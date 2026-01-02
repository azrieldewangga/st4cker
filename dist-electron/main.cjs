"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const electron_1 = require("electron");
const url_1 = require("url");
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
// --- DB Modules ---
const index_cjs_1 = require("./db/index.cjs");
const migration_cjs_1 = require("./db/migration.cjs");
const assignments_cjs_1 = require("./db/assignments.cjs");
const transactions_cjs_1 = require("./db/transactions.cjs");
const performance_cjs_1 = require("./db/performance.cjs");
const schedule_cjs_1 = require("./db/schedule.cjs");
const userProfile_cjs_1 = require("./db/userProfile.cjs");
const materials_cjs_1 = require("./db/materials.cjs");
const backup_cjs_1 = require("./db/backup.cjs");
const subscriptions_cjs_1 = require("./db/subscriptions.cjs");
// driveService will be imported dynamically
// JSON store deprecated — migrated to SQLite
// SimpleStore removed.
// Startup handled by Electron
let mainWindow = null;
let driveService; // Dynamically loaded
const createWindow = () => {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        frame: false,
        transparent: true, // Enable transparency
        backgroundMaterial: 'none', // EXPLICITLY DISABLE to prevent gray box in prod
        backgroundColor: '#00000000', // Start fully transparent
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.cjs'), // Back to .js to match tsc output
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
        },
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        console.log('Loading URL:', process.env.VITE_DEV_SERVER_URL);
        console.log('Preload Path:', path_1.default.join(__dirname, 'preload.js'));
        mainWindow?.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow?.webContents.openDevTools();
    }
    else {
        mainWindow?.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
};
// @ts-ignore
const main_js_1 = __importDefault(require("electron-log/main.js"));
main_js_1.default.initialize();
electron_1.app.on('ready', async () => {
    // Debug Path Logging
    main_js_1.default.info('App Ready');
    main_js_1.default.info('UserData:', electron_1.app.getPath('userData'));
    main_js_1.default.info('AppPath:', electron_1.app.getAppPath());
    main_js_1.default.info('CWD:', process.cwd());
    // 0. Load ESM Modules
    try {
        // Use pathToFileURL for robust Windows/ASAR handling
        const drivePath = path_1.default.join(__dirname, 'services/drive.js');
        const driveUrl = (0, url_1.pathToFileURL)(drivePath).href;
        console.log('[Main] Loading drive service from:', driveUrl);
        const driveModule = await import(driveUrl);
        driveService = driveModule.driveService;
        console.log('[Main] driveService loaded dynamically.');
    }
    catch (e) {
        console.error('[Main] Failed to load driveService:', e);
        main_js_1.default.error('[Main] Failed to load driveService:', e);
    }
    // 1. Init DB
    try {
        (0, index_cjs_1.getDB)(); // This runs schema init
        // 2. Run Migration (if needed)
        console.log('[DEBUG] Main: Calling runMigration()...');
        try {
            (0, migration_cjs_1.runMigration)();
            console.log('[DEBUG] Main: runMigration() returned.');
        }
        catch (migErr) {
            console.error('[DEBUG] Main: runMigration() CRASHED:', migErr);
        }
        // 3. Verify Content (Temporary Debug)
        const db = (0, index_cjs_1.getDB)();
        const meta = db.prepare('SELECT * FROM meta').all();
        console.log('[DEBUG] Meta Table Content:', meta);
        try {
            // Only try reading if table exists (it should)
            const courses = db.prepare('SELECT * FROM performance_courses LIMIT 3').all();
            console.log('[DEBUG] Performance Courses (First 3):', courses);
        }
        catch (err) {
            console.log('[DEBUG] Error reading courses:', err);
        }
    }
    catch (e) {
        console.error('Failed to initialize database:', e);
        try {
            const fs = require('fs');
            fs.appendFileSync('debug_info.txt', `[DB Error] ${e}\n`);
        }
        catch { }
    }
    // --- Domain Handlers ---
    // User Profile
    electron_1.ipcMain.handle('userProfile:get', () => userProfile_cjs_1.userProfile.get());
    electron_1.ipcMain.handle('userProfile:update', (_, data) => userProfile_cjs_1.userProfile.update(data));
    // Assignments
    electron_1.ipcMain.handle('assignments:list', () => assignments_cjs_1.assignments.getAll());
    electron_1.ipcMain.handle('assignments:create', (_, data) => assignments_cjs_1.assignments.create({
        ...data,
        id: (0, crypto_1.randomUUID)(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }));
    electron_1.ipcMain.handle('assignments:update', (_, id, data) => assignments_cjs_1.assignments.update(id, data));
    electron_1.ipcMain.handle('assignments:updateStatus', (_, id, status) => assignments_cjs_1.assignments.updateStatus(id, status));
    electron_1.ipcMain.handle('assignments:delete', (_, id) => assignments_cjs_1.assignments.delete(id));
    // Transactions
    electron_1.ipcMain.handle('transactions:list', (_, params) => transactions_cjs_1.transactions.getAll(params));
    electron_1.ipcMain.handle('transactions:create', (_, data) => transactions_cjs_1.transactions.create({
        ...data,
        id: (0, crypto_1.randomUUID)(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }));
    electron_1.ipcMain.handle('transactions:update', (_, id, data) => transactions_cjs_1.transactions.update(id, data));
    electron_1.ipcMain.handle('transactions:delete', (_, id) => transactions_cjs_1.transactions.delete(id));
    electron_1.ipcMain.handle('transactions:summary', (_, currency) => transactions_cjs_1.transactions.getSummary(currency));
    electron_1.ipcMain.handle('transactions:clear', () => transactions_cjs_1.transactions.clearAll());
    // Performance
    electron_1.ipcMain.handle('performance:getSemesters', () => performance_cjs_1.performance.getSemesters());
    electron_1.ipcMain.handle('performance:upsertSemester', (_, s, i) => performance_cjs_1.performance.upsertSemester(s, i));
    electron_1.ipcMain.handle('performance:getCourses', (_, sem) => performance_cjs_1.performance.getCourses(sem));
    electron_1.ipcMain.handle('performance:upsertCourse', (_, c) => performance_cjs_1.performance.upsertCourse(c));
    electron_1.ipcMain.handle('performance:updateSksOnly', (_, id, sks) => performance_cjs_1.performance.updateSksOnly(id, sks));
    // Schedule
    electron_1.ipcMain.handle('schedule:getAll', () => schedule_cjs_1.schedule.getAll());
    electron_1.ipcMain.handle('schedule:upsert', (_, item) => schedule_cjs_1.schedule.upsert(item));
    // Course Materials
    electron_1.ipcMain.handle('materials:getByCourse', (_, courseId) => materials_cjs_1.materials.getByCourse(courseId));
    electron_1.ipcMain.handle('materials:add', (_, id, courseId, type, title, url) => materials_cjs_1.materials.add(id, courseId, type, title, url));
    electron_1.ipcMain.handle('materials:delete', (_, id) => materials_cjs_1.materials.delete(id));
    // Subscriptions
    electron_1.ipcMain.handle('subscriptions:list', () => subscriptions_cjs_1.subscriptions.getAll());
    electron_1.ipcMain.handle('subscriptions:create', (_, data) => subscriptions_cjs_1.subscriptions.create(data));
    electron_1.ipcMain.handle('subscriptions:update', (_, id, data) => subscriptions_cjs_1.subscriptions.update(id, data));
    electron_1.ipcMain.handle('subscriptions:delete', (_, id) => subscriptions_cjs_1.subscriptions.delete(id));
    electron_1.ipcMain.handle('subscriptions:checkDeductions', () => subscriptions_cjs_1.subscriptions.checkAndProcessDeductions());
    // Backup & Restore
    electron_1.ipcMain.handle('db:export', async () => {
        const { dialog } = require('electron');
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const defaultFilename = `CampusDash-Backup-${dateStr}.db`;
        const result = await dialog.showSaveDialog({
            title: 'Backup Database',
            defaultPath: defaultFilename,
            filters: [{ name: 'SQLite Database', extensions: ['db'] }]
        });
        if (result.canceled || !result.filePath)
            return { success: false, canceled: true };
        return await backup_cjs_1.backup.export(result.filePath);
    });
    electron_1.ipcMain.handle('db:import', async () => {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog({
            title: 'Restore Database',
            properties: ['openFile'],
            filters: [{ name: 'SQLite Database', extensions: ['db'] }]
        });
        if (result.canceled || result.filePaths.length === 0)
            return { success: false, canceled: true };
        return await backup_cjs_1.backup.import(result.filePaths[0]);
    });
    // Google Drive Backup
    // Ensure driveService is used after it's been loaded
    electron_1.ipcMain.handle('drive:authenticate', () => {
        if (!driveService) {
            main_js_1.default.error('[Main] driveService is null during authenticate call.');
            throw new Error('Google Drive Service not initialized. Check logs.');
        }
        return driveService.authenticate();
    });
    electron_1.ipcMain.handle('drive:upload', () => driveService?.uploadDatabase());
    electron_1.ipcMain.handle('drive:isAuthenticated', () => driveService?.isAuthenticated());
    electron_1.ipcMain.handle('drive:logout', () => driveService?.logout());
    electron_1.ipcMain.handle('drive:lastBackup', () => driveService?.getLastBackup());
    // Reports (PDF Export)
    electron_1.ipcMain.handle('reports:export-pdf', async (_, filename = 'Report.pdf') => {
        const win = electron_1.BrowserWindow.getFocusedWindow();
        if (!win)
            return { success: false, error: 'No focused window' };
        const { dialog } = require('electron');
        const fs = require('fs/promises');
        try {
            const { filePath } = await dialog.showSaveDialog(win, {
                title: 'Save Report PDF',
                defaultPath: filename,
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });
            if (!filePath)
                return { success: false, canceled: true };
            const pdfData = await win.webContents.printToPDF({
                printBackground: true,
                pageSize: 'A4',
                margins: { top: 0, bottom: 0, left: 0, right: 0 } // Let CSS handle margins
            });
            await fs.writeFile(filePath, pdfData);
            return { success: true, filePath };
        }
        catch (error) {
            console.error('PDF Generation Error:', error);
            return { success: false, error: error.message };
        }
    });
    // Settings (Startup)
    electron_1.ipcMain.handle('settings:getStartupStatus', () => {
        const settings = electron_1.app.getLoginItemSettings();
        return settings.openAtLogin;
    });
    electron_1.ipcMain.handle('settings:toggleStartup', (_, openAtLogin) => {
        electron_1.app.setLoginItemSettings({
            openAtLogin: openAtLogin,
            path: electron_1.app.getPath('exe') // Important for production
        });
        return electron_1.app.getLoginItemSettings().openAtLogin;
    });
    // Listeners
    electron_1.ipcMain.on('data-changed', () => {
        electron_1.BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('refresh-data');
        });
    });
    // Dialog
    const { dialog } = require('electron');
    electron_1.ipcMain.handle('dialog:openFile', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile']
        });
        return result;
    });
    // Utilities (Shell)
    const { shell } = require('electron');
    electron_1.ipcMain.handle('utils:openExternal', (_, url) => shell.openExternal(url));
    electron_1.ipcMain.handle('utils:openPath', (_, path) => shell.openPath(path));
    // Toggle DevTools for debugging in production
    const { globalShortcut } = require('electron');
    globalShortcut.register('F12', () => {
        const win = electron_1.BrowserWindow.getFocusedWindow();
        if (win)
            win.webContents.toggleDevTools();
    });
    createWindow();
    // Check Auto-Backup (After a short delay to let things settle, and confirm driveService exists)
    setTimeout(() => {
        if (driveService) {
            driveService.checkAndRunAutoBackup().catch((err) => console.error('Auto-backup check failed:', err));
        }
        else {
            console.log('[Main] driveService not available for auto-backup check.');
        }
    }, 5000);
    electron_1.ipcMain.on('window-close', (event) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        win?.close();
    });
    electron_1.ipcMain.on('window-minimize', (event) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        win?.minimize();
    });
    electron_1.ipcMain.on('window-maximize', (event) => {
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        if (win?.isMaximized())
            win.unmaximize();
        else
            win?.maximize();
    });
    electron_1.ipcMain.on('window-open', (_, route, width = 800, height = 600) => {
        console.log(`[Main] Request to open window: ${route}`);
        try {
            const childWin = new electron_1.BrowserWindow({
                width,
                height,
                // parent: mainWindow || undefined, // REMOVED to decouple windows
                modal: false,
                frame: false,
                transparent: true,
                backgroundMaterial: 'none',
                backgroundColor: '#00000000',
                webPreferences: {
                    preload: path_1.default.join(__dirname, 'preload.cjs'),
                    nodeIntegration: false,
                    contextIsolation: true,
                    webSecurity: true
                }
            });
            if (process.env.VITE_DEV_SERVER_URL) {
                childWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}#${route}`);
            }
            else {
                childWin.loadFile(path_1.default.join(__dirname, '../dist/index.html'), { hash: route });
            }
            console.log('[Main] Window created successfully');
            // Notify ALL other windows (Main Window)
            electron_1.BrowserWindow.getAllWindows().forEach(win => {
                if (win.id !== childWin.id) {
                    console.log('[Main] Broadcasting child-window-opened to window:', win.id);
                    win.webContents.send('child-window-opened', route);
                }
            });
            childWin.on('closed', () => {
                console.log('[Main] Child window closed, notifying all windows');
                electron_1.BrowserWindow.getAllWindows().forEach(win => {
                    if (win.id !== childWin.id && !win.isDestroyed()) {
                        win.webContents.send('child-window-closed', route);
                        win.focus(); // Force focus back to main window
                    }
                });
            });
        }
        catch (err) {
            console.error('[Main] Failed to create window:', err);
        }
    });
    electron_1.app.on('will-quit', () => {
        // Unregister all shortcuts.
        const { globalShortcut } = require('electron');
        globalShortcut.unregisterAll();
    });
    electron_1.app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            electron_1.app.quit();
        }
    });
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
