import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const RadioGroup = React.forwardRef<
    React.ElementRef<typeof RadioGroupPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
    return (
        <RadioGroupPrimitive.Root
            className={cn('grid gap-2', className)}
            {...props}
            ref={ref}
        />
    );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const Radio = React.forwardRef<
    React.ElementRef<typeof RadioGroupPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => {
    return (
        <RadioGroupPrimitive.Item
            ref={ref}
            className={cn(
                'aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            {...props}
        >
            {children}
        </RadioGroupPrimitive.Item>
    );
});
Radio.displayName = RadioGroupPrimitive.Item.displayName;

const RadioIndicator = React.forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center" asChild>
        <motion.span
            ref={ref}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 16 }}
            className={cn('flex h-2.5 w-2.5 rounded-full bg-current', className)}
            {...(props as any)}
        />
    </RadioGroupPrimitive.Indicator>
));
RadioIndicator.displayName = 'RadioIndicator';

export { RadioGroup, Radio, RadioIndicator };
