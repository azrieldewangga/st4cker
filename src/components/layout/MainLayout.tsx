import React, { ReactNode } from 'react';
import { useStore } from '../../store/useStore';
import { MainNav } from './MainNav';
import { Search } from './Search';
import { UserNav } from './UserNav';
import { SemesterSwitcher } from './SemesterSwitcher';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils'; // Assuming cn is available
import { TipBanner } from '@/components/ui/tip-banner';
import { GlobalSearchDialog } from '@/components/shared/GlobalSearchDialog';
import { useTheme } from '@/components/theme-provider';
import { isDev } from '@/lib/constants';

import { useNotifications } from '@/hooks/useNotifications';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler";

interface MainLayoutProps {
    children: ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    useNotifications(); // Desktop Notifications Logic
    const { notification, isSearchOpen, setSearchOpen } = useStore();
    const themeTogglerRef = React.useRef<HTMLButtonElement>(null);

    // Expose theme toggler click to window for keyboard shortcuts
    React.useEffect(() => {
        (window as any).triggerThemeToggle = () => {
            themeTogglerRef.current?.click();
        };
        return () => {
            delete (window as any).triggerThemeToggle;
        };
    }, []);

    // Search Shortcut
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                setSearchOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Notification Listener
    React.useEffect(() => {
        if (notification) {
            // @ts-ignore
            toast[notification.type === 'error' ? 'error' : notification.type === 'success' ? 'success' : 'message'](notification.message);
        }
    }, [notification]);

    // Theme Management
    const { theme, setTheme } = useTheme();
    const { autoTheme, themeSchedule, theme: storeTheme } = useStore();

    // 1. Sync Manual Changes: Store -> NextThemes
    React.useEffect(() => {
        if (!autoTheme && storeTheme !== theme) {
            // @ts-ignore
            setTheme(storeTheme);
        }
    }, [storeTheme, autoTheme]);

    // Auto-switch logic
    React.useEffect(() => {
        if (!autoTheme) return;

        const checkTheme = () => {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            const [startH, startM] = themeSchedule.start.split(':').map(Number);
            const [endH, endM] = themeSchedule.end.split(':').map(Number);

            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;

            let isDarkTime = false;

            if (startMinutes < endMinutes) {
                // e.g. 18:00 to 22:00 (Dark only in evening)
                isDarkTime = currentMinutes >= startMinutes && currentMinutes < endMinutes;
            } else {
                // e.g. 18:00 to 06:00 (Overnight)
                isDarkTime = currentMinutes >= startMinutes || currentMinutes < endMinutes;
            }

            const targetTheme = isDarkTime ? 'dark' : 'light';
            if (theme !== targetTheme) {
                // @ts-ignore
                setTheme(targetTheme);
                // We DON'T update store 'theme' here to avoid infinite loops or overwriting manual pref if user toggles auto off momentarily
                // But for consistency let's silently update local store state without triggering listeners? 
                // Actually, let's leave store.theme as "last manually selected" or "system", and just let view override.
                // But Settings UI uses store.theme to highlight buttons.
                // Let's allow effective theme.
            }
        };

        checkTheme(); // Initial check
        const interval = setInterval(checkTheme, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [autoTheme, themeSchedule, theme]);

    // Window actions
    const handleMinimize = () => window.electronAPI?.minimize?.();
    const handleMaximize = () => window.electronAPI?.maximize?.();
    const handleClose = () => {
        // Close search or window
        if (isSearchOpen) setSearchOpen(false);
        else window.electronAPI?.close?.();
    };

    // Child Window Blur Effect
    const [isChildWindowOpen, setIsChildWindowOpen] = React.useState(false);

    React.useEffect(() => {
        // Only set up listeners if running in Electron
        if (!window.electronAPI) {
            if (isDev) console.log('[MainLayout] Not running in Electron, skipping child window listeners');
            return;
        }

        if (!window.electronAPI.on) {
            if (isDev) console.log('[MainLayout] Electron API does not support event listeners');
            return;
        }

        // @ts-ignore
        const handleOpen = () => {
            if (isDev) console.log('[MainLayout] Received child-window-opened');
            setIsChildWindowOpen(true);
        };
        // @ts-ignore
        const handleClose = () => {
            if (isDev) console.log('[MainLayout] Received child-window-closed');
            setIsChildWindowOpen(false);
        };

        // @ts-ignore
        window.electronAPI.on('child-window-opened', handleOpen);
        // @ts-ignore
        window.electronAPI.on('child-window-closed', handleClose);

        return () => {
            // @ts-ignore
            window.electronAPI.off('child-window-opened', handleOpen);
            // @ts-ignore
            window.electronAPI.off('child-window-closed', handleClose);
        };
    }, []);

    return (
        <div className="h-screen w-screen overflow-hidden bg-transparent flex flex-col">
            {/* Custom Window Frame */}
            <div className="flex flex-col h-full w-full bg-background rounded-xl overflow-hidden shadow-2xl border border-border relative ring-1 ring-white/10">
                {/* Blur Overlay when Child Window is Open */}
                {isChildWindowOpen && (
                    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
                )}

                {/* Title Bar / Header */}
                <div className="border-b bg-card">
                    <div className="flex h-16 items-center px-4 titlebar-drag">
                        {/* Left: Switcher & Nav */}
                        <div className="no-drag flex items-center pr-4">
                            <SemesterSwitcher />
                            <MainNav className="mx-6" />
                        </div>

                        {/* Spacer */}
                        <div className="flex-1" />

                        <div className="no-drag flex items-center space-x-4">
                            <Search onClick={() => setSearchOpen(true)} />
                            <ThemeTogglerButton ref={themeTogglerRef} variant="ghost" modes={['light', 'dark']} className="rounded-full w-8 h-8" />
                            <UserNav />

                            {/* Window Actions */}
                            <div className="flex gap-2 ml-4">
                                <button onClick={handleMinimize} className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 border border-yellow-600/30" />
                                <button onClick={handleMaximize} className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 border border-green-600/30" />
                                <button onClick={handleClose} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 border border-red-600/30" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <ScrollArea className="flex-1 space-y-4 bg-muted/10 h-full">
                    <div className="p-8 pt-6 mx-auto max-w-7xl animate-fade-in text-foreground">
                        {children}
                    </div>
                </ScrollArea>

            </div>

            <Toaster duration={8000} />
            <TipBanner />
            <GlobalSearchDialog
                isOpen={isSearchOpen}
                onClose={() => setSearchOpen(false)}
            />
        </div>
    );
};

export default MainLayout;
