"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const electron_1 = require("electron");
const url_1 = require("url");
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const crypto_1 = require("crypto");
// Load .env from the correct path (dev vs production)
const envPaths = [
    path_1.default.join(process.cwd(), '.env'), // Dev: project root
    path_1.default.join(__dirname, '..', '.env'), // Production: next to asar
    path_1.default.join(electron_1.app?.getPath?.('userData') || '', '.env'), // Production: userData folder
];
for (const envPath of envPaths) {
    if ((0, fs_1.existsSync)(envPath)) {
        dotenv_1.default.config({ path: envPath });
        console.log(`[Main] Loaded .env from: ${envPath}`);
        break;
    }
}
console.log('--- STARTING MAIN PROCESS V2 (FRESH BUILD) ---');
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
const projects_cjs_1 = require("./db/projects.cjs");
const project_sessions_cjs_1 = require("./db/project-sessions.cjs");
const project_attachments_cjs_1 = require("./db/project-attachments.cjs");
const telegram_sync_cjs_1 = require("./helpers/telegram-sync.cjs");
// driveService will be imported dynamically
// JSON store deprecated — migrated to SQLite
// SimpleStore removed.
// Startup handled by Electron
// Single Instance Lock - Prevent multiple instances
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    // Another instance is already running, quit this one
    electron_1.app.quit();
}
else {
    // This is the first instance, set up second-instance handler
    electron_1.app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, focus our window instead
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
}
let mainWindow = null;
let splashWindow = null;
let driveService; // Dynamically loaded
const createSplashWindow = () => {
    splashWindow = new electron_1.BrowserWindow({
        width: 600,
        height: 350,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        center: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Required: splash.html uses require('electron').ipcRenderer directly
        }
    });
    const splashPath = electron_1.app.isPackaged
        ? path_1.default.join(__dirname, 'splash.html')
        : path_1.default.join(__dirname, '../electron/splash.html');
    splashWindow.loadFile(splashPath);
    splashWindow.center();
};
const createWindow = () => {
    // Create Splash first
    createSplashWindow();
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        frame: false,
        transparent: false,
        backgroundColor: '#00000000', // Transparent background
        show: false, // Don't show immediately
        icon: path_1.default.join(__dirname, electron_1.app.isPackaged ? '../dist/icon.ico' : '../public/icon.ico'),
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.cjs'),
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
        splashWindow?.webContents.send('splash-progress', { message: 'Loading modules...', percent: 10 });
        // Use pathToFileURL for robust Windows/ASAR handling
        const drivePath = path_1.default.join(__dirname, 'services/drive.js');
        const driveUrl = (0, url_1.pathToFileURL)(drivePath).href;
        console.log('[Main] Loading drive service from:', driveUrl);
        const driveModule = await import(driveUrl);
        driveService = driveModule.driveService;
        console.log('[Main] driveService loaded dynamically.');
        splashWindow?.webContents.send('splash-progress', { message: 'Modules loaded', percent: 30 });
    }
    catch (e) {
        console.error('[Main] Failed to load driveService:', e);
        main_js_1.default.error('[Main] Failed to load driveService:', e);
    }
    // 1. Init DB
    try {
        splashWindow?.webContents.send('splash-progress', { message: 'Initializing Database...', percent: 40 });
        (0, index_cjs_1.getDB)(); // This runs schema init
        // 2. Run Migration (if needed)
        console.log('[DEBUG] Main: Calling runMigration()...');
        try {
            splashWindow?.webContents.send('splash-progress', { message: 'Checking migrations...', percent: 60 });
            (0, migration_cjs_1.runMigration)();
            console.log('[DEBUG] Main: runMigration() returned.');
        }
        catch (migErr) {
            console.error('[DEBUG] Main: runMigration() CRASHED:', migErr);
        }
        // 3. Verify Content (Temporary Debug)
        splashWindow?.webContents.send('splash-progress', { message: 'Verifying data...', percent: 70 });
        const db = (0, index_cjs_1.getDB)();
        console.log('[Main] Database initialized and verified');
        try {
            // Only try reading if table exists (it should)
            const courses = db.prepare('SELECT * FROM performance_courses LIMIT 3').all();
            console.log('[DEBUG] Performance Courses (First 3):', courses);
        }
        catch (err) {
            console.log('[DEBUG] Error reading courses:', err);
        }
        splashWindow?.webContents.send('splash-progress', { message: 'Starting Application...', percent: 90 });
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
    electron_1.ipcMain.handle('assignments:create', (_, data) => {
        const id = (0, crypto_1.randomUUID)();
        const newAssignment = assignments_cjs_1.assignments.create({
            ...data,
            id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        // Queue VPS sync (works offline)
        syncCRUD('task', 'create', id, {
            title: data.title || data.type || 'Tugas',
            course: data.course || '',
            deadline: data.deadline || new Date().toISOString(),
            type: data.type || 'Tugas',
            note: data.note || ''
        }).catch(console.error);
        return newAssignment;
    });
    electron_1.ipcMain.handle('assignments:update', (_, id, data) => {
        const result = assignments_cjs_1.assignments.update(id, data);
        syncCRUD('task', 'update', id, {
            status: data.status,
            deadline: data.deadline
        }).catch(console.error);
        return result;
    });
    electron_1.ipcMain.handle('assignments:updateStatus', (_, id, status) => {
        const result = assignments_cjs_1.assignments.updateStatus(id, status);
        syncCRUD('task', 'update', id, { status }).catch(console.error);
        return result;
    });
    electron_1.ipcMain.handle('assignments:delete', (_, id) => {
        const result = assignments_cjs_1.assignments.delete(id);
        syncCRUD('task', 'delete', id, {}).catch(console.error);
        return result;
    });
    // Transactions
    electron_1.ipcMain.handle('transactions:list', (_, params) => transactions_cjs_1.transactions.getAll(params));
    electron_1.ipcMain.handle('transactions:create', (_, data) => {
        const id = (0, crypto_1.randomUUID)();
        const result = transactions_cjs_1.transactions.create({
            ...data,
            id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        syncCRUD('transaction', 'create', id, {
            amount: data.amount,
            type: data.type,
            category: data.category,
            title: data.title || data.category,
            date: data.date || new Date().toISOString()
        }).catch(console.error);
        return result;
    });
    electron_1.ipcMain.handle('transactions:update', (_, id, data) => {
        const result = transactions_cjs_1.transactions.update(id, data);
        syncCRUD('transaction', 'update', id, data).catch(console.error);
        return result;
    });
    electron_1.ipcMain.handle('transactions:delete', (_, id) => {
        const result = transactions_cjs_1.transactions.delete(id);
        syncCRUD('transaction', 'delete', id, {}).catch(console.error);
        return result;
    });
    electron_1.ipcMain.handle('transactions:summary', (_, currency) => transactions_cjs_1.transactions.getSummary(currency));
    electron_1.ipcMain.handle('transactions:clear', () => {
        const result = transactions_cjs_1.transactions.clearAll();
        return result;
    });
    // Performance
    electron_1.ipcMain.handle('performance:getSemesters', () => performance_cjs_1.performance.getSemesters());
    electron_1.ipcMain.handle('performance:upsertSemester', (_, s, i) => {
        const result = performance_cjs_1.performance.upsertSemester(s, i);
        if (telegramStore && telegramStore.get('paired'))
            (0, telegram_sync_cjs_1.syncUserDataToBackend)(telegramStore, telegramSocket).catch(console.error);
        return result;
    });
    electron_1.ipcMain.handle('performance:getCourses', (_, sem) => performance_cjs_1.performance.getCourses(sem));
    electron_1.ipcMain.handle('performance:upsertCourse', (_, c) => {
        const result = performance_cjs_1.performance.upsertCourse(c);
        if (telegramStore && telegramStore.get('paired'))
            (0, telegram_sync_cjs_1.syncUserDataToBackend)(telegramStore, telegramSocket).catch(console.error);
        return result;
    });
    electron_1.ipcMain.handle('performance:updateSksOnly', (_, id, sks) => {
        const result = performance_cjs_1.performance.updateSksOnly(id, sks);
        if (telegramStore && telegramStore.get('paired'))
            (0, telegram_sync_cjs_1.syncUserDataToBackend)(telegramStore, telegramSocket).catch(console.error);
        return result;
    });
    electron_1.ipcMain.handle('performance:deleteCourse', (_, id) => {
        const result = performance_cjs_1.performance.deleteCourse(id);
        if (telegramStore && telegramStore.get('paired'))
            (0, telegram_sync_cjs_1.syncUserDataToBackend)(telegramStore, telegramSocket).catch(console.error);
        return result;
    });
    // Schedule
    electron_1.ipcMain.handle('schedule:getAll', () => schedule_cjs_1.schedule.getAll());
    electron_1.ipcMain.handle('schedule:upsert', (_, item) => {
        const result = schedule_cjs_1.schedule.upsert(item);
        if (telegramStore && telegramStore.get('paired'))
            (0, telegram_sync_cjs_1.syncUserDataToBackend)(telegramStore, telegramSocket).catch(console.error);
        return result;
    });
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
    // Projects
    electron_1.ipcMain.handle('projects:list', () => projects_cjs_1.projects.getAll());
    electron_1.ipcMain.handle('projects:getById', (_, id) => projects_cjs_1.projects.getById(id));
    electron_1.ipcMain.handle('projects:create', (_, data) => {
        const newProject = {
            ...data,
            id: (0, crypto_1.randomUUID)(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        projects_cjs_1.projects.create(newProject);
        syncCRUD('project', 'create', newProject.id, {
            title: data.title,
            description: data.description || '',
            deadline: data.deadline,
            priority: data.priority || 'medium',
            type: data.type || 'personal',
            courseName: data.courseName || ''
        }).catch(console.error);
        return newProject;
    });
    electron_1.ipcMain.handle('projects:update', (_, id, data) => {
        const result = projects_cjs_1.projects.update(id, data);
        syncCRUD('project', 'update', id, {
            title: data.title,
            status: data.status,
            priority: data.priority,
            description: data.description
        }).catch(console.error);
        return result;
    });
    electron_1.ipcMain.handle('projects:updateProgress', (_, id, progress) => {
        const result = projects_cjs_1.projects.updateProgress(id, progress);
        syncCRUD('project', 'update', id, { totalProgress: progress }).catch(console.error);
        return result;
    });
    electron_1.ipcMain.handle('projects:delete', (_, id) => {
        const result = projects_cjs_1.projects.delete(id);
        syncCRUD('project', 'delete', id, {}).catch(console.error);
        return result;
    });
    // Project Sessions
    electron_1.ipcMain.handle('projectSessions:listByProject', (_, projectId) => project_sessions_cjs_1.projectSessions.getByProjectId(projectId));
    electron_1.ipcMain.handle('projectSessions:getById', (_, id) => project_sessions_cjs_1.projectSessions.getById(id));
    electron_1.ipcMain.handle('projectSessions:create', (_, data) => {
        const newSession = {
            ...data,
            id: (0, crypto_1.randomUUID)(),
            createdAt: new Date().toISOString()
        };
        project_sessions_cjs_1.projectSessions.create(newSession);
        return newSession;
    });
    electron_1.ipcMain.handle('projectSessions:update', (_, id, data) => project_sessions_cjs_1.projectSessions.update(id, data));
    electron_1.ipcMain.handle('projectSessions:delete', (_, id) => project_sessions_cjs_1.projectSessions.delete(id));
    electron_1.ipcMain.handle('projectSessions:getStats', (_, projectId) => project_sessions_cjs_1.projectSessions.getStats(projectId));
    // Project Attachments
    electron_1.ipcMain.handle('projectAttachments:listByProject', (_, projectId) => project_attachments_cjs_1.projectAttachments.getByProjectId(projectId));
    electron_1.ipcMain.handle('projectAttachments:create', (_, data) => {
        const newAttachment = {
            ...data,
            id: (0, crypto_1.randomUUID)(),
            createdAt: new Date().toISOString()
        };
        project_attachments_cjs_1.projectAttachments.create(newAttachment);
        return newAttachment;
    });
    electron_1.ipcMain.handle('projectAttachments:delete', (_, id) => project_attachments_cjs_1.projectAttachments.delete(id));
    // Backup & Restore
    electron_1.ipcMain.handle('db:export', async () => {
        const { dialog } = require('electron');
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const defaultFilename = `st4cker-Backup-${dateStr}.db`;
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
    electron_1.ipcMain.removeHandler('settings:toggleStartup');
    electron_1.ipcMain.handle('settings:toggleStartup', (_, openAtLogin) => {
        electron_1.app.setLoginItemSettings({
            openAtLogin: openAtLogin,
            path: electron_1.app.getPath('exe') // Important for production
        });
        return electron_1.app.getLoginItemSettings().openAtLogin;
    });
    // ========================================
    // Telegram Sync - Inline Implementation
    // ========================================
    let telegramStore = null;
    let telegramSocket = null;
    let initTelegramWebSocket; // Defined outer scope
    const WEBSOCKET_URL = process.env.TELEGRAM_WEBSOCKET_URL || 'http://103.127.134.173:3000';
    const API_KEY = process.env.AGENT_API_KEY;
    if (!API_KEY) {
        console.warn('[Telegram] WARNING: AGENT_API_KEY env var is not set. VPS sync will fail.');
    }
    // ========================================
    // VPS Sync Helpers (Offline-First)
    // ========================================
    async function syncToVPS(method, apiPath, body) {
        if (!WEBSOCKET_URL || !API_KEY)
            return false; // Can't sync without config
        try {
            const res = await fetch(`${WEBSOCKET_URL}/api/v1${apiPath}`, {
                method,
                headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'x-source': 'desktop' },
                body: body ? JSON.stringify(body) : undefined
            });
            if (!res.ok)
                console.error(`[VPS Sync] ${method} ${apiPath} failed:`, res.status);
            return res.ok;
        }
        catch (e) {
            console.log(`[VPS Sync] Offline or error: ${e.message}`);
            return false;
        }
    }
    function queueSync(entityType, action, entityId, payload) {
        try {
            const db = (0, index_cjs_1.getDB)();
            db.prepare(`INSERT OR REPLACE INTO sync_queue (id, entity_type, action, entity_id, payload, created_at, synced) VALUES (?, ?, ?, ?, ?, ?, 0)`)
                .run((0, crypto_1.randomUUID)(), entityType, action, entityId, JSON.stringify(payload), new Date().toISOString());
            console.log(`[Sync Queue] Queued ${action} ${entityType} ${entityId}`);
        }
        catch (e) {
            console.error('[Sync Queue] Error:', e);
        }
    }
    async function processQueue() {
        const db = (0, index_cjs_1.getDB)();
        const pending = db.prepare('SELECT * FROM sync_queue WHERE synced = 0 ORDER BY created_at').all();
        if (pending.length === 0)
            return;
        console.log(`[Sync Queue] Processing ${pending.length} pending items...`);
        for (const item of pending) {
            const payload = JSON.parse(item.payload || '{}');
            let success = false;
            if (item.action === 'create') {
                success = await syncToVPS('POST', `/${item.entity_type}s`, { id: item.entity_id, ...payload });
            }
            else if (item.action === 'update') {
                success = await syncToVPS('PATCH', `/${item.entity_type}s/${item.entity_id}`, payload);
            }
            else if (item.action === 'delete') {
                success = await syncToVPS('DELETE', `/${item.entity_type}s/${item.entity_id}`);
            }
            if (success) {
                db.prepare('UPDATE sync_queue SET synced = 1 WHERE id = ?').run(item.id);
                console.log(`[Sync Queue] ✅ Synced ${item.action} ${item.entity_type} ${item.entity_id}`);
            }
            else {
                console.log(`[Sync Queue] ⏳ Will retry ${item.action} ${item.entity_type} ${item.entity_id}`);
                break; // Stop on first failure, retry later
            }
        }
        // Cleanup old synced items (keep last 100)
        db.prepare('DELETE FROM sync_queue WHERE synced = 1 AND id NOT IN (SELECT id FROM sync_queue WHERE synced = 1 ORDER BY created_at DESC LIMIT 100)').run();
    }
    async function pullFromVPS() {
        try {
            const headers = { 'x-api-key': API_KEY };
            const [tasksRes, projectsRes, txRes] = await Promise.all([
                fetch(`${WEBSOCKET_URL}/api/v1/tasks`, { headers }),
                fetch(`${WEBSOCKET_URL}/api/v1/projects`, { headers }),
                fetch(`${WEBSOCKET_URL}/api/v1/transactions`, { headers })
            ]);
            const db = (0, index_cjs_1.getDB)();
            if (tasksRes.ok) {
                const { data: vpsTasks } = await tasksRes.json();
                if (vpsTasks && Array.isArray(vpsTasks)) {
                    for (const t of vpsTasks) {
                        const deadline = t.deadline ? new Date(t.deadline).toISOString() : null;
                        db.prepare(`INSERT OR REPLACE INTO assignments (id, title, course, type, status, deadline, note, semester, createdAt, updatedAt)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                            .run(t.id, t.title, t.course, t.type, t.status, deadline, t.note || '', t.semester || 4, t.createdAt || new Date().toISOString(), t.updatedAt || new Date().toISOString());
                    }
                    console.log(`[VPS Pull] ✅ Synced ${vpsTasks.length} tasks`);
                }
            }
            if (projectsRes.ok) {
                const { data: vpsProjects } = await projectsRes.json();
                if (vpsProjects && Array.isArray(vpsProjects)) {
                    for (const p of vpsProjects) {
                        const deadline = p.deadline ? new Date(p.deadline).toISOString() : new Date().toISOString();
                        db.prepare(`INSERT OR REPLACE INTO projects (id, title, courseId, description, startDate, deadline, totalProgress, status, priority, semester, createdAt, updatedAt)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                            .run(p.id, p.title, p.courseId || null, p.description || '', p.createdAt || new Date().toISOString(), deadline, p.totalProgress || 0, p.status || 'active', p.priority || 'medium', p.semester || 4, p.createdAt || new Date().toISOString(), p.updatedAt || new Date().toISOString());
                    }
                    console.log(`[VPS Pull] ✅ Synced ${vpsProjects.length} projects`);
                }
            }
            if (txRes.ok) {
                const { data: vpsTx } = await txRes.json();
                if (vpsTx && Array.isArray(vpsTx)) {
                    for (const tx of vpsTx) {
                        const date = tx.date ? new Date(tx.date).toISOString() : new Date().toISOString();
                        db.prepare(`INSERT OR REPLACE INTO transactions (id, title, category, amount, currency, date, type, createdAt, updatedAt)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                            .run(tx.id, tx.title || tx.note || '', tx.category || 'Other', tx.amount, 'IDR', date, tx.type, tx.createdAt || new Date().toISOString(), tx.updatedAt || new Date().toISOString());
                    }
                    console.log(`[VPS Pull] ✅ Synced ${vpsTx.length} transactions`);
                }
            }
            // Refresh UI
            electron_1.BrowserWindow.getAllWindows().forEach(win => {
                if (!win.isDestroyed())
                    win.webContents.send('refresh-data');
            });
        }
        catch (e) {
            console.error('[VPS Pull] Error:', e);
        }
    }
    // Helper: attempt immediate sync, queue if offline
    async function syncCRUD(entityType, action, entityId, payload) {
        queueSync(entityType, action, entityId, payload);
        // Try immediate sync
        let success = false;
        if (action === 'create') {
            success = await syncToVPS('POST', `/${entityType}s`, { id: entityId, ...payload });
        }
        else if (action === 'update') {
            success = await syncToVPS('PATCH', `/${entityType}s/${entityId}`, payload);
        }
        else if (action === 'delete') {
            success = await syncToVPS('DELETE', `/${entityType}s/${entityId}`);
        }
        if (success) {
            const db = (0, index_cjs_1.getDB)();
            db.prepare('UPDATE sync_queue SET synced = 1 WHERE entity_id = ? AND action = ? AND synced = 0').run(entityId, action);
        }
    }
    // Initialize Telegram modules async
    async function initTelegramModules() {
        try {
            const Store = (await import('electron-store')).default;
            const { io: ioClient } = await import('socket.io-client');
            telegramStore = new Store({
                name: 'telegram-sync',
                encryptionKey: process.env.TELEGRAM_ENCRYPTION_KEY || 'st4cker-telegram-encryption-key'
            });
            // Initialize WebSocket connection
            initTelegramWebSocket = (token) => {
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
                }
                catch (err) {
                    console.error('[Telegram] Failed to create socket instance:', err);
                }
                telegramSocket.on('connect', () => {
                    console.log(`[Telegram] WebSocket connected (ID: ${telegramSocket.id})`);
                    electron_1.BrowserWindow.getAllWindows().forEach((win) => {
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
                    (async () => {
                        try {
                            await processQueue(); // Push pending local changes
                            await pullFromVPS(); // Pull latest from VPS
                            // Legacy sync (keep for safety/other data)
                            if (telegramStore && telegramStore.get('paired')) {
                                await (0, telegram_sync_cjs_1.syncUserDataToBackend)(telegramStore, telegramSocket);
                            }
                        }
                        catch (e) {
                            console.error('[Telegram] Auto-sync sequence failed:', e);
                        }
                    })().catch(err => {
                        console.error('[Telegram] Auto-sync wrapper failed:', err);
                    });
                });
                telegramSocket.on('disconnect', () => {
                    console.log('[Telegram] WebSocket disconnected');
                    electron_1.BrowserWindow.getAllWindows().forEach((win) => {
                        win.webContents.send('telegram:status-change', 'disconnected');
                    });
                });
                telegramSocket.on('connect_error', async (error) => {
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
                                    electron_1.BrowserWindow.getAllWindows().forEach((win) => {
                                        win.webContents.send('telegram:session-recovered');
                                    });
                                }
                                else {
                                    console.error('[Telegram] Auto-recovery failed, session not found');
                                    // Notify UI that pairing is needed
                                    electron_1.BrowserWindow.getAllWindows().forEach((win) => {
                                        win.webContents.send('telegram:session-expired', { recoverable: false });
                                    });
                                }
                            }
                            catch (recoveryError) {
                                console.error('[Telegram] Auto-recovery error:', recoveryError);
                                electron_1.BrowserWindow.getAllWindows().forEach((win) => {
                                    win.webContents.send('telegram:session-expired', { recoverable: false });
                                });
                            }
                        }
                        else {
                            console.log('[Telegram] No device ID stored, cannot auto-recover');
                            electron_1.BrowserWindow.getAllWindows().forEach((win) => {
                                win.webContents.send('telegram:session-expired', { recoverable: false });
                            });
                        }
                    }
                });
                telegramSocket.onAny((event, ...args) => {
                    console.log(`[Telegram Debug] Incoming Event: ${event}`, args);
                });
                telegramSocket.on('telegram-event', async (event) => {
                    console.log('[Telegram Debug] Raw Event Payload:', JSON.stringify(event, null, 2));
                    console.log('[Telegram] Received event:', event.eventType, event.eventId);
                    // 1. Idempotency Check: Check applied_events table
                    if (event.eventId) {
                        try {
                            const db = (0, index_cjs_1.getDB)();
                            const existing = db.prepare('SELECT event_id FROM applied_events WHERE event_id = ?').get(event.eventId);
                            if (existing) {
                                console.log(`[Telegram] Event ${event.eventId} already applied. Auto-ACK.`);
                                telegramSocket.emit('event-ack', event.eventId);
                                return;
                            }
                        }
                        catch (e) {
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
                                }
                                else if (typeof semester === 'number') {
                                    parsedSemester = semester;
                                }
                                if (isNaN(parsedSemester))
                                    parsedSemester = 1;
                            }
                            catch (e) {
                                console.error('[Telegram] Error parsing semester:', semester, e);
                            }
                            // Create assignment
                            const newAssignment = {
                                id: (0, crypto_1.randomUUID)(),
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
                            assignments_cjs_1.assignments.create(newAssignment);
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
                            const updates = {};
                            // Map Status
                            if (status) {
                                const statusMap = {
                                    'pending': 'to-do',
                                    'in-progress': 'progress', // Frontend expects 'progress' NOT 'in-progress'
                                    'completed': 'done' // Frontend expects 'done' NOT 'completed'
                                };
                                updates.status = statusMap[status] || status;
                            }
                            // Map Other Fields
                            if (rest.title)
                                updates.title = rest.title;
                            if (rest.type)
                                updates.type = rest.type;
                            if (rest.course)
                                updates.course = rest.course;
                            if (rest.note !== undefined)
                                updates.note = rest.note;
                            console.log('[Telegram Debug] Constructing DB update:', updates);
                            if (Object.keys(updates).length > 0) {
                                try {
                                    const result = assignments_cjs_1.assignments.update(id, updates);
                                    console.log(`[Telegram Debug] assignments.update result: ${result}`);
                                    if (result) {
                                        new (require('electron').Notification)({
                                            title: 'Task Updated',
                                            body: `Task updated successfully`
                                        }).show();
                                        success = true;
                                    }
                                    else {
                                        console.error(`[Telegram Error] Update failed - Task ID ${id} not found or no changes made.`);
                                    }
                                }
                                catch (updateErr) {
                                    console.error('[Telegram Error] DB Update Exception:', updateErr);
                                }
                            }
                            else {
                                console.warn('[Telegram Debug] No valid updates found in payload.');
                            }
                        }
                        else if (event.eventType === 'task.deleted') {
                            const { id } = event.payload;
                            console.log(`[Telegram] Received task.deleted for ${id}`);
                            if (assignments_cjs_1.assignments.delete(id)) {
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
                            if (transactions_cjs_1.transactions.delete(id)) {
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
                            const dbUpdates = {};
                            if (updates.amount)
                                dbUpdates.amount = updates.amount;
                            if (updates.note) {
                                dbUpdates.title = updates.note;
                            }
                            if (transactions_cjs_1.transactions.update(id, dbUpdates)) {
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
                                id: (0, crypto_1.randomUUID)(),
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
                            projects_cjs_1.projects.create(newProject);
                            console.log('[Telegram] Project created from event:', newProject.id);
                            // Handle Attachments
                            if (event.payload.attachments && Array.isArray(event.payload.attachments)) {
                                console.log(`[Telegram] Processing ${event.payload.attachments.length} attachments for project ${newProject.id}`);
                                for (const att of event.payload.attachments) {
                                    try {
                                        project_attachments_cjs_1.projectAttachments.create({
                                            id: att.id || (0, crypto_1.randomUUID)(),
                                            projectId: newProject.id,
                                            type: att.type || 'link',
                                            name: att.title || att.name || 'Attachment',
                                            path: att.url || att.path,
                                            size: null,
                                            createdAt: new Date().toISOString()
                                        });
                                        console.log('[Telegram] Attachment created:', att.title);
                                    }
                                    catch (attErr) {
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
                            const dbUpdates = {};
                            if (updates.name)
                                dbUpdates.title = updates.name; // Map name -> title
                            if (updates.deadline)
                                dbUpdates.deadline = updates.deadline;
                            if (updates.priority)
                                dbUpdates.priority = updates.priority;
                            // Map Status specifically if present
                            if (updates.status) {
                                let dbStatus = 'active';
                                if (updates.status === 'completed')
                                    dbStatus = 'completed';
                                if (updates.status === 'on_hold')
                                    dbStatus = 'on_hold';
                                if (updates.status === 'in_progress')
                                    dbStatus = 'active'; // Map specifically
                                dbUpdates.status = dbStatus;
                            }
                            if (Object.keys(dbUpdates).length > 0) {
                                try {
                                    if (projects_cjs_1.projects.update(id, dbUpdates)) {
                                        new (require('electron').Notification)({
                                            title: 'Project Updated',
                                            body: `Project updated from Telegram`
                                        }).show();
                                        success = true;
                                    }
                                }
                                catch (e) {
                                    console.error('[Telegram] Failed to update project:', e);
                                }
                            }
                        }
                        else if (event.eventType === 'project.deleted') {
                            const { id } = event.payload;
                            console.log(`[Telegram] Received project.deleted for ${id}`);
                            try {
                                if (projects_cjs_1.projects.delete(id)) {
                                    new (require('electron').Notification)({
                                        title: 'Project Deleted',
                                        body: 'Project removed via Telegram'
                                    }).show();
                                    success = true;
                                }
                            }
                            catch (e) {
                                console.error('[Telegram] Failed to delete project:', e);
                            }
                        }
                        else if (event.eventType === 'progress.logged') {
                            const payload = event.payload;
                            // Payload: { projectId, duration, note, status, progress, loggedAt }
                            console.log('[Telegram] Received progress.logged:', payload);
                            const projectId = payload.projectId;
                            const project = projects_cjs_1.projects.getById(projectId);
                            if (project) {
                                const duration = payload.duration || 0;
                                const note = payload.note || '';
                                const newProgress = payload.progress !== undefined ? payload.progress : (project.totalProgress || 0);
                                const newStatus = payload.status || project.status;
                                // 1. Create Session Log
                                // projectSessions is imported from ./db/project-sessions.cjs
                                project_sessions_cjs_1.projectSessions.create({
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
                                    const db = (0, index_cjs_1.getDB)();
                                    // Status map: Active -> in_progress, Completed -> completed, On Hold -> on_hold
                                    let dbStatus = 'in_progress';
                                    if (newStatus.toLowerCase() === 'completed')
                                        dbStatus = 'completed';
                                    if (newStatus.toLowerCase() === 'on hold')
                                        dbStatus = 'on_hold';
                                    if (newStatus.toLowerCase() === 'active')
                                        dbStatus = 'in_progress';
                                    db.prepare('UPDATE projects SET status = ? WHERE id = ?').run(dbStatus, projectId);
                                }
                                // 4. Force UI Refresh Immediately
                                electron_1.BrowserWindow.getAllWindows().forEach(win => {
                                    if (!win.isDestroyed())
                                        win.webContents.send('refresh-data');
                                });
                                new (require('electron').Notification)({
                                    title: 'Progress Logged',
                                    body: `${project.title}: ${newProgress}% (${duration}m)`
                                }).show();
                                success = true;
                            }
                            else {
                                console.error('[Telegram] Project not found for progress log:', projectId);
                                // Force refresh anyway, maybe the project list is just stale?
                                electron_1.BrowserWindow.getAllWindows().forEach(win => {
                                    if (!win.isDestroyed())
                                        win.webContents.send('refresh-data');
                                });
                            }
                        }
                        else if (event.eventType === 'transaction.created') {
                            const payload = event.payload;
                            console.log('[Telegram] Received transaction.created:', payload);
                            // HELPER TO EXTRACT VALUE
                            const getValue = (field) => (field && typeof field === 'object' && field.value !== undefined) ? field.value : field;
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
                            transactions_cjs_1.transactions.create(newTransaction);
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
                                transactions_cjs_1.transactions.delete(id);
                                success = true;
                            }
                        }
                        else if (event.eventType === 'transaction.updated') {
                            const { id, updates } = event.payload;
                            // updates should map to DB columns: amount, category, note (title)
                            if (id && updates) {
                                console.log('[Telegram] Updating transaction:', id, updates);
                                // Map 'note' from bot to 'title' in DB if present
                                const dbUpdates = { ...updates };
                                if (dbUpdates.note) {
                                    dbUpdates.title = dbUpdates.note;
                                    delete dbUpdates.note;
                                }
                                transactions_cjs_1.transactions.update(id, dbUpdates);
                                success = true;
                            }
                        }
                        // --- POST PROCESSING ---
                        if (success) {
                            // 1. Notify UI
                            electron_1.BrowserWindow.getAllWindows().forEach(win => {
                                win.webContents.send('refresh-data');
                            });
                            // 2. Mark as Applied & ACK
                            if (event.eventId) {
                                try {
                                    const db = (0, index_cjs_1.getDB)();
                                    db.prepare('INSERT INTO applied_events (event_id, event_type, applied_at, source) VALUES (?, ?, ?, ?)').run(event.eventId, event.eventType, Date.now(), 'websocket');
                                    console.log(`[Telegram] Acknowledging event ${event.eventId}`);
                                    telegramSocket.emit('event-ack', event.eventId);
                                }
                                catch (dbError) {
                                    console.error('[Telegram] Failed to store applied_event:', dbError);
                                    // Try to ack anyway to prevent endless loop of delivery if logic succeeded
                                    telegramSocket.emit('event-ack', event.eventId);
                                }
                            }
                            // 3. Sync Back to Bot (Update menu state etc)
                            if (telegramStore && telegramStore.get('paired')) {
                                (0, telegram_sync_cjs_1.syncUserDataToBackend)(telegramStore, telegramSocket).catch(err => console.error('[Telegram] Auto-sync failed:', err));
                            }
                        }
                    }
                    catch (error) {
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
                    initTelegramWebSocket(storedSessionToken);
                }
            }; // End initTelegramModules
            // Define IPC handlers INSIDE initTelegramModules scope so they can access telegramStore/Socket?
            // actually they are global ipcMain, but telegramStore is local to this function scope if defined inside?
            // Re-reading code: telegramStore was defined OUTSIDE as 'let telegramStore: any = null'.
            // So handlers below are fine.
            // Removed recursive call
        }
        catch (error) {
            console.error('[Telegram] Failed to initialize modules:', error);
        }
    }
    // Call the async init wrapper
    initTelegramModules();
    // IPC Handlers for Telegram (Moved outside wrapper but check nulls)
    electron_1.ipcMain.handle('telegram:verify-pairing', async (_, code) => {
        if (!telegramStore)
            return { success: false, error: 'Telegram not initialized' };
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
                }
                catch (regError) {
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
                        (0, telegram_sync_cjs_1.syncUserDataToBackend)(telegramStore, telegramSocket).catch(console.error);
                    }
                }, 2000);
                return { success: true };
            }
            return { success: false, error: data.error || 'Invalid code' };
        }
        catch (error) {
            console.error('[Telegram] Verify pairing error:', error);
            return { success: false, error: 'Connection failed' };
        }
    });
    electron_1.ipcMain.handle('telegram:sync-now', async () => {
        if (!telegramStore || !telegramStore.get('paired'))
            return { success: false, error: 'Not paired' };
        try {
            await (0, telegram_sync_cjs_1.syncUserDataToBackend)(telegramStore, telegramSocket);
            return { success: true };
        }
        catch (error) {
            console.error('[Telegram] Sync failed:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('telegram:unpair', async () => {
        if (!telegramStore)
            return { success: false };
        const sessionToken = telegramStore.get('sessionToken');
        if (sessionToken) {
            try {
                await fetch(`${WEBSOCKET_URL}/api/unpair`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken })
                });
            }
            catch (e) { }
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
    electron_1.ipcMain.handle('telegram:get-status', () => {
        if (!telegramStore)
            return { paired: false, status: 'unknown' };
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
    // Utilities (Shell & File System)
    const { shell } = require('electron');
    electron_1.ipcMain.removeHandler('utils:openExternal');
    electron_1.ipcMain.handle('utils:openExternal', (_, url) => shell.openExternal(url));
    electron_1.ipcMain.removeHandler('utils:openPath');
    electron_1.ipcMain.handle('utils:openPath', (_, path) => shell.openPath(path));
    electron_1.ipcMain.removeHandler('utils:saveFile');
    electron_1.ipcMain.handle('utils:saveFile', async (_, content, defaultName, extensions = ['csv']) => {
        const win = electron_1.BrowserWindow.getFocusedWindow();
        if (!win)
            return { success: false, error: 'No focused window' };
        const { dialog } = require('electron');
        const fs = require('fs/promises');
        try {
            const { filePath } = await dialog.showSaveDialog(win, {
                title: 'Save File',
                defaultPath: defaultName,
                filters: [{ name: 'Export File', extensions }]
            });
            if (!filePath)
                return { success: false, canceled: true };
            await fs.writeFile(filePath, content, 'utf-8');
            return { success: true, filePath };
        }
        catch (error) {
            console.error('File Save Error:', error);
            return { success: false, error: error.message };
        }
    });
    // Toggle DevTools for debugging in production
    const { globalShortcut } = require('electron');
    globalShortcut.register('F12', () => {
        const win = electron_1.BrowserWindow.getFocusedWindow();
        if (win)
            win.webContents.toggleDevTools();
    });
    createWindow();
    // Check Auto-Backup & Subscriptions (After a short delay to let things settle)
    setTimeout(async () => {
        // 1. Auto Backup
        if (driveService) {
            driveService.checkAndRunAutoBackup().catch((err) => console.error('Auto-backup check failed:', err));
        }
        else {
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
            }
            else {
                console.log('[Main] Telegram modules not ready yet or not paired.');
            }
        }
        catch (err) {
            console.error('[Main] Telegram auto-connect failed:', err);
        }
        // 3. Check Subscriptions & Recurring Transactions
        try {
            console.log('[Main] Checking for due subscriptions...');
            const result = subscriptions_cjs_1.subscriptions.checkAndProcessDeductions();
            if (result.deductionsMade > 0) {
                console.log(`[Main] Processed ${result.deductionsMade} recurring transactions.`);
                // Notify windows to refresh data
                electron_1.BrowserWindow.getAllWindows().forEach(win => {
                    win.webContents.send('refresh-data');
                });
            }
        }
        catch (err) {
            console.error('[Main] Failed to process subscriptions:', err);
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
    // Notifications
    electron_1.ipcMain.handle('notifications:send', (_, title, body) => {
        const { Notification } = require('electron');
        new Notification({ title, body }).show();
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
