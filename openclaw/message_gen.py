#!/usr/bin/env python3
"""
Message Generator - Persona: Azriel (Zril)
Generate natural, conversational messages
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

class MessageGenerator:
    """
    Generate messages dengan persona Azriel (Zril) - teman kuliah yang friendly & supportive.
    """
    
    def __init__(self):
        self.name = "Zril"  # Panggilan user
    
    def get_greeting(self) -> str:
        """Get time-appropriate greeting."""
        hour = datetime.now().hour
        
        if 5 <= hour < 11:
            return "Pagi"
        elif 11 <= hour < 15:
            return "Halo"
        elif 15 <= hour < 19:
            return "Halo"
        else:
            return "Ehh"
    
    def generate(self, trigger_type: str, data: Dict, user_ctx: Dict) -> str:
        """
        Generate message based on trigger type.
        """
        if trigger_type == "night_preview":
            return self._generate_night_preview(data)
        
        elif trigger_type == "schedule":
            return self._generate_schedule_reminder(data, user_ctx)
        
        elif trigger_type == "task_list":
            return self._generate_task_list(data)
        
        elif trigger_type == "followup":
            return self._generate_followup(data, user_ctx)
        
        elif trigger_type == "crisis_check":
            return self._generate_crisis(data)
        
        else:
            return f"Halo {self.name}! 👋 Ada info buat kamu."
    
    def _generate_night_preview(self, data: Dict) -> str:
        """Generate night preview message (jam 21:00)."""
        schedules = data.get("tomorrow_schedules", [])
        tasks = data.get("tomorrow_tasks", [])
        
        greeting = self.get_greeting()
        lines = [f"{greeting} {self.name}! 👋", ""]
        
        if not schedules and not tasks:
            lines.append("Besok gak ada jadwal kuliah! 🎉")
            return "\n".join(lines)
        
        # Schedules
        if schedules:
            lines.append(f"Besok ada {len(schedules)} matkul ya:")
            lines.append("")
            
            for i, sched in enumerate(schedules, 1):
                course = sched.get("course_name", "Matkul")
                time = sched.get("start_time", "??")
                room = sched.get("room", "Ruang ?")
                lecturer = sched.get("lecturer", "")
                
                lecturer_info = f" ({lecturer})" if lecturer else ""
                lines.append(f"{i}. **{course}** - jam {time} di {room}{lecturer_info}")
            
            lines.append("")
            
            # First class reminder
            first = schedules[0]
            first_time = first.get("start_time", "??")
            lines.append(f"Yang pertama {first['course_name']} jam {first_time}, jangan lupa alarm ⏰")
        
        # Tasks
        urgent_tasks = [t for t in tasks if t.get("days_left", 7) <= 2]
        if urgent_tasks:
            lines.append("")
            lines.append(f"Oh iya, besok ada {len(urgent_tasks)} tugas deadline:")
            for task in urgent_tasks:
                lines.append(f"• **{task['title']}** ({task['course']})")
        
        # Skip prompt
        lines.append("")
        lines.append("Ada matkul yang kosong besok? Kalau ada yang kosong, reply \"besok [matkul] kosong\" biar aku gak ngingetin ya.")
        
        return "\n".join(lines)
    
    def _generate_schedule_reminder(self, data: Dict, user_ctx: Dict) -> str:
        """Generate schedule reminder message."""
        course = data.get("course", "Matkul")
        time = data.get("start_time", "??")
        room = data.get("room", "Ruang ?")
        lecturer = data.get("lecturer", "")
        minutes_before = data.get("minutes_before", 0)
        is_first = data.get("is_first_class", False)
        
        greeting = self.get_greeting()
        lecturer_info = f"Dosennya {lecturer} ya." if lecturer else ""
        
        if minutes_before == 90 or (is_first and "05:45" in data.get("trigger_time", "")):
            # Pagi reminder
            return f"""{greeting} {self.name}! ☀️

Sekitar 1.5 jam lagi ada **{course}** jam {time} di {room}.
{lecturer_info}

Sarapan dulu biar kuat! Reply \"otw\" kalo udah berangkat."""
        
        elif minutes_before == 15:
            # 15 minutes reminder
            if is_first:
                return f"""Ehh {self.name}, bentar lagi jam {time} ada **{course}** di {room} nih!

Udah di kampus? 👀"""
            else:
                return f"""Halo! 15 menit lagi ada **{course}** di {room}.

Ini matkul berikutnya hari ini. Semangat terus! 🔥"""
        
        else:
            return f"""{greeting} {self.name}!

Segera ada **{course}** jam {time} di {room}.

Jangan telat ya! 👍"""
    
    def _generate_task_list(self, data: Dict) -> str:
        """Generate task list reminder (jam 15:00)."""
        tasks = data.get("tasks", [])
        count = data.get("count", 0)
        
        if not tasks:
            return f"Halo {self.name}! 👋\n\nHari ini gak ada tugas yang deadline dekat. Santai dulu ya! 😄"
        
        lines = [f"📋 *REMINDER TUGAS*", ""]
        lines.append(f"Halo {self.name}! Ada {count} tugas yang perlu dikerjain:")
        lines.append("")
        
        for t in tasks:
            title = t.get("title", "Tugas")
            course = t.get("course", "")
            task_type = t.get("type", "")
            deadline = t.get("deadline", "")
            urgency = t.get("urgency", "")
            note = t.get("note", "")
            days_left = t.get("days_left", 7)
            
            lines.append(f"📚 **{course}** - {title}")
            lines.append(f"   🏷️ {task_type}")
            lines.append(f"   📅 {deadline} ({urgency})")
            if note:
                lines.append(f"   📌 {note}")
            lines.append("")
        
        # Urgent warning
        very_urgent = [t for t in tasks if t.get("days_left", 7) <= 1]
        if very_urgent:
            lines.append(f"⚠️ Ada {len(very_urgent)} tugas deadline besok/lusa! Jangan ditunda ya.")
            lines.append("")
        
        lines.append("Reply dengan nomor atau nama tugas yang mau dikerjain ya!")
        lines.append("Contoh: \"1\", \"kerjain kjk\", atau \"otw ngerjain laporan\"")
        
        return "\n".join(lines)
    
    def _generate_followup(self, data: Dict, user_ctx: Dict) -> str:
        """Generate follow-up message (jam 20:00)."""
        mode = data.get("mode", "general")
        task = data.get("task", {})
        
        task_name = task.get("title", "Tugas")
        course = task.get("course", "")
        progress = task.get("progress", 0)
        deadline = task.get("deadline", "")
        days_left = task.get("days_left", 7)
        
        if mode == "crisis":
            return f"""{self.name}, 🚨

Besok deadline **{task_name}** ({course})!

Progressnya masih {progress}%. Butuh bantuan gak?

Reply:
• \"60%\" atau \"baru 60%\" → update progress
• \"stuck\" atau \"buntu\" → aku bantu pecah task
• \"done\" atau \"selesai\" → mark selesai 🎉"""
        
        elif mode == "progress_check":
            return f"""Halo {self.name}! 👋

Tadi siang kamu bilang mau ngerjain **{task_name}** ({course}),
sekarang progressnya gimana? Udah berapa %?

(Ps: masih ada waktu {days_left} hari lagi sih, santai aja tapi jangan mager ya 😄)"""
        
        elif mode == "unclaimed":
            return f"""{self.name}, aku notice ada **{task_name}** ({course}) deadline {deadline},
tapi kamu belum bilang mau mulai ngerjain.

Gimana? Mau dikerjain atau memang skip?
Reply \"kerjain\" atau \"skip aja\" ya."""
        
        else:  # gentle nudge
            return f"""Ehh {self.name}, aku liat ada **{task_name}** ({course}) deadline {days_left} hari lagi nih.

Mau mulai dikit-dikit hari ini? Biar besok gak numpuk sama yang lain."""
    
    def _generate_crisis(self, data: Dict) -> str:
        """Generate crisis mode message (H-1/H-0)."""
        task = data.get("task", {})
        hours_left = data.get("hours_left", 24)
        
        task_name = task.get("title", "Tugas")
        course = task.get("course", "")
        progress = task.get("progress", 0)
        
        if hours_left <= 8:  # H-0
            return f"""🚨🚨 {self.name}!!!

**{task_name}** ({course}) deadline HARI INI!
Progress: {progress}%

Sisa waktu cuma ~{hours_left} jam lagi. BISA SELESAI GAK NIH?! 😱

Kalau stuck, bilang SEKARANG biar aku bantu pecah task-nya!"""
        else:  # H-1
            return f"""{self.name}, 🚨

Besok deadline **{task_name}** ({course})!
Progress masih {progress}%.

Butuh bantuan gak? Aku bisa bantu:
• Pecah jadi sub-task
• Estimasi waktu per bagian
• Atau kasih semangat dulu 😄

Reply sekarang ya!"""
    
    def generate_help_response(self, help_type: str, user_ctx: Dict) -> str:
        """Generate response untuk help request."""
        task = user_ctx.get("active_task", {})
        task_name = task.get("name", "tugas ini")
        
        if help_type == "bab_teori":
            return f"""Oke {self.name}, stuck di bab teori ya? 🤔

Coba approach ini:
1. Buat outline dulu (heading per bab)
2. Cari 3 referensi utama
3. Paraphrase, jangan copy-paste

Mau aku bantu cari struktur outline yang cocok?"""
        
        elif help_type == "coding":
            return f"""Coding stuck ya? 😅

Coba:
1. Break down fitur jadi fungsi kecil
2. Test tiap fungsi satu-satu
3. Debug dengan print/console.log

Atau mau aku kasih template struktur kodingannya?"""
        
        elif help_type == "breakdown":
            return f"""Oke {self.name}, aku bantu pecah **{task_name}** jadi sub-task:

📋 Sub-task:
1. Research & outline (30 menit)
2. Draft bab 1-2 (1 jam)
3. Draft bab 3-4 (1 jam)
4. Review & edit (30 menit)

Mau mulai dari yang mana? Reply \"mulai 1\" ya!"""
        
        else:
            return f"""Oke {self.name}, aku ngerti kamu stuck 🙏

Coba ceritain lebih detail: yang bikin buntu itu apa?
• Gak ngerti materinya?
• Gak ada ide?
• Atau males aja? (honest answer gapapa 😄)

Bilang aja ya!"""

# Singleton instance
message_generator = MessageGenerator()

# Convenience function
def generate(trigger_type: str, data: Dict, user_ctx: Dict) -> str:
    return message_generator.generate(trigger_type, data, user_ctx)
