import { getUserData, saveUserData } from '../store.js';
import { v4 as uuidv4 } from 'uuid';
import { parseDate, formatDate } from '../nlp/dateParser.js';

// Store command sessions (in-memory, could move to DB for persistence)
const commandSessions = new Map();

// Helper: Get user's active session
function getSession(userId) {
    return commandSessions.get(userId.toString());
}

// Helper: Set user session
function setSession(userId, data) {
    commandSessions.set(userId.toString(), data);
}

// Helper: Clear user session
export function clearSession(userId) {
    commandSessions.delete(userId.toString());
}

// SHARED EXECUTION LOGIC
export async function processTaskCreation(bot, chatId, userId, data, broadcastEvent) {
    const { courseId, courseName, type, deadline, notes, semester } = data;

    // VALIDATION
    if (!courseId) return { success: false, message: 'Matkulnya belum dipilih nih!' };
    if (!type) return { success: false, message: 'Tipe tugasnya apa?' };
    if (!deadline) return { success: false, message: 'Deadlinenya kapan?' };

    // Get User Data for Semester check
    const currentUserData = getUserData(userId);
    const userSemester = semester || (currentUserData?.semester || 'Semester 1');

    const event = {
        eventId: uuidv4(),
        eventType: 'task.created',
        telegramUserId: userId,
        timestamp: new Date().toISOString(),
        payload: {
            courseId: courseId,
            courseName: courseName,
            type: type,
            dueDate: deadline, // YYYY-MM-DD
            notes: notes || '',
            completed: false,
            semester: userSemester
        },
        source: 'telegram'
    };

    // Broadcast
    let isOffline = false;
    try {
        if (broadcastEvent) {
            const result = broadcastEvent(userId, event);
            if (result && result.online === false) isOffline = true;
        } else {
            console.error('[Task Command] broadcastEvent function is missing');
            return { success: false, message: 'Yah, gagal konek ke server. Coba lagi nanti ya!' };
        }
    } catch (error) {
        console.error('[Task Command] Failed to broadcast event:', error);
        return { success: false, message: 'Gagal kirim data ke app desktop nih.' };
    }

    // OPTIMISTIC UPDATE
    try {
        const currentData = getUserData(userId);
        if (currentData) {
            if (!currentData.activeAssignments) currentData.activeAssignments = [];

            const newAssignment = {
                id: event.payload.id || event.eventId,
                title: type, // Fallback title
                course: courseName,
                type: type,
                status: 'pending',
                deadline: deadline,
                note: notes,
                semester: userSemester,
                createdAt: new Date().toISOString()
            };

            currentData.activeAssignments.push(newAssignment);
            saveUserData(userId, currentData);
            console.log('[Task Command] Optimistically added task to local cache');
        }
    } catch (error) {
        console.error('[Task Command] Failed to update local cache:', error);
    }

    // FORMAT SUCCESS MESSAGE
    const deadlineDate = new Date(deadline);
    const deadlineStr = formatDate(deadlineDate); // e.g. "15 Januari"

    let message = `✅ *Siapp, Tugas Dibuat!*\n\n📚 Matkul: ${courseName}\n📝 Tipe: ${type}\n📅 Deadline: ${deadlineStr}\n${notes ? `📄 Note: ${notes}` : ''}\n\n_Semangat ngerjainnya! 🔥_`;

    if (isOffline) {
        message += '\n\n☁️ _Saved to Cloud (Desktop Offline)_';
    }

    return { success: true, message: message };
}

// Helper: Match course by text
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load synonyms from Wit.ai entity file
let synonymMap = null;
function getSynonymMap() {
    if (synonymMap) return synonymMap;
    synonymMap = new Map();
    try {
        // Path to st4cker/entities/matkul.json
        // From telegram-bot/src/commands to st4cker/entities
        // Path: ../../../st4cker/entities/matkul.json
        const entityPath = path.resolve(__dirname, '../../../st4cker/entities/matkul.json');
        console.log(`[Task] Loading synonyms from: ${entityPath}`);

        if (fs.existsSync(entityPath)) {
            const content = JSON.parse(fs.readFileSync(entityPath, 'utf8'));
            if (content.keywords) {
                for (const item of content.keywords) {
                    const normalizedKey = item.keyword.toLowerCase();
                    for (const syn of item.synonyms) {
                        synonymMap.set(syn.toLowerCase(), normalizedKey);
                    }
                }
            }
            console.log(`[Task] Loaded ${synonymMap.size} synonyms.`);
        } else {
            console.warn(`[Task] Synonym file not found at: ${entityPath}`);
        }
    } catch (e) {
        console.error('[Task] Failed to load course synonyms:', e.message);
    }
    return synonymMap;
}

// Helper: Match course by text
export function findCourse(text, courses) {
    if (!text) return null;
    if (!courses || courses.length === 0) {
        console.warn('[findCourse] No courses provided to search against.');
        return null;
    }

    // Helper: Normalize String for comparison
    function normalize(name) {
        if (!name) return '';
        return name.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    const query = normalize(text);
    const rawLower = text.toLowerCase();

    // Debugging: Show available courses and query
    console.log(`[findCourse DEBUG] Query: "${text}" (norm: "${query}")`);
    console.log(`[findCourse DEBUG] User Courses: ${courses.map(c => c.name).join(', ')}`);

    // 1. Try Synonym Resolution (Wit.ai) - Direct & Scanning
    const map = getSynonymMap();
    if (map) {
        if (map.size === 0) console.warn('[findCourse] Synonym map is empty!');

        // A. Direct Match
        if (map.has(rawLower)) {
            const resolvedName = normalize(map.get(rawLower));
            // console.log(`[findCourse] Direct Synonym found: "${rawLower}" -> "${resolvedName}"`);

            // Find course by normalized name
            const exact = courses.find(c => normalize(c.name) === resolvedName);
            if (exact) {
                // console.log(`[findCourse] >> MATCHED Course: ${exact.name}`);
                return exact;
            } else {
                // Fuzzy fallback on resolved name
                const fuzzy = courses.find(c => normalize(c.name).includes(resolvedName));
                if (fuzzy) return fuzzy;
            }
        }

        // B. Scanning Match (Find synonym IN text)
        const sortedKeys = Array.from(map.keys()).sort((a, b) => b.length - a.length);
        for (const key of sortedKeys) {
            if (key.length < 4) {
                // Word boundary for short keys
                if (new RegExp(`\\b${key}\\b`, 'i').test(rawLower)) {
                    const resolvedName = normalize(map.get(key));
                    const match = courses.find(c => normalize(c.name) === resolvedName);
                    if (match) return match;

                    // Fuzzy fallback
                    const fuzzyMatch = courses.find(c => normalize(c.name).includes(resolvedName));
                    if (fuzzyMatch) return fuzzyMatch;
                }
            } else {
                if (rawLower.includes(key)) {
                    const resolvedName = normalize(map.get(key));
                    const match = courses.find(c => normalize(c.name) === resolvedName);
                    if (match) return match;

                    // Fuzzy fallback
                    const fuzzyMatch = courses.find(c => normalize(c.name).includes(resolvedName));
                    if (fuzzyMatch) return fuzzyMatch;
                }
            }
        }
    } else {
        console.warn('[findCourse] Synonym map failed to load.');
    }

    // 2. Exact Name Match
    const exact = courses.find(c => normalize(c.name) === query);
    if (exact) return exact;

    // 3. Scan for Full Course Name in Text
    const nameMatch = courses.find(c => rawLower.includes(c.name.toLowerCase()));
    if (nameMatch) {
        console.log(`[findCourse] Name found in text: ${nameMatch.name}`);
        return nameMatch;
    }

    // 4. Smart Acronym Matching
    const acronymHelper = (name, skipStopWords = false) => {
        let words = name.toLowerCase().split(/[^a-z0-9]+/);
        if (skipStopWords) {
            const stopWords = ['dan', 'and', '&', 'of', 'the', 'praktikum', 'workshop', 'teori', 'pengantar'];
            words = words.filter(w => !stopWords.includes(w));
        }
        return words.map(w => w[0]).join('');
    };

    const acronym = courses.find(c => {
        const acroStandard = acronymHelper(c.name, false);
        // Only valid if query is the acronym exactly (not scanning, risky for 2-3 chars)
        if (acroStandard === query) return true;

        const acroSmart = acronymHelper(c.name, true);
        if (acroSmart === query) return true;

        return false;
    });
    if (acronym) return acronym;

    return null;
}


// Helper: Normalize Task Type (Synonyms)
export function normalizeTaskType(text) {
    if (!text) return null;
    const lower = text.toLowerCase().trim();

    const synonyms = {
        'lapres': 'Laporan Resmi',
        'lapsem': 'Laporan Sementara',
        'lapen': 'Laporan Pendahuluan',
        'lp': 'Laporan Pendahuluan', // Keep legacy support just in case
        'prak': 'Praktikum',
        'praktikum': 'Praktikum',
        'quiz': 'Kuis',
        'kuis': 'Kuis',
        'uts': 'UTS',
        'uas': 'UAS',
        'projek': 'Project',
        'project': 'Project',
        'tugas': 'Tugas',
        'presentasi': 'Presentasi'
    };

    return synonyms[lower] || null; // Return mapped value or null (if null, use original text potentially)
}


// /task command - Add assignment with interactive menu
export function handleTaskCommand(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // Get user data from backend
    const userData = getUserData(userId);

    if (!userData || !userData.courses || userData.courses.length === 0) {
        bot.sendMessage(chatId, '❌ Belum ada matkul nih. Sync dulu ya ke desktop app!');
        return;
    }

    // Initialize session
    setSession(userId, {
        command: 'task',
        step: 'select_course',
        data: {}
    });

    // Create inline keyboard with courses
    const keyboard = {
        inline_keyboard: userData.courses.map(course => [{
            text: course.name,
            callback_data: `task_course_${course.id}`
        }])
    };

    bot.sendMessage(chatId, '📚 *Tugas matkul apa nih?* (Pilih atau ketik namanya)', {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

// Handle callback queries for /task flow
export function handleTaskCallback(bot, query) {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const data = query.data;

    const session = getSession(userId);
    if (!session || session.command !== 'task') {
        bot.answerCallbackQuery(query.id, { text: 'Sesi habis, ulang lagi ya /task' });
        return;
    }

    // Step 1: Course selected
    if (data.startsWith('task_course_')) {
        const courseId = data.replace('task_course_', '');
        const userData = getUserData(userId);
        const course = userData.courses.find(c => c.id === courseId);

        if (!course) {
            bot.answerCallbackQuery(query.id, { text: 'Course not found' });
            return;
        }

        session.data.courseId = courseId;
        session.data.courseName = course.name;
        session.step = 'select_type';
        setSession(userId, session);

        // Show assignment types (dynamic from sync)
        const types = userData.assignmentTypes && userData.assignmentTypes.length > 0
            ? userData.assignmentTypes
            : ['Tugas', 'Laporan Pendahuluan', 'Laporan Sementara', 'Laporan Resmi']; // Fallback

        const keyboard = {
            inline_keyboard: types.map(type => [{
                text: type,
                callback_data: `task_type_${type}`
            }])
        };

        bot.editMessageText(`📚 Matkul: ${course.name}\n\n📝 *Jenis tugasnya apa?*`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });

        bot.answerCallbackQuery(query.id);
    }
    // Step 2: Type selected
    else if (data.startsWith('task_type_')) {
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
export async function handleTaskInput(bot, msg, broadcastEvent) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const text = msg.text.trim();

    const session = getSession(userId);
    if (!session || session.command !== 'task') return false;

    // Check for cancellation
    if (['cancel', 'batal', 'gajadi', 'gak jadi', 'exit', '/cancel'].includes(text.toLowerCase())) {
        clearSession(userId);
        bot.sendMessage(chatId, '❌ Pembuatan tugas dibatalkan.');
        return true;
    }

    // Step 1: Course (via Text)
    if (session.step === 'select_course') {
        const userData = getUserData(userId);
        if (!userData || !userData.courses) return false;

        const course = findCourse(text, userData.courses);
        if (course) {
            session.data.courseId = course.id;
            session.data.courseName = course.name;
            session.step = 'select_type';
            setSession(userId, session);

            const types = userData.assignmentTypes && userData.assignmentTypes.length > 0
                ? userData.assignmentTypes
                : ['Tugas', 'Laporan Pendahuluan', 'Laporan Sementara', 'Laporan Resmi'];

            const keyboard = {
                inline_keyboard: types.map(type => [{
                    text: type,
                    callback_data: `task_type_${type}`
                }])
            };

            bot.sendMessage(chatId, `✅ *${course.name}*\n\n📝 *Jenis tugasnya apa?*`, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            return true;
        } else {
            bot.sendMessage(chatId, '❌ Waduh, matkul itu gak ketemu. Coba ketik yang bener atau pilih tombol ya.');
            return true;
        }
    }

    // Step 3: Deadline entered
    if (session.step === 'enter_deadline') {
        try {
            const deadlineDate = parseDate(text);
            if (!deadlineDate) throw new Error('Invalid date');

            // Store YYYY-MM-DD
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

        const userData = getUserData(userId);
        const result = await processTaskCreation(bot, chatId, userId, {
            courseId: session.data.courseId,
            courseName: session.data.courseName,
            type: session.data.type,
            deadline: session.data.deadline,
            notes: session.data.notes,
            semester: userData?.semester
        }, broadcastEvent);

        if (result.success) {
            bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, `❌ ${result.message}`);
        }

        clearSession(userId);
        return true;
    }

    return false;
}
