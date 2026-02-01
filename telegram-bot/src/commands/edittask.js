
import { DbService } from '../services/dbService.js';
import crypto from 'crypto';

// Handler for /edittask command
export async function handleEditTaskCommand(bot, msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;

    const activeAssignments = await DbService.getTasks(userId);

    if (!activeAssignments || activeAssignments.length === 0) {
        bot.sendMessage(chatId, '📭 No active tasks to edit.');
        return;
    }

    // Limit to 10 most urgent tasks
    const tasks = activeAssignments.slice(0, 10);

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

// Handler for callback queries
export async function handleEditTaskCallback(bot, callbackQuery, broadcastEvent) {
    const { data, message } = callbackQuery;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id.toString();

    // 1. Task Selection
    if (data.startsWith('EDIT_TASK:')) {
        const taskId = data.split(':')[1];
        const task = await DbService.getTaskById(taskId);

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

        const result = await DbService.updateTask(taskId, { status: newStatus });

        if (result.success) {
            // Create Event
            const event = {
                eventId: crypto.randomUUID(),
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

            // Broadcast
            if (broadcastEvent) {
                broadcastEvent(userId, event);
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
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: 'Failed to update status.' });
        }
    }

    // 3. Cancel
    else if (data === 'CANCEL_EDIT') {
        try { bot.deleteMessage(chatId, message.message_id); } catch (e) { }
    }
}
