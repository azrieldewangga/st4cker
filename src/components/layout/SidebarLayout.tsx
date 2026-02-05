import React, { ReactNode } from 'react';
import { useStore } from '@/store/useStoreNew';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { TipBanner } from '@/components/ui/tip-banner';
import { GlobalSearchDialog } from '@/components/shared/GlobalSearchDialog';
import { useTheme } from '@/components/theme-provider';
import { isDev } from '@/lib/constants';
import { useNotifications } from '@/hooks/useNotifications';
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler";

interface SidebarLayoutProps {
    children: ReactNode;
}

const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children }) => {
    useNotifications();

    const notification = useStore(state => state.notification);
    const isSearchOpen = useStore(state => state.isSearchOpen);
    const setSearchOpen = useStore(state => state.setSearchOpen);
    const autoTheme = useStore(state => state.autoTheme);
    const themeSchedule = useStore(state => state.themeSchedule);
    const storeTheme = useStore(state => state.theme);

    const themeTogglerRef = React.useRef<HTMLButtonElement>(null);

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

    React.useEffect(() => {
        if (!autoTheme && storeTheme !== theme) {
            // @ts-ignore
            setTheme(storeTheme);
        }
    }, [storeTheme, autoTheme]);

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
                isDarkTime = currentMinutes >= startMinutes && currentMinutes < endMinutes;
            } else {
                isDarkTime = currentMinutes >= startMinutes || currentMinutes < endMinutes;
            }

            const targetTheme = isDarkTime ? 'dark' : 'light';
            if (theme !== targetTheme) {
                // @ts-ignore
                setTheme(targetTheme);
            }
        };

        checkTheme();
        const interval = setInterval(checkTheme, 60000);
        return () => clearInterval(interval);
    }, [autoTheme, themeSchedule, theme]);

    // Window actions
    const handleMinimize = () => window.electronAPI?.minimize?.();
    const handleMaximize = () => window.electronAPI?.maximize?.();
    const handleClose = () => {
        if (isSearchOpen) setSearchOpen(false);
        else window.electronAPI?.close?.();
    };

    // Child Window Blur Effect
    const [isChildWindowOpen, setIsChildWindowOpen] = React.useState(false);

    React.useEffect(() => {
        if (!window.electronAPI) {
            if (isDev) console.log('[SidebarLayout] Not running in Electron');
            return;
        }

        if (!window.electronAPI.on) {
            if (isDev) console.log('[SidebarLayout] Electron API does not support event listeners');
            return;
        }

        // @ts-ignore
        const handleOpen = () => setIsChildWindowOpen(true);
        // @ts-ignore
        const handleClose = () => setIsChildWindowOpen(false);

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
        <div className="h-screen w-screen overflow-hidden bg-sidebar">
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset className="flex flex-col h-screen bg-background relative min-w-0 overflow-hidden">
                    {/* Blur Overlay when Child Window is Open */}
                    {isChildWindowOpen && (
                        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
                    )}

                    {/* Header with window controls */}
                    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 bg-background px-4 titlebar-drag">
                        <div className="no-drag flex items-center gap-2">
                            <SidebarTrigger className="-ml-1" />
                            <Separator orientation="vertical" className="mr-2 h-4" />
                        </div>

                        {/* Spacer */}
                        <div className="flex-1" />

                        <div className="no-drag flex items-center space-x-2">
                            <ThemeTogglerButton
                                ref={themeTogglerRef}
                                variant="ghost"
                                modes={['light', 'dark']}
                                className="rounded-full w-8 h-8"
                            />

                            {/* Window Actions */}
                            <div className="flex items-center ml-2">
                                <button 
                                    onClick={handleMinimize} 
                                    className="h-8 px-3 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                    title="Minimize"
                                >
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect y="5" width="12" height="2" fill="currentColor"/>
                                    </svg>
                                </button>
                                <button 
                                    onClick={handleMaximize} 
                                    className="h-8 px-3 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                    title="Maximize"
                                >
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="0.5" y="0.5" width="11" height="11" stroke="currentColor"/>
                                    </svg>
                                </button>
                                <button 
                                    onClick={handleClose} 
                                    className="h-8 px-3 text-muted-foreground hover:bg-red-500 hover:text-white transition-colors"
                                    title="Close"
                                >
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M1 1L11 11M1 11L11 1" stroke="currentColor" strokeWidth="1.5"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </header>

                    {/* Main Content Area */}
                    <div className="flex-1 w-full overflow-auto">
                        {children}
                    </div>
                </SidebarInset>
            </SidebarProvider>

            <Toaster duration={8000} />
            <TipBanner />
            <GlobalSearchDialog
                isOpen={isSearchOpen}
                onClose={() => setSearchOpen(false)}
            />
        </div>
    );
};

export default SidebarLayout;
