import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, Command } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Shortcut {
    id: string;
    category: string;
    keys: string[];
    description: string;
    action?: () => void;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onToggleTheme?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    onSearch?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
    isOpen,
    onClose,
    onToggleTheme,
    onUndo,
    onRedo,
    onSearch,
}) => {
    const [search, setSearch] = useState('');

    const shortcuts: Shortcut[] = [
        {
            id: 'toggle-theme',
            category: 'Theme',
            keys: ['Ctrl', 'Alt', 'D'],
            description: 'Toggle Dark/Light Mode',
            action: onToggleTheme,
        },
        {
            id: 'undo',
            category: 'Editing',
            keys: ['Ctrl', 'Z'],
            description: 'Undo last action',
            action: onUndo,
        },
        {
            id: 'redo',
            category: 'Editing',
            keys: ['Ctrl', 'Shift', 'Z'],
            description: 'Redo last action',
            action: onRedo,
        },
        {
            id: 'quick-add',
            category: 'General',
            keys: ['Ctrl', 'N'],
            description: 'New Assignment (Assignments) / Add Transaction (Cashflow)',
        },
        {
            id: 'command-palette',
            category: 'General',
            keys: ['Ctrl', 'K'],
            description: 'Open Command Palette (this)',
        },
        {
            id: 'global-search',
            category: 'General',
            keys: ['Ctrl', 'F'],
            description: 'Global Search',
            action: onSearch,
        },
        {
            id: 'close-window',
            category: 'Window',
            keys: ['Esc'],
            description: 'Close dialogs and modals',
        },
    ];

    const filteredShortcuts = useMemo(() => {
        if (!search) return shortcuts;
        const lowerSearch = search.toLowerCase();
        return shortcuts.filter(
            (s) =>
                s.description.toLowerCase().includes(lowerSearch) ||
                s.category.toLowerCase().includes(lowerSearch) ||
                s.keys.some((k) => k.toLowerCase().includes(lowerSearch))
        );
    }, [search]);

    const groupedShortcuts = useMemo(() => {
        const groups: Record<string, Shortcut[]> = {};
        filteredShortcuts.forEach((shortcut) => {
            if (!groups[shortcut.category]) {
                groups[shortcut.category] = [];
            }
            groups[shortcut.category].push(shortcut);
        });
        return groups;
    }, [filteredShortcuts]);

    // Reset search when dialog opens/closes
    useEffect(() => {
        if (!isOpen) {
            setSearch('');
        }
    }, [isOpen]);

    const handleExecute = (shortcut: Shortcut) => {
        if (shortcut.action) {
            shortcut.action();
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl p-0 gap-0">
                <DialogHeader className="px-4 pt-4 pb-0">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Command className="h-5 w-5" />
                        Command Palette
                    </DialogTitle>
                </DialogHeader>

                {/* Search Input */}
                <div className="px-4 py-3 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search shortcuts..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Shortcuts List */}
                <div className="max-h-[400px] overflow-y-auto p-4">
                    {Object.keys(groupedShortcuts).length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No shortcuts found</p>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(groupedShortcuts).map(([category, items]) => (
                                <div key={category}>
                                    <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                                        {category}
                                    </h3>
                                    <div className="space-y-1">
                                        {items.map((shortcut) => (
                                            <div
                                                key={shortcut.id}
                                                className={cn(
                                                    "flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors",
                                                    shortcut.action && "cursor-pointer"
                                                )}
                                                onClick={() => handleExecute(shortcut)}
                                            >
                                                <span className="text-sm">{shortcut.description}</span>
                                                <div className="flex items-center gap-1">
                                                    {shortcut.keys.map((key, i) => (
                                                        <React.Fragment key={i}>
                                                            <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded">
                                                                {key}
                                                            </kbd>
                                                            {i < shortcut.keys.length - 1 && (
                                                                <span className="text-muted-foreground text-xs">+</span>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t bg-muted/50">
                    <p className="text-xs text-muted-foreground text-center">
                        Click on a shortcut to execute it, or press <kbd className="px-1.5 py-0.5 text-xs bg-background border rounded">Esc</kbd> to close
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
};
