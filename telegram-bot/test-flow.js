// test-flow.js - Regression Test
import { handleNaturalLanguage, handleSlotCompletion } from './src/nlp/nlp-handler.js';
import fs from 'fs';

// Mock Bot
const bot = {
    sendMessage: async (chatId, text, options) => {
        log(`[BOT] ${text}`);
        if (options?.reply_markup) {
            log(`[BOT BUTTONS] ${JSON.stringify(options.reply_markup)}`);
        }
        return { message_id: 123 };
    },
    sendChatAction: async () => { },
    editMessageReplyMarkup: async () => { },
    answerCallbackQuery: async () => { },
    deleteMessage: async () => { }
};

// Utils
const originalLog = console.log;
console.log = function (...args) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    originalLog.apply(console, args);
    try { fs.appendFileSync('test_output.log', msg + '\n'); } catch (e) { }
}

function log(msg) {
    console.log(msg);
}

// Ensure clean log
fs.writeFileSync('test_output.log', '');

const chatId = 999999;
const userId = 999999;

async function runRegressionTest() {
    log('\n=== STARTING REGRESSION TEST ===\n');

    // 1. Create Project "Iya Sebentar"
    log('>>> USER: buat project Iya Sebentar deadline 2025-12-31');
    await handleNaturalLanguage(bot, {
        chat: { id: chatId },
        from: { id: userId, first_name: 'Test', username: 'testuser' },
        text: 'buat project Iya Sebentar deadline 2025-12-31'
    });

    // Use handleNaturalLanguage for everything to let it resolve state
    const send = async (text) => {
        log(`>>> USER: ${text}`);
        await handleNaturalLanguage(bot, {
            chat: { id: chatId },
            from: { id: userId, first_name: 'Test', username: 'testuser' },
            text: text
        });
    };

    log('>>> USER: personal');
    await send('personal');

    log('>>> USER: medium');
    await send('medium');

    log('>>> USER: -'); // Desc
    await send('-');

    log('>>> USER: ga'); // Link
    await send('ga');

    log('>>> USER: ya'); // Confirm Creation
    await send('ya');

    // Manual Persistence Check & Injection
    const { getUserData, saveUserData } = await import('./src/store.js');
    await new Promise(r => setTimeout(r, 1000));

    let dbData = getUserData(userId);
    log(`[TEST DEBUG] Post-Create Data Keys: ${dbData ? Object.keys(dbData) : 'null'}`);
    if (dbData && dbData.projects) {
        log(`[TEST DEBUG] Projects count: ${dbData.projects.length}`);
        log(`[TEST DEBUG] Project names: ${dbData.projects.map(p => p.name).join(', ')}`);
    } else {
        if (!dbData) dbData = { projects: [] };
        if (!dbData.projects) dbData.projects = [];

        // Check if Sakit Hati exists
        if (!dbData.projects.find(p => p.name === 'Proyek Sakit Hati')) {
            dbData.projects.push({
                id: 'manual-test-id-sakit',
                name: 'Proyek Sakit Hati',
                status: 'in_progress',
                totalProgress: 0,
                deadline: '2025-12-31',
                priority: 'high',
                type: 'personal',
                createdAt: new Date().toISOString()
            });
            saveUserData(userId, dbData);
            log('[TEST DEBUG] Injected manual project "Proyek Sakit Hati".');
        } else {
            log('[TEST DEBUG] "Proyek Sakit Hati" already exists.');
        }
    }

    // Allow DB save
    await new Promise(r => setTimeout(r, 1000));

    // 2. Test Smart Extraction
    log('\n>>> USER: catet progres sakit 35% 30 menit');
    await send('catet progres sakit 35% 30 menit');

    // Expect: 
    // Project: "Proyek Sakit Hati" (via "sakit" fuzzy)
    // Progress: 35%
    // Duration: 30m

    // 4. Test Sticky Session (Strong Intent Interrupt)
    // Setup: Start a flow but don't finish it
    log('\n>>> USER: ingatkan beli susu');
    await send('ingatkan beli susu');
    // Bot should ask for "Deadlinenya kapan?" or "Kapan?"

    // Attempt to interrupt with a Strong Intent
    log('>>> USER: catet progres sakit hati 50% 1 jam');
    await send('catet progres sakit hati 50% 1 jam');

    // Expect: Bot should CANCEL "beli susu" and START "catat_progress"
    // Current Bug: Bot says "Oke, note udah kuganti jadi catet progres..." or similar context switch error

    // Allow DB save
    await new Promise(r => setTimeout(r, 1000));

    // 6. Test Mandatory Note for Progress
    // Setup: Reset any pending
    log('\n>>> USER: batal');
    await send('batal');

    // Create Project First: Sakit Hati
    log('>>> USER: buat project Sakit Hati deadline 2025-12-31');
    await send('buat project Sakit Hati deadline 2025-12-31');
    await send('personal');
    await send('medium');
    await send('ya');

    log('>>> USER: catet progres sakit hati 20% 1 jam');
    await send('catet progres sakit hati 20% 1 jam');

    // Bot should find project and ask for note (since we didn't provide it in initial text?)
    // Wait, regex might pick up "1 jam" as duration. If no note text remains?
    // "sakit hati" is project. "20%" is progress. "1 jam" is duration.
    // Remaining text: empty.
    // Bot should ask: "Note/Keterangannya apa? (Wajib)"

    await new Promise(r => setTimeout(r, 1000));

    log('>>> USER: ga');
    await send('ga');
    // Expect: "❌ Note wajib diisi..." (Bot rejects skip)

    log('>>> USER: ngerjain styling css');
    await send('ngerjain styling css');
    // Expect: Confirmation

    log('>>> USER: ya');
    await send('ya');
    // Expect: Success message (Check log for crash)

    // Allow logs to flush
    await new Promise(r => setTimeout(r, 2000));
}

(async () => {
    try {
        await runRegressionTest();
    } catch (e) {
        log('TEST FAILED: ' + e.message);
        console.error(e);
    }
})();
