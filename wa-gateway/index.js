import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import express from 'express';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

const logger = pino({ level: 'warn' }); // Suppress Baileys verbose logs
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
        printQRInTerminal: true,  // Print QR in docker logs
        logger,
        browser: ['St4cker Reminder', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: false
    });

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Connection status handler
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n╔══════════════════════════════════════════╗');
            console.log('║   SCAN QR CODE INI DENGAN HP KAMU!       ║');
            console.log('║   Buka WhatsApp > Linked Devices > Link  ║');
            console.log('╚══════════════════════════════════════════╝\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            isConnected = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(`[WA] Connection closed. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);

            if (shouldReconnect) {
                // Wait before reconnecting
                setTimeout(() => connectToWhatsApp(), 5000);
            } else {
                console.log('[WA] Logged out. Delete auth_state folder and restart to re-pair.');
            }
        } else if (connection === 'open') {
            isConnected = true;
            console.log('[WA] ✅ Connected to WhatsApp!');
            console.log(`[WA] Logged in as: ${sock.user?.id || 'unknown'}`);
        }
    });
}

// ───────────────────────────────────────────
// REST API Endpoints
// ───────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: isConnected ? 'connected' : 'disconnected',
        service: 'wa-gateway'
    });
});

// Send message
app.post('/send', async (req, res) => {
    try {
        const { to, message } = req.body;

        if (!to || !message) {
            return res.status(400).json({ error: '"to" (phone number) and "message" are required' });
        }

        if (!isConnected || !sock) {
            return res.status(503).json({ error: 'WhatsApp not connected. Check QR code in logs.' });
        }

        // Format phone number: ensure it ends with @s.whatsapp.net
        let jid = to.toString().replace(/[^0-9]/g, '');
        if (!jid.endsWith('@s.whatsapp.net')) {
            jid = jid + '@s.whatsapp.net';
        }

        await sock.sendMessage(jid, { text: message });
        console.log(`[WA] ✅ Message sent to ${to}`);

        res.json({ success: true, to, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error(`[WA] ❌ Failed to send:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// ───────────────────────────────────────────
// Start
// ───────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`[WA Gateway] API running on port ${PORT}`);
    console.log(`[WA Gateway] POST /send  { to: "628xxx", message: "hello" }`);
    connectToWhatsApp();
});
