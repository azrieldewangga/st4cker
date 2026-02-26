#!/usr/bin/env python3
"""
SmartReminder Client - Interface ke SmartReminder Daemon
Menangani komunikasi antara OpenClaw dan SmartReminder untuk attendance tracking
"""

import httpx
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class SmartReminderClient:
    """
    Client untuk berkomunikasi dengan SmartReminder daemon.
    Mengirim intent updates dan mengambil status.
    """
    
    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url
        self.timeout = 10.0
    
    async def send_attendance_intent(
        self, 
        message: str, 
        intent: str, 
        details: Dict[str, Any] = None,
        sender: str = "1168825716"
    ) -> Dict[str, Any]:
        """Kirim attendance intent ke SmartReminder."""
        payload = {
            "message": message,
            "intent": intent,
            "details": details or {},
            "sender": sender,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/webhook",
                    json=payload,
                    timeout=self.timeout
                )
                response.raise_for_status()
                result = response.json()
                logger.info(f"SmartReminder intent sent: {intent} -> {result}")
                return result
        except Exception as e:
            logger.error(f"Failed to send intent to SmartReminder: {e}")
            return {
                "status": "error",
                "message": str(e),
                "intent": intent
            }
    
    async def send_course_management(
        self,
        intent: str,
        course: str,
        date: str,
        details: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Send course management intent (skip/reschedule)"""
        payload = {
            "intent_type": "course_mgmt",
            "intent": intent,
            "course": course,
            "date": date,
            "details": details or {},
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/webhook",
                    json=payload,
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to send course mgmt: {e}")
            return {"status": "error", "message": str(e)}
    
    async def get_status(self) -> Dict[str, Any]:
        """Get current SmartReminder status."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/status",
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get SmartReminder status: {e}")
            return {"status": "error", "message": str(e)}
    
    async def trigger_setup(self) -> Dict[str, Any]:
        """Trigger manual setup di SmartReminder."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/setup-now",
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to trigger setup: {e}")
            return {"status": "error", "message": str(e)}
    
    def sync_send_attendance_intent(
        self, 
        message: str, 
        intent: str, 
        details: Dict[str, Any] = None,
        sender: str = "1168825716"
    ) -> Dict[str, Any]:
        """Synchronous version untuk non-async contexts."""
        import requests
        
        payload = {
            "message": message,
            "intent": intent,
            "details": details or {},
            "sender": sender,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/webhook",
                json=payload,
                timeout=self.timeout
            )
            response.raise_for_status()
            result = response.json()
            logger.info(f"SmartReminder intent sent (sync): {intent}")
            return result
        except Exception as e:
            logger.error(f"Failed to send intent (sync): {e}")
            return {"status": "error", "message": str(e)}
    
    def sync_send_course_management(
        self,
        intent: str,
        course: str,
        date: str,
        details: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Synchronous version untuk course management."""
        import requests
        
        payload = {
            "intent_type": "course_mgmt",
            "intent": intent,
            "course": course,
            "date": date,
            "details": details or {},
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/webhook",
                json=payload,
                timeout=self.timeout
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to send course mgmt (sync): {e}")
            return {"status": "error", "message": str(e)}


# Singleton instance
client = SmartReminderClient()

# Utility functions
async def send_attendance_intent(message: str, intent: str, details: Dict[str, Any] = None) -> Dict[str, Any]:
    return await client.send_attendance_intent(message, intent, details)

def send_attendance_intent_sync(message: str, intent: str, details: Dict[str, Any] = None) -> Dict[str, Any]:
    return client.sync_send_attendance_intent(message, intent, details)

async def send_course_management(intent: str, course: str, date: str, details: Dict[str, Any] = None) -> Dict[str, Any]:
    return await client.send_course_management(intent, course, date, details)

def send_course_management_sync(intent: str, course: str, date: str, details: Dict[str, Any] = None) -> Dict[str, Any]:
    return client.sync_send_course_management(intent, course, date, details)
