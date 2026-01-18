import {
    processProjectCreation,
    processLogProgress,
    processListProjects,
    processEditProject,
    processDeleteProject
} from '../../commands/project.js';
import { getUserData } from '../../store.js';

export async function handleProjectIntent(bot, msg, intent, data, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // 1. Create Project
    if (intent === 'buat_project') {
        console.log('[ProjectHandler] Data:', JSON.stringify(data, null, 2));

        const toLocalYMD = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dy = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dy}`;
        };

        const rawDate = data.parsedDate || new Date();
        const dateStr = toLocalYMD(rawDate);

        const res = await processProjectCreation(bot, chatId, userId, {
            title: data.project || data.judul,
            deadline: dateStr,
            priority: data.priority || 'medium',
            projectType: data.project_type || 'personal',
            courseId: data.courseId,
            description: data.note || '',
            courseName: data.matkul || '',
            link: data.link || '',
            linkTitle: data.link_title || '',
            links: data.links || []
        }, broadcastEvent);

        if (res.success) bot.sendMessage(chatId, res.message, { parse_mode: 'Markdown' });
        else bot.sendMessage(chatId, `❌ ${res.message}`);
        return true;
    }

    // 2. Log Progress
    if (intent === 'catat_progress') {
        const projects = getUserData(userId)?.projects || [];
        let targetProject = null;
        if (data.project) {
            const search = data.project.toLowerCase();
            targetProject = projects.find(p => p.name.toLowerCase().includes(search));
        }

        if (!targetProject) {
            // Interactive Selection
            const buttons = projects.slice(0, 10).map(p => [{
                text: p.name,
                callback_data: `nlp_progress_${p.id}` // This callback needs to be handled in logic or passed back?
                // The callback handler in nlp-handler.js handles 'nlp_progress_' prefix.
                // It sets pending state and asks for missing slots.
                // So this just initiates the UI.
            }]);

            if (buttons.length === 0) {
                bot.sendMessage(chatId, 'Belum ada project aktif. Buat dulu ya!');
                return true;
            }
            bot.sendMessage(chatId, 'Pilih project yg mau dicatat:', {
                reply_markup: { inline_keyboard: buttons }
            });
            return true;
        }

        // Check for 100% completion flag
        if (data.persentase == 100) data.newStatus = 'completed';

        const res = await processLogProgress(bot, chatId, userId, {
            projectId: targetProject.id,
            projectName: targetProject.name,
            duration: typeof data.duration === 'string' ? parseInt(data.duration) : (data.duration || 60),
            note: data.note || 'Progress Log',
            newStatus: data.newStatus || 'in_progress',
            newProgress: parseInt(data.persentase)
        }, broadcastEvent);

        if (res.success) bot.sendMessage(chatId, res.message, { parse_mode: 'Markdown' });
        return true;
    }

    // 3. View Projects
    if (intent === 'lihat_project') {
        return processListProjects(bot, chatId, userId, 1);
    }

    // 4. Delete Project
    if (intent === 'hapus_project') {
        return processDeleteProject(bot, chatId, userId);
    }

    // 5. Edit Project
    if (intent === 'edit_project') {
        return processEditProject(bot, chatId, userId);
    }

    return false;
}
