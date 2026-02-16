import { create } from 'zustand';
import { NotificationService } from '../services/NotificationService';
import { createAssignmentSlice, AssignmentSlice } from './slices/assignmentSlice';
import { createTransactionSlice, TransactionSlice } from './slices/transactionSlice';
import { createProjectSlice, ProjectSlice } from './slices/projectSlice';
import { createPerformanceSlice, PerformanceSlice } from './slices/performanceSlice';
import { createSettingsSlice, SettingsSlice } from './slices/settingsSlice';
import { createMiscSlice, MiscSlice } from './slices/miscSlice';
import { createUndoRedoSlice, UndoRedoSlice } from './slices/undoRedoSlice';


export type AppState = AssignmentSlice &
    TransactionSlice &
    ProjectSlice &
    PerformanceSlice &
    SettingsSlice &
    MiscSlice &
    UndoRedoSlice &
 {
        initApp: (skipDelay?: boolean) => Promise<void>;
    };

export const useStore = create<AppState>()((...a) => ({
    ...createAssignmentSlice(...a),
    ...createTransactionSlice(...a),
    ...createProjectSlice(...a),
    ...createPerformanceSlice(...a),
    ...createSettingsSlice(...a),
    ...createMiscSlice(...a),
    ...createUndoRedoSlice(...a),


    initApp: async (skipDelay = false) => {
        const store = a[0];
        store({ isAppReady: false });

        const state = a[1]();
        const {
            fetchUserProfile,
            fetchTransactions,
            fetchAssignments,
            fetchSubscriptions,
            fetchProjects,
            checkSubscriptionDeductions,
            seedDatabase,
            fetchExchangeRate
        } = state;

        fetchExchangeRate().catch(err => console.error('Exchange rate fetch error:', err));

        await seedDatabase();

        const promises: Promise<any>[] = [
            fetchUserProfile(),
            fetchTransactions(),
            fetchAssignments(),
            fetchSubscriptions(),
            fetchProjects()
        ];

        checkSubscriptionDeductions().catch(err => console.error('Auto-deduct error:', err));

        if (!skipDelay) {
            promises.push(new Promise(resolve => setTimeout(resolve, 2000)));
        }

        await Promise.all(promises);
        
        // Sync from backend after local data loaded
        const state = a[1]();
        if (state.fetchAssignmentsFromBackend) {
            state.fetchAssignmentsFromBackend().catch(err => 
                console.error('[initApp] Fetch assignments from backend error:', err)
            );
        }
        if (state.fetchScheduleFromBackend) {
            state.fetchScheduleFromBackend().catch(err => 
                console.error('[initApp] Fetch schedule from backend error:', err)
            );
        }
        if (state.fetchTransactionsFromBackend) {
            state.fetchTransactionsFromBackend().catch(err => 
                console.error('[initApp] Fetch transactions from backend error:', err)
            );
        }

        const { assignments, subscriptions } = a[1]();
        NotificationService.checkDeadlineNotifications(assignments, subscriptions);

        store({ isAppReady: true });
    },
}));
