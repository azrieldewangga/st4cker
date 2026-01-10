import { getUserData, saveUserData } from '../store.js';
import crypto from 'crypto';

// Local in-memory session store
const projectSessions = new Map();

function getSession(userId) {
    return projectSessions.get(userId.toString());
}

function updateSession(userId, data) {
    const existing = projectSessions.get(userId.toString()) || {};
    if (data.state === 'IDLE') {
        projectSessions.delete(userId.toString());
    } else {
        projectSessions.set(userId.toString(), {
            ...existing,
            ...data
        });
    }
}

// Handler: Start Project Creation (Deadline First)
export const handleCreateProjectCommand = async (bot, msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    updateSession(userId, {
        state: 'AWAITING_PROJECT_DEADLINE',
        data: {}
    });

    bot.sendMessage(chatId, '🆕 *Create New Project*\n\nStep 1/5: Enter **Deadline** (YYYY-MM-DD):');
};

export const handleProjectsCommand = async (bot, msg) => {
    // Acts as /listprojects
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const userData = getUserData(userId);

    if (!userData || !userData.projects || userData.projects.length === 0) {
        return bot.sendMessage(chatId, '📂 *No Active Projects Found*\n\nUse /project to create one!');
    }

    let response = '📂 *Your Active Projects*\n\n';

    // Create inline keyboard for easier logging
    const inlineKeyboard = [];

    userData.projects.forEach((proj, index) => {
        const statusIcon = proj.status === 'in_progress' ? '▶️' : '⏸️';
        response += `${index + 1}. ${statusIcon} *${proj.name}*\n`;
        response += `   Status: ${(proj.status || 'in_progress').replace('_', ' ')} | ${proj.totalProgress || 0}%\n`;

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

export const handleProjectCallback = async (bot, query, broadcastEvent) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const data = query.data;

    // --- LOGGING CALLBACKS ---
    if (data.startsWith('log_proj_')) {
        const projectId = data.replace('log_proj_', '');
        const userData = getUserData(userId);
        const project = userData.projects.find(p => p.id === projectId);

        if (!project) {
            return bot.answerCallbackQuery(query.id, { text: 'Project not found/synced.' });
        }

        // Start Log Flow: Ask Status First
        updateSession(userId, {
            state: 'AWAITING_LOG_STATUS',
            data: { projectId, projectName: project.name, currentProgress: project.totalProgress || 0 }
        });

        bot.answerCallbackQuery(query.id);
        bot.sendMessage(chatId, `📝 Logging for *${project.name}*\n\nUpdate Project Status:`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Active', callback_data: 'LOG_STATUS_active' }],
                    [{ text: 'On Hold', callback_data: 'LOG_STATUS_on_hold' }],
                    [{ text: 'Completed', callback_data: 'LOG_STATUS_completed' }]
                ]
            },
            parse_mode: 'Markdown'
        });
        return;
    }

    if (data.startsWith('LOG_STATUS_')) {
        const status = data.replace('LOG_STATUS_', '');
        const userSession = getSession(userId);

        if (!userSession || userSession.state !== 'AWAITING_LOG_STATUS') {
            return bot.answerCallbackQuery(query.id, { text: 'Session expired.' });
        }

        updateSession(userId, {
            state: 'AWAITING_LOG_DURATION',
            data: { ...userSession.data, newStatus: status }
        });

        bot.answerCallbackQuery(query.id);
        bot.sendMessage(chatId, `⏱️ Enter **Duration** worked (e.g. "2h", "45m", "1h 30m"):`);
        return;
    }

    // --- CREATION CALLBACKS ---

    // Project Type Selection
    if (data.startsWith('TYPE_')) {
        const type = data.replace('TYPE_', ''); // course | personal
        const userSession = getSession(userId);

        if (!userSession || userSession.state !== 'AWAITING_PROJECT_TYPE') {
            return bot.answerCallbackQuery(query.id, { text: 'Session expired.' });
        }

        bot.answerCallbackQuery(query.id);

        if (type === 'course') {
            // Show Courses
            const userData = getUserData(userId);
            if (!userData || !userData.courses || userData.courses.length === 0) {
                // If no courses, suggest Personal Project instead of hard blocking?
                // Or just warn.
                bot.sendMessage(chatId, '⚠️ No courses found. Please sync your desktop app first.\n\nType /project again and select "Personal Project" if you want to proceed without a course.');
                return;
            }

            const courseButtons = userData.courses.map(c => [{
                text: c.name,
                callback_data: `COURSE_${c.id}`
            }]);

            updateSession(userId, {
                state: 'AWAITING_PROJECT_COURSE',
                data: { ...userSession.data, projectType: 'course' }
            });

            bot.editMessageText(`📚 Select **Course**:`, {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: { inline_keyboard: courseButtons },
                parse_mode: 'Markdown'
            });
        } else {
            // Personal -> Skip to Priority
            // Explicitly set null for course data
            updateSession(userId, {
                state: 'AWAITING_PROJECT_PRIORITY',
                data: { ...userSession.data, projectType: 'personal', courseId: null, courseName: null }
            });

            // Fix: pass messageId for editMessageText
            askPriority(bot, chatId, query.message.message_id);
        }
        return;
    }

    // Course Selection
    if (data.startsWith('COURSE_')) {
        const courseId = data.replace('COURSE_', '');
        const userSession = getSession(userId);

        if (!userSession || userSession.state !== 'AWAITING_PROJECT_COURSE') return;

        // Fetch Course Name
        const userData = getUserData(userId);
        const course = userData.courses ? userData.courses.find(c => c.id === courseId) : null;
        const courseName = course ? course.name : 'Unknown Course';

        updateSession(userId, {
            state: 'AWAITING_PROJECT_PRIORITY',
            data: { ...userSession.data, courseId, courseName }
        });

        bot.answerCallbackQuery(query.id);
        askPriority(bot, chatId, query.message.message_id); // Pass messageId
        return;
    }

    // Priority Selection (Final Step before Note)
    if (data.startsWith('K_PRIORITY_')) {
        const priority = data.replace('K_PRIORITY_', '').toLowerCase();
        const userSession = getSession(userId);

        if (!userSession || userSession.state !== 'AWAITING_PROJECT_PRIORITY') return;

        updateSession(userId, {
            state: 'AWAITING_PROJECT_NOTE',
            data: { ...userSession.data, priority }
        });

        bot.answerCallbackQuery(query.id);

        // FIX: Edit the priority selection message to hide buttons
        const priorityEmoji = priority === 'low' ? '🟢' : priority === 'medium' ? '🟡' : '🔴';
        const priorityText = priority.charAt(0).toUpperCase() + priority.slice(1);
        bot.editMessageText(`⚡ Select Priority: ${priorityEmoji} ${priorityText}`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown'
        });

        // Send next step
        bot.sendMessage(chatId, `📝 Add a **Note/Description** (Optional, type /skip):`, {
            parse_mode: 'Markdown'
        });
        return;
    }
};

function askPriority(bot, chatId, messageId = null) {
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🟢 Low', callback_data: 'K_PRIORITY_LOW' }],
                [{ text: '🟡 Medium', callback_data: 'K_PRIORITY_MEDIUM' }],
                [{ text: '🔴 High', callback_data: 'K_PRIORITY_HIGH' }],
            ]
        },
        parse_mode: 'Markdown'
    };

    if (messageId) {
        bot.editMessageText(`⚡ Select **Priority**:`, {
            chat_id: chatId,
            message_id: messageId,
            ...opts
        });
    } else {
        bot.sendMessage(chatId, `⚡ Select **Priority**:`, opts);
    }
}

export const handleProjectInput = async (bot, msg, broadcastEvent) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const userSession = getSession(userId);

    if (!userSession || !userSession.state) return false;

    // --- LOGRESS LOGGING FLOW ---
    if (userSession.state === 'AWAITING_LOG_DURATION') {
        const durationStr = msg.text.toLowerCase();
        const durationMinutes = parseDuration(durationStr);

        if (!durationMinutes) {
            bot.sendMessage(chatId, '❌ Invalid format. Try "2h", "30m", or "1.5h".');
            return true;
        }

        updateSession(userId, {
            state: 'AWAITING_LOG_PROGRESS',
            data: { ...userSession.data, duration: durationMinutes }
        });

        bot.sendMessage(chatId, `📊 Current Progress: ${userSession.data.currentProgress}%\n\nEnter **New Progress %** (0-100):`);
        return true;
    }

    if (userSession.state === 'AWAITING_LOG_PROGRESS') {
        const progress = parseInt(msg.text);
        if (isNaN(progress) || progress < 0 || progress > 100) {
            bot.sendMessage(chatId, '❌ Invalid number. Enter 0-100.');
            return true;
        }

        updateSession(userId, {
            state: 'AWAITING_LOG_NOTE',
            data: { ...userSession.data, newProgress: progress }
        });

        bot.sendMessage(chatId, `📝 Add a **Session Note** (Mandatory):`);
        return true;
    }

    if (userSession.state === 'AWAITING_LOG_NOTE') {
        const note = msg.text; // Mandatory
        if (!note || note.trim().length === 0) {
            bot.sendMessage(chatId, '❌ Note is mandatory for progress logs.');
            return true;
        }

        const { projectId, duration, projectName, newStatus, newProgress } = userSession.data;

        const event = {
            eventId: crypto.randomUUID(),
            eventType: 'progress.logged',
            telegramUserId: userId,
            timestamp: new Date().toISOString(),
            payload: {
                projectId,
                duration,
                note,
                status: newStatus,
                progress: newProgress,
                loggedAt: new Date().toISOString()
            },
            source: 'telegram'
        };

        broadcastEvent(userId, event); // FIXED call (was just event)
        updateSession(userId, { state: 'IDLE', data: {} });

        // Optimistic Update
        const userData = getUserData(userId);
        if (userData && userData.projects) {
            const projIndex = userData.projects.findIndex(p => p.id === projectId);
            if (projIndex !== -1) {
                userData.projects[projIndex].totalProgress = newProgress;

                // Map status back to storage format
                let dbStatus = 'in_progress';
                if (newStatus.toLowerCase() === 'completed') dbStatus = 'completed';
                if (newStatus.toLowerCase() === 'on hold') dbStatus = 'on_hold';

                userData.projects[projIndex].status = dbStatus;
                saveUserData(userId, userData);
            }
        }

        // Format duration display
        const hours = Math.floor(duration / 60);
        const mins = duration % 60;
        const timeStr = `${hours > 0 ? hours + 'h ' : ''}${mins}m`;

        bot.sendMessage(chatId, `✅ *Progress Logged!*\n\n📂 Project: ${projectName}\n📊 Progress: ${newProgress}%\n⚡ Status: ${newStatus}\n⏱️ Time: ${timeStr}\n📝 Note: ${note}`, { parse_mode: 'Markdown' });
        return true;
    }


    // --- CREATION FLOW ---
    if (userSession.state === 'AWAITING_PROJECT_DEADLINE') {
        const dateStr = msg.text.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            bot.sendMessage(chatId, `❌ Invalid format. Please use YYYY-MM-DD (e.g. 2026-12-31)`);
            return true;
        }

        updateSession(userId, {
            state: 'AWAITING_PROJECT_TITLE',
            data: { ...userSession.data, deadline: dateStr }
        });

        bot.sendMessage(chatId, ` Step 2/5: Enter **Project Title**:`, { parse_mode: 'Markdown' });
        return true;
    }

    if (userSession.state === 'AWAITING_PROJECT_TITLE') {
        const title = msg.text.trim();

        updateSession(userId, {
            state: 'AWAITING_PROJECT_TYPE',
            data: { ...userSession.data, title }
        });

        bot.sendMessage(chatId, `Step 3/5: Select **Project Type**:`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📚 Course Project', callback_data: 'TYPE_course' }],
                    [{ text: '👤 Personal Project', callback_data: 'TYPE_personal' }]
                ]
            }
        });
        return true;
    }

    if (userSession.state === 'AWAITING_PROJECT_NOTE') {
        const note = msg.text === '/skip' ? '' : msg.text;
        const { title, deadline, priority, projectType, courseId } = userSession.data;

        // Create Event
        const eventId = crypto.randomUUID();
        const event = {
            eventId: eventId,
            eventType: 'project.created',
            telegramUserId: userId,
            timestamp: new Date().toISOString(),
            payload: {
                title,
                description: note, // Note maps to Description
                deadline,
                priority,
                type: projectType,
                courseId: courseId
            },
            source: 'telegram'
        };

        broadcastEvent(userId, event); // FIXED call (was just event)
        updateSession(userId, { state: 'IDLE', data: {} });

        // Optimistic Update
        const userData = getUserData(userId) || {};
        if (!userData.projects) userData.projects = [];

        userData.projects.push({
            id: eventId,
            name: title,
            status: 'in_progress',
            totalProgress: 0,
            createdAt: new Date().toISOString()
        });
        saveUserData(userId, userData);

        bot.sendMessage(chatId, `✅ *Project Created!*\n\n📌 ${title}\n📅 Due: ${deadline}\n⚡ Priority: ${priority}\n📂 Type: ${projectType === 'course' ? `Course Project (${userSession.data.courseName})` : 'Personal'}\n\nSynced to Desktop.`);
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

    if (!hours && !mins && !isNaN(parseFloat(str))) {
        totalMinutes = parseFloat(str);
    }

    return totalMinutes > 0 ? Math.round(totalMinutes) : null;
}
