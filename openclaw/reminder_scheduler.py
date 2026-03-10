"""
Reminder Scheduler - OpenClaw kirim langsung
"""
import os
import asyncio
import logging
import subprocess
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Set
from smart_reminder_subagent import SmartReminderSubagent, subagent as smart_reminder

logger = logging.getLogger(__name__)

class ReminderScheduler:
    def __init__(self, check_interval=60):
        self.smart_reminder = smart_reminder
        self.target_phone = os.getenv("REMINDER_TARGET_PHONE", "6281311417727")
        self.check_interval = check_interval
        self._running = False
        self._task = None
        self.last_check = None
        self.notified_today = set()
        self.pending_retry = {}
    
    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._scheduler_loop())
        logger.info("[SmartReminder] Scheduler started")
    
    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
    
    async def _scheduler_loop(self):
        await asyncio.sleep(5)
        print("[SmartReminder] Scheduler loop started", flush=True)
        while self._running:
            try:
                print(f"[SmartReminder] Checking at {datetime.now()}", flush=True)
                await self._check_and_notify()
                self.last_check = datetime.now()
            except Exception as e:
                print(f"[SmartReminder] Error: {e}", flush=True)
                logger.error(f"[SmartReminder] Error: {e}")
            await asyncio.sleep(self.check_interval)
    
    async def _check_and_notify(self):
        try:
            logger.info("[SmartReminder] Checking for reminders...")
            reminder = await self.smart_reminder.get_next_reminder()
            if not reminder:
                logger.info("[SmartReminder] No reminder due")
                return
            logger.info(f"[SmartReminder] Got reminder: {reminder}")
            
            course_name = reminder.get('course_name', 'Unknown')
            start_time = reminder.get('start_time', '')
            reminder_key = f"{course_name}_{start_time}"
            
            if reminder_key in self.notified_today:
                return
            
            message = self._generate_message(reminder)
            success = await self._send_via_openclaw(message)
            
            if success:
                self.notified_today.add(reminder_key)
                logger.info(f"✅ [OpenClaw] Sent: {course_name}")
                await self.smart_reminder.update_attendance(course_name, 'reminded')
            else:
                logger.error(f"❌ [OpenClaw] Failed: {course_name}")
        except Exception as e:
            logger.error(f"❌ Error: {e}")
    
    def _generate_message(self, reminder):
        course_name = reminder.get('course_name', 'Unknown')
        room = reminder.get('room', 'TBA')
        start_time = reminder.get('start_time', '')
        lecturer = reminder.get('lecturer', '')
        
        start_str = start_time[:5] if len(start_time) >= 5 else start_time
        
        return (
            f"⏰ *Pengingat Jadwal*\n\n"
            f"📚 {course_name}\n"
            f"🕐 {start_str} WIB\n"
            f"📍 {room}\n"
            f"👤 {lecturer}\n\n"
            f"Apakah kamu akan hadir?\n"
            f"Balas: *hadir*, *tidak*, atau *ragu*"
        )
    
    async def _send_via_openclaw(self, message, phone=None):
        """Send message via st4cker-bot Telegram API"""
        try:
            import httpx
            
            target = phone or self.target_phone
            st4cker_api = os.getenv("ST4CKER_API_URL", "http://st4cker-bot:3000")
            reminder_secret = os.getenv("REMINDER_SECRET", "r3m1nd3r_s3cr3t")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{st4cker_api}/send-message",
                    headers={"x-reminder-secret": reminder_secret},
                    json={
                        "chatId": target,
                        "message": message
                    },
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    return True
                else:
                    logger.error(f"Send message error: {response.status_code} - {response.text[:200]}")
                    return False
        except Exception as e:
            logger.error(f"Exception sending message: {e}")
            return False
    
    def get_status(self):
        return {
            "running": self._running,
            "last_check": self.last_check.isoformat() if self.last_check else None,
            "notified_today": list(self.notified_today),
            "target_phone": self.target_phone,
            "method": "openclaw_direct"
        }

scheduler = ReminderScheduler()
