import { describe, it, expect } from 'vitest';
import { validateData, TransactionSchema, AssignmentSchema, UserProfileSchema } from '../validation';

describe('Validation Schemas', () => {
    describe('TransactionSchema', () => {
        it('should validate correct transaction data', () => {
            const validData = {
                title: 'Test Transaction',
                amount: 50000,
                type: 'expense' as const,
                category: 'Food',
                date: new Date().toISOString(),
                currency: 'IDR' as const
            };

            const result = validateData(TransactionSchema, validData);
            expect(result.success).toBe(true);
        });

        it('should allow negative amounts (for expenses)', () => {
            const validData = {
                title: 'Test',
                amount: -100,
                type: 'expense' as const,
                category: 'Food',
                date: new Date().toISOString(),
                currency: 'IDR' as const
            };

            const result = validateData(TransactionSchema, validData);
            // Schema ALLOWS negative amounts by design
            expect(result.success).toBe(true);
        });

        it('should reject zero amounts', () => {
            const invalidData = {
                title: 'Test',
                amount: 0,
                type: 'expense' as const,
                category: 'Food',
                date: new Date().toISOString(),
                currency: 'IDR' as const
            };

            const result = validateData(TransactionSchema, invalidData);
            expect(result.success).toBe(false);
        });
    });

    it('should reject missing required fields', () => {
        const invalidData = {
            title: 'Test',
            amount: 100,
            // Missing type, category, date
        };

        const result = validateData(TransactionSchema, invalidData as any);
        expect(result.success).toBe(false);
    });
});

describe('AssignmentSchema', () => {
    it('should validate correct assignment data', () => {
        const validData = {
            courseId: 'course-1-0',
            title: 'Test Assignment',
            type: 'Tugas' as const,
            deadline: new Date().toISOString(),
            status: 'to-do' as const,
            note: 'Test description',
            semester: 1
        };

        const result = validateData(AssignmentSchema, validData);
        expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
        const invalidData = {
            title: 'Test Assignment',
            // Missing courseId, type, deadline, status
        };

        const result = validateData(AssignmentSchema, invalidData as any);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.errors.length).toBeGreaterThan(0);
        }
    });

    it('should reject invalid status', () => {
        const invalidData = {
            courseId: 'course-1-0',
            title: 'Test',
            type: 'Tugas' as const,
            deadline: new Date().toISOString(),
            status: 'invalid-status' as any,
            semester: 1
        };

        const result = validateData(AssignmentSchema, invalidData);
        expect(result.success).toBe(false);
    });

    it('should reject invalid type', () => {
        const invalidData = {
            courseId: 'course-1-0',
            title: 'Test',
            type: 'InvalidType' as any,
            deadline: new Date().toISOString(),
            status: 'to-do' as const,
            semester: 1
        };

        const result = validateData(AssignmentSchema, invalidData);
        expect(result.success).toBe(false);
    });
});

describe('UserProfileSchema', () => {
    it('should validate correct user profile data', () => {
        const validData = {
            name: 'John Doe',
            semester: 3,
            major: 'Computer Science',
            avatar: 'https://example.com/avatar.jpg'
        };

        const result = validateData(UserProfileSchema, validData);
        expect(result.success).toBe(true);
    });

    it('should allow empty avatar', () => {
        const validData = {
            name: 'John Doe',
            semester: 3,
            major: 'Computer Science',
            avatar: ''
        };

        const result = validateData(UserProfileSchema, validData);
        expect(result.success).toBe(true);
    });

    it('should reject invalid semester (too low)', () => {
        const invalidData = {
            name: 'John Doe',
            semester: 0,
            major: 'Computer Science'
        };

        const result = validateData(UserProfileSchema, invalidData);
        expect(result.success).toBe(false);
    });

    it('should reject invalid semester (too high)', () => {
        const invalidData = {
            name: 'John Doe',
            semester: 15,
            major: 'Computer Science'
        };

        const result = validateData(UserProfileSchema, invalidData);
        expect(result.success).toBe(false);
    });

    it('should reject invalid name (contains numbers)', () => {
        const invalidData = {
            name: 'John123',
            semester: 3,
            major: 'Computer Science'
        };

        const result = validateData(UserProfileSchema, invalidData);
        expect(result.success).toBe(false);
    });
});

