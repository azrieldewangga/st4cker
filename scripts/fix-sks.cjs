const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Load Curriculum
const curriculumPath = path.join(__dirname, '../src/lib/curriculum.json');
const curriculum = JSON.parse(fs.readFileSync(curriculumPath, 'utf-8'));

// Open DB
const dbPath = path.join(__dirname, '../campusdash.db');
const db = new Database(dbPath);

console.log('--- Fixing SKS Values ---');

const updateStmt = db.prepare('UPDATE performance_courses SET sks = ? WHERE id = ?');
const selectStmt = db.prepare('SELECT id, name, sks FROM performance_courses WHERE id = ?');

let updatedCount = 0;

Object.keys(curriculum).forEach(semKey => {
    const courses = curriculum[semKey];
    courses.forEach((c, idx) => {
        const id = `course-${semKey}-${idx}`; // Standard ID format

        // Check current DB value
        const current = selectStmt.get(id);

        if (current) {
            if (current.sks !== c.sks) {
                console.log(`[FIX] Updating ${c.name} (Sem ${semKey}): SKS ${current.sks} -> ${c.sks}`);
                updateStmt.run(c.sks, id);
                updatedCount++;
            }
        }
    });
});

console.log(`--- Finished. Updated ${updatedCount} courses. ---`);
