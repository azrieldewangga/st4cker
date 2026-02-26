#!/usr/bin/env python3
"""
Memory System - Track user patterns, history, and behavior
Untuk deteksi repetitive transaksi, task patterns, dll
"""

import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from collections import defaultdict


class UserMemory:
    """
    Memory untuk satu user. Track:
    - Transaction patterns
    - Task creation patterns  
    - Project progress patterns
    - Response preferences
    """
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.transactions: List[Dict] = []
        self.tasks: List[Dict] = []
        self.projects: List[Dict] = []
        self.interactions: List[Dict] = []
        self.patterns: Dict[str, Any] = {}
        self.last_updated = datetime.now()
    
    def add_transaction(self, transaction: Dict):
        """Add transaction to memory."""
        transaction["timestamp"] = datetime.now().isoformat()
        self.transactions.append(transaction)
        self._analyze_transaction_patterns()
        self._cleanup_old_data()
    
    def add_task(self, task: Dict):
        """Add task to memory."""
        task["timestamp"] = datetime.now().isoformat()
        self.tasks.append(task)
        self._cleanup_old_data()
    
    def add_project_progress(self, project_id: str, progress: int, note: str = ""):
        """Add project progress log."""
        self.projects.append({
            "project_id": project_id,
            "progress": progress,
            "note": note,
            "timestamp": datetime.now().isoformat()
        })
    
    def add_interaction(self, message: str, response: str, intent: str):
        """Record interaction for context."""
        self.interactions.append({
            "message": message,
            "response": response,
            "intent": intent,
            "timestamp": datetime.now().isoformat()
        })
        # Keep only last 20 interactions
        self.interactions = self.interactions[-20:]
    
    def _analyze_transaction_patterns(self):
        """Analyze transaction patterns untuk deteksi repetitif."""
        # Group by category and title
        category_counts = defaultdict(lambda: defaultdict(int))
        title_timeline = defaultdict(list)
        
        for tx in self.transactions:
            cat = tx.get("category", "unknown")
            title = tx.get("title", "unknown")
            date = tx.get("date", "") or tx.get("timestamp", "")
            
            category_counts[cat][title] += 1
            title_timeline[title].append(date)
        
        # Detect repetitive patterns
        self.patterns["repetitive_transactions"] = []
        
        for category, titles in category_counts.items():
            for title, count in titles.items():
                if count >= 3:  # 3+ times = repetitive
                    # Check if recent (within last 7 days)
                    dates = title_timeline[title][-count:]
                    if len(dates) >= 3:
                        self.patterns["repetitive_transactions"].append({
                            "category": category,
                            "title": title,
                            "count": count,
                            "type": "frequent_purchase"
                        })
    
    def get_repetitive_transaction(self, category: str = None, title: str = None) -> Optional[Dict]:
        """Check if a transaction is repetitive."""
        reps = self.patterns.get("repetitive_transactions", [])
        
        for rep in reps:
            if category and rep["category"] == category:
                return rep
            if title and rep["title"].lower() in title.lower():
                return rep
        
        return None
    
    def get_recent_transactions(self, days: int = 7, category: str = None) -> List[Dict]:
        """Get recent transactions."""
        cutoff = datetime.now() - timedelta(days=days)
        recent = []
        
        for tx in self.transactions:
            date_str = tx.get("date") or tx.get("timestamp", "")
            try:
                if isinstance(date_str, str):
                    if 'T' in date_str:
                        tx_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    else:
                        tx_date = datetime.strptime(date_str, '%Y-%m-%d')
                    
                    if tx_date >= cutoff:
                        if category is None or tx.get("category") == category:
                            recent.append(tx)
            except:
                continue
        
        return recent
    
    def get_pending_tasks_count(self) -> int:
        """Get count of pending tasks."""
        return len([t for t in self.tasks if t.get("status") == "pending"])
    
    def get_active_projects(self) -> List[Dict]:
        """Get active projects."""
        # This would need to be populated from API calls
        return [p for p in self.projects if p.get("progress", 0) < 100]
    
    def _cleanup_old_data(self):
        """Remove old data to prevent memory bloat."""
        cutoff = datetime.now() - timedelta(days=90)  # Keep 90 days
        
        def is_recent(item):
            date_str = item.get("timestamp", "")
            try:
                if isinstance(date_str, str):
                    item_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    return item_date >= cutoff
            except:
                pass
            return True
        
        self.transactions = [t for t in self.transactions if is_recent(t)][-100:]  # Keep max 100
        self.tasks = [t for t in self.tasks if is_recent(t)][-50:]
        self.projects = self.projects[-50:]
    
    def to_dict(self) -> Dict:
        """Serialize to dict."""
        return {
            "user_id": self.user_id,
            "transactions": self.transactions,
            "tasks": self.tasks,
            "projects": self.projects,
            "interactions": self.interactions,
            "patterns": self.patterns,
            "last_updated": self.last_updated.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "UserMemory":
        """Create from dict."""
        memory = cls(data.get("user_id", "unknown"))
        memory.transactions = data.get("transactions", [])
        memory.tasks = data.get("tasks", [])
        memory.projects = data.get("projects", [])
        memory.interactions = data.get("interactions", [])
        memory.patterns = data.get("patterns", {})
        return memory


class MemoryStore:
    """
    Store untuk semua user memories.
    Bisa pakai file-based atau in-memory.
    """
    
    def __init__(self, storage_path: str = None):
        self.memories: Dict[str, UserMemory] = {}
        self.storage_path = storage_path or os.getenv("MEMORY_STORAGE_PATH", "/tmp/openclaw_memory.json")
        self._load()
    
    def get_memory(self, user_id: str) -> UserMemory:
        """Get or create memory untuk user."""
        if user_id not in self.memories:
            self.memories[user_id] = UserMemory(user_id)
        return self.memories[user_id]
    
    def save(self):
        """Save memories to disk."""
        try:
            data = {
                user_id: mem.to_dict()
                for user_id, mem in self.memories.items()
            }
            with open(self.storage_path, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[MemoryStore] Save error: {e}")
    
    def _load(self):
        """Load memories from disk."""
        try:
            if os.path.exists(self.storage_path):
                with open(self.storage_path, 'r') as f:
                    data = json.load(f)
                    for user_id, mem_data in data.items():
                        self.memories[user_id] = UserMemory.from_dict(mem_data)
                print(f"[MemoryStore] Loaded {len(self.memories)} user memories")
        except Exception as e:
            print(f"[MemoryStore] Load error: {e}")
    
    def clear_user(self, user_id: str):
        """Clear memory untuk user."""
        if user_id in self.memories:
            del self.memories[user_id]
            self.save()


# Singleton
_memory_store = None

def get_memory_store() -> MemoryStore:
    global _memory_store
    if _memory_store is None:
        _memory_store = MemoryStore()
    return _memory_store


def get_user_memory(user_id: str) -> UserMemory:
    """Get memory untuk specific user."""
    return get_memory_store().get_memory(user_id)
