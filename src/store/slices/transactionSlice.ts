import { StateCreator } from 'zustand';
import { Transaction } from '@/types/models';
import { validateData, TransactionSchema } from '@/lib/validation';
import { API_CONFIG, buildApiUrl } from '@/config/api';

export interface TransactionSlice {
    transactions: Transaction[];
    fetchTransactions: () => Promise<void>;
    addTransaction: (data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
    deleteTransaction: (id: string) => Promise<void>;
    clearTransactions: () => Promise<void>;
    syncTransactionsToBackend: () => Promise<void>;
    autoSyncTransactionsToBackend: () => void;
    fetchTransactionsFromBackend: () => Promise<void>;
    setupTransactionsRealtimeSync: () => void;
    transactionsLastSyncedAt: string | null;
}

export const createTransactionSlice: StateCreator<
    TransactionSlice & { currency: string; undoStack: any[]; redoStack: any[]; userProfile: any },
    [],
    [],
    TransactionSlice
> = (set, get) => ({
    transactions: [],
    transactionsLastSyncedAt: null,

    fetchTransactions: async () => {
        try {
            const data = await window.electronAPI.transactions.list();
            set({ transactions: data });
        } catch (error) {
            console.error('[TransactionSlice] Fetch error:', error);
        }
    },

    addTransaction: async (data) => {
        const validation = validateData(TransactionSchema.omit({ currency: true }), data);
        if (!validation.success) {
            throw new Error(validation.errors[0]);
        }
        try {
            const state = get() as any;
            const payload = { ...data, currency: state.currency };

            if (!window.electronAPI || !window.electronAPI.transactions) {
                console.warn('[TransactionSlice] Electron API not available.');
                get().fetchTransactions();
                return;
            }

            const created = await window.electronAPI.transactions.create(payload);

            if (created) {
                set({ redoStack: [] });
                set((state: any) => ({
                    undoStack: [...state.undoStack, {
                        type: 'ADD_TRANSACTION',
                        payload: { id: created.id, data: created }
                    }]
                }));
            }

            get().fetchTransactions();
            
            // Auto-sync to backend (debounced)
            get().autoSyncTransactionsToBackend();
        } catch (error) {
            console.error('[TransactionSlice] Add error:', error);
            throw error;
        }
    },

    updateTransaction: async (id, data) => {
        try {
            await window.electronAPI.transactions.update(id, data);
            set((state) => ({
                transactions: state.transactions.map((item) =>
                    item.id === id ? { ...item, ...data } : item
                )
            }));
            get().fetchTransactions();
            
            // Auto-sync to backend (debounced)
            get().autoSyncTransactionsToBackend();
        } catch (error) {
            console.error('[TransactionSlice] Update error:', error);
            throw error;
        }
    },

    deleteTransaction: async (id) => {
        try {
            const item = get().transactions.find(t => t.id === id);
            if (item) {
                set({ redoStack: [] });
                set((state: any) => ({
                    undoStack: [...state.undoStack, {
                        type: 'DELETE_TRANSACTION',
                        payload: { id, data: item }
                    }]
                }));
            }

            await window.electronAPI.transactions.delete(id);
            get().fetchTransactions();
            
            // Auto-sync to backend (debounced)
            get().autoSyncTransactionsToBackend();
        } catch (error) {
            console.error('[TransactionSlice] Delete error:', error);
            throw error;
        }
    },

    clearTransactions: async () => {
        try {
            await window.electronAPI.transactions.clear();
            set({ transactions: [] });
        } catch (error) {
            console.error('[TransactionSlice] Clear error:', error);
            throw error;
        }
    },

    syncTransactionsToBackend: async () => {
        try {
            const state = get() as any;
            const { transactions, userProfile } = state;
            const apiKey = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';

            const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SYNC_USER_DATA), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                },
                body: JSON.stringify({
                    sessionToken: localStorage.getItem('sessionToken'),
                    data: {
                        transactions: transactions
                    }
                }),
            });

            if (!response.ok) throw new Error('Failed to sync transactions');
            console.log('[TransactionSlice] Transactions synced to backend');
        } catch (error) {
            console.error('[TransactionSlice] Sync to backend error:', error);
            throw error;
        }
    },

    fetchTransactionsFromBackend: async () => {
        try {
            const state = get() as any;
            const { userProfile, transactions: localTransactionsState } = state;
            const apiKey = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';

            const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TRANSACTIONS, { userId: userProfile?.telegramUserId }), {
                headers: {
                    'X-API-Key': apiKey,
                },
            });

            if (!response.ok) throw new Error('Failed to fetch transactions');
            const data = await response.json();

            if (!data.data?.length) {
                console.log('[TransactionSlice] Server has no transactions, keeping local data');
                return;
            }

            // IMPROVED DUPLICATE DETECTION like assignmentSlice
            const localTx = await window.electronAPI.transactions.list();
            const existingIds = new Set(localTx.map((t: any) => t.id));
            const existingKeys = new Set(localTx.map((t: any) => 
                `${(t.title || '').toLowerCase().trim()}_${t.date}_${t.amount}_${t.type}`
            ));
            const localStateIds = new Set(localTransactionsState.map((t: any) => t.id));

            for (const item of data.data) {
                // Check by ID first
                const existsById = existingIds.has(item.id) || localStateIds.has(item.id);
                
                // Check by content (title + date + amount + type)
                const itemKey = `${(item.title || '').toLowerCase().trim()}_${item.date}_${item.amount}_${item.type}`;
                const existsByContent = existingKeys.has(itemKey);
                
                const txData = {
                    id: item.id,
                    title: item.title,
                    amount: item.amount,
                    type: item.type,
                    category: item.category,
                    date: item.date,
                    currency: item.currency || 'IDR',
                    updatedAt: new Date().toISOString(),
                };
                
                if (existsById) {
                    await window.electronAPI.transactions.update(item.id, txData);
                    console.log(`[TransactionSlice] Updated existing transaction by ID: ${item.id}`);
                } else if (!existsByContent) {
                    await window.electronAPI.transactions.create(txData);
                    existingIds.add(item.id);
                    existingKeys.add(itemKey);
                    console.log(`[TransactionSlice] Created new transaction: ${item.title}`);
                } else {
                    console.log(`[TransactionSlice] Skipping duplicate transaction: ${item.title} (${itemKey})`);
                }
            }

            get().fetchTransactions();
            console.log('[TransactionSlice] Transactions fetched from backend');
        } catch (error) {
            console.error('[TransactionSlice] Fetch from backend error:', error);
        }
    },

    // Auto-sync transactions ke backend (dengan debounce)
    autoSyncTransactionsToBackend: (() => {
        let syncTimeout: NodeJS.Timeout | null = null;
        return function(this: any) {
            if (syncTimeout) clearTimeout(syncTimeout);
            syncTimeout = setTimeout(() => {
                const state = get() as any;
                if (state.syncTransactionsToBackend) {
                    state.syncTransactionsToBackend().then(() => {
                        set({ transactionsLastSyncedAt: new Date().toISOString() } as any);
                    }).catch((err: any) => {
                        console.error('[TransactionSlice] Auto-sync failed:', err);
                    });
                }
            }, 2000); // Debounce 2 detik
        };
    })(),

    // Setup real-time sync listener untuk transactions
    setupTransactionsRealtimeSync: () => {
        if (typeof window === 'undefined' || !window.electronAPI?.onEvent) return;

        const handleTransactionEvent = (event: any) => {
            console.log('[TransactionSlice] Received real-time event:', event.eventType);
            
            // Handle berbagai event types
            const relevantEventTypes = [
                'transaction.created',
                'transaction.updated', 
                'transaction.deleted',
                'data.synced'
            ];
            
            if (relevantEventTypes.includes(event.eventType)) {
                // Fetch latest data dari backend
                const state = get() as any;
                if (state.fetchTransactionsFromBackend) {
                    // Tambahkan delay kecil untuk batch processing
                    setTimeout(() => {
                        state.fetchTransactionsFromBackend();
                    }, 500);
                }
            }
        };

        // Listen untuk telegram-event (generic event dari backend)
        window.electronAPI.onEvent('telegram-event', handleTransactionEvent);
        
        // Listen untuk transaction-specific events
        window.electronAPI.onEvent('transaction.created', handleTransactionEvent);
        window.electronAPI.onEvent('transaction.updated', handleTransactionEvent);
        window.electronAPI.onEvent('transaction.deleted', handleTransactionEvent);
        
        console.log('[TransactionSlice] Real-time sync enabled');
    },
});
