#!/usr/bin/env python3
"""
Reminder Bot - Trigger Only
Cuma trigger ke OpenClaw, gak ada logic sendiri.
OpenClaw yang decide everything.
"""

import psycopg2
import time
from datetime import datetime, timedelta
import logging
import requests
import os
import json

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Konfigurasi Database (from environment)
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "st4cker-db"),
    "port": os.environ.get("DB_PORT", "5432"),
    "database": os.environ.get("DB_NAME", "st4cker_db"),
    "user": os.environ.get("DB_USER", "st4cker_admin"),
    "password": os.environ.get("DB_PASSWORD", "")  # NO DEFAULT - must be set
}

# OpenClaw config
OPENCLAW_WEBHOOK_URL = os.environ.get("OPENCLAW_WEBHOOK_URL", "http://openclaw:8000/webhook/st4cker-reminder-trigger")
OPENCLAW_API_KEY = os.environ.get("OPENCLAW_API_KEY", "st4cker_openclaw_secure_key_2024")
TARGET_PHONE = os.environ.get("TARGET_PHONE", "")  # MUST be set via environment
TARGET_USER_ID = os.environ.get("TARGET_USER_ID", "")  # Telegram ID untuk DB

# Validate required environment variables
if not TARGET_PHONE:
    logger.error("❌ ERROR: TARGET_PHONE environment variable must be set!")
    logger.error("   Example: TARGET_PHONE=6281234567890")
    exit(1)

if not TARGET_USER_ID:
    logger.error("❌ ERROR: TARGET_USER_ID environment variable must be set!")
    logger.error("   Example: TARGET_USER_ID=1168825716")
    exit(1)

if not DB_CONFIG["password"]:
    logger.error("❌ ERROR: DB_PASSWORD environment variable must be set!")
    exit(1)

# State file (hanya untuk tracking waktu terakhir trigger, bukan logic)
STATE_FILE = "/tmp/reminder_state.json"

def load_state():
    """Load state tracking."""
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Error loading state: {e}")
    return {}

def save_state(state):
    """Save state tracking."""
    try:
        with open(STATE_FILE, 'w') as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving state: {e}")

def get_db_connection():
    """Get database connection."""
    return psycopg2.connect(**DB_CONFIG)

def trigger_openclaw(trigger_type: str, trigger_time: str, data: dict):
    """
    Trigger OpenClaw dengan data mentah.
    OpenClaw yang decide: kirim/skip, format pesan, tone, dll.
    """
    try:
        payload = {
            "event": "reminder_trigger",
            "source": "reminder-bot",
            "trigger_type": trigger_type,
            "trigger_time": trigger_time,
            "user_id": TARGET_USER_ID,
            "phone": TARGET_PHONE,
            "data": data
        }
        
        headers = {"X-API-Key": OPENCLAW_API_KEY}
        response = requests.post(OPENCLAW_WEBHOOK_URL, json=payload, headers=headers, timeout=15)
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"[OpenClaw] {trigger_type} at {trigger_time} - Action: {result.get('action', 'unknown')}")
            return True
        else:
            logger.warning(f"[OpenClaw] {trigger_type} returned {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"[OpenClaw] Failed to trigger: {e}")
        return False

def parse_time(time_str):
    """Parse time string HH:MM."""
    try:
        return datetime.strptime(time_str, "%H:%M")
    except:
        return None

def time_to_minutes(time_str):
    """Convert HH:MM to total minutes."""
    try:
        h, m = map(int, time_str.split(':'))
        return h * 60 + m
    except:
        return 0

def check_schedule_reminders():
    """
    Check schedule reminders dan trigger OpenClaw.
    Cuma kirim data mentah, OpenClaw yang decide.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        now = datetime.now()
        today = now.strftime('%Y-%m-%d')
        day_now = now.isoweekday()
        current_hour = now.hour
        current_minute = now.minute
        current_total_minutes = current_hour * 60 + current_minute
        
        # Ambil user_id
        cur.execute("SELECT telegram_user_id FROM users LIMIT 1")
        user_result = cur.fetchone()
        if not user_result:
            logger.warning("No users found")
            return
        
        # Ambil jadwal hari ini
        cur.execute("""
            SELECT id, course_name, start_time, end_time, room, lecturer, day_of_week
            FROM schedules 
            WHERE day_of_week = %s 
            AND is_active = true 
            ORDER BY start_time ASC
        """, (day_now,))
        
        schedules = cur.fetchall()
        if not schedules:
            logger.info("No schedules today")
            return
        
        logger.info(f"Found {len(schedules)} schedules today")
        
        # Load state
        state = load_state()
        today_state = state.get(today, {})
        
        # Process tiap jadwal
        for idx, schedule in enumerate(schedules):
            sched_id, course_name, start_time, end_time, room, lecturer, day = schedule
            start_dt = parse_time(start_time)
            
            if not start_dt:
                continue
            
            start_hour = start_dt.hour
            start_minute = start_dt.minute
            start_total_minutes = start_hour * 60 + start_minute
            is_first = (idx == 0)
            
            # Check: Jam 5:45 untuk matkul jam 8
            if start_hour == 8 and current_hour == 5 and current_minute == 45:
                trigger_key = f"{sched_id}_0545"
                if trigger_key not in today_state.get("triggered", {}):
                    # Trigger OpenClaw
                    trigger_openclaw("schedule", "05:45", {
                        "course": course_name,
                        "start_time": start_time,
                        "room": room,
                        "lecturer": lecturer,
                        "is_first_class": is_first,
                        "minutes_before": 135  # 2 jam 15 menit sebelum
                    })
                    
                    # Mark triggered
                    if "triggered" not in today_state:
                        today_state["triggered"] = {}
                    today_state["triggered"][trigger_key] = True
                    state[today] = today_state
                    save_state(state)
            
            # Check: 90 menit sebelum
            reminder_start = start_total_minutes - 90
            reminder_end = reminder_start + 10
            
            if reminder_start <= current_total_minutes <= reminder_end:
                trigger_key = f"{sched_id}_90min"
                if trigger_key not in today_state.get("triggered", {}):
                    trigger_openclaw("schedule", f"{current_hour}:{current_minute:02d}", {
                        "course": course_name,
                        "start_time": start_time,
                        "room": room,
                        "lecturer": lecturer,
                        "is_first_class": is_first,
                        "minutes_before": 90
                    })
                    
                    today_state["triggered"][trigger_key] = True
                    state[today] = today_state
                    save_state(state)
            
            # Check: 15 menit sebelum (hanya untuk matkul berikutnya)
            if not is_first:  # Skip first class karena udah ada 90min reminder
                reminder_start = start_total_minutes - 15
                reminder_end = reminder_start + 10
                
                if reminder_start <= current_total_minutes <= reminder_end:
                    trigger_key = f"{sched_id}_15min"
                    if trigger_key not in today_state.get("triggered", {}):
                        trigger_openclaw("schedule", f"{current_hour}:{current_minute:02d}", {
                            "course": course_name,
                            "start_time": start_time,
                            "room": room,
                            "lecturer": lecturer,
                            "is_first_class": False,
                            "minutes_before": 15
                        })
                        
                        today_state["triggered"][trigger_key] = True
                        state[today] = today_state
                        save_state(state)
        
        cur.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"Error check_schedule_reminders: {e}")

def check_task_reminders():
    """
    Check task reminders (jam 15:00) dan trigger OpenClaw.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        now = datetime.now()
        today = now.strftime('%Y-%m-%d')
        current_hour = now.hour
        current_minute = now.minute
        
        # Cek apakah sudah trigger hari ini
        state = load_state()
        today_state = state.get(today, {})
        
        if today_state.get("task_triggered"):
            return
        
        # Window: jam 15:00 - 15:10
        if not (current_hour == 15 and current_minute <= 10):
            return
        
        # Ambil user_id
        cur.execute("SELECT telegram_user_id FROM users LIMIT 1")
        user_result = cur.fetchone()
        if not user_result:
            return
        
        # Ambil tugas deadline 3 hari ke depan
        three_days_later = (now + timedelta(days=3)).strftime('%Y-%m-%d')
        
        cur.execute("""
            SELECT id, title, course, type, deadline, note, status
            FROM assignments
            WHERE deadline <= %s
            AND deadline >= %s
            AND status NOT IN ('Completed', 'completed')
            ORDER BY deadline ASC, created_at ASC
        """, (three_days_later, today))
        
        tasks = cur.fetchall()
        if not tasks:
            logger.info("No pending tasks for reminder")
            return
        
        # Prepare task list
        tasks_list = []
        for idx, task in enumerate(tasks, 1):
            task_id, title, course, task_type, deadline, note, status = task
            
            deadline_date = datetime.strptime(deadline, '%Y-%m-%d')
            days_left = (deadline_date - now).days
            
            if days_left == 0:
                urgency = "🔴 *BESOK*"
            elif days_left == 1:
                urgency = "🟠 *LUSA*"
            else:
                urgency = f"🟡 {days_left} hari lagi"
            
            tasks_list.append({
                "number": idx,
                "id": task_id,
                "title": title,
                "course": course,
                "type": task_type,
                "deadline": deadline,
                "note": note,
                "days_left": days_left,
                "urgency": urgency
            })
        
        # Trigger OpenClaw
        trigger_openclaw("task_list", "15:00", {
            "tasks": tasks_list,
            "count": len(tasks_list)
        })
        
        # Mark triggered
        today_state["task_triggered"] = True
        state[today] = today_state
        save_state(state)
        
        cur.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"Error check_task_reminders: {e}")

def night_preview():
    """
    Night preview jam 21:00 - trigger OpenClaw dengan jadwal besok.
    """
    try:
        now = datetime.now()
        current_hour = now.hour
        current_minute = now.minute
        
        # Window: jam 21:00 - 21:10
        if not (current_hour == 21 and current_minute <= 10):
            return
        
        tomorrow = (now + timedelta(days=1)).strftime('%Y-%m-%d')
        tomorrow_day = (now + timedelta(days=1)).isoweekday()
        
        # Cek sudah trigger belum
        state = load_state()
        if state.get(f"preview_{tomorrow}"):
            return
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Ambil jadwal besok
        cur.execute("""
            SELECT id, course_name, start_time, end_time, room, lecturer
            FROM schedules 
            WHERE day_of_week = %s 
            AND is_active = true 
            ORDER BY start_time ASC
        """, (tomorrow_day,))
        
        schedules = cur.fetchall()
        
        # Ambil tugas besok
        three_days = (now + timedelta(days=3)).strftime('%Y-%m-%d')
        cur.execute("""
            SELECT id, title, course, deadline
            FROM assignments
            WHERE deadline <= %s AND deadline >= %s
            AND status NOT IN ('Completed', 'completed')
        """, (three_days, tomorrow))
        
        tasks = cur.fetchall()
        tasks_list = [{
            "id": t[0],
            "title": t[1],
            "course": t[2],
            "deadline": t[3],
            "days_left": (datetime.strptime(t[3], '%Y-%m-%d') - now).days
        } for t in tasks]
        
        # Trigger OpenClaw
        schedules_list = [{
            "id": s[0],
            "course_name": s[1],
            "start_time": s[2],
            "end_time": s[3],
            "room": s[4],
            "lecturer": s[5]
        } for s in schedules]
        
        trigger_openclaw("night_preview", "21:00", {
            "tomorrow_schedules": schedules_list,
            "tomorrow_tasks": tasks_list,
            "date": tomorrow
        })
        
        # Mark triggered
        state[f"preview_{tomorrow}"] = True
        save_state(state)
        
        cur.close()
        conn.close()
        
        logger.info(f"[Night Preview] Triggered for {tomorrow}")
        
    except Exception as e:
        logger.error(f"Error night_preview: {e}")

if __name__ == "__main__":
    logger.info("="*50)
    logger.info("ReminderBot - Trigger Only Mode")
    logger.info("Semua decision di OpenClaw")
    logger.info("="*50)
    logger.info(f"OpenClaw URL: {OPENCLAW_WEBHOOK_URL}")
    logger.info(f"Target User ID: {TARGET_USER_ID}")
    logger.info(f"Target Phone: {TARGET_PHONE}")
    logger.info("="*50)
    
    while True:
        now = datetime.now()
        
        # Check schedule reminders
        check_schedule_reminders()
        
        # Check task reminders (jam 15:00)
        if now.hour == 15:
            check_task_reminders()
        
        # Night preview (jam 21:00)
        if now.hour == 21:
            night_preview()
        
        time.sleep(60)  # Cek tiap 1 menit
