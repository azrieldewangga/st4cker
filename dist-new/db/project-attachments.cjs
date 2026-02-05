"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectAttachments = void 0;
const index_cjs_1 = require("./index.cjs");
const crypto_1 = require("crypto");
exports.projectAttachments = {
    // Get all attachments for a project
    getByProjectId: (projectId) => {
        const db = (0, index_cjs_1.getDB)();
        return db.prepare('SELECT * FROM project_attachments WHERE projectId = ? ORDER BY createdAt DESC').all(projectId);
    },
    // Get attachment by ID
    getById: (id) => {
        const db = (0, index_cjs_1.getDB)();
        return db.prepare('SELECT * FROM project_attachments WHERE id = ?').get(id);
    },
    // Create new attachment
    create: (data) => {
        const db = (0, index_cjs_1.getDB)();
        const stmt = db.prepare(`
            INSERT INTO project_attachments 
            (id, projectId, type, name, path, size, createdAt)
            VALUES (@id, @projectId, @type, @name, @path, @size, @createdAt)
        `);
        stmt.run({
            id: data.id || (0, crypto_1.randomUUID)(),
            projectId: data.projectId,
            type: data.type, // 'file' | 'link'
            name: data.name,
            path: data.path,
            size: data.size || null,
            createdAt: data.createdAt || new Date().toISOString()
        });
        return { success: true };
    },
    // Delete attachment
    delete: (id) => {
        const db = (0, index_cjs_1.getDB)();
        const stmt = db.prepare('DELETE FROM project_attachments WHERE id = ?');
        stmt.run(id);
        return { success: true };
    }
};
