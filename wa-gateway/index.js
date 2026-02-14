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

// Track last reminder sent for context-aware confirmation
let lastReminderState = {
    sentAt: null,
    date: null,
    phone: null,
    type: null, // 'schedule' atau 'task'
    scheduleInfo: null // Detail schedule untuk OpenClaw context
};

// Track task reminder state
let taskReminderState = {
    active: false,
    sentAt: null,
    taskCount: 0,
    date: null,
    tasks: [] // Store task details from OpenClaw
};

// OpenClaw configuration
const OPENCLAW_URL = process.env.OPENCLAW_URL || 'http://openclaw:8000';
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || '';

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
const TARGET_PHONE = process.env.TARGET_PHONE; // MUST be set via environment

// Validate TARGET_PHONE is set
if (!TARGET_PHONE) {
    console.error('❌ ERROR: TARGET_PHONE environment variable must be set!');
    console.error('   Example: TARGET_PHONE=6281234567890');
    process.exit(1);
}

// Keywords for confirmation
// Note: Removed 'ya' and 'y' because they're too common in casual Indonesian chat
const CONFIRM_KEYWORDS = ['iya', 'yes', 'ok', 'oke', 'okee', 'gas', 'otw', 'let\'s go', 'yoi', 'siap', 'siapp', 'yuk', 'ayo', 'lanjut', 'lanjutkan'];

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
                const originalText = msg.body.trim();
                console.log(`[WA] Received message: "${msg.body}"`);
                
                const now = new Date();
                
                // ─── TASK REMINDER HANDLER (OpenClaw as Brain) ───
                const TASK_WINDOW_MINUTES = 30;
                const isTaskWindowActive = taskReminderState.active && 
                    taskReminderState.sentAt &&
                    ((now - taskReminderState.sentAt) / (1000 * 60)) < TASK_WINDOW_MINUTES &&
                    taskReminderState.date === now.toISOString().split('T')[0];
                
                if (isTaskWindowActive) {
                    console.log(`[WA] Task window active, forwarding to OpenClaw: "${originalText}"`);
                    
                    // Forward to OpenClaw for processing
                    try {
                        const response = await fetch(`${OPENCLAW_URL}/api/v1/st4cker/task-reply`, {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'X-API-Key': OPENCLAW_API_KEY
                            },
                            body: JSON.stringify({
                                phone: TARGET_PHONE,
                                userId: TARGET_PHONE,
                                message: originalText,
                                context: {
                                    event: 'task_reminder_reply',
                                    reminderSentAt: taskReminderState.sentAt,
                                    tasks: taskReminderState.tasks,
                                    taskCount: taskReminderState.taskCount
                                }
                            })
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            console.log(`[WA] OpenClay replied: ${data.reply}`);
                            
                            // Send OpenClaw's reply back to user
                            if (data.reply) {
                                await client.sendMessage(msg.from, data.reply);
                            }
                            
                            // If OpenClaw says done/cancelled, clear the state
                            if (data.done || data.clearContext) {
                                taskReminderState.active = false;
                                console.log('[WA] Task context cleared by OpenClaw');
                            }
                            
                            return; // Handled by OpenClaw
                        } else {
                            console.error(`[WA] OpenClaw returned ${response.status}`);
                        }
                    } catch (e) {
                        console.error('[WA] Failed to contact OpenClaw:', e.message);
                    }
                    
                    // Fallback: if OpenClaw fails, just acknowledge
                    await client.sendMessage(msg.from, '👍 Oke! Catat ya~');
                    taskReminderState.active = false;
                    return;
                }
                
                // ─── SCHEDULE REMINDER HANDLER (OpenClaw as Brain) ───
                const SCHEDULE_WINDOW_MINUTES = 30;
                const isScheduleWindowActive = lastReminderState.sentAt && 
                    lastReminderState.type === 'schedule' &&
                    ((now - lastReminderState.sentAt) / (1000 * 60)) < SCHEDULE_WINDOW_MINUTES &&
                    lastReminderState.date === now.toISOString().split('T')[0];
                
                if (isScheduleWindowActive) {
                    console.log(`[WA] Schedule window active, forwarding to OpenClaw: "${originalText}"`);
                    
                    // Forward to OpenClaw for processing
                    try {
                        const response = await fetch(`${OPENCLAW_URL}/api/v1/st4cker/schedule-reply`, {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'X-API-Key': OPENCLAW_API_KEY
                            },
                            body: JSON.stringify({
                                phone: TARGET_PHONE,
                                userId: TARGET_PHONE,
                                message: originalText,
                                context: {
                                    event: 'schedule_reminder_reply',
                                    reminderSentAt: lastReminderState.sentAt,
                                    reminderType: lastReminderState.type
                                }
                            })
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            console.log(`[WA] OpenClaw replied: ${data.reply}`);
                            
                            // Send OpenClaw's reply back to user
                            if (data.reply) {
                                await client.sendMessage(msg.from, data.reply);
                            }
                            
                            // Update local confirmation state if confirmed
                            if (data.confirmed) {
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
                            }
                            
                            // If OpenClaw says done/cancelled, clear the state
                            if (data.done) {
                                lastReminderState = { sentAt: null, date: null, phone: null, type: null };
                                console.log('[WA] Schedule context cleared by OpenClaw');
                            }
                            
                            return; // Handled by OpenClaw
                        } else {
                            console.error(`[WA] OpenClaw returned ${response.status}`);
                        }
                    } catch (e) {
                        console.error('[WA] Failed to contact OpenClaw:', e.message);
                    }
                    
                    // Fallback: simple keyword matching if OpenClaw fails
                    const matchedKeyword = CONFIRM_KEYWORDS.find(keyword => {
                        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
                        return regex.test(text);
                    });
                    
                    if (matchedKeyword) {
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
                        await client.sendMessage(msg.from, '✅ Oke! Siap berangkat. Nanti aku ingetin lagi 15 menit sebelum matkul berikutnya ya!');
                    }
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
        
        // Track if this is a reminder message for context-aware confirmation
        const isScheduleReminder = message.includes('⏰ PENGINGAT') || 
                                   message.includes('⏰ 15 MENIT LAGI') ||
                                   message.includes('Jangan lupa berangkat');
        
        const isTaskReminder = message.includes('📋 REMINDER TUGAS');
        
        if (isScheduleReminder) {
            lastReminderState = {
                sentAt: new Date(),
                date: new Date().toISOString().split('T')[0],
                phone: number,
                type: 'schedule'
            };
            console.log(`[WA] Schedule reminder sent, tracking for confirmation window. Target: ${number}`);
        } else if (isTaskReminder) {
            lastReminderState = {
                sentAt: new Date(),
                date: new Date().toISOString().split('T')[0],
                phone: number,
                type: 'task'
            };
            console.log(`[WA] Task reminder sent. Target: ${number}`);
        }
        
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

// Receive task reminder notification from reminder-bot
app.post('/confirmation/task-reminder', (req, res) => {
    const { user_id, task_count, sent_at, tasks } = req.body;
    
    taskReminderState = {
        active: true,
        sentAt: new Date(sent_at || Date.now()),
        taskCount: task_count || 0,
        date: new Date().toISOString().split('T')[0],
        tasks: tasks || []
    };
    
    console.log(`[WA] Task reminder tracking activated: ${task_count} tasks`);
    res.json({ success: true, message: 'Task reminder tracking activated' });
});

// Receive schedule reminder notification from reminder-bot
app.post('/confirmation/schedule-reminder', (req, res) => {
    const { user_id, schedule, reminder_type, sent_at } = req.body;
    
    lastReminderState = {
        sentAt: new Date(sent_at || Date.now()),
        date: new Date().toISOString().split('T')[0],
        phone: TARGET_PHONE,
        type: 'schedule',
        scheduleInfo: schedule
    };
    
    console.log(`[WA] Schedule reminder tracking activated: ${reminder_type} - ${schedule?.course_name}`);
    res.json({ success: true, message: 'Schedule reminder tracking activated' });
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
