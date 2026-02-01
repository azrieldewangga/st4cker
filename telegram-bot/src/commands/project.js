
import crypto from 'crypto';
import { DbService } from '../services/dbService.js';
import { parseDate } from '../nlp/dateParser.js';

import {
    clearSession,
    getSession,
    updateSession
} from './project/session.js';
import {
    processLogProgress
} from './project/log.js';
import {
    handleCreateProjectCommand,
    processProjectCreation
} from './project/create.js';
import {
    processListProjects
} from './project/list.js';
import {
    processEditProject,
    processDeleteProject,
    handleEditInput,
    handleDeleteConfirmation
} from './project/edit.js';
import {
    parseDuration
} from './project/utils.js';
import {
    STATES
} from './project/constants.js';

// --- COMMAND HANDLERS ---

export const handleProjectsCommand = async (bot, msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    await processListProjects(bot, chatId, userId, 1);
};

export const handleLogCommand = async (bot, msg) => {
    handleProjectsCommand(bot, msg);
};

export { handleCreateProjectCommand, processProjectCreation };
export { processEditProject, processDeleteProject, clearSession, processListProjects, processLogProgress };

// --- CALLBACK HANDLER ---

export const handleProjectCallback = async (bot, query, broadcastEvent) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const data = query.data;

    // --- LOGGING CALLBACKS ---
    if (data.startsWith('log_proj_')) {
        const projectId = data.replace('log_proj_', '');
        const project = await DbService.getProjectById(projectId);

        if (!project) {
            return bot.answerCallbackQuery(query.id, { text: 'Project not found/synced.' });
        }

        // Start Log Flow: Ask Status First
        updateSession(userId, {
            state: STATES.AWAITING_LOG_STATUS,
            data: { projectId, projectName: project.title, currentProgress: project.totalProgress || 0 }
        });

        bot.answerCallbackQuery(query.id);
        bot.sendMessage(chatId, `📝 Catat progress buat *${project.title}*\n\nUpdate Status Project:`, {
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

        if (!userSession || userSession.state !== STATES.AWAITING_LOG_STATUS) {
            return bot.answerCallbackQuery(query.id, { text: 'Session expired.' });
        }

        try {
            await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id });
        } catch (e) { }

        updateSession(userId, {
            state: STATES.AWAITING_LOG_DURATION,
            data: { ...userSession.data, newStatus: status }
        });

        bot.answerCallbackQuery(query.id);
        bot.sendMessage(chatId, `⏱️ Berapa lama ngerjainnya? (contoh: "2h", "45m", "1.5h"):`);
        return;
    }

    // --- LIST PAGINATION & MODES ---
    if (data.startsWith('list_proj_page_')) {
        let pageStr = data.replace('list_proj_page_', '');
        let mode = 'view';
        if (pageStr.includes('_mode=')) {
            const parts = pageStr.split('_mode=');
            pageStr = parts[0];
            mode = parts[1];
        }

        const page = parseInt(pageStr);
        bot.answerCallbackQuery(query.id);

        try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) { }
        return processListProjects(bot, chatId, userId, page, mode);
    }

    // Cancel Action
    if (data === 'cancel_proj_action') {
        bot.answerCallbackQuery(query.id, { text: 'Selesai.' });
        try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) { }
        return;
    }

    // --- DELETE FLOW ---
    if (data.startsWith('del_proj_')) {
        const projectId = data.replace('del_proj_', '');
        const project = await DbService.getProjectById(projectId);

        if (!project) {
            bot.answerCallbackQuery(query.id, { text: 'Project not found.' });
            return processListProjects(bot, chatId, userId, 1, 'delete');
        }

        bot.editMessageText(`⚠️ **Konfirmasi Hapus Project**\n\n📌 **${project.title}**\nProgress: ${project.totalProgress}%\n\nYakin mau dihapus permanen?`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Ya, Hapus', callback_data: `confirm_del_proj_${projectId}` }],
                    [{ text: '❌ Batal', callback_data: `cancel_proj_action` }]
                ]
            }
        });
        return;
    }

    if (data.startsWith('confirm_del_proj_')) {
        const projectId = data.replace('confirm_del_proj_', '');
        const details = await handleDeleteConfirmation(bot, chatId, userId, projectId, broadcastEvent);

        bot.editMessageText(`✅ Project **${details}** berhasil dihapus!`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [] }
        });
        return;
    }

    // --- EDIT FLOW ---
    if (data.startsWith('edit_proj_')) {
        const projectId = data.replace('edit_proj_', '');
        updateSession(userId, {
            state: STATES.EDITING_PROJECT_SELECT,
            data: { projectId }
        });

        bot.editMessageText(`✏️ **Edit Project**\nMau ubah data apa?`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📝 Judul', callback_data: `EDIT_PROJ_title` }],
                    [{ text: '📅 Deadline', callback_data: `EDIT_PROJ_deadline` }],
                    [{ text: '⚡ Priority', callback_data: `EDIT_PROJ_priority` }],
                    [{ text: '❌ Batal', callback_data: `cancel_proj_action` }]
                ]
            }
        });
        return;
    }

    if (data.startsWith('EDIT_PROJ_')) {
        const field = data.replace('EDIT_PROJ_', '');
        const session = getSession(userId);

        if (!session || !session.data.projectId) return;

        // Sub-menu for Priority
        if (field === 'priority') {
            bot.editMessageText(`⚡ Pilih **Priority Baru**:`, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🟢 Low', callback_data: `SET_PROJ_PRIO_low` }],
                        [{ text: '🟡 Medium', callback_data: `SET_PROJ_PRIO_medium` }],
                        [{ text: '🔴 High', callback_data: `SET_PROJ_PRIO_high` }],
                        [{ text: '🔙 Kembali', callback_data: `edit_proj_${session.data.projectId}` }]
                    ]
                }
            });
            return;
        }

        updateSession(userId, {
            state: STATES.AWAITING_EDIT_INPUT,
            data: { ...session.data, field }
        });

        bot.deleteMessage(chatId, query.message.message_id).catch(() => { });
        bot.sendMessage(chatId, `Masukkan **${field}** baru:`, { parse_mode: 'Markdown' });
        return;
    }

    if (data.startsWith('SET_PROJ_PRIO_')) {
        const priority = data.replace('SET_PROJ_PRIO_', '');
        const session = getSession(userId);
        if (session && session.data.projectId) {
            await DbService.updateProject(session.data.projectId, { priority });

            // Broadcast Update
            if (broadcastEvent) {
                broadcastEvent(userId, {
                    eventId: crypto.randomUUID(),
                    eventType: 'project.updated',
                    timestamp: new Date().toISOString(),
                    payload: { id: session.data.projectId, updates: { priority } },
                    source: 'telegram'
                });
            }

            bot.editMessageText(`✅ Priority diubah jadi: **${priority}**`, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown'
            });
            clearSession(userId);
        }
        return;
    }

    // --- CREATION CALLBACKS ---

    // Project Type Selection
    if (data.startsWith('TYPE_')) {
        const type = data.replace('TYPE_', ''); // course | personal
        const userSession = getSession(userId);

        if (!userSession || userSession.state !== STATES.AWAITING_PROJECT_TYPE) {
            return bot.answerCallbackQuery(query.id, { text: 'Session expired.' });
        }

        bot.answerCallbackQuery(query.id);

        if (type === 'course') {
            // Since we don't have courses in DB yet, prompt for name manually
            updateSession(userId, {
                state: STATES.AWAITING_PROJECT_COURSE, // Reusing state but treating as text input expectation
                data: { ...userSession.data, projectType: 'course' }
            });

            // Ask for text
            bot.editMessageText(`📚 Ketik Nama **Matkul** project ini:`, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown'
            });

        } else {
            // Personal -> Skip to Priority
            updateSession(userId, {
                state: STATES.AWAITING_PROJECT_PRIORITY,
                data: { ...userSession.data, projectType: 'personal', courseId: null, courseName: null }
            });

            askPriority(bot, chatId, query.message.message_id);
        }
        return;
    }

    // Priority Selection (Final Step before Note)
    if (data.startsWith('K_PRIORITY_')) {
        const priority = data.replace('K_PRIORITY_', '').toLowerCase();
        const userSession = getSession(userId);

        if (!userSession || userSession.state !== STATES.AWAITING_PROJECT_PRIORITY) return;

        updateSession(userId, {
            state: STATES.AWAITING_PROJECT_DESC,
            data: { ...userSession.data, priority }
        });

        bot.answerCallbackQuery(query.id);

        const priorityEmoji = priority === 'low' ? '🟢' : priority === 'medium' ? '🟡' : '🔴';
        const priorityText = priority.charAt(0).toUpperCase() + priority.slice(1);
        bot.editMessageText(`⚡ Priority: ${priorityEmoji} ${priorityText}`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown'
        });

        // Send next step
        bot.sendMessage(chatId, `📝 Tambahkan **Deskripsi Project** (atau ketik /skip):`, {
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
        bot.editMessageText(`⚡ Pilih **Priority**:`, {
            chat_id: chatId,
            message_id: messageId,
            ...opts
        });
    } else {
        bot.sendMessage(chatId, `⚡ Pilih **Priority**:`, opts);
    }
}

// --- MESSAGE HANDLER ---

export const handleProjectInput = async (bot, msg, broadcastEvent) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const userSession = getSession(userId);

    if (!userSession || !userSession.state) return false;

    // --- LOGGING FLOW ---
    if (userSession.state === STATES.AWAITING_LOG_DURATION) {
        const durationStr = msg.text.toLowerCase();
        const durationMinutes = parseDuration(durationStr);

        if (!durationMinutes) {
            bot.sendMessage(chatId, '❌ Format salah. Coba "2h", "30m", atau "1.5h".');
            return true;
        }

        updateSession(userId, {
            state: STATES.AWAITING_LOG_PROGRESS,
            data: { ...userSession.data, duration: durationMinutes }
        });

        bot.sendMessage(chatId, `📊 Progress sekarang: ${userSession.data.currentProgress}%\n\nMasukkan **Progress Baru %** (0-100):`);
        return true;
    }

    if (userSession.state === STATES.AWAITING_LOG_PROGRESS) {
        const input = msg.text.trim();
        const progress = parseInt(input);

        if (isNaN(progress) || progress < 0 || progress > 100) {
            bot.sendMessage(chatId, '❌ Angkanya ga valid. Masukkan 0-100.');
            return true;
        }

        // 100% CHECK LOGIC
        if (progress === 100) {
            updateSession(userId, {
                state: STATES.AWAITING_COMPLETION_CONFIRM,
                data: { ...userSession.data, potentialProgress: 100 }
            });
            bot.sendMessage(chatId, 'Wow 100%! 🥳\nBerarti project ini udah **SELESAI** tuntas?', {
                reply_markup: {
                    keyboard: [['Ya, Selesai!'], ['Belum, set 99% aja']],
                    one_time_keyboard: true,
                    resize_keyboard: true
                }
            });
            return true;
        }

        // Standard flow (<100)
        updateSession(userId, {
            state: STATES.AWAITING_LOG_NOTE,
            data: { ...userSession.data, newProgress: progress }
        });

        bot.sendMessage(chatId, `📝 Oke ${progress}%. Ada catatan/progress note? (Wajib)`);
        return true;
    }

    if (userSession.state === STATES.AWAITING_COMPLETION_CONFIRM) {
        const answer = msg.text.toLowerCase();
        let finalProgress = 99;
        let finalStatus = userSession.data.newStatus || 'in_progress';

        // Expanded Affirmative Keywords
        const affirmative = ['ya', 'selesai', 'udah', 'sudah', 'yep', 'yo', 'ok', 'gas', 'kelar', 'done', 'tuntas'];

        if (affirmative.some(kw => answer.includes(kw))) {
            finalProgress = 100;
            finalStatus = 'completed';
        } else {
            finalProgress = 99;
            finalStatus = 'in_progress';
        }

        // Remove keyboard
        bot.sendMessage(chatId, `Oke, diset ke ${finalProgress}% (${finalStatus === 'completed' ? 'Done' : 'In Progress'}).`, {
            reply_markup: { remove_keyboard: true }
        });

        updateSession(userId, {
            state: STATES.AWAITING_LOG_NOTE,
            data: { ...userSession.data, newProgress: finalProgress, newStatus: finalStatus }
        });

        bot.sendMessage(chatId, `📝 Terakhir, isi **Note** buat log ini:`);
        return true;
    }

    if (userSession.state === STATES.AWAITING_LOG_NOTE) {
        const note = msg.text;
        if (!note || note.trim().length === 0) {
            bot.sendMessage(chatId, '❌ Note wajib diisi ya buat log progress.');
            return true;
        }

        const { projectId, duration, projectName, newStatus, newProgress } = userSession.data;

        const result = await processLogProgress(bot, chatId, userId, {
            projectId,
            duration,
            note,
            newStatus: newStatus || 'in_progress',
            newProgress,
            projectName
        }, broadcastEvent);

        if (result.success) {
            bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
        }

        updateSession(userId, { state: STATES.IDLE, data: {} });
        return true;
    }

    if (userSession.state === STATES.AWAITING_EDIT_INPUT) {
        const { field } = userSession.data;
        try {
            const result = await handleEditInput(bot, msg, field);
            if (result && broadcastEvent) {
                broadcastEvent(userId, {
                    eventId: crypto.randomUUID(),
                    eventType: 'project.updated',
                    timestamp: new Date().toISOString(),
                    payload: result,
                    source: 'telegram'
                });
            }
        } catch (e) {
            console.error('Edit error:', e);
        }

        clearSession(userId);
        return true;
    }

    // --- CREATION FLOW ---
    if (userSession.state === STATES.AWAITING_PROJECT_DEADLINE) {
        const dateStr = msg.text.trim();
        const parsedDate = parseDate(dateStr);

        if (!parsedDate) {
            bot.sendMessage(chatId, `❌ Tanggal ga kebaca. Coba format: "YYYY-MM-DD", "Besok", atau "25 Mar 2026"`);
            return true;
        }

        // Format to YYYY-MM-DD
        const yyyy = parsedDate.getFullYear();
        const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const dd = String(parsedDate.getDate()).padStart(2, '0');
        const formatted = `${yyyy}-${mm}-${dd}`;

        updateSession(userId, {
            state: STATES.AWAITING_PROJECT_TITLE,
            data: { ...userSession.data, deadline: formatted }
        });

        bot.sendMessage(chatId, ` Step 2/5: Masukkan **Judul Project**:`, { parse_mode: 'Markdown' });
        return true;
    }

    if (userSession.state === STATES.AWAITING_PROJECT_TITLE) {
        const title = msg.text.trim();

        updateSession(userId, {
            state: STATES.AWAITING_PROJECT_TYPE,
            data: { ...userSession.data, title }
        });

        bot.sendMessage(chatId, `Step 3/5: Pilih **Tipe Project**:`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📚 Course Project', callback_data: 'TYPE_course' }],
                    [{ text: '👤 Personal Project', callback_data: 'TYPE_personal' }]
                ]
            }
        });
        return true;
    }

    // NEW: Handle Manual Course Name Input (Replaces Button Selection)
    if (userSession.state === STATES.AWAITING_PROJECT_COURSE) {
        const courseName = msg.text.trim();

        updateSession(userId, {
            state: STATES.AWAITING_PROJECT_PRIORITY,
            data: { ...userSession.data, courseName, courseId: null }
        });

        askPriority(bot, chatId);
        return true;
    }

    if (userSession.state === STATES.AWAITING_PROJECT_DESC) {
        const note = msg.text === '/skip' ? '' : msg.text;
        const { title, deadline, priority, projectType, courseId, courseName } = userSession.data;

        const result = await processProjectCreation(bot, chatId, userId, {
            title, deadline, priority, projectType, courseId, description: note, courseName
        }, broadcastEvent);

        if (result.success) {
            bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
        }

        updateSession(userId, { state: STATES.IDLE, data: {} });
        return true;
    }

    return false;
};
