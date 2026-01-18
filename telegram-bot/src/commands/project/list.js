import { getUserData } from '../../store.js';
import { PAGE_SIZE, STATUS_ICONS, PRIORITY_ICONS } from './constants.js';

export async function processListProjects(bot, chatId, userId, page = 1, mode = 'view') {
    const userData = getUserData(userId);

    if (!userData || !userData.projects || userData.projects.length === 0) {
        return bot.sendMessage(chatId, '📂 *Belum ada Project*\n\nKetik /project buat bikin baru!', { parse_mode: 'Markdown' });
    }

    // Filter Active Only
    const activeProjects = userData.projects
        .filter(p => p.status !== 'completed')
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline)); // Sort by deadline

    if (activeProjects.length === 0) {
        return bot.sendMessage(chatId, '✅ *Semua Project Selesai!*\n\nSantai dulu bang 😎', { parse_mode: 'Markdown' });
    }

    // Pagination
    const totalPages = Math.ceil(activeProjects.length / PAGE_SIZE);

    // Adjust page if out of bounds
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const items = activeProjects.slice(start, end);

    let titleInfo = '📂 **Active Projects**';
    if (mode === 'delete') titleInfo = '🗑️ **Hapus Project** (Pilih nomor)';
    if (mode === 'edit') titleInfo = '✏️ **Edit Project** (Pilih nomor)';

    let response = `${titleInfo} (${activeProjects.length}) - Page ${page}/${totalPages}\n\n`;

    const inlineKeyboard = [];

    items.forEach((proj, idx) => {
        const realIdx = start + idx + 1;
        const daysLeft = Math.ceil((new Date(proj.deadline) - new Date()) / (1000 * 60 * 60 * 24));
        const statusIcon = proj.status === 'in_progress' ? STATUS_ICONS.in_progress : STATUS_ICONS.on_hold;

        // Priority Icon
        let prioIcon = PRIORITY_ICONS[proj.priority] || '';

        response += `${realIdx}. ${statusIcon} **${proj.name}**\n`;
        response += `   📊 ${proj.totalProgress || 0}% | ${prioIcon} ${proj.priority}\n`;
        response += `   📅 ${proj.deadline} (${daysLeft > 0 ? daysLeft + ' hari lagi' : 'OVERDUE ⚠️'})\n\n`;

        // Buttons based on Mode
        if (mode === 'view') {
            inlineKeyboard.push([{
                text: `📝 Log: ${proj.name}`,
                callback_data: `log_proj_${proj.id}`
            }]);
        } else if (mode === 'delete') {
            inlineKeyboard.push([{
                text: `❌ Hapus ${realIdx}`,
                callback_data: `del_proj_${proj.id}`
            }]);
        } else if (mode === 'edit') {
            inlineKeyboard.push([{
                text: `✏️ Edit ${realIdx}`,
                callback_data: `edit_proj_${proj.id}`
            }]);
        }
    });

    // Pagination Buttons
    const navRow = [];
    const modeSuffix = mode === 'view' ? '' : `_mode=${mode}`;
    if (page > 1) navRow.push({ text: '⬅️ Prev', callback_data: `list_proj_page_${page - 1}${modeSuffix}` });
    if (page < totalPages) navRow.push({ text: 'Next ➡️', callback_data: `list_proj_page_${page + 1}${modeSuffix}` });

    if (navRow.length > 0) inlineKeyboard.push(navRow);

    // Cancel / Back Button for Action Modes
    if (mode !== 'view') {
        inlineKeyboard.push([{ text: '🔙 Kembali / Selesai', callback_data: 'cancel_proj_action' }]);
    }

    bot.sendMessage(chatId, response, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: inlineKeyboard
        }
    });
}
