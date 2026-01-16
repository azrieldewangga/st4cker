import { getUserData, saveUserData } from '../store.js';
import { parseDate } from '../nlp/dateParser.js';
import crypto from 'crypto';

// Local in-memory session store
const projectSessions = new Map();

export function clearSession(userId) {
    projectSessions.delete(userId.toString());
}


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

// Helper to escape Legacy Markdown characters
function escapeMarkdown(text) {
    if (!text) return '';
    return text.toString().replace(/([_*[`])/g, '\\$1');
}

// SHARED EXECUTION LOGIC: LOG PROGRESS
export async function processLogProgress(bot, chatId, userId, data, broadcastEvent) {
    const { projectId, duration, note, newStatus, newProgress, projectName } = data;

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

    let isOffline = false;
    if (broadcastEvent) {
        const result = broadcastEvent(userId, event);
        if (result && result.online === false) isOffline = true;
    }

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

    const escProject = escapeMarkdown(projectName);
    const escNote = escapeMarkdown(note);

    // Format status for display (remove underscores, capitalize)
    const displayStatus = newStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    let message = `✅ *Update Mantap!*\n\n📂 Project: ${escProject}\n📊 Progress: ${newProgress}%\n⚡ Status: ${displayStatus}\n⏱️ Kerja: ${timeStr}\n📝 Note: ${escNote}\n\n_Lanjut terus bos! 🔥_`;

    if (isOffline) {
        message += '\n\n☁️ _Saved to Cloud (Desktop Offline)_';
    }

    return {
        success: true,
        message
    };
}

// SHARED EXECUTION LOGIC: CREATE PROJECT
export async function processProjectCreation(bot, chatId, userId, data, broadcastEvent) {
    const { title, deadline, priority, projectType, courseId, description, courseName, link, linkTitle, links } = data;

    // Safety Fallback for Title
    const finalTitle = title || 'Untitled Project';
    const attachments = [];

    // 1. Handle Multiple Links (Priority)
    if (links && Array.isArray(links) && links.length > 0) {
        links.forEach(l => {
            if (!l.url || l.url === '-' || l.url.toLowerCase() === 'skip') return;
            let cleanUrl = l.url.trim();
            if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'https://' + cleanUrl;

            attachments.push({
                id: crypto.randomUUID(),
                type: 'link',
                title: l.title && l.title.toLowerCase() !== 'skip' ? l.title : 'Ref Link',
                url: cleanUrl
            });
        });
    }
    // 2. Fallback to Single Link (if no array provided)
    else if (link && link !== '-' && link.toLowerCase() !== 'skip') {
        let cleanUrl = link.trim();
        if (!/^https?:\/\//i.test(cleanUrl)) {
            cleanUrl = 'https://' + cleanUrl;
        }

        attachments.push({
            id: crypto.randomUUID(),
            type: 'link',
            title: linkTitle || 'Ref Link',
            url: cleanUrl
        });
    }

    const eventId = crypto.randomUUID();
    const event = {
        eventId: eventId,
        eventType: 'project.created',
        telegramUserId: userId,
        timestamp: new Date().toISOString(),
        payload: {
            title: finalTitle,
            description: description || '',
            deadline,
            priority,
            type: projectType,
            courseId: courseId,
            attachments // Pass attachments to Desktop App
        },
        source: 'telegram'
    };

    let isOffline = false;
    if (broadcastEvent) {
        const result = broadcastEvent(userId, event);
        if (result && result.online === false) isOffline = true;
    }

    // Optimistic Update (Save full data locally)
    const userData = getUserData(userId) || {};
    if (!userData.projects) userData.projects = [];

    userData.projects.push({
        id: eventId,
        name: finalTitle,
        description: description || '',
        status: 'in_progress',
        totalProgress: 0,
        deadline,
        priority,
        type: projectType,
        courseId,
        attachments,
        createdAt: new Date().toISOString()
    });
    saveUserData(userId, userData);

    const escTitle = escapeMarkdown(finalTitle);
    const escDesc = escapeMarkdown(description || '-');
    const escCourse = escapeMarkdown(courseName);

    let message = `✅ *Project Created!*\n\n📌 ${escTitle}\n📅 Due: ${deadline}\n⚡ Priority: ${priority}\n📂 Type: ${projectType === 'course' ? `Course Project (${escCourse})` : 'Personal'}\n📝 Desc: ${escDesc}\n\n_Siap dieksekusi!_`;

    if (isOffline) {
        message += '\n\n☁️ _Saved to Cloud (Desktop Offline)_';
    }

    return {
        success: true,
        message
    };
}


// Handler: Start Project Creation (Deadline First)
export const handleCreateProjectCommand = async (bot, msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    updateSession(userId, {
        state: 'AWAITING_PROJECT_DEADLINE',
        data: {}
    });

    bot.sendMessage(chatId, '🆕 *Bikin Project Baru*\n\nStep 1/5: Masukkan **Deadline** (YYYY-MM-DD):', { parse_mode: 'Markdown' });
};

// LIST PROJECTS (SHARED)
export async function processListProjects(bot, chatId, userId, page = 1, mode = 'view') {
    const userData = getUserData(userId);

    if (!userData || !userData.projects || userData.projects.length === 0) {
        return bot.sendMessage(chatId, '📂 *Belum ada Project*\n\nKetik /project buat bikin baru!', { parse_mode: 'Markdown' });
    }

    // Filter Active Only
    const activeProjects = userData.projects
        .filter(p => p.status !== 'completed')
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline)); // Sort by deadline

    if (activeProjects.length === 0) {
        return bot.sendMessage(chatId, '✅ *Semua Project Selesai!*\n\nSantai dulu bang 😎', { parse_mode: 'Markdown' });
    }

    // Pagination
    const PAGE_SIZE = 5;
    const totalPages = Math.ceil(activeProjects.length / PAGE_SIZE);

    // Adjust page if out of bounds
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const items = activeProjects.slice(start, end);

    let titleInfo = '📂 **Active Projects**';
    if (mode === 'delete') titleInfo = '🗑️ **Hapus Project** (Pilih nomor)';
    if (mode === 'edit') titleInfo = '✏️ **Edit Project** (Pilih nomor)';

    let response = `${titleInfo} (${activeProjects.length}) - Page ${page}/${totalPages}\n\n`;

    const inlineKeyboard = [];

    items.forEach((proj, idx) => {
        const realIdx = start + idx + 1;
        const daysLeft = Math.ceil((new Date(proj.deadline) - new Date()) / (1000 * 60 * 60 * 24));
        const statusIcon = proj.status === 'in_progress' ? '▶️' : '⏸️';

        // Priority Icon
        let prioIcon = '';
        if (proj.priority === 'high') prioIcon = '🔴';
        else if (proj.priority === 'medium') prioIcon = '🟡';
        else prioIcon = '🟢';

        response += `${realIdx}. ${statusIcon} **${proj.name}**\n`;
        response += `   📊 ${proj.totalProgress || 0}% | ${prioIcon} ${proj.priority}\n`;
        response += `   📅 ${proj.deadline} (${daysLeft > 0 ? daysLeft + ' hari lagi' : 'OVERDUE ⚠️'})\n\n`;

        // Buttons based on Mode
        if (mode === 'view') {
            inlineKeyboard.push([{
                text: `📝 Log: ${proj.name}`,
                callback_data: `log_proj_${proj.id}`
            }]);
        } else if (mode === 'delete') {
            inlineKeyboard.push([{
                text: `❌ Hapus ${realIdx}`,
                callback_data: `del_proj_${proj.id}`
            }]);
        } else if (mode === 'edit') {
            inlineKeyboard.push([{
                text: `✏️ Edit ${realIdx}`,
                callback_data: `edit_proj_${proj.id}`
            }]);
        }
    });

    // Pagination Buttons
    const navRow = [];
    const modeSuffix = mode === 'view' ? '' : `_mode=${mode}`;
    if (page > 1) navRow.push({ text: '⬅️ Prev', callback_data: `list_proj_page_${page - 1}${modeSuffix}` });
    if (page < totalPages) navRow.push({ text: 'Next ➡️', callback_data: `list_proj_page_${page + 1}${modeSuffix}` });

    if (navRow.length > 0) inlineKeyboard.push(navRow);

    // Cancel / Back Button for Action Modes
    if (mode !== 'view') {
        inlineKeyboard.push([{ text: '🔙 Kembali / Selesai', callback_data: 'cancel_proj_action' }]);
    }

    bot.sendMessage(chatId, response, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: inlineKeyboard
        }
    });
}



export const processEditProject = async (bot, chatId, userId) => {
    return processListProjects(bot, chatId, userId, 1, 'edit');
};

export const processDeleteProject = async (bot, chatId, userId) => {
    return processListProjects(bot, chatId, userId, 1, 'delete');
};

export const handleProjectsCommand = async (bot, msg) => {
    // Acts as /listprojects
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    await processListProjects(bot, chatId, userId, 1);
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
        bot.sendMessage(chatId, `📝 Catat progress buat *${project.name}*\n\nUpdate Status Project:`, {
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

        // Clean up status buttons
        try {
            await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id });
        } catch (e) { }

        updateSession(userId, {
            state: 'AWAITING_LOG_DURATION',
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
        const userData = getUserData(userId);
        const project = userData.projects.find(p => p.id === projectId);

        if (!project) {
            bot.answerCallbackQuery(query.id, { text: 'Project not found.' });
            return processListProjects(bot, chatId, userId, 1, 'delete');
        }

        bot.editMessageText(`⚠️ **Konfirmasi Hapus Project**\n\n📌 **${project.name}**\nProgress: ${project.totalProgress}%\n\nYakin mau dihapus permanen?`, {
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
        const userData = getUserData(userId);
        const idx = userData.projects.findIndex(p => p.id === projectId);

        let details = '';
        if (idx !== -1) {
            details = userData.projects[idx].name;
            userData.projects.splice(idx, 1);
            saveUserData(userId, userData);

            // Broadcast
            if (broadcastEvent) {
                broadcastEvent(userId, {
                    eventId: crypto.randomUUID(),
                    eventType: 'project.deleted',
                    timestamp: new Date().toISOString(),
                    payload: { id: projectId },
                    source: 'telegram'
                });
            }
        }

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
            state: 'EDITING_PROJECT_SELECT',
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
            state: 'AWAITING_EDIT_INPUT',
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
            const userData = getUserData(userId);
            const project = userData.projects.find(p => p.id === session.data.projectId);
            if (project) {
                project.priority = priority;
                saveUserData(userId, userData);

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
        }
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
                bot.sendMessage(chatId, '⚠️ Belum ada course yg sync. Pilih Personal Project aja atau sync dulu desktop app.');
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

            bot.editMessageText(`📚 Pilih **Matkul**:`, {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: { inline_keyboard: courseButtons },
                parse_mode: 'Markdown'
            });
        } else {
            // Personal -> Skip to Priority
            updateSession(userId, {
                state: 'AWAITING_PROJECT_PRIORITY',
                data: { ...userSession.data, projectType: 'personal', courseId: null, courseName: null }
            });

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
            state: 'AWAITING_PROJECT_DESC',
            data: { ...userSession.data, priority }
        });

        bot.answerCallbackQuery(query.id);

        // FIX: Edit the priority selection message to hide buttons
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

export const handleProjectInput = async (bot, msg, broadcastEvent) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const userSession = getSession(userId);

    if (!userSession || !userSession.state) return false;

    // --- LOGGING FLOW ---
    if (userSession.state === 'AWAITING_LOG_DURATION') {
        const durationStr = msg.text.toLowerCase();
        const durationMinutes = parseDuration(durationStr);

        if (!durationMinutes) {
            bot.sendMessage(chatId, '❌ Format salah. Coba "2h", "30m", atau "1.5h".');
            return true;
        }

        updateSession(userId, {
            state: 'AWAITING_LOG_PROGRESS',
            data: { ...userSession.data, duration: durationMinutes }
        });

        bot.sendMessage(chatId, `📊 Progress sekarang: ${userSession.data.currentProgress}%\n\nMasukkan **Progress Baru %** (0-100):`);
        return true;
    }

    if (userSession.state === 'AWAITING_LOG_PROGRESS') {
        const input = msg.text.trim();
        const progress = parseInt(input);

        if (isNaN(progress) || progress < 0 || progress > 100) {
            bot.sendMessage(chatId, '❌ Angkanya ga valid. Masukkan 0-100.');
            return true;
        }

        // 100% CHECK LOGIC
        if (progress === 100) {
            updateSession(userId, {
                state: 'AWAITING_COMPLETION_CONFIRM',
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
            state: 'AWAITING_LOG_NOTE',
            data: { ...userSession.data, newProgress: progress }
        });

        bot.sendMessage(chatId, `📝 Oke ${progress}%. Ada catatan/progress note? (Wajib)`);
        return true;
    }

    if (userSession.state === 'AWAITING_COMPLETION_CONFIRM') {
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
            state: 'AWAITING_LOG_NOTE',
            data: { ...userSession.data, newProgress: finalProgress, newStatus: finalStatus }
        });

        bot.sendMessage(chatId, `📝 Terakhir, isi **Note** buat log ini:`);
        return true;
    }

    if (userSession.state === 'AWAITING_LOG_NOTE') {
        const note = msg.text;
        if (!note || note.trim().length === 0) {
            bot.sendMessage(chatId, '❌ Note wajib diisi ya buat log progress.');
            return true;
        }

        const { projectId, duration, projectName, newStatus, newProgress } = userSession.data; // newStatus might come from confirm

        const result = await processLogProgress(bot, chatId, userId, {
            projectId,
            duration,
            note,
            newStatus: newStatus || 'in_progress', // Default fallback
            newProgress,
            projectName
        }, broadcastEvent);

        if (result.success) {
            bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
        }

        updateSession(userId, { state: 'IDLE', data: {} });
        return true;
    }


    if (userSession.state === 'AWAITING_EDIT_INPUT') {
        const { projectId, field } = userSession.data;
        const input = msg.text.trim();
        const userData = getUserData(userId);
        const project = userData.projects.find(p => p.id === projectId);

        if (!project) {
            bot.sendMessage(chatId, '❌ Project not found.');
            clearSession(userId);
            return true;
        }

        if (field === 'deadline') {
            const parsedDate = parseDate(input);
            if (!parsedDate) {
                bot.sendMessage(chatId, '❌ Format tanggal tidak dikenali. Coba: "YYYY-MM-DD" atau "25 Mar 2026"');
                return true;
            }
            // Format to YYYY-MM-DD
            const yyyy = parsedDate.getFullYear();
            const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
            const dd = String(parsedDate.getDate()).padStart(2, '0');
            const formatted = `${yyyy}-${mm}-${dd}`;

            project.deadline = formatted;
        } else if (field === 'title') {
            project.name = input;
        }

        saveUserData(userId, userData);
        bot.sendMessage(chatId, `✅ Project **${field}** berhasil diupdate!`, { parse_mode: 'Markdown' });

        // Broadcast Update (Simple version)
        if (broadcastEvent) {
            broadcastEvent(userId, {
                eventId: crypto.randomUUID(),
                eventType: 'project.updated',
                timestamp: new Date().toISOString(),
                payload: { id: projectId, updates: { [field === 'title' ? 'name' : field]: field === 'deadline' ? project.deadline : input } },
                source: 'telegram'
            });
        }

        clearSession(userId);
        return true;
    }

    // --- CREATION FLOW ---
    if (userSession.state === 'AWAITING_PROJECT_DEADLINE') {
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
            state: 'AWAITING_PROJECT_TITLE',
            data: { ...userSession.data, deadline: formatted }
        });

        bot.sendMessage(chatId, ` Step 2/5: Masukkan **Judul Project**:`, { parse_mode: 'Markdown' });
        return true;
    }

    if (userSession.state === 'AWAITING_PROJECT_TITLE') {
        const title = msg.text.trim();

        updateSession(userId, {
            state: 'AWAITING_PROJECT_TYPE',
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

    if (userSession.state === 'AWAITING_PROJECT_DESC') {
        const note = msg.text === '/skip' ? '' : msg.text;
        const { title, deadline, priority, projectType, courseId, courseName } = userSession.data;

        const result = await processProjectCreation(bot, chatId, userId, {
            title, deadline, priority, projectType, courseId, description: note, courseName
        }, broadcastEvent);

        if (result.success) {
            bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
        }

        updateSession(userId, { state: 'IDLE', data: {} });
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
