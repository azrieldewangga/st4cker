import { getDB } from './index.cjs';

export const schedule = {
    getAll: () => {
        const db = getDB();
        return db.prepare('SELECT * FROM schedule_items').all();
    },

    upsert: (item: any) => {
        const db = getDB();
        console.log('[DEBUG-DB] Upserting Schedule Item:', item);
        const stmt = db.prepare(`
            INSERT INTO schedule_items (id, day, startTime, endTime, course, location, lecturer, note, semester, updatedAt)
            VALUES (@id, @day, @startTime, @endTime, @course, @location, @lecturer, @note, @semester, @updatedAt)
            ON CONFLICT(id) DO UPDATE SET
                day = excluded.day,
                startTime = excluded.startTime,
                endTime = excluded.endTime,
                course = excluded.course,
                location = excluded.location,
                lecturer = excluded.lecturer,
                note = excluded.note,
                semester = excluded.semester,
                updatedAt = excluded.updatedAt
        `);
        stmt.run(item);
        return item;
    }
};
