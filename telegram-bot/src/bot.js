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
    ]);

    console.log('[Bot] Telegram bot initialized successfully');
}

export default bot;
