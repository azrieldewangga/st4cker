"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Window Controls
    minimize: () => electron_1.ipcRenderer.send('window-minimize'),
    maximize: () => electron_1.ipcRenderer.send('window-maximize'),
    close: () => electron_1.ipcRenderer.send('window-close'),
    openWindow: (route, width, height) => electron_1.ipcRenderer.send('window-open', route, width, height),
    // Data Sync
    notifyDataChanged: () => electron_1.ipcRenderer.send('data-changed'),
    onRefreshData: (callback) => electron_1.ipcRenderer.on('refresh-data', callback),
    offRefreshData: () => electron_1.ipcRenderer.removeAllListeners('refresh-data'),
    // --- Domain APIs ---
    userProfile: {
        get: () => electron_1.ipcRenderer.invoke('userProfile:get'),
        update: (data) => electron_1.ipcRenderer.invoke('userProfile:update', data)
    },
    assignments: {
        list: () => electron_1.ipcRenderer.invoke('assignments:list'),
        create: (data) => electron_1.ipcRenderer.invoke('assignments:create', data),
        update: (id, data) => electron_1.ipcRenderer.invoke('assignments:update', id, data),
        updateStatus: (id, status) => electron_1.ipcRenderer.invoke('assignments:updateStatus', id, status),
        delete: (id) => electron_1.ipcRenderer.invoke('assignments:delete', id)
    },
    transactions: {
        list: (params) => electron_1.ipcRenderer.invoke('transactions:list', params),
        create: (data) => electron_1.ipcRenderer.invoke('transactions:create', data),
        update: (id, data) => electron_1.ipcRenderer.invoke('transactions:update', id, data),
        delete: (id) => electron_1.ipcRenderer.invoke('transactions:delete', id),
        summary: (currency) => electron_1.ipcRenderer.invoke('transactions:summary', currency),
        clear: () => electron_1.ipcRenderer.invoke('transactions:clear')
    },
    performance: {
        getSemesters: () => electron_1.ipcRenderer.invoke('performance:getSemesters'),
        upsertSemester: (semester, ips) => electron_1.ipcRenderer.invoke('performance:upsertSemester', semester, ips),
        getCourses: (semester) => electron_1.ipcRenderer.invoke('performance:getCourses', semester),
        upsertCourse: (course) => electron_1.ipcRenderer.invoke('performance:upsertCourse', course),
        updateSksOnly: (id, sks) => electron_1.ipcRenderer.invoke('performance:updateSksOnly', id, sks)
    },
    schedule: {
        getAll: () => electron_1.ipcRenderer.invoke('schedule:getAll'),
        upsert: (item) => electron_1.ipcRenderer.invoke('schedule:upsert', item)
    },
    materials: {
        getByCourse: (courseId) => electron_1.ipcRenderer.invoke('materials:getByCourse', courseId),
        add: (id, courseId, type, title, url) => electron_1.ipcRenderer.invoke('materials:add', id, courseId, type, title, url),
        delete: (id) => electron_1.ipcRenderer.invoke('materials:delete', id)
    },
    subscriptions: {
        list: () => electron_1.ipcRenderer.invoke('subscriptions:list'),
        create: (data) => electron_1.ipcRenderer.invoke('subscriptions:create', data),
        update: (id, data) => electron_1.ipcRenderer.invoke('subscriptions:update', id, data),
        delete: (id) => electron_1.ipcRenderer.invoke('subscriptions:delete', id),
        checkDeductions: () => electron_1.ipcRenderer.invoke('subscriptions:checkDeductions')
    },
    // Dialog
    dialog: {
        openFile: () => electron_1.ipcRenderer.invoke('dialog:openFile')
    },
    backup: {
        export: () => electron_1.ipcRenderer.invoke('db:export'),
        import: () => electron_1.ipcRenderer.invoke('db:import')
    },
    drive: {
        authenticate: () => electron_1.ipcRenderer.invoke('drive:authenticate'),
        upload: () => electron_1.ipcRenderer.invoke('drive:upload'),
        isAuthenticated: () => electron_1.ipcRenderer.invoke('drive:isAuthenticated'),
        logout: () => electron_1.ipcRenderer.invoke('drive:logout'),
        getLastBackup: () => electron_1.ipcRenderer.invoke('drive:lastBackup')
    },
    utils: {
        openExternal: (url) => electron_1.ipcRenderer.invoke('utils:openExternal', url),
        openPath: (path) => electron_1.ipcRenderer.invoke('utils:openPath', path)
    },
    settings: {
        getStartupStatus: () => electron_1.ipcRenderer.invoke('settings:getStartupStatus'),
        toggleStartup: (openAtLogin) => electron_1.ipcRenderer.invoke('settings:toggleStartup', openAtLogin)
    },
    // Generic Event Listeners
    on: (channel, callback) => electron_1.ipcRenderer.on(channel, (_event, ...args) => callback(...args)),
    off: (channel, callback) => electron_1.ipcRenderer.removeListener(channel, (_event, ...args) => callback(...args)),
    removeAllListeners: (channel) => electron_1.ipcRenderer.removeAllListeners(channel)
});
