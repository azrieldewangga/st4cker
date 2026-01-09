import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '../useStoreNew';

// Define mocks explicitly
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockList = vi.fn().mockResolvedValue([]);

const mockElectronAPI = {
    assignments: {
        list: mockList,
        create: mockCreate,
        update: mockUpdate,
        delete: mockDelete,
    },
};

vi.stubGlobal('window', {
    electronAPI: mockElectronAPI,
});

describe('useStoreNew - Assignments', () => {

    beforeEach(() => {
        useStore.setState({
            assignments: [],
            userProfile: { semester: 1 } as any,
            undoStack: [],
            redoStack: []
        });
        vi.clearAllMocks();
    });

    it('should add assignment', async () => {
        // Mock fetchAssignments to do nothing for this test
        vi.spyOn(useStore.getState(), 'fetchAssignments').mockImplementation(async () => { });

        const newAssignment = {
            title: 'Test Assignment',
            courseId: 'course-1-0',
            deadline: new Date().toISOString(),
            note: 'Test description',
            type: 'Tugas' as const,
            status: 'to-do' as const,
        };

        await useStore.getState().addAssignment(newAssignment);

        expect(mockCreate).toHaveBeenCalled();
        expect(useStore.getState().assignments).toHaveLength(1);
    });

    it('should update assignment', async () => {
        // Mock fetchAssignments to do nothing for this test
        vi.spyOn(useStore.getState(), 'fetchAssignments').mockImplementation(async () => { });

        const initialAssignment = {
            id: '1',
            title: 'Test',
            courseId: 'course-1-0',
            deadline: new Date().toISOString(),
            status: 'to-do' as const,
            type: 'Tugas' as const,
            note: '',
            semester: 1,
            customOrder: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        useStore.setState({ assignments: [initialAssignment] });

        await useStore.getState().updateAssignment('1', { status: 'done' });

        expect(mockUpdate).toHaveBeenCalledWith('1', { status: 'done' });
        expect(useStore.getState().assignments[0].status).toBe('done');
    });

    it('should delete assignment', async () => {
        // Mock fetchAssignments to actually remove the item from state
        vi.spyOn(useStore.getState(), 'fetchAssignments').mockImplementation(async () => {
            useStore.setState({ assignments: [] });
        });

        const initialAssignment = {
            id: '1',
            title: 'Delete Me',
            courseId: 'course-1-0',
            deadline: new Date().toISOString(),
            status: 'to-do' as const,
            type: 'Tugas' as const,
            note: '',
            semester: 1,
            customOrder: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        useStore.setState({ assignments: [initialAssignment] });

        await useStore.getState().deleteAssignment('1');

        expect(mockDelete).toHaveBeenCalledWith('1');
        expect(useStore.getState().assignments).toHaveLength(0);
    });

    it('should fetch assignments', async () => {
        const mockData = [{ id: '1', title: 'A1', deadline: new Date().toISOString(), course: 'C1' }];
        mockList.mockResolvedValueOnce(mockData);

        await useStore.getState().fetchAssignments();

        expect(mockList).toHaveBeenCalled();
        expect(useStore.getState().assignments).toHaveLength(1);
    });
});
