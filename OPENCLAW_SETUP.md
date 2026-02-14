# OpenClaw St4cker Setup Guide

Setup OpenClaw sebagai AI Brain untuk St4cker Reminder Bot.

## 1. Install & Run OpenClaw Skill

```bash
# 1. Install dependencies
pip install -r openclaw_requirements.txt

# 2. Set environment variables
export ST4CKER_API_URL="http://your-vps-ip:3000"
export ST4CKER_API_KEY="your_st4cker_api_key"
export OPENCLAW_API_KEY="your_secret_key_for_st4cker"

# 3. Run server
python openclaw_st4cker_skill.py
```

Server akan jalan di `http://localhost:8000`

---

## 2. Configure St4cker

Edit file `.env` di server St4cker:

```env
# wa-gateway/.env
OPENCLAW_URL=http://your-openclaw-ip:8000
OPENCLAW_API_KEY=your_secret_key_for_st4cker

# reminder-bot/.env  
OPENCLAW_WEBHOOK_URL=http://your-openclaw-ip:8000/webhook
```

---

## 3. Test Integration

### Test Task Reminder Flow
```bash
# 1. Trigger task reminder webhook
curl -X POST http://localhost:8000/webhook/st4cker-task-reminder \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_secret_key" \
  -d '{
    "event": "task_reminder_sent",
    "user_id": "6281311417727",
    "phone": "6281311417727",
    "task_count": 2,
    "tasks": [
      {"number": 1, "title": "Laporan Pendahuluan", "course": "Keamanan Jaringan dan Kriptografi", "days_left": 3},
      {"number": 2, "title": "Tugas Kecil 2", "course": "Komputasi Bergerak", "days_left": 5}
    ],
    "sent_at": "2026-02-14T15:00:00",
    "date": "2026-02-14"
  }'

# 2. Simulate user reply
curl -X POST http://localhost:8000/api/v1/st4cker/task-reply \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_secret_key" \
  -d '{
    "phone": "6281311417727",
    "userId": "6281311417727",
    "message": "iyaa aku otw ngerjain kjk",
    "context": {"event": "task_reminder_reply"}
  }'
```

Expected response:
```json
{
  "reply": "✅ Oke! Fokus ngerjain Laporan Pendahuluan...",
  "done": true,
  "clearContext": true
}
```

---

## 4. Features

### Task Reminder Skill
- ✅ Parse: "kerjain nomor 1", "otw kjk", "fokus laporan"
- ✅ Fuzzy match course names (kjk, komber, ppl, sister)
- ✅ Auto-update task status to "in_progress"
- ✅ Context expires after 30 minutes

### Schedule Reminder Skill
- ✅ Parse: "oke gas", "siap", "otw", "skip", "nanti dulu"
- ✅ Confirm/decline attendance
- ✅ Generate contextual replies

---

## 5. Architecture Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│reminder-bot │────▶│   OpenClaw  │◄────│ wa-gateway  │
│ (jam 15:00) │     │  (AI Brain) │     │(user reply) │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ st4cker-bot │
                    │  (API/DB)   │
                    └─────────────┘
```

---

## 6. Troubleshooting

**OpenClaw tidak terima webhook:**
```bash
# Check connectivity
curl http://your-openclaw-ip:8000/health

# Check logs
python openclaw_st4cker_skill.py 2>&1 | tee openclaw.log
```

**St4cker API error:**
- Pastikan `ST4CKER_API_KEY` sama dengan di st4cker-bot
- Check st4cker health: `curl http://st4cker-ip:3000/health`

**Context hilang:**
- Context hanya bertahan 30 menit setelah reminder
- Normal jika user reply setelah waktu tersebut

---

## 7. Production Deployment

Gunakan systemd atau docker:

```dockerfile
# Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY openclaw_requirements.txt .
RUN pip install -r openclaw_requirements.txt
COPY openclaw_st4cker_skill.py .
CMD ["python", "openclaw_st4cker_skill.py"]
```

```yaml
# docker-compose.yml (tambahkan ke st4cker)
  openclaw:
    build: ./openclaw
    ports:
      - "8000:8000"
    environment:
      - ST4CKER_API_URL=http://st4cker-bot:3000
      - ST4CKER_API_KEY=${AGENT_API_KEY}
      - OPENCLAW_API_KEY=${OPENCLAW_API_KEY}
```
