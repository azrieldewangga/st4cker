#!/usr/bin/env python3
"""
Follow-up Bot - Trigger Only
Trigger follow-up ke OpenClaw berdasarkan urgency tugas.
OpenClaw yang decide mode & response.
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
TARGET_PHONE = os.environ.get("TARGET_PHONE", "")  # MUST be set via environment

# Validate required environment variables
if not TARGET_PHONE:
    logger.error("❌ ERROR: TARGET_PHONE environment variable must be set!")
    logger.error("   Example: TARGET_PHONE=6281234567890")
    exit(1)

if not DB_CONFIG["password"]:
    logger.error("❌ ERROR: DB_PASSWORD environment variable must be set!")
    exit(1)

# State file
STATE_FILE = "/tmp/followup_state.json"

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
    Trigger OpenClaw dengan data follow-up.
    """
    try:
        payload = {
            "event": "reminder_trigger",
            "source": "followup-bot",
            "trigger_type": trigger_type,
            "trigger_time": trigger_time,
            "user_id": TARGET_PHONE,
            "phone": TARGET_PHONE,
            "data": data
        }
        
        response = requests.post(OPENCLAW_WEBHOOK_URL, json=payload, timeout=15)
        
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

def was_reminder_sent_today(cur, user_id, today):
    """
    Check if initial task reminder was sent today (jam 15:00).
    """
    try:
        cur.execute("""
            SELECT id FROM reminder_logs
            WHERE user_id = %s
            AND reminder_date = %s
            AND type = 'task_daily'
            LIMIT 1
        """, (user_id, today))
        return cur.fetchone() is not None
    except Exception as e:
        logger.error(f"Error checking reminder log: {e}")
        return False


def check_followup_reminders():
    """
    Check follow-up jam 20:00.
    Trigger OpenClaw untuk tugas yang perlu follow-up.
    Hanya kirim jika user sudah menerima reminder jam 15:00.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        now = datetime.now()
        today = now.strftime('%Y-%m-%d')
        current_hour = now.hour
        current_minute = now.minute
        
        # Window: jam 20:00 - 20:10
        if not (current_hour == 20 and current_minute <= 10):
            return
        
        # Cek sudah trigger belum
        state = load_state()
        if state.get(f"followup_{today}"):
            return
        
        # Get user_id
        cur.execute("SELECT telegram_user_id FROM users LIMIT 1")
        user_result = cur.fetchone()
        if not user_result:
            logger.info("No users found")
            return
        user_id = user_result[0]
        
        # CEK: Apakah reminder jam 15:00 sudah dikirim hari ini?
        if not was_reminder_sent_today(cur, user_id, today):
            logger.info("[Follow-up] SKIP - Initial task reminder (15:00) was NOT sent today")
            # Mark as triggered anyway to prevent retrying
            state[f"followup_{today}"] = True
            save_state(state)
            return
        
        logger.info("[Follow-up] Initial reminder was sent, proceeding with follow-up check")
        
        # Ambil tugas dengan deadline H-0 s/d H-3
        three_days_later = (now + timedelta(days=3)).strftime('%Y-%m-%d')
        
        cur.execute("""
            SELECT id, title, course, deadline, status, 
                   COALESCE(progress, 0) as progress
            FROM assignments
            WHERE deadline <= %s
            AND deadline >= %s
            AND status NOT IN ('Completed', 'completed', 'Cancelled')
            ORDER BY deadline ASC
        """, (three_days_later, today))
        
        tasks = cur.fetchall()
        if not tasks:
            logger.info("No tasks for follow-up")
            return
        
        logger.info(f"Found {len(tasks)} tasks for follow-up")
        
        # Process tiap tugas
        for task in tasks:
            task_id, title, course, deadline, status, progress = task
            
            deadline_date = datetime.strptime(deadline, '%Y-%m-%d')
            days_left = (deadline_date - now).days
            hours_left = (deadline_date - now).total_seconds() / 3600
            
            # Determine trigger type berdasarkan urgency
            # Tapi OpenClaw yang decide mode sebenarnya
            
            if days_left <= 0:  # H-0 atau overdue
                trigger_type = "crisis_check"
            elif days_left == 1:  # H-1
                if status == "in_progress":
                    trigger_type = "followup"
                else:
                    trigger_type = "crisis_check"
            elif status == "in_progress":
                trigger_type = "followup"
            else:
                trigger_type = "followup"  # gentle nudge
            
            # Trigger OpenClaw
            trigger_openclaw(trigger_type, "20:00", {
                "mode": "auto",  # OpenClaw yang decide sebenarnya
                "task": {
                    "id": task_id,
                    "title": title,
                    "course": course,
                    "deadline": deadline,
                    "status": status,
                    "progress": progress,
                    "days_left": days_left,
                    "hours_left": hours_left
                }
            })
        
        # Mark triggered
        state[f"followup_{today}"] = True
        save_state(state)
        
        cur.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"Error check_followup_reminders: {e}")

def check_crisis_reminders():
    """
    Check crisis reminders untuk H-1 dan H-0.
    Trigger di jam 09:00, 18:00 (H-1) dan 08:00, 14:00 (H-0).
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        now = datetime.now()
        today = now.strftime('%Y-%m-%d')
        current_hour = now.hour
        current_minute = now.minute
        
        # Window: xx:00 - xx:10
        if current_minute > 10:
            return
        
        # Define crisis check times
        crisis_times = [8, 9, 14, 18]  # 08:00, 09:00, 14:00, 18:00
        
        if current_hour not in crisis_times:
            return
        
        # Cek sudah trigger untuk jam ini
        state = load_state()
        trigger_key = f"crisis_{today}_{current_hour}"
        if state.get(trigger_key):
            return
        
        # Ambil tugas H-1 dan H-0 yang belum selesai
        tomorrow = (now + timedelta(days=1)).strftime('%Y-%m-%d')
        
        cur.execute("""
            SELECT id, title, course, deadline, status,
                   COALESCE(progress, 0) as progress
            FROM assignments
            WHERE deadline IN (%s, %s)
            AND status NOT IN ('Completed', 'completed')
            ORDER BY deadline ASC, progress ASC
        """, (today, tomorrow))
        
        tasks = cur.fetchall()
        if not tasks:
            return
        
        for task in tasks:
            task_id, title, course, deadline, status, progress = task
            
            deadline_date = datetime.strptime(deadline, '%Y-%m-%d')
            days_left = (deadline_date - now).days
            hours_left = (deadline_date - now).total_seconds() / 3600
            
            # Trigger crisis check
            trigger_openclaw("crisis_check", f"{current_hour:02d}:00", {
                "task": {
                    "id": task_id,
                    "title": title,
                    "course": course,
                    "deadline": deadline,
                    "status": status,
                    "progress": progress,
                    "days_left": days_left,
                    "hours_left": hours_left
                },
                "hours_left": hours_left
            })
        
        # Mark triggered
        state[trigger_key] = True
        save_state(state)
        
        cur.close()
        conn.close()
        
        logger.info(f"[Crisis Check] Triggered at {current_hour}:00 for {len(tasks)} tasks")
        
    except Exception as e:
        logger.error(f"Error check_crisis_reminders: {e}")

if __name__ == "__main__":
    logger.info("="*50)
    logger.info("Follow-up Bot - Trigger Only Mode")
    logger.info("Jam 20:00: Follow-up tugas")
    logger.info("H-1/H-0: Crisis check jam 09:00, 18:00, 08:00, 14:00")
    logger.info("="*50)
    logger.info(f"OpenClaw URL: {OPENCLAW_WEBHOOK_URL}")
    logger.info(f"Target Phone: {TARGET_PHONE}")
    logger.info("="*50)
    
    while True:
        now = datetime.now()
        
        # Check follow-up (jam 20:00)
        if now.hour == 20:
            check_followup_reminders()
        
        # Check crisis (jam 08, 09, 14, 18)
        if now.hour in [8, 9, 14, 18]:
            check_crisis_reminders()
        
        time.sleep(60)  # Cek tiap 1 menit
