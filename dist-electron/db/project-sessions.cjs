"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectSessions = void 0;
const index_cjs_1 = require("./index.cjs");
const crypto_1 = require("crypto");
exports.projectSessions = {
    // Get all sessions for a project
    getByProjectId: (projectId) => {
        const db = (0, index_cjs_1.getDB)();
        return db.prepare('SELECT * FROM project_sessions WHERE projectId = ? ORDER BY sessionDate DESC').all(projectId);
    },
    // Get session by ID
    getById: (id) => {
        const db = (0, index_cjs_1.getDB)();
        return db.prepare('SELECT * FROM project_sessions WHERE id = ?').get(id);
    },
    // Create new session
    create: (data) => {
        const db = (0, index_cjs_1.getDB)();
        const stmt = db.prepare(`
            INSERT INTO project_sessions 
            (id, projectId, sessionDate, duration, note, progressBefore, progressAfter, createdAt)
            VALUES (@id, @projectId, @sessionDate, @duration, @note, @progressBefore, @progressAfter, @createdAt)
        `);
        stmt.run({
            id: data.id || (0, crypto_1.randomUUID)(),
            projectId: data.projectId,
            sessionDate: data.sessionDate || new Date().toISOString(),
            duration: data.duration,
            note: data.note || '',
            progressBefore: data.progressBefore,
            progressAfter: data.progressAfter,
            createdAt: data.createdAt || new Date().toISOString()
        });
        // CRITICAL: Update the parent project's progress to match the session's progressAfter
        const updateProjectStmt = db.prepare(`
            UPDATE projects 
            SET totalProgress = ? 
            WHERE id = ?
        `);
        updateProjectStmt.run(data.progressAfter, data.projectId);
        return { success: true };
    },
    // Update session
    update: (id, data) => {
        const db = (0, index_cjs_1.getDB)();
        const fields = Object.keys(data);
        const sets = fields.map(f => `${f} = @${f}`).join(', ');
        const stmt = db.prepare(`UPDATE project_sessions SET ${sets} WHERE id = @id`);
        stmt.run({ ...data, id });
        return { success: true };
    },
    // Delete session
    delete: (id) => {
        const db = (0, index_cjs_1.getDB)();
        const stmt = db.prepare('DELETE FROM project_sessions WHERE id = ?');
        stmt.run(id);
        return { success: true };
    },
    // Get session stats for a project
    getStats: (projectId) => {
        const db = (0, index_cjs_1.getDB)();
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as sessionCount,
                SUM(duration) as totalMinutes,
                AVG(duration) as avgDuration
            FROM project_sessions 
            WHERE projectId = ?
        `).get(projectId);
        return stats;
    }
};
