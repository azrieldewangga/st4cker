# Database Migration Plan: Local to Centralized Server (Hybrid Sync)

**Selected Architecture:** Option 1 - Hybrid Sync
**Infrastructure:** Railway (Node.js Service + PostgreSQL Plugin)

## � Objective
Migrate St4cker from a "Local SQLite + JSON Dump" system to a "Centralized PostgreSQL + Two-Way Sync" architecture.
This enables:
1.  **Multi-Tenancy:** Multiple users can use the same bot with isolated data.
2.  **Real-Time Sync:** Data input from Bot appears on Desktop, and vice-versa.
3.  **Offline-First:** Desktop app remains fast and works offline.

---

## 🛠️ Tech Stack & Tools
*   **Database:** PostgreSQL (Railway Plugin)
*   **ORM:** Drizzle ORM (Replaces `better-sqlite3` raw queries for cleaner schema management & migration support).
*   **Sync:** Custom REST API on Bot Server.

---

## 📅 Implementation Roadmap

### Phase 1: Server Foundation (The "Backend")
1.  **Provision DB:** Add PostgreSQL plugin to existing Railway project.
2.  **Schema Design:** Define the unified schema (PostgreSQL) mirroring the desktop schema.
    *   **New:** All tables (`transactions`, `tasks`, etc.) gain a `user_id` column.
    *   **New:** `users` table to manage `telegram_user_id` and auth tokens.
3.  **Bot Update:** Modify `server.js` to connect to Postgres using Drizzle.

### Phase 2: Bot Migration (The "Interface")
1.  **Read/Write:** Update `nlp-handler` and `HistoryService` to read/write directly to Postgres.
    *   *Result:* Bot responses become 100% accurate based on server data.
2.  **Multi-User Logic:** Ensure every query allows filters by `user_id`.

### Phase 3: Desktop Bridge (The "Sync Engine")
1.  **Data Push:** ✅ **Implemented**
    *   Server now accepts full JSON payload from Desktop and upserts it into Postgres.
    *   Verified: User balance, Transactions, Projects, and Assignments are correctly synced.
2.  **Data Pull:** ✅ **Implemented**
    *   **Real-Time:** WebSockets push events from Bot to Desktop.
    *   **Offline Catch-up:** Server flushes `pendingEvents` on Desktop reconnect.
3.  **Initial Migration:** ✅ **Complete**
    *   Desktop's `syncUserDataToBackend` now successfully uploads current local state to the Server DB on first connection/forced sync.
    *   *Result:* No history lost during migration. Data is unified in Postgres.

---

## ⚠️ Requirements for User
1.  **Action:** You will need to add a PostgreSQL Service in your Railway dashboard (I will guide you).
2.  **Env Var:** We will need `DATABASE_URL` from Railway.

---

## Next Step
**Start Phase 1:** Set up the Server Database and Schema.
