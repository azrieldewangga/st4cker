import { getUserData, saveUserData } from '../store.js';
import { formatDate } from '../nlp/dateParser.js';
import { findCourse, normalizeTaskType } from './task.js';
import { v4 as uuidv4 } from 'uuid';

const PAGE_SIZE = 10;
const sessions = {}; // Simple local session for edit steps

function getSession(userId) { return sessions[userId]; }
function setSession(userId, data) { sessions[userId] = { ...data, lastActive: Date.now() }; }
function clearSession(userId) { delete sessions[userId]; }

// Helper to perform update and broadcast
function performTaskUpdate(userId, taskId, updates, broadcastEvent) {
    const userData = getUserData(userId);
    const task = userData.activeAssignments.find(t => t.id === taskId);
    if (!task) return null;

    Object.assign(task, updates);
    saveUserData(userId, userData);

    if (broadcastEvent) {
        broadcastEvent(userId, {
            eventId: uuidv4(),
            eventType: 'task.updated',
            timestamp: new Date().toISOString(),
            payload: { id: taskId, ...updates },
            source: 'telegram'
        });
    }
    return task;
}

// Main Entry: List Tasks with Modes
export async function processListTasks(bot, chatId, userId, page = 0, mode = 'view') {
    // Get user data
    const userData = getUserData(userId);
    if (!userData || !userData.activeAssignments || userData.activeAssignments.length === 0) {
        bot.sendMessage(chatId, '📭 **Tugas Kosong**\n\nSantai dulu, belum ada tugas aktif. Mau nambah? Ketik /task');
        return;
    }

    let assignments = [...userData.activeAssignments];
    const now = new Date();

    // Sort: Overdue first, then by deadline ascending
    assignments.sort((a, b) => {
        const dateA = new Date(a.deadline);
        const dateB = new Date(b.deadline);
        return dateA - dateB;
    });

    const totalTasks = assignments.length;
    const totalPages = Math.ceil(totalTasks / PAGE_SIZE);

    if (page < 0) page = 0;
    if (page >= totalPages) page = totalPages - 1;

    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = assignments.slice(start, end);

    let titleInfo = '📋 **Daftar Tugas**';
    if (mode === 'delete') titleInfo = '🗑️ **Hapus Tugas** (Pilih nomor)';
    if (mode === 'edit') titleInfo = '✏️ **Edit Tugas** (Pilih nomor)';

    let message = `${titleInfo} (${page + 1}/${totalPages})\n\n`;

    const buttons = [];
    let row = [];

    // Render Items
    pageItems.forEach((task, index) => {
        const globalIndex = start + index + 1;
        const deadlineDate = new Date(task.deadline);
        const isOverdue = deadlineDate < now && (task.status !== 'completed' && task.status !== 'Done');

        // Days Left calc
        const diffTime = deadlineDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        // Force Jakarta Timezone for Display
        const deadlineStr = deadlineDate.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            timeZone: 'Asia/Jakarta'
        });

        let statusIcon = '⬜';
        if (task.status === 'in-progress' || task.status === 'In Progress') statusIcon = '⏳';
        else if (task.status === 'completed' || task.status === 'Done') statusIcon = '✅';
        if (isOverdue) statusIcon = '⚠️';

        let timeStatus = '';
        if (diffDays < 0) timeStatus = 'Telat!';
        else if (diffDays === 0) timeStatus = 'Hari ini!';
        else if (diffDays === 1) timeStatus = 'Besok!';
        else timeStatus = `${diffDays} hari lagi`;

        // Fix Course Name Display (Resolve ID to Name)
        let displayCourse = task.course;
        if (displayCourse.startsWith('course-') && userData.courses) {
            const foundC = userData.courses.find(c => c.id === displayCourse);
            if (foundC) displayCourse = foundC.name;
        }

        // Clean Title: Remove course name if present to avoid redundancy
        // Example: "Keamanan Jaringan Tugas" -> "Tugas"
        let cleanTitle = task.title;
        if (cleanTitle && displayCourse) {
            const normTitle = cleanTitle.toLowerCase();
            const normCourse = displayCourse.toLowerCase();
            if (normTitle.includes(normCourse)) {
                cleanTitle = cleanTitle.replace(new RegExp(displayCourse, 'gi'), '').trim();
                // Remove leading/trailing non-word chars (like " - ")
                cleanTitle = cleanTitle.replace(/^[\s\W]+|[\s\W]+$/g, '');
            }
        }
        if (!cleanTitle) cleanTitle = task.type || 'Tugas';

        // Format: 1. Icon Title - Course
        message += `${globalIndex}. ${statusIcon} ${cleanTitle} - ${displayCourse}\n`;
        // message += `   📅 ${deadlineStr} (${timeStatus})\n`; // This line is next, ensuring we don't break it
        message += `   📅 ${deadlineStr} (${timeStatus})\n`;
        if (task.note) message += `   📝 Note: ${task.note}\n`;
        message += `\n`;

        // Action Buttons logic
        if (mode === 'delete') {
            row.push({ text: `❌ ${globalIndex}`, callback_data: `del_task_${task.id}` });
        } else if (mode === 'edit') {
            row.push({ text: `✏️ ${globalIndex}`, callback_data: `edit_task_${task.id}` });
        }

        if (row.length === 5) {
            buttons.push(row);
            row = [];
        }
    });

    if (row.length > 0) buttons.push(row);

    // Navigation Buttons
    const navRow = [];
    if (page > 0) navRow.push({ text: '⬅️ Prev', callback_data: `list_task_page_${page - 1}_${mode}` });
    if (page < totalPages - 1) navRow.push({ text: 'Next ➡️', callback_data: `list_task_page_${page + 1}_${mode}` });
    if (navRow.length > 0) buttons.push(navRow);

    // Cancel Button for Action Modes
    if (mode !== 'view') {
        buttons.push([{ text: '🔙 Kembali', callback_data: 'cancel_task_action' }]);
    }

    const opts = {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    };

    bot.sendMessage(chatId, message, opts);
}

// Entry Points for NLP
export function handleListTasks(bot, msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    return processListTasks(bot, chatId, userId, 0, 'view');
}

export function processDeleteTask(bot, chatId, userId) {
    return processListTasks(bot, chatId, userId, 0, 'delete');
}

export function processEditTask(bot, chatId, userId) {
    return processListTasks(bot, chatId, userId, 0, 'edit');
}

// Callback Handler
export async function handleTaskListCallback(bot, query, broadcastEvent) {
    const { data, message } = query;
    const chatId = message.chat.id;
    const userId = query.from.id.toString();

    // Pagination
    if (data.startsWith('list_task_page_')) {
        const parts = data.replace('list_task_page_', '').split('_');
        const page = parseInt(parts[0]);
        const mode = parts[1] || 'view';

        try { await bot.deleteMessage(chatId, message.message_id); } catch (e) { }
        return processListTasks(bot, chatId, userId, page, mode);
    }

    // Cancel
    if (data === 'cancel_task_action') {
        try { await bot.deleteMessage(chatId, message.message_id); } catch (e) { }
        return processListTasks(bot, chatId, userId, 0, 'view');
    }

    // --- DELETE ACTION (CONFIRMATION) ---
    if (data.startsWith('del_task_')) {
        const taskId = data.replace('del_task_', '');
        const userData = getUserData(userId);
        const task = userData?.activeAssignments?.find(t => t.id === taskId);

        if (!task) {
            bot.answerCallbackQuery(query.id, { text: 'Tugas tidak ditemukan.' });
            return processListTasks(bot, chatId, userId, 0, 'delete');
        }

        const confirmMsg = `⚠️ **Konfirmasi Hapus Tugas**\n\n` +
            `Matkul: ${task.course}\n` +
            `Judul: ${task.title}\n` +
            `Sisa Waktu: ${formatDate(new Date(task.deadline))}\n\n` +
            `Yakin mau dihapus permanen?`;

        bot.editMessageText(confirmMsg, {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Ya, Hapus', callback_data: `confirm_del_task_${taskId}` }],
                    [{ text: '❌ Batal', callback_data: `cancel_task_action` }]
                ]
            }
        });
        bot.answerCallbackQuery(query.id);
        return;
    }

    // --- CONFIRMED DELETE ---
    if (data.startsWith('confirm_del_task_')) {
        const taskId = data.replace('confirm_del_task_', '');
        const userData = getUserData(userId);
        let removedDetails = '';

        if (userData && userData.activeAssignments) {
            const idx = userData.activeAssignments.findIndex(t => t.id === taskId);
            if (idx !== -1) {
                const task = userData.activeAssignments[idx];
                removedDetails = `\nMatkul: ${task.course}\nJudul: ${task.title}`;
                userData.activeAssignments.splice(idx, 1);
                saveUserData(userId, userData);

                // Broadcast
                if (broadcastEvent) {
                    broadcastEvent(userId, {
                        eventId: uuidv4(),
                        eventType: 'task.deleted',
                        timestamp: new Date().toISOString(),
                        payload: { id: taskId },
                        source: 'telegram'
                    });
                }
            }
        }

        try {
            bot.editMessageText(`✅ **Tugas Berhasil Dihapus!**${removedDetails}`, {
                chat_id: chatId,
                message_id: message.message_id,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [] }
            });
        } catch (e) { }

        bot.answerCallbackQuery(query.id, { text: 'Terhapus!' });
        return;
    }

    // --- EDIT ACTION ---
    if (data.startsWith('edit_task_')) {
        const taskId = data.replace('edit_task_', '');
        setSession(userId, {
            command: 'edit_task',
            step: 'select_field',
            data: { taskId }
        });

        bot.answerCallbackQuery(query.id);

        bot.editMessageText('✏️ **Mode Edit Tugas**\nMau ubah bagian mana?', {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📚 Ganti Matkul', callback_data: 'EDIT_TASK_course' }],
                    [{ text: '📝 Ganti Tipe', callback_data: 'EDIT_TASK_title' }],
                    [{ text: '📄 Ganti Note', callback_data: 'EDIT_TASK_note' }],
                    [{ text: '🔄 Set Status', callback_data: 'EDIT_TASK_status' }],
                    [{ text: '❌ Batal', callback_data: 'cancel_edit_task' }]
                ]
            }
        });
        return;
    }

    // --- BUTTON SELECTION HANDLERS (Course & Type) ---
    if (data.startsWith('SELECT_COURSE_')) {
        const courseId = data.replace('SELECT_COURSE_', '');
        const session = getSession(userId);

        if (session && session.data.taskId) {
            const userData = getUserData(userId);
            const course = userData.courses.find(c => c.id === courseId);
            const task = userData.activeAssignments.find(t => t.id === session.data.taskId);

            if (course && task) {
                // Validation: Prevent Theory Course for Laporan
                const isLaporan = (t) => /Laporan/i.test(t);
                const isTheory = (c) => !/Praktikum|Workshop|Lab|Studio|KP|Skripsi|Proyek/i.test(c);

                if (isLaporan(task.type || task.title) && isTheory(course.name)) {
                    bot.answerCallbackQuery(query.id, {
                        text: "❌ Laporan tidak bisa untuk matkul Teori! Pilih matkul Praktikum/Workshop.",
                        show_alert: true
                    });
                    return;
                }

                const updatedTask = performTaskUpdate(userId, session.data.taskId, { course: course.name }, broadcastEvent);
                if (updatedTask) {
                    bot.editMessageText(`✅ **Update Berhasil!**\nMatkul: ${updatedTask.course}`, {
                        chat_id: chatId,
                        message_id: message.message_id,
                        parse_mode: 'Markdown'
                    });
                    clearSession(userId);
                }
            }
        } else {
            bot.editMessageText('⚠️ **Sesi Berakhir**\nSilakan ulangi edit dari awal atau ketik /listtasks', {
                chat_id: chatId,
                message_id: message.message_id,
                parse_mode: 'Markdown'
            });
        }
        bot.answerCallbackQuery(query.id);
        return;
    }

    if (data.startsWith('SELECT_TYPE_')) {
        const newType = data.replace('SELECT_TYPE_', '');
        const session = getSession(userId);

        if (session && session.data.taskId) {
            const userData = getUserData(userId);
            const task = userData.activeAssignments.find(t => t.id === session.data.taskId);

            if (task) {
                // Validation: Prevent Laporan Type for Theory Course
                const isLaporan = (t) => /Laporan/i.test(t);
                const isTheory = (c) => !/Praktikum|Workshop|Lab|Studio|KP|Skripsi|Proyek/i.test(c);

                if (isLaporan(newType) && isTheory(task.course)) {
                    bot.answerCallbackQuery(query.id, {
                        text: "❌ Matkul Teori tidak butuh Laporan! Pilih tipe Tugas biasa.",
                        show_alert: true
                    });
                    return;
                }

                // Type maps to Title in current schema
                const updatedTask = performTaskUpdate(userId, session.data.taskId, {
                    title: newType,
                    type: newType
                }, broadcastEvent);

                if (updatedTask) {
                    bot.editMessageText(`✅ **Update Berhasil!**\nTipe: ${updatedTask.title}`, {
                        chat_id: chatId,
                        message_id: message.message_id,
                        parse_mode: 'Markdown'
                    });
                    clearSession(userId);
                }
            }
        } else {
            bot.editMessageText('⚠️ **Sesi Berakhir**\nSilakan ulangi edit dari awal atau ketik /listtasks', {
                chat_id: chatId,
                message_id: message.message_id,
                parse_mode: 'Markdown'
            });
        }
        bot.answerCallbackQuery(query.id);
        return;
    }
    // --- EDIT FLOW HANDLERS ---
    if (data.startsWith('EDIT_TASK_')) {
        const field = data.replace('EDIT_TASK_', '');
        const session = getSession(userId);

        // Sub-menu for Status
        if (field === 'status') {
            bot.editMessageText('🔄 **Pilih Status Baru:**', {
                chat_id: chatId,
                message_id: message.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬜ To Do', callback_data: 'SET_TASK_STATUS_pending' }],
                        [{ text: '⏳ In Progress', callback_data: 'SET_TASK_STATUS_in-progress' }],
                        [{ text: '✅ Done', callback_data: 'SET_TASK_STATUS_completed' }],
                        [{ text: '🔙 Kembali', callback_data: `edit_task_${session.data.taskId}` }]
                    ]
                }
            });
            return;
        }

        // Text Input Fields configuration
        const prompts = {
            'course': '📚 Pilih **Matkul Baru** atau ketik namanya:',
            'title': '📝 Pilih **Tipe Baru** atau ketik namanya:',
            'note': '📄 Masukkan **Catatan Baru** (Ketik "kosong" untuk menghapus):'
        };

        if (prompts[field]) {
            session.data.field = field;
            session.step = 'awaiting_input';
            setSession(userId, session);

            try { await bot.deleteMessage(chatId, message.message_id); } catch (e) { }

            let reply_markup = undefined;
            const userData = getUserData(userId);

            // Dynamic Buttons for Course
            if (field === 'course' && userData && userData.courses) {
                const buttons = userData.courses.map(c => ({ text: c.name, callback_data: `SELECT_COURSE_${c.id}` }));
                const keyboard = [];
                for (let i = 0; i < buttons.length; i += 2) keyboard.push(buttons.slice(i, i + 2));
                reply_markup = { inline_keyboard: keyboard };
            }

            // Buttons for Title/Type
            if (field === 'title') {
                // Default Types + User assignment types if available
                const defaultTypes = ['Tugas', 'Laporan Pendahuluan', 'Laporan Sementara', 'Laporan Resmi'];
                const types = (userData.assignmentTypes && userData.assignmentTypes.length) ? userData.assignmentTypes : defaultTypes;

                const buttons = types.map(t => ({ text: t, callback_data: `SELECT_TYPE_${t}` }));
                const keyboard = [];
                for (let i = 0; i < buttons.length; i += 2) keyboard.push(buttons.slice(i, i + 2));
                reply_markup = { inline_keyboard: keyboard };
            }

            bot.sendMessage(chatId, prompts[field], { parse_mode: 'Markdown', reply_markup });
            return;
        }
    }

    // Set Status Action
    if (data.startsWith('SET_TASK_STATUS_')) {
        const statusKey = data.replace('SET_TASK_STATUS_', '');
        const session = getSession(userId);
        if (session) {
            const taskId = session.data.taskId;

            const updatedTask = performTaskUpdate(userId, taskId, { status: statusKey }, broadcastEvent);
            if (updatedTask) {
                const displayMap = { 'pending': 'To Do', 'in-progress': 'In Progress', 'completed': 'Done' };
                bot.editMessageText(`✅ **Status Berhasil Diupdate!**\nSekarang: **${displayMap[statusKey]}**\n(${updatedTask.title})`, {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown'
                });
            }
        }
    }
    if (data === 'cancel_edit_task') {
        clearSession(userId);
        try {
            bot.editMessageText('❌ Edit dibatalkan.', {
                chat_id: chatId,
                message_id: message.message_id
            });
        } catch (e) { }
        return;
    }
}

// Handle Text Input for Task Edit
export async function handleEditTaskInput(bot, msg, broadcastEvent) {
    const userId = msg.from.id.toString();
    const session = getSession(userId);

    if (!session || session.command !== 'edit_task' || session.step !== 'awaiting_input') return false;

    const { taskId, field } = session.data;
    const userData = getUserData(userId);
    const task = userData.activeAssignments.find(t => t.id === taskId);

    if (!task) {
        bot.sendMessage(msg.chat.id, '❌ Tugas tidak ditemukan.');
        clearSession(userId);
        return true;
    }

    const updates = {};
    let msgPreview = '';

    const isLaporan = (t) => /Laporan/i.test(t);
    const isTheory = (c) => !/Praktikum|Workshop|Lab|Studio|KP|Skripsi|Proyek/i.test(c);

    if (field === 'title') {
        const rawTitle = msg.text.trim();
        const newTitle = normalizeTaskType(rawTitle);

        if (isLaporan(newTitle) && isTheory(task.course)) {
            bot.sendMessage(msg.chat.id, '❌ Matkul Teori tidak butuh Laporan! Silakan ganti tipe lain.');
            return true;
        }

        updates.title = newTitle;
        updates.type = newTitle;
        msgPreview = `Tipe: ${newTitle}`;
    } else if (field === 'course') {
        const rawText = msg.text.trim();
        // FUZZY MATCH LOGIC
        const resolvedCourse = findCourse(rawText, userData.courses || []);
        const newCourseName = resolvedCourse ? resolvedCourse.name : rawText;

        if (isLaporan(task.type || task.title) && isTheory(newCourseName)) {
            bot.sendMessage(msg.chat.id, '❌ Laporan tidak bisa untuk matkul Teori! Cari matkul lain.');
            return true;
        }

        updates.course = newCourseName;
        msgPreview = `Matkul: ${updates.course}`;
    } else if (field === 'note') {
        const input = msg.text.trim();
        updates.note = (input.toLowerCase() === 'kosong' || input === '-') ? '' : input;
        msgPreview = `Note: ${updates.note || '(Kosong)'}`;
    }

    performTaskUpdate(userId, taskId, updates, broadcastEvent);

    bot.sendMessage(msg.chat.id, `✅ **Update Berhasil!**\n${msgPreview}`, { parse_mode: 'Markdown' });
    clearSession(userId);
    return true;
}
