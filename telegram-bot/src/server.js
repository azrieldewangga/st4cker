import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { createServer } from 'http';
import crypto from 'crypto';
import db from './database.js';
import { createPairingCode, verifyPairingCode, validateSession, unpairSession } from './pairing.js';
import { saveUserData, getUserData } from './store.js';

const app = express();
const httpServer = createServer(app);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5173',
    'http://localhost:4173'
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like Electron apps, mobile apps, curl)
        if (!origin) {
            return callback(null, true);
        }

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
    res.json({ status: 'ok', service: 'st4cker-telegram-bot' });
});

// Pairing API Endpoints
app.post('/api/generate-pairing', (req, res) => {
    try {
        const { telegramUserId } = req.body;

        if (!telegramUserId) {
            return res.status(400).json({ error: 'telegramUserId required' });
        }

        const { code, expiresAt } = createPairingCode(telegramUserId);

        res.json({ code, expiresAt });
    } catch (error) {
        console.error('[API] Generate pairing error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/verify-pairing', (req, res) => {
    try {
        const { code } = req.body;

        console.log('[API] Verify pairing request:', { code, body: req.body });

        if (!code) {
            console.log('[API] Missing code in request');
            return res.status(400).json({ error: 'code required' });
        }

        console.log('[API] Calling verifyPairingCode with:', code);
        const result = verifyPairingCode(code);
        console.log('[API] verifyPairingCode result:', result);

        if (result.success) {
            res.json({
                success: true,
                sessionToken: result.sessionToken,
                telegramUserId: result.telegramUserId,
                deviceId: result.deviceId,
                expiresAt: result.expiresAt
            });
        } else {
            console.log('[API] Verification failed:', result.error);
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('[API] Verify pairing error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/unpair', (req, res) => {
    try {
        const { sessionToken } = req.body;

        if (!sessionToken) {
            return res.status(400).json({ error: 'sessionToken required' });
        }

        const success = unpairSession(sessionToken);
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

        console.log('[API] Recovery request:', { deviceId, telegramUserId });

        if (!deviceId || !telegramUserId) {
            return res.status(400).json({ success: false, error: 'Missing parameters' });
        }

        // Check if device is registered and enabled
        const device = db.prepare(
            'SELECT * FROM devices WHERE device_id = ? AND telegram_user_id = ? AND enabled = 1'
        ).get(deviceId, telegramUserId);

        if (!device) {
            console.log('[API] Device not found or disabled');
            return res.status(404).json({ success: false, error: 'Device not registered' });
        }

        // Generate new session token
        const sessionToken = crypto.randomUUID();
        const now = Date.now();
        const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 days

        // Create new session
        db.prepare(`
            INSERT OR REPLACE INTO sessions 
            (session_token, telegram_user_id, device_id, created_at, expires_at, last_activity)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(sessionToken, telegramUserId, deviceId, now, expiresAt, now);

        // Update device last seen
        db.prepare('UPDATE devices SET last_seen = ? WHERE device_id = ?')
            .run(now, deviceId);

        console.log('[API] Session recovered successfully');
        res.json({
            success: true,
            sessionToken,
            expiresAt
        });
    } catch (error) {
        console.error('[API] Recover session error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Device Registration Endpoint
app.post('/api/register-device', (req, res) => {
    try {
        const { sessionToken, deviceId, deviceName } = req.body;

        console.log('[API] Register device:', { deviceId, deviceName });

        if (!sessionToken || !deviceId) {
            return res.status(400).json({ success: false, error: 'Missing parameters' });
        }

        // Verify session token
        const session = db.prepare('SELECT * FROM sessions WHERE session_token = ?').get(sessionToken);
        if (!session) {
            return res.status(401).json({ success: false, error: 'Invalid session' });
        }

        const now = Date.now();

        // Register or update device
        db.prepare(`
            INSERT INTO devices (device_id, telegram_user_id, device_name, first_paired_at, last_paired_at, last_seen)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(device_id) DO UPDATE SET
                last_paired_at = excluded.last_paired_at,
                last_seen = excluded.last_seen,
                device_name = excluded.device_name
        `).run(deviceId, session.telegram_user_id, deviceName || 'Unknown Device', now, now, now);

        console.log('[API] Device registered successfully');
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Register device error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// User Data Sync Endpoints

app.post('/api/sync-user-data', (req, res) => {
    console.log('[API] Sync Request Received. Body keys:', Object.keys(req.body));
    const { sessionToken, data } = req.body;

    if (sessionToken) {
        console.log('[API] Sync SessionToken:', sessionToken.slice(0, 8) + '...');
    } else {
        console.log('[API] Sync SessionToken: MISSING');
    }

    if (data) {
        console.log('[API] Sync Data Keys:', Object.keys(data));
        if (data.courses) console.log('[API] Sync Courses count:', data.courses.length);
    } else {
        console.log('[API] Sync Data: MISSING');
    }

    if (!sessionToken || !data) {
        console.log('[API] Sync failed: Missing token or data');
        return res.status(400).json({ error: 'Missing sessionToken or data' });
    }

    try {
        // Find user by session token
        // NOTE: The original code used `validateSession` and `syncUserData`.
        // This replacement assumes `db` and `saveUserData` are available in the context.
        // If not, this code will cause errors.
        // For faithful replacement, I'm using the provided code as is.
        const session = db.prepare('SELECT telegram_user_id FROM sessions WHERE session_token = ? AND expires_at > ?').get(sessionToken, Date.now());

        if (!session) {
            console.log('[API] Sync failed: Invalid session token');
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        console.log(`[API] Syncing data for user: ${session.telegram_user_id}`);

        // 1. Save to user_data table
        saveUserData(session.telegram_user_id, data);

        // 2. Update session last_activity so /status is accurate
        db.prepare('UPDATE sessions SET last_activity = ? WHERE session_token = ?')
            .run(Date.now(), sessionToken);

        res.json({ success: true });
    } catch (error) {
        console.error('[API] Sync error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/user-data/:telegramUserId', (req, res) => {
    try {
        const { telegramUserId } = req.params;

        if (!telegramUserId) {
            return res.status(400).json({ error: 'telegramUserId required' });
        }

        const userData = getUserData(telegramUserId);

        if (userData) {
            res.json(userData);
        } else {
            res.status(404).json({ error: 'User data not found' });
        }
    } catch (error) {
        console.error('[API] Get user data error:', error);
        res.status(500).json({ error: error.message });
    }
});


// Socket.IO setup with token-based auth
const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// WebSocket authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Authentication token required'));
    }

    const validation = validateSession(token);

    if (!validation.valid) {
        return next(new Error(validation.error));
    }

    // Attach session data to socket
    socket.data.session = {
        telegramUserId: validation.telegramUserId,
        deviceId: validation.deviceId
    };

    next();
});

// WebSocket connection handler
io.on('connection', (socket) => {
    const { telegramUserId, deviceId } = socket.data.session;

    console.log(`[WebSocket] Client connected: user=${telegramUserId}, device=${deviceId}`);

    // Join user-specific room
    socket.join(`user-${telegramUserId}`);

    // Handle Event Acknowledgement
    socket.on('event-ack', (eventId) => {
        try {
            console.log(`[WebSocket] Received ACK for event ${eventId}`);
            db.prepare('DELETE FROM pending_events WHERE event_id = ?').run(eventId);
        } catch (error) {
            console.error('[WebSocket] Error processing ACK:', error);
        }
    });

    // Flush pending events
    try {
        const pending = db.prepare('SELECT * FROM pending_events WHERE telegram_user_id = ? ORDER BY created_at ASC').all(telegramUserId);
        if (pending.length > 0) {
            console.log(`[WebSocket] Flushing ${pending.length} pending events to user ${telegramUserId}`);
            pending.forEach(row => {
                const event = {
                    eventId: row.event_id,
                    eventType: row.event_type,
                    payload: JSON.parse(row.event_data),
                    source: 'telegram',
                    timestamp: new Date(row.created_at).toISOString(),
                    isReplay: true
                };
                socket.emit('telegram-event', event);
            });
        }
    } catch (error) {
        console.error('[WebSocket] Error flushing events:', error);
    }

    socket.on('disconnect', () => {
        console.log(`[WebSocket] Client disconnected: user=${telegramUserId}`);
    });
});

// Check if user is connected
export function isUserOnline(telegramUserId) {
    const room = io.sockets.adapter.rooms.get(`user-${telegramUserId}`);
    return room && room.size > 0;
}

// Broadcast event to user's connected devices
export function broadcastEvent(telegramUserId, event) {
    // 1. Persist event first
    try {
        db.prepare('INSERT INTO pending_events (event_id, telegram_user_id, event_type, event_data, created_at) VALUES (?, ?, ?, ?, ?)')
            .run(event.eventId, telegramUserId, event.eventType, JSON.stringify(event.payload), Date.now());
        console.log(`[Server] Persisted event ${event.eventId} for user ${telegramUserId}`);
    } catch (error) {
        console.error('[Server] Failed to persist event:', error);
    }

    // 2. Broadcast
    const online = isUserOnline(telegramUserId);
    io.to(`user-${telegramUserId}`).emit('telegram-event', event);
    console.log(`[WebSocket] Broadcast event ${event.eventType} to user ${telegramUserId} (Online: ${online})`);

    return { success: true, online };
}

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT}`);
    console.log(`[Server] WebSocket ready for connections`);
});

export { app, io };
