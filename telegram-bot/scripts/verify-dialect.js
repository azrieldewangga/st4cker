
import { handleNaturalLanguage } from '../src/nlp/nlp-handler.js';
import { getManager } from '../src/nlp/nlp-service.js';

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
        return Promise.resolve({ message_id: 123 });
    },
    deleteMessage: () => Promise.resolve(true),
    editMessageReplyMarkup: () => Promise.resolve(true),
    onText: () => { },
    on: () => { },
    removeListener: () => { }
};

const mockBroadcast = () => ({ online: true });

async function runDialectTest() {
    console.log('=== DIALECT NLP TEST ===\n');

    // Fix: Initialize NLP manually so we don't deadlock waiting for it
    const { initNLP } = await import('../src/nlp/nlp-service.js');
    await initNLP();
    await waitForNLP();

    const scenarios = [
        // Suroboyoan
        { text: 'busak tugas alpro', desc: 'Delete Task (Sby: Busak)' },
        { text: 'benakno tugas alpro', desc: 'Edit Task (Sby: Benakno)' },
        { text: 'ndelok duwit', desc: 'History Transaction (Sby: Ndelok Duwit)' },
        { text: 'garap tugas', desc: 'Create Task fallback (Sby: Garap)' }, // Might trigger NLP or override?

        // Betawi / Slang
        { text: 'apus transaksi', desc: 'Delete Tx (Btw: Apus)' },
        { text: 'oprek project skripsi', desc: 'Edit Project (Btw: Oprek)' },
        { text: 'intip cuan', desc: 'History Tx (Slang: Intip Cuan)' },
    ];

    const USER_ID = '123456789';
    const CHAT_ID = 123456789;

    for (const s of scenarios) {
        console.log(`\n--- TEST: ${s.desc} ---`);
        console.log(`[USER] "${s.text}"`);
        try {
            await handleNaturalLanguage(mockBot, {
                chat: { id: CHAT_ID },
                from: { id: USER_ID },
                text: s.text
            }, mockBroadcast);
        } catch (e) {
            console.error('[ERROR]', e.message);
        }
        await new Promise(r => setTimeout(r, 200));
    }
}

runDialectTest();
