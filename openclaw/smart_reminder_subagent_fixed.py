#!/usr/bin/env python3
"""
SmartReminder Subagent Client - New API (Port 5001)
Passive subagent that provides schedule data to OpenClaw
"""

import httpx
import logging
import os
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)


class SmartReminderSubagent:
    """
    Client untuk berkomunikasi dengan SmartReminder Subagent (API Mode).
    SmartReminder sekarang passive - hanya menyediakan data, tidak kirim pesan.
    """
    
    def __init__(self, base_url: str = None):
        # Use environment variable or default
        self.base_url = base_url or os.getenv('SMARTREMINDER_URL', 'http://smartreminder:5001')
        self.timeout = 10.0
        logger.info(f"SmartReminderSubagent initialized with URL: {self.base_url}")
    
    async def get_today_schedule(self) -> Dict[str, Any]:
        """
        Get today's complete schedule with reminder times.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/api/v1/schedules/today",
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get today's schedule: {e}")
            return {
                'date': datetime.now().strftime('%Y-%m-%d'),
                'day_name': '',
                'attendance_status': 'unknown',
                'courses': []
            }
    
    async def get_next_reminder(self) -> Optional[Dict[str, Any]]:
        """
        Check if there's a reminder that should be sent NOW.
        This is called every minute by the scheduler.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/api/v1/reminders/next",
                    timeout=self.timeout
                )
                response.raise_for_status()
                data = response.json()
                
                if data.get('has_reminder'):
                    return data['reminder']
                return None
        except Exception as e:
            logger.error(f"Failed to check next reminder: {e}")
            return None
    
    async def mark_reminder_sent(self, course_name: str) -> bool:
        """
        Mark a reminder as sent.
        Called by OpenClaw after successfully sending a reminder.
        """
        try:
            # SmartReminder automatically marks when get_next_reminder is called
            # But we can also explicitly mark it
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/api/v1/reminders/mark-sent",
                    json={'course_name': course_name},
                    timeout=self.timeout
                )
                response.raise_for_status()
                logger.info(f"Marked reminder as sent: {course_name}")
                return True
        except Exception as e:
            # Endpoint might not exist, that's ok
            logger.debug(f"Could not mark reminder sent (endpoint may not exist): {e}")
            return False
    
    async def update_attendance(
        self, 
        status: str, 
        details: Dict[str, Any] = None
    ) -> bool:
        """
        Update attendance status in SmartReminder.
        Called by OpenClaw after AI detects intent from user reply.
        
        status: 'confirmed' | 'declined' | 'unknown'
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/api/v1/attendance",
                    json={
                        'status': status,
                        'details': details or {}
                    },
                    timeout=self.timeout
                )
                response.raise_for_status()
                logger.info(f"✅ Attendance updated to {status}")
                return True
        except Exception as e:
            logger.error(f"❌ Failed to update attendance: {e}")
            return False
    
    async def get_attendance(self) -> Dict[str, Any]:
        """Get current attendance status"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/api/v1/attendance",
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get attendance: {e}")
            return {'status': 'unknown', 'details': {}, 'timestamp': None}
    
    async def reset_daily(self) -> bool:
        """
        Reset for new day (called at 4 AM).
        Clears attendance and sent reminders.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/api/v1/attendance/reset",
                    timeout=self.timeout
                )
                response.raise_for_status()
                logger.info("Daily reset completed")
                return True
        except Exception as e:
            logger.error(f"Failed to reset daily: {e}")
            return False


# Global instance
subagent = SmartReminderSubagent()
