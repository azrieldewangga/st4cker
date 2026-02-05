"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.materials = void 0;
const index_cjs_1 = require("./index.cjs");
exports.materials = {
    getByCourse: (courseId) => {
        const db = (0, index_cjs_1.getDB)();
        return db.prepare('SELECT * FROM course_materials WHERE course_id = ? ORDER BY created_at DESC').all(courseId);
    },
    add: (id, courseId, type, title, url) => {
        const db = (0, index_cjs_1.getDB)();
        const stmt = db.prepare(`
            INSERT INTO course_materials (id, course_id, type, title, url, created_at)
            VALUES (@id, @courseId, @type, @title, @url, @createdAt)
        `);
        const newItem = {
            id,
            courseId,
            type,
            title,
            url,
            createdAt: new Date().toISOString()
        };
        stmt.run(newItem);
        return newItem;
    },
    delete: (id) => {
        const db = (0, index_cjs_1.getDB)();
        db.prepare('DELETE FROM course_materials WHERE id = ?').run(id);
        return true;
    }
};
