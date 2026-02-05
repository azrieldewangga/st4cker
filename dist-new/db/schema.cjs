"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSchema = void 0;
const initSchema = (db) => {
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

    -- Project Progress Tracking Tables
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        courseId TEXT,
        description TEXT,
        startDate TEXT NOT NULL,
        deadline TEXT NOT NULL,
        totalProgress INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        priority TEXT DEFAULT 'medium',
        semester INTEGER,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        lastSessionDate TEXT
    );

    CREATE TABLE IF NOT EXISTS project_sessions (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        sessionDate TEXT NOT NULL,
        duration INTEGER NOT NULL,
        note TEXT,
        progressBefore INTEGER NOT NULL,
        progressAfter INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_attachments (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        size INTEGER,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Additional Performance Indices (Phase 6)
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_date_type ON transactions(date, type);
    CREATE INDEX IF NOT EXISTS idx_assignments_semester ON assignments(semester);
    CREATE INDEX IF NOT EXISTS idx_courses_semester ON performance_courses(semester);

    -- Project Progress Tracking Indices
    CREATE INDEX IF NOT EXISTS idx_projects_deadline ON projects(deadline);
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_semester ON projects(semester);
    CREATE INDEX IF NOT EXISTS idx_projects_priority ON projects(priority);
    CREATE INDEX IF NOT EXISTS idx_project_sessions_projectId ON project_sessions(projectId);
    CREATE INDEX IF NOT EXISTS idx_project_sessions_date ON project_sessions(sessionDate);
    CREATE INDEX IF NOT EXISTS idx_project_attachments_projectId ON project_attachments(projectId);

    CREATE TABLE IF NOT EXISTS applied_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        applied_at INTEGER NOT NULL,
        source TEXT NOT NULL, -- 'websocket' or 'drive'
        payload_hash TEXT     -- For extra verification
    );

    CREATE INDEX IF NOT EXISTS idx_applied_at ON applied_events(applied_at);
    CREATE INDEX IF NOT EXISTS idx_event_type ON applied_events(event_type);

    `;
    db.exec(schema);
    // Migration: Add semester column to assignments if it doesn't exist
    try {
        db.prepare("ALTER TABLE assignments ADD COLUMN semester INTEGER").run();
    }
    catch (error) {
        if (!error.message.includes('duplicate column name'))
            console.error('Migration error (assignments):', error);
    }
    // Migration: Add lecturer column to schedule_items if it doesn't exist
    try {
        db.prepare("ALTER TABLE schedule_items ADD COLUMN lecturer TEXT").run();
    }
    catch (error) {
        if (!error.message.includes('duplicate column name'))
            console.error('Migration error (schedule_items):', error);
    }
    // Migration: Add location and lecturer to performance_courses if it doesn't exist
    try {
        db.prepare("ALTER TABLE performance_courses ADD COLUMN location TEXT").run();
    }
    catch (error) {
        if (!error.message.includes('duplicate column name'))
            console.error('Migration error (performance_courses location):', error);
    }
    try {
        db.prepare("ALTER TABLE performance_courses ADD COLUMN lecturer TEXT").run();
    }
    catch (error) {
        if (!error.message.includes('duplicate column name'))
            console.error('Migration error (performance_courses lecturer):', error);
    }
    // DEBUG: Check Columns
    try {
        const cols = db.pragma('table_info(schedule_items)');
        console.log('[DEBUG-SCHEMA] schedule_items columns:', cols);
        const courseCols = db.pragma('table_info(performance_courses)');
        console.log('[DEBUG-SCHEMA] performance_courses columns:', courseCols);
        // VERIFICATION: Check Indices (Phase 6)
        const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all();
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
        }
        else {
            console.error('❌ [DB-VERIFY] FAILED: Missing indices:', missing);
        }
    }
    catch (e) {
        console.error('[DEBUG-SCHEMA] Error getting information:', e);
    }
};
exports.initSchema = initSchema;
