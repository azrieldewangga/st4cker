import { getUserData } from '../store.js';
import crypto from 'crypto';

// Local in-memory session store (similar to task.js)
const projectSessions = new Map();

function getSession(userId) {
    return projectSessions.get(userId.toString());
}

function updateSession(userId, data) {
    const existing = projectSessions.get(userId.toString()) || {};
    // Merge if state exists, or overwrite?
    // task.js uses setSession which overwrites.
    // Let's implement a merge update for convenience
    // But adhering to simple set is safer pattern if we match task.js
    // I'll use simple set/overwrite but keep name updateSession as I used it in logic.
    if (data.state === 'IDLE') {
        projectSessions.delete(userId.toString());
    } else {
        projectSessions.set(userId.toString(), {
            ...existing,
            ...data
        });
    }
}

export const handleProjectsCommand = async (bot, msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const userData = getUserData(userId); // Fixed: Import from store.js

    if (!userData || !userData.projects || userData.projects.length === 0) {
        return bot.sendMessage(chatId, '📂 *No Active Projects Found*\n\nCreate a project in the Desktop App first to see it here.');
    }

    let response = '📂 *Your Active Projects*\n\n';

    // Create inline keyboard for easier logging
    const inlineKeyboard = [];

    userData.projects.forEach((proj, index) => {
        const statusIcon = proj.status === 'in_progress' ? '▶️' : '⏸️';
        response += `${index + 1}. ${statusIcon} *${proj.name}*\n`;
        response += `   Status: ${proj.status.replace('_', ' ')}\n`;

        inlineKeyboard.push([{
            text: `⏱️ Log: ${proj.name.substring(0, 20)}...`,
            callback_data: `log_proj_${proj.id}`
        }]);
    });

    bot.sendMessage(chatId, response, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: inlineKeyboard
        }
    });
};

export const handleLogCommand = async (bot, msg) => {
    handleProjectsCommand(bot, msg);
};

export const handleProjectCallback = async (bot, query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const data = query.data;

    if (data.startsWith('log_proj_')) {
        const projectId = data.replace('log_proj_', '');
        const userData = getUserData(userId); // Fixed function call
        const project = userData.projects.find(p => p.id === projectId);

        if (!project) {
            return bot.answerCallbackQuery(query.id, { text: 'Project not found/synced.' });
        }

        updateSession(userId, {
            state: 'AWAITING_LOG_DURATION',
            data: { projectId, projectName: project.name }
        });

        bot.answerCallbackQuery(query.id);
        bot.sendMessage(chatId, `⏱️ Logging for *${project.name}*\n\nEnter duration (e.g. "2h", "45m", "1h 30m"):`, { parse_mode: 'Markdown' });
    }
};

export const handleProjectInput = async (bot, msg, broadcastEvent) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const userSession = getSession(userId);

    if (!userSession || !userSession.state) return false;

    if (userSession.state === 'AWAITING_LOG_DURATION') {
        const durationStr = msg.text.toLowerCase();
        const durationMinutes = parseDuration(durationStr);

        if (!durationMinutes) {
            bot.sendMessage(chatId, '❌ Invalid format. Try "2h", "30m", or "1.5h".');
            return true;
        }

        updateSession(userId, {
            state: 'AWAITING_LOG_NOTE',
            data: { ...userSession.data, duration: durationMinutes }
        });

        bot.sendMessage(chatId, `📝 Add a note for this session (or type /skip):`);
        return true;
    }

    if (userSession.state === 'AWAITING_LOG_NOTE') {
        const note = msg.text === '/skip' ? '' : msg.text;
        const { projectId, duration, projectName } = userSession.data;

        // Create Event
        const event = {
            eventId: crypto.randomUUID(),
            eventType: 'progress.logged',
            telegramUserId: userId,
            timestamp: new Date().toISOString(),
            payload: {
                projectId,
                duration, // minutes
                note,
                loggedAt: new Date().toISOString()
            },
            source: 'telegram'
        };

        // Broadcast
        broadcastEvent(event);

        // Reset state
        updateSession(userId, { state: 'IDLE', data: {} });

        // Format duration display
        const hours = Math.floor(duration / 60);
        const mins = duration % 60;
        const timeStr = `${hours > 0 ? hours + 'h ' : ''}${mins}m`;

        bot.sendMessage(chatId, `✅ *Progress Logged!*\n\n📂 Project: ${projectName}\n⏱️ Time: ${timeStr}\n📝 Note: ${note || '-'}\n\nSynced to Desktop.`, { parse_mode: 'Markdown' });
        return true;
    }

    return false;
};

// Helper: Parse "1h 30m" to minutes
function parseDuration(str) {
    let totalMinutes = 0;
    const hours = str.match(/(\d+(?:\.\d+)?)\s*h/);
    const mins = str.match(/(\d+(?:\.\d+)?)\s*m/);

    if (hours) totalMinutes += parseFloat(hours[1]) * 60;
    if (mins) totalMinutes += parseFloat(mins[1]);

    // Fallback: if just a number, assume minutes? Or fail?
    // Let's assume user might type "90" for 90 mins.
    if (!hours && !mins && !isNaN(parseFloat(str))) {
        totalMinutes = parseFloat(str);
    }

    return totalMinutes > 0 ? Math.round(totalMinutes) : null;
}
