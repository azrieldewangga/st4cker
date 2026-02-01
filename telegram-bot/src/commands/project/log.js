
import crypto from 'crypto';
import { DbService } from '../../services/dbService.js';
import { escapeMarkdown } from './utils.js';

export async function processLogProgress(bot, chatId, userId, data, broadcastEvent) {
    const { projectId, duration, note, newStatus, newProgress, projectName } = data;

    try {
        // Map status
        let dbStatus = 'in_progress';
        if (newStatus.toLowerCase() === 'completed') dbStatus = 'completed';
        else if (newStatus.toLowerCase() === 'on_hold' || newStatus.toLowerCase() === 'on hold') dbStatus = 'on_hold';
        // 'active' maps to 'active' or 'in_progress'? Schema has 'status' default 'active'. 
        // Let's use 'active' if not completed/on_hold to stay consistent with CREATE.
        if (dbStatus === 'in_progress') dbStatus = 'active';

        // Update DB (Log + Project Progress)
        const result = await DbService.createProjectLog(projectId, {
            sessionDate: new Date().toISOString(),
            duration: duration || 0,
            note: note || '',
            progressBefore: 0, // We could fetch this if needed, skipping for now
            progressAfter: newProgress
        });

        // Update Project Status if changed
        // createProjectLog updates progress, but maybe not status? 
        // DbService.createProjectLog only updates totalProgress. 
        // We should update status explicitly if needed.
        await DbService.updateProject(projectId, { status: dbStatus });

        // Generate Event for Desktop
        const event = {
            eventId: result.id || crypto.randomUUID(), // Use DB ID if available
            eventType: 'progress.logged',
            telegramUserId: userId,
            timestamp: new Date().toISOString(),
            payload: {
                projectId,
                duration,
                note,
                status: newStatus, // Send original string or normalized? Desktop might expect specific enum?
                progress: newProgress,
                loggedAt: new Date().toISOString()
            },
            source: 'telegram'
        };

        let isOffline = false;
        if (broadcastEvent) {
            const res = await broadcastEvent(userId, event);
            if (res && res.online === false) isOffline = true;
        }

        // Format duration display
        const hours = Math.floor(duration / 60);
        const mins = duration % 60;
        const timeStr = `${hours > 0 ? hours + 'h ' : ''}${mins}m`;

        const escProject = escapeMarkdown(projectName);
        const escNote = escapeMarkdown(note);

        // Format status for display
        const displayStatus = newStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        let message = `✅ *Update Mantap!*\n\n📂 Project: ${escProject}\n📊 Progress: ${newProgress}%\n⚡ Status: ${displayStatus}\n⏱️ Kerja: ${timeStr}\n📝 Note: ${escNote}\n\n_Lanjut terus bos! 🔥_`;

        if (isOffline) {
            message += '\n\n☁️ _Saved to Cloud (Desktop Offline)_';
        }

        return {
            success: true,
            message
        };

    } catch (e) {
        console.error('[Project Log] Error:', e);
        return { success: false, message: 'Gagal update progress di database.' };
    }
}
