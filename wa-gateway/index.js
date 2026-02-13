import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default;
const useMultiFileAuthState = baileys.useMultiFileAuthState;
const DisconnectReason = baileys.DisconnectReason;
const makeCacheableSignalKeyStore = baileys.makeCacheableSignalKeyStore;
const Browsers = baileys.Browsers;

import express from 'express';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

const logger = pino({ level: 'warn' });
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const AUTH_DIR = process.env.AUTH_DIR || './auth_state';

let sock = null;
let isConnected = false;
let retryCount = 0;
const MAX_RETRIES = 10;

// ───────────────────────────────────────────
// Baileys WhatsApp Connection
// ───────────────────────────────────────────
async function connectToWhatsApp() {
    if (retryCount >= MAX_RETRIES) {
        console.log(`[WA] Max retries (${MAX_RETRIES}) reached. Restarting in 60s...`);
        retryCount = 0;
        setTimeout(() => connectToWhatsApp(), 60000);
        return;
    }

    try {
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

        console.log(`[WA] Connecting... (attempt ${retryCount + 1})`);

        sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            logger,
            browser: Browsers.ubuntu('Chrome'),
            generateHighQualityLinkPreview: false,
            syncFullHistory: false
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                retryCount = 0; // Reset on successful QR generation
                console.log('\n╔══════════════════════════════════════════════╗');
                console.log('║  SCAN QR CODE INI DENGAN HP BISNIS KAMU!     ║');
                console.log('║  WhatsApp > Settings > Linked Devices > Link ║');
                console.log('╚══════════════════════════════════════════════╝\n');
                qrcode.generate(qr, { small: true });
                console.log('\n⏳ Menunggu scan... (QR expires in ~20 detik)\n');
            }

            if (connection === 'close') {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(`[WA] Disconnected. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);

                if (shouldReconnect) {
                    retryCount++;
                    const delay = Math.min(retryCount * 3000, 30000); // Backoff: 3s, 6s, 9s... max 30s
                    console.log(`[WA] Retry in ${delay / 1000}s...`);
                    setTimeout(() => connectToWhatsApp(), delay);
                } else {
                    console.log('[WA] Logged out! To re-pair, restart container:');
                    console.log('[WA]   docker compose down wa-gateway');
                    console.log('[WA]   docker volume rm st4cker_wa_auth');
                    console.log('[WA]   docker compose up -d wa-gateway');
                }
            } else if (connection === 'open') {
                isConnected = true;
                retryCount = 0;
                console.log('[WA] ✅ Connected to WhatsApp!');
                console.log(`[WA] Logged in as: ${sock.user?.id || 'unknown'}`);
            }
        });
    } catch (error) {
        console.error('[WA] Fatal error:', error.message);
        retryCount++;
        setTimeout(() => connectToWhatsApp(), 10000);
    }
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
    console.log(`[WA Gateway] POST /send { to: "628xxx", message: "hello" }`);
    connectToWhatsApp();
});
