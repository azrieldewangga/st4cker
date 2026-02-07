#!/bin/bash
# Script to Migrate Data from Railway (PostgreSQL) -> Local VPS (Docker Postgres)
# RUN THIS FROM THE ROOT DIRECTORY (st4cker/)
# Usage: ./MIGRATE_DB.sh "YOUR_RAILWAY_DATABASE_URL"

# Default Arguments
RAILWAY_URL=$1
LOCAL_DB_USER="st4cker_admin"
LOCAL_DB_NAME="st4cker_db"

if [ -z "$RAILWAY_URL" ]; then
    echo "⚠️  Missing DATABASE_URL"
    echo "Usage: ./MIGRATE_DB.sh \"postgresql://user:pass@railway:port/dbname\""
    echo "P.S. Get the URL from your Railway Dashboard."
    exit 1
fi

echo "🚀 Starting Migration from Railway -> Local VPS Docker..."
echo "Target: user=$LOCAL_DB_USER db=$LOCAL_DB_NAME"

# 1. Start Docker Services (Ensure Local DB is UP)
echo "📦 Starting Docker Services from ROOT..."
docker-compose up -d postgres

# Wait for DB to be healthy
echo "⏳ Waiting for Local DB to be ready..."
sleep 15
until docker exec st4cker-db pg_isready -U $LOCAL_DB_USER -d $LOCAL_DB_NAME; do
  echo "Still waiting for database..."
  sleep 5
done

# 2. Dump Railway Data (Using Docker image to prevent dependency hell)
echo "⬇️  Dumping Data from Railway..."
# Using --rm to clean up the container after use
docker run --rm -v $(pwd):/backup postgres:15-alpine pg_dump "$RAILWAY_URL" -Fc -f /backup/railway_backup.dump

if [ ! -f railway_backup.dump ]; then
    echo "❌ Backup Failed! Please check your Railway URL."
    exit 1
fi
echo "✅ Dump Success: railway_backup.dump"

# 3. Restore to Local Docker Postgres
echo "⬆️  Restoring to Local DB..."
# Using --clean --if-exists to overwrite existing data safely
docker exec -i st4cker-db pg_restore -U $LOCAL_DB_USER -d $LOCAL_DB_NAME --clean --if-exists --no-owner --role=$LOCAL_DB_USER < railway_backup.dump

# 4. Cleanup Dump File
rm railway_backup.dump
echo "🧹 Cleaned up temporary dump file."

echo "✅ DATABASE MIGRATION COMPLETE! 🎉"
echo "Your data is now safe locally."
echo "You can now start the bot: docker-compose up -d --build st4cker-bot"
