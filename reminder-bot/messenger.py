#!/usr/bin/env python3
import psycopg2
import os
import time
import requests
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "st4cker-db"),
    "port": os.environ.get("DB_PORT", "5432"),
    "database": os.environ.get("DB_NAME", "st4cker_db"),
    "user": os.environ.get("DB_USER", "st4cker_admin"),
    "password": os.environ.get("DB_PASS", "Parkit234")
}

# Telegram bridge endpoint (st4cker-bot container)
SEND_API_URL = os.environ.get("SEND_API_URL", "http://st4cker-bot:3000/send-message")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "1168825716")
REMINDER_SECRET = os.environ.get("REMINDER_SECRET", "")

def send_to_telegram(message):
    try:
        payload = {"chatId": TELEGRAM_CHAT_ID, "message": message}
        headers = {"Content-Type": "application/json"}
        if REMINDER_SECRET:
            headers["x-reminder-secret"] = REMINDER_SECRET
        
        response = requests.post(SEND_API_URL, json=payload, headers=headers, timeout=15)
        
        if response.status_code == 200:
            return True
        else:
            logger.error(f"API responded {response.status_code}: {response.text}")
            return False
    except Exception as e:
        logger.error(f"Gagal kirim Telegram: {e}")
        return False

def poll_outbox():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        cur.execute("SELECT id, message FROM outbox WHERE status = 'pending' ORDER BY created_at LIMIT 5")
        tasks = cur.fetchall()
        
        for task_id, msg in tasks:
            logger.info(f"Mengirim pesan ID {task_id}...")
            if send_to_telegram(msg):
                cur.execute("UPDATE outbox SET status = 'sent', sent_at = NOW() WHERE id = %s", (task_id,))
                logger.info(f"✅ Pesan {task_id} sukses terkirim via Telegram!")
            else:
                logger.warning(f"❌ Gagal mengirim pesan {task_id}, akan dicoba lagi nanti.")
        
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Error Database: {e}")

if __name__ == "__main__":
    logger.info("Messenger Aktif - Menunggu antrean outbox...")
    logger.info(f"Target: Telegram Chat ID {TELEGRAM_CHAT_ID}")
    logger.info(f"API: {SEND_API_URL}")
    while True:
        poll_outbox()
        time.sleep(60)  # Cek tiap 1 menit (was 5 menit)
