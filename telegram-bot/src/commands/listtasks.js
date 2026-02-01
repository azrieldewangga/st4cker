
import { DbService } from '../services/dbService.js';
import { formatDate } from '../nlp/dateParser.js';
import { findCourse, normalizeTaskType } from './task.js';
import { v4 as uuidv4 } from 'uuid';
import { broadcastEvent } from '../server.js'; // Direct import

const PAGE_SIZE = 10;
const sessions = {}; // Local session for edit

function getSession(userId) { return sessions[userId]; }
function setSession(userId, data) { sessions[userId] = { ...data, lastActive: Date.now() }; }
function clearSession(userId) { delete sessions[userId]; }

// Helper to update Task in DB & Broadcast
async function performTaskUpdate(userId, taskId, updates) {
    // 1. Update DB
    const result = await DbService.updateTask(taskId, updates);

    if (result.success) {
        // 2. Broadcast
        if (broadcastEvent) {
            const event = {
                eventId: uuidv4(),
                eventType: 'task.updated',
                timestamp: new Date().toISOString(),
                payload: { id: taskId, ...updates },
                source: 'telegram'
            };
            broadcastEvent(userId, event);
        }

        // Return updated object (simulated, or fetch again if critical)
        // For UI display, we merge updates into a dummy object or fetch fresh if needed.
        // Let's fetch fresh for accuracy
        return await DbService.getTaskById(taskId);
    }
    return null;
}

// Main Entry: List Tasks with Modes
export async function processListTasks(bot, chatId, userId, page = 0, mode = 'view') {
    // Fetch active tasks from DB
    const assignments = await DbService.getTasks(userId);

    if (!assignments || assignments.length === 0) {
        bot.sendMessage(chatId, '📭 **Tugas Kosong**\n\nSantai dulu, belum ada tugas aktif. Mau nambah? Ketik /task');
        return;
    }

    const now = new Date();

    // Sort: Overdue first, then by deadline ascending
    // (DbService sorts by deadline desc by default, let's re-sort in memory for correct view)
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

    // Need courses for Name Resolution
    // We can fetch user metadata if needed, but for now assuming updated DbService.getTasks might join or we fetch courses separately?
    // DbService.getTasks doesn't join currently.
    // Let's assume we fetch user metadata (courses) separately if we want perfect display.
    // Or just rely on stored name.

    // In new Schema, 'course' column stores Name directly or ID? 
    // In NLP Handler, we stored Name if resolved. 
    // If it stores ID (like course-xyz), we need to resolve.
    // Let's fetch user to get courses map.
    const user = await DbService.getUser(userId);
    // Wait, DbService.getUser just returns user table row. Doesn't join courses.
    // We need a way to get courses. 
    // TEMPORARILY: We just display what is in 'course' column. 
    // Ideally we migrate to storing IDs properly or fetching properly.
    // Assuming 'course' column has the display name for now (as per legacy logic often storing name).

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

        let displayCourse = task.course;
        // Simple heuristic: if course starts with course-, try to resolve?
        // user metadata doesn't have courses in new DB schema? 
        // We haven't migrated courses table yet? 
        // Wait, schema.js DOES NOT have courses table! 
        // Users table has semester/ipk. 
        // We need a 'courses' table if we want to store them in Postgres.
        // Currently courses are in JSON blob in SQLite? 
        // Ah, Phase 1 Checklist said "Transactions, Tasks, Projects".
        // Courses metadata is missing in Schema!
        // For now, we assume 'course' column holds the string name.

        let cleanTitle = task.title;
        // Clean Title logic...
        if (cleanTitle && displayCourse) {
            const normTitle = cleanTitle.toLowerCase();
            const normCourse = displayCourse.toLowerCase();
            if (normTitle.includes(normCourse)) {
                cleanTitle = cleanTitle.replace(new RegExp(displayCourse, 'gi'), '').trim();
                cleanTitle = cleanTitle.replace(/^[\s\W]+|[\s\W]+$/g, '');
            }
        }
        if (!cleanTitle) cleanTitle = task.type || 'Tugas';

        message += `${globalIndex}. ${statusIcon} ${cleanTitle} - ${displayCourse}\n`;
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
        const task = await DbService.getTaskById(taskId);

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

        // Fetch Details before delete for UI
        const task = await DbService.getTaskById(taskId);
        let removedDetails = '';
        if (task) {
            removedDetails = `\nMatkul: ${task.course}\nJudul: ${task.title}`;
        }

        const res = await DbService.deleteTask(taskId);

        if (res.success) {
            if (broadcastEvent) {
                const event = {
                    eventId: uuidv4(),
                    eventType: 'task.deleted',
                    timestamp: new Date().toISOString(),
                    payload: { id: taskId },
                    source: 'telegram'
                };
                broadcastEvent(userId, event);
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
        } else {
            bot.answerCallbackQuery(query.id, { text: 'Gagal hapus tugas.' });
        }
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
        // Course selection logic involves user Metadata (courses) which we might not have yet in DB fully
        // But let's support it if we do (or we will skip for now)
        // Since we removed 'store.js', 'userData.courses' is gone.
        // We need 'DbService.getCourses(userId)' but we didn't implement it yet.
        // For now, disabling Dynamic Course Selection via Button if we don't have courses.
        // Or we allow manual typing.

        bot.answerCallbackQuery(query.id, { text: 'Fitur pilih matkul dari list belum aktif (Database Migration).' });
        return;
    }

    if (data.startsWith('SELECT_TYPE_')) {
        // Similar issue with Types. 
        // Just allow manual typing for now or static types.
        const newType = data.replace('SELECT_TYPE_', '');
        const session = getSession(userId);

        if (session && session.data.taskId) {
            const updatedTask = await performTaskUpdate(userId, session.data.taskId, {
                title: newType,
                type: newType
            });

            if (updatedTask) {
                bot.editMessageText(`✅ **Update Berhasil!**\nTipe: ${updatedTask.title}`, {
                    chat_id: chatId,
                    message_id: message.message_id,
                    parse_mode: 'Markdown'
                });
                clearSession(userId);
            }
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
            'course': '📚 Ketik nama **Matkul Baru**:',
            'title': '📝 Pilih **Tipe Baru** atau ketik namanya:',
            'note': '📄 Masukkan **Catatan Baru** (Ketik "kosong" untuk menghapus):'
        };

        if (prompts[field]) {
            session.data.field = field;
            session.step = 'awaiting_input';
            setSession(userId, session);

            try { await bot.deleteMessage(chatId, message.message_id); } catch (e) { }

            let reply_markup = undefined;
            // Static Types buttons
            if (field === 'title') {
                const defaultTypes = ['Tugas', 'Laporan Pendahuluan', 'Laporan Sementara', 'Laporan Resmi'];
                const buttons = defaultTypes.map(t => ({ text: t, callback_data: `SELECT_TYPE_${t}` }));
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
            const updatedTask = await performTaskUpdate(userId, taskId, { status: statusKey });

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

    // Check Task Existence by ID
    const task = await DbService.getTaskById(taskId);

    if (!task) {
        bot.sendMessage(msg.chat.id, '❌ Tugas tidak ditemukan.');
        clearSession(userId);
        return true;
    }

    const updates = {};
    let msgPreview = '';

    if (field === 'title') {
        const rawTitle = msg.text.trim();
        const newTitle = normalizeTaskType(rawTitle); // ensure imported?
        updates.title = newTitle;
        updates.type = newTitle;
        msgPreview = `Tipe: ${newTitle}`;
    } else if (field === 'course') {
        updates.course = msg.text.trim();
        msgPreview = `Matkul: ${updates.course}`;
    } else if (field === 'note') {
        const input = msg.text.trim();
        updates.note = (input.toLowerCase() === 'kosong' || input === '-') ? '' : input;
        msgPreview = `Note: ${updates.note || '(Kosong)'}`;
    }

    await performTaskUpdate(userId, taskId, updates);

    bot.sendMessage(msg.chat.id, `✅ **Update Berhasil!**\n${msgPreview}`, { parse_mode: 'Markdown' });
    clearSession(userId);
    return true;
}
