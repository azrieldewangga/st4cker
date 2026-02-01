# Implementation Plan - Gemini API Migration (The "St4cker" Evolution)

**Goal:** Transform St4cker Bot from a simple command executor into a contextual AI Assistant using **Google Gemini 1.5 Flash**.

---

## 📅 Phased Approach

### Phase 1: The Brain Transplant (Core Migration) @today
**Objective:** Replace `node-nlp` with Gemini API to handle Intent Classification & Entity Extraction. Response style remains standard for stability.
**Why:** Quick win to fix "stupid bot" errors (e.g. failing to understand complex sentences).
**Git Strategy:** We will work on a separate branch named `LLM`. DO NOT push to `main` until Phase 1 is fully verified.

1.  **Branching:** Create and checkout branch `LLM`.
2.  **Dependencies:** Install `@google/generative-ai`, `dotenv`.
2.  **Data Preservation:** Rename `corpus.json` -> `legacy_corpus_backup.json` (Do not delete!).
3.  **Service Rewrite:** Create new `nlp-service.js` that talks to Gemini.
4.  **Handler Cleanup:** Simplify `nlp-handler.js` (remove regex fallbacks).
5.  **Output:** Bot behaves smarter in understanding, but replies are still standard templates.

### Phase 2: The Personality Upgrade (COMPLETED)
**Objective:** Enable "Context Awareness" (Memory) and "Generative Responses" (Personality).
**Why:** To achieve the "Nasi Ayam 5 Hari" scenario.

1.  **Context Injection (DONE):** Created `HistoryService.js` to fetch recent transactions, tasks, and balance. Injected this context into Gemini System Prompt.
2.  **Generative Reply (DONE):** `nlp-service.js` now has `generateCasualReply` which uses the context to generate friendly/sarcastic responses.
3.  **Persona Tuning (DONE):** System Prompt adjusted to be "Friendly", "Sarkas", and "Supportive".
4.  **Verification (DONE):** Tested with mock data. Bot correctly identifies past transactions ("Nasi Ayam") and pending tasks ("Algoritma").

### Phase 1.1: Refining Midflow Editing (Immediate Fix) @today
**Objective:** Fix `tipe_tugas` detection and `matkul` resolution during mid-flow corrections.
1.  **Code Correction:**
    - Update `extractLocalEntities` in `nlp-handler.js` to detect `tipe_tugas` (keywords: `tipe`, `jenis`).
    - Update `handleSlotCompletion` in `nlp-handler.js` to properly resolve `matkul` (using `findCourse`) when it is updated mid-flow.
    - Improve `extractLocalEntities` to handle note correction phrases like "notenya jadi X", "ubah note X".
2.  **Verification:**
    - Manual Test: "Tipe lapen" -> Should update type to "Laporan Pendahuluan".
    - Manual Test: "Matkul prak komber" -> Should update, resolve to ID, and not fail validation.
    - Manual Test: "Notenya jadi bsk" -> Note should be "bsk" (not "nya jadi bsk").

### Phase 1.2: Slang & Colloquial Support @today
**Objective:** Restore understanding of Javanese/Betawi slang (e.g., "yoi", "okura") for confirmation.
1.  **Code Correction:**
    - Update `handleSlotCompletion` in `nlp-handler.js` to expand the list of positive/negative confirmation keywords.
    - Add terms: `yoi`, `siip`, `okura`, `mantap`, `hooh`, `yup`, `betul`, `sabi`, `gass`.
2.  **Verification:**
    - Manual Test: "Yoi" -> Should be treated as "Ya".
    - Manual Test: "Gak dulu" -> Should be treated as "Tidak".

### Phase 1.3: Flexible Note & Negatives @today
**Objective:** Fix "gada" being captured as note, and allow valid text to be captured as note without "Note:" prefix.
1.  **Code Correction (`nlp-handler.js`):**
    - Add `ga ada`, `gada`, `engga ada` to `SKIP_KEYWORDS` and `negatives` list.
    - Implement **Implicit Note Fallback**: If user text is NOT a positive/negative/skip keyword and NOT a command, treat it as a Note update.
2.  **Verification:**
    - Manual Test: Reply "gada" to confirmation -> Should act as "Tidak" (or skip if in input mode).
    - Manual Test: Reply "Nitip sandal" -> Should update note to "Nitip sandal" (without saying "Note: Nitip sandal").

### Phase 1.8: Smart AI Confirmation @today
**Objective:** Let Gemini decide if user input is "Yes", "No", or "Correction" instead of hardcoded lists.
1.  **Code Correction (`nlp-service.js`):**
    - Add intents: `konfirmasi_positif`, `konfirmasi_negatif`.
    - Train prompt to recognize "Benerr", "Gas", "Mantap", "Yoi" as Positive.
    - Train prompt to recognize "Gak jadi", "Gada" as Negative.
2.  **Code Correction (`nlp-handler.js`):**
    - In `handleSlotCompletion`, if `pending.subState === 'confirmation'`:
        - Use `parseMessage(text)` to check intent.
        - If `konfirmasi_positif` -> Execute.
        - If `konfirmasi_negatif` -> Cancel.
        - Else -> Treat as Correction (fallback to existing logic).
3.  **Verification:**
    - Manual Test: During confirmation, reply "Benerr banget bang" -> Action Executed.
    - Manual Test: Reply "Waduh salah, gajadi deh" -> Action Cancelled.

### Phase 1.5: Fix Project Creation @today
**Objective:** Enhance `buat_project` to capture all fields (Priority, Note/Desc, Link, Loop).
1.  **Code Correction (`intentSchemas.js`):**
    - Update `buat_project` to correct schema: `required: ['project', 'project_type', 'priority', 'note', 'link']`.
    - Note: 'link' is optional during init, but we want to prompt for it. Actually, better make it required in schema so `getMissingFields` catches it, but allow 'skip' in handler.
2.  **Code Correction (`nlp-handler.js`):**
    - Update `askForMissing` to handle:
        - `priority` -> Show Inline Buttons (High/Medium/Low).
        - `note` -> "Deskripsi singkat projectnya?".
        - `link` -> "Ada link/URL terkait? (Github/Drive/dll)".
    - Update `handleSlotCompletion` to loop for Link (User provided one -> Ask "Ada lagi?").
3.  **Verification:**
    - Manual Test: "Bikin project skripsi deadline bulan depan" -> Bot asks Type -> Priority -> Desc -> Link -> Confirm.

### Phase 1.6: Fix Edit/Delete Intents @today
**Objective:** Wire up `edit_tugas`, `hapus_tugas`, `edit_transaksi`, `hapus_transaksi`, `edit_project`, `hapus_project`.
1.  **Code Correction:**
    - Add switch cases in `executeConfirmedIntent` for all these intents.
    - Ensure they call the respective handlers (`handleTaskIntent`, `handleTransactionIntent`, `handleProjectIntent`).

### Phase 1.7: Fix Log Progress @today
**Objective:** Wire up `catat_progress`.
1.  **Code Correction:**
    - Add routing for `catat_progress` to `handleProjectIntent`.

---

## ⚠️ User Review Required
> [!IMPORTANT]
> **API KEY:** You need a valid Google Generative AI API Key.
> **Privacy:** Chat content is sent to Google servers for processing (Standard for cloud AI).

---

## Technical Details (Phase 1)

### 1. Dependencies
#### [MODIFY] `package.json`
- Remove: `node-nlp`
- Add: `@google/generative-ai`
- Add: `dotenv`

### 2. NLP Service (The Brain)
#### [OVERWRITE] [nlp-service.js](file:///d:/Project/st4cker/telegram-bot/src/nlp/nlp-service.js)
- **Class:** `GeminiNLP`
- **Method:** `parseMessage(text)`
- **System Prompt:**
  ```text
  Role: Financial Assistant.
  Task: Extract entities (intent, amount, category, note) from user text.
  Time Reference: Today is [CURRENT_DATE].
  Output: JSON only.
  ```

### 3. Handler Logic
#### [MODIFY] [nlp-handler.js](file:///d:/Project/st4cker/telegram-bot/src/nlp/nlp-handler.js)
- Remove: `trainNewIntent`, regex overrides.
- Keep: Business validation (Saldo check, Matkul validation).

### 4. Cleanup
#### [RENAME] `corpus.json` -> `legacy_corpus_backup.json`
#### [DELETE] `model.nlp`

---

## Verification Plan (Phase 1)

### Manual Testing
1.  **Ambiguity Test:** "Barusan abis 20rb buat beli bensin" -> Expect: `Expense`, `Transport`, `20000`.
2.  **Negative Test:** "Gajadi deh" -> Expect: `Cancel`.
3.  **Slang Test:** "Cuan 1jt dari freelance" -> Expect: `Income`, `Salary`, `1000000`.

---

## 📝 Update Log (2026-01-30)

### ✅ Phase 1 Completed (Core Migration)
1.  **Migration to Gemini API**: Replaced `node-nlp` with `@google/generative-ai`.
2.  **"Matkul belum dipilih" Fix**: Implemented early course resolution to ensure courses are detected before missing fields validation.
3.  **Desktop App Sync Crash Fix**: 
    - Updated `electron/main.cts` to safely parse `semester` (handling both number and string types).
    - Fixed `transaction.created` payload handling (extracting `.value` from objects) to prevent SQLite binding errors.
4.  **Practical Switch logic**: Bot now correctly switches to "Praktikum" variant if "prak" keyword is detected, overriding Gemini's base course extraction.
5.  **Mid-flow Editing & Corrections**:
    - Implemented `extractLocalEntities` in `nlp-handler.js`.
    - Bot now supports mid-flow corrections for **Dates** ("Bukan, tanggal 21"), **Amounts**, and **Notes** without re-triggering full NLP, fixing the "besok bes" (+2 days) issue.

### ✅ Phase 2 Completed (Personality Upgrade)
1.  **HistoryService Implemented**: Created `src/services/historyService.js` to fetch Last 5 Transactions, Top 3 Pending Tasks, and Active Projects.
2.  **Context-Aware NLP**: Updated `nlp-service.js` to inject User Context into the System Prompt.
3.  **Generative Responses**: `generateCasualReply` now reads user context to provide sarcastic/supportive comments (e.g., commenting on low balance or pending deadlines).
4.  **Verified**: Test script confirmed correct context recall.
