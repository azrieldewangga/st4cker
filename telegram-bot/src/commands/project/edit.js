import crypto from 'crypto';
import { getUserData, saveUserData } from '../../store.js';
import { updateSession, getSession, clearSession } from './session.js';
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

    // Return the update payload for broadcasting
    return {
        id: projectId,
        updates: { [field === 'title' ? 'name' : field]: field === 'deadline' ? project.deadline : input }
    };
};

export const handleDeleteConfirmation = async (bot, chatId, userId, projectId, broadcastEvent) => {
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
    return details;
};
