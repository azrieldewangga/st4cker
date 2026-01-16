import { getUserData } from '../store.js';

// Handler for /balance command
export function handleBalanceCommand(bot, msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;

    const userData = getUserData(userId);

    // Check if user has synced data
    if (!userData) {
        bot.sendMessage(chatId, '⚠️ Please sync your data from the properties desktop app first.');
        return;
    }

    const balance = userData.currentBalance;

    // Format to IDR
    const formatter = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    });

    const formattedBalance = formatter.format(balance || 0);

    bot.sendMessage(chatId, `💰 *Current Balance:*\n${formattedBalance}`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📜 Lihat Riwayat', callback_data: 'list_tx_page_1' }]
            ]
        }
    });
}
