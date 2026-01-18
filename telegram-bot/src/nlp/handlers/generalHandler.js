import { responses } from '../personality.js'; // Ensure path
import { getUserData } from '../../store.js';

export async function handleGeneralIntent(bot, msg, intent, data, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // 1. Summary
    if (intent === 'summary' || intent === 'minta_summary') {
        return handleSummary(bot, msg, data, broadcastEvent);
    }

    // 2. Reminders (Implementing New Feature)
    if (intent === 'ingatkan') {
        // data.waktu and data.note should be present
        const time = data.waktu ? (data.waktu.parsed || data.waktu.value) : 'soon';
        const note = data.note ? data.note.value : 'Sesuatu';

        // Since we don't have a dynamic scheduler yet, we'll just acknowledge for now.
        // OR we can create a "Task" with "Reminder" type?
        // Let's create a TODO task named "Reminder: [Note]"

        // This is a creative solution: Reminders -> Tasks
        const { processTaskCreation } = await import('../../commands/task.js');

        let deadline = new Date();
        if (time instanceof Date) deadline = time;
        else if (time === 'besok') deadline.setDate(deadline.getDate() + 1);

        // Format YYYY-MM-DD
        const toLocalYMD = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dy = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dy}`;
        };

        const res = await processTaskCreation(bot, chatId, userId, {
            type: 'Reminder', // New type?
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
    else if (intent === 'bantuan') await bot.sendMessage(chatId, responses.help());
    else if (intent === 'casual') await bot.sendMessage(chatId, responses.casual());

    return true;
}

// Helper: Handle Summary
async function handleSummary(bot, msg, entities, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const text = (msg.text || '').toLowerCase();

    try {
        const userData = getUserData(userId);
        const summary = userData?.summary;

        if (!summary) {
            await bot.sendMessage(chatId, '⚠️ Data summary belum tersedia. Coba restart App Desktop & pastikan connect.');
            return true;
        }

        const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

        let title = '📊 **Summary Global**';
        let stats = summary.monthly;

        let timeLabel = 'Bulan Ini';

        if (text.includes('hari ini') || text.includes('today')) {
            title = '📅 **Summary Hari Ini**';
            stats = summary.daily;
            timeLabel = 'Hari Ini';
        } else if (text.includes('minggu ini') || text.includes('week')) {
            title = '📅 **Summary Minggu Ini** (Last 7 Days)';
            stats = summary.weekly;
            timeLabel = 'Minggu Ini';
        } else if (text.includes('bulan ini') || text.includes('month')) {
            title = '📅 **Summary Bulan Ini**';
            stats = summary.monthly;
            timeLabel = 'Bulan Ini';
        } else {
            // Default "Summary" -> Show All
            let message = `📊 **Financial Summary**\n\n`;

            message += `**Hari Ini:**\n`;
            message += `🟢 Masuk: ${formatRupiah(summary.daily.income)}\n`;
            message += `🔴 Keluar: ${formatRupiah(summary.daily.expense)}\n\n`;

            message += `**Minggu Ini (7 Hari):**\n`;
            message += `🟢 Masuk: ${formatRupiah(summary.weekly.income)}\n`;
            message += `🔴 Keluar: ${formatRupiah(summary.weekly.expense)}\n\n`;

            message += `**Bulan Ini:**\n`;
            message += `🟢 Masuk: ${formatRupiah(summary.monthly.income)}\n`;
            message += `🔴 Keluar: ${formatRupiah(summary.monthly.expense)}\n\n`;

            message += `💳 **Saldo Saat Ini:** ${formatRupiah(userData.currentBalance || 0)}`;

            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            return true;
        }

        // Specific Time View
        const balance = stats.income - stats.expense;
        const icon = balance >= 0 ? '📈' : '📉';

        let message = `${title}\n\n`;
        message += `🟢 Pemasukan: ${formatRupiah(stats.income)}\n`;
        message += `🔴 Pengeluaran: ${formatRupiah(stats.expense)}\n`;
        message += `-------------------------\n`;
        message += `${icon} Net Flow: **${formatRupiah(balance)}**\n\n`;

        if (timeLabel === 'Bulan Ini') {
            message += `💳 Saldo Akhir: **${formatRupiah(userData.currentBalance || 0)}**`;
        }

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    } catch (e) {
        console.error('[NLP] Error Handle Summary:', e);
        await bot.sendMessage(chatId, 'Gagal memproses summary.');
    }
    return true;
}
