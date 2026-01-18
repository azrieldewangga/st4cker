import {
    processTaskCreation,
    findCourse,
    normalizeTaskType
} from '../../commands/task.js';
import {
    handleListTasks,
    processDeleteTask,
    processEditTask
} from '../../commands/listtasks.js';

export async function handleTaskIntent(bot, msg, intent, data, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // 1. Create Task
    if (intent === 'buat_tugas') {
        const toLocalYMD = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dy = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dy}`;
        };

        const rawDate = data.parsedDate || new Date();
        const dateStr = toLocalYMD(rawDate); // Fallback to Today? Or should parsing handle it?

        // Assuming data.waktu.parsed exists if passed from main handler, 
        // else nlp-service dateParser handled it.
        // nlp-handler logic uses data.parsedDate.

        const res = await processTaskCreation(bot, chatId, userId, {
            courseId: data.courseId,
            courseName: data.matkul || data.course || 'General',
            type: data.tipe_tugas || 'Tugas',
            deadline: dateStr,
            notes: data.note || '',
            semester: ''
        }, broadcastEvent);

        if (res.success) bot.sendMessage(chatId, res.message, { parse_mode: 'Markdown' });
        else bot.sendMessage(chatId, `❌ ${res.message}`);
        return true;
    }

    // 2. View Tasks / Deadline
    if (intent === 'lihat_tugas' || intent === 'deadline_terdekat') {
        // handleListTasks expects (bot, msg, page) or similar.
        // It wraps processListTasks.
        return handleListTasks(bot, msg, 0);
    }

    // 3. Edit Task
    if (intent === 'edit_tugas') {
        return processEditTask(bot, chatId, userId);
    }

    // 4. Delete Task
    if (intent === 'hapus_tugas') {
        return processDeleteTask(bot, chatId, userId);
    }

    return false;
}
