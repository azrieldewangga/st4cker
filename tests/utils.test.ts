import { describe, it, expect } from 'vitest';
import { formatCurrency, cn } from '@/lib/utils'; // Adjust import if needed

describe('utils', () => {
    describe('formatCurrency', () => {
        it('should format IDR correctly', () => {
            // Assuming default is IDR or explicit
            // Adjust based on actual function signature
            expect(formatCurrency(10000, 'IDR')).toContain('Rp');
            expect(formatCurrency(10000, 'IDR')).toContain('10.000');
        });

        it('should format USD correctly', () => {
            expect(formatCurrency(100, 'USD')).toContain('$');
            expect(formatCurrency(100, 'USD')).toContain('100.00');
        });
    });

    describe('cn (classNames)', () => {
        it('should merge classes correctly', () => {
            expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
        });

        it('should handle conditional classes', () => {
            expect(cn('block', undefined, false && 'hidden', 'flex')).toBe('flex');
        });
    });
});
