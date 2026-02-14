#!/usr/bin/env python3
"""
Tools Module - API calls to St4cker (telegram-bot)
"""

import httpx
from typing import Dict, Any, Optional

class St4ckerTools:
    """
    Tools untuk berinteraksi dengan St4cker API (telegram-bot).
    """
    
    def __init__(self, api_url: str, api_key: str):
        self.api_url = api_url
        self.api_key = api_key
    
    async def _request(self, method: str, endpoint: str, data: Dict = None) -> Dict[str, Any]:
        """Make request ke St4cker API."""
        url = f"{self.api_url}{endpoint}"
        headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                if method == "GET":
                    response = await client.get(url, headers=headers, timeout=10)
                else:
                    response = await client.post(url, json=data, headers=headers, timeout=10)
                
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                print(f"[St4cker API Error] {e}")
                return {"error": str(e), "success": False}
    
    # =========================================================================
    # Task APIs
    # =========================================================================
    
    async def update_task_status(self, user_id: str, task_id: str, status: str) -> Dict:
        """Update status tugas."""
        return await self._request("POST", "/api/v1/tasks/update-status", {
            "userId": user_id,
            "taskId": task_id,
            "status": status
        })
    
    async def update_task_progress(self, user_id: str, task_id: str, progress: int, notes: str = None) -> Dict:
        """Update progress tugas."""
        return await self._request("POST", "/api/v1/tasks/progress", {
            "userId": user_id,
            "taskId": task_id,
            "progress": progress,
            "notes": notes,
            "updated_at": "now"
        })
    
    async def get_task_progress_history(self, user_id: str, task_id: str) -> Dict:
        """Get history progress tugas."""
        return await self._request("GET", f"/api/v1/tasks/{task_id}/progress", None)
    
    async def create_task(self, user_id: str, title: str, course: str, deadline: str, task_type: str = "Individual") -> Dict:
        """Create new task."""
        return await self._request("POST", "/api/v1/tasks", {
            "userId": user_id,
            "title": title,
            "course": course,
            "deadline": deadline,
            "type": task_type,
            "status": "pending"
        })
    
    # =========================================================================
    # Schedule APIs
    # =========================================================================
    
    async def update_skip_preference(self, user_id: str, date: str, course: str, skipped: bool, reason: str = None) -> Dict:
        """Update skip preference untuk schedule."""
        return await self._request("POST", "/api/v1/schedules/skip", {
            "userId": user_id,
            "date": date,
            "course": course,
            "skipped": skipped,
            "reason": reason
        })
    
    async def get_skip_preferences(self, user_id: str, date: str) -> Dict:
        """Get skip preferences untuk date."""
        return await self._request("GET", f"/api/v1/schedules/skips?userId={user_id}&date={date}", None)
    
    async def confirm_schedule_attendance(self, user_id: str, schedule_id: str, confirmed: bool) -> Dict:
        """Confirm attendance untuk schedule."""
        return await self._request("POST", "/api/v1/schedules/confirm", {
            "userId": user_id,
            "scheduleId": schedule_id,
            "confirmed": confirmed
        })
    
    async def get_today_schedules(self, user_id: str) -> Dict:
        """Get jadwal hari ini."""
        return await self._request("GET", f"/api/v1/schedules/today?userId={user_id}", None)
    
    async def get_tomorrow_schedules(self, user_id: str) -> Dict:
        """Get jadwal besok."""
        return await self._request("GET", f"/api/v1/schedules/tomorrow?userId={user_id}", None)
    
    # =========================================================================
    # User APIs
    # =========================================================================
    
    async def get_user_info(self, user_id: str) -> Dict:
        """Get user info."""
        return await self._request("GET", f"/api/v1/users/{user_id}", None)
    
    async def update_user_preference(self, user_id: str, preferences: Dict) -> Dict:
        """Update user preferences."""
        return await self._request("POST", f"/api/v1/users/{user_id}/preferences", preferences)
