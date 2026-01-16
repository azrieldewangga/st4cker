import { getUserData, saveUserData } from '../store.js';
import { v4 as uuidv4 } from 'uuid';
import { parseAmount, formatAmount } from '../nlp/currency.js';

// Store command sessions
const commandSessions = new Map();

function getSession(userId) {
    return commandSessions.get(userId.toString());
}

function setSession(userId, data) {
    commandSessions.set(userId.toString(), data);
}

export function clearSession(userId) {
    commandSessions.delete(userId.toString());
}

// SHARED EXECUTION LOGIC
export async function processTransaction(bot, chatId, userId, data, broadcastEvent) {
    const { type, amount, category, note, date } = data;

    // VALIDATION
    if (!amount || amount <= 0) {
        return { success: false, message: 'Waduh, nominalnya ga valid nih (harus > 0). Coba cek lagi ya!' };
    }
    if (!category) {
        return { success: false, message: 'Kategorinya belum diisi nih bos!' };
    }

    // CREATE EVENT
    const event = {
        eventId: uuidv4(),
        eventType: 'transaction.created',
        telegramUserId: userId,
        timestamp: new Date().toISOString(),
        payload: {
            type: type, // 'income' or 'expense'
            category: category,
            amount: amount,
            note: note || '',
            date: date || new Date().toISOString()
        },
        source: 'telegram'
    };

    // BROADCAST
    let isOffline = false;
    try {
        if (broadcastEvent) {
            const result = broadcastEvent(userId, event);
            if (result && result.online === false) isOffline = true;
        }
    } catch (e) {
        console.error('Broadcast failed', e);
        return { success: false, message: 'Yah, gagal konek ke server nih. Coba lagi nanti ya!' };
    }

    // OPTIMISTIC UPDATE
    let currentBalance = 0;
    try {
        const userData = getUserData(userId);
        if (userData) {
            currentBalance = userData.currentBalance || 0;
            const delta = type === 'income' ? amount : -amount;
            userData.currentBalance = currentBalance + delta;
            currentBalance = userData.currentBalance;

            saveUserData(userId, userData);
            console.log(`[Transaction] Optimistic balance update: -> ${userData.currentBalance}`);
        }
    } catch (e) {
        console.error('Optimistic update failed', e);
    }

    // FORMAT SUCCESS MESSAGE
    const fmtAmount = formatAmount(amount);
    const fmtBalance = formatAmount(currentBalance);

    // Casual Response
    let message = '';
    if (type === 'income') {
        message = `Asik! Ada pemasukan **${fmtAmount}** dari *${category}* 🤑\n\n`;
    } else {
        message = `Oke, habis jajan **${fmtAmount}** buat *${category}* 💸\n\n`;
    }

    if (note) message += `📝 "${note}"\n`;
    message += `💰 Saldo sekarang: **${fmtBalance}**`;

    if (isOffline) {
        message += '\n\n☁️ _Saved to Cloud (Desktop Offline)_';
    }

    return { success: true, message: message };
}

// Handle /income and /expense commands
export function handleTransactionCommand(bot, msg, type) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    const userData = getUserData(userId);

    // Check key depending on type
    const syncedCategories = userData?.categories?.[type] || [];
    const appCategories = ['Food', 'Transport', 'Shopping', 'Bills', 'Subscription', 'Transfer', 'Salary'];
    const defaultCategories = appCategories;

    // Merge and deduplicate
    const categories = [...new Set([...syncedCategories, ...defaultCategories])];

    setSession(userId, {
        command: 'transaction',
        type: type, // 'income' or 'expense'
        step: 'select_category',
        data: {}
    });

    // Create keyboard
    const keyboard = {
        inline_keyboard: categories.slice(0, 15).map(cat => [{
            text: cat,
            callback_data: `tx_cat_${cat}`
        }])
    };

    const greeting = type === 'income'
        ? 'Dapet duit dari mana nih? 🤑'
        : 'Abis jajan apa hari ini? 💸';

    bot.sendMessage(chatId, `💰 *${greeting}*`, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

// Handle callback
export function handleTransactionCallback(bot, query, broadcastEvent) {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const data = query.data;

    const session = getSession(userId);
    if (!session || session.command !== 'transaction') {
        if (data.startsWith('tx_cat_')) {
            bot.answerCallbackQuery(query.id, { text: 'Sori, sesinya udah expired. Ketik ulang ya!' });
        }
        return;
    }

    // Step 1: Category Selected
    if (data.startsWith('tx_cat_')) {
        const category = data.replace('tx_cat_', '');
        session.data.category = category;
        session.step = 'enter_amount';
        setSession(userId, session);

        bot.editMessageText(`✅ Kategori: ${category}\n\nOke, berapa nominalnya? (contoh: 50rb, 15.000)`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown'
        });

        bot.answerCallbackQuery(query.id);
    }
}

// Handle amount text input
export async function handleTransactionInput(bot, msg, broadcastEvent) {
    const userId = msg.from.id.toString();
    const session = getSession(userId);

    if (!session || session.command !== 'transaction' || session.step !== 'enter_amount') {
        return false; // Not handled
    }

    const text = msg.text.trim();
    // Use STRICT parser
    const amount = parseAmount(text);

    if (amount <= 0) {
        bot.sendMessage(msg.chat.id, '❌ Waduh, angkanya ga kebaca atau <= 0. Coba pake format: 50rb, 50k, atau 50000');
        return true;
    }

    session.data.amount = amount;
    session.step = 'enter_note';
    setSession(userId, session);

    const fmtAmount = formatAmount(amount);
    bot.sendMessage(msg.chat.id, `Oke **${fmtAmount}** dicatat!\n\n📝 **Ada catatan tambahan?**\n(Ketik catatanmu, atau /skip kalau ga ada)`, { parse_mode: 'Markdown' });
    return true;
}

export async function handleTransactionNote(bot, msg, broadcastEvent) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const session = getSession(userId);

    if (!session || session.command !== 'transaction' || session.step !== 'enter_note') {
        return false;
    }

    let note = msg.text.trim();
    if (note === '/skip' || note === '-') note = '';

    session.data.note = note;

    // EXECUTE
    const result = await processTransaction(bot, chatId, userId, {
        type: session.type,
        amount: session.data.amount,
        category: session.data.category,
        note: session.data.note,
        date: new Date().toISOString()
    }, broadcastEvent);

    if (result.success) {
        bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, `❌ ${result.message}`);
    }

    clearSession(userId);
    return true;
}

// FORMAT HELPER (Rupiah)
function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

function formatDateRelative(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hari ini';
    if (diffDays === 1) return 'Kemarin';
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// LIST TRANSACTIONS (PAGINATED + MODES)
// mode: 'view' | 'delete' | 'edit'
export async function processListTransactions(bot, chatId, userId, page = 1, mode = 'view') {
    const userData = getUserData(userId);
    const transactions = userData?.transactions || [];

    if (transactions.length === 0) {
        return bot.sendMessage(chatId, '📭 **Belum ada transaksi**\n\nYuk catat pemasukan/pengeluaran dulu!', { parse_mode: 'Markdown' });
    }

    // Sort by Date DESC (Newest First)
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Pagination
    const PAGE_SIZE = 10;
    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const items = sorted.slice(start, end);

    let title = '💰 **Riwayat Transaksi**';
    if (mode === 'delete') title = '🗑️ **Hapus Transaksi** (Pilih Nomor)';
    if (mode === 'edit') title = '✏️ **Edit Transaksi** (Pilih Nomor)';

    let message = `${title} (${page}/${totalPages})\n\n`;

    const actionButtons = [];
    const actionRowSize = 5;
    let currentRow = [];

    items.forEach((t, idx) => {
        const isIncome = t.type === 'income';
        const icon = isIncome ? '🟢' : '🔴';
        const sign = isIncome ? '+' : '-';
        const amountStr = formatRupiah(Math.abs(t.amount));
        const note = t.note || t.category || '-';
        const dateInfo = formatDateRelative(t.date);
        const itemNum = start + idx + 1;

        // Show Index for Edit/Delete modes
        const numPrefix = (mode === 'delete' || mode === 'edit') ? `*${itemNum}.* ` : '';

        message += `${numPrefix}${icon} **${sign}${amountStr}** (${t.category})\n`;
        message += `   ${note} • _${dateInfo}_\n\n`;

        // Generate Buttons for Actions
        if (mode !== 'view') {
            const btnText = `${itemNum}`;
            const prefix = mode === 'delete' ? 'del_tx_' : 'edit_tx_';
            // Store ID in callback
            currentRow.push({ text: btnText, callback_data: `${prefix}${t.id}` });

            if (currentRow.length === actionRowSize) {
                actionButtons.push(currentRow);
                currentRow = [];
            }
        }
    });

    if (currentRow.length > 0) actionButtons.push(currentRow);

    if (mode === 'view') {
        const currentBalance = userData?.currentBalance || 0;
        message += `💳 **Saldo Akhir:** ${formatRupiah(currentBalance)}`;
    }

    // Navigation Buttons
    const navRow = [];
    const modePrefix = mode === 'view' ? '' : `_mode=${mode}`; // Pass mode in callback

    if (page > 1) navRow.push({ text: '⬅️ Prev', callback_data: `list_tx_page_${page - 1}${modePrefix}` });
    if (page < totalPages) navRow.push({ text: 'Next ➡️', callback_data: `list_tx_page_${page + 1}${modePrefix}` });

    const inlineKeyboard = [...actionButtons];
    if (navRow.length > 0) inlineKeyboard.push(navRow);

    // Cancel Button for Action Modes
    if (mode !== 'view') {
        inlineKeyboard.push([{ text: '❌ Batal / Selesai', callback_data: `cancel_tx_action` }]);
    }

    bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: inlineKeyboard }
    });
}

// ENTRY POINTS
export async function processDeleteTransaction(bot, chatId, userId) {
    return processListTransactions(bot, chatId, userId, 1, 'delete');
}

export async function processEditTransaction(bot, chatId, userId) {
    return processListTransactions(bot, chatId, userId, 1, 'edit');
}


// Handle Pagination and Actions Callback
export async function handleTransactionListCallback(bot, query, broadcastEvent) {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const data = query.data;

    // --- NAVIGATION ---
    if (data.startsWith('list_tx_page_')) {
        let pageStr = data.replace('list_tx_page_', '');
        let mode = 'view';

        if (pageStr.includes('_mode=')) {
            const parts = pageStr.split('_mode=');
            pageStr = parts[0];
            mode = parts[1];
        }

        const page = parseInt(pageStr);
        bot.answerCallbackQuery(query.id);

        try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) { }
        return processListTransactions(bot, chatId, userId, page, mode);
    }

    // --- CANCEL ACTION ---
    if (data === 'cancel_tx_action') {
        bot.answerCallbackQuery(query.id, { text: 'Mode edit/hapus selesai.' });
        try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) { }
        return;
    }

    // --- DELETE ACTION (CONFIRMATION STEP) ---
    if (data.startsWith('del_tx_')) {
        const txId = data.replace('del_tx_', '');
        const userData = getUserData(userId);
        const tx = userData?.transactions?.find(t => t.id === txId);

        if (!tx) {
            bot.answerCallbackQuery(query.id, { text: 'Transaksi tidak ditemukan.' });
            return processListTransactions(bot, chatId, userId, 1, 'delete');
        }

        const amountStr = formatRupiah(Math.abs(tx.amount));
        const typeStr = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';

        const confirmMsg = `⚠️ **Konfirmasi Hapus**\n\n` +
            `Jenis: ${typeStr}\n` +
            `Nominal: ${amountStr}\n` +
            `Catatan: ${tx.note || tx.category}\n\n` +
            `Yakin mau dihapus permanen?`;

        bot.editMessageText(confirmMsg, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Ya, Hapus', callback_data: `confirm_del_tx_${txId}` }],
                    [{ text: '❌ Batal', callback_data: `cancel_tx_action` }]
                ]
            }
        });
        bot.answerCallbackQuery(query.id);
        return;
    }

    // --- CONFIRMED DELETE ---
    if (data.startsWith('confirm_del_tx_')) {
        const txId = data.replace('confirm_del_tx_', '');

        // Broadcast Event
        if (broadcastEvent) {
            broadcastEvent(userId, {
                eventId: uuidv4(),
                eventType: 'transaction.deleted',
                timestamp: new Date().toISOString(),
                payload: { id: txId },
                source: 'telegram'
            });
        }

        // Optimistic Update & Capture Details
        let removedDetails = '';
        const userData = getUserData(userId);
        if (userData && userData.transactions) {
            const idx = userData.transactions.findIndex(t => t.id === txId);
            if (idx !== -1) {
                const tx = userData.transactions[idx];
                removedDetails = `\nNominal: ${formatRupiah(tx.amount)}\nNote: ${tx.note || tx.category}`;

                // Revert Balance
                if (tx.type === 'income') userData.currentBalance -= tx.amount;
                else userData.currentBalance += tx.amount;

                userData.transactions.splice(idx, 1);
                saveUserData(userId, userData);
            }
        }

        // UX: Replace confirmation with Success Message with Details
        try {
            bot.editMessageText(`❌ **Transaksi Berhasil Dihapus!**${removedDetails}`, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [] }
            });
        } catch (e) {
            // Fallback if edit fails (e.g. message too old)
            bot.sendMessage(chatId, `❌ **Transaksi Berhasil Dihapus!**${removedDetails}`, { parse_mode: 'Markdown' });
        }

        bot.answerCallbackQuery(query.id, { text: 'Terhapus!' });
        return;
    }

    // --- EDIT ACTION ---
    if (data.startsWith('edit_tx_')) {
        const txId = data.replace('edit_tx_', '');
        setSession(userId, {
            command: 'edit_transaction',
            step: 'select_field',
            data: { txId }
        });

        bot.answerCallbackQuery(query.id);

        // UX: Replace list with Edit Menu
        bot.editMessageText('✏️ **Mode Edit**\nMau ubah data apa?', {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Rp Nominal', callback_data: 'EDIT_FIELD_amount' }],
                    [{ text: '📝 Catatan', callback_data: 'EDIT_FIELD_note' }],
                    [{ text: '❌ Batal', callback_data: 'cancel_edit' }]
                ]
            }
        });
        return;
    }

    // --- EDIT FLOW HANDLERS ---
    if (data.startsWith('EDIT_FIELD_')) {
        const field = data.replace('EDIT_FIELD_', '');
        const session = getSession(userId);
        if (!session || session.command !== 'edit_transaction') {
            return bot.answerCallbackQuery(query.id, { text: 'Sesi expired.' });
        }

        session.data.field = field;
        session.step = 'awaiting_input';
        setSession(userId, session);

        bot.answerCallbackQuery(query.id);

        // UX: Delete the menu to allow text input
        try { await bot.deleteMessage(chatId, query.message.message_id); } catch (e) { }

        const prompt = field === 'amount'
            ? '💰 Masukkan **Nominal Baru** (contoh: 50rb):'
            : '📝 Masukkan **Catatan Baru**:';

        bot.sendMessage(chatId, prompt, { parse_mode: 'Markdown' });
        return;
    }

    if (data === 'cancel_edit') {
        clearSession(userId);
        bot.answerCallbackQuery(query.id, { text: 'Edit dibatalkan.' });
        // UX: Show Cancelled message replacing the menu
        try {
            bot.editMessageText('❌ Edit dibatalkan.', {
                chat_id: chatId,
                message_id: query.message.message_id
            });
        } catch (e) { }
        return;
    }
}

// Handle Text Input for Edit
export async function handleEditTransactionInput(bot, msg, broadcastEvent) {
    const userId = msg.from.id.toString();
    const session = getSession(userId);

    if (!session || session.command !== 'edit_transaction' || session.step !== 'awaiting_input') return false;

    const { txId, field } = session.data;
    const updates = {};
    const userData = getUserData(userId);
    const tx = userData.transactions.find(t => t.id === txId);

    if (!tx) {
        bot.sendMessage(msg.chat.id, '❌ Transaksi tidak ditemukan (mungkin sudah dihapus).');
        clearSession(userId);
        return true;
    }

    if (field === 'amount') {
        const newAmount = parseAmount(msg.text);
        if (newAmount <= 0) {
            bot.sendMessage(msg.chat.id, '❌ Nominal tidak valid.');
            return true;
        }
        updates.amount = newAmount;

        // Balance Adjustment logic
        if (tx.type === 'income') {
            userData.currentBalance = (userData.currentBalance - tx.amount) + newAmount;
        } else {
            userData.currentBalance = (userData.currentBalance + tx.amount) - newAmount;
        }
        tx.amount = newAmount; // Optimistic update of tx
    }
    else if (field === 'note') {
        updates.note = msg.text.trim();
        tx.note = updates.note; // Optimistic update
    }

    // Broadcast Update
    if (broadcastEvent) {
        broadcastEvent(userId, {
            eventId: uuidv4(),
            eventType: 'transaction.updated',
            timestamp: new Date().toISOString(),
            payload: { id: txId, updates },
            source: 'telegram'
        });
    }

    saveUserData(userId, userData); // Persist optimistic changes

    // Enhanced Success Message with Detail
    let detailMsg = '';
    if (field === 'amount') {
        detailMsg = `Nominal diubah jadi: **${formatRupiah(updates.amount)}**\n(${tx.note || tx.category})`;
    } else {
        detailMsg = `Catatan diubah jadi: **"${updates.note}"**\n(${formatRupiah(tx.amount)})`;
    }

    bot.sendMessage(msg.chat.id, `**Update Berhasil!**\n${detailMsg}`, { parse_mode: 'Markdown' });
    clearSession(userId);
    return true;
}
