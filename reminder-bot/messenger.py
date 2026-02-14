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
    "password": os.environ.get("DB_PASSWORD", "")  # NO DEFAULT
}

# WhatsApp Gateway endpoint
WA_API_URL = os.environ.get("WA_API_URL", "http://wa-gateway:4000/send")
TARGET_PHONE = os.environ.get("TARGET_PHONE", "")  # MUST be set via environment

def send_to_whatsapp(message):
    try:
        payload = {"to": TARGET_PHONE, "message": message}
        response = requests.post(WA_API_URL, json=payload, timeout=15)
        
        if response.status_code == 200:
            return True
        elif response.status_code == 503:
            logger.warning("WhatsApp belum connected. Cek QR code: docker logs wa-gateway")
            return False
        else:
            logger.error(f"WA Gateway responded {response.status_code}: {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        logger.warning("WA Gateway belum ready, coba lagi nanti...")
        return False
    except Exception as e:
        logger.error(f"Gagal kirim WA: {e}")
        return False

def poll_outbox():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        cur.execute("SELECT id, message FROM outbox WHERE status = 'pending' ORDER BY created_at LIMIT 5")
        tasks = cur.fetchall()
        
        for task_id, msg in tasks:
            logger.info(f"Mengirim pesan ID {task_id}...")
            if send_to_whatsapp(msg):
                cur.execute("UPDATE outbox SET status = 'sent', sent_at = NOW() WHERE id = %s", (task_id,))
                logger.info(f"✅ Pesan {task_id} terkirim via WhatsApp!")
            else:
                logger.warning(f"❌ Gagal mengirim pesan {task_id}, akan dicoba lagi nanti.")
        
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Error Database: {e}")

if __name__ == "__main__":
    logger.info("Messenger Aktif - Menunggu antrean outbox...")
    logger.info(f"Target WA: {TARGET_PHONE}")
    logger.info(f"Gateway: {WA_API_URL}")
    while True:
        poll_outbox()
        time.sleep(60)  # Cek tiap 1 menit
