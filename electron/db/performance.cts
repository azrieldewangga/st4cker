import { getDB } from './index.cjs';

export const performance = {
    getSemesters: () => {
        const db = getDB();
        return db.prepare('SELECT * FROM performance_semesters ORDER BY semester ASC').all();
    },

    upsertSemester: (semester: number, ips: number) => {
        const db = getDB();
        const stmt = db.prepare(`
            INSERT INTO performance_semesters (semester, ips)
            VALUES (?, ?)
            ON CONFLICT(semester) DO UPDATE SET ips = excluded.ips
        `);
        stmt.run(semester, ips);
        return { semester, ips };
    },

    getCourses: (semester?: number) => {
        const db = getDB();
        if (semester) {
            return db.prepare('SELECT * FROM performance_courses WHERE semester = ?').all(semester);
        }
        return db.prepare('SELECT * FROM performance_courses').all();
    },

    upsertCourse: (course: any) => {
        console.log('[DEBUG-DB] upsertCourse called with:', course);
        const db = getDB();
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

    updateSksOnly: (id: string, sks: number) => {
        const db = getDB();
        const stmt = db.prepare('UPDATE performance_courses SET sks = ? WHERE id = ?');
        stmt.run(sks, id);
        console.log(`[DEBUG-DB] updateSksOnly: ${id} -> ${sks} SKS`);
        return { id, sks };
    },

    deleteCourse: (id: string) => {
        const db = getDB();
        const stmt = db.prepare('DELETE FROM performance_courses WHERE id = ?');
        stmt.run(id);
        console.log(`[DEBUG-DB] deleteCourse: ${id}`);
        return true;
    }
};
