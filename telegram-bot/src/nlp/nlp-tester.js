import { scenarioSuite } from './scenario-suite.js';
import { handleNaturalLanguage } from './index.js';

/**
 * Simulation Engine for NLP Testing
 */
export class NLPTester {
    constructor(bot, broadcastEvent) {
        this.bot = bot;
        this.broadcastEvent = broadcastEvent;
        this.activeSessions = new Map(); // userId -> { category, index }
    }

    /**
     * Start a test category for a user
     */
    async startCategory(chatId, userId, category) {
        const scenarios = scenarioSuite[category];
        if (!scenarios) {
            await this.bot.sendMessage(chatId, `❌ Kategori ${category} gak ada.`);
            return;
        }

        await this.bot.sendMessage(chatId, `🚀 **Memulai Testing: ${category.toUpperCase()}**\nTotal: ${scenarios.length} skenario.\n\n_Mohon tunggu, saya akan mensimulasikan input satu per satu._`, { parse_mode: 'Markdown' });

        this.activeSessions.set(userId, { category, index: 0, chatId });
        await this.runNext(userId);
    }

    /**
     * Run the next scenario in the active session
     */
    async runNext(userId) {
        const session = this.activeSessions.get(userId);
        if (!session) return;

        const scenarios = scenarioSuite[session.category];
        if (session.index >= scenarios.length) {
            await this.bot.sendMessage(session.chatId, `✅ **Selesai!**\nSemua skenario ${session.category} telah dijalankan. Silakan cek hasil di atas atau histori data.`, { parse_mode: 'Markdown' });
            this.activeSessions.delete(userId);
            return;
        }

        const scenario = scenarios[session.index];
        await this.bot.sendMessage(session.chatId, `🧪 **Test #${session.index + 1}: ${scenario.name}**\n💬 Input: \`${scenario.text}\`\n🎯 Ekspektasi: _${scenario.expectation}_`, { parse_mode: 'Markdown' });

        // Simulate typing
        await this.bot.sendChatAction(session.chatId, 'typing');
        await new Promise(r => setTimeout(r, 1000));

        // Create MOCKED message object
        const mockMsg = {
            chat: { id: session.chatId },
            from: { id: userId, first_name: 'Tester' },
            text: scenario.text,
            isSimulation: true // Flag to skip some checks if needed
        };

        try {
            // Trigger actual NLP handler
            await handleNaturalLanguage(this.bot, mockMsg, this.broadcastEvent);

            // Advance index
            session.index++;
            this.activeSessions.set(userId, session);

            // Provide a button to continue to the next test
            // This prevents spamming and allows the user to verify each result
            await this.bot.sendMessage(session.chatId, `🏁 **Test #${session.index} Selesai.**\nSilakan cek status di atas. Klik tombol di bawah untuk lanjut ke test berikutnya.`, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '⏭️ Lanjut Test Berikutnya', callback_data: `nlp_test_next` },
                        { text: '⏹️ Berhenti', callback_data: `nlp_test_stop` }
                    ]]
                }
            });
        } catch (error) {
            console.error('[NLP-Tester] Error:', error);
            await this.bot.sendMessage(session.chatId, `❌ **Error on Test #${session.index + 1}**: ${error.message}`);
        }
    }

    stop(chatId, userId) {
        this.activeSessions.delete(userId);
        this.bot.sendMessage(chatId, '⏹️ **Testing Dihentikan.**');
    }
}
