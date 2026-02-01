
import crypto from 'crypto';
import { DbService } from '../../services/dbService.js';
import { updateSession } from './session.js';
import { escapeMarkdown } from './utils.js';
import { STATES } from './constants.js';

export async function processProjectCreation(bot, chatId, userId, data, broadcastEvent) {
    const { title, deadline, priority, projectType, courseId, description, courseName, link, linkTitle, links } = data;

    // Safety Fallback for Title
    const finalTitle = title || 'Untitled Project';
    const attachments = [];

    // 1. Handle Multiple Links (Priority)
    if (links && Array.isArray(links) && links.length > 0) {
        links.forEach(l => {
            if (!l.url || l.url === '-' || l.url.toLowerCase() === 'skip') return;
            let cleanUrl = l.url.trim();
            if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'https://' + cleanUrl;

            attachments.push({
                id: crypto.randomUUID(),
                type: 'link',
                title: l.title && l.title.toLowerCase() !== 'skip' ? l.title : 'Ref Link',
                url: cleanUrl
            });
        });
    }
    // 2. Fallback to Single Link (if no array provided)
    else if (link && link !== '-' && link.toLowerCase() !== 'skip') {
        let cleanUrl = link.trim();
        if (!/^https?:\/\//i.test(cleanUrl)) {
            cleanUrl = 'https://' + cleanUrl;
        }

        attachments.push({
            id: crypto.randomUUID(),
            type: 'link',
            title: linkTitle || 'Ref Link',
            url: cleanUrl
        });
    }

    try {
        // Create in DB
        const result = await DbService.createProject(userId, {
            title: finalTitle,
            description: description || '',
            deadline,
            priority,
            type: projectType || 'personal',
            courseId: courseId || null,
            courseName: courseName || ''
        });

        if (!result.success) throw new Error('DB creation failed');

        const eventId = result.id; // Use DB ID

        const event = {
            eventId: eventId,
            eventType: 'project.created',
            telegramUserId: userId,
            timestamp: new Date().toISOString(),
            payload: {
                id: eventId, // ensure payload ID matches DB
                title: finalTitle,
                description: description || '',
                deadline,
                priority,
                type: projectType,
                courseId: courseId,
                attachments // Pass attachments to Desktop App (Desktop handles storage or ignore)
            },
            source: 'telegram'
        };

        let isOffline = false;
        if (broadcastEvent) {
            const res = await broadcastEvent(userId, event);
            if (res && res.online === false) isOffline = true;
        }

        const escTitle = escapeMarkdown(finalTitle);
        const escDesc = escapeMarkdown(description || '-');
        const escCourse = escapeMarkdown(courseName || '');

        let message = `✅ *Project Created!*\n\n📌 ${escTitle}\n📅 Due: ${deadline}\n⚡ Priority: ${priority}\n📂 Type: ${projectType === 'course' ? `Course Project (${escCourse})` : 'Personal'}\n📝 Desc: ${escDesc}\n\n_Siap dieksekusi!_`;

        if (isOffline) {
            message += '\n\n☁️ _Saved to Cloud (Desktop Offline)_';
        }

        return {
            success: true,
            message
        };
    } catch (e) {
        console.error('[Project Create] Error:', e);
        return { success: false, message: 'Gagal membuat project di database.' };
    }
}

export const handleCreateProjectCommand = async (bot, msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    updateSession(userId, {
        state: STATES.AWAITING_PROJECT_DEADLINE,
        data: {}
    });

    bot.sendMessage(chatId, '🆕 *Bikin Project Baru*\n\nStep 1/5: Masukkan **Deadline** (YYYY-MM-DD):', { parse_mode: 'Markdown' });
};
