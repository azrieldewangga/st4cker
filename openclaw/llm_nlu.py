#!/usr/bin/env python3
"""
LLM-Based NLU - Natural Language Understanding menggunakan Gemini
Bukan regex, tapi truly AI understanding
"""

import os
import json
import re
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta

# Gemini import
try:
    from google.generativeai import GenerativeModel, configure
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("[LLM_NLU] Warning: Gemini not available, using fallback")


class LLM_NLU:
    """
    NLU yang pakai LLM untuk parse intent dan extract fields.
    Ngerti konteks, tidak kaku, truly AI.
    """
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.model = None
        
        if GEMINI_AVAILABLE and self.api_key:
            try:
                configure(api_key=self.api_key)
                self.model = GenerativeModel('gemini-2.0-flash')
                print("[LLM_NLU] Gemini initialized")
            except Exception as e:
                print(f"[LLM_NLU] Failed to init Gemini: {e}")
    
    async def parse(self, message: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Parse message menjadi structured intent menggunakan LLM.
        
        Returns:
            {
                "intent": str,
                "confidence": float,
                "fields": {},  # Extracted fields
                "missing_fields": [],  # Fields yang perlu ditanyakan
                "clarification_needed": bool,
                "response_tone": str,  # suggested response tone
            }
        """
        if not self.model:
            return await self._fallback_parse(message, context)
        
        # Build prompt dengan context
        prompt = self._build_parse_prompt(message, context)
        
        try:
            response = await self.model.generate_content_async(prompt)
            result = self._extract_json(response.text)
            
            # Post-process
            result = self._post_process(result, message, context)
            return result
            
        except Exception as e:
            print(f"[LLM_NLU] Error: {e}")
            return await self._fallback_parse(message, context)
    
    def _build_parse_prompt(self, message: str, context: Dict[str, Any]) -> str:
        """Build prompt untuk LLM."""
        
        # Context info
        recent_transactions = context.get("recent_transactions", []) if context else []
        active_project = context.get("active_project") if context else None
        awaiting_field = context.get("awaiting_field") if context else None
        
        context_str = ""
        if awaiting_field:
            context_str += f"\nCurrently waiting for: {awaiting_field}"
        if active_project:
            context_str += f"\nActive project: {active_project.get('title')}"
        if recent_transactions:
            recent = recent_transactions[-3:]
            context_str += f"\nRecent transactions: {[t.get('title') for t in recent]}"
        
        prompt = f"""You are an AI assistant named "kimi" helping a student named "zril" manage tasks, projects, and finances.

Parse this message and extract intent and fields:

Message: "{message}"
Context:{context_str}

Available intents:
- create_task: User EXPLICITLY wants to add a new assignment/task (contains words like "tugas", "ada tugas", "buat tugas", "tambah tugas", "deadline")
  Fields: course (matkul), deadline, type (Tugas/LP/LS/LR/tugas), title
  IMPORTANT: Casual conversation about topics (parfum, makanan, liburan, etc) is NOT create_task!
- create_project: User wants to create a new project
  Fields: title, deadline, priority (low/medium/high), description
- create_transaction: User wants to record expense/income (contains nominal/amount like "15rb", "100k", "Rp 50000")
  Fields: amount, type (expense/income), category, title, date
- log_progress: User wants to update project progress
  Fields: project_name, progress_percentage, note
- list_tasks: User wants to see their tasks ("list tugas", "tugas apa aja", "ada tugas")
  Fields: status_filter, course_filter
- list_projects: User wants to see their projects
- list_transactions: User wants to see recent transactions
- check_balance: User wants to check their balance
- list_schedules: User wants to see class schedule
- cancel/skip: User wants to skip/cancel something
- confirm: User confirming attendance or action
- attendance_reply: User is replying to a course reminder ("iya", "ok", "otw", "skip", "ga jadi", "berangkat", etc)
  Fields: attendance_intent (confirmed/declined/rescheduled), delay_minutes
- course_management: User wants to skip/reschedule/mark online a course ("skip KJK", "KJK online", "pindahin Sister ke besok")
  Fields: course, action (skip/online/reschedule), date
- general_chat: Casual conversation, asking for advice, discussing topics like parfum, lebaran, makanan, liburan, life decisions, etc
  This is the DEFAULT when user is just chatting without specific task/transaction intent
  IMPORTANT: "bingung", "gatau", "pengen", "mau" about personal life topics (parfum, liburan, dll) = general_chat, NOT need_help!
  Only use other intents for EXPLICIT task/finance/schedule management commands.

Respond in JSON format:
{{
    "intent": "intent_name",
    "confidence": 0.0-1.0,
    "fields": {{
        "field_name": "extracted_value"
    }},
    "missing_fields": ["field1", "field2"],
    "clarification_needed": true/false,
    "notes": "any additional context or observations",
    "detected_patterns": {{
        "repetitive_transaction": null or {{"category": "...", "count": N}},
        "urgent_deadline": true/false
    }}
}}

Examples:

Message: "tugas KJK besok laporan pendahuluan"
{{
    "intent": "create_task",
    "confidence": 0.95,
    "fields": {{
        "course": "KJK",
        "deadline": "besok",
        "type": "Laporan Pendahuluan",
        "title": "Laporan Pendahuluan"
    }},
    "missing_fields": [],
    "clarification_needed": false,
    "notes": "Complete task info provided",
    "detected_patterns": {{}}
}}

Message: "beli nasi ayam 15rb"
{{
    "intent": "create_transaction",
    "confidence": 0.92,
    "fields": {{
        "amount": 15000,
        "type": "expense",
        "category": "makan",
        "title": "nasi ayam"
    }},
    "missing_fields": [],
    "clarification_needed": false,
    "notes": "Food purchase, might be repetitive",
    "detected_patterns": {{
        "repetitive_transaction": {{"category": "makan", "title": "nasi ayam"}}
    }}
}}

Message: "tambah tugas"
{{
    "intent": "create_task",
    "confidence": 0.88,
    "fields": {{}},
    "missing_fields": ["course", "deadline", "type"],
    "clarification_needed": true,
    "notes": "User wants to add task but no details provided",
    "detected_patterns": {{}}
}}

Message: "buat project website"
{{
    "intent": "create_project",
    "confidence": 0.90,
    "fields": {{
        "title": "website"
    }},
    "missing_fields": ["deadline", "priority"],
    "clarification_needed": true,
    "notes": "Project title provided, need deadline and priority",
    "detected_patterns": {{}}
}}

Now parse this message: "{message}"

JSON response:"""
        
        return prompt
    
    def _extract_json(self, text: str) -> Dict[str, Any]:
        """Extract JSON dari response LLM."""
        # Cari JSON di antara ```json atau langsung {}
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', text, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # Cari { ... }
            json_match = re.search(r'(\{.*?\})', text, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                json_str = text
        
        try:
            return json.loads(json_str)
        except:
            print(f"[LLM_NLU] Failed to parse JSON: {text[:200]}")
            return {
                "intent": "general_chat",
                "confidence": 0.5,
                "fields": {},
                "missing_fields": [],
                "clarification_needed": False,
                "notes": "Failed to parse"
            }
    
    def _post_process(self, result: Dict, message: str, context: Dict) -> Dict:
        """Post-process hasil LLM."""
        # Parse relative dates
        deadline = result.get("fields", {}).get("deadline")
        if deadline:
            parsed_date = self._parse_date(deadline)
            if parsed_date:
                result["fields"]["deadline"] = parsed_date
        
        # Parse amount
        amount = result.get("fields", {}).get("amount")
        if amount and isinstance(amount, str):
            parsed_amount = self._parse_amount(amount)
            if parsed_amount:
                result["fields"]["amount"] = parsed_amount
        
        # Course normalization
        course = result.get("fields", {}).get("course")
        if course:
            result["fields"]["course"] = self._normalize_course(course)
        
        return result
    
    def _parse_date(self, date_str: str) -> Optional[str]:
        """Parse relative date ke YYYY-MM-DD."""
        date_str = date_str.lower().strip()
        today = datetime.now()
        
        if date_str in ["besok", "tomorrow"]:
            return (today + timedelta(days=1)).strftime('%Y-%m-%d')
        elif date_str in ["lusa", "day after tomorrow"]:
            return (today + timedelta(days=2)).strftime('%Y-%m-%d')
        elif date_str in ["minggu depan", "next week"]:
            return (today + timedelta(days=7)).strftime('%Y-%m-%d')
        elif date_str in ["hari ini", "today"]:
            return today.strftime('%Y-%m-%d')
        
        # Try parse YYYY-MM-DD
        try:
            dt = datetime.strptime(date_str, '%Y-%m-%d')
            return dt.strftime('%Y-%m-%d')
        except:
            pass
        
        return None
    
    def _parse_amount(self, amount_str: str) -> Optional[float]:
        """Parse amount string ke number."""
        # Remove common prefixes/suffixes
        amount_str = amount_str.lower().replace('rp', '').replace('.', '').replace(',', '')
        
        # Handle "ribu", "rb", "juta", "jt"
        multiplier = 1
        if 'juta' in amount_str or 'jt' in amount_str:
            multiplier = 1000000
            amount_str = amount_str.replace('juta', '').replace('jt', '')
        elif 'ribu' in amount_str or 'rb' in amount_str:
            multiplier = 1000
            amount_str = amount_str.replace('ribu', '').replace('rb', '')
        
        try:
            return float(amount_str) * multiplier
        except:
            return None
    
    def _normalize_course(self, course: str) -> str:
        """Normalize course name/alias."""
        course = course.lower().strip()
        
        aliases = {
            "kjk": "KJK",
            "keamanan jaringan": "KJK",
            "komber": "Komber",
            "komputasi bergerak": "Komber",
            "kb": "Komber",
            "ppl": "PPL",
            "pengembangan perangkat lunak": "PPL",
            "sister": "Sister",
            "sistem terdistribusi": "Sister",
            "pemjar": "Pemjar",
            "pemrograman jaringan": "Pemjar",
            "wspk": "WSPK",
            "workshop spk": "WSPK",
            "spk": "WSPK",
        }
        
        return aliases.get(course, course.upper())
    
    async def _fallback_parse(self, message: str, context: Dict) -> Dict[str, Any]:
        """Fallback kalau LLM tidak available - simple keyword matching."""
        msg_lower = message.lower()
        
        # Simple intent detection
        if any(x in msg_lower for x in ["tugas", "tambah tugas", "buat tugas", "ada tugas"]):
            return {
                "intent": "create_task",
                "confidence": 0.7,
                "fields": {},
                "missing_fields": ["course", "deadline", "type"],
                "clarification_needed": True,
                "notes": "Fallback parsing",
                "detected_patterns": {}
            }
        
        elif any(x in msg_lower for x in ["project", "proyek", "buat project"]):
            return {
                "intent": "create_project",
                "confidence": 0.7,
                "fields": {},
                "missing_fields": ["title", "deadline", "priority"],
                "clarification_needed": True,
                "notes": "Fallback parsing",
                "detected_patterns": {}
            }
        
        elif any(x in msg_lower for x in ["pengeluaran", "pemasukan", "beli", "bayar", "duit"]):
            return {
                "intent": "create_transaction",
                "confidence": 0.7,
                "fields": {},
                "missing_fields": ["amount"],
                "clarification_needed": True,
                "notes": "Fallback parsing",
                "detected_patterns": {}
            }
        
        elif any(x in msg_lower for x in ["list tugas", "tugas apa", "ada tugas"]):
            return {
                "intent": "list_tasks",
                "confidence": 0.8,
                "fields": {},
                "missing_fields": [],
                "clarification_needed": False,
                "notes": "Fallback parsing",
                "detected_patterns": {}
            }
        
        return {
            "intent": "general_chat",
            "confidence": 0.5,
            "fields": {},
            "missing_fields": [],
            "clarification_needed": False,
            "notes": "Fallback - unclear intent",
            "detected_patterns": {}
        }


# Singleton instance
_llm_nlu = None

def get_llm_nlu(api_key: str = None) -> LLM_NLU:
    global _llm_nlu
    if _llm_nlu is None:
        _llm_nlu = LLM_NLU(api_key)
    return _llm_nlu
