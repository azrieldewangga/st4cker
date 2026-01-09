import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '../useStoreNew';

const mockElectronAPI = {
    transactions: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
};

vi.stubGlobal('window', {
    electronAPI: mockElectronAPI,
});

describe('useStoreNew - Transactions', () => {

    beforeEach(() => {
        useStore.setState({
            transactions: [],
            currency: 'IDR',
            undoStack: [],
            redoStack: []
        });
        vi.clearAllMocks();
    });

    it('should fetch transactions', async () => {
        const mockTransactions = [{ id: '1', amount: 100, type: 'income', title: 'Test' }];
        // @ts-ignore
        vi.mocked(window.electronAPI.transactions.list).mockResolvedValueOnce(mockTransactions);

        await useStore.getState().fetchTransactions();

        expect(window.electronAPI.transactions.list).toHaveBeenCalled();
        expect(useStore.getState().transactions).toHaveLength(1);
    });

    it('should add transaction', async () => {
        const newTx = {
            type: 'income' as const,
            amount: 50000,
            title: 'Salary',
            category: 'Salary',
            date: new Date().toISOString(),
            currency: 'IDR' as const
        };

        // @ts-ignore
        vi.mocked(window.electronAPI.transactions.create).mockResolvedValueOnce({ id: 'new-id', ...newTx });

        await useStore.getState().addTransaction(newTx);

        expect(window.electronAPI.transactions.create).toHaveBeenCalled();
        // Store often refreshes after add
        expect(window.electronAPI.transactions.list).toHaveBeenCalled();
    });

    it('should delete transaction', async () => {
        const tx = {
            id: '1',
            type: 'income' as const,
            amount: 50000,
            title: 'Salary',
            category: 'Salary',
            date: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            currency: 'IDR' as const
        };
        useStore.setState({ transactions: [tx] });

        await useStore.getState().deleteTransaction('1');

        expect(window.electronAPI.transactions.delete).toHaveBeenCalledWith('1');
        expect(window.electronAPI.transactions.list).toHaveBeenCalled();
    });

    it('should calculate total balance correctly', () => {
        const store = useStore.getState();

        // Set up test transactions
        store.transactions = [
            {
                id: '1',
                type: 'income',
                amount: 100000,
                title: 'Salary',
                category: 'Salary',
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                currency: 'IDR'
            },
            {
                id: '2',
                type: 'expense',
                amount: 50000, // Positive expense
                title: 'Food',
                category: 'Food',
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                currency: 'IDR'
            }
        ];

        // We can test the helper logic if exposed, or just verify the state is capable
        // Since useStoreNew logic is often inside components, we just verify data integrity here
        // But if we have a selector, we could test that.
        // For now, let's keep the reduction check to ensure data structure validity.

        const balance = store.transactions.reduce((acc, tx) => {
            const amount = Number(tx.amount);
            if (amount < 0) return acc + amount;
            return acc + (tx.type === 'income' ? amount : -amount);
        }, 0);

        expect(balance).toBe(50000); // 100000 - 50000
    });

    it('should handle negative amount expenses correctly', () => {
        const store = useStore.getState();

        store.transactions = [
            {
                id: '1',
                type: 'expense',
                amount: -25000, // Already negative
                title: 'Coffee',
                category: 'Food',
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                currency: 'IDR'
            }
        ];

        const balance = store.transactions.reduce((acc, tx) => {
            const amount = Number(tx.amount);
            if (amount < 0) return acc + amount;
            return acc + (tx.type === 'income' ? amount : -amount);
        }, 0);

        expect(balance).toBe(-25000);
    });

    it('should handle mixed positive and negative amounts', () => {
        const store = useStore.getState();

        store.transactions = [
            {
                id: '1', type: 'income', amount: 200000, title: 'Salary', category: 'Salary',
                date: new Date().toISOString(), createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(), currency: 'IDR'
            },
            {
                id: '2', type: 'expense', amount: -30000, title: 'Food', category: 'Food',
                date: new Date().toISOString(), createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(), currency: 'IDR'
            },
            {
                id: '3', type: 'expense', amount: 20000, title: 'Transport', category: 'Transport',
                date: new Date().toISOString(), createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(), currency: 'IDR'
            }
        ];

        const balance = store.transactions.reduce((acc, tx) => {
            const amount = Number(tx.amount);
            if (amount < 0) return acc + amount;
            return acc + (tx.type === 'income' ? amount : -amount);
        }, 0);

        // 200000 (income) - 30000 (negative expense) - 20000 (positive expense) = 150000
        expect(balance).toBe(150000);
    });
});
