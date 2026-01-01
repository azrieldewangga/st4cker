import React, { ReactNode } from 'react';
import { useStore } from '../../store/useStore';
import { MainNav } from './MainNav';
import { Search } from './Search';
import { UserNav } from './UserNav';
import { SemesterSwitcher } from './SemesterSwitcher';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils'; // Assuming cn is available

interface MainLayoutProps {
    children: ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { notification } = useStore();

    // Notification Listener
    React.useEffect(() => {
        if (notification) {
            // @ts-ignore
            toast[notification.type === 'error' ? 'error' : notification.type === 'success' ? 'success' : 'message'](notification.message);
        }
    }, [notification]);

    // Window Controls
    const handleMinimize = () => window.electronAPI.minimize();
    const handleMaximize = () => window.electronAPI.maximize();
    const handleClose = () => window.electronAPI.close();

    // Child Window Blur Effect
    const [isChildWindowOpen, setIsChildWindowOpen] = React.useState(false);

    React.useEffect(() => {
        // @ts-ignore
        const handleOpen = () => {
            console.log('[MainLayout] Received child-window-opened');
            setIsChildWindowOpen(true);
        };
        // @ts-ignore
        const handleClose = () => {
            console.log('[MainLayout] Received child-window-closed');
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
        <div className="h-screen w-screen overflow-hidden bg-transparent flex flex-col p-4">
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

                        {/* Right: Search & User & Window Controls */}
                        <div className="no-drag flex items-center space-x-4">
                            <Search />
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
                <div className="flex-1 space-y-4 p-8 pt-6 overflow-y-auto bg-muted/10">
                    <div className="mx-auto max-w-7xl animate-fade-in text-foreground">
                        {children}
                    </div>
                </div>

            </div>

            <Toaster />
        </div>
    );
};

export default MainLayout;
