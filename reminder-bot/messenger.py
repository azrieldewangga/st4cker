#!/usr/bin/env python3
import psycopg2
import time
import requests
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

DB_CONFIG = {
    "host": "st4cker-db",
    "port": "5432",
    "database": "st4cker_db",
    "user": "st4cker_admin",
    "password": "Parkit234"
}

# Pastikan endpoint /send-message sudah ada di st4cker-bot kamu
WA_API_URL = "http://st4cker-bot:3000/send-message" 

def send_to_whatsapp(message):
    try:
        # GANTI 6281311417727 dengan nomor WA kamu (contoh: 628123456789)
        payload = {"to": "6281311417727", "message": message} 
        response = requests.post(WA_API_URL, json=payload, timeout=10)
        return response.status_code == 200
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
                logger.info(f"Pesan {task_id} sukses terkirim!")
            else:
                logger.warning(f"Gagal mengirim pesan {task_id}, akan dicoba lagi nanti.")
        
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Error Database: {e}")

if __name__ == "__main__":
    logger.info("Messenger Aktif - Menunggu antrean outbox...")
    while True:
        poll_outbox()
        time.sleep(300) # Cek tiap 5 menit
