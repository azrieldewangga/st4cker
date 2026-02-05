"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backup = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_1 = require("electron");
const index_cjs_1 = require("./index.cjs");
exports.backup = {
    export: async (destinationPath) => {
        const db = (0, index_cjs_1.getDB)();
        console.log('[Backup] Starting export to:', destinationPath);
        try {
            // Use better-sqlite3 native backup API
            // This is non-blocking and safe for WAL mode
            await db.backup(destinationPath);
            console.log('[Backup] Export successful');
            return { success: true };
        }
        catch (error) {
            console.error('[Backup] Export failed:', error);
            return { success: false, error: error.message };
        }
    },
    import: async (sourcePath) => {
        console.log('[Backup] Starting restore from:', sourcePath);
        try {
            // 1. Verify it's a valid SQLite file (simple header check or try opening)
            // We'll rely on try/catch wrapper logic in main implementation usually,
            // but here we just proceed with the copy replacement strategy.
            // 2. Close current connection
            (0, index_cjs_1.closeDB)();
            // 3. Determine DB path
            let dbPath;
            if (process.env.VITE_DEV_SERVER_URL) {
                dbPath = path_1.default.join(process.cwd(), 'st4cker.db');
            }
            else {
                dbPath = path_1.default.join(electron_1.app.getPath('userData'), 'st4cker.db');
            }
            // 4. Force copy (Replace)
            // We use fs.copyFile
            await fs_1.default.promises.copyFile(sourcePath, dbPath);
            console.log('[Backup] Restore successful, DB replaced.');
            // 5. Restart App to ensure clean state and fresh connection
            electron_1.app.relaunch();
            electron_1.app.quit();
            return { success: true };
        }
        catch (error) {
            console.error('[Backup] Restore failed:', error);
            // Re-open DB if we failed so app doesn't crash entirely?
            // getDB() will lazy init again on next call.
            return { success: false, error: error.message };
        }
    }
};
