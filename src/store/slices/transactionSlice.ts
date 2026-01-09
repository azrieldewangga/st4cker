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
});
