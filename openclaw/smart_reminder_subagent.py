#!/usr/bin/env python3
import os
"""
SmartReminder Subagent Client - New API (Port 5001)
Passive subagent that provides schedule data to OpenClaw
"""

import httpx
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)


class SmartReminderSubagent:
    """
    Client untuk berkomunikasi dengan SmartReminder Subagent (API Mode).
    SmartReminder sekarang passive - hanya menyediakan data, tidak kirim pesan.
    """
    
    def __init__(self, base_url: str = None):
        if base_url is None:
            base_url = os.getenv("SMARTREMINDER_URL", "http://smartreminder:5001")
        self.base_url = base_url
        self.timeout = 10.0
    
    async def get_today_schedule(self) -> Dict[str, Any]:
        """
        Get today's complete schedule with reminder times.
        Returns: {
            'date': '2026-02-27',
            'day_name': 'Jumat',
            'attendance_status': 'unknown' | 'confirmed' | 'declined',
            'courses': [
                {
                    'course_name': 'Basis Data',
                    'course_code': 'CS101',
                    'start_time': '08:40:00',
                    'end_time': '10:20:00',
                    'room': 'Lab A',
                    'dosen': 'Dr. Ahmad',
                    'reminder_time': '05:45',
                    'is_first_early': True,
                    'is_rescheduled': False
                }
            ]
        }
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
        
        Returns: {
            'has_reminder': True,
            'reminder': {
                'course_name': 'Basis Data',
                'course_code': 'CS101',
                'start_time': '08:40',
                'end_time': '10:20',
                'room': 'Lab A',
                'dosen': 'Dr. Ahmad',
                'is_rescheduled': False
            }
        }
        or None if no reminder due
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
            # Extract course name from details if provided
            course_name = details.get('course', 'Unknown') if details else 'Unknown'
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/api/v1/attendance/update",
                    json={
                        'course': course_name,
                        'status': status,
                        'data': details or {}
                    },
                    timeout=self.timeout
                )
                response.raise_for_status()
                logger.info(f"Attendance updated for {course_name} to {status}")
                return True
        except Exception as e:
            logger.error(f"Failed to update attendance: {e}")
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
    
    async def skip_course(self, course_name: str, reason: str = "") -> bool:
        """Mark a course as skipped for today"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/api/v1/course/skip",
                    json={
                        'course_name': course_name,
                        'reason': reason,
                        'date': datetime.now().strftime('%Y-%m-%d')
                    },
                    timeout=self.timeout
                )
                response.raise_for_status()
                logger.info(f"Course {course_name} marked as skipped")
                return True
        except Exception as e:
            logger.error(f"Failed to skip course: {e}")
            return False
    
    # Synchronous versions for non-async contexts
    def sync_get_today_schedule(self) -> Dict[str, Any]:
        import requests
        try:
            response = requests.get(
                f"{self.base_url}/api/v1/schedules/today",
                timeout=self.timeout
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to get schedule (sync): {e}")
            return {
                'date': datetime.now().strftime('%Y-%m-%d'),
                'day_name': '',
                'attendance_status': 'unknown',
                'courses': []
            }
    
    def sync_get_next_reminder(self) -> Optional[Dict[str, Any]]:
        import requests
        try:
            response = requests.get(
                f"{self.base_url}/api/v1/reminders/next",
                timeout=self.timeout
            )
            response.raise_for_status()
            data = response.json()
            if data.get('has_reminder'):
                return data['reminder']
            return None
        except Exception as e:
            logger.error(f"Failed to check reminder (sync): {e}")
            return None
    
    def sync_update_attendance(self, status: str, details: Dict[str, Any] = None) -> bool:
        import requests
        try:
            response = requests.post(
                f"{self.base_url}/api/v1/attendance",
                json={'status': status, 'details': details or {}},
                timeout=self.timeout
            )
            response.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"Failed to update attendance (sync): {e}")
            return False


# Singleton instance
subagent = SmartReminderSubagent()

# Utility functions
async def get_today_schedule() -> Dict[str, Any]:
    return await subagent.get_today_schedule()

async def get_next_reminder() -> Optional[Dict[str, Any]]:
    return await subagent.get_next_reminder()

async def update_attendance(status: str, details: Dict[str, Any] = None) -> bool:
    return await subagent.update_attendance(status, details)

def sync_get_next_reminder() -> Optional[Dict[str, Any]]:
    return subagent.sync_get_next_reminder()

def sync_update_attendance(status: str, details: Dict[str, Any] = None) -> bool:
    return subagent.sync_update_attendance(status, details)
