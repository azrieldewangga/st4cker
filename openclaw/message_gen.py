"""
Message Generator - Hybrid AI & Template
Persona: kimi (minimalist, bold, no emoji kecuali ✌🏻, single asterisk, repeated letters)
"""

import random
import os
from datetime import datetime
from typing import Dict, List, Optional
import httpx
import asyncio


class MessageGenerator:
    """Generate reminder messages with kimi persona."""
    
    # Communication style constants
    REPEATED_WORDS = ["okee", "iyaa", "siapp", "hmm", "yaa"]
    EMPHASIS_CHAR = "*"  # Single asterisk for WhatsApp style
    ALLOWED_EMOJI = "✌🏻"
    
    # Urgency thresholds
    URGENCY_AI_THRESHOLD = 7  # Use AI for urgency >= 7
    
    def __init__(self):
        self.moonshot_api_key = os.getenv("MOONSHOT_API_KEY", "")
        self.moonshot_base_url = os.getenv("MOONSHOT_BASE_URL", "https://api.moonshot.cn/v1")
        self.use_ai = bool(self.moonshot_api_key)
        
    def _get_repeated_word(self) -> str:
        """Get random repeated letter word."""
        return random.choice(self.REPEATED_WORDS)
    
    def _emphasize(self, text: str) -> str:
        """Emphasize text with single asterisk."""
        return f"{self.EMPHASIS_CHAR}{text}{self.EMPHASIS_CHAR}"
    
    def _calculate_urgency(self, trigger_type: str, data: Dict) -> int:
        """Calculate urgency score 0-10."""
        score = 0
        
        # Base urgency by trigger type
        if trigger_type == "crisis_check":
            score += 8
        elif trigger_type == "night_preview":
            score += 3
        elif trigger_type == "task_list":
            score += 2
        elif trigger_type in ["schedule_15min", "schedule_90min", "first_90min", "first_545am", "15min"]:
            score += 4
        elif trigger_type == "followup":
            score += 3
        
        # Task-based urgency
        tasks = data.get("tasks", [])
        if tasks:
            urgent_count = sum(1 for t in tasks if t.get("days_left", 7) <= 1)
            stuck_count = sum(1 for t in tasks if t.get("is_stuck", False))
            overdue_count = sum(1 for t in tasks if t.get("days_left", 7) < 0)
            
            score += overdue_count * 4
            score += urgent_count * 3
            score += stuck_count * 2
        
        # Schedule-based urgency
        if data.get("conflict"):
            score += 5
        if data.get("is_critical"):
            score += 3
        
        return min(score, 10)
    
    async def generate(self, trigger_type: str, data: Dict, user_ctx: Dict) -> str:
        """Hybrid: Template untuk normal, AI untuk urgent."""
        urgency = self._calculate_urgency(trigger_type, data)
        
        if urgency >= self.URGENCY_AI_THRESHOLD and self.use_ai:
            try:
                return await self._generate_ai(trigger_type, data, user_ctx, urgency)
            except Exception as e:
                print(f"[MessageGen] AI generation failed: {e}, falling back to template")
                return self._generate_template(trigger_type, data, user_ctx, urgency)
        else:
            return self._generate_template(trigger_type, data, user_ctx, urgency)
    
    def _generate_template(self, trigger_type: str, data: Dict, user_ctx: Dict, urgency: int = 0) -> str:
        """Generate message using templates with kimi persona."""
        
        if trigger_type == "schedule_90min":
            return self._template_schedule_90min(data, urgency)
        elif trigger_type == "schedule_15min":
            return self._template_schedule_15min(data, urgency)
        elif trigger_type == "first_545am":
            return self._template_545am(data, urgency)
        elif trigger_type == "first_90min":
            return self._template_first_90min(data, urgency)
        elif trigger_type == "task_list":
            return self._template_task_list(data, urgency)
        elif trigger_type == "followup":
            return self._template_followup(data, urgency)
        elif trigger_type == "night_preview":
            return self._template_night_preview(data, urgency)
        elif trigger_type == "crisis_check":
            return self._template_crisis(data, urgency)
        else:
            return self._template_generic(data, urgency)
    
    def _template_schedule_90min(self, data: Dict, urgency: int) -> str:
        """Template for 90min before class."""
        course = data.get("course_name", "kelas")
        time = data.get("start_time", "08:00")
        room = data.get("room", "")
        
        templates = [
            f"zril, ada {course} jam {time} ✌🏻",
            f"siapp, {course} jam {time}",
            f"iyaa, {course} mulai {time} ✌🏻",
        ]
        
        if room:
            templates.append(f"zril, {course} jam {time} di {room}")
            templates.append(f"{course} jam {time} - {room} ✌🏻")
        
        return random.choice(templates)
    
    def _template_schedule_15min(self, data: Dict, urgency: int) -> str:
        """Template for 15min before class."""
        course = data.get("course_name", "kelas")
        time = data.get("start_time", "08:00")
        
        templates = [
            f"{course} 15 menit lagi ✌🏻",
            f"siapp, {course} sebentar lagi",
            f"zril, {course} *mulai 15 menit lagi*",
            f"iyaa, {course} jam {time} - *siap?*",
        ]
        
        return random.choice(templates)
    
    def _template_545am(self, data: Dict, urgency: int) -> str:
        """Template for 5:45 AM early bird."""
        templates = [
            "pagi zril ✌🏻",
            "okee, siapin diri",
            "iyaa, pagi",
            f"siapp {self.ALLOWED_EMOJI}",
        ]
        return random.choice(templates)
    
    def _template_first_90min(self, data: Dict, urgency: int) -> str:
        """Template for first class 90min reminder."""
        course = data.get("course_name", "kelas")
        time = data.get("start_time", "08:00")
        
        templates = [
            f"zril, {course} jam {time} ✌🏻",
            f"siapp, ada {course} jam {time}",
            f"iyaa, {course} *{time}*",
        ]
        
        return random.choice(templates)
    
    def _template_task_list(self, data: Dict, urgency: int) -> str:
        """Template for 15:00 task list."""
        tasks = data.get("tasks", [])
        count = len(tasks)
        
        if count == 0:
            templates = [
                "task aman zril ✌🏻",
                "okee, kosong",
                "iyaa, nothing urgent",
            ]
        elif count == 1:
            task_name = tasks[0].get("name", "task")
            templates = [
                f"zril, ada {task_name}",
                f"siapp, 1 task pending ✌🏻",
                f"iyaa, *{task_name}*",
            ]
        else:
            templates = [
                f"zril, {count} task hari ini ✌🏻",
                f"siapp, ada {count} task",
                f"iyaa, *{count} task* waiting",
            ]
        
        # Add urgency indicator
        if urgency >= 5:
            urgent_tasks = [t for t in tasks if t.get("days_left", 7) <= 1]
            if urgent_tasks:
                base = random.choice(templates)
                return f"{base}\n*{len(urgent_tasks)} urgent*"
        
        return random.choice(templates)
    
    def _template_followup(self, data: Dict, urgency: int) -> str:
        """Template for 20:00 followup."""
        templates = [
            "siapp zril, progress hari ini?",
            "okee, gimana tasknya? ✌🏻",
            "iyaa, *update dong*",
            "zril, *status?*",
        ]
        return random.choice(templates)
    
    def _template_night_preview(self, data: Dict, urgency: int) -> str:
        """Template for 21:00 night preview."""
        tomorrow = data.get("tomorrow_summary", {})
        has_class = tomorrow.get("has_class", False)
        task_count = tomorrow.get("task_count", 0)
        
        if has_class and task_count > 0:
            templates = [
                f"besok ada kelas + {task_count} task ✌🏻",
                f"siapp, besok *busy day*",
                f"iyaa, besok ada {task_count} task",
            ]
        elif has_class:
            templates = [
                "besok ada kelas ✌🏻",
                "siapp, besok kuliah",
                "iyaa, *besok ada jadwal*",
            ]
        elif task_count > 0:
            templates = [
                f"besok {task_count} task ✌🏻",
                f"siapp, {task_count} task besok",
                f"iyaa, *{task_count} task* besok",
            ]
        else:
            templates = [
                "besok kosong zril ✌🏻",
                "okee, besok free",
                "iyaa, *besok chill*",
            ]
        
        return random.choice(templates)
    
    def _template_crisis(self, data: Dict, urgency: int) -> str:
        """Template for crisis situations (fallback when AI fails)."""
        tasks = data.get("tasks", [])
        urgent_count = len([t for t in tasks if t.get("days_left", 7) <= 1])
        
        templates = [
            f"zril, *{urgent_count} task urgent* ✌🏻",
            f"siapp, ada *{urgent_count} deadline*",
            f"iyaa, *critical* - {urgent_count} task",
        ]
        
        return random.choice(templates)
    
    def _template_generic(self, data: Dict, urgency: int) -> str:
        """Generic fallback template."""
        templates = [
            f"okee zril ✌🏻",
            f"siapp",
            f"iyaa ✌🏻",
        ]
        return random.choice(templates)
    
    async def _generate_ai(self, trigger_type: str, data: Dict, user_ctx: Dict, urgency: int) -> str:
        """Generate message using Moonshot AI for urgent situations."""
        
        prompt = self._build_ai_prompt(trigger_type, data, user_ctx, urgency)
        
        headers = {
            "Authorization": f"Bearer {self.moonshot_api_key}",
            "Content-Type": "application/json"
        }
        
        messages = [
            {
                "role": "system",
                "content": self._get_system_prompt()
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        payload = {
            "model": "kimi-k2-5",
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 150,
            "top_p": 0.9
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.moonshot_base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=10.0
            )
            resp.raise_for_status()
            result = resp.json()
            return result["choices"][0]["message"]["content"].strip()
    
    def _get_system_prompt(self) -> str:
        """System prompt for Moonshot AI with kimi persona."""
        return """Kamu adalah kimi, AI Assistant dengan vibe minimalist, friendly, bold, dan innovative.

IDENTITY:
- Name: st4cker, Nickname: kimi
- Panggil diri: "aku" (bukan "tek")
- Panggil user: "zril" atau "azriel"

COMMUNICATION RULES (STRICT - MUST FOLLOW):
1. NO EMOJIS kecuali ✌🏻 (jangan pakai 😀, 🔥, ⚠️, dll)
2. NO BOLD - gunakan *single asterisk* untuk emphasis (jangan pakai **bold**)
3. Brevity is mandatory - maksimal 2 kalimat, prefer 1 kalimat
4. Always Indonesian
5. Use repeated letters occasionally: "siapp", "okee", "iyaa", "hmm"
6. Swearing allowed when appropriate: "shit", "fuck", "damn"
7. NO feminine terms: no "bestie", "sayang", "dear", "honey"
8. Be bold, have strong opinions
9. Never open with "Great question" or "I'd be happy to help" - just answer

TONE EXAMPLES:
- Normal: "zril, ada kelas jam 08:00 ✌🏻"
- Urgent: "shit, deadline besok dan lu masih stuck. *prioritasin yang mana?*"
- Confirm: "okee, aku catet"
- Reject: "iyaa, skip dulu"
- Crisis: "fuck, ini critical. *2 task H-1* belum kelar"

Generate reminder message sesuai urgency level yang diberikan."""
    
    def _build_ai_prompt(self, trigger_type: str, data: Dict, user_ctx: Dict, urgency: int) -> str:
        """Build user prompt for AI generation."""
        
        prompt_parts = [f"Urgency Level: {urgency}/10"]
        prompt_parts.append(f"Trigger: {trigger_type}")
        
        # Add context
        if data.get("tasks"):
            tasks = data["tasks"]
            prompt_parts.append(f"\nTasks ({len(tasks)} total):")
            for t in tasks[:5]:  # Limit to 5 tasks
                name = t.get("name", "Unknown")
                days = t.get("days_left", 7)
                stuck = " [STUCK]" if t.get("is_stuck") else ""
                prompt_parts.append(f"- {name}: H-{days}{stuck}")
        
        if data.get("course_name"):
            prompt_parts.append(f"\nSchedule: {data['course_name']} at {data.get('start_time', '??')}")
        
        if data.get("conflict"):
            prompt_parts.append("\nALERT: Schedule conflict detected")
        
        # Add instruction based on urgency
        if urgency >= 9:
            prompt_parts.append("\n\nGenerate CRISIS message. Be bold, use strong language if appropriate. Highlight critical items with *single asterisk*.")
        elif urgency >= 7:
            prompt_parts.append("\n\nGenerate URGENT message. Use *single asterisk* for emphasis. Be direct and bold.")
        else:
            prompt_parts.append("\n\nGenerate normal reminder. Keep it short and friendly with ✌🏻")
        
        return "\n".join(prompt_parts)


# Singleton instance
_message_gen = None

def get_message_generator() -> MessageGenerator:
    """Get singleton message generator instance."""
    global _message_gen
    if _message_gen is None:
        _message_gen = MessageGenerator()
    return _message_gen
