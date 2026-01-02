export interface IElectronAPI {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    // Modules
    userProfile: {
        get: () => Promise<any>;
        update: (data: any) => Promise<any>;
    };
    courses: {
        list: () => Promise<any[]>;
        get: (id: string) => Promise<any>;
        add: (name: string, semester: number, sks: number) => Promise<any>;
        update: (id: string, data: any) => Promise<any>;
        delete: (id: string) => Promise<void>;
    };
    assignments: {
        list: () => Promise<any[]>;
        create: (data: any) => Promise<any>;
        update: (id: string, data: any) => Promise<any>;
        updateStatus: (id: string, status: string) => Promise<any>;
        delete: (id: string) => Promise<void>;
    };
    schedule: {
        getAll: () => Promise<any[]>;
        upsert: (data: any) => Promise<any>;
    };
    performance: {
        getSemesters: () => Promise<any[]>;
        upsertSemester: (semester: number, ips: number) => Promise<any>;
        getCourses: (semester?: number) => Promise<any[]>;
        upsertCourse: (course: any) => Promise<any>;
        updateSksOnly: (id: string, sks: number) => Promise<any>;
    };
    transactions: {
        list: () => Promise<any[]>;
        create: (data: any) => Promise<any>;
        update: (id: string, data: any) => Promise<any>;
        delete: (id: string) => Promise<void>;
        clear: () => Promise<void>;
    };
    materials: {
        getByCourse: (courseId: string) => Promise<any[]>;
        add: (id: string, courseId: string, type: 'link' | 'file', title: string, url: string) => Promise<any>;
        delete: (id: string) => Promise<void>;
    };
    subscriptions: {
        list: () => Promise<any[]>;
        create: (data: any) => Promise<any>;
        update: (id: string, data: any) => Promise<any>;
        delete: (id: string) => Promise<void>;
        checkDeductions: () => Promise<{ deductionsMade: number }>;
    };

    reports: {
        exportPdf: (filename?: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
    };

    // Tools
    dialog: {
        openFile: () => Promise<any>;
    };
    backup: {
        export: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>;
        import: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>;
    };
    drive: {
        authenticate: () => Promise<boolean>;
        upload: () => Promise<string>;
        isAuthenticated: () => Promise<boolean>;
        logout: () => Promise<void>;
        getLastBackup: () => Promise<number | undefined>;
    };
    utils: {
        openExternal: (url: string) => Promise<void>;
        openPath: (path: string) => Promise<void>;
    };

    notifications: {
        send: (title: string, body: string) => Promise<void>;
    };

    settings: {
        getStartupStatus: () => Promise<boolean>;
        toggleStartup: (openAtLogin: boolean) => Promise<boolean>;
    };

    // Events
    notifyDataChanged: () => void;
    onRefreshData: (callback: () => void) => void;
    offRefreshData: () => void;
    openWindow: (route: string, width?: number, height?: number) => void;

    on: (channel: string, callback: (...args: any[]) => void) => void;
    off: (channel: string, callback: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
}

declare global {
    interface Window {
        electronAPI: IElectronAPI;
    }
}
