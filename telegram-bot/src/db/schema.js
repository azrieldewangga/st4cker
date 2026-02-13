
import { pgTable, text, integer, timestamp, serial, boolean, doublePrecision, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// --- Auth Tables ---

// Users table (Manages Telegram User IDs and Metadata)
export const users = pgTable('users', {
    telegramUserId: text('telegram_user_id').primaryKey(), // Using Telegram ID as unique identifier
    currentBalance: doublePrecision('current_balance').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),

    // Metadata prefs
    semester: integer('semester').default(1),
    ipk: doublePrecision('ipk').default(0),
});

// Sessions table (For desktop auth)
export const sessions = pgTable('sessions', {
    sessionToken: text('session_token').primaryKey(),
    telegramUserId: text('telegram_user_id').notNull().references(() => users.telegramUserId, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull(),
    deviceName: text('device_name'),
    createdAt: timestamp('created_at').defaultNow(),
    expiresAt: timestamp('expires_at').notNull(),
    lastActivity: timestamp('last_activity').defaultNow(),
}, (table) => {
    return {
        sessionUserIdx: index('idx_sessions_user').on(table.telegramUserId),
    };
});

// Devices table
export const devices = pgTable('devices', {
    deviceId: text('device_id').primaryKey(),
    telegramUserId: text('telegram_user_id').notNull().references(() => users.telegramUserId, { onDelete: 'cascade' }),
    deviceName: text('device_name'),
    enabled: boolean('enabled').default(true),
    lastSeen: timestamp('last_seen'),
    createdAt: timestamp('created_at').defaultNow(),
});

// --- Data Tables ---

// Transactions
export const transactions = pgTable('transactions', {
    id: text('id').primaryKey(), // UUID from Desktop
    userId: text('user_id').notNull().references(() => users.telegramUserId, { onDelete: 'cascade' }),
    title: text('title'),
    category: text('category'),
    amount: doublePrecision('amount').notNull(),
    currency: text('currency').default('IDR'),
    type: text('type').notNull(), // 'income' | 'expense'
    date: text('date').notNull(), // ISO Date String YYYY-MM-DD
    note: text('note'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
    return {
        trxUserIdx: index('idx_transactions_user').on(table.userId),
        trxDateIdx: index('idx_transactions_date').on(table.date),
    };
});

// Assignments (Tasks)
export const assignments = pgTable('assignments', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.telegramUserId, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    course: text('course'),
    type: text('type'), // 'Tugas' | 'Kuis' etc
    status: text('status').default('pending'),
    deadline: text('deadline'), // ISO Date
    note: text('note'),
    semester: integer('semester'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
    return {
        tskUserIdx: index('idx_assignments_user').on(table.userId),
        tskDeadlineIdx: index('idx_assignments_deadline').on(table.deadline),
    };
});

// Projects
export const projects = pgTable('projects', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.telegramUserId, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').default('active'),
    priority: text('priority').default('medium'),
    type: text('type').default('personal'), // 'personal' | 'course'
    courseId: text('course_id'),
    courseName: text('course_name'),
    totalProgress: integer('total_progress').default(0),
    deadline: text('deadline'),
    semester: integer('semester'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
    return {
        prjUserIdx: index('idx_projects_user').on(table.userId),
    };
});

// Project Log Sessions
export const projectSessions = pgTable('project_sessions', {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    sessionDate: text('session_date').notNull(),
    duration: integer('duration').default(0),
    note: text('note'),
    progressBefore: integer('progress_before'),
    progressAfter: integer('progress_after'),
    createdAt: timestamp('created_at').defaultNow(),
}, (table) => {
    return {
        sessionPrjIdx: index('idx_project_sessions_prj').on(table.projectId),
    };
});

// Pending Events (For Sync)
export const pendingEvents = pgTable('pending_events', {
    eventId: text('event_id').primaryKey(),
    telegramUserId: text('telegram_user_id').notNull().references(() => users.telegramUserId, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    eventData: text('event_data'), // JSON string
    createdAt: timestamp('created_at').defaultNow(), // Should use BigInt if storing Date.now(), or timestamp
});

// Pairing Codes table
export const pairingCodes = pgTable('pairing_codes', {
    code: text('code').primaryKey(),
    telegramUserId: text('telegram_user_id').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    expiresAt: timestamp('expires_at').notNull(),
    used: boolean('used').default(false),
    attempts: integer('attempts').default(0)
}, (table) => {
    return {
        pairingUserIdx: index('idx_pairing_user').on(table.telegramUserId),
        pairingExpiresIdx: index('idx_pairing_expires').on(table.expiresAt),
    };
});

// --- SCHEDULES / JADWAL KULIAH ---
export const schedules = pgTable('schedules', {
    id: text('id').primaryKey(), // UUID
    userId: text('user_id').notNull().references(() => users.telegramUserId, { onDelete: 'cascade' }),
    courseName: text('course_name').notNull(), // Nama matkul
    courseCode: text('course_code'), // Kode matkul (opsional)
    dayOfWeek: integer('day_of_week').notNull(), // 1=Senin, 2=Selasa, ..., 7=Minggu
    startTime: text('start_time').notNull(), // Format HH:MM (WIB)
    endTime: text('end_time'), // Format HH:MM (WIB), opsional
    room: text('room'), // Ruangan kelas
    lecturer: text('lecturer'), // Nama dosen
    isActive: boolean('is_active').default(true), // Aktif/tidak
    semester: integer('semester').default(4),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
    return {
        schedUserIdx: index('idx_schedules_user').on(table.userId),
        schedDayIdx: index('idx_schedules_day').on(table.dayOfWeek),
    };
});
