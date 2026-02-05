import 'dotenv/config';
import { app, BrowserWindow, ipcMain } from 'electron';
console.log('--- STARTING MAIN PROCESS V2 (FRESH BUILD) ---');
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
import { projects } from './db/projects.cjs';
import { projectSessions } from './db/project-sessions.cjs';
import { projectAttachments } from './db/project-attachments.cjs';
import { syncUserDataToBackend } from './helpers/telegram-sync.cjs';
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
let splashWindow: BrowserWindow | null = null;
let driveService: any; // Dynamically loaded

const createSplashWindow = () => {
    splashWindow = new BrowserWindow({
        width: 600,
        height: 350,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        center: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // For simple splash logic
        }
    });

    const splashPath = app.isPackaged
        ? path.join(__dirname, 'splash.html')
        : path.join(__dirname, '../electron/splash.html');

    splashWindow.loadFile(splashPath);
    splashWindow.center();
};

const createWindow = () => {
    // Create Splash first
    createSplashWindow();

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        frame: false,
        transparent: false,
        backgroundColor: '#00000000', // Transparent background

        show: false, // Don't show immediately
        icon: path.join(__dirname, app.isPackaged ? '../dist/icon.ico' : '../public/icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
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

    // Handle external links (target="_blank")
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        // Check if URL is external (http/https) and not localhost (dev server)
        const isExternal = url.startsWith('http') && !url.includes('localhost:') && !url.includes('127.0.0.1:');

        if (isExternal) {
            require('electron').shell.openExternal(url);
            return { action: 'deny' };
        }

        // Ensure even internal links don't open new windows (e.g. Ctrl+Click)
        // If it's strictly internal but trying to open a new window, just deny it to keep single-window app feels
        // Or if you want multi-window for internal stuff, allow it. But usually for this app, deny is safer.
        return { action: 'deny' };
    });

    // Prevent navigation to external sites within the same window (e.g. drag & drop link)
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const isExternal = url.startsWith('http') && !url.includes('localhost:') && !url.includes('127.0.0.1:');
        if (isExternal) {
            event.preventDefault();
            require('electron').shell.openExternal(url);
        }
    });

    // Wait for main window to be ready
    mainWindow.once('ready-to-show', () => {
        console.log('[Main] MainWindow ready-to-show triggered');
        splashWindow?.webContents.send('splash-progress', { message: 'Ready!', percent: 100 });

        // Short delay to see the 100%
        setTimeout(() => {
            splashWindow?.close();
            splashWindow = null;
            mainWindow?.show();
            mainWindow?.focus();
        }, 500);
    });

    // Fallback: Force close splash after 10 seconds if ready-to-show doesn't fire
    setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            console.log('[Main] Splash screen timeout - forcing close');
            splashWindow?.close();
            splashWindow = null;
            mainWindow?.show();
            mainWindow?.focus();
        }
    }, 10000);
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
        splashWindow?.webContents.send('splash-progress', { message: 'Loading modules...', percent: 10 });

        // Use pathToFileURL for robust Windows/ASAR handling
        const drivePath = path.join(__dirname, 'services/drive.js');
        const driveUrl = pathToFileURL(drivePath).href;
        console.log('[Main] Loading drive service from:', driveUrl);

        const driveModule = await import(driveUrl);
        driveService = driveModule.driveService;
        console.log('[Main] driveService loaded dynamically.');
        splashWindow?.webContents.send('splash-progress', { message: 'Modules loaded', percent: 30 });
    } catch (e) {
        console.error('[Main] Failed to load driveService:', e);
        log.error('[Main] Failed to load driveService:', e);
    }

    // 1. Init DB
    try {
        splashWindow?.webContents.send('splash-progress', { message: 'Initializing Database...', percent: 40 });
        getDB(); // This runs schema init

        // 2. Run Migration (if needed)
        console.log('[DEBUG] Main: Calling runMigration()...');
        try {
            splashWindow?.webContents.send('splash-progress', { message: 'Checking migrations...', percent: 60 });
            runMigration();
            console.log('[DEBUG] Main: runMigration() returned.');
        } catch (migErr) {
            console.error('[DEBUG] Main: runMigration() CRASHED:', migErr);
        }

        // 3. Verify Content (Temporary Debug)
        splashWindow?.webContents.send('splash-progress', { message: 'Verifying data...', percent: 70 });
        const db = getDB();
        const dbPath = process.env.VITE_DEV_SERVER_URL ? path.join(process.cwd(), 'st4cker.db') : path.join(app.getPath('userData'), 'st4cker.db');
        console.log('--------------------------------------------------');
        console.log('[DEBUG-CRITICAL] DB PATH DETECTED:', dbPath);

        const meta = db.prepare('SELECT * FROM meta').all();
        console.log('[DEBUG-CRITICAL] META TABLE RAW CONTENT:', JSON.stringify(meta, null, 2));

        const userCheck = userProfile.get();
        console.log('[DEBUG-CRITICAL] userProfile.get() RESULT:', JSON.stringify(userCheck, null, 2));
        console.log('--------------------------------------------------');

        try {
            // Only try reading if table exists (it should)
            const courses = db.prepare('SELECT * FROM performance_courses LIMIT 3').all();
            console.log('[DEBUG] Performance Courses (First 3):', courses);
        } catch (err) {
            console.log('[DEBUG] Error reading courses:', err);
        }

        splashWindow?.webContents.send('splash-progress', { message: 'Starting Application...', percent: 90 });

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
    ipcMain.handle('assignments:create', (_, data) => {
        const newAssignment = assignments.create({
            ...data,
            id: randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        // Sync to Telegram
        if (telegramStore && telegramStore.get('paired')) {
            syncUserDataToBackend(telegramStore, telegramSocket).catch(err => console.error('Auto-sync failed:', err));
        }
        return newAssignment;
    });
    ipcMain.handle('assignments:update', (_, id, data) => {
        const result = assignments.update(id, data);
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return result;
    });
    ipcMain.handle('assignments:updateStatus', (_, id, status) => {
        const result = assignments.updateStatus(id, status);
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return result;
    });
    ipcMain.handle('assignments:delete', (_, id) => {
        const result = assignments.delete(id);
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return result;
    });

    // Transactions
    ipcMain.handle('transactions:list', (_, params) => transactions.getAll(params));
    ipcMain.handle('transactions:create', (_, data) => {
        const result = transactions.create({
            ...data,
            id: randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return result;
    });
    ipcMain.handle('transactions:update', (_, id, data) => {
        const result = transactions.update(id, data);
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return result;
    });
    ipcMain.handle('transactions:delete', (_, id) => {
        const result = transactions.delete(id);
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return result;
    });
    ipcMain.handle('transactions:summary', (_, currency) => transactions.getSummary(currency));
    ipcMain.handle('transactions:clear', () => {
        const result = transactions.clearAll();
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return result;
    });

    // Performance
    ipcMain.handle('performance:getSemesters', () => performance.getSemesters());
    ipcMain.handle('performance:upsertSemester', (_, s, i) => {
        const result = performance.upsertSemester(s, i);
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return result;
    });
    ipcMain.handle('performance:getCourses', (_, sem) => performance.getCourses(sem));
    ipcMain.handle('performance:upsertCourse', (_, c) => {
        const result = performance.upsertCourse(c);
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return result;
    });
    ipcMain.handle('performance:updateSksOnly', (_, id, sks) => {
        const result = performance.updateSksOnly(id, sks);
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return result;
    });
    ipcMain.handle('performance:deleteCourse', (_, id) => {
        const result = performance.deleteCourse(id);
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return result;
    });

    // Schedule
    ipcMain.handle('schedule:getAll', () => schedule.getAll());
    ipcMain.handle('schedule:upsert', (_, item) => {
        const result = schedule.upsert(item);
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return result;
    });

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

    // Projects
    ipcMain.handle('projects:list', () => projects.getAll());
    ipcMain.handle('projects:getById', (_, id) => projects.getById(id));
    ipcMain.handle('projects:create', (_, data) => {
        const newProject = {
            ...data,
            id: randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        projects.create(newProject);
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return newProject;
    });
    ipcMain.handle('projects:update', (_, id, data) => {
        const result = projects.update(id, data);
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return result;
    });
    ipcMain.handle('projects:updateProgress', (_, id, progress) => {
        const result = projects.updateProgress(id, progress);
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return result;
    });
    ipcMain.handle('projects:delete', (_, id) => {
        const result = projects.delete(id);
        if (telegramStore && telegramStore.get('paired')) syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
        return result;
    });

    // Project Sessions
    ipcMain.handle('projectSessions:listByProject', (_, projectId) => projectSessions.getByProjectId(projectId));
    ipcMain.handle('projectSessions:getById', (_, id) => projectSessions.getById(id));
    ipcMain.handle('projectSessions:create', (_, data) => {
        const newSession = {
            ...data,
            id: randomUUID(),
            createdAt: new Date().toISOString()
        };
        projectSessions.create(newSession);
        return newSession;
    });
    ipcMain.handle('projectSessions:update', (_, id, data) => projectSessions.update(id, data));
    ipcMain.handle('projectSessions:delete', (_, id) => projectSessions.delete(id));
    ipcMain.handle('projectSessions:getStats', (_, projectId) => projectSessions.getStats(projectId));

    // Project Attachments
    ipcMain.handle('projectAttachments:listByProject', (_, projectId) => projectAttachments.getByProjectId(projectId));
    ipcMain.handle('projectAttachments:create', (_, data) => {
        const newAttachment = {
            ...data,
            id: randomUUID(),
            createdAt: new Date().toISOString()
        };
        projectAttachments.create(newAttachment);
        return newAttachment;
    });
    ipcMain.handle('projectAttachments:delete', (_, id) => projectAttachments.delete(id));

    // Backup & Restore
    ipcMain.handle('db:export', async () => {
        const { dialog } = require('electron');
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const defaultFilename = `st4cker-Backup-${dateStr}.db`;

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

    ipcMain.removeHandler('settings:toggleStartup');
    ipcMain.handle('settings:toggleStartup', (_, openAtLogin) => {
        app.setLoginItemSettings({
            openAtLogin: openAtLogin,
            path: app.getPath('exe') // Important for production
        });
        return app.getLoginItemSettings().openAtLogin;
    });



    // ========================================
    // Telegram Sync - Inline Implementation
    // ========================================
    let telegramStore: any = null;
    let telegramSocket: any = null;
    let initTelegramWebSocket: (token: string) => void; // Defined outer scope
    const WEBSOCKET_URL = process.env.TELEGRAM_WEBSOCKET_URL || 'https://elegant-heart-production.up.railway.app';



    // Initialize Telegram modules async
    async function initTelegramModules() {
        try {
            const Store = (await import('electron-store')).default;
            const { io: ioClient } = await import('socket.io-client');

            telegramStore = new Store({
                name: 'telegram-sync',
                encryptionKey: 'st4cker-telegram-encryption-key'
            });

            // Initialize WebSocket connection
            initTelegramWebSocket = (token: string) => {

                if (telegramSocket) {
                    console.log('[Telegram] Socket instance already exists. Updating token and connecting...');
                    telegramSocket.auth = { token: token }; // Force update token
                    if (!telegramSocket.connected) {
                        telegramSocket.connect();
                    }
                    return;
                }

                console.log(`[Telegram] Initializing WebSocket with token: ${token ? token.slice(0, 8) + '...' : 'NONE'}`);

                console.log(`[Telegram] Connecting to ${WEBSOCKET_URL}`);

                // Force WebSocket transport
                try {
                    telegramSocket = ioClient(WEBSOCKET_URL, {
                        auth: { token: token },
                        transports: ['websocket'],
                        reconnection: true,
                        reconnectionDelay: 1000,
                        reconnectionAttempts: 20
                    });
                    console.log('[Telegram] Socket instance created');
                } catch (err) {
                    console.error('[Telegram] Failed to create socket instance:', err);
                }

                telegramSocket.on('connect', () => {
                    console.log(`[Telegram] WebSocket connected (ID: ${telegramSocket.id})`);
                    BrowserWindow.getAllWindows().forEach((win: BrowserWindow) => {
                        win.webContents.send('telegram:status-change', 'connected');
                    });

                    // Heartbeat Logger
                    setInterval(() => {
                        if (telegramSocket) {
                            // console.log(`[Telegram Heartbeat] Connected: ${telegramSocket.connected}, ID: ${telegramSocket.id}`);
                        }
                    }, 5000);

                    // Auto-sync whenever we connect/reconnect
                    console.log('[Telegram] Connected! Triggering auto-sync...');
                    syncUserDataToBackend(telegramStore, telegramSocket).catch(err => {
                        console.error('[Telegram] Auto-sync failed:', err);
                    });
                });

                telegramSocket.on('disconnect', () => {
                    console.log('[Telegram] WebSocket disconnected');
                    BrowserWindow.getAllWindows().forEach((win: BrowserWindow) => {
                        win.webContents.send('telegram:status-change', 'disconnected');
                    });
                });

                telegramSocket.on('connect_error', async (error: any) => {
                    console.error('[Telegram] Connection error:', error.message);

                    // Check if error is authentication failure
                    if (error.message && (error.message.includes('Authentication') || error.message.includes('Invalid'))) {
                        console.log('[Telegram] Session invalid, attempting auto-recovery...');

                        const deviceId = telegramStore.get('deviceId');
                        const userId = telegramStore.get('userId');

                        if (deviceId && userId) {
                            try {
                                const response = await fetch(`${WEBSOCKET_URL}/api/recover-session`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ deviceId, telegramUserId: userId })
                                });

                                const data = await response.json();

                                if (data.success && data.sessionToken) {
                                    console.log('[Telegram] Session recovered successfully');

                                    // Update stored token
                                    telegramStore.set('sessionToken', data.sessionToken);
                                    telegramStore.set('expiresAt', data.expiresAt);

                                    // Reconnect with new token
                                    if (telegramSocket) {
                                        telegramSocket.auth = { token: data.sessionToken };
                                        telegramSocket.connect();
                                    }

                                    // Notify UI
                                    BrowserWindow.getAllWindows().forEach((win: BrowserWindow) => {
                                        win.webContents.send('telegram:session-recovered');
                                    });
                                } else {
                                    console.error('[Telegram] Auto-recovery failed, session not found');
                                    // Notify UI that pairing is needed
                                    BrowserWindow.getAllWindows().forEach((win: BrowserWindow) => {
                                        win.webContents.send('telegram:session-expired', { recoverable: false });
                                    });
                                }
                            } catch (recoveryError) {
                                console.error('[Telegram] Auto-recovery error:', recoveryError);
                                BrowserWindow.getAllWindows().forEach((win: BrowserWindow) => {
                                    win.webContents.send('telegram:session-expired', { recoverable: false });
                                });
                            }
                        } else {
                            console.log('[Telegram] No device ID stored, cannot auto-recover');
                            BrowserWindow.getAllWindows().forEach((win: BrowserWindow) => {
                                win.webContents.send('telegram:session-expired', { recoverable: false });
                            });
                        }
                    }
                });

                telegramSocket.onAny((event: any, ...args: any[]) => {
                    console.log(`[Telegram Debug] Incoming Event: ${event}`, args);
                });

                telegramSocket.on('telegram-event', async (event: any) => {
                    console.log('[Telegram Debug] Raw Event Payload:', JSON.stringify(event, null, 2));
                    console.log('[Telegram] Received event:', event.eventType, event.eventId);

                    // 1. Idempotency Check: Check applied_events table
                    if (event.eventId) {
                        try {
                            const db = getDB();
                            const existing = db.prepare('SELECT event_id FROM applied_events WHERE event_id = ?').get(event.eventId);
                            if (existing) {
                                console.log(`[Telegram] Event ${event.eventId} already applied. Auto-ACK.`);
                                telegramSocket.emit('event-ack', event.eventId);
                                return;
                            }
                        } catch (e) {
                            console.error('[Telegram] Error checking duplication:', e);
                        }
                    }

                    let success = false;

                    try {
                        // --- EVENT PROCESSING ---
                        if (event.eventType === 'task.created') {
                            const { courseId, courseName, type, dueDate, notes, semester } = event.payload;

                            // SAFE PARSING SEMESTER
                            let parsedSemester = 1;
                            try {
                                if (typeof semester === 'string') {
                                    parsedSemester = parseInt(semester.replace('Semester ', ''));
                                } else if (typeof semester === 'number') {
                                    parsedSemester = semester;
                                }
                                if (isNaN(parsedSemester)) parsedSemester = 1;
                            } catch (e) {
                                console.error('[Telegram] Error parsing semester:', semester, e);
                            }

                            // Create assignment
                            const newAssignment = {
                                id: randomUUID(),
                                title: type || 'Untitled Task', // Fallback
                                course: courseName || 'General', // Fallback
                                type: type || 'Tugas',
                                status: 'pending',
                                deadline: dueDate,
                                note: notes || '',
                                semester: parsedSemester,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            };

                            assignments.create(newAssignment);
                            console.log('[Telegram] Assignment created from event:', newAssignment.id);

                            new (require('electron').Notification)({
                                title: 'New Task Added',
                                body: `${courseName} - ${type}\nDue: ${new Date(dueDate).toLocaleDateString()}`
                            }).show();
                            success = true;
                        }

                        else if (event.eventType === 'task.updated') {
                            const { id, status, ...rest } = event.payload;
                            console.log(`[Telegram Debug] processing task.updated for ID: ${id}`);
                            console.log('[Telegram Debug] Payload keys:', Object.keys(rest));

                            const updates: any = {};

                            // Map Status
                            if (status) {
                                const statusMap: Record<string, string> = {
                                    'pending': 'to-do',
                                    'in-progress': 'progress', // Frontend expects 'progress' NOT 'in-progress'
                                    'completed': 'done'        // Frontend expects 'done' NOT 'completed'
                                };
                                updates.status = statusMap[status] || status;
                            }

                            // Map Other Fields
                            if (rest.title) updates.title = rest.title;
                            if (rest.type) updates.type = rest.type;
                            if (rest.course) updates.course = rest.course;
                            if (rest.note !== undefined) updates.note = rest.note;

                            console.log('[Telegram Debug] Constructing DB update:', updates);

                            if (Object.keys(updates).length > 0) {
                                try {
                                    const result = assignments.update(id, updates);
                                    console.log(`[Telegram Debug] assignments.update result: ${result}`);
                                    if (result) {
                                        new (require('electron').Notification)({
                                            title: 'Task Updated',
                                            body: `Task updated successfully`
                                        }).show();
                                        success = true;
                                    } else {
                                        console.error(`[Telegram Error] Update failed - Task ID ${id} not found or no changes made.`);
                                    }
                                } catch (updateErr) {
                                    console.error('[Telegram Error] DB Update Exception:', updateErr);
                                }
                            } else {
                                console.warn('[Telegram Debug] No valid updates found in payload.');
                            }
                        }

                        else if (event.eventType === 'task.deleted') {
                            const { id } = event.payload;
                            console.log(`[Telegram] Received task.deleted for ${id}`);

                            if (assignments.delete(id)) {
                                new (require('electron').Notification)({
                                    title: 'Task Deleted',
                                    body: 'Active task removed'
                                }).show();
                                success = true;
                            }
                        }

                        else if (event.eventType === 'transaction.deleted') {
                            const { id } = event.payload;
                            console.log(`[Telegram] Received transaction.deleted for ${id}`);
                            if (transactions.delete(id)) {
                                new (require('electron').Notification)({
                                    title: 'Transaction Deleted',
                                    body: 'Transaction removed'
                                }).show();
                                success = true;
                            }
                        }

                        else if (event.eventType === 'transaction.updated') {
                            const { id, updates } = event.payload;
                            console.log(`[Telegram] Received transaction.updated for ${id}`, updates);

                            const dbUpdates: any = {};
                            if (updates.amount) dbUpdates.amount = updates.amount;
                            if (updates.note) {
                                dbUpdates.title = updates.note;
                            }

                            if (transactions.update(id, dbUpdates)) {
                                new (require('electron').Notification)({
                                    title: 'Transaction Updated',
                                    body: 'Transaction details updated'
                                }).show();
                                success = true;
                            }
                        }

                        else if (event.eventType === 'project.created') {
                            const { title, description, deadline, priority, type, courseId } = event.payload;

                            // Create project
                            // Map incoming priority/status if needed
                            const newProject = {
                                id: randomUUID(),
                                title: title || 'Untitled Project', // Fallback for legacy events
                                description: description || '',
                                deadline: deadline,
                                priority: priority || 'medium', // low, medium, high
                                status: 'active', // active, completed, archived
                                type: type || 'personal', // personal, course
                                courseId: courseId || null,
                                progress: 0,
                                startDate: new Date().toISOString().split('T')[0], // Default to today as Telegram doesn't send it
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            };

                            projects.create(newProject);
                            console.log('[Telegram] Project created from event:', newProject.id);

                            // Handle Attachments
                            if (event.payload.attachments && Array.isArray(event.payload.attachments)) {
                                console.log(`[Telegram] Processing ${event.payload.attachments.length} attachments for project ${newProject.id}`);
                                for (const att of event.payload.attachments) {
                                    try {
                                        projectAttachments.create({
                                            id: att.id || randomUUID(),
                                            projectId: newProject.id,
                                            type: att.type || 'link',
                                            name: att.title || att.name || 'Attachment',
                                            path: att.url || att.path,
                                            size: null,
                                            createdAt: new Date().toISOString()
                                        });
                                        console.log('[Telegram] Attachment created:', att.title);
                                    } catch (attErr) {
                                        console.error('[Telegram] Failed to create attachment:', attErr);
                                    }
                                }
                            }

                            new (require('electron').Notification)({
                                title: 'New Project Created',
                                body: `${title}\nDue: ${deadline}`
                            }).show();
                            success = true;
                        }

                        else if (event.eventType === 'project.updated') {
                            const { id, updates } = event.payload;
                            console.log(`[Telegram] Received project.updated for ${id}`, updates);

                            const dbUpdates: any = {};
                            if (updates.name) dbUpdates.title = updates.name; // Map name -> title
                            if (updates.deadline) dbUpdates.deadline = updates.deadline;
                            if (updates.priority) dbUpdates.priority = updates.priority;

                            // Map Status specifically if present
                            if (updates.status) {
                                let dbStatus = 'active';
                                if (updates.status === 'completed') dbStatus = 'completed';
                                if (updates.status === 'on_hold') dbStatus = 'on_hold';
                                if (updates.status === 'in_progress') dbStatus = 'active'; // Map specifically
                                dbUpdates.status = dbStatus;
                            }

                            if (Object.keys(dbUpdates).length > 0) {
                                try {
                                    if (projects.update(id, dbUpdates)) {
                                        new (require('electron').Notification)({
                                            title: 'Project Updated',
                                            body: `Project updated from Telegram`
                                        }).show();
                                        success = true;
                                    }
                                } catch (e) {
                                    console.error('[Telegram] Failed to update project:', e);
                                }
                            }
                        }

                        else if (event.eventType === 'project.deleted') {
                            const { id } = event.payload;
                            console.log(`[Telegram] Received project.deleted for ${id}`);

                            try {
                                if (projects.delete(id)) {
                                    new (require('electron').Notification)({
                                        title: 'Project Deleted',
                                        body: 'Project removed via Telegram'
                                    }).show();
                                    success = true;
                                }
                            } catch (e) {
                                console.error('[Telegram] Failed to delete project:', e);
                            }
                        }

                        else if (event.eventType === 'progress.logged') {
                            const payload = event.payload;
                            // Payload: { projectId, duration, note, status, progress, loggedAt }
                            console.log('[Telegram] Received progress.logged:', payload);

                            const projectId = payload.projectId;
                            const project = projects.getById(projectId) as any;

                            if (project) {
                                const duration = payload.duration || 0;
                                const note = payload.note || '';
                                const newProgress = payload.progress !== undefined ? payload.progress : (project.totalProgress || 0);
                                const newStatus = payload.status || project.status;

                                // 1. Create Session Log
                                // projectSessions is imported from ./db/project-sessions.cjs
                                projectSessions.create({
                                    id: event.eventId,
                                    projectId: projectId,
                                    duration: duration,
                                    note: note,
                                    progressBefore: project.totalProgress || 0,
                                    progressAfter: newProgress,
                                    createdAt: payload.loggedAt || new Date().toISOString(),
                                    sessionDate: payload.loggedAt || new Date().toISOString()
                                });

                                // 2. Update Project Progress (Redundant if projectSessions.create does it, but kept for safety or if logic changes)
                                // projects.updateProgress(projectId, newProgress); 
                                // projectSessions.create already updates progress in 'project-sessions.cts', so we can skip or keep.
                                // Keeping it is fine, just an extra update.

                                // 3. Update Project Status if changed
                                if (newStatus && newStatus !== project.status) {
                                    const db = getDB();
                                    // Status map: Active -> in_progress, Completed -> completed, On Hold -> on_hold
                                    let dbStatus = 'in_progress';
                                    if (newStatus.toLowerCase() === 'completed') dbStatus = 'completed';
                                    if (newStatus.toLowerCase() === 'on hold') dbStatus = 'on_hold';
                                    if (newStatus.toLowerCase() === 'active') dbStatus = 'in_progress';

                                    db.prepare('UPDATE projects SET status = ? WHERE id = ?').run(dbStatus, projectId);
                                }

                                // 4. Force UI Refresh Immediately
                                BrowserWindow.getAllWindows().forEach(win => {
                                    if (!win.isDestroyed()) win.webContents.send('refresh-data');
                                });

                                new (require('electron').Notification)({
                                    title: 'Progress Logged',
                                    body: `${project.title}: ${newProgress}% (${duration}m)`
                                }).show();
                                success = true;
                            } else {
                                console.error('[Telegram] Project not found for progress log:', projectId);
                                // Force refresh anyway, maybe the project list is just stale?
                                BrowserWindow.getAllWindows().forEach(win => {
                                    if (!win.isDestroyed()) win.webContents.send('refresh-data');
                                });
                            }
                        }
                        else if (event.eventType === 'transaction.created') {
                            const payload = event.payload;
                            console.log('[Telegram] Received transaction.created:', payload);

                            // HELPER TO EXTRACT VALUE
                            const getValue = (field: any) => (field && typeof field === 'object' && field.value !== undefined) ? field.value : field;

                            const noteVal = getValue(payload.note);
                            const amtVal = getValue(payload.amount);
                            const catVal = getValue(payload.category);
                            const typeVal = getValue(payload.type);

                            const newTransaction = {
                                id: event.eventId, // Using eventId as transaction ID to safe-guard duplication naturally
                                title: noteVal || payload.description || typeVal,
                                type: typeVal,
                                category: catVal,
                                amount: typeof amtVal === 'string' ? parseFloat(amtVal) : amtVal,
                                currency: 'IDR',
                                date: payload.date || new Date().toISOString(),
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            };

                            transactions.create(newTransaction);

                            new (require('electron').Notification)({
                                title: 'Transaction Added',
                                body: `${typeVal === 'income' ? '+' : '-'} Rp ${(typeof amtVal === 'number' ? amtVal : parseFloat(amtVal)).toLocaleString('id-ID')} (${catVal})`
                            }).show();
                            success = true;
                        }

                        else if (event.eventType === 'transaction.deleted') {
                            const { id } = event.payload;
                            if (id) {
                                console.log('[Telegram] Deleting transaction:', id);
                                transactions.delete(id);
                                success = true;
                            }
                        }

                        else if (event.eventType === 'transaction.updated') {
                            const { id, updates } = event.payload;
                            // updates should map to DB columns: amount, category, note (title)
                            if (id && updates) {
                                console.log('[Telegram] Updating transaction:', id, updates);

                                // Map 'note' from bot to 'title' in DB if present
                                const dbUpdates: any = { ...updates };
                                if (dbUpdates.note) {
                                    dbUpdates.title = dbUpdates.note;
                                    delete dbUpdates.note;
                                }

                                transactions.update(id, dbUpdates);
                                success = true;
                            }
                        }

                        // --- POST PROCESSING ---
                        if (success) {
                            // 1. Notify UI
                            BrowserWindow.getAllWindows().forEach(win => {
                                win.webContents.send('refresh-data');
                            });

                            // 2. Mark as Applied & ACK
                            if (event.eventId) {
                                try {
                                    const db = getDB();
                                    db.prepare('INSERT INTO applied_events (event_id, event_type, applied_at, source) VALUES (?, ?, ?, ?)').run(
                                        event.eventId,
                                        event.eventType,
                                        Date.now(),
                                        'websocket'
                                    );

                                    console.log(`[Telegram] Acknowledging event ${event.eventId}`);
                                    telegramSocket.emit('event-ack', event.eventId);
                                } catch (dbError) {
                                    console.error('[Telegram] Failed to store applied_event:', dbError);
                                    // Try to ack anyway to prevent endless loop of delivery if logic succeeded
                                    telegramSocket.emit('event-ack', event.eventId);
                                }
                            }

                            // 3. Sync Back to Bot (Update menu state etc)
                            if (telegramStore && telegramStore.get('paired')) {
                                syncUserDataToBackend(telegramStore, telegramSocket).catch(err =>
                                    console.error('[Telegram] Auto-sync failed:', err)
                                );
                            }
                        }

                    } catch (error) {
                        console.error(`[Telegram] Failed to process ${event.eventType}:`, error);
                        // Add notification for debug
                        new (require('electron').Notification)({
                            title: 'Telegram Sync Error',
                            body: `Failed to process ${event.eventType}. Check logs.`
                        }).show();
                    }
                });

                // Check if paired on app start and connect
                const isPaired = telegramStore.get('paired', false);
                const storedSessionToken = telegramStore.get('sessionToken');
                if (isPaired && storedSessionToken) {
                    initTelegramWebSocket(storedSessionToken as string);
                }
            } // End initTelegramModules

            // Define IPC handlers INSIDE initTelegramModules scope so they can access telegramStore/Socket?
            // actually they are global ipcMain, but telegramStore is local to this function scope if defined inside?
            // Re-reading code: telegramStore was defined OUTSIDE as 'let telegramStore: any = null'.
            // So handlers below are fine.

            // Removed recursive call

        } catch (error) {
            console.error('[Telegram] Failed to initialize modules:', error);
        }
    }

    // Call the async init wrapper
    initTelegramModules();

    // IPC Handlers for Telegram (Moved outside wrapper but check nulls)
    ipcMain.handle('telegram:verify-pairing', async (_, code: string) => {
        if (!telegramStore) return { success: false, error: 'Telegram not initialized' };

        try {
            const response = await fetch(`${WEBSOCKET_URL}/api/verify-pairing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            const data = await response.json();

            if (data.success) {
                // Store session data
                telegramStore.set('sessionToken', data.sessionToken);
                telegramStore.set('deviceId', data.deviceId);
                telegramStore.set('userId', data.telegramUserId);
                telegramStore.set('paired', true);
                telegramStore.set('expiresAt', data.expiresAt);

                // Register device with backend
                try {
                    const os = await import('os');
                    await fetch(`${WEBSOCKET_URL}/api/register-device`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionToken: data.sessionToken,
                            deviceId: data.deviceId,
                            deviceName: os.hostname()
                        })
                    });
                    console.log('[Telegram] Device registered successfully');
                } catch (regError) {
                    console.error('[Telegram] Device registration failed (non-fatal):', regError);
                }

                // Initialize WebSocket with new token
                if (initTelegramWebSocket) {
                    initTelegramWebSocket(data.sessionToken);
                }

                // FORCE SYNC (NEW)
                setTimeout(() => {
                    if (telegramStore && telegramSocket) {
                        console.log('[Telegram] Force syncing data after pairing...');
                        syncUserDataToBackend(telegramStore, telegramSocket).catch(console.error);
                    }
                }, 2000);

                return { success: true };
            }

            return { success: false, error: data.error || 'Invalid code' };
        } catch (error: any) {
            console.error('[Telegram] Verify pairing error:', error);
            return { success: false, error: 'Connection failed' };
        }
    });

    ipcMain.handle('telegram:sync-now', async () => {
        if (!telegramStore || !telegramStore.get('paired')) return { success: false, error: 'Not paired' };
        try {
            await syncUserDataToBackend(telegramStore, telegramSocket);
            return { success: true };
        } catch (error: any) {
            console.error('[Telegram] Sync failed:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('telegram:unpair', async () => {
        if (!telegramStore) return { success: false };
        const sessionToken = telegramStore.get('sessionToken');
        if (sessionToken) {
            try {
                await fetch(`${WEBSOCKET_URL}/api/unpair`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken })
                });
            } catch (e) { }
        }
        if (telegramSocket) {
            telegramSocket.close();
            telegramSocket = null;
        }
        telegramStore.delete('sessionToken');
        telegramStore.delete('paired');
        telegramStore.delete('expiresAt');
        return { success: true };
    });

    ipcMain.handle('telegram:get-status', () => {
        if (!telegramStore) return { paired: false, status: 'unknown' };
        const paired = telegramStore.get('paired', false);
        const expiresAt = telegramStore.get('expiresAt');
        const deviceId = telegramStore.get('deviceId');
        const userId = telegramStore.get('userId');
        const connected = telegramSocket?.connected || false;
        return {
            paired,
            expiresAt,
            deviceId,
            userId,
            status: paired ? (connected ? 'connected' : 'disconnected') : 'unknown'
        };
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

    // Utilities (Shell & File System)
    const { shell } = require('electron');
    ipcMain.removeHandler('utils:openExternal');
    ipcMain.handle('utils:openExternal', (_, url) => shell.openExternal(url));
    ipcMain.removeHandler('utils:openPath');
    ipcMain.handle('utils:openPath', (_, path) => shell.openPath(path));
    ipcMain.removeHandler('utils:saveFile');
    ipcMain.handle('utils:saveFile', async (_, content, defaultName, extensions = ['csv']) => {
        const win = BrowserWindow.getFocusedWindow();
        if (!win) return { success: false, error: 'No focused window' };

        const { dialog } = require('electron');
        const fs = require('fs/promises');

        try {
            const { filePath } = await dialog.showSaveDialog(win, {
                title: 'Save File',
                defaultPath: defaultName,
                filters: [{ name: 'Export File', extensions }]
            });

            if (!filePath) return { success: false, canceled: true };

            await fs.writeFile(filePath, content, 'utf-8');
            return { success: true, filePath };
        } catch (error: any) {
            console.error('File Save Error:', error);
            return { success: false, error: error.message };
        }
    });

    // Toggle DevTools for debugging in production
    const { globalShortcut } = require('electron');
    globalShortcut.register('F12', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) win.webContents.toggleDevTools();
    });

    createWindow();

    // Check Auto-Backup & Subscriptions (After a short delay to let things settle)
    setTimeout(async () => {
        // 1. Auto Backup
        if (driveService) {
            driveService.checkAndRunAutoBackup().catch((err: any) => console.error('Auto-backup check failed:', err));
        } else {
            console.log('[Main] driveService not available for auto-backup check.');
        }

        // 2. Telegram Auto-Connect
        try {
            // Do NOT re-init modules. They are init at line ~769.
            // Just check if we need to connect.
            if (telegramStore && initTelegramWebSocket) {
                const sessionToken = telegramStore.get('sessionToken');
                if (sessionToken && (!telegramSocket || !telegramSocket.connected)) {
                    console.log('[Main] Found Telegram session, connecting...');
                    initTelegramWebSocket(sessionToken);
                }
            } else {
                console.log('[Main] Telegram modules not ready yet or not paired.');
            }
        } catch (err) {
            console.error('[Main] Telegram auto-connect failed:', err);
        }

        // 3. Check Subscriptions & Recurring Transactions
        try {
            console.log('[Main] Checking for due subscriptions...');
            const result = subscriptions.checkAndProcessDeductions();
            if (result.deductionsMade > 0) {
                console.log(`[Main] Processed ${result.deductionsMade} recurring transactions.`);
                // Notify windows to refresh data
                BrowserWindow.getAllWindows().forEach(win => {
                    win.webContents.send('refresh-data');
                });
            }
        } catch (err) {
            console.error('[Main] Failed to process subscriptions:', err);
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

    // Notifications
    ipcMain.handle('notifications:send', (_, title, body) => {
        const { Notification } = require('electron');
        new Notification({ title, body }).show();
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

