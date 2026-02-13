import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;

let client = null;
let isConnected = false;
let isReady = false;

// ───────────────────────────────────────────
// WhatsApp Client with Puppeteer
// ───────────────────────────────────────────
async function initWhatsApp() {
    console.log('[WA] Initializing WhatsApp client...');

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: '/app/auth_state'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        }
    });

    // QR Code event
    client.on('qr', (qr) => {
        console.log('\n╔══════════════════════════════════════════════╗');
        console.log('║  SCAN QR CODE INI (HP BISNIS)                ║');
        console.log('╚══════════════════════════════════════════════╝\n');
        qrcode.generate(qr, { small: true });
        isConnected = false;
        isReady = false;
    });

    // Loading screen
    client.on('loading_screen', (percent, message) => {
        console.log(`[WA] Loading: ${percent}% - ${message}`);
    });

    // Authenticated
    client.on('authenticated', () => {
        console.log('[WA] ✅ Authenticated!');
        isConnected = true;
    });

    // Auth failure
    client.on('auth_failure', (msg) => {
        console.error('[WA] ❌ Auth failure:', msg);
        isConnected = false;
        isReady = false;
    });

    // Ready to use
    client.on('ready', () => {
        console.log('[WA] ✅ Client is ready!');
        isConnected = true;
        isReady = true;
    });

    // Disconnected
    client.on('disconnected', (reason) => {
        console.log('[WA] ❌ Disconnected:', reason);
        isConnected = false;
        isReady = false;
        // Re-initialize after disconnect
        setTimeout(() => initWhatsApp(), 5000);
    });

    // Initialize
    await client.initialize();
}

// ───────────────────────────────────────────
// REST API
// ───────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: isReady ? 'connected' : (isConnected ? 'authenticating' : 'disconnected'),
        service: 'wa-gateway'
    });
});

app.post('/send', async (req, res) => {
    try {
        const { to, message } = req.body;

        if (!isReady || !client) {
            return res.status(503).json({ error: 'WhatsApp not ready' });
        }

        if (!to || !message) {
            return res.status(400).json({ error: 'Missing "to" or "message" field' });
        }

        // Format number: remove non-digits and add @c.us suffix
        const number = to.toString().replace(/[^0-9]/g, '');
        const chatId = number + '@c.us';

        const response = await client.sendMessage(chatId, message);
        
        res.json({ 
            success: true, 
            messageId: response.id.id,
            timestamp: response.timestamp
        });
    } catch (error) {
        console.error('[WA] Send error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ───────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`[WA Gateway] Running on port ${PORT}`);
    initWhatsApp();
});
