import { StateCreator } from 'zustand';
import { Project, ProjectSession, ProjectAttachment } from '@/types/models';

export interface ProjectSlice {
    projects: Project[];
    projectSessions: Record<string, ProjectSession[]>;
    projectAttachments: Record<string, ProjectAttachment[]>;

    fetchProjects: () => Promise<void>;
    getProjectById: (id: string) => Promise<Project | null>;
    addProject: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project | null>;
    updateProject: (id: string, data: Partial<Project>) => Promise<void>;
    deleteProject: (id: string, skipLog?: boolean) => Promise<void>;

    fetchProjectSessions: (projectId: string) => Promise<void>;
    addProjectSession: (data: Omit<ProjectSession, 'id' | 'createdAt'>) => Promise<void>;
    updateProjectSession: (id: string, data: Partial<ProjectSession>) => Promise<void>;
    deleteProjectSession: (id: string, projectId: string) => Promise<void>;

    fetchProjectAttachments: (projectId: string) => Promise<void>;
    addProjectAttachment: (data: Omit<ProjectAttachment, 'id' | 'createdAt'>) => Promise<void>;
    deleteProjectAttachment: (id: string, projectId: string) => Promise<void>;

    // Master DB Sync
    syncProjectsToBackend: () => Promise<void>;
    fetchProjectsFromBackend: () => Promise<void>;
    syncProjectSessionsToBackend: () => Promise<void>;
    fetchProjectSessionsFromBackend: () => Promise<void>;
}

export const createProjectSlice: StateCreator<
    ProjectSlice & { undoStack: any[]; redoStack: any[] },
    [],
    [],
    ProjectSlice
> = (set, get) => ({
    projects: [],
    projectSessions: {},
    projectAttachments: {},

    fetchProjects: async () => {
        try {
            const data = await window.electronAPI.projects.list();
            set({ projects: data });
        } catch (error) {
            console.error('[ProjectSlice] Fetch error:', error);
        }
    },

    getProjectById: async (id) => {
        try {
            const project = await window.electronAPI.projects.get(id);
            return project;
        } catch (error) {
            console.error('[ProjectSlice] Get error:', error);
            return null;
        }
    },

    addProject: async (data) => {
        try {
            const created = await window.electronAPI.projects.create(data);
            set((state) => ({
                projects: [...state.projects, created]
            }));
            
            // Auto-sync to backend
            try {
                await get().syncProjectsToBackend();
            } catch (syncErr) {
                console.error('[ProjectSlice] Auto-sync failed:', syncErr);
            }
            
            return created;
        } catch (error) {
            console.error('[ProjectSlice] Add error:', error);
            return null;
        }
    },

    updateProject: async (id, data) => {
        try {
            await window.electronAPI.projects.update(id, data);
            set((state) => ({
                projects: state.projects.map((p) => p.id === id ? { ...p, ...data } : p)
            }));
            get().fetchProjects();
            
            // Auto-sync to backend
            try {
                await get().syncProjectsToBackend();
            } catch (syncErr) {
                console.error('[ProjectSlice] Auto-sync failed:', syncErr);
            }
        } catch (error) {
            console.error('[ProjectSlice] Update error:', error);
            throw error;
        }
    },

    deleteProject: async (id, skipLog = false) => {
        try {
            if (!skipLog) {
                const project = get().projects.find(p => p.id === id);
                if (project) {
                    set({ redoStack: [] });
                    set((state: any) => ({
                        undoStack: [...state.undoStack, {
                            type: 'DELETE_PROJECT',
                            payload: { id, data: project }
                        }]
                    }));
                }
            }

            await window.electronAPI.projects.delete(id);
            get().fetchProjects();
            
            // Auto-sync to backend
            try {
                await get().syncProjectsToBackend();
            } catch (syncErr) {
                console.error('[ProjectSlice] Auto-sync failed:', syncErr);
            }
        } catch (error) {
            console.error('[ProjectSlice] Delete error:', error);
            throw error;
        }
    },

    fetchProjectSessions: async (projectId) => {
        try {
            const sessions = await window.electronAPI.projectSessions.listByProject(projectId);
            set((state) => ({
                projectSessions: { ...state.projectSessions, [projectId]: sessions }
            }));
        } catch (error) {
            console.error('[ProjectSlice] Fetch sessions error:', error);
        }
    },

    addProjectSession: async (data) => {
        try {
            await window.electronAPI.projectSessions.create(data);
            get().fetchProjectSessions(data.projectId);
            get().fetchProjects();
            
            // Auto-sync to backend
            try {
                await get().syncProjectSessionsToBackend();
            } catch (syncErr) {
                console.error('[ProjectSlice] Auto-sync sessions failed:', syncErr);
            }
        } catch (error) {
            console.error('[ProjectSlice] Add session error:', error);
            throw error;
        }
    },

    updateProjectSession: async (id, data) => {
        try {
            await window.electronAPI.projectSessions.update(id, data);
            if ((data as any).projectId) {
                get().fetchProjectSessions((data as any).projectId);
            }
            
            // Auto-sync to backend
            try {
                await get().syncProjectSessionsToBackend();
            } catch (syncErr) {
                console.error('[ProjectSlice] Auto-sync sessions failed:', syncErr);
            }
        } catch (error) {
            console.error('[ProjectSlice] Update session error:', error);
            throw error;
        }
    },

    deleteProjectSession: async (id, projectId) => {
        try {
            await window.electronAPI.projectSessions.delete(id);
            get().fetchProjectSessions(projectId);
            get().fetchProjects();
            
            // Auto-sync to backend
            try {
                await get().syncProjectSessionsToBackend();
            } catch (syncErr) {
                console.error('[ProjectSlice] Auto-sync sessions failed:', syncErr);
            }
        } catch (error) {
            console.error('[ProjectSlice] Delete session error:', error);
            throw error;
        }
    },

    fetchProjectAttachments: async (projectId) => {
        try {
            const attachments = await window.electronAPI.projectAttachments.listByProject(projectId);
            set((state) => ({
                projectAttachments: { ...state.projectAttachments, [projectId]: attachments }
            }));
        } catch (error) {
            console.error('[ProjectSlice] Fetch attachments error:', error);
        }
    },

    addProjectAttachment: async (data) => {
        try {
            await window.electronAPI.projectAttachments.create(data);
            get().fetchProjectAttachments(data.projectId);
        } catch (error) {
            console.error('[ProjectSlice] Add attachment error:', error);
            throw error;
        }
    },

    deleteProjectAttachment: async (id, projectId) => {
        try {
            await window.electronAPI.projectAttachments.delete(id);
            get().fetchProjectAttachments(projectId);
        } catch (error) {
            console.error('[ProjectSlice] Delete attachment error:', error);
            throw error;
        }
    },

    // =========================================================================
    // MASTER DB SYNC
    // =========================================================================

    syncProjectsToBackend: async () => {
        try {
            const state = get() as any;
            const { projects, userProfile } = state;
            const serverUrl = 'http://103.127.134.173:3000';
            const apiKey = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';

            const response = await fetch(`${serverUrl}/api/sync-user-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                },
                body: JSON.stringify({
                    sessionToken: localStorage.getItem('sessionToken'),
                    data: { projects }
                }),
            });

            if (!response.ok) throw new Error('Failed to sync projects');
            console.log('[ProjectSlice] Projects synced to backend');
        } catch (error) {
            console.error('[ProjectSlice] Sync to backend error:', error);
            throw error;
        }
    },

    fetchProjectsFromBackend: async () => {
        try {
            const state = get() as any;
            const { userProfile, projects: localProjectsState } = state;
            const serverUrl = 'http://103.127.134.173:3000';
            const apiKey = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';

            const response = await fetch(`${serverUrl}/api/v1/projects`, {
                headers: { 'X-API-Key': apiKey },
            });

            if (!response.ok) throw new Error('Failed to fetch projects');
            const data = await response.json();

            if (!data.data?.length) {
                console.log('[ProjectSlice] Server has no projects, keeping local data');
                return;
            }

            // IMPROVED DUPLICATE DETECTION
            const localProjects = await window.electronAPI.projects.list();
            const existingIds = new Set(localProjects.map((p: any) => p.id));
            const existingKeys = new Set(localProjects.map((p: any) => 
                `${(p.title || '').toLowerCase().trim()}_${p.deadline}_${p.courseId || 'personal'}`
            ));
            const localStateIds = new Set(localProjectsState.map((p: any) => p.id));

            for (const item of data.data) {
                const existsById = existingIds.has(item.id) || localStateIds.has(item.id);
                const itemKey = `${(item.title || '').toLowerCase().trim()}_${item.deadline}_${item.courseName || 'personal'}`;
                const existsByContent = existingKeys.has(itemKey);

                const projectData = {
                    id: item.id,
                    title: item.title,
                    description: item.description || '',
                    courseId: item.courseName || null,
                    status: item.status === 'on_hold' ? 'on-hold' : item.status,
                    priority: item.priority,
                    totalProgress: item.totalProgress || 0,
                    startDate: item.createdAt || new Date().toISOString(),
                    deadline: item.deadline || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };

                if (existsById) {
                    await window.electronAPI.projects.update(item.id, projectData);
                    console.log(`[ProjectSlice] Updated existing project by ID: ${item.id}`);
                } else if (!existsByContent) {
                    await window.electronAPI.projects.create(projectData);
                    existingIds.add(item.id);
                    existingKeys.add(itemKey);
                    console.log(`[ProjectSlice] Created new project: ${item.title}`);
                } else {
                    console.log(`[ProjectSlice] Skipping duplicate project: ${item.title}`);
                }
            }

            get().fetchProjects();
            console.log('[ProjectSlice] Projects fetched from backend');
        } catch (error) {
            console.error('[ProjectSlice] Fetch from backend error:', error);
        }
    },

    syncProjectSessionsToBackend: async () => {
        try {
            const state = get() as any;
            const { projectSessions, userProfile } = state;
            const serverUrl = 'http://103.127.134.173:3000';
            const apiKey = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';

            // Flatten all sessions from all projects
            const allSessions = Object.values(projectSessions).flat() as ProjectSession[];

            const response = await fetch(`${serverUrl}/api/sync-user-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                },
                body: JSON.stringify({
                    sessionToken: localStorage.getItem('sessionToken'),
                    data: { projectSessions: allSessions }
                }),
            });

            if (!response.ok) throw new Error('Failed to sync project sessions');
            console.log('[ProjectSlice] Project sessions synced to backend');
        } catch (error) {
            console.error('[ProjectSlice] Sync sessions to backend error:', error);
            throw error;
        }
    },

    fetchProjectSessionsFromBackend: async () => {
        // Project sessions are fetched per-project via /api/v1/projects/:id/logs
        // For now, we'll rely on project fetch and local session storage
        console.log('[ProjectSlice] Project sessions are managed locally per project');
    },
});
