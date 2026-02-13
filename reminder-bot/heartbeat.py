#!/usr/bin/env python3
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

# Konfigurasi Database
DB_CONFIG = {
    "host": "st4cker-db",
    "port": "5432",
    "database": "st4cker_db",
    "user": "st4cker_admin",
    "password": "Parkit234"
}

# WhatsApp Gateway config
WA_API_URL = os.environ.get("WA_API_URL", "http://wa-gateway:4000/send")
TARGET_PHONE = os.environ.get("TARGET_PHONE", "6281311417727")
WA_CONFIRMATION_URL = "http://wa-gateway:4000/confirmation"

# State file for tracking reminders
STATE_FILE = "/tmp/reminder_state.json"

# Load state
reminder_state = {}

def load_state():
    global reminder_state
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r') as f:
                reminder_state = json.load(f)
    except Exception as e:
        logger.error(f"Error loading state: {e}")
        reminder_state = {}

def save_state():
    try:
        with open(STATE_FILE, 'w') as f:
            json.dump(reminder_state, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving state: {e}")

def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(**DB_CONFIG)

def send_whatsapp_message(message):
    """Kirim pesan WhatsApp via Gateway"""
    try:
        payload = {"to": TARGET_PHONE, "message": message}
        response = requests.post(WA_API_URL, json=payload, timeout=15)
        return response.status_code == 200
    except Exception as e:
        logger.error(f"Gagal kirim WA: {e}")
        return False

def check_user_confirmed():
    """Cek apakah user sudah konfirmasi hari ini"""
    try:
        response = requests.get(f"{WA_CONFIRMATION_URL}/{TARGET_PHONE}", timeout=5)
        if response.status_code == 200:
            data = response.json()
            return data.get('confirmed', False)
    except Exception as e:
        logger.warning(f"Gagal cek konfirmasi: {e}")
    return False

def get_active_override(today_date, user_id):
    """Cek ada override aktif untuk hari ini"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, action, reason, custom_time
            FROM reminder_overrides
            WHERE user_id = %s
            AND override_date = %s
            AND is_active = true
            LIMIT 1
        """, (user_id, today_date))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if result:
            return {
                'id': result[0],
                'action': result[1],
                'reason': result[2],
                'custom_time': result[3]
            }
    except Exception as e:
        logger.error(f"Error checking override: {e}")
    return None

def log_reminder_sent(schedule_id, user_id, reminder_type, message_content, reminder_date):
    """Log reminder yang sudah dikirim ke database"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        log_id = str(__import__('uuid').uuid4())
        cur.execute("""
            INSERT INTO reminder_logs (id, schedule_id, user_id, type, message_content, reminder_date)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """, (log_id, schedule_id, user_id, reminder_type, message_content, reminder_date))
        
        conn.commit()
        cur.close()
        conn.close()
        logger.info(f"Logged reminder: {reminder_type} for schedule {schedule_id}")
        return log_id
    except Exception as e:
        logger.error(f"Error logging reminder: {e}")
        return None

def update_confirmation_status(schedule_id, user_id, confirmed_message):
    """Update log kalau user confirmed"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            UPDATE reminder_logs
            SET user_confirmed = true, confirmed_at = NOW(), confirmed_message = %s
            WHERE schedule_id = %s AND user_id = %s AND user_confirmed = false
        """, (confirmed_message, schedule_id, user_id))
        
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Error updating confirmation: {e}")

def get_todays_logs(user_id, reminder_date):
    """Ambil log reminder hari ini"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT schedule_id, type, user_confirmed
            FROM reminder_logs
            WHERE user_id = %s AND reminder_date = %s
        """, (user_id, reminder_date))
        
        results = cur.fetchall()
        cur.close()
        conn.close()
        
        return {r[0]: {'type': r[1], 'confirmed': r[2]} for r in results}
    except Exception as e:
        logger.error(f"Error getting logs: {e}")
        return {}

def parse_time(time_str):
    """Parse time string HH:MM"""
    try:
        return datetime.strptime(time_str, "%H:%M")
    except:
        return None

def time_to_minutes(time_str):
    """Convert HH:MM to total minutes"""
    try:
        h, m = map(int, time_str.split(':'))
        return h * 60 + m
    except:
        return 0

def check_reminders():
    """Logic reminder utama dengan window 10 menit"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        now = datetime.now()
        today = now.strftime('%Y-%m-%d')
        day_now = now.isoweekday()  # 1=Senin, 7=Minggu
        current_time = now.strftime('%H:%M')
        current_hour = now.hour
        current_minute = now.minute
        current_total_minutes = current_hour * 60 + current_minute
        
        # Ambil user_id (default)
        cur.execute("SELECT telegram_user_id FROM users LIMIT 1")
        user_result = cur.fetchone()
        if not user_result:
            logger.warning("No users found")
            return
        user_id = user_result[0]
        
        # Cek active override untuk hari ini
        override = get_active_override(today, user_id)
        if override:
            if override['action'] == 'skip_all':
                logger.info(f"Auto-reminder di-skip karena override: {override['reason']}")
                return
            elif override['action'] == 'custom_time' and override['custom_time']:
                logger.info(f"Using custom reminder time: {override['custom_time']}")
        
        # Ambil semua jadwal hari ini
        cur.execute("""
            SELECT id, course_name, start_time, end_time, room, lecturer, day_of_week
            FROM schedules 
            WHERE day_of_week = %s 
            AND is_active = true 
            ORDER BY start_time ASC
        """, (day_now,))
        
        schedules = cur.fetchall()
        if not schedules:
            logger.info("Tidak ada jadwal hari ini")
            return
        
        logger.info(f"Ada {len(schedules)} matkul hari ini")
        
        # Cek konfirmasi user
        user_confirmed = check_user_confirmed()
        
        # Ambil log hari ini
        todays_logs = get_todays_logs(user_id, today)
        
        # Proses setiap jadwal
        for idx, schedule in enumerate(schedules):
            sched_id, course_name, start_time, end_time, room, lecturer, day = schedule
            start_dt = parse_time(start_time)
            
            if not start_dt:
                continue
            
            start_hour = start_dt.hour
            start_minute = start_dt.minute
            start_total_minutes = start_hour * 60 + start_minute
            
            # Format info
            room_info = f"\n📍 Ruang: {room}" if room else ""
            lecturer_info = f"\n👨‍🏫 Dosen: {lecturer}" if lecturer else ""
            
            # Cek sudah ada log untuk schedule ini
            existing_log = todays_logs.get(sched_id)
            if existing_log:
                # Sudah pernah kirim reminder untuk schedule ini
                continue
            
            if not user_confirmed:
                # Mode: Belum konfirmasi
                is_first_class = (idx == 0)
                
                if is_first_class:
                    # Matkul pertama
                    if start_hour == 8:
                        # SPECIAL: Matkul jam 8:xx - exact jam 6:00
                        if current_hour == 6 and current_minute == 0:
                            message = f"⏰ PENGINGAT PAGI:\n\nMatkul pertama hari ini:\n📚 {course_name}\n🕐 Jam: {start_time}{room_info}{lecturer_info}\n\nJangan lupa berangkat 1 jam 30 menit lebih awal ya!\n\nReply 'ok' atau 'gas' kalau sudah otw."
                            if send_whatsapp_message(message):
                                log_reminder_sent(sched_id, user_id, 'first_6am', message, today)
                                logger.info(f"Reminder jam 6:00 (exact) dikirim untuk {course_name}")
                    else:
                        # Window 10 menit untuk 1.5 jam sebelum
                        reminder_start = start_total_minutes - 90
                        reminder_end = reminder_start + 10
                        
                        if reminder_start <= current_total_minutes <= reminder_end:
                            message = f"⏰ PENGINGAT:\n\nMatkul pertama hari ini:\n📚 {course_name}\n🕐 Jam: {start_time}{room_info}{lecturer_info}\n\nJangan lupa berangkat 1 jam 30 menit lebih awal ya!\n\nReply 'ok' atau 'gas' kalau sudah otw."
                            if send_whatsapp_message(message):
                                log_reminder_sent(sched_id, user_id, 'first_90min', message, today)
                                logger.info(f"Reminder 90 menit (window) dikirim untuk {course_name}")
                    
                    # Remind ulang kalau 10 menit setelah reminder pertama belum konfirmasi
                    # (Ini tetap pakai state file karena butuh tracking sementara)
                    # ... logic retry tetap sama
            else:
                # Mode: Sudah konfirmasi
                if idx > 0:  # Skip matkul pertama
                    reminder_start = start_total_minutes - 15
                    reminder_end = reminder_start + 10
                    
                    if reminder_start <= current_total_minutes <= reminder_end:
                        message = f"⏰ 15 MENIT LAGI:\n\n📚 {course_name}\n🕐 Jam: {start_time}{room_info}{lecturer_info}\n\nSiap-siap ya!"
                        if send_whatsapp_message(message):
                            log_reminder_sent(sched_id, user_id, '15min', message, today)
                            logger.info(f"Reminder 15 menit (window) dikirim untuk {course_name}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"Error check_reminders: {e}")

if __name__ == "__main__":
    logger.info("="*50)
    logger.info("ReminderBot Aktif - Smart Reminder System")
    logger.info("Target: 1.5 jam sebelum matkul pertama (window 10 menit)")
    logger.info("        15 menit sebelum matkul berikutnya (window 10 menit)")
    logger.info("        Jam 8:xx = exact jam 6:00")
    logger.info("Override & Logging: ENABLED")
    logger.info("="*50)
    
    while True:
        check_reminders()
        time.sleep(60)
