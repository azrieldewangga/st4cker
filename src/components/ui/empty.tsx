import * as React from "react"
import { cn } from "@/lib/utils"

const Empty = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "flex h-full w-full flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50",
            className
        )}
        {...props}
    />
))
Empty.displayName = "Empty"

const EmptyHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-col items-center justify-center space-y-2 mb-4", className)}
        {...props}
    />
))
EmptyHeader.displayName = "EmptyHeader"


const EmptyMedia = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { variant?: "icon" | "image" }
>(({ className, variant = "icon", children, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "flex items-center justify-center text-muted-foreground",
            variant === "icon" && "p-4 bg-muted rounded-full mb-2 [&>svg]:w-8 [&>svg]:h-8",
            className
        )}
        {...props}
    >
        {children}
    </div>
))
EmptyMedia.displayName = "EmptyMedia"

const EmptyTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn("text-lg font-semibold leading-none tracking-tight", className)}
        {...props}
    />
))
EmptyTitle.displayName = "EmptyTitle"

const EmptyDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-sm text-muted-foreground max-w-xs mx-auto", className)}
        {...props}
    />
))
EmptyDescription.displayName = "EmptyDescription"

const EmptyContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-col items-center justify-center", className)}
        {...props}
    />
))
EmptyContent.displayName = "EmptyContent"

export {
    Empty,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    EmptyDescription,
    EmptyContent,
}
