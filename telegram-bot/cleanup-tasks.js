import { db } from './src/db/index.js';
import { assignments } from './src/db/schema.js';
import { eq, or, like } from 'drizzle-orm';

async function cleanup() {
    console.log('Cleaning up assignments...');
    try {
        // Delete all assignments containing 'Basis Data' or 'Jarkom' (stale test data)
        const res = await db.delete(assignments).where(
            or(
                like(assignments.course, '%Basis Data%'),
                like(assignments.course, '%Jarkom%'),
                like(assignments.title, '%Basis Data%'),
                like(assignments.title, '%Jarkom%')
            )
        );
        console.log('Cleanup finished.');
        process.exit(0);
    } catch (e) {
        console.error('Cleanup failed:', e);
        process.exit(1);
    }
}

cleanup();
