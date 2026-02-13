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

def check_user_response():
    """
    Cek response user - return:
    - 'confirmed' = user mengiyakan (ok, gas, otw, etc)
    - 'declined' = user menolak/menunda (tidak, nanti, skip, etc)
    - 'none' = belum ada response
    """
    try:
        # Ambil timestamp last message dari user
        # Ini simplified - sebenarnya perlu cek konten pesan
        response = requests.get(f"{WA_CONFIRMATION_URL}/{TARGET_PHONE}", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('confirmed', False):
                return 'confirmed'
            # Kalau ada data tapi tidak confirmed, cek apakah ada message lain
            # Untuk sekarang, anggap 'none' kalau tidak confirmed
    except Exception as e:
        logger.warning(f"Gagal cek response: {e}")
    return 'none'

def get_active_override(today_date, user_id):
    """Cek ada override aktif untuk tanggal tertentu"""
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
        
        import uuid
        log_id = str(uuid.uuid4())
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

# Keywords
CONFIRM_KEYWORDS = ['ok', 'oke', 'okee', 'gas', 'otw', 'iya', 'ya', 'yoi', 'siap', 'siapp', 'yuk', 'ayo', 'lanjut', 'gaskeun', 'let\'s go', 'lets go', 'baik', 'mantap']
DECLINE_KEYWORDS = ['tidak', 'ga', 'gak', 'nggak', 'skip', 'nanti', 'belum', 'tunda', 'cancel', 'batal', 'no', 'nope']

def is_schedule_cancelled(schedule_id, cancel_date, user_id):
    """Cek apakah matkul ini di-cancel untuk tanggal tertentu"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id FROM schedule_cancellations
            WHERE schedule_id = %s
            AND cancel_date = %s
            AND user_id = %s
            AND is_active = true
            LIMIT 1
        """, (schedule_id, cancel_date, user_id))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        return result is not None
    except Exception as e:
        logger.error(f"Error checking cancellation: {e}")
        return False

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
        
        # Ambil semua jadwal hari ini, urutkan by jam mulai
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
        
        # Cek response user (confirmed/declined/none)
        user_response = check_user_response()
        
        # Load state untuk tracking
        load_state()
        if today not in reminder_state:
            reminder_state[today] = {
                'reminders_sent': {},
                'user_confirmed': False,
                'user_declined': False,
                'response_time': None
            }
        
        today_state = reminder_state[today]
        
        # Update state berdasarkan response
        if user_response == 'confirmed':
            today_state['user_confirmed'] = True
            today_state['response_time'] = current_time
            save_state()
            logger.info("User confirmed/reminder acknowledged")
        # Note: decline detection lebih kompleks, perlu cek pesan langsung
        
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
            cur.execute("""
                SELECT id FROM reminder_logs 
                WHERE schedule_id = %s AND reminder_date = %s
            """, (sched_id, today))
            existing_log = cur.fetchone()
            
            if existing_log:
                continue  # Sudah pernah kirim reminder
            
            # Cek apakah matkul ini di-cancel untuk tanggal ini
            if is_schedule_cancelled(sched_id, today, user_id):
                logger.info(f"Skipping {course_name} - cancelled for {today}")
                continue
            
            if not today_state['user_confirmed']:
                # Mode: Belum konfirmasi (atau menolak/tunda)
                is_first_class = (idx == 0)
                
                if is_first_class:
                    # Matkul pertama
                    if start_hour == 8:
                        # SPECIAL: Matkul jam 8:xx - reminder EXACT jam 05:45
                        if current_hour == 5 and current_minute == 45:
                            message = f"⏰ PENGINGAT PAGI:\n\nMatkul pertama hari ini:\n📚 {course_name}\n🕐 Jam: {start_time}{room_info}{lecturer_info}\n\nJangan lupa berangkat 1 jam 30 menit lebih awal ya!\n\nReply 'ok' atau 'gas' kalau sudah otw."
                            if send_whatsapp_message(message):
                                log_reminder_sent(sched_id, user_id, 'first_545am', message, today)
                                logger.info(f"Reminder jam 05:45 (exact) dikirim untuk {course_name}")
                    else:
                        # Window 10 menit untuk 1.5 jam sebelum
                        reminder_start = start_total_minutes - 90
                        reminder_end = reminder_start + 10
                        
                        if reminder_start <= current_total_minutes <= reminder_end:
                            message = f"⏰ PENGINGAT:\n\nMatkul pertama hari ini:\n📚 {course_name}\n🕐 Jam: {start_time}{room_info}{lecturer_info}\n\nJangan lupa berangkat 1 jam 30 menit lebih awal ya!\n\nReply 'ok' atau 'gas' kalau sudah otw."
                            if send_whatsapp_message(message):
                                log_reminder_sent(sched_id, user_id, 'first_90min', message, today)
                                logger.info(f"Reminder 90 menit (window) dikirim untuk {course_name}")
                    
                    # Remind ulang kalau 10 menit setelah reminder pertama belum ada response positif
                    reminder_key = f"{sched_id}_sent"
                    if reminder_key in today_state.get('first_reminder_sent', {}):
                        sent_time = today_state['first_reminder_sent'][reminder_key]
                        sent_minutes = time_to_minutes(sent_time)
                        retry_time = sent_minutes + 10
                        
                        if current_total_minutes == retry_time and not today_state['user_confirmed']:
                            retry_key = f"{sched_id}_retry"
                            if retry_key not in today_state.get('retries_sent', {}):
                                message = f"⏰ REMINDER ULANG:\n\nJangan lupa matkul {course_name} jam {start_time}!\n\nReply 'ok' atau 'gas' kalau sudah otw ya!\n\n(Kalau tidak bisa berangkat, reply 'skip' atau 'nanti')"
                                if send_whatsapp_message(message):
                                    if 'retries_sent' not in today_state:
                                        today_state['retries_sent'] = {}
                                    today_state['retries_sent'][retry_key] = current_time
                                    save_state()
                                    logger.info(f"Reminder ulang dikirim untuk {course_name}")
                    else:
                        # Catat waktu reminder pertama dikirim
                        if 'first_reminder_sent' not in today_state:
                            today_state['first_reminder_sent'] = {}
                        today_state['first_reminder_sent'][reminder_key] = current_time
                        save_state()
            else:
                # Mode: Sudah konfirmasi
                if idx > 0:  # Skip matkul pertama karena user udah otw
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
    logger.info("        Jam 8:xx = exact jam 05:45")
    logger.info("        Konfirmasi: ok/gas/otw/etc = lanjut, selain itu = tunda")
    logger.info("Override & Logging: ENABLED")
    logger.info("="*50)
    
    while True:
        check_reminders()
        time.sleep(60)
