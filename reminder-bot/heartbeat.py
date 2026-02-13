#!/usr/bin/env python3
import psycopg2
import time
from datetime import datetime
import logging

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

def check_reminders():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        now = datetime.now()
        day_now = now.isoweekday() 

        # Logika Pengingat 1.5 jam sebelum matkul
        cur.execute("""
            SELECT id, course_name, start_time 
            FROM schedules 
            WHERE day_of_week = %s 
            AND is_active = true 
            AND CURRENT_TIME BETWEEN (start_time - INTERVAL '90 minutes') AND start_time
        """, (day_now,))
        
        results = cur.fetchall()
        for row in results:
            msg = f"⏰ PENGINGAT: Matkul {row[1]} akan mulai jam {row[2]}, zril!"
            # Cek duplikasi pesan di outbox hari ini
            cur.execute("SELECT id FROM outbox WHERE message = %s AND DATE(created_at) = CURRENT_DATE", (msg,))
            if not cur.fetchone():
                cur.execute("INSERT INTO outbox (message) VALUES (%s)", (msg,))
                logger.info(f"Berhasil membuat antrean pesan untuk: {row[1]}")
        
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Error Database: {e}")

if __name__ == "__main__":
    logger.info("="*50)
    logger.info("ReminderBot Aktif - Memantau Jadwal Semester 4 PENS")
    logger.info("="*50)
    while True:
        check_reminders()
        time.sleep(900) # Cek setiap 15 menit
