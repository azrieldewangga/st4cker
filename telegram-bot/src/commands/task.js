import { getUserData, saveUserData } from '../store.js';
import { v4 as uuidv4 } from 'uuid';

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
function clearSession(userId) {
    commandSessions.delete(userId.toString());
}

// /task command - Add assignment with interactive menu
export function handleTaskCommand(bot, msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // Get user data from backend
    const userData = getUserData(userId);

    if (!userData || !userData.courses || userData.courses.length === 0) {
        bot.sendMessage(chatId, '❌ No courses found. Please sync your desktop app first:\n\n1. Open st4cker desktop\n2. Go to Settings → Telegram\n3. Make sure it\'s connected');
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

    bot.sendMessage(chatId, '📚 *Select Course:*', {
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
        bot.answerCallbackQuery(query.id, { text: 'Session expired. Please start again with /task' });
        return;
    }

    // Step 1: Course selected
    if (data.startsWith('task_course_')) {
        const courseId = data.replace('task_course_', '');
        const userData = getUserData(userId);
        const course = userData.courses.find(c => c.id === courseId);

        session.data.courseId = courseId;
        session.data.courseName = course.name;
        session.step = 'select_type';
        setSession(userId, session);

        // Show assignment types (dynamic from sync)
        const currentData = getUserData(userId);
        const types = currentData.assignmentTypes && currentData.assignmentTypes.length > 0
            ? currentData.assignmentTypes
            : ['Tugas', 'Laporan Pendahuluan', 'Laporan Sementara', 'Laporan Resmi']; // Fallback

        const keyboard = {
            inline_keyboard: types.map(type => [{
                text: type,
                callback_data: `task_type_${type}`
            }])
        };

        bot.editMessageText('📝 *Select Type:*', {
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

        bot.editMessageText(`📅 *Enter deadline:*\n\nExamples: tomorrow, 15 Jan, next Monday`, {
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
    const text = msg.text;

    const session = getSession(userId);
    if (!session || session.command !== 'task') return;

    // Step 3: Deadline entered
    if (session.step === 'enter_deadline') {
        try {
            const deadline = parseDate(text);
            session.data.deadline = deadline.toISOString();
            session.step = 'enter_notes';
            setSession(userId, session);

            bot.sendMessage(chatId, '📄 *Add notes?* (optional)\n\nType your notes or send /skip', {
                parse_mode: 'Markdown'
            });
        } catch (error) {
            bot.sendMessage(chatId, '❌ Invalid date format. Try: tomorrow, 15 Jan, or 2026-01-15');
        }
    }
    // Step 4: Notes entered or skipped
    else if (session.step === 'enter_notes') {
        const notes = text === '/skip' ? '' : text;
        session.data.notes = notes;

        // Create event
        const userData = getUserData(userId) || {};
        const semester = userData.semester || 'Semester 1';

        const event = {
            eventId: uuidv4(),
            eventType: 'task.created',
            telegramUserId: userId,
            timestamp: new Date().toISOString(),
            payload: {
                courseId: session.data.courseId,
                courseName: session.data.courseName,
                type: session.data.type,
                dueDate: session.data.deadline,
                notes: session.data.notes,
                completed: false,
                semester: semester
            },
            source: 'telegram'
        };

        // Broadcast event via WebSocket
        try {
            if (broadcastEvent) {
                broadcastEvent(userId, event);
            } else {
                console.error('[Task Command] broadcastEvent function is missing');
            }
        } catch (error) {
            console.error('[Task Command] Failed to broadcast event:', error);
        }

        // OPTIMISTIC UPDATE: Add to local cache immediately
        // This ensures /listtasks works even if desktop is offline
        try {
            const currentData = getUserData(userId);
            if (currentData) {
                if (!currentData.activeAssignments) currentData.activeAssignments = [];

                const newAssignment = {
                    id: event.payload.id || event.eventId, // Use eventId as fallback
                    title: session.data.type,
                    course: session.data.courseName,
                    type: session.data.type,
                    status: 'pending',
                    deadline: session.data.deadline,
                    note: session.data.notes,
                    semester: semester,
                    createdAt: new Date().toISOString()
                };

                currentData.activeAssignments.push(newAssignment);

                saveUserData(userId, currentData);
                console.log('[Task Command] Optimistically added task to local cache');
            }
        } catch (error) {
            console.error('[Task Command] Failed to update local cache:', error);
        }

        // Send confirmation
        const deadlineDate = new Date(session.data.deadline);
        const formattedDate = deadlineDate.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        bot.sendMessage(chatId, `✅ *Assignment created!*\n\n📚 Course: ${session.data.courseName}\n📝 Type: ${session.data.type}\n📅 Due: ${formattedDate}\n${notes ? `📄 Notes: ${notes}` : ''}\n\n_View in st4cker desktop app._`, {
            parse_mode: 'Markdown'
        });

        clearSession(userId);
    }
}

// Simple date parser (Indonesian + English)
function parseDate(dateString) {
    const now = new Date();
    const lower = dateString.toLowerCase().trim();

    // Today
    if (lower === 'today' || lower === 'hari ini') {
        const date = new Date(now);
        date.setHours(23, 59, 59, 999);
        return date;
    }

    // Tomorrow
    if (lower === 'tomorrow' || lower === 'besok') {
        const date = new Date(now);
        date.setDate(date.getDate() + 1);
        date.setHours(23, 59, 59, 999);
        return date;
    }

    // Pattern: 15 Feb or 15 February (without year)
    const dayMonthRegex = /^(\d{1,2})\s+([a-zA-Z]+)$/;
    const match = lower.match(dayMonthRegex);
    if (match) {
        const year = now.getFullYear();
        // Try current year first
        const withYear = `${match[1]} ${match[2]} ${year}`;
        let parsed = new Date(withYear);

        // If date is valid and in the past (more than a day ago), maybe they mean next year?
        if (!isNaN(parsed.getTime())) {
            if (parsed < new Date(now.getTime() - 86400000)) {
                parsed.setFullYear(year + 1);
            }
            parsed.setHours(23, 59, 59, 999);
            return parsed;
        }
    }

    // "next [day]" logic
    if (lower.startsWith('next ')) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDay = lower.replace('next ', '').trim();
        const dayIndex = days.indexOf(targetDay);
        if (dayIndex !== -1) {
            const date = new Date(now);
            date.setDate(date.getDate() + (dayIndex + 7 - date.getDay()) % 7 + 7); // +7 ensures next week
            date.setHours(23, 59, 59, 999);
            return date;
        }
    }

    // Fallback: Try parsing as is, but if year is 2001 (legacy default), fix it
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
        // Fix the weird 2001 default for "15 feb"
        if (parsed.getFullYear() === 2001) {
            parsed.setFullYear(now.getFullYear());
            // specific adjustment: 15 Feb 2001 -> 15 Feb 2026
        }
        parsed.setHours(23, 59, 59, 999);
        return parsed;
    }

    throw new Error('Invalid date');
}
