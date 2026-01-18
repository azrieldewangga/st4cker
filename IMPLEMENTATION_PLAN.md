# Implementation Plan - Gemini API Migration (The "St4cker" Evolution)

**Goal:** Transform St4cker Bot from a simple command executor into a contextual AI Assistant using **Google Gemini 1.5 Flash**.

---

## 📅 Phased Approach

### Phase 1: The Brain Transplant (Core Migration) @today
**Objective:** Replace `node-nlp` with Gemini API to handle Intent Classification & Entity Extraction. Response style remains standard for stability.
**Why:** Quick win to fix "stupid bot" errors (e.g. failing to understand complex sentences).

1.  **Dependencies:** Install `@google/generative-ai`, `dotenv`.
2.  **Data Preservation:** Rename `corpus.json` -> `legacy_corpus_backup.json` (Do not delete!).
3.  **Service Rewrite:** Create new `nlp-service.js` that talks to Gemini.
4.  **Handler Cleanup:** Simplify `nlp-handler.js` (remove regex fallbacks).
5.  **Output:** Bot behaves smarter in understanding, but replies are still standard templates.

### Phase 2: The Personality Upgrade (Projected)
**Objective:** Enable "Context Awareness" (Memory) and "Generative Responses" (Personality).
**Why:** To achieve the "Nasi Ayam 5 Hari" scenario.

1.  **Context Injection:** Bot fetches last 5 transactions from Database before prompting Gemini.
2.  **Generative Reply:** Gemini not only extracting data, but also composing the reply text.
3.  **Persona Tuning:** Adjusting System Prompt to be "Sarkas", "Supportive", or "Professional".

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
