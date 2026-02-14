# OpenClaw St4cker Skills

Skill untuk OpenClaw agar bisa handle task dan schedule reminder dari St4cker.

---

## TASK REMINDER SKILL

### 1. Webhook: Task Reminder Sent
```
POST /webhook/st4cker-task-reminder
```
Dipanggil oleh reminder-bot saat reminder tugas dikirim (jam 15:00).

**Request Body:**
```json
{
  "event": "task_reminder_sent",
  "user_id": "6281311417727",
  "phone": "6281311417727",
  "task_count": 3,
  "tasks": [
    {
      "number": 1,
      "id": "uuid-task-1",
      "title": "Laporan Pendahuluan",
      "course": "Keamanan Jaringan dan Kriptografi",
      "type": "Laporan Pendahuluan",
      "deadline": "2026-02-17",
      "note": "Bab 1-3",
      "days_left": 3,
      "urgency": "🟡 3 hari lagi"
    }
  ],
  "sent_at": "2026-02-14T15:00:00",
  "date": "2026-02-14"
}
```

---

### 2. API: Task Reply Handler
```
POST /api/v1/st4cker/task-reply
```
Dipanggil oleh wa-gateway saat user reply dalam window 30 menit.

**Request Body:**
```json
{
  "phone": "6281311417727",
  "userId": "6281311417727",
  "message": "iyaa aku otw ngerjain kjk",
  "context": {
    "event": "task_reminder_reply",
    "reminderSentAt": "2026-02-14T15:00:00",
    "tasks": [...],
    "taskCount": 3
  }
}
```

**Expected Response:**
```json
{
  "reply": "✅ Oke! Fokus ngerjain Laporan Pendahuluan (KJK) ya! Deadline masih 3 hari, semangat! 💪",
  "done": true,
  "clearContext": false
}
```

---

## SCHEDULE REMINDER SKILL

### 1. Webhook: Schedule Reminder Sent
```
POST /webhook/st4cker-schedule-reminder
```
Dipanggil oleh reminder-bot saat reminder matkul dikirim.

**Request Body:**
```json
{
  "event": "schedule_reminder_sent",
  "user_id": "6281311417727",
  "phone": "6281311417727",
  "schedule": {
    "id": "uuid-schedule-1",
    "course_name": "Keamanan Jaringan dan Kriptografi",
    "start_time": "08:00",
    "room": "Lab Jaringan",
    "lecturer": "Pak Budi",
    "is_first_class": true
  },
  "reminder_type": "first_90min",
  "message": "⏰ PENGINGAT...",
  "sent_at": "2026-02-14T06:30:00",
  "date": "2026-02-14"
}
```

**Reminder Types:**
- `first_545am` - Reminder jam 5:45 untuk matkul jam 8
- `first_90min` - Reminder 90 menit sebelum matkul pertama
- `15min` - Reminder 15 menit sebelum matkul berikutnya

---

### 2. API: Schedule Reply Handler
```
POST /api/v1/st4cker/schedule-reply
```
Dipanggil oleh wa-gateway saat user reply dalam window 30 menit.

**Request Body:**
```json
{
  "phone": "6281311417727",
  "userId": "6281311417727",
  "message": "oke gas otw",
  "context": {
    "event": "schedule_reminder_reply",
    "reminderSentAt": "2026-02-14T06:30:00",
    "reminderType": "first_90min"
  }
}
```

**Expected Response:**
```json
{
  "reply": "✅ Oke! Siap berangkat. Nanti aku ingetin lagi 15 menit sebelum matkul berikutnya ya!",
  "confirmed": true,
  "done": true
}
```

---

## TOOLS (Internal OpenClaw → St4cker API)

### Tool: update_task_status
```json
{
  "name": "update_task_status",
  "description": "Update status tugas. Bisa cari by nama tugas, matkul, atau nomor.",
  "parameters": {
    "type": "object",
    "properties": {
      "userId": {"type": "string"},
      "searchQuery": {"type": "string", "description": "'kjk', 'laporan', 'kjk laporan', 'nomor 1'"},
      "newStatus": {"type": "string", "enum": ["pending", "in_progress", "completed", "cancelled"]},
      "replyMessage": {"type": "string"}
    },
    "required": ["userId", "searchQuery", "newStatus"]
  }
}
```

**API Call:**
```
POST http://telegram-bot:3001/api/v1/tasks/update-status
X-API-Key: {AGENT_API_KEY}
```

---

### Tool: get_last_task_reminder
```json
{
  "name": "get_last_task_reminder",
  "description": "Ambil context reminder tugas terakhir",
  "parameters": {
    "type": "object",
    "properties": {
      "userId": {"type": "string"}
    },
    "required": ["userId"]
  }
}
```

**API Call:**
```
GET http://telegram-bot:3001/api/v1/tasks/last-reminder/{userId}
X-API-Key: {AGENT_API_KEY}
```

---

### Tool: confirm_schedule_attendance
```json
{
  "name": "confirm_schedule_attendance",
  "description": "Konfirmasi user akan hadir ke matkul (update state untuk reminder berikutnya)",
  "parameters": {
    "type": "object",
    "properties": {
      "userId": {"type": "string"},
      "confirmed": {"type": "boolean"},
      "message": {"type": "string", "description": "Original user message"}
    },
    "required": ["userId", "confirmed"]
  }
}
```

**API Call:**
```
POST http://telegram-bot:3001/api/v1/reminders/confirm
X-API-Key: {AGENT_API_KEY}
```

---

## CONTOH FLOW

### Task Flow
```
[15:00] Bot: 📋 REMINDER TUGAS
        1. KJK - Laporan (3 hari)
        2. Komber - Tugas (5 hari)

[15:05] User: "iyaa aku otw ngerjain kjk"

[OpenClaw Logic]
1. Parse: "otw ngerjain" + "kjk"
2. Find: Task #1 (Laporan KJK)
3. Call: update_task_status → in_progress
4. Reply: "✅ Oke! Fokus ngerjain Laporan KJK! 💪"
```

### Schedule Flow
```
[06:30] Bot: ⏰ PENGINGAT: KJK jam 08:00
        Jangan lupa berangkat 1.5 jam lebih awal!
        Reply 'ok' atau 'gas' kalau otw.

[06:35] User: "oke gas nih otw"

[OpenClaw Logic]
1. Parse: "oke" + "gas" + "otw" = confirmed
2. Call: confirm_schedule_attendance → true
3. Reply: "✅ Siap berangkat! Nanti kuingetin 15 menit sebelum matkul berikutnya"
```

### Schedule Decline/Snooze
```
[06:30] Bot: ⏰ PENGINGAT: KJK jam 08:00

[06:35] User: "skip dulu, belum bangun"

[OpenClaw Logic]
1. Parse: "skip" = decline
2. Call: confirm_schedule_attendance → false
3. Reply: "👍 Oke, ditunda dulu. Bangun dulu ya, nanti kuingetin lagi!"
```

---

## ENVIRONMENT VARIABLES

**wa-gateway:**
```env
OPENCLAW_URL=http://openclaw:8000
OPENCLAW_API_KEY=your_openclaw_api_key
```

**reminder-bot:**
```env
OPENCLAW_WEBHOOK_URL=http://openclaw:8000/webhook
```
