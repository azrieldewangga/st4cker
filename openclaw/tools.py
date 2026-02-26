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
            "x-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        
        # Debug logging
        print(f"[St4cker API] {method} {url}")
        print(f"[St4cker API] Headers: {headers}")
        print(f"[St4cker API] API Key length: {len(self.api_key) if self.api_key else 0}")
        
        async with httpx.AsyncClient() as client:
            try:
                if method == "GET":
                    response = await client.get(url, headers=headers, timeout=10)
                elif method == "DELETE":
                    response = await client.delete(url, headers=headers, timeout=10)
                elif method == "PATCH":
                    response = await client.patch(url, json=data, headers=headers, timeout=10)
                else:
                    response = await client.post(url, json=data, headers=headers, timeout=10)
                
                print(f"[St4cker API] Response status: {response.status_code}")
                
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                print(f"[St4cker API Error] HTTP {e.response.status_code}: {e.response.text}")
                return {"error": str(e), "success": False, "status_code": e.response.status_code}
            except httpx.HTTPError as e:
                print(f"[St4cker API Error] {e}")
                return {"error": str(e), "success": False}
    
    # =========================================================================
    # TASK APIs
    # =========================================================================
    
    async def get_tasks(self, status: str = None, course: str = None) -> Dict:
        """Get list of tasks."""
        endpoint = "/api/v1/tasks"
        params = []
        if status:
            params.append(f"status={status}")
        if course:
            params.append(f"course={course}")
        if params:
            endpoint += "?" + "&".join(params)
        return await self._request("GET", endpoint, None)
    
    async def get_task_by_id(self, task_id: str) -> Dict:
        """Get task by ID."""
        return await self._request("GET", f"/api/v1/tasks/{task_id}", None)
    
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
    
    async def update_task(self, task_id: str, updates: Dict) -> Dict:
        """Update task by ID."""
        return await self._request("PATCH", f"/api/v1/tasks/{task_id}", updates)
    
    async def update_task_status(self, user_id: str, search_query: str, new_status: str) -> Dict:
        """Update task status by search query (fuzzy search)."""
        return await self._request("POST", "/api/v1/tasks/update-status", {
            "userId": user_id,
            "searchQuery": search_query,
            "newStatus": new_status
        })
    
    async def update_task_progress(self, user_id: str, task_id: str, progress: int) -> Dict:
        """Update task progress by ID."""
        return await self._request("PATCH", f"/api/v1/tasks/{task_id}", {
            "progress": progress,
            "userId": user_id
        })
    
    async def delete_task(self, task_id: str) -> Dict:
        """Delete task by ID."""
        return await self._request("DELETE", f"/api/v1/tasks/{task_id}", None)
    
    async def get_last_task_reminder(self, user_id: str) -> Dict:
        """Get last task reminder context."""
        return await self._request("GET", f"/api/v1/tasks/last-reminder/{user_id}", None)
    
    # =========================================================================
    # PROJECT APIs
    # =========================================================================
    
    async def get_projects(self, status: str = None) -> Dict:
        """Get list of projects."""
        endpoint = "/api/v1/projects"
        if status:
            endpoint += f"?status={status}"
        return await self._request("GET", endpoint, None)
    
    async def get_project_by_id(self, project_id: str) -> Dict:
        """Get project by ID."""
        return await self._request("GET", f"/api/v1/projects/{project_id}", None)
    
    async def create_project(self, user_id: str, title: str, description: str = "", 
                           project_type: str = "personal", priority: str = "medium",
                           course_name: str = None, deadline: str = None) -> Dict:
        """Create new project."""
        return await self._request("POST", "/api/v1/projects", {
            "userId": user_id,
            "title": title,
            "description": description,
            "type": project_type,
            "priority": priority,
            "courseName": course_name,
            "deadline": deadline,
            "status": "active"
        })
    
    async def update_project(self, project_id: str, updates: Dict) -> Dict:
        """Update project by ID."""
        return await self._request("PATCH", f"/api/v1/projects/{project_id}", updates)
    
    async def delete_project(self, project_id: str) -> Dict:
        """Delete project by ID."""
        return await self._request("DELETE", f"/api/v1/projects/{project_id}", None)
    
    async def log_project_progress(self, project_id: str, progress: int, message: str) -> Dict:
        """Log progress untuk project."""
        return await self._request("POST", f"/api/v1/projects/{project_id}/logs", {
            "progress": progress,
            "message": message
        })
    
    # =========================================================================
    # SCHEDULE APIs
    # =========================================================================
    
    async def get_schedules(self, day: str = None, active: bool = None) -> Dict:
        """Get list of schedules."""
        endpoint = "/api/v1/schedules"
        params = []
        if day:
            params.append(f"day={day}")
        if active is not None:
            params.append(f"active={str(active).lower()}")
        if params:
            endpoint += "?" + "&".join(params)
        return await self._request("GET", endpoint, None)
    
    async def get_schedule_by_id(self, schedule_id: str) -> Dict:
        """Get schedule by ID."""
        return await self._request("GET", f"/api/v1/schedules/{schedule_id}", None)
    
    async def create_schedule(self, user_id: str, course_name: str, day_of_week: str, 
                            start_time: str, end_time: str = None, room: str = None,
                            lecturer: str = None, course_code: str = None) -> Dict:
        """Create new schedule."""
        return await self._request("POST", "/api/v1/schedules", {
            "userId": user_id,
            "courseName": course_name,
            "dayOfWeek": day_of_week,
            "startTime": start_time,
            "endTime": end_time,
            "room": room,
            "lecturer": lecturer,
            "courseCode": course_code
        })
    
    async def update_schedule(self, schedule_id: str, updates: Dict) -> Dict:
        """Update schedule by ID."""
        return await self._request("PATCH", f"/api/v1/schedules/{schedule_id}", updates)
    
    async def delete_schedule(self, schedule_id: str) -> Dict:
        """Delete schedule by ID."""
        return await self._request("DELETE", f"/api/v1/schedules/{schedule_id}", None)
    
    async def cancel_schedule_date(self, schedule_id: str, cancel_date: str, reason: str = None) -> Dict:
        """Cancel schedule untuk tanggal tertentu."""
        return await self._request("POST", f"/api/v1/schedules/{schedule_id}/cancel", {
            "cancelDate": cancel_date,
            "reason": reason
        })
    
    # =========================================================================
    # TRANSACTION APIs
    # =========================================================================
    
    async def get_transactions(self, limit: int = 50) -> Dict:
        """Get list of transactions."""
        return await self._request("GET", f"/api/v1/transactions?limit={limit}", None)
    
    async def get_transaction_by_id(self, transaction_id: str) -> Dict:
        """Get transaction by ID."""
        return await self._request("GET", f"/api/v1/transactions/{transaction_id}", None)
    
    async def create_transaction(self, user_id: str, amount: float, type_: str, 
                                category: str, title: str = None, date: str = None) -> Dict:
        """Create new transaction."""
        return await self._request("POST", "/api/v1/transactions", {
            "userId": user_id,
            "amount": amount,
            "type": type_,
            "category": category,
            "title": title,
            "date": date
        })
    
    async def update_transaction(self, transaction_id: str, updates: Dict) -> Dict:
        """Update transaction by ID."""
        return await self._request("PATCH", f"/api/v1/transactions/{transaction_id}", updates)
    
    async def delete_transaction(self, transaction_id: str) -> Dict:
        """Delete transaction by ID."""
        return await self._request("DELETE", f"/api/v1/transactions/{transaction_id}", None)
    
    # =========================================================================
    # BALANCE & SUMMARY APIs
    # =========================================================================
    
    async def get_balance(self) -> Dict:
        """Get current balance."""
        return await self._request("GET", "/api/v1/balance", None)
    
    async def get_summary(self) -> Dict:
        """Get dashboard summary (tasks, projects, balance, upcoming deadlines)."""
        return await self._request("GET", "/api/v1/summary", None)
    
    # =========================================================================
    # REMINDER APIs
    # =========================================================================
    
    async def get_reminder_status(self) -> Dict:
        """Get reminder status for today."""
        return await self._request("GET", "/api/v1/reminders/today", None)
    
    async def get_reminder_history(self, days: int = 7) -> Dict:
        """Get reminder history for last N days."""
        return await self._request("GET", f"/api/v1/reminders/history?days={days}", None)
    
    async def skip_today_reminders(self, date: str, action: str = "skip_all", 
                                  reason: str = None, custom_time: str = None) -> Dict:
        """Skip/pause reminders for a date."""
        return await self._request("POST", "/api/v1/reminders/override", {
            "date": date,
            "action": action,
            "reason": reason,
            "customTime": custom_time
        })
    
    async def cancel_skip_reminders(self, override_id: str) -> Dict:
        """Cancel a reminder override."""
        return await self._request("DELETE", f"/api/v1/reminders/overrides/{override_id}", None)
    
    async def confirm_schedule_attendance(self, user_id: str, confirmed: bool, message: str = None) -> Dict:
        """Confirm schedule attendance."""
        return await self._request("POST", "/api/v1/reminders/confirm", {
            "userId": user_id,
            "confirmed": confirmed,
            "message": message
        })
    
    async def log_reminder(self, user_id: str, type_: str, message_content: str = None, schedule_id: str = None) -> Dict:
        """Log a reminder (called when sending reminders)."""
        payload = {
            "userId": user_id,
            "type": type_,
            "messageContent": message_content
        }
        if schedule_id:
            payload["scheduleId"] = schedule_id
        return await self._request("POST", "/api/v1/reminders/log", payload)
