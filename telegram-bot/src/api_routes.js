import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { db } from './db/index.js';
import { assignments, projects, transactions, users, schedules, reminderLogs, reminderOverrides } from './db/schema.js';
import { eq, and, desc, like } from 'drizzle-orm';
import crypto from 'crypto';
import { broadcastEvent } from './server.js';

// Helper: Force date to end-of-day WIB (23:59:59 WIB = 16:59:59 UTC)
// Prevents +1 day shift when storing dates without explicit time
function toWIBEndOfDay(dateInput) {
    const d = new Date(dateInput);
    // If time is midnight UTC (just a date string like '2026-02-12'), 
    // set to 23:59:59 WIB to keep it on the correct calendar day
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
        d.setUTCHours(16, 59, 59, 0); // 23:59:59 WIB
    }
    return d;
}
import { getEntityCache } from './commands/task.js';

// Helper: Resolve course name from synonym/abbreviation
function resolveCourseName(input) {
    if (!input) return input;
    const entityCache = getEntityCache();
    if (entityCache && entityCache['matkul']) {
        const resolved = entityCache['matkul'].get(input.toLowerCase());
        if (resolved) {
            console.log(`[API] Resolved course: "${input}" -> "${resolved}"`);
            return resolved;
        }
    }
    return input;
}

const router = express.Router();

// Middleware: API Key Auth
const authenticateApiKey = (req, res, next) => {
    const VALID_API_KEY = process.env.AGENT_API_KEY;
    if (!VALID_API_KEY) {
        console.error('[AUTH] FATAL: AGENT_API_KEY env var is not set. Rejecting all API requests.');
        return res.status(503).json({ error: 'Server misconfigured: API key not set' });
    }

    const apiKey = req.header('x-api-key');
    if (!apiKey || apiKey !== VALID_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
    next();
};

router.use(authenticateApiKey);

// Helper: Validation Error Handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// ==========================================
// USER / BALANCE ENDPOINTS
// ==========================================

// GET /api/v1/balance
router.get('/balance', async (req, res) => {
    try {
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        const user = usersList[0];

        res.json({
            success: true,
            data: {
                currentBalance: user.currentBalance || 0,
                formattedBalance: `Rp${(user.currentBalance || 0).toLocaleString('id-ID')}`,
                semester: user.semester
            }
        });
    } catch (error) {
        console.error('[API] Get Balance Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/v1/summary
router.get('/summary', async (req, res) => {
    try {
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        const user = usersList[0];
        const userId = user.telegramUserId;

        const allTasks = await db.select().from(assignments)
            .where(eq(assignments.userId, userId));
        const allProjects = await db.select().from(projects)
            .where(eq(projects.userId, userId));
        const recentTx = await db.select().from(transactions)
            .where(eq(transactions.userId, userId))
            .orderBy(desc(transactions.date))
            .limit(5);

        const pendingTasks = allTasks.filter(t => t.status === 'pending');
        const upcomingDeadlines = pendingTasks
            .filter(t => t.deadline)
            .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
            .slice(0, 5)
            .map(t => ({ id: t.id, title: t.title, course: t.course, deadline: t.deadline }));

        res.json({
            success: true,
            data: {
                balance: {
                    current: user.currentBalance || 0,
                    formatted: `Rp${(user.currentBalance || 0).toLocaleString('id-ID')}`
                },
                tasks: {
                    total: allTasks.length,
                    pending: pendingTasks.length,
                    completed: allTasks.filter(t => t.status === 'completed').length
                },
                projects: {
                    total: allProjects.length,
                    active: allProjects.filter(p => p.status === 'active').length
                },
                upcomingDeadlines,
                recentTransactions: recentTx
            }
        });
    } catch (error) {
        console.error('[API] Get Summary Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// TASKS (ASSIGNMENTS) ENDPOINTS
// ==========================================

// GET /api/v1/tasks
router.get('/tasks', [
    query('status').optional().isIn(['pending', 'completed', 'missed']),
    query('course').optional().isString(),
    query('priority').optional().isIn(['low', 'medium', 'high']),
    handleValidationErrors
], async (req, res) => {
    try {
        const { status, course } = req.query;
        let conditions = [];

        // For now, assuming single user or taking user_id from query/header if multi-tenant
        // defaulting to the first user found or specific ID if needed.
        // ideally, the API Key should map to a user, or we pass telegramUserId
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        const defaultUserId = usersList[0].telegramUserId;

        conditions.push(eq(assignments.userId, defaultUserId));

        if (status) conditions.push(eq(assignments.status, status));
        if (course) conditions.push(like(assignments.course, `% ${course}% `));

        const tasks = await db.select().from(assignments)
            .where(and(...conditions))
            .orderBy(desc(assignments.deadline));

        res.json({ success: true, count: tasks.length, data: tasks });
    } catch (error) {
        console.error('[API] Get Tasks Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/v1/tasks/:id
router.get('/tasks/:id', [
    param('id').isUUID(),
    handleValidationErrors
], async (req, res) => {
    try {
        const task = await db.select().from(assignments).where(eq(assignments.id, req.params.id)).limit(1);
        if (task.length === 0) return res.status(404).json({ error: 'Task not found' });
        res.json({ success: true, data: task[0] });
    } catch (error) {
        console.error('[API] Get Task Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/v1/tasks
router.post('/tasks', [
    body('title').notEmpty().withMessage('Title is required'),
    body('course').notEmpty().withMessage('Course is required'),
    body('deadline').isISO8601().withMessage('Valid ISO Date required'),
    body('type').optional().isIn(['Tugas', 'Ujian', 'Kuis', 'Proyek', 'Laporan Pendahuluan', 'Laporan Sementara', 'Laporan Resmi'])
        .withMessage('Type must be one of: Tugas, Ujian, Kuis, Proyek, Laporan Pendahuluan, Laporan Sementara, Laporan Resmi'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id: clientId, title, course, deadline, note, type, priority } = req.body;

        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        const defaultUserId = usersList[0].telegramUserId;
        const userSemester = usersList[0].semester || 4;

        // Get Entity Cache for normalization
        const entityCache = getEntityCache();

        // 1. Normalize Course Name via Synonym Cache
        let normalizedCourse = course;
        if (entityCache && entityCache['matkul']) {
            const resolved = entityCache['matkul'].get(course.toLowerCase());
            if (resolved) {
                console.log(`[API] Resolved course: "${course}" -> "${resolved}"`);
                normalizedCourse = resolved;
            }
        }

        // 2. Normalize Task Type via Synonym Cache
        let normalizedType = type || 'Tugas';
        if (entityCache && entityCache['tipe_tugas']) {
            const resolvedType = entityCache['tipe_tugas'].get((type || 'tugas').toLowerCase());
            if (resolvedType) {
                console.log(`[API] Resolved type: "${type}" -> "${resolvedType}"`);
                normalizedType = resolvedType;
            }
        }

        // 3. Auto-Prefix "Praktikum " if task type is a report (Laporan*)
        if (normalizedType.toLowerCase().includes('laporan')) {
            if (!normalizedCourse.toLowerCase().startsWith('praktikum')) {
                normalizedCourse = 'Praktikum ' + normalizedCourse;
                console.log(`[API] Auto - prefixed Praktikum: "${normalizedCourse}"`);
            }
        }

        const newTask = {
            id: clientId || crypto.randomUUID(),
            userId: defaultUserId,
            title,
            course: normalizedCourse,
            deadline: toWIBEndOfDay(deadline),
            status: 'pending',
            type: normalizedType,
            note: note || '',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.insert(assignments).values(newTask);

        // Broadcast Event (skip if from Desktop to prevent echo loop)
        if (req.header('x-source') !== 'desktop') {
            await broadcastEvent(defaultUserId, {
                eventId: crypto.randomUUID(),
                eventType: 'task.created',
                payload: {
                    courseName: newTask.course,
                    type: newTask.type,
                    dueDate: newTask.deadline instanceof Date ? newTask.deadline.toISOString() : newTask.deadline,
                    notes: newTask.note,
                    semester: `Semester ${userSemester}`
                }
            });
        }

        res.status(201).json({ success: true, data: newTask });
    } catch (error) {
        console.error('[API] Create Task Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PATCH /api/v1/tasks/:id
router.patch('/tasks/:id', [
    param('id').isUUID(),
    body('status').optional().isIn(['pending', 'completed']),
    body('deadline').optional().isISO8601(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        updates.updatedAt = new Date();
        if (updates.deadline) updates.deadline = toWIBEndOfDay(updates.deadline);

        await db.update(assignments)
            .set(updates)
            .where(eq(assignments.id, id));

        // Broadcast Event
        // We need to fetch the updated task or construct the payload. Ideally fetch.
        // For efficiency, just send ID and updates
        const usersList = await db.select().from(users).limit(1);
        const defaultUserId = usersList[0].telegramUserId;

        await broadcastEvent(defaultUserId, {
            eventId: crypto.randomUUID(),
            eventType: 'task.updated',
            payload: {
                id,
                status: updates.status,
                title: updates.title,
                type: updates.type,
                course: updates.course,
                note: updates.note
            }
        });

        res.json({ success: true, message: 'Task updated' });
    } catch (error) {
        console.error('[API] Update Task Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /api/v1/tasks/:id
router.delete('/tasks/:id', [
    param('id').isUUID(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        await db.delete(assignments).where(eq(assignments.id, id));
        const usersList = await db.select().from(users).limit(1);
        const defaultUserId = usersList[0].telegramUserId;

        await broadcastEvent(defaultUserId, {
            eventId: crypto.randomUUID(),
            eventType: 'task.deleted',
            payload: { id }
        });

        res.json({ success: true, message: 'Task deleted' });
    } catch (error) {
        console.error('[API] Delete Task Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// PROJECTS ENDPOINTS
// ==========================================

// GET /api/v1/projects
router.get('/projects', [
    query('status').optional().isIn(['active', 'completed', 'archived']),
    handleValidationErrors
], async (req, res) => {
    try {
        const { status } = req.query;
        let conditions = [];

        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        const defaultUserId = usersList[0].telegramUserId;

        conditions.push(eq(projects.userId, defaultUserId));
        if (status) conditions.push(eq(projects.status, status));

        const data = await db.select().from(projects).where(and(...conditions));
        res.json({ success: true, count: data.length, data });
    } catch (error) {
        console.error('[API] Get Projects Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/v1/projects/:id
router.get('/projects/:id', [
    param('id').isUUID(),
    handleValidationErrors
], async (req, res) => {
    try {
        const project = await db.select().from(projects).where(eq(projects.id, req.params.id)).limit(1);
        if (project.length === 0) return res.status(404).json({ error: 'Project not found' });
        res.json({ success: true, data: project[0] });
    } catch (error) {
        console.error('[API] Get Project Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/v1/projects
router.post('/projects', [
    body('title').notEmpty().withMessage('Title is required'),
    body('status').optional().isIn(['active', 'completed', 'on_hold'])
        .withMessage('Status must be one of: active, completed, on_hold'),
    body('priority').optional().isIn(['low', 'medium', 'high'])
        .withMessage('Priority must be one of: low, medium, high'),
    body('type').optional().isIn(['personal', 'course'])
        .withMessage('Type must be one of: personal, course'),
    body('courseName').optional().isString(),
    body('description').optional().isString(),
    body('deadline').optional().isISO8601(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id: clientId, title, description, status, priority, deadline, type, courseName } = req.body;

        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        const defaultUserId = usersList[0].telegramUserId;

        // Normalize Course Name if provided
        let normalizedCourseName = courseName || null;
        if (courseName) {
            const entityCache = getEntityCache();
            if (entityCache && entityCache['matkul']) {
                const resolved = entityCache['matkul'].get(courseName.toLowerCase());
                if (resolved) {
                    console.log(`[API] Resolved project course: "${courseName}" -> "${resolved}"`);
                    normalizedCourseName = resolved;
                }
            }
        }

        const newProject = {
            id: clientId || crypto.randomUUID(),
            userId: defaultUserId,
            title,
            description: description || '',
            status: status || 'active',
            priority: priority || 'medium',
            type: type || 'personal',
            courseName: normalizedCourseName,
            deadline: deadline ? toWIBEndOfDay(deadline) : null,
            totalProgress: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.insert(projects).values(newProject);
        if (req.header('x-source') !== 'desktop') {
            await broadcastEvent(defaultUserId, {
                eventId: crypto.randomUUID(),
                eventType: 'project.created',
                payload: {
                    title: newProject.title,
                    description: newProject.description,
                    deadline: newProject.deadline instanceof Date ? newProject.deadline.toISOString() : newProject.deadline,
                    priority: newProject.priority,
                    type: newProject.type,
                    courseId: null,
                    courseName: newProject.courseName
                }
            });
        }

        res.status(201).json({ success: true, data: newProject });
    } catch (error) {
        console.error('[API] Create Project Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PATCH /api/v1/projects/:id
router.patch('/projects/:id', [
    param('id').isUUID(),
    body('status').optional().isIn(['active', 'completed', 'on_hold', 'archived'])
        .withMessage('Status must be one of: active, completed, on_hold, archived'),
    body('priority').optional().isIn(['low', 'medium', 'high'])
        .withMessage('Priority must be one of: low, medium, high'),
    body('type').optional().isIn(['personal', 'course'])
        .withMessage('Type must be one of: personal, course'),
    body('courseName').optional().isString(),
    body('title').optional().isString(),
    body('description').optional().isString(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        updates.updatedAt = new Date();

        await db.update(projects)
            .set(updates)
            .where(eq(projects.id, id));

        const usersList = await db.select().from(users).limit(1);
        const defaultUserId = usersList[0].telegramUserId;

        await broadcastEvent(defaultUserId, {
            eventId: crypto.randomUUID(),
            eventType: 'project.updated',
            payload: {
                id,
                updates: {
                    name: updates.title || undefined,
                    deadline: updates.deadline || undefined,
                    priority: updates.priority || undefined,
                    status: updates.status || undefined,
                    description: updates.description || undefined
                }
            }
        });

        res.json({ success: true, message: 'Project updated' });
    } catch (error) {
        console.error('[API] Update Project Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/v1/projects/:id/logs
router.post('/projects/:id/logs', [
    param('id').isUUID(),
    body('progress').isInt({ min: 0, max: 100 }).withMessage('Progress must be 0-100'),
    body('message').notEmpty().withMessage('Message is required - describe what you worked on'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        const { progress, message } = req.body;

        // 1. Update Project Progress
        await db.update(projects)
            .set({ totalProgress: progress, updatedAt: new Date() })
            .where(eq(projects.id, id));

        // 2. (Opt) Insert into logs table if exists, for now just update project

        const usersList = await db.select().from(users).limit(1);
        const defaultUserId = usersList[0].telegramUserId;

        await broadcastEvent(defaultUserId, {
            eventId: crypto.randomUUID(),
            eventType: 'progress.logged',
            payload: {
                projectId: id,
                progress: progress,
                note: message,
                duration: 0,
                loggedAt: new Date().toISOString()
            }
        });

        res.json({ success: true, message: 'Progress logged' });
    } catch (error) {
        console.error('[API] Log Progress Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /api/v1/projects/:id
router.delete('/projects/:id', [
    param('id').isUUID(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        await db.delete(projects).where(eq(projects.id, id));
        const usersList = await db.select().from(users).limit(1);
        const defaultUserId = usersList[0].telegramUserId;

        await broadcastEvent(defaultUserId, {
            eventId: crypto.randomUUID(),
            eventType: 'project.deleted',
            payload: { id }
        });

        res.json({ success: true, message: 'Project deleted' });
    } catch (error) {
        console.error('[API] Delete Project Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// TRANSACTIONS ENDPOINTS
// ==========================================

// GET /api/v1/transactions
router.get('/transactions', async (req, res) => {
    try {
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        const defaultUserId = usersList[0].telegramUserId;

        const data = await db.select().from(transactions)
            .where(eq(transactions.userId, defaultUserId))
            .orderBy(desc(transactions.date))
            .limit(50); // Limit to last 50 for safety

        res.json({ success: true, count: data.length, data });
    } catch (error) {
        console.error('[API] Get Transactions Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/v1/transactions/:id
router.get('/transactions/:id', [
    param('id').isUUID(),
    handleValidationErrors
], async (req, res) => {
    try {
        const tx = await db.select().from(transactions).where(eq(transactions.id, req.params.id)).limit(1);
        if (tx.length === 0) return res.status(404).json({ error: 'Transaction not found' });
        res.json({ success: true, data: tx[0] });
    } catch (error) {
        console.error('[API] Get Transaction Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/v1/transactions
router.post('/transactions', [
    body('amount').isNumeric(),
    body('type').isIn(['income', 'expense']),
    body('category').isIn(['Food', 'Transport', 'Shopping', 'Bills', 'Subscription', 'Transfer', 'Salary', 'Other'])
        .withMessage('Category must be one of: Food, Transport, Shopping, Bills, Subscription, Transfer, Salary, Other'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id: clientId, amount, type, category, title, date } = req.body;

        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        const defaultUserId = usersList[0].telegramUserId;

        const newTx = {
            id: clientId || crypto.randomUUID(),
            userId: defaultUserId,
            amount: parseFloat(amount),
            type,
            category,
            title: title || 'Untitled Transaction',
            date: date ? new Date(date) : new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.insert(transactions).values(newTx);

        // Update User Balance
        const currentUser = await db.select().from(users).where(eq(users.telegramUserId, defaultUserId)).limit(1);
        let newBalance = parseFloat(currentUser[0].currentBalance);
        if (type === 'income') newBalance += parseFloat(amount);
        else newBalance -= parseFloat(amount);

        await db.update(users)
            .set({ currentBalance: newBalance, updatedAt: new Date() })
            .where(eq(users.telegramUserId, defaultUserId));

        if (req.header('x-source') !== 'desktop') {
            await broadcastEvent(defaultUserId, {
                eventId: crypto.randomUUID(),
                eventType: 'transaction.created',
                payload: {
                    amount: newTx.amount,
                    type: newTx.type,
                    category: newTx.category,
                    note: newTx.title,
                    date: newTx.date instanceof Date ? newTx.date.toISOString() : newTx.date
                }
            });
        }

        // Also broadcast balance update? Maybe separate event or include in payload
        // For now, transaction lists usually trigger re-fetch of user data

        res.status(201).json({ success: true, data: newTx, newBalance });
    } catch (error) {
        console.error('[API] Create Transaction Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PATCH /api/v1/transactions/:id
router.patch('/transactions/:id', [
    param('id').isUUID(),
    body('amount').optional().isNumeric().withMessage('Amount must be a number'),
    body('category').optional().isIn(['Food', 'Transport', 'Shopping', 'Bills', 'Subscription', 'Transfer', 'Salary', 'Other'])
        .withMessage('Category must be one of: Food, Transport, Shopping, Bills, Subscription, Transfer, Salary, Other'),
    body('note').optional().isString(),
    body('title').optional().isString(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, category, note, title } = req.body;

        // Build updates object with only provided fields
        const updates = { updatedAt: new Date() };
        if (amount !== undefined) updates.amount = parseFloat(amount);
        if (category !== undefined) updates.category = category;
        if (note !== undefined) updates.note = note;
        if (title !== undefined) updates.title = title;

        await db.update(transactions)
            .set(updates)
            .where(eq(transactions.id, id));

        // Broadcast update event
        const usersList = await db.select().from(users).limit(1);
        const defaultUserId = usersList[0].telegramUserId;

        await broadcastEvent(defaultUserId, {
            eventId: crypto.randomUUID(),
            eventType: 'transaction.updated',
            payload: {
                id,
                updates: {
                    amount: updates.amount,
                    note: updates.title || updates.note
                }
            }
        });

        res.json({ success: true, message: 'Transaction updated' });
    } catch (error) {
        console.error('[API] Update Transaction Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /api/v1/transactions/:id
router.delete('/transactions/:id', [
    param('id').isUUID(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Get Tx logic to revert balance? 
        // For simplicity API v1, just delete record. 
        // Ideally we revert the balance change.

        await db.delete(transactions).where(eq(transactions.id, id));

        // Broadcast delete event
        const usersList = await db.select().from(users).limit(1);
        const defaultUserId = usersList[0].telegramUserId;

        await broadcastEvent(defaultUserId, {
            eventId: crypto.randomUUID(),
            eventType: 'transaction.deleted',
            payload: { id }
        });

        res.json({ success: true, message: 'Transaction deleted' });
    } catch (error) {
        console.error('[API] Delete Transaction Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// SCHEDULES (JADWAL KULIAH) ENDPOINTS
// ==========================================

// Helper: Day name to number
const DAY_MAP = {
    'senin': 1, 'selasa': 2, 'rabu': 3, 'kamis': 4, 'jumat': 5, 'sabtu': 6, 'minggu': 7,
    'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 7
};

function parseDay(dayInput) {
    if (typeof dayInput === 'number') return dayInput;
    const normalized = dayInput.toString().toLowerCase().trim();
    return DAY_MAP[normalized] || null;
}

// GET /api/v1/schedules
router.get('/schedules', [
    query('day').optional().isString(),
    query('active').optional().isBoolean(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { day, active } = req.query;
        
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        const defaultUserId = usersList[0].telegramUserId;

        let conditions = [eq(schedules.userId, defaultUserId)];
        
        if (day) {
            const dayNum = parseDay(day);
            if (dayNum) conditions.push(eq(schedules.dayOfWeek, dayNum));
        }
        if (active !== undefined) {
            conditions.push(eq(schedules.isActive, active === 'true'));
        }

        const data = await db.select().from(schedules)
            .where(and(...conditions))
            .orderBy(schedules.dayOfWeek, schedules.startTime);

        // Format response dengan nama hari
        const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        const formatted = data.map(s => ({
            ...s,
            dayName: dayNames[s.dayOfWeek],
        }));

        res.json({ success: true, count: data.length, data: formatted });
    } catch (error) {
        console.error('[API] Get Schedules Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/v1/schedules/:id
router.get('/schedules/:id', [
    param('id').isUUID(),
    handleValidationErrors
], async (req, res) => {
    try {
        const data = await db.select().from(schedules)
            .where(eq(schedules.id, req.params.id))
            .limit(1);
        if (data.length === 0) return res.status(404).json({ error: 'Schedule not found' });
        
        const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        res.json({ 
            success: true, 
            data: { ...data[0], dayName: dayNames[data[0].dayOfWeek] } 
        });
    } catch (error) {
        console.error('[API] Get Schedule Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/v1/schedules - Tambah matkul baru
router.post('/schedules', [
    body('courseName').notEmpty().withMessage('Nama matkul wajib diisi'),
    body('dayOfWeek').notEmpty().withMessage('Hari wajib diisi (1-7 atau nama hari)'),
    body('startTime').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Format jam HH:MM (contoh: 08:00)'),
    body('endTime').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Format jam HH:MM'),
    handleValidationErrors
], async (req, res) => {
    try {
        let { courseName, courseCode, dayOfWeek, startTime, endTime, room, lecturer, semester } = req.body;

        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        const defaultUserId = usersList[0].telegramUserId;
        const userSemester = usersList[0].semester || 4;

        const dayNum = parseDay(dayOfWeek);
        if (!dayNum) return res.status(400).json({ error: 'Hari tidak valid. Gunakan: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, atau Minggu' });

        // Resolve singkatan matkul (komber → Komputasi Bergerak)
        courseName = resolveCourseName(courseName);

        const newSchedule = {
            id: crypto.randomUUID(),
            userId: defaultUserId,
            courseName,
            courseCode: courseCode || null,
            dayOfWeek: dayNum,
            startTime,
            endTime: endTime || null,
            room: room || null,
            lecturer: lecturer || null,
            semester: semester || userSemester,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.insert(schedules).values(newSchedule);

        await broadcastEvent(defaultUserId, {
            eventId: crypto.randomUUID(),
            eventType: 'schedule.created',
            payload: newSchedule
        });

        res.status(201).json({ success: true, data: newSchedule });
    } catch (error) {
        console.error('[API] Create Schedule Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PATCH /api/v1/schedules/:id - Update jadwal (pindah hari/jam, ganti ruang/dosen)
router.patch('/schedules/:id', [
    param('id').isUUID(),
    body('dayOfWeek').optional().custom((value) => {
        if (parseDay(value)) return true;
        throw new Error('Hari tidak valid');
    }),
    body('startTime').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('endTime').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        updates.updatedAt = new Date();

        // Convert day name to number if provided
        if (updates.dayOfWeek) {
            updates.dayOfWeek = parseDay(updates.dayOfWeek);
        }

        // Resolve singkatan matkul jika courseName diupdate
        if (updates.courseName) {
            updates.courseName = resolveCourseName(updates.courseName);
        }

        await db.update(schedules)
            .set(updates)
            .where(eq(schedules.id, id));

        // Fetch updated record
        const updated = await db.select().from(schedules).where(eq(schedules.id, id)).limit(1);
        
        const usersList = await db.select().from(users).limit(1);
        const defaultUserId = usersList[0].telegramUserId;

        await broadcastEvent(defaultUserId, {
            eventId: crypto.randomUUID(),
            eventType: 'schedule.updated',
            payload: updated[0]
        });

        res.json({ success: true, message: 'Jadwal berhasil diupdate', data: updated[0] });
    } catch (error) {
        console.error('[API] Update Schedule Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /api/v1/schedules/:id - Hapus matkul
router.delete('/schedules/:id', [
    param('id').isUUID(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.delete(schedules).where(eq(schedules.id, id));
        
        const usersList = await db.select().from(users).limit(1);
        const defaultUserId = usersList[0].telegramUserId;

        await broadcastEvent(defaultUserId, {
            eventId: crypto.randomUUID(),
            eventType: 'schedule.deleted',
            payload: { id, courseName: 'deleted' }
        });

        res.json({ success: true, message: 'Matkul berhasil dihapus' });
    } catch (error) {
        console.error('[API] Delete Schedule Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// REMINDER ENDPOINTS (OpenClaw Integration)
// ==========================================

// GET /api/v1/reminders/today - Status reminder hari ini
router.get('/reminders/today', async (req, res) => {
    try {
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        const defaultUserId = usersList[0].telegramUserId;
        
        const today = new Date().toISOString().split('T')[0];
        const dayOfWeek = new Date().getDay() || 7; // 1=Senin, 7=Minggu
        
        // Ambil jadwal hari ini
        const todaysSchedules = await db.select().from(schedules)
            .where(and(
                eq(schedules.userId, defaultUserId),
                eq(schedules.dayOfWeek, dayOfWeek),
                eq(schedules.isActive, true)
            ))
            .orderBy(schedules.startTime);
        
        // Ambil log reminder hari ini
        const todayLogs = await db.select().from(reminderLogs)
            .where(and(
                eq(reminderLogs.userId, defaultUserId),
                eq(reminderLogs.reminderDate, today)
            ));
        
        // Ambil active override hari ini
        const todayOverride = await db.select().from(reminderOverrides)
            .where(and(
                eq(reminderOverrides.userId, defaultUserId),
                eq(reminderOverrides.overrideDate, today),
                eq(reminderOverrides.isActive, true)
            ))
            .limit(1);
        
        // Format response
        const scheduleStatus = todaysSchedules.map(sched => {
            const log = todayLogs.find(l => l.scheduleId === sched.id);
            return {
                id: sched.id,
                courseName: sched.courseName,
                startTime: sched.startTime,
                room: sched.room,
                lecturer: sched.lecturer,
                reminderSent: !!log,
                sentAt: log?.sentAt || null,
                reminderType: log?.type || null,
                userConfirmed: log?.userConfirmed || false,
                confirmedAt: log?.confirmedAt || null
            };
        });
        
        const confirmedCount = scheduleStatus.filter(s => s.userConfirmed).length;
        const pendingCount = scheduleStatus.length - confirmedCount;
        const allConfirmed = scheduleStatus.length > 0 && confirmedCount === scheduleStatus.length;
        
        res.json({
            success: true,
            date: today,
            dayOfWeek,
            overrideActive: todayOverride.length > 0,
            override: todayOverride[0] || null,
            totalSchedules: todaysSchedules.length,
            confirmedCount,
            pendingCount,
            allConfirmed,
            schedules: scheduleStatus
        });
    } catch (error) {
        console.error('[API] Get Today Reminders Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/v1/reminders/history - History 7 hari terakhir
router.get('/reminders/history', [
    query('days').optional().isInt({ min: 1, max: 30 }),
    handleValidationErrors
], async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        const defaultUserId = usersList[0].telegramUserId;
        
        // Hitung tanggal dari X hari yang lalu
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        const fromDateStr = fromDate.toISOString().split('T')[0];
        
        const logs = await db.select().from(reminderLogs)
            .where(and(
                eq(reminderLogs.userId, defaultUserId),
                sql`${reminderLogs.reminderDate} >= ${fromDateStr}`
            ))
            .orderBy(sql`${reminderLogs.reminderDate} DESC`);
        
        // Group by date
        const grouped = {};
        logs.forEach(log => {
            if (!grouped[log.reminderDate]) {
                grouped[log.reminderDate] = {
                    date: log.reminderDate,
                    totalReminders: 0,
                    userConfirmed: false,
                    confirmationTime: null,
                    courses: []
                };
            }
            grouped[log.reminderDate].totalReminders++;
            grouped[log.reminderDate].courses.push(log.messageContent?.split('\n')[0] || 'Unknown');
            if (log.userConfirmed) {
                grouped[log.reminderDate].userConfirmed = true;
                grouped[log.reminderDate].confirmationTime = log.confirmedAt;
            }
        });
        
        res.json({
            success: true,
            days,
            history: Object.values(grouped)
        });
    } catch (error) {
        console.error('[API] Get Reminder History Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/v1/reminders/override - Skip/pause reminder
router.post('/reminders/override', [
    body('date').isISO8601().withMessage('Format tanggal YYYY-MM-DD'),
    body('action').isIn(['skip_all', 'custom_time']).withMessage('Action: skip_all atau custom_time'),
    body('reason').optional().isString(),
    body('customTime').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    handleValidationErrors
], async (req, res) => {
    try {
        const { date, action, reason, customTime } = req.body;
        
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        const defaultUserId = usersList[0].telegramUserId;
        
        // Nonaktifkan override lama untuk tanggal yang sama
        await db.update(reminderOverrides)
            .set({ isActive: false })
            .where(and(
                eq(reminderOverrides.userId, defaultUserId),
                eq(reminderOverrides.overrideDate, date)
            ));
        
        // Buat override baru
        const newOverride = {
            id: crypto.randomUUID(),
            userId: defaultUserId,
            overrideDate: date,
            action,
            reason: reason || null,
            customTime: customTime || null,
            isActive: true,
            createdAt: new Date()
        };
        
        await db.insert(reminderOverrides).values(newOverride);
        
        res.json({
            success: true,
            message: action === 'skip_all' 
                ? `Reminder untuk ${date} akan di-skip`
                : `Reminder untuk ${date} di-set ke jam ${customTime}`,
            override: newOverride
        });
    } catch (error) {
        console.error('[API] Create Override Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/v1/reminders/overrides - List active overrides
router.get('/reminders/overrides', async (req, res) => {
    try {
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        const defaultUserId = usersList[0].telegramUserId;
        
        const today = new Date().toISOString().split('T')[0];
        
        const overrides = await db.select().from(reminderOverrides)
            .where(and(
                eq(reminderOverrides.userId, defaultUserId),
                eq(reminderOverrides.isActive, true),
                sql`${reminderOverrides.overrideDate} >= ${today}`
            ))
            .orderBy(reminderOverrides.overrideDate);
        
        res.json({
            success: true,
            count: overrides.length,
            overrides
        });
    } catch (error) {
        console.error('[API] Get Overrides Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /api/v1/reminders/overrides/:id - Cancel override
router.delete('/reminders/overrides/:id', [
    param('id').isUUID(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.update(reminderOverrides)
            .set({ isActive: false })
            .where(eq(reminderOverrides.id, id));
        
        res.json({ success: true, message: 'Override dibatalkan' });
    } catch (error) {
        console.error('[API] Cancel Override Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
