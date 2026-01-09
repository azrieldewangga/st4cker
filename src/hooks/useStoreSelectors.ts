import { useMemo } from 'react';
import { useStore } from '@/store/useStoreNew';

/**
 * Custom selector hooks to minimize re-renders
 * IMPORTANT: These return STABLE references, not new objects
 */

// Assignment selectors
export const useAssignments = () => useStore(state => state.assignments);

export const useActiveAssignments = () => {
    const assignments = useStore(state => state.assignments);
    return useMemo(
        () => assignments.filter(a => a.status !== 'done'),
        [assignments]
    );
};

export const useAssignmentById = (id: string | null) => {
    const assignments = useStore(state => state.assignments);
    return useMemo(
        () => assignments.find(a => a.id === id) || null,
        [assignments, id]
    );
};

// Transaction selectors
export const useTransactions = () => useStore(state => state.transactions);

export const useMonthlyTransactions = (month?: Date) => {
    const transactions = useStore(state => state.transactions);
    return useMemo(() => {
        if (!month) return transactions;
        return transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate.getMonth() === month.getMonth() &&
                tDate.getFullYear() === month.getFullYear();
        });
    }, [transactions, month]);
};

// Project selectors
export const useProjects = () => useStore(state => state.projects);

export const useActiveProjects = () => {
    const projects = useStore(state => state.projects);
    return useMemo(
        () => projects.filter(p => p.status === 'active'),
        [projects]
    );
};

export const useProjectById = (id: string | null) => {
    const projects = useStore(state => state.projects);
    return useMemo(
        () => projects.find(p => p.id === id) || null,
        [projects, id]
    );
};

// Settings selectors
export const useTheme = () => useStore(state => state.theme);
export const useCurrency = () => useStore(state => state.currency);
export const useExchangeRate = () => useStore(state => state.exchangeRate);

// Performance selectors
export const useCourses = () => useStore(state => state.courses);
export const useGrades = () => useStore(state => state.grades);

export const useCourseById = (id: string | null) => {
    const courses = useStore(state => state.courses);
    return useMemo(
        () => courses.find(c => c.id === id) || null,
        [courses, id]
    );
};

// UI State selectors
export const useAppReady = () => useStore(state => state.isAppReady);
export const useLoading = () => useStore(state => state.isLoading);

// User Profile selector
export const useUserProfile = () => useStore(state => state.userProfile);

// Undo/Redo - return individual values, NOT objects
export const canUndo = () => useStore(state => state.undoStack.length > 0);
export const canRedo = () => useStore(state => state.redoStack.length > 0);
