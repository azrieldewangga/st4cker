import TelegramBot from 'node-telegram-bot-api';
import { createPairingCode, verifyPairingCode, hasActiveSession, getSessionInfo, revokeSession, getUserSessions } from './pairing.js';
import { handleTaskCommand, handleTaskCallback, handleTaskInput, clearSession as clearTaskSession } from './commands/task.js';
import { handleListTasks, handleTaskListCallback } from './commands/listtasks.js';
import { handleEditTaskCommand, handleEditTaskCallback } from './commands/edittask.js';
import { handleBalanceCommand } from './commands/balance.js';
import { handleTransactionCommand, handleTransactionCallback, handleTransactionInput, handleTransactionNote, clearSession as clearTxSession } from './commands/transaction.js';
import { handleProjectsCommand, handleLogCommand, handleProjectCallback, handleProjectInput, handleCreateProjectCommand, clearSession as clearProjSession } from './commands/project.js';
import { handleNaturalLanguage, handleNLPCallback } from './nlp/index.js';
import { initScheduler } from './scheduler.js';

import { broadcastEvent } from './server.js';
import crypto from 'crypto';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error('[Bot] TELEGRAM_BOT_TOKEN not found in environment variables');
    process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(token, { polling: true });

// Initialize Scheduler (Morning Brief)
initScheduler(bot);

// Set Telegram Command Menu
bot.setMyCommands([
    { command: 'start', description: 'Generate pairing code & connect desktop' },
    { command: 'help', description: 'See all available commands' },
    { command: 'status', description: 'Check connection status' },
    { command: 'unpair', description: 'Disconnect desktop app' },
    { command: 'task', description: 'Add new assignment' },
    { command: 'edittask', description: 'Edit task status' },
    { command: 'listtasks', description: 'View all tasks' },
    { command: 'project', description: 'Create new project' },
    { command: 'projects', description: 'List active projects' },
    { command: 'editproject', description: 'Edit existing project' },
    { command: 'deleteproject', description: 'Delete a project' },
    { command: 'progress', description: 'Log project progress' },
    { command: 'log', description: 'Log project progress (alias)' },
    { command: 'expense', description: 'Record expense' },
    { command: 'income', description: 'Record income' },
    { command: 'balance', description: 'View your balance' }
]).catch(err => console.error('[Bot] Failed to set commands:', err.message));

console.log('[Bot] st4cker Telegram bot started');

// Debounce Map: userId -> { text, timestamp }
const messageDebounce = new Map();
const DEBOUNCE_WINDOW = 2000; // 2 seconds

// Helper: Clear ALL sessions (Last One Wins)
function clearAllSessions(userId) {
    clearTaskSession(userId);
    clearTxSession(userId);
    clearProjSession(userId);
    // Add editTask session clearing if/when exposed
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
    } else if (query.data.startsWith('list_task_page_') ||
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
    } else if (query.data.startsWith('tx_cat_')) {
        handleTransactionCallback(bot, query, broadcastEvent);
    } else if (query.data.startsWith('list_tx_page_') ||
        query.data.startsWith('del_tx_') ||
        query.data.startsWith('edit_tx_') ||
        query.data.startsWith('cancel_tx_') ||
        query.data.startsWith('EDIT_FIELD_') ||
        query.data === 'cancel_edit' ||
        query.data.startsWith('confirm_del_tx_')) {
        const { handleTransactionListCallback } = await import('./commands/transaction.js');
        handleTransactionListCallback(bot, query, broadcastEvent);
    } else if (query.data.startsWith('log_proj_') ||
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
    } else if (query.data.startsWith('nlp_')) {
        // NLP callback handlers
        handleNLPCallback(bot, query, broadcastEvent);
    }
});

// /listprojects command
bot.onText(/\/listprojects/, (msg) => {
    const telegramUserId = msg.from.id.toString();
    if (!hasActiveSession(telegramUserId)) return bot.sendMessage(msg.chat.id, '❌ Not connected. Use /start to pair first.');
    handleProjectsCommand(bot, msg);
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

const KNOWN_COMMANDS = [
    '/start', '/help', '/status', '/unpair',
    '/task', '/listtasks', '/edittask',
    '/project', '/projects', '/log', '/progress',
    '/expense', '/income', '/balance',
    '/editproject', '/deleteproject',
    '/summary',
    '/skip' // Special case
];

// Handle text messages (for command flow inputs AND unknown commands)
bot.on('message', async (msg) => {
    if (!msg.text) return;
    const userId = msg.from.id.toString();

    // 1. DEBOUNCING
    // 1. DEBOUNCING (DISABLED - Causes issues with rapid "ga" replies)
    // const lastMsg = messageDebounce.get(userId);
    // const now = Date.now();
    // if (lastMsg && lastMsg.text === msg.text && (now - lastMsg.timestamp) < DEBOUNCE_WINDOW) {
    //     // Drop duplicate
    //     return;
    // }
    // messageDebounce.set(userId, { text: msg.text, timestamp: now });

    // 2. CHECK FOR KNOWN COMMANDS (Interruption)
    if (msg.text.startsWith('/')) {
        const command = msg.text.split(' ')[0].toLowerCase();

        if (KNOWN_COMMANDS.includes(command)) {
            // Only interrupt if it's NOT /skip (which is part of flow)
            if (command !== '/skip') {
                clearAllSessions(userId); // Last One Wins!
                return; // Let the specific onText handler run
            }
        } else {
            // UNKNOWN COMMAND -> Stripping Slash for NLP
            // e.g. /buat_tugas -> buat_tugas
            console.log(`[Bot] Unknown command ${command} passed to NLP`);
            msg.text = msg.text.substring(1); // Rewrite for handlers
        }
    }

    if (!hasActiveSession(userId)) return;

    // 3. HANDLER CHAIN
    // Try handling as task input first
    const handledTask = await handleTaskInput(bot, msg, broadcastEvent);
    if (handledTask) return;

    // Try handling as transaction input
    const handledTxInput = await handleTransactionInput(bot, msg, broadcastEvent);
    if (handledTxInput) return;

    // Try handling as transaction note
    const handledTxNote = await handleTransactionNote(bot, msg, broadcastEvent);
    if (handledTxNote) return;

    // Try handling as project input (duration/note/creation)
    const handledProjInput = await handleProjectInput(bot, msg, broadcastEvent);
    if (handledProjInput) return;

    // 4. NLP FALLBACK
    try {
        const handledNLP = await handleNaturalLanguage(bot, msg, broadcastEvent);
        if (handledNLP) return;
    } catch (error) {
        console.error('[NLP] Error:', error.message);
    }
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

// /projects command (List)
bot.onText(/\/projects/, (msg) => {
    handleProjectsCommand(bot, msg);
});

// /project command (Create) - Use $ to match end of string
bot.onText(/\/project$/, (msg) => {
    handleCreateProjectCommand(bot, msg);
});

// /editproject
bot.onText(/\/editproject/, async (msg) => {
    const { processEditProject } = await import('./commands/project.js');
    processEditProject(bot, msg.chat.id, msg.from.id.toString());
});

// /deleteproject
bot.onText(/\/deleteproject/, async (msg) => {
    const { processDeleteProject } = await import('./commands/project.js');
    processDeleteProject(bot, msg.chat.id, msg.from.id.toString());
});

// /summary
bot.onText(/\/summary/, async (msg) => {
    const { processSummary } = await import('./commands/summary.js');
    processSummary(bot, msg.chat.id, msg.from.id.toString(), msg.text);
});

// /log command
bot.onText(/\/log/, (msg) => {
    handleLogCommand(bot, msg);
});

// /progress command (Alias for /log)
bot.onText(/\/progress/, (msg) => {
    handleLogCommand(bot, msg);
});

// Error handling
bot.on('polling_error', (error) => {
    const code = error.code || error.response?.body?.error_code;
    const msg = error.message;

    // Filter common network errors
    if (['EFATAL', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNABORTED'].includes(code) ||
        (msg && (msg.includes('ECONNRESET') || msg.includes('ENOTFOUND') || msg.includes('ECONNABORTED')))) {
        // Check if we should log (throttle?)
        // For now, just a simpler log
        // console.log(`[Bot] Network error (${code}): Retrying...`);
        return; // Silent retry for common net errors to avoid spam
    }

    console.error('[Bot] Polling error:', error);
});

export default bot;

