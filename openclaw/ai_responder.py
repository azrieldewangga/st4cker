#!/usr/bin/env python3
"""
AI Response Generator - Generate natural, personality-driven responses
Bukan template! Tiap response unik sesuai konteks.
"""

import os
import random
from typing import Dict, Any, List
from datetime import datetime

try:
    from google.generativeai import GenerativeModel, configure
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


class AIResponder:
    """
    Generate responses dengan personality kimi.
    Context-aware, non-template, truly conversational.
    """
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.model = None
        
        if GEMINI_AVAILABLE and self.api_key:
            try:
                configure(api_key=self.api_key)
                self.model = GenerativeModel('gemini-2.0-flash-lite')
                print("[AIResponder] Initialized")
            except Exception as e:
                print(f"[AIResponder] Init error: {e}")
    
    async def generate(self, 
                       context: str,  # 'task_created', 'transaction_recorded', etc
                       data: Dict[str, Any],
                       user_memory: Any = None,
                       detected_patterns: Dict = None) -> str:
        """
        Generate natural response.
        
        Args:
            context: Situasi (task_created, transaction_recorded, etc)
            data: Data terkait (task info, transaction info, etc)
            user_memory: UserMemory object untuk konteks history
            detected_patterns: Pattern detection dari LLM_NLU
        """
        if not self.model:
            return self._fallback_response(context, data)
        
        # Build rich prompt
        prompt = self._build_prompt(context, data, user_memory, detected_patterns)
        
        try:
            response = await self.model.generate_content_async(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"[AIResponder] Error: {e}")
            return self._fallback_response(context, data)
    
    def _build_prompt(self, context: str, data: Dict, user_memory: Any, patterns: Dict) -> str:
        """Build prompt untuk LLM."""
        
        # Get context info
        memory_info = ""
        if user_memory:
            recent_tx = user_memory.get_recent_transactions(days=7)
            if recent_tx:
                memory_info += f"\nRecent similar transactions: {len(recent_tx)} in last 7 days"
            
            # Check for repetitive pattern
            if patterns and patterns.get("repetitive_transaction"):
                rep = patterns["repetitive_transaction"]
                memory_info += f"\nPATTERN DETECTED: User has '{rep['title']}' {rep['count']} times recently"
        
        # Build context-specific info
        context_info = ""
        if context == "task_created":
            deadline = data.get('deadline', '')
            if deadline:
                try:
                    deadline_date = datetime.strptime(deadline, '%Y-%m-%d')
                    days_left = (deadline_date - datetime.now()).days
                    if days_left <= 1:
                        context_info = "URGENT: Deadline is tomorrow or today!"
                    elif days_left <= 3:
                        context_info = "Deadline is in a few days"
                except:
                    pass
        
        elif context == "transaction_recorded":
            amount = data.get('amount', 0)
            category = data.get('category', '')
            if amount > 500000:
                context_info = "LARGE EXPENSE: Above 500k"
            elif category == "makan":
                context_info = "Food expense"
        
        prompt = f"""You are "kimi", a friendly AI assistant helping a student named "zril".

Your personality:
- Very friendly and casual, like a close friend
- Use Indonesian mixed with casual English
- Call the user "zril"
- Use emojis naturally (✌🏻, 💪, 😄, 👍)
- Supportive and encouraging
- Not robotic, not templated - each response is unique
- Can be witty and playful when appropriate

Current situation: {context}
Data: {data}
{memory_info}
{context_info}

Guidelines:
1. Respond naturally like texting a friend
2. Reference patterns if detected (e.g., "btw kamu beli ini terus ya?")
3. Add relevant follow-up questions or comments
4. Keep it concise (1-3 sentences usually)
5. Don't be overly formal
6. Variation: Don't use the same phrases repeatedly

Examples:

Situation: task_created, urgent deadline
Response: "Wah zril deadline besok! 😱 Semangat ya, masih ada waktu kok. Mau aku ingetin nanti?"

Situation: transaction_recorded, repetitive food purchase
Response: "Catet! 💸 Nasi ayam Rp15.000\n\nBtw zril, kamu udah 5 hari berturut-turut makan nasi ayam nih, ga bosen? 😄"

Situation: task_created, normal deadline
Response: "Oke zril, tugas KJK-nya ku catet ya. 3 hari lagi deadline, santai aja tapi jangan mager 💪"

Situation: project_progress_logged
Response: "Keren zril! 🎉 Dari 50% jadi 75%, mantap progressnya!"

Situation: list_tasks, many pending
Response: "Zril, ada 5 tugas menunggu nih ✌🏻 Yang mana mau dikerjain dulu?"

Situation: list_tasks, empty
Response: "Santai zril, ga ada tugas pending! ✌🏻 Mau nonton atau tidur? 😄"

Now generate response for:
Situation: {context}
Data: {data}

Response (in kimi's voice):"""
        
        return prompt
    
    def _fallback_response(self, context: str, data: Dict) -> str:
        """Fallback kalau LLM tidak available - tapi tetep natural."""
        
        variations = {
            "task_created": [
                f"Oke zril, tugasnya ku catet! ✌🏻",
                f"Catet! 📋 Semangat ngerjainnya ya zril!",
                f"Done! ✅ Tugas sudah tercatat, jangan lupa dikerjain!",
            ],
            "transaction_recorded": [
                f"Catet! 💸",
                f"Oke zril, udah ku catet! 👍",
                f"Tercatat! 📊",
            ],
            "project_created": [
                f"Project baru! 💪 Semangat zril!",
                f"Oke, project sudah dibuat. Gaskeun! 🚀",
                f"Catet project baru! 📁",
            ],
            "progress_logged": [
                f"Keren zril! 🔥 Progress naik nih!",
                f"Mantap! 💪 Progress updated!",
                f"Good job zril! ✨",
            ],
            "list_tasks": [
                f"Ini daftar tugasmu zril ✌🏻",
                f"Zril, tugas-tugasmu nih 📋",
                f"Catatan tugas zril! 💪",
            ],
            "general_chat": [
                f"Ada yang bisa aku bantu zril? ✌🏻",
                f"Zril! 👋 What's up?",
                f"Halo zril! Mau ngapain hari ini? 😄",
            ]
        }
        
        options = variations.get(context, variations["general_chat"])
        return random.choice(options)
    
    async def generate_clarification(self, 
                                     missing_fields: List[str],
                                     partial_data: Dict,
                                     user_memory: Any = None) -> str:
        """
        Generate clarification question yang natural.
        Tanya hanya yang perlu, tidak kaku.
        """
        if not self.model or not missing_fields:
            return self._fallback_clarification(missing_fields)
        
        # Build context
        has_info = []
        need_info = []
        
        for field in missing_fields:
            if field == "course":
                need_info.append("mata kuliah")
            elif field == "deadline":
                need_info.append("deadline kapan")
            elif field == "type":
                need_info.append("tipe tugas (Tugas/LP/LS/LR)")
            elif field == "amount":
                need_info.append("berapa nominalnya")
            elif field == "title":
                need_info.append("judul project")
            elif field == "priority":
                need_info.append("priority (low/medium/high)")
            else:
                need_info.append(field)
        
        for key, val in partial_data.items():
            if val:
                if key == "course":
                    has_info.append(f"matkul {val}")
                elif key == "deadline":
                    has_info.append(f"deadline {val}")
                elif key == "title":
                    has_info.append(f"judul '{val}'")
        
        prompt = f"""You are "kimi", friendly AI assistant for "zril".

User wants to create something but missing some info.
Already have: {', '.join(has_info) if has_info else 'nothing yet'}
Still need: {', '.join(need_info)}

Generate a NATURAL clarification question. Don't list fields mechanically.
Ask like a friend would ask. Can combine multiple missing fields in one question.

Examples:

Has: course=KJK
Need: deadline, type
"Oke zril, tugas KJK. Deadline kapan dan tipe tugasnya apa?"

Has: nothing
Need: course, deadline, type  
"Mau nambah tugas ya? Untuk matkul apa dan deadline kapan?"

Has: title=Website Portfolio
Need: deadline, priority
"Project Website Portfolio, noted! Deadline kapan dan prioritynya gimana?"

Has: category=makan
Need: amount
"Oke makan. Berapa harganya zril?"

Now generate for:
Has: {has_info}
Need: {need_info}

Response:"""
        
        try:
            response = await self.model.generate_content_async(prompt)
            return response.text.strip()
        except:
            return self._fallback_clarification(missing_fields)
    
    def _fallback_clarification(self, missing_fields: List[str]) -> str:
        """Fallback clarification."""
        field_names = {
            "course": "matkulnya apa",
            "deadline": "deadline kapan",
            "type": "tipe tugasnya apa",
            "amount": "berapa nominalnya",
            "title": "judulnya apa",
            "priority": "prioritynya gimana"
        }
        
        questions = [field_names.get(f, f) for f in missing_fields]
        return f"Zril, aku perlu tau: {', '.join(questions)}?"


# Singleton
_responder = None

def get_responder(api_key: str = None) -> AIResponder:
    global _responder
    if _responder is None:
        _responder = AIResponder(api_key)
    return _responder
