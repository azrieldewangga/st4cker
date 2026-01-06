import Database from 'better-sqlite3';

export const initSchema = (db: Database.Database) => {


    const schema = `
    CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
    );

    CREATE TABLE IF NOT EXISTS assignments (
        id TEXT PRIMARY KEY,
        title TEXT,
        course TEXT,
        type TEXT,
        status TEXT,
        deadline TEXT,
        note TEXT,
        semester INTEGER,
        createdAt TEXT,
        updatedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON assignments(deadline);
    CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);

    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        title TEXT,
        category TEXT,
        amount REAL,
        currency TEXT,
        date TEXT,
        type TEXT,
        createdAt TEXT,
        updatedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_currency ON transactions(currency);

    CREATE TABLE IF NOT EXISTS performance_semesters (
        semester INTEGER PRIMARY KEY,
        ips REAL
    );

    CREATE TABLE IF NOT EXISTS performance_courses (
        id TEXT PRIMARY KEY,
        semester INTEGER,
        name TEXT,
        sks INTEGER,
        grade TEXT,
        updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS schedule_items (
        id TEXT PRIMARY KEY,
        day TEXT,
        startTime TEXT,
        endTime TEXT,
        course TEXT,
        location TEXT,
        note TEXT,
        updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS course_materials (
        id TEXT PRIMARY KEY,
        course_id TEXT,
        type TEXT, -- 'link' | 'file'
        title TEXT,
        url TEXT, -- URL or File Path
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        name TEXT,
        cost REAL,
        dueDay INTEGER,
        lastPaidDate TEXT,
        createdAt TEXT,
        updatedAt TEXT
    );

    -- Additional Performance Indices (Phase 6)
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_date_type ON transactions(date, type);
    CREATE INDEX IF NOT EXISTS idx_assignments_semester ON assignments(semester);
    CREATE INDEX IF NOT EXISTS idx_courses_semester ON performance_courses(semester);

    `;

    db.exec(schema);

    // Migration: Add semester column to assignments if it doesn't exist
    try {
        db.prepare("ALTER TABLE assignments ADD COLUMN semester INTEGER").run();
    } catch (error: any) {
        if (!error.message.includes('duplicate column name')) console.error('Migration error (assignments):', error);
    }

    // Migration: Add lecturer column to schedule_items if it doesn't exist
    try {
        db.prepare("ALTER TABLE schedule_items ADD COLUMN lecturer TEXT").run();
    } catch (error: any) {
        if (!error.message.includes('duplicate column name')) console.error('Migration error (schedule_items):', error);
    }

    // Migration: Add location and lecturer to performance_courses if it doesn't exist
    try {
        db.prepare("ALTER TABLE performance_courses ADD COLUMN location TEXT").run();
    } catch (error: any) {
        if (!error.message.includes('duplicate column name')) console.error('Migration error (performance_courses location):', error);
    }
    try {
        db.prepare("ALTER TABLE performance_courses ADD COLUMN lecturer TEXT").run();
    } catch (error: any) {
        if (!error.message.includes('duplicate column name')) console.error('Migration error (performance_courses lecturer):', error);
    }

    // DEBUG: Check Columns
    try {
        const cols = db.pragma('table_info(schedule_items)');
        console.log('[DEBUG-SCHEMA] schedule_items columns:', cols);
        const courseCols = db.pragma('table_info(performance_courses)');
        console.log('[DEBUG-SCHEMA] performance_courses columns:', courseCols);

        // VERIFICATION: Check Indices (Phase 6)
        const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as { name: string }[];
        const indexNames = indices.map(i => i.name);
        const expectedIndices = [
            'idx_transactions_type',
            'idx_transactions_date_type',
            'idx_assignments_semester',
            'idx_courses_semester'
        ];
        const missing = expectedIndices.filter(i => !indexNames.includes(i));
        if (missing.length === 0) {
            console.log('✅ [DB-VERIFY] SUCCESS: All optimization indices are present.');
        } else {
            console.error('❌ [DB-VERIFY] FAILED: Missing indices:', missing);
        }
    } catch (e) {
        console.error('[DEBUG-SCHEMA] Error getting information:', e);
    }
};
