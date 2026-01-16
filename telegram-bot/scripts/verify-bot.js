
import { handleNaturalLanguage } from '../src/nlp/nlp-handler.js';
import { getManager } from '../src/nlp/nlp-service.js';
import { processSummary } from '../src/commands/summary.js';

// Wait for NLP to be ready
async function waitForNLP() {
    console.log('[TEST] Waiting for NLP Manager...');
    let retries = 0;
    while (!getManager() && retries < 50) {
        await new Promise(r => setTimeout(r, 100)); // Wait 100ms
        retries++;
    }
    if (!getManager()) {
        console.error('[TEST] NLP Manager failed to initialize (Timeout)');
        process.exit(1);
    }
    console.log('[TEST] NLP Manager Ready!');
}

// Mocking the bot object
const mockBot = {
    sendMessage: (chatId, text, options) => {
        console.log(`[BOT -> ${chatId}] ${text}`);
        if (options?.reply_markup) console.log(`   [Keyboard]`, JSON.stringify(options.reply_markup));
        return Promise.resolve({ message_id: Math.floor(Math.random() * 1000) });
    },
    deleteMessage: (chatId, messageId) => {
        console.log(`[BOT] Delete Message ${messageId} in ${chatId}`);
        return Promise.resolve(true);
    },
    editMessageReplyMarkup: (markup, options) => {
        console.log(`[BOT] Edit Markup ${options.message_id}:`, JSON.stringify(markup));
        return Promise.resolve(true);
    },
    onText: () => { }, // No-op
    on: () => { }, // No-op
    removeListener: () => { } // No-op
};

// Mock broadcast function
const mockBroadcast = (userId, event) => {
    console.log(`[BROADCAST] User ${userId}:`, event.eventType);
    return { online: true };
};

const TEST_USER_ID = '123456789';
const TEST_CHAT_ID = 123456789;

async function runTestScenarios() {
    console.log('=== STARTING BOT VERIFICATION SCRIPT ===\n');
    await waitForNLP();

    const scenarios = [
        // 1. NLP GREETING
        { text: 'Halo bot', description: 'Casual Greeting' },

        // 2. SUMMARY
        { text: 'summary', description: 'General Summary' },
        { text: 'rekap besok', description: 'Filtered Summary (Tomorrow)' },
        { text: 'summary mingdep', description: 'Filtered Summary (Next Week)' },

        // 3. TASK CRUD
        { text: 'buat tugas Sistem Operasi Praktikum Laporan Resmi besok', description: 'Create Task (Complete)' },
        { text: 'edit tugas', description: 'Edit Task Trigger' },
        { text: 'hapus tugas', description: 'Delete Task Trigger' },

        // 4. TRANSACTION CRUD
        { text: 'beli kopi 25k', description: 'Add Expense (NLP)' },
        { text: 'edit transaksi', description: 'Edit Transaction Trigger' },
        { text: 'hapus transaksi', description: 'Delete Transaction Trigger' },

        // 5. PROJECT CRUD
        { text: 'buat project', description: 'Create Project Trigger' },
        { text: 'edit project', description: 'Edit Project Trigger' },
        { text: 'hapus project', description: 'Delete Project Trigger' },
        { text: 'lihat project', description: 'List Project Trigger' },

        // 6. LOG PROGRESS
        { text: 'catat progress', description: 'Log Progress Trigger' }
    ];

    for (const scenario of scenarios) {
        console.log(`\n--- TEST: ${scenario.description} ---`);
        console.log(`[USER] "${scenario.text}"`);

        try {
            const msg = {
                chat: { id: TEST_CHAT_ID },
                from: { id: TEST_USER_ID },
                text: scenario.text
            };

            await handleNaturalLanguage(mockBot, msg, mockBroadcast);

        } catch (error) {
            console.error(`[ERROR] Test Failed: ${error.message}`);
        }

        // Small delay
        await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n=== VERIFICATION COMPLETE ===');
}

runTestScenarios();
