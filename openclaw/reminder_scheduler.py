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
    def __init__(self):
        self.smart_reminder = smart_reminder
        self.target_phone = os.getenv("REMINDER_TARGET_PHONE", "6281311417727")
        self.check_interval = 60
        self._running = False
        self._task = None
        self.last_check = None
        self.notified_today = set()
        self.pending_retry = {}
    
    def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._scheduler_loop())
        logger.info("[SmartReminder] Scheduler started")
    
    def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None
    
    async def _scheduler_loop(self):
        await asyncio.sleep(5)
        while self._running:
            try:
                await self._check_and_notify()
                self.last_check = datetime.now()
            except Exception as e:
                logger.error(f"[SmartReminder] Error: {e}")
            await asyncio.sleep(self.check_interval)
    
    async def _check_and_notify(self):
        try:
            reminder = await self.smart_reminder.get_next_reminder()
            if not reminder:
                return
            
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
        try:
            target = phone or self.target_phone
            cmd = ["openclaw", "message", "send", "--channel", "whatsapp", "--target", target, "--message", message]
            
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60.0)
            
            if proc.returncode == 0:
                return True
            else:
                logger.error(f"OpenClaw error: {stderr.decode()[:200]}")
                return False
        except Exception as e:
            logger.error(f"Exception: {e}")
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
