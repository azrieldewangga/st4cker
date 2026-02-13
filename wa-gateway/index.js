import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default;
const useMultiFileAuthState = baileys.useMultiFileAuthState;
const DisconnectReason = baileys.DisconnectReason;
const makeCacheableSignalKeyStore = baileys.makeCacheableSignalKeyStore;
const { delay, Browsers } = baileys;

import express from 'express';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';

const logger = pino({ level: 'error' }); // Minimal logs
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const AUTH_DIR = process.env.AUTH_DIR || './auth_state';

let sock = null;
let isConnected = false;

// ───────────────────────────────────────────
// Baileys WhatsApp Connection (QR Code)
// ───────────────────────────────────────────
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    console.log('[WA] Starting connection...');

    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        logger,
        printQRInTerminal: false, // Manual handling
        browser: Browsers.baileys('Desktop'), // Default Baileys browser
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        connectTimeoutMs: 60000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n╔══════════════════════════════════════════════╗');
            console.log('║  SCAN QR CODE INI (HP BISNIS)                ║');
            console.log('╚══════════════════════════════════════════════╝\n');
            qrcode.generate(qr, { small: true });
            console.log('\n⏳ Menunggu scan...');
        }

        if (connection === 'close') {
            isConnected = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(`[WA] Closed. Status: ${statusCode}`);

            // 405 / 403 / 401 Critical errors -> Clear Auth & Restart
            if (statusCode === 405 || statusCode === 403 || statusCode === 401) {
                console.log('[WA] Critical session error. Clearing auth and restarting...');
                try {
                    sock.end();
                    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                    console.log('[WA] Auth cleared. Rebooting...');
                    process.exit(1); // Docker will restart it fresh
                } catch (e) {
                    console.error('[WA] Failed to clear auth:', e);
                }
            } else if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('[WA] Logged out manually.');
            }
        } else if (connection === 'open') {
            isConnected = true;
            console.log('[WA] ✅ Connected as ' + sock.user?.id);
        }
    });

    // Handle initial errors
    sock.ev.on('connection.error', (err) => {
        console.error('[WA] Connection error:', err);
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
        if (!isConnected || !sock) return res.status(503).json({ error: 'Not connected' });

        let jid = to.toString().replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        await sock.sendMessage(jid, { text: message });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ───────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`[WA Gateway] Running on port ${PORT}`);
    connectToWhatsApp();
});
