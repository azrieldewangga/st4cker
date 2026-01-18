import crypto from 'crypto';
import { getUserData, saveUserData } from '../../store.js';
import { escapeMarkdown } from './utils.js';

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
