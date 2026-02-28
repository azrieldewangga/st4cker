#!/usr/bin/env python3
"""
Reminder Scheduler - Internal Timer Loop for OpenClaw
NO CRON JOB! This runs as part of OpenClaw process.

Flow:
1. Runs check every minute (asyncio timer)
2. Asks SmartReminder subagent: "Any reminder due now?"
3. If yes, generates message and sends via OpenClaw
4. User replies → OpenClaw AI detects intent → updates SmartReminder
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from smart_reminder_subagent import subagent, SmartReminderSubagent
from attendance_nlu import AttendanceIntentDetector

logger = logging.getLogger(__name__)


class ReminderScheduler:
    """
    Internal scheduler that checks for reminders every minute.
    Runs as part of OpenClaw - no external cron needed!
    """
    
    def __init__(self, check_interval: int = 60):
        """
        Args:
            check_interval: Seconds between checks (default: 60 = 1 minute)
        """
        self.check_interval = check_interval
        self.subagent = SmartReminderSubagent()
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._last_check: Optional[datetime] = None
        
        # Track which reminders we've already notified about
        # Format: {"2026-02-27_Basis Data": True}
        self._notified_today: Dict[str, bool] = {}
        
        # Intent detector for attendance replies
        self.intent_detector = AttendanceIntentDetector()
    
    async def start(self):
        """Start the scheduler loop"""
        if self._running:
            logger.warning("Scheduler already running")
            return
        
        self._running = True
        self._task = asyncio.create_task(self._scheduler_loop())
        logger.info("=" * 60)
        logger.info("⏰ Reminder Scheduler Started")
        logger.info(f"   Check interval: {self.check_interval} seconds")
        logger.info("=" * 60)
    
    async def stop(self):
        """Stop the scheduler loop"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("⏰ Reminder Scheduler Stopped")
    
    async def _scheduler_loop(self):
        """Main scheduler loop - runs every minute"""
        while self._running:
            try:
                await self._check_and_notify()
                self._last_check = datetime.now()
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")
            
            # Wait for next check
            await asyncio.sleep(self.check_interval)
    
    async def _check_and_notify(self):
        """
        Check if there's a reminder due and notify OpenClaw to send it.
        This is the core logic called every minute.
        """
        now = datetime.now()
        
        # Daily reset at 4:00 AM
        if now.hour == 4 and now.minute == 0:
            logger.info("🌅 Daily reset triggered")
            await self.subagent.reset_daily()
            self._notified_today.clear()
            return
        
        # Ask SmartReminder if there's a reminder due now
        reminder = await self.subagent.get_next_reminder()
        
        if not reminder:
            return
        
        # Create unique key for this reminder
        today_str = now.strftime('%Y-%m-%d')
        reminder_key = f"{today_str}_{reminder['course_name']}"
        
        # Check if we already notified about this reminder
        if self._notified_today.get(reminder_key):
            logger.debug(f"Already notified for {reminder['course_name']}")
            return
        
        # Mark as notified
        self._notified_today[reminder_key] = True
        
        # Generate the message
        message = self._generate_message(reminder, now)
        
        # Log the reminder (OpenClaw will handle actual sending)
        logger.info(f"🔔 Reminder due: {reminder['course_name']} at {reminder['start_time']}")
        
        # Store in queue for OpenClaw to send
        # This will be picked up by OpenClaw's message sender
        await self._queue_message(message, reminder)
    
    def _generate_message(self, reminder: Dict[str, Any], now: datetime) -> str:
        """
        Generate a dynamic, context-rich reminder message.
        OpenClaw can further customize this before sending.
        """
        course_name = reminder['course_name']
        course_code = reminder.get('course_code', '')
        start_time = reminder['start_time']
        end_time = reminder.get('end_time', '')
        room = reminder.get('room', 'N/A')
        dosen = reminder.get('dosen', '')
        is_rescheduled = reminder.get('is_rescheduled', False)
        
        # Calculate time until class
        start_hour, start_min = map(int, start_time.split(':'))
        class_time = now.replace(hour=start_hour, minute=start_min, second=0, microsecond=0)
        
        if class_time < now:
            minutes_until = 0
        else:
            minutes_until = int((class_time - now).total_seconds() / 60)
        
        # Build message lines
        lines = []
        
        # Header based on urgency
        if minutes_until <= 0:
            lines.append(f"⏰ *Kuliah dimulai sekarang!*")
        elif minutes_until <= 15:
            lines.append(f"⏰ *Kuliah dalam {minutes_until} menit*")
        else:
            lines.append(f"📚 *Pengingat Kuliah*")
        
        lines.append("")
        
        # Course info
        if course_code:
            lines.append(f"*{course_name}* ({course_code})")
        else:
            lines.append(f"*{course_name}*")
        
        # Time
        if end_time:
            lines.append(f"🕐 {start_time} - {end_time}")
        else:
            lines.append(f"🕐 {start_time}")
        
        # Room
        if room and room != 'N/A':
            lines.append(f"📍 {room}")
        
        # Dosen
        if dosen:
            lines.append(f"👨‍🏫 {dosen}")
        
        # Rescheduled notice
        if is_rescheduled:
            lines.append("")
            lines.append("⚠️ *Jadwal ini pindah hari ini*")
        
        # Context-aware message
        lines.append("")
        if minutes_until <= 0:
            lines.append("Kelas sudah dimulai! Gaskeun! 🏃‍♂️")
        elif minutes_until <= 15:
            lines.append("Siap-siap berangkat ya! 💪")
        elif minutes_until <= 30:
            lines.append("Waktunya bersiap-siap! 🎒")
        else:
            lines.append("Jangan lupa siapin perlengkapannya ya! 📚")
        
        # Interactive hint for AI conversation
        lines.append("")
        lines.append("_Balas apa saja, aku akan mengerti maksudmu_ 😊")
        
        return "\n".join(lines)
    
    async def _queue_message(self, message: str, reminder: Dict[str, Any]):
        """
        Queue the message for OpenClaw to send.
        This stores in a way OpenClaw can pick up and send.
        """
        # Store in delivery queue or memory
        # OpenClaw will check this and send via WhatsApp
        reminder_context = {
            'type': 'course_reminder',
            'course': reminder['course_name'],
            'start_time': reminder['start_time'],
            'room': reminder.get('room'),
            'timestamp': datetime.now().isoformat(),
            'message': message
        }
        
        # Add to pending reminders queue
        # This will be processed by OpenClaw's message handler
        if not hasattr(self, '_pending_reminders'):
            self._pending_reminders = []
        
        self._pending_reminders.append(reminder_context)
        
        logger.info(f"📤 Reminder queued for sending: {reminder['course_name']}")
    
    def get_pending_reminders(self) -> list:
        """Get and clear pending reminders (called by OpenClaw)"""
        if not hasattr(self, '_pending_reminders'):
            return []
        
        reminders = self._pending_reminders.copy()
        self._pending_reminders.clear()
        return reminders
    
    async def handle_user_response(
        self, 
        user_message: str, 
        intent_data: Dict[str, Any]
    ) -> str:
        """
        Handle user response to reminder.
        Called by OpenClaw after AI detects intent.
        
        Returns: Response message to send back to user
        """
        intent = intent_data.get('intent', 'unknown')
        details = intent_data.get('details', {})
        
        # Update SmartReminder with the intent
        await self.subagent.update_attendance(intent, details)
        
        # Generate contextual response
        if intent == 'confirmed':
            delay = details.get('delay_minutes', 0)
            if delay > 0:
                return f"Oke! Ditunggu ya, semangat kuliahnya! 💪"
            else:
                return f"Oke! Semangat kuliahnya! 🎓"
        
        elif intent == 'declined':
            reason = details.get('reason', '')
            if reason:
                return f"Baik, dicatat ya. Semoga {reason}nya cepat berlalu 🤗"
            else:
                return f"Baik, dicatat ya. Istirahat yang cukup! ☕"
        
        elif intent == 'rescheduled':
            suggested_time = details.get('suggested_time', '')
            if suggested_time:
                return f"Oke, dicatat untuk {suggested_time} ya! 📅"
            else:
                return f"Oke, dicatat jadwal barunya! 📅"
        
        elif intent == 'delayed':
            delay = details.get('delay_minutes', 0)
            return f"Oke, ditunggu {delay} menit lagi ya! Jangan terlambat 😊"
        
        else:
            # Unknown intent - ask for clarification naturally
            return "Maaf, aku kurang paham. Maksudnya gimana ya? 😅"
    
    def is_attendance_related(self, message: str, context: Dict[str, Any] = None) -> bool:
        """Check if message is likely an attendance reply"""
        check_context = context or self._context
        
        # Check if we're expecting a reply
        if not check_context.get('awaiting_reply') and not check_context.get('awaiting_attendance_reply'):
            # Even if not explicitly awaiting, check if message looks like attendance
            result = self.intent_detector.detect(message, check_context)
            return result['confidence'] >= 0.6
        
        # Use NLU to check
        return self.intent_detector.is_attendance_related(message, check_context)
    
    def get_status(self) -> Dict[str, Any]:
        """Get scheduler status for debugging"""
        return {
            'running': self._running,
            'last_check': self._last_check.isoformat() if self._last_check else None,
            'notified_today': len(self._notified_today),
            'check_interval': self.check_interval,
            'pending_reminders': len(getattr(self, '_pending_reminders', []))
        }


# Global scheduler instance
scheduler = ReminderScheduler()


async def start_scheduler():
    """Start the reminder scheduler"""
    await scheduler.start()


async def stop_scheduler():
    """Stop the reminder scheduler"""
    await scheduler.stop()


def get_scheduler() -> ReminderScheduler:
    """Get the global scheduler instance"""
    return scheduler
