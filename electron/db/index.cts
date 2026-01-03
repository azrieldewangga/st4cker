import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { initSchema } from './schema.cjs';

let db: Database.Database | null = null;

export const getDB = () => {
    if (!db) {
        let dbPath;
        if (process.env.VITE_DEV_SERVER_URL) {
            // In Dev, store DB in project root
            dbPath = path.join(process.cwd(), 'campusdash.db');
            console.log('[DB] Dev Mode: Using CWD database:', dbPath);
        } else {
            const userDataPath = app.getPath('userData');
            dbPath = path.join(userDataPath, 'campusdash.db');
        }

        // Debug Log
        try {
            const fs = require('fs');
            // Assuming running in dev where ./debug_info.txt maps to project root or similar. 
            // We'll try to append.
            fs.appendFileSync('debug_info.txt', `[DB] Connecting to: ${dbPath}\n`);
        } catch { }

        console.log('[DB] Connecting to:', dbPath);
        db = new Database(dbPath);
        db.pragma('journal_mode = DELETE');

        // Initialize Schema
        initSchema(db);
    }
    return db;
};

// Helper for closing if needed
export const closeDB = () => {
    if (db) {
        db.close();
        db = null;
    }
};
