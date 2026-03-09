# SmartReminder Subagent Integration Guide

## 🎯 Arsitektur Baru (Fix Semua Masalah!)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ARSITEKTUR BARU                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   OPENCLAW (Main Brain)                                                     │
│   ├─ Internal Timer Loop (asyncio) - Check every 60 seconds                │
│   ├─ AI NLU (attendance_nlu.py) - Natural conversation                     │
│   └─ Message Sender - Full context & dynamic messages                      │
│        │                                                                    │
│        │ HTTP API (Port 5001)                                              │
│        ▼                                                                    │
│   SMARTREMINDER SUBAGENT (Passive)                                          │
│   ├─ Database jadwal                                                       │
│   ├─ Hitung waktu reminder (90min/15min/05:45)                            │
│   └─ API: /api/v1/schedules/today, /api/v1/reminders/next                  │
│                                                                             │
│   ❌ NO CRON JOB!                                                           │
│   ❌ SmartReminder tidak kirim pesan langsung                               │
│   ✅ OpenClaw punya full konteks                                            │
│   ✅ AI-based intent detection (bukan regex)                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## ✅ Perbaikan dari Masalah Sebelumnya

| Masalah | Sebelumnya | Sekarang |
|---------|-----------|----------|
| **Cron tidak reliable** | Pakai cron job eksternal | ✅ Timer loop internal asyncio |
| **SmartReminder standalone** | Kirim pesan sendiri via nohup-reminder.sh | ✅ Passive API, OpenClaw yang kirim |
| **Regex intent detection** | Keyword matching sederhana | ✅ AI NLU dengan confidence scoring |
| **OpenClaw tidak tahu konteks** | Bypass OpenClaw | ✅ OpenClaw punya full history |
| **Pesan statis** | Template fixed | ✅ Pesan dinamis dengan konteks lengkap |
| **Bug jam 8:40** | Logic cutoff salah | ✅ Fixed: < 9:00 → 05:45 reminder |

## 🚀 Cara Menjalankan

### 1. Start SmartReminder Subagent Server

```bash
cd ~/.openclaw/workspace/SmartReminder
./start-subagent.sh
```

Server akan jalan di port 5001 dengan API:
- `GET /api/v1/schedules/today` - Jadwal lengkap hari ini
- `GET /api/v1/reminders/next` - Cek reminder yang due now
- `POST /api/v1/attendance` - Update status kehadiran

### 2. Integrasi dengan OpenClaw

Copy file-file ini ke folder OpenClaw:
```
openclaw/
├── smart_reminder_subagent.py    # API client
├── reminder_scheduler.py         # Timer loop internal
├── reminder_integration.py       # Main interface
└── attendance_nlu.py             # AI NLU (sudah ada)
```

Modifikasi main OpenClaw:

```python
from reminder_integration import reminder_system, start_reminder_system

# On startup
async def on_startup():
    await start_reminder_system()  # Start timer loop

# In message processing loop
async def process_message(user_msg, context):
    # Check if this is reminder reply
    if reminder_system.is_attendance_related(user_msg):
        result = await reminder_system.handle_user_reply(user_msg, context)
        return result['response']  # AI-generated response
    
    # Normal processing...

# Background task to send reminders
async def reminder_sender_loop():
    while True:
        messages = reminder_system.get_pending_messages()
        for msg in messages:
            await send_whatsapp(msg['message'])
        await asyncio.sleep(5)
```

## 🧠 AI Intent Detection

Sistem mengerti bahasa natural:

| User Message | Intent | Confidence |
|-------------|--------|------------|
| "iya gas" | confirmed | 0.9 |
| "5 menit lg berangkat" | confirmed + delay 5min | 0.85 |
| "otw nih" | confirmed | 0.8 |
| "skip dulu sakit" | declined + reason: sick | 0.9 |
| "gak jadi, macet parah" | declined + reason: traffic | 0.85 |
| "pindah besok aja" | rescheduled | 0.8 |

## 📊 Logic Waktu Reminder

```python
# Jam 4:00 AM - Daily reset
# Check every 60 seconds - No cron!

# Logic per kelas:
if is_first_class and start_hour < 9:
    reminder_time = "05:45"  # Fixed for early class
elif attendance == "confirmed":
    reminder_time = start_time - 15 minutes
else:  # unknown or declined
    reminder_time = start_time - 90 minutes
```

## 🔍 Troubleshooting

### SmartReminder subagent tidak bisa di-start
```bash
cd ~/.openclaw/workspace/SmartReminder
source venv/bin/activate
pip install -r requirements-subagent.txt
python3 subagent_server.py
```

### Port 5001 sudah digunakan
```bash
# Cek apa yang pakai port 5001
lsof -i :5001

# Kill process
kill -9 <PID>
```

### OpenClaw tidak deteksi reminder
1. Cek SmartReminder jalan: `curl http://localhost:5001/health`
2. Cek OpenClaw timer loop jalan
3. Cek logs: `tail -f ~/.openclaw/workspace/SmartReminder/subagent.log`

### User reply tidak terdeteksi
Pastikan `is_attendance_related()` dipanggil dengan context yang benar:
```python
context = {'awaiting_reply': True}  # Set saat kirim reminder
```

## 📁 File Structure

```
~/.openclaw/workspace/SmartReminder/
├── subagent_server.py           # API server (Port 5001)
├── requirements-subagent.txt    # Dependencies
├── start-subagent.sh           # Startup script
├── sent_reminders_*.json       # Tracking (auto-generated)
└── attendance_state.json       # State (auto-generated)

~/projects/st4cker/openclaw/
├── smart_reminder_subagent.py   # API client
├── reminder_scheduler.py        # Timer loop
├── reminder_integration.py      # Main interface
├── setup_smartreminder_integration.sh
└── OPENCLAW_INTEGRATION_EXAMPLE.py
```

## 🎉 Keuntungan Arsitektur Baru

1. **No Cron Job** - Timer loop internal lebih reliable
2. **Full AI** - Natural conversation, bukan command bot
3. **OpenClaw Control** - Main brain punya konteks lengkap
4. **Modular** - SmartReminder bisa di-restart tanpa ganggu OpenClaw
5. **Debuggable** - Logs terpisah, mudah trace masalah
