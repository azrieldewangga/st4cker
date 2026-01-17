import cron from 'node-cron';
import db from './database.js';

// Helper: Get local YYYY-MM-DD
const getLocalYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
        const jakartaOffset = 7 * 60 * 60 * 1000;
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const jakartaTime = new Date(utc + jakartaOffset);

        const today = new Date(jakartaTime);
        const tomorrow = new Date(jakartaTime);
        tomorrow.setDate(jakartaTime.getDate() + 1);
        const lusa = new Date(jakartaTime);
        lusa.setDate(jakartaTime.getDate() + 2);

        const tomorrowStr = getLocalYMD(tomorrow);
        const lusaStr = getLocalYMD(lusa);

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
                let d = t.deadline.includes('T') ? t.deadline.split('T')[0] : t.deadline;
                return d === tomorrowStr;
            });

            const dueLusa = userData.activeAssignments.filter(t => {
                if (t.status === 'done' || !t.deadline) return false;
                let d = t.deadline.includes('T') ? t.deadline.split('T')[0] : t.deadline;
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
