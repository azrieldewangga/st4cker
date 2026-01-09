import { create } from 'zustand';
import { Assignment, Course, UserProfile, Transaction, CourseMaterial, Subscription, Project, ProjectSession, ProjectAttachment } from '../types/models';
import { NotificationService } from '../services/NotificationService';
import { getUSDRate, refreshExchangeRate } from '../services/exchangeRate';
import {
    validateData,
    AssignmentSchema,
    TransactionSchema,
    UserProfileSchema,
    CourseSchema,
    SubscriptionSchema,
    CourseMaterialSchema
} from '../lib/validation';
import curriculumDataJson from '../lib/curriculum.json';
import { EXCHANGE_RATES, ANALYTICS_CONFIG, isDev } from '@/lib/constants';
import { isSameMonth } from 'date-fns';

const curriculumData = curriculumDataJson as Record<string, { sks: number; name: string; id?: string }[]>;


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
        payload: { id: string; data: Assignment } // Redo: add again, Undo: delete
    }
    | {
        type: 'DELETE_ASSIGNMENT';
        payload: { id: string; data: Assignment } // Restore assignment
    }
    | {
        type: 'ADD_TRANSACTION';
        payload: { id: string; data: Transaction }
    }
    | {
        type: 'DELETE_TRANSACTION';
        payload: { id: string; data: Transaction }
    }
    | {
        type: 'DELETE_PROJECT';
        payload: { id: string; data: Project }
    };

interface AppState {
    // ... existing ...
    undoStack: UndoOp[];
    redoStack: UndoOp[];
    undo: () => Promise<void>;
    redo: () => Promise<void>;

    assignments: Assignment[];
    courses: Course[];
    userProfile: UserProfile | null;
    grades: Record<string, string>; // courseId -> grade
    performanceRecords: Course[]; // Cache of ALL courses in DB
    schedule: Record<string, any>; // key: "Day-Time", val: { id, courseId, color, ... }
    materials: Record<string, CourseMaterial[]>; // key: courseId, val: list of materials
    transactions: Transaction[];
    isLoading: boolean;
    isAppReady: boolean;
    error: string | null;

    isHistoryWindowOpen: boolean;
    setHistoryWindowOpen: (isOpen: boolean) => void;

    isSearchOpen: boolean;
    setSearchOpen: (isOpen: boolean) => void;

    currency: 'IDR' | 'USD';
    setCurrency: (currency: 'IDR' | 'USD') => void;

    exchangeRate: number;
    fetchExchangeRate: () => Promise<void>;
    refreshExchangeRate: () => Promise<void>;

    theme: string;

    // Auto Theme
    autoTheme: boolean;
    setAutoTheme: (enabled: boolean) => void;
    themeSchedule: { start: string; end: string }; // HH:mm format
    setThemeSchedule: (schedule: { start: string; end: string }) => void;
    setTheme: (theme: string) => void;

    monthlyLimit: number;
    setMonthlyLimit: (limit: number) => void;

    // Actions
    fetchUserProfile: () => Promise<void>;
    initApp: (skipDelay?: boolean) => Promise<void>;
    updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;

    fetchAssignments: () => Promise<void>;
    addAssignment: (data: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>, skipLog?: boolean) => Promise<void>;
    updateAssignment: (id: string, data: Partial<Assignment>) => Promise<void>;
    deleteAssignment: (id: string, skipLog?: boolean) => Promise<void>;
    duplicateAssignment: (id: string) => Promise<void>;
    reorderAssignments: (newOrder: Assignment[]) => Promise<void>;



    fetchCourses: () => Promise<void>;
    fetchGrades: () => Promise<void>;
    updateGrade: (courseId: string, grade: string) => Promise<void>;
    addCourse: (semester: number) => Promise<void>;
    updateCourse: (course: Course) => Promise<void>;
    deleteCourse: (id: string) => Promise<void>;

    // --- Materials ---

    fetchSchedule: () => Promise<void>;
    setScheduleItem: (day: string, time: string, courseId: string, color?: string, room?: string, lecturer?: string, skipLog?: boolean) => Promise<void>;

    fetchTransactions: () => Promise<void>;
    addTransaction: (data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
    deleteTransaction: (id: string) => Promise<void>;
    clearTransactions: () => Promise<void>;

    getSemesterCourses: (semester: number) => Course[];

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

    // Projects
    projects: Project[];
    projectSessions: Record<string, ProjectSession[]>; // key: projectId
    projectAttachments: Record<string, ProjectAttachment[]>; // key: projectId
    fetchProjects: () => Promise<void>;
    getProjectById: (id: string) => Promise<Project | null>;
    addProject: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project | null>;
    updateProject: (id: string, data: Partial<Project>) => Promise<void>;
    deleteProject: (id: string, skipLog?: boolean) => Promise<void>;

    // Project Sessions
    fetchProjectSessions: (projectId: string) => Promise<void>;
    addProjectSession: (data: Omit<ProjectSession, 'id' | 'createdAt'>) => Promise<void>;
    updateProjectSession: (id: string, data: Partial<ProjectSession>) => Promise<void>;
    deleteProjectSession: (id: string, projectId: string) => Promise<void>;

    // Project Attachments
    fetchProjectAttachments: (projectId: string) => Promise<void>;
    addProjectAttachment: (data: Omit<ProjectAttachment, 'id' | 'createdAt'>) => Promise<void>;
    deleteProjectAttachment: (id: string, projectId: string) => Promise<void>;

    // Notifications
    notification: { message: string, type: 'info' | 'success' | 'error' | 'warning' } | null;
    showNotification: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
    hideNotification: () => void;

    seedDatabase: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
    undoStack: [],
    redoStack: [],

    undo: async () => {
        const { undoStack, redoStack } = get();
        if (undoStack.length === 0) return;

        const op = undoStack[undoStack.length - 1];
        // Move to Redo Stack
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
                // Restore deleted assignment by recreating it
                await window.electronAPI.assignments.create(op.payload.data);
                await get().fetchAssignments();
                break;
            case 'DELETE_PROJECT':
                // Restore deleted project
                // @ts-ignore
                await window.electronAPI.projects.create(op.payload.data);
                await get().fetchProjects();
                break;
        }
    },

    redo: async () => {
        const { undoStack, redoStack } = get();
        if (redoStack.length === 0) return;

        const op = redoStack[redoStack.length - 1];
        // Move back to Undo Stack
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
                // Redoing an ADD means adding it again
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

    assignments: [],
    courses: [],
    // ... rest of init state
    userProfile: null,
    grades: {},
    performanceRecords: [],
    schedule: {},
    materials: {}, // Initialize materials
    subscriptions: [], // Initialize subscriptions
    projects: [], // Initialize projects
    projectSessions: {}, // Initialize project sessions by projectId
    projectAttachments: {}, // Initialize project attachments by projectId
    transactions: [],
    isLoading: false,
    isAppReady: false,
    error: null,

    isHistoryWindowOpen: false,
    setHistoryWindowOpen: (isOpen) => set({ isHistoryWindowOpen: isOpen }),

    isSearchOpen: false,
    setSearchOpen: (isOpen) => set({ isSearchOpen: isOpen }),

    // ... rest ...

    currency: 'IDR',
    setCurrency: (currency) => set({ currency }),

    exchangeRate: EXCHANGE_RATES.FALLBACK_IDR_TO_USD, // Default fallback
    fetchExchangeRate: async () => {
        try {
            const rate = await getUSDRate();
            set({ exchangeRate: rate });
            if (isDev) console.log('[Store] Exchange rate updated:', rate);
        } catch (error) {
            console.error('[Store] Failed to fetch exchange rate:', error);
            // Keep fallback value
        }
    },
    refreshExchangeRate: async () => {
        try {
            const rate = await refreshExchangeRate();
            set({ exchangeRate: rate });
            if (isDev) console.log('[Store] Exchange rate refreshed:', rate);
        } catch (error) {
            console.error('[Store] Failed to refresh exchange rate:', error);
        }
    },

    // Theme State - migrate old themes to new ones
    // Theme State
    theme: localStorage.getItem('theme') || 'system',
    autoTheme: localStorage.getItem('auto-theme') === 'true',
    themeSchedule: JSON.parse(localStorage.getItem('theme-schedule') || '{"start":"18:00","end":"06:00"}'),

    setTheme: (theme: string) => {
        localStorage.setItem('theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        set({ theme });
    },

    setAutoTheme: (enabled: boolean) => {
        set({ autoTheme: enabled });
        localStorage.setItem('auto-theme', String(enabled));
    },

    setThemeSchedule: (schedule: { start: string; end: string }) => {
        set({ themeSchedule: schedule });
        localStorage.setItem('theme-schedule', JSON.stringify(schedule));
    },

    // Monthly Limit
    monthlyLimit: parseInt(localStorage.getItem('monthlyLimit') || String(ANALYTICS_CONFIG.DEFAULT_MONTHLY_LIMIT)),
    setMonthlyLimit: (limit: number) => {
        localStorage.setItem('monthlyLimit', limit.toString());
        set({ monthlyLimit: limit });
    },

    initApp: async (skipDelay = false) => {
        set({ isAppReady: false });
        // Use 'get()' inside the async function to simplify
        const { fetchUserProfile, fetchTransactions, fetchAssignments, fetchSubscriptions, checkSubscriptionDeductions, seedDatabase, fetchExchangeRate } = get();

        // Fetch exchange rate early (non-blocking)
        fetchExchangeRate().catch(err => console.error('Exchange rate fetch error:', err));

        // 1. Ensure DB is seeded from JSON (Migration)
        await seedDatabase();

        const promises: Promise<any>[] = [
            fetchUserProfile(),
            fetchTransactions(),
            fetchAssignments(),
            fetchSubscriptions()
        ];

        // Check for auto-deductions silently
        checkSubscriptionDeductions().catch(err => console.error('Auto-deduct error:', err));

        // Only add delay branding for main window
        if (!skipDelay) {
            promises.push(new Promise(resolve => setTimeout(resolve, 2000)));
        }

        await Promise.all(promises);

        // Check for notifications after data is loaded
        const { assignments, subscriptions } = get();
        NotificationService.checkDeadlineNotifications(assignments, subscriptions);

        set({ isAppReady: true });
    },

    fetchUserProfile: async () => {
        if (isDev) console.log('[useStore] Fetching user profile...');
        try {
            const profile = await window.electronAPI.userProfile.get();
            if (isDev) console.log('[useStore] User Profile fetched:', profile);
            if (profile) {
                set({ userProfile: profile });
                get().fetchCourses();
            } else {
                // No profile found = Fresh Install
                // Leave userProfile as null. The specific routing gate (App.tsx) or Onboarding logic
                // will handle the redirection.
                if (isDev) console.log('[useStore] No profile returned. Waiting for Onboarding.');
                set({ userProfile: null });
                // Don't fetch courses yet if we don't know the semester
            }
        } catch (err: any) {
            console.error('[useStore] Error fetching profile:', err);
        }
    },

    updateUserProfile: async (data) => {
        const validation = validateData(UserProfileSchema.partial(), data);
        if (!validation.success) {
            console.error('[Store] Validation Failed:', validation.errors);
            set({ error: validation.errors.join(', ') });
            throw new Error(validation.errors[0]);
        }

        try {
            const updated = await window.electronAPI.userProfile.update(data);
            set({ userProfile: updated });
            // If semester changed, re-fetch courses
            if (data.semester) {
                get().fetchCourses();
            }
        } catch (err: any) {
            set({ error: err.message });
        }
    },

    fetchAssignments: async () => {
        set({ isLoading: true });
        try {
            const data = await window.electronAPI.assignments.list();
            // MAP DB 'course' -> Frontend 'courseId'
            const mappedData = data.map((item: any) => ({
                ...item,
                courseId: item.course || item.courseId, // Handle both just in case
            }));

            // Sort by deadline ascending by default
            mappedData.sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
            set({ assignments: mappedData, isLoading: false });
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    addAssignment: async (data, skipLog = false) => {
        const validation = validateData(AssignmentSchema.omit({ status: true, semester: true }), data); // Allow defaults
        if (!validation.success) {
            // Check if it failed only on missing defaults that we fill below
            // Actually, best to validate the FINAL object or a specific input schema.
            // We'll validate the input 'data' against a loose schema or the final object.
            // Let's validate the 'data' known fields.
            // Note: AssignmentSchema requires status/semester. We fill them below.
        }

        set({ isLoading: true });
        try {
            const { assignments } = get();
            const maxOrder = assignments.reduce((max, item) => Math.max(max, item.customOrder || 0), 0);
            const id = `assign-${Date.now()}`;

            const newItem = {
                ...data,
                id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                course: data.courseId,
                semester: get().userProfile?.semester || 1,
                customOrder: maxOrder + 1,
                status: 'to-do' as 'to-do' // Default
            };

            // Validate Final Object
            const finalValidation = validateData(AssignmentSchema, {
                ...newItem,
                courseId: newItem.course // Schema expects courseId
            });
            if (!finalValidation.success) {
                set({ error: finalValidation.errors.join(', '), isLoading: false });
                throw new Error(finalValidation.errors[0]);
            }


            if (!skipLog) {
                set({ redoStack: [] });
                set(state => ({
                    undoStack: [...state.undoStack, {
                        type: 'ADD_ASSIGNMENT',
                        payload: { id, data: newItem }
                    }]
                }));
            }

            await window.electronAPI.assignments.create(newItem);

            set((state) => {
                const newList = [...state.assignments, newItem];
                return { assignments: newList, isLoading: false };
            });
            get().fetchAssignments();
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    updateAssignment: async (id, data) => {
        const validation = validateData(AssignmentSchema.partial(), data);
        if (!validation.success) {
            set({ error: validation.errors.join(', ') });
            throw new Error(validation.errors[0]);
        }
        try {
            // Map course relation
            const updatePayload = { ...data };
            if (updatePayload.courseId) {
                (updatePayload as any).course = updatePayload.courseId;
                delete updatePayload.courseId;
            }

            await window.electronAPI.assignments.update(id, updatePayload);
            // Optimistic update or refetch
            set((state) => ({
                assignments: state.assignments.map((item) => item.id === id ? { ...item, ...data } : item)
            }));
            get().fetchAssignments();
        } catch (error) {
            console.error('Update assignment error:', error);
        }
    },

    updateStatus: async (id: string, status: string) => {
        try {
            await window.electronAPI.assignments.updateStatus(id, status);
            get().fetchAssignments();
        } catch (error) {
            console.error('Update status error:', error);
        }
    },

    deleteAssignment: async (id, skipLog = false) => {
        try {
            if (!skipLog) {
                const item = get().assignments.find(a => a.id === id);
                if (item) {
                    set({ redoStack: [] });
                    set(state => ({
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
            console.error('Delete assignment error:', error);
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
        // Optional: Persist order if DB supports it (e.g. 'order' column)
    },


    // --- Courses & Grades (Performance) ---

    fetchCourses: async () => {
        const profile = get().userProfile;
        if (!profile) return;

        // Ensure we have the latest DB data first!
        await get().fetchGrades();

        // Use the unified Hybrid logic (DB + JSON)
        // This ensures what we see in the Schedule Dropdown matches what we see in Performance
        // and includes any future/custom courses from DB.
        const mappedCourses = get().getSemesterCourses(profile.semester);

        set({ courses: mappedCourses });
    },

    fetchGrades: async () => {
        // Fetch grades from DB
        const profile = get().userProfile;
        if (!profile) return;

        // Fetch ALL courses/grades from all semesters
        const dbCourses = await window.electronAPI.performance.getCourses();

        // Store raw records for "Hybrid" merging
        set({ performanceRecords: dbCourses });

        const gradeMap: Record<string, string> = {};

        dbCourses.forEach((dbGrade: any) => {
            // ... (keep mapping logic for legacy gradeMap support if needed, or rely on performanceRecords?)
            // We'll keep gradeMap for now as lighter components usage? 
            // Rebuild grade map from DB

            // Re-use logic to map ID
            let mappedId = dbGrade.id;
            if (dbGrade.id && dbGrade.id.startsWith('course-')) {
                mappedId = dbGrade.id;
            } else {
                let found = false;
                for (const semKey of Object.keys(curriculumData)) {
                    if (found) break;
                    const semCourses = curriculumData[semKey];
                    if (!semCourses) continue;

                    semCourses.forEach((c, idx) => {
                        if (found) return;
                        if (c.name === dbGrade.name || c.name === dbGrade.id) {
                            mappedId = `course-${semKey}-${idx}`;
                            found = true;
                        }
                    });
                }
            }
            if (mappedId) {
                gradeMap[mappedId] = dbGrade.grade;
            }
        });
        set({ grades: gradeMap });
    },

    updateGrade: async (courseId, grade) => {
        const profile = get().userProfile;
        if (!profile) return;

        // Try to find SKS from current courses or Curriculum
        let sks = 3; // Default
        const parts = courseId.split('-'); // course-SEM-INDEX
        if (parts.length === 3) {
            const sem = parts[1];
            const idx = parseInt(parts[2]);
            const cData = curriculumData[sem]?.[idx];
            if (cData) sks = cData.sks;
        }

        // Just in case, check current courses state too
        const course = get().courses.find(c => c.id === courseId);
        if (course) sks = course.sks || sks;

        await window.electronAPI.performance.upsertCourse({
            id: courseId,
            semester: parts.length === 3 ? parseInt(parts[1]) : profile.semester,
            name: course ? course.name : courseId, // use ID as name fallback, or better lookup
            sks: sks,
            grade: grade,
            location: course?.location || '',
            lecturer: course?.lecturer || '',
            updatedAt: new Date().toISOString()
        });

        get().fetchGrades();
    },

    // --- Schedule ---

    fetchSchedule: async () => {
        try {
            const profile = get().userProfile;
            const currentSem = profile?.semester || 1;
            const items = await window.electronAPI.schedule.getAll();
            const scheduleMap: Record<string, any> = {};

            items.forEach((item: any) => {
                // Check if item belongs to current semester
                // Format: "Day-Time-Semester" or legacy "Day-Time"
                const parts = item.id.split('-');
                // Basic check: if parts length > 2 and last part == currentSem
                // ID: "Senin-08:00-3" -> parts ["Senin", "08:00", "3"]

                let isMatch = false;
                if (parts.length >= 3) {
                    const itemSem = parseInt(parts[parts.length - 1]);
                    if (itemSem === currentSem) {
                        isMatch = true;
                    }
                } else {
                    // Legacy Item (No semester suffix)
                    // Option: Show it for ALL semesters? 
                    // Or Show it ONLY for Sem 1?
                    // User complained about "course 3.x" showing in other semesters.
                    // So better to HIDE legacy items unless we migrate them.
                    // Let's assume Legacy = Global? No, bad UX.
                    // Let's hide them to be safe, or migrate?
                    // Safe bet: Hide them. If user wants them, they re-add.
                    isMatch = false;
                }

                if (isMatch) {
                    const key = `${item.day}-${item.startTime}`; // UI expects simple key
                    scheduleMap[key] = item;
                }
            });


            set({ schedule: scheduleMap });
        } catch (error) {
            console.error('Fetch schedule error:', error);
        }
    },

    setScheduleItem: async (day, time, courseId, color = 'bg-primary', room = '', lecturer = '', skipLog = false) => {
        try {

            const { schedule, userProfile, undoStack } = get();

            // Undo Logic
            if (!skipLog) {
                const key = `${day}-${time}`;
                const prevItem = schedule[key];

                // Construct Op
                const op: UndoOp = {
                    type: 'SET_SCHEDULE',
                    payload: {
                        day,
                        time,
                        prevCourse: prevItem?.course || '',
                        prevColor: prevItem?.color || '',
                        prevRoom: prevItem?.location || '', // DB field is location
                        prevLecturer: prevItem?.lecturer || '',
                        newCourse: courseId,
                        newColor: color,
                        newRoom: room,
                        newLecturer: lecturer
                    }
                };

                // Add to Undo Stack and Clear Redo Stack
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
            console.error('Set schedule item error:', error);
        }
    },

    // --- Transactions ---

    // --- Transactions ---

    fetchTransactions: async () => {
        try {
            const data = await window.electronAPI.transactions.list();
            set({ transactions: data });
        } catch (error) {
            console.error('Fetch transactions error:', error);
        }
    },

    addTransaction: async (data, skipLog = false) => {
        const validation = validateData(TransactionSchema.omit({ currency: true }), data);
        if (!validation.success) {
            set({ error: validation.errors.join(', ') });
            throw new Error(validation.errors[0]);
        }
        try {
            const payload = { ...data, currency: get().currency };

            // Check if running in Electron environment
            if (!window.electronAPI || !window.electronAPI.transactions) {
                console.warn('[Store] Electron API not available. Transaction not saved (browser mode).');
                // Still call fetchTransactions to trigger UI update even in browser mode
                get().fetchTransactions();
                return;
            }

            // Generate ID manually if needed or let DB handle? DB handles, but we need it for undo.
            // Better to let DB handle, but for Undo we need the full object.
            // Let's generate ID here to be safe for undo consistency?
            // Actually our Main.cts `transactions.create` expects data without ID usually?
            // Let's assume create returns the ID.
            const created = await window.electronAPI.transactions.create(payload);

            // If we use the returned object, we are good.
            // But we need to push to undo stack.
            if (!skipLog && created) {
                set({ redoStack: [] });
                set(state => ({
                    undoStack: [...state.undoStack, {
                        type: 'ADD_TRANSACTION',
                        payload: { id: created.id || created.lastInsertRowid, data: created as Transaction }
                        // Note: 'created' usually contains ID.
                    }]
                }));
            }

            get().fetchTransactions();
        } catch (error) {
            console.error('Add transaction error:', error);
        }
    },

    updateTransaction: async (id, data) => {
        const validation = validateData(TransactionSchema.partial(), data);
        if (!validation.success) {
            set({ error: validation.errors.join(', ') });
            throw new Error(validation.errors[0]);
        }
        try {
            await window.electronAPI.transactions.update(id, data);
            get().fetchTransactions();
        } catch (error) {
            console.error('Update transaction error:', error);
        }
    },

    deleteTransaction: async (id, skipLog = false) => {
        try {
            if (!skipLog) {
                const item = get().transactions.find(t => t.id === id);
                if (item) {
                    set({ redoStack: [] });
                    set(state => ({
                        undoStack: [...state.undoStack, {
                            type: 'DELETE_TRANSACTION',
                            payload: { id, data: item }
                        }]
                    }));
                }
            }
            await window.electronAPI.transactions.delete(id);
            get().fetchTransactions();
        } catch (error) {
            console.error('Delete transaction error:', error);
        }
    },

    clearTransactions: async () => {
        try {
            await window.electronAPI.transactions.clear();
            get().fetchTransactions();
        } catch (error) {
            console.error('Clear transactions error:', error);
        }
    },

    getSemesterCourses: (semester: number) => {
        const { performanceRecords } = get();
        // Pure DB Logic now
        return (performanceRecords || []).filter((c: any) => c.semester === semester);
    },

    seedDatabase: async () => {
        const { performanceRecords } = get();
        // If we haven't fetched yet, do it
        let currentRecords = performanceRecords;
        if (currentRecords.length === 0) {
            try {
                currentRecords = await window.electronAPI.performance.getCourses();
                set({ performanceRecords: currentRecords });
            } catch (e) { return; }
        }

        const dbIds = new Set(currentRecords.map((c: any) => c.id));
        const promises: Promise<any>[] = [];

        // @ts-ignore
        Object.keys(curriculumData).forEach((semKey) => {
            // @ts-ignore
            const courses = curriculumData[semKey];
            courses.forEach((c: any, idx: number) => {
                const id = `course-${semKey}-${idx}`;
                if (!dbIds.has(id)) {
                    // Seed default course
                    promises.push(window.electronAPI.performance.upsertCourse({
                        id,
                        semester: parseInt(semKey),
                        name: c.name,
                        sks: c.sks,
                        grade: '', // Default null
                        location: '', // Default missing param
                        lecturer: '', // Default missing param
                        updatedAt: new Date().toISOString()
                    }));
                }
            });
        });

        if (promises.length > 0) {
            await Promise.all(promises);
            if (isDev) console.log(`[Seeder] Seeded ${promises.length} courses.`);
            // Refresh
            get().fetchGrades();
        }

        // --- Course Data Sync: Fix names and SKS from curriculum.json ---
        const syncPromises: Promise<any>[] = [];
        // @ts-ignore
        Object.keys(curriculumData).forEach((semKey) => {
            // @ts-ignore
            const courses = curriculumData[semKey];
            courses.forEach((c: any, idx: number) => {
                const id = `course-${semKey}-${idx}`;
                const dbRecord = currentRecords.find((r: any) => r.id === id);
                if (dbRecord) {
                    // Check if name or sks needs updating
                    const needsNameFix = dbRecord.name !== c.name;
                    const needsSksFix = dbRecord.sks !== c.sks;

                    if (needsNameFix || needsSksFix) {
                        if (isDev) console.log(`[Course-Sync] Fixing ${id}: name=${needsNameFix ? dbRecord.name + ' -> ' + c.name : 'OK'}, sks=${needsSksFix ? dbRecord.sks + ' -> ' + c.sks : 'OK'}`);
                        syncPromises.push(window.electronAPI.performance.upsertCourse({
                            ...dbRecord,
                            name: c.name,
                            sks: c.sks,
                            updatedAt: new Date().toISOString()
                        }));
                    }
                }
            });
        });

        if (syncPromises.length > 0) {
            await Promise.all(syncPromises);
            if (isDev) console.log(`[Course-Sync] Fixed ${syncPromises.length} courses.`);
            // Refresh records for grade seeding
            currentRecords = await window.electronAPI.performance.getCourses();
            set({ performanceRecords: currentRecords });
        }



    },

    addCourse: async (semester: number) => {
        try {
            const newCourse = {
                id: crypto.randomUUID(),
                semester,
                name: 'New Course',
                sks: 2,
                grade: '',
                location: '',
                lecturer: '',
                updatedAt: new Date().toISOString()
            };
            await window.electronAPI.performance.upsertCourse(newCourse);
            await get().fetchGrades();
        } catch (error) {
            console.error('Add course error:', error);
        }
    },

    updateCourse: async (course: Course) => { // Use Course type
        const validation = validateData(CourseSchema.partial(), course);
        if (!validation.success) {
            console.error("Course validation failed", validation.errors);
            set({ error: validation.errors.join(', ') });
            throw new Error(validation.errors[0]);
        }
        try {
            await window.electronAPI.performance.upsertCourse({
                ...course,
                updatedAt: new Date().toISOString()
            });
            await get().fetchGrades();
        } catch (error) {
            console.error('Update course error:', error);
        }
    },

    deleteCourse: async (id: string) => {
        try {
            await window.electronAPI.performance.deleteCourse(id);
            await get().fetchGrades();
        } catch (error) {
            console.error('Delete course error:', error);
        }
    },

    // --- Materials ---

    fetchMaterials: async (courseId) => {
        try {
            const list = await window.electronAPI.materials.getByCourse(courseId);
            set(state => ({
                materials: {
                    ...state.materials,
                    [courseId]: list
                }
            }));
        } catch (error) {
            console.error('Fetch materials error:', error);
        }
    },

    addMaterial: async (courseId, type, title, url) => {
        try {
            const id = crypto.randomUUID();
            await window.electronAPI.materials.add(id, courseId, type, title, url);
            await get().fetchMaterials(courseId);
        } catch (error) {
            console.error('Add material error:', error);
        }
    },

    deleteMaterial: async (id, courseId) => {
        try {
            await window.electronAPI.materials.delete(id);
            await get().fetchMaterials(courseId);
        } catch (error) {
            console.error('Delete material error:', error);
        }
    },

    // --- Subscriptions ---

    fetchSubscriptions: async () => {
        try {
            const data = await window.electronAPI.subscriptions.list();
            set({ subscriptions: data });
        } catch (error) {
            console.error('Fetch subscriptions error:', error);
        }
    },

    addSubscription: async (data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>) => {
        const validation = validateData(SubscriptionSchema, data);
        if (!validation.success) {
            set({ error: validation.errors.join(', ') });
            throw new Error(validation.errors[0]);
        }
        try {
            await window.electronAPI.subscriptions.create(data);
            get().fetchSubscriptions();
        } catch (error) {
            console.error('Add subscription error:', error);
        }
    },

    updateSubscription: async (id: string, data: Partial<Subscription>) => {
        const validation = validateData(SubscriptionSchema.partial(), data);
        if (!validation.success) {
            set({ error: validation.errors.join(', ') });
            throw new Error(validation.errors[0]);
        }
        try {
            await window.electronAPI.subscriptions.update(id, data);
            get().fetchSubscriptions();
        } catch (error) {
            console.error('Update subscription error:', error);
        }
    },

    deleteSubscription: async (id: string) => {
        try {
            await window.electronAPI.subscriptions.delete(id);
            get().fetchSubscriptions();
        } catch (error) {
            console.error('Delete subscription error:', error);
        }
    },

    checkSubscriptionDeductions: async () => {
        try {
            const res = await window.electronAPI.subscriptions.checkDeductions();
            if (res.deductionsMade > 0) {
                if (isDev) console.log(`[Store] Auto-deducted ${res.deductionsMade} subscriptions.`);
                get().fetchTransactions(); // Refresh transactions if any were made
                get().fetchSubscriptions(); // Refresh subs (lastPaidDate changed)

                // Show Notification
                const amount = res.deductionsMade; // Wait, checkDeductions return { deductionsMade: number } count or amount?
                // Actually subscriptions.cts says: return { deductionsMade: count }
                // I might want to calculate total or just say "Processed X subscriptions".
                // Ideally backend returns more info, but for now:
                get().showNotification(
                    `🔔 Processed auto-payment for ${res.deductionsMade} subscription${res.deductionsMade > 1 ? 's' : ''}.`,
                    'info'
                );
            }
        } catch (error) {
            console.error('Check deductions error:', error);
        }
    },

    // --- Projects ---

    fetchProjects: async () => {
        try {
            const data = await window.electronAPI.projects.list();
            set({ projects: data });
        } catch (error) {
            console.error('Fetch projects error:', error);
        }
    },

    getProjectById: async (id: string) => {
        try {
            const project = await window.electronAPI.projects.get(id);
            return project;
        } catch (error) {
            console.error('Get project by ID error:', error);
            return null;
        }
    },

    addProject: async (data) => {
        try {
            const created = await window.electronAPI.projects.create(data);
            get().fetchProjects();
            get().showNotification('Project created successfully', 'success');
            return created;
        } catch (error) {
            console.error('Add project error:', error);
            get().showNotification('Failed to create project', 'error');
            return null;
        }
    },

    updateProject: async (id: string, data) => {
        try {
            await window.electronAPI.projects.update(id, data);
            get().fetchProjects();
            get().showNotification('Project updated successfully', 'success');
        } catch (error) {
            console.error('Update project error:', error);
            get().showNotification('Failed to update project', 'error');
        }
    },

    deleteProject: async (id: string, skipLog = false) => {
        try {
            if (!skipLog) {
                const project = get().projects.find(p => p.id === id);
                if (project) {
                    set({ redoStack: [] });
                    set(state => ({
                        undoStack: [...state.undoStack, {
                            type: 'DELETE_PROJECT',
                            payload: { id, data: project }
                        }]
                    }));
                }
            }

            await window.electronAPI.projects.delete(id);
            get().fetchProjects();
            // Clean up sessions and attachments from state
            const { projectSessions, projectAttachments } = get();
            const newSessions = { ...projectSessions };
            const newAttachments = { ...projectAttachments };
            delete newSessions[id];
            delete newAttachments[id];
            set({ projectSessions: newSessions, projectAttachments: newAttachments });
            get().showNotification('Project deleted successfully', 'success');
        } catch (error) {
            console.error('Delete project error:', error);
            get().showNotification('Failed to delete project', 'error');
        }
    },

    // --- Project Sessions ---

    fetchProjectSessions: async (projectId: string) => {
        try {
            const data = await window.electronAPI.projectSessions.listByProject(projectId);
            set((state) => ({
                projectSessions: {
                    ...state.projectSessions,
                    [projectId]: data
                }
            }));
        } catch (error) {
            console.error('Fetch project sessions error:', error);
        }
    },

    addProjectSession: async (data) => {
        try {
            await window.electronAPI.projectSessions.create(data);
            // Update project's totalProgress and lastSessionDate
            await window.electronAPI.projects.updateProgress(data.projectId, data.progressAfter);
            get().fetchProjectSessions(data.projectId);
            get().fetchProjects(); // Refresh to get updated progress
            get().showNotification('Progress logged successfully', 'success');
        } catch (error) {
            console.error('Add project session error:', error);
            get().showNotification('Failed to log progress', 'error');
        }
    },

    updateProjectSession: async (id: string, data) => {
        try {
            await window.electronAPI.projectSessions.update(id, data);
            // If progressAfter changed, might need to update project
            if (data.projectId) {
                get().fetchProjectSessions(data.projectId);
            }
            get().showNotification('Session updated successfully', 'success');
        } catch (error) {
            console.error('Update project session error:', error);
            get().showNotification('Failed to update session', 'error');
        }
    },

    deleteProjectSession: async (id: string, projectId: string) => {
        try {
            await window.electronAPI.projectSessions.delete(id);
            get().fetchProjectSessions(projectId);
            get().showNotification('Session deleted successfully', 'success');
        } catch (error) {
            console.error('Delete project session error:', error);
            get().showNotification('Failed to delete session', 'error');
        }
    },

    // --- Project Attachments ---

    fetchProjectAttachments: async (projectId: string) => {
        try {
            const data = await window.electronAPI.projectAttachments.listByProject(projectId);
            set((state) => ({
                projectAttachments: {
                    ...state.projectAttachments,
                    [projectId]: data
                }
            }));
        } catch (error) {
            console.error('Fetch project attachments error:', error);
        }
    },

    addProjectAttachment: async (data) => {
        try {
            await window.electronAPI.projectAttachments.create(data);
            get().fetchProjectAttachments(data.projectId);
            get().showNotification('Attachment added successfully', 'success');
        } catch (error) {
            console.error('Add project attachment error:', error);
            get().showNotification('Failed to add attachment', 'error');
        }
    },

    deleteProjectAttachment: async (id: string, projectId: string) => {
        try {
            await window.electronAPI.projectAttachments.delete(id);
            get().fetchProjectAttachments(projectId);
            get().showNotification('Attachment deleted successfully', 'success');
        } catch (error) {
            console.error('Delete project attachment error:', error);
            get().showNotification('Failed to delete attachment', 'error');
        }
    },

    // --- Notifications ---
    notification: null,
    showNotification: (message, type = 'info') => {
        set({ notification: { message, type } });
        // Auto-hide after 5s
        setTimeout(() => {
            get().hideNotification();
        }, 5000);
    },
    hideNotification: () => set({ notification: null }),
}));

export const selectTotalBalance = (state: AppState) => {
    return state.transactions.reduce((acc, tx) => {
        const amount = Number(tx.amount);
        if (amount < 0) return acc + amount;
        return acc + (tx.type === 'income' ? amount : -amount);
    }, 0);
};

export const selectCompletionRate = (state: AppState) => {
    const total = state.assignments.length;
    if (total === 0) return 0;
    const done = state.assignments.filter(a => a.status === 'done').length;
    return (done / total) * 100;
};

export const selectMonthlyStats = (state: AppState) => {
    const now = new Date();
    return state.transactions.reduce((acc, tx) => {
        if (isSameMonth(new Date(tx.date), now)) {
            const amount = Number(tx.amount);
            if (amount < 0) {
                acc.expense += Math.abs(amount);
            } else if (tx.type === 'income') {
                acc.income += amount;
            } else {
                acc.expense += amount;
            }
        }
        return acc;
    }, { income: 0, expense: 0 });
};
