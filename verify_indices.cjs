const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Path to DB (Dev Mode)
const dbPath = path.join(process.cwd(), 'st4cker.db');

console.log('Verifying Database at:', dbPath);

if (!fs.existsSync(dbPath)) {
    console.error('❌ Database file not found!');
    process.exit(1);
}

const db = new Database(dbPath);

try {
    const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").all();
    const indexNames = indices.map(i => i.name);

    console.log('\nExisting Indices:');
    indexNames.forEach(name => console.log(` - ${name}`));

    const expectedIndices = [
        'idx_transactions_type',
        'idx_transactions_date_type',
        'idx_assignments_semester',
        'idx_courses_semester'
    ];

    console.log('\nVerification Results:');
    let allPassed = true;
    expectedIndices.forEach(expected => {
        if (indexNames.includes(expected)) {
            console.log(`✅ Found ${expected}`);
        } else {
            console.log(`❌ MISSING ${expected}`);
            allPassed = false;
        }
    });

    if (allPassed) {
        console.log('\n🎉 SUCCESS: All Phase 6 indices are present.');
    } else {
        console.error('\n⚠️ FAILED: Some indices are missing. Did you restart the app?');
    }

} catch (err) {
    console.error('Error verifying database:', err);
} finally {
    db.close();
}
