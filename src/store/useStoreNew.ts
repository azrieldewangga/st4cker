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
        // First push local changes, then fetch from backend
        const state2 = a[1]();
        
        // Push local assignments to backend first
        if (state2.syncAssignmentsToBackend) {
            try {
                await state2.syncAssignmentsToBackend();
                console.log('[initApp] Local assignments synced to backend');
            } catch (err) {
                console.error('[initApp] Failed to sync assignments to backend:', err);
            }
        }
        
        // Then fetch from backend (with timestamp comparison to prevent overwriting newer local data)
        if (state2.fetchAssignmentsFromBackend) {
            state2.fetchAssignmentsFromBackend().catch(err => 
                console.error('[initApp] Fetch assignments from backend error:', err)
            );
        }
        if (state2.fetchScheduleFromBackend) {
            state2.fetchScheduleFromBackend().catch(err => 
                console.error('[initApp] Fetch schedule from backend error:', err)
            );
        }
        // Setup real-time sync listeners
        if (state2.setupScheduleRealtimeSync) {
            state2.setupScheduleRealtimeSync();
        }
        if (state2.setupAssignmentsRealtimeSync) {
            state2.setupAssignmentsRealtimeSync();
        }
        if (state2.setupTransactionsRealtimeSync) {
            state2.setupTransactionsRealtimeSync();
        }
        if (state2.setupProjectsRealtimeSync) {
            state2.setupProjectsRealtimeSync();
        }
        
        // Push local transactions to backend first, then fetch
        if (state2.syncTransactionsToBackend) {
            try {
                await state2.syncTransactionsToBackend();
                console.log('[initApp] Local transactions synced to backend');
            } catch (err) {
                console.error('[initApp] Failed to sync transactions to backend:', err);
            }
        }
        if (state2.fetchTransactionsFromBackend) {
            state2.fetchTransactionsFromBackend().catch(err => 
                console.error('[initApp] Fetch transactions from backend error:', err)
            );
        }
        
        // Push local projects to backend first, then fetch
        if (state2.syncProjectsToBackend) {
            try {
                await state2.syncProjectsToBackend();
                console.log('[initApp] Local projects synced to backend');
            } catch (err) {
                console.error('[initApp] Failed to sync projects to backend:', err);
            }
        }
        if (state2.fetchProjectsFromBackend) {
            state2.fetchProjectsFromBackend().catch(err => 
                console.error('[initApp] Fetch projects from backend error:', err)
            );
        }

        const { assignments, subscriptions } = a[1]();
        NotificationService.checkDeadlineNotifications(assignments, subscriptions);

        store({ isAppReady: true });
    },
}));
