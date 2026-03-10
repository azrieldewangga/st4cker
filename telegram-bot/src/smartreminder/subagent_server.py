#!/usr/bin/env python3
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo
import json
import os
import fcntl
import re

app = FastAPI(title="SmartReminder Subagent")

API_KEY = os.getenv("SMARTREMINDER_API_KEY", "smartreminder_secure_key_2024")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://st4cker-bot:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["X-API-Key", "Content-Type"],
)

JAKARTA_TZ = ZoneInfo("Asia/Jakarta")
def get_now_jakarta():
    return datetime.now(JAKARTA_TZ)

DATA_DIR = "/app/data"
SENT_REMINDERS_FILE = os.path.join(DATA_DIR, "sent_reminders.json")
ATTENDANCE_FILE = os.path.join(DATA_DIR, "attendance_state.json")
LOCK_FILE = os.path.join(DATA_DIR, ".lock")

class FileLock:
    def __enter__(self):
        self.fd = open(LOCK_FILE, "w")
        fcntl.flock(self.fd.fileno(), fcntl.LOCK_EX)
        return self
    def __exit__(self, *args):
        fcntl.flock(self.fd.fileno(), fcntl.LOCK_UN)
        self.fd.close()

def load_json_safe(path, default):
    try:
        with FileLock():
            if not os.path.exists(path):
                return default.copy()
            with open(path) as f:
                return json.load(f)
    except:
        return default.copy()

def save_json_safe(path, data):
    with FileLock():
        tmp = f"{path}.tmp"
        with open(tmp, 'w') as f:
            json.dump(data, f)
        os.replace(tmp, path)

def load_sent_reminders():
    default = {'date': get_now_jakarta().strftime('%Y-%m-%d'), 'courses': []}
    data = load_json_safe(SENT_REMINDERS_FILE, default)
    today = get_now_jakarta().strftime('%Y-%m-%d')
    if data.get('date') != today:
        if os.path.exists(SENT_REMINDERS_FILE):
            os.remove(SENT_REMINDERS_FILE)
        return default.copy()
    return data

def save_sent_reminder(course_name):
    data = load_sent_reminders()
    if course_name not in data['courses']:
        data['courses'].append(course_name)
    os.makedirs(DATA_DIR, exist_ok=True)
    save_json_safe(SENT_REMINDERS_FILE, data)

def is_reminder_sent(course_name):
    return course_name in load_sent_reminders().get('courses', [])

def load_attendance_state():
    default = {'courses': {}, 'global_status': 'unknown'}
    return load_json_safe(ATTENDANCE_FILE, default)

def save_attendance_state(state):
    state['timestamp'] = get_now_jakarta().isoformat()
    os.makedirs(DATA_DIR, exist_ok=True)
    save_json_safe(ATTENDANCE_FILE, state)

def get_course_attendance(course_name):
    return load_attendance_state()['courses'].get(course_name, 'unknown')

COURSES = [
    {"name": "PPL", "day": 1, "time": "08:40", "room": "PS-04.08", "lecturer": "Haryadi Amran Darwito"},
    {"name": "Keamanan Jaringan", "day": 1, "time": "10:40", "room": "B 302", "lecturer": "Amang Sudarsono"},
    {"name": "Praktikum PPL", "day": 1, "time": "12:30", "room": "SAW-03.08", "lecturer": "Norma Ningsih"},
    {"name": "Kewirausahaan", "day": 2, "time": "09:00", "room": "A 101", "lecturer": "Dr. Budi"},
    {"name": "Proyek 2", "day": 3, "time": "09:00", "room": "Lab D", "lecturer": "Tim Proyek"},
    {"name": "Proyek 2", "day": 3, "time": "14:00", "room": "Lab E", "lecturer": "Tim Proyek"},
    {"name": "Komputasi Awan", "day": 4, "time": "12:40", "room": "Lab F", "lecturer": "Dr. Cloud"},
    {"name": "PPB", "day": 4, "time": "14:40", "room": "B 201", "lecturer": "Dr. Web"},
    {"name": "Interoperabilitas", "day": 5, "time": "08:40", "room": "C 301", "lecturer": "Dr. Interop"}
]

class AttendanceRequest(BaseModel):
    course: str
    status: str
    data: Optional[dict] = None

async def verify_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(401, "Invalid API Key")
    return True

@app.get("/health")
async def health():
    now = get_now_jakarta()
    return {
        "status": "healthy",
        "version": "2.3-secure",
        "timezone": "Asia/Jakarta",
        "current_time": now.isoformat()
    }

@app.get("/api/v1/schedules/today")
async def get_today_schedule(_: bool = Depends(verify_key)):
    now = get_now_jakarta()
    weekday = now.weekday()
    today_courses = [c for c in COURSES if c["day"] == weekday]
    
    result = []
    for i, course in enumerate(today_courses):
        course_time = datetime.strptime(course["time"], "%H:%M").time()
        is_first_early = i == 0 and course_time < time(9, 0)
        
        if is_first_early:
            reminder_time = time(5, 45)
            minutes_before = 175
        else:
            course_status = get_course_attendance(course["name"])
            if course_status in ['declined', 'absent', 'unknown']:
                reminder_minutes = 90
            else:
                reminder_minutes = 15
            
            course_dt = datetime.combine(now.date(), course_time)
            reminder_dt = course_dt - timedelta(minutes=reminder_minutes)
            reminder_time = reminder_dt.time()
            minutes_before = reminder_minutes
        
        result.append({
            "course": course["name"],
            "time": course["time"],
            "reminder_time": reminder_time.strftime("%H:%M"),
            "minutes_before": minutes_before,
            "attendance_status": get_course_attendance(course["name"]),
            "room": course.get("room", "TBA"),
            "lecturer": course.get("lecturer", "TBD")
        })
    
    return result

@app.get("/api/v1/reminders/next")
async def get_next_reminder(_: bool = Depends(verify_key)):
    now = get_now_jakarta()
    weekday = now.weekday()
    current_time = now.time()
    
    today_courses = [c for c in COURSES if c["day"] == weekday]
    
    for i, course in enumerate(today_courses):
        course_time = datetime.strptime(course["time"], "%H:%M").time()
        is_first_early = i == 0 and course_time < time(9, 0)
        
        if is_first_early:
            reminder_time = time(5, 45)
        else:
            course_status = get_course_attendance(course["name"])
            if course_status in ['declined', 'absent', 'unknown']:
                reminder_minutes = 90
            else:
                reminder_minutes = 15
            
            course_dt = datetime.combine(now.date(), course_time)
            reminder_dt = course_dt - timedelta(minutes=reminder_minutes)
            reminder_time = reminder_dt.time()
        
        reminder_dt = datetime.combine(now.date(), reminder_time)
        current_dt = datetime.combine(now.date(), current_time)
        diff_minutes = abs((current_dt - reminder_dt).total_seconds() / 60)
        
        if diff_minutes < 2 and not is_reminder_sent(course["name"]):
            save_sent_reminder(course["name"])
            return {
                "has_reminder": True,
                "reminder": {
                    "course_name": course["name"],
                    "course_code": course["name"][:4].upper(),
                    "start_time": course["time"],
                    "end_time": (datetime.combine(now.date(), course_time) + timedelta(hours=2)).strftime("%H:%M"),
                    "room": course.get("room", "TBA"),
                    "dosen": course.get("lecturer", "TBD"),
                    "is_rescheduled": False
                },
                "timestamp": now.isoformat()
            }
    
    return {"has_reminder": False, "timestamp": now.isoformat()}

@app.post("/api/v1/attendance/update")
async def update_attendance(req: AttendanceRequest, _: bool = Depends(verify_key)):
    course = re.sub(r'[^\w\s\-]', '', req.course).strip()[:100]
    status = req.status.lower().strip()
    
    if not course:
        raise HTTPException(400, "Invalid course name")
    
    allowed = ['confirmed', 'declined', 'uncertain', 'unknown', 'present', 'absent']
    if status not in allowed:
        raise HTTPException(400, f"Status must be one of: {allowed}")
    
    state = load_attendance_state()
    state['courses'][course] = status
    state['global_status'] = 'mixed'
    save_attendance_state(state)
    
    return {"success": True, "course": course, "status": status}

@app.get("/api/v1/attendance/status")
async def get_attendance_status(_: bool = Depends(verify_key)):
    state = load_attendance_state()
    return {
        "courses": state.get('courses', {}),
        "global_status": state.get('global_status', 'unknown'),
        "timestamp": get_now_jakarta().isoformat()
    }

@app.post("/api/v1/attendance/reset")
async def reset_attendance(_: bool = Depends(verify_key)):
    save_attendance_state({'courses': {}, 'global_status': 'unknown'})
    today = get_now_jakarta().strftime('%Y-%m-%d')
    save_json_safe(SENT_REMINDERS_FILE, {'date': today, 'courses': []})
    return {"success": True}

@app.post("/api/v1/attendance/refresh")
async def refresh_attendance(_: bool = Depends(verify_key)):
    return {"success": True}

if __name__ == "__main__":
    import uvicorn
    os.makedirs(DATA_DIR, exist_ok=True)
    print(f"[SmartReminder] Timezone: Asia/Jakarta, Current: {get_now_jakarta().isoformat()}")
    uvicorn.run(app, host="0.0.0.0", port=5001)
