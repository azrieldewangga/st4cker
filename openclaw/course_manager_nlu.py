#!/usr/bin/env python3
"""
Course Manager NLU - Handle skip, online, and reschedule intents
"""

import re
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

class CourseManagerNLU:
    """
    Detect intents untuk course management:
    - Skip/Online: "besok KJK kosong", "Senin online"
    - Reschedule Temporary: "KJK besok pindah ke Jumat jam 10"
    - Reschedule Permanent: "KJK pindah permanen ke Rabu jam 8"
    """
    
    def __init__(self):
        self.course_aliases = {
            "kjk": ["kjk", "keamanan jaringan", "keamanan"],
            "komber": ["komber", "komputasi bergerak", "kb"],
            "ppl": ["ppl", "pengembangan perangkat lunak"],
            "sister": ["sister", "sistem terdistribusi"],
            "pemjar": ["pemjar", "pemrograman jaringan"],
            "wspk": ["wspk", "workshop spk", "spk"],
        }
        
        self.days = {
            "senin": 1, "selasa": 2, "rabu": 3, "kamis": 4, 
            "jumat": 5, "sabtu": 6, "minggu": 7,
            "monday": 1, "tuesday": 2, "wednesday": 3, 
            "thursday": 4, "friday": 5, "saturday": 6, "sunday": 7
        }
    
    def parse_course_management(self, message: str) -> Dict[str, Any]:
        """
        Parse course management intent.
        
        Returns:
            {
                "intent": "skip" | "online" | "reschedule_temp" | "reschedule_perm" | "unknown",
                "course": str,
                "date": str (YYYY-MM-DD or "besok" | "hari_ini"),
                "new_day": str (untuk reschedule),
                "new_time": str (HH:MM untuk reschedule),
                "is_permanent": bool,
                "confidence": float
            }
        """
        msg_lower = message.lower().strip()
        
        # Check for skip/online intent
        skip_result = self._detect_skip_online(msg_lower)
        if skip_result["confidence"] > 0.5:
            return skip_result
        
        # Check for reschedule intent
        reschedule_result = self._detect_reschedule(msg_lower)
        if reschedule_result["confidence"] > 0.5:
            return reschedule_result
        
        return {"intent": "unknown", "confidence": 0.0}
    
    def _detect_skip_online(self, msg_lower: str) -> Dict[str, Any]:
        """Detect skip/online intents"""
        # Patterns for skip/online
        skip_patterns = [
            r'(besok|senin|selasa|rabu|kamis|jumat|sabtu|minggu|hari ini)?\s*(kjk|komber|ppl|sister|pemjar|wspk|matkul)\s*(kosong|online|cancel|skip|batal|libur)',
            r'(kjk|komber|ppl|sister|pemjar|wspk|matkul)\s*(besok|senin|selasa|rabu|kamis|jumat|sabtu|minggu|hari ini)?\s*(kosong|online|cancel|skip)',
            r'(skip|lewat|gak ada)\s*(kjk|komber|ppl|sister|pemjar|wspk)?',
        ]
        
        online_keywords = ["online", "zoom", "gmeet", "virtual", "daring"]
        skip_keywords = ["kosong", "skip", "cancel", "batal", "libur", "gak ada", "tidak ada"]
        
        for pattern in skip_patterns:
            match = re.search(pattern, msg_lower)
            if match:
                # Extract components
                groups = match.groups()
                
                # Determine if it's online or skip
                is_online = any(kw in msg_lower for kw in online_keywords)
                is_skip = any(kw in msg_lower for kw in skip_keywords)
                
                intent_type = "online" if is_online else "skip"
                
                # Extract course
                course = self._extract_course(msg_lower) or "unknown"
                
                # Extract date
                date_str = self._extract_date(msg_lower)
                
                return {
                    "intent": intent_type,
                    "course": course,
                    "date": date_str,
                    "reason": "online" if is_online else "kosong",
                    "confidence": 0.9,
                    "is_permanent": False
                }
        
        return {"intent": "unknown", "confidence": 0.0}
    
    def _detect_reschedule(self, msg_lower: str) -> Dict[str, Any]:
        """Detect reschedule intents"""
        # Patterns for reschedule
        reschedule_patterns = [
            r'(kjk|komber|ppl|sister|pemjar|wspk)\s*(besok|senin|selasa|rabu|kamis|jumat)?\s*(pindah|geser|undur|maju)\s*(ke)?\s*(senin|selasa|rabu|kamis|jumat|sabtu|minggu)?\s*(jam)?\s*(\d{1,2}:\d{2}|\d{1,2})',
            r'(pindah|geser)\s*(kjk|komber|ppl|sister|pemjar|wspk)\s*(ke)?\s*(senin|selasa|rabu|kamis|jumat|sabtu|minggu)?\s*(jam)?\s*(\d{1,2}:\d{2}|\d{1,2})',
        ]
        
        permanent_keywords = ["permanen", "permanent", "selamanya", "fix", "resmi"]
        temporary_keywords = ["besok", "minggu ini", "sementara", "sekali", "kali ini"]
        
        for pattern in reschedule_patterns:
            match = re.search(pattern, msg_lower)
            if match:
                # Check permanent vs temporary
                is_permanent = any(kw in msg_lower for kw in permanent_keywords)
                is_temporary = any(kw in msg_lower for kw in temporary_keywords)
                
                # If neither specified, default to temporary for safety
                if not is_permanent and not is_temporary:
                    is_temporary = True
                
                # Extract course
                course = self._extract_course(msg_lower) or "unknown"
                
                # Extract original date (if specified)
                orig_date = self._extract_date(msg_lower)
                
                # Extract new day
                new_day = self._extract_day_name(msg_lower)
                
                # Extract new time
                new_time = self._extract_time(msg_lower)
                
                intent_type = "reschedule_perm" if is_permanent else "reschedule_temp"
                
                return {
                    "intent": intent_type,
                    "course": course,
                    "original_date": orig_date,
                    "new_day": new_day,
                    "new_time": new_time,
                    "is_permanent": is_permanent,
                    "confidence": 0.85
                }
        
        return {"intent": "unknown", "confidence": 0.0}
    
    def _extract_course(self, msg_lower: str) -> Optional[str]:
        """Extract course name from message"""
        for alias, variations in self.course_aliases.items():
            for var in variations:
                if var in msg_lower:
                    return alias
        return None
    
    def _extract_date(self, msg_lower: str) -> str:
        """Extract date reference"""
        if "besok" in msg_lower:
            tomorrow = datetime.now() + timedelta(days=1)
            return tomorrow.strftime("%Y-%m-%d")
        elif "hari ini" in msg_lower or "sekarang" in msg_lower:
            return datetime.now().strftime("%Y-%m-%d")
        
        # Check for day names
        for day_name, day_num in self.days.items():
            if day_name in msg_lower:
                # Calculate next occurrence of this day
                today_num = datetime.now().isoweekday()
                days_ahead = day_num - today_num
                if days_ahead <= 0:  # Target day already passed this week
                    days_ahead += 7
                target_date = datetime.now() + timedelta(days=days_ahead)
                return target_date.strftime("%Y-%m-%d")
        
        return "besok"  # Default to tomorrow
    
    def _extract_day_name(self, msg_lower: str) -> Optional[str]:
        """Extract day name (Senin, Selasa, etc)"""
        for day_name in self.days.keys():
            if day_name in msg_lower:
                return day_name.capitalize()
        return None
    
    def _extract_time(self, msg_lower: str) -> Optional[str]:
        """Extract time in HH:MM format"""
        # Pattern: "jam 8", "jam 8:00", "8:00", "08.00"
        patterns = [
            r'jam\s*(\d{1,2}):(\d{2})',
            r'jam\s*(\d{1,2})\s*(\d{2})?',
            r'(\d{1,2}):(\d{2})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, msg_lower)
            if match:
                hour = int(match.group(1))
                minute = match.group(2) if match.group(2) else "00"
                return f"{hour:02d}:{minute}"
        return None


# Singleton
course_manager = CourseManagerNLU()

def parse_course_management(message: str) -> Dict[str, Any]:
    """Utility function"""
    return course_manager.parse_course_management(message)
