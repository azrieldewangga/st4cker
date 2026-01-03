"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDB = exports.getDB = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const schema_cjs_1 = require("./schema.cjs");
let db = null;
const getDB = () => {
    if (!db) {
        let dbPath;
        if (process.env.VITE_DEV_SERVER_URL) {
            // In Dev, store DB in project root
            dbPath = path_1.default.join(process.cwd(), 'campusdash.db');
            console.log('[DB] Dev Mode: Using CWD database:', dbPath);
        }
        else {
            const userDataPath = electron_1.app.getPath('userData');
            dbPath = path_1.default.join(userDataPath, 'campusdash.db');
        }
        // Debug Log
        try {
            const fs = require('fs');
            // Assuming running in dev where ./debug_info.txt maps to project root or similar. 
            // We'll try to append.
            fs.appendFileSync('debug_info.txt', `[DB] Connecting to: ${dbPath}\n`);
        }
        catch { }
        console.log('[DB] Connecting to:', dbPath);
        db = new better_sqlite3_1.default(dbPath);
        db.pragma('journal_mode = DELETE');
        // Initialize Schema
        (0, schema_cjs_1.initSchema)(db);
    }
    return db;
};
exports.getDB = getDB;
// Helper for closing if needed
const closeDB = () => {
    if (db) {
        db.close();
        db = null;
    }
};
exports.closeDB = closeDB;
