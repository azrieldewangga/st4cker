# st4cker NLP Hybrid Command Plan (v2.0)

**Goal:** Unify Bot Logic & Enhance User Experience (Hybrid Command + NLP)

## 📋 Overview
The objective is to unify the bot's business logic while preserving two distinct interfaces for the user:
1.  **Standard Commands** (`/task`, `/income`): Button/Menu-based interactivity.
2.  **Natural Language** ("Buat tugas..."): Chat-based interactivity.

---

## 🚀 Progress Update (2026-01-16) - Progress & Conversational Polish
*   **Progress Tracking:** ✅ **DONE**. 
    *   **Smart Extraction:** "Catat progress project x 50% 2 jam" works.
    *   **Logic:** Fuzzy match project name, regex for duration/percentage.
    *   **Sync:** Patched Desktop App to force refresh on log.
*   **Conversational Polish:** ✅ **DONE**.
    *   **Greetings:** "Pagi bang" -> "Pagi juga bang!".
    *   **Sticky Session Fix:** Strong intents (`buat project`) interrupt pending logic immediately.

### Data Visibility Features (Current Priority)
We are now focusing on retrieving and displaying data to the user via the bot.

#### 1. List Project (`lihat project`)
*   **Goal:** Allow user to see what they are working on without opening the app.
*   **Format:**
    ```text
    📂 **Active Projects:**
    1. **Skripsi V2** (In Progress)
       📅 Deadline: 20 Jan 2026 (4 days left)
       📊 Progress: 50%
    2. ...
    ```
*   **Pagination:** 5 items per page.

#### 2. Transaction History (`log keuangan`)
*   **Goal:** Quick check of recent spending/income.
*   **Format:**
    ```text
    💰 **Recent Transactions (Last 5):**
    1. 🔴 -Rp 50.000 (Makan) - *Hari ini*
    2. 🟢 +Rp 1.000.000 (Gaji) - *Kemarin*
    ...
    💳 **Balance:** Rp 1.500.000
    ```

#### 3. Monthly/Daily Summary (`summary`)
*   **Goal:** High-level overview of tasks and finances.
*   **Variants:** `summary hari ini`, `summary bulan ini`.
*   **Content:**
    *   Total Income/Expense (Period).
    *   Tasks Completed vs Pending (Period).
    *   Progress log count.

#### 4. Edit & Delete Features (Maintenance)
*   **Goal:** Allow users to fix mistakes or clean up data via bot.
*   **Features:**
    *   **Edit/Delete Transaction:** modify amount/category or delete incorrect entry.
    *   **Delete Task:** Remove accidental task creation.

---
