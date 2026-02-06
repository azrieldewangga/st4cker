
import fs from 'fs';
import { parseMessage, initNLP } from './nlp-service.js';
import { schemas, getMissingFields } from './intentSchemas.js';
import { setPending, getPending, clearPending } from './pendingState.js';
import { parseAmount } from './currency.js';
import { parseDate } from './dateParser.js';
import { responses } from './personality.js';

import { handleTransactionIntent } from './handlers/transactionHandler.js';
import { handleTaskIntent } from './handlers/taskHandler.js';
import { handleProjectIntent } from './handlers/projectHandler.js';
import { handleGeneralIntent } from './handlers/generalHandler.js';

// Legacy Imports (Required for Regex/Session Checks)
import {
    handleTransactionNote,
    handleEditTransactionInput,
    processDeleteTransaction,
    processEditTransaction,
    processListTransactions
} from '../commands/transaction.js';
import { handleEditTaskInput, processDeleteTask, processEditTask } from '../commands/listtasks.js';
import { findCourse, normalizeTaskType, getEntityCache } from '../commands/task.js';
import { processLogProgress } from '../commands/project.js';

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
const CANCEL_KEYWORDS = ['ga jadi', 'gajadi', 'batal', 'cancel', 'skip', 'udahan', 'tidak jadi', 'gasido'];
const SKIP_KEYWORDS = ['ga ada', 'gak ada', 'tidak ada', 'kosong', 'skip', '-', 'ga usah', 'gak usah', 'gapapa', 'ngga', 'ngga ada', 'engga', 'enggak', 'no', 'nope', 'tidak', 'gak', 'ga', 'gk', 'tdk', 'cukup', 'dah', 'udah', 'sudah'];

/**
 * Generate course selection buttons for a user
 * @param {string} userId - Telegram user ID
 * @returns {Object|null} Reply markup with inline keyboard, or null if no courses
 */
function generateCourseButtons(userId) {
    // Phase 3: Add DbService.getCourses(userId) here if needed.
    // For now, return null as we don't have courses in DB.
    return null;
}

// Strict Valid Categories (from TransactionModal.tsx)
const VALID_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Subscription', 'Transfer', 'Salary'];

const CATEGORY_KEYWORDS = {
    'Food': ['makan', 'minum', 'jajan', 'snack', 'kopi', 'restoran', 'warung', 'food'],
    'Transport': ['bensin', 'ojek', 'gojek', 'grab', 'parkir', 'tol', 'transport'],
    'Shopping': ['belanja', 'baju', 'kaos', 'skincare', 'sabun', 'shampoo', 'shopping', 'beli'],
    'Bills': ['listrik', 'air', 'internet', 'wifi', 'pulsa', 'pln', 'pdam'],
    'Subscription': ['netflix', 'spotify', 'youtube', 'langganan'],
    'Transfer': ['trf', 'tf', 'transfer', 'bayar utang', 'kirim', 'thr', 'angpao'],
    'Salary': ['gaji', 'bonus', 'dapet duit', 'income', 'pemasukan']
};

// Regex for Amount Correction (e.g., 15rb, 20.000, 50k)
const AMOUNT_REGEX = /\b(?:\d{1,3}(?:[.,]\d{3})*(?:,\d+)?|\d+)\s*(?:rb|k|jt|juta)?\b/i;

/**
 * Main NLP handler - entry point for natural language messages
 */
export async function handleNaturalLanguage(bot, msg, broadcastEvent) {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();

    if (!text) return false;

    // 1. Store raw text for logging
    logRawText(chatId, text);

    // 2. IMMEDIATE GREETING CHECK (Bypass NLP)
    const greetingRegex = /^(h+a+l+o+|h+a+i+|o+i+|p+a+g+i+|s+i+a+n+g+|s+o+r+e+|m+a+l+a+m+|m+k+s+h+|m+a+k+a+s+i+h+|t+h+a+n+k+s+)$/i;
    const standardGreeting = /^(selamat )?(pagi|siang|sore|malam)$/i;

    if (greetingRegex.test(text) || standardGreeting.test(text)) {
        console.log(`[NLP] Greeting detected: ${text} -> Force Casual`);
        const parts = text.split(/\s+/);
        const lastWord = parts[parts.length - 1];
        let suffix = '';
        if (parts.length > 1 && !['pagi', 'siang', 'sore', 'malam', 'halo', 'hai'].includes(lastWord.toLowerCase())) {
            suffix = lastWord;
        }
        return executeConfirmedIntent(bot, msg, 'casual', { note: { value: suffix } }, broadcastEvent);
    }

    // 2. Check if there's pending state (multi-turn conversation)
    const pending = getPending(chatId);
    if (pending) {
        return handleSlotCompletion(bot, msg, pending, text, broadcastEvent);
    }

    // 2b. Check Transaction Session (Edit/Input Mode)
    if (await handleTransactionNote(bot, msg, broadcastEvent)) return;
    if (await handleEditTransactionInput(bot, msg, broadcastEvent)) return;
    if (await handleEditTaskInput(bot, msg, broadcastEvent)) return;

    // 2c. OVERRIDES (Fix NLP Misses for new commands that require specific regex)
    if (/^(hapus|delete|remove)\s+(transaksi|keuangan|duwit|duit|picis|ceng|sangun|arto|fulus|ceban|cuan|hepeng|dana)/i.test(text)) {
        return processDeleteTransaction(bot, chatId, msg.from.id.toString());
    }
    if (/^(edit|ubah|ganti)\s+(transaksi|keuangan|duwit|duit|picis|ceng|sangun|arto|fulus|ceban|cuan|hepeng|dana)/i.test(text)) {
        return processEditTransaction(bot, chatId, msg.from.id.toString());
    }
    if (/^(histori|riwayat|log|cek|liat|lihat)\s+(transaksi|keuangan|duwit|duit|picis|ceng|sangun|arto|fulus|ceban|cuan|hepeng|dana)/i.test(text)) {
        return processListTransactions(bot, chatId, msg.from.id.toString());
    }
    if (/^(hapus|delete|remove)\s+(tugas|lapres|lapsem|lapen|lp|pr|kuis|quiz|uts|uas)/i.test(text)) {
        return processDeleteTask(bot, chatId, msg.from.id.toString());
    }
    if (/^(edit|ubah|ganti)\s+(tugas|lapres|lapsem|lapen|lp|pr|kuis|quiz|uts|uas)/i.test(text)) {
        return processEditTask(bot, chatId, msg.from.id.toString());
    }
    if (/^(summary|ringkasan|rangkuman|rekap)/i.test(text)) {
        const { processSummary } = await import('../commands/summary.js');
        return processSummary(bot, chatId, msg.from.id.toString(), text);
    }

    // 3. Process with GEMINI NLP
    let result = await parseMessage(text, msg.from.id.toString());

    // 4. Confidence gate
    const topIntent = result.intents?.[0];

    // Special Handling for API Limit
    if (topIntent?.name === 'api_limit') {
        const resetTime = new Date(Date.now() + 60000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        await bot.sendMessage(msg.chat.id, `⌛ <b>Server Lagi Penuh</b> (Limit Tercapai)\n\nOtak saya lagi istirahat sebentar karena kebanyakan request. Coba lagi jam <b>${resetTime}</b> ya!`, { parse_mode: 'HTML' });
        return true;
    }

    if (!topIntent || topIntent.confidence < CONFIDENCE_THRESHOLD) {
        return handleLowConfidence(bot, msg, text);
    }

    // 5. Extract entities
    const intent = topIntent.name;
    const entities = result.entities;

    // --- Handling OpenClaw Response ---
    if (intent === 'openclaw_response') {
        const responseText = entities.response?.[0]?.value || '⚠️ No response from OpenClaw Agent.';
        // Format nicely if it's code
        const opts = { parse_mode: 'Markdown' };
        await bot.sendMessage(chatId, `🤖 *St4cker (via OpenClaw)*:\n\n${responseText}`, opts);
        return true;
    }


    // 6. Enrich entities
    const enriched = enrichEntities(entities, text, msg.from.id.toString());

    // NEW: Smart Course Scan (Early Enrichment for buat_tugas AND buat_project)
    if ((intent === 'buat_tugas' || intent === 'buat_project') && !enriched.matkul) {
        const courses = []; // Phase 1: No courses list in DB yet

        if (courses.length > 0) {
            const found = findCourse(text, courses);
            if (found) {
                enriched.matkul = {
                    value: found.name,
                    courseId: found.id,
                    raw: found.name,
                    confidence: 1
                };
                if (intent === 'buat_project' && !enriched.project_type) {
                    enriched.project_type = { value: 'course', raw: 'course', confidence: 1 };
                }
                if (intent === 'buat_project' && enriched.project) {
                    const projectLower = enriched.project.value.toLowerCase();
                    const textLower = text.toLowerCase();
                    if (textLower.includes(projectLower) && found.name.toLowerCase() !== projectLower) {
                        delete enriched.project;
                    }
                }
            }
        }
    }

    process.stdout.write(`\n[GEMINI] Intent: ${intent}, Enriched Keys: ${Object.keys(enriched).join(', ')}\n`);

    // NEW: Validation Logic
    if (intent === 'buat_tugas' && enriched.matkul && enriched.tipe_tugas) {
        const type = (enriched.tipe_tugas.value || '').toLowerCase();
        const courseName = (enriched.matkul.value || '').toLowerCase();
        const rawMatkul = (enriched.matkul.raw || '').toLowerCase();
        const userText = text.toLowerCase();

        const isReport = type.includes('laporan') || type.includes('lapres') || type.includes('lapsem') || type.includes('lapen');
        const isPractical = courseName.includes('praktikum') ||
            courseName.includes('workshop') ||
            rawMatkul.includes('prak') ||
            userText.includes('prak');

        if (isReport && !isPractical) {
            bot.sendMessage(msg.chat.id, `⚠️ <b>Gak Match!</b> ⚠️\n\nJenis tugas <b>${enriched.tipe_tugas.value}</b> biasanya cuma buat matkul Praktikum/Workshop.\n(Sedangkan ini matkul: <i>${enriched.matkul.value}</i>)\n\nKalau maksa, ketik ulang pakai kata "Prak" ya (misal: "Prak Komber").`, { parse_mode: 'HTML' });
            delete enriched.tipe_tugas;
        }
    }

    // 7. Check required fields
    if ((intent === 'buat_tugas' || intent === 'buat_project') && enriched.matkul?.value && !enriched.matkul.courseId) {
        const courses = []; // Placeholder

        const resolved = findCourse(enriched.matkul.value, courses);

        if (resolved) {
            enriched.matkul.value = resolved.name;
            enriched.matkul.courseId = resolved.id;

            // PRACTICAL SWITCH LOGIC
            if (!resolved.name.toLowerCase().includes('praktikum') && !resolved.name.toLowerCase().includes('workshop')) {
                const lowerText = text.toLowerCase();
                if (lowerText.includes('prak') || lowerText.includes('workshop')) {
                    // Since we have no courses list, we skip switching logic
                }
            }
        } else {
            // If manual entry and not in courses table, acceptable in Phase 1
            // We retain the value as is
        }
    }

    const schema = schemas[intent];
    if (!schema) {
        if (intent === 'casual') {
            return executeConfirmedIntent(bot, msg, 'casual', enriched, broadcastEvent);
        }
        console.warn('Unknown intent:', intent);
        return false;
    }

    const missing = getMissingFields(schema.required, enriched);

    // --- CUSTOM FLOW: Project Creation (Type & Matkul logic) ---
    if (intent === 'buat_project' && !missing.includes('project')) {
        if (!enriched.project_type) {
            setPending(chatId, {
                intent, filled: enriched, missing: ['project_type', ...missing], raw_text: text, confidence: topIntent.confidence, userId: msg.from.id.toString()
            });
            await bot.sendMessage(chatId, `Jenis Projectnya apa? 🏫/👤\n_Pilih atau ketik "personal"/"matkul"_`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '👤 Personal', callback_data: 'nlp_proj_personal' },
                        { text: '🏫 Mata Kuliah', callback_data: 'nlp_proj_course' }
                    ]]
                }
            });
            return true;
        }
        if (enriched.project_type.value === 'course' && !enriched.matkul) {
            setPending(chatId, {
                intent, filled: enriched, missing: ['matkul'], raw_text: text, confidence: topIntent.confidence, userId: msg.from.id.toString()
            });
            return askForMissing(bot, chatId, 'matkul', intent, enriched);
        }
    }

    if (missing.length > 0) {
        setPending(chatId, {
            intent,
            filled: enriched,
            missing,
            raw_text: text,
            confidence: topIntent.confidence,
            userId: msg.from.id.toString()
        });
        return askForMissing(bot, chatId, missing[0], intent, enriched);
    }

    // 8. All Validated - Trigger Confirmation Flow
    if (intent === 'tambah_pengeluaran' || intent === 'tambah_pemasukan') {
        if (!enriched.kategori) {
            setPending(chatId, {
                intent, filled: enriched, missing: ['kategori'], raw_text: text, confidence: topIntent.confidence, userId: msg.from.id.toString()
            });
            return askForMissing(bot, chatId, 'kategori', intent, enriched);
        }
    }

    const pendingState = {
        intent,
        filled: enriched,
        missing: [],
        raw_text: text,
        confidence: topIntent.confidence,
        subState: 'confirmation',
        userId: msg.from.id.toString()
    };

    const NO_CONFIRM_INTENTS = [
        'lihat_tugas', 'lihat_transaksi', 'cek_saldo', 'deadline_terdekat',
        'minta_summary', 'batalkan', 'bantuan', 'casual', 'lihat_project'
    ];

    if (NO_CONFIRM_INTENTS.includes(intent)) {
        return executeConfirmedIntent(bot, msg, intent, enriched, broadcastEvent);
    }

    setPending(chatId, pendingState);
    return askForConfirmation(bot, chatId, intent, enriched);
}

/**
 * Handle slot completion
 */
export async function handleSlotCompletion(bot, msg, pending, text, broadcastEvent) {
    const chatId = msg.chat.id;
    const lowerText = text.toLowerCase();

    // A. Check for cancel keywords
    if (isCancelKeyword(text)) {
        if (pending.confirmMessageId) {
            try { await bot.deleteMessage(chatId, pending.confirmMessageId); } catch (error) { }
        }
        clearPending(chatId);
        await bot.sendMessage(chatId, responses.cancelled());
        return true;
    }

    // B. Check for skip keywords
    const currentMissing = pending.missing[0];
    if (currentMissing && (isSkipKeyword(text) || lowerText === 'ga' || lowerText === 'gak')) {
        if (pending.intent === 'catat_progress' && currentMissing === 'note') {
            await bot.sendMessage(chatId, '❌ Note wajib diisi buat log progress!');
            return;
        }
        pending.filled[currentMissing] = { value: '-', raw: text, confidence: 1 };
        pending.missing.shift();

        if (pending.lastQuestionId) {
            try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: pending.lastQuestionId }); } catch (e) { }
            delete pending.lastQuestionId;
        }
        text = '';
    }

    // C. Confirmation State Handling (AI-POWERED)
    if (pending.subState === 'confirmation') {

        const aiResult = await parseMessage(text, msg.from.id.toString());
        const aiIntent = aiResult?.intents?.[0]?.name;

        console.log(`[CONFIRM-AI] Text: "${text}" -> Intent: ${aiIntent}`);

        // 2. POSITIVE
        if (aiIntent === 'konfirmasi_positif') {
            if (pending.confirmMessageId) {
                try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: pending.confirmMessageId }); } catch (e) { }
            }
            clearPending(chatId);
            return executeConfirmedIntent(bot, msg, pending.intent, pending.filled, broadcastEvent, pending.links);
        }

        // 3. NEGATIVE
        else if (aiIntent === 'konfirmasi_negatif' || isCancelKeyword(text)) {
            if (pending.confirmMessageId) {
                try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: pending.confirmMessageId }); } catch (e) { }
            }
            clearPending(chatId);
            await bot.sendMessage(chatId, '❌ Dibatalkan.');
            return true;
        }

        // 4. CORRECTION
        const localEntities = extractLocalEntities(text);
        const correction = enrichEntities(
            localEntities,
            text,
            msg.from.id.toString()
        );

        let updated = false;

        if (correction.amount) { pending.filled.amount = correction.amount; updated = true; }
        if (correction.waktu) { pending.filled.waktu = correction.waktu; updated = true; }
        if (correction.kategori) { pending.filled.kategori = correction.kategori; updated = true; }

        if (correction.tipe_tugas) {
            const norm = normalizeTaskType(correction.tipe_tugas.value);
            if (norm) correction.tipe_tugas.value = norm;
            pending.filled.tipe_tugas = correction.tipe_tugas;
            updated = true;
        }

        if (correction.matkul) {
            const courses = [];
            const resolved = findCourse(correction.matkul.value, courses);

            if (resolved) {
                pending.filled.matkul = {
                    value: resolved.name,
                    courseId: resolved.id,
                    raw: correction.matkul.value,
                    confidence: 1
                };
                updated = true;
            } else {
                // Keep manual input
                pending.filled.matkul = correction.matkul;
                updated = true;
            }
        }

        if (correction.project) {
            pending.filled.project = correction.project;
            updated = true;
        }

        if (correction.note) { pending.filled.note = correction.note; updated = true; }

        // Priority correction for projects
        if (correction.priority) { pending.filled.priority = correction.priority; updated = true; }

        // Item correction for transactions
        if (correction.item) { pending.filled.item = correction.item; updated = true; }

        const deleteKeywords = ['hapus', 'apus', 'delete', 'remove', 'buang', 'kosongin', 'ilangin', 'hilangkan'];
        const isDeleteAction = deleteKeywords.some(kw => lowerText.includes(kw));

        if (isDeleteAction && (lowerText.includes('link') || lowerText.includes('tautan'))) {
            pending.links = [];
            pending.filled.link = { value: '-', raw: '-', confidence: 1 };
            updated = true;
        }

        if (!updated) {
            if (text.length > 2 && !isSkipKeyword(text) && !isCancelKeyword(text)) {
                pending.filled.note = { value: text, raw: text, confidence: 1 };
                updated = true;
            }
        }

        if (updated) {
            await bot.sendMessage(chatId, '✅ Data diupdate.');
            setPending(chatId, pending);
            return askForConfirmation(bot, chatId, pending.intent, pending.filled);
        } else {
            await bot.sendMessage(chatId, '🤔 Saya bingung. Jawab <b>Ya</b> untuk simpan, <b>Tidak</b> untuk batal.\nAtau ketik langsung revisinya (misal: "Besok aja").', { parse_mode: 'HTML' });
            return true;
        }
    }

    // D. Normal Slot Filling
    let enriched = {};
    if (text) {
        if (pending.missing[0] === 'note') {
            enriched = { note: { value: text, raw: text, confidence: 1 } };
        }
        else if (pending.missing[0] === 'project_type') {
            // Handle text input for project type
            const lower = text.toLowerCase();
            let pType = 'personal'; // default
            if (lower.includes('matkul') || lower.includes('kuliah') || lower.includes('course') || lower === 'mk') {
                pType = 'course';
            }
            enriched = { project_type: { value: pType, raw: text, confidence: 1 } };

            // If course type, add matkul to missing if not already present
            if (pType === 'course' && !pending.filled.matkul && !pending.missing.includes('matkul')) {
                pending.missing.splice(1, 0, 'matkul'); // Insert after project_type
            }
        }
        else if (pending.missing[0] === 'priority') {
            let prio = 'medium';
            const t = text.toLowerCase();
            if (t.includes('high') || t.includes('tinggi') || t.includes('urgent') || t.includes('penting')) prio = 'high';
            if (t.includes('low') || t.includes('rendah') || t.includes('santai')) prio = 'low';
            if (t.includes('sedang') || t.includes('normal')) prio = 'medium';
            enriched = { priority: { value: prio, raw: text, confidence: 1 } };
        }
        else if (pending.missing[0] === 'link') {
            if (isSkipKeyword(text)) {
                // Shifted below
            } else {
                if (!pending.tempLink) {
                    pending.tempLink = { url: text };
                    await bot.sendMessage(chatId, `🔗 Oke, URL tersimpan. Judul link-nya apa? (Misal: "Figma", "Drive")`);
                    return;
                } else {
                    pending.tempLink.title = text;
                    if (!pending.links) pending.links = [];
                    pending.links.push(pending.tempLink);
                    delete pending.tempLink;
                    await bot.sendMessage(chatId, `✅ Link tersimpan. Ada lagi? (Ketik link lain atau "enggak" buat lanjut)`);
                    return;
                }
            }
        }
        else if (pending.missing[0] === 'matkul') {
            // Resolve matkul using findCourse to match synonyms
            const courses = [];
            const resolved = findCourse(text, courses);

            if (resolved) {
                enriched = {
                    matkul: {
                        value: resolved.name,
                        courseId: resolved.id,
                        raw: text,
                        confidence: 1
                    }
                };
            } else {
                // Keep raw input if no match found
                enriched = { matkul: { value: text, raw: text, confidence: 0.5 } };
            }
        }
        else {
            const rawEntities = {};
            if (pending.missing[0] === 'amount') rawEntities.amount = [{ value: text }];
            else if (pending.missing[0] === 'waktu') rawEntities.datetime = [{ value: text }];
            else rawEntities[pending.missing[0]] = [{ value: text }];

            rawEntities.isSlotFilling = true; // Mark to prevent default date overwriting
            enriched = enrichEntities(rawEntities, text, msg.from.id.toString());
        }

        Object.assign(pending.filled, enriched);
        pending.missing.shift();
    }

    setPending(chatId, pending);
    if (pending.missing.length > 0) {
        return askForMissing(bot, chatId, pending.missing[0], pending.intent, pending.filled);
    } else {
        pending.subState = 'confirmation';
        setPending(chatId, pending);
        return askForConfirmation(bot, chatId, pending.intent, pending.filled);
    }
}

// UTILS
function isCancelKeyword(text) {
    return CANCEL_KEYWORDS.some(k => text.toLowerCase() === k);
}
function isSkipKeyword(text) {
    return SKIP_KEYWORDS.some(k => text.toLowerCase() === k);
}
function logRawText(chatId, text) {
    const logLine = `[${new Date().toISOString()}] ${chatId}: ${text}\n`;
    fs.appendFile('message_logs.txt', logLine, () => { });
}
async function handleLowConfidence(bot, msg, text) {
    await bot.sendMessage(msg.chat.id, responses.confusion());
    return true;
}

function enrichEntities(entities, text, userId = null) {
    const enriched = {};
    const getVal = (key) => {
        const entity = entities[key]?.[0];
        if (entity === undefined || entity === null) return null;
        return (entity.value !== undefined) ? entity.value : entity;
    };

    // 1. Amount
    const rawAmt = getVal('amount');
    if (rawAmt) {
        const val = (typeof rawAmt === 'number') ? rawAmt : parseAmount(rawAmt.toString());
        enriched.amount = { value: val, raw: rawAmt.toString(), confidence: 1 };
    }

    // 2. Kategori
    let rawCat = getVal('kategori');
    if (rawCat) {
        const normalized = inferCategory(rawCat);
        if (normalized) rawCat = normalized;
        else if (!VALID_CATEGORIES.includes(rawCat)) {
            const titleCase = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();
            if (VALID_CATEGORIES.includes(titleCase)) rawCat = titleCase;
        }
        enriched.kategori = { value: rawCat, raw: rawCat, confidence: 1 };
    }

    // 3. Matkul
    const rawMatkul = getVal('matkul');
    if (rawMatkul) enriched.matkul = { value: rawMatkul, raw: rawMatkul, confidence: 1 };

    // 4. Note
    const rawNote = getVal('note');
    if (rawNote) enriched.note = { value: rawNote, raw: rawNote, confidence: 1 };

    // 5. Date (check multiple possible key names from Gemini)
    const rawDate = getVal('date') || getVal('datetime') || getVal('waktu') || getVal('deadline');
    if (rawDate) {
        const parsed = parseDate(rawDate);
        if (parsed) enriched.waktu = { value: rawDate, parsed: parsed, raw: rawDate, confidence: 1 };
    } else if (!entities.isSlotFilling) {
        // Only default to 'Hari Ini' if NOT in slot-filling mode (first extraction)
        const now = new Date();
        const todayStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
        enriched.waktu = { value: 'Hari Ini', parsed: now, raw: todayStr, confidence: 1 };
    }

    // 5b. Priority
    const rawPrio = getVal('priority');
    if (rawPrio) {
        let p = rawPrio.toString().toLowerCase();
        if (p.includes('tinggi') || p.includes('urgent') || p.includes('penting')) p = 'high';
        else if (p.includes('rendah') || p.includes('santai')) p = 'low';
        else if (p.includes('sedang') || p.includes('normal')) p = 'medium';
        enriched.priority = { value: p, raw: rawPrio, confidence: 1 };
    }

    // 6. Others (normalize tipe_tugas to valid types only)
    const VALID_TASK_TYPES = ['Tugas', 'Laporan Pendahuluan', 'Laporan Sementara', 'Laporan Resmi'];
    ['tipe_tugas', 'project', 'project_type', 'item', 'link'].forEach(key => {
        let val = getVal(key);

        // Handle project as object (Gemini sometimes returns { nama_project, priority, deadline })
        if (key === 'project' && val && typeof val === 'object') {
            // Extract nama_project from object
            const projectName = val.nama_project || val.name || val.title;
            if (projectName) {
                enriched.project = { value: projectName, raw: projectName, confidence: 1 };
            }
            // Also extract priority if present
            if (val.priority && !enriched.priority) {
                let p = val.priority.toString().toLowerCase();
                if (p.includes('tinggi') || p.includes('high') || p.includes('urgent')) p = 'high';
                else if (p.includes('rendah') || p.includes('low') || p.includes('santai')) p = 'low';
                else if (p.includes('sedang') || p.includes('medium') || p.includes('normal')) p = 'medium';
                enriched.priority = { value: p, raw: val.priority, confidence: 1 };
            }
            // Also extract deadline if present
            if (val.deadline && !enriched.waktu) {
                const parsed = parseDate(val.deadline);
                if (parsed) enriched.waktu = { value: val.deadline, parsed: parsed, raw: val.deadline, confidence: 1 };
            }
            return;
        }

        if (key === 'project' && val && typeof val === 'string') {
            const lower = val.toLowerCase();
            const generics = ['personal', 'pribadi', 'project', 'proyek', 'tugas', 'matkul', 'kuliah', 'kerjaan', 'kantor', 'urgent', 'penting'];
            if (generics.includes(lower)) return;
        }
        if (key === 'tipe_tugas' && val) {
            // Normalize to valid types only
            const normalizedType = normalizeToValidType(val);
            enriched[key] = { value: normalizedType, raw: val, confidence: 1 };
            return;
        }
        if (val && typeof val === 'string') enriched[key] = { value: val, raw: val, confidence: 1 };
    });

    // Helper to normalize task types to valid ones
    function normalizeToValidType(type) {
        if (!type) return 'Tugas';
        const lower = type.toLowerCase().trim();
        const mapping = {
            'lapres': 'Laporan Resmi',
            'laporan resmi': 'Laporan Resmi',
            'lapsem': 'Laporan Sementara',
            'laporan sementara': 'Laporan Sementara',
            'lapen': 'Laporan Pendahuluan',
            'laporan pendahuluan': 'Laporan Pendahuluan',
            'lp': 'Laporan Pendahuluan',
            'tugas': 'Tugas'
        };
        return mapping[lower] || 'Tugas'; // All others (Kuis, UTS, etc.) become Tugas
    }

    // 7. Infer Project Type
    if (!enriched.project_type && text) {
        const lower = text.toLowerCase();
        if (lower.includes('personal') || lower.includes('pribadi')) {
            enriched.project_type = { value: 'personal', raw: 'personal', confidence: 0.8 };
        } else if (lower.includes('matkul') || lower.includes('kuliah') || lower.includes('course')) {
            enriched.project_type = { value: 'course', raw: 'matkul', confidence: 0.8 };
        }
    }

    // Merge Item & Note
    if (enriched.item && enriched.note) {
        const itemVal = enriched.item.value;
        const noteVal = enriched.note.value;
        if (!noteVal.toLowerCase().includes(itemVal.toLowerCase())) {
            enriched.note.value = `${itemVal} ${noteVal}`;
        }
        delete enriched.item;
    } else if (enriched.item && !enriched.note) {
        enriched.note = { ...enriched.item };
        delete enriched.item;
    }

    return enriched;
}

function inferCategory(text) {
    const lower = text.toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(k => lower.includes(k))) return cat;
    }
    return null;
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function askForMissing(bot, chatId, field, intent, currentData) {
    console.log(`[askForMissing] field='${field}', intent='${intent}'`);
    const question = responses.askField(field, intent, currentData);
    const opts = { parse_mode: 'HTML' };

    if (field === 'kategori') {
        opts.reply_markup = {
            inline_keyboard: [
                [{ text: '🍔 Food', callback_data: 'nlp_kategori_Food' }, { text: '🚗 Transport', callback_data: 'nlp_kategori_Transport' }],
                [{ text: '🛍️ Shopping', callback_data: 'nlp_kategori_Shopping' }, { text: '💡 Bills', callback_data: 'nlp_kategori_Bills' }],
                [{ text: '📺 Subscript', callback_data: 'nlp_kategori_Subscription' }, { text: '💸 Transfer', callback_data: 'nlp_kategori_Transfer' }]
            ]
        };
    }
    if (field === 'priority') {
        opts.reply_markup = {
            inline_keyboard: [
                [{ text: 'High', callback_data: 'nlp_prio_High' }, { text: 'Medium', callback_data: 'nlp_prio_Medium' }, { text: 'Low', callback_data: 'nlp_prio_Low' }]
            ]
        };
    }
    if (field === 'project_type') {
        opts.reply_markup = {
            inline_keyboard: [[
                { text: '👤 Personal', callback_data: 'nlp_proj_personal' },
                { text: '🏫 Mata Kuliah', callback_data: 'nlp_proj_course' }
            ]]
        };
    }
    if (field === 'matkul') {
        // Load courses from entity cache (matkul.json)
        const cache = getEntityCache();
        const matkulKeywords = [];

        if (cache && cache['matkul']) {
            // Extract unique course names (keywords)
            const map = cache['matkul'];
            const seen = new Set();
            for (const [synonym, keyword] of map.entries()) {
                if (!seen.has(keyword)) {
                    seen.add(keyword);
                    matkulKeywords.push(keyword);
                }
            }
        }

        // Build inline keyboard (max 12 courses, 2 per row)
        if (matkulKeywords.length > 0) {
            const buttons = matkulKeywords.slice(0, 12).map(name => {
                // Shorten long names for button text
                const shortName = name.length > 20 ? name.substring(0, 17) + '...' : name;
                return { text: shortName, callback_data: `nlp_matkul_${name.substring(0, 30)}` };
            });

            // Arrange in rows of 2
            const keyboard = [];
            for (let i = 0; i < buttons.length; i += 2) {
                keyboard.push(buttons.slice(i, i + 2));
            }

            opts.reply_markup = { inline_keyboard: keyboard };
        }
    }

    const sent = await bot.sendMessage(chatId, question, opts);
    const p = getPending(chatId);
    if (p) {
        p.lastQuestionId = sent.message_id;
        setPending(chatId, p);
    }
    return true;
}

async function askForConfirmation(bot, chatId, intent, data) {
    let summary = `<b>Konfirmasi Data</b> 📝\n\n`;
    const priorityKeys = ['project', 'waktu', 'project_type', 'priority', 'note', 'amount', 'kategori', 'item', 'matkul', 'tipe_tugas'];

    const pending = getPending(chatId);
    const hasLinkList = pending && pending.links && pending.links.length > 0;

    priorityKeys.forEach(key => {
        const val = data[key];
        if (!val) return;
        let displayVal = escapeHtml(val.value);

        if (key === 'amount') {
            const num = Number(val.value);
            const fmt = !isNaN(num) ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num) : val.value;
            displayVal = escapeHtml(fmt);
        } else if (key === 'waktu' && val.parsed) {
            const dtStr = val.parsed.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
            displayVal = escapeHtml(dtStr);
        }

        const keyName = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
        summary += `- <b>${keyName}</b>: ${displayVal}\n`;
    });

    Object.keys(data).forEach(key => {
        if (priorityKeys.includes(key)) return;
        if (key === 'link') {
            const v = data[key]?.value;
            if (hasLinkList) return;
            if (v === '-' || v.toLowerCase() === 'skip') return;
        }
        if (['confidence', 'raw', 'parsed', 'courseId', 'links'].includes(key)) return;
        summary += `- <b>${key}</b>: ${escapeHtml(data[key].value)}\n`;
    });

    if (hasLinkList) {
        summary += `\n🔗 <b>Links:</b>\n`;
        pending.links.forEach(l => {
            const t = l.title || 'Link';
            summary += `- <a href="${l.url}">${escapeHtml(t)}</a>\n`;
        });
    }

    summary += `\nSudah benar? (Ya/Tidak)`;

    const sent = await bot.sendMessage(chatId, summary, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [[
                { text: '✅ Ya', callback_data: 'nlp_confirm_yes' },
                { text: '❌ Tidak', callback_data: 'nlp_confirm_no' }
            ]]
        }
    });

    const p = getPending(chatId);
    if (p) {
        p.confirmMessageId = sent.message_id;
        setPending(chatId, p);
    }
    return true;
}

async function executeConfirmedIntent(bot, msg, intent, data, broadcastEvent, extraData = []) {
    console.log(`[EXECUTE] Intent: ${intent}`, JSON.stringify(data));
    if (extraData && Array.isArray(extraData) && extraData.length > 0) {
        data.links = extraData;
    }

    try {
        if (['tambah_pemasukan', 'tambah_pengeluaran', 'lihat_transaksi', 'edit_transaksi', 'hapus_transaksi', 'cek_saldo'].includes(intent)) {
            await handleTransactionIntent(bot, msg, intent, data, broadcastEvent);
        }
        else if (intent.includes('tugas') || intent === 'deadline_terdekat') {
            await handleTaskIntent(bot, msg, intent, data, broadcastEvent);
        }
        else if (intent.includes('project') || intent === 'catat_progress') {
            await handleProjectIntent(bot, msg, intent, data, broadcastEvent);
        }
        else {
            await handleGeneralIntent(bot, msg, intent, data, broadcastEvent);
        }
    } catch (err) {
        console.error('Execute Error:', err);
        bot.sendMessage(msg.chat.id, '❌ Terjadi kesalahan saat memproses data.');
    }
}

function extractLocalEntities(text) {
    const lower = text.toLowerCase();
    const entities = {};

    const amtMatch = text.match(AMOUNT_REGEX);
    if (amtMatch) {
        if (!amtMatch[0].match(/^\d{4}$/) || lower.includes('rp')) {
            entities.amount = [{ value: amtMatch[0] }];
        }
    }

    if (/^(deadline|tenggat|waktu|tanggal|date)\b/i.test(lower)) {
        const val = text.replace(/^(deadline|tenggat|waktu|tanggal|date)\s*[:=]?\s*(nya)?\s*/i, '');
        entities.waktu = [{ value: val }];
    } else {
        const dateObj = parseDate(text);
        if (dateObj) entities.waktu = [{ value: text }];
    }

    if (lower.startsWith('note') || lower.startsWith('catatan') || lower.startsWith('ket')) {
        let val = text.replace(/^(ganti|ubah)?\s*(note|catatan|ket)(nya)?\s*(jadi|ke)?\s*[:=]?\s*/i, '');
        entities.note = [{ value: val }];
    }

    if (lower.startsWith('matkul') || lower.startsWith('mk')) {
        const val = text.replace(/^(matkul|mk)(nya)?\s*(jadi|ke)?\s*[:=]?\s*/i, '');
        entities.matkul = [{ value: val }];
    }

    if (lower.startsWith('nama project') || lower.startsWith('project') || lower.includes('nama jadi') || lower.includes('ganti nama')) {
        const val = text.replace(/^(ganti)?\s*(nama)?\s*(project|proyek)?(nya)?\s*(jadi|ke)?\s*[:=]?\s*/i, '');
        if (val && val.length > 1) entities.project = [{ value: val }];
    }

    if (lower.startsWith('kategori') || lower.startsWith('kat')) {
        const val = text.replace(/^(kategori|kat)(nya)?\s*(jadi|ke)?\s*[:=]?\s*/i, '');
        entities.kategori = [{ value: val }];
    } else {
        const foundCat = VALID_CATEGORIES.find(c => lower.includes(c.toLowerCase()));
        if (foundCat) entities.kategori = [{ value: foundCat }];
    }

    if (lower.startsWith('tipe') || lower.startsWith('jenis') || lower.startsWith('tugas')) {
        const val = text.replace(/^(tipe|jenis|tugas)(nya)?\s*(tugas)?\s*(jadi|ke)?\s*[:=]?\s*/i, '');
        entities.tipe_tugas = [{ value: val }];
    }

    // Priority extraction for projects
    if (lower.startsWith('priority') || lower.startsWith('prioritas') || lower.startsWith('prio')) {
        let val = text.replace(/^(priority|prioritas|prio)(nya)?\s*(jadi|ke)?\s*[:=]?\s*/i, '').toLowerCase();
        if (val.includes('tinggi') || val.includes('high') || val.includes('urgent')) val = 'high';
        else if (val.includes('rendah') || val.includes('low') || val.includes('santai')) val = 'low';
        else if (val.includes('sedang') || val.includes('medium') || val.includes('normal')) val = 'medium';
        entities.priority = [{ value: val }];
    }

    // Item extraction for transactions
    if (lower.startsWith('item') || lower.startsWith('barang') || lower.startsWith('beli')) {
        const val = text.replace(/^(item|barang|beli)(nya)?\s*(jadi|ke)?\s*[:=]?\s*/i, '');
        if (val && val.length > 1) entities.item = [{ value: val }];
    }

    // Conflict Resolution: Date vs Amount
    if (entities.waktu && entities.amount) {
        const amtStr = entities.amount[0].value;
        if (!/rb|k|jt|juta/i.test(amtStr)) {
            delete entities.amount;
        }
    }

    return entities;
}

// Callback Query Handler
export async function handleNLPCallback(bot, query, broadcastEvent) {
    const data = query.data;
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();

    // 1. Kategori Selection
    if (data.startsWith('nlp_kategori_')) {
        const val = data.replace('nlp_kategori_', '');
        // Simulate text answer
        const fakeMsg = { chat: { id: chatId }, from: { id: userId }, text: val };
        try { await bot.answerCallbackQuery(query.id); } catch (e) { console.warn('[NLP Callback] answerCallbackQuery failed:', e.message); }
        return handleNaturalLanguage(bot, fakeMsg, broadcastEvent);
    }

    // 1b. Matkul Selection
    if (data.startsWith('nlp_matkul_')) {
        const val = data.replace('nlp_matkul_', '');
        // Find full course name from cache if it was truncated
        const cache = getEntityCache();
        let fullName = val;
        if (cache && cache['matkul']) {
            for (const [_, keyword] of cache['matkul'].entries()) {
                if (keyword.startsWith(val)) {
                    fullName = keyword;
                    break;
                }
            }
        }

        const fakeMsg = { chat: { id: chatId }, from: { id: userId }, text: fullName };
        try { await bot.answerCallbackQuery(query.id); } catch (e) { console.warn('[NLP Callback] answerCallbackQuery failed:', e.message); }
        try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }); } catch (e) { }
        return handleNaturalLanguage(bot, fakeMsg, broadcastEvent);
    }

    // 2. Confirmation
    if (data === 'nlp_confirm_yes' || data === 'nlp_confirm_no') {
        const pending = getPending(chatId);
        if (!pending) return;

        try { await bot.answerCallbackQuery(query.id); } catch (e) { console.warn('[NLP Callback] answerCallbackQuery failed:', e.message); }
        try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }); } catch (e) { }
        clearPending(chatId);

        if (data === 'nlp_confirm_yes') {
            const fakeMsg = { chat: { id: chatId }, from: { id: userId }, text: '' };
            return executeConfirmedIntent(bot, fakeMsg, pending.intent, pending.filled, broadcastEvent, pending.links);
        } else {
            await bot.sendMessage(chatId, '❌ Dibatalkan.');
        }
        return;
    }

    if (data.startsWith('nlp_prio_')) {
        const val = data.replace('nlp_prio_', '');
        const fakeMsg = { chat: { id: chatId }, from: { id: userId }, text: val };
        try { await bot.answerCallbackQuery(query.id); } catch (e) { console.warn('[NLP Callback] answerCallbackQuery failed:', e.message); }
        return handleNaturalLanguage(bot, fakeMsg, broadcastEvent);
    }

    // 4. Project Type Selection
    if (data === 'nlp_proj_personal' || data === 'nlp_proj_course') {
        const pending = getPending(chatId);
        if (!pending) return;

        const type = data === 'nlp_proj_personal' ? 'personal' : 'course';

        pending.filled.project_type = { value: type, raw: type, confidence: 1 };
        pending.missing = pending.missing.filter(field => field !== 'project_type');

        // If type is COURSE and Matkul is missing, force ask for matkul
        if (type === 'course' && !pending.filled.matkul) {
            if (!pending.missing.includes('matkul')) pending.missing.unshift('matkul');
        }

        try { await bot.answerCallbackQuery(query.id); } catch (e) { console.warn('[NLP Callback] answerCallbackQuery failed:', e.message); }
        try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }); } catch (e) { }

        setPending(chatId, pending);
        if (pending.missing.length > 0) {
            return askForMissing(bot, chatId, pending.missing[0], pending.intent, pending.filled);
        } else {
            pending.subState = 'confirmation';
            setPending(chatId, pending);
            return askForConfirmation(bot, chatId, pending.intent, pending.filled);
        }
    }
}
