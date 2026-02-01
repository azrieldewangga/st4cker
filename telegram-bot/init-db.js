import { db, checkConnection } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function init() {
    console.log('[DB-Init] Starting database initialization...');
    const connected = await checkConnection();
    if (!connected) {
        process.exit(1);
    }

    try {
        console.log('[DB-Init] Ensuring tables exist...');

        // Define the pairing_codes table if it doesn't exist
        // Drizzle doesn't have a simple db.createTables() for existing connections 
        // without drizzle-kit. We'll run raw SQL for now to be safe and fast.

        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS pairing_codes (
                code TEXT PRIMARY KEY,
                telegram_user_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                attempts INTEGER DEFAULT 0
            );
        `);

        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pairing_user ON pairing_codes(telegram_user_id);`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pairing_expires ON pairing_codes(expires_at);`);

        // Ensure users table exists (it should, but safety first)
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS users (
                telegram_user_id TEXT PRIMARY KEY,
                current_balance DOUBLE PRECISION DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                semester INTEGER DEFAULT 1,
                ipk DOUBLE PRECISION DEFAULT 0
            );
        `);

        // Ensure sessions table exists
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS sessions (
                session_token TEXT PRIMARY KEY,
                telegram_user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
                device_id TEXT NOT NULL,
                device_name TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP NOT NULL,
                last_activity TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(telegram_user_id);`);

        // Ensure devices table exists
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS devices (
                device_id TEXT PRIMARY KEY,
                telegram_user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
                device_name TEXT,
                enabled BOOLEAN DEFAULT TRUE,
                last_seen TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Ensure pending_events table exists
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS pending_events (
                event_id TEXT PRIMARY KEY,
                telegram_user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                event_data TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log('[DB-Init] Database initialization completed successfully.');
    } catch (error) {
        console.error('[DB-Init] Initialization failed:', error);
        process.exit(1);
    }
}

init();
