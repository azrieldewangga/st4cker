#!/usr/bin/env python3
"""
SmartReminder Integration for OpenClaw
Main interface that connects all components:
- ReminderScheduler (timer loop, no cron)
- SmartReminderSubagent (API to subagent)
- AttendanceIntentDetector (AI NLU)
- OpenClaw message sending

Usage:
    from reminder_integration import reminder_system
    
    # Start scheduler on OpenClaw startup
    await reminder_system.start()
    
    # Handle user reply (called by OpenClaw when user responds)
    response = await reminder_system.handle_user_reply(user_message, context)
    
    # Get pending reminders (called periodically by OpenClaw)
    reminders = reminder_system.get_pending_messages()
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from reminder_scheduler import ReminderScheduler, get_scheduler
from smart_reminder_subagent import SmartReminderSubagent, subagent
from attendance_nlu import AttendanceIntentDetector, detector

logger = logging.getLogger(__name__)


class SmartReminderSystem:
    """
    Main integration class for SmartReminder in OpenClaw.
    This is what OpenClaw uses to interact with the reminder subagent.
    """
    
    def __init__(self):
        self.scheduler = ReminderScheduler(check_interval=60)
        self.subagent = SmartReminderSubagent()
        self.intent_detector = AttendanceIntentDetector()
        self._started = False
        
        # Message queue for OpenClaw to pick up and send
        self._outgoing_messages: List[Dict[str, Any]] = []
        
        # Context for intent detection
        self._context = {
            'awaiting_reply': False,
            'last_reminder_course': None,
            'last_reminder_time': None
        }
    
    async def start(self):
        """Start the reminder system (called on OpenClaw startup)"""
        if self._started:
            return
        
        logger.info("=" * 60)
        logger.info("🚀 SmartReminder System Starting")
        logger.info("   Mode: Subagent (Passive API)")
        logger.info("   Scheduler: Internal Timer (No Cron)")
        logger.info("   AI NLU: Enabled")
        logger.info("=" * 60)
        
        # Start the scheduler loop
        await self.scheduler.start()
        
        self._started = True
        logger.info("✅ SmartReminder System Ready")
    
    async def stop(self):
        """Stop the reminder system"""
        await self.scheduler.stop()
        self._started = False
        logger.info("⏹️  SmartReminder System Stopped")
    
    def get_pending_messages(self) -> List[Dict[str, Any]]:
        """
        Get pending reminder messages that need to be sent.
        Called periodically by OpenClaw's main loop.
        
        Returns list of messages with format:
        {
            'type': 'course_reminder',
            'course': 'Basis Data',
            'message': '...',
            'timestamp': '...'
        }
        """
        # Get from scheduler's pending queue
        pending = self.scheduler.get_pending_reminders()
        
        # Add to our outgoing queue
        for reminder in pending:
            self._outgoing_messages.append({
                'type': 'course_reminder',
                'course': reminder['course'],
                'start_time': reminder['start_time'],
                'room': reminder.get('room'),
                'message': reminder['message'],
                'timestamp': reminder['timestamp']
            })
            
            # Update context for better intent detection
            self._context['awaiting_reply'] = True
            self._context['last_reminder_course'] = reminder['course']
            self._context['last_reminder_time'] = datetime.now().isoformat()
        
        # Return and clear outgoing messages
        messages = self._outgoing_messages.copy()
        self._outgoing_messages.clear()
        return messages
    
    async def handle_user_reply(
        self, 
        user_message: str,
        chat_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Handle user reply to a reminder.
        This is called by OpenClaw when user responds to reminder.
        
        Uses AI NLU to detect intent and generates appropriate response.
        
        Returns:
        {
            'intent': 'confirmed' | 'declined' | 'rescheduled' | 'unknown',
            'confidence': 0.9,
            'response': 'Oke! Semangat kuliahnya! 🎓',
            'action_taken': True
        }
        """
        chat_context = chat_context or {}
        
        # Merge contexts
        full_context = {**self._context, **chat_context}
        
        # Detect intent using AI NLU
        intent_result = self.intent_detector.detect(user_message, full_context)
        
        intent = intent_result['intent']
        confidence = intent_result['confidence']
        details = intent_result['details']
        
        logger.info(f"🧠 Intent detected: {intent} (confidence: {confidence:.2f})")
        
        # If confidence too low, ask for clarification
        if confidence < 0.3:
            return {
                'intent': 'unknown',
                'confidence': confidence,
                'response': "Maaf aku kurang paham maksudmu 😅. Maksudnya gimana ya?",
                'action_taken': False
            }
        
        # Update SmartReminder with the intent
        await self.subagent.update_attendance(intent, details)
        
        # Reset awaiting flag
        self._context['awaiting_reply'] = False
        
        # Generate contextual response
        response_message = self._generate_response(intent, details)
        
        return {
            'intent': intent,
            'confidence': confidence,
            'response': response_message,
            'action_taken': True,
            'details': details
        }
    
    def _generate_response(self, intent: str, details: Dict[str, Any]) -> str:
        """Generate contextual response based on intent"""
        
        if intent == 'confirmed':
            delay = details.get('delay_minutes', 0)
            if delay > 0:
                if delay < 60:
                    return f"Oke! Ditunggu {delay} menit lagi ya, jangan telat! 💪"
                else:
                    hours = delay // 60
                    return f"Oke! Ditunggu {hours} jam lagi ya! Jangan lupa berangkat 🎓"
            else:
                responses = [
                    "Oke! Semangat kuliahnya! 🎓",
                    "Siap! Jangan lupa catat materinya ya 📝",
                    "Oke! Tetap fokus dan semangat! 💪",
                    "Baik! Selamat belajar! 📚"
                ]
                # Rotate responses for variety
                import random
                return random.choice(responses)
        
        elif intent == 'declined':
            reason = details.get('reason', '')
            if reason == 'sakit':
                return "Baik, semoga cepat sembuh ya! Jangan lupa istirahat 🥺"
            elif reason == 'macet':
                return "Oke, hati-hati di jalan ya! Tetap sabar 🚗"
            elif reason == 'kerja':
                return "Baik, semoga kerjaannya lancar! Jangan lupa catch up materinya 📖"
            elif reason == 'ngantuk':
                return "Haha gapapa, istirahat dulu aja biar fresh nanti ☕"
            else:
                return "Baik, dicatat ya! Semoga harinya tetap produktif! ☕"
        
        elif intent == 'rescheduled':
            suggested = details.get('suggested_time', '')
            if suggested:
                return f"Oke, dicatat untuk {suggested} ya! 📅"
            else:
                return "Oke, jadwalnya dicatat! Nanti kabari lagi ya 📅"
        
        else:
            return "Maaf aku kurang paham 😅. Bisa ulangi?"
    
    async def get_today_schedule(self) -> Dict[str, Any]:
        """Get today's schedule from SmartReminder"""
        return await self.subagent.get_today_schedule()
    
    async def skip_course(self, course_name: str, reason: str = "") -> bool:
        """Mark a course as skipped"""
        return await self.subagent.skip_course(course_name, reason)
    
    def get_status(self) -> Dict[str, Any]:
        """Get system status for debugging"""
        return {
            'started': self._started,
            'scheduler': self.scheduler.get_status(),
            'context': self._context,
            'outgoing_queue': len(self._outgoing_messages)
        }
    
    def is_attendance_related(self, message: str) -> bool:
        """Check if message is likely an attendance reply"""
        # Check if we're expecting a reply
        if not self._context.get('awaiting_reply'):
            return False
        
        # Use NLU to check
        return self.intent_detector.is_attendance_related(message, self._context)


# Global instance
reminder_system = SmartReminderSystem()


# Utility functions for easy import
async def start_reminder_system():
    """Start the SmartReminder system"""
    await reminder_system.start()

async def stop_reminder_system():
    """Stop the SmartReminder system"""
    await reminder_system.stop()

async def handle_reminder_reply(user_message: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
    """Handle user reply to reminder"""
    return await reminder_system.handle_user_reply(user_message, context)

def get_reminder_messages() -> List[Dict[str, Any]]:
    """Get pending reminder messages"""
    return reminder_system.get_pending_messages()

def is_reminder_reply(message: str) -> bool:
    """Check if message is likely a reply to reminder"""
    return reminder_system.is_attendance_related(message)
