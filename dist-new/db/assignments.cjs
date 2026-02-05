"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignments = void 0;
const index_cjs_1 = require("./index.cjs");
exports.assignments = {
    getAll: () => {
        const db = (0, index_cjs_1.getDB)();
        return db.prepare('SELECT * FROM assignments ORDER BY deadline ASC').all();
    },
    create: (assignment) => {
        const db = (0, index_cjs_1.getDB)();
        const stmt = db.prepare(`
            INSERT INTO assignments (id, title, course, type, status, deadline, note, semester, createdAt, updatedAt)
            VALUES (@id, @title, @course, @type, @status, @deadline, @note, @semester, @createdAt, @updatedAt)
        `);
        stmt.run(assignment);
        return assignment;
    },
    update: (id, data) => {
        const db = (0, index_cjs_1.getDB)();
        const sets = Object.keys(data).map(key => `${key} = @${key}`).join(', ');
        const stmt = db.prepare(`UPDATE assignments SET ${sets}, updatedAt = @updatedAt WHERE id = @id`);
        const info = stmt.run({ ...data, id, updatedAt: new Date().toISOString() });
        return info.changes > 0;
    },
    updateStatus: (id, status) => {
        const db = (0, index_cjs_1.getDB)();
        const stmt = db.prepare('UPDATE assignments SET status = ?, updatedAt = ? WHERE id = ?');
        const info = stmt.run(status, new Date().toISOString(), id);
        return info.changes > 0;
    },
    delete: (id) => {
        const db = (0, index_cjs_1.getDB)();
        const stmt = db.prepare('DELETE FROM assignments WHERE id = ?');
        const info = stmt.run(id);
        return info.changes > 0;
    }
};
