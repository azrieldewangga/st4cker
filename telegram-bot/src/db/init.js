import { db, checkConnection } from './index.js';
import { sql } from 'drizzle-orm';

export async function initDatabase() {
    console.log('[DB-Init] Starting database initialization...');
    const connected = await checkConnection();
    if (!connected) {
        console.error('[DB-Init] Cannot connect to database, skipping initialization');
        return;
    }

    try {
        console.log('[DB-Init] Ensuring tables exist...');

        // Create users table first (referenced by others)
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

        // Create pairing_codes table
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

        // Create sessions table
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

        // Create devices table
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

        // Create pending_events table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS pending_events (
                event_id TEXT PRIMARY KEY,
                telegram_user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                event_data TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Create outbox table (for reminder-bot messenger)
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS outbox (
                id SERIAL PRIMARY KEY,
                message TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW(),
                sent_at TIMESTAMP
            );
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, created_at);`);

        // Create schedules table (for reminder-bot)
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS schedules (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
                course_name TEXT NOT NULL,
                course_code TEXT,
                day_of_week INTEGER NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                room TEXT,
                lecturer TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                semester INTEGER DEFAULT 4,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_schedules_user ON schedules(user_id);`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_schedules_day ON schedules(day_of_week);`);

        // Create assignments table (for reminder-bot)
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS assignments (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                course TEXT,
                type TEXT,
                status TEXT DEFAULT 'pending',
                deadline TEXT,
                note TEXT,
                semester INTEGER,
                progress INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_assignments_user ON assignments(user_id);`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON assignments(deadline);`);

        // Create transactions table (for financial tracking)
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
                title TEXT,
                category TEXT,
                amount DOUBLE PRECISION NOT NULL,
                currency TEXT DEFAULT 'IDR',
                type TEXT NOT NULL,
                date TEXT NOT NULL,
                note TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);`);

        // Create projects table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'active',
                priority TEXT DEFAULT 'medium',
                type TEXT DEFAULT 'personal',
                course_id TEXT,
                course_name TEXT,
                total_progress INTEGER DEFAULT 0,
                deadline TEXT,
                semester INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);`);

        // Create project_sessions table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS project_sessions (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                session_date TEXT NOT NULL,
                duration INTEGER DEFAULT 0,
                note TEXT,
                progress_before INTEGER,
                progress_after INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_project_sessions_prj ON project_sessions(project_id);`);

        // Create reminder_logs table (schedule_id is nullable for task reminders)
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS reminder_logs (
                id TEXT PRIMARY KEY,
                schedule_id TEXT REFERENCES schedules(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
                sent_at TIMESTAMP DEFAULT NOW(),
                type TEXT NOT NULL,
                message_content TEXT,
                user_confirmed BOOLEAN DEFAULT FALSE,
                confirmed_at TIMESTAMP,
                confirmed_message TEXT,
                reminder_date TEXT NOT NULL
            );
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminder_logs_user ON reminder_logs(user_id);`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminder_logs_date ON reminder_logs(reminder_date);`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminder_logs_schedule ON reminder_logs(schedule_id);`);

        // Create reminder_overrides table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS reminder_overrides (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
                override_date TEXT NOT NULL,
                action TEXT NOT NULL,
                reason TEXT,
                custom_time TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE
            );
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminder_overrides_user ON reminder_overrides(user_id);`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminder_overrides_date ON reminder_overrides(override_date);`);

        // Create schedule_cancellations table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS schedule_cancellations (
                id TEXT PRIMARY KEY,
                schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(telegram_user_id) ON DELETE CASCADE,
                cancel_date TEXT NOT NULL,
                reason TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_schedule_cancellations_user ON schedule_cancellations(user_id);`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_schedule_cancellations_schedule ON schedule_cancellations(schedule_id);`);
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_schedule_cancellations_date ON schedule_cancellations(cancel_date);`);

        console.log('[DB-Init] Database initialization completed successfully.');
    } catch (error) {
        console.error('[DB-Init] Initialization failed:', error);
        // Don't exit, just log error - app can still run without DB for some features
    }
}
