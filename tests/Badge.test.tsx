import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';
import React from 'react';

describe('Badge', () => {
    it('renders correctly', () => {
        render(<Badge>Test Badge</Badge>);
        expect(screen.getByText('Test Badge')).toBeInTheDocument();
    });

    it('applies variant classes', () => {
        const { container } = render(<Badge variant="destructive">Destructive</Badge>);
        // Check if the rendered element or its parent has the class associated with destructive variant
        // This depends on your shadcn implementation, usually bg-destructive
        expect(container.firstChild).toHaveClass('bg-destructive');
    });
});
