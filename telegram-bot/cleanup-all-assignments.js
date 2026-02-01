import { db } from './src/db/index.js';
import { assignments } from './src/db/schema.js';
import { eq } from 'drizzle-orm';

async function cleanupAllAssignments() {
    const userId = process.argv[2];

    if (!userId) {
        console.log('Usage: node cleanup-all-assignments.js <telegramUserId>');
        console.log('Example: node cleanup-all-assignments.js 1168825716');
        process.exit(1);
    }

    console.log(`Cleaning up all assignments for user ${userId}...`);
    try {
        const res = await db.delete(assignments).where(eq(assignments.userId, userId));
        console.log('All assignments deleted for user:', userId);
        process.exit(0);
    } catch (e) {
        console.error('Cleanup failed:', e);
        process.exit(1);
    }
}

cleanupAllAssignments();
