import { getDB } from '../db/index.cjs';

// Telegram data sync helper
async function syncUserDataToBackend(telegramStore: any, socket: any) {
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
            SELECT id, title as name, status, createdAt 
            FROM projects 
            WHERE status != 'completed'
            ORDER BY createdAt DESC
        `).all() as Array<{ id: string; name: string; status: string; createdAt: string }>;

        // Get active assignments
        const activeAssignments = db.prepare(`
            SELECT id, title, course, type, status, deadline, note, semester
            FROM assignments
            WHERE status != 'completed'
            ORDER BY deadline ASC
        `).all() as Array<{ id: string; title: string; course: string; type: string; status: string; deadline: string; note: string; semester: number }>;

        // Calculate current balance (Robust: Income - ABS(Expense))
        const balanceResult = db.prepare(`
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN ABS(amount) ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN type = 'expense' THEN ABS(amount) ELSE 0 END), 0) as balance
            FROM transactions
        `).get() as { balance: number };

        const currentBalance = balanceResult ? balanceResult.balance : 0;

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
                    'Tugas', 'Kuis', 'UTS', 'UAS', 'Project',
                    'Laporan Pendahuluan', 'Laporan Sementara', 'Laporan Resmi'
                ],
                activeAssignments, // Send assignments to bot
                currentBalance: currentBalance
            }
        };

        const backendUrl = process.env.TELEGRAM_WEBSOCKET_URL || 'https://elegant-heart-production.up.railway.app';
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
            throw new Error(`Server returned ${response.status}: ${errorText}`);
        }
    } catch (error) {
        console.error('[Telegram Sync] Error syncing user data:', error);
        throw error;
    }
}

export { syncUserDataToBackend };
