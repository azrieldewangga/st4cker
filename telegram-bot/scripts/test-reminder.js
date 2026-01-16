
import { initScheduler } from '../src/scheduler.js';
import cron from 'node-cron';

// Mock Bot
const mockBot = {
    sendMessage: (userId, msg, opts) => {
        console.log(`[MOCK BOT -> ${userId}] Message:`);
        console.log(msg);
        return Promise.resolve();
    }
};

console.log('--- TESTING MORNING BRIEF LOGIC ---');
// We can't export sendMorningBrief easily without changing scheduler.js exports,
// so we will simulate it by importing it?
// Actually, since I didn't export it, I'll copy the logic briefly or modify scheduler to export it.

// Better approach: Modify scheduler.js to export it for testing? 
// No, I'll just rely on a new temporary file that has the exact SAME logic but runs immediately.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../data');

const getLocalYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

async function testBrief() {
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const lusa = new Date(today);
    lusa.setDate(today.getDate() + 2);

    const tomorrowStr = getLocalYMD(tomorrow);
    const lusaStr = getLocalYMD(lusa);

    console.log(`Target Tomorrow: ${tomorrowStr}`);

    for (const file of files) {
        const userId = file.replace('.json', '');
        if (!userId || isNaN(userId)) continue;

        const rawData = fs.readFileSync(path.join(dataDir, file), 'utf-8');
        const userData = JSON.parse(rawData);

        if (!userData.activeAssignments || userData.activeAssignments.length === 0) continue;

        // Filter Tasks
        const dueTomorrow = userData.activeAssignments.filter(t => {
            if (t.status === 'done' || !t.deadline) return false;
            let d = t.deadline.includes('T') ? t.deadline.split('T')[0] : t.deadline;
            return d === tomorrowStr;
        });

        if (dueTomorrow.length > 0) {
            console.log(`\n[User ${userId}] Found ${dueTomorrow.length} tasks due tomorrow!`);
            dueTomorrow.forEach(t => console.log(` - ${t.title} (${t.course})`));
        } else {
            console.log(`[User ${userId}] No tasks due tomorrow.`);
        }
    }
}

testBrief();
