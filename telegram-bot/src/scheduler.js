
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { responses } from './nlp/personality.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');

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
        const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const lusa = new Date(today);
        lusa.setDate(today.getDate() + 2);

        const tomorrowStr = getLocalYMD(tomorrow);
        const lusaStr = getLocalYMD(lusa);

        for (const file of files) {
            const userId = file.replace('.json', '');
            if (!userId || isNaN(userId)) continue; // Skip non-user files

            const rawData = fs.readFileSync(path.join(dataDir, file), 'utf-8');
            const userData = JSON.parse(rawData);

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
                    msg += `• **${t.title}** (${t.course})\n`;
                });

                if (dueLusa.length > 0) {
                    msg += `\n📅 Lusa juga ada:\n`;
                    dueLusa.forEach(t => msg += `• ${t.title} (${t.course})\n`);
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
