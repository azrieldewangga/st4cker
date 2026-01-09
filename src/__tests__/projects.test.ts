import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '../store/useStoreNew';

// Mock the electronAPI
const mockElectronAPI = {
    projects: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        get: vi.fn(),
    },
    projectSessions: {
        create: vi.fn(),
        listByProject: vi.fn(),
    },
    projectAttachments: {
        create: vi.fn(),
        listByProject: vi.fn(),
        delete: vi.fn(),
    },
    on: vi.fn(),
    off: vi.fn(),
};

// @ts-ignore
window.electronAPI = mockElectronAPI;

describe('Project Store', () => {
    beforeEach(() => {
        useStore.setState({
            projects: [],
            projectSessions: {},
            projectAttachments: {},
            courses: []
        });
        vi.clearAllMocks();
    });

    it('should add a project', async () => {
        const newProject = {
            id: '123',
            title: 'Test Project',
            status: 'active' as const,
            priority: 'high' as const,
            startDate: '2023-01-01',
            deadline: '2023-12-31',
            totalProgress: 0,
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01',
            courseId: null,
            semester: 1
        };

        mockElectronAPI.projects.create.mockResolvedValue(newProject);
        mockElectronAPI.projects.list.mockResolvedValue([newProject]);

        await useStore.getState().addProject(newProject);

        expect(mockElectronAPI.projects.create).toHaveBeenCalledWith(newProject);
        expect(useStore.getState().projects).toContainEqual(newProject);
    });

    it('should update project progress', async () => {
        const project = {
            id: '123',
            title: 'Test Project',
            status: 'active' as const,
            totalProgress: 0,
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01',
            deadline: '2023-12-31',
            startDate: '2023-01-01',
            priority: 'medium' as const,
            courseId: null,
            semester: 1
        };
        useStore.setState({ projects: [project] });

        const updatedData = { totalProgress: 50 };
        mockElectronAPI.projects.update.mockResolvedValue({ success: true });
        mockElectronAPI.projects.get.mockResolvedValue({ ...project, ...updatedData });
        mockElectronAPI.projects.list.mockResolvedValue([{ ...project, ...updatedData }]);

        await useStore.getState().updateProject('123', updatedData);

        expect(mockElectronAPI.projects.update).toHaveBeenCalledWith('123', updatedData);
        expect(useStore.getState().projects[0].totalProgress).toBe(50);
    });

    it('should log a project session', async () => {
        const project = {
            id: '123',
            title: 'Test Project',
            totalProgress: 0,
            status: 'active' as const,
            priority: 'medium' as const,
            startDate: '2023-01-01',
            deadline: '2023-12-31',
            createdAt: '2023-01-01',
            updatedAt: '2023-01-01',
            courseId: null,
            semester: 1
        };
        useStore.setState({ projects: [project] });

        const session = {
            projectId: '123',
            sessionDate: '2023-01-02',
            duration: 60,
            note: 'Worked on stuff',
            progressBefore: 0,
            progressAfter: 10
        };

        mockElectronAPI.projectSessions.create.mockResolvedValue({ success: true, id: 'sess1' });
        // The store typically re-fetches sessions or adds to list
        mockElectronAPI.projectSessions.listByProject.mockResolvedValue([{ ...session, id: 'sess1', createdAt: '2023-01-02' }]);

        await useStore.getState().addProjectSession(session);

        expect(mockElectronAPI.projectSessions.create).toHaveBeenCalledWith(session);
        // Also verify that project progress might be updated if logic handles it
        // The addProjectSession action in store usually triggers updateProject internally or we do it manually in UI.
        // But often the store logic might chain them. Let's check session store state.

        expect(useStore.getState().projectSessions['123']).toHaveLength(1);
    });
});
