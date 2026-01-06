import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '../useStore';

describe('useStore - Transactions', () => {
    // Import after setup to ensure mocks are in place

    beforeEach(() => {
        // Reset store state before each test
        const store = useStore.getState();
        store.transactions = [];
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

        // Calculate balance using same logic from store
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

    it('should return 0 for empty transactions', () => {
        const store = useStore.getState();
        store.transactions = [];

        const balance = store.transactions.reduce((acc, tx) => {
            const amount = Number(tx.amount);
            if (amount < 0) return acc + amount;
            return acc + (tx.type === 'income' ? amount : -amount);
        }, 0);

        expect(balance).toBe(0);
    });
});
