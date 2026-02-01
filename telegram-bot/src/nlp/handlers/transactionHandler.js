
import {
    processTransaction,
    processDeleteTransaction,
    processEditTransaction,
    processListTransactions
} from '../../commands/transaction.js';
import { DbService } from '../../services/dbService.js'; // Use DbService
import { formatAmount, parseAmount } from '../currency.js';
import { generateDynamicResponse } from '../nlp-service.js';

// Category Keywords (Copied from nlp-handler.js for now - ideally centralized in a Utils file)
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

        // Helper to safely get value from potential entity object
        const getValue = (key) => typeof data[key] === 'object' ? data[key].value : data[key];

        // Infer Category
        let inferredCategory = getValue('kategori') || inferCategory((msg.text || '').toLowerCase());

        // Fallback Category
        const cat = inferredCategory || (type === 'income' ? 'Salary' : 'Food');

        // Parse Amount if needed
        let amount = getValue('amount');
        if (amount && typeof amount === 'string') amount = parseAmount(amount);

        const noteVal = getValue('note') || '';

        // processTransaction now uses DbService internally
        const res = await processTransaction(bot, chatId, userId, {
            type,
            amount: amount,
            category: cat,
            note: noteVal,
            date: new Date().toISOString()
        });

        if (res.success) {
            const dynamicMsg = await generateDynamicResponse('transaction_added', {
                type, amount, note: noteVal, category: cat
            });
            // processTransaction already sends message?
            // Wait, processTransaction in transaction.js RETURNS success/msg, but doesn't send casual message if not commanded?
            // Actually processTransaction logic I wrote returns object {success, message}. It does NOT send message.
            // But wait, the previous code sent message too. 
            // Let's modify processTransaction to returning data, and letting Handler send UI?
            // In my overwrite of transaction.js, processTransaction does NOT send message to bot, it merely returns strings.
            // So we should send `res.message` here.

            // NOTE: processTransaction returns a formatted message!
            bot.sendMessage(chatId, res.message, { parse_mode: 'Markdown' });
        }
        else bot.sendMessage(chatId, `❌ ${res.message}`);
        return true;
    }

    // 2. View Transactions (History)
    if (intent === 'lihat_transaksi') {
        // Use shared command logic
        return processListTransactions(bot, chatId, userId, 1, 'view');
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
        const user = await DbService.getUser(userId);
        const balance = user?.currentBalance || 0;
        const dynamicMsg = await generateDynamicResponse('balance_check', { balance });
        await bot.sendMessage(chatId, dynamicMsg);
    } catch (e) { await bot.sendMessage(chatId, 'Gagal cek saldo.'); }
    return true;
}

// handleLihatTransaksi is removed because we use processListTransactions from commands/transaction.js
