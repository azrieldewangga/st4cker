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

def parse_time(time_str):
    """Parse time string HH:MM"""
    try:
        return datetime.strptime(time_str, "%H:%M")
    except:
        return None

def check_reminders():
    """Logic reminder utama"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        now = datetime.now()
        today = now.strftime('%Y-%m-%d')
        day_now = now.isoweekday()  # 1=Senin, 7=Minggu
        current_time = now.strftime('%H:%M')
        current_hour = now.hour
        current_minute = now.minute
        
        # Load state
        load_state()
        if today not in reminder_state:
            reminder_state[today] = {
                'reminders_sent': {},  # schedule_id -> {sent_at, type}
                'user_confirmed': False,
                'confirmed_at': None
            }
        
        today_state = reminder_state[today]
        
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
        
        # Cek konfirmasi user
        user_confirmed = check_user_confirmed() or today_state.get('user_confirmed', False)
        
        if user_confirmed and not today_state.get('user_confirmed'):
            today_state['user_confirmed'] = True
            today_state['confirmed_at'] = current_time
            save_state()
            logger.info("User sudah konfirmasi OTW")
        
        # Proses setiap jadwal
        for idx, schedule in enumerate(schedules):
            sched_id, course_name, start_time, end_time, room, lecturer, day = schedule
            start_dt = parse_time(start_time)
            
            if not start_dt:
                continue
            
            # Hitung waktu reminder
            is_first_class = (idx == 0)
            start_hour = start_dt.hour
            start_minute = start_dt.minute
            
            # Format info ruangan dan dosen
            room_info = f"\n📍 Ruang: {room}" if room else ""
            lecturer_info = f"\n👨‍🏫 Dosen: {lecturer}" if lecturer else ""
            
            # Key untuk tracking
            reminder_key = f"{sched_id}"
            
            if not user_confirmed:
                # Mode: Belum konfirmasi
                # Cek apakah ini matkul pertama
                if is_first_class:
                    # Matkul pertama - cek waktu reminder
                    if start_hour == 8:
                        # Matkul jam 8:xx - reminder jam 6:00
                        if current_hour == 6 and current_minute == 0:
                            if reminder_key not in today_state['reminders_sent']:
                                message = f"⏰ PENGINGAT PAGI:\n\nMatkul pertama hari ini:\n📚 {course_name}\n🕐 Jam: {start_time}{room_info}{lecturer_info}\n\nJangan lupa berangkat 1 jam 30 menit lebih awal ya!\n\nReply 'ok' atau 'gas' kalau sudah otw."
                                if send_whatsapp_message(message):
                                    today_state['reminders_sent'][reminder_key] = {
                                        'sent_at': current_time,
                                        'type': 'first_6am',
                                        'course': course_name
                                    }
                                    save_state()
                                    logger.info(f"Reminder jam 6:00 dikirim untuk {course_name}")
                    else:
                        # Matkul pertama tapi bukan jam 8 - 1.5 jam sebelum
                        reminder_time = start_dt - timedelta(minutes=90)
                        if current_hour == reminder_time.hour and current_minute == reminder_time.minute:
                            if reminder_key not in today_state['reminders_sent']:
                                message = f"⏰ PENGINGAT:\n\nMatkul pertama hari ini:\n📚 {course_name}\n🕐 Jam: {start_time}{room_info}{lecturer_info}\n\nJangan lupa berangkat 1 jam 30 menit lebih awal ya!\n\nReply 'ok' atau 'gas' kalau sudah otw."
                                if send_whatsapp_message(message):
                                    today_state['reminders_sent'][reminder_key] = {
                                        'sent_at': current_time,
                                        'type': 'first_90min',
                                        'course': course_name
                                    }
                                    save_state()
                                    logger.info(f"Reminder 90 menit dikirim untuk {course_name}")
                    
                    # Remind ulang kalau 10 menit belum konfirmasi
                    if reminder_key in today_state['reminders_sent']:
                        sent_info = today_state['reminders_sent'][reminder_key]
                        sent_at = parse_time(sent_info['sent_at'])
                        if sent_at:
                            remind_again_time = sent_at + timedelta(minutes=10)
                            if current_hour == remind_again_time.hour and current_minute == remind_again_time.minute:
                                retry_key = f"{sched_id}_retry"
                                if retry_key not in today_state['reminders_sent']:
                                    message = f"⏰ REMINDER ULANG:\n\nJangan lupa matkul {course_name} jam {start_time}!\n\nReply 'ok' atau 'gas' kalau sudah otw ya!"
                                    if send_whatsapp_message(message):
                                        today_state['reminders_sent'][retry_key] = {
                                            'sent_at': current_time,
                                            'type': 'retry',
                                            'course': course_name
                                        }
                                        save_state()
                                        logger.info(f"Reminder ulang dikirim untuk {course_name}")
            else:
                # Mode: Sudah konfirmasi
                # Reminder 15 menit sebelum matkul (mulai dari matkul kedua)
                if idx > 0:  # Skip matkul pertama karena user udah otw
                    reminder_time = start_dt - timedelta(minutes=15)
                    if current_hour == reminder_time.hour and current_minute == reminder_time.minute:
                        if reminder_key not in today_state['reminders_sent']:
                            message = f"⏰ 15 MENIT LAGI:\n\n📚 {course_name}\n🕐 Jam: {start_time}{room_info}{lecturer_info}\n\nSiap-siap ya!"
                            if send_whatsapp_message(message):
                                today_state['reminders_sent'][reminder_key] = {
                                    'sent_at': current_time,
                                    'type': '15min',
                                    'course': course_name
                                }
                                save_state()
                                logger.info(f"Reminder 15 menit dikirim untuk {course_name}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"Error check_reminders: {e}")

if __name__ == "__main__":
    logger.info("="*50)
    logger.info("ReminderBot Aktif - Smart Reminder System")
    logger.info("Target: 1.5 jam sebelum matkul pertama")
    logger.info("        15 menit sebelum matkul berikutnya (setelah konfirmasi)")
    logger.info("="*50)
    
    # Check tiap 1 menit
    while True:
        check_reminders()
        time.sleep(60)
