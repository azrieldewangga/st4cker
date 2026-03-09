import { StateCreator } from 'zustand';
import { Assignment } from '@/types/models';
import { validateData, AssignmentSchema } from '@/lib/validation';
import { isDev } from '@/lib/constants';
import { API_CONFIG, buildApiUrl } from '@/config/api';

export interface AssignmentSlice {
    assignments: Assignment[];
    fetchAssignments: () => Promise<void>;
    addAssignment: (data: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>, skipLog?: boolean) => Promise<void>;
    updateAssignment: (id: string, data: Partial<Assignment>) => Promise<void>;
    deleteAssignment: (id: string, skipLog?: boolean) => Promise<void>;
    duplicateAssignment: (id: string) => Promise<void>;
    reorderAssignments: (newOrder: Assignment[]) => Promise<void>;
    syncAssignmentsToBackend: () => Promise<void>;
    autoSyncAssignmentsToBackend: () => void;
    fetchAssignmentsFromBackend: () => Promise<void>;
    setupAssignmentsRealtimeSync: () => void;
    assignmentsLastSyncedAt: string | null;
    deletedAssignmentIds: Set<string>;
}

export const createAssignmentSlice: StateCreator<
    AssignmentSlice & { userProfile: any; undoStack: any[]; redoStack: any[] },
    [],
    [],
    AssignmentSlice
> = (set, get) => {
    // Inisialisasi Set di luar object literal untuk menghindari TS error
    const deletedIdsSet = new Set<string>();
    
    return {
    assignments: [],
    assignmentsLastSyncedAt: null,
    deletedAssignmentIds: deletedIdsSet,

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

            // Auto-sync to backend (debounced)
            get().autoSyncAssignmentsToBackend();
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

            // Auto-sync to backend (debounced)
            get().autoSyncAssignmentsToBackend();
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

            // Track ID yang dihapus
            const deletedIds = (get() as any).deletedAssignmentIds || new Set<string>();
            deletedIds.add(id);
            set({ deletedAssignmentIds: deletedIds } as any);

            // Update state dulu (optimistic UI)
            set((state) => ({
                assignments: state.assignments.filter(a => a.id !== id)
            }));

            // Delete dari SQLite
            await window.electronAPI.assignments.delete(id);

            // Sync ke backend - kirim ID yang dihapus
            const state = get() as any;
            const { userProfile } = state;
            const apiKey = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';

            try {
                // Call API delete langsung
                const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/tasks/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'X-API-Key': apiKey,
                        'X-Session-Token': localStorage.getItem('sessionToken') || '',
                    },
                });
                if (response.ok) {
                    console.log('[AssignmentSlice] Deleted from backend:', id);
                }
            } catch (e) {
                console.warn('[AssignmentSlice] Failed to delete from backend:', e);
            }

            // Tidak fetch dari backend setelah delete
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
            const apiKey = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';

            // Map frontend status to backend status
            const mapStatusToBackend = (status: string) => {
                switch (status) {
                    case 'done': return 'completed';
                    case 'to-do':
                    case 'progress':
                    case 'pending': return 'pending';
                    default: return 'pending';
                }
            };

            const assignmentsArray = assignments.map((a: any) => ({
                id: a.id,
                title: a.title,
                course: a.course || a.courseId,
                type: a.type || 'Tugas',
                status: mapStatusToBackend(a.status),
                deadline: a.deadline,
                note: a.note || '',
                semester: userProfile?.semester || 1,
                updatedAt: a.updatedAt || new Date().toISOString(),
            }));

            const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SYNC_USER_DATA), {
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
            const { userProfile, assignments: localAssignmentsState } = state;

            // Prevent multiple simultaneous fetches
            if ((state as any).isFetchingFromBackend) {
                console.log('[AssignmentSlice] Already fetching from backend, skipping...');
                return;
            }

            // Set flag to prevent duplicate fetches
            set({ isFetchingFromBackend: true } as any);

            const apiKey = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';

            const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TASKS, { userId: userProfile?.telegramUserId }), {
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

            // IMPROVED DUPLICATE DETECTION:
            // 1. Track by ID (UUID) - exact match
            // 2. Track by content hash (title + deadline + course) - content match
            // 3. Track by ID yang ada di local state (biar ga double fetch)

            const existingIds = new Set(localAssignments.map((a: any) => a.id));
            const existingKeys = new Set(localAssignments.map((a: any) => {
                const course = a.course || a.courseId || '';
                return `${(a.title || '').toLowerCase().trim()}_${a.deadline}_${course}`;
            }));

            // Create a map of local assignments by ID for quick lookup
            const localAssignmentsMap = new Map(localAssignments.map((a: any) => [a.id, a]));

            // Track local IDs yang sudah ada di state (prevent double create)
            const localStateIds = new Set(localAssignmentsState.map((a: Assignment) => a.id));

            // Track server IDs untuk deteksi delete
            const serverIds = new Set(data.data.map((item: any) => item.id));

            // Get deleted IDs yang sudah dihapus di session ini
            const deletedIds = (state as any).deletedAssignmentIds || new Set<string>();

            for (const item of data.data) {
                // SKIP kalau ID ini sudah dihapus di session ini
                if (deletedIds.has(item.id)) {
                    console.log(`[AssignmentSlice] Skipping deleted assignment: ${item.id}`);
                    continue;
                }
                // Normalize course ID (bisa dari item.course atau item.courseId)
                const courseId = item.course || item.courseId || '';

                // Check by ID first
                const existsById = existingIds.has(item.id) || localStateIds.has(item.id);

                // Also check by content to prevent duplicates with different IDs
                // Ini untuk handle tugas yang dibuat di telegram (UUID beda) vs app (UUID beda)
                const itemKey = `${(item.title || '').toLowerCase().trim()}_${item.deadline}_${courseId}`;
                const existsByContent = existingKeys.has(itemKey);

                // Map backend status to frontend status
                const mapStatusToFrontend = (status: string) => {
                    switch (status) {
                        case 'completed': return 'done';
                        case 'pending': return 'to-do';
                        case 'missed': return 'to-do'; // Treat missed as to-do
                        default: return status; // 'to-do', 'progress', 'done' pass through
                    }
                };

                const assignmentData = {
                    id: item.id,
                    title: item.title,
                    course: courseId, // Simpan course ID (format course-X-Y)
                    type: item.type,
                    status: mapStatusToFrontend(item.status),
                    deadline: item.deadline,
                    note: item.note || '',
                    semester: item.semester,
                    updatedAt: item.updatedAt || new Date().toISOString(),
                };

                if (existsById) {
                    // Check if local data is newer than server data
                    const localItem = localAssignmentsMap.get(item.id);
                    const serverUpdatedAt = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
                    const localUpdatedAt = localItem?.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;
                    
                    // Only update if server data is newer or local doesn't have updatedAt
                    if (!localUpdatedAt || serverUpdatedAt >= localUpdatedAt) {
                        await window.electronAPI.assignments.update(item.id, assignmentData);
                        console.log(`[AssignmentSlice] Updated existing assignment by ID: ${item.id} (server is newer)`);
                    } else {
                        console.log(`[AssignmentSlice] Skipping update for ${item.id} - local data is newer`);
                    }
                } else if (!existsByContent) {
                    // Only create if no duplicate by content
                    await window.electronAPI.assignments.create(assignmentData);
                    existingIds.add(item.id);
                    existingKeys.add(itemKey);
                    console.log(`[AssignmentSlice] Created new assignment: ${item.title}`);
                } else {
                    console.log(`[AssignmentSlice] Skipping duplicate assignment: ${item.title} (${itemKey})`);
                }
            }

            // HAPUS assignment lokal yang tidak ada di server (sudah dihapus user di device lain)
            // Tapi hanya hapus kalau assignment tersebut berasal dari server (bukan local-only)
            for (const localId of localStateIds) {
                const id = localId as string;
                if (!serverIds.has(id) && existingIds.has(id)) {
                    // Assignment ada di local tapi tidak di server = sudah dihapus
                    try {
                        await window.electronAPI.assignments.delete(id);
                        console.log(`[AssignmentSlice] Deleted local assignment not on server: ${id}`);
                    } catch (e) {
                        console.warn(`[AssignmentSlice] Failed to delete local assignment: ${id}`, e);
                    }
                }
            }

            await get().fetchAssignments();
            console.log('[AssignmentSlice] Assignments fetched from backend successfully');
        } catch (error) {
            console.error('[AssignmentSlice] Fetch from backend error:', error);
        } finally {
            set({ isFetchingFromBackend: false } as any);
        }
    },

    // Auto-sync assignments ke backend (dengan debounce)
    autoSyncAssignmentsToBackend: (() => {
        let syncTimeout: ReturnType<typeof setTimeout> | null = null;
        return function (this: any) {
            if (syncTimeout) clearTimeout(syncTimeout);
            syncTimeout = setTimeout(() => {
                const state = get() as any;
                if (state.syncAssignmentsToBackend) {
                    state.syncAssignmentsToBackend().then(() => {
                        set({ assignmentsLastSyncedAt: new Date().toISOString() } as any);
                    }).catch((err: any) => {
                        console.error('[AssignmentSlice] Auto-sync failed:', err);
                    });
                }
            }, 2000); // Debounce 2 detik
        };
    })(),

    // Setup real-time sync listener untuk assignments
    setupAssignmentsRealtimeSync: () => {
        if (typeof window === 'undefined' || !window.electronAPI?.onEvent) return;

        const handleAssignmentEvent = (event: any) => {
            console.log('[AssignmentSlice] Received real-time event:', event.eventType);

            // Handle berbagai event types
            const relevantEventTypes = [
                'task.created',
                'task.updated',
                'task.deleted',
                'assignment.created',
                'assignment.updated',
                'assignment.deleted',
                'data.synced'
            ];

            if (relevantEventTypes.includes(event.eventType)) {
                // Fetch latest data dari backend
                const state = get() as any;
                if (state.fetchAssignmentsFromBackend) {
                    // Tambahkan delay kecil untuk batch processing
                    setTimeout(() => {
                        state.fetchAssignmentsFromBackend();
                    }, 500);
                }
            }
        };

        // Listen untuk telegram-event (generic event dari backend)
        window.electronAPI.onEvent('telegram-event', handleAssignmentEvent);

        // Listen untuk assignment-specific events (jika ada)
        window.electronAPI.onEvent('assignment.created', handleAssignmentEvent);
        window.electronAPI.onEvent('assignment.updated', handleAssignmentEvent);
        window.electronAPI.onEvent('assignment.deleted', handleAssignmentEvent);

        console.log('[AssignmentSlice] Real-time sync enabled');
    },
};
};
