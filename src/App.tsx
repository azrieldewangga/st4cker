import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import MainLayout from './components/layout/MainLayout';
// import LoadingScreen from './components/shared/LoadingScreen';
import { useStore } from './store/useStore';
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
  const { initApp, isAppReady, userProfile, theme: storeTheme, setTheme: setStoreTheme } = useStore();
  const { theme } = useTheme(); // Keep for reading current effective theme if needed, or just use storeTheme
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    // Detect window type
    const isMain = window.location.hash === '' || window.location.hash === '#/';
    initApp(!isMain);
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
        const newTheme = storeTheme === 'dark' ? 'light' : 'dark';
        setStoreTheme(newTheme);
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
    <ErrorBoundary>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onToggleTheme={() => {
          const newTheme = storeTheme === 'dark' ? 'light' : 'dark';
          setStoreTheme(newTheme);
        }}
        onUndo={() => useStore.getState().undo()}
        onRedo={() => useStore.getState().redo()}
        onSearch={() => useStore.getState().setSearchOpen(true)}
      />


      <HashRouter>
        <Routes>
          {/* Secondary Windows */}
          <Route path="/history" element={<TransactionHistoryModal />} />

          {/* Onboarding Route */}
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Primary Routes */}
          <Route path="/*" element={
            // Gate: If App Connected but No Profile -> Redirect to Onboarding
            isAppReady && !userProfile ? (
              <Navigate to="/onboarding" replace />
            ) : (
              <MainLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/assignments" element={<Assignments />} />
                  <Route path="/performance" element={<Performance />} />
                  <Route path="/schedule" element={<Schedule />} />
                  <Route path="/cashflow" element={<Cashflow />} />
                  <Route path="/settings" element={<Settings />} />
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
