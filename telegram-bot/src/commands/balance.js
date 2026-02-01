
import { DbService } from '../services/dbService.js';

// Handler for /balance command
export async function handleBalanceCommand(bot, msg) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;

    // Fetch user from DB
    const user = await DbService.getUser(userId);
    const balance = user?.currentBalance || 0;

    // Format to IDR
    const formatter = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    });

    const formattedBalance = formatter.format(balance);

    bot.sendMessage(chatId, `💰 *Current Balance:*\n${formattedBalance}`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📜 Lihat Riwayat', callback_data: 'list_tx_page_1' }]
            ]
        }
    });
}
