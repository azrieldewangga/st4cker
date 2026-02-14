import { StateCreator } from 'zustand';
import { CourseMaterial, Subscription, UserProfile } from '@/types/models';
import { validateData, CourseMaterialSchema, SubscriptionSchema, UserProfileSchema } from '@/lib/validation';
import { isDev } from '@/lib/constants';
import { isSameMonth } from 'date-fns';

export interface MiscSlice {
    // Schedule
    schedule: Record<string, any>;
    fetchSchedule: () => Promise<void>;
    setScheduleItem: (day: string, time: string, courseId: string, color?: string, room?: string, lecturer?: string, skipLog?: boolean) => Promise<void>;
    syncScheduleToBackend: () => Promise<void>;
    fetchScheduleFromBackend: () => Promise<void>;

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
            const scheduleMap: Record<string, any> = {};

            items.forEach((item: any) => {
                const parts = item.id.split('-');
                let isMatch = false;
                if (parts.length >= 3) {
                    const itemSem = parseInt(parts[parts.length - 1]);
                    if (itemSem === currentSem) {
                        isMatch = true;
                    }
                } else {
                    isMatch = false;
                }

                if (isMatch) {
                    const key = `${item.day}-${item.startTime}`;
                    scheduleMap[key] = item;
                }
            });

            set({ schedule: scheduleMap });
        } catch (error) {
            console.error('[MiscSlice] Fetch schedule error:', error);
        }
    },

    setScheduleItem: async (day, time, courseId, color = 'bg-primary', room = '', lecturer = '', skipLog = false) => {
        try {
            const state = get() as any;
            const { schedule, userProfile, undoStack } = state;

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

            await window.electronAPI.schedule.upsert({
                id,
                day,
                startTime: time,
                endTime: '',
                course: courseId,
                location: room,
                lecturer: lecturer,
                note: JSON.stringify({ color }),
                updatedAt: new Date().toISOString()
            });
            get().fetchSchedule();
        } catch (error) {
            console.error('[MiscSlice] Set schedule item error:', error);
        }
    },

    syncScheduleToBackend: async () => {
        try {
            const state = get() as any;
            const { schedule, userProfile } = state;
            // Use server URL from userProfile or env
            // Use explicit server URL - MUST match VPS IP
            const serverUrl = 'http://103.127.134.173:3000';
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

            const response = await fetch(`${serverUrl}/api/v1/schedules/sync`, {
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
            const { userProfile } = state;
            // Use explicit server URL - MUST match VPS IP
            const serverUrl = 'http://103.127.134.173:3000';
            const apiKey = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';
            
            const response = await fetch(`${serverUrl}/api/v1/schedules`, {
                headers: {
                    'X-API-Key': apiKey,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch');
            const data = await response.json();
            
            // Jangan overwrite kalau server kosong tapi lokal ada data
            if (!data.data?.length) {
                console.log('[MiscSlice] Server has no schedules, keeping local data');
                return;
            }
            
            // Convert array to schedule map
            const scheduleMap: Record<string, any> = {};
            data.data?.forEach((item: any) => {
                const key = `${item.day}-${item.startTime}`;
                scheduleMap[key] = {
                    ...item,
                    course: item.courseName || item.course,
                    location: item.room || item.location,
                };
                // Save to local SQLite
                window.electronAPI.schedule.upsert({
                    id: item.id,
                    day: item.day,
                    startTime: item.startTime,
                    endTime: item.endTime,
                    course: item.courseName || item.course,
                    location: item.room || item.location,
                    lecturer: item.lecturer,
                    note: JSON.stringify({ color: 'bg-primary' }),
                    updatedAt: new Date().toISOString(),
                });
            });
            
            set({ schedule: scheduleMap });
            console.log('[MiscSlice] Schedule fetched from backend');
        } catch (error) {
            console.error('[MiscSlice] Fetch from backend error:', error);
            // Fallback to local
            get().fetchSchedule();
        }
    },

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
