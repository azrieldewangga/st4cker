# St4cker <-> OpenClaw Integration Guide

This guide explains how to deploy your updated St4cker Bot on a VPS and connect it to OpenClaw (or any Agentic AI).

## 1. VPS Deployment

You can now run St4cker using Docker, which is cleaner and easier to manage on a VPS.

### Prerequisites (on VPS)
- Docker & Docker Compose installed.

### Steps
1.  **Upload Code**: Copy the `telegram-bot` folder (managed in this repo) to your VPS.
2.  **Configure Env**: Create a `.env` file in the same folder as `docker-compose.yml`.
    ```env
    # Add your standard variables
    TELEGRAM_BOT_TOKEN=...
    AGENT_API_KEY=my_secure_secret_key_123   <-- CRITICAL: Set this!
    ```
3.  **Run**:
    ```bash
    docker-compose up -d --build
    ```
    Your St4cker API will be live at `http://YOUR_VPS_IP:3000`.

## 2. Connecting OpenClaw (The "Asisten" Setup)

To make OpenClaw "smart" about your tasks, you need to give it the tool definition.

### Option A: Using the OpenAPI Spec (Standard)
If OpenClaw supports importing OpenAPI/Swagger:
1.  Download `st4cker-openapi.yaml` (created in this session).
2.  Import it into OpenClaw's tool config.
3.  Set the Authentication Header: `x-api-key: my_secure_secret_key_123`.

### Option B: Manual Tool Definition (Copy-Paste)
If you need to paste a JSON schema for the tools, use this:

#### Tool: `get_tasks`
*Description: Get list of pending tasks to remind the user.*
```json
{
  "name": "get_tasks",
  "description": "Fetch list of academic tasks or assignments. Use this to check deadlines for the user.",
  "parameters": {
    "type": "object",
    "properties": {
      "status": { "type": "string", "enum": ["pending", "completed"] },
      "priority": { "type": "string", "enum": ["high", "medium", "low"] }
    }
  }
}
```
*(API Route: `GET /api/v1/tasks`)*

#### Tool: `add_task`
*Description: Add a new task from user instruction.*
```json
{
  "name": "add_task",
  "description": "Create a new assignment or task in the database.",
  "parameters": {
    "type": "object",
    "properties": {
      "title": { "type": "string", "description": "Title of the task" },
      "course": { "type": "string", "description": "Subject or course name" },
      "deadline": { "type": "string", "description": "ISO Date string (YYYY-MM-DDTHH:mm:ss.sssZ)" },
      "note": { "type": "string" }
    },
    "required": ["title", "course", "deadline"]
  }
}
```
*(API Route: `POST /api/v1/tasks`)*

#### Tool: `get_schedules`
*Description: Lihat jadwal kuliah/kelas.*
```json
{
  "name": "get_schedules",
  "description": "Melihat jadwal matkul. Bisa filter berdasarkan hari.",
  "parameters": {
    "type": "object",
    "properties": {
      "day": { "type": "string", "description": "Filter hari (Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu). Kosongkan untuk semua." }
    }
  }
}
```
*(API Route: `GET /api/v1/schedules`)*

#### Tool: `add_schedule`
*Description: Tambah matkul/jadwal kuliah baru.*
```json
{
  "name": "add_schedule",
  "description": "Menambahkan jadwal kuliah baru ke database. Bisa pakai singkatan matkul (komber, kjk, ppl, sister, dll).",
  "parameters": {
    "type": "object",
    "properties": {
      "courseName": { "type": "string", "description": "Nama matkul atau singkatan (contoh: Pemrograman Web, komber, kjk, ppl, sister, pemjar)" },
      "courseCode": { "type": "string", "description": "Kode matkul (opsional, contoh: PWEB-123)" },
      "dayOfWeek": { "type": "string", "description": "Hari (Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu)" },
      "startTime": { "type": "string", "description": "Jam mulai format HH:MM (contoh: 08:00)" },
      "endTime": { "type": "string", "description": "Jam selesai format HH:MM (opsional)" },
      "room": { "type": "string", "description": "Ruangan kelas (opsional)" },
      "lecturer": { "type": "string", "description": "Nama dosen pengampu (opsional)" }
    },
    "required": ["courseName", "dayOfWeek", "startTime"]
  }
}
```
*(API Route: `POST /api/v1/schedules`)*

**Singkatan yang didukung:**
- `komber` / `kb` → Komputasi Bergerak
- `kjk` → Keamanan Jaringan dan Kriptografi  
- `ppl` → Pengembangan Perangkat Lunak
- `sister` → Sistem Terdistribusi
- `pemjar` / `pj` → Pemrograman Jaringan
- `wspk` → Workshop Sistem Pendukung Keputusan
- Tambahkan `prak` di depan untuk praktikum (contoh: `prak komber`)

#### Tool: `update_schedule`
*Description: Update/pindahkan jadwal matkul.*
```json
{
  "name": "update_schedule",
  "description": "Mengubah jadwal kuliah: pindah hari, ganti jam, ganti ruangan, atau ganti dosen.",
  "parameters": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "ID jadwal yang mau diubah (dari get_schedules)" },
      "courseName": { "type": "string", "description": "Nama matkul baru (opsional)" },
      "dayOfWeek": { "type": "string", "description": "Hari baru (Senin, Selasa, dll)" },
      "startTime": { "type": "string", "description": "Jam mulai baru format HH:MM" },
      "endTime": { "type": "string", "description": "Jam selesai baru format HH:MM" },
      "room": { "type": "string", "description": "Ruangan baru" },
      "lecturer": { "type": "string", "description": "Nama dosen baru" },
      "isActive": { "type": "boolean", "description": "Aktifkan/nonaktifkan jadwal" }
    },
    "required": ["id"]
  }
}
```
*(API Route: `PATCH /api/v1/schedules/:id`)*

#### Tool: `delete_schedule`
*Description: Hapus jadwal matkul.*
```json
{
  "name": "delete_schedule",
  "description": "Menghapus jadwal kuliah dari database.",
  "parameters": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "ID jadwal yang mau dihapus" }
    },
    "required": ["id"]
  }
}
```
*(API Route: `DELETE /api/v1/schedules/:id`)*

#### Tool: `get_reminder_status`
*Description: Cek status reminder hari ini.*
```json
{
  "name": "get_reminder_status",
  "description": "Melihat status reminder hari ini - sudah dikirim atau belum, user sudah konfirmasi atau belum, dan informasi matkul hari ini.",
  "parameters": {
    "type": "object",
    "properties": {}
  }
}
```
*(API Route: `GET /api/v1/reminders/today`)*

#### Tool: `get_reminder_history`
*Description: Lihat history reminder.*
```json
{
  "name": "get_reminder_history",
  "description": "Melihat history reminder beberapa hari terakhir (berapa kali reminder dikirim, apakah user konfirmasi, dll).",
  "parameters": {
    "type": "object",
    "properties": {
      "days": { "type": "integer", "description": "Jumlah hari ke belakang (default: 7, max: 30)" }
    }
  }
}
```
*(API Route: `GET /api/v1/reminders/history`)*

#### Tool: `skip_today_reminders`
*Description: Skip/pause reminder hari ini.*
```json
{
  "name": "skip_today_reminders",
  "description": "Menonaktifkan auto-reminder untuk hari ini (misal: cuti, libur, tidak masuk).",
  "parameters": {
    "type": "object",
    "properties": {
      "date": { "type": "string", "description": "Tanggal yang mau di-skip (YYYY-MM-DD). Kosongkan untuk hari ini." },
      "reason": { "type": "string", "description": "Alasan skip (opsional, contoh: 'Cuti', 'Sakit', 'Libur')" }
    }
  }
}
```
*(API Route: `POST /api/v1/reminders/override`)*

#### Tool: `cancel_skip_reminders`
*Description: Batalkan skip reminder.*
```json
{
  "name": "cancel_skip_reminders",
  "description": "Membatalkan override/skip reminder yang aktif.",
  "parameters": {
    "type": "object",
    "properties": {
      "overrideId": { "type": "string", "description": "ID override yang mau dibatalkan (dari get_reminder_status)" }
    }
  }
}
```
*(API Route: `DELETE /api/v1/reminders/overrides/:id`)*

---

## 3. Example Workflow (What to tell OpenClaw)

Once connected, you can give OpenClaw instructions like:

### A. Task Management
> "You are my academic assistant. Every morning at 7 AM, use `get_tasks` to check my pending tasks. If there are tasks due within 2 days, send me a summary on WhatsApp."

### B. Schedule Management
> "Pindahkan jadwal Pemrograman Web dari Senin ke hari Selasa jam 10:00."

> "Tambahkan matkul baru: Kalkulus Lanjut, hari Kamis jam 13:00-15:00, ruang A301, dosen Pak Budi."

> "Ganti ruangan Basis Data dari B201 ke Lab Komputer 3."

> "Hapus jadwal matkul Fisika Dasar."

> "Tampilkan semua jadwal hari Senin."

### C. Reminder Tracking
> "Udah ada reminder belum hari ini?"

> "Aku sudah konfirmasi reminder belum?"

> "Jangan kirim reminder hari ini, aku cuti."

> "Minggu ini aku rajin konfirmasi reminder ga?"

> "Cancel skip reminder, aku jadi masuk hari ini."

This works because OpenClaw now has the **Tools** (`get_tasks`, `get_schedules`, `add_schedule`, `update_schedule`, `delete_schedule`, `get_reminder_status`, `get_reminder_history`, `skip_today_reminders`, `cancel_skip_reminders`) to manage your data and the **medium** (WhatsApp) to talk to you.
