"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDB = exports.getDB = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_1 = require("electron");
const schema_cjs_1 = require("./schema.cjs");
// @ts-ignore
const main_js_1 = __importDefault(require("electron-log/main.js"));
let db = null;
const getDB = () => {
    if (!db) {
        const userDataPath = electron_1.app.getPath('userData');
        let dbPath;
        if (process.env.VITE_DEV_SERVER_URL) {
            // Dev mode: store DB in project root
            dbPath = path_1.default.join(process.cwd(), 'st4cker.db');
            console.log('[DB] Dev Mode: Using CWD database:', dbPath);
        }
        else {
            // Production mode: store DB in userData with migration logic
            dbPath = path_1.default.join(userDataPath, 'st4cker.db');
            // Migration: Rename old database if exists
            const oldDbPath = path_1.default.join(userDataPath, 'campusdash.db');
            if (fs_1.default.existsSync(oldDbPath) && !fs_1.default.existsSync(dbPath)) {
                main_js_1.default.info('[DB] Migrating database: campusdash.db → st4cker.db');
                try {
                    fs_1.default.renameSync(oldDbPath, dbPath);
                    main_js_1.default.info('[DB] Migration complete');
                }
                catch (error) {
                    main_js_1.default.error('[DB] Migration failed:', error);
                    // Fallback to old path if migration fails
                    dbPath = oldDbPath;
                }
            }
        }
        // Debug Log
        try {
            fs_1.default.appendFileSync('debug_info.txt', `[DB] Connecting to: ${dbPath}\n`);
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
