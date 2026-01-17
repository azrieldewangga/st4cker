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

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const lusa = new Date(today);
        lusa.setDate(today.getDate() + 2);

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

                    msg += `• **${t.title}** (${cName})\n`;
                });

                if (dueLusa.length > 0) {
                    msg += `\n📅 Lusa juga ada:\n`;
                    dueLusa.forEach(t => {
                        let cName = t.course;
                        if (cName.startsWith('course-') && userData.courses) {
                            const found = userData.courses.find(c => c.id === cName);
                            if (found) cName = found.name;
                        }
                        msg += `• ${t.title} (${cName})\n`;
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
