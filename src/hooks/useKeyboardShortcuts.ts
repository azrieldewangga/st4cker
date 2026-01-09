import { useHotkeys } from 'react-hotkeys-hook';
import { useStore } from '@/store/useStoreNew';
import { toast } from 'sonner';

/**
 * Global keyboard shortcuts hook
 * Use this in MainLayout or App root
 */
export const useGlobalKeyboardShortcuts = (callbacks: {
    onNewAssignment?: () => void;
    onNewTransaction?: () => void;
    onNewProject?: () => void;
    onSearch?: () => void;
}) => {
    const { undo, redo } = useStore(state => ({
        undo: state.undo,
        redo: state.redo,
    }));

    // Undo (Ctrl+Z)
    useHotkeys('ctrl+z, meta+z', (e) => {
        e.preventDefault();
        undo();
        toast.info('Undo');
    }, { enableOnFormTags: false });

    // Redo (Ctrl+Shift+Z or Ctrl+Y)
    useHotkeys('ctrl+shift+z, ctrl+y, meta+shift+z', (e) => {
        e.preventDefault();
        redo();
        toast.info('Redo');
    }, { enableOnFormTags: false });

    // New Assignment (Ctrl+Alt+A)
    useHotkeys('ctrl+alt+a', (e) => {
        e.preventDefault();
        callbacks.onNewAssignment?.();
    }, { enableOnFormTags: false });

    // New Transaction (Ctrl+Alt+T)
    useHotkeys('ctrl+alt+t', (e) => {
        e.preventDefault();
        callbacks.onNewTransaction?.();
    }, { enableOnFormTags: false });

    // New Project (Ctrl+Alt+P)
    useHotkeys('ctrl+alt+p', (e) => {
        e.preventDefault();
        callbacks.onNewProject?.();
    }, { enableOnFormTags: false });

    // Search (Ctrl+K)
    useHotkeys('ctrl+k, meta+k', (e) => {
        e.preventDefault();
        callbacks.onSearch?.();
    }, { enableOnFormTags: false });

    // Help overlay (Ctrl+/)
    useHotkeys('ctrl+/', (e) => {
        e.preventDefault();
        toast.info(`Shortcuts: 
Ctrl+Z: Undo | Ctrl+Y: Redo
Ctrl+Alt+A: New Assignment
Ctrl+Alt+T: New Transaction
Ctrl+Alt+P: New Project
Ctrl+K: Search`, {
            duration: 5000
        });
    }, { enableOnFormTags: false });
};
