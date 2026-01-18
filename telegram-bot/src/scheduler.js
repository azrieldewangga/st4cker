import cron from 'node-cron';
import db from './database.js';

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
        // Fix: Read from SQLite instead of JSON files
        const users = db.prepare('SELECT telegram_user_id, data FROM user_data').all();

        // Fix: Use Jakarta Timezone (UTC+7) for "Today"
        // Create a date object relative to Jakarta time
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const lusa = new Date(now);
        lusa.setDate(now.getDate() + 2);

        const tomorrowStr = getJakartaDateStr(tomorrow);
        const lusaStr = getJakartaDateStr(lusa);

        for (const user of users) {
            const userId = user.telegram_user_id;
            let userData;

            try {
                userData = JSON.parse(user.data);
            } catch (e) {
                console.error(`[Scheduler] Failed to parse data for ${userId}`);
                continue;
            }

            if (!userData.activeAssignments || userData.activeAssignments.length === 0) continue;

            // Filter Tasks
            const dueTomorrow = userData.activeAssignments.filter(t => {
                if (t.status === 'done' || !t.deadline) return false;
                const d = t.deadline.includes('T') ? getJakartaDateStr(new Date(t.deadline)) : t.deadline;
                return d === tomorrowStr;
            });

            const dueLusa = userData.activeAssignments.filter(t => {
                if (t.status === 'done' || !t.deadline) return false;
                const d = t.deadline.includes('T') ? getJakartaDateStr(new Date(t.deadline)) : t.deadline;
                return d === lusaStr;
            });

            if (dueTomorrow.length > 0) {
                let msg = `☀️ **Morning Briefing**\n\n`;
                msg += `⚠️ **BESOK (${tomorrowStr})** ada deadline:\n`;
                dueTomorrow.forEach(t => {
                    // Resolve course name if ID
                    let cName = t.course;
                    if (cName.startsWith('course-') && userData.courses) {
                        const found = userData.courses.find(c => c.id === cName);
                        if (found) cName = found.name;
                    }

                    // Clean Title Logic
                    let cleanTitle = t.title;
                    if (cleanTitle && cName) {
                        if (cleanTitle.toLowerCase().includes(cName.toLowerCase())) {
                            cleanTitle = cleanTitle.replace(new RegExp(cName, 'gi'), '').trim();
                            cleanTitle = cleanTitle.replace(/^[\s\W]+|[\s\W]+$/g, '');
                        }
                    }
                    if (!cleanTitle) cleanTitle = t.type || 'Tugas';

                    msg += `• ${cleanTitle} - ${cName}\n`;
                });

                if (dueLusa.length > 0) {
                    msg += `\n📅 Lusa juga ada:\n`;
                    dueLusa.forEach(t => {
                        let cName = t.course;
                        if (cName.startsWith('course-') && userData.courses) {
                            const found = userData.courses.find(c => c.id === cName);
                            if (found) cName = found.name;
                        }

                        // Clean Title Logic
                        let cleanTitle = t.title;
                        if (cleanTitle && cName) {
                            if (cleanTitle.toLowerCase().includes(cName.toLowerCase())) {
                                cleanTitle = cleanTitle.replace(new RegExp(cName, 'gi'), '').trim();
                                cleanTitle = cleanTitle.replace(/^[\s\W]+|[\s\W]+$/g, '');
                            }
                        }
                        if (!cleanTitle) cleanTitle = t.type || 'Tugas';

                        msg += `• ${cleanTitle} - ${cName}\n`;
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
