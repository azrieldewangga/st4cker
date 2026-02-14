# St4cker Proactive Bot System - Implementation Plan

## 📋 Overview

**Arsitektur: OpenClaw Fully Decide**

OpenClaw adalah satu-satunya "otak" yang memutuskan. Bot lain (reminder-bot, followup-bot) hanya **trigger** - mereka query DB dan kirim data mentah ke OpenClaw. OpenClaw yang decide:
- Mau kirim pesan atau tidak
- Format & tone pesan seperti apa
- Handle reply dengan conversational flow (bisa tanya balik)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ST4CKER BOT SYSTEM                                 │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐    │
│   │                         OPENCLAW (Brain)                             │    │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │    │
│   │  │   Decide     │  │   Generate   │  │ Conversational│               │    │
│   │  │  Send/Skip?  │  │    Message   │  │    Handler    │               │    │
│   │  └──────────────┘  └──────────────┘  └──────────────┘               │    │
│   │                                                                      │    │
│   │  ┌──────────────────────────────────────────────────────────────┐   │    │
│   │  │              NLU (Natural, gak keyword-based)                 │   │    │
│   │  │  - "macet" → tanya: "semua atau KJK aja?"                     │   │    │
│   │  │  - "sakit" → tanya: "total rest atau bisa sore?"              │   │    │
│   │  │  - "baru 50%" → acknowledge + ask next                        │   │    │
│   │  └──────────────────────────────────────────────────────────────┘   │    │
│   └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│           ┌──────────────────────────┼──────────────────────────┐             │
│           ▼                          ▼                          ▼             │
│   ┌───────────────┐         ┌───────────────┐         ┌───────────────┐      │
│   │ reminder-bot  │         │ followup-bot  │         │  wa-gateway   │      │
│   │   (Trigger)   │         │   (Trigger)   │         │  (Executor)   │      │
│   │               │         │               │         │               │      │
│   │ Query DB      │         │ Query DB      │         │ Kirim WA      │      │
│   │ POST to       │         │ POST to       │         │ sesuai        │      │
│   │ OpenClaw      │         │ OpenClaw      │         │ instruksi     │      │
│   │               │         │               │         │ OpenClaw      │      │
│   └───────────────┘         └───────────────┘         └───────────────┘      │
│                                                                              │
│   Note: reminder-bot & followup-bot TIDAK punya logic decision.             │
│   Mereka cuma: "Hey OpenClaw, jam X, data Y" → OpenClaw decide rest.        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 👤 Persona: Azriel (Zril)

OpenClaw berbicara sebagai **Azriel** - teman kuliah yang:
- **Friendly & santai** - gak formal, kayak chat teman
- **Supportive tapi gak maksa** - ngasih tau, tapi respect keputusan
- **Chatty tapi useful** - ngobrol asyik tapi tetep on point
- **Panggilan**: "Zril" (bukan user/generic)
- **Bisa tanya balik** - gak auto-execute, conversational

### Tone Contoh:
- Pagi: *"Pagi Zril! ☀️"*
- Sore: *"Halo Zril! 👋"*
- Crisis: *"Zril, 🚨"*
- Santai: *"(Ps: masih ada waktu sih, santai aja tapi jangan mager ya 😄)"*
- Tanya balik: *"Ini cuma matkul pertamanya aja atau hari ini full libur?"*

---

## 🤖 Bot 1: reminder-bot (Trigger ONLY)

### Tugas: Cuma Trigger
**NO DECISION. NO MESSAGE GENERATION. NO LOGIC.**

reminder-bot cuma:
1. Cek waktu (jam 05:45, 90 menit, 15 menit, 15:00, 21:00)
2. Query DB (jadwal, tugas, overrides)
3. POST data mentah ke OpenClaw
4. OpenClaw yang decide & kirim instruksi ke wa-gateway

### Schedule Trigger

| Waktu | Trigger Ke | Data yang Dikirim |
|-------|-----------|-------------------|
| 05:45 (kalo matkul jam 8) | OpenClaw | `{type: "schedule", course: "KJK", time: "08:00", room: "...", lecturer: "..."}` |
| 90 menit sebelum matkul | OpenClaw | `{type: "schedule", course: "...", is_first: true/false}` |
| 15 menit sebelum matkul | OpenClaw | `{type: "schedule", course: "...", is_next: true}` |
| 15:00 | OpenClaw | `{type: "task_list", tasks: [...], count: N}` |
| 21:00 | OpenClaw | `{type: "night_preview", tomorrow_schedules: [...], tomorrow_tasks: [...]}` |

### Code Structure (Target)

```python
def check_schedule_reminders():
    """Cuma trigger ke OpenClaw"""
    schedules = query_db_today_schedules()
    
    for sched in schedules:
        if should_trigger(sched):  # Cuma cek waktu
            # Kirim data mentah ke OpenClaw
            requests.post(OPENCLAW_WEBHOOK, json={
                "event": "reminder_trigger",
                "trigger_type": "schedule",
                "trigger_time": "05:45",
                "data": {
                    "course": sched.course_name,
                    "start_time": sched.start_time,
                    "room": sched.room,
                    "lecturer": sched.lecturer,
                    "is_first_class": sched.is_first
                }
            })
            # DONE. OpenClaw yang decide mau kirim apa gak.

def check_task_reminders():
    """Cuma trigger ke OpenClaw"""
    tasks = query_db_pending_tasks()
    
    requests.post(OPENCLAW_WEBHOOK, json={
        "event": "reminder_trigger",
        "trigger_type": "task_list",
        "trigger_time": "15:00",
        "data": {
            "tasks": tasks,
            "count": len(tasks)
        }
    })

def night_preview():
    """Cuma trigger ke OpenClaw"""
    tomorrow = get_tomorrow_schedules_and_tasks()
    
    requests.post(OPENCLAW_WEBHOOK, json={
        "event": "reminder_trigger",
        "trigger_type": "night_preview",
        "trigger_time": "21:00",
        "data": tomorrow
    })
```

### Format Pesan (DI OPENCLAW, BUKAN DI REMINDER-BOT)

OpenClaw generate pesan natural:

**Night Preview (OpenClaw generate):**
```
Halo Zril! 👋

Besok ada 3 matkul ya:

1. **KJK** - jam 08:00 di Lab Jaringan (Pak Budi)
2. **Komber** - jam 10:30 di Ruang 302 (Bu Ani)
3. **PPL** - jam 13:00 di Lab Software (Pak Dodi)

Yang pertama KJK jam 8 pagi, jangan lupa alarm ⏰

Oh iya, ada matkul yang kosong besok? Kalau ada yang kosong,
reply "besok KJK kosong" biar aku gak ngingetin ya.
```

**Schedule 90 Menit (OpenClaw generate):**
```
Pagi Zril! ☀️

Sekitar 1.5 jam lagi ada **KJK** jam 08:00 di Lab Jaringan.
Dosennya Pak Budi ya.

Sarapan dulu biar kuat! Reply "otw" kalo udah berangkat.
```

---

## 🤖 Bot 2: followup-bot (Trigger ONLY)

### Tugas: Cuma Trigger Follow-up
**NO DECISION. OpenClaw yang decide mode & response.**

followup-bot cuma:
1. Jam 20:00: Query tugas deadline H-0 s/d H-3
2. POST ke OpenClaw: "nih datanya"
3. OpenClaw decide: crisis/progress/nudge/unclaimed

### Schedule Trigger

| Waktu | Trigger Ke | Data yang Dikirim |
|-------|-----------|-------------------|
| 20:00 | OpenClaw | `{type: "followup", tasks: [...], mode: "auto"}` |
| H-1 09:00 | OpenClaw | `{type: "crisis_check", task: {...}, hours_left: 24}` |
| H-1 18:00 | OpenClaw | `{type: "crisis_check", task: {...}, hours_left: 14}` |
| H-0 08:00 | OpenClaw | `{type: "crisis_check", task: {...}, hours_left: 8}` |

### Mode (OpenClaw Decide, BUKAN followup-bot)

OpenClaw lihat data, lalu decide:

**Mode Crisis (H-0/H-1 + progress rendah):**
```
Zril, 🚨

Besok deadline **Laporan KJK**! Progressnya masih 40%.
Butuh bantuan gak?

Reply:
• "60%" → update progress
• "stuck" → aku bantu pecah task
• "done" → mark selesai 🎉
```

**Mode Progress Check (in_progress):**
```
Halo Zril! 👋

Tadi siang kamu bilang mau ngerjain **Tugas Komber**,
sekarang progressnya gimana? Udah berapa %?

(Ps: masih ada waktu 2 hari lagi sih, santai aja tapi jangan mager ya 😄)
```

**Mode Unclaimed (pending + H-1):**
```
Zril, aku notice ada **Laporan KJK** deadline besok,
tapi kamu belum bilang mau mulai ngerjain.

Gimana? Mau dikerjain atau memang skip?
Reply "kerjain" atau "skip aja" ya.
```

---

## 🧠 OpenClaw: The Brain (100% Decision)

### Endpoints

#### 1. Reminder Trigger (Dari reminder-bot & followup-bot)
```
POST /webhook/st4cker-reminder-trigger
```

**Body:**
```json
{
  "event": "reminder_trigger",
  "source": "reminder-bot|followup-bot",
  "trigger_type": "schedule|task_list|night_preview|followup|crisis_check",
  "trigger_time": "05:45",
  "user_id": "6281311417727",
  "phone": "6281311417727",
  "data": {
    // Data mentah dari DB
  }
}
```

**OpenClaw Process:**
1. Cek context user (ada skip preference?)
2. Decide: kirim / skip / tunda
3. Generate message (natural, persona Azriel)
4. Instruksi ke wa-gateway

**Response ke Bot:**
```json
{
  "action": "send|skip|delay",
  "message": "Pagi Zril! ☀️...",
  "send_via": "wa-gateway",
  "context_update": {...}
}
```

#### 2. Universal Chat Handler (Semua reply user kesini)
```
POST /api/v1/st4cker/chat
```

**Body:**
```json
{
  "phone": "6281311417727",
  "user_id": "6281311417727",
  "message": "macet parah nih",
  "context": {
    "last_intent": "schedule_reminder",
    "last_course": "KJK",
    "awaiting_clarification": false
  }
}
```

**OpenClaw NLU (Conversational):**

**Case 1: Ambiguous (Ask Clarification)**
```json
{
  "reply": "Waduh Zril, KJK pertama kena macet ya?\n\nTelat berapa lama kira-kira?\n\nKalau cuma telat, aku pause KJK aja. Tapi kalau emang gak jadi kuliah sama sekali, bilang 'skip hari ini' ya.",
  "context_update": {
    "awaiting_clarification": true,
    "clarification_type": "cancel_scope",
    "affected_course": "KJK"
  },
  "done": false
}
```

**Case 2: Clarified Response**
User: *"skip KJK aja, telat 1 jam"*
```json
{
  "reply": "Oke, KJK aku skip 👍\n\nJam 10:30 ada Komber di Ruang 302 tetep jadi kan?",
  "context_update": {
    "skip_preferences": {
      "2026-02-16": {
        "KJK": {"skipped": true, "reason": "macet"},
        "Komber": {"skipped": false}
      }
    },
    "awaiting_clarification": false
  },
  "tools_to_call": ["update_skip_preference"],
  "done": false
}
```

**Case 3: Clear Intent (Direct Action)**
User: *"baru 60% nih"*
```json
{
  "reply": "Oke progress! Dari 40% jadi 60% 🎉\n\nMasih butuh ~2 jam lagi ya? Mau lanjut malam ini?",
  "context_update": {
    "task_progress": {
      "task_id": "xxx",
      "progress": 60
    }
  },
  "tools_to_call": ["update_task_progress"],
  "done": false
}
```

### NLU (Natural Language Understanding)

**HAPUS keyword matching rigid. GANTI dengan intent extraction.**

```python
# ❌ SALAH (Rigid)
if "macet" in message:
    return cancel_all()

# ✅ BENAR (Conversational)
def parse_intent(message: str, context: dict) -> dict:
    """
    Extract intent tapi tetep conversational.
    Kalau ambiguous, return needs_clarification=True
    """
    
    # Detect potential issues
    has_problem = detect_problem_keywords(message)  # macet, sakit, cancel, etc
    
    # Check if user specify scope
    scope = extract_scope(message)  # "KJK aja", "hari ini", "semua"
    
    # Check if user specify time
    time_scope = extract_time_scope(message)  # "sore", "besok", "minggu ini"
    
    if has_problem and not scope and not context.get("awaiting_clarification"):
        return {
            "intent": "potential_cancel",
            "confidence": 0.7,
            "needs_clarification": true,
            "clarification_question": "scope",  # "semua atau yang ini?"
            "extracted": {
                "problem": extract_problem_type(message),  # "macet", "sakit"
                "affected_course": guess_course(message) or context.get("last_course")
            }
        }
    
    if scope:
        return {
            "intent": "cancel",
            "confidence": 0.9,
            "needs_clarification": false,
            "extracted": {
                "scope": scope,  # "KJK only", "today", "all"
                "time": time_scope or "today"
            }
        }
    
    # Progress update
    if extract_percentage(message):
        return {
            "intent": "update_progress",
            "confidence": 0.9,
            "extracted": {
                "progress": extract_percentage(message),
                "task": guess_task(message) or context.get("active_task")
            }
        }
    
    # Stuck/need help
    if detect_stuck_keywords(message):
        return {
            "intent": "need_help",
            "confidence": 0.8,
            "needs_clarification": true,
            "clarification_question": "help_type",  # "bagian mana?"
        }
```

### Context Storage

```python
class UserContext:
    def __init__(self, user_id: str):
        self.user_id = user_id
        
        # Conversational state
        self.awaiting_clarification = False
        self.clarification_type = None  # "scope", "help_type", "confirmation"
        
        # Skip preferences (flexible)
        self.skip_preferences = {}  # {date: {course: {skipped, reason}}}
        
        # Active tasks/schedules
        self.active_task = None
        self.active_schedule = None
        
        # History for continuity
        self.last_intent = None
        self.last_message_time = None
        
    def update_skip(self, date: str, course: str, skipped: bool, reason: str = None):
        if date not in self.skip_preferences:
            self.skip_preferences[date] = {}
        self.skip_preferences[date][course] = {
            "skipped": skipped,
            "reason": reason,
            "updated_at": datetime.now()
        }
    
    def is_skipped(self, date: str, course: str) -> bool:
        return self.skip_preferences.get(date, {}).get(course, {}).get("skipped", False)
```

### Message Generator

```python
def generate_message(intent: dict, context: UserContext, data: dict) -> str:
    """Generate natural message dengan persona Azriel"""
    
    # Time-based greeting
    greeting = get_greeting()  # "Pagi", "Halo", "Ehh"
    
    if intent["type"] == "night_preview":
        schedules = data["tomorrow_schedules"]
        
        lines = [f"{greeting} Zril! 👋", ""]
        lines.append(f"Besok ada {len(schedules)} matkul ya:")
        lines.append("")
        
        for i, sched in enumerate(schedules, 1):
            lines.append(f"{i}. **{sched['course']}** - jam {sched['time']} di {sched['room']} ({sched['lecturer']})")
        
        lines.append("")
        lines.append(f"Yang pertama {schedules[0]['course']} jam {schedules[0]['time']}, jangan lupa alarm ⏰")
        lines.append("")
        lines.append("Oh iya, ada matkul yang kosong besok? Kalau ada yang kosong, reply \"besok [matkul] kosong\" biar aku gak ngingetin ya.")
        
        return "\n".join(lines)
    
    if intent["type"] == "schedule_reminder":
        sched = data["schedule"]
        
        if data["is_first"] and data["minutes_before"] == 90:
            return f"""{greeting} Zril! ☀️

Sekitar 1.5 jam lagi ada **{sched['course']}** jam {sched['time']} di {sched['room']}.
Dosennya {sched['lecturer']} ya.

Sarapan dulu biar kuat! Reply "otw" kalo udah berangkat."""
        
        elif data["minutes_before"] == 15:
            return f"""Ehh Zril, bentar lagi jam {sched['time']} ada **{sched['course']}** di {sched['room']} nih!

Udah di kampus? 👀"""
    
    if intent["type"] == "crisis_mode":
        task = data["task"]
        return f"""Zril, 🚨

Besok deadline **{task['title']}**! Progressnya masih {task['progress']}%.
Butuh bantuan gak?

Reply:
• "60%" → update progress
• "stuck" → aku bantu pecah task
• "done" → mark selesai 🎉"""
```

---

## 🛠️ Tools (OpenClaw → Telegram Bot API)

```python
async def update_skip_preference(user_id: str, date: str, course: str, 
                                  skipped: bool, reason: str = None):
    """Call telegram-bot API"""
    return await st4cker_request("POST", "/schedules/skip", {
        "userId": user_id,
        "date": date,
        "course": course,
        "skipped": skipped,
        "reason": reason
    })

async def update_task_progress(user_id: str, task_id: str, 
                                progress: int, notes: str = None):
    """Call telegram-bot API"""
    return await st4cker_request("POST", "/tasks/progress", {
        "userId": user_id,
        "taskId": task_id,
        "progress": progress,
        "notes": notes
    })

async def confirm_schedule_attendance(user_id: str, schedule_id: str, 
                                       confirmed: bool):
    """Call telegram-bot API"""
    return await st4cker_request("POST", "/schedules/confirm", {
        "userId": user_id,
        "scheduleId": schedule_id,
        "confirmed": confirmed
    })
```

---

## 📁 File Structure

```
📁 reminder-bot/
   ├── heartbeat.py           # Cuma trigger ke OpenClaw
   ├── requirements.txt
   └── Dockerfile

📁 followup-bot/
   ├── heartbeat.py            # Cuma trigger ke OpenClaw
   ├── requirements.txt
   └── Dockerfile

📁 openclaw/
   └── st4cker_skill.py        # SEMUA logic di sini
       ├── Endpoints:
       │   ├── POST /webhook/st4cker-reminder-trigger
       │   └── POST /api/v1/st4cker/chat
       ├── Modules:
       │   ├── nlu.py           # Conversational NLU
       │   ├── message_gen.py   # Natural message generator
       │   ├── context.py       # Context management
       │   └── tools.py         # API calls to telegram-bot
       └── Persona:
           └── azriel.py        # Tone & style

📁 wa-gateway/
   └── index.js                # Executor: kirim WA

📁 telegram-bot/
   └── src/
       └── api_routes.js       # Tambah endpoints
```

---

## 🗺️ Migration Steps

### Phase 1: OpenClaw Brain (Highest Priority)
- [ ] Buat struktur folder openclaw/
- [ ] Implement NLU conversational (hapus keyword rigid)
- [ ] Implement message generator
- [ ] Implement context manager
- [ ] Endpoint `/webhook/st4cker-reminder-trigger`
- [ ] Endpoint `/api/v1/st4cker/chat`

### Phase 2: Refactor reminder-bot
- [ ] Hapus semua logic message formatting
- [ ] Hapus send_whatsapp_message langsung
- [ ] Jadi trigger only: query → POST ke OpenClaw

### Phase 3: Telegram Bot API Extension
- [ ] Endpoint `POST /api/v1/schedules/skip`
- [ ] Endpoint `GET /api/v1/schedules/skips`
- [ ] Endpoint `POST /api/v1/tasks/progress`
- [ ] Database migration untuk skip & progress

### Phase 4: Create followup-bot
- [ ] Folder structure
- [ ] Trigger jam 20:00, H-1, H-0

### Phase 5: Integration & Testing
- [ ] Test conversational flow
- [ ] Test clarification loop
- [ ] Test skip functionality
- [ ] Deploy

---

## ⏰ Timeline

| Phase | Estimasi |
|-------|----------|
| Phase 1: OpenClaw Brain | 8-10 jam |
| Phase 2: Refactor reminder-bot | 3-4 jam |
| Phase 3: Telegram API | 2-3 jam |
| Phase 4: followup-bot | 2-3 jam |
| Phase 5: Testing | 3-4 jam |
| **Total** | **18-24 jam** |

---

## 📝 Key Principles

1. **OpenClaw decides everything** - Bot lain cuma trigger
2. **Conversational, not command-based** - Natural language, gak rigid
3. **Ask for clarification** - Kalau ambiguous, tanya dulu
4. **Context-aware** - Ingat percakapan sebelumnya
5. **Respect user** - Gak maksa, tone supportive

---

*Plan ini overwrite semua plan sebelumnya. Fokus: OpenClaw Fully Decide.*
