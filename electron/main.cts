import 'dotenv/config';
import { app, BrowserWindow, ipcMain } from 'electron';
import { pathToFileURL } from 'url';
import path from 'path';
import { randomUUID } from 'crypto';

// --- DB Modules ---
import { getDB } from './db/index.cjs';
import { runMigration } from './db/migration.cjs';
import { assignments } from './db/assignments.cjs';
import { transactions } from './db/transactions.cjs';
import { performance } from './db/performance.cjs';
import { schedule } from './db/schedule.cjs';
import { userProfile } from './db/userProfile.cjs';
import { materials } from './db/materials.cjs';
import { backup } from './db/backup.cjs';
import { subscriptions } from './db/subscriptions.cjs';
// driveService will be imported dynamically


// JSON store deprecated — migrated to SQLite
// SimpleStore removed.

// Startup handled by Electron

// Single Instance Lock - Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    // Another instance is already running, quit this one
    app.quit();
} else {
    // This is the first instance, set up second-instance handler
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, focus our window instead
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

let mainWindow: BrowserWindow | null = null;
let driveService: any; // Dynamically loaded

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        frame: false,
        transparent: true, // Enable transparency
        backgroundMaterial: 'none', // EXPLICITLY DISABLE to prevent gray box in prod
        backgroundColor: '#00000000', // Start fully transparent
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'), // Back to .js to match tsc output
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
        },
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        console.log('Loading URL:', process.env.VITE_DEV_SERVER_URL);
        console.log('Preload Path:', path.join(__dirname, 'preload.js'));
        mainWindow?.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow?.webContents.openDevTools();
    } else {
        mainWindow?.loadFile(path.join(__dirname, '../dist/index.html'));
    }
};

// @ts-ignore
import log from 'electron-log/main.js';
log.initialize();

app.on('ready', async () => {
    // Debug Path Logging
    log.info('App Ready');
    log.info('UserData:', app.getPath('userData'));
    log.info('AppPath:', app.getAppPath());
    log.info('CWD:', process.cwd());

    // 0. Load ESM Modules
    try {
        // Use pathToFileURL for robust Windows/ASAR handling
        const drivePath = path.join(__dirname, 'services/drive.js');
        const driveUrl = pathToFileURL(drivePath).href;
        console.log('[Main] Loading drive service from:', driveUrl);

        const driveModule = await import(driveUrl);
        driveService = driveModule.driveService;
        console.log('[Main] driveService loaded dynamically.');
    } catch (e) {
        console.error('[Main] Failed to load driveService:', e);
        log.error('[Main] Failed to load driveService:', e);
    }

    // 1. Init DB
    try {
        getDB(); // This runs schema init

        // 2. Run Migration (if needed)
        console.log('[DEBUG] Main: Calling runMigration()...');
        try {
            runMigration();
            console.log('[DEBUG] Main: runMigration() returned.');
        } catch (migErr) {
            console.error('[DEBUG] Main: runMigration() CRASHED:', migErr);
        }

        // 3. Verify Content (Temporary Debug)
        const db = getDB();
        const meta = db.prepare('SELECT * FROM meta').all();
        console.log('[DEBUG] Meta Table Content:', meta);

        try {
            // Only try reading if table exists (it should)
            const courses = db.prepare('SELECT * FROM performance_courses LIMIT 3').all();
            console.log('[DEBUG] Performance Courses (First 3):', courses);
        } catch (err) {
            console.log('[DEBUG] Error reading courses:', err);
        }

    } catch (e) {
        console.error('Failed to initialize database:', e);
        try {
            const fs = require('fs');
            fs.appendFileSync('debug_info.txt', `[DB Error] ${e}\n`);
        } catch { }
    }
    // --- Domain Handlers ---

    // User Profile
    ipcMain.handle('userProfile:get', () => userProfile.get());
    ipcMain.handle('userProfile:update', (_, data) => userProfile.update(data));

    // Assignments
    ipcMain.handle('assignments:list', () => assignments.getAll());
    ipcMain.handle('assignments:create', (_, data) => assignments.create({
        ...data,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }));
    ipcMain.handle('assignments:update', (_, id, data) => assignments.update(id, data));
    ipcMain.handle('assignments:updateStatus', (_, id, status) => assignments.updateStatus(id, status));
    ipcMain.handle('assignments:delete', (_, id) => assignments.delete(id));

    // Transactions
    ipcMain.handle('transactions:list', (_, params) => transactions.getAll(params));
    ipcMain.handle('transactions:create', (_, data) => transactions.create({
        ...data,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }));
    ipcMain.handle('transactions:update', (_, id, data) => transactions.update(id, data));
    ipcMain.handle('transactions:delete', (_, id) => transactions.delete(id));
    ipcMain.handle('transactions:summary', (_, currency) => transactions.getSummary(currency));
    ipcMain.handle('transactions:clear', () => transactions.clearAll());

    // Performance
    ipcMain.handle('performance:getSemesters', () => performance.getSemesters());
    ipcMain.handle('performance:upsertSemester', (_, s, i) => performance.upsertSemester(s, i));
    ipcMain.handle('performance:getCourses', (_, sem) => performance.getCourses(sem));
    ipcMain.handle('performance:upsertCourse', (_, c) => performance.upsertCourse(c));
    ipcMain.handle('performance:updateSksOnly', (_, id, sks) => performance.updateSksOnly(id, sks));

    // Schedule
    ipcMain.handle('schedule:getAll', () => schedule.getAll());
    ipcMain.handle('schedule:upsert', (_, item) => schedule.upsert(item));

    // Course Materials
    ipcMain.handle('materials:getByCourse', (_, courseId) => materials.getByCourse(courseId));
    ipcMain.handle('materials:add', (_, id, courseId, type, title, url) => materials.add(id, courseId, type, title, url));
    ipcMain.handle('materials:delete', (_, id) => materials.delete(id));

    // Subscriptions
    ipcMain.handle('subscriptions:list', () => subscriptions.getAll());
    ipcMain.handle('subscriptions:create', (_, data) => subscriptions.create(data));
    ipcMain.handle('subscriptions:update', (_, id, data) => subscriptions.update(id, data));
    ipcMain.handle('subscriptions:delete', (_, id) => subscriptions.delete(id));
    ipcMain.handle('subscriptions:checkDeductions', () => subscriptions.checkAndProcessDeductions());

    // Backup & Restore
    ipcMain.handle('db:export', async () => {
        const { dialog } = require('electron');
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const defaultFilename = `CampusDash-Backup-${dateStr}.db`;

        const result = await dialog.showSaveDialog({
            title: 'Backup Database',
            defaultPath: defaultFilename,
            filters: [{ name: 'SQLite Database', extensions: ['db'] }]
        });

        if (result.canceled || !result.filePath) return { success: false, canceled: true };

        return await backup.export(result.filePath);
    });

    ipcMain.handle('db:import', async () => {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog({
            title: 'Restore Database',
            properties: ['openFile'],
            filters: [{ name: 'SQLite Database', extensions: ['db'] }]
        });

        if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };

        return await backup.import(result.filePaths[0]);
    });

    // Google Drive Backup
    // Ensure driveService is used after it's been loaded
    ipcMain.handle('drive:authenticate', () => {
        if (!driveService) {
            log.error('[Main] driveService is null during authenticate call.');
            throw new Error('Google Drive Service not initialized. Check logs.');
        }
        return driveService.authenticate();
    });
    ipcMain.handle('drive:upload', () => driveService?.uploadDatabase());
    ipcMain.handle('drive:isAuthenticated', () => driveService?.isAuthenticated());
    ipcMain.handle('drive:logout', () => driveService?.logout());
    ipcMain.handle('drive:lastBackup', () => driveService?.getLastBackup());

    // Reports (PDF Export)
    ipcMain.handle('reports:export-pdf', async (_, filename = 'Report.pdf') => {
        const win = BrowserWindow.getFocusedWindow();
        if (!win) return { success: false, error: 'No focused window' };

        const { dialog } = require('electron');
        const fs = require('fs/promises');

        try {
            const { filePath } = await dialog.showSaveDialog(win, {
                title: 'Save Report PDF',
                defaultPath: filename,
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });

            if (!filePath) return { success: false, canceled: true };

            const pdfData = await win.webContents.printToPDF({
                printBackground: true,
                pageSize: 'A4',
                margins: { top: 0, bottom: 0, left: 0, right: 0 } // Let CSS handle margins
            });

            await fs.writeFile(filePath, pdfData);
            return { success: true, filePath };
        } catch (error: any) {
            console.error('PDF Generation Error:', error);
            return { success: false, error: error.message };
        }
    });

    // Settings (Startup)
    ipcMain.handle('settings:getStartupStatus', () => {
        const settings = app.getLoginItemSettings();
        return settings.openAtLogin;
    });

    ipcMain.handle('settings:toggleStartup', (_, openAtLogin) => {
        app.setLoginItemSettings({
            openAtLogin: openAtLogin,
            path: app.getPath('exe') // Important for production
        });
        return app.getLoginItemSettings().openAtLogin;
    });

    // Listeners
    ipcMain.on('data-changed', () => {
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('refresh-data');
        });
    });

    // Dialog
    const { dialog } = require('electron');
    ipcMain.handle('dialog:openFile', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile']
        });
        return result;
    });

    // Utilities (Shell)
    const { shell } = require('electron');
    ipcMain.handle('utils:openExternal', (_, url) => shell.openExternal(url));
    ipcMain.handle('utils:openPath', (_, path) => shell.openPath(path));

    // Toggle DevTools for debugging in production
    const { globalShortcut } = require('electron');
    globalShortcut.register('F12', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) win.webContents.toggleDevTools();
    });

    createWindow();

    // Check Auto-Backup (After a short delay to let things settle, and confirm driveService exists)
    setTimeout(() => {
        if (driveService) {
            driveService.checkAndRunAutoBackup().catch((err: any) => console.error('Auto-backup check failed:', err));
        } else {
            console.log('[Main] driveService not available for auto-backup check.');
        }
    }, 5000);

    ipcMain.on('window-close', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        win?.close();
    });
    ipcMain.on('window-minimize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        win?.minimize();
    });
    ipcMain.on('window-maximize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win?.isMaximized()) win.unmaximize();
        else win?.maximize();
    });

    ipcMain.on('window-open', (_, route: string, width = 800, height = 600) => {
        console.log(`[Main] Request to open window: ${route}`);
        try {
            const childWin = new BrowserWindow({
                width,
                height,
                // parent: mainWindow || undefined, // REMOVED to decouple windows
                modal: false,
                frame: false,
                transparent: true,
                backgroundMaterial: 'none',
                backgroundColor: '#00000000',
                webPreferences: {
                    preload: path.join(__dirname, 'preload.cjs'),
                    nodeIntegration: false,
                    contextIsolation: true,
                    webSecurity: true
                }
            });

            if (process.env.VITE_DEV_SERVER_URL) {
                childWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}#${route}`);
            } else {
                childWin.loadFile(path.join(__dirname, '../dist/index.html'), { hash: route });
            }

            console.log('[Main] Window created successfully');

            // Notify ALL other windows (Main Window)
            BrowserWindow.getAllWindows().forEach(win => {
                if (win.id !== childWin.id) {
                    console.log('[Main] Broadcasting child-window-opened to window:', win.id);
                    win.webContents.send('child-window-opened', route);
                }
            });

            childWin.on('closed', () => {
                console.log('[Main] Child window closed, notifying all windows');
                BrowserWindow.getAllWindows().forEach(win => {
                    if (win.id !== childWin.id && !win.isDestroyed()) {
                        win.webContents.send('child-window-closed', route);
                        win.focus(); // Force focus back to main window
                    }
                });
            });

        } catch (err) {
            console.error('[Main] Failed to create window:', err);
        }
    });

    app.on('will-quit', () => {
        // Unregister all shortcuts.
        const { globalShortcut } = require('electron');
        globalShortcut.unregisterAll();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

