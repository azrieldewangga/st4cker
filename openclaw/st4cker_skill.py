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

# Configuration
ST4CKER_API_URL = os.getenv("ST4CKER_API_URL", "http://localhost:3001")
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

async def handle_clear_intent(intent: Dict, data: ChatRequest, user_ctx: Dict) -> OpenClawResponse:
    """
    Handle intent yang sudah clear (gak perlu clarification).
    """
    intent_type = intent.get("intent")
    
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
