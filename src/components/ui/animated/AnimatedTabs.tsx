import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const AnimatedTabsList = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
    return (
        <TabsPrimitive.List
            ref={ref}
            className={cn(
                "inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
                className
            )}
            {...props}
        >
            {children}
        </TabsPrimitive.List>
    );
});
AnimatedTabsList.displayName = "AnimatedTabsList";

interface AnimatedTabsTriggerProps
    extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
    activeTab?: string;
    setActiveTab?: (value: string) => void;
    group?: string; // Scope the animation
}

const AnimatedTabsTrigger = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    AnimatedTabsTriggerProps
>(({ className, children, value, activeTab, group, ...props }, ref) => {
    const isActive = activeTab === value;

    return (
        <TabsPrimitive.Trigger
            ref={ref}
            value={value}
            className={cn(
                "relative inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80",
                className
            )}
            {...props}
        >
            {/* The Text */}
            <span className="relative z-20">{children}</span>

            {/* The Sliding Pill */}
            {isActive && (
                <motion.div
                    layoutId={`${group || 'default'}-active-tab-pill`}
                    className="absolute inset-0 z-10 rounded-md bg-background shadow-sm"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
            )}
        </TabsPrimitive.Trigger>
    );
});
AnimatedTabsTrigger.displayName = "AnimatedTabsTrigger";

const TabsContent = TabsPrimitive.Content; // Use standard content

export { Tabs, AnimatedTabsList, AnimatedTabsTrigger, TabsContent };
