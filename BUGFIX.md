# Bug Fix Report - 28 Feb 2026

## 1. Assignment Duplicates Bug ✅ FIXED

### Problem
Ada 20 tugas duplikat "Laporan Resmi - Praktikum Pemrograman Jaringan" di database yang membuat dashboard cluttered.

### Root Cause  
Kemungkinan race condition atau multiple submission saat membuat tugas melalui NLP/telegram bot.

### Fix
Menghapus 19 duplikat, menyisakan 1 tugas asli (ID: assign-1772098049)

```bash
# Sebelum: 20 tasks duplikat
# Sesudah: 1 task
```

### Prevention
Tambahkan unique constraint atau deduplication logic di API endpoint POST /tasks.

---

## 2. Subscription "Mark as Paid" Bug ⚠️ IDENTIFIED

### Problem
Ketika user "Mark as Paid" subscription di desktop app:
1. Transaksi berhasil dibuat ✅
2. Subscription tetap muncul di dashboard notifications ❌

### Root Cause Analysis
Backend (telegram-bot API) tidak memiliki tabel `subscriptions`. Subscription management ada di desktop app (frontend/local state) dan tidak sinkron dengan backend.

### Current Flow
```
Desktop App (Mark as Paid)
├── Create Transaction → POST /transactions ✅
├── Remove from Local State → (kadang gagal) ❌
└── Dashboard Refresh → (tidak trigger) ❌
```

### Fix Plan
**Option A: Backend Subscription Management** (Recommended)
1. Buat tabel `subscriptions` di database
2. Tambahkan endpoint:
   - `GET /subscriptions` - List active subscriptions
   - `POST /subscriptions` - Create new subscription
   - `PATCH /subscriptions/:id/paid` - Mark as paid
   - `DELETE /subscriptions/:id` - Cancel subscription
3. Update desktop app untuk pakai API subscription

**Option B: Quick Frontend Fix**
1. Pastikan state update setelah mark as paid
2. Force refresh dashboard notifications
3. Tambahkan localStorage sync

### Status
Perlu diskusi: Apakah subscription harus di-backend atau tetap frontend-only?

---

## 3. OpenClaw Skill St4cker Update ✅ COMPLETED

### Changes
1. **SKILL.md** - Tambah instruksi penggunaan yang jelas
2. **tools.json** - Update 19 tools dengan API key yang benar
3. **New tools added:**
   - `st4cker_get_balance` - Cek saldo
   - `st4cker_get_summary` - Ringkasan data
   - `st4cker_get_schedules` - Jadwal kuliah
   - `st4cker_get_*_by_id` - Get item by ID

### Result
OpenClaw sekarang bisa:
- Jawab "saldo berapa" dengan balance user
- List tugas tanpa false positive (tidak buat task saat chatting parfum)
- Akses semua fitur St4cker via natural language

---

## Action Items

- [ ] Implement subscription backend (optional)
- [ ] Add duplicate prevention in POST /tasks
- [ ] Test desktop app subscription flow
- [ ] Deploy updated OpenClaw skill
