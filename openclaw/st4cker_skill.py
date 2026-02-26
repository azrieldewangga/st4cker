#!/usr/bin/env python3
"""
OpenClaw St4cker Skill - The Brain
Fully conversational AI for St4cker reminder system

Persona: Azriel (Zril) - teman kuliah yang friendly & supportive
"""

import asyncio
import os
import re
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

import httpx
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel

# Import modules
from nlu import NLU
from message_gen import MessageGenerator
from context import ContextStore
from tools import St4ckerTools
from attendance_nlu import detect_attendance_intent
from course_manager_nlu import parse_course_management
from smart_reminder_client import send_attendance_intent_sync, send_course_management_sync

# Configuration
# Default ke telegram-bot API (port 3000) - BUKAN localhost:3001
ST4CKER_API_URL = os.getenv("ST4CKER_API_URL", "http://103.127.134.173:3000")
ST4CKER_API_KEY = os.getenv("ST4CKER_API_KEY", "")
OPENCLAW_API_KEY = os.getenv("OPENCLAW_API_KEY", "")

# Initialize components
nlu = NLU()
msg_gen = MessageGenerator()
context_store = ContextStore()
tools = St4ckerTools(ST4CKER_API_URL, ST4CKER_API_KEY)

# =============================================================================
# Helper: Log reminder to St4cker API (so followup-bot knows reminder was sent)
# =============================================================================
async def log_reminder_to_st4cker(user_id: str, reminder_type: str, message_content: str = "", schedule_id: str = None):
    """
    Log reminder to St4cker API so followup-bot can check if initial reminder was sent.
    This is crucial to prevent follow-up reminders when initial reminder was skipped.
    """
    try:
        async with httpx.AsyncClient() as client:
            payload = {
                "userId": user_id,
                "type": reminder_type,
                "messageContent": message_content[:500] if message_content else None  # Limit size
            }
            if schedule_id:
                payload["scheduleId"] = schedule_id
            
            response = await client.post(
                f"{ST4CKER_API_URL}/api/v1/reminders/log",
                json=payload,
                headers={"x-api-key": ST4CKER_API_KEY, "Content-Type": "application/json"},
                timeout=5
            )
            
            if response.status_code == 200:
                print(f"[LogReminder] Success: {reminder_type} for {user_id}")
                return True
            else:
                print(f"[LogReminder] Failed: {response.status_code} - {response.text}")
                return False
    except Exception as e:
        print(f"[LogReminder] Error: {e}")
        return False

# Pydantic Models
class ReminderTrigger(BaseModel):
    event: str
    source: str  # "reminder-bot" | "followup-bot"
    trigger_type: str  # "schedule" | "task_list" | "night_preview" | "followup" | "crisis_check"
    trigger_time: str
    user_id: str
    phone: str
    data: Dict[str, Any]

class ChatRequest(BaseModel):
    phone: str
    user_id: str
    message: str
    context: Optional[Dict[str, Any]] = None

class OpenClawResponse(BaseModel):
    reply: str
    action: str = "send"  # "send" | "skip" | "delay"
    context_update: Optional[Dict[str, Any]] = None
    tools_to_call: Optional[List[Dict]] = None
    done: bool = False

# FastAPI App
app = FastAPI(
    title="OpenClaw St4cker Brain",
    description="Conversational AI for St4cker - Persona: Azriel (Zril)",
    version="2.0.0"
)

def verify_api_key(x_api_key: Optional[str] = Header(None)):
    if OPENCLAW_API_KEY and x_api_key != OPENCLAW_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return True

# =============================================================================
# ENDPOINT 1: Reminder Trigger (dari reminder-bot & followup-bot)
# =============================================================================

@app.post("/webhook/st4cker-reminder-trigger")
async def handle_reminder_trigger(
    data: ReminderTrigger, 
    _: bool = Depends(verify_api_key)
) -> OpenClawResponse:
    """
    Handle trigger dari reminder-bot & followup-bot.
    OpenClaw decide: kirim / skip / apa pesannya.
    """
    print(f"[Trigger] {data.source} - {data.trigger_type} at {data.trigger_time}")
    
    # Get or create user context
    user_ctx = context_store.get_context(data.user_id)
    
    # OpenClaw decide what to do
    decision = await decide_reminder_action(data, user_ctx)
    
    if decision["action"] == "skip":
        return OpenClawResponse(
            reply="",
            action="skip",
            done=True
        )
    
    # Generate message with persona Azriel
    message = await msg_gen.generate(data.trigger_type, data.data, user_ctx)
    
    # LOG THE REMINDER - This is crucial for followup-bot to know if initial reminder was sent
    # Determine the log type based on trigger_type
    log_type_map = {
        "task_list": "task_daily",
        "followup": "task_followup", 
        "crisis_check": "crisis_check",
        "night_preview": "night_preview",
        "schedule": "schedule"
    }
    log_type = log_type_map.get(data.trigger_type, data.trigger_type)
    
    # Get schedule_id if this is a schedule reminder
    schedule_id = None
    if data.trigger_type == "schedule" and data.data:
        schedule_id = data.data.get("schedule_id") or data.data.get("id")
    
    # Log async (don't wait for it to complete)
    asyncio.create_task(log_reminder_to_st4cker(
        user_id=data.user_id,
        reminder_type=log_type,
        message_content=message,
        schedule_id=schedule_id
    ))
    
    # Update context - simpan course untuk tracking attendance
    context_store.update_context(data.user_id, {
        "last_trigger": data.trigger_type,
        "last_trigger_time": data.trigger_time,
        "last_data": data.data,
        "awaiting_reply": True,
        "last_course": data.data.get("course_name", "")
    })
    
    return OpenClawResponse(
        reply=message,
        action="send",
        context_update={"awaiting_reply": True},
        done=True
    )

async def decide_reminder_action(trigger: ReminderTrigger, user_ctx: Dict) -> Dict:
    """
    OpenClaw decision logic: mau kirim reminder atau skip?
    """
    trigger_type = trigger.trigger_type
    data = trigger.data
    
    # Check skip preferences
    today = datetime.now().strftime('%Y-%m-%d')
    
    if trigger_type == "schedule":
        course = data.get("course", "")
        
        # Check if this course is skipped for today
        if user_ctx.get("skip_preferences", {}).get(today, {}).get(course, {}).get("skipped"):
            print(f"[Decision] Skip {course} - user preference")
            return {"action": "skip"}
        
        # Check if full day is skipped
        if user_ctx.get("skip_preferences", {}).get(today, {}).get("_full_day"):
            print(f"[Decision] Skip all - full day skip")
            return {"action": "skip"}
    
    if trigger_type == "task_list":
        tasks = data.get("tasks", [])
        if not tasks:
            return {"action": "skip"}
    
    # Default: send
    return {"action": "send"}

# =============================================================================
# ENDPOINT 2: Universal Chat Handler (semua reply user kesini)
# =============================================================================

@app.post("/api/v1/st4cker/chat")
async def handle_chat(
    data: ChatRequest,
    _: bool = Depends(verify_api_key)
) -> OpenClawResponse:
    """
    Universal chat handler - semua reply user masuk sini.
    Conversational NLU - bisa tanya balik untuk clarification.
    """
    print(f"[Chat] {data.user_id}: {data.message}")
    
    # Get user context
    user_ctx = context_store.get_context(data.user_id)
    
    # Merge context dari request
    if data.context:
        user_ctx.update(data.context)
    
    # Check if we're awaiting clarification
    if user_ctx.get("awaiting_clarification"):
        return await handle_clarification_response(data, user_ctx)
    
    # Parse intent dengan NLU conversational
    intent = nlu.parse(data.message, user_ctx)
    print(f"[Intent] Detected: {intent.get('intent')} for message: '{data.message}'")
    
    # Kalau ambiguous, ask for clarification
    if intent.get("needs_clarification"):
        return await ask_clarification(intent, user_ctx)
    
    # Handle clear intent
    return await handle_clear_intent(intent, data, user_ctx)

async def handle_clarification_response(data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """
    Handle response ke clarification question sebelumnya.
    """
    clarification_type = user_ctx.get("clarification_type")
    
    if clarification_type == "cancel_scope":
        # User replied ke pertanyaan "semua atau yang ini?"
        scope = nlu.extract_scope(data.message)
        
        if scope:
            # Apply skip preference
            today = datetime.now().strftime('%Y-%m-%d')
            affected_course = user_ctx.get("affected_course", "")
            
            if scope == "single_course":
                context_store.update_skip_preference(
                    data.user_id, today, affected_course, True, "user_cancelled"
                )
                
                # Tanyain matkul berikutnya
                reply = f"Oke Zril, {affected_course} aku skip 👍\n\n"
                
                # Check if there are more courses today
                next_course = user_ctx.get("next_course")
                if next_course:
                    reply += f"Jam {next_course['time']} ada {next_course['name']} di {next_course['room']} tetep jadi kan?"
                else:
                    reply += "Istirahat dulu ya! ☕"
                
                return OpenClawResponse(
                    reply=reply,
                    action="send",
                    context_update={
                        "awaiting_clarification": False,
                        f"skip_{today}_{affected_course}": True
                    },
                    done=False
                )
            
            elif scope == "full_day":
                context_store.update_skip_preference(
                    data.user_id, today, "_full_day", True, "user_cancelled"
                )
                
                return OpenClawResponse(
                    reply="Oke Zril, hari ini full libur ya 👍\n\nIstirahat dulu, nanti aku kabarin kalo ada tugas deadline dekat ya.",
                    action="send",
                    context_update={
                        "awaiting_clarification": False,
                        f"skip_{today}_full": True
                    },
                    done=True
                )
    
    elif clarification_type == "help_type":
        # User replied ke pertanyaan "bagian mana yang stuck?"
        help_type = nlu.extract_help_type(data.message)
        
        reply = msg_gen.generate_help_response(help_type, user_ctx)
        
        return OpenClawResponse(
            reply=reply,
            action="send",
            context_update={"awaiting_clarification": False},
            done=False
        )
    
    # Default: treat as new message
    user_ctx["awaiting_clarification"] = False
    intent = nlu.parse(data.message, user_ctx)
    return await handle_clear_intent(intent, data, user_ctx)

async def ask_clarification(intent: Dict, user_ctx: Dict) -> OpenClawResponse:
    """
    Ask user for clarification kalo intent ambiguous - dengan AI-generated question.
    """
    clarification_q = intent.get("clarification_question")
    
    if clarification_q == "scope":
        affected = intent.get("extracted", {}).get("affected_course", "matkul ini")
        
        # AI generate clarification question
        reply = await msg_gen.generate("conversation", {
            "user_message": f"ask clarification for skip scope: {affected}",
            "intent": "clarification_scope"
        }, user_ctx)
        
        return OpenClawResponse(
            reply=reply,
            action="send",
            context_update={
                "awaiting_clarification": True,
                "clarification_type": "cancel_scope",
                "affected_course": affected
            },
            done=False
        )
    
    elif clarification_q == "help_type":
        # AI generate clarification question
        reply = await msg_gen.generate("conversation", {
            "user_message": "ask clarification for help type",
            "intent": "clarification_help"
        }, user_ctx)
        
        return OpenClawResponse(
            reply=reply,
            action="send",
            context_update={
                "awaiting_clarification": True,
                "clarification_type": "help_type"
            },
            done=False
        )
    
    # Default clarification dengan AI
    reply = await msg_gen.generate("conversation", {
        "user_message": "ambiguous intent",
        "intent": "clarification_default"
    }, user_ctx)
    
    return OpenClawResponse(
        reply=reply,
        action="send",
        done=False
    )

async def handle_attendance_intent(attendance_result: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """
    Handle attendance intent dengan SmartReminder integration.
    Mengerti konteks seperti "5 menit lg berangkat" = confirmed
    """
    intent = attendance_result["intent"]
    details = attendance_result.get("details", {})
    confidence = attendance_result["confidence"]
    
    # Get course info dari context
    course = user_ctx.get("last_course", "")
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Kirim intent ke SmartReminder (sync karena ini blocking operation)
    try:
        sm_result = send_attendance_intent_sync(
            message=data.message,
            intent=intent,
            details=details
        )
        print(f"[SmartReminder] Intent sent: {intent}, response: {sm_result}")
    except Exception as e:
        print(f"[SmartReminder] Error: {e}")
    
    if intent == "confirmed":
        # Log attendance
        ctx_obj = context_store.get_user_context_obj(data.user_id)
        ctx_obj.log_attendance(today, course, "confirmed")
        
        # Update context
        context_store.update_context(data.user_id, {
            "confirmed_attendance": True,
            "awaiting_reply": False,
            "use_short_reminder": True
        })
        
        # Generate response - simple acknowledgement
        # Note: delay_minutes hanya informasi, tidak mengubah jadwal/reminder
        reply = await msg_gen.generate("user_confirm", {
            "course": course,
            "context": "attendance_confirmed"
        }, user_ctx)
        
        return OpenClawResponse(
            reply=reply,
            action="send",
            context_update={"confirmed_attendance": True, "use_short_reminder": True},
            done=True
        )
    
    elif intent == "declined":
        # User tidak jadi berangkat
        context_store.update_context(data.user_id, {
            "confirmed_attendance": False,
            "awaiting_reply": False,
            "use_short_reminder": False
        })
        
        reply = await msg_gen.generate("user_skip", {
            "course": course,
            "context": "skip",
            "reason": details.get("reason", "")
        }, user_ctx)
        
        return OpenClawResponse(
            reply=reply,
            action="send",
            done=True
        )
    
    elif intent == "rescheduled":
        reply = f"Oke, pindah ke {details.get('suggested_time', 'nanti')} ya. Aku update jadwalnya 👍"
        return OpenClawResponse(
            reply=reply,
            action="send",
            done=True
        )
    
    return OpenClawResponse(
        reply="Hmmm, bisa jelasin lagi?",
        action="send",
        done=False
    )


async def handle_course_management_intent(course_result: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """
    Handle course management intent (skip, online, reschedule).
    Response digenerate dengan AI (bukan template kaku).
    """
    intent = course_result["intent"]
    course = course_result["course"]
    date = course_result["date"]
    details = course_result.get("details", {})
    
    # Send to SmartReminder
    try:
        sm_result = send_course_management_sync(
            intent=intent,
            course=course,
            date=date,
            details=details
        )
        print(f"[SmartReminder] Course mgmt sent: {intent} for {course}")
    except Exception as e:
        print(f"[SmartReminder] Error: {e}")
    
    # Generate AI response (not template!)
    reply = await msg_gen.generate("course_mgmt", {
        "intent": intent,
        "course": course,
        "date": date,
        "details": details,
        "user_message": data.message
    }, user_ctx)
    
    return OpenClawResponse(
        reply=reply,
        action="send",
        done=True
    )


async def handle_clear_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """
    Handle intent yang sudah clear (gak perlu clarification).
    """
    intent_type = intent.get("intent")
    
    # Check for course management intent FIRST
    course_result = parse_course_management(data.message)
    if course_result["confidence"] >= 0.5:
        return await handle_course_management_intent(course_result, data, user_ctx)
    
    # Check for attendance intent (priority untuk reminder responses)
    attendance_result = detect_attendance_intent(data.message, user_ctx)
    if attendance_result["confidence"] >= 0.5:
        return await handle_attendance_intent(attendance_result, data, user_ctx)
    
    if intent_type == "cancel":
        return await handle_cancel_intent(intent, data, user_ctx)
    
    elif intent_type == "confirm_attendance":
        return await handle_confirm_intent(intent, data, user_ctx)
    
    elif intent_type == "update_progress":
        return await handle_progress_intent(intent, data, user_ctx)
    
    elif intent_type == "need_help":
        return await handle_need_help_intent(intent, data, user_ctx)
    
    elif intent_type == "select_task":
        return await handle_select_task_intent(intent, data, user_ctx)
    
    elif intent_type == "new_task":
        return await handle_new_task_intent(intent, data, user_ctx)
    
    elif intent_type == "resume_attendance":
        return await handle_resume_intent(intent, data, user_ctx)
    
    elif intent_type == "list_tasks":
        return await handle_list_tasks_intent(intent, data, user_ctx)
    
    elif intent_type == "list_schedules":
        return await handle_list_schedules_intent(intent, data, user_ctx)
    
    elif intent_type == "check_balance":
        return await handle_check_balance_intent(intent, data, user_ctx)
    
    elif intent_type == "list_projects":
        return await handle_list_projects_intent(intent, data, user_ctx)
    
    elif intent_type == "list_transactions":
        return await handle_list_transactions_intent(intent, data, user_ctx)
    
    elif intent_type == "create_task":
        return await handle_create_task_intent(intent, data, user_ctx)
    
    elif intent_type == "create_project":
        # Handle priority clarification separately
        if user_ctx.get("clarification_type") == "project_priority":
            return await handle_project_priority_clarification(intent, data, user_ctx)
        return await handle_create_project_intent(intent, data, user_ctx)
    
    elif intent_type == "create_transaction":
        # Handle amount clarification
        if user_ctx.get("clarification_type") == "transaction_amount":
            return await handle_transaction_amount_clarification(intent, data, user_ctx)
        return await handle_create_transaction_intent(intent, data, user_ctx)
    
    elif intent_type == "log_progress":
        # Handle project selection and progress value clarification
        if user_ctx.get("clarification_type") == "select_project_for_progress":
            return await handle_select_project_for_progress(intent, data, user_ctx)
        elif user_ctx.get("clarification_type") == "progress_value":
            return await handle_progress_value_clarification(intent, data, user_ctx)
        return await handle_log_progress_intent(intent, data, user_ctx)
    
    # Fallback
    return OpenClawResponse(
        reply=f"Halo Zril! 👋 Aku dengerin, tapi belum ngerti maksudnya 😅\n\nAda yang bisa aku bantu?",
        action="send",
        done=False
    )

async def handle_cancel_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle cancel/reschedule intent - dengan AI-generated response."""
    extracted = intent.get("extracted", {})
    scope = extracted.get("scope", "unknown")
    reason = extracted.get("reason", "")
    
    today = datetime.now().strftime('%Y-%m-%d')
    current_course = user_ctx.get("last_course", "")
    
    # Detect if this is reschedule (pindah) vs permanent skip
    msg_lower = data.message.lower()
    is_reschedule = any(x in msg_lower for x in [
        "pindah", "geser", "reschedule", "diundur", "dimajukan",
        "minggu depan", "besok aja", "hari lain", "jam lain"
    ])
    
    if scope == "full_day":
        # Full day skip - reminder berikutnya tetap 90 menit (default)
        context_store.update_skip_preference(data.user_id, today, "_full_day", True, reason, is_temporary=False)
        
        # AI generate response
        reply = await msg_gen.generate("user_skip", {
            "course": "full_day",
            "context": "full_day_skip",
            "reason": reason
        }, user_ctx)
        
        return OpenClawResponse(
            reply=reply,
            action="send",
            context_update={"awaiting_reply": False},
            done=True
        )
    
    elif scope == "single_course":
        course = extracted.get("course", "") or current_course
        
        if is_reschedule:
            # Reschedule sementara
            context_store.update_skip_preference(data.user_id, today, course, True, f"rescheduled: {reason}", is_temporary=True)
            skip_context = "reschedule"
        else:
            # Skip permanen
            context_store.update_skip_preference(data.user_id, today, course, True, reason, is_temporary=False)
            skip_context = "skip"
        
        # AI generate response
        reply = await msg_gen.generate("user_skip", {
            "course": course,
            "context": skip_context,
            "reason": reason
        }, user_ctx)
        
        return OpenClawResponse(
            reply=reply,
            action="send",
            done=False
        )
    
    # Ambiguous - should have been caught, but fallback
    return await ask_clarification({
        "needs_clarification": True,
        "clarification_question": "scope",
        "extracted": {"affected_course": user_ctx.get("last_course", "matkul ini")}
    }, user_ctx)

async def handle_confirm_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle confirm otw."""
    # Get course from user_ctx or from scheduleInfo in context
    course = user_ctx.get("last_course", "")
    if not course:
        schedule_info = user_ctx.get("scheduleInfo", {})
        course = schedule_info.get("course_name", "matkul")
    if not course:
        course = "matkul"
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Log attendance sebagai 'confirmed'
    ctx_obj = context_store.get_user_context_obj(data.user_id)
    ctx_obj.log_attendance(today, course, "confirmed")
    print(f"[Attendance Log] {data.user_id} - {course} @ {today}: confirmed")
    
    # Generate AI response (user interaction - always AI)
    reply = await msg_gen.generate("user_confirm", {
        "course": course,
        "context": "attendance_confirmed"
    }, user_ctx)
    
    # Update context
    context_store.update_context(data.user_id, {
        "confirmed_attendance": True,
        "awaiting_reply": False,
        "use_short_reminder": True
    })
    
    return OpenClawResponse(
        reply=reply,
        action="send",
        context_update={"confirmed_attendance": True, "use_short_reminder": True},
        done=True
    )

async def handle_progress_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle progress update."""
    extracted = intent.get("extracted", {})
    progress = extracted.get("progress", 0)
    task = extracted.get("task", user_ctx.get("active_task", {}))
    
    # Update via API
    if task and task.get("id"):
        await tools.update_task_progress(data.user_id, task["id"], progress)
    
    # Generate response
    previous_progress = user_ctx.get("last_progress", 0)
    delta = progress - previous_progress
    
    reply = f"Oke progress! 🎉\n\n"
    
    if delta > 0:
        reply += f"Dari {previous_progress}% jadi {progress}% (+{delta}%)\n\n"
    else:
        reply += f"Sekarang {progress}%\n\n"
    
    # Context-aware response
    deadline = task.get("deadline", "")
    if deadline:
        days_left = (datetime.strptime(deadline, '%Y-%m-%d') - datetime.now()).days
        
        if days_left == 0:
            if progress < 80:
                reply += "Besok deadline nih! Masih ada waktu ~2 jam ya, semangat! 💪"
            else:
                reply += "Besok deadline dan udah {progress}%! Tinggal finising touch ya 🎯"
        elif days_left == 1:
            reply += f"Lusa deadline, progress {progress}%. On track! 👍"
        else:
            reply += f"Masih ada waktu {days_left} hari, santai tapi jangan mager ya 😄"
    
    # Update context
    context_store.update_context(data.user_id, {
        "last_progress": progress,
        "awaiting_reply": False
    })
    
    return OpenClawResponse(
        reply=reply,
        action="send",
        context_update={"last_progress": progress},
        done=True
    )

async def handle_need_help_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle user stuck/need help."""
    return await ask_clarification({
        "needs_clarification": True,
        "clarification_question": "help_type"
    }, user_ctx)

async def handle_select_task_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle user select task dari list."""
    extracted = intent.get("extracted", {})
    task_id = extracted.get("task_id")
    task_name = extracted.get("task_name", "")
    
    # Update status ke in_progress
    if task_id:
        await tools.update_task_status(data.user_id, task_id, "in_progress")
    
    reply = f"✅ Oke Zril! Fokus ngerjain **{task_name}** ya!\n\n"
    
    # Update context
    context_store.update_context(data.user_id, {
        "active_task": {"id": task_id, "name": task_name},
        "awaiting_reply": False
    })
    
    return OpenClawResponse(
        reply=reply,
        action="send",
        context_update={"active_task": {"id": task_id, "name": task_name}},
        done=True
    )

async def handle_new_task_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle user report new task."""
    extracted = intent.get("extracted", {})
    course = extracted.get("course", "")
    deadline = extracted.get("deadline", "")
    
    reply = f"Waduh baru tau! 📝\n\n"
    reply += f"Oke aku catet: Tugas **{course}** deadline {deadline}.\n\n"
    reply += "Ini tugas individual atau kelompok? Estimasi berapa jam?"
    
    return OpenClawResponse(
        reply=reply,
        action="send",
        context_update={
            "awaiting_clarification": True,
            "clarification_type": "new_task_details",
            "temp_new_task": extracted
        },
        done=False
    )

async def handle_resume_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle user resume after cancel."""
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Clear skip preferences
    context_store.clear_skip_preference(data.user_id, today)
    
    reply = "Oke Zril! Balik mode kuliah ya 👍\n\n"
    
    # Check remaining schedules
    remaining = user_ctx.get("remaining_schedules", [])
    if remaining:
        next_sched = remaining[0]
        reply += f"Aku ingetin lagi jam {next_sched['time']} ada {next_sched['name']} ya!"
    
    return OpenClawResponse(
        reply=reply,
        action="send",
        context_update={"skip_cancelled": True},
        done=True
    )

# =============================================================================
# ENDPOINT 3: Incoming Message from WA Gateway
# =============================================================================

class IncomingMessage(BaseModel):
    from_phone: str
    message: str
    timestamp: Optional[str] = None

@app.post("/webhook/st4cker-incoming")
async def handle_incoming_message(
    data: IncomingMessage,
    _: bool = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Handle incoming message dari WA Gateway (generic endpoint).
    Forward ke chat handler dengan user_id yang sesuai.
    """
    print(f"[Incoming WA] {data.from_phone}: {data.message}")
    
    # Map phone to user_id
    user_id = TARGET_USER_ID if TARGET_USER_ID else "1168825716"
    
    # Create ChatRequest
    chat_request = ChatRequest(
        phone=data.from_phone,
        user_id=user_id,
        message=data.message,
        context={}
    )
    
    # Handle dengan chat handler
    response = await handle_chat(chat_request, _)
    
    return {
        "success": True,
        "reply": response.reply,
        "action": response.action,
        "user_id": user_id
    }

# Legacy endpoints for backward compatibility with wa-gateway
class ScheduleReplyRequest(BaseModel):
    phone: str
    userId: str
    message: str
    context: Optional[Dict[str, Any]] = None

class TaskReplyRequest(BaseModel):
    phone: str
    userId: str
    message: str
    context: Optional[Dict[str, Any]] = None

@app.post("/api/v1/st4cker/schedule-reply")
async def handle_schedule_reply(
    data: ScheduleReplyRequest,
    _: bool = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Handle schedule reminder reply dari WA Gateway (backward compatible).
    """
    print(f"[Schedule Reply] {data.userId}: {data.message}")
    
    chat_request = ChatRequest(
        phone=data.phone,
        user_id=data.userId,
        message=data.message,
        context=data.context or {}
    )
    
    response = await handle_chat(chat_request, _)
    
    return {
        "reply": response.reply,
        "action": response.action,
        "done": response.done,
        "confirmed": response.context_update.get("confirmed_attendance") if response.context_update else False
    }

@app.post("/api/v1/st4cker/task-reply")
async def handle_task_reply(
    data: TaskReplyRequest,
    _: bool = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Handle task reminder reply dari WA Gateway (backward compatible).
    """
    print(f"[Task Reply] {data.userId}: {data.message}")
    
    chat_request = ChatRequest(
        phone=data.phone,
        user_id=data.userId,
        message=data.message,
        context=data.context or {}
    )
    
    response = await handle_chat(chat_request, _)
    
    return {
        "reply": response.reply,
        "action": response.action,
        "done": response.done,
        "clearContext": response.done
    }

# =============================================================================
# ENDPOINT 4: Attendance API (untuk reminder-bot query)
# =============================================================================

@app.get("/api/v1/attendance/get")
async def get_attendance(
    course: str,
    date: str,
    user_id: Optional[str] = None,
    _: bool = Depends(verify_api_key)
) -> Dict[str, str]:
    """
    Get attendance status untuk course tertentu di date tertentu.
    Digunakan oleh reminder-bot untuk decide 15min vs 90min reminder.
    """
    if not user_id:
        user_id = TARGET_USER_ID if TARGET_USER_ID else "1168825716"
    
    ctx = context_store.get_context(user_id)
    attendance_log = ctx.get("attendance_log", {})
    
    date_log = attendance_log.get(date, {})
    course_status_obj = date_log.get(course, {})
    course_status = course_status_obj.get("status", "unknown") if isinstance(course_status_obj, dict) else course_status_obj
    
    print(f"[Attendance API] {user_id} - {course} @ {date}: {course_status}")
    
    return {
        "user_id": user_id,
        "course": course,
        "date": date,
        "status": course_status  # "confirmed" | "skipped" | "unknown"
    }

@app.post("/api/v1/attendance/log")
async def log_attendance(
    course: str,
    date: str,
    status: str,  # "confirmed" | "skipped"
    user_id: Optional[str] = None,
    _: bool = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Log attendance status.
    Bisa dipakai untuk manual update atau testing.
    """
    if not user_id:
        user_id = TARGET_USER_ID if TARGET_USER_ID else "1168825716"
    
    ctx_obj = context_store.get_user_context_obj(user_id)
    ctx_obj.log_attendance(date, course, status)
    
    print(f"[Attendance Log] {user_id} - {course} @ {date}: {status}")
    
    return {
        "success": True,
        "user_id": user_id,
        "course": course,
        "date": date,
        "status": status
    }

# =============================================================================
# NEW INTENT HANDLERS (List Tasks, Schedules, Balance, Projects, Transactions)
# =============================================================================

async def handle_list_tasks_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle list tasks intent."""
    extracted = intent.get("extracted", {})
    status_filter = extracted.get("status")
    course_filter = extracted.get("course")
    
    # Call API
    result = await tools.get_tasks(status=status_filter, course=course_filter)
    
    if result.get("error"):
        return OpenClawResponse(
            reply=f"Aduh zril, ada error pas ambil data tugas 😅\n\nCoba lagi nanti ya!",
            action="send",
            done=True
        )
    
    tasks = result.get("data", [])
    count = result.get("count", 0)
    
    if count == 0:
        return OpenClawResponse(
            reply=f"Santai zril, gak ada tugas pending! ✌🏻\n\nMau nambah tugas baru?",
            action="send",
            done=True
        )
    
    # Format task list dengan persona kimi (minimalist, bold, ✌🏻)
    reply_lines = [f"zril, ada *{count} tugas* nih ✌🏻\n"]
    
    now = datetime.now()
    for i, task in enumerate(tasks[:10], 1):  # Limit 10 tasks
        title = task.get("title", "Tugas")
        course = task.get("course", "")
        deadline_str = task.get("deadline", "")
        status = task.get("status", "pending")
        
        # Calculate days left
        days_left = None
        if deadline_str:
            try:
                deadline = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
                days_left = (deadline - now).days
            except:
                pass
        
        # Format status icon
        if status == "completed":
            icon = "✅"
        elif days_left is not None and days_left < 0:
            icon = "🔥"
        elif days_left is not None and days_left <= 1:
            icon = "⚠️"
        else:
            icon = "⬜"
        
        # Format deadline text
        if days_left is not None:
            if days_left < 0:
                deadline_text = f"telat {abs(days_left)} hari"
            elif days_left == 0:
                deadline_text = "hari ini"
            elif days_left == 1:
                deadline_text = "besok"
            else:
                deadline_text = f"{days_left} hari lagi"
        else:
            deadline_text = "deadline TBD"
        
        reply_lines.append(f"{i}. {icon} *{title}* - {course}")
        reply_lines.append(f"   _{deadline_text}_")
    
    if count > 10:
        reply_lines.append(f"\n...dan {count - 10} tugas lainnya")
    
    reply_lines.append("\nmau *update progress* atau pilih nomor buat dikerjain?")
    
    return OpenClawResponse(
        reply="\n".join(reply_lines),
        action="send",
        done=True
    )

async def handle_list_schedules_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle list schedules intent."""
    extracted = intent.get("extracted", {})
    day = extracted.get("day")
    
    # Map day ke parameter API
    day_param = None
    if day == "today":
        day_param = None  # API akan pakai default (semua)
    elif day == "tomorrow":
        # Hitung hari besok
        tomorrow = datetime.now() + timedelta(days=1)
        day_names = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
        day_param = day_names[tomorrow.weekday()]
    elif day:
        day_param = day
    
    # Call API
    result = await tools.get_schedules(day=day_param)
    
    if result.get("error"):
        return OpenClawResponse(
            reply=f"Error ambil jadwal zril 😅\n\nCoba lagi ya!",
            action="send",
            done=True
        )
    
    schedules = result.get("data", [])
    count = result.get("count", 0)
    
    if count == 0:
        return OpenClawResponse(
            reply=f"zril, gak ada jadwal kuliah! ✌🏻\n\nLibur nih, santai aja~",
            action="send",
            done=True
        )
    
    # Format schedule list
    reply_lines = [f"jadwal kuliah zril ✌🏻\n"]
    
    current_day = None
    for sched in schedules:
        day_name = sched.get("dayName", "")
        course = sched.get("courseName", "")
        start_time = sched.get("startTime", "")
        end_time = sched.get("endTime", "")
        room = sched.get("room", "")
        
        # Group by day
        if day_name != current_day:
            reply_lines.append(f"\n*{day_name}*")
            current_day = day_name
        
        time_str = f"{start_time}-{end_time}" if end_time else start_time
        room_str = f" ({room})" if room else ""
        
        reply_lines.append(f"  • {time_str} - *{course}*{room_str}")
    
    return OpenClawResponse(
        reply="\n".join(reply_lines),
        action="send",
        done=True
    )

async def handle_check_balance_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle check balance intent."""
    # Call API
    result = await tools.get_balance()
    
    if result.get("error"):
        return OpenClawResponse(
            reply=f"Error cek saldo zril 😅\n\nCoba lagi ya!",
            action="send",
            done=True
        )
    
    balance_data = result.get("data", {})
    formatted_balance = balance_data.get("formattedBalance", "Rp0")
    semester = balance_data.get("semester", "-")
    
    # Get summary for additional info
    summary_result = await tools.get_summary()
    recent_tx = []
    if summary_result.get("success"):
        recent_tx = summary_result.get("data", {}).get("recentTransactions", [])
    
    reply_lines = [
        f"zril, saldo kamu ✌🏻",
        f"",
        f"💰 *{formatted_balance}*",
        f"📚 Semester: {semester}",
    ]
    
    if recent_tx:
        reply_lines.append(f"\n_transaksi terakhir:_")
        for tx in recent_tx[:3]:
            tx_type = tx.get("type", "")
            amount = tx.get("amount", 0)
            category = tx.get("category", "")
            icon = "💸" if tx_type == "expense" else "💵"
            reply_lines.append(f"{icon} {category}: Rp{abs(amount):,}")
    
    reply_lines.append(f"\nmau *catat transaksi* baru?")
    
    return OpenClawResponse(
        reply="\n".join(reply_lines),
        action="send",
        done=True
    )

async def handle_list_projects_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle list projects intent."""
    result = await tools.get_projects(status="active")
    
    if result.get("error"):
        return OpenClawResponse(
            reply=f"Error ambil project zril 😅\n\nCoba lagi ya!",
            action="send",
            done=True
        )
    
    projects = result.get("data", [])
    count = result.get("count", 0)
    
    if count == 0:
        return OpenClawResponse(
            reply=f"zril, gak ada project aktif ✌🏻\n\nMau mulai project baru?",
            action="send",
            done=True
        )
    
    reply_lines = [f"project aktif zril ✌🏻\n"]
    
    for i, project in enumerate(projects[:5], 1):
        title = project.get("title", "Project")
        progress = project.get("totalProgress", 0)
        project_type = project.get("type", "personal")
        course = project.get("courseName", "")
        
        # Progress bar
        progress_bar = "█" * (progress // 10) + "░" * (10 - progress // 10)
        
        type_icon = "👤" if project_type == "personal" else "📚"
        course_str = f" ({course})" if course else ""
        
        reply_lines.append(f"{i}. {type_icon} *{title}*{course_str}")
        reply_lines.append(f"   {progress_bar} {progress}%")
    
    if count > 5:
        reply_lines.append(f"\n...dan {count - 5} project lainnya")
    
    reply_lines.append(f"\nmau *update progress* project?")
    
    return OpenClawResponse(
        reply="\n".join(reply_lines),
        action="send",
        done=True
    )

async def handle_list_transactions_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle list transactions intent."""
    result = await tools.get_transactions(limit=10)
    
    if result.get("error"):
        return OpenClawResponse(
            reply=f"Error ambil transaksi zril 😅\n\nCoba lagi ya!",
            action="send",
            done=True
        )
    
    transactions = result.get("data", [])
    count = result.get("count", 0)
    
    if count == 0:
        return OpenClawResponse(
            reply=f"zril, belum ada transaksi tercatat ✌🏻\n\nMau catat pengeluaran?",
            action="send",
            done=True
        )
    
    reply_lines = [f"transaksi terakhir zril ✌🏻\n"]
    
    total_income = 0
    total_expense = 0
    
    for tx in transactions[:5]:
        tx_type = tx.get("type", "")
        amount = tx.get("amount", 0)
        category = tx.get("category", "")
        title = tx.get("title", "")
        date = tx.get("date", "")[:10]  # YYYY-MM-DD
        
        if tx_type == "income":
            icon = "💵"
            total_income += amount
            amount_str = f"+Rp{amount:,.0f}"
        else:
            icon = "💸"
            total_expense += abs(amount)
            amount_str = f"-Rp{abs(amount):,.0f}"
        
        reply_lines.append(f"{icon} *{amount_str}* - {category}")
        if title and title != category:
            reply_lines.append(f"   _{title}_")
    
    reply_lines.append(f"\n📊 Total: +Rp{total_income:,.0f} | -Rp{total_expense:,.0f}")
    reply_lines.append(f"\nmau *catat transaksi* baru?")
    
    return OpenClawResponse(
        reply="\n".join(reply_lines),
        action="send",
        done=True
    )


# =============================================================================
# CREATE INTENT HANDLERS (Task, Project, Transaction, Progress Log)
# =============================================================================

async def handle_create_task_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle create task intent - multi-step clarification seperti Telegram Bot."""
    msg_lower = data.message.lower()
    
    # Check if this is a clarification response
    if user_ctx.get("clarification_type") == "new_task_details":
        temp_task = user_ctx.get("temp_new_task", {})
        
        # Parse course dari jawaban user
        course = nlu._extract_course(data.message)
        if not course:
            # Coba cari dari known courses
            courses = ["kjk", "komber", "ppl", "sister", "pemjar", "wspk"]
            for c in courses:
                if c in msg_lower:
                    course = c
                    break
        
        # Parse deadline dari jawaban user
        deadline = None
        if "besok" in msg_lower:
            deadline = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        elif "lusa" in msg_lower:
            deadline = (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d')
        elif "minggu" in msg_lower:
            deadline = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        else:
            # Coba parse format YYYY-MM-DD
            import re
            date_match = re.search(r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})', msg_lower)
            if date_match:
                deadline = f"{date_match.group(1)}-{date_match.group(2):0>2}-{date_match.group(3):0>2}"
        
        # Validasi: Course wajib
        if not course:
            return OpenClawResponse(
                reply=f"Zril, aku belum ngerti matkulnya apa 😅\n\nCoba sebutin matkulnya (misal: KJK, PPL, Sister, dll)",
                action="send",
                done=False
            )
        
        # Validasi: Deadline wajib
        if not deadline:
            return OpenClawResponse(
                reply=f"Oke, matkulnya *{course.upper()}*. Deadline kapan?\n\nFormat: besok, lusa, atau YYYY-MM-DD",
                action="send",
                context_update={
                    "awaiting_clarification": True,
                    "clarification_type": "new_task_details",
                    "temp_new_task": {**temp_task, "course": course}
                },
                done=False
            )
        
        # Validasi: Tipe tugas
        task_type = temp_task.get("type")
        if not task_type:
            # Deteksi dari pesan
            if any(x in msg_lower for x in ["laporan pendahuluan", "lp"]): 
                task_type = "Laporan Pendahuluan"
            elif any(x in msg_lower for x in ["laporan sementara", "ls"]):
                task_type = "Laporan Sementara"
            elif any(x in msg_lower for x in ["laporan resmi", "lr"]):
                task_type = "Laporan Resmi"
            elif "praktikum" in msg_lower:
                task_type = "Tugas"
            else:
                # Tanyakan tipe tugas
                return OpenClawResponse(
                    reply=f"Oke, tugas *{course.upper()}* deadline *{deadline}*.\n\nTipe tugasnya apa?\n• Tugas\n• Laporan Pendahuluan\n• Laporan Sementara\n• Laporan Resmi",
                    action="send",
                    context_update={
                        "awaiting_clarification": True,
                        "clarification_type": "new_task_type",
                        "temp_new_task": {**temp_task, "course": course, "deadline": deadline}
                    },
                    done=False
                )
        
        # Extract title/note
        raw_title = temp_task.get("raw", "Tugas")
        # Remove matkul name dari title
        title = raw_title
        for alias in nlu.course_aliases.get(course, []):
            title = title.replace(alias, "").strip()
        if not title or title == "Tugas":
            title = task_type
        
        # Create the task
        result = await tools.create_task(
            user_id=data.user_id,
            title=title,
            course=course.upper(),
            deadline=deadline,
            task_type=task_type
        )
        
        if result.get("error"):
            return OpenClawResponse(
                reply=f"Maaf zril, gagal nambahin tugas 😅\n\nCoba lagi ya!",
                action="send",
                done=True
            )
        
        task = result.get("data", {})
        return OpenClawResponse(
            reply=f"✅ Tugas tercatat!\n\n📋 *{task.get('title', 'Tugas')}*\n📚 {course.upper()}\n📅 {deadline}\n📝 {task_type}",
            action="send",
            context_update={"awaiting_clarification": False},
            done=True
        )
    
    # Check if waiting for task type
    if user_ctx.get("clarification_type") == "new_task_type":
        temp_task = user_ctx.get("temp_new_task", {})
        course = temp_task.get("course", "")
        deadline = temp_task.get("deadline", "")
        
        # Parse tipe dari jawaban
        task_type = "Tugas"  # default
        if any(x in msg_lower for x in ["pendahuluan", "lp"]):
            task_type = "Laporan Pendahuluan"
        elif any(x in msg_lower for x in ["sementara", "ls"]):
            task_type = "Laporan Sementara"
        elif any(x in msg_lower for x in ["resmi", "lr"]):
            task_type = "Laporan Resmi"
        
        # Create the task
        result = await tools.create_task(
            user_id=data.user_id,
            title=task_type,
            course=course.upper(),
            deadline=deadline,
            task_type=task_type
        )
        
        if result.get("error"):
            return OpenClawResponse(
                reply=f"Maaf zril, gagal nambahin tugas 😅\n\nCoba lagi ya!",
                action="send",
                done=True
            )
        
        task = result.get("data", {})
        return OpenClawResponse(
            reply=f"✅ Tugas tercatat!\n\n📋 *{task_type}*\n📚 {course.upper()}\n📅 {deadline}",
            action="send",
            context_update={"awaiting_clarification": False},
            done=True
        )
    
    # First time - need to collect info
    extracted = intent.get("extracted", {})
    return OpenClawResponse(
        reply=f"Oke zril, mau nambah tugas ya?\n\nUntuk matkul apa? (misal: KJK, PPL, Sister)",
        action="send",
        context_update={
            "awaiting_clarification": True,
            "clarification_type": "new_task_details",
            "temp_new_task": extracted
        },
        done=False
    )


async def handle_create_project_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle create project intent - multi-step seperti Telegram Bot."""
    msg_lower = data.message.lower()
    
    # Step 1: Get title
    if user_ctx.get("clarification_type") != "project_details":
        title_match = re.search(r'(?:buat project|tambah project|bikin project)\s+(.+)', msg_lower)
        if title_match:
            title = title_match.group(1).strip().title()
            return OpenClawResponse(
                reply=f"Oke, project *{title}* 📁\n\nDeadline kapan? (YYYY-MM-DD atau 'besok', 'lusa')",
                action="send",
                context_update={
                    "awaiting_clarification": True,
                    "clarification_type": "project_details",
                    "temp_project": {"title": title}
                },
                done=False
            )
        else:
            return OpenClawResponse(
                reply=f"Oke zril, mau buat project baru ya?\n\nProjectnya tentang apa? Kasih judul yang deskriptif ya.",
                action="send",
                context_update={
                    "awaiting_clarification": True,
                    "clarification_type": "project_details",
                    "temp_project": {}
                },
                done=False
            )
    
    # Step 2: Get deadline and other details
    temp_project = user_ctx.get("temp_project", {})
    title = temp_project.get("title")
    
    # Parse deadline
    deadline = None
    if "besok" in msg_lower:
        deadline = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    elif "lusa" in msg_lower:
        deadline = (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d')
    elif "minggu" in msg_lower:
        deadline = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
    else:
        import re
        date_match = re.search(r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})', msg_lower)
        if date_match:
            deadline = f"{date_match.group(1)}-{date_match.group(2):0>2}-{date_match.group(3):0>2}"
    
    # Validasi deadline wajib
    if not deadline and not temp_project.get("deadline"):
        # Coba extract title dari pesan jika belum ada
        if not title:
            title = msg_lower.strip().title()
            if len(title) > 50:
                title = title[:50] + "..."
        
        return OpenClawResponse(
            reply=f"Oke, project *{title}* 📁\n\nDeadline kapan? (YYYY-MM-DD atau 'besok', 'lusa')",
            action="send",
            context_update={
                "awaiting_clarification": True,
                "clarification_type": "project_details",
                "temp_project": {"title": title}
            },
            done=False
        )
    
    # Simpan deadline
    if deadline:
        temp_project["deadline"] = deadline
    
    # Step 3: Get priority (if not provided)
    priority = temp_project.get("priority")
    if not priority:
        if any(x in msg_lower for x in ["high", "penting", "urgent", "tinggi"]):
            priority = "high"
        elif any(x in msg_lower for x in ["low", "low", "biasa", "rendah"]):
            priority = "low"
        else:
            # Tanyakan priority
            return OpenClawResponse(
                reply=f"Oke, deadline *{temp_project['deadline']}* 📅\n\nPriority project ini?\n• High (urgent)\n• Medium (normal)\n• Low (santai)",
                action="send",
                context_update={
                    "awaiting_clarification": True,
                    "clarification_type": "project_priority",
                    "temp_project": temp_project
                },
                done=False
            )
    
    # Create project
    result = await tools.create_project(
        user_id=data.user_id,
        title=temp_project["title"],
        description=temp_project.get("description", ""),
        project_type=temp_project.get("type", "personal"),
        priority=priority or "medium",
        deadline=temp_project.get("deadline")
    )
    
    if result.get("error"):
        return OpenClawResponse(
            reply=f"Maaf zril, gagal buat project 😅\n\nCoba lagi ya!",
            action="send",
            done=True
        )
    
    project = result.get("data", {})
    return OpenClawResponse(
        reply=f"✅ Project baru berhasil dibuat!\n\n📁 *{project.get('title', 'Project')}*\n📅 {temp_project.get('deadline', 'No deadline')}\n⚡ {priority or 'medium'}\n\nSemangat ngerjainnya zril! 💪",
        action="send",
        context_update={"awaiting_clarification": False},
        done=True
    )


async def handle_project_priority_clarification(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle priority clarification for project creation."""
    msg_lower = data.message.lower()
    temp_project = user_ctx.get("temp_project", {})
    
    # Parse priority
    priority = "medium"
    if any(x in msg_lower for x in ["high", "penting", "urgent", "tinggi"]):
        priority = "high"
    elif any(x in msg_lower for x in ["low", "rendah", "biasa", "santai"]):
        priority = "low"
    else:
        priority = "medium"
    
    # Create project
    result = await tools.create_project(
        user_id=data.user_id,
        title=temp_project["title"],
        description=temp_project.get("description", ""),
        project_type=temp_project.get("type", "personal"),
        priority=priority,
        deadline=temp_project.get("deadline")
    )
    
    if result.get("error"):
        return OpenClawResponse(
            reply=f"Maaf zril, gagal buat project 😅\n\nCoba lagi ya!",
            action="send",
            done=True
        )
    
    project = result.get("data", {})
    return OpenClawResponse(
        reply=f"✅ Project baru berhasil dibuat!\n\n📁 *{project.get('title', 'Project')}*\n📅 {temp_project.get('deadline', 'No deadline')}\n⚡ {priority}\n\nSemangat ngerjainnya zril! 💪",
        action="send",
        context_update={"awaiting_clarification": False},
        done=True
    )


async def handle_create_transaction_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle create transaction intent (expense/income)."""
    extracted = intent.get("extracted", {})
    
    amount = extracted.get("amount")
    type_ = extracted.get("type", "expense")
    category = extracted.get("category", "lainnya")
    title = extracted.get("title") or category
    
    # If amount not provided, need clarification
    if not amount:
        return OpenClawResponse(
            reply=f"Oke zril, mau catat {'pengeluaran' if type_ == 'expense' else 'pemasukan'} ya?\n\nBerapa nominalnya?",
            action="send",
            context_update={
                "awaiting_clarification": True,
                "clarification_type": "transaction_amount",
                "temp_transaction": extracted
            },
            done=False
        )
    
    # Create transaction
    today = datetime.now().strftime('%Y-%m-%d')
    result = await tools.create_transaction(
        user_id=data.user_id,
        amount=amount,
        type_=type_,
        category=category,
        title=title,
        date=today
    )
    
    if result.get("error"):
        return OpenClawResponse(
            reply=f"Maaf zril, gagal catat transaksi 😅\n\nCoba lagi ya!",
            action="send",
            done=True
        )
    
    tx = result.get("data", {})
    icon = "💸" if type_ == "expense" else "💵"
    action_text = "Pengeluaran" if type_ == "expense" else "Pemasukan"
    
    return OpenClawResponse(
        reply=f"✅ {action_text} tercatat!\n\n{icon} *{tx.get('title', category)}*\n💰 Rp{amount:,.0f}\n📁 {category}",
        action="send",
        done=True
    )


async def handle_transaction_amount_clarification(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle amount clarification for transaction."""
    msg_lower = data.message.lower()
    temp_tx = user_ctx.get("temp_transaction", {})
    
    # Parse amount dari jawaban user
    amount = None
    amount_patterns = [
        (r'rp\.?\s*([\d.,]+)', 1),
        (r'rp\s*([\d.,]+)', 1),
        (r'([\d.,]+)\s*ribu', 1000),
        (r'([\d.,]+)\s*rb', 1000),
        (r'([\d.,]+)\s*juta', 1000000),
        (r'([\d.,]+)\s*jt', 1000000),
        (r'([\d.,]+)', 1),
    ]
    
    for pattern, multiplier in amount_patterns:
        match = re.search(pattern, msg_lower)
        if match:
            amount_str = match.group(1).replace(',', '').replace('.', '')
            try:
                amount = float(amount_str) * multiplier
                break
            except:
                continue
    
    if not amount:
        return OpenClawResponse(
            reply=f"Zril, aku belum ngerti nominalnya 😅\n\nCoba tulis angkanya ya (misal: 50000 atau Rp50.000)",
            action="send",
            done=False
        )
    
    # Parse category dari jawaban user jika belum ada
    category = temp_tx.get("category", "lainnya")
    if category == "lainnya":
        categories_map = {
            "makan": "makan", "food": "makan", "kuliner": "makan",
            "transport": "transport", "transportasi": "transport", "bensin": "transport", "parkir": "transport",
            "kuliah": "kuliah", "print": "kuliah", "atk": "kuliah",
            "pulsa": "pulsa", "kuota": "pulsa", "internet": "pulsa",
            "hiburan": "hiburan", "entertainment": "hiburan", "nonton": "hiburan", "game": "hiburan",
            "belanja": "belanja", "shopping": "belanja"
        }
        for key, val in categories_map.items():
            if key in msg_lower:
                category = val
                break
    
    type_ = temp_tx.get("type", "expense")
    title = temp_tx.get("title") or category
    
    # Create transaction
    today = datetime.now().strftime('%Y-%m-%d')
    result = await tools.create_transaction(
        user_id=data.user_id,
        amount=amount,
        type_=type_,
        category=category,
        title=title,
        date=today
    )
    
    if result.get("error"):
        return OpenClawResponse(
            reply=f"Maaf zril, gagal catat transaksi 😅\n\nCoba lagi ya!",
            action="send",
            done=True
        )
    
    tx = result.get("data", {})
    icon = "💸" if type_ == "expense" else "💵"
    action_text = "Pengeluaran" if type_ == "expense" else "Pemasukan"
    
    return OpenClawResponse(
        reply=f"✅ {action_text} tercatat!\n\n{icon} *{title}*\n💰 Rp{amount:,.0f}\n📁 {category}",
        action="send",
        context_update={"awaiting_clarification": False},
        done=True
    )


async def handle_log_progress_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle log project progress intent."""
    extracted = intent.get("extracted", {})
    progress = extracted.get("progress")
    
    # Get active project from context
    active_project = user_ctx.get("active_project")
    
    if not active_project:
        # Try to find project from message
        return OpenClawResponse(
            reply=f"Zril, mau update progress project ya?\n\nProject yang mana? Kasih tau judulnya ya.",
            action="send",
            context_update={
                "awaiting_clarification": True,
                "clarification_type": "select_project_for_progress"
            },
            done=False
        )
    
    if not progress:
        return OpenClawResponse(
            reply=f"Progress {active_project.get('title')} sekarang berapa persen zril?",
            action="send",
            context_update={
                "awaiting_clarification": True,
                "clarification_type": "progress_value"
            },
            done=False
        )
    
    # Log progress
    project_id = active_project.get("id")
    result = await tools.log_project_progress(
        project_id=project_id,
        progress=progress,
        message=f"Progress update: {progress}%"
    )
    
    if result.get("error"):
        return OpenClawResponse(
            reply=f"Maaf zril, gagal update progress 😅\n\nCoba lagi ya!",
            action="send",
            done=True
        )
    
    # Progress bar
    progress_bar = "█" * (progress // 10) + "░" * (10 - progress // 10)
    
    return OpenClawResponse(
        reply=f"✅ Progress updated!\n\n📁 *{active_project.get('title')}*\n{progress_bar} {progress}%\n\nKeren zril! 💪",
        action="send",
        done=True
    )


async def handle_select_project_for_progress(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle project selection for progress logging."""
    msg_lower = data.message.lower()
    
    # Get projects list
    result = await tools.get_projects(status="active")
    projects = result.get("data", [])
    
    # Try to match project name from message
    selected_project = None
    for project in projects:
        title = project.get("title", "").lower()
        if title in msg_lower or any(word in msg_lower for word in title.split()):
            selected_project = project
            break
    
    if not selected_project:
        # List projects and ask again
        if len(projects) == 0:
            return OpenClawResponse(
                reply=f"Zril, belum ada project aktif nih. Mau buat project baru dulu?",
                action="send",
                context_update={"awaiting_clarification": False},
                done=True
            )
        
        reply_lines = ["Zril, project yang mana?\n"]
        for i, project in enumerate(projects[:5], 1):
            reply_lines.append(f"{i}. {project.get('title')}")
        
        return OpenClawResponse(
            reply="\n".join(reply_lines),
            action="send",
            done=False
        )
    
    # Ask for progress value
    return OpenClawResponse(
        reply=f"Oke, project *{selected_project.get('title')}* 📁\n\nProgress sekarang berapa persen?",
        action="send",
        context_update={
            "awaiting_clarification": True,
            "clarification_type": "progress_value",
            "active_project": selected_project
        },
        done=False
    )


async def handle_progress_value_clarification(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """Handle progress value clarification."""
    msg_lower = data.message.lower()
    active_project = user_ctx.get("active_project")
    
    if not active_project:
        return OpenClawResponse(
            reply=f"Zril, projectnya yang mana ya? Coba sebutin judulnya.",
            action="send",
            context_update={
                "awaiting_clarification": True,
                "clarification_type": "select_project_for_progress"
            },
            done=False
        )
    
    # Parse progress from message
    progress = None
    
    # Pattern: "50%", "50 persen", "baru 50%"
    progress_match = re.search(r'(\d+)(?:\s*%|\s*persen)?', msg_lower)
    if progress_match:
        try:
            progress = int(progress_match.group(1))
            if progress < 0:
                progress = 0
            elif progress > 100:
                progress = 100
        except:
            pass
    
    # Textual percentages
    if progress is None:
        if "setengah" in msg_lower or "separuh" in msg_lower:
            progress = 50
        elif "sepertiga" in msg_lower:
            progress = 33
        elif "seperempat" in msg_lower:
            progress = 25
        elif "selesai" in msg_lower or "done" in msg_lower or "100" in msg_lower:
            progress = 100
    
    if progress is None:
        return OpenClawResponse(
            reply=f"Zril, aku belum ngerti progressnya berapa 😅\n\nCoba tulis angkanya ya (misal: 50% atau 75)",
            action="send",
            done=False
        )
    
    # Log progress
    project_id = active_project.get("id")
    result = await tools.log_project_progress(
        project_id=project_id,
        progress=progress,
        message=f"Progress update via chat: {progress}%"
    )
    
    if result.get("error"):
        return OpenClawResponse(
            reply=f"Maaf zril, gagal update progress 😅\n\nCoba lagi ya!",
            action="send",
            done=True
        )
    
    # Progress bar
    progress_bar = "█" * (progress // 10) + "░" * (10 - progress // 10)
    
    return OpenClawResponse(
        reply=f"✅ Progress updated!\n\n📁 *{active_project.get('title')}*\n{progress_bar} {progress}%\n\nKeren zril! 💪",
        action="send",
        context_update={"awaiting_clarification": False},
        done=True
    )


# =============================================================================
# SMARTREMINDER CONSULTATION ENDPOINT
# 2-way communication: SmartReminder bisa konsultasi ke OpenClaw
# =============================================================================

class ConsultRequest(BaseModel):
    type: str  # ambiguous_intent | missing_info | confirmation_needed
    message: str
    user_id: str = "default"
    context: Optional[Dict[str, Any]] = {}
    options: List[str] = []
    missing_fields: List[str] = []
    proposed_action: Optional[str] = None

class ConsultResponse(BaseModel):
    decision: str
    confidence: float
    reply: str
    clarification_needed: bool = False
    follow_up_questions: List[str] = []


@app.post("/consult")
async def consult_smartreminder(request: ConsultRequest):
    """
    SmartReminder konsultasi ke OpenClaw untuk decide ambiguous situation.
    """
    user_ctx = {"user_id": request.user_id, "persona": "kimi"}
    
    if request.type == "ambiguous_intent":
        return await _handle_ambiguous_consult(request, user_ctx)
    elif request.type == "missing_info":
        return await _handle_missing_info_consult(request, user_ctx)
    elif request.type == "confirmation_needed":
        return await _handle_confirmation_consult(request, user_ctx)
    else:
        return ConsultResponse(
            decision="unknown_type",
            confidence=0.0,
            reply="*error* tipe consult tidak dikenal",
            clarification_needed=True
        )


async def _handle_ambiguous_consult(request: ConsultRequest, user_ctx: Dict) -> ConsultResponse:
    """Handle ambiguous intent - AI decide berdasarkan message context."""
    message_lower = request.message.lower()
    
    # Quick rule-based decision untuk common patterns
    if any(w in message_lower for w in ["iya", "oke", "okee", "siap", "siapp", "hadir", "berangkat", "datang"]):
        decision = "confirm"
        confidence = 0.9
    elif any(w in message_lower for w in ["tidak", "ga", "gak", "skip", "gabisa", "gabs", "bolos", "nggak"]):
        decision = "decline"
        confidence = 0.9
    elif any(w in message_lower for w in ["ganti", "pindah", "reschedule", "ubah", "gantiin"]):
        decision = "reschedule"
        confidence = 0.85
    elif any(w in message_lower for w in ["telat", "bentar", "sebentar", "ntar", "nanti", "lambat"]):
        decision = "delay"
        confidence = 0.8
    elif any(w in message_lower for w in ["online", "zoom", "gmeet", "meet", "virtual"]):
        decision = "online"
        confidence = 0.85
    else:
        decision = "need_more_info"
        confidence = 0.4
    
    # Generate reply dengan msg_gen
    reply_data = {
        "intent": decision,
        "confidence": confidence,
        "user_message": request.message,
        "context": request.context,
        "is_consultation": True
    }
    
    reply = await msg_gen.generate("ambiguous_decision", reply_data, user_ctx)
    
    return ConsultResponse(
        decision=decision,
        confidence=confidence,
        reply=reply,
        clarification_needed=confidence < 0.7,
        follow_up_questions=["*confirm* (hadir)?", "*skip* (bolos)?", "*reschedule*?"] if confidence < 0.7 else []
    )


async def _handle_missing_info_consult(request: ConsultRequest, user_ctx: Dict) -> ConsultResponse:
    """Handle missing information - tanya user dengan sopan."""
    missing = ", ".join(request.missing_fields)
    
    reply_data = {
        "missing_fields": request.missing_fields,
        "user_message": request.message,
        "context": request.context,
        "is_consultation": True
    }
    
    reply = await msg_gen.generate("missing_info", reply_data, user_ctx)
    
    return ConsultResponse(
        decision="need_more_info",
        confidence=0.0,
        reply=reply,
        clarification_needed=True,
        follow_up_questions=[f"Info yang kurang: {missing}"]
    )


async def _handle_confirmation_consult(request: ConsultRequest, user_ctx: Dict) -> ConsultResponse:
    """Handle confirmation needed - minta konfirmasi user."""
    reply_data = {
        "proposed_action": request.proposed_action,
        "user_message": request.message,
        "context": request.context,
        "is_consultation": True
    }
    
    reply = await msg_gen.generate("confirmation", reply_data, user_ctx)
    
    return ConsultResponse(
        decision="awaiting_confirmation",
        confidence=0.5,
        reply=reply,
        clarification_needed=True,
        follow_up_questions=[f"Ketik *iya* untuk {request.proposed_action}, atau *tidak* untuk batal"]
    )


# =============================================================================
# HEALTH CHECK
# =============================================================================

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "openclaw-brain",
        "version": "2.0.0",
        "persona": "Azriel (Zril)",
        "timestamp": datetime.now().isoformat()
    }

# Main
if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("🧠 OpenClaw St4cker Brain")
    print("👤 Persona: Azriel (Zril)")
    print("🎯 Mode: Fully Conversational")
    print("=" * 60)
    print(f"St4cker API: {ST4CKER_API_URL}")
    print(f"API Key Set: {'Yes' if ST4CKER_API_KEY else 'No (unsafe!)'}")
    print("Endpoints:")
    print("  POST /webhook/st4cker-reminder-trigger")
    print("  POST /api/v1/st4cker/chat")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000)
