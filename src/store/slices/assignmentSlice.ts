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
    syncAssignmentsToBackend: () => Promise<void>;
    fetchAssignmentsFromBackend: () => Promise<void>;
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
            
            // Auto-sync to backend
            try {
                await get().syncAssignmentsToBackend();
            } catch (syncErr) {
                console.error('[AssignmentSlice] Auto-sync failed:', syncErr);
            }
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
            
            // Auto-sync to backend
            try {
                await get().syncAssignmentsToBackend();
            } catch (syncErr) {
                console.error('[AssignmentSlice] Auto-sync failed:', syncErr);
            }
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
            
            // Auto-sync to backend
            try {
                await get().syncAssignmentsToBackend();
            } catch (syncErr) {
                console.error('[AssignmentSlice] Auto-sync failed:', syncErr);
            }
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

    syncAssignmentsToBackend: async () => {
        try {
            const state = get() as any;
            const { assignments, userProfile } = state;
            const serverUrl = 'http://103.127.134.173:3000';
            const apiKey = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';

            const assignmentsArray = assignments.map((a: any) => ({
                id: a.id,
                title: a.title,
                course: a.course || a.courseId,
                type: a.type || 'Tugas',
                status: a.status || 'to-do',
                deadline: a.deadline,
                note: a.note || '',
                semester: userProfile?.semester || 1,
            }));

            const response = await fetch(`${serverUrl}/api/sync-user-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                },
                body: JSON.stringify({
                    sessionToken: localStorage.getItem('sessionToken'),
                    data: {
                        activeAssignments: assignmentsArray
                    }
                }),
            });

            if (!response.ok) throw new Error('Failed to sync assignments');
            console.log('[AssignmentSlice] Assignments synced to backend');
        } catch (error) {
            console.error('[AssignmentSlice] Sync to backend error:', error);
            throw error;
        }
    },

    fetchAssignmentsFromBackend: async () => {
        try {
            const state = get() as any;
            const { userProfile } = state;
            
            // Prevent multiple simultaneous fetches
            if ((state as any).isFetchingFromBackend) {
                console.log('[AssignmentSlice] Already fetching from backend, skipping...');
                return;
            }
            
            // Set flag to prevent duplicate fetches
            set({ isFetchingFromBackend: true } as any);
            
            const serverUrl = 'http://103.127.134.173:3000';
            const apiKey = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';

            const response = await fetch(`${serverUrl}/api/v1/tasks?userId=${userProfile?.telegramUserId}`, {
                headers: {
                    'X-API-Key': apiKey,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch assignments');
            const data = await response.json();

            if (!data.data?.length) {
                console.log('[AssignmentSlice] Server has no assignments, keeping local data');
                set({ isFetchingFromBackend: false } as any);
                return;
            }

            // Convert and save to local SQLite
            const localAssignments = await window.electronAPI.assignments.list();
            
            // Create a set of existing assignment keys for duplicate detection
            const existingKeys = new Set(localAssignments.map((a: any) => 
                `${a.title?.toLowerCase().trim()}_${a.deadline}_${a.course || a.courseId}`
            ));
            
            for (const item of data.data) {
                // Check by ID first
                const existsById = localAssignments.find((a: any) => a.id === item.id);
                
                // Also check by content to prevent duplicates with different IDs
                const itemKey = `${item.title?.toLowerCase().trim()}_${item.deadline}_${item.course}`;
                const existsByContent = existingKeys.has(itemKey);
                
                const assignmentData = {
                    id: item.id,
                    title: item.title,
                    course: item.course,
                    type: item.type,
                    status: item.status,
                    deadline: item.deadline,
                    note: item.note || '',
                    semester: item.semester,
                    updatedAt: new Date().toISOString(),
                };
                
                if (existsById) {
                    // Update existing by ID
                    await window.electronAPI.assignments.update(item.id, assignmentData);
                } else if (!existsByContent) {
                    // Only create if no duplicate by content
                    await window.electronAPI.assignments.create(assignmentData);
                    existingKeys.add(itemKey); // Add to tracked keys
                } else {
                    console.log(`[AssignmentSlice] Skipping duplicate assignment: ${item.title}`);
                }
            }

            await get().fetchAssignments();
            console.log('[AssignmentSlice] Assignments fetched from backend');
        } catch (error) {
            console.error('[AssignmentSlice] Fetch from backend error:', error);
        } finally {
            set({ isFetchingFromBackend: false } as any);
        }
    },
});
