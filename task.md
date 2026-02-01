# Task: Database Migration (PostgreSQL)

## Phase 1: Server Foundation (The Backend) @today
Focus: Setting up PostgreSQL schema and ORM on the server (Bot).
- [x] Install Drizzle ORM & Postgres drivers (`drizzle-orm`, `pg`, `drizzle-kit`) <!-- id: 0 -->
- [x] Define PostgreSQL Schema (mirroring `st4cker` SQLite) <!-- id: 1 -->
    - [x] Users & Auth Tables
    - [x] Transactions, Tasks, Projects (with `user_id`)
- [x] Configure `drizzle.config.ts` <!-- id: 2 -->
- [x] Implement DB Connection logic in `src/db/index.js` <!-- id: 3 -->
- [x] Verify Connection with "Dev Database" (Requires `DATABASE_URL`) <!-- id: 4 -->

## Phase 2: Bot Migration (The Interface)
Focus: Making the Bot read/write from the new Server DB.
- [ ] Refactor `HistoryService` to use Drizzle <!-- id: 5 -->
- [ ] Refactor `nlp-handler` logic to use Drizzle <!-- id: 6 -->
- [ ] Update `server.js` endpoints to use Drizzle <!-- id: 7 -->

## Phase 3: Desktop Bridge (The Sync)
Focus: Connecting the Desktop App to the Server.
- [ ] Implement `API Service` in Electron to push/pull data <!-- id: 8 -->
- [ ] Add `sync` button/logic in Frontend <!-- id: 9 -->

## Phase 4: Data Migration (One-time)
Focus: Moving existing local data to the cloud.
- [ ] Create migration script (`sqlite-to-pg.js`) <!-- id: 10 -->
- [ ] Run migration for the user <!-- id: 11 -->
