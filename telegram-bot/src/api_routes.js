import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { db } from './db/index.js';
import { assignments, projects, transactions, users } from './db/schema.js';
import { eq, and, desc, like } from 'drizzle-orm';
import crypto from 'crypto';

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

        const newTask = {
            id: crypto.randomUUID(),
            userId: defaultUserId,
            title,
            course,
            deadline: new Date(deadline),
            status: 'pending',
            type: type || 'Tugas',
            note: note || '',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.insert(assignments).values(newTask);

        // TODO: Trigger Notification or Broadcast if needed

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

        res.json({ success: true, message: 'Task updated' });
    } catch (error) {
        console.error('[API] Update Task Error:', error);
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
        res.status(201).json({ success: true, data: newProject });
    } catch (error) {
        console.error('[API] Create Project Error:', error);
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
    body('category').notEmpty(),
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

        res.status(201).json({ success: true, data: newTx, newBalance });
    } catch (error) {
        console.error('[API] Create Transaction Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
