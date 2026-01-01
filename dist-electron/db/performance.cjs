"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performance = void 0;
const index_cjs_1 = require("./index.cjs");
exports.performance = {
    getSemesters: () => {
        const db = (0, index_cjs_1.getDB)();
        return db.prepare('SELECT * FROM performance_semesters ORDER BY semester ASC').all();
    },
    upsertSemester: (semester, ips) => {
        const db = (0, index_cjs_1.getDB)();
        const stmt = db.prepare(`
            INSERT INTO performance_semesters (semester, ips)
            VALUES (?, ?)
            ON CONFLICT(semester) DO UPDATE SET ips = excluded.ips
        `);
        stmt.run(semester, ips);
        return { semester, ips };
    },
    getCourses: (semester) => {
        const db = (0, index_cjs_1.getDB)();
        if (semester) {
            return db.prepare('SELECT * FROM performance_courses WHERE semester = ?').all(semester);
        }
        return db.prepare('SELECT * FROM performance_courses').all();
    },
    upsertCourse: (course) => {
        console.log('[DEBUG-DB] upsertCourse called with:', course);
        const db = (0, index_cjs_1.getDB)();
        const stmt = db.prepare(`
            INSERT INTO performance_courses (id, semester, name, sks, grade, location, lecturer, updatedAt)
            VALUES (@id, @semester, @name, @sks, @grade, @location, @lecturer, @updatedAt)
            ON CONFLICT(id) DO UPDATE SET 
                name = excluded.name,
                sks = excluded.sks,
                grade = excluded.grade,
                location = excluded.location,
                lecturer = excluded.lecturer,
                updatedAt = excluded.updatedAt
        `);
        stmt.run(course);
        console.log('[DEBUG-DB] upsertCourse success');
        return course;
    },
    updateSksOnly: (id, sks) => {
        const db = (0, index_cjs_1.getDB)();
        const stmt = db.prepare('UPDATE performance_courses SET sks = ? WHERE id = ?');
        stmt.run(sks, id);
        console.log(`[DEBUG-DB] updateSksOnly: ${id} -> ${sks} SKS`);
        return { id, sks };
    }
};
