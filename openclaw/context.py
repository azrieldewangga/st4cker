#!/usr/bin/env python3
"""
Context Storage - Store user conversation state & preferences
In-memory dengan TTL (Time To Live)
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import threading
from threading import RLock

class UserContext:
    """
    Context untuk satu user.
    Simpan: conversational state, skip preferences, active tasks, dll.
    """
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        
        # Conversational state
        self.awaiting_clarification = False
        self.clarification_type = None  # "scope", "help_type", "new_task_details", dll
        self.clarification_data = {}
        
        # Skip preferences - format: {date: {course: {skipped, reason}}}
        self.skip_preferences = {}
        
        # Active items
        self.active_task = None
        self.active_schedule = None
        self.last_course = None
        
        # Progress tracking
        self.last_progress = 0
        
        # Schedule info untuk hari ini
        self.today_schedules = []
        self.next_course = None
        self.remaining_schedules = []
        
        # Flags
        self.confirmed_attendance = False
        self.awaiting_reply = False
        self.last_intent = None
        
        # Timestamps
        self.created_at = datetime.now()
        self.last_updated = datetime.now()
        self.last_message_time = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict untuk response."""
        return {
            "user_id": self.user_id,
            "awaiting_clarification": self.awaiting_clarification,
            "clarification_type": self.clarification_type,
            "skip_preferences": self.skip_preferences,
            "active_task": self.active_task,
            "active_schedule": self.active_schedule,
            "last_course": self.last_course,
            "last_progress": self.last_progress,
            "confirmed_attendance": self.confirmed_attendance,
            "awaiting_reply": self.awaiting_reply,
            "today_schedules": self.today_schedules,
            "next_course": self.next_course,
            "last_updated": self.last_updated.isoformat()
        }
    
    def update(self, data: Dict[str, Any]):
        """Update context dengan data baru."""
        for key, value in data.items():
            if hasattr(self, key):
                setattr(self, key, value)
        
        self.last_updated = datetime.now()
    
    def update_skip_preference(self, date: str, course: str, skipped: bool, reason: str = None):
        """Update skip preference untuk course tertentu di date tertentu."""
        if date not in self.skip_preferences:
            self.skip_preferences[date] = {}
        
        self.skip_preferences[date][course] = {
            "skipped": skipped,
            "reason": reason,
            "updated_at": datetime.now().isoformat()
        }
        
        self.last_updated = datetime.now()
    
    def is_skipped(self, date: str, course: str) -> bool:
        """Check apakah course di date tertentu di-skip."""
        return self.skip_preferences.get(date, {}).get(course, {}).get("skipped", False)
    
    def is_full_day_skipped(self, date: str) -> bool:
        """Check apakah full day di-skip."""
        return self.skip_preferences.get(date, {}).get("_full_day", {}).get("skipped", False)
    
    def clear_skip_preference(self, date: str):
        """Clear all skip preferences untuk date."""
        if date in self.skip_preferences:
            del self.skip_preferences[date]
            self.last_updated = datetime.now()


class ContextStore:
    """
    Store untuk semua user context.
    In-memory dengan cleanup periodik.
    """
    
    def __init__(self, ttl_hours: int = 24):
        self.contexts: Dict[str, UserContext] = {}
        self.ttl = timedelta(hours=ttl_hours)
        self.lock = RLock()  # Reentrant lock to prevent deadlocks
    
    def get_context(self, user_id: str) -> Dict[str, Any]:
        """Get context untuk user (return sebagai dict)."""
        with self.lock:
            if user_id not in self.contexts:
                self.contexts[user_id] = UserContext(user_id)
            
            ctx = self.contexts[user_id]
            
            # Check TTL
            if datetime.now() - ctx.last_updated > self.ttl:
                # Reset tapi keep skip preferences
                skip_prefs = ctx.skip_preferences
                self.contexts[user_id] = UserContext(user_id)
                self.contexts[user_id].skip_preferences = skip_prefs
                ctx = self.contexts[user_id]
            
            # Return copy to avoid external modification issues
            return ctx.to_dict().copy()
    
    def get_user_context_obj(self, user_id: str) -> UserContext:
        """Get UserContext object (untuk internal use)."""
        with self.lock:
            if user_id not in self.contexts:
                self.contexts[user_id] = UserContext(user_id)
            return self.contexts[user_id]
    
    def update_context(self, user_id: str, data: Dict[str, Any]):
        """Update context user."""
        with self.lock:
            ctx = self.get_user_context_obj(user_id)
            ctx.update(data)
    
    def update_skip_preference(self, user_id: str, date: str, course: str, skipped: bool, reason: str = None):
        """Update skip preference."""
        with self.lock:
            ctx = self.get_user_context_obj(user_id)
            ctx.update_skip_preference(date, course, skipped, reason)
    
    def clear_skip_preference(self, user_id: str, date: str):
        """Clear skip preference."""
        with self.lock:
            ctx = self.get_user_context_obj(user_id)
            ctx.clear_skip_preference(date)
    
    def cleanup_expired(self):
        """Remove expired contexts."""
        with self.lock:
            now = datetime.now()
            expired = [
                user_id for user_id, ctx in self.contexts.items()
                if now - ctx.last_updated > self.ttl
            ]
            for user_id in expired:
                del self.contexts[user_id]
            return len(expired)


# Global instance - create fresh
context_store = ContextStore()

# For async/ FastAPI compatibility
def get_context_store():
    """Get context store instance."""
    return context_store
