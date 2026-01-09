import { StateCreator } from 'zustand';

type UndoOp =
    | {
        type: 'SET_SCHEDULE';
        payload: {
            day: string;
            time: string;
            prevCourse: string;
            prevColor: string;
            prevRoom: string;
            prevLecturer: string;
            newCourse: string;
            newColor: string;
            newRoom: string;
            newLecturer: string;
        }
    }
    | {
        type: 'ADD_ASSIGNMENT';
        payload: { id: string; data: any }
    }
    | {
        type: 'DELETE_ASSIGNMENT';
        payload: { id: string; data: any }
    }
    | {
        type: 'ADD_TRANSACTION';
        payload: { id: string; data: any }
    }
    | {
        type: 'DELETE_TRANSACTION';
        payload: { id: string; data: any }
    }
    | {
        type: 'DELETE_PROJECT';
        payload: { id: string; data: any }
    };

export interface UndoRedoSlice {
    undoStack: UndoOp[];
    redoStack: UndoOp[];
    undo: () => Promise<void>;
    redo: () => Promise<void>;
}

export const createUndoRedoSlice: StateCreator<
    UndoRedoSlice & {
        setScheduleItem: any;
        deleteAssignment: any;
        fetchAssignments: any;
        deleteProject: any;
        fetchProjects: any;
    },
    [],
    [],
    UndoRedoSlice
> = (set, get) => ({
    undoStack: [],
    redoStack: [],

    undo: async () => {
        const { undoStack, redoStack } = get();
        if (undoStack.length === 0) return;

        const op = undoStack[undoStack.length - 1];
        set({
            undoStack: undoStack.slice(0, -1),
            redoStack: [...redoStack, op]
        });

        switch (op.type) {
            case 'SET_SCHEDULE':
                await get().setScheduleItem(
                    op.payload.day,
                    op.payload.time,
                    op.payload.prevCourse,
                    op.payload.prevColor,
                    op.payload.prevRoom,
                    op.payload.prevLecturer,
                    true
                );
                break;
            case 'ADD_ASSIGNMENT':
                await get().deleteAssignment(op.payload.id, true);
                break;
            case 'DELETE_ASSIGNMENT':
                await window.electronAPI.assignments.create(op.payload.data);
                await get().fetchAssignments();
                break;
            case 'DELETE_PROJECT':
                await window.electronAPI.projects.create(op.payload.data);
                await get().fetchProjects();
                break;
        }
    },

    redo: async () => {
        const { undoStack, redoStack } = get();
        if (redoStack.length === 0) return;

        const op = redoStack[redoStack.length - 1];
        set({
            redoStack: redoStack.slice(0, -1),
            undoStack: [...undoStack, op]
        });

        switch (op.type) {
            case 'SET_SCHEDULE':
                await get().setScheduleItem(
                    op.payload.day,
                    op.payload.time,
                    op.payload.newCourse,
                    op.payload.newColor,
                    op.payload.newRoom,
                    op.payload.newLecturer,
                    true
                );
                break;
            case 'ADD_ASSIGNMENT':
                await window.electronAPI.assignments.create(op.payload.data);
                await get().fetchAssignments();
                break;
            case 'DELETE_ASSIGNMENT':
                await get().deleteAssignment(op.payload.id, true);
                break;
            case 'DELETE_PROJECT':
                await get().deleteProject(op.payload.id, true);
                break;
        }
    },
});
