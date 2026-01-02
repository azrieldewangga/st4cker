import React, { useState, useEffect } from 'react';
import { Lightbulb, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tip {
    id: string;
    text: string;
    icon?: React.ReactNode;
}

const tips: Tip[] = [
    {
        id: 'command-palette',
        text: 'Press Ctrl+K to open the command palette and view all shortcuts',
    },
    {
        id: 'quick-add',
        text: 'Use Ctrl+N to quickly add a new assignment or transaction',
    },
    {
        id: 'theme-toggle',
        text: 'Quickly toggle between light and dark mode with Ctrl+Alt+D',
    },
    {
        id: 'undo-redo',
        text: 'Made a mistake? Use Ctrl+Z to undo and Ctrl+Shift+Z to redo',
    },
];

export const TipBanner: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [currentTipIndex, setCurrentTipIndex] = useState(0);
    const [isDismissed, setIsDismissed] = useState(false);
    const [isEnabled, setIsEnabled] = useState(true);

    useEffect(() => {
        // Check if tips are enabled in settings
        const enabled = localStorage.getItem('tips-enabled');
        if (enabled === 'false') {
            setIsEnabled(false);
            return;
        }
        setIsEnabled(true);

        // Check if user has dismissed tips
        const dismissed = localStorage.getItem('tips-dismissed');
        if (dismissed === 'true') {
            setIsDismissed(true);
            return;
        }

        // Show tip after 2 seconds
        const showTimer = setTimeout(() => {
            setIsVisible(true);
        }, 2000);

        // Rotate tips every 10 seconds
        const rotateTimer = setInterval(() => {
            setCurrentTipIndex((prev) => (prev + 1) % tips.length);
        }, 10000);

        return () => {
            clearTimeout(showTimer);
            clearInterval(rotateTimer);
        };
    }, []);

    const handleDismiss = () => {
        setIsVisible(false);
        setTimeout(() => {
            setIsDismissed(true);
            localStorage.setItem('tips-dismissed', 'true');
        }, 300);
    };

    if (!isEnabled || isDismissed) return null;

    const currentTip = tips[currentTipIndex];

    return (
        <div
            className={cn(
                "fixed bottom-4 right-4 z-50 transition-all duration-300",
                isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
            )}
        >
            <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 backdrop-blur-sm border border-emerald-500/20 rounded-lg shadow-lg p-4 pr-12 max-w-md">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-full">
                        <Lightbulb className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                            💡 Pro Tip
                        </p>
                        <p className="text-sm text-foreground">
                            {currentTip.text}
                        </p>
                        <div className="flex items-center gap-1 mt-2">
                            {tips.map((_, index) => (
                                <div
                                    key={index}
                                    className={cn(
                                        "h-1 rounded-full transition-all",
                                        index === currentTipIndex
                                            ? "w-4 bg-emerald-500"
                                            : "w-1 bg-muted-foreground/30"
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    className="absolute top-2 right-2 p-1 hover:bg-muted rounded-md transition-colors"
                    aria-label="Dismiss tips"
                >
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
            </div>
        </div>
    );
};
