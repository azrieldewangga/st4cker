import { z } from 'zod';

// ==================== TRANSACTION VALIDATION ====================
export const TransactionSchema = z.object({
    title: z.string()
        .min(1, 'Title is required')
        .max(100, 'Title must be less than 100 characters'),
    amount: z.number()
        .refine(val => val !== 0, 'Amount cannot be zero')
        .refine(val => Math.abs(val) <= 999999999, 'Amount is too large')
        .refine(val => Number.isFinite(val), 'Amount must be a valid number')
        .refine(val => Number((val * 100).toFixed(0)) / 100 === val, 'Amount can have at most 2 decimal places'),
    type: z.enum(['income', 'expense']),
    category: z.string()
        .min(1, 'Category is required')
        .max(50, 'Category must be less than 50 characters'),
    date: z.string()
        .datetime({ message: 'Invalid date format' })
        .refine(date => {
            const d = new Date(date);
            const now = new Date();
            const hundredYearsAgo = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
            return d >= hundredYearsAgo && d <= now;
        }, 'Date must be within the last 100 years and not in the future'),
    currency: z.enum(['IDR', 'USD']).optional(),
});

export type TransactionInput = z.infer<typeof TransactionSchema>;

// ==================== ASSIGNMENT VALIDATION ====================
export const AssignmentSchema = z.object({
    courseId: z.string().min(1, 'Course is required'),
    title: z.string()
        .min(1, 'Title is required')
        .max(200, 'Title must be less than 200 characters'),
    type: z.enum(['Laporan Pendahuluan', 'Laporan Sementara', 'Laporan Resmi', 'Tugas']),
    deadline: z.string()
        .datetime({ message: 'Invalid date format' })
        .refine(date => {
            const d = new Date(date);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            return d >= oneYearAgo;
        }, 'Deadline cannot be more than 1 year in the past'),
    status: z.enum(['to-do', 'progress', 'done']),
    note: z.string().max(500, 'Note must be less than 500 characters').optional(),
    semester: z.number().int().min(1).max(8).optional(),
});

export type AssignmentInput = z.infer<typeof AssignmentSchema>;

// ==================== COURSE VALIDATION ====================
export const CourseSchema = z.object({
    name: z.string()
        .min(1, 'Course name is required')
        .max(100, 'Course name must be less than 100 characters'),
    semester: z.number()
        .int('Semester must be an integer')
        .min(1, 'Semester must be between 1 and 8')
        .max(8, 'Semester must be between 1 and 8'),
    sks: z.number()
        .int('SKS must be an integer')
        .min(1, 'SKS must be between 1 and 6')
        .max(6, 'SKS must be between 1 and 6')
        .optional(),
    grade: z.string()
        .max(3, 'Grade must be valid (A, B, C, D, E)')
        .regex(/^[ABCDE][+-]?$/, 'Grade must be valid (A, B+, C-, etc.)')
        .optional(),
    location: z.string().max(100, 'Location must be less than 100 characters').optional(),
    lecturer: z.string().max(100, 'Lecturer name must be less than 100 characters').optional(),
});

export type CourseInput = z.infer<typeof CourseSchema>;

// ==================== USER PROFILE VALIDATION ====================
export const UserProfileSchema = z.object({
    name: z.string()
        .min(1, 'Name is required')
        .max(100, 'Name must be less than 100 characters')
        .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
    semester: z.number()
        .int('Semester must be an integer')
        .min(1, 'Semester must be between 1 and 8')
        .max(8, 'Semester must be between 1 and 8'),
    avatar: z.string().url('Avatar must be a valid URL').optional().or(z.literal('')),
    cardLast4: z.string()
        .regex(/^\d{4}$/, 'Card number must be exactly 4 digits')
        .optional()
        .or(z.literal('')),
    major: z.string().max(100, 'Major must be less than 100 characters').optional(),
});

export type UserProfileInput = z.infer<typeof UserProfileSchema>;

// ==================== SUBSCRIPTION VALIDATION ====================
export const SubscriptionSchema = z.object({
    name: z.string()
        .min(1, 'Subscription name is required')
        .max(100, 'Name must be less than 100 characters'),
    cost: z.number()
        .positive('Cost must be positive')
        .max(999999999, 'Cost is too large'),
    dueDay: z.number()
        .int('Due day must be an integer')
        .min(1, 'Due day must be between 1 and 31')
        .max(31, 'Due day must be between 1 and 31'),
    lastPaidDate: z.string().datetime().optional(),
});

export type SubscriptionInput = z.infer<typeof SubscriptionSchema>;

// ==================== COURSE MATERIAL VALIDATION ====================
export const CourseMaterialSchema = z.object({
    courseId: z.string().min(1, 'Course is required'),
    type: z.enum(['link', 'file']),
    title: z.string()
        .min(1, 'Title is required')
        .max(200, 'Title must be less than 200 characters'),
    url: z.string()
        .min(1, 'URL is required')
        .max(2000, 'URL is too long'),
});

export type CourseMaterialInput = z.infer<typeof CourseMaterialSchema>;

// ==================== VALIDATION HELPER ====================
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    if (!result.error) {
        return { success: false, errors: ['Unknown validation error'] };
    }

    const errorList = result.error.issues || (result.error as any).errors;

    if (!errorList) {
        console.error('Validation error structure unexpected:', result);
        return { success: false, errors: ['Unknown validation error'] };
    }

    const errors = errorList.map((err: any) => {
        const path = err.path.length > 0 ? err.path.join('.') : 'value';
        return `${path}: ${err.message}`;
    });

    return { success: false, errors };
}
