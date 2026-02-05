"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projects = void 0;
const index_cjs_1 = require("./index.cjs");
const crypto_1 = require("crypto");
exports.projects = {
    // Get all projects
    getAll: () => {
        const db = (0, index_cjs_1.getDB)();
        return db.prepare('SELECT * FROM projects ORDER BY deadline ASC').all();
    },
    // Get project by ID
    getById: (id) => {
        const db = (0, index_cjs_1.getDB)();
        return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    },
    // Create new project
    create: (data) => {
        const db = (0, index_cjs_1.getDB)();
        const stmt = db.prepare(`
            INSERT INTO projects 
            (id, title, courseId, description, startDate, deadline, totalProgress, status, priority, semester, createdAt, updatedAt, lastSessionDate)
            VALUES (@id, @title, @courseId, @description, @startDate, @deadline, @totalProgress, @status, @priority, @semester, @createdAt, @updatedAt, @lastSessionDate)
        `);
        stmt.run({
            id: data.id || (0, crypto_1.randomUUID)(),
            title: data.title,
            courseId: data.courseId || null,
            description: data.description || '',
            startDate: data.startDate,
            deadline: data.deadline,
            totalProgress: data.totalProgress || 0,
            status: data.status || 'active',
            priority: data.priority || 'medium',
            semester: data.semester,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
            lastSessionDate: data.lastSessionDate || null
        });
        return { success: true };
    },
    // Update project
    update: (id, data) => {
        const db = (0, index_cjs_1.getDB)();
        const fields = Object.keys(data);
        const sets = fields.map(f => `${f} = @${f}`).join(', ');
        const stmt = db.prepare(`UPDATE projects SET ${sets}, updatedAt = @updatedAt WHERE id = @id`);
        stmt.run({ ...data, updatedAt: new Date().toISOString(), id });
        return { success: true };
    },
    // Update progress and lastSessionDate
    updateProgress: (id, progress) => {
        const db = (0, index_cjs_1.getDB)();
        const stmt = db.prepare('UPDATE projects SET totalProgress = ?, lastSessionDate = ?, updatedAt = ? WHERE id = ?');
        stmt.run(progress, new Date().toISOString(), new Date().toISOString(), id);
        return { success: true };
    },
    // Delete project (cascade will delete sessions and attachments)
    delete: (id) => {
        const db = (0, index_cjs_1.getDB)();
        const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
        stmt.run(id);
        return { success: true };
    }
};
