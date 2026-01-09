import { getUserData } from '../store.js';

export default async function handleListTasks(bot, msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;

    // Get user data
    const userData = getUserData(userId);
    if (!userData || !userData.activeAssignments || userData.activeAssignments.length === 0) {
        bot.sendMessage(chatId, '📭 No active tasks found.\nTip: Add a task with /task to get started!');
        return;
    }

    const assignments = userData.activeAssignments;
    const now = new Date();

    let message = '📋 **Your Tasks**\n\n';

    // Group by deadline urgency (Overdue vs Upcoming)
    const overdue = [];
    const upcoming = [];

    assignments.forEach(task => {
        const deadline = new Date(task.deadline);
        const isOverdue = deadline < now && (task.status !== 'completed' && task.status !== 'Done');

        const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
        const deadlineStr = deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

        let statusIcon = '⬜'; // To Do
        if (task.status === 'in-progress' || task.status === 'In Progress') statusIcon = '⏳';

        const item = {
            ...task,
            display: `${statusIcon} **[${task.course}]** ${task.title}\n📅 ${deadlineStr} (${diffDays > 0 ? diffDays + ' days left' : isOverdue ? 'Overdue!' : 'Today'})`
        };

        if (isOverdue) overdue.push(item);
        else upcoming.push(item);
    });

    // Render list
    if (overdue.length > 0) {
        message += '⚠️ **Overdue**\n';
        overdue.forEach(t => message += `${t.display}\n\n`);
    }

    if (upcoming.length > 0) {
        message += '📅 **Upcoming**\n';
        upcoming.forEach(t => message += `${t.display}\n\n`);
    }

    message += 'Use /edittask to change status.';

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}
