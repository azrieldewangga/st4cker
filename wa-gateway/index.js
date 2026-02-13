import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Baileys is CJS — use require for reliable imports
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

import express from 'express';
import pino from 'pino';

const logger = pino({ level: 'warn' });
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const AUTH_DIR = process.env.AUTH_DIR || './auth_state';

let sock = null;
let isConnected = false;

// ───────────────────────────────────────────
// Baileys WhatsApp Connection
// ───────────────────────────────────────────
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        printQRInTerminal: true,
        logger,
        browser: ['St4cker Reminder', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n╔══════════════════════════════════════════╗');
            console.log('║   SCAN QR CODE INI DENGAN HP BISNIS!     ║');
            console.log('║   WA > Linked Devices > Link a Device    ║');
            console.log('╚══════════════════════════════════════════╝\n');
        }

        if (connection === 'close') {
            isConnected = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(`[WA] Connection closed. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);

            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(), 5000);
            } else {
                console.log('[WA] Logged out. Delete auth_state and restart to re-pair.');
            }
        } else if (connection === 'open') {
            isConnected = true;
            console.log('[WA] ✅ Connected to WhatsApp!');
            console.log(`[WA] Logged in as: ${sock.user?.id || 'unknown'}`);
        }
    });
}

// ───────────────────────────────────────────
// REST API
// ───────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: isConnected ? 'connected' : 'disconnected',
        service: 'wa-gateway'
    });
});

app.post('/send', async (req, res) => {
    try {
        const { to, message } = req.body;

        if (!to || !message) {
            return res.status(400).json({ error: '"to" and "message" are required' });
        }

        if (!isConnected || !sock) {
            return res.status(503).json({ error: 'WhatsApp not connected. Scan QR: docker logs wa-gateway' });
        }

        let jid = to.toString().replace(/[^0-9]/g, '') + '@s.whatsapp.net';

        await sock.sendMessage(jid, { text: message });
        console.log(`[WA] ✅ Message sent to ${to}`);

        res.json({ success: true, to, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error(`[WA] ❌ Failed to send:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// ───────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`[WA Gateway] Running on port ${PORT}`);
    connectToWhatsApp();
});
