import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { db } from './db/index.js';
import { assignments, projects, transactions, users, schedules, reminderLogs, reminderOverrides, scheduleCancellations, userCourseNames } from './db/schema.js';
import { eq, and, desc, like, sql } from 'drizzle-orm';
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

// Public endpoint for OpenClaw to get schedules (used for AI responses)
router.get('/schedules/public', async (req, res) => {
    try {
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) {
            return res.json({ success: true, data: [] });
        }
        const userId = usersList[0].telegramUserId;
        
        const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        const data = await db.select()
            .from(schedules)
            .where(eq(schedules.userId, userId))
            .orderBy(schedules.dayOfWeek, schedules.startTime);
        
        const formatted = data.map(s => ({
            ...s,
            dayName: dayNames[s.dayOfWeek],
        }));
        
        res.json({ success: true, count: data.length, data: formatted });
    } catch (error) {
        console.error('[API] Public Schedules Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Middleware: Session-based Auth (multi-user mode)
// Priority: 1) Session Token 2) API Key (fallback to default user)
import { sessions } from './db/schema.js';
const authenticateSessionOrApiKey = async (req, res, next) => {
    const VALID_API_KEY = process.env.AGENT_API_KEY;
    
    // Try session token first (multi-user mode)
    const sessionToken = req.header('x-session-token') || req.query.sessionToken;
    
    if (sessionToken) {
        try {
            const { eq, and, gt } = await import('drizzle-orm');
            const session = await db.select().from(sessions)
                .where(and(eq(sessions.sessionToken, sessionToken), gt(sessions.expiresAt, new Date())))
                .limit(1);
            
            if (session.length > 0) {
                req.userId = session[0].telegramUserId;
                req.authMethod = 'session';
                return next();
            }
        } catch (err) {
            console.error('[AUTH] Session validation error:', err);
        }
    }
    
    // Fallback to API key (single-user mode)
    if (!VALID_API_KEY) {
        console.error('[AUTH] FATAL: AGENT_API_KEY env var is not set.');
        return res.status(503).json({ error: 'Server misconfigured' });
    }

    const apiKey = req.header('x-api-key');
    if (!apiKey || apiKey !== VALID_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid credentials' });
    }
    
    // API key valid - use default user (first user in DB)
    try {
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) {
            return res.status(404).json({ error: 'No users found' });
        }
        req.userId = usersList[0].telegramUserId;
        req.authMethod = 'apikey';
        next();
    } catch (err) {
        console.error('[AUTH] Error fetching default user:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

// Apply session-based auth untuk semua routes (kecuali public schedules)
router.use(authenticateSessionOrApiKey);

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
        const userId = usersList[0].telegramUserId;

        conditions.push(eq(assignments.userId, userId));

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
        const task = await db.select().from(assignments)
            .where(and(eq(assignments.id, req.params.id), eq(assignments.userId, req.userId)))
            .limit(1);
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
        const userId = usersList[0].telegramUserId;
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
            userId: userId || req.userId,
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
            await broadcastEvent(userId || req.userId, {
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

        // Check if task exists and belongs to user
        const existingTask = await db.select().from(assignments)
            .where(and(eq(assignments.id, id), eq(assignments.userId, req.userId)))
            .limit(1);
        
        if (existingTask.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        await db.update(assignments)
            .set(updates)
            .where(and(eq(assignments.id, id), eq(assignments.userId, req.userId)));

        // Broadcast Event
        // We need to fetch the updated task or construct the payload. Ideally fetch.
        // For efficiency, just send ID and updates
        const usersList = await db.select().from(users).limit(1);
        // Using req.userId from auth middleware

        await broadcastEvent(req.userId, {
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
        
        // Check if task exists and belongs to user
        const existingTask = await db.select().from(assignments)
            .where(and(eq(assignments.id, id), eq(assignments.userId, req.userId)))
            .limit(1);
        
        if (existingTask.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        await db.delete(assignments).where(and(eq(assignments.id, id), eq(assignments.userId, req.userId)));
        const usersList = await db.select().from(users).limit(1);
        // Using req.userId from auth middleware

        await broadcastEvent(req.userId, {
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
        const userId = usersList[0].telegramUserId;

        conditions.push(eq(projects.userId, userId));
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
        const project = await db.select().from(projects)
            .where(and(eq(projects.id, req.params.id), eq(projects.userId, req.userId)))
            .limit(1);
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
        // Using req.userId from auth middleware

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
            userId: userId || req.userId,
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
            await broadcastEvent(userId || req.userId, {
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

        // Check if project exists and belongs to user
        const existingProject = await db.select().from(projects)
            .where(and(eq(projects.id, id), eq(projects.userId, req.userId)))
            .limit(1);
        
        if (existingProject.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        await db.update(projects)
            .set(updates)
            .where(and(eq(projects.id, id), eq(projects.userId, req.userId)));

        const usersList = await db.select().from(users).limit(1);
        // Using req.userId from auth middleware

        await broadcastEvent(req.userId, {
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
        // Using req.userId from auth middleware

        await broadcastEvent(req.userId, {
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
        
        // Check if project exists and belongs to user
        const existingProject = await db.select().from(projects)
            .where(and(eq(projects.id, id), eq(projects.userId, req.userId)))
            .limit(1);
        
        if (existingProject.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, req.userId)));
        const usersList = await db.select().from(users).limit(1);
        // Using req.userId from auth middleware

        await broadcastEvent(req.userId, {
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
        const userId = usersList[0].telegramUserId;

        const data = await db.select().from(transactions)
            .where(eq(transactions.userId, userId))
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
        const tx = await db.select().from(transactions)
            .where(and(eq(transactions.id, req.params.id), eq(transactions.userId, req.userId)))
            .limit(1);
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
        // Using req.userId from auth middleware

        const newTx = {
            id: clientId || crypto.randomUUID(),
            userId: req.userId,
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
        const currentUser = await db.select().from(users).where(eq(users.telegramUserId, req.userId)).limit(1);
        let newBalance = parseFloat(currentUser[0].currentBalance);
        if (type === 'income') newBalance += parseFloat(amount);
        else newBalance -= parseFloat(amount);

        await db.update(users)
            .set({ currentBalance: newBalance, updatedAt: new Date() })
            .where(eq(users.telegramUserId, req.userId));

        if (req.header('x-source') !== 'desktop') {
            await broadcastEvent(req.userId, {
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

        // Check if transaction exists and belongs to user
        const existingTx = await db.select().from(transactions)
            .where(and(eq(transactions.id, id), eq(transactions.userId, req.userId)))
            .limit(1);
        
        if (existingTx.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        await db.update(transactions)
            .set(updates)
            .where(and(eq(transactions.id, id), eq(transactions.userId, req.userId)));

        // Broadcast update event
        const usersList = await db.select().from(users).limit(1);
        // Using req.userId from auth middleware

        await broadcastEvent(req.userId, {
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

        // Check if transaction exists and belongs to user
        const existingTx = await db.select().from(transactions)
            .where(and(eq(transactions.id, id), eq(transactions.userId, req.userId)))
            .limit(1);
        
        if (existingTx.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // 1. Get Tx logic to revert balance? 
        // For simplicity API v1, just delete record. 
        // Ideally we revert the balance change.

        await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, req.userId)));

        // Broadcast delete event
        const usersList = await db.select().from(users).limit(1);
        // Using req.userId from auth middleware

        await broadcastEvent(req.userId, {
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
        const userId = usersList[0].telegramUserId;

        let conditions = [eq(schedules.userId, userId)];
        
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
// POST /api/v1/schedules/sync - Bulk sync schedules from desktop app with timestamp-based conflict resolution
router.post('/schedules/sync', async (req, res) => {
    try {
        const { schedules: schedulesData, clientTimestamp, modifiedBy = 'app' } = req.body;
        const usersList = await db.select().from(users).limit(1);
        
        if (usersList.length === 0) {
            return res.status(400).json({ error: 'No users found' });
        }
        
        // Using req.userId from auth middleware
        const now = new Date();
        const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        
        let created = 0, updated = 0, skipped = 0;
        const changedSchedules = [];
        
        // Upsert each schedule dengan timestamp comparison
        for (const item of schedulesData) {
            const dayNum = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].indexOf(item.day) + 1;
            if (dayNum === 0) continue; // Skip invalid day
            
            // Check if schedule exists
            const existing = await db.select()
                .from(schedules)
                .where(eq(schedules.id, item.id))
                .limit(1);
            
            const scheduleData = {
                id: item.id || crypto.randomUUID(),
                userId: req.userId,
                courseName: item.course,
                courseCode: item.course?.substring(0, 3).toUpperCase(),
                dayOfWeek: dayNum,
                startTime: item.startTime,
                endTime: item.endTime || '',
                room: item.location || '',
                lecturer: item.lecturer || '',
                isActive: item.isActive ?? true,
                semester: item.semester || 1,
                createdAt: now,
                updatedAt: now,
                lastModifiedAt: now,
                modifiedBy: modifiedBy
            };
            
            if (existing.length === 0) {
                // New schedule - create
                await db.insert(schedules).values(scheduleData);
                created++;
                changedSchedules.push({ ...scheduleData, dayName: dayNames[dayNum], action: 'created' });
            } else {
                // Existing schedule - check timestamp for conflict resolution
                const serverLastModified = new Date(existing[0].lastModifiedAt || existing[0].updatedAt);
                const clientLastModified = new Date(item.lastModifiedAt || clientTimestamp || now);
                
                // Only update if client data is newer (or same time but different content)
                if (clientLastModified >= serverLastModified) {
                    await db.update(schedules)
                        .set(scheduleData)
                        .where(eq(schedules.id, item.id));
                    updated++;
                    changedSchedules.push({ ...scheduleData, dayName: dayNames[dayNum], action: 'updated' });
                } else {
                    // Server has newer data, skip this item
                    skipped++;
                }
            }
        }
        
        // Broadcast changes ke semua connected clients
        if (changedSchedules.length > 0) {
            await broadcastEvent(req.userId, {
                eventId: crypto.randomUUID(),
                eventType: 'schedule.synced',
                payload: {
                    schedules: changedSchedules,
                    timestamp: now.toISOString(),
                    summary: { created, updated, skipped }
                }
            });
        }
        
        res.json({ 
            success: true, 
            count: schedulesData.length,
            summary: { created, updated, skipped },
            serverTimestamp: now.toISOString()
        });
    } catch (error) {
        console.error('[API] Sync Schedules Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET /api/v1/schedules/sync-status - Get last modified timestamp for sync detection
router.get('/schedules/sync-status', async (req, res) => {
    try {
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) {
            return res.status(400).json({ error: 'No users found' });
        }
        
        // Using req.userId from auth middleware
        
        // Get last modified schedule
        const lastModified = await db.select()
            .from(schedules)
            .where(eq(schedules.userId, req.userId))
            .orderBy(desc(schedules.lastModifiedAt))
            .limit(1);
        
        // Get total count
        const count = await db.select({ count: sql`COUNT(*)` })
            .from(schedules)
            .where(eq(schedules.userId, req.userId));
        
        res.json({
            success: true,
            lastModifiedAt: lastModified[0]?.lastModifiedAt || null,
            lastModifiedBy: lastModified[0]?.modifiedBy || null,
            totalCount: count[0]?.count || 0,
            serverTimestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] Sync Status Error:', error);
        res.status(500).json({ error: error.message });
    }
});


// GET /api/v1/schedules/:id
router.get('/schedules/:id', [
    param('id').isUUID(),
    handleValidationErrors
], async (req, res) => {
    try {
        const data = await db.select().from(schedules)
            .where(and(eq(schedules.id, req.params.id), eq(schedules.userId, req.userId)))
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
        const userId = usersList[0].telegramUserId;
        const userSemester = usersList[0].semester || 4;

        const dayNum = parseDay(dayOfWeek);
        if (!dayNum) return res.status(400).json({ error: 'Hari tidak valid. Gunakan: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, atau Minggu' });

        // Resolve singkatan matkul (komber → Komputasi Bergerak)
        courseName = resolveCourseName(courseName);

        const now = new Date();
        const modifiedBy = req.body.modifiedBy || 'app';
        
        const newSchedule = {
            id: crypto.randomUUID(),
            userId: userId || req.userId,
            courseName,
            courseCode: courseCode || null,
            dayOfWeek: dayNum,
            startTime,
            endTime: endTime || null,
            room: room || null,
            lecturer: lecturer || null,
            semester: semester || userSemester,
            isActive: true,
            createdAt: now,
            updatedAt: now,
            lastModifiedAt: now,
            modifiedBy: modifiedBy
        };

        await db.insert(schedules).values(newSchedule);

        // Broadcast ke semua connected clients untuk real-time sync
        await broadcastEvent(userId || req.userId, {
            eventId: crypto.randomUUID(),
            eventType: 'schedule.created',
            payload: { 
                schedule: { ...newSchedule, dayName: ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'][dayNum] },
                timestamp: now.toISOString()
            }
        });

        await broadcastEvent(userId || req.userId, {
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
        const now = new Date();
        
        updates.updatedAt = now;
        updates.lastModifiedAt = now;
        updates.modifiedBy = updates.modifiedBy || 'app';

        // Convert day name to number if provided
        if (updates.dayOfWeek) {
            updates.dayOfWeek = parseDay(updates.dayOfWeek);
        }

        // Resolve singkatan matkul jika courseName diupdate
        if (updates.courseName) {
            updates.courseName = resolveCourseName(updates.courseName);
        }

        // Check if schedule exists and belongs to user
        const existingSchedule = await db.select().from(schedules)
            .where(and(eq(schedules.id, id), eq(schedules.userId, req.userId)))
            .limit(1);
        
        if (existingSchedule.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        await db.update(schedules)
            .set(updates)
            .where(and(eq(schedules.id, id), eq(schedules.userId, req.userId)));

        // Fetch updated record
        const updated = await db.select().from(schedules)
            .where(and(eq(schedules.id, id), eq(schedules.userId, req.userId)))
            .limit(1);
        
        // Broadcast dengan timestamp untuk real-time sync
        const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        await broadcastEvent(req.userId, {
            eventId: crypto.randomUUID(),
            eventType: 'schedule.updated',
            payload: { 
                schedule: { ...updated[0], dayName: dayNames[updated[0].dayOfWeek] },
                timestamp: now.toISOString()
            }
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
        const now = new Date();
        
        // Get schedule info before delete for broadcast
        const scheduleToDelete = await db.select().from(schedules)
            .where(and(eq(schedules.id, id), eq(schedules.userId, req.userId)))
            .limit(1);
        
        if (scheduleToDelete.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        
        const courseName = scheduleToDelete[0]?.courseName || 'Unknown';
        
        await db.delete(schedules).where(and(eq(schedules.id, id), eq(schedules.userId, req.userId)));
        
        const usersList = await db.select().from(users).limit(1);
        // Using req.userId from auth middleware

        // Broadcast dengan timestamp untuk real-time sync
        await broadcastEvent(req.userId, {
            eventId: crypto.randomUUID(),
            eventType: 'schedule.deleted',
            payload: { 
                id, 
                courseName,
                timestamp: now.toISOString()
            }
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
        // Using req.userId from auth middleware
        
        const today = new Date().toISOString().split('T')[0];
        const dayOfWeek = new Date().getDay() || 7; // 1=Senin, 7=Minggu
        
        // Ambil jadwal hari ini
        const todaysSchedules = await db.select().from(schedules)
            .where(and(
                eq(schedules.userId, req.userId),
                eq(schedules.dayOfWeek, dayOfWeek),
                eq(schedules.isActive, true)
            ))
            .orderBy(schedules.startTime);
        
        // Ambil log reminder hari ini
        const todayLogs = await db.select().from(reminderLogs)
            .where(and(
                eq(reminderLogs.userId, req.userId),
                eq(reminderLogs.reminderDate, today)
            ));
        
        // Ambil active override hari ini
        const todayOverride = await db.select().from(reminderOverrides)
            .where(and(
                eq(reminderOverrides.userId, req.userId),
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
        // Using req.userId from auth middleware
        
        // Hitung tanggal dari X hari yang lalu
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        const fromDateStr = fromDate.toISOString().split('T')[0];
        
        const logs = await db.select().from(reminderLogs)
            .where(and(
                eq(reminderLogs.userId, req.userId),
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
        // Using req.userId from auth middleware
        
        // Nonaktifkan override lama untuk tanggal yang sama
        await db.update(reminderOverrides)
            .set({ isActive: false })
            .where(and(
                eq(reminderOverrides.userId, req.userId),
                eq(reminderOverrides.overrideDate, date)
            ));
        
        // Buat override baru
        const newOverride = {
            id: crypto.randomUUID(),
            userId: req.userId,
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
        // Using req.userId from auth middleware
        
        const today = new Date().toISOString().split('T')[0];
        
        const overrides = await db.select().from(reminderOverrides)
            .where(and(
                eq(reminderOverrides.userId, req.userId),
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

// ==========================================
// SCHEDULE CANCELLATIONS (Matkul kosong di tanggal tertentu)
// ==========================================

// POST /api/v1/schedules/:id/cancel - Cancel matkul di tanggal tertentu
router.post('/schedules/:id/cancel', [
    param('id').isUUID(),
    body('cancelDate').isISO8601().withMessage('Format tanggal YYYY-MM-DD'),
    body('reason').optional().isString(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        const { cancelDate, reason } = req.body;
        
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        // Using req.userId from auth middleware
        
        // Cek apakah schedule ada
        const schedule = await db.select().from(schedules)
            .where(and(eq(schedules.id, id), eq(schedules.userId, req.userId)))
            .limit(1);
        
        if (schedule.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        
        // Cek apakah sudah ada cancellation aktif untuk tanggal ini
        const existing = await db.select().from(scheduleCancellations)
            .where(and(
                eq(scheduleCancellations.scheduleId, id),
                eq(scheduleCancellations.cancelDate, cancelDate),
                eq(scheduleCancellations.isActive, true)
            ))
            .limit(1);
        
        if (existing.length > 0) {
            return res.json({ 
                success: true, 
                message: 'Matkul sudah di-cancel untuk tanggal ini',
                cancellation: existing[0]
            });
        }
        
        // Buat cancellation baru
        const newCancellation = {
            id: crypto.randomUUID(),
            scheduleId: id,
            userId: req.userId,
            cancelDate,
            reason: reason || null,
            isActive: true,
            createdAt: new Date()
        };
        
        await db.insert(scheduleCancellations).values(newCancellation);
        
        res.json({
            success: true,
            message: `Reminder ${schedule[0].courseName} untuk ${cancelDate} di-cancel`,
            cancellation: newCancellation
        });
    } catch (error) {
        console.error('[API] Create Cancellation Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/v1/schedules/:id/cancellations - Lihat cancellations untuk matkul ini
router.get('/schedules/:id/cancellations', [
    param('id').isUUID(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        // Using req.userId from auth middleware
        
        const today = new Date().toISOString().split('T')[0];
        
        const cancellations = await db.select().from(scheduleCancellations)
            .where(and(
                eq(scheduleCancellations.scheduleId, id),
                eq(scheduleCancellations.userId, req.userId),
                eq(scheduleCancellations.isActive, true),
                sql`${scheduleCancellations.cancelDate} >= ${today}`
            ))
            .orderBy(scheduleCancellations.cancelDate);
        
        res.json({
            success: true,
            count: cancellations.length,
            cancellations
        });
    } catch (error) {
        console.error('[API] Get Cancellations Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /api/v1/schedules/cancellations/:id - Batalkan cancellation
router.delete('/schedules/cancellations/:id', [
    param('id').isUUID(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.update(scheduleCancellations)
            .set({ isActive: false })
            .where(eq(scheduleCancellations.id, id));
        
        res.json({ success: true, message: 'Cancellation dibatalkan' });
    } catch (error) {
        console.error('[API] Cancel Schedule Cancellation Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// TASK REMINDER API (For wa-gateway & OpenClaw)
// ==========================================

// POST /api/task/select - User selected a task from reminder (legacy, use /api/v1/tasks/update-status)
router.post('/task/select', async (req, res) => {
    try {
        const { userId, taskIndex, message } = req.body;
        
        if (taskIndex === undefined || taskIndex < 0) {
            return res.status(400).json({ error: 'Invalid task index' });
        }
        
        // Get user
        const user = await db.select().from(users).where(eq(users.telegramUserId, userId)).limit(1);
        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get pending tasks for this user (same query as reminder)
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const threeDaysLater = new Date(now);
        threeDaysLater.setDate(threeDaysLater.getDate() + 3);
        const threeDaysLaterStr = threeDaysLater.toISOString().split('T')[0];
        
        const tasks = await db.select()
            .from(assignments)
            .where(and(
                eq(assignments.userId, userId),
                eq(assignments.status, 'pending'),
                assignments.deadline >= today,
                assignments.deadline <= threeDaysLaterStr
            ))
            .orderBy(assignments.deadline);
        
        if (taskIndex >= tasks.length) {
            return res.status(400).json({ error: 'Task index out of range' });
        }
        
        const selectedTask = tasks[taskIndex];
        
        // Update task status to 'in_progress'
        await db.update(assignments)
            .set({ 
                status: 'in_progress',
                updatedAt: new Date()
            })
            .where(eq(assignments.id, selectedTask.id));
        
        console.log(`[API] Task ${selectedTask.id} (${selectedTask.title}) marked as in_progress by user selection`);
        
        res.json({
            success: true,
            taskId: selectedTask.id,
            taskName: selectedTask.title,
            course: selectedTask.course,
            message: `Task "${selectedTask.title}" marked as in progress`
        });
        
    } catch (error) {
        console.error('[API] Task Select Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/v1/tasks/update-status - OpenClaw uses this to update task status
// Supports fuzzy search by task name, course, or combination
router.post('/tasks/update-status', [
    body('userId').isString().notEmpty(),
    body('searchQuery').isString().notEmpty(), // e.g., "kjk", "laporan", "kjk laporan"
    body('newStatus').isIn(['pending', 'in_progress', 'completed', 'cancelled']),
    body('replyMessage').optional().isString(), // Original user message for context
    handleValidationErrors
], async (req, res) => {
    try {
        const { userId, searchQuery, newStatus, replyMessage } = req.body;
        
        // Get user
        const user = await db.select().from(users).where(eq(users.telegramUserId, userId)).limit(1);
        if (user.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get all pending/in_progress tasks for this user
        const tasks = await db.select()
            .from(assignments)
            .where(and(
                eq(assignments.userId, userId),
                eq(assignments.status, 'pending')
            ))
            .orderBy(assignments.deadline);
        
        if (tasks.length === 0) {
            return res.status(404).json({ 
                error: 'No pending tasks found',
                message: 'User tidak memiliki tugas yang pending'
            });
        }
        
        // Fuzzy search function
        const searchLower = searchQuery.toLowerCase();
        const searchTerms = searchLower.split(/\s+/).filter(t => t.length > 2);
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const task of tasks) {
            const titleLower = (task.title || '').toLowerCase();
            const courseLower = (task.course || '').toLowerCase();
            const noteLower = (task.note || '').toLowerCase();
            const typeLower = (task.type || '').toLowerCase();
            
            let score = 0;
            
            // Exact match gets highest score
            if (titleLower === searchLower || courseLower === searchLower) {
                score = 100;
            }
            // Contains full query
            else if (titleLower.includes(searchLower) || courseLower.includes(searchLower)) {
                score = 80;
            }
            // Search terms matching
            else {
                for (const term of searchTerms) {
                    if (titleLower.includes(term)) score += 20;
                    if (courseLower.includes(term)) score += 25; // Course match weighted higher
                    if (noteLower.includes(term)) score += 10;
                    if (typeLower.includes(term)) score += 15;
                }
            }
            
            // Course synonym matching (KJK, komber, etc)
            const entityCache = getEntityCache();
            if (entityCache && entityCache['matkul']) {
                const resolvedCourse = entityCache['matkul'].get(searchLower);
                if (resolvedCourse && courseLower.includes(resolvedCourse.toLowerCase())) {
                    score += 30;
                }
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestMatch = task;
            }
        }
        
        // Threshold: need at least 20 score to be considered a match
        if (!bestMatch || bestScore < 20) {
            return res.status(404).json({
                error: 'No matching task found',
                message: `Tidak menemukan tugas yang cocok dengan "${searchQuery}"`,
                availableTasks: tasks.map(t => ({
                    id: t.id,
                    title: t.title,
                    course: t.course,
                    deadline: t.deadline
                }))
            });
        }
        
        // Update task status
        await db.update(assignments)
            .set({ 
                status: newStatus,
                updatedAt: new Date()
            })
            .where(eq(assignments.id, bestMatch.id));
        
        console.log(`[API] Task ${bestMatch.id} (${bestMatch.title}) status updated to ${newStatus} by query "${searchQuery}"`);
        
        // Broadcast update
        if (broadcastEvent) {
            broadcastEvent('assignment_updated', {
                id: bestMatch.id,
                status: newStatus
            });
        }
        
        res.json({
            success: true,
            taskId: bestMatch.id,
            taskName: bestMatch.title,
            course: bestMatch.course,
            type: bestMatch.type,
            deadline: bestMatch.deadline,
            previousStatus: bestMatch.status,
            newStatus: newStatus,
            matchScore: bestScore,
            message: `Task "${bestMatch.title}" (${bestMatch.course}) status diubah menjadi ${newStatus}`
        });
        
    } catch (error) {
        console.error('[API] Update Task Status Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/v1/tasks/last-reminder - Get last task reminder context for OpenClaw
router.get('/tasks/last-reminder/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const today = new Date().toISOString().split('T')[0];
        
        // Check if task reminder was sent today
        const reminderLog = await db.select()
            .from(reminderLogs)
            .where(and(
                eq(reminderLogs.userId, userId),
                eq(reminderLogs.reminderDate, today),
                eq(reminderLogs.type, 'task_daily')
            ))
            .limit(1);
        
        if (reminderLog.length === 0) {
            return res.json({
                hasReminderToday: false,
                message: 'No task reminder sent today'
            });
        }
        
        // Get current pending tasks
        const threeDaysLater = new Date();
        threeDaysLater.setDate(threeDaysLater.getDate() + 3);
        const threeDaysLaterStr = threeDaysLater.toISOString().split('T')[0];
        
        const tasks = await db.select()
            .from(assignments)
            .where(and(
                eq(assignments.userId, userId),
                eq(assignments.status, 'pending'),
                assignments.deadline >= today,
                assignments.deadline <= threeDaysLaterStr
            ))
            .orderBy(assignments.deadline);
        
        res.json({
            hasReminderToday: true,
            reminderSentAt: reminderLog[0].sentAt,
            taskCount: tasks.length,
            tasks: tasks.map((t, idx) => ({
                number: idx + 1,
                id: t.id,
                title: t.title,
                course: t.course,
                type: t.type,
                deadline: t.deadline,
                note: t.note,
                daysLeft: Math.ceil((new Date(t.deadline) - new Date(today)) / (1000 * 60 * 60 * 24))
            }))
        });
        
    } catch (error) {
        console.error('[API] Get Last Reminder Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/v1/reminders/confirm - OpenClaw confirms user attendance confirmation
router.post('/reminders/confirm', [
    body('userId').isString().notEmpty(),
    body('confirmed').isBoolean(),
    body('message').optional().isString(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { userId, confirmed, message } = req.body;
        const today = new Date().toISOString().split('T')[0];
        
        // Update reminder log to mark user confirmed
        // Note: This uses the reminderOverrides table for simplicity
        // Or could create a new user_confirmation_logs table
        
        console.log(`[API] User ${userId} ${confirmed ? 'confirmed' : 'declined'} attendance: ${message}`);
        
        res.json({
            success: true,
            confirmed: confirmed,
            message: confirmed 
                ? 'User attendance confirmed for today' 
                : 'User declined/cancelled attendance'
        });
        
    } catch (error) {
        console.error('[API] Confirm Attendance Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/v1/reminders/last-schedule/:userId - Get last schedule reminder context
router.get('/reminders/last-schedule/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const today = new Date().toISOString().split('T')[0];
        
        // Get today's schedule reminders
        const logs = await db.select()
            .from(reminderLogs)
            .where(and(
                eq(reminderLogs.userId, userId),
                eq(reminderLogs.reminderDate, today),
                reminderLogs.type.in(['first_545am', 'first_90min', '15min'])
            ))
            .orderBy(desc(reminderLogs.sentAt))
            .limit(1);
        
        if (logs.length === 0) {
            return res.json({
                hasReminderToday: false,
                message: 'No schedule reminder sent today'
            });
        }
        
        const lastLog = logs[0];
        
        // Get today's schedules
        const dayOfWeek = new Date().getDay() || 7; // 1-7 (Senin-Minggu)
        const todaysSchedules = await db.select()
            .from(schedules)
            .where(and(
                eq(schedules.userId, userId),
                eq(schedules.dayOfWeek, dayOfWeek),
                eq(schedules.isActive, true)
            ))
            .orderBy(schedules.startTime);
        
        res.json({
            hasReminderToday: true,
            lastReminder: {
                type: lastLog.type,
                sentAt: lastLog.sentAt,
                scheduleId: lastLog.scheduleId,
                messageContent: lastLog.messageContent
            },
            todaySchedules: todaysSchedules.map(s => ({
                id: s.id,
                courseName: s.courseName,
                startTime: s.startTime,
                room: s.room,
                lecturer: s.lecturer
            }))
        });
        
    } catch (error) {
        console.error('[API] Get Last Schedule Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/v1/reminders/log - Log a reminder (called by OpenClaw when sending reminders)
router.post('/reminders/log', [
    body('userId').isString().notEmpty(),
    body('type').isIn(['task_daily', 'task_followup', 'schedule', 'schedule_90min', 'schedule_15min', 'first_545am', 'first_90min', '15min', 'crisis_check', 'night_preview']),
    body('messageContent').optional().isString(),
    body('scheduleId').optional().isUUID(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { userId, type, messageContent, scheduleId } = req.body;
        const today = new Date().toISOString().split('T')[0];
        
        // Check if already logged today for this type
        const existing = await db.select()
            .from(reminderLogs)
            .where(and(
                eq(reminderLogs.userId, userId),
                eq(reminderLogs.reminderDate, today),
                eq(reminderLogs.type, type)
            ))
            .limit(1);
        
        if (existing.length > 0) {
            return res.json({
                success: true,
                message: 'Reminder already logged today',
                logId: existing[0].id
            });
        }
        
        // Create new log entry
        const newLog = {
            id: crypto.randomUUID(),
            userId: userId,
            scheduleId: scheduleId || null, // Nullable for task reminders
            type: type,
            messageContent: messageContent || null,
            reminderDate: today,
            sentAt: new Date(),
            userConfirmed: false
        };
        
        await db.insert(reminderLogs).values(newLog);
        
        console.log(`[API] Reminder logged: ${type} for user ${userId}`);
        
        res.json({
            success: true,
            message: 'Reminder logged successfully',
            logId: newLog.id
        });
        
    } catch (error) {
        console.error('[API] Log Reminder Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// USER COURSE NAMES (Custom names from app desktop)
// ==========================================

// GET /api/v1/user/courses/names - Get all custom course names for user
router.get('/user/courses/names', async (req, res) => {
    try {
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        // Using req.userId from auth middleware

        const courseNames = await db.select()
            .from(userCourseNames)
            .where(eq(userCourseNames.userId, req.userId));

        res.json({ success: true, count: courseNames.length, data: courseNames });
    } catch (error) {
        console.error('[API] Get User Course Names Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/v1/user/courses/names - Set custom course name
router.post('/user/courses/names', [
    body('courseId').notEmpty().withMessage('courseId is required'),
    body('customName').notEmpty().withMessage('customName is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { courseId, customName } = req.body;
        
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        // Using req.userId from auth middleware

        await db.insert(userCourseNames)
            .values({
                id: crypto.randomUUID(),
                userId: req.userId,
                courseId,
                customName,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .onConflictDoUpdate({
                target: [userCourseNames.userId, userCourseNames.courseId],
                set: { customName, updatedAt: new Date() }
            });

        res.json({ success: true, message: 'Course name updated' });
    } catch (error) {
        console.error('[API] Set User Course Name Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /api/v1/user/courses/names/:courseId - Remove custom course name
router.delete('/user/courses/names/:courseId', async (req, res) => {
    try {
        const { courseId } = req.params;
        
        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        // Using req.userId from auth middleware

        await db.delete(userCourseNames)
            .where(and(
                eq(userCourseNames.userId, req.userId),
                eq(userCourseNames.courseId, courseId)
            ));

        res.json({ success: true, message: 'Course name removed' });
    } catch (error) {
        console.error('[API] Delete User Course Name Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
