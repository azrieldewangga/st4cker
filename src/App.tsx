import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ErrorFallback } from '@/components/common/ErrorFallback';
import MainLayout from './components/layout/MainLayout';
// import LoadingScreen from './components/shared/LoadingScreen';
import { useStore } from './store/useStoreNew';
import Dashboard from './pages/Dashboard';

import Assignments from './pages/Assignments';
import Onboarding from './pages/Onboarding';

// Placeholder components
import Settings from './pages/Settings';
import Performance from './pages/Performance';
import Schedule from './pages/Schedule';

import Cashflow from './pages/Cashflow';
import TransactionHistoryModal from './components/modals/TransactionHistoryModal'; // Now acting as a page




import { useTheme } from "@/components/theme-provider";
import { CommandPalette } from "@/components/ui/command-palette";
import { useState } from 'react';


const StandaloneRoutes = () => {
  // Use direct store access to prevent object recreation
  const initApp = useStore(state => state.initApp);
  const isAppReady = useStore(state => state.isAppReady);
  const userProfile = useStore(state => state.userProfile);
  const theme = useStore(state => state.theme);
  const setTheme = useStore(state => state.setTheme);

  const { theme: contextTheme } = useTheme(); // Keep for reading current effective theme if needed, or just use storeTheme
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    // Detect window type
    const isMain = window.location.hash === '' || window.location.hash === '#/';
    initApp(!isMain);

    // Listen for refresh-data events (e.g. from Telegram)
    const handleRefresh = () => {
      console.log('[App] Received refresh-data signal');
      useStore.getState().fetchAssignments();
      import("sonner").then(({ toast }) => {
        toast.success("New Data Received", {
          description: "Your assignments have been updated from Telegram."
        });
      });
    };

    // Safe check for Electron API
    // @ts-ignore
    const api = window.electronAPI;
    if (api && typeof api.onRefreshData === 'function') {
      api.onRefreshData(handleRefresh);
    }

    return () => {
      // @ts-ignore
      const api = window.electronAPI;
      if (api && typeof api.offRefreshData === 'function') {
        api.offRefreshData();
      }
    };
  }, []);

  useEffect(() => {
    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + K: Open Command Palette
      if (cmdKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      // Ctrl + Alt + D: Toggle Theme
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        // Trigger the actual button to get the wipe animation
        if ((window as any).triggerThemeToggle) {
          (window as any).triggerThemeToggle();
        } else {
          // Fallback if button not mounted yet
          const newTheme = theme === 'dark' ? 'light' : 'dark';
          setTheme(newTheme);
        }
      }

      if (cmdKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          // Redo: Ctrl + Shift + Z
          useStore.getState().redo();
        } else {
          // Undo: Ctrl + Z
          useStore.getState().undo();
        }
      }

      // Ctrl + R: Refresh
      if (cmdKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        window.location.reload();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [theme]);

  // if (!isAppReady) {
  //   // Show loading screen for main window only
  //   // const isMain = window.location.hash === '' || window.location.hash === '#/';
  //   // if (!isMain) return null;
  //   // return <LoadingScreen />;

  //   // Legacy Loading Screen Removed: We now use Electron Splash Screen
  //   // Just return null until ready, or allow render if you prefer skeleton
  //   // if (!isAppReady) return null;
  // }

  return (
    <ErrorBoundary context="App">
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onToggleTheme={() => {
          const newTheme = theme === 'dark' ? 'light' : 'dark';
          setTheme(newTheme);
        }}
        onUndo={() => useStore.getState().undo()}
        onRedo={() => useStore.getState().redo()}
        onSearch={() => useStore.getState().setSearchOpen(true)}
      />


      <HashRouter>
        <Routes>
          {/* Secondary Windows */}
          <Route path="/history" element={
            <ErrorBoundary context="History Window" fallback={<ErrorFallback context="History" error={new Error("History Window Error")} />}>
              <TransactionHistoryModal />
            </ErrorBoundary>
          } />

          {/* Onboarding Route */}
          <Route path="/onboarding" element={
            <ErrorBoundary context="Onboarding">
              <Onboarding />
            </ErrorBoundary>
          } />

          {/* Primary Routes */}
          <Route path="/*" element={
            // Gate: If App Connected but No Profile -> Redirect to Onboarding
            isAppReady && !userProfile ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <MainLayout>
                <Routes>
                  <Route path="/" element={<ErrorBoundary context="Dashboard" fallback={({ error, resetErrorBoundary }) => <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} context="Dashboard" />}><Dashboard /></ErrorBoundary>} />
                  <Route path="/assignments" element={<ErrorBoundary context="Assignments" fallback={({ error, resetErrorBoundary }) => <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} context="Assignments" />}><Assignments /></ErrorBoundary>} />
                  <Route path="/performance" element={<ErrorBoundary context="Performance" fallback={({ error, resetErrorBoundary }) => <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} context="Performance" />}><Performance /></ErrorBoundary>} />
                  <Route path="/schedule" element={<ErrorBoundary context="Schedule" fallback={({ error, resetErrorBoundary }) => <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} context="Schedule" />}><Schedule /></ErrorBoundary>} />
                  <Route path="/cashflow" element={<ErrorBoundary context="Cashflow" fallback={({ error, resetErrorBoundary }) => <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} context="Cashflow" />}><Cashflow /></ErrorBoundary>} />
                  <Route path="/settings" element={<ErrorBoundary context="Settings" fallback={({ error, resetErrorBoundary }) => <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} context="Settings" />}><Settings /></ErrorBoundary>} />
                </Routes>
              </MainLayout>
            )
          } />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  )
}


export default StandaloneRoutes;
