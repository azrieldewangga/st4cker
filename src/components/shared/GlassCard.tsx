import React, { ReactNode } from 'react';
import clsx from 'clsx';

interface GlassCardProps {
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
    variant?: 'base' | 'soft' | 'strong';
    title?: string;
    action?: ReactNode;
}

const GlassCard = ({
    children,
    className,
    bodyClassName,
    variant = 'base', // Kept for API compatibility, unused
    title,
    action
}: GlassCardProps) => {

    return (
        <div className={clsx(
            "rounded-xl bg-card shadow-lg border border-border", // Shadcn-compatible styles
            className
        )}>
            <div className={clsx("p-6", bodyClassName)}>
                {(title || action) && (
                    <div className="flex justify-between items-center mb-4">
                        {title && <h2 className="text-xl font-semibold text-card-foreground">{title}</h2>}
                        {action && <div>{action}</div>}
                    </div>
                )}
                {children}
            </div>
        </div>
    );
};

export default GlassCard;
