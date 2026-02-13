import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default;
const useMultiFileAuthState = baileys.useMultiFileAuthState;
const DisconnectReason = baileys.DisconnectReason;
const makeCacheableSignalKeyStore = baileys.makeCacheableSignalKeyStore;
const { delay } = baileys;

import express from 'express';
import pino from 'pino';

const logger = pino({ level: 'trace' }); // Increased logging for debugging
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const AUTH_DIR = process.env.AUTH_DIR || './auth_state';

// Phone number to pair with (WA Bisnis / OpenClaw)
const PAIRING_PHONE = process.env.PAIRING_PHONE || '6285190447727';

let sock = null;
let isConnected = false;
let retryCount = 0;

// ───────────────────────────────────────────
// Baileys WhatsApp Connection
// ───────────────────────────────────────────
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    console.log(`[WA] Connecting... (attempt ${retryCount + 1})`);

    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        logger,
        printQRInTerminal: false, // Must be false for pairing code
        // Custom browser string often helps with "Couldn't link device"
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        keepAliveIntervalMs: 30000,
        connectTimeoutMs: 60000,
    });

    sock.ev.on('creds.update', saveCreds);

    // Request pairing code if not registered
    if (!state.creds.registered) {
        // Wait for connection to be 'open' (conceptually) or at least socket init
        setTimeout(async () => {
            try {
                // Ensure we don't request if already connected (race condition)
                if (isConnected) return;

                console.log(`[WA] Requesting Pairing Code for ${PAIRING_PHONE}...`);
                const code = await sock.requestPairingCode(PAIRING_PHONE);
                console.log('\n╔══════════════════════════════════════════════════╗');
                console.log('║              PAIRING CODE                        ║');
                console.log(`║                                                  ║`);
                console.log(`║       📱  ${code}                            ║`);
                console.log(`║                                                  ║`);
                console.log('║  Buka WA di HP > Link Device > Phone Number      ║');
                console.log('╚══════════════════════════════════════════════════╝\n');
            } catch (e) {
                console.error('[WA] Failed to request pairing code:', e.message);
            }
        }, 6000); // 6s delay to ensure socket is ready
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            isConnected = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(`[WA] Disconnected. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);

            if (shouldReconnect) {
                if (statusCode === 405) {
                    // 405 in loop often means temp ban or bad config. Wait longer.
                    console.log('[WA] Hit 405 error. Waiting 5s before retry...');
                    await delay(5000);
                }
                connectToWhatsApp();
            } else {
                console.log('[WA] Logged out! Access token invalid.');
                console.log('[WA] Run: docker volume rm st4cker_wa_auth && docker compose restart wa-gateway');
            }
        } else if (connection === 'open') {
            isConnected = true;
            retryCount = 0;
            console.log('[WA] ✅ Connected to WhatsApp!');
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
