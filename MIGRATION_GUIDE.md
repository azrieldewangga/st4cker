# 🚀 St4cker VPS Migration Checklist

Use this guide to ensure you have completely migrated off Railway.

## 1. Verify Deployment
- [ ] Pull latest code: `git pull`
- [ ] Check `.env` (Should use local `POSTGRES_...` and NO Railway URL): `nano telegram-bot/.env`
- [ ] Check `docker-compose` (Should show `postgres` & `st4cker-bot`): `docker ps`

## 2. Verify Data
- [ ] Check Bot Tasks: `/listtasks` (Should match old data)
- [ ] Check User Balance: `/balance` (Should match old data)

## 3. Decommission Railway
Only proceed if Steps 1 & 2 are 100% successful.
- [ ] Go to Railway Dashboard.
- [ ] **Method A (Safe)**: Go to Settings -> "Pause Service" (Stop database).
- [ ] Test your bot again. If it works -> Migration is SOLID.
- [ ] **Method B (Final)**: Delete the service to stop billing.

## Troubleshooting
- **Bot Error "Connection Refused"**: Check `.env` credentials vs `docker-compose.yml`.
- **Data Missing**: Re-run `./MIGRATE_DB.sh` (Warning: Overwrites current data!).
