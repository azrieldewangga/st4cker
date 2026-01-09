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
});
