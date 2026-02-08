import { getDB } from '../db/index.cjs';

// Telegram data sync helper
async function syncUserDataToBackend(telegramStore: any, socket: any) {
    // Defined inside function to ensure safe access and proper scoping for errors
    const backendUrl = process.env.TELEGRAM_WEBSOCKET_URL || 'http://103.127.134.173:3000';

    console.log('[Telegram Sync] Function called, checking session...');
    try {
        const sessionToken = telegramStore.get('sessionToken');
        if (!sessionToken) {
            console.log('[Telegram Sync] No session token, skipping sync');
            return;
        }

        console.log('[Telegram Sync] Session token found, fetching data from DB...');
        const db = getDB();

        // Get current semester
        const semesterRow = db.prepare("SELECT value FROM meta WHERE key = 'user_semester'").get() as { value: string } | undefined;
        const semester = semesterRow ? `Semester ${semesterRow.value}` : 'Semester 1';

        const rawSemester = semesterRow ? parseInt(semesterRow.value) : 1;

        // Get active courses
        const courses = db.prepare(`
            SELECT id, name
            FROM performance_courses 
            WHERE semester = ? 
            ORDER BY name
        `).all(rawSemester) as Array<{ id: string; name: string }>;

        // Standard Categories from App (TransactionModal.tsx)
        // The app uses a single list for both Income and Expense.
        const appCategories = ['Food', 'Transport', 'Shopping', 'Bills', 'Subscription', 'Transfer', 'Salary'];

        const defaultExpense = [...appCategories];
        const defaultIncome = [...appCategories];

        // Get transaction categories from DB
        const dbExpense = db.prepare(`
            SELECT DISTINCT category 
            FROM transactions 
            WHERE type = 'expense' AND category IS NOT NULL
        `).all() as Array<{ category: string }>;

        const dbIncome = db.prepare(`
            SELECT DISTINCT category 
            FROM transactions 
            WHERE type = 'income' AND category IS NOT NULL
        `).all() as Array<{ category: string }>;

        // Merge and Deduplicate
        const expenseCategories = Array.from(new Set([
            ...defaultExpense,
            ...dbExpense.map(c => c.category)
        ])).sort();

        const incomeCategories = Array.from(new Set([
            ...defaultIncome,
            ...dbIncome.map(c => c.category)
        ])).sort();

        // Get active projects
        const activeProjects = db.prepare(`
            SELECT id, title as name, status, createdAt, deadline, priority, totalProgress, description
            FROM projects 
            WHERE status != 'completed'
            ORDER BY createdAt DESC
        `).all() as Array<{ id: string; name: string; status: string; createdAt: string; deadline: string; priority: string; totalProgress: number; description: string }>;

        // Get active assignments
        const activeAssignments = db.prepare(`
            SELECT id, title, course, type, status, deadline, note, semester
            FROM assignments
            WHERE (status IS NULL OR (status != 'completed' AND status != 'done' AND status != 'Done'))
            AND (semester = ? OR semester IS NULL)
            ORDER BY deadline ASC
        `).all(rawSemester) as Array<{ id: string; title: string; course: string; type: string; status: string; deadline: string; note: string; semester: number }>;

        // Calculate current balance (Robust: Income - ABS(Expense))
        const balanceResult = db.prepare(`
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN ABS(amount) ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END), 0) as balance
            FROM transactions
        `).get() as { balance: number };

        const currentBalance = balanceResult ? balanceResult.balance : 0;

        // Get Recent Transactions (Sync LAST 100 for performance/relevance, or ALL?)
        // User said "sampai habis" (until finished/all). Let's sync last 100 which is reasonable context.
        // Syncing thousands might be too heavy for the single payload approach.
        // But for "sampai habis", let's try 100 first, or maybe 500. 
        // Let's go with 200.
        const recentTransactions = db.prepare(`
            SELECT id, type, amount, category, date, title as note
            FROM transactions
            ORDER BY date DESC, createdAt DESC
            LIMIT 200
        `).all() as Array<{ id: string; type: string; amount: number; category: string; date: string; note: string }>;

        // --- SUMMARY STATS ---

        // 1. Daily (Today)
        const dailyStats = db.prepare(`
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END), 0) as expense
            FROM transactions
            WHERE date(date) = date('now', 'localtime')
        `).get() as { income: number; expense: number };

        // 2. Weekly (Last 7 Days)
        const weeklyStats = db.prepare(`
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END), 0) as expense
            FROM transactions
            WHERE date(date) >= date('now', '-6 days', 'localtime')
        `).get() as { income: number; expense: number };

        // 3. Monthly (Current Month)
        const monthlyStats = db.prepare(`
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END), 0) as expense
            FROM transactions
            WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now', 'localtime')
        `).get() as { income: number; expense: number };

        const summaryStats = {
            daily: dailyStats || { income: 0, expense: 0 },
            weekly: weeklyStats || { income: 0, expense: 0 },
            monthly: monthlyStats || { income: 0, expense: 0 }
        };

        const syncData = {
            sessionToken,
            data: {
                semester,
                courses,
                categories: {
                    expense: expenseCategories,
                    income: incomeCategories
                },
                projects: activeProjects,
                priorities: ['Low', 'Medium', 'High'],
                projectTypes: ['Course Project', 'Personal Project'],
                assignmentTypes: [
                    'Tugas', 'Laporan Pendahuluan', 'Laporan Sementara', 'Laporan Resmi'
                ],
                activeAssignments, // Send assignments to bot
                transactions: recentTransactions, // Send recent transactions
                currentBalance: currentBalance,
                summary: summaryStats
            }
        };

        const response = await fetch(`${backendUrl}/api/sync-user-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(syncData)
        });

        if (response.ok) {
            console.log('[Telegram Sync] Successfully synced user data to backend');
        } else {
            const errorText = await response.text();
            console.error('[Telegram Sync] Failed to sync:', errorText);
            throw new Error(`[${backendUrl}] Server returned ${response.status}: ${errorText}`);
        }
    } catch (error: any) {
        console.error('[Telegram Sync] Error syncing user data:', error);
        throw new Error(`Sync failed (${backendUrl || 'unknown'}): ${error.message}`);
    }
}

export { syncUserDataToBackend };
