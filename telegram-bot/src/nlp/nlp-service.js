
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HistoryService } from '../services/historyService.js';
import { OpenClawService } from '../services/openClawService.js';

dotenv.config();

let genAI = null;
let model = null;

// Throttle mechanism for rate limiting (Traffic Smoothing)
let lastCallTime = 0;
const THROTTLE_MS = 1500; // 1.5 second cooldown between any Gemini API calls

/**
 * Wait for cooldown to ensure traffic smoothing
 */
async function waitForThrottle() {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    if (timeSinceLastCall < THROTTLE_MS) {
        const waitTime = THROTTLE_MS - timeSinceLastCall;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastCallTime = Date.now();
}

/**
 * Truncated Exponential Backoff with Jitter
 */
async function retryWithBackoff(fn, maxRetries = 5) {
    let retries = 0;
    while (retries <= maxRetries) {
        try {
            await waitForThrottle();
            return await fn();
        } catch (e) {
            const isRateLimit = e.status === 429 || e.toString().includes('429') || e.toString().includes('Quota');
            const isNetworkError = e.message.includes('fetch failed') || e.message.includes('network');

            if (isRateLimit || isNetworkError) {
                retries++;
                if (retries > maxRetries) throw e;

                // Initial 1s, 2x multiplier, plus jitter (0-1000ms)
                // Using Math.min to cap the delay if needed (truncated)
                const baseDelay = (Math.pow(2, retries - 1) * 1000);
                const jitter = Math.random() * 1000;
                const delay = Math.min(baseDelay + jitter, 30000); // Cap at 30s

                console.warn(`⚠️ [NLP] ${isRateLimit ? 'Rate Limit (429)' : 'Network Error'} detected. Retrying in ${Math.round(delay)}ms... (Attempt ${retries}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw e; // If not retryable, throw immediately
        }
    }
}

export async function initNLP() {
    if (!process.env.GEMINI_API_KEY) {
        console.error('❌ [NLP] GEMINI_API_KEY is missing in .env');
        return;
    }

    // Gunakan API Key dari project
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    model = genAI.getGenerativeModel({
        // Gunakan model 2.0 Flash (Confirmed Available via list-models.js)
        model: "gemini-2.0-flash",

        // Pakai Response MIME Type agar output PASTI JSON murni
        generationConfig: {
            responseMimeType: "application/json",
        },
    });
    console.log('✅ [NLP] Gemini 1.5 Flash Connected with JSON Mode');
}

export function getManager() {
    return model;
}

// Helper to generate Prompt with DYNAMIC Date & Corpus
async function getSystemPrompt(userId = null) {
    // Current date in WIB (UTC+7)
    const now = new Date();
    const today = now.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const time = now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });

    // Get History Context
    const userContext = userId ? await HistoryService.getContext(userId) : '';

    return `
    Role: You are St4cker, a smart and helpful financial assistant / student companion bot.
    Task: Analyze the user's message and extract data into a structured JSON format.

Current Date: ${today}
Current Time: ${time}
    (YYYY - MM - DD Reference: ${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })})

${userContext}

Supported Intents:
    // TASK
    - buat_tugas (Keywords: tugas, pr, kuis, lapres, tubes, deadline, ... jam ...) -> Action: Adding a new item to the list.
    - lihat_tugas (Keywords: list, daftar, ada apa aja, cek tugas, tampilkan) -> Action: Querying existing items.
    - edit_tugas (Keywords: edit tugas, ganti deadline tugas, ubah tugas)
    - hapus_tugas (Keywords: hapus tugas, delete tugas, cancel tugas)
    
    // PROJECT
    - buat_project (Keywords: project baru, bikin projek, ada project) -> Action: Creating.
    - lihat_project (Keywords: list, daftar, ada apa aja, project apa) -> Action: Querying.
    - edit_project (Keywords: edit project, ganti priority project, ubah project)
    - hapus_project (Keywords: hapus project, delete project)
    - catat_progress (Keywords: progress, update project, kerjain, log progress)
    
    // TRANSACTION
    - tambah_pengeluaran (Keywords: beli, bayar, jajan, habis, expense, ...rb, keluar)
    - tambah_pemasukan (Keywords: gaji, transfer masuk, dapet duit, income, pemasukan)
    - lihat_transaksi (Keywords: history, riwayat transaksi, pengeluaran kemarin)
    - edit_transaksi (Keywords: edit transaksi, ganti nominal, ubah transaksi)
    - hapus_transaksi (Keywords: hapus transaksi, delete transaksi)
    - cek_saldo (Keywords: saldo, balance, uang berapa, sisa uang)
    
    // SUMMARY & HELP
    - minta_summary (Keywords: summary, rekap, rangkuman, laporan hari ini)
    - bantuan (Keywords: help, bantuan, cara pakai, gimana caranya)
    
    // META
    - casual (Greetings, small talk, questions not related to above)
    - batalkan (Keywords: ga jadi, cancel, batal)
    - konfirmasi_positif (Keywords: ya, benar, benerr, gas, mantap, yoi, sikat, lanjut, oke, sip)
    - konfirmasi_negatif (Keywords: tidak, bukan, salah, ga jadi, cancel, skip, enggak, no)

    Rules:
    - CATEGORY MAPPING (STRICT):
        - Food: makan, minum, jajan, kopi, snack
        - Transport: bensin, ojek, parkir, tol
        - Shopping: beli baju, skincare, barang
        - Bills: listrik, air, pulsa, kuota
        - Subscription: netflix, spotify, youtube
        - Transfer: kirim uang, bayar utang, invest
        - Salary: gaji, bonus, dapet duit, income, pemasukan
    - TRANSACTION RULES:
        - For tambah_pengeluaran/tambah_pemasukan, extract 'item' as the specific thing bought/paid.
        - Example: "beli kopi 15rb" -> item="kopi", kategori="Food", amount=15000
        - The 'item' field should be specific.
    - PROJECT RULES:
        - Extract 'priority' if user mentions: "penting", "urgent", "santai", "high", "low".
        - Extract 'link' if user mentions URL (http/https).
        - Extract 'note' as Project Description if user provides details.
    - If user says "15rb", convert to 15000.
    - Resolve relative dates based on Current Date above.
    - 'tipe_tugas' MUST be short formatted label (Tugas, Kuis, Praktikum, Laporan Resmi).

    MATKUL REFERENCE (Studi Kasus):
    - KJK: Keamanan Jaringan dan Kriptografi
    - KB, Komber: Komputasi Bergerak
    - PJ, Pemjar: Pemrograman Jaringan
    - PPL: Pengembangan Perangkat Lunak
    - Sister: Sistem Terdistribusi
    - SPK, WSPK: Workshop Sistem Pendukung Keputusan

Return ONLY the JSON object.
    `;
}

export async function parseMessage(text, userId = null) {
    if (!model) await initNLP();
    if (!text) return { intents: [], entities: {} };

    try {
        // SMART ROUTING LOGIC (OpenClaw vs Internal)
        // ------------------------------------------

        const lowerText = text.toLowerCase();

        // 1. Heavy Tasks -> OpenClaw (Pro)
        const heavyKeywords = ['coding', 'buatkan kode', 'python', 'script', 'pdf', 'analisis', 'review jurnal', 'deep dive', 'debug'];
        if (process.env.OPENCLAW_ENDPOINT && heavyKeywords.some(w => lowerText.includes(w))) {
            console.log('[NLP] Routing to OpenClaw (PRO Model)...');
            const clawResponse = await OpenClawService.sendPrompt(text, 'pro');
            if (clawResponse) {
                return {
                    intents: [{ name: 'openclaw_response', confidence: 1.0 }],
                    entities: { response: [{ value: clawResponse }] }
                };
            }
        }

        // 2. Light Tasks -> OpenClaw (Flash)
        const lightKeywords = ['cari', 'search', 'googling', 'cuaca', 'berita', 'siapa itu', 'summary url', 'rangkum link'];
        if (process.env.OPENCLAW_ENDPOINT && lightKeywords.some(w => lowerText.includes(w))) {
            console.log('[NLP] Routing to OpenClaw (FLASH/Skill)...');
            const clawResponse = await OpenClawService.sendPrompt(text, 'flash');
            if (clawResponse) {
                return {
                    intents: [{ name: 'openclaw_response', confidence: 1.0 }],
                    entities: { response: [{ value: clawResponse }] }
                };
            }
        }

        // 3. Fallback / Internal St4cker Logic
        return await retryWithBackoff(async () => {
            const systemPrompt = await getSystemPrompt(userId);
            const dynamicPrompt = `${systemPrompt} \n\nUser Message: "${text}"`;

            const result = await model.generateContent(dynamicPrompt);
            const response = await result.response;
            const responseText = response.text();
            console.log(`[NLP] Input: "${text}"`);
            console.log(`[NLP] Raw Response: ${responseText}`);
            const data = JSON.parse(responseText);

            // If data.entities exists, flatten it into the main data object
            if (data.entities) {
                for (const [key, value] of Object.entries(data.entities)) {
                    data[key] = value;
                }
                delete data.entities; // Remove the original entities object
            }

            // Sanitize Intent (Remove "12. " prefix if exists)
            let parsedIntent = data.intent || 'casual';
            if (typeof parsedIntent === 'string') {
                parsedIntent = parsedIntent.replace(/^\d+\.\s*/, '').trim();
            }

            const entities = {};
            for (const [key, value] of Object.entries(data)) {
                if (key === 'intent' || key === 'confidence' || value === null || value === undefined) continue;
                entities[key] = [{ value: value, raw: value.toString(), confidence: 1.0 }];
            }

            return {
                intents: [{ name: parsedIntent, confidence: data.confidence || 0.9 }],
                entities: entities
            };
        });
    } catch (e) {
        console.error(`❌ [NLP] Gemini Parse Error after retries:`, e.message);
        if (e.status === 429 || e.toString().includes('429')) {
            return { intents: [{ name: 'api_limit', confidence: 1.0 }], entities: {} };
        }
        return { intents: [{ name: 'error', confidence: 0.0 }], entities: {} };
    }
}

// Keep export for compatibility
export function extractEntities(entities) {
    return entities;
}

/**
 * Generate casual/chat reply using Gemini (Phase 2 - Personality)
 */
export async function generateCasualReply(userText, userId = null) {
    if (!model) await initNLP();
    if (!userText) return 'Haii 👋';

    try {
        return await retryWithBackoff(async () => {
            const chatModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const context = userId ? await HistoryService.getContext(userId) : '';

            const prompt = `
Kamu adalah St4cker, asisten virtual yang friendly, sarkas dikit, dan sangat suportif sama mahasiswa.
Personality:
- Gunakan bahasa Indonesia gaul (gue/lo atau aku/kamu tergantung user, tapi defaultnya friendly casual).
- Kalau saldo menipis, ingatkan hemat.
- Kalau tugas banyak, kasih semangat.
- Keep responses SHORT (max 2 kalimat).
${context}

User bilang: "${userText}"

Reply (friendly & helpful):`;

            const result = await chatModel.generateContent(prompt);
            const response = await result.response;
            let reply = response.text().trim();
            reply = reply.replace(/^["']|["']$/g, '').replace(/\*\*/g, '');

            return reply || 'Haii 👋';
        });
    } catch (e) {
        console.error('[NLP] Casual reply error after retries:', e.message);
        return 'Haii 👋';
    }
}


/**
 * Generate dynamic response for any action (Phase 2 - Full Personality)
 * With throttling to avoid rate limits
 */
export async function generateDynamicResponse(actionType, data = {}) {
    // Friendly template fallbacks
    const templates = {
        task_created: `Siapp! Tugas ${data.type || ''} ${data.courseName || ''} deadline ${data.deadline || ''} udah dicatet~ 📝`,
        task_empty: `Santai dulu, belum ada tugas aktif 😎`,
        transaction_added: `Oke! ${data.type === 'income' ? 'Pemasukan' : 'Pengeluaran'} ${data.note || ''} Rp${data.amount?.toLocaleString('id-ID') || 0} tercatat ✅`,
        project_created: `Project "${data.title || ''}" siap dilacak! 🚀`,
        progress_logged: `Nice! Progress ${data.projectName || 'project'} sekarang ${data.progress || 0}% 💪`,
        balance_check: `💰 Saldo kamu: Rp${data.balance?.toLocaleString('id-ID') || 0}`,
        deleted: `${data.type || 'Item'} udah dihapus~ ✅`
    };

    const friendlyTemplate = templates[actionType] || 'Done! ✅';

    if (!genAI) await initNLP();

    try {
        return await retryWithBackoff(async () => {
            const chatModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const prompt = `
Kamu adalah St4cker, asisten virtual yang friendly.
Ubah pesan berikut jadi lebih friendly dan natural (1-2 kalimat, boleh tambah emoji):

Pesan: "${friendlyTemplate}"

Output (friendly, natural, PENDEK):`;

            const result = await chatModel.generateContent(prompt);
            const response = await result.response;
            let reply = response.text().trim();
            reply = reply.replace(/^["']|["']$/g, '').replace(/\*\*/g, '');

            return reply || friendlyTemplate;
        });
    } catch (e) {
        console.error('[NLP] Dynamic response error after retries:', e.message);
        return friendlyTemplate;
    }
}
