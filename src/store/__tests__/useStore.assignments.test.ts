import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useStore } from '../useStore';

describe('useStore - Assignments', () => {

    beforeEach(() => {
        // Reset store and mocks
        const store = useStore.getState();
        store.assignments = [];
        vi.clearAllMocks();
    });

    it('should add assignment with auto-generated ID', async () => {
        const store = useStore.getState();

        const newAssignment = {
            title: 'Test Assignment',
            courseId: 'course-1-0',
            deadline: new Date().toISOString(),
            note: 'Test description',
            type: 'Tugas' as const,
            status: 'to-do' as const,
        };

        // @ts-ignore
        await store.addAssignment(newAssignment);

        // Verify electronAPI.assignments.create was called
        expect(window.electronAPI.assignments.create).toHaveBeenCalled();
    });

    it('should update assignment status', async () => {
        const store = useStore.getState();

        // Setup initial assignment
        store.assignments = [{
            id: '1',
            title: 'Test',
            courseId: 'course-1-0',
            deadline: new Date().toISOString(),
            status: 'to-do',
            type: 'Tugas',
            note: '',
            semester: 1,
            customOrder: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }];

        await store.updateAssignment('1', { status: 'done' });

        expect(window.electronAPI.assignments.update).toHaveBeenCalledWith('1', { status: 'done' });
    });

    it('should delete assignment', async () => {
        const store = useStore.getState();

        store.assignments = [{
            id: '1',
            title: 'Test',
            courseId: 'course-1-0',
            deadline: new Date().toISOString(),
            status: 'to-do',
            type: 'Tugas',
            // priority: 'medium', // Removed
            note: '',
            semester: 1,
            customOrder: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }];

        await store.deleteAssignment('1');

        expect(window.electronAPI.assignments.delete).toHaveBeenCalledWith('1');
    });

    it('should fetch assignments from API', async () => {
        const mockAssignments = [
            {
                id: '1',
                title: 'Assignment 1',
                courseId: 'course-1-0', // Fixed
                deadline: new Date().toISOString(),
                status: 'to-do',
                type: 'Tugas', // Added
                note: 'Test',
                semester: 1,
                customOrder: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        // @ts-ignore
        vi.mocked(window.electronAPI.assignments.list).mockResolvedValueOnce(mockAssignments);

        const store = useStore.getState();
        await store.fetchAssignments();

        expect(window.electronAPI.assignments.list).toHaveBeenCalled();
    });
});
