import { getDB } from './index.cjs';
import { randomUUID } from 'crypto';

export const projectSessions = {
    // Get all sessions for a project
    getByProjectId: (projectId: string) => {
        const db = getDB();
        return db.prepare('SELECT * FROM project_sessions WHERE projectId = ? ORDER BY sessionDate DESC').all(projectId);
    },

    // Get session by ID
    getById: (id: string) => {
        const db = getDB();
        return db.prepare('SELECT * FROM project_sessions WHERE id = ?').get(id);
    },

    // Create new session
    create: (data: any) => {
        const db = getDB();
        const stmt = db.prepare(`
            INSERT INTO project_sessions 
            (id, projectId, sessionDate, duration, note, progressBefore, progressAfter, createdAt)
            VALUES (@id, @projectId, @sessionDate, @duration, @note, @progressBefore, @progressAfter, @createdAt)
        `);
        stmt.run({
            id: data.id || randomUUID(),
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
    update: (id: string, data: any) => {
        const db = getDB();
        const fields = Object.keys(data);
        const sets = fields.map(f => `${f} = @${f}`).join(', ');
        const stmt = db.prepare(`UPDATE project_sessions SET ${sets} WHERE id = @id`);
        stmt.run({ ...data, id });
        return { success: true };
    },

    // Delete session
    delete: (id: string) => {
        const db = getDB();
        const stmt = db.prepare('DELETE FROM project_sessions WHERE id = ?');
        stmt.run(id);
        return { success: true };
    },

    // Get session stats for a project
    getStats: (projectId: string) => {
        const db = getDB();
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
