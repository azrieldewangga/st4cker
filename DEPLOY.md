# 🚀 Deployment Guide - St4cker Proactive Bot System

## 📋 Pre-Deployment Checklist

### 1. Environment Variables (Pastikan semua terisi di `.env`)

```bash
# Database Configuration
POSTGRES_USER=st4cker_admin
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD_HERE        # ⭐ Ganti!
POSTGRES_DB=st4cker_db

# API Keys
ST4CKER_API_KEY=your_api_key_here                   # ⭐ Ganti!
OPENCLAW_API_KEY=your_openclaw_key_here             # ⭐ Ganti!

# WhatsApp chat sekarang pakai bawaan OpenClaw (tanpa wa-gateway terpisah)
# Tidak perlu TARGET_PHONE untuk service wa-gateway.
```

### 2. Validasi `.env` tidak di-push ke Git

```bash
# Pastikan .env ada di .gitignore
cat .gitignore | grep "\.env"

# Harus muncul: .env
```

### 3. Pastikan Port 3000 dan 8000 tidak terpakai

```bash
# Cek port yang terpakai
netstat -tlnp | grep -E ':(3000|8000)'

# Kalau ada yang terpakai, kill dulu:
# sudo kill -9 <PID>
```

---

## 🚀 Deployment Steps

### Step 1: Stop Services Lama (kalau ada)

```bash
docker compose down
```

### Step 2: Clean Build (Fresh Start)

```bash
# Hapus volume lama (WARNING: akan hapus data persistent)
docker volume rm st4cker_postgres_data st4cker_reminder_data st4cker_followup_data 2>/dev/null || true

# Clean build semua services
docker compose build --no-cache
```

### Step 3: Start Services

```bash
# Start semua services
docker compose up -d

# Atau start satu per satu untuk debug:
docker compose up -d postgres
docker compose up -d st4cker-bot
docker compose up -d openclaw
docker compose up -d reminder-bot
docker compose up -d followup-bot
```

### Step 4: Verify Services Health

```bash
# Check status semua container
docker compose ps

# Check logs masing-masing service
docker logs openclaw -f
docker logs reminder-bot -f
docker logs followup-bot -f
```

### Step 5: Test OpenClaw API

```bash
# Health check
curl http://localhost:8000/health

# Expected response:
# {"status": "ok", "service": "openclaw-brain", "version": "2.0.0", ...}
```

### Step 6: Setup WhatsApp di OpenClaw (Native)

```bash
# Validasi OpenClaw sudah menerima chat WhatsApp native
docker logs openclaw -f
```

### Step 7: Test End-to-End

```bash
# Manual trigger test (kalau perlu)
curl -X POST http://localhost:8000/webhook/st4cker-reminder-trigger \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_openclaw_key" \
  -d '{
    "event": "reminder_trigger",
    "source": "test",
    "trigger_type": "task_list",
    "trigger_time": "15:00",
    "user_id": "6281311417727",
    "phone": "6281311417727",
    "data": {
      "tasks": [],
      "count": 0
    }
  }'
```

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      DOCKER NETWORK                          │
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   postgres  │◄───│  st4cker-bot│◄───│   openclaw  │     │
│  │   (5432)    │    │   (3000)    │    │   (8000)    │     │
│  └─────────────┘    └──────┬──────┘    └──────┬──────┘     │
│                            │                    │            │
│                            │            ┌───────┴──────┐     │
│                            │            │              │     │
│                     ┌─────────────┐    ┌─────────────┐│     │
│                     │ reminder-bot│    │followup-bot ││     │
│                     │  (trigger)  │    │  (trigger)  ││     │
│                     └─────────────┘    └─────────────┘│     │
│                                                        │     │
│               WhatsApp chat handled natively by OpenClaw     │
│                                                        │     │
└────────────────────────────────────────────────────────┴─────┘
```

---

## 🔧 Troubleshooting

### Issue: OpenClaw gak bisa start

```bash
# Cek error
docker logs openclaw

# Pastikan env variables ter-set
docker exec openclaw env | grep API_KEY
```

### Issue: reminder-bot/followup-bot exit

```bash
# Cek error
docker logs reminder-bot

# Pastikan DB_PASSWORD ter-set
docker exec reminder-bot env | grep DB_PASSWORD
```

### Issue: Chat WhatsApp tidak masuk ke OpenClaw

```bash
# Cek log OpenClaw
docker logs openclaw -f

# Restart OpenClaw
docker compose restart openclaw
```

### Issue: Database connection failed

```bash
# Cek postgres health
docker compose ps postgres

# Cek logs
docker logs postgres

# Pastikan password benar
docker exec -it postgres psql -U st4cker_admin -d st4cker_db -c "\dt"
```

---

## 📅 Expected Behavior

| Waktu | Trigger | Aksi |
|-------|---------|------|
| 05:45 | reminder-bot | Kalau matkul jam 8, trigger OpenClaw |
| 90 min sebelum matkul | reminder-bot | Trigger OpenClaw |
| 15 min sebelum matkul | reminder-bot | Trigger OpenClaw |
| 15:00 | reminder-bot | Task list reminder |
| 21:00 | reminder-bot | Night preview jadwal besok |
| 20:00 | followup-bot | Follow-up tugas |
| H-1 09:00 | followup-bot | Crisis check |
| H-1 18:00 | followup-bot | Crisis check |
| H-0 08:00 | followup-bot | Crisis check |
| H-0 14:00 | followup-bot | Crisis check |

---

## 🔐 Security Notes

- ✅ No hardcoded credentials
- ✅ All secrets in `.env` (jangan di-push!)
- ✅ Internal services only accessible via Docker network
- ✅ OpenClaw protected with API key
- ✅ Validation on startup (exit kalau env gak lengkap)

---

## 🎉 Success Indicators

Kalau deploy berhasil:

1. ✅ `docker compose ps` → semua status `healthy` atau `up`
2. ✅ `curl localhost:8000/health` → return JSON
3. ✅ WhatsApp ter-connect (cek log OpenClaw native chat channel)
4. ✅ Pesan reminder masuk ke WhatsApp sesuai jadwal

---

Siap deploy Kim! 🚀
