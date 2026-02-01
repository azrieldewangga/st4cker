
import { DbService } from './dbService.js';

/**
 * Service to fetch and format user history for LLM Context
 */
export class HistoryService {
    /**
     * Get formatted context string for a user
     * @param {string} userId - Telegram User ID
     * @returns {Promise<string>} Formatted context block
     */
    static async getContext(userId) {
        // Ensure user exists first
        const user = await DbService.getUser(userId);
        if (!user) return '';

        const balance = user.currentBalance || 0;

        // Fetch Data Parallelly
        const [transactions, tasks, projects] = await Promise.all([
            DbService.getTransactions(userId, 5),
            DbService.getTasks(userId),
            DbService.getProjects(userId)
        ]);

        // Improve Transaction Formatting
        const txStr = transactions
            .map(t => {
                const amt = t.amount ? Math.abs(t.amount).toLocaleString('id-ID') : '0';
                return `- ${t.category || t.title || 'Exp'}: Rp${amt} (${t.note || '-'})`;
            })
            .join('\n');

        // Improve Task Formatting
        // DbService.getTasks already filters pending and sorts by deadline
        const taskStr = tasks
            .slice(0, 3)
            .map(t => `- ${t.course || t.title}: ${t.type || 'Tugas'} (Deadline: ${t.deadline})`)
            .join('\n');

        // Projects
        const projStr = projects
            .slice(0, 3)
            .map(p => `- ${p.title} (${p.totalProgress || 0}%)`)
            .join('\n');

        return `
[USER CONTEXT]
💰 Current Balance: Rp${balance.toLocaleString('id-ID')}
📉 Recent Transactions:
${txStr || '(None)'}

📝 Active Tasks (Top 3):
${taskStr || '(None)'}

🚀 Active Projects:
${projStr || '(None)'}
`;
    }
}
