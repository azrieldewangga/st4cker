import { StateCreator } from 'zustand';
import { CourseMaterial, Subscription, UserProfile } from '@/types/models';
import { validateData, CourseMaterialSchema, SubscriptionSchema, UserProfileSchema } from '@/lib/validation';
import { isDev } from '@/lib/constants';
import { isSameMonth } from 'date-fns';
import { API_CONFIG, buildApiUrl } from '@/config/api';

export interface MiscSlice {
    // Schedule
    schedule: Record<string, any>;
    fetchSchedule: () => Promise<void>;
    setScheduleItem: (day: string, time: string, courseId: string, color?: string, room?: string, lecturer?: string, skipLog?: boolean, endTime?: string) => Promise<void>;
    syncScheduleToBackend: () => Promise<void>;
    fetchScheduleFromBackend: () => Promise<void>;
    setupScheduleRealtimeSync: () => void;
    autoSyncScheduleToBackend: () => void;

    // Materials
    materials: Record<string, CourseMaterial[]>;
    fetchMaterials: (courseId: string) => Promise<void>;
    addMaterial: (courseId: string, type: 'link' | 'file', title: string, url: string) => Promise<void>;
    deleteMaterial: (id: string, courseId: string) => Promise<void>;

    // Subscriptions
    subscriptions: Subscription[];
    fetchSubscriptions: () => Promise<void>;
    addSubscription: (data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateSubscription: (id: string, data: Partial<Subscription>) => Promise<void>;
    deleteSubscription: (id: string) => Promise<void>;
    checkSubscriptionDeductions: () => Promise<void>;

    // User Profile
    userProfile: UserProfile | null;
    fetchUserProfile: () => Promise<void>;
    updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;

    // App State
    isLoading: boolean;
    isAppReady: boolean;
    error: string | null;
    notification: { message: string, type: 'info' | 'success' | 'error' | 'warning' } | null;
    showNotification: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
    hideNotification: () => void;

    // Seed
    seedDatabase: () => Promise<void>;
}

export const createMiscSlice: StateCreator<
    MiscSlice & { userProfile: any; undoStack: any[]; redoStack: any[]; fetchCourses: () => void; fetchTransactions: () => void; currency: string },
    [],
    [],
    MiscSlice
> = (set, get) => ({
    schedule: {},
    materials: {},
    subscriptions: [],
    userProfile: null,
    isLoading: false,
    isAppReady: false,
    error: null,
    notification: null,

    fetchSchedule: async () => {
        try {
            const state = get() as any;
            const profile = state.userProfile;
            const currentSem = profile?.semester || 1;
            const items = await window.electronAPI.schedule.getAll();
            console.log(`[MiscSlice] fetchSchedule: Got ${items.length} items from SQLite, currentSem=${currentSem}`);
            const scheduleMap: Record<string, any> = {};

            items.forEach((item: any) => {
                // Use semester field if available, otherwise fallback to ID parsing for legacy data
                const itemSem = item.semester ?? (() => {
                    const parts = item.id.split('-');
                    if (parts.length >= 3) {
                        return parseInt(parts[parts.length - 1]) || 1;
                    }
                    return 1;
                })();
                
                if (itemSem === currentSem) {
                    const key = `${item.day}-${item.startTime}`;
                    scheduleMap[key] = item;
                }
            });

            const matchedKeys = Object.keys(scheduleMap);
            console.log(`[MiscSlice] fetchSchedule: Filtered to ${matchedKeys.length} items for semester ${currentSem}`);
            if (matchedKeys.length > 0) {
                console.log(`[MiscSlice] fetchSchedule: Keys = ${matchedKeys.join(', ')}`);
            }

            set({ schedule: scheduleMap });
        } catch (error) {
            console.error('[MiscSlice] Fetch schedule error:', error);
        }
    },

    setScheduleItem: async (day, time, courseId, color = 'bg-primary', room = '', lecturer = '', skipLog = false, endTime = '') => {
        try {
            const state = get() as any;
            const { schedule, userProfile, undoStack } = state;
            const now = new Date().toISOString();

            if (!skipLog) {
                const key = `${day}-${time}`;
                const prevItem = schedule[key];

                const op = {
                    type: 'SET_SCHEDULE',
                    payload: {
                        day,
                        time,
                        prevCourse: prevItem?.course || '',
                        prevColor: prevItem?.color || '',
                        prevRoom: prevItem?.location || '',
                        prevLecturer: prevItem?.lecturer || '',
                        newCourse: courseId,
                        newColor: color,
                        newRoom: room,
                        newLecturer: lecturer
                    }
                };

                set({
                    undoStack: [...undoStack, op],
                    redoStack: []
                });
            }

            const profile = userProfile;
            const semester = profile?.semester || 1;
            const id = `${day}-${time}-${semester}`;

            // Calculate endTime if not provided (default to 2 hours after start)
            let calculatedEndTime = endTime;
            if (!calculatedEndTime && time) {
                const [hours, minutes] = time.split(':').map(Number);
                const endDate = new Date();
                endDate.setHours(hours, minutes + 120); // Add 2 hours
                calculatedEndTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
            }

            await window.electronAPI.schedule.upsert({
                id,
                day,
                startTime: time,
                endTime: calculatedEndTime,
                course: courseId,
                location: room,
                lecturer: lecturer,
                semester: semester,
                note: JSON.stringify({ color }),
                updatedAt: now,
                lastModifiedAt: now,
                modifiedBy: 'app'
            });
            
            // Update local state
            get().fetchSchedule();
            
            // Trigger auto-sync ke backend (dengan debounce)
            get().autoSyncScheduleToBackend();
            
        } catch (error) {
            console.error('[MiscSlice] Set schedule item error:', error);
        }
    },

    syncScheduleToBackend: async () => {
        try {
            const state = get() as any;
            const { schedule, userProfile } = state;
            // Use server URL from userProfile or env
            const apiKey = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';
            
            const schedulesArray = Object.entries(schedule).map(([key, value]: [string, any]) => ({
                id: value.id || key,
                day: value.day,
                startTime: value.startTime,
                endTime: value.endTime || '',
                course: value.course,
                location: value.location || '',
                lecturer: value.lecturer || '',
                isActive: true,
                semester: userProfile?.semester || 1,
            }));

            const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SCHEDULES_SYNC), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                },
                body: JSON.stringify({ schedules: schedulesArray }),
            });

            if (!response.ok) throw new Error('Failed to sync');
            console.log('[MiscSlice] Schedule synced to backend');
        } catch (error) {
            console.error('[MiscSlice] Sync to backend error:', error);
            throw error;
        }
    },

    fetchScheduleFromBackend: async () => {
        try {
            const state = get() as any;
            const { userProfile, schedule: localScheduleState } = state;
            const apiKey = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';
            
            // Get sync status untuk timestamp comparison
            const syncStatusRes = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SCHEDULES_SYNC_STATUS), {
                headers: { 'X-API-Key': apiKey },
            });
            
            let serverLastModified = null;
            if (syncStatusRes.ok) {
                const syncStatus = await syncStatusRes.json();
                serverLastModified = syncStatus.lastModifiedAt;
            }
            
            // Get local last modified
            const localSchedules = await window.electronAPI.schedule.getAll();
            const localLastModified = localSchedules.length > 0 
                ? localSchedules.reduce((latest: string, s: any) => {
                    const itemDate = s.updatedAt || s.createdAt || '1970-01-01';
                    return itemDate > latest ? itemDate : latest;
                }, '1970-01-01')
                : null;
            
            // Skip jika server tidak ada update baru
            if (serverLastModified && localLastModified && 
                new Date(serverLastModified) <= new Date(localLastModified)) {
                console.log('[MiscSlice] Server schedule is not newer, skipping fetch');
                return;
            }
            
            const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SCHEDULES), {
                headers: {
                    'X-API-Key': apiKey,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch');
            const data = await response.json();
            
            console.log(`[MiscSlice] fetchScheduleFromBackend: Got ${data.data?.length || 0} items from server`);
            if (data.data?.length > 0) {
                console.log('[MiscSlice] First item from server:', JSON.stringify(data.data[0]));
            }
            
            // Jangan overwrite kalau server kosong tapi lokal ada data
            if (!data.data?.length) {
                console.log('[MiscSlice] Server has no schedules, keeping local data');
                return;
            }
            
            // Get local schedules untuk duplicate detection dan conflict resolution
            const existingIds = new Set(localSchedules.map((s: any) => s.id));
            const existingKeys = new Set(localSchedules.map((s: any) => 
                `${s.day}_${s.startTime}_${(s.course || '').toLowerCase().trim()}`
            ));
            
            // Day mapping: dayOfWeek (number) -> day (string)
            const dayMap: Record<number, string> = {
                1: 'Senin',
                2: 'Selasa', 
                3: 'Rabu',
                4: 'Kamis',
                5: 'Jumat'
            };
            
            // Convert array to schedule map dengan timestamp-based conflict resolution
            const scheduleMap: Record<string, any> = { ...localScheduleState };
            let updatedCount = 0;
            let skippedCount = 0;
            let processedCount = 0;
            
            data.data?.forEach((item: any) => {
                processedCount++;
                // Map dayOfWeek to day string
                const day = item.day || dayMap[item.dayOfWeek] || '';
                const key = `${day}-${item.startTime}`;
                const itemKey = `${item.day}_${item.startTime}_${(item.courseName || item.course || '').toLowerCase().trim()}`;
                
                // Check for existing local schedule
                const existingLocal = localSchedules.find((s: any) => 
                    s.id === item.id || 
                    (`${s.day}-${s.startTime}` === key && (s.course || '').toLowerCase() === (item.courseName || item.course || '').toLowerCase())
                );
                
                // Conflict resolution: Prioritize server data when explicitly fetching from backend
                // Only skip if local data was recently modified by user (within last 5 minutes)
                const FIVE_MINUTES = 5 * 60 * 1000;
                const localModified = existingLocal ? new Date(existingLocal.updatedAt || existingLocal.createdAt || 0).getTime() : 0;
                const recentlyModifiedLocally = existingLocal && (Date.now() - localModified < FIVE_MINUTES);
                
                // Update if: no local data, or local not recently modified, or server has different data
                if (!existingLocal || !recentlyModifiedLocally) {
                    scheduleMap[key] = {
                        ...item,
                        day: day,  // Use mapped day
                        course: item.courseName || item.course,
                        location: item.room || item.location,
                    };
                    
                    // Save to local SQLite
                    const state = get() as any;
                    const currentSem = state.userProfile?.semester || 1;
                    const scheduleData = {
                        id: item.id,
                        day: day,  // Use mapped day
                        startTime: item.startTime,
                        endTime: item.endTime,
                        course: item.courseName || item.course,
                        location: item.room || item.location,
                        lecturer: item.lecturer,
                        semester: item.semester || currentSem,
                        note: JSON.stringify({ color: 'bg-primary' }),
                        updatedAt: new Date().toISOString(),
                    };
                    
                    if (!existingIds.has(item.id)) {
                        window.electronAPI.schedule.upsert(scheduleData);
                        existingIds.add(item.id);
                        existingKeys.add(itemKey);
                    } else {
                        // Update existing
                        window.electronAPI.schedule.upsert(scheduleData);
                        updatedCount++;
                    }
                } else {
                    skippedCount++;
                    console.log(`[MiscSlice] Keeping local schedule (recently modified): ${item.courseName || item.course}`);
                }
            });
            
            console.log(`[MiscSlice] Processed: ${processedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);
            
            set({ schedule: scheduleMap });
            const finalKeys = Object.keys(scheduleMap);
            console.log(`[MiscSlice] fetchScheduleFromBackend: ${finalKeys.length} items in final state, ${updatedCount} updated from server`);
            if (finalKeys.length > 0) {
                console.log(`[MiscSlice] fetchScheduleFromBackend: Keys = ${finalKeys.join(', ')}`);
            }
        } catch (error) {
            console.error('[MiscSlice] Fetch from backend error:', error);
            // Fallback to local
            get().fetchSchedule();
        }
    },

    // Setup WebSocket listener untuk real-time schedule updates
    setupScheduleRealtimeSync: () => {
        const handleScheduleEvent = (event: any) => {
            const { eventType, payload } = event;
            console.log(`[MiscSlice] Received schedule event: ${eventType}`, payload);
            
            switch (eventType) {
                case 'schedule.created':
                case 'schedule.updated':
                    // Auto-refresh schedule dari backend
                    get().fetchScheduleFromBackend();
                    break;
                case 'schedule.deleted':
                    // Remove dari local state
                    if (payload?.id) {
                        set((state) => {
                            const newSchedule = { ...state.schedule };
                            // Find and delete key yang match
                            Object.keys(newSchedule).forEach(key => {
                                if (newSchedule[key]?.id === payload.id) {
                                    delete newSchedule[key];
                                }
                            });
                            return { schedule: newSchedule };
                        });
                        // Also delete dari local SQLite
                        window.electronAPI.schedule.delete?.(payload.id).catch(() => {
                            // Schedule might not exist locally
                        });
                    }
                    break;
                case 'schedule.synced':
                    // Bulk sync completed, refresh
                    get().fetchScheduleFromBackend();
                    break;
            }
        };

        // Register event listener jika electronAPI tersedia
        if (window.electronAPI?.onEvent) {
            window.electronAPI.onEvent('schedule.created', handleScheduleEvent);
            window.electronAPI.onEvent('schedule.updated', handleScheduleEvent);
            window.electronAPI.onEvent('schedule.deleted', handleScheduleEvent);
            window.electronAPI.onEvent('schedule.synced', handleScheduleEvent);
            console.log('[MiscSlice] Real-time schedule sync enabled');
        }
    },

    // Auto-sync schedule ke backend (dengan debounce)
    autoSyncScheduleToBackend: (() => {
        let syncTimeout: ReturnType<typeof setTimeout> | null = null;
        return () => {
            if (syncTimeout) clearTimeout(syncTimeout);
            syncTimeout = setTimeout(() => {
                const state = get() as any;
                if (state.syncScheduleToBackend) {
                    state.syncScheduleToBackend().catch((err: any) => {
                        console.error('[MiscSlice] Auto-sync failed:', err);
                    });
                }
            }, 2000); // Debounce 2 detik
        };
    })(),

    fetchMaterials: async (courseId) => {
        try {
            const data = await window.electronAPI.materials.getByCourse(courseId);
            set((state) => ({
                materials: { ...state.materials, [courseId]: data }
            }));
        } catch (error) {
            console.error('[MiscSlice] Fetch materials error:', error);
        }
    },

    addMaterial: async (courseId, type, title, url) => {
        try {
            const materialId = `mat-${Date.now()}`;
            await window.electronAPI.materials.add(materialId, courseId, type, title, url);
            get().fetchMaterials(courseId);
        } catch (error) {
            console.error('[MiscSlice] Add material error:', error);
            throw error;
        }
    },

    deleteMaterial: async (id, courseId) => {
        try {
            await window.electronAPI.materials.delete(id);
            get().fetchMaterials(courseId);
        } catch (error) {
            console.error('[MiscSlice] Delete material error:', error);
            throw error;
        }
    },

    fetchSubscriptions: async () => {
        try {
            const data = await window.electronAPI.subscriptions.list();
            set({ subscriptions: data });
        } catch (error) {
            console.error('[MiscSlice] Fetch subscriptions error:', error);
        }
    },

    addSubscription: async (data) => {
        const validation = validateData(SubscriptionSchema, data);
        if (!validation.success) {
            throw new Error(validation.errors[0]);
        }
        try {
            await window.electronAPI.subscriptions.create(data);
            get().fetchSubscriptions();
        } catch (error) {
            console.error('[MiscSlice] Add subscription error:', error);
            throw error;
        }
    },

    updateSubscription: async (id, data) => {
        const validation = validateData(SubscriptionSchema.partial(), data);
        if (!validation.success) {
            throw new Error(validation.errors[0]);
        }
        try {
            await window.electronAPI.subscriptions.update(id, data);
            get().fetchSubscriptions();
        } catch (error) {
            console.error('[MiscSlice] Update subscription error:', error);
            throw error;
        }
    },

    deleteSubscription: async (id) => {
        try {
            await window.electronAPI.subscriptions.delete(id);
            get().fetchSubscriptions();
        } catch (error) {
            console.error('[MiscSlice] Delete subscription error:', error);
            throw error;
        }
    },

    checkSubscriptionDeductions: async () => {
        try {
            const state = get() as any;
            const { subscriptions, transactions, currency } = state;
            const today = new Date();

            for (const sub of subscriptions) {
                const lastPaid = sub.lastPaidDate ? new Date(sub.lastPaidDate) : null;
                const shouldDeduct = !lastPaid || !isSameMonth(lastPaid, today);

                if (shouldDeduct && today.getDate() >= sub.dueDay) {
                    await window.electronAPI.transactions.create({
                        title: `${sub.name} Subscription`,
                        category: 'subscription',
                        amount: sub.cost,
                        currency,
                        date: today.toISOString(),
                        type: 'expense',
                        createdAt: today.toISOString(),
                        updatedAt: today.toISOString()
                    });

                    await window.electronAPI.subscriptions.update(sub.id, {
                        lastPaidDate: today.toISOString()
                    });
                }
            }

            get().fetchTransactions();
            get().fetchSubscriptions();
        } catch (error) {
            console.error('[MiscSlice] Check subscription deductions error:', error);
        }
    },

    fetchUserProfile: async () => {
        if (isDev) console.log('[MiscSlice] Fetching user profile...');
        try {
            const profile = await window.electronAPI.userProfile.get();
            if (isDev) console.log('[MiscSlice] User Profile fetched:', profile);
            if (profile) {
                set({ userProfile: profile });
                get().fetchCourses();
            } else {
                if (isDev) console.log('[MiscSlice] No profile returned. Waiting for Onboarding.');
                set({ userProfile: null });
            }
        } catch (err: any) {
            console.error('[MiscSlice] Error fetching profile:', err);
        }
    },

    updateUserProfile: async (data) => {
        const validation = validateData(UserProfileSchema.partial(), data);
        if (!validation.success) {
            console.error('[MiscSlice] Validation Failed:', validation.errors);
            set({ error: validation.errors.join(', ') });
            throw new Error(validation.errors[0]);
        }

        try {
            const updated = await window.electronAPI.userProfile.update(data);
            set({ userProfile: updated });
            if (data.semester) {
                get().fetchCourses();
            }
        } catch (err: any) {
            set({ error: err.message });
        }
    },

    showNotification: (message, type = 'info') => {
        set({ notification: { message, type } });
    },

    hideNotification: () => {
        set({ notification: null });
    },

    seedDatabase: async () => {
        try {
            // await window.electronAPI.db.seed();
            console.warn('[MiscSlice] Seed database not implemented in IElectronAPI');
        } catch (error) {
            console.error('[MiscSlice] Seed database error:', error);
        }
    },
});
