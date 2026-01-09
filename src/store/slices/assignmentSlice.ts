import { StateCreator } from 'zustand';
import { Assignment } from '@/types/models';
import { validateData, AssignmentSchema } from '@/lib/validation';
import { isDev } from '@/lib/constants';

export interface AssignmentSlice {
    assignments: Assignment[];
    fetchAssignments: () => Promise<void>;
    addAssignment: (data: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>, skipLog?: boolean) => Promise<void>;
    updateAssignment: (id: string, data: Partial<Assignment>) => Promise<void>;
    deleteAssignment: (id: string, skipLog?: boolean) => Promise<void>;
    duplicateAssignment: (id: string) => Promise<void>;
    reorderAssignments: (newOrder: Assignment[]) => Promise<void>;
}

export const createAssignmentSlice: StateCreator<
    AssignmentSlice & { userProfile: any; undoStack: any[]; redoStack: any[] },
    [],
    [],
    AssignmentSlice
> = (set, get) => ({
    assignments: [],

    fetchAssignments: async () => {
        try {
            const data = await window.electronAPI.assignments.list();
            const mappedData = data.map((item: any) => ({
                ...item,
                courseId: item.course || item.courseId,
            }));
            mappedData.sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
            set({ assignments: mappedData });
        } catch (err: any) {
            console.error('[AssignmentSlice] Error fetching assignments:', err);
        }
    },

    addAssignment: async (data, skipLog = false) => {
        try {
            const state = get() as any;
            const { assignments } = state;
            const maxOrder = assignments.reduce((max: number, item: any) => Math.max(max, item.customOrder || 0), 0);
            const id = `assign-${Date.now()}`;

            const newItem = {
                ...data,
                id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                course: data.courseId,
                semester: state.userProfile?.semester || 1,
                customOrder: maxOrder + 1,
                status: 'to-do' as 'to-do'
            };

            const finalValidation = validateData(AssignmentSchema, {
                ...newItem,
                courseId: newItem.course
            });

            if (!finalValidation.success) {
                throw new Error(finalValidation.errors[0]);
            }

            if (!skipLog) {
                set({ redoStack: [] });
                set((state: any) => ({
                    undoStack: [...state.undoStack, {
                        type: 'ADD_ASSIGNMENT',
                        payload: { id, data: newItem }
                    }]
                }));
            }

            await window.electronAPI.assignments.create(newItem);
            set((state) => ({
                assignments: [...state.assignments, newItem]
            }));
            get().fetchAssignments();
        } catch (err: any) {
            console.error('[AssignmentSlice] Error adding assignment:', err);
            throw err;
        }
    },

    updateAssignment: async (id, data) => {
        const validation = validateData(AssignmentSchema.partial(), data);
        if (!validation.success) {
            throw new Error(validation.errors[0]);
        }
        try {
            const updatePayload = { ...data };
            if ((updatePayload as any).courseId) {
                (updatePayload as any).course = (updatePayload as any).courseId;
                delete (updatePayload as any).courseId;
            }

            await window.electronAPI.assignments.update(id, updatePayload);
            set((state) => ({
                assignments: state.assignments.map((item) => item.id === id ? { ...item, ...data } : item)
            }));
            get().fetchAssignments();
        } catch (error) {
            console.error('[AssignmentSlice] Update error:', error);
            throw error;
        }
    },

    deleteAssignment: async (id, skipLog = false) => {
        try {
            if (!skipLog) {
                const item = get().assignments.find(a => a.id === id);
                if (item) {
                    set({ redoStack: [] });
                    set((state: any) => ({
                        undoStack: [...state.undoStack, {
                            type: 'DELETE_ASSIGNMENT',
                            payload: { id, data: item }
                        }]
                    }));
                }
            }

            await window.electronAPI.assignments.delete(id);
            get().fetchAssignments();
        } catch (error) {
            console.error('[AssignmentSlice] Delete error:', error);
            throw error;
        }
    },

    duplicateAssignment: async (id) => {
        const item = get().assignments.find(a => a.id === id);
        if (item) {
            const { id: _, createdAt: __, updatedAt: ___, ...rest } = item;
            await get().addAssignment({ ...rest, title: `${rest.title} (Copy)` });
        }
    },

    reorderAssignments: async (newOrder) => {
        set({ assignments: newOrder });
    },
});
