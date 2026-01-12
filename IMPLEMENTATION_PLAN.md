# st4cker NLP Implementation Plan v1.9.0

**Version:** 1.9.0  
**Date:** January 12, 2026  
**Status:** Migration Phase

---

## 📋 Overview

Integrasi Natural Language Processing (NLP) menggunakan **NLP.js** (offline) ke bot Telegram st4cker. User bisa mengirim pesan natural language dan bot akan mengenali intent serta entity secara otomatis.

> [!IMPORTANT]
> **Migrasi dari Wit.ai ke NLP.js**
> Wit.ai mengalami bug intent classification (issue #2822). Solusi: migrasi ke NLP.js yang berjalan offline di server Railway.

### Keuntungan NLP.js:
| Aspek | Wit.ai (Lama) | NLP.js (Baru) |
|-------|---------------|---------------|
| Hosting | Cloud (Meta) | Self-hosted |
| Latency | ~200-500ms | <50ms |
| Privacy | Data ke Meta | Data lokal |
| Reliability | Tergantung API | 100% offline |
| Cost | Free tier limit | Unlimited |


---

## 🎯 Requirements Summary

| Aspek | Keputusan |
|-------|-----------|
| Bahasa | Indonesia |
| Low Confidence (<70%) | Konfirmasi kontekstual |
| Missing Entity | Follow-up question |
| Currency | "rb", "k", "jt", "gocap", "cepe" |
| Typo | Fuzzy match + konfirmasi |
| Cancel | "batal" + tombol inline |
| Kategori Baru | Tolak, pilih existing |
| API Down | Fallback command-based |
| Destructive Actions | Konfirmasi dulu |
| Multiple Items | Per-item deadline |
| Undo | Chain undo dengan konfirmasi |
| Reminder | Gabung jika waktu sama |
| Timezone | WIB fixed |
| Overdue | Notif jam 7:30 WIB, setiap hari sampai selesai |
| Bot Personality | Casual, "kamu", vokal dipanjangkan ("okee", "siapp") |
| Response Style | List tapi casual |
| Emoji | Minimal |
| Sync | Bidirectional realtime (WebSocket) |
| History | 10 transaksi terakhir |
| Deadline | 5 hari kedepan |
| Text Truncate | 75 karakter |
| Date Format | "15 Januari" (output), bebas (input) |
| Time Format | 24h |
| Confidence Log | Ya |
| Feedback | User bisa report error |

---

## ✅ NLP System Checklist (16 Points)

**Fokus: Data aman, UX enak, NLP boleh salah**

### 1️⃣ Intent Schema
Setiap intent punya required/optional fields:
```json
{
  "tambah_pengeluaran": { "required": ["amount"], "optional": ["category", "note", "time"] },
  "buat_tugas": { "required": ["matkul", "waktu"], "optional": ["tipe_tugas", "note"] },
  "catat_progress": { "required": ["project", "duration", "note"], "optional": [] }
}
```

### 2️⃣ Raw Text Always Stored
Simpan raw text **SEBELUM** parsing NLP:
```json
{ "raw_text": "naik gojek habis 20rb", "timestamp": "2026-01-10T20:30", "user_id": "..." }
```

### 3️⃣ NLP = Extractor Only
NLP **tidak pernah insert DB**. Output hanya structured data → validator yang proses.

### 4️⃣ Confidence Gate
- Intent confidence < 0.6 → fallback to note
- Entity penting confidence rendah → clarification mode
```
Bot: "aku catat ini sebagai catatan dulu ya"
DB: { "type": "note", "content": "naik gojek habis 20rb" }
```

### 5️⃣ Missing Field Detector + Smart Field Completion
Cek required fields → kalau ada yang kosong → tanyakan **satu per satu**, skip yang sudah ada.

**Contoh `buat_project`:**
```
User: project baru website deadline februari high

Bot internal check:
- project_name: "website" ✅
- deadline: "februari" ⚠️ (tidak spesifik tanggal)
- priority: "high" ✅
- project_type: ❌ missing
- matkul: ❌ (depends on type)

Bot: Project "Website" deadline Februari prioritas High!
     Deadline tanggal berapa di Februari?

User: tanggal 20

Bot: Oke! Ini Course Project atau Personal Project?
     [Course Project] [Personal Project]

User: Personal

Bot: Siapp, project Website (High) deadline 20 Feb udah dicatat!
     Ada deskripsi ga?
```

**Rules:**
1. **Skip** field yang sudah disebutkan user
2. **Ask one by one** untuk yang missing
3. **Never auto-assume** - misal "februari" tanpa tanggal → TANYA
4. Berlaku untuk SEMUA intent
5. **Title/Name Confirmation** - konfirmasi jika kompleks, langsung pakai jika simple:
   ```javascript
   function shouldConfirmTitle(title, confidence) {
     if (!title) return true;              // tidak detect → wajib tanya
     if (confidence < 0.7) return true;    // low confidence
     if (title.split(' ').length > 3) return true; // >3 kata
     if (/[0-9!@#$%]/.test(title)) return true;    // karakter aneh
     return false;                         // langsung pakai
   }
   ```
   **Contoh:**
   | Title | Action |
   |-------|--------|
   | "skripsi" | Langsung ✅ |
   | "website portfolio" | Langsung ✅ |
   | "sistem informasi manajemen keuangan" | Konfirmasi ⚠️ |
   | tidak terdetect | Tanya ❌ |

### 6️⃣ Clarification State
Pending intent disimpan di DB/Redis dengan TTL:
```json
{
  "pending_intent": "tambah_pengeluaran",
  "missing_fields": ["category"],
  "filled_fields": { "amount": 20000 },
  "raw_text": "habis 20rb",
  "expires_at": "2026-01-10T20:45"
}
```

### 7️⃣ Bot Nanya Balik (Slot-aware)
❌ "tolong ulangi input"  
✅ "kategorinya apa?" dengan inline buttons

### 8️⃣ User Answer = Slot Completion
Jawaban user di-merge ke pending state, **bukan intent baru**.

### 9️⃣ Enrichment Logic
Deterministic enrichment:
- `gojek` → category: Transport
- `note` = raw_text - amount - time - category
```json
{ "amount": 20000, "category": "transport", "note": "naik gojek" }
```

### 🔟 Never Auto-Assume
User: "senin" → Bot: "senin ini atau senin depan?"  
❌ Bot TIDAK BOLEH nebak diam-diam untuk tanggal.

### 1️⃣1️⃣ Cancellation Handling
"ngga jadi" / "batal" → clear pending state, simpan raw_text sebagai cancelled.

### 1️⃣2️⃣ Timeout Handling
Pending expired → simpan sebagai note:
```
Bot: "yang tadi belum selesai, aku simpan sebagai catatan ya"
```

### 1️⃣3️⃣ Idempotent Finalization
Event hanya diproses sekali (pakai event_id UUID). Restart/spam aman.

### 1️⃣4️⃣ Intent Override
User: "eh bukan pengeluaran, pemasukan deng"  
→ pending intent diganti, filled fields dipertahankan

### 1️⃣5️⃣ Multi-Entity Conflict Resolver
User: "bayar listrik kemarin dan hari ini"  
Bot: "pakai yang mana? kemarin atau hari ini?"

### 1️⃣6️⃣ Explainable Logs
```json
{
  "intent": "tambah_pengeluaran",
  "confidence": 0.91,
  "missing": ["category"],
  "question_asked": "kategorinya apa?",
  "final_action": "expense_created"
}
```

### 1️⃣7️⃣ Mid-flow Field Editing
User bisa ubah field **kapan saja sebelum finalized**. Berlaku untuk SEMUA intent.

**Trigger keywords:** "ganti", "ubah", "bukan", "salah", "koreksi"

**Contoh:**
```
[Expense]
User: aku habis makan nasi goreng 20rb
Bot: Siapp, expense makan Rp20.000 udah kucatat! Kategorinya apa?

User: eh ganti harganya bukan 20rb tapi 22rb
Bot: Oke, udah kuganti jadi Rp22.000! Kategorinya apa?

[Project]
User: buat project skripsi deadline maret
Bot: Project "Skripsi" deadline Maret! Course atau Personal?

User: ganti nama projectnya jadi tugas akhir
Bot: Oke, udah kuganti jadi "Tugas Akhir"! Course atau Personal?

[Task]
User: tugas ppl deadline senin
Bot: Siapp, tugas PPL deadline Senin! Ada note ga?

User: eh deadline nya rabu bukan senin
Bot: Oke, deadline udah kuganti ke Rabu! Ada note ga?
```

**Logic:**
1. Detect "ganti/ubah/bukan/salah" + field name
2. Parse new value dari input
3. Update `pending_state.filled_fields[field]`
4. **Lanjut dari step yang sama**, tidak restart

### 1️⃣8️⃣ Mid-flow Cancel/Undo
User bisa cancel **kapan saja** saat flow belum selesai.

**Trigger keywords:** "ga jadi", "batal", "cancel", "skip", "udahan"

```
User: buat project skripsi deadline maret
Bot: Project "Skripsi" deadline Maret! Course atau Personal?

User: eh ga jadi deh
Bot: Okee, dibatalin ya~
```

**Logic:**
1. Clear `pending_state`
2. Simpan raw_text sebagai cancelled (untuk log)
3. Tidak insert ke DB

### 1️⃣9️⃣ Mid-flow Delete (After Finalized)
User bisa delete **setelah finalized** tapi masih dalam sesi.

**Trigger keywords:** "hapus yang tadi", "delete", "buang"

```
User: habis 50rb makan
Bot: Siapp, expense makan Rp50.000 udah dicatat!

User: eh hapus yang tadi
Bot: Mau hapus expense makan Rp50.000?
     [Ya, hapus] [Ga jadi]

User: [Ya, hapus]
Bot: Expense makan Rp50.000 udah kuhapus~
```

**Logic:**
1. Cek `last_action` di session
2. **KONFIRMASI DULU** dengan inline buttons
3. Soft delete dari DB setelah user confirm
4. Update `last_action` untuk chain undo

### 2️⃣0️⃣ Destructive Action Confirmation
**SEMUA destructive action wajib konfirmasi:**
- `hapus_tugas` → "Yakin hapus tugas X?"
- `hapus_transaksi` → "Yakin hapus expense/income X?"  
- `hapus_project` → "Yakin hapus project X? Progress juga kehapus loh"
- `batalkan` (undo) → langsung execute (karena bisa redo)

```
User: hapus tugas ppl
Bot: Yakin hapus tugas PPL?
     [Ya, hapus] [Ga jadi]
```

### 2️⃣1️⃣ Catat Progress Guided Flow
`catat_progress` pakai **guided flow** step-by-step:

```
Step 1: User trigger
User: mau log progress / nyatet progress / catat progress

Step 2: Bot tampilkan project aktif
Bot: Mau log progress project mana?
     [Skripsi] [Website] [Freelance]

Step 3: User pilih project
User: [Skripsi]

Step 4: Bot tanya durasi
Bot: Berapa lama kerja project Skripsi?
     [30 menit] [1 jam] [2 jam] [Custom]

User: 2 jam

Step 5: Bot tanya persentase
Bot: Progress Skripsi sekarang 45%. Mau update ke berapa persen?

User: 60

Step 6: Bot tanya note (WAJIB)
Bot: Oke 60%! Tadi ngerjain apaa?

User: selesaiin bab 3 metodologi

Step 7: Konfirmasi
Bot: Siapp! Progress Skripsi udah kucatat:
     • Durasi: 2 jam
     • Progress: 45% → 60% (+15%)
     • Note: selesaiin bab 3 metodologi
```

**Entity baru yang dibutuhkan:** `persentase`
| Keyword | Synonyms |
|---------|----------|
| (Free Text) | 50%, 60 persen, setengah |

---

## 🔧 Intent Mapping (19 Intents)

| Intent | Contoh | Default/Note |
|--------|--------|--------------|
| `buat_tugas` | "tugas fisdas besok" | Filter per semester |
| `edit_tugas` | "ubah status tugas fisdas jadi done" | — |
| `lihat_tugas` | "tugas minggu ini" | — |
| `hapus_tugas` | "hapus tugas fisdas" | ⚠️ Konfirmasi |
| `deadline_terdekat` | "ada deadline apa aja" | 5 hari kedepan |
| `tambah_pengeluaran` | "habis 50rb makan" | — |
| `tambah_pemasukan` | "dapat 2jt gaji" | — |
| `edit_transaksi` | "ubah expense makan jadi 75rb" | Ubah field yang disebut |
| `hapus_transaksi` | "hapus expense yang tadi" | ⚠️ Konfirmasi |
| `lihat_transaksi` | "history transaksi" | 10 terakhir |
| `cek_saldo` | "saldo berapa" | IDR only |
| `buat_project` | "buat project skripsi" | — |
| `edit_project` | "ubah deadline project skripsi" | — |
| `hapus_project` | "hapus project web" | ⚠️ Konfirmasi |
| `lihat_project` | "list project" | — |
| `catat_progress` | "kerja skripsi 2 jam" | — |
| `ingatkan` | "ingatkan tugas fisdas besok jam 8" | Tanya waktu jika tidak disebut |
| `tambah_langganan` | "langganan spotify 50rb tiap bulan" | Recurring |
| `batalkan` | "ga jadi", "cancel" | Redo jika undo lagi |
| `minta_summary` | "summary minggu ini" | Tugas, transaksi, progress |
| `bantuan` | "bisa apa aja", "bantuan" | List kemampuan |
| `feedback` | "bot salah", "laporkan bug" | Simpan ke DB bot |
| `casual` | "makasih", "halo" | Reply friendly |

---

## 🎭 Bot Personality

### Style Guide

| Aspek | Rule |
|-------|------|
| Pronoun | "kamu" |
| Vokal akhir | Dipanjangkan: "okee", "siapp", "sudahh" |
| Emoji | Minimal, hanya di awal kalimat jika perlu |
| Tone | Friendly, casual, informatif |
| Error | Tetap friendly tanpa emoji: "Waduh, ada yang salah nih: [error]" |

### Contoh Response

**Buat tugas:**
```
Siapp, tugas Fisika Dasar deadline besok udah dicatat yaa
```

**Lihat tugas:**
```
Tugas kamu minggu ini:
• Fisika Dasar - Lapres (besok)
• Aljabar Linear - Tugas (Senin)
• WPL - Lapdul (Rabu)

Masih ada 3 lagi, mau lihat?
```

**Undo:**
```
Okee, expense Rp50.000 (Makan) dibatalkan

Mau undo lagi yang sebelumnya?
[💜 Ya] [Tidak usah]
```

**Overdue (pagi):**
```
Heyy, tugas Fisika Dasar udah lewat deadline kemarin nih

Udah selesai atau mau perpanjang?
[Udah selesai] [Perpanjang]
```

**Buat Tugas (ask note):**
```
User: lapres kjk prak deadline rabu

Bot: Siapp, Laporan Resmi Praktikum KJK yang deadlinenya Rabu udah dicatat yaa
     Ada note ga?

User: inget pake format IEEE

Bot: Okee, "inget pake format IEEE" udah kumasukin ke note nya. Udah ku input jugaa!

--- ATAU jika tidak ada note ---

User: ga ada

Bot: Okee udah ku input!
```

**Note Flow (opsional - kecuali progress):**
- `buat_tugas` → tanya note setelah konfirmasi
- `tambah_pengeluaran/pemasukan` → tanya note setelah konfirmasi
- `buat_project` → tanya note setelah konfirmasi
- `catat_progress` → note WAJIB, tanya di awal jika tidak ada

**Congratulate selesai:**
```
Yeayy tugas Fisika Dasar selesaiii! Satu lagi kelar nihh
```

**Error:**
```
Waduh, ada yang salah nih: gagal nyimpen ke database
```

---

## 📊 Fitur Detail

### Undo Chain
- Setiap undo dikonfirmasi dengan konteks
- Undo berulang = redo aksi sebelumnya
- Unlimited time

### Pagination
- Default sesuai fitur (10 transaksi, 5 hari deadline)
- "masih ada X lagi, mau lihat?"
- User bilang berapa → tampilkan sejumlah itu
- Jika kurang dari yang diminta: "ini sisanya"

### Validasi Tipe Tugas
**Logic:** Laporan (lapres, lapsem, lapen) hanya untuk matkul praktikum/workshop.

```javascript
function validateTipeTugas(matkul, tipeTugas) {
  const isPraktikum = matkul.toLowerCase().includes('prak') || 
                      matkul.toLowerCase().includes('praktikum') ||
                      matkul.toLowerCase().includes('workshop');
  
  const laporanTypes = ['lapres', 'lapsem', 'lapen', 'laporan'];
  const isLaporan = laporanTypes.some(t => tipeTugas.toLowerCase().includes(t));
  
  if (isLaporan && !isPraktikum) {
    return { valid: false, reason: 'Laporan hanya untuk matkul praktikum' };
  }
  return { valid: true };
}
```

**Response jika invalid:**
```
Bot: Hmm, lapres itu cuma buat matkul praktikum loh. 
     Mau ganti jadi Tugas atau Quiz?
     [Tugas] [Quiz]
```

### Overdue Notification
- Dikirim jam 7:30 WIB
- Setiap hari sampai tugas selesai
- Tombol aksi: [Udah selesai] [Perpanjang]
- Perpanjang: tanya user mau berapa hari
- Skip jika bot down, lanjut besok

### Feedback
- User bilang "bot salah" → simpan ke tabel `feedback` di DB bot
- Cara cek: Railway Console → query `SELECT * FROM feedback`

### Sync Bidirectional
- Desktop online → realtime WebSocket
- Desktop offline → simpan ke server, sync saat buka app
- Desktop harus cek pending sync setiap buka app
- Last write wins (desktop dan bot setara)

### Summary
- On-demand (user minta)
- Mencakup: tugas selesai, overdue, income/expense, progress project

### Description Fallback (Transaksi)
Jika `note` kosong tapi `kategori` ada → gunakan trigger word sebagai description:
```javascript
// Contoh: "naik gojek 15rb ke kampus"
// kategori = Transport (trigger: gojek), note = kosong
if (!note && kategoriTrigger) {
  description = kategoriTrigger; // "Gojek"
}
```

### Entity Fallback (Matkul/Project)
Entity `matkul` dan `project` isinya sama. Kode harus cek keduanya:
```javascript
function getCourseName(entities) {
  return entities.matkul?.[0]?.value || 
         entities.project?.[0]?.value || 
         null;
}
```

### Entity Fallback (Status)
Entity `task_status` dan `project_status` punya synonym mirip (selesai, done, completed). Kode pilih berdasarkan **intent**:
```javascript
function getStatus(intent, entities) {
  // Pilih entity berdasarkan intent
  if (['edit_tugas', 'buat_tugas'].includes(intent)) {
    return entities.task_status?.[0]?.value || 
           entities.project_status?.[0]?.value || null;
  }
  if (['edit_project', 'catat_progress'].includes(intent)) {
    return entities.project_status?.[0]?.value || 
           entities.task_status?.[0]?.value || null;
  }
  return entities.task_status?.[0]?.value || 
         entities.project_status?.[0]?.value || null;
}
```

---

## 🗄️ Entities wit.ai

| Entity | Role | Contoh Synonyms |
|--------|------|-----------------|
| `matkul` | Mata kuliah | fisdas→Fisika Dasar, alin→Aljabar Linear |
| `tipe_tugas` | Jenis tugas | lapres→Laporan Resmi, lapsem→Laporan Sementara |
| `kategori` | Income/expense | makan, transport, gaji, transfer |
| `project` | Nama project | skripsi, web, app |
| `hari` | Hari (typo) | senen→Senin, rebo→Rabu |

---

## �️ Filler Words

Kata-kata filler yang akan di-ignore (user bisa pakai, bot tetap paham):
- "dong", "sih", "nih", "deh", "ya", "yaa", "kah"

Contoh: "liat tugas minggu ini dong" → intent `lihat_tugas` ✅

**Handling:**
1. Train wit.ai dengan beberapa contoh yang include filler
2. Preprocessing: hapus filler sebelum kirim ke wit.ai

---

## �💰 Currency Parsing (Lokal)

```javascript
// currency.js
export function parseAmount(text) {
  // Slang khusus
  const slang = {
    'gocap': 50000,
    'cepe': 100000,
    'gopek': 500000,
    'sejuta': 1000000
  };
  
  const lower = text.toLowerCase().replace(/\./g, '');
  
  if (slang[lower]) return slang[lower];
  
  // Pattern matching: rb, ribu, k, jt, juta
  if (lower.match(/[\d,]+\s*(rb|ribu)$/)) {
    return parseFloat(lower.replace(/[^\d.,]/g, '').replace(',', '.')) * 1000;
  }
  if (lower.match(/[\d,]+k$/)) {
    return parseFloat(lower.replace(/[^\d.,]/g, '').replace(',', '.')) * 1000;
  }
  if (lower.match(/[\d,]+\s*(jt|juta)$/)) {
    return parseFloat(lower.replace(/[^\d.,]/g, '').replace(',', '.')) * 1000000;
  }
  
  // Angka biasa
  return parseInt(lower.replace(/\D/g, '')) || 0;
}

// Contoh:
// parseAmount("50rb") → 50000
// parseAmount("1.5jt") → 1500000
// parseAmount("gocap") → 50000
```

---

## 📅 Date Parsing (Lokal)

wit.ai hanya extract text, **kode yang translate ke tanggal**.

**Cara tag:** Tag **seluruh phrase** sebagai `waktu`:
- ✅ "**selasa depan**" → tag semua sebagai `waktu`
- ❌ "**selasa**" saja → salah, "depan" hilang

```javascript
// dateParser.js
export function parseDate(text) {
  const today = new Date();
  const lower = text.toLowerCase();
  
  // Relative
  if (lower === 'besok') return addDays(today, 1);
  if (lower === 'lusa') return addDays(today, 2);
  if (lower.includes('minggu ini')) return getEndOfWeek(today);
  if (lower.includes('minggu depan')) return addDays(getEndOfWeek(today), 7);
  
  // Day + "depan"
  const days = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];
  for (let i = 0; i < days.length; i++) {
    if (lower.includes(days[i])) {
      let diff = (i - today.getDay() + 7) % 7;
      if (lower.includes('depan')) diff += 7;
      return addDays(today, diff || 7);
    }
  }
  
  // Absolute: "20 januari", "tanggal 25"
  const dateMatch = lower.match(/(\d{1,2})\s*(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = dateMatch[2] ? parseMonth(dateMatch[2]) : today.getMonth();
    return new Date(today.getFullYear(), month, day);
  }
  
  return null;
}
```

---

## 📁 New Files

| File | Purpose |
|------|---------|
| `nlp-service.js` | **[NEW]** NLP.js manager (replaces wit.js) |
| `corpus.json` | **[NEW]** Trained model file |
| `nlp-handler.js` | Intent routing + confidence check |
| `currency.js` | Parse currency slang |
| `dateParser.js` | Parse tanggal Indonesia |
| `aliases.js` | Fallback synonyms |
| `undo.js` | Track last actions untuk undo chain |
| `reminder.js` | Scheduler untuk reminder + overdue |
| `personality.js` | Response templates casual |
| `pendingState.js` | Manage clarification state |
| `intentSchemas.js` | Required/optional fields per intent |

---

## 🔧 Coding Phase

### Phase 0: Migration from Wit.ai to NLP.js

> [!CAUTION]
> **Breaking Change:** Menghapus dependency Wit.ai API. Bot akan berjalan 100% offline.

#### 0.1 Install Dependencies
```bash
cd telegram-bot
npm install node-nlp
```

#### 0.2 Convert Wit.ai Backup
Backup Wit.ai sudah tersedia di `st4cker/st4cker/`:
- `utterances/utterances-1.json` - Training data (3000+ utterances)
- `entities/*.json` - Entity definitions (matkul, kategori, waktu, dll)

Script konversi: `convert-wit.js`
```javascript
// convert-wit.js - Run once to generate corpus.json
const { NlpManager } = require('node-nlp');
const manager = new NlpManager({ languages: ['id'], forceNER: true });

// Load entities from st4cker/entities/*.json
// Load utterances from st4cker/utterances/utterances-1.json
// manager.addDocument('id', text, intent);
// manager.addNamedEntity(entityName, keyword, ['id'], synonyms);

await manager.train();
manager.save('./corpus.json');
```

#### 0.3 [NEW] `nlp-service.js`
```javascript
// src/nlp/nlp-service.js - Replaces wit.js
import { NlpManager } from 'node-nlp';

let manager = null;

export async function initNLP() {
    manager = new NlpManager({ languages: ['id'], forceNER: true });
    manager.load('./corpus.json');
    console.log('[NLP] Model loaded');
}

export async function parseMessage(text) {
    const result = await manager.process('id', text);
    // Convert to Wit.ai-compatible format for minimal code changes
    return {
        intents: [{ name: result.intent, confidence: result.score }],
        entities: convertEntities(result.entities)
    };
}

function convertEntities(nlpEntities) {
    const converted = {};
    for (const e of nlpEntities || []) {
        const name = e.entity;
        if (!converted[name]) converted[name] = [];
        converted[name].push({
            value: e.option || e.utteranceText,
            confidence: e.accuracy,
            body: e.utteranceText
        });
    }
    return converted;
}
```

#### 0.4 [MODIFY] `nlp-handler.js`
```diff
- import { parseMessage, extractEntities } from './wit.js';
+ import { parseMessage, extractEntities, initNLP } from './nlp-service.js';

// Add initialization call at bot startup
+ await initNLP();
```

#### 0.5 [DELETE] Files
- `src/nlp/wit.js` - No longer needed

---

### Phase 1: Core NLP (Existing - No Changes Needed)

#### 1.2 `intentSchemas.js`
```javascript
// intentSchemas.js
export const schemas = {
  tambah_pengeluaran: { required: ['amount'], optional: ['category', 'note', 'time'] },
  buat_tugas: { required: ['matkul', 'waktu'], optional: ['tipe_tugas', 'note'] },
  buat_project: { required: ['project'], optional: ['waktu', 'priority'] },
  catat_progress: { required: ['project'], optional: [] }, // guided flow
  // ... semua intent
};
```

#### 1.3 `pendingState.js`
```javascript
// pendingState.js - manage clarification state
const pendingStates = new Map(); // chatId -> state

export function setPending(chatId, state) {
  pendingStates.set(chatId, { ...state, expires_at: Date.now() + 15*60*1000 });
}

export function getPending(chatId) {
  const state = pendingStates.get(chatId);
  if (!state || Date.now() > state.expires_at) return null;
  return state;
}

export function clearPending(chatId) {
  pendingStates.delete(chatId);
}
```

#### 1.4 `nlp-handler.js`
```javascript
// nlp-handler.js
export async function handleNaturalLanguage(bot, msg, broadcastEvent) {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // 1. Store raw text
  logRawText(chatId, text);
  
  // 2. Check pending state (for slot completion)
  const pending = getPending(chatId);
  if (pending) return handleSlotCompletion(bot, msg, pending, text);
  
  // 3. Parse with wit.ai
  const result = await parseMessage(text);
  
  // 4. Confidence gate
  if (!result.intents?.[0] || result.intents[0].confidence < 0.6) {
    return handleLowConfidence(bot, msg, text);
  }
  
  // 5. Extract entities
  const intent = result.intents[0].name;
  const entities = extractEntities(result.entities);
  
  // 6. Check required fields (Smart Field Completion)
  const schema = schemas[intent];
  const missing = getMissingFields(schema.required, entities);
  
  if (missing.length > 0) {
    setPending(chatId, { intent, entities, filled: entities, missing, raw_text: text });
    return askForMissing(bot, chatId, missing[0], intent);
  }
  
  // 7. Execute intent
  return executeIntent(bot, msg, intent, entities, broadcastEvent);
}

// handleSlotCompletion - BERLAKU UNTUK SEMUA INTENT
async function handleSlotCompletion(bot, msg, pending, text) {
  const chatId = msg.chat.id;
  
  // A. Check for cancel keywords
  if (isCancelKeyword(text)) {
    clearPending(chatId);
    return bot.sendMessage(chatId, responses.cancelled());
  }
  
  // B. Check for mid-flow edit keywords (ganti, ubah, bukan, salah)
  const editMatch = detectMidFlowEdit(text);
  if (editMatch) {
    pending.filled[editMatch.field] = editMatch.value;
    await bot.sendMessage(chatId, `Oke, ${editMatch.field} udah kuganti!`);
    // Continue asking for remaining missing fields
  }
  
  // C. Parse answer as slot completion
  const result = await parseMessage(text);
  const entities = extractEntities(result.entities || {});
  
  // D. Merge new entities to filled fields
  Object.assign(pending.filled, entities);
  
  // E. Re-check missing fields
  const schema = schemas[pending.intent];
  const stillMissing = getMissingFields(schema.required, pending.filled);
  
  if (stillMissing.length > 0) {
    pending.missing = stillMissing;
    setPending(chatId, pending);
    return askForMissing(bot, chatId, stillMissing[0], pending.intent);
  }
  
  // F. All fields complete → execute
  clearPending(chatId);
  return executeIntent(bot, msg, pending.intent, pending.filled, broadcastEvent);
}
```

### Phase 2: Utility Functions

#### 2.1 `currency.js` ✅ (sudah di plan)
#### 2.2 `dateParser.js` ✅ (sudah di plan)

#### 2.3 `personality.js`
```javascript
// personality.js
export const responses = {
  confirm_expense: (amount, category) => 
    `Siapp, expense ${category} Rp${amount.toLocaleString()} udah kucatat!`,
  confirm_task: (matkul, deadline) => 
    `Siapp, tugas ${matkul} deadline ${deadline} udah dicatat yaa`,
  ask_category: () => 
    `Kategorinya apa?`,
  ask_note: () => 
    `Ada note ga?`,
  cancelled: () => 
    `Okee, dibatalin ya~`,
  // ...
};
```

### Phase 3: Integration

#### 3.1 Update `bot.js`
```javascript
// bot.js - tambahkan di on('message')
bot.on('message', async (msg) => {
  // ... existing handlers ...
  
  // NLP Fallback (jika bukan command)
  if (!msg.text?.startsWith('/')) {
    const handled = await handleNaturalLanguage(bot, msg, broadcastEvent);
    if (handled) return;
  }
});
```

### Phase 4: Testing

1. Test dengan wit.ai HTTP API langsung
2. Test confidence threshold
3. Test entity extraction
4. Test pending state flow
5. Test mid-flow editing
6. Test cancel/undo
7. Test edge cases

---

## 🔄 Modified Files

| File | Changes |
|------|---------|
| `bot.js` | NLP handler integration |
| `server.js` | Pending sync endpoint |
| `package.json` | Add node-fetch, fuzzball |
| `.env` | Add WIT_ACCESS_TOKEN |

---

## 📋 wit.ai Training Guide

### Step 1: Buat Entities

Buka wit.ai Dashboard → Entities, buat:
- `matkul` — nama mata kuliah
- `tipe_tugas` — lapres, tugas, dll
- `kategori` — makan, transport, gaji
- `project` — nama project
- `hari` — senen → senin
- `status` — selesai, done, belum, pending

> **Built-in (otomatis ada):** `wit$datetime`, `wit$number`, `wit$duration`

### ⚡ Dynamic Entities (Auto-Sync)

**Problem:** Matkul berubah tiap semester, tidak mau update wit.ai manual.

**Solusi:** Gunakan **local aliases** yang di-sync dari desktop:

1. Desktop sync daftar matkul + aliases ke bot server
2. Bot simpan di database `course_aliases`
3. Sebelum kirim ke wit.ai, bot resolve alias dulu
4. wit.ai cukup tau pattern, bukan nama matkul spesifik

**Flow:**
```
"tugas fisdas besok"
  → Bot: "fisdas" = "Fisika Dasar" (dari sync data)
  → wit.ai: detect intent "buat_tugas"
```

**Yang perlu di-sync dari desktop:**
- Daftar matkul + singkatan
- Daftar project
- Daftar kategori custom

### Step 2: Isi Synonyms

**Entity `matkul`:**
| Value | Synonyms |
|-------|----------|
| Fisika Dasar | fisdas, fisda |
| Aljabar Linear | alin |
| Web Programming Lab | wpl |

**Entity `tipe_tugas`:**
| Value | Synonyms |
|-------|----------|
| Laporan Resmi | lapres |
| Laporan Sementara | lapsem |
| Laporan Pendahuluan | lapdul, lapen |

### Step 3: Train Utterances

**`buat_tugas`:**
```
senen besok ada lapres wpl
tugas fisdas deadline besok
jumat ini kumpul lapdul alin
bikin tugas fisika sama alin deadline senin depan
```

**`batalkan`:**
```
ga jadi
cancel yang tadi
batal
ga jadi deh
```

**`casual`:**
```
makasih
halo
thanks bot
```

---

## ✅ Verification Plan

### Test Lokal

1. Setup wit.ai app + train intents
2. Copy WIT_ACCESS_TOKEN ke .env
3. Run `npm run dev`
4. Test via Telegram:
   - High confidence: "habis 50rb makan"
   - Low confidence: "keluar uang nih"
   - Missing entity: "buat tugas deadline besok"
   - Typo: "tugas fisads besok"
   - Undo: "ga jadi"
   - Casual: "makasih"

### Checklist

- [ ] 19 intents berfungsi
- [ ] Konfirmasi muncul saat confidence rendah
- [ ] Follow-up question saat entity missing
- [ ] Fuzzy match untuk typo
- [ ] Currency parsing (rb, k, jt, gocap)
- [ ] Undo chain berfungsi
- [ ] Overdue notif pagi
- [ ] Pagination "mau lihat lagi?"
- [ ] Summary lengkap
- [ ] Sync ke desktop realtime
- [ ] Personality casual

---

## 🚀 Implementation Steps

1. [ ] Buat akun wit.ai
2. [ ] Buat entities + synonyms
3. [ ] Train 19 intents
4. [ ] Copy WIT_ACCESS_TOKEN ke .env
5. [ ] Install: node-fetch, fuzzball
6. [ ] Implement new files
7. [ ] Modify bot.js, server.js
8. [ ] Test lokal
9. [ ] Buat user documentation
10. [ ] Deploy ke Railway

---

## 📝 User Documentation (Draft)

### Cara Pakai NLP

Kirim pesan ke bot tanpa command, contoh:
- "tugas fisdas deadline besok"
- "habis 50rb makan"
- "kerja skripsi 2 jam"
- "ada deadline apa aja"
- "saldo berapa"

### Command Tetap Berfungsi

Semua /command lama tetap bisa dipakai:
- /task, /expense, /income, /project, /log, dll

### Tips

- Pakai singkatan matkul (fisdas, alin, wpl)
- Pakai singkatan currency (50rb, 100k, gocap)
- Bilang "ga jadi" untuk undo
- Bilang "bantuan" untuk lihat kemampuan

---

**Ready for Review** ✅
