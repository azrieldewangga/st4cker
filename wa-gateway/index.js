import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const DATA_DIR = '/app/data';
const USER_STATE_FILE = path.join(DATA_DIR, 'user_state.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// User confirmation state
let userConfirmations = {};

// Load confirmations from file
function loadConfirmations() {
    try {
        if (fs.existsSync(USER_STATE_FILE)) {
            const data = fs.readFileSync(USER_STATE_FILE, 'utf8');
            userConfirmations = JSON.parse(data);
            console.log('[WA] Loaded user confirmations:', Object.keys(userConfirmations).length, 'entries');
        }
    } catch (e) {
        console.error('[WA] Error loading confirmations:', e.message);
        userConfirmations = {};
    }
}

// Save confirmations to file
function saveConfirmations() {
    try {
        fs.writeFileSync(USER_STATE_FILE, JSON.stringify(userConfirmations, null, 2));
    } catch (e) {
        console.error('[WA] Error saving confirmations:', e.message);
    }
}

// Load on startup
loadConfirmations();

let client = null;
let isConnected = false;
let isReady = false;
let initAttempts = 0;
const MAX_RETRIES = 5;

// Target phone from env
const TARGET_PHONE = process.env.TARGET_PHONE || '6281311417727';

// Keywords for confirmation
const CONFIRM_KEYWORDS = ['iya', 'yes', 'ok', 'oke', 'okee', 'gas', 'otw', 'let\'s go', 'yoi', 'siap', 'siapp', 'y', 'ya', 'yuk', 'ayo', 'lanjut', 'lanjutkan'];

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
            initAttempts = 0;
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
            initAttempts = 0;
        });

        // Disconnected
        client.on('disconnected', (reason) => {
            console.log('[WA] ❌ Disconnected:', reason);
            isConnected = false;
            isReady = false;
            client = null;
            
            if (initAttempts < MAX_RETRIES) {
                const delay = Math.min(initAttempts * 5000, 30000);
                console.log(`[WA] Retrying in ${delay/1000}s...`);
                setTimeout(() => initWhatsApp(), delay);
            }
        });

        // Listen for incoming messages
        client.on('message_create', async (msg) => {
            // Only process messages from target phone and not from ourselves
            if (!msg.fromMe && msg.from.includes(TARGET_PHONE)) {
                const text = msg.body.toLowerCase().trim();
                console.log(`[WA] Received message: "${msg.body}"`);
                
                // Check if it's a confirmation keyword
                const isConfirmed = CONFIRM_KEYWORDS.some(keyword => text.includes(keyword));
                
                if (isConfirmed) {
                    console.log(`[WA] User confirmed: ${msg.body}`);
                    
                    // Mark user as confirmed for today
                    const today = new Date().toISOString().split('T')[0];
                    if (!userConfirmations[today]) {
                        userConfirmations[today] = {};
                    }
                    userConfirmations[today][TARGET_PHONE] = {
                        confirmed: true,
                        confirmedAt: new Date().toISOString(),
                        message: msg.body
                    };
                    saveConfirmations();
                    
                    // Send acknowledgment
                    await client.sendMessage(msg.from, '✅ Oke! Siap berangkat. Nanti aku ingetin lagi 15 menit sebelum matkul berikutnya ya!');
                }
            }
        });

        await client.initialize();
        
    } catch (error) {
        console.error('[WA] Initialization error:', error.message);
        isConnected = false;
        isReady = false;
        client = null;
        
        if (initAttempts < MAX_RETRIES) {
            const delay = Math.min(initAttempts * 5000, 30000);
            console.log(`[WA] Retrying in ${delay/1000}s...`);
            setTimeout(() => initWhatsApp(), delay);
        } else {
            console.error('[WA] Max retries reached.');
        }
    }
}

// ───────────────────────────────────────────
// REST API
// ───────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: isReady ? 'connected' : (isConnected ? 'authenticating' : 'disconnected'),
        service: 'wa-gateway',
        initialized: !!client
    });
});

// Send message
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

// Check user confirmation status
app.get('/confirmation/:phone', (req, res) => {
    const { phone } = req.params;
    const today = new Date().toISOString().split('T')[0];
    
    const confirmation = userConfirmations[today]?.[phone];
    res.json({
        confirmed: confirmation?.confirmed || false,
        confirmedAt: confirmation?.confirmedAt || null,
        today: today
    });
});

// Reset confirmation (for testing)
app.post('/reset-confirmation', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    if (userConfirmations[today]) {
        delete userConfirmations[today];
        saveConfirmations();
    }
    res.json({ success: true, message: 'Confirmation reset' });
});

// Test reminder (manual trigger for testing)
app.post('/test-reminder', async (req, res) => {
    try {
        const { to, courseName, startTime, room, lecturer, type } = req.body;
        const target = to || TARGET_PHONE;
        
        const roomInfo = room ? `\n📍 Ruang: ${room}` : '';
        const lecturerInfo = lecturer ? `\n👨‍🏫 Dosen: ${lecturer}` : '';
        
        let message;
        if (type === 'first') {
            message = `⏰ TEST REMINDER (Matkul Pertama):\n\n📚 ${courseName || 'Test Matkul'}\n🕐 Jam: ${startTime || '08:00'}${roomInfo}${lecturerInfo}\n\nJangan lupa berangkat 1 jam 30 menit lebih awal ya!\n\nReply 'ok' atau 'gas' kalau sudah otw.`;
        } else if (type === '15min') {
            message = `⏰ TEST REMINDER (15 Menit Lagi):\n\n📚 ${courseName || 'Test Matkul'}\n🕐 Jam: ${startTime || '10:00'}${roomInfo}${lecturerInfo}\n\nSiap-siap ya!`;
        } else {
            message = `🧪 TEST PESAN from St4cker Bot!\n\nIni cuma test. Sistem reminder sudah aktif! 🚀`;
        }
        
        if (!isReady || !client) {
            return res.status(503).json({ error: 'WhatsApp not ready' });
        }
        
        const number = target.toString().replace(/[^0-9]/g, '');
        const chatId = number + '@c.us';
        const response = await client.sendMessage(chatId, message);
        
        res.json({ 
            success: true, 
            message: 'Test reminder sent',
            messageId: response.id.id,
            sentTo: target
        });
    } catch (error) {
        console.error('[WA] Test reminder error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ───────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`[WA Gateway] Running on port ${PORT}`);
    initWhatsApp();
});
