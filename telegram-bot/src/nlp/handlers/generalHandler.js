
import { responses } from '../personality.js';
import { generateCasualReply } from '../nlp-service.js';
import { processSummary } from '../../commands/summary.js';
import { DbService } from '../../services/dbService.js';

export async function handleGeneralIntent(bot, msg, intent, data, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // 1. Summary
    if (intent === 'summary' || intent === 'minta_summary') {
        const text = msg.text || '';
        return processSummary(bot, chatId, userId, text);
    }

    // 2. Reminders 
    if (intent === 'ingatkan') {
        const time = data.waktu ? (data.waktu.parsed || data.waktu.value) : 'soon';
        const note = data.note ? data.note.value : 'Sesuatu';

        // Use Task module for reminders
        const { processTaskCreation } = await import('../../commands/task.js');

        let deadline = new Date();
        if (time instanceof Date) deadline = time;
        else if (time === 'besok') deadline.setDate(deadline.getDate() + 1);

        const toLocalYMD = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dy = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dy}`;
        };

        const res = await processTaskCreation(bot, chatId, userId, {
            type: 'Reminder',
            title: `Reminder: ${note}`,
            courseName: 'General',
            deadline: toLocalYMD(deadline),
            notes: `Auto-reminder for: ${data.waktu ? data.waktu.raw : 'today'}`,
            semester: '',
            courseId: null
        }, broadcastEvent);

        if (res.success) {
            bot.sendMessage(chatId, `⏰ **Reminder Disimpan!**\nAku masukin ke Task list deadline ${toLocalYMD(deadline)}.`, { parse_mode: 'Markdown' });
        }
        return true;
    }

    // 3. Fallbacks
    if (intent === 'batalkan') await bot.sendMessage(chatId, responses.cancelled());
    else if (intent === 'bantuan') await bot.sendMessage(chatId, responses.help(), { parse_mode: 'HTML' });
    else if (intent === 'casual') {
        const reply = await generateCasualReply(msg.text, userId);
        await bot.sendMessage(chatId, reply);
    }

    return true;
}
