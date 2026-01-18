
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseMessage, extractEntities, initNLP, getManager } from './nlp-service.js';
import { schemas, getMissingFields } from './intentSchemas.js';
import { setPending, getPending, clearPending, updatePending } from './pendingState.js';
import { parseAmount, formatAmount } from './currency.js';
import { parseDate } from './dateParser.js';
import { responses } from './personality.js';

import { handleTransactionIntent } from './handlers/transactionHandler.js';
import { handleTaskIntent } from './handlers/taskHandler.js';
import { handleProjectIntent } from './handlers/projectHandler.js';
import { handleGeneralIntent } from './handlers/generalHandler.js';
import { getUserData } from '../store.js';

// Legacy Imports (Required for Regex/Session Checks)
import {
    handleTransactionNote,
    handleEditTransactionInput,
    processDeleteTransaction,
    processEditTransaction,
    processListTransactions
} from '../commands/transaction.js';
import { handleEditTaskInput, processDeleteTask, processEditTask } from '../commands/listtasks.js';
import { findCourse, normalizeTaskType } from '../commands/task.js';
import { processProjectCreation, processLogProgress } from '../commands/project.js';

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
const SKIP_KEYWORDS = ['ga ada', 'gak ada', 'tidak ada', 'kosong', 'skip', '-', 'ga usah', 'gak usah', 'gapapa', 'ngga', 'enggak', 'no', 'nope', 'tidak', 'gak', 'ga'];
const EDIT_KEYWORDS = ['ganti', 'ubah', 'bukan', 'salah', 'koreksi'];

// Strict Valid Categories (from TransactionModal.tsx)
const VALID_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Subscription', 'Transfer', 'Salary'];

// Category Keywords Mapping (Fallback)
const CATEGORY_KEYWORDS = {
    'Food': ['makan', 'minum', 'jajan', 'snack', 'kopi', 'nasi', 'bakso', 'soto', 'lunch', 'dinner', 'sarapan', 'cafe', 'warteg', 'mie', 'sate', 'martabak', 'geprek'],
    'Transport': ['gojek', 'grab', 'bensin', 'parkir', 'tol', 'angkot', 'busway', 'kereta', 'uber', 'maxim', 'ojek', 'bengkel', 'service motor', 'service mobil'],
    'Shopping': ['beli', 'belanja', 'shopee', 'tokped', 'tokopedia', 'lazada', 'tiktok', 'baju', 'celana', 'sepatu', 'tas', 'outfit', 'skincare'],
    'Bills': ['listrik', 'air', 'pulsa', 'internet', 'wifi', 'spp', 'ukt', 'tagihan', 'token', 'pdam', 'pln', 'bpjs'],
    'Subscription': ['netflix', 'spotify', 'youtube', 'premium', 'icloud', 'google one', 'disney'],
    'Transfer': ['transfer', 'tf', 'kirim uang', 'bayar utang', 'saham', 'reksadana', 'investasi', 'tabungan'],
    'Salary': ['gaji', 'gajian', 'salary', 'honor', 'upah', 'bayaran kerja', 'bonus', 'freelance', 'project', 'dikasih', 'thr', 'angpao', 'hadiah', 'beasiswa']
};

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
    // Catch "pagi", "pagii", "paagii", "halooo", "haai" etc.
    const greetingRegex = /^(h+a+l+o+|h+a+i+|o+i+|p+a+g+i+|s+i+a+n+g+|s+o+r+e+|m+a+l+a+m+|m+k+s+h+|m+a+k+a+s+i+h+|t+h+a+n+k+s+)$/i;
    const standardGreeting = /^(selamat )?(pagi|siang|sore|malam)$/i;

    if (greetingRegex.test(text) || standardGreeting.test(text)) {
        console.log(`[NLP] Greeting detected: ${text} -> Force Casual`);
        // Extract suffix/honorific (last word if length > 2 and not part of greeting base)
        const parts = text.split(/\s+/);
        const lastWord = parts[parts.length - 1];
        let suffix = '';

        // Simple check: if last word is not "pagi" or "halo", treat as name/honorific
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
    // This connects the command-based session from transaction.js to the NLP handler flow
    if (await handleTransactionNote(bot, msg, broadcastEvent)) return;
    if (await handleEditTransactionInput(bot, msg, broadcastEvent)) return;
    if (await handleEditTaskInput(bot, msg, broadcastEvent)) return;

    // 2c. OVERRIDES (Fix NLP Misses for new commands)
    // TRANSACTION CRUD (Dialects: Sby, Btw, Slang)
    // Delete: hapus, ngapus, busak, mbusak, ilangno, buwak, uncalno, apus, buang, musnahin, tiadakan, drop, wipe
    if (/^(hapus|ngapus|ngapusin|hapusin|apus|delete|remove|buang|batalkan|cancel|busak|mbusak|ilangno|buwak|uncalno|musnahin|tiadakan|drop|wipe)\s+(transaksi|keuangan|duwit|duit|picis|ceng|sangun|arto|fulus|ceban|cuan|hepeng|dana)/i.test(text)) {
        return processDeleteTransaction(bot, chatId, msg.from.id.toString());
    }
    // Edit: edit, ubah, ganti, benakno, opoo, dandani, ulik, benerin, oprek, otak-atik, revisi, rombak, tweak, patch
    if (/^(edit|ubah|ganti|koreksi|revisi|update|change|benakno|opoo|dandani|ulik|benerin|oprek|otak-atik|rombak|tweak|patch)\s+(transaksi|keuangan|duwit|duit|picis|ceng|sangun|arto|fulus|ceban|cuan|hepeng|dana)/i.test(text)) {
        return processEditTransaction(bot, chatId, msg.from.id.toString());
    }
    // Read/History: histori, riwayat, log, cek, liat, ndelok, eruh, inceng, was, lirik, intip, pantau, tengok, kepoin
    if (/^(histori|riwayat|log|cek|liat|lihat|ndelok|eruh|inceng|was|lirik|intip|pantau|tengok|kepoin)\s+(transaksi|keuangan|duwit|duit|picis|ceng|sangun|arto|fulus|ceban|cuan|hepeng|dana)/i.test(text)) {
        return processListTransactions(bot, chatId, msg.from.id.toString());
    }

    // TASK CRUD (Dialects: Sby, Btw, Slang)
    // Delete
    if (/^(hapus|ngapus|ngapusin|hapusin|apus|delete|remove|buang|batalkan|cancel|busak|mbusak|ilangno|buwak|uncalno|musnahin|tiadakan|drop|wipe)\s+(tugas|lapres|lapsem|lapen|lp|pr|kuis|quiz|uts|uas|garapan|gawean|tanggungan|kerjaan|proyekan|grind|quest|misi)\b/i.test(text)) {
        return processDeleteTask(bot, chatId, msg.from.id.toString());
    }
    // Edit
    if (/^(edit|ubah|ganti|koreksi|revisi|update|change|benakno|opoo|dandani|ulik|benerin|oprek|otak-atik|rombak|tweak|patch)\s+(tugas|lapres|lapsem|lapen|lp|pr|kuis|quiz|uts|uas|garapan|gawean|tanggungan|kerjaan|proyekan|grind|quest|misi)\b/i.test(text)) {
        return processEditTask(bot, chatId, msg.from.id.toString());
    }

    // PROJECT CRUD (Dialects: Sby, Btw, Slang)
    // Delete
    if (/^(hapus|ngapus|ngapusin|hapusin|apus|delete|remove|buang|batalkan|cancel|busak|mbusak|ilangno|buwak|uncalno|musnahin|tiadakan|drop|wipe)\s+(project|projek|proyek)/i.test(text)) {
        const { processDeleteProject } = await import('../commands/project.js');
        return processDeleteProject(bot, chatId, msg.from.id.toString());
    }
    // Edit
    if (/^(edit|ubah|ganti|koreksi|revisi|update|change|benakno|opoo|dandani|ulik|benerin|oprek|otak-atik|rombak|tweak|patch)\s+(project|projek|proyek)/i.test(text)) {
        const { processEditProject } = await import('../commands/project.js');
        return processEditProject(bot, chatId, msg.from.id.toString());
    }
    // SUMMARY OVERRIDE
    if (/^(summary|ringkasan|rangkuman|rekap)/i.test(text)) {
        const { processSummary } = await import('../commands/summary.js');
        return processSummary(bot, chatId, msg.from.id.toString(), text);
    }

    // 3. Process with NLP (Wit.ai / NodeNLP)
    // FORCE OVERRIDE: Check for specific patterns that NLP misses
    let result = { intents: [], entities: {} };
    const lowerText = text.toLowerCase();

    // Regex for Task Creation (Specific Keywords Only)
    // Excluded 'project/projek' to avoid hijacking project commands
    if (/^((?:aku|saya|gw|gue)\s+)?(buat|tambah|ada|input|bikin)\s+(tugas|lapres|lapsem|lapen|lp|laporan|pr|kuis|quiz|uts|uas)\b/i.test(lowerText) ||
        /^((?:aku|saya|gw|gue)\s+)?(tugas|lapres|lapsem|lapen|lp)\b/.test(lowerText)) {
        console.log(`[NLP] Regex Override: Detected Task Creation -> Force 'buat_tugas'`);
        result.intents = [{ name: 'buat_tugas', confidence: 1.0 }];
        const nlpResult = (await getManager()) ? await parseMessage(text) : { intents: [], entities: {} };
        result.entities = nlpResult.entities;
    }
    // Regex for Project Creation
    // Regex for Project Creation vs Query
    else if (/^((?:aku|saya|gw|gue)\s+)?(buat|tambah|ada|input|bikin)\s+(project|projek)/.test(lowerText)) {
        // Disambiguation: Check if it's a question ("ada project ga?", "project apa?")
        const isQuery = text.endsWith('?') || /\b(ga|apa|kah|mana)\??$/i.test(lowerText);

        if (isQuery) {
            console.log(`[NLP] Regex Override: Detected Project Query -> Force 'lihat_project'`);
            result.intents = [{ name: 'lihat_project', confidence: 1.0 }];
        } else {
            console.log(`[NLP] Regex Override: Detected Project Creation -> Force 'buat_project'`);
            result.intents = [{ name: 'buat_project', confidence: 1.0 }];
        }

        const nlpResult = (await getManager()) ? await parseMessage(text) : { intents: [], entities: {} };
        result.entities = nlpResult.entities;
    }
    // Regex for Log Progress
    else if (/^((?:aku|saya|gw|gue)\s+)?(catat|catet|log|lapor|update|tambah)\s+(progress|progres)\b/i.test(lowerText)) {
        console.log(`[NLP] Regex Override: Detected Log Progress -> Force 'catat_progress'`);
        result.intents = [{ name: 'catat_progress', confidence: 1.0 }];
        const nlpResult = (await getManager()) ? await parseMessage(text) : { intents: [], entities: {} };
        result.entities = nlpResult.entities;
    }
    else {
        result = (await getManager()) ? await parseMessage(text) : { intents: [] };
    }

    // 4. Confidence gate
    const topIntent = result.intents?.[0];
    if (!topIntent || topIntent.confidence < CONFIDENCE_THRESHOLD) {
        return handleLowConfidence(bot, msg, text);
    }

    // 5. Extract entities
    const intent = topIntent.name;
    const entities = extractEntities(result.entities);

    // 6. Enrich entities (parse amounts, dates, etc)
    const enriched = enrichEntities(entities, text, msg.from.id.toString());

    // --- LOCAL FALLBACK EXTRACTION (Smart NLP) ---
    // If Amount is missing, try to extract from text using Regex (Only for transactions)
    if (!enriched.amount && (intent === 'tambah_pemasukan' || intent === 'tambah_pengeluaran')) {
        // Added \b to start to prevent matching inside words like jkt48
        const amountMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta|m|milyar)?\b/i);
        if (amountMatch) {
            const val = parseAmount(amountMatch[0]);
            if (val > 0) {
                enriched.amount = { value: val, raw: amountMatch[0], confidence: 1 };
                console.log(`[NLP] extracted local amount: ${val}`);
            }
        }
    }

    // If Category is missing, try to infer from text
    if (!enriched.kategori && (intent === 'tambah_pengeluaran' || intent === 'tambah_pemasukan')) {
        const inferred = inferCategory(text);
        if (inferred) {
            enriched.kategori = { value: inferred, raw: text, confidence: 0.9 };
            console.log(`[NLP] extracted local category: ${inferred}`);
        }
    }

    // NEW: Smart Course Scan (Early Enrichment for buat_tugas)
    // Scan text for course acronyms/names BEFORE checking missing fields
    if (intent === 'buat_tugas' && !enriched.matkul) {
        const userData = getUserData(msg.from.id.toString());
        const courses = userData?.courses || [];

        if (courses.length > 0) {
            // findCourse now supports scanning text for synonyms/names
            const found = findCourse(text, courses);
            if (found) {
                enriched.matkul = {
                    value: found.name,
                    courseId: found.id,
                    raw: found.name,
                    confidence: 1
                };
                console.log(`[NLP DEBUG] Early Scan found: ${found.name}`);
            }
        }
    }



    // DEBUG: Print all keys
    try { fs.appendFileSync('debug_nlp.log', `[DEBUG] Intent: ${intent}, Enriched Keys: ${Object.keys(enriched).join(', ')}\n`); } catch (e) { }
    process.stdout.write(`\n[XXX] Intent: ${intent}, Enriched Keys: ${Object.keys(enriched).join(', ')}\n`);

    // NEW: Validation Logic (Only 'Praktikum'/'Workshop' courses can have Reports)
    if (intent === 'buat_tugas' && enriched.matkul && enriched.tipe_tugas) {
        const type = (enriched.tipe_tugas.value || '').toLowerCase();
        const courseName = (enriched.matkul.value || '').toLowerCase();

        // Normalized Types often used: "Laporan Resmi", "Laporan Pendahuluan", "Laporan Sementara"
        const isReport = type.includes('laporan') || type.includes('lapres') || type.includes('lapsem') || type.includes('lapen');
        const isPractical = courseName.includes('praktikum') || courseName.includes('workshop');

        if (isReport && !isPractical) {
            console.log(`[NLP VALIDATION] Rejected '${type}' for course '${courseName}'`);
            bot.sendMessage(msg.chat.id, `⚠️ *Gak Match!* ⚠️\n\nJenis tugas *${enriched.tipe_tugas.value}* cuma bisa buat matkul Praktikum/Workshop.\n(Sedangkan ini matkul: _${enriched.matkul.value}_)\n\nCoba pilih tipe lain ya.`, { parse_mode: 'Markdown' });

            // Clear the invalid field so it prompts again
            delete enriched.tipe_tugas;
        }
    }

    // If Note is missing, try to extract it from remaining text (Optional but heuristic)
    // Heuristic: Remove Intent Keywords, Category Keywords, and Amount. What's left is Note.
    if (!enriched.note && (intent === 'tambah_pengeluaran' || intent === 'tambah_pemasukan')) {
        let cleanText = text.toLowerCase();
        // Remove amount raw
        if (enriched.amount?.raw) cleanText = cleanText.replace(enriched.amount.raw.toLowerCase(), '');
        // Remove category keywords
        if (enriched.kategori?.value) {
            const catKeywords = CATEGORY_KEYWORDS[enriched.kategori.value] || [];
            catKeywords.forEach(kw => cleanText = cleanText.replace(kw, ''));
        }
        // Remove basic keywords and pronouns
        // Remove basic keywords and pronouns
        const stopWords = [
            // Transaction Actions
            'income', 'pemasukan', 'expense', 'pengeluaran', 'beli', 'bayar', 'jajan', 'transfer',
            // Amount Labels
            'nominal', 'harga', 'jumlah', 'duit', 'harganya', 'nominalnya', 'sebesar', 'senilai', 'seharga', 'sebanyak',
            // Time / Recency
            'baru aja', 'baru saja', 'barusan', 'tadi', 'kemarin', 'kemaren', 'hari ini', 'saat ini', 'sekarang',
            // Aspect
            'abis', 'habis', 'lagi', 'sedang', 'sudah', 'telah', 'mau', 'ingin', 'akan',
            // Pronouns
            'aku', 'saya', 'gw', 'gua', 'gue', 'kita', 'kami', 'lu', 'lo', 'kamu', 'anda', 'dia', 'mereka',
            // Prepositions
            'di', 'ke', 'dari', 'buat', 'untuk', 'sama', 'kepada', 'dengan', 'pada', 'bagi', 'oleh',
            // Conjunctions / Demonstratives
            'adalah', 'yaitu', 'yakni', 'ini', 'itu', 'yang', 'dan', 'atau',
            // Particles / Fillers
            'dong', 'sih', 'deh', 'kan', 'ya', 'ni', 'nih', 'tuh', 'cuma', 'hanya', 'cuman', 'si', 'sang', 'para',
            // Custom Fillers
            'bes', 'bang', 'mas', 'kang', 'coy', 'ler'
        ];

        // Sort by length desc to handle phrases first ("baru aja" before "baru")
        stopWords.sort((a, b) => b.length - a.length);

        stopWords.forEach(kw => {
            cleanText = cleanText.replace(new RegExp(`\\b${kw}\\b`, 'gi'), '');
        });

        const potentialNote = cleanText.trim().replace(/\s+/g, ' ');
        if (potentialNote.length > 2) { // Minimal length check
            enriched.note = { value: potentialNote, raw: potentialNote, confidence: 0.8 };
            console.log(`[NLP] extracted local note: "${potentialNote}"`);
        }
    }
    // ---------------------------------------------

    // 7. Check required fields (Smart Field Completion)
    const schema = schemas[intent];
    if (!schema) {
        console.warn('Unknown intent:', intent);
        return false;
    }

    const missing = getMissingFields(schema.required, enriched);

    // --- CUSTOM FLOW: Project Creation (Type & Matkul logic) ---
    if (intent === 'buat_project' && !missing.includes('project')) {
        // 1. Check Project Type
        if (!enriched.project_type) {
            setPending(chatId, {
                intent, filled: enriched, missing: ['project_type'], raw_text: text, confidence: topIntent.confidence
            });
            await bot.sendMessage(chatId, `Jenis Projectnya apa? 🏫/👤\n_Pilih atau ketik "personal"/"matkul"_`, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '👤 Personal', callback_data: 'nlp_proj_personal' },
                        { text: '🏫 Mata Kuliah', callback_data: 'nlp_proj_course' }
                    ]]
                }
            });
            return true;
        }

        // 2. If Course -> Check Matkul
        if (enriched.project_type.value === 'course' && !enriched.matkul) {
            setPending(chatId, {
                intent, filled: enriched, missing: ['matkul'], raw_text: text, confidence: topIntent.confidence
            });
            return askForMissing(bot, chatId, 'matkul', intent, enriched);
        }
    }
    // -----------------------------------------------------------

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

    // 8. All required fields present - BUT we must validate specific constraints (Strict Category)
    // and then ask for confirmation.

    // 8. All Validated - BUT we must validate specific constraints

    // A. Expense/Income Strict Category
    if (intent === 'tambah_pengeluaran' || intent === 'tambah_pemasukan') {
        let category = enriched.kategori?.value;

        // Validation: Check strict list
        if (category && !VALID_CATEGORIES.includes(category)) {
            // Try fallback inference
            const inferred = inferCategory(category) || inferCategory(text);
            if (inferred) {
                enriched.kategori = { value: inferred, raw: category, confidence: 1 };
            } else {
                // Invalid and cannot infer -> Mark as missing
                delete enriched.kategori;
                // Re-evaluate missing fields
                const missingAgain = getMissingFields(['kategori'], enriched); // Force allow asking
                if (missingAgain.length > 0) {
                    setPending(chatId, {
                        intent, filled: enriched, missing: missingAgain, raw_text: text, confidence: topIntent.confidence
                    });
                    return askForMissing(bot, chatId, missingAgain[0], intent, enriched);
                }
            }
        }

        if (!enriched.kategori) {
            setPending(chatId, {
                intent, filled: enriched, missing: ['kategori'], raw_text: text, confidence: topIntent.confidence
            });
            return askForMissing(bot, chatId, 'kategori', intent, enriched);
        }
    }

    // B. Task Creation Strict Validation (NEW)
    else if (intent === 'buat_tugas') {
        const userData = getUserData(msg.from.id.toString());
        const courses = userData?.courses || [];

        // 1. Resolve Course Name to ID
        // Note: We already did "Smart Scan" in Early Enrichment step.
        // So enriched.matkul should have { value: "Full Name", courseId: "..." } if found.

        if (enriched.matkul?.value) {
            // Validate that the course actually exists (double check) or find ID if missing
            // If it came from NLP entity, it might not have courseId yet.
            if (!enriched.matkul.courseId) {
                const resolved = findCourse(enriched.matkul.value, courses);
                if (resolved) {
                    enriched.matkul.value = resolved.name;
                    enriched.matkul.courseId = resolved.id;
                } else {
                    // Invalid course name from NLP?
                    await bot.sendMessage(chatId, `❌ Matkul "${enriched.matkul.value}" gak ketemu di daftarmu.`);
                    delete enriched.matkul;
                    setPending(chatId, {
                        intent, filled: enriched, missing: ['matkul'], raw_text: text, confidence: topIntent.confidence
                    });
                    return askForMissing(bot, chatId, 'matkul', intent, enriched);
                }
            }
        } else {
            // If still missing after Early Scan -> Ask user
            // This block normally won't be reached if matkul is "required" schema, 
            // because getMissingFields returns before this validation block.
            // But just in case.
        }

        // 2. Validate Task Type vs Course Type
        if (enriched.tipe_tugas?.value && enriched.matkul?.value) {
            const type = enriched.tipe_tugas.value; // e.g. "Laporan Resmi"
            const courseName = enriched.matkul.value.toLowerCase();

            const isReport = ['Laporan Resmi', 'Laporan Sementara', 'Laporan Pendahuluan'].includes(type);
            const isPracticalCourse = courseName.includes('praktikum') || courseName.includes('workshop');

            if (isReport && !isPracticalCourse) {
                await bot.sendMessage(chatId, `⚠️ **Validasi Gagal**\n"${type}" cuma boleh buat matkul Praktikum/Workshop.\nMatkul "${enriched.matkul.value}" ini Teori.`);
                delete enriched.tipe_tugas;

                setPending(chatId, {
                    intent, filled: enriched, missing: ['tipe_tugas'], raw_text: text, confidence: topIntent.confidence
                });
                return askForMissing(bot, chatId, 'tipe_tugas', intent, enriched);
            }
        }
    }



    // 9. All Validated - Trigger Confirmation Flow
    const pendingState = {
        intent,
        filled: enriched,
        missing: [],
        raw_text: text,
        confidence: topIntent.confidence,
        subState: 'confirmation'
    };

    // 9. NEW: Check if this intent requires confirmation at all
    // Read-only intents should execute immediately without asking "Benar?"
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
 * Handle slot completion for multi-turn conversations
 */
export async function handleSlotCompletion(bot, msg, pending, text, broadcastEvent) {
    const chatId = msg.chat.id;

    // A.0 Check for STRONG INTENTS (Interrupt current flow)
    const lowerText = text.toLowerCase();

    // 1. Progress Logging Override
    if (/^((?:aku|saya|gw|gue)\s+)?(catat|catet|log|lapor|update|tambah)\s+(progress|progres)\b/i.test(lowerText)) {
        console.log('[NLP] Strong Intent Interrupt: catat_progress');
        clearPending(chatId);
        // Delete previous confirmation if exists
        if (pending.confirmMessageId) {
            try { await bot.deleteMessage(chatId, pending.confirmMessageId); } catch (e) { }
        }
        return handleNaturalLanguage(bot, msg, broadcastEvent);
    }

    // 4. Check Transaction Note Input
    if (await handleTransactionNote(bot, msg, broadcastEvent)) return;

    // 5. Check Edit Transaction Input (New)
    if (await handleEditTransactionInput(bot, msg, broadcastEvent)) return;

    // --- OVERRIDES (Fix NLP Misses) ---
    if (/^(hapus|delete|remove)\s+transaksi/i.test(lowerText)) {
        return processDeleteTransaction(bot, chatId, userId);
    }
    if (/^(edit|ubah|ganti)\s+transaksi/i.test(lowerText)) {
        return processEditTransaction(bot, chatId, userId);
    }
    if (/^(hapus|delete|remove)\s+(project|projek)/i.test(lowerText)) {
        // Future: processDeleteProject(bot, chatId, userId)
        // For now, let it fall through or handle if implemented
    }

    // 6. NLP Analysis
    if (/^((?:aku|saya|gw|gue)\s+)?(buat|tambah|ada|input|bikin)\s+(project|projek)/.test(lowerText)) {
        console.log('[NLP] Strong Intent Interrupt: buat_project');
        clearPending(chatId);
        // Delete previous confirmation if exists
        if (pending.confirmMessageId) {
            try { await bot.deleteMessage(chatId, pending.confirmMessageId); } catch (e) { }
        }
        return handleNaturalLanguage(bot, msg, broadcastEvent);
    }

    // A. Check for cancel keywords
    if (isCancelKeyword(text)) {
        // Delete the previous confirmation message if it exists
        if (pending.confirmMessageId) {
            try {
                await bot.deleteMessage(chatId, pending.confirmMessageId);
            } catch (error) {
                console.log('[NLP] Failed to delete confirmation message (maybe too old or already deleted)');
            }
        }

        clearPending(chatId);
        await bot.sendMessage(chatId, responses.cancelled());
        return true;
    }

    // A.1 Check for Casual/Help Interruption (Reset Flow)
    // const lower = text.toLowerCase(); // Already defined above
    const casualWords = ['halo', 'hai', 'oi', 'pagi', 'siang', 'sore', 'malam'];
    const helpWords = ['bantuan', 'help', 'menu', 'panduan', 'command'];

    if (casualWords.some(w => lowerText.startsWith(w))) {
        clearPending(chatId);
        // Treat as new casual message
        // Extract suffix/honorific (last word if length > 2 and not part of greeting base)
        const parts = text.split(/\s+/);
        const lastWord = parts[parts.length - 1];
        let suffix = '';
        if (parts.length > 1 && !['pagi', 'siang', 'sore', 'malam', 'halo', 'hai'].includes(lastWord.toLowerCase())) {
            suffix = lastWord;
        }

        await bot.sendMessage(chatId, responses.casual(text, suffix));
        return true;
    }

    if (helpWords.some(w => lowerText.includes(w))) {
        clearPending(chatId);
        return handleFallbackIntents(bot, msg, 'bantuan');
    }

    // A.5 Check for skip keywords (for optional fields)
    const currentMissing = pending.missing[0];
    // const lowerText = text.toLowerCase().trim(); // Already defined at top
    // console.log(`[NLP DEBUG Block A.5] currentMissing=${currentMissing}, text="${text}"`);
    console.log(`[NLP DEBUG Block A.5] currentMissing=${currentMissing}, text="${text}"`);
    // Force "ga" check to be safe + existing helper
    if (currentMissing && (isSkipKeyword(text) || lowerText === 'ga' || lowerText === 'gak')) {

        // 1. Mandatory Note Check for catat_progress
        if (pending.intent === 'catat_progress' && currentMissing === 'note') {
            await bot.sendMessage(chatId, '❌ Note wajib diisi buat log progress! (Apa yang dikerjain?)');
            return;
        }

        // Fix: Use '-' instead of '' so Block F knows it is filled
        pending.filled[currentMissing] = { value: '-', raw: text, confidence: 1 };

        // SPECIAL SIDE-EFFECT: Link Title Skipped -> Push link to array
        if (currentMissing === 'link_title' && pending.filled.link) {
            // ... existing logic ...
            if (!pending.links) pending.links = [];
            pending.links.push({ url: pending.filled.link.value, title: 'Ref Link' });
            pending.filled.links = { value: pending.links, raw: '', confidence: 1 };

            // Loop: STOP Loop on Skip Title (Fix "Two Ga" annoyance)
            pending.missing.shift(); // Remove link_title
            pending.missing = pending.missing.filter(f => f !== 'add_more_links');
        } else if (currentMissing === 'link') {
            // Special handling for Link Skip: If user skips link, it means NO link (or stop adding)
            pending.filled.link = { value: '-', raw: text, confidence: 1 };
            pending.missing.shift(); // Remove 'link'

            // Also remove 'link_title' and 'add_more_links' if they are queued
            pending.missing = pending.missing.filter(f => f !== 'link_title' && f !== 'add_more_links');

            // Ensure 'links' field is set to prevent re-asking
            if (!pending.filled.links) {
                pending.filled.links = { value: pending.links || [], raw: '', confidence: 1 };
            }
        } else {
            pending.missing.shift();
        }

        // Cleanup Buttons for Skip/Manual "ga"
        if (pending.lastQuestionId) {
            try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: pending.lastQuestionId }); } catch (e) { }
            delete pending.lastQuestionId;
        }

        text = '';
    }


    // B. Check for mid-flow edit keywords
    const userId = msg.from.id.toString();
    const editMatch = detectMidFlowEdit(text, pending, userId);
    if (editMatch) {
        if (editMatch.type === 'intent') {
            pending.intent = editMatch.value;
            await bot.sendMessage(chatId, `✅ Tipe diubah ke: ${editMatch.value === 'tambah_pemasukan' ? 'Income' : 'Expense'}`);

            // Recalculate missing for new intent
            const req = schemas[pending.intent].required;
            pending.missing = getMissingFields(req, pending.filled);
            setPending(chatId, pending);

            if (pending.missing.length > 0) {
                return askForMissing(bot, chatId, pending.missing[0], pending.intent, pending.filled);
            } else {
                pending.subState = 'confirmation';
                setPending(chatId, pending);
                return askForConfirmation(bot, chatId, pending.intent, pending.filled);
            }
        } else {
            // Special handling for Link Edits (Array modification)
            if (editMatch.field === 'edit_link') {
                const { index, url } = editMatch.value;
                if (pending.links && pending.links[index]) {
                    pending.links[index] = { ...pending.links[index], url: url };
                    pending.filled.links = { value: pending.links, raw: '', confidence: 1 };
                    await bot.sendMessage(chatId, `✅ Link ${index + 1} diubah jadi: ${url}`);
                } else {
                    await bot.sendMessage(chatId, `❌ Link nomor ${index + 1} gak ketemu.`);
                }
            } else if (editMatch.field === 'edit_link_title') {
                const { index, title } = editMatch.value;
                if (pending.links && pending.links[index]) {
                    pending.links[index] = { ...pending.links[index], title: title };
                    pending.filled.links = { value: pending.links, raw: '', confidence: 1 };
                    await bot.sendMessage(chatId, `✅ Judul link ${index + 1} diubah jadi: ${title}`);
                } else {
                    await bot.sendMessage(chatId, `❌ Link nomor ${index + 1} gak ketemu.`);
                }
            } else {
                // Normal fields
                pending.filled[editMatch.field] = editMatch.value;
                let displayVal = editMatch.value.value;
                if (editMatch.field === 'amount') {
                    displayVal = formatAmount(displayVal);
                }
                await bot.sendMessage(chatId, responses.fieldUpdated(editMatch.field, displayVal));
            }
        }

        // Common Re-evaluation (for both Field edits and link edits)
        // If we were in confirmation mode, re-trigger confirmation with new data immediately
        if (pending.subState === 'confirmation') {
            if (pending.confirmMessageId) {
                try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: pending.confirmMessageId }); } catch (e) { }
            }
            return askForConfirmation(bot, chatId, pending.intent, pending.filled);
        }

        // If in collection mode, re-check missing and continue
        pending.missing = pending.missing.filter(field => {
            const val = pending.filled[field];
            return !val || val.value === undefined || val.value === '';
        });

        // Dynamic Dependency Check (Project Type -> Matkul)
        if (pending.filled.project_type?.value === 'personal') {
            pending.missing = pending.missing.filter(f => f !== 'matkul');
        } else if (pending.filled.project_type?.value === 'course' && !pending.filled.matkul) {
            if (!pending.missing.includes('matkul')) pending.missing.unshift('matkul');
        }
        setPending(chatId, pending);

        if (pending.missing.length > 0) {
            return askForMissing(bot, chatId, pending.missing[0], pending.intent, pending.filled);
        } else {
            // All done
            pending.subState = 'confirmation';
            setPending(chatId, pending);
            return askForConfirmation(bot, chatId, pending.intent, pending.filled);
        }
    }

    // C. Confirmation State Handling
    if (pending.subState === 'confirmation') {
        const lower = (text || '').toLowerCase();
        // Added 'udah', 'sudah', 'sip', 'siap', 'betul'
        if (['ya', 'y', 'benar', 'bener', 'lanjut', 'gas', 'oke', 'ok', 'udah', 'sudah', 'sip', 'siap', 'betul', 'udeh', 'sudah bener', 'sudah benar', 'sudah betul', 'iye', 'ye', 'hooh', 'yak'].includes(lower)) {
            // Cleanup confirmation buttons
            if (pending.confirmMessageId) {
                try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: pending.confirmMessageId }); } catch (e) { }
            }
            clearPending(chatId);
            return executeConfirmedIntent(bot, msg, pending.intent, pending.filled, broadcastEvent, pending.links);
        } else if (['tidak', 'ga', 'salah', 'bukan', 'no', 'enggak', 'gajadi', 'batal'].includes(lower)) {
            // Cleanup confirmation buttons
            if (pending.confirmMessageId) {
                try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: pending.confirmMessageId }); } catch (e) { }
            }
            clearPending(chatId);
            await bot.sendMessage(chatId, '❌ Dibatalkan. Silakan input ulang jika perlu.');
            return true;
        } else {
            // 1. Check for Corrections (Explicit or Implicit)
            // Priority: Corrections > Context Switch
            // 1. Check for Corrections (Explicit or Implicit)
            // Priority: Corrections > Context Switch
            const correctionResult = await parseMessage(text);
            const rawCorrectionEntities = extractEntities(correctionResult.entities || {});
            // CRITICAL FIX: Enrich entities immediately to catch Regex-based fields (like 'tipe_tugas' for 'lapsem')
            const enrichedCorrection = enrichEntities(rawCorrectionEntities, text);

            // Explicit correction keywords
            const isExplicitCorrection = ['ganti', 'ubah', 'koreksi', 'bukan', 'salah', 'tipe', 'matkul', 'deadline', 'waktu'].some(w => text.toLowerCase().includes(w));

            // Check if any recognized entity matches the schema fields
            // Use enrichedCorrection keys!
            const hasCorrection = Object.keys(enrichedCorrection).some(key =>
                ['amount', 'kategori', 'waktu', 'matkul', 'tipe_tugas', 'note', 'number', 'datetime'].includes(key)
            );

            if (hasCorrection || isExplicitCorrection) {
                // Cleanup OLD confirmation buttons before re-asking
                if (pending.confirmMessageId) {
                    try { bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: pending.confirmMessageId }); } catch (e) { }
                }
                // Apply correction
                // enrichedCorrection is already calculated

                // If explicit correction but no entity found (e.g. "ganti note jadi ini"), treat text as note if generic
                if (Object.keys(enrichedCorrection).length === 0 && isExplicitCorrection) {
                    // Simple heuristic: if likely a note correction
                    if (text.toLowerCase().includes('note') || text.toLowerCase().includes('catatan')) {
                        const cleanNote = text.replace(/ganti|ubah|koreksi|note|catatan|jadi/gi, '').trim();
                        if (cleanNote) enrichedCorrection.note = { value: cleanNote, raw: cleanNote, confidence: 1 };
                    }
                }

                // Handling for 'edit_link' (Special case for array modification)
                if (enrichedCorrection.edit_link) {
                    const { index, url } = enrichedCorrection.edit_link.value;
                    if (pending.links && pending.links[index]) {
                        pending.links[index] = { ...pending.links[index], url: url };
                        pending.filled.links = { value: pending.links, raw: '', confidence: 1 };
                        await bot.sendMessage(chatId, `✅ Link ${index + 1} diubah jadi: ${url}`);
                        delete enrichedCorrection.edit_link;
                    } else {
                        await bot.sendMessage(chatId, `❌ Link nomor ${index + 1} gak ketemu.`);
                        return true;
                    }
                }

                // Handling for 'edit_link_title' 
                if (enrichedCorrection.edit_link_title) {
                    const { index, title } = enrichedCorrection.edit_link_title.value;
                    if (pending.links && pending.links[index]) {
                        pending.links[index] = { ...pending.links[index], title: title };
                        pending.filled.links = { value: pending.links, raw: '', confidence: 1 };
                        await bot.sendMessage(chatId, `✅ Judul link ${index + 1} diubah jadi: ${title}`);
                        delete enrichedCorrection.edit_link_title;
                    } else {
                        await bot.sendMessage(chatId, `❌ Link nomor ${index + 1} gak ketemu.`);
                        return true;
                    }
                }



                // Force delete special keys to avoid them leaking into Object.assign or logs
                const editKeys = ['edit_link', 'edit_link_title'];
                editKeys.forEach(k => delete enrichedCorrection[k]);

                Object.assign(pending.filled, enrichedCorrection);

                // Re-confirm with updated data
                // Generate human-readable feedback
                const changes = [];
                const fieldLabels = {
                    matkul: 'Matkul',
                    tipe_tugas: 'Tipe',
                    waktu: 'Deadline',
                    amount: 'Nominal',
                    kategori: 'Kategori',
                    note: 'Note',
                    date: 'Tanggal',
                    project: 'Project',
                    link: 'Link',
                    priority: 'Prioritas'
                };

                for (const [key, val] of Object.entries(enrichedCorrection)) {
                    // Skip undefined or internal keys
                    // Fix: Skip edit_link* keys explicitly to avoid "undefined" logs
                    if (!fieldLabels[key] || key.startsWith('edit_link')) continue;

                    let displayVal = val.value;
                    // Format Date
                    if (key === 'waktu' && val.parsed) {
                        displayVal = val.parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                    }
                    // Format Amount
                    if (key === 'amount' && typeof val.value === 'number') {
                        displayVal = formatAmount(val.value);
                    }
                    // Format Link (truncate)
                    if (key === 'link' && displayVal.length > 30) {
                        displayVal = displayVal.substring(0, 27) + '...';
                    }

                    changes.push(`${fieldLabels[key]} udah kuganti jadi ${displayVal}`);
                }

                if (changes.length > 0) {
                    await bot.sendMessage(chatId, `Okee, ${changes.join(', ')} 👍`);
                } else {
                    await bot.sendMessage(chatId, `✅ Data diperbarui.`);
                }
                // Return to recursion with SAME intent/data to re-trigger confirmation logic properly
                // But simpler depends on logic: just re-calling askForConfirmation is safest
                await askForConfirmation(bot, chatId, pending.intent, pending.filled);
                return true;
            }

            // 2. Context Switch (High Confidence New Intent)
            const manager = getManager();
            if (manager) {
                const processResult = await manager.process('id', text);
                const limit = 0.75;
                if (processResult.intent && processResult.intent !== 'None' && processResult.score > limit) {
                    // CRITICAL FIX: If intent is SAME as pending, treat as Refinement/Correction, NOT Cancellation
                    if (processResult.intent === pending.intent) {
                        console.log(`[NLP] Same intent detected (${pending.intent}). Merging new entities...`);
                        const newEntities = extractEntities(processResult.entities || {});
                        const enrichedNew = enrichEntities(newEntities, text);
                        Object.assign(pending.filled, enrichedNew);

                        await bot.sendMessage(chatId, `✅ Data diperbarui.`);
                        await askForConfirmation(bot, chatId, pending.intent, pending.filled);
                        return true;
                    }

                    console.log(`[NLP] Context Switch: Cancelling ${pending.intent} -> ${processResult.intent}`);
                    clearPending(chatId);
                    await bot.sendMessage(chatId, `⚠️ Transaksi sebelumnya dibatalkan. Mengganti ke perintah baru...`);
                    return handleNaturalLanguage(bot, msg, broadcastEvent);
                }
            }

            // 3. Fallback: Unknown / Gibberish
            // Do NOT re-ask confirmation card aggressively.
            await bot.sendMessage(chatId, `Maaf, saya tidak mengerti. 
- Jawab "Ya" untuk konfirmasi.
- Jawab "Tidak" untuk batal.
- Atau ketik koreksi (misal: "50rb", "makan").
- Gunakan /help untuk bantuan.`);
            return true;
        }
    }

    // D. Parse answer as slot completion
    let enriched = {};
    if (text) {
        // SPECIAL CASE: Note/Link field (Raw Text Capture)
        if (pending.missing[0] === 'note') {
            enriched = { note: { value: text, raw: text, confidence: 1 } };
        } else if (pending.missing[0] === 'link') {
            const trimmed = text.trim();
            const isUrl = (trimmed.includes('.') && !trimmed.includes(' ')) || /^(http|https):\/\//i.test(trimmed);

            if (isUrl) {
                enriched = { link: { value: text, raw: text, confidence: 1 } };
                // CRITICAL FIX: Save immediately
                Object.assign(pending.filled, enriched);

                // Next step: Title
                pending.missing.unshift('link_title');

                setPending(chatId, pending);
                // Cleanup prev buttons
                if (pending.lastQuestionId) {
                    try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: pending.lastQuestionId }); } catch (e) { }
                    delete pending.lastQuestionId;
                }
                return askForMissing(bot, chatId, 'link_title', pending.intent, pending.filled);
            } else {
                // Invalid URL (and not skip, because skip is handled in A.5)
                await bot.sendMessage(chatId, '❌ Link gak valid (misal: google.com). Ketik "ga" atau "-" kalau mau skip.');
                return true; // Stop flow, ask user to retry
            }
        } else if (pending.missing[0] === 'link_title') {
            enriched = { link_title: { value: text, raw: text, confidence: 1 } };
        } else if (pending.missing[0] === 'add_more_links') {
            const trimmed = text.trim();
            const isUrl = (trimmed.includes('.') && !trimmed.includes(' ')) || /^(http|https):\/\//i.test(trimmed);

            // 1. Smart URL Check
            if (isUrl) {
                delete pending.filled.link;
                delete pending.filled.link_title;
                delete pending.filled.add_more_links;

                // Save new link
                pending.filled.link = { value: text, raw: text, confidence: 1 };

                // Loop state: Expecting Title next
                pending.missing.shift(); // Remove add_more_links
                pending.missing.unshift('link_title');

                setPending(chatId, pending);
                if (pending.lastQuestionId) {
                    try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: pending.lastQuestionId }); } catch (e) { }
                    delete pending.lastQuestionId;
                }
                return askForMissing(bot, chatId, 'link_title', pending.intent, pending.filled);
            }

            // 2. Normal Yes/No Check
            const lower = text.toLowerCase();
            const yesWords = ['ya', 'y', 'boleh', 'tambah', 'lagi', 'mau', 'lanjut', 'ada'];
            const val = yesWords.some(w => lower.includes(w)) ? 'yes' : 'no';

            if (val === 'yes') {
                // Cleanup buttons explicitly for text answer "Ya"
                if (pending.lastQuestionId) {
                    try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: pending.lastQuestionId }); } catch (e) { }
                    delete pending.lastQuestionId;
                }

                delete pending.filled.link;
                delete pending.filled.link_title;
                delete pending.filled.add_more_links;

                // Loop state: Expecting Link next
                pending.missing.shift();
                pending.missing.unshift('link');

                setPending(chatId, pending);
                if (pending.lastQuestionId) {
                    try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: pending.lastQuestionId }); } catch (e) { }
                    delete pending.lastQuestionId;
                }
                return askForMissing(bot, chatId, 'link', pending.intent, pending.filled);
            }

            enriched = { add_more_links: { value: val, raw: text, confidence: 1 } };
            // Cleanup buttons explicitly for text answer "No" or "Tidak"
            if (pending.lastQuestionId) {
                try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: pending.lastQuestionId }); } catch (e) { }
                delete pending.lastQuestionId;
            }
        } else {
            const result = await parseMessage(text);
            const entities = extractEntities(result.entities || {});
            enriched = enrichEntities(entities, text);
        }
        Object.assign(pending.filled, enriched);

        // INJECTION: If project_type is 'course', ensure 'matkul' is asked
        if (pending.filled.project_type) {
            const pType = pending.filled.project_type.value;
            if (pType === 'course' || pType === 'matkul') {
                // Fix: If 'matkul' is filled but value is just "matkul" (keyword), clear it so we ask properly
                if (pending.filled.matkul && pending.filled.matkul.raw.toLowerCase() === 'matkul') {
                    delete pending.filled.matkul;
                }

                // Force into missing queue at the front
                // Fix: Only inject/clear text if we are NOT already asking for matkul
                // If we are already asking (missing[0] === 'matkul'), the current text is the ANSWER, so don't clear it!
                if (!pending.filled.matkul && pending.missing[0] !== 'matkul') {
                    pending.missing = pending.missing.filter(f => f !== 'matkul');
                    pending.missing.unshift('matkul');

                    // Prevent Block E from using the "matkul" text to try filling the new 'matkul' field
                    // Only done if we JUST detected the project type in this turn (avoid clearing legitimate answers)
                    if (enriched.project_type) {
                        text = '';
                    }
                }
            }
        }

        // Cleanup: If the current missing field is now filled by NLP, remove buttons
        if (enriched[pending.missing[0]]) {
            if (pending.lastQuestionId) {
                try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: pending.lastQuestionId }); } catch (e) { }
                delete pending.lastQuestionId;
            }
        }
    }

    // E. Handle simple text answers (Fallback if NLP didn't catch the specific missing field)
    const missingField = pending.missing[0];
    console.log(`[NLP DEBUG Block E] missingField="${missingField}", text="${text}", enriched=${!!enriched[missingField]}`);
    if (pending.missing.length > 0 && text && !enriched[missingField]) {
        let value = text;
        let confidence = 1;

        // 1. Amount Parsing
        if (missingField === 'amount') {
            const amountMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta|m|milyar)?\b/i);
            if (amountMatch) {
                const parsed = parseAmount(amountMatch[0]);
                if (parsed > 0) value = parsed;
            }
        }

        // 2. Course Resolution (Matkul)
        else if (missingField === 'matkul') {
            const userData = getUserData(msg.from.id.toString());
            const courses = userData?.courses || [];
            console.log(`[NLP DEBUG Block E Matkul] ID=${msg.from.id.toString()}, courses=${courses.length}, text="${text}"`);
            const found = findCourse(text, courses);
            console.log(`[NLP DEBUG Block E Matkul] found=${found ? found.name : 'null'}`);

            if (found) {
                value = found.name;
                confidence = 1;
            } else {
                await bot.sendMessage(chatId, '❌ Matkul gak ketemu. Coba pilih dari tombol atau ketik nama yang bener.');
                return true;
            }
        }


        // 3. Task Type Normalization
        else if (missingField === 'tipe_tugas') {
            const normalized = normalizeTaskType(text);
            if (normalized) value = normalized;
        }


        // 4. Project Type Validation
        else if (missingField === 'project_type') {
            const lower = text.toLowerCase();
            if (lower.includes('personal') || lower.includes('pribadi') || lower.includes('sendiri')) {
                value = 'personal';
            } else if (lower.includes('matkul') || lower.includes('kuliah') || lower.includes('course')) {
                value = 'course';
                // Trigger Matkul Selection logic explicitly for text input
                if (!pending.filled.matkul && !pending.missing.includes('matkul')) {
                    pending.missing.unshift('matkul');
                }
            } else {
                // Invalid input for project type, re-ask
                return askForMissing(bot, chatId, missingField, pending.intent, pending.filled);
            }
        }

        // 5. Date Parsing (Waktu / Deadline)
        else if (missingField === 'waktu') {
            console.log(`[NLP DEBUG] Manual Date Parse for: "${text}"`);
            const parsedDate = parseDate(text);
            if (parsedDate) {
                console.log(`[NLP DEBUG] Parsed Date Success:`, parsedDate);
                // Format to YYYY-MM-DD or keep Date object?
                // The system seems to use Date object in 'parsed' field
                pending.filled['waktu'] = {
                    value: text,
                    raw: text,
                    parsed: parsedDate,
                    confidence: 1
                };
                // We manually set it here so we don't rely on 'value' assignment below for the complex object
                value = text;
            } else {
                console.log(`[NLP DEBUG] Parsed Date Failed (null).`);
            }
        }


        let fieldData = { value: value, raw: text, confidence };

        // Attach courseId if resolved (Text Input Case)
        if (missingField === 'matkul') {
            const userData = getUserData(msg.from.id.toString());
            const courses = userData?.courses || [];
            const resolved = findCourse(text, courses);
            if (resolved) {
                fieldData.value = resolved.name;
                fieldData.courseId = resolved.id;
            }
        }

        pending.filled[missingField] = fieldData;

        // Cleanup previous buttons (if any)
        if (pending.lastQuestionId) {
            console.log(`[NLP DEBUG] Cleaning up ID: ${pending.lastQuestionId}`);
            try {
                await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: pending.lastQuestionId });
            } catch (e) {
                // Ignore "message is not modified"
                if (!e.message.includes('message is not modified')) {
                    console.log('[NLP DEBUG] Cleanup Error:', e.message);
                }
            }
            delete pending.lastQuestionId;
        }
    }

    // E.5 Post-Processing Side Effects (Centralized)
    // Handle Link Title completion (from Block D or E)
    // Use pending.missing[0] because Block F hasn't run yet
    if (pending.missing[0] === 'link_title' && pending.filled.link_title && pending.filled.link) {
        if (!pending.links) pending.links = [];

        const titleVal = pending.filled.link_title.value || 'Ref Link';
        // Check duplicates?
        // pending.links.push({ url: pending.filled.link.value, title: titleVal });

        // Use the value from filled (which might be raw text or skipped empty string handled elsewhere, 
        // but if it's empty here, we default. Wait, A.5 handled Skip already)
        // This block handles the Text Input case.
        // In Text Input case, 'links' array is NOT updated yet.

        // Avoid double push if A.5 already did it? 
        // A.5 clears 'text' and loops, so it falls through to F. 
        // So this block won't execute for A.5 because 'text' is empty? 
        // Wait, this block is outside 'if (missingField...)'. It's standalone after E.
        // But A.5 managed 'missing' array (shifted link_title). 
        // So pending.missing[0] is 'add_more_links' (if A.5 ran).
        // So this block won't run for A.5. CORRECT.

        pending.links.push({ url: pending.filled.link.value, title: titleVal });
        pending.filled.links = { value: pending.links, raw: '', confidence: 1 };

        // Trigger Loop
        pending.missing.unshift('add_more_links');
    }

    // F. Re-check missing fields
    const stillMissing = pending.missing.filter(field => {
        const val = pending.filled[field];
        // Log status of each field
        // console.log(`[NLP DEBUG] Checking field ${field}:`, val);
        return !val || val.value === undefined || val.value === '';
    });

    if (stillMissing.length > 0) {
        console.log(`[NLP DEBUG] Still missing fields: ${stillMissing.join(', ')}`);
        pending.missing = stillMissing;
        setPending(chatId, pending);
        return askForMissing(bot, chatId, stillMissing[0], pending.intent, pending.filled);
    }

    // G. All fields complete - Trigger Confirmation
    pending.missing = [];
    pending.subState = 'confirmation';
    setPending(chatId, pending);
    return askForConfirmation(bot, chatId, pending.intent, pending.filled);
}

// ----------------------------------------------------
// Helper Functions (Top Level)
// ----------------------------------------------------

async function handleLowConfidence(bot, msg, text) {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, responses.lowConfidence(text));
    return true;
}

async function askForMissing(bot, chatId, field, intent, filled) {
    const message = responses.askField(field, intent, filled);
    const buttons = getFieldButtons(field, intent);

    let sentMsg;
    if (buttons) {
        sentMsg = await bot.sendMessage(chatId, message, {
            reply_markup: { inline_keyboard: buttons }
        });
    } else {
        sentMsg = await bot.sendMessage(chatId, message);
    }

    // Save message ID to cleanup buttons later
    updatePending(chatId, { lastQuestionId: sentMsg.message_id });
    return true;
}

async function askForConfirmation(bot, chatId, intent, data) {
    bot.sendChatAction(chatId, 'typing').catch(() => { }); // Enhance responsiveness perception
    console.log('[NLP DEBUG] askForConfirmation called for intent:', intent);
    let summary = `📝 *Konfirmasi Data*\n\n`;

    // Customize summary based on intent
    if (intent === 'tambah_pengeluaran' || intent === 'tambah_pemasukan') {
        const type = intent === 'tambah_pemasukan' ? 'Income 🟢' : 'Expense 🔴';
        const formattedAmount = data.amount?.value ? formatAmount(data.amount.value) : (data.amount || '0');
        const cat = data.kategori?.value || data.kategori || '-';

        summary += `Type: ${type}\n`;
        summary += `Nominal: ${formattedAmount}\n`;
        summary += `Kategori: ${cat}\n`;
        summary += `Note: ${data.note?.value || data.note || '-'}\n`;
    } else if (intent === 'buat_tugas') {
        // Task Summary
        const deadlineStr = data.waktu?.parsed
            ? data.waktu.parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
            : (data.waktu?.value || '-');

        summary += `📚 Matkul: ${data.matkul?.value || '-'}\n`;
        summary += `📝 Tipe: ${data.tipe_tugas?.value || '-'}\n`;
        summary += `📅 Deadline: ${deadlineStr}\n`;
        if (data.note?.value) summary += `📄 Note: ${data.note.value}\n`;

    } else if (intent === 'buat_project') {
        const deadlineStr = data.waktu?.parsed
            ? data.waktu.parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
            : (data.waktu?.value || '-');

        summary += `📌 Project: ${data.project?.value || '-'}\n`;
        summary += `📂 Type: ${data.project_type?.value || '-'}\n`;
        if (data.matkul?.value) summary += `🏫 Matkul: ${data.matkul.value}\n`;
        summary += `⚡ Priority: ${data.priority?.value || '-'}\n`;
        summary += `📅 Deadline: ${deadlineStr}\n`;
        if (data.note?.value) summary += `📄 Desc: ${data.note.value}\n`;
        // Show Links
        if (data.links && Array.isArray(data.links)) {
            data.links.forEach((l, i) => summary += `🔗 Link ${i + 1}: ${l.title} (${l.url})\n`);
        } else if (data.links?.value && Array.isArray(data.links.value)) {
            data.links.value.forEach((l, i) => summary += `🔗 Link ${i + 1}: ${l.title} (${l.url})\n`);
        } else {
            summary += `🔗 Link: ${data.link?.value === '-' ? '-' : (data.link?.value || '-')}\n`;
        }
    } else if (intent === 'catat_progress') {
        summary += `📌 Project: ${data.project?.value || 'Unknown'}\n`;
        summary += `📈 Progress: ${data.persentase?.value || '0'}%\n`;
        summary += `⏱️ Duration: ${data.duration?.value || '-'} menit\n`;
        summary += `📝 Note: ${data.note?.value || '-'}\n`;
    }

    summary += `\nSudah benar? (Ya/Tidak)`;

    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✅ Ya', callback_data: 'nlp_confirm_yes' },
                    { text: '❌ Batal', callback_data: 'nlp_confirm_no' }
                ]
            ]
        }
    };

    let sentMsg;
    try {
        console.log('[NLP DEBUG] Sending Confirmation Message...');
        sentMsg = await bot.sendMessage(chatId, summary, options);
        console.log('[NLP DEBUG] Confirmation Sent Successfully.');
    } catch (error) {
        console.error('[NLP DEBUG] Confirmation Send Error:', error.message);
        // Fallback if markdown error
        sentMsg = await bot.sendMessage(chatId, summary.replace(/\*/g, '').replace(/_/g, ''), { ...options, parse_mode: undefined });
    }

    // Save message ID to delete it later if cancelled
    updatePending(chatId, { confirmMessageId: sentMsg.message_id });
    return true;
}

async function executeConfirmedIntent(bot, msg, intent, entities, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // ============ AMBIGUITY CHECK ============
    // If Intent is Expense, check keywords implying Income (receive money)
    if (intent === 'tambah_pengeluaran') {
        const fullText = (msg.text || '').toLowerCase();
        // Keywords: dikasih, dapat, dapet, nemu, gajian, cair, transferan masuk
        const incomeKeywords = ['dikasih', 'dapat', 'dapet', 'nemu', 'gajian', 'cair', 'transferan'];
        if (incomeKeywords.some(kw => fullText.includes(kw))) {
            intent = 'tambah_pemasukan';
            console.log(`[NLP] Switched intent Expense -> Income due to keyword check.`);
        }
    }

    // Map entity values to simple Key-Value pair
    const data = {};
    for (const [key, val] of Object.entries(entities)) {
        data[key] = val?.value ?? val; // Simplifies value

        // Preserve rich data (courseId, parsed date)
        if (val && typeof val === 'object') {
            if (val.courseId) data.courseId = val.courseId;
            if (val.parsed) data.parsedDate = val.parsed;
        }
    }
    // ensure 'amount' is number if string
    if (data.amount && typeof data.amount === 'string') data.amount = parseAmount(data.amount);

    // Route to Handlers (Shared Logic)
    // Route to Handlers
    // 1. Transaction Handlers
    if (await handleTransactionIntent(bot, msg, intent, data, broadcastEvent)) return true;

    // 2. Task Handlers
    if (await handleTaskIntent(bot, msg, intent, data, broadcastEvent)) return true;

    // 3. Project Handlers
    if (await handleProjectIntent(bot, msg, intent, data, broadcastEvent)) return true;

    // 4. General Handlers
    if (await handleGeneralIntent(bot, msg, intent, data, broadcastEvent)) return true;

    // If no handler matched (and confidence was checked before), maybe log?
    return false;

}

// ============ Utility Functions ============

function isCancelKeyword(text) {
    const lower = text.toLowerCase();
    return CANCEL_KEYWORDS.some(kw => lower.includes(kw));
}

function isSkipKeyword(text) {
    if (!text) return false;
    const lower = text.trim().toLowerCase();
    return SKIP_KEYWORDS.some(kw => lower === kw || lower.includes(kw));
}


function detectMidFlowEdit(text, pending, userId) {
    const lower = text.toLowerCase();

    // 1. Check for Intent/Type Switching
    // Allow simple "tipe income", "ganti expense", "income"
    if (lower.includes('income') || lower.includes('pemasukan')) {
        return { type: 'intent', value: 'tambah_pemasukan' };
    }
    if (lower.includes('expense') || lower.includes('pengeluaran')) {
        return { type: 'intent', value: 'tambah_pengeluaran' };
    }

    // 1.5. CHECK FOR LINK EDITING (Project specific)
    const linkEditMatch = text.match(/link\s?(\d+)\s?(?:ganti|ubah|jadi|set|ke)?\s*(.+)/i);
    const titleEditMatch = text.match(/(?:judul|nama)\s?link\s?(\d+)\s?(?:ganti|ubah|jadi|set|ke)?\s*(.+)/i);

    if (titleEditMatch) {
        const index = parseInt(titleEditMatch[1]) - 1;
        const newTitle = titleEditMatch[2].trim();
        return { field: 'edit_link_title', value: { index, title: newTitle } };
    }
    if (linkEditMatch) {
        const index = parseInt(linkEditMatch[1]) - 1; // 0-indexed
        const newUrl = linkEditMatch[2].trim();
        return { field: 'edit_link', value: { index, url: newUrl } };
    }

    // 2. UNIVERSAL CONTEXT SWITCHING (Smart Scan)
    // We check if the text strongly matches ANY entity
    if (userId) {
        const potentialRaw = {};
        // Use our existing enrichers
        const potential = enrichEntities(potentialRaw, text, userId); // Base + Project + Transaction + Task
        // enriched now contains whatever was found

        // We need to filter out things that are NOT relevant or weak
        // Strategy: Only return if confidence is high or raw length is significant

        // Priority Ordered Check

        // A. Project Name (Strongest if matched)
        if (potential.project && potential.project.confidence >= 0.8) {
            // Only if we are not currently asking for project (or even if we are, maybe user is correcting it)
            return { field: 'project', value: potential.project };
        }

        // B. Date/Waktu
        if (potential.waktu) {
            // Date is tricky because "besok" might be part of a note
            // But if user says "deadline besok" or just "besok" when asked for something else, it's likely a switch
            return { field: 'waktu', value: potential.waktu };
        }

        // C. Amount (Money)
        if (potential.amount) {
            return { field: 'amount', value: potential.amount };
        }

        // D. Category
        if (potential.kategori && potential.kategori.confidence >= 0.8) {
            return { field: 'kategori', value: potential.kategori };
        }

        // E. Matkul (Course)
        if (potential.matkul) {
            return { field: 'matkul', value: potential.matkul };
        }

        // F. Task Type
        if (potential.tipe_tugas) {
            return { field: 'tipe_tugas', value: potential.tipe_tugas };
        }

        // G. Progress Specifics
        if (potential.persentase) return { field: 'persentase', value: potential.persentase };
        if (potential.duration) return { field: 'duration', value: potential.duration };

        // H. Project Type
        if (potential.project_type) {
            return { field: 'project_type', value: potential.project_type };
        }

        // I. Priority
        if (potential.priority) {
            return { field: 'priority', value: potential.priority };
        }
    }

    // 3. Explicit Command Fallback (e.g. "ganti note jadi ...")
    const noteMatch = text.match(/(?:note|catatan|keterangan)(?:\s+(?:nya|adalah))?[:\s]\s*(.+)/i);
    if (noteMatch) {
        return { field: 'note', value: { value: noteMatch[1], raw: noteMatch[1], confidence: 1 } };
    }

    return null; // No edit detected
}



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





// Helper to enrich Project specific entities
function enrichProjectSpecifics(enriched, rawText, userId) {
    // 1. Priority
    if (!enriched.priority) {
        if (/\b(urgent|penting|high|tinggi|darurat)\b/i.test(rawText)) enriched.priority = { value: 'high', raw: 'urgent', confidence: 0.9 };
        else if (/\b(santai|low|rendah|biasa)\b/i.test(rawText)) enriched.priority = { value: 'low', raw: 'santai', confidence: 0.9 };
        else if (/\b(sedang|medium|normal)\b/i.test(rawText)) enriched.priority = { value: 'medium', raw: 'medium', confidence: 0.9 };
    }

    // 2. Project Type (Explicit keywords)
    if (!enriched.project_type) {
        if (/\b(personal|pribadi|sendiri)\b/i.test(rawText)) {
            enriched.project_type = { value: 'personal', raw: 'personal', confidence: 0.9 };
        } else if (/\b(matkul|kuliah|kampus|course)\b/i.test(rawText)) {
            enriched.project_type = { value: 'course', raw: 'matkul', confidence: 0.9 };
        }
    }

    // 3. Project Title (Smart Extraction)
    // Pattern: "judul/judulnya/project" + [Capture] + delim
    if (!enriched.project) {
        // Look for explicit marker 'judul'/'nama' first
        let titleMatch = rawText.match(/(?:judul|nama)(?:nya)?(?:\s+adalah)?\s+(.+?)(?:\s+(?:deadline|tenggat|prioritas|tipe|kategori|urgent|penting|biasa|santai|matkul|kuliah|matakuliah|personal|detail|$))/i);

        // If not found, look for "project [Title]" but exclude keywords
        if (!titleMatch) {
            titleMatch = rawText.match(/(?:project|projek)\s+(?!personal|matkul|nih\b|ni\b|dong\b|deh\b|sih\b)(.+?)(?:\s+(?:deadline|tenggat|prioritas|tipe|kategori|urgent|penting|biasa|santai|matkul|kuliah|matakuliah|personal|detail|$))/i);
        }

        if (titleMatch) {
            let title = titleMatch[1].trim();
            // Cleanup: remove common stop words if captured
            title = title.replace(/^(buat|bikin)\s+/i, '');
            if (title) {
                enriched.project = { value: title, raw: title, confidence: 0.8 };
                console.log(`[NLP DEBUG] Smart Scan found project title: ${title}`);
            }
        }
    }

    // 4. Matkul (Project Context)
    // Only if not already found and not 'personal' (which implies no matkul)
    if (!enriched.matkul && enriched.project_type?.value !== 'personal') {
        const matkulMatch = rawText.match(/(?:matkul|kuliah|matakuliah)\s+(?!apa\b)(.+?)(?:\s+(?:deadline|tenggat|prioritas|tipe|kategori|urgent|penting|biasa|santai|judul|nama|$))/i);
        if (matkulMatch) {
            const query = matkulMatch[1].trim();
            try {
                // Fetch User Data to get courses
                const userData = getUserData(userId);
                const courses = userData?.courses || [];

                const found = findCourse(query, courses);

                if (found) {
                    enriched.matkul = { value: found.name, courseId: found.id, raw: query, confidence: 0.9 };
                    // Also infer project_type = course
                    if (!enriched.project_type) {
                        enriched.project_type = { value: 'course', raw: 'inferred', confidence: 0.9 };
                    }
                    console.log(`[NLP DEBUG] Smart Scan found matkul: ${found.name}`);
                }
            } catch (e) {
                console.log(`[NLP DEBUG] findCourse error in Smart Scan: ${e.message}`);
            }
        }
    }
}

function enrichEntities(entities, rawText, userId) { // rawText is needed for context if entities missing
    const enriched = { ...entities };
    if (enriched.number) {
        const amount = parseAmount(enriched.number.raw || enriched.number.value?.toString());
        enriched.amount = { value: amount, raw: enriched.number.raw, confidence: enriched.number.confidence };
    }

    // 1. DATE / TIMING
    // If 'waktu' missing, try to detect 'datetime' entity from Wit.ai/NLP first (sometimes mapped differently)
    if (!enriched.waktu && enriched.datetime) {
        enriched.waktu = enriched.datetime;
    }

    if (enriched.waktu) {
        const date = parseDate(enriched.waktu.raw || enriched.waktu.value);
        enriched.waktu = { ...enriched.waktu, parsed: date };
    } else {
        // Smart Scan for Date (e.g. "besok", "minggu depan")
        // Check if raw text contains evident date keywords
        const dateKeywords = ['besok', 'lusa', 'hari ini', 'minggu depan', 'bulan depan', 'jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
        const textLower = rawText.toLowerCase();
        if (dateKeywords.some(k => textLower.includes(k))) {
            const date = parseDate(rawText);
            // Validation: parseDate returns null or current date if failed? 
            // The existing parseDate implementation seems to return a Date object if matches found.
            // We assume it's robust based on previous logs.
            if (date) {
                // Use formatted date string as value instead of full rawText
                const dateStr = date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
                enriched.waktu = { value: dateStr, raw: rawText, parsed: date, confidence: 0.9 };
                console.log(`[NLP DEBUG] Smart Scan found date: ${date.toISOString()}`);
            }
        }
    }

    // 2. COURSE (Already handled in main loop mostly, but placeholder here)
    if (enriched.matkul) {
        // Kept for structure
    }

    // 3. TASK TYPE
    // If missing, scan for keywords
    if (!enriched.tipe_tugas) {
        const typeRegex = /\b(tugas|quiz|kuis|ujian|uts|uas|projek|project|laporan|lapres|lapen|lapsem|workshop)\b/i;
        const match = rawText.match(typeRegex);
        if (match) {
            enriched.tipe_tugas = { value: match[0], raw: match[0], confidence: 0.9 };
            console.log(`[NLP DEBUG] Smart Scan found task type: ${match[0]}`);
        }
    }

    // Normalize Task Type
    if (enriched.tipe_tugas) {
        const normalized = normalizeTaskType(enriched.tipe_tugas.value);
        if (normalized) {
            enriched.tipe_tugas = { value: normalized, raw: enriched.tipe_tugas.raw, confidence: 1 };
        }
    }

    // 4. PROJECT SPECIFICS
    enrichProjectSpecifics(enriched, rawText, userId);

    // 5. PROGRESS SPECIFICS
    enrichProgressSpecifics(enriched, rawText, userId);

    return enriched;
}

// Helper: Enrich Progress Specifics (Smart Extraction)
function enrichProgressSpecifics(enriched, text, userId) {
    if (!text) return;

    // A. Extract Persentase (e.g., 50%, 50 persen)
    if (!enriched.persentase) {
        // Fix: Remove \b after % because % is non-word, \b requires word/non-word boundary. 
        // 25% matches. 25%_ matches. 25%space matches.
        const pctMatch = text.match(/\b(\d+)\s*(%|persen|percent)/i);
        if (pctMatch) {
            let val = parseInt(pctMatch[1]);
            if (val >= 0 && val <= 100) {
                enriched.persentase = { value: val, raw: pctMatch[0], confidence: 1 };
            }
        }
    }

    // B. Extract Duration (e.g., 2 jam, 30 menit)
    if (!enriched.duration) {
        // Regex for duration: 2.5 jam, 30 menit, 1 h
        const durMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(jam|menit|hour|minute|h|m)\b/i);
        if (durMatch) {
            let num = parseFloat(durMatch[1].replace(',', '.'));
            let unit = durMatch[2].toLowerCase();
            let minutes = 0;

            if (unit.startsWith('j') || unit.startsWith('h')) {
                minutes = num * 60;
            } else {
                minutes = num;
            }

            if (minutes > 0) {
                enriched.duration = { value: Math.round(minutes), raw: durMatch[0], confidence: 1 };
            }
        }
    }

    // C. Extract Project (Fuzzy Match)
    // Only if not already found (Project specific helper might have found it too)
    if (!enriched.project && userId) {
        // Use findCourse-like logic but for projects
        // We need list of active projects. Since we don't have direct access here, 
        // we might need to rely on what `getUserData` provides or similar.
        // Assuming getUserData(userId) gives us access to projects.
        const userData = getUserData(userId);
        const activeProjects = (userData?.projects || []).filter(p => p.status !== 'completed'); // Only active

        if (activeProjects.length > 0) {
            // Simple heuristic directly in text
            // Sort projects by length (desc) to match longest triggers first
            // e.g. "Sistem Skripsi" > "Skripsi"
            const sorted = [...activeProjects].sort((a, b) => b.name.length - a.name.length);

            for (const p of sorted) {
                // Check exact name match or partial match if name is long
                const pName = p.name.toLowerCase();
                const textLower = text.toLowerCase();

                // 1. Direct inclusion
                if (textLower.includes(pName)) {
                    enriched.project = { value: p.name, raw: p.name, confidence: 1 };
                    break;
                }

                // 2. Acronym/Short name check (Optional - simple word match)
                // If project name is "Sistem Skripsi V2", and user says "skripsi" -> match
                const words = pName.split(/\s+/).filter(w => w.length > 3);
                const hasKeyword = words.some(w => textLower.includes(w));
                if (hasKeyword) {
                    enriched.project = { value: p.name, raw: p.name, confidence: 0.8 };
                    break;
                }
            }
        }
    }

    // D. Extract Note (Everything else)
    if (!enriched.note) {
        let cleanText = text;

        // Remove Duration
        if (enriched.duration?.raw) cleanText = cleanText.replace(enriched.duration.raw, '');
        // Remove Percent
        if (enriched.persentase?.raw) cleanText = cleanText.replace(enriched.persentase.raw, '');
        // Remove Project Name
        if (enriched.project?.value) {
            // Try to remove the matched part. Since we don't have 'raw' for project fuzzy match,
            // we try to remove the project name itself or words.
            // This is tricky. For now, let's just leave it or improve 'enriched.project' to have 'raw'.
            const words = enriched.project.value.toLowerCase().split(' ');
            words.forEach(w => {
                const reg = new RegExp(`\\b${w}\\b`, 'gi');
                cleanText = cleanText.replace(reg, '');
            });
        }

        // Remove intent keywords
        // Added 'catet'
        cleanText = cleanText.replace(/\b(catet|catat|progres|progress|lapor|update|log)\b/gi, '');

        // Cleanup
        cleanText = cleanText.replace(/\s+/g, ' ').trim();

        // If length > 3, assume it's a note
        if (cleanText.length > 3) {
            enriched.note = { value: cleanText, raw: cleanText, confidence: 0.8 };
        }
    }
}


// ============ Course Data Helper ============


const __filename_nlp = fileURLToPath(import.meta.url); // Avoid conflict with possible existing vars
const __dirname_nlp = path.dirname(__filename_nlp);

let cachedCourseButtons = null;
function getCourseButtons() {
    if (cachedCourseButtons) return cachedCourseButtons;

    try {
        // Path relative to: telegram-bot/src/nlp/nlp-handler.js
        // Target: st4cker/st4cker/entities/matkul.json (Based on user report: D:\Project\st4cker\st4cker\entities\matkul.json)
        // Path: ../../../st4cker/entities/matkul.json (if root is D:\Project\st4cker and folder is st4cker/st4cker/entities)

        // Let's try both common paths to be safe.
        let entityPath = path.resolve(__dirname_nlp, '../../../st4cker/entities/matkul.json');

        if (!fs.existsSync(entityPath)) {
            // Fallback to standard path if double-nested doesn't exist
            entityPath = path.resolve(__dirname_nlp, '../../../entities/matkul.json');
        }

        if (fs.existsSync(entityPath)) {
            console.log(`[NLP DEBUG] Loaded Course Buttons from: ${entityPath}`);
            const content = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
            if (content.keywords) {
                // Map to inline buttons (rows of 2)
                const buttons = [];
                let row = [];
                content.keywords.forEach(k => {
                    // Use clean title case for label
                    const label = k.keyword.charAt(0).toUpperCase() + k.keyword.slice(1);
                    row.push({ text: label, callback_data: `nlp_matkul_${k.keyword}` });
                    if (row.length === 2) {
                        buttons.push(row);
                        row = [];
                    }
                });
                if (row.length > 0) buttons.push(row);

                cachedCourseButtons = buttons;
            }
        } else {
            console.warn('[NLP] Course entity file not found at:', entityPath);
        }
    } catch (e) {
        console.error('[NLP] Failed to load course buttons:', e.message);
    }
    return cachedCourseButtons;
}

function logRawText(chatId, text) {
    console.log(`[NLP] ${chatId}: "${text}"`);
}

function getFieldButtons(field, intent) {
    switch (field) {
        case 'kategori':
            if (intent === 'tambah_pemasukan') {
                return [[
                    { text: '💸 Salary', callback_data: 'nlp_kategori_Salary' },
                    { text: '🏦 Transfer', callback_data: 'nlp_kategori_Transfer' }
                ]];
            }
            return [[
                { text: '🍔 Food', callback_data: 'nlp_kategori_Food' },
                { text: '🚗 Transport', callback_data: 'nlp_kategori_Transport' }
            ], [
                { text: '🛍️ Shopping', callback_data: 'nlp_kategori_Shopping' },
                { text: '📄 Bills', callback_data: 'nlp_kategori_Bills' }
            ], [
                { text: '📺 Subscription', callback_data: 'nlp_kategori_Subscription' },
                { text: '💸 Transfer', callback_data: 'nlp_kategori_Transfer' }
            ]];
        case 'priority':
            return [[
                { text: 'Low', callback_data: 'nlp_priority_Low' },
                { text: 'Medium', callback_data: 'nlp_priority_Medium' },
                { text: 'High', callback_data: 'nlp_priority_High' }
            ]];
        case 'project_type':
            return [[
                { text: '👤 Personal', callback_data: 'nlp_proj_personal' },
                { text: '🏫 Matkul', callback_data: 'nlp_proj_course' }
            ]];
        case 'matkul':
            return getCourseButtons();
        case 'add_more_links':
            return [[
                { text: '✅ Ya', callback_data: 'nlp_addlink_yes' },
                { text: '❌ Tidak', callback_data: 'nlp_addlink_no' }
            ]];
        default:
            return null;
    }
}

// Fallback Handlers
async function handleFallbackIntents(bot, msg, intent) {
    const chatId = msg.chat.id;
    if (intent === 'batalkan') await bot.sendMessage(chatId, responses.cancelled());
    else if (intent === 'bantuan') await bot.sendMessage(chatId, responses.help());
    else if (intent === 'casual') await bot.sendMessage(chatId, responses.casual());
    return true;
}

async function handleCekSaldo(bot, msg, entities) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    try {
        const userData = getUserData(userId);
        const balance = userData?.currentBalance || 0;
        await bot.sendMessage(chatId, `💰 Saldo kamu: *${formatAmount(balance)}*`, { parse_mode: 'Markdown' });
    } catch (e) { await bot.sendMessage(chatId, 'Gagal cek saldo.'); }
    return true;
}

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

// Handle Summary
async function handleSummary(bot, msg, entities, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const text = msg.text.toLowerCase();

    try {
        const userData = getUserData(userId);
        const summary = userData?.summary;

        if (!summary) {
            await bot.sendMessage(chatId, '⚠️ Data summary belum tersedia. Coba restart App Desktop & pastikan connect.');
            return true;
        }

        const formatRupiah = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);

        let title = '📊 **Summary Global**';
        let stats = summary.monthly; // Default to monthly if unspecified? Or All?
        // Actually "summary" usually implies general status.
        // Let's detect time keyword

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
            // Default "Summary" -> Show All 3?
            // "Ringkasan"
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

// Helpers for NLP callbacks
export async function handleNLPCallback(bot, query, broadcastEvent) {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const data = query.data;

    if (data.startsWith('nlp_kategori_')) {
        const val = data.replace('nlp_kategori_', '');
        updateSlotAndContinue(bot, chatId, userId, 'kategori', val, query.id, query.message.message_id, broadcastEvent);
        return;
    }
    if (data.startsWith('nlp_priority_')) {
        const val = data.replace('nlp_priority_', '');
        updateSlotAndContinue(bot, chatId, userId, 'priority', val, query.id, query.message.message_id, broadcastEvent);
        return;
    }
    // Project Type flow
    if (data.startsWith('nlp_proj_')) {
        const val = data.replace('nlp_proj_', '');
        updateSlotAndContinue(bot, chatId, userId, 'project_type', val, query.id, query.message.message_id, broadcastEvent);
        return;
    }
    // Matkul flow
    if (data.startsWith('nlp_matkul_')) {
        const val = data.replace('nlp_matkul_', '');
        // For buttons, the val is the keyword (e.g. 'webpro'). 
        // We can capitalize it for display or keep as is.
        updateSlotAndContinue(bot, chatId, userId, 'matkul', val, query.id, query.message.message_id, broadcastEvent);
        return;
    }
    // Add Link flow
    if (data.startsWith('nlp_addlink_')) {
        const val = data.replace('nlp_addlink_', ''); // 'yes' or 'no'

        // Handle "No" -> Just complete the field and continue (to confirmation)
        if (val === 'no') {
            // Explicit cleanup to be ultra-safe
            try { await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }); } catch (e) { }
            updateSlotAndContinue(bot, chatId, userId, 'add_more_links', 'no', query.id, query.message.message_id, broadcastEvent);
            return;
        }

        // Handle "Yes" -> Reset fields to loop back
        if (val === 'yes') {
            const pending = getPending(chatId);
            if (pending) {
                // Remove filled fields to restart loop
                delete pending.filled.link;
                delete pending.filled.link_title;
                delete pending.filled.add_more_links;

                // Add 'link' back to missing (at start)
                if (!pending.missing.includes('link')) {
                    pending.missing.unshift('link');
                }
                // Remove 'add_more_links' from missing if it's there (it shouldn't be, but safe check)
                pending.missing = pending.missing.filter(f => f !== 'add_more_links');

                setPending(chatId, pending);

                await bot.answerCallbackQuery(query.id, { text: 'Sip, tambah lagi.' }).catch(() => { });
                // Clear buttons
                bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id });

                // Ask for the next link
                await askForMissing(bot, chatId, 'link', pending.intent, pending.filled);
                return;
            }
        }
        return;
    }

    // Progress flow
    if (data.startsWith('nlp_progress_')) {
        const pid = data.replace('nlp_progress_', '');
        // For progress, we trigger "catat_progress" with project filled
        setPending(chatId, {
            intent: 'catat_progress',
            filled: { project: { value: pid } },
            missing: ['persentase', 'duration', 'note'],
            raw_text: ''
        });
        await bot.answerCallbackQuery(query.id);
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id });
        await askForMissing(bot, chatId, 'persentase', 'catat_progress', {});
        return;
    }

    // Confirm flow
    if (data === 'nlp_confirm_yes') {
        const pending = getPending(chatId);
        if (pending && pending.subState === 'confirmation') {
            clearPending(chatId);
            await bot.answerCallbackQuery(query.id, { text: 'Processing...' }).catch(() => { });
            bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id });
            const fakeMsg = { chat: { id: chatId }, from: { id: userId }, text: '' };
            return executeConfirmedIntent(bot, fakeMsg, pending.intent, pending.filled, broadcastEvent);
        }
    }
    if (data === 'nlp_confirm_no') {
        clearPending(chatId);
        await bot.answerCallbackQuery(query.id, { text: 'Cancelled' }).catch(() => { });

        // Delete the confirmation message to keep chat clean (consistent with "gajadi")
        try {
            await bot.deleteMessage(chatId, query.message.message_id);
        } catch (e) { console.log('[NLP] Failed to delete confirmation on button click', e.message); }

        await bot.sendMessage(chatId, responses.cancelled());
        return;
    }

    await bot.answerCallbackQuery(query.id).catch(() => { });
}

async function updateSlotAndContinue(bot, chatId, userId, field, value, callbackQueryId, messageId, broadcastEvent, rawValue = null) {
    const pending = getPending(chatId);
    if (!pending) {
        await bot.answerCallbackQuery(callbackQueryId, { text: 'Session expired.' });
        return;
    }

    // Cleanup buttons immediately
    try {
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
    } catch (e) { }

    const slotData = { value: value, raw: rawValue || value, confidence: 1 };

    // Resolve Course ID for 'matkul'
    if (field === 'matkul') {
        const userData = getUserData(userId);
        const courses = userData?.courses || [];
        const found = findCourse(value, courses);
        if (found) {
            slotData.value = found.name;
            slotData.courseId = found.id;
        }
    }

    pending.filled[field] = slotData;
    await bot.answerCallbackQuery(callbackQueryId).catch(() => { });

    // Inject 'matkul' if project_type becomes course
    if (field === 'project_type' && (value === 'course' || value === 'matkul')) {
        if (!pending.filled.matkul && !pending.missing.includes('matkul')) {
            pending.missing.unshift('matkul');
        }
    }

    // Remove current field from missing
    pending.missing = pending.missing.filter(f => f !== field);

    if (pending.missing.length > 0) {
        setPending(chatId, pending);
        return askForMissing(bot, chatId, pending.missing[0], pending.intent, pending.filled);
    }

    // All done -> Confirmation
    pending.missing = [];
    pending.subState = 'confirmation';
    setPending(chatId, pending);
    return askForConfirmation(bot, chatId, pending.intent, pending.filled);
}
