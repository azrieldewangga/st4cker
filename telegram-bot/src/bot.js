import TelegramBot from 'node-telegram-bot-api';
import { createPairingCode, verifyPairingCode, hasActiveSession, getSessionInfo, revokeSession, getUserSessions } from './pairing.js';
import { handleTaskCommand, handleTaskCallback, handleTaskInput } from './commands/task.js';
import handleListTasks from './commands/listtasks.js';
import { handleEditTaskCommand, handleEditTaskCallback } from './commands/edittask.js';
import { handleBalanceCommand } from './commands/balance.js';
import { handleTransactionCommand, handleTransactionCallback, handleTransactionInput, handleTransactionNote } from './commands/transaction.js';
import { handleProjectsCommand, handleLogCommand, handleProjectCallback, handleProjectInput } from './commands/project.js';

import { broadcastEvent } from './server.js';
import crypto from 'crypto';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error('[Bot] TELEGRAM_BOT_TOKEN not found in environment variables');
    process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(token, { polling: true });

console.log('[Bot] st4cker Telegram bot started');

// Helper: Create event structure
function createEvent(eventType, telegramUserId, payload) {
    return {
        eventId: crypto.randomUUID(),
        eventType,
        telegramUserId,
        timestamp: new Date().toISOString(),
        payload,
        source: 'telegram'
    };
}


// /start command - Generate pairing code
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramUserId = msg.from.id.toString();

    try {
        // Check if already paired
        const sessions = getUserSessions(telegramUserId);

        if (sessions.length > 0) {
            // Already paired
            const lastActivity = new Date(sessions[0].last_activity);
            const timeAgo = Math.floor((Date.now() - sessions[0].last_activity) / 1000 / 60);

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

// Handle callback queries (inline keyboard buttons)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const telegramUserId = query.from.id.toString();

    // Handle pairing code generation (no auth required)
    if (query.data === 'generate_code') {
        try {
            const { code, expiresAt } = createPairingCode(telegramUserId);
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
    if (!hasActiveSession(telegramUserId)) {
        bot.answerCallbackQuery(query.id, { text: 'Not connected. Use /start to pair first.' });
        return;
    }

    // Handle task command callbacks
    if (query.data.startsWith('task_') || query.data.startsWith('course_')) {
        handleTaskCallback(bot, query);
    } else if (query.data.startsWith('EDIT_TASK:') || query.data.startsWith('SET_STATUS:') || query.data === 'CANCEL_EDIT') {
        handleEditTaskCallback(bot, query, broadcastEvent);
    } else if (query.data.startsWith('tx_cat_')) {
        handleTransactionCallback(bot, query, broadcastEvent);
    } else if (query.data.startsWith('log_proj_')) {
        handleProjectCallback(bot, query);
    }
});

// /listtasks command
bot.onText(/\/listtasks/, (msg) => {
    const telegramUserId = msg.from.id.toString();
    if (!hasActiveSession(telegramUserId)) return bot.sendMessage(msg.chat.id, '❌ Not connected. Use /start to pair first.');
    handleListTasks(bot, msg);
});

// /edittask command
bot.onText(/\/edittask/, (msg) => {
    const telegramUserId = msg.from.id.toString();
    if (!hasActiveSession(telegramUserId)) return bot.sendMessage(msg.chat.id, '❌ Not connected. Use /start to pair first.');
    handleEditTaskCommand(bot, msg);
});

// /help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;

    const helpText = `📚 *st4cker Quick Commands*\n\n*Setup:*\n/start - Generate pairing code\n/unpair - Disconnect desktop\n\n*Tasks:*\n/task - Add assignment\n/edittask - Edit task status\n/listtasks - View all tasks\n\n*Projects:*\n/project - Create project\n/progress - Log progress\n\n*Transactions:*\n/expense - Record expense\n/income - Record income\n\n*Utilities:*\n/status - Connection status\n/help - Show this help`;

    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// /status command
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const telegramUserId = msg.from.id.toString();

    const sessions = getUserSessions(telegramUserId);

    if (sessions.length === 0) {
        bot.sendMessage(chatId, '❌ *Not Connected*\n\nUse /start to pair with st4cker desktop app.', {
            parse_mode: 'Markdown'
        });
    } else {
        const session = sessions[0];
        const lastActivity = Math.floor((Date.now() - session.last_activity) / 1000 / 60);
        const expiresIn = Math.floor((session.expires_at - Date.now()) / 1000 / 60 / 60 / 24);

        bot.sendMessage(chatId, `✅ *Connected*\n\n💻 Desktop: Active\n📡 Last sync: ${lastActivity} mins ago\n⏰ Session expires: ${expiresIn} days\n\nType /help for commands`, {
            parse_mode: 'Markdown'
        });
    }
});

// /unpair command
bot.onText(/\/unpair/, (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(chatId, '⚠️ *Unpair Desktop App?*\n\nThis will disconnect your st4cker desktop.\nYou will need a new pairing code to reconnect.', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '✅ Yes, Unpair', callback_data: 'confirm_unpair' },
                { text: '❌ Cancel', callback_data: 'cancel_unpair' }
            ]]
        }
    });
});

bot.onText(/\/task/, (msg) => {
    const chatId = msg.chat.id;
    const telegramUserId = msg.from.id.toString();

    if (!hasActiveSession(telegramUserId)) {
        bot.sendMessage(chatId, '❌ Not connected. Use /start to pair first.');
        return;
    }

    handleTaskCommand(bot, msg);
});

// Handle text messages (for command flow inputs)
bot.on('message', async (msg) => {
    // Skip commands
    // Skip commands (except /skip which is used in flow)
    if (msg.text && msg.text.startsWith('/') && msg.text !== '/skip') return;

    const userId = msg.from.id.toString();
    if (!hasActiveSession(userId)) return;

    // Try handling as task input first
    const handledTask = await handleTaskInput(bot, msg, broadcastEvent);
    if (handledTask) return;

    // Try handling as transaction input
    const handledTxInput = await handleTransactionInput(bot, msg, broadcastEvent);
    if (handledTxInput) return;

    // Try handling as transaction note
    // Try handling as transaction note
    const handledTxNote = await handleTransactionNote(bot, msg, broadcastEvent);
    if (handledTxNote) return;

    // Try handling as project input (duration/note)
    const handledProjInput = await handleProjectInput(bot, msg, broadcastEvent);
    if (handledProjInput) return;
});

// /balance command
bot.onText(/\/balance/, (msg) => {
    handleBalanceCommand(bot, msg);
});

// /income command
bot.onText(/\/income/, (msg) => {
    handleTransactionCommand(bot, msg, 'income');
});

// /expense command
bot.onText(/\/expense/, (msg) => {
    handleTransactionCommand(bot, msg, 'expense');
});

// /projects command
bot.onText(/\/projects/, (msg) => {
    handleProjectsCommand(bot, msg);
});

// /log command
bot.onText(/\/log/, (msg) => {
    handleLogCommand(bot, msg);
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('[Bot] Polling error:', error.message);
});

export default bot;
