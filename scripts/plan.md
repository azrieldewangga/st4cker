# Audit Fix Implementation Plan

Prioritized plan to address the 22 issues from [audit_report.md](file:///C:/Users/washi/.gemini/antigravity/brain/4f847244-7689-4b2b-b030-0c15bac44a24/audit_report.md). Grouped into 5 waves, from most to least critical. Each wave can be shipped independently.

## Context

- **Infra**: Self-hosted VPS (no Railway). PostgreSQL runs locally on VPS via Docker.
- **Network**: Tailscale mesh network — VPS IP `100.93.206.95`. Desktop ↔ VPS traffic is **encrypted by Tailscale** (WireGuard). This means HTTPS is optional for the internal network.
- **DB URL**: Both `.env` files still reference Railway (`yamanote.proxy.rlwy.net`). These need updating to point to the local Postgres on the VPS.

## User Review Required

> [!IMPORTANT]
> **Secret Rotation**: User will rotate Telegram token, Gemini key, and Google OAuth manually after Wave 1.

> [!WARNING]
> **DATABASE_URL** in both `.env` and `telegram-bot/.env` still points to Railway. After Wave 1, you should update these to point to your VPS Postgres (e.g. `postgresql://st4cker_admin:YOUR_NEW_PASSWORD@localhost:5432/st4cker_db`).

---

## Wave 1 — Hardening Secrets & Auth (Code-Only, No Infra)

Fixes audit items **#1, #2, #3, #7**.

---

### Server Security

#### [MODIFY] [api_routes.js](file:///d:/Project/st4cker/telegram-bot/src/api_routes.js)
- Remove `|| 'st4cker-agent-secret'` fallback from `authenticateApiKey`. Crash if `AGENT_API_KEY` is unset.

#### [MODIFY] [server.js](file:///d:/Project/st4cker/telegram-bot/src/server.js)
- Add `express-rate-limit` middleware to ALL `/api/*` routes:
  - Pairing endpoints: max 5 requests/minute
  - Sync endpoints: max 20 requests/minute 
  - General: max 100 requests/minute
- Add auth check to `GET /api/user-data/:telegramUserId` — require valid `sessionToken` query param
- Add `express.json({ limit: '2mb' })` body size limit (line 39)

#### [MODIFY] [main.cts](file:///d:/Project/st4cker/electron/main.cts)
- Remove `|| 'http://103.127.134.173:3000'` fallback on line 527. Crash with error if env not set.
- Remove `|| 'st4cker-agent-secret'` fallback on line 528.
- Change `encryptionKey` on line 675 to use `process.env.TELEGRAM_ENCRYPTION_KEY` (with error if unset).

#### [MODIFY] [docker-compose.yml](file:///d:/Project/st4cker/docker-compose.yml)
- Remove default password fallback. Require `POSTGRES_PASSWORD` from env file.

#### [NEW] [.dockerignore](file:///d:/Project/st4cker/telegram-bot/.dockerignore)
- Add `.env`, `*.db`, `*.log`, `node_modules/`, `experiments/`, `*.txt`, `*.md`

---

## Wave 2 — Tailscale Network Hardening (Config-Only)

Fixes audit items **#4, #15**.

> [!NOTE]
> Since Tailscale already encrypts all traffic (WireGuard), formal HTTPS/nginx is **optional** for Desktop ↔ VPS. However, the Telegram Bot API webhook still uses the public IP and would benefit from HTTPS if exposed.

#### [MODIFY] [docker-compose.yml](file:///d:/Project/st4cker/docker-compose.yml)
- Bind bot port to Tailscale IP only: `100.93.206.95:3000:3000` (not `0.0.0.0`)
- Change Postgres port to `127.0.0.1:5432:5432` (local-only, no external access)

#### [MODIFY] Both `.env` files
- Update `TELEGRAM_WEBSOCKET_URL` to `http://100.93.206.95:3000` (Tailscale IP)
- Update `DATABASE_URL` from Railway to local Postgres

#### [MODIFY] [main.cts](file:///d:/Project/st4cker/electron/main.cts)
- Change fallback URL to use Tailscale IP or remove fallback entirely

---

## Wave 3 — Database Cleanup (Schema & Query Fixes)

Fixes audit items **#5, #6, #9, #10, #12**.

---

### Remove Legacy SQLite from Bot

#### [MODIFY] [pairing.js](file:///d:/Project/st4cker/telegram-bot/src/pairing.js)
- Rewrite to use Drizzle/Postgres `pairingCodes` + `sessions` tables instead of `database.js` (SQLite).

#### [DELETE] [database.js](file:///d:/Project/st4cker/telegram-bot/src/database.js)
- Remove entirely after migrating pairing + sessions to Drizzle.

---

### Fix N+1 Sync Queries

#### [MODIFY] [server.js](file:///d:/Project/st4cker/telegram-bot/src/server.js)
- Replace the `for (const t of incomingAssignments)` loop (lines 301-346) with a **batched transaction**:
  ```js
  await db.transaction(async (tx) => {
    for (const t of incomingAssignments) {
      await tx.insert(assignments).values({...}).onConflictDoUpdate({...});
    }
  });
  ```
- Same batching for transactions sync (lines 219-243) and projects sync (lines 247-271).

---

### Fix Date & Money Types

#### [MODIFY] [schema.js](file:///d:/Project/st4cker/telegram-bot/src/db/schema.js)
- Change `deadline: text()` → `deadline: timestamp()` in `assignments` and `projects` tables
- Change `date: text()` → `date: timestamp()` in `transactions` table
- Change `amount: doublePrecision()` → `amount: integer()` (store in smallest currency unit, e.g. Rupiah)
- **Requires migration script** for existing data

#### [NEW] [migration-001-fix-types.js](file:///d:/Project/st4cker/telegram-bot/scripts/migration-001-fix-types.js)
- SQL migration converting existing text dates to timestamps and float amounts to integers

---

### Add Pending Events Cleanup

#### [MODIFY] [server.js](file:///d:/Project/st4cker/telegram-bot/src/server.js)
- Add `node-cron` job to delete `pendingEvents` older than 30 days

---

## Wave 4 — Docker & DevOps

Fixes audit items **#13, #14, #16, #17**.

#### [MODIFY] [Dockerfile](file:///d:/Project/st4cker/telegram-bot/Dockerfile)
- Change `FROM node:18-bullseye` → `FROM node:20-alpine`
- Add healthcheck: `HEALTHCHECK CMD wget -qO- http://localhost:3000/health || exit 1`

#### [MODIFY] [docker-compose.yml](file:///d:/Project/st4cker/docker-compose.yml)
- Add healthcheck for bot service
- Add `deploy.resources.limits` (e.g. `mem_limit: 512m`)

---

## Wave 5 — Code Cleanup & Quality

Fixes audit items **#18, #19, #21, #22**.

#### [MODIFY] [package.json](file:///d:/Project/st4cker/package.json)
- Change hardcoded NSIS paths (`d:/Project/st4cker/build/...`) to relative (`./build/...`)

#### [MODIFY] [main.cts](file:///d:/Project/st4cker/electron/main.cts)
- Remove `[DEBUG-CRITICAL]` console.logs
- Enable `contextIsolation: true` on splash window (line 63)

#### [DELETE] Dead files
- `telegram-bot/convert-wit.js`
- `telegram-bot/test-wit.js`
- `telegram-bot/legacy_corpus_backup.json`
- `reproduce_validation.js`
- `test_connection.js`, `test_date.js`, `test_entities.js`

---

## Verification Plan

### Automated Tests

**Wave 1 — API Security:**
```bash
# From project root, after starting the bot
# Test: API key rejection
curl -X GET http://localhost:3000/api/v1/tasks
# Expected: 401 Unauthorized

# Test: rate limiting (run in quick succession)
for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/generate-pairing -H "Content-Type: application/json" -d '{"telegramUserId":"test"}'; done
# Expected: 429 after 5th request

# Test: body size limit
# Send oversized payload
curl -X POST http://localhost:3000/api/sync-user-data -H "Content-Type: application/json" -d "$(python -c "print('{\"data\":\"' + 'x'*3000000 + '\"}')")"
# Expected: 413 Payload Too Large

# Test: user-data endpoint auth
curl -X GET http://localhost:3000/api/user-data/12345
# Expected: 401 (previously returned data without auth)
```

**Wave 3 — Database:**
```bash
cd telegram-bot
# Verify the bot starts without database.js (no SQLite)
node src/index.js
# Expected: No SQLite errors, bot starts normally

# Verify pairing still works through Postgres
# (Manual test via Telegram bot)
```

### Manual Verification
1. **Wave 1**: After deploying updated bot, try accessing `GET /api/user-data/<your-telegram-id>` without session token from browser → should get 401
2. **Wave 2**: After nginx setup, open `https://yourdomain.com/health` → should show `{"status":"ok"}`
3. **Wave 3**: Create a task via Telegram bot, then check it appears on Desktop app → confirms Postgres pairing works without SQLite
4. **Wave 5**: Run `npm run build` on the Electron app from a different machine/folder → confirms NSIS paths work as relative
