
import cron from 'node-cron';
import { DbService } from './services/dbService.js';

// Helper: Get local YYYY-MM-DD in Jakarta Time
const getJakartaDateStr = (dateObj) => {
    return dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
};

export const initScheduler = (bot) => {
    console.log('[Scheduler] Initialized. Running jobs...');

    // Job: Morning Brief (07:00 AM)
    // Runs every day at 07:00
    cron.schedule('0 7 * * *', async () => {
        console.log('[Scheduler] Running Morning Brief...');
        await sendMorningBrief(bot);
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });
};

async function sendMorningBrief(bot) {
    try {
        // Calculate dynamic dates for Jakarta
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const lusa = new Date(now);
        lusa.setDate(now.getDate() + 2);

        const tomorrowStr = getJakartaDateStr(tomorrow);
        const lusaStr = getJakartaDateStr(lusa);

        // Fetch Tasks
        const tasksTomorrow = await DbService.getDueTasks(tomorrowStr);
        const tasksLusa = await DbService.getDueTasks(lusaStr);

        // Group by User
        const userTasks = new Map();

        const addToUser = (userId, type, task) => {
            if (!userTasks.has(userId)) {
                userTasks.set(userId, { tomorrow: [], lusa: [] });
            }
            userTasks.get(userId)[type].push(task);
        };

        tasksTomorrow.forEach(t => addToUser(t.userId, 'tomorrow', t));
        tasksLusa.forEach(t => addToUser(t.userId, 'lusa', t));

        // Iterate Users and Send Messages
        for (const [userId, groups] of userTasks.entries()) {
            if (groups.tomorrow.length > 0) {
                let msg = `☀️ **Morning Briefing**\n\n`;
                msg += `⚠️ **BESOK (${tomorrowStr})** ada deadline:\n`;

                groups.tomorrow.forEach(t => {
                    // Display Logic: Use title or type, course is name or ID
                    let displayTitle = t.title || t.type || 'Tugas';
                    let displayCourse = t.course || 'General';
                    // Strip course name from title if redundant
                    if (displayTitle.toLowerCase().includes(displayCourse.toLowerCase())) {
                        displayTitle = displayTitle.replace(new RegExp(displayCourse, 'gi'), '').trim();
                        displayTitle = displayTitle.replace(/^[\s\W]+|[\s\W]+$/g, '');
                    }
                    msg += `• ${displayTitle} - ${displayCourse}\n`;
                });

                if (groups.lusa.length > 0) {
                    msg += `\n📅 Lusa juga ada:\n`;
                    groups.lusa.forEach(t => {
                        let displayTitle = t.title || t.type || 'Tugas';
                        let displayCourse = t.course || 'General';
                        if (displayTitle.toLowerCase().includes(displayCourse.toLowerCase())) {
                            displayTitle = displayTitle.replace(new RegExp(displayCourse, 'gi'), '').trim();
                            displayTitle = displayTitle.replace(/^[\s\W]+|[\s\W]+$/g, '');
                        }
                        msg += `• ${displayTitle} - ${displayCourse}\n`;
                    });
                }

                msg += `\n_Yuk dicicil hari ini, biar besok santai! 🔥_`;

                try {
                    await bot.sendMessage(userId, msg, { parse_mode: 'Markdown' });
                    console.log(`[Scheduler] Sent brief to ${userId}`);
                } catch (e) {
                    console.error(`[Scheduler] Failed to send to ${userId}:`, e.message);
                }
            }
        }

    } catch (error) {
        console.error('[Scheduler] Error in Morning Brief:', error);
    }
}
