
import crypto from 'crypto';
import { DbService } from '../../services/dbService.js';
import { getSession, clearSession } from './session.js';
import { processListProjects } from './list.js';
import { parseDate } from '../../nlp/dateParser.js';

// Edit Handlers (Entry Point)
export const processEditProject = async (bot, chatId, userId) => {
    return processListProjects(bot, chatId, userId, 1, 'edit');
};

export const processDeleteProject = async (bot, chatId, userId) => {
    return processListProjects(bot, chatId, userId, 1, 'delete');
};

// Logic for Editing Inputs (Title / Deadline)
export const handleEditInput = async (bot, msg, field) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const input = msg.text.trim();
    const session = getSession(userId);

    const projectId = session.data.projectId;
    const project = await DbService.getProjectById(projectId);

    if (!project) {
        bot.sendMessage(chatId, '❌ Project not found.');
        clearSession(userId);
        return true;
    }

    const updates = {};
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
        updates.deadline = `${yyyy}-${mm}-${dd}`;
    } else if (field === 'title') {
        updates.title = input; // Schema uses title
    }

    await DbService.updateProject(projectId, updates);
    bot.sendMessage(chatId, `✅ Project **${field}** berhasil diupdate!`, { parse_mode: 'Markdown' });

    // Return the update payload for broadcasting
    return {
        id: projectId,
        updates: updates // { title: ..., deadline: ... }
    };
};

export const handleDeleteConfirmation = async (bot, chatId, userId, projectId, broadcastEvent) => {
    const project = await DbService.getProjectById(projectId);
    let details = '';

    if (project) {
        details = project.title;
        await DbService.deleteProject(projectId);

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
    return details;
};
