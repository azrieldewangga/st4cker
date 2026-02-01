
import db from '../database.js';
import { generateCasualReply } from './nlp-service.js';

// Mock Data
const TEST_USER_ID = '999999';
const mockData = {
    currentBalance: 5250000,
    transactions: [
        { category: 'Food', amount: 25000, note: 'Nasi Ayam', date: '2024-01-30' },
        { category: 'Transport', amount: 10000, note: 'Gojek', date: '2024-01-30' },
        { category: 'Shopping', amount: 500000, note: 'Khilaf beli skin', date: '2024-01-29' }
    ],
    tasks: [
        { courseName: 'Algoritma', type: 'Tugas', deadline: '2024-02-01', completed: false }
    ],
    projects: []
};

// Setup DB
console.log('Setting up Test Data...');
try {
    const existing = db.prepare('SELECT telegram_user_id FROM user_data WHERE telegram_user_id = ?').get(TEST_USER_ID);
    if (existing) {
        db.prepare('UPDATE user_data SET data = ?, updated_at = ? WHERE telegram_user_id = ?').run(JSON.stringify(mockData), Date.now(), TEST_USER_ID);
    } else {
        db.prepare('INSERT INTO user_data (telegram_user_id, data, updated_at) VALUES (?, ?, ?)')
            .run(TEST_USER_ID, JSON.stringify(mockData), Date.now());
    }
} catch (e) {
    console.error('DB Setup Error:', e);
}

// Run Test
async function run() {
    console.log('\n--- TEST 1: Saldo Check (Casual) ---');
    console.log('User: Gue boros ga sih hari ini?');
    const reply1 = await generateCasualReply('Gue boros ga sih hari ini?', TEST_USER_ID);
    console.log('Bot:', reply1);

    console.log('\n--- TEST 2: Context Awareness (Nasi Ayam) ---');
    console.log('User: Tadi gue makan apa ya?');
    const reply2 = await generateCasualReply('Tadi gue makan apa ya?', TEST_USER_ID);
    console.log('Bot:', reply2);

    console.log('\n--- TEST 3: Task Motivation ---');
    console.log('User: Lagi males nugas nih');
    const reply3 = await generateCasualReply('Lagi males nugas nih', TEST_USER_ID);
    console.log('Bot:', reply3);

    // Cleanup
    // db.prepare('DELETE FROM user_data WHERE telegram_user_id = ?').run(TEST_USER_ID);
}

run();
