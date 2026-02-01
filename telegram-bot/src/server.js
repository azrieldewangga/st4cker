
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { createServer } from 'http';
import crypto from 'crypto';

// Drizzle Imports
import { db } from './db/index.js';
import { users, sessions, devices, pendingEvents, transactions, projects, assignments } from './db/schema.js';
import { eq, and, gt, sql } from 'drizzle-orm';
import { DbService } from './services/dbService.js'; // Use DbService for data fetch

import { createPairingCode, verifyPairingCode, validateSession, unpairSession } from './pairing.js';
// store.js imports removed

const app = express();
const httpServer = createServer(app);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5173',
    'http://localhost:4173'
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('[CORS] Rejected origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.url}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'st4cker-telegram-bot-pg' });
});

// Pairing API Endpoints
app.post('/api/generate-pairing', async (req, res) => {
    try {
        const { telegramUserId } = req.body;
        if (!telegramUserId) return res.status(400).json({ error: 'telegramUserId required' });

        const { code, expiresAt } = await createPairingCode(telegramUserId);
        res.json({ code, expiresAt });
    } catch (error) {
        console.error('[API] Generate pairing error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/verify-pairing', async (req, res) => {
    try {
        const { code } = req.body;
        console.log('[API] Verify pairing request:', { code });

        if (!code) return res.status(400).json({ error: 'code required' });

        const result = await verifyPairingCode(code);

        if (result.success) {
            // Once paired, ensure USER exists in DB
            DbService.ensureUser(result.telegramUserId).catch(e => console.error(e));

            res.json({
                success: true,
                sessionToken: result.sessionToken,
                telegramUserId: result.telegramUserId,
                deviceId: result.deviceId,
                expiresAt: result.expiresAt
            });
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('[API] Verify pairing error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/unpair', async (req, res) => {
    try {
        const { sessionToken } = req.body;
        if (!sessionToken) return res.status(400).json({ error: 'sessionToken required' });

        const success = await unpairSession(sessionToken);
        res.json({ success });
    } catch (error) {
        console.error('[API] Unpair error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Session Recovery Endpoint
app.post('/api/recover-session', async (req, res) => {
    try {
        const { deviceId, telegramUserId } = req.body;
        if (!deviceId || !telegramUserId) return res.status(400).json({ success: false, error: 'Missing parameters' });

        // Check Device
        const device = await db.select().from(devices).where(and(
            eq(devices.deviceId, deviceId),
            eq(devices.telegramUserId, telegramUserId),
            eq(devices.enabled, true)
        )).limit(1);

        if (device.length === 0) {
            return res.status(404).json({ success: false, error: 'Device not registered' });
        }

        // Generate new session
        const sessionToken = crypto.randomUUID();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

        // Insert Session
        await db.insert(sessions).values({
            sessionToken,
            telegramUserId,
            deviceId,
            createdAt: now,
            expiresAt,
            lastActivity: now
        }).onConflictDoUpdate({
            target: sessions.sessionToken, // unexpected conflict but safe
            set: { expiresAt, lastActivity: now }
        });

        // Update Device Last Seen
        await db.update(devices)
            .set({ lastSeen: now })
            .where(eq(devices.deviceId, deviceId));

        res.json({ success: true, sessionToken, expiresAt: expiresAt.getTime() }); // return timestamp for compat
    } catch (error) {
        console.error('[API] Recover session error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Device Registration Endpoint
app.post('/api/register-device', async (req, res) => {
    try {
        const { sessionToken, deviceId, deviceName } = req.body;
        if (!sessionToken || !deviceId) return res.status(400).json({ success: false, error: 'Missing parameters' });

        // Verify Session
        const session = await db.select().from(sessions).where(eq(sessions.sessionToken, sessionToken)).limit(1);
        if (session.length === 0) return res.status(401).json({ success: false, error: 'Invalid session' });

        // Register Device
        await db.insert(devices).values({
            deviceId,
            telegramUserId: session[0].telegramUserId,
            deviceName: deviceName || 'Unknown Device',
            enabled: true,
            lastSeen: new Date()
        }).onConflictDoUpdate({
            target: devices.deviceId,
            set: { lastSeen: new Date(), deviceName: deviceName || 'Unknown Device' }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[API] Register device error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// User Data Sync Endpoints
// NOTE: This is temporarily mostly READ-ONLY until Phase 3.
app.post('/api/sync-user-data', async (req, res) => {
    try {
        const { sessionToken, data } = req.body;
        if (!sessionToken) return res.status(400).json({ error: 'sessionToken required' });
        if (!data) return res.status(400).json({ error: 'data payload required' });

        // 1. Validate Session
        const session = await db.select().from(sessions)
            .where(and(eq(sessions.sessionToken, sessionToken), gt(sessions.expiresAt, new Date())))
            .limit(1);

        if (session.length === 0) return res.status(401).json({ error: 'Invalid or expired session' });
        const telegramUserId = session[0].telegramUserId;

        console.log(`[API] Sync received from ${telegramUserId}`);

        // 2. Ensure User Exists
        await DbService.ensureUser(telegramUserId);

        // 3. Update User Balance & Semester
        await db.update(users).set({
            currentBalance: data.currentBalance || 0,
            semester: typeof data.semester === 'string' ? parseInt(data.semester.replace(/\D/g, '')) || 1 : data.semester || 1,
            updatedAt: new Date()
        }).where(eq(users.telegramUserId, telegramUserId));

        // 4. Sync Transactions (Upsert)
        if (data.transactions && Array.isArray(data.transactions)) {
            const txOps = data.transactions.map(tx => {
                // Map Desktop fields to DB fields
                return db.insert(transactions).values({
                    id: tx.id,
                    userId: telegramUserId,
                    title: tx.note || tx.title || 'Untitled', // Desktop sends 'note' usually as title/desc
                    category: tx.category || 'General',
                    amount: tx.amount,
                    type: tx.type,
                    date: tx.date,
                    createdAt: tx.createdAt ? new Date(tx.createdAt) : new Date(),
                    updatedAt: new Date()
                }).onConflictDoUpdate({
                    target: transactions.id,
                    set: {
                        amount: tx.amount,
                        category: tx.category,
                        title: tx.note || tx.title,
                        updatedAt: new Date()
                    }
                });
            });
            if (txOps.length > 0) await Promise.all(txOps);
            console.log(`[API] Synced ${txOps.length} transactions`);
        }

        // 5. Sync Projects (Upsert)
        if (data.projects && Array.isArray(data.projects)) {
            const projOps = data.projects.map(p => {
                return db.insert(projects).values({
                    id: p.id,
                    userId: telegramUserId,
                    title: p.name || p.title, // Desktop sends 'name' in sync payload? Check telegram-sync.cts
                    status: p.status || 'active',
                    priority: p.priority || 'medium',
                    deadline: p.deadline,
                    totalProgress: p.totalProgress || 0,
                    description: p.description,
                    createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
                    updatedAt: new Date()
                }).onConflictDoUpdate({
                    target: projects.id,
                    set: {
                        title: p.name || p.title,
                        status: p.status,
                        totalProgress: p.totalProgress,
                        updatedAt: new Date()
                    }
                });
            });
            if (projOps.length > 0) await Promise.all(projOps);
            console.log(`[API] Synced ${projOps.length} projects`);
        }

        // 6. Sync Assignments (Tasks) - Full Sync with Intelligent Upsert
        // This will DELETE assignments in Bot DB that are NOT in App's payload
        const incomingAssignments = data.activeAssignments || [];
        const incomingIds = new Set(incomingAssignments.map(a => a.id));

        // Get all current assignments in Bot DB for this user
        const currentAssignments = await db.select().from(assignments)
            .where(eq(assignments.userId, telegramUserId));

        // Delete assignments not in incoming payload (orphaned)
        let deletedCount = 0;
        for (const existing of currentAssignments) {
            if (!incomingIds.has(existing.id)) {
                await db.delete(assignments).where(eq(assignments.id, existing.id));
                deletedCount++;
            }
        }
        if (deletedCount > 0) console.log(`[API] Deleted ${deletedCount} orphaned assignments`);

        // Upsert incoming assignments
        if (incomingAssignments.length > 0) {
            let syncedCount = 0;
            for (const t of incomingAssignments) {
                // Check for existing task with same content (userId, course, title, deadline)
                const existing = await db.select().from(assignments).where(
                    and(
                        eq(assignments.userId, telegramUserId),
                        eq(assignments.course, t.course),
                        eq(assignments.title, t.title),
                        eq(assignments.deadline, t.deadline)
                    )
                ).limit(1);

                if (existing.length > 0) {
                    // Update existing record with new data (keep existing DB ID)
                    await db.update(assignments)
                        .set({
                            status: t.status || existing[0].status,
                            note: t.note || existing[0].note,
                            type: t.type,
                            updatedAt: new Date()
                        })
                        .where(eq(assignments.id, existing[0].id));
                } else {
                    // Check by ID next (standard upsert)
                    await db.insert(assignments).values({
                        id: t.id,
                        userId: telegramUserId,
                        title: t.title,
                        course: t.course,
                        type: t.type,
                        status: t.status || 'pending',
                        deadline: t.deadline,
                        note: t.note,
                        semester: t.semester,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }).onConflictDoUpdate({
                        target: assignments.id,
                        set: {
                            status: t.status,
                            title: t.title,
                            note: t.note,
                            updatedAt: new Date()
                        }
                    });
                }
                syncedCount++;
            }
            console.log(`[API] Synced ${syncedCount} assignments (Full Sync)`);
        } else {
            console.log(`[API] Synced 0 assignments (Full Sync)`);
        }

        res.json({
            success: true, count: {
                tx: data.transactions?.length || 0,
                projects: data.projects?.length || 0,
                tasks: data.activeAssignments?.length || 0
            }
        });

    } catch (error) {
        console.error('[API] Sync error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/user-data/:telegramUserId', async (req, res) => {
    try {
        const { telegramUserId } = req.params;
        if (!telegramUserId) return res.status(400).json({ error: 'telegramUserId required' });

        // Construct JSON from Postgres table to maintain compatibility with Desktop App
        const user = await DbService.getUser(telegramUserId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const [txs, tasks, projs] = await Promise.all([
            db.select().from(transactions).where(eq(transactions.userId, telegramUserId)),
            db.select().from(assignments).where(eq(assignments.userId, telegramUserId)),
            db.select().from(projects).where(eq(projects.userId, telegramUserId))
        ]);

        const data = {
            currentBalance: user.currentBalance,
            transactions: txs,
            tasks: tasks,
            projects: projs,
            // others defaults
            courses: [],
            categories: {}
        };

        res.json(data);
    } catch (error) {
        console.error('[API] Get user data error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Socket.IO setup
const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
    transports: ['websocket', 'polling']
});

// WebSocket Auth Middleware
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication token required'));

    // Validate Session via DB
    try {
        const sessionsRes = await db.select().from(sessions)
            .where(and(eq(sessions.sessionToken, token), gt(sessions.expiresAt, new Date())))
            .limit(1);

        if (sessionsRes.length === 0) return next(new Error('Invalid or expired session'));

        const session = sessionsRes[0];
        socket.data.session = {
            telegramUserId: session.telegramUserId,
            deviceId: session.deviceId
        };
        next();
    } catch (e) {
        console.error('Socket Auth Error:', e);
        next(new Error('Internal Server Error'));
    }
});

io.on('connection', async (socket) => {
    const { telegramUserId, deviceId } = socket.data.session;
    console.log(`[WebSocket] Client connected: user=${telegramUserId}`);

    socket.join(`user-${telegramUserId}`);

    socket.on('event-ack', async (eventId) => {
        try {
            await db.delete(pendingEvents).where(eq(pendingEvents.eventId, eventId));
        } catch (e) { console.error('ACK Error:', e); }
    });

    // Flush pending
    try {
        const pending = await db.select().from(pendingEvents)
            .where(eq(pendingEvents.telegramUserId, telegramUserId))
            .orderBy(pendingEvents.createdAt);

        if (pending.length > 0) {
            console.log(`[WebSocket] Flushing ${pending.length} events to ${telegramUserId}`);
            pending.forEach(row => {
                const event = {
                    eventId: row.eventId,
                    eventType: row.eventType,
                    payload: JSON.parse(row.eventData),
                    source: 'telegram',
                    timestamp: row.createdAt.toISOString(),
                    isReplay: true
                };
                socket.emit('telegram-event', event);
            });
        }
    } catch (e) { console.error('Flush Error:', e); }

    socket.on('disconnect', () => {
        console.log(`[WebSocket] User ${telegramUserId} disconnected`);
    });
});

export function isUserOnline(telegramUserId) {
    const room = io.sockets.adapter.rooms.get(`user-${telegramUserId}`);
    return !!(room && room.size > 0);
}

export async function broadcastEvent(telegramUserId, event) {
    // 1. Persist
    try {
        await db.insert(pendingEvents).values({
            eventId: event.eventId,
            telegramUserId: telegramUserId,
            eventType: event.eventType,
            eventData: JSON.stringify(event.payload),
            createdAt: new Date()
        });
    } catch (e) { console.error('Persist Event Error:', e); }

    // 2. Broadcast
    const online = isUserOnline(telegramUserId);
    io.to(`user-${telegramUserId}`).emit('telegram-event', event);
    console.log(`[WebSocket] Broadcast ${event.eventType} (Online: ${online})`);

    return { success: true, online };
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT}`);
});

const shutdown = () => {
    console.log('[Server] Shutting down...');
    httpServer.close(() => {
        process.exit(0);
    });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, io };
