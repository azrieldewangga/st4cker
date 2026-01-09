import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
    return (
        <div
            className={cn("animate-pulse rounded-md bg-muted", className)}
            {...props}
        />
    );
}

// Specific skeleton loaders for common components

export function ProjectCardSkeleton() {
    return (
        <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16" />
            </div>
            <div className="space-y-2">
                <div className="flex justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-2 w-full" />
            </div>
            <div className="flex justify-between items-center">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex gap-2 justify-center">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-28" />
            </div>
        </div>
    );
}

export function AssignmentRowSkeleton() {
    return (
        <div className="flex items-center gap-4 p-3 border-b">
            <Skeleton className="h-4 w-4" />
            <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-24" />
        </div>
    );
}

export function TransactionRowSkeleton() {
    return (
        <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                </div>
            </div>
            <Skeleton className="h-4 w-20" />
        </div>
    );
}

export function ChartSkeleton() {
    return (
        <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
}
