import { getUserData } from '../store.js';
import { formatDate } from '../nlp/dateParser.js';

export const processSummary = async (bot, chatId, userId, text = '') => {
    const userData = getUserData(userId);
    if (!userData) {
        return bot.sendMessage(chatId, '❌ Belum ada data. Mulai pakai bot dulu ya!');
    }

    const today = new Date();
    const lowerText = text.toLowerCase();

    let startDate = new Date();
    let endDate = new Date();
    let rangeLabel = 'Hari Ini';
    let filterType = 'daily'; // daily | weekly | range | monthly

    // Helper: Safe Local YYYY-MM-DD (No UTC Shift)
    const getLocalYMD = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // --- 1. DETERMINE DATE RANGE ---
    if (lowerText.includes('kemarin')) {
        startDate.setDate(today.getDate() - 1);
        endDate = new Date(startDate);
        rangeLabel = 'Kemarin';
    } else if (lowerText.includes('besok')) {
        startDate.setDate(today.getDate() + 1);
        endDate = new Date(startDate);
        rangeLabel = 'Besok';
    } else if (lowerText.includes('lusa')) {
        startDate.setDate(today.getDate() + 2);
        endDate = new Date(startDate);
        rangeLabel = 'Lusa';
    } else if (lowerText.includes('minggu ini')) {
        const day = today.getDay() || 7; // Convert Sun(0) to 7
        startDate.setDate(today.getDate() - day + 1); // Monday
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // Sunday
        rangeLabel = 'Minggu Ini';
        filterType = 'weekly';
    } else if (lowerText.includes('minggu depan') || lowerText.includes('mingdep')) {
        const day = today.getDay() || 7;
        startDate.setDate(today.getDate() + (8 - day)); // Next Monday
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // Next Sunday
        rangeLabel = 'Minggu Depan';
        filterType = 'weekly';
    } else if (lowerText.includes('bulan ini')) {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1); // 1st of current month
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month
        rangeLabel = 'Bulan Ini';
        filterType = 'monthly';
    } else if (lowerText.includes('bulan depan') || lowerText.includes('buldep')) {
        startDate = new Date(today.getFullYear(), today.getMonth() + 1, 1); // 1st of next month
        endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0); // Last day of next month
        rangeLabel = 'Bulan Depan';
        filterType = 'monthly';
    } else {
        // Default: Today
        rangeLabel = `Hari Ini (${formatDate(today)})`;
    }

    // Generate comparison strings using Local Time
    const startStr = getLocalYMD(startDate);
    const endStr = getLocalYMD(endDate);

    // --- 2. CALCULATE FINANCE ---
    let income = 0;
    let expense = 0;
    let incomeMonth = 0;
    let expenseMonth = 0;

    // Always calc month stats for context if viewing Today
    if (rangeLabel.includes('Hari Ini')) {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        // Convert to timestmap for range checking
        const mStart = monthStart.setHours(0, 0, 0, 0);
        const mEnd = monthEnd.setHours(23, 59, 59, 999);

        if (userData.transactions) {
            userData.transactions.forEach(t => {
                const tDate = new Date(t.date).getTime();
                if (tDate >= mStart && tDate <= mEnd) {
                    if (t.type === 'income') incomeMonth += parseFloat(t.amount);
                    else expenseMonth += parseFloat(t.amount);
                }
            });
        }
    }

    if (userData.transactions) {
        userData.transactions.forEach(t => {
            const tObj = new Date(t.date);
            const tDateStr = getLocalYMD(tObj);

            if (tDateStr >= startStr && tDateStr <= endStr) {
                if (t.type === 'income') income += parseFloat(t.amount);
                else expense += parseFloat(t.amount);
            }
        });
    }

    // --- 3. FILTER TASKS ---
    let tasksInRange = [];

    // DEBUG VARS
    let debugTotalTasks = 0;
    let debugSample = 'None';

    if (userData.activeAssignments) {
        debugTotalTasks = userData.activeAssignments.length;
        if (userData.activeAssignments.length > 0) {
            const f = userData.activeAssignments[0];
            // DEBUG: Read 'deadline', NOT 'date'
            debugSample = `ID: ${f.id}, Deadline: ${f.deadline}, Title: ${f.title}`;
        }

        tasksInRange = userData.activeAssignments.filter(t => {
            if (t.status === 'done' || t.status === 'completed') return false;

            // KEY FIX: Use 'deadline' property, not 'date'
            if (!t.deadline) return false;

            // Task Date Cleaning: Remove 'T' part if exists
            let tDateRaw = t.deadline;
            if (typeof tDateRaw === 'string' && tDateRaw.includes('T')) {
                tDateRaw = tDateRaw.split('T')[0];
            }

            // Compare strings (YYYY-MM-DD)
            return tDateRaw >= startStr && tDateRaw <= endStr;
        });
    }

    // --- 4. PROJECTS (Always show active) ---
    const activeProjects = userData.projects ? userData.projects.filter(p => p.status !== 'completed' && p.status !== 'on_hold') : [];

    // Formatting
    const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

    // --- BUILD MESSAGE ---
    let message = `📊 **Summary: ${rangeLabel}**\n\n`;

    // Finance Section
    message += `💰 **Keuangan:**\n`;
    message += `   • Masuk : ${formatCurrency(income)}\n`;
    message += `   • Keluar: ${formatCurrency(expense)}\n`;

    if (rangeLabel.includes('Hari Ini')) {
        message += `   • **Balance:** ${formatCurrency(userData.currentBalance || 0)}\n`;
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
            // Show Time if available from 'deadline'
            let dStr = t.deadline.split('T')[0];
            let tStr = t.deadline.includes('T') ? t.deadline.split('T')[1].substring(0, 5) : '';
            const timeDisplay = tStr ? ` ${tStr}` : '';
            message += `   • ⚠️ **${t.title}** (${t.course})${timeDisplay} - ${dStr}\n`;
        });
        message += `\n`;
    } else {
        message += `   • ✅ Kosong (Relax!)\n\n`;
    }

    // Project Section
    if (activeProjects.length > 0) {
        message += `🚀 **Project Aktif:**\n`;

        const startTs = startDate.setHours(0, 0, 0, 0);
        const endTs = endDate.setHours(23, 59, 59, 999);

        // Sort projects
        activeProjects.sort((a, b) => {
            const dA = new Date(a.deadline).getTime();
            const dB = new Date(b.deadline).getTime();
            const inRangeA = dA >= startTs && dA <= endTs;
            const inRangeB = dB >= startTs && dB <= endTs;
            if (inRangeA && !inRangeB) return -1;
            if (!inRangeA && inRangeB) return 1;
            return dA - dB;
        });

        activeProjects.slice(0, 3).forEach(p => {
            const pDeadline = new Date(p.deadline);
            const daysLeft = Math.ceil((pDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            const inRange = pDeadline.getTime() >= startTs && pDeadline.getTime() <= endTs;
            const icon = inRange ? '🔥' : '🔹';

            message += `   • ${icon} ${p.name} (${p.totalProgress}%) - ⏳ ${daysLeft} hari lagi\n`;
        });
        if (activeProjects.length > 3) message += `   ...dan ${activeProjects.length - 3} lainnya.\n`;
    } else {
        message += `🚀 Tidak ada project aktif.\n`;
    }

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
};
