import { StateCreator } from 'zustand';
import { Transaction } from '@/types/models';
import { validateData, TransactionSchema } from '@/lib/validation';

export interface TransactionSlice {
    transactions: Transaction[];
    fetchTransactions: () => Promise<void>;
    addTransaction: (data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
    deleteTransaction: (id: string) => Promise<void>;
    clearTransactions: () => Promise<void>;
    syncTransactionsToBackend: () => Promise<void>;
    fetchTransactionsFromBackend: () => Promise<void>;
}

export const createTransactionSlice: StateCreator<
    TransactionSlice & { currency: string; undoStack: any[]; redoStack: any[] },
    [],
    [],
    TransactionSlice
> = (set, get) => ({
    transactions: [],

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
            
            // Auto-sync to backend
            try {
                await get().syncTransactionsToBackend();
            } catch (syncErr) {
                console.error('[TransactionSlice] Auto-sync failed:', syncErr);
            }
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
            
            // Auto-sync to backend
            try {
                await get().syncTransactionsToBackend();
            } catch (syncErr) {
                console.error('[TransactionSlice] Auto-sync failed:', syncErr);
            }
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
            
            // Auto-sync to backend
            try {
                await get().syncTransactionsToBackend();
            } catch (syncErr) {
                console.error('[TransactionSlice] Auto-sync failed:', syncErr);
            }
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
            const serverUrl = 'http://103.127.134.173:3000';
            const apiKey = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';

            const response = await fetch(`${serverUrl}/api/sync-user-data`, {
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
            const { userProfile } = state;
            const serverUrl = 'http://103.127.134.173:3000';
            const apiKey = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';

            const response = await fetch(`${serverUrl}/api/v1/cashflow/transactions?userId=${userProfile?.telegramUserId}`, {
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

            // Convert and save to local SQLite
            const localTx = await window.electronAPI.transactions.list();
            for (const item of data.data) {
                const exists = localTx.find((t: any) => t.id === item.id);
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
                
                if (exists) {
                    await window.electronAPI.transactions.update(item.id, txData);
                } else {
                    await window.electronAPI.transactions.create(txData);
                }
            }

            get().fetchTransactions();
            console.log('[TransactionSlice] Transactions fetched from backend');
        } catch (error) {
            console.error('[TransactionSlice] Fetch from backend error:', error);
        }
    },
});
