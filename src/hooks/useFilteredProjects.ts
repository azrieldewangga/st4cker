import { useMemo } from 'react';
import { Project } from '@/types/models';
import { differenceInDays } from 'date-fns';

type SortOption = 'deadline-asc' | 'deadline-desc' | 'progress-asc' | 'progress-desc' | 'priority-high' | 'priority-low' | 'title-asc';

interface FilterOptions {
    statusFilter: 'all' | 'active' | 'completed' | 'on-hold';
    priorityFilter: 'all' | 'high' | 'medium' | 'low';
    sortOption: SortOption;
    searchQuery: string;
}

/**
 * Custom hook with memoized filtering and sorting for projects
 * Prevents expensive recalculations on every render
 */
export const useFilteredProjects = (projects: Project[], filters: FilterOptions) => {
    return useMemo(() => {
        const { statusFilter, priorityFilter, sortOption, searchQuery } = filters;

        // Filter
        let filtered = projects.filter(p => {
            const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
            const matchesPriority = priorityFilter === 'all' || p.priority === priorityFilter;
            const matchesSearch = !searchQuery || (p.title && p.title.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesStatus && matchesPriority && matchesSearch;
        });

        // Sort
        filtered.sort((a, b) => {
            switch (sortOption) {
                case 'deadline-asc':
                    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
                case 'deadline-desc':
                    return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
                case 'progress-asc':
                    return (a.totalProgress || 0) - (b.totalProgress || 0);
                case 'progress-desc':
                    return (b.totalProgress || 0) - (a.totalProgress || 0);
                case 'priority-high': {
                    const pOrder = { high: 3, medium: 2, low: 1 };
                    return (pOrder[b.priority as keyof typeof pOrder] || 0) - (pOrder[a.priority as keyof typeof pOrder] || 0);
                }
                case 'priority-low': {
                    const pOrder = { high: 3, medium: 2, low: 1 };
                    return (pOrder[a.priority as keyof typeof pOrder] || 0) - (pOrder[b.priority as keyof typeof pOrder] || 0);
                }
                case 'title-asc':
                    return a.title.localeCompare(b.title);
                default:
                    return 0;
            }
        });

        return filtered;
    }, [projects, filters.statusFilter, filters.priorityFilter, filters.sortOption, filters.searchQuery]);
};

/**
 * Memoized helper functions for project display
 */
export const useProjectHelpers = () => {
    return useMemo(() => ({
        getDaysRemaining: (deadline: string) => {
            if (!deadline) return 0;
            const date = new Date(deadline);
            if (isNaN(date.getTime())) return 0;
            return differenceInDays(date, new Date());
        },
        getPriorityColor: (priority: string) => {
            switch (priority) {
                case 'high': return 'text-red-500';
                case 'medium': return 'text-yellow-500';
                case 'low': return 'text-gray-500';
                default: return 'text-gray-500';
            }
        },
        getPriorityIcon: (priority: string) => {
            switch (priority) {
                case 'high': return '🔴';
                case 'medium': return '🟡';
                case 'low': return '⚪';
                default: return '⚪';
            }
        }
    }), []);
};
