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
import { generateDynamicResponse } from '../nlp-service.js';

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

        // Helper to extract value safely
        const getVal = (key) => data[key]?.value || '';

        // Extract Date: Use 'parsed' date object if available in data.waktu/data.date
        let targetDate = new Date();
        if (data.waktu?.parsed) targetDate = new Date(data.waktu.parsed);
        else if (data.date?.parsed) targetDate = new Date(data.date.parsed);

        const dateStr = toLocalYMD(targetDate);
        const courseName = getVal('matkul') || 'General';
        const taskType = getVal('tipe_tugas') || 'Tugas';

        // INTEGRASI: Gunakan findCourse untuk mendapatkan course ID yang benar
        // Format: course-{semester_asli}-{index}
        const courseInfo = findCourse(courseName, []);
        const courseId = courseInfo?.id || data.matkul?.courseId || null;

        // Map Enriched Data to Task Processor
        const res = await processTaskCreation(bot, chatId, userId, {
            courseId: courseId,
            courseName: courseInfo?.name || courseName,
            type: taskType,
            deadline: dateStr,
            notes: getVal('note') || ''
            // semester akan di-parse dari courseId di processTaskCreation
        }, broadcastEvent);

        if (res.success) {
            // Use dynamic response
            const dynamicMsg = await generateDynamicResponse('task_created', {
                type: taskType,
                courseName: courseInfo?.name || courseName,
                deadline: dateStr
            });
            bot.sendMessage(chatId, dynamicMsg);
        }
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
