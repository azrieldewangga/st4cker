import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { db } from './db/index.js';
import { assignments, projects, transactions, users } from './db/schema.js';
import { eq, and, desc, like } from 'drizzle-orm';
import crypto from 'crypto';
import { broadcastEvent } from './server.js';
import { getEntityCache } from './commands/task.js';

const router = express.Router();

// Middleware: Simple API Key Auth
const authenticateApiKey = (req, res, next) => {
    const apiKey = req.header('x-api-key');
    // TODO: Move to .env or DB
    const VALID_API_KEY = process.env.AGENT_API_KEY || 'st4cker-agent-secret';

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
        if (course) conditions.push(like(assignments.course, `%${course}%`));

        const tasks = await db.select().from(assignments)
            .where(and(...conditions))
            .orderBy(desc(assignments.deadline));

        res.json({ success: true, count: tasks.length, data: tasks });
    } catch (error) {
        console.error('[API] Get Tasks Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/v1/tasks
router.post('/tasks', [
    body('title').notEmpty().withMessage('Title is required'),
    body('course').notEmpty().withMessage('Course is required'),
    body('deadline').isISO8601().withMessage('Valid ISO Date required'),
    body('type').optional().isIn(['Tugas', 'Ujian', 'Kuis', 'Proyek']),
    handleValidationErrors
], async (req, res) => {
    try {
        const { title, course, deadline, note, type, priority } = req.body;

        const usersList = await db.select().from(users).limit(1);
        if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
        const defaultUserId = usersList[0].telegramUserId;

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
                console.log(`[API] Auto-prefixed Praktikum: "${normalizedCourse}"`);
            }
        }

        const newTask = {
            id: crypto.randomUUID(),
            userId: defaultUserId,
            title,
            course: normalizedCourse,
            deadline: new Date(deadline),
            status: 'pending',
            type: normalizedType,
            note: note || '',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.insert(assignments).values(newTask);

        // Broadcast Event
        await broadcastEvent(defaultUserId, {
            eventId: crypto.randomUUID(),
            eventType: 'task.created',
            payload: newTask
        });

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
        if (updates.deadline) updates.deadline = new Date(updates.deadline);

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
            payload: { id, ...updates }
        });

        res.json({ success: true, message: 'Task updated' });
    } catch (error) {
        console.error('[API] Update Task Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
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

    // POST /api/v1/projects
    router.post('/projects', [
        body('title').notEmpty(),
        body('status').optional().isIn(['active', 'completed', 'on_hold']),
        handleValidationErrors
    ], async (req, res) => {
        try {
            const { title, description, status, priority, deadline } = req.body;

            const usersList = await db.select().from(users).limit(1);
            if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
            const defaultUserId = usersList[0].telegramUserId;

            const newProject = {
                id: crypto.randomUUID(),
                userId: defaultUserId,
                title,
                description: description || '',
                status: status || 'active',
                priority: priority || 'medium',
                deadline: deadline ? new Date(deadline) : null,
                totalProgress: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await db.insert(projects).values(newProject);
            await broadcastEvent(defaultUserId, {
                eventId: crypto.randomUUID(),
                eventType: 'project.created',
                payload: newProject
            });

            res.status(201).json({ success: true, data: newProject });
        } catch (error) {
        }
    });

    // PATCH /api/v1/projects/:id
    router.patch('/projects/:id', [
        param('id').isUUID(),
        body('status').optional().isIn(['active', 'completed', 'on_hold', 'archived']),
        body('title').optional().isString(),
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
                payload: { id, ...updates }
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
        body('progress').isInt({ min: 0, max: 100 }),
        body('message').optional().isString(),
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
                eventType: 'project.updated', // Using project.updated for logs too for now
                payload: { id, totalProgress: progress, message }
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

    // POST /api/v1/transactions
    router.post('/transactions', [
        body('amount').isNumeric(),
        body('type').isIn(['income', 'expense']),
        body('category').isIn(['Food', 'Transport', 'Shopping', 'Bills', 'Subscription', 'Transfer', 'Salary', 'Other'])
            .withMessage('Category must be one of: Food, Transport, Shopping, Bills, Subscription, Transfer, Salary, Other'),
        handleValidationErrors
    ], async (req, res) => {
        try {
            const { amount, type, category, title, date } = req.body;

            const usersList = await db.select().from(users).limit(1);
            if (usersList.length === 0) return res.status(404).json({ error: 'No users found' });
            const defaultUserId = usersList[0].telegramUserId;

            const newTx = {
                id: crypto.randomUUID(),
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

            await broadcastEvent(defaultUserId, {
                eventId: crypto.randomUUID(),
                eventType: 'transaction.created',
                payload: newTx
            });

            // Also broadcast balance update? Maybe separate event or include in payload
            // For now, transaction lists usually trigger re-fetch of user data

            res.status(201).json({ success: true, data: newTx, newBalance });
        } catch (error) {
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
                payload: { id, ...updates }
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
            res.json({ success: true, message: 'Transaction deleted' });
        } catch (error) {
            console.error('[API] Delete Transaction Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    export default router;
