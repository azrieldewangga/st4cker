import {
    processTransaction,
    processDeleteTransaction,
    processEditTransaction,
    processListTransactions // If available or we use local logic
} from '../../commands/transaction.js';
import { getUserData } from '../../store.js';
import { formatAmount, parseAmount } from '../currency.js'; // Ensure path is correct
// inferCategory was local, we'll define it here or import if we centralize utils

// Category Keywords (Copied from nlp-handler.js for now)
const CATEGORY_KEYWORDS = {
    'Food': ['makan', 'minum', 'jajan', 'snack', 'kopi', 'nasi', 'bakso', 'soto', 'lunch', 'dinner', 'sarapan', 'cafe', 'warteg', 'mie', 'sate', 'martabak', 'geprek'],
    'Transport': ['gojek', 'grab', 'bensin', 'parkir', 'tol', 'angkot', 'busway', 'kereta', 'uber', 'maxim', 'ojek', 'bengkel', 'service motor', 'service mobil'],
    'Shopping': ['beli', 'belanja', 'shopee', 'tokped', 'tokopedia', 'lazada', 'tiktok', 'baju', 'celana', 'sepatu', 'tas', 'outfit', 'skincare'],
    'Bills': ['listrik', 'air', 'pulsa', 'internet', 'wifi', 'spp', 'ukt', 'tagihan', 'token', 'pdam', 'pln', 'bpjs'],
    'Subscription': ['netflix', 'spotify', 'youtube', 'premium', 'icloud', 'google one', 'disney'],
    'Transfer': ['transfer', 'tf', 'kirim uang', 'bayar utang', 'saham', 'reksadana', 'investasi', 'tabungan'],
    'Salary': ['gaji', 'gajian', 'salary', 'honor', 'upah', 'bayaran kerja', 'bonus', 'freelance', 'project', 'dikasih', 'thr', 'angpao', 'hadiah', 'beasiswa']
};

function inferCategory(text) {
    if (!text) return null;
    const lower = text.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(kw => lower.includes(kw))) {
            return category;
        }
    }
    return null;
}

export async function handleTransactionIntent(bot, msg, intent, data, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // 1. Transaction Creation (Income/Expense)
    if (intent === 'tambah_pengeluaran' || intent === 'tambah_pemasukan') {
        const type = intent === 'tambah_pemasukan' ? 'income' : 'expense';

        // Infer Category
        const inferredCategory = data.kategori || inferCategory((msg.text || '').toLowerCase());
        if (inferredCategory) data.kategori = inferredCategory;

        // Fallback Category
        const cat = data.kategori || (type === 'income' ? 'Salary' : 'Food');

        // Parse Amount if needed
        let amount = data.amount;
        if (amount && typeof amount === 'string') amount = parseAmount(amount);

        const res = await processTransaction(bot, chatId, userId, {
            type,
            amount: amount,
            category: cat,
            note: data.note || '',
            date: new Date().toISOString()
        }, broadcastEvent);

        if (res.success) bot.sendMessage(chatId, res.message, { parse_mode: 'Markdown' });
        else bot.sendMessage(chatId, `❌ ${res.message}`);
        return true;
    }

    // 2. View Transactions (History)
    if (intent === 'lihat_transaksi') {
        return handleLihatTransaksi(bot, msg, data, broadcastEvent); // data is entities
    }

    // 3. Edit Transaction
    if (intent === 'edit_transaksi') {
        return processEditTransaction(bot, chatId, userId);
    }

    // 4. Delete Transaction
    if (intent === 'hapus_transaksi') {
        return processDeleteTransaction(bot, chatId, userId);
    }

    // 5. Check Balance
    if (intent === 'cek_saldo') {
        return handleCekSaldo(bot, msg);
    }

    return false;
}

// Helper: Cek Saldo
async function handleCekSaldo(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    try {
        const userData = getUserData(userId);
        const balance = userData?.currentBalance || 0;
        await bot.sendMessage(chatId, `💰 Saldo kamu: *${formatAmount(balance)}*`, { parse_mode: 'Markdown' });
    } catch (e) { await bot.sendMessage(chatId, 'Gagal cek saldo.'); }
    return true;
}

// Helper: Lihat Riwayat
async function handleLihatTransaksi(bot, msg, entities, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    try {
        const userData = getUserData(userId);
        const transactions = userData?.transactions || [];

        if (transactions.length === 0) {
            await bot.sendMessage(chatId, '📭 **Belum ada transaksi**\n\nYuk catat pemasukan/pengeluaran dulu!', { parse_mode: 'Markdown' });
            return true;
        }

        // Sort just in case (though sync handles it)
        const recent = transactions.slice(0, 10);

        // Helper for formatting
        const formatMoney = (amount) => {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
        };

        const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            const now = new Date();
            const diffTime = now - date;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 0) return 'Hari ini';
            if (diffDays === 1) return 'Kemarin';
            return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        };

        let message = `💰 **Riwayat Transaksi (10 Terakhir)**\n\n`;

        recent.forEach((t) => {
            const isIncome = t.type === 'income';
            const icon = isIncome ? '🟢' : '🔴';
            const sign = isIncome ? '+' : '-';
            const amountStr = formatMoney(Math.abs(t.amount));
            const note = t.note || t.category || '-';
            const dateInfo = formatDate(t.date);

            message += `${icon} **${sign}${amountStr}**\n   ${note} • _${dateInfo}_\n\n`;
        });

        const currentBalance = userData?.currentBalance || 0;
        message += `💳 **Saldo Akhir:** ${formatMoney(currentBalance)}`;

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('[NLP] Error Lihat Transaksi:', e);
        await bot.sendMessage(chatId, 'Gagal ambil data transaksi.');
    }
    return true;
}
