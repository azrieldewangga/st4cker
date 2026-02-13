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
let initAttempts = 0;
const MAX_RETRIES = 5;

// ───────────────────────────────────────────
// WhatsApp Client with Puppeteer
// ───────────────────────────────────────────
async function initWhatsApp() {
    initAttempts++;
    console.log(`[WA] Initializing WhatsApp client... (attempt ${initAttempts}/${MAX_RETRIES})`);

    try {
        client = new Client({
            authStrategy: new LocalAuth({
                dataPath: '/app/auth_state'
            }),
            puppeteer: {
                headless: true,
                handleSIGINT: false,
                handleSIGTERM: false,
                handleSIGHUP: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-breakpad',
                    '--disable-component-update',
                    '--disable-default-apps',
                    '--disable-features=TranslateUI',
                    '--disable-hang-monitor',
                    '--disable-ipc-flooding-protection',
                    '--disable-popup-blocking',
                    '--disable-prompt-on-repost',
                    '--disable-renderer-backgrounding',
                    '--force-color-profile=srgb',
                    '--metrics-recording-only',
                    '--safebrowsing-disable-auto-update'
                ],
                timeout: 120000
            }
        });

        // QR Code event
        client.on('qr', (qr) => {
            console.log('\n╔══════════════════════════════════════════════╗');
            console.log('║  SCAN QR CODE INI (HP BISNIS)                ║');
            console.log('╚══════════════════════════════════════════════╝\n');
            qrcode.generate(qr, { small: true });
        });

        // Loading screen
        client.on('loading_screen', (percent, message) => {
            console.log(`[WA] Loading: ${percent}% - ${message}`);
        });

        // Authenticated
        client.on('authenticated', () => {
            console.log('[WA] ✅ Authenticated!');
            isConnected = true;
            initAttempts = 0; // Reset counter on success
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
            initAttempts = 0; // Reset counter on success
        });

        // Disconnected
        client.on('disconnected', (reason) => {
            console.log('[WA] ❌ Disconnected:', reason);
            isConnected = false;
            isReady = false;
            client = null;
            
            // Retry dengan delay
            if (initAttempts < MAX_RETRIES) {
                const delay = Math.min(initAttempts * 5000, 30000);
                console.log(`[WA] Retrying in ${delay/1000}s...`);
                setTimeout(() => initWhatsApp(), delay);
            } else {
                console.error('[WA] Max retries reached. Please check VPS resources (RAM/swap).');
            }
        });

        // Initialize dengan error handling
        await client.initialize();
        
    } catch (error) {
        console.error('[WA] Initialization error:', error.message);
        isConnected = false;
        isReady = false;
        client = null;
        
        // Retry dengan delay
        if (initAttempts < MAX_RETRIES) {
            const delay = Math.min(initAttempts * 5000, 30000);
            console.log(`[WA] Retrying in ${delay/1000}s...`);
            setTimeout(() => initWhatsApp(), delay);
        } else {
            console.error('[WA] Max retries reached. Please check:');
            console.error('  1. RAM (minimal 1GB, rekomendasi 2GB)');
            console.error('  2. Swap space (minimal 1GB)');
            console.error('  3. Run: free -h  # untuk cek memory');
        }
    }
}

// ───────────────────────────────────────────
// REST API
// ───────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: isReady ? 'connected' : (isConnected ? 'authenticating' : 'disconnected'),
        service: 'wa-gateway',
        initialized: !!client
    });
});

app.post('/send', async (req, res) => {
    try {
        const { to, message } = req.body;

        if (!isReady || !client) {
            return res.status(503).json({ 
                error: 'WhatsApp not ready',
                status: isReady ? 'ready' : (isConnected ? 'authenticating' : 'disconnected')
            });
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
