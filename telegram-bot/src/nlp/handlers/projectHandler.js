
import {
    processProjectCreation,
    processLogProgress,
    processListProjects,
    processEditProject,
    processDeleteProject
} from '../../commands/project.js';
import { DbService } from '../../services/dbService.js';
import { generateDynamicResponse } from '../nlp-service.js';

export async function handleProjectIntent(bot, msg, intent, data, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const getVal = (key) => typeof data[key] === 'object' ? data[key]?.value : (data[key] || '');

    // 1. Create Project
    if (intent === 'buat_project') {
        const toLocalYMD = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dy = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dy}`;
        };

        // Handle Date
        let targetDate = new Date();
        if (data.waktu?.parsed) targetDate = new Date(data.waktu.parsed);
        else if (data.date?.parsed) targetDate = new Date(data.date.parsed);
        const dateStr = toLocalYMD(targetDate);

        const projectType = getVal('project_type') || 'personal';
        const matkulObj = data.matkul;

        const projectTitle = getVal('project') || getVal('judul') || 'Untitled';

        const res = await processProjectCreation(bot, chatId, userId, {
            title: projectTitle,
            deadline: dateStr,
            priority: getVal('priority') || 'medium',
            projectType: projectType,
            courseId: matkulObj?.courseId || null,
            description: getVal('note') || '',
            courseName: getVal('matkul') || '',
            link: getVal('link') || '',
            linkTitle: getVal('link_title') || '',
            links: data.links || []
        }, broadcastEvent);

        if (res.success) {
            const dynamicMsg = await generateDynamicResponse('project_created', { title: projectTitle });
            bot.sendMessage(chatId, dynamicMsg);
        }
        else bot.sendMessage(chatId, `❌ ${res.message}`);
        return true;
    }

    // 2. Log Progress
    if (intent === 'catat_progress') {
        // Fetch projects from DB
        const projects = await DbService.getProjects(userId);
        let targetProject = null;

        const projName = getVal('project');

        if (projName) {
            const search = projName.toLowerCase();
            targetProject = projects.find(p => p.title.toLowerCase().includes(search));
        }

        if (!targetProject) {
            // Interactive Selection
            // Show recent active projects first
            // projects are sorted by deadline default if we wanted. DbService returns order? 
            // We should sort by last updated or deadline for relevance.
            // Let's take first 10.
            const buttons = projects.slice(0, 10).map(p => [{
                text: p.title,
                callback_data: `log_proj_${p.id}` // Reuse command callback
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

        // Logic for auto-filling progress
        const rawPercent = getVal('persentase');
        let newProgress = parseInt(rawPercent);
        if (isNaN(newProgress)) newProgress = (targetProject.totalProgress || 0) + 10; // Default increment if not specified? 
        if (newProgress > 100) newProgress = 100;

        let newStatus = getVal('project_status') || 'in_progress';
        if (newProgress === 100) newStatus = 'completed';

        const res = await processLogProgress(bot, chatId, userId, {
            projectId: targetProject.id,
            projectName: targetProject.title,
            duration: parseInt(getVal('duration')) || 60,
            note: getVal('note') || 'Progress Log',
            newStatus: newStatus,
            newProgress: newProgress
        }, broadcastEvent);

        if (res.success) {
            const dynamicMsg = await generateDynamicResponse('progress_logged', {
                projectName: targetProject.title,
                progress: newProgress
            });
            bot.sendMessage(chatId, dynamicMsg);
        }
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
