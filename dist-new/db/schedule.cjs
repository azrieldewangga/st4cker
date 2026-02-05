"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedule = void 0;
const index_cjs_1 = require("./index.cjs");
exports.schedule = {
    getAll: () => {
        const db = (0, index_cjs_1.getDB)();
        return db.prepare('SELECT * FROM schedule_items').all();
    },
    upsert: (item) => {
        const db = (0, index_cjs_1.getDB)();
        console.log('[DEBUG-DB] Upserting Schedule Item:', item);
        const stmt = db.prepare(`
            INSERT INTO schedule_items (id, day, startTime, endTime, course, location, lecturer, note, updatedAt)
            VALUES (@id, @day, @startTime, @endTime, @course, @location, @lecturer, @note, @updatedAt)
            ON CONFLICT(id) DO UPDATE SET
                day = excluded.day,
                startTime = excluded.startTime,
                endTime = excluded.endTime,
                course = excluded.course,
                location = excluded.location,
                lecturer = excluded.lecturer,
                note = excluded.note,
                updatedAt = excluded.updatedAt
        `);
        stmt.run(item);
        return item;
    }
};
