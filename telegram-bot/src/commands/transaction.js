import { getUserData, saveUserData } from '../store.js';
import { v4 as uuidv4 } from 'uuid';

// Store command sessions
const commandSessions = new Map();

function getSession(userId) {
    return commandSessions.get(userId.toString());
}

function setSession(userId, data) {
    commandSessions.set(userId.toString(), data);
}

function clearSession(userId) {
    commandSessions.delete(userId.toString());
}

// Handle /income and /expense commands
export function handleTransactionCommand(bot, msg, type) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    const userData = getUserData(userId);

    // Check key depending on type
    const syncedCategories = userData?.categories?.[type] || [];

    // Default categories matching Desktop App (TransactionModal.tsx)
    // App uses single mixed list for both types
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
        inline_keyboard: categories.slice(0, 15).map(cat => [{ // Limit to 15 to avoid massive keyboard
            text: cat,
            callback_data: `tx_cat_${cat}`
        }])
    };

    bot.sendMessage(chatId, `💰 *Select ${type === 'income' ? 'Income' : 'Expense'} Category:*`, {
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
        // Maybe user clicked old button
        if (data.startsWith('tx_cat_')) {
            bot.answerCallbackQuery(query.id, { text: 'Session expired. /income or /expense again.' });
        }
        return;
    }

    // Step 1: Category Selected
    if (data.startsWith('tx_cat_')) {
        const category = data.replace('tx_cat_', '');
        session.data.category = category;
        session.step = 'enter_amount';
        setSession(userId, session);

        bot.editMessageText(`✅ Category: ${category}\n\n💵 *Enter Amount (Rp):*`, {
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
    // Parse amount (allow '10k', '10.000', etc logic later, for now simple number)
    // Remove non-numeric chars except comma/dot? simple: keep digits
    const cleanAmount = text.replace(/[^0-9]/g, '');
    const amount = parseInt(cleanAmount);

    if (isNaN(amount) || amount <= 0) {
        bot.sendMessage(msg.chat.id, '❌ Invalid amount. Please enter a number (e.g. 50000).');
        return true;
    }

    session.data.amount = amount;

    // Complete transaction
    // (Optional: Add note step? User asked for "create income/expense" simple flow. 
    // Plan says "Enter note (optional)". Let's skip note for speed or make it quick.)
    // Let's finish here for MVP, or prompt for note. 
    // User said: "make sure ketiga ini bisa offline mode juga"
    // Let's add Note step for completeness as per requirement.

    session.step = 'enter_note';
    setSession(userId, session);

    bot.sendMessage(msg.chat.id, '📝 *Enter Note (optional)*\nType note or /skip', { parse_mode: 'Markdown' });
    return true;
}

export async function handleTransactionNote(bot, msg, broadcastEvent) {
    const userId = msg.from.id.toString();
    const session = getSession(userId);

    if (!session || session.command !== 'transaction' || session.step !== 'enter_note') {
        return false;
    }

    let note = msg.text.trim();
    if (note === '/skip') note = '';

    session.data.note = note;

    // FINALIZE
    const event = {
        eventId: uuidv4(),
        eventType: 'transaction.created',
        telegramUserId: userId,
        timestamp: new Date().toISOString(),
        payload: {
            type: session.type, // FIXED: was session.data.type
            category: session.data.category,
            amount: session.data.amount,
            note: session.data.note,
            date: new Date().toISOString()
        },
        source: 'telegram'
    };

    // Broadcast
    try {
        if (broadcastEvent) broadcastEvent(userId, event);
    } catch (e) {
        console.error('Broadcast failed', e);
    }

    // OPTIMISTIC UPDATE: Update Balance
    try {
        const userData = getUserData(userId);
        if (userData) {
            const currentBalance = userData.currentBalance || 0;
            // FIXED: Use session.type here too
            const delta = session.type === 'income' ? session.data.amount : -session.data.amount;
            userData.currentBalance = currentBalance + delta;

            saveUserData(userId, userData);
            console.log(`[Transaction] Optimistic balance update: ${currentBalance} -> ${userData.currentBalance}`);
        }
    } catch (e) {
        console.error('Optimistic update failed', e);
    }

    // Reply
    const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 });
    const fmtAmount = formatter.format(session.data.amount);

    bot.sendMessage(msg.chat.id, `✅ *Transaction Recorded*\n\n📊 Type: ${session.type}\n💰 Amount: ${fmtAmount}\n🏷️ Category: ${session.data.category}\n📝 Note: ${note || '-'}\n\n_Synced to desktop app._`, {
        parse_mode: 'Markdown'
    });

    clearSession(userId);
    return true;
}
