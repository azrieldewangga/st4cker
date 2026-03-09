import TelegramBot from 'node-telegram-bot-api';
import { createPairingCode, verifyPairingCode, hasActiveSession, getSessionInfo, revokeSession, getUserSessions } from './pairing.js';
import { handleTaskCommand, handleTaskCallback, handleTaskInput, clearSession as clearTaskSession } from './commands/task.js';
import { handleListTasks, handleTaskListCallback } from './commands/listtasks.js';
import { handleEditTaskCommand, handleEditTaskCallback } from './commands/edittask.js';
import { handleBalanceCommand } from './commands/balance.js';
import { handleTransactionCommand, handleTransactionCallback, handleTransactionInput, handleTransactionNote, clearSession as clearTxSession } from './commands/transaction.js';
import { handleProjectsCommand, handleLogCommand, handleProjectCallback, handleProjectInput, handleCreateProjectCommand, clearSession as clearProjSession } from './commands/project.js';
import { handleNaturalLanguage, handleNLPCallback } from './nlp/index.js';
import { NLPTester } from './nlp/nlp-tester.js';
import { initScheduler } from './scheduler.js';

import { broadcastEvent } from './server.js';
import crypto from 'crypto';

const token = process.env.TELEGRAM_BOT_TOKEN;

// Export bot instance (null if no token)
export let bot = null;

if (!token) {
    console.log('[Bot] TELEGRAM_BOT_TOKEN not set, running in API-only mode (WhatsApp)');
    console.log('[Bot] API-only mode active - WhatsApp Gateway will handle messaging');
} else {
    // Create bot instance
    bot = new TelegramBot(token, { polling: true });

    // Initialize Scheduler (Morning Brief)
    initScheduler(bot);

    // Initialize NLP Tester
    const nlpTester = new NLPTester(bot, broadcastEvent);

    // Set Telegram Command Menu
    bot.setMyCommands([
        { command: 'start', description: 'Generate pairing code & connect desktop' },
        { command: 'help', description: 'See all available commands' },
        { command: 'status', description: 'Check connection status' },
        { command: 'unpair', description: 'Disconnect desktop app' },
        { command: 'task', description: 'Add new assignment' },
        { command: 'edittask', description: 'Edit task status' },
        { command: 'listtasks', description: 'View all tasks' },
        { command: 'projects', description: 'Manage projects' },
        { command: 'balance', description: 'Check financial balance' },
        { command: 'log', description: 'Quick log transaction' },
        { command: 'testnlp', description: 'Test NLP accuracy [Admin only]' }
    ]).catch(err => console.error('[Bot] Failed to set commands:', err.message));

    console.log('[Bot] Telegram bot initialized successfully');

    // Debounce Map: userId -> { text, timestamp }
    const messageDebounce = new Map();
    const DEBOUNCE_WINDOW = 2000; // 2 seconds

    // Helper: Clear ALL sessions (Last One Wins)
    function clearAllSessions(userId) {
        clearTaskSession(userId);
        clearTxSession(userId);
        clearProjSession(userId);
    }

    // /start command - Generate pairing code
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramUserId = msg.from.id.toString();

        try {
            // Check if already paired
            const sessions = await getUserSessions(telegramUserId);

            if (sessions.length > 0) {
                // Already paired
                const timeAgo = Math.floor((Date.now() - new Date(sessions[0].lastActivity).getTime()) / 1000 / 60);

                bot.sendMessage(chatId, `✅ *Already Connected!*\n\n💻 Desktop: Active\n📡 Last sync: ${timeAgo} mins ago\n\nType /help to see available commands\n\nTo unpair: /unpair`, {
                    parse_mode: 'Markdown'
                });
                return;
            }

            // Show pairing instructions with inline button
            bot.sendMessage(chatId, `👋 *Welcome to st4cker Bot!*\n\nQuick input for tasks, expenses, and projects from your phone.\n\n*To connect your desktop app:*\n1. Click button below to generate pairing code\n2. Open st4cker → Settings → Telegram\n3. Enter the code (valid 5 minutes)`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔐 Generate Pairing Code', callback_data: 'generate_code' }
                    ]]
                }
            });
        } catch (error) {
            console.error('[Bot] /start error:', error);
            bot.sendMessage(chatId, '❌ Error occurred. Please try again.');
        }
    });

    // /status command
    bot.onText(/\/status/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramUserId = msg.from.id.toString();

        try {
            const sessions = await getUserSessions(telegramUserId);

            if (sessions.length === 0) {
                bot.sendMessage(chatId, '❌ *Not Connected*\n\nYou are not paired with any desktop app.\n\nUse /start to generate pairing code.', {
                    parse_mode: 'Markdown'
                });
                return;
            }

            const session = sessions[0];
            const timeAgo = Math.floor((Date.now() - new Date(session.lastActivity).getTime()) / 1000 / 60);
            const deviceInfo = session.deviceId ? `\n📱 Device: ${session.deviceId.slice(0, 8)}...` : '';

            bot.sendMessage(chatId, `✅ *Connection Status*\n\n💻 Desktop: Connected${deviceInfo}\n📡 Last sync: ${timeAgo} mins ago\n📅 Paired since: ${new Date(session.createdAt).toLocaleDateString()}\n\nTo disconnect: /unpair`, {
                parse_mode: 'Markdown'
            });
        } catch (error) {
            console.error('[Bot] /status error:', error);
            bot.sendMessage(chatId, '❌ Error checking status. Please try again.');
        }
    });

    // /unpair command
    bot.onText(/\/unpair/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramUserId = msg.from.id.toString();

        try {
            const sessions = await getUserSessions(telegramUserId);

            if (sessions.length === 0) {
                bot.sendMessage(chatId, '❌ You are not paired with any desktop app.');
                return;
            }

            bot.sendMessage(chatId, '⚠️ *Disconnect Desktop App?*\n\nThis will unlink your Telegram from the desktop app.\nYou can reconnect anytime with /start.', {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Yes, Disconnect', callback_data: 'confirm_unpair' },
                        { text: '❌ Cancel', callback_data: 'cancel_unpair' }
                    ]]
                }
            });
        } catch (error) {
            console.error('[Bot] /unpair error:', error);
            bot.sendMessage(chatId, '❌ Error. Please try again.');
        }
    });

    // /help command
    bot.onText(/\/help/, (msg) => {
        const chatId = msg.chat.id;

        const helpText = `📚 *st4cker Quick Commands*\n\n*Setup:*\n/start - Generate pairing code\n/status - Check connection status\n/unpair - Disconnect desktop\n\n*Tasks:*\n/task - Add assignment\n/edittask - Edit task status\n/listtasks - View all tasks\n\n*Projects:*\n/projects - Manage projects\n/log - Log project progress\n\n*Transactions:*\n/expense - Record expense\n/income - Record income\n/balance - Check balance\n\n*Other:*\n/help - Show this help`;

        bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
    });

    // /task command
    bot.onText(/\/task/, async (msg) => {
        const telegramUserId = msg.from.id.toString();
        if (!await hasActiveSession(telegramUserId)) {
            return bot.sendMessage(msg.chat.id, '❌ Not connected. Use /start to pair first.');
        }
        handleTaskCommand(bot, msg);
    });

    // /edittask command
    bot.onText(/\/edittask/, async (msg) => {
        const telegramUserId = msg.from.id.toString();
        if (!await hasActiveSession(telegramUserId)) {
            return bot.sendMessage(msg.chat.id, '❌ Not connected. Use /start to pair first.');
        }
        handleEditTaskCommand(bot, msg);
    });

    // /listtasks command
    bot.onText(/\/listtasks/, async (msg) => {
        const telegramUserId = msg.from.id.toString();
        if (!await hasActiveSession(telegramUserId)) {
            return bot.sendMessage(msg.chat.id, '❌ Not connected. Use /start to pair first.');
        }
        handleListTasks(bot, msg);
    });

    // /projects command
    bot.onText(/\/projects/, async (msg) => {
        const telegramUserId = msg.from.id.toString();
        if (!await hasActiveSession(telegramUserId)) {
            return bot.sendMessage(msg.chat.id, '❌ Not connected. Use /start to pair first.');
        }
        handleProjectsCommand(bot, msg);
    });

    // /balance command
    bot.onText(/\/balance/, async (msg) => {
        const telegramUserId = msg.from.id.toString();
        if (!await hasActiveSession(telegramUserId)) {
            return bot.sendMessage(msg.chat.id, '❌ Not connected. Use /start to pair first.');
        }
        handleBalanceCommand(bot, msg);
    });

    // /log command
    bot.onText(/\/log/, async (msg) => {
        const telegramUserId = msg.from.id.toString();
        if (!await hasActiveSession(telegramUserId)) {
            return bot.sendMessage(msg.chat.id, '❌ Not connected. Use /start to pair first.');
        }
        handleLogCommand(bot, msg);
    });

    // /expense command
    bot.onText(/\/expense/, async (msg) => {
        const telegramUserId = msg.from.id.toString();
        if (!await hasActiveSession(telegramUserId)) {
            return bot.sendMessage(msg.chat.id, '❌ Not connected. Use /start to pair first.');
        }
        handleTransactionCommand(bot, msg, 'expense');
    });

    // /income command
    bot.onText(/\/income/, async (msg) => {
        const telegramUserId = msg.from.id.toString();
        if (!await hasActiveSession(telegramUserId)) {
            return bot.sendMessage(msg.chat.id, '❌ Not connected. Use /start to pair first.');
        }
        handleTransactionCommand(bot, msg, 'income');
    });

    // /testnlp command
    bot.onText(/\/testnlp/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramUserId = msg.from.id.toString();
        if (!await hasActiveSession(telegramUserId)) {
            return bot.sendMessage(chatId, '❌ Not connected. Use /start to pair first.');
        }

        bot.sendMessage(chatId, '🧪 **NLP Testing**\nPilih kategori:', {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💰 Transaction', callback_data: 'nlp_test_cat_transaction' }],
                    [{ text: '📝 Task', callback_data: 'nlp_test_cat_task' }],
                    [{ text: '📊 Project', callback_data: 'nlp_test_cat_project' }]
                ]
            }
        });
    });

    // Handle callback queries (inline keyboard buttons)
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const telegramUserId = query.from.id.toString();

        // Handle pairing code generation (no auth required)
        if (query.data === 'generate_code') {
            try {
                const { code, expiresAt } = await createPairingCode(telegramUserId);
                const expiryTime = new Date(expiresAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Jakarta'
                });

                bot.answerCallbackQuery(query.id, { text: 'Code generated!' });

                bot.sendMessage(chatId, `🔐 *Your Pairing Code:*\n\n\`${code}\`\n\n⏰ Valid until ${expiryTime} WIB (5 minutes)\n📱 Enter this code in st4cker desktop app:\n    Settings → Telegram → Enter Code`, {
                    parse_mode: 'Markdown'
                });
            } catch (error) {
                console.error('[Bot] Code generation error:', error);
                bot.answerCallbackQuery(query.id, { text: 'Error: ' + error.message, show_alert: true });
            }
            return;
        }

        // All other callbacks require active session
        if (!await hasActiveSession(telegramUserId)) {
            bot.answerCallbackQuery(query.id, { text: 'Not connected. Use /start to pair first.' });
            return;
        }

        // Handle unpair confirmation
        if (query.data === 'confirm_unpair') {
            const sessions = await getUserSessions(telegramUserId);
            if (sessions.length > 0) {
                sessions.forEach(s => revokeSession(s.session_token));
            }

            bot.answerCallbackQuery(query.id, { text: 'Device disconnected.' });
            bot.sendMessage(chatId, '✅ *Disconnected!*\n\nYour Telegram is now unlinked from Desktop App.', { parse_mode: 'Markdown' });
            try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) { }
            return;
        }

        if (query.data === 'cancel_unpair') {
            bot.answerCallbackQuery(query.id, { text: 'Cancelled.' });
            try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) { }
            return;
        }

        // Handle task callbacks
        if (query.data.startsWith('task_') || query.data.startsWith('course_')) {
            handleTaskCallback(bot, query);
        }
        else if (query.data.startsWith('list_task_page_') ||
            query.data.startsWith('del_task_') ||
            query.data.startsWith('confirm_del_task_') ||
            query.data.startsWith('edit_task_') ||
            query.data.startsWith('EDIT_TASK_') ||
            query.data.startsWith('SET_TASK_STATUS_') ||
            query.data.startsWith('SELECT_COURSE_') ||
            query.data.startsWith('SELECT_TYPE_') ||
            query.data === 'cancel_task_action' ||
            query.data === 'cancel_edit_task') {
            handleTaskListCallback(bot, query, broadcastEvent);
        }
        // Handle transaction callbacks
        else if (query.data.startsWith('tx_cat_')) {
            handleTransactionCallback(bot, query, broadcastEvent);
        }
        // Handle project callbacks
        else if (query.data.startsWith('log_proj_') ||
            query.data.startsWith('K_PRIORITY_') ||
            query.data.startsWith('LOG_STATUS_') ||
            query.data.startsWith('TYPE_') ||
            query.data.startsWith('COURSE_') ||
            query.data.startsWith('del_proj_') ||
            query.data.startsWith('confirm_del_proj_') ||
            query.data.startsWith('edit_proj_') ||
            query.data.startsWith('EDIT_PROJ_') ||
            query.data.startsWith('SET_PROJ_') ||
            query.data.startsWith('list_proj_page_') ||
            query.data === 'cancel_proj_action') {
            handleProjectCallback(bot, query, broadcastEvent);
        }
        // Handle NLP test callbacks
        else if (query.data.startsWith('nlp_test_cat_')) {
            const category = query.data.replace('nlp_test_cat_', '');
            nlpTester.startCategory(chatId, telegramUserId, category);
            bot.answerCallbackQuery(query.id, { text: `Starting ${category} tests...` });
        }
        else if (query.data === 'nlp_test_next') {
            nlpTester.runNext(telegramUserId);
            bot.answerCallbackQuery(query.id);
            try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) { }
        }
        else if (query.data === 'nlp_test_stop') {
            nlpTester.stop(chatId, telegramUserId);
            bot.answerCallbackQuery(query.id);
            try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) { }
        }
        // Handle NLP callbacks
        else if (query.data.startsWith('nlp_')) {
            handleNLPCallback(bot, query, broadcastEvent);
        }
    });

    // Handle text messages (NLP)
    bot.on('message', async (msg) => {
        // Ignore non-text messages
        if (!msg.text || msg.text.startsWith('/')) return;

        const telegramUserId = msg.from.id.toString();

        // Check session
        if (!await hasActiveSession(telegramUserId)) {
            return bot.sendMessage(msg.chat.id, '❌ Not connected. Use /start to pair first.');
        }

        // Debounce check
        const now = Date.now();
        const lastMessage = messageDebounce.get(telegramUserId);
        if (lastMessage && lastMessage.text === msg.text && (now - lastMessage.timestamp) < DEBOUNCE_WINDOW) {
            console.log(`[Bot] Debounced duplicate message from ${telegramUserId}`);
            return;
        }
        messageDebounce.set(telegramUserId, { text: msg.text, timestamp: now });

        // Process with NLP
        try {
            await handleNaturalLanguage(bot, msg, broadcastEvent);
        } catch (error) {
            console.error('[Bot] NLP error:', error);
            bot.sendMessage(msg.chat.id, '❌ Sorry, I had trouble understanding that. Please try again.');
        }
    });

    console.log('[Bot] Message handlers registered');
}

export default bot;
