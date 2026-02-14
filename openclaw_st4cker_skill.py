#!/usr/bin/env python3
"""
OpenClaw St4cker Skill - FastAPI server untuk handle reminder dari St4cker Bot
"""

import os
import re
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

import httpx
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel

# Configuration
ST4CKER_API_URL = os.getenv("ST4CKER_API_URL", "http://localhost:3000")
ST4CKER_API_KEY = os.getenv("ST4CKER_API_KEY", "")
OPENCLAW_API_KEY = os.getenv("OPENCLAW_API_KEY", "")

# In-memory context storage
class ContextStore:
    def __init__(self):
        self.task_contexts: Dict[str, Dict] = {}
        self.schedule_contexts: Dict[str, Dict] = {}

    def set_task_context(self, phone: str, context: Dict, ttl_minutes: int = 30):
        self.task_contexts[phone] = {
            **context,
            "expires_at": datetime.now() + timedelta(minutes=ttl_minutes)
        }

    def get_task_context(self, phone: str) -> Optional[Dict]:
        ctx = self.task_contexts.get(phone)
        if ctx and datetime.now() < ctx["expires_at"]:
            return ctx
        return None

    def clear_task_context(self, phone: str):
        self.task_contexts.pop(phone, None)

    def set_schedule_context(self, phone: str, context: Dict, ttl_minutes: int = 30):
        self.schedule_contexts[phone] = {
            **context,
            "expires_at": datetime.now() + timedelta(minutes=ttl_minutes)
        }

    def get_schedule_context(self, phone: str) -> Optional[Dict]:
        ctx = self.schedule_contexts.get(phone)
        if ctx and datetime.now() < ctx["expires_at"]:
            return ctx
        return None

    def clear_schedule_context(self, phone: str):
        self.schedule_contexts.pop(phone, None)

store = ContextStore()

# Pydantic Models
class TaskReminderWebhook(BaseModel):
    event: str
    user_id: str
    phone: str
    task_count: int
    tasks: List[Dict[str, Any]]
    sent_at: str
    date: str

class ScheduleReminderWebhook(BaseModel):
    event: str
    user_id: str
    phone: str
    schedule: Dict[str, Any]
    reminder_type: str
    message: str
    sent_at: str
    date: str

class TaskReplyRequest(BaseModel):
    phone: str
    userId: str
    message: str
    context: Dict[str, Any]

class ScheduleReplyRequest(BaseModel):
    phone: str
    userId: str
    message: str
    context: Dict[str, Any]

class OpenClawResponse(BaseModel):
    reply: str
    done: bool = False
    clearContext: bool = False
    confirmed: Optional[bool] = None

# St4cker API Client
async def st4cker_request(method: str, endpoint: str, data: Dict = None) -> Dict:
    url = f"{ST4CKER_API_URL}/api/v1{endpoint}"
    headers = {"X-API-Key": ST4CKER_API_KEY, "Content-Type": "application/json"}
    
    async with httpx.AsyncClient() as client:
        try:
            if method == "GET":
                response = await client.get(url, headers=headers, timeout=10)
            else:
                response = await client.post(url, json=data, headers=headers, timeout=10)
            
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            print(f"[St4cker API Error] {e}")
            return {"error": str(e)}

async def update_task_status(user_id: str, search_query: str, new_status: str) -> Dict:
    return await st4cker_request("POST", "/tasks/update-status", {
        "userId": user_id,
        "searchQuery": search_query,
        "newStatus": new_status
    })

async def confirm_schedule_attendance(user_id: str, confirmed: bool) -> Dict:
    return await st4cker_request("POST", "/reminders/confirm", {
        "userId": user_id,
        "confirmed": confirmed
    })

# NLP / Intent Parsing
CONFIRM_KEYWORDS = ["ok", "oke", "okee", "gas", "otw", "iya", "ya", "yoi", "siap", "siapp", 
                    "yuk", "ayo", "lanjut", "gaskeun", "baik", "mantap", "iyaa", "yaa", "okeh"]
DECLINE_KEYWORDS = ["tidak", "ga", "gak", "nggak", "skip", "nanti", "belum", "tunda", "cancel", 
                    "batal", "no", "nope", "gajadi", "ga jadi"]
TASK_SELECT_PATTERNS = ["nomor", "no", "yang", "kerjain", "otw", "mau kerja", "fokus", "mulai"]

COURSE_ALIASES = {
    "kjk": ["keamanan jaringan", "kjk"],
    "komber": ["komputasi bergerak", "komber", "kb"],
    "ppl": ["pengembangan perangkat lunak", "ppl"],
    "sister": ["sistem terdistribusi", "sister"],
    "pemjar": ["pemrograman jaringan", "pemjar", "pj"],
    "wspk": ["workshop spk", "wspk", "spk"],
}

def parse_intent(message: str) -> Dict[str, Any]:
    msg_lower = message.lower()
    
    is_confirm = any(kw in msg_lower for kw in CONFIRM_KEYWORDS)
    is_decline = any(kw in msg_lower for kw in DECLINE_KEYWORDS)
    is_task_select = any(pattern in msg_lower for pattern in TASK_SELECT_PATTERNS)
    
    number_match = re.search(r'(?:nomor\s*|no\s*|\b)(\d+)', msg_lower)
    number = int(number_match.group(1)) if number_match else None
    
    found_course = None
    for alias, variations in COURSE_ALIASES.items():
        if any(var in msg_lower for var in variations):
            found_course = alias
            break
    
    return {
        "is_confirmation": is_confirm and not is_decline,
        "is_decline": is_decline,
        "is_task_select": is_task_select or number is not None or found_course is not None,
        "number": number,
        "course_alias": found_course,
        "raw_message": message
    }

# FastAPI App
app = FastAPI(title="OpenClaw St4cker Skill", description="AI Brain for St4cker Reminder Bot", version="1.0.0")

def verify_api_key(x_api_key: Optional[str] = Header(None)):
    if OPENCLAW_API_KEY and x_api_key != OPENCLAW_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return True

# Webhook Endpoints
@app.post("/webhook/st4cker-task-reminder")
async def task_reminder_webhook(data: TaskReminderWebhook, _: bool = Depends(verify_api_key)):
    print(f"[Webhook] Task reminder sent to {data.phone}: {data.task_count} tasks")
    store.set_task_context(data.phone, {
        "event": "task_reminder",
        "tasks": data.tasks,
        "task_count": data.task_count,
        "sent_at": data.sent_at,
        "user_id": data.user_id
    })
    return {"success": True, "message": "Task context stored"}

@app.post("/webhook/st4cker-schedule-reminder")
async def schedule_reminder_webhook(data: ScheduleReminderWebhook, _: bool = Depends(verify_api_key)):
    print(f"[Webhook] Schedule reminder sent to {data.phone}: {data.schedule.get('course_name')}")
    store.set_schedule_context(data.phone, {
        "event": "schedule_reminder",
        "schedule": data.schedule,
        "reminder_type": data.reminder_type,
        "sent_at": data.sent_at,
        "user_id": data.user_id
    })
    return {"success": True, "message": "Schedule context stored"}

# Reply Handlers
@app.post("/api/v1/st4cker/task-reply")
async def handle_task_reply(data: TaskReplyRequest, _: bool = Depends(verify_api_key)) -> OpenClawResponse:
    print(f"[TaskReply] {data.phone}: {data.message}")
    
    ctx = store.get_task_context(data.phone)
    if not ctx:
        return OpenClawResponse(reply="👋 Hai! Ada yang bisa dibantu?", done=True, clearContext=True)
    
    intent = parse_intent(data.message)
    tasks = ctx.get("tasks", [])
    
    if intent["is_decline"]:
        store.clear_task_context(data.phone)
        return OpenClawResponse(reply="👍 Oke, ditunda dulu ya. Nanti kuingetin lagi!", done=True, clearContext=True)
    
    selected_task = None
    
    if intent["number"] and 1 <= intent["number"] <= len(tasks):
        selected_task = tasks[intent["number"] - 1]
    elif intent["course_alias"]:
        for task in tasks:
            course_lower = task.get("course", "").lower()
            if intent["course_alias"] in course_lower:
                selected_task = task
                break
    
    if not selected_task:
        msg_words = set(data.message.lower().split())
        best_score = 0
        for task in tasks:
            task_text = f"{task.get('title', '')} {task.get('course', '')}".lower()
            score = len(msg_words & set(task_text.split()))
            if score > best_score:
                best_score = score
                selected_task = task
    
    if selected_task:
        result = await update_task_status(ctx["user_id"], selected_task.get("course", ""), "in_progress")
        
        if result.get("success"):
            days_left = selected_task.get("days_left", 0)
            deadline_text = "🔴 Besok deadline!" if days_left == 0 else f"🟡 {days_left} hari lagi"
            reply = f"✅ Oke! Fokus ngerjain *{selected_task['title']}* ({selected_task['course']}) ya!\n{deadline_text}\nSemangat! 💪"
        else:
            reply = f"✅ Oke! Fokus ngerjain *{selected_task['title']}* ya!"
        
        store.clear_task_context(data.phone)
        return OpenClawResponse(reply=reply, done=True, clearContext=True)
    
    task_list = "\n".join([f"{t['number']}. {t['course']} - {t['title']}" for t in tasks[:5]])
    return OpenClawResponse(
        reply=f"🤔 Maaf, kurang paham. Maksudnya yang mana?\n\n{task_list}\n\nCoba: \"nomor 1\" atau \"kerjain kjk\"",
        done=False,
        clearContext=False
    )

@app.post("/api/v1/st4cker/schedule-reply")
async def handle_schedule_reply(data: ScheduleReplyRequest, _: bool = Depends(verify_api_key)) -> OpenClawResponse:
    print(f"[ScheduleReply] {data.phone}: {data.message}")
    
    ctx = store.get_schedule_context(data.phone)
    if not ctx:
        return OpenClawResponse(reply="👋 Hai! Ada yang bisa dibantu?", done=True, clearContext=True)
    
    intent = parse_intent(data.message)
    schedule = ctx.get("schedule", {})
    course_name = schedule.get("course_name", "matkul")
    
    if intent["is_confirmation"]:
        await confirm_schedule_attendance(ctx["user_id"], True)
        reply = f"✅ Oke! Siap berangkat ke *{course_name}*. Nanti aku ingetin lagi 15 menit sebelum matkul berikutnya ya!"
        store.clear_schedule_context(data.phone)
        return OpenClawResponse(reply=reply, confirmed=True, done=True, clearContext=True)
    
    elif intent["is_decline"]:
        await confirm_schedule_attendance(ctx["user_id"], False)
        reply = f"👍 Oke, {course_name} ditunda dulu. Bangun dulu ya!"
        store.clear_schedule_context(data.phone)
        return OpenClawResponse(reply=reply, confirmed=False, done=True, clearContext=True)
    
    else:
        return OpenClawResponse(
            reply=f"🤔 Aku kurang paham. Jadi otw ke *{course_name}* atau nanti dulu? (Reply: \"oke\" atau \"skip\")",
            done=False,
            clearContext=False
        )

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "openclaw-st4cker-skill", "timestamp": datetime.now().isoformat()}

# Main
if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("OpenClaw St4cker Skill")
    print("=" * 60)
    print(f"St4cker API: {ST4CKER_API_URL}")
    print(f"API Key Set: {'Yes' if ST4CKER_API_KEY else 'No (unsafe!)'}")
    print("Endpoints:")
    print("  POST /webhook/st4cker-task-reminder")
    print("  POST /webhook/st4cker-schedule-reminder")
    print("  POST /api/v1/st4cker/task-reply")
    print("  POST /api/v1/st4cker/schedule-reply")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000)
