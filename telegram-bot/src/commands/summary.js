
import { DbService } from '../services/dbService.js';
import { formatDate } from '../nlp/dateParser.js';

export const processSummary = async (bot, chatId, userId, text = '') => {
    // 1. DETERMINE DATE RANGE (LOCAL TIME)
    const today = new Date();
    const lowerText = text.toLowerCase();

    let startDate = new Date();
    let endDate = new Date();
    let rangeLabel = 'Hari Ini';

    // Default: Today
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    if (lowerText.includes('kemarin')) {
        startDate.setDate(today.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        rangeLabel = 'Kemarin';
    } else if (lowerText.includes('besok')) {
        startDate.setDate(today.getDate() + 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        rangeLabel = 'Besok';
    } else if (lowerText.includes('lusa')) {
        startDate.setDate(today.getDate() + 2);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        rangeLabel = 'Lusa';
    } else if (lowerText.includes('minggu ini')) {
        const day = today.getDay() || 7; // Convert Sun(0) to 7
        startDate.setDate(today.getDate() - day + 1); // Monday
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // Sunday
        endDate.setHours(23, 59, 59, 999);

        rangeLabel = 'Minggu Ini';
    } else if (lowerText.includes('minggu depan') || lowerText.includes('mingdep')) {
        const day = today.getDay() || 7;
        startDate.setDate(today.getDate() + (8 - day)); // Next Monday
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // Next Sunday
        endDate.setHours(23, 59, 59, 999);

        rangeLabel = 'Minggu Depan';
    } else if (lowerText.includes('bulan ini')) {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        rangeLabel = 'Bulan Ini';
    } else if (lowerText.includes('bulan depan') || lowerText.includes('buldep')) {
        startDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        endDate.setHours(23, 59, 59, 999);
        rangeLabel = 'Bulan Depan';
    } else {
        rangeLabel = `Hari Ini (${formatDate(today)})`;
    }

    // 2. FETCH DATA FROM DB
    try {
        const transactions = await DbService.getTransactionsByRange(userId, startDate.toISOString(), endDate.toISOString());
        const user = await DbService.getUser(userId);
        const tasks = await DbService.getTasks(userId);
        const projects = await DbService.getProjects(userId);

        if (!user && transactions.length === 0 && tasks.length === 0) {
            return bot.sendMessage(chatId, '❌ Belum ada data. Mulai pakai bot dulu ya!');
        }

        // 3. CALCULATE FINANCE
        let income = 0;
        let expense = 0;

        transactions.forEach(t => {
            if (t.type === 'income') income += parseFloat(t.amount);
            else expense += Math.abs(parseFloat(t.amount)); // Ensure positive for display
        });

        // Current Balance Logic
        const currentBalance = user?.currentBalance || 0;

        // Month Stats (If viewing Today)
        let expenseMonth = 0;
        if (rangeLabel.includes('Hari Ini')) {
            const mStart = new Date(today.getFullYear(), today.getMonth(), 1);
            mStart.setHours(0, 0, 0, 0);
            const mEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            mEnd.setHours(23, 59, 59, 999);

            // Fetch separate query or accept current range limit?
            // Correct approach: Fetch monthly stats separate or assume usage pattern. 
            // For efficiency, we can query just Expense if needed. 
            // Let's do a quick query for month expenses.
            const monthTx = await DbService.getTransactionsByRange(userId, mStart.toISOString(), mEnd.toISOString());
            monthTx.forEach(t => {
                if (t.type === 'expense') expenseMonth += Math.abs(parseFloat(t.amount));
            });
        }

        // 4. FILTER TASKS
        // DbService.getTasks returns assignments where status!=completed
        // We filter by range
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        const tasksInRange = tasks.filter(t => {
            if (!t.deadline) return false;
            // Compare purely by YYYY-MM-DD string
            // Assume deadline is YYYY-MM-DD or ISO
            const d = t.deadline.split('T')[0];
            return d >= startStr && d <= endStr;
        });

        // 5. PROJECTS (Filter Active)
        // Ensure DbService.getProjects returns active only (it does)

        // Formatting
        const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

        // --- BUILD MESSAGE ---
        let message = `📊 **Summary: ${rangeLabel}**\n\n`;

        // Finance Section
        message += `💰 **Keuangan:**\n`;
        message += `   • Masuk : ${formatCurrency(income)}\n`;
        message += `   • Keluar: ${formatCurrency(expense)}\n`;

        if (rangeLabel.includes('Hari Ini')) {
            message += `   • **Balance:** ${formatCurrency(currentBalance)}\n`;
            message += `\n📅 **Bulan Ini:**\n`;
            message += `   • Keluar: ${formatCurrency(expenseMonth)}\n`;
        } else {
            message += `   • **Net**: ${formatCurrency(income - expense)}\n`;
        }
        message += `\n`;

        // Task Section
        message += `📚 **Tugas / Deadline:**\n`;
        if (tasksInRange.length > 0) {
            tasksInRange.forEach(t => {
                let dStr = t.deadline.split('T')[0];
                let displayCourse = t.course || 'Global';
                message += `   • ⚠️ **${t.title}** (${displayCourse}) - ${dStr}\n`;
            });
            message += `\n`;
        } else {
            message += `   • ✅ Kosong (Relax!)\n\n`;
        }

        // Project Section (Always show if active and deadline relevant or high prio)
        // Logic: Show top 3 active projects regardless of date, OR filtered by date?
        // Original logic: sorted by deadline, highlighted if in range.
        if (projects && projects.length > 0) {
            message += `🚀 **Project Aktif:**\n`;

            projects.sort((a, b) => {
                const dA = a.deadline ? new Date(a.deadline).getTime() : 9999999999999;
                const dB = b.deadline ? new Date(b.deadline).getTime() : 9999999999999;
                return dA - dB;
            });

            projects.slice(0, 3).forEach(p => {
                const pDeadline = p.deadline ? new Date(p.deadline) : null;
                const daysLeft = pDeadline ? Math.ceil((pDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 999;

                const inRange = pDeadline && pDeadline.getTime() >= startDate.getTime() && pDeadline.getTime() <= endDate.getTime();
                const icon = inRange ? '🔥' : '🔹';

                const daysStr = daysLeft > 900 ? 'No Due' : `${daysLeft} hari lagi`;
                message += `   • ${icon} ${p.title} (${p.totalProgress}%) - ⏳ ${daysStr}\n`;
            });
            if (projects.length > 3) message += `   ...dan ${projects.length - 3} lainnya.\n`;
        } else {
            message += `🚀 Tidak ada project aktif.\n`;
        }

        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    } catch (e) {
        console.error('[Summary] Error:', e);
        bot.sendMessage(chatId, '❌ Gagal membuat summary. Coba lagi nanti.');
    }
};
