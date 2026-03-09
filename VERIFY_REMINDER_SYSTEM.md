# 🔍 Verifikasi Sistem Reminder - Pre-Monday Check

## ⚠️ Komponen yang Harus Jalan

### 1. SmartReminder Subagent (Port 5001)
```bash
curl -s http://localhost:5001/api/v1/schedules/today | python3 -m json.tool
```
✅ **Harus response:** JSON dengan jadwal Senin

### 2. OpenClaw St4cker Skill
```bash
# Cek apakah OpenClaw berjalan (port tergantung konfigurasi)
curl -s http://localhost:8000/health || curl -s http://localhost:8080/health
```

### 3. St4cker Backend API
```bash
curl -s http://103.127.134.173:3000/api/v1/summary \
  -H "x-api-key: ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62"
```
✅ **Harus response:** HTTP 200 dengan data summary

### 4. Reminder Scheduler Loop
Cek log untuk memastikan scheduler running:
```bash
tail -f ~/.openclaw/workspace/SmartReminder/subagent.log
```

---

## 🧪 Test Manual Sebelum Senin

### Test A: Simulasi Senin 05:45
```bash
# Set system time test (opsional - jangan di production)
# Atau tunggu sampai 05:45 untuk real test

# Check reminder calculation
curl -s http://localhost:5001/api/v1/reminders/next
```

### Test B: Kirim Test Message via Telegram Bot
```
/start
```
✅ Bot harus reply

### Test C: Check Schedule Data
```bash
# Pastikan data jadwal ada di SmartReminder
cat ~/.openclaw/workspace/SmartReminder/ramadhan_schedule.json | head -50
```

---

## 🔥 Fallback Plan (Kalau Sistem Gagal)

### Otomatis Fallback:
1. **SmartReminder subagent down** → OpenClaw akan error di log, tapi app tetap jalan
2. **OpenClaw down** → Telegram bot tetap bisa akses data langsung dari St4cker API
3. **St4cker backend down** → Data lokal di SQLite masih tersedia di desktop app

### Manual Fallback (User bisa lakukan):
1. Buka desktop app St4cker → Tab Schedule
2. Lihat jadwal manual di sana
3. Atur alarm manual di HP

---

## 📊 Monitoring Checklist (Minggu Malam)

Sebelum tidur Minggu malam, cek:

- [ ] SmartReminder subagent running: `curl http://localhost:5001/health`
- [ ] Data jadwal Senin tersedia: `curl http://localhost:5001/api/v1/schedules/today`
- [ ] OpenClaw skill aktif (check log)
- [ ] Telegram bot responding: kirim `/start`
- [ ] St4cker backend online: `curl http://103.127.134.173:3000/api/health`

---

## 🚨 Quick Fix Commands

### Restart SmartReminder:
```bash
cd ~/.openclaw/workspace/SmartReminder
./start-subagent.sh
```

### Restart OpenClaw:
```bash
# Sesuai cara start OpenClaw di sistem Anda
# Biasanya: python3 st4cker_skill.py atau docker
```

### Check Log Real-time (Senin pagi 05:40):
```bash
tail -f ~/.openclaw/workspace/SmartReminder/subagent.log &
tail -f ~/projects/st4cker/openclaw/openclaw.log 2>/dev/null || echo "OpenClaw log not found"
```

---

## ⏰ Timeline Besok Pagi

| Waktu | Event | Expected |
|-------|-------|----------|
| 04:00 | Daily Reset | Reset attendance, clear sent reminders |
| 05:45 | **Reminder 1** | Komputasi Bergerak (first class < 9:00) |
| 07:20 | - | No reminder (sesuai logic) |
| 08:35 | **Reminder 2** | Jika user confirmed 05:45 |
| 09:00 | **Reminder 3** | Praktikum PJ (90 min before) |
| 10:15 | **Reminder 4** | Jika user confirmed 09:00 |

---

## 🔧 Jika Besok Tidak Muncul Reminder

### Langkah 1: Cek Status (05:50)
```bash
curl -s http://localhost:5001/api/v1/schedules/today | grep -o '"day_name":"[^"]*"'
```

### Langkah 2: Cek Apakah Sudah Sent
```bash
cat ~/.openclaw/workspace/SmartReminder/sent_reminders_$(date +%Y-%m-%d).json 2>/dev/null || echo "No sent reminders yet"
```

### Langkah 3: Force Send Test
```bash
curl -X POST http://localhost:5001/api/v1/test-reminder \
  -H "Content-Type: application/json" \
  -d '{"course": "Test", "time": "08:50"}'
```

### Langkah 4: Check OpenClaw Integration
```bash
# Cek apakah OpenClaw menerima data dari SmartReminder
curl -s http://localhost:5001/api/v1/reminders/next
```

