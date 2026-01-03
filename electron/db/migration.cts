import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getDB } from './index.cjs';
import log from 'electron-log/main';

export const runMigration = () => {
    console.log('[DEBUG-MIG] runMigration START');
    try {
        const db = getDB();
        console.log('[DEBUG-MIG] DB Acquired');
        const userDataPath = app.getPath('userData');
        console.log('[DEBUG-MIG] UserData:', userDataPath);

        // Debug logging to file
        const fs = require('fs');
        const debugLog = (msg: string) => {
            try {
                fs.appendFileSync('debug_info.txt', `[Migration] ${msg}\n`);
            } catch { }
            console.log(`[Migration] ${msg}`);
        };

        console.log('[DEBUG-MIG] Preparing Check Stmt');
        const meta = db.prepare('SELECT value FROM meta WHERE key = ?').get('migrated_from_json') as { value: string } | undefined;
        console.log('[DEBUG-MIG] Meta Json Check:', meta);
        const metaV2 = db.prepare('SELECT value FROM meta WHERE key = ?').get('migrated_v2') as { value: string } | undefined;
        console.log('[DEBUG-MIG] Meta V2 Check:', metaV2);

        // Hardcoded check for project root if userData fails
        // Assuming project root is 2 levels up from userData if in dev default? No, usually distinct.
        // Let's assume the JSON is in the Current Working Directory (CWD) if running dev.
        const cwdJsonPath = path.join(process.cwd(), 'campusdash-db.json');
        const userDataJsonPath = path.join(userDataPath, 'campusdash-db.json');

        let sourcePath = userDataJsonPath;
        // Prioritize UserData (AppData) as per user request to ensure latest data
        if (fs.existsSync(userDataJsonPath)) {
            sourcePath = userDataJsonPath;
            debugLog(`Found JSON in UserData (Priority): ${userDataJsonPath}`);
        } else if (fs.existsSync(cwdJsonPath)) {
            sourcePath = cwdJsonPath;
            debugLog(`Found JSON in CWD: ${cwdJsonPath}`);
        } else {
            debugLog(`Msg: No JSON found at ${cwdJsonPath} or ${userDataJsonPath}`);
        }

        // If no JSON database found at all, skip.
        if (!fs.existsSync(sourcePath)) {
            // Only mark done if we are SURE. If missing, maybe just return?
            // If we mark done, retries won't happen.
            debugLog('ABORT: Source file not found.');
            return;
        }

        // V2 Logic (Enhanced to cover Schedule, Semesters, UserProfile)
        // [CLEANUP] JSON Migration Disabled per user request (Single Source of Truth)
        if (metaV2 && metaV2.value === 'true') {
            debugLog('Already migrated (v2). Skipping.');
        } else {
            // debugLog(`Starting V2 Migration from: ${sourcePath}`);
            // ... (Migration logic commented out/removed to stop "Zombie Data")

            // Mark as migrated so we don't try again even if logic was enabled
            db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('migrated_v2', 'true');
            db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('migrated_from_json', 'true');
        }
    } catch (criticalErr) {
        console.error('[DEBUG-MIG] CRITICAL MIGRATION FAILURE:', criticalErr);
    }
};

