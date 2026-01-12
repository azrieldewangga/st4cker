// nlp-handler.js - Main NLP handler with intent routing

import { parseMessage, extractEntities, initNLP } from './nlp-service.js';
import { schemas, getMissingFields } from './intentSchemas.js';
import { setPending, getPending, clearPending, updatePending } from './pendingState.js';
import { parseAmount } from './currency.js';
import { parseDate } from './dateParser.js';
import { responses } from './personality.js';

// Initialize NLP
(async () => {
    try {
        await initNLP();
    } catch (e) {
        console.error('[NLP] Failed to initialize:', e);
    }
})();

// Confidence threshold
const CONFIDENCE_THRESHOLD = 0.6;

// Cancel keywords
const CANCEL_KEYWORDS = ['ga jadi', 'gajadi', 'batal', 'cancel', 'skip', 'udahan', 'tidak jadi'];

// Edit keywords
const EDIT_KEYWORDS = ['ganti', 'ubah', 'bukan', 'salah', 'koreksi'];

/**
 * Main NLP handler - entry point for natural language messages
 */
export async function handleNaturalLanguage(bot, msg, broadcastEvent) {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    if (!text) return false;

    // 1. Store raw text for logging
    logRawText(chatId, text);

    // 2. Check if there's pending state (multi-turn conversation)
    const pending = getPending(chatId);
    if (pending) {
        return handleSlotCompletion(bot, msg, pending, text, broadcastEvent);
    }

    // 3. Parse message with wit.ai
    const result = await parseMessage(text);

    // 4. Confidence gate
    const topIntent = result.intents?.[0];
    if (!topIntent || topIntent.confidence < CONFIDENCE_THRESHOLD) {
        return handleLowConfidence(bot, msg, text);
    }

    // 5. Extract entities
    const intent = topIntent.name;
    const entities = extractEntities(result.entities);

    // 6. Enrich entities (parse amounts, dates, etc)
    const enriched = enrichEntities(entities, text);

    // 7. Check required fields (Smart Field Completion)
    const schema = schemas[intent];
    if (!schema) {
        console.warn('Unknown intent:', intent);
        return false;
    }

    const missing = getMissingFields(schema.required, enriched);

    if (missing.length > 0) {
        // Save pending state and ask for missing field
        setPending(chatId, {
            intent,
            filled: enriched,
            missing,
            raw_text: text,
            confidence: topIntent.confidence
        });
        return askForMissing(bot, chatId, missing[0], intent, enriched);
    }

    // 8. All required fields present - execute intent
    return executeIntent(bot, msg, intent, enriched, broadcastEvent);
}

/**
 * Handle slot completion for multi-turn conversations
 * BERLAKU UNTUK SEMUA INTENT
 */
async function handleSlotCompletion(bot, msg, pending, text, broadcastEvent) {
    const chatId = msg.chat.id;

    // A. Check for cancel keywords
    if (isCancelKeyword(text)) {
        clearPending(chatId);
        await bot.sendMessage(chatId, responses.cancelled());
        return true;
    }

    // B. Check for mid-flow edit keywords
    const editMatch = detectMidFlowEdit(text, pending);
    if (editMatch) {
        pending.filled[editMatch.field] = editMatch.value;
        await bot.sendMessage(chatId, responses.fieldUpdated(editMatch.field, editMatch.value));
    }

    // C. Parse answer as slot completion
    const result = await parseMessage(text);
    const entities = extractEntities(result.entities || {});
    const enriched = enrichEntities(entities, text);

    // D. Merge new entities to filled fields
    Object.assign(pending.filled, enriched);

    // E. Handle simple text answers (when user just types an answer)
    if (pending.missing.length > 0 && Object.keys(enriched).length === 0) {
        // User gave a plain text answer, assign to first missing field
        const missingField = pending.missing[0];
        pending.filled[missingField] = { value: text, raw: text, confidence: 1 };
    }

    // F. Re-check missing fields
    const schema = schemas[pending.intent];
    const stillMissing = getMissingFields(schema.required, pending.filled);

    if (stillMissing.length > 0) {
        pending.missing = stillMissing;
        setPending(chatId, pending);
        return askForMissing(bot, chatId, stillMissing[0], pending.intent, pending.filled);
    }

    // G. All fields complete - execute intent
    clearPending(chatId);
    return executeIntent(bot, msg, pending.intent, pending.filled, broadcastEvent);
}

/**
 * Handle low confidence results
 */
async function handleLowConfidence(bot, msg, text) {
    const chatId = msg.chat.id;

    // Save as note/fallback
    await bot.sendMessage(chatId, responses.lowConfidence(text));
    return true;
}

/**
 * Ask user for missing field
 */
async function askForMissing(bot, chatId, field, intent, filled) {
    const message = responses.askField(field, intent, filled);
    const buttons = getFieldButtons(field, intent);

    if (buttons) {
        await bot.sendMessage(chatId, message, {
            reply_markup: { inline_keyboard: buttons }
        });
    } else {
        await bot.sendMessage(chatId, message);
    }

    return true;
}

/**
 * Execute intent after all fields are filled
 */
async function executeIntent(bot, msg, intent, entities, broadcastEvent) {
    const chatId = msg.chat.id;

    // Route to intent handler
    switch (intent) {
        case 'tambah_pengeluaran':
            return handleTambahPengeluaran(bot, msg, entities, broadcastEvent);
        case 'tambah_pemasukan':
            return handleTambahPemasukan(bot, msg, entities, broadcastEvent);
        case 'buat_tugas':
            return handleBuatTugas(bot, msg, entities, broadcastEvent);
        case 'buat_project':
            return handleBuatProject(bot, msg, entities, broadcastEvent);
        case 'catat_progress':
            return handleCatatProgress(bot, msg, entities, broadcastEvent);
        case 'cek_saldo':
            return handleCekSaldo(bot, msg, entities, broadcastEvent);
        case 'lihat_tugas':
            return handleLihatTugas(bot, msg, entities, broadcastEvent);
        case 'lihat_transaksi':
            return handleLihatTransaksi(bot, msg, entities, broadcastEvent);
        case 'batalkan':
            return handleBatalkan(bot, msg, entities, broadcastEvent);
        case 'bantuan':
            return handleBantuan(bot, msg);
        case 'casual':
            return handleCasual(bot, msg, entities);
        default:
            console.log('Unhandled intent:', intent);
            return false;
    }
}

// ============ Utility Functions ============

function isCancelKeyword(text) {
    const lower = text.toLowerCase();
    return CANCEL_KEYWORDS.some(kw => lower.includes(kw));
}

function detectMidFlowEdit(text, pending) {
    const lower = text.toLowerCase();

    for (const keyword of EDIT_KEYWORDS) {
        if (lower.includes(keyword)) {
            // Try to detect which field and new value
            // Example: "ganti harganya jadi 22rb" -> field: amount, value: 22000
            const amountMatch = text.match(/(\d+)\s*(rb|ribu|k|jt|juta)?/i);
            if (amountMatch && lower.includes('harga')) {
                return { field: 'amount', value: { value: parseAmount(amountMatch[0]), raw: amountMatch[0] } };
            }

            // Add more field detection as needed
        }
    }

    return null;
}

function enrichEntities(entities, rawText) {
    const enriched = { ...entities };

    // Enrich amount
    if (enriched.number) {
        const amount = parseAmount(enriched.number.raw || enriched.number.value?.toString());
        enriched.amount = { value: amount, raw: enriched.number.raw, confidence: enriched.number.confidence };
    }

    // Enrich date/time
    if (enriched.waktu) {
        const date = parseDate(enriched.waktu.raw || enriched.waktu.value);
        enriched.waktu = { ...enriched.waktu, parsed: date };
    }

    return enriched;
}

function logRawText(chatId, text) {
    console.log(`[NLP] ${chatId}: "${text}"`);
}

function getFieldButtons(field, intent) {
    // Return inline keyboard buttons based on field
    switch (field) {
        case 'kategori':
            return [[
                { text: '🍔 Food', callback_data: 'nlp_kategori_Food' },
                { text: '🚗 Transport', callback_data: 'nlp_kategori_Transport' }
            ], [
                { text: '🛍️ Shopping', callback_data: 'nlp_kategori_Shopping' },
                { text: '📄 Bills', callback_data: 'nlp_kategori_Bills' }
            ]];
        case 'priority':
            return [[
                { text: 'Low', callback_data: 'nlp_priority_Low' },
                { text: 'Medium', callback_data: 'nlp_priority_Medium' },
                { text: 'High', callback_data: 'nlp_priority_High' }
            ]];
        default:
            return null;
    }
}

// ============ Intent Handlers ============

import { v4 as uuidv4 } from 'uuid';
import { getUserData, saveUserData } from '../store.js';

async function handleTambahPengeluaran(bot, msg, entities, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const amount = entities.amount?.value || 0;
    const kategori = entities.kategori?.value || null;
    const note = entities.note?.value || '';

    // If no category, ask for it
    if (!kategori) {
        setPending(chatId, {
            intent: 'tambah_pengeluaran',
            filled: entities,
            missing: ['kategori'],
            raw_text: msg.text
        });
        return askForMissing(bot, chatId, 'kategori', 'tambah_pengeluaran', entities);
    }

    // Create event
    const event = {
        eventId: uuidv4(),
        eventType: 'transaction.created',
        telegramUserId: userId,
        timestamp: new Date().toISOString(),
        payload: {
            type: 'expense',
            category: kategori,
            amount: amount,
            note: note || kategori, // Use category as note if no note
            date: new Date().toISOString()
        },
        source: 'telegram'
    };

    // Broadcast to desktop
    try {
        if (broadcastEvent) broadcastEvent(userId, event);
    } catch (e) {
        console.error('[NLP] Broadcast failed:', e);
    }

    // Optimistic update balance
    try {
        const userData = getUserData(userId);
        if (userData) {
            userData.currentBalance = (userData.currentBalance || 0) - amount;
            saveUserData(userId, userData);
        }
    } catch (e) {
        console.error('[NLP] Optimistic update failed:', e);
    }

    await bot.sendMessage(chatId, responses.confirmExpense(amount, kategori));

    // Ask for note
    setPending(chatId, {
        intent: 'tambah_pengeluaran_note',
        filled: { ...entities, event },
        missing: [],
        raw_text: msg.text
    });
    await bot.sendMessage(chatId, responses.askNote());

    return true;
}

async function handleTambahPemasukan(bot, msg, entities, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const amount = entities.amount?.value || 0;
    const kategori = entities.kategori?.value || 'Income';
    const note = entities.note?.value || '';

    // Create event
    const event = {
        eventId: uuidv4(),
        eventType: 'transaction.created',
        telegramUserId: userId,
        timestamp: new Date().toISOString(),
        payload: {
            type: 'income',
            category: kategori,
            amount: amount,
            note: note || kategori,
            date: new Date().toISOString()
        },
        source: 'telegram'
    };

    // Broadcast to desktop
    try {
        if (broadcastEvent) broadcastEvent(userId, event);
    } catch (e) {
        console.error('[NLP] Broadcast failed:', e);
    }

    // Optimistic update balance
    try {
        const userData = getUserData(userId);
        if (userData) {
            userData.currentBalance = (userData.currentBalance || 0) + amount;
            saveUserData(userId, userData);
        }
    } catch (e) {
        console.error('[NLP] Optimistic update failed:', e);
    }

    await bot.sendMessage(chatId, responses.confirmIncome(amount, kategori));
    return true;
}

async function handleBuatTugas(bot, msg, entities, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // Entity fallback: matkul or project
    const matkul = entities.matkul?.value || entities.project?.value || null;
    const waktu = entities.waktu?.value || null;
    const tipeTugas = entities.tipe_tugas?.value || 'Tugas';

    // Check missing required fields
    if (!matkul) {
        setPending(chatId, {
            intent: 'buat_tugas',
            filled: entities,
            missing: ['matkul'],
            raw_text: msg.text
        });
        return askForMissing(bot, chatId, 'matkul', 'buat_tugas', entities);
    }

    if (!waktu) {
        setPending(chatId, {
            intent: 'buat_tugas',
            filled: { ...entities, matkul: { value: matkul } },
            missing: ['waktu'],
            raw_text: msg.text
        });
        return askForMissing(bot, chatId, 'waktu', 'buat_tugas', entities);
    }

    // Create event
    const event = {
        eventId: uuidv4(),
        eventType: 'assignment.created',
        telegramUserId: userId,
        timestamp: new Date().toISOString(),
        payload: {
            course: matkul,
            title: `${tipeTugas} ${matkul}`,
            deadline: entities.waktu?.parsed?.toISOString() || new Date().toISOString(),
            taskType: tipeTugas,
            status: 'pending'
        },
        source: 'telegram'
    };

    // Broadcast to desktop
    try {
        if (broadcastEvent) broadcastEvent(userId, event);
    } catch (e) {
        console.error('[NLP] Broadcast failed:', e);
    }

    await bot.sendMessage(chatId, responses.confirmTask(matkul, waktu));

    // Ask for note (handling multi-turn)
    setPending(chatId, {
        intent: 'tambah_note_tugas',
        filled: { eventId: event.eventId },
        missing: ['note'],
        raw_text: ''
    });

    await bot.sendMessage(chatId, responses.askNote());

    return true;
}

async function handleBuatProject(bot, msg, entities, broadcastEvent) {
    const chatId = msg.chat.id;
    const project = entities.project?.value || null;

    if (!project) {
        setPending(chatId, {
            intent: 'buat_project',
            filled: entities,
            missing: ['project'],
            raw_text: msg.text
        });
        return askForMissing(bot, chatId, 'project', 'buat_project', entities);
    }

    await bot.sendMessage(chatId, responses.confirmProject(project));
    return true;
}

async function handleCatatProgress(bot, msg, entities, broadcastEvent) {
    // Guided flow - show project list buttons
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // Get user's projects from userData
    const userData = getUserData(userId);
    const projects = userData?.projects || [];

    if (projects.length === 0) {
        await bot.sendMessage(chatId, 'Belum ada project nih~ Buat dulu dengan "buat project [nama]"');
        return true;
    }

    // Show project buttons
    const buttons = projects.slice(0, 10).map(p => [{
        text: p.title || p.name,
        callback_data: `nlp_progress_${p.id}`
    }]);

    await bot.sendMessage(chatId, responses.askProject(), {
        reply_markup: { inline_keyboard: buttons }
    });

    return true;
}

async function handleCekSaldo(bot, msg, entities, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    try {
        const userData = getUserData(userId);
        const balance = userData?.currentBalance || 0;

        const formatter = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        });

        await bot.sendMessage(chatId, `💰 Saldo kamu: *${formatter.format(balance)}*`, {
            parse_mode: 'Markdown'
        });
    } catch (e) {
        await bot.sendMessage(chatId, 'Gagal ambil saldo, coba lagi nanti~');
    }

    return true;
}

async function handleLihatTugas(bot, msg, entities, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    try {
        const userData = getUserData(userId);
        const tasks = userData?.assignments || [];

        if (tasks.length === 0) {
            await bot.sendMessage(chatId, 'Belum ada tugas nih~ Buat dengan "tugas [matkul] deadline [tanggal]"');
            return true;
        }

        // Filter pending tasks and sort by deadline
        const pendingTasks = tasks
            .filter(t => t.status === 'pending' || !t.status)
            .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
            .slice(0, 10);

        if (pendingTasks.length === 0) {
            await bot.sendMessage(chatId, 'Semua tugas udah selesai! 🎉');
            return true;
        }

        // Format task list
        let message = '📝 *Tugas Kamu:*\n\n';
        pendingTasks.forEach((t, i) => {
            const deadline = new Date(t.deadline);
            const deadlineStr = deadline.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short'
            });
            message += `${i + 1}. *${t.course || t.title}*\n`;
            message += `   📅 ${deadlineStr}\n`;
        });

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('[NLP] List tasks error:', e);
        await bot.sendMessage(chatId, 'Gagal ambil daftar tugas~');
    }

    return true;
}

async function handleLihatTransaksi(bot, msg, entities, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    try {
        const userData = getUserData(userId);
        const transactions = userData?.transactions || [];

        if (transactions.length === 0) {
            await bot.sendMessage(chatId, 'Belum ada transaksi nih~');
            return true;
        }

        // Get last 10 transactions
        const recent = transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10);

        const formatter = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        });

        let message = '💰 *Transaksi Terakhir:*\n\n';
        recent.forEach((t, i) => {
            const icon = t.type === 'income' ? '💚' : '❤️';
            const sign = t.type === 'income' ? '+' : '-';
            message += `${icon} ${sign}${formatter.format(t.amount)}\n`;
            message += `   ${t.category || t.note || '-'}\n`;
        });

        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('[NLP] List transactions error:', e);
        await bot.sendMessage(chatId, 'Gagal ambil daftar transaksi~');
    }

    return true;
}

async function handleBatalkan(bot, msg, entities, broadcastEvent) {
    // TODO: Implement undo chain
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, responses.cancelled());
    return true;
}

async function handleBantuan(bot, msg) {
    await bot.sendMessage(chatId, responses.help());
    return true;
}

async function handleCasual(bot, msg, entities) {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, responses.casual());
    return true;
}

/**
 * Handle NLP inline keyboard callbacks
 */
export async function handleNLPCallback(bot, query, broadcastEvent) {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const data = query.data;

    // Handle category selection
    if (data.startsWith('nlp_kategori_')) {
        const kategori = data.replace('nlp_kategori_', '');
        const pending = getPending(chatId);

        if (pending) {
            pending.filled.kategori = { value: kategori, raw: kategori, confidence: 1 };

            // Remove kategori from missing
            pending.missing = pending.missing.filter(f => f !== 'kategori');

            if (pending.missing.length > 0) {
                setPending(chatId, pending);
                await bot.answerCallbackQuery(query.id, { text: `✅ ${kategori}` });
                return askForMissing(bot, chatId, pending.missing[0], pending.intent, pending.filled);
            }

            // All fields filled - execute
            clearPending(chatId);
            await bot.answerCallbackQuery(query.id, { text: `✅ ${kategori}` });

            // Create fake msg for executeIntent
            const fakeMsg = { chat: { id: chatId }, from: { id: userId }, text: '' };
            return executeIntent(bot, fakeMsg, pending.intent, pending.filled, broadcastEvent);
        }

        await bot.answerCallbackQuery(query.id, { text: 'Session expired' });
        return true;
    }

    // Handle priority selection
    if (data.startsWith('nlp_priority_')) {
        const priority = data.replace('nlp_priority_', '');
        const pending = getPending(chatId);

        if (pending) {
            pending.filled.priority = { value: priority, raw: priority, confidence: 1 };
            pending.missing = pending.missing.filter(f => f !== 'priority');

            if (pending.missing.length > 0) {
                setPending(chatId, pending);
                await bot.answerCallbackQuery(query.id, { text: `✅ ${priority}` });
                return askForMissing(bot, chatId, pending.missing[0], pending.intent, pending.filled);
            }

            clearPending(chatId);
            await bot.answerCallbackQuery(query.id, { text: `✅ ${priority}` });

            const fakeMsg = { chat: { id: chatId }, from: { id: userId }, text: '' };
            return executeIntent(bot, fakeMsg, pending.intent, pending.filled, broadcastEvent);
        }

        await bot.answerCallbackQuery(query.id, { text: 'Session expired' });
        return true;
    }

    // Handle progress project selection
    if (data.startsWith('nlp_progress_')) {
        const projectId = data.replace('nlp_progress_', '');

        setPending(chatId, {
            intent: 'catat_progress',
            filled: { project: { value: projectId } },
            missing: ['duration', 'persentase', 'note'],
            raw_text: ''
        });

        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(chatId, 'Berapa lama kerjanya?', {
            reply_markup: {
                inline_keyboard: [[
                    { text: '30 menit', callback_data: 'nlp_duration_30' },
                    { text: '1 jam', callback_data: 'nlp_duration_60' },
                    { text: '2 jam', callback_data: 'nlp_duration_120' }
                ], [
                    { text: 'Custom', callback_data: 'nlp_duration_custom' }
                ]]
            }
        });

        return true;
    }

    // Handle duration selection
    if (data.startsWith('nlp_duration_')) {
        const duration = data.replace('nlp_duration_', '');
        const pending = getPending(chatId);

        if (pending && duration !== 'custom') {
            pending.filled.duration = { value: parseInt(duration), raw: `${duration} menit` };
            pending.missing = pending.missing.filter(f => f !== 'duration');
            setPending(chatId, pending);

            await bot.answerCallbackQuery(query.id);
            await bot.sendMessage(chatId, 'Mau update progress ke berapa persen?');
            return true;
        }

        if (duration === 'custom') {
            await bot.answerCallbackQuery(query.id);
            await bot.sendMessage(chatId, 'Ketik durasi (contoh: 45 menit, 1.5 jam)');
            return true;
        }
    }

    await bot.answerCallbackQuery(query.id);
    return true;
}
