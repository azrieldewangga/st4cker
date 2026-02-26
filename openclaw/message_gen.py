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
    ALLOWED_EMOJI = ""
    
    # Urgency thresholds
    URGENCY_AI_THRESHOLD = 7  # Use AI for urgency >= 7
    
    def __init__(self):
        # Support multiple AI providers
        self.moonshot_api_key = os.getenv("MOONSHOT_API_KEY", "")
        self.moonshot_base_url = os.getenv("MOONSHOT_BASE_URL", "https://api.moonshot.cn/v1")
        
        # Gemini configuration
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self.gemini_base_url = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        
        # Determine which AI to use (Gemini prioritized if both set)
        self.use_gemini = bool(self.gemini_api_key)
        self.use_moonshot = bool(self.moonshot_api_key) and not self.use_gemini
        self.use_ai = self.use_gemini or self.use_moonshot
        
        # Log configuration
        if self.use_gemini:
            print(f"[MessageGen] Using Gemini AI ({self.gemini_model}) - CHEAP MODE 💰")
        elif self.use_moonshot:
            print(f"[MessageGen] Using Moonshot AI (kimi-k2-5)")
        else:
            print(f"[MessageGen] AI disabled - using templates only")
        
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
        """
        Hybrid message generation:
        - Template mode: schedule reminders (normal urgency)
        - AI mode: user interaction (confirm/skip/conversation) OR high urgency reminders
        """
        # User interaction: ALWAYS AI (never template)
        if trigger_type in ["user_confirm", "user_skip", "conversation", "chat", "course_mgmt", 
                           "ambiguous_decision", "missing_info", "confirmation"]:
            if self.use_ai:
                try:
                    return await self._generate_ai(trigger_type, data, user_ctx, urgency=5)
                except Exception as e:
                    print(f"[MessageGen] AI generation failed for user interaction: {e}")
                    # Fallback ke simple response
                    return self._fallback_user_response(trigger_type, data)
            else:
                return self._fallback_user_response(trigger_type, data)
        
        # Reminder: Hybrid based on urgency
        urgency = self._calculate_urgency(trigger_type, data)
        
        if urgency >= self.URGENCY_AI_THRESHOLD and self.use_ai:
            try:
                return await self._generate_ai(trigger_type, data, user_ctx, urgency)
            except Exception as e:
                print(f"[MessageGen] AI generation failed: {e}, falling back to template")
                return self._generate_template(trigger_type, data, user_ctx, urgency)
        else:
            return self._generate_template(trigger_type, data, user_ctx, urgency)
    
    def _fallback_user_response(self, trigger_type: str, data: Dict) -> str:
        """Fallback response untuk user interaction kalau AI fail."""
        if trigger_type == "user_confirm":
            return random.choice(["okee, aku catet ✌🏻", "siapp, zril", "iyaa, noted"])
        elif trigger_type == "user_skip":
            return random.choice(["okee, skip dulu", "iyaa, next time", "siapp, paham"])
        else:
            return random.choice(["hmm, bisa jelasin lagi?", "iyaa?", "okee"])
    
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
        
        # Always include room if available, always start with "zril, ada"
        if room:
            templates = [
                f"zril, ada {course} jam {time} di {room}",
            ]
        else:
            templates = [
                f"zril, ada {course} jam {time}",
            ]
        
        return random.choice(templates)
    
    def _template_schedule_15min(self, data: Dict, urgency: int) -> str:
        """Template for 15min before class."""
        course = data.get("course_name", "kelas")
        time = data.get("start_time", "08:00")
        room = data.get("room", "")
        
        # Consistent format: "zril, ..."
        if room:
            return f"zril, {course} mulai 15 menit lagi di {room}"
        else:
            return f"zril, {course} mulai 15 menit lagi"
    
    def _template_545am(self, data: Dict, urgency: int) -> str:
        """Template for 5:45 AM early bird."""
        templates = [
            "pagi zril",
            "okee, siapin diri",
            "iyaa, pagi",
            "siapp",
        ]
        return random.choice(templates)
    
    def _template_first_90min(self, data: Dict, urgency: int) -> str:
        """Template for first class 90min reminder."""
        course = data.get("course_name", "kelas")
        time = data.get("start_time", "08:00")
        
        if room:
            templates = [
                f"zril, {course} jam {time} di {room}",
                f"siapp, ada {course} jam {time} - {room}",
                f"iyaa, {course} *{time}* di {room}",
            ]
        else:
            templates = [
                f"zril, {course} jam {time}",
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
                "task aman zril",
                "okee, kosong",
                "iyaa, nothing urgent",
            ]
        elif count == 1:
            task_name = tasks[0].get("name", "task")
            templates = [
                f"zril, ada {task_name}",
                f"siapp, 1 task pending",
                f"iyaa, *{task_name}*",
            ]
        else:
            templates = [
                f"zril, {count} task hari ini",
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
            "okee, gimana tasknya?",
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
                f"besok ada kelas + {task_count} task",
                f"siapp, besok *busy day*",
                f"iyaa, besok ada {task_count} task",
            ]
        elif has_class:
            templates = [
                "besok ada kelas",
                "siapp, besok kuliah",
                "iyaa, *besok ada jadwal*",
            ]
        elif task_count > 0:
            templates = [
                f"besok {task_count} task",
                f"siapp, {task_count} task besok",
                f"iyaa, *{task_count} task* besok",
            ]
        else:
            templates = [
                "besok kosong zril",
                "okee, besok free",
                "iyaa, *besok chill*",
            ]
        
        return random.choice(templates)
    
    def _template_crisis(self, data: Dict, urgency: int) -> str:
        """Template for crisis situations (fallback when AI fails)."""
        tasks = data.get("tasks", [])
        urgent_count = len([t for t in tasks if t.get("days_left", 7) <= 1])
        
        templates = [
            f"zril, *{urgent_count} task urgent*",
            f"siapp, ada *{urgent_count} deadline*",
            f"iyaa, *critical* - {urgent_count} task",
        ]
        
        return random.choice(templates)
    
    def _template_generic(self, data: Dict, urgency: int) -> str:
        """Generic fallback template."""
        templates = [
            f"okee zril",
            f"siapp",
            f"iyaa",
        ]
        return random.choice(templates)
    
    async def _generate_ai(self, trigger_type: str, data: Dict, user_ctx: Dict, urgency: int) -> str:
        """Generate message using AI (Gemini prioritized, fallback to Moonshot)."""
        
        prompt = self._build_ai_prompt(trigger_type, data, user_ctx, urgency)
        
        if self.use_gemini:
            return await self._generate_gemini(prompt)
        else:
            return await self._generate_moonshot(prompt)
    
    async def _generate_gemini(self, prompt: str) -> str:
        """Generate using Gemini API (cheaper option)."""
        
        # Gemini uses different payload format
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": self._get_system_prompt() + "\n\n" + prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 150,
                "topP": 0.9
            }
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.gemini_base_url}/models/{self.gemini_model}:generateContent?key={self.gemini_api_key}",
                json=payload,
                timeout=10.0
            )
            resp.raise_for_status()
            result = resp.json()
            
            # Parse Gemini response format
            if "candidates" in result and len(result["candidates"]) > 0:
                content = result["candidates"][0]["content"]["parts"][0]["text"]
                return content.strip()
            else:
                raise Exception("No response from Gemini")
    
    async def _generate_moonshot(self, prompt: str) -> str:
        """Generate using Moonshot API (legacy)."""
        
        headers = {
            "Authorization": f"Bearer {self.moonshot_api_key}",
            "Content-Type": "application/json"
        }
        
        messages = [
            {"role": "system", "content": self._get_system_prompt()},
            {"role": "user", "content": prompt}
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
1. NO EMOJIS sama sekali (jangan pakai 😀, 🔥, ⚠️, ✌🏻, dll)
2. NO BOLD - gunakan *single asterisk* untuk emphasis (jangan pakai **bold**)
3. Brevity is mandatory - maksimal 2 kalimat, prefer 1 kalimat
4. Always Indonesian
5. Use repeated letters occasionally: "siapp", "okee", "iyaa", "hmm"
6. Swearing allowed when appropriate: "shit", "fuck", "damn"
7. NO feminine terms: no "bestie", "sayang", "dear", "honey"
8. Be bold, have strong opinions
9. Never open with "Great question" or "I'd be happy to help" - just answer

TONE EXAMPLES:
- Normal: "zril, ada kelas jam 08:00"
- Urgent: "shit, deadline besok dan lu masih stuck. *prioritasin yang mana?*"
- Confirm: "okee, aku catet"
- Reject: "iyaa, skip dulu"
- Crisis: "fuck, ini critical. *2 task H-1* belum kelar"

Generate reminder message sesuai urgency level yang diberikan."""
    
    def _build_ai_prompt(self, trigger_type: str, data: Dict, user_ctx: Dict, urgency: int) -> str:
        """Build user prompt for AI generation."""
        
        # User interaction prompts (NOT reminder)
        if trigger_type == "user_confirm":
            course = data.get("course", "kelas")
            return f"""User (zril) confirmed attendance for {course}.

Generate short acknowledgment with kimi persona:
- Minimalist, friendly
- Use "okee", "iyaa", or "siapp" with repeated letters
- NO emoji
- Max 1 sentence
- Single asterisk for emphasis (if needed)

Examples: "okee, aku catet" | "siapp, zril" | "iyaa, noted"""
        
        elif trigger_type == "user_skip":
            course = data.get("course", "kelas")
            return f"""User (zril) skipped/cancelled attendance for {course}.

Generate short acknowledgment with kimi persona:
- Minimalist, no judgement
- Use "okee", "iyaa", or "siapp" with repeated letters
- NO emoji
- Max 1 sentence

Examples: "okee, skip dulu" | "iyaa, next time" | "siapp, paham"""
        
        elif trigger_type == "user_progress":
            task = data.get("task", "tugas")
            progress = data.get("progress", 0)
            return f"""User (zril) reported progress {progress}% on {task}.

Generate encouraging acknowledgment with kimi persona:
- Minimalist, supportive
- Use repeated letters (okee, iyaa, siapp)
- NO emoji
- Max 2 sentences
- Single asterisk for emphasis

Acknowledge progress and give brief motivation."""
        
        elif trigger_type in ["conversation", "chat"]:
            user_message = data.get("user_message", "")
            intent = data.get("intent", "unknown")
            return f"""User (zril) said: "{user_message}"
Intent detected: {intent}

Generate conversational reply with kimi persona:
- Minimalist, friendly, bold
- Use repeated letters (okee, iyaa, siapp, hmm)
- NO emoji
- Single asterisk for emphasis (WhatsApp style)
- Brevity mandatory - max 2 sentences
- Indonesian only
- Swearing allowed when appropriate
- Call user "zril" or "azriel", self as "aku"

Be helpful but concise. If asking clarification, keep it simple."""
        
        elif trigger_type == "course_mgmt":
            intent = data.get("intent", "unknown")
            course = data.get("course", "matkul")
            date = data.get("date", "")
            details = data.get("details", {})
            user_message = data.get("user_message", "")
            
            # Build context description
            if intent == "skip":
                context_desc = f"User (zril) informed that {course} on {date} is skipped/kosong."
            elif intent == "online":
                context_desc = f"User (zril) informed that {course} on {date} will be conducted online."
            elif intent == "reschedule_temp":
                new_day = details.get("new_day", "?")
                new_time = details.get("new_time", "?")
                context_desc = f"User (zril) rescheduled {course} on {date} to {new_day} at {new_time} (temporary/one-time)."
            elif intent == "reschedule_perm":
                new_day = details.get("new_day", "?")
                new_time = details.get("new_time", "?")
                context_desc = f"User (zril) permanently rescheduled {course} to {new_day} at {new_time}."
            else:
                context_desc = f"User (zril) updated schedule for {course}."
            
            return f"""{context_desc}
Original message: "{user_message}"

Generate acknowledgment with kimi persona:
- Confirm the schedule change was noted
- Minimalist, friendly
- Use repeated letters (okee, iyaa, siapp, hmm)
- NO emoji
- Single asterisk for emphasis
- Brevity mandatory - max 2 sentences
- Indonesian only
- Call user "zril", self as "aku"

Examples:
- Skip: "okee, aku catet KJK kosong. Matkul berikutnya tetep jadi ya."
- Online: "siapp, KJK online. Jangan lupa cek linknya."
- Reschedule: "iyaa, KJK pindah ke Jumat jam 10. Aku update jadwalnya."""
        
        elif trigger_type == "ambiguous_decision":
            intent = data.get("intent", "unknown")
            confidence = data.get("confidence", 0.5)
            user_message = data.get("user_message", "")
            
            if confidence >= 0.7:
                return f"""SmartReminder detected ambiguous message from zril: "{user_message}"
AI decided this is: {intent} (confidence: {confidence:.0%})

Generate acknowledgment with kimi persona:
- Confirm the decision briefly
- Minimalist, friendly
- Use repeated letters (okee, iyaa, siapp)
- NO emoji
- Single asterisk for emphasis
- Brevity mandatory - max 1 sentence
- Indonesian only

Examples:
- Confirm: "okee, aku catet zril hadir."
- Decline: "iyaa, skip dulu ya."
- Delay: "siapp, dicatet telat {data.get('delay_min', 5)} menit."
- Online: "okee, online noted."""
            else:
                return f"""SmartReminder detected ambiguous message from zril: "{user_message}"
AI is unsure (confidence: {confidence:.0%})

Generate clarification request with kimi persona:
- Ask user to clarify simply
- Minimalist, friendly
- Use repeated letters (okee, iyaa, siapp, hmm)
- NO emoji
- Single asterisk for emphasis
- Brevity mandatory - max 2 sentences
- Indonesian only

Examples:
- "zril, maksudnya *confirm* atau *skip*?"
- "hmm, ini *hadir* atau *bolos* ya?"
- "iyaa? maksudnya gimana?"""
        
        elif trigger_type == "missing_info":
            missing_fields = data.get("missing_fields", [])
            return f"""SmartReminder needs more info from zril.
Missing: {', '.join(missing_fields)}

Generate polite request with kimi persona:
- Ask for missing info simply
- Minimalist, friendly
- Use repeated letters (okee, iyaa, siapp)
- NO emoji
- Single asterisk for emphasis
- Brevity mandatory - max 2 sentences
- Indonesian only

Example: "zril, *{missing_fields[0]}* nya kapan ya?"""
        
        elif trigger_type == "confirmation":
            proposed = data.get("proposed_action", "action")
            return f"""SmartReminder needs confirmation from zril for: {proposed}

Generate confirmation request with kimi persona:
- Ask for confirmation simply
- Minimalist, friendly
- Use repeated letters (okee, iyaa, siapp)
- NO emoji
- Single asterisk for emphasis
- Brevity mandatory - max 2 sentences
- Indonesian only
- Make it easy to confirm (just reply "iya")

Example: "zril, aku catet *{proposed}*? Balas *iya* kalau betul."""
        
        # Reminder prompts (existing logic)
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
            prompt_parts.append("\n\nGenerate normal reminder. Keep it short and friendly, NO emoji.")
        
        return "\n".join(prompt_parts)


# Singleton instance
_message_gen = None

def get_message_generator() -> MessageGenerator:
    """Get singleton message generator instance."""
    global _message_gen
    if _message_gen is None:
        _message_gen = MessageGenerator()
    return _message_gen
