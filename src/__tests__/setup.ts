import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
    cleanup();
});

// Mock Electron API (Zustand store depends on window.electronAPI)
// @ts-ignore
(globalThis as any).window = window;
// @ts-ignore
(globalThis as any).window.electronAPI = {
    assignments: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn(async (data) => ({ ...data, id: `test-${Date.now()}` })),
        update: vi.fn().mockResolvedValue(undefined),
        updateStatus: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
    },
    transactions: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn(async (data) => ({ ...data, id: `tx-${Date.now()}`, lastInsertRowid: Date.now() })),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        summary: vi.fn().mockResolvedValue({ income: 0, expense: 0 }),
        clear: vi.fn().mockResolvedValue(undefined),
    },
    userProfile: {
        get: vi.fn().mockResolvedValue(null),
        update: vi.fn(async (data) => data),
    },
    performance: {
        getCourses: vi.fn().mockResolvedValue([]),
        upsertCourse: vi.fn().mockResolvedValue(undefined),
    },
    schedule: {
        getAll: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue(undefined),
    },
    subscriptions: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        checkDeductions: vi.fn().mockResolvedValue({ deductionsMade: 0 }),
    },
    notifications: {
        send: vi.fn(),
    },
} as any;
