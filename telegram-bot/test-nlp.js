
import { handleNaturalLanguage } from './src/nlp/nlp-handler-test.js';
import { initNLP } from './src/nlp/nlp-service.js';

const mockBot = {
    messages: [],
    sendMessage: async (chatId, text, options) => {
        console.log(`[BOT] Send to ${chatId}: ${text}`);
        mockBot.messages.push({ chatId, text, options });
        return { message_id: 123 };
    },
    answerCallbackQuery: async (id, options) => {
        console.log(`[BOT] Answer Callback ${id}:`, options);
    }
};

async function run() {
    console.log('🚀 Initializing test...');
    try {
        await initNLP();

        // Test 1: Expense
        const msg1 = { chat: { id: 1001 }, text: 'habis makan 50rb', from: { id: 888 } };
        console.log(`\n[USER] ${msg1.text}`);
        await handleNaturalLanguage(mockBot, msg1, (userId, event) => {
            console.log('[EVENT BROADCAST]', event.eventType, event.payload);
        });

        // Test 2: Project (Multi-turn)
        const msg2 = { chat: { id: 1001 }, text: 'buat project skripsi', from: { id: 888 } };
        console.log(`\n[USER] ${msg2.text}`);
        await handleNaturalLanguage(mockBot, msg2);

        // Test 3: Answer Multi-turn
        const msg3 = { chat: { id: 1001 }, text: 'januari', from: { id: 888 } }; // Answer deadline
        // Note: Logic depends on state. We assume state is memory-based.
        console.log(`\n[USER] ${msg3.text}`);
        // await handleNaturalLanguage(mockBot, msg3); // Commented out, let's see output of 2 first

    } catch (e) {
        console.error('Test Failed:', e);
    }
}

run();
