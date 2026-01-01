import { HashRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import MainLayout from './components/layout/MainLayout';
import LoadingScreen from './components/shared/LoadingScreen';
import { useStore } from './store/useStore';
import Dashboard from './pages/Dashboard';

import Assignments from './pages/Assignments';

// Placeholder components
import Settings from './pages/Settings';
import Performance from './pages/Performance';
import Schedule from './pages/Schedule';

import Cashflow from './pages/Cashflow';
import TransactionHistoryModal from './components/modals/TransactionHistoryModal'; // Now acting as a page


function App() {
  return (
    <HashRouter>
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
    </HashRouter>
  );
}

const StandaloneRoutes = () => {
  const { initApp, isAppReady } = useStore();

  useEffect(() => {
    // Check if this is the main window or a secondary window
    const isMain = window.location.hash === '' || window.location.hash === '#/';
    initApp(!isMain);

    // Global Key Listener for Undo/Redo
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isAppReady) {
    // If it's a secondary window, render nothing while loading (instant feel)
    const isMain = window.location.hash === '' || window.location.hash === '#/';
    if (!isMain) return null;
    return <LoadingScreen />;
  }

  return (
    <HashRouter>
      <Routes>
        {/* Standalone Window Routes - MUST BE FIRST */}
        <Route path="/history" element={<TransactionHistoryModal />} />


        {/* Main App Routes - Catch all others */}
        <Route path="/*" element={
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
        } />
      </Routes>
    </HashRouter>
  )
}

export default StandaloneRoutes;
