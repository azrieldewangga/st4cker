import { getUserData, saveUserData } from '../store.js';

// Handler for /edittask command
export function handleEditTaskCommand(bot, msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;

    const userData = getUserData(userId);
    if (!userData || !userData.activeAssignments || userData.activeAssignments.length === 0) {
        bot.sendMessage(chatId, '📭 No active tasks to edit.');
        return;
    }

    // Limit to 10 most urgent tasks to avoid hitting message limits
    // Pagination could be added later
    const tasks = userData.activeAssignments.slice(0, 10);

    const inlineKeyboard = tasks.map(task => ([{
        text: `[${task.course}] ${task.title} (${task.status})`,
        callback_data: `EDIT_TASK:${task.id}`
    }]));

    bot.sendMessage(chatId, '✏️ **Select a task to update status:**', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: inlineKeyboard
        }
    });
}

// Handler for callback queries (button clicks)
export function handleEditTaskCallback(bot, callbackQuery, broadcastEvent) {
    const { data, message } = callbackQuery;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id.toString();

    // 1. Task Selection
    if (data.startsWith('EDIT_TASK:')) {
        const taskId = data.split(':')[1];

        // Check if task still exists
        const userData = getUserData(userId);
        const task = userData?.activeAssignments?.find(t => t.id === taskId);

        if (!task) {
            bot.answerCallbackQuery(callbackQuery.id, { text: 'Task not found or deleted.' });
            return;
        }

        // Show Status Options
        const statusOptions = [
            [{ text: '⬜ To Do', callback_data: `SET_STATUS:${taskId}:pending` }],
            [{ text: '⏳ In Progress', callback_data: `SET_STATUS:${taskId}:in-progress` }],
            [{ text: '✅ Done', callback_data: `SET_STATUS:${taskId}:completed` }],
            [{ text: '🔙 Cancel', callback_data: 'CANCEL_EDIT' }]
        ];

        bot.editMessageText(`📝 **Editing: ${task.title}**\nCurrent Status: ${task.status}\n\nSelect new status:`, {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: statusOptions }
        });

        bot.answerCallbackQuery(callbackQuery.id);
    }

    // 2. Status Update
    else if (data.startsWith('SET_STATUS:')) {
        const [_, taskId, newStatus] = data.split(':');

        // Create Event
        const event = {
            eventId: crypto.randomUUID(), // Node 19+ or import uuid
            eventType: 'task.updated',
            telegramUserId: userId,
            timestamp: new Date().toISOString(),
            payload: {
                id: taskId,
                status: newStatus,
                updatedAt: new Date().toISOString()
            },
            source: 'telegram'
        };

        // Broadcast (Offline Supported via Server Queue)
        if (broadcastEvent) {
            broadcastEvent(userId, event);
        }

        // Optimistic UI Update & Local Cache Update
        try {
            const userData = getUserData(userId);
            if (userData && userData.activeAssignments) {
                const taskIndex = userData.activeAssignments.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                    userData.activeAssignments[taskIndex].status = newStatus;

                    saveUserData(userId, userData);
                    console.log('[EditTask] Optimistically updated task status in local cache');
                }
            }
        } catch (error) {
            console.error('[EditTask] Failed to update local cache:', error);
        }

        const statusMap = {
            'pending': 'To Do',
            'in-progress': 'In Progress',
            'completed': 'Done'
        };

        bot.editMessageText(`✅ **Status Updated!**\nTask marked as: **${statusMap[newStatus]}**`, {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'Markdown'
        });

        bot.answerCallbackQuery(callbackQuery.id, { text: 'Status updated!' });
    }

    // 3. Cancel
    else if (data === 'CANCEL_EDIT') {
        bot.deleteMessage(chatId, message.message_id);
    }
}

// Polyfill randomUUID if needed (for older Node versions on Railway)
import crypto from 'crypto';
if (!crypto.randomUUID) {
    crypto.randomUUID = () => '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}
