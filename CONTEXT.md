# St4cker Development Context

## 🎯 Current Mission: OpenClaw AI Refactor
Transform OpenClaw dari regex-based bot jadi truly AI dengan context awareness dan personality kimi.

---

## ✅ COMPLETED

### 1. Sync System (DONE)
- **Files:** `src/hooks/useSync.ts`, `src/components/sync/*`, `src/store/slices/*`
- **Features:**
  - Auto-polling setiap 5 menit
  - Online/offline detection dengan toast
  - Manual sync button di TopBar
  - Cross-tab sync via BroadcastChannel
  - Project, Transaction, Assignment sync dengan duplicate detection

### 2. API Key Fix (DONE)
- **Files:** `openclaw/tools.py`
- **Changes:**
  - Debug logging untuk trace auth
  - Header `x-api-key` lowercase
  - Response status code logging

### 3. Basic OpenClaw CRUD (DONE - but needs refactor)
- **Files:** `openclaw/st4cker_skill.py`, `openclaw/nlu.py`
- **Current:** Regex-based intent matching (terlalu kaku)
- **Status:** Fungsional tapi belum "AI feel"

---

## 🔄 IN PROGRESS / TODO

### 1. LLM-Based NLU (HIGH PRIORITY)
**Goal:** Parse intent pakai LLM, bukan regex

**Current Problem:**
```python
# SEKARANG (kaku):
if "tambah tugas" in msg.lower():  # regex matching

# TARGET (AI):
intent = await llm_parse(message, context)  # natural understanding
```

**Files to Modify:**
- `openclaw/nlu.py` → Refactor total jadi LLM-based
- `openclaw/st4cker_skill.py` → Simplify handlers

**Key Requirements:**
- Parse field extraction: matkul, deadline, tipe, amount, dll
- Handle various formats: "tugas KJK besok", "besok ada tugas KJK", "KJK tugasnya besok ya"
- Return structured: `{"intent": "create_task", "fields": {...}}`

---

### 2. Context Memory System (HIGH PRIORITY)
**Goal:** OpenClaw ingat history user

**Features:**
- Track transaksi history (buat detect pattern)
- Track task creation pattern
- Track project progress history
- Simpan di memory/Redis/file

**Pattern Detection:**
```python
# Detect repetitive transaction
if user.create_transaction(category="makan", title="nasi ayam", count=5, days_span=5):
    response = "Btw zril, kamu makan nasi ayam terus nih 5 hari berturut-turut, ga bosen? 😄"
```

**Files:**
- `openclaw/context.py` → Extend dengan history tracking
- `openclaw/st4cker_skill.py` → Integrate pattern detection

---

### 3. Personality Engine (MEDIUM PRIORITY)
**Goal:** Respons kimi yang natural, non-template

**Current (kaku):**
```python
reply = f"✅ Tugas tercatat!\n📋 {title}\n📚 {course}"
```

**Target (AI):**
```python
# LLM generates based on context
reply = await generate_personality_response(
    context="task_created",
    data={"title": title, "course": course, "deadline": deadline},
    user_history=user_ctx.get("recent_tasks", []),
    tone="friendly, supportive, casual"
)
# Output: "Oke zril! Tugas KJK-nya ku catet ya. Besok deadline nih, semangat! 💪"
```

**Files:**
- `openclaw/personality.py` atau extend `message_gen.py`

---

### 4. Smart Clarification (MEDIUM PRIORITY)
**Goal:** Tanya hanya field yang kurang, natural

**Flow:**
```
User: "tambah tugas KJK"
AI: "Oke zril, tugas KJK. Deadline kapan nih?"

User: "besok, tipe LP"
AI: "Oke, Laporan Pendahuluan KJK besok. Done!"

User: "tambah tugas PPL 2026-03-01 Laporan Resmi"
AI: "Catet! LR PPL deadline 1 Maret ya zril! 📋"
```

**Key:** AI yang nentuin apa yang kurang, bukan hardcoded logic.

---

## 📁 FILES STRUCTURE

### Backend API (telegram-bot)
```
telegram-bot/src/
├── api_routes.js         # API endpoints (sudah lengkap)
├── commands/             # Telegram bot commands
├── services/             # DB services
└── nlp/                  # NLP untuk Telegram (terpisah dari OpenClaw)
```

### OpenClaw (AI Brain)
```
openclaw/
├── st4cker_skill.py      # MAIN FILE - Endpoint handlers
├── nlu.py                # PARSER - Intent extraction (NEEDS REFACTOR)
├── tools.py              # API client ke telegram-bot
├── context.py            # Context storage
├── message_gen.py        # Message generator (template-based, NEEDS AI)
└── personality.py        # Could be merged/extended
```

### Desktop App
```
src/
├── store/slices/         # Redux-style slices
├── hooks/useSync.ts      # Sync system
└── components/sync/      # UI components
```

---

## 🔧 TECHNICAL NOTES

### API Endpoints (Telegram Bot)
- `GET  /api/v1/tasks` - List tasks
- `POST /api/v1/tasks` - Create task
- `PATCH /api/v1/tasks/:id` - Update task
- `GET  /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `POST /api/v1/projects/:id/logs` - Log progress
- `GET  /api/v1/transactions` - List transactions
- `POST /api/v1/transactions` - Create transaction

### API Key
- `AGENT_API_KEY=st4cker-agent-secret` (telegram-bot)
- `ST4CKER_API_KEY=st4cker-agent-secret` (OpenClaw .env)
- Header: `x-api-key: st4cker-agent-secret`

### OpenClaw Endpoints
- `POST /api/v1/st4cker/chat` - Universal chat handler
- `POST /webhook/st4cker-reminder-trigger` - Reminder webhook

---

## 🎨 PERSONA KIMI

### Character
- Nama: kimi (bukan Azriel, Azriel adalah user)
- Panggilan user: "zril"
- Tone: Friendly, supportive, casual, anak kuliah
- Emoji: ✌🏻, 💪, 😄, 👍
- Bahasa: Gaul tapi sopan, mixed Indonesia-English

### Sample Responses
```
User: "list tugas"
kimi: "zril, ada 3 tugas nih ✌🏻
1. ⬜ LP KJK - besok
2. ⬜ Tugas PPL - 3 hari lagi
3. ⚠️ LS Sister - besok

Mau mulai yang mana?"

User: "beli nasi ayam 15rb"
kimi: "Catet! 💸 Nasi ayam Rp15.000
...
Btw zril, kamu udah 5 hari berturut-turut makan nasi ayam nih, ga bosen? 😄"
```

---

## 🚀 NEXT STEPS (Prioritas)

1. **Refactor nlu.py** → LLM-based parsing
2. **Extend context.py** → Add history tracking
3. **Create pattern detector** → Repetitive transaction detection
4. **Refactor message_gen.py** → AI-based response (not template)
5. **Test end-to-end** → Natural conversation flow

---

## 📝 GIT STATUS
```bash
# Commit terakhir
git log --oneline -3

# File yang belum di-push (kalau ada)
git status

# Push kalau ada perubahan
git add -A && git commit -m "..." && git push origin main
```

---

## 🔗 USEFUL COMMANDS

### Check OpenClaw running
```bash
curl http://103.127.134.173:8001/
```

### Test API
```bash
curl -H "x-api-key: st4cker-agent-secret" \
  http://103.127.134.173:3000/api/v1/tasks
```

### Deploy OpenClaw
```bash
ssh azriel@103.127.134.173
cd ~/st4cker
git pull
# Restart OpenClaw (docker atau manual)
```

---

Last updated: 2026-02-26
