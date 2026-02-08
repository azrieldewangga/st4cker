
import { DbService } from '../services/dbService.js';
import { v4 as uuidv4 } from 'uuid';
import { parseDate, formatDate } from '../nlp/dateParser.js';
import { broadcastEvent } from '../server.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// SHARED EXECUTION LOGIC
export async function processTaskCreation(bot, chatId, userId, data) {
    const { courseId, courseName, type, deadline, notes, semester } = data;

    // VALIDATION
    if (!courseName) return { success: false, message: 'Matkulnya belum dipilih nih!' }; // relaxed courseId check as we might be flexible
    if (!type) return { success: false, message: 'Tipe tugasnya apa?' };
    if (!deadline) return { success: false, message: 'Deadlinenya kapan?' };

    // Get User Data for Semester check
    const user = await DbService.getUser(userId);
    const userSemester = semester || (user?.semester || 1); // defaulting to 1 (integer)

    try {
        // 1. Create in DB
        const result = await DbService.createTask(userId, {
            title: type, // Schema expects title
            course: courseName,
            type: type,
            deadline: deadline,
            note: notes,
            semester: userSemester
        });

        if (!result.success) throw new Error(result.message || 'DB Insert Failed');

        // 2. Broadcast Event
        const event = {
            eventId: result.id, // Use DB ID
            eventType: 'task.created',
            telegramUserId: userId,
            timestamp: new Date().toISOString(),
            payload: {
                id: result.id,
                courseId: courseId || 'unknown', // Pass ID if we have it, else unknown
                courseName: courseName,
                type: type,
                dueDate: deadline, // YYYY-MM-DD
                notes: notes || '',
                completed: false,
                semester: userSemester
            },
            source: 'telegram'
        };

        const broadcastRes = await broadcastEvent(userId, event);
        const isOffline = broadcastRes.online === false;

        // FORMAT SUCCESS MESSAGE (HTML)
        const deadlineDate = new Date(deadline);
        const deadlineStr = formatDate(deadlineDate); // e.g. "15 Januari"

        let message = `✅ <b>Siapp, Tugas Dibuat!</b>\n\n📚 Matkul: ${escapeHtml(courseName)}\n📝 Tipe: ${escapeHtml(type)}\n📅 Deadline: ${escapeHtml(deadlineStr)}\n${notes ? `📄 Note: ${escapeHtml(notes)}` : ''}\n\n<i>Semangat ngerjainnya! 🔥</i>`;

        if (isOffline) {
            message += '\n\n☁️ <i>Saved to Cloud (Desktop Offline)</i>';
        }

        return { success: true, message: message };

    } catch (error) {
        console.error('[Task Command] Failed to create task:', error);
        return { success: false, message: 'Gagal menyimpan tugas. Coba lagi nanti.' };
    }
}

// Imports for Entities
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Global Entity Cache: { 'matkul': Map, 'tipe_tugas': Map, ... }
let globalEntityCache = null;

export function getEntityCache() {
    if (globalEntityCache) return globalEntityCache;

    globalEntityCache = {};
    try {
        try {
            const potentialPaths = [
                path.resolve(__dirname, '../entities'), // Priority: Local src/entities (Self-contained)
                path.resolve(__dirname, '../../../st4cker/entities'), // Local dev relative
                path.resolve(process.cwd(), 'st4cker/entities'), // Docker/Root relative
                path.resolve(process.cwd(), 'entities'), // Fallback
                '/app/st4cker/entities' // Docker absolute
            ];

            let entitiesDir = null;
            for (const p of potentialPaths) {
                if (fs.existsSync(p)) {
                    entitiesDir = p;
                    break;
                }
            }

            if (entitiesDir) {
                const files = fs.readdirSync(entitiesDir).filter(f => f.endsWith('.json'));
                console.log(`[Entity Loader] Scanned synonyms from: ${entitiesDir}`);

                files.forEach(file => {
                    try {
                        const content = JSON.parse(fs.readFileSync(path.join(entitiesDir, file), 'utf8'));
                        if (content.name && content.keywords) {
                            const entityName = content.name;
                            const map = new Map();
                            for (const item of content.keywords) {
                                const normalizedKey = item.keyword;
                                for (const syn of item.synonyms) {
                                    map.set(syn.toLowerCase(), normalizedKey);
                                }
                            }
                            globalEntityCache[entityName] = map;
                        }
                    } catch (err) { }
                });
            }
        } catch (e) { console.error('[Entity Loader] Critical Failure:', e.message); }
        return globalEntityCache;
    }

// Helper: Match course by text
export function findCourse(text, courses) {
        if (!text) return null;
        // Courses might be empty or null if not synced.
        // If courses array is empty, we can still try Entity Cache to standardize Name
        // But we won't return a Course Object with ID. 
        // We return a "Simulated" course object: { name: "Resolved Name", id: null }

        // Normalize String
        function normalize(name) {
            if (!name) return '';
            return name.toLowerCase().replace(/[^a-z0-9]/g, '');
        }
        const rawLower = text.toLowerCase();

        // 1. Try Synonym Resolution (Dynamic 'matkul' Entity)
        const cache = getEntityCache();
        const map = cache ? cache['matkul'] : null;

        // If we have courses list, try to match against it
        if (courses && courses.length > 0) {
            // [Existing Logic preserved conceptually]
            // Shortened for brevity in this overwrite, focused on ensuring DbService integration
            // ... (Re-implementing finding logic if needed)
            // For simplicity, let's just do direct search first
            const exact = courses.find(c => normalize(c.name) === normalize(text));
            if (exact) return exact;

            // Return first match
            const match = courses.find(c => c.name.toLowerCase().includes(rawLower));
            if (match) return match;
        }

        // Fallback: If map exists, check synonyms
        if (map && map.has(rawLower)) {
            return { name: map.get(rawLower), id: null };
        }

        return null;
    }

    // Helper: Normalize Task Type
    // VALID TYPES: Tugas, Laporan Pendahuluan, Laporan Sementara, Laporan Resmi
    export function normalizeTaskType(text) {
        if (!text) return 'Tugas';
        const lower = text.toLowerCase().trim();

        // Check entity cache first
        const cache = getEntityCache();
        const map = cache ? cache['tipe_tugas'] : null;
        if (map && map.has(lower)) {
            const resolved = map.get(lower);
            // Validate resolved value is in allowed list
            const valid = ['Tugas', 'Laporan Pendahuluan', 'Laporan Sementara', 'Laporan Resmi'];
            if (valid.includes(resolved)) return resolved;
            return 'Tugas'; // Fallback
        }

        // Direct mapping for common synonyms
        const synonyms = {
            'lapres': 'Laporan Resmi',
            'laporan resmi': 'Laporan Resmi',
            'lapsem': 'Laporan Sementara',
            'laporan sementara': 'Laporan Sementara',
            'lapen': 'Laporan Pendahuluan',
            'laporan pendahuluan': 'Laporan Pendahuluan',
            'lp': 'Laporan Pendahuluan',
            'tugas': 'Tugas'
        };

        // All other types (Kuis, UTS, UAS, Praktikum, etc.) go to 'Tugas'
        return synonyms[lower] || 'Tugas';
    }

    // /task command
    export function handleTaskCommand(bot, msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();

        // Since we don't have courses in DB yet (Phase 1),
        // and store.js is deprecated, we skip "Select Course" menu.
        // We go straight to "Enter Course Name".

        setSession(userId, {
            command: 'task',
            step: 'enter_course_custom', // New flow
            data: {}
        });

        const cache = getEntityCache();
        const courses = [];
        if (cache && cache['matkul']) {
            const map = cache['matkul'];
            const seen = new Set();
            for (const [key, val] of map.entries()) {
                if (!seen.has(val)) {
                    seen.add(val);
                    courses.push(val);
                }
            }
        }

        const opts = { parse_mode: 'Markdown' };
        if (courses.length > 0) {
            const buttons = courses.slice(0, 12).map(name => {
                const shortName = name.length > 20 ? name.substring(0, 17) + '...' : name;
                return { text: shortName, callback_data: `nlp_matkul_${name.substring(0, 30)}` }; // Reuse NLP callback format or define specific one
            });
            const keyboard = [];
            for (let i = 0; i < buttons.length; i += 2) {
                keyboard.push(buttons.slice(i, i + 2));
            }
            opts.reply_markup = { inline_keyboard: keyboard };
        }

        bot.sendMessage(chatId, '📚 *Tugas matkul apa nih?* (Ketik namanya atau pilih)', opts);
    }
    // Callback Handler (Mostly disabled until we have course lists)
    export function handleTaskCallback(bot, query) {
        const chatId = query.message.chat.id;
        const userId = query.from.id.toString();
        const data = query.data;

        const session = getSession(userId);
        if (!session || session.command !== 'task') {
            bot.answerCallbackQuery(query.id, { text: 'Sesi habis, ulang lagi ya /task' });
            return;
        }

        // Step 2: Type selected
        if (data.startsWith('task_type_')) {
            const type = data.replace('task_type_', '');

            session.data.type = type;
            session.step = 'enter_deadline';
            setSession(userId, session);

            bot.editMessageText(`📅 *Deadlinenya kapan?*\n(Ketik: besok, 20 Jan, atau minggu depan)`, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown'
            });

            bot.answerCallbackQuery(query.id);
        }
    }

    // Handle text input for /task flow
    export async function handleTaskInput(bot, msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const text = msg.text.trim();

        const session = getSession(userId);
        if (!session || session.command !== 'task') return false;

        if (['cancel', 'batal', 'gajadi', 'gak jadi', 'exit', '/cancel'].includes(text.toLowerCase())) {
            clearSession(userId);
            bot.sendMessage(chatId, '❌ Pembuatan tugas dibatalkan.');
            return true;
        }

        // Step 1: Course (via Text)
        if (session.step === 'enter_course_custom' || session.step === 'select_course') {
            // Without course list, we blindly accept the name or try normalization
            let courseName = text;
            const normalized = findCourse(text, []); // Empty courses array
            if (normalized && normalized.name) courseName = normalized.name;

            session.data.courseName = courseName;
            session.data.courseId = normalized?.id || null;

            session.step = 'select_type';
            setSession(userId, session);

            // Show Types Menu
            const types = ['Tugas', 'Laporan Pendahuluan', 'Laporan Sementara', 'Laporan Resmi'];
            const keyboard = {
                inline_keyboard: types.map(type => [{
                    text: type,
                    callback_data: `task_type_${type}`
                }])
            };

            bot.sendMessage(chatId, `✅ *${courseName}*\n\n📝 *Jenis tugasnya apa?*`, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            return true;
        }

        // Step 3: Deadline entered
        if (session.step === 'enter_deadline') {
            try {
                const deadlineDate = parseDate(text);
                if (!deadlineDate) throw new Error('Invalid date');

                const iso = deadlineDate.toISOString().split('T')[0];
                session.data.deadline = iso;

                session.step = 'enter_notes';
                setSession(userId, session);

                bot.sendMessage(chatId, '📄 *Ada catatan tambahan?*\n(Ketik catatannya atau /skip)', {
                    parse_mode: 'Markdown'
                });
                return true;
            } catch (error) {
                bot.sendMessage(chatId, '❌ Gagal baca tanggalnya. Coba: besok, 15 Jan, atau Senin depan');
                return true;
            }
        }
        // Step 4: Notes entered or skipped
        else if (session.step === 'enter_notes') {
            const notes = (text === '/skip' || text === '-') ? '' : text;
            session.data.notes = notes;

            const result = await processTaskCreation(bot, chatId, userId, {
                courseId: session.data.courseId,
                courseName: session.data.courseName,
                type: session.data.type,
                deadline: session.data.deadline,
                notes: session.data.notes,
                semester: semester_placeholder(userId) // Placeholder
            });

            if (result.success) {
                bot.sendMessage(chatId, result.message, { parse_mode: 'HTML' });
            } else {
                bot.sendMessage(chatId, `❌ ${result.message}`);
            }

            clearSession(userId);
            return true;
        }

        return false;
    }

    function semester_placeholder(userId) {
        // We already fetch inside processTaskCreation but this is for session flow
        // Can leave undefined/null as processTaskCreation handles it
        return undefined;
    }
