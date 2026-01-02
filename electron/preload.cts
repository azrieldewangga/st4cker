import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Window Controls
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    openWindow: (route: string, width?: number, height?: number) => ipcRenderer.send('window-open', route, width, height),

    // Data Sync
    notifyDataChanged: () => ipcRenderer.send('data-changed'),
    onRefreshData: (callback: () => void) => ipcRenderer.on('refresh-data', callback),
    offRefreshData: () => ipcRenderer.removeAllListeners('refresh-data'),

    // --- Domain APIs ---
    userProfile: {
        get: () => ipcRenderer.invoke('userProfile:get'),
        update: (data: any) => ipcRenderer.invoke('userProfile:update', data)
    },
    assignments: {
        list: () => ipcRenderer.invoke('assignments:list'),
        create: (data: any) => ipcRenderer.invoke('assignments:create', data),
        update: (id: string, data: any) => ipcRenderer.invoke('assignments:update', id, data),
        updateStatus: (id: string, status: string) => ipcRenderer.invoke('assignments:updateStatus', id, status),
        delete: (id: string) => ipcRenderer.invoke('assignments:delete', id)
    },

    transactions: {
        list: (params?: any) => ipcRenderer.invoke('transactions:list', params),
        create: (data: any) => ipcRenderer.invoke('transactions:create', data),
        update: (id: string, data: any) => ipcRenderer.invoke('transactions:update', id, data),
        delete: (id: string) => ipcRenderer.invoke('transactions:delete', id),
        summary: (currency: string) => ipcRenderer.invoke('transactions:summary', currency),
        clear: () => ipcRenderer.invoke('transactions:clear')
    },

    performance: {
        getSemesters: () => ipcRenderer.invoke('performance:getSemesters'),
        upsertSemester: (semester: number, ips: number) => ipcRenderer.invoke('performance:upsertSemester', semester, ips),
        getCourses: (semester?: number) => ipcRenderer.invoke('performance:getCourses', semester),
        upsertCourse: (course: any) => ipcRenderer.invoke('performance:upsertCourse', course),
        updateSksOnly: (id: string, sks: number) => ipcRenderer.invoke('performance:updateSksOnly', id, sks)
    },

    schedule: {
        getAll: () => ipcRenderer.invoke('schedule:getAll'),
        upsert: (item: any) => ipcRenderer.invoke('schedule:upsert', item)
    },

    materials: {
        getByCourse: (courseId: string) => ipcRenderer.invoke('materials:getByCourse', courseId),
        add: (id: string, courseId: string, type: 'link' | 'file', title: string, url: string) => ipcRenderer.invoke('materials:add', id, courseId, type, title, url),
        delete: (id: string) => ipcRenderer.invoke('materials:delete', id)
    },

    subscriptions: {
        list: () => ipcRenderer.invoke('subscriptions:list'),
        create: (data: any) => ipcRenderer.invoke('subscriptions:create', data),
        update: (id: string, data: any) => ipcRenderer.invoke('subscriptions:update', id, data),
        delete: (id: string) => ipcRenderer.invoke('subscriptions:delete', id),
        checkDeductions: () => ipcRenderer.invoke('subscriptions:checkDeductions')
    },

    reports: {
        exportPdf: (filename?: string) => ipcRenderer.invoke('reports:export-pdf', filename)
    },

    // Dialog
    dialog: {
        openFile: () => ipcRenderer.invoke('dialog:openFile')
    },

    backup: {
        export: () => ipcRenderer.invoke('db:export'),
        import: () => ipcRenderer.invoke('db:import')
    },

    drive: {
        authenticate: () => ipcRenderer.invoke('drive:authenticate'),
        upload: () => ipcRenderer.invoke('drive:upload'),
        isAuthenticated: () => ipcRenderer.invoke('drive:isAuthenticated'),
        logout: () => ipcRenderer.invoke('drive:logout'),
        getLastBackup: () => ipcRenderer.invoke('drive:lastBackup')
    },

    utils: {
        openExternal: (url: string) => ipcRenderer.invoke('utils:openExternal', url),
        openPath: (path: string) => ipcRenderer.invoke('utils:openPath', path),
        saveFile: (content: string, defaultName: string, extensions: string[]) => ipcRenderer.invoke('utils:saveFile', content, defaultName, extensions),
        // @ts-ignore
        getPathForFile: (file: File) => webUtils.getPathForFile(file)
    },

    notifications: {
        send: (title: string, body: string) => ipcRenderer.invoke('notifications:send', title, body)
    },

    settings: {
        getStartupStatus: () => ipcRenderer.invoke('settings:getStartupStatus'),
        toggleStartup: (openAtLogin: boolean) => ipcRenderer.invoke('settings:toggleStartup', openAtLogin)
    },

    // Generic Event Listeners
    on: (channel: string, callback: Function) => ipcRenderer.on(channel, (_event, ...args) => callback(...args)),
    off: (channel: string, callback: Function) => ipcRenderer.removeListener(channel, (_event, ...args) => callback(...args)),
    removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
});
