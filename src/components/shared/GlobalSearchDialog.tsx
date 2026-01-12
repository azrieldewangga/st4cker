import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, FileText, CreditCard, BookOpen, Calendar } from 'lucide-react';
import { useStore } from '@/store/useStoreNew';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface GlobalSearchDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export const GlobalSearchDialog: React.FC<GlobalSearchDialogProps> = ({
    isOpen,
    onClose,
}) => {
    const navigate = useNavigate();

    // Use direct store access to prevent object recreation
    const assignments = useStore(state => state.assignments);
    const transactions = useStore(state => state.transactions);
    const courses = useStore(state => state.courses);
    const userProfile = useStore(state => state.userProfile);

    const [search, setSearch] = useState('');

    // Reset search when dialog opens/closes
    useEffect(() => {
        if (!isOpen) {
            setSearch('');
        }
    }, [isOpen]);

    const results = useMemo(() => {
        if (!search || search.length < 2) return [];

        const lowerSearch = search.toLowerCase();

        interface SearchResult {
            id: string;
            type: 'assignment' | 'transaction' | 'course';
            title: string;
            subtitle: string;
            icon: React.ElementType;
            url: string;
        }

        const allResults: SearchResult[] = [];

        // Pre-calculate course map for name lookup
        const courseMap: Record<string, string> = {};
        courses.forEach(c => courseMap[c.id] = c.name);

        // 1. Search Assignments
        assignments.forEach(a => {
            const courseName = courseMap[a.courseId] || 'No Course';
            if (
                (a.title && a.title.toLowerCase().includes(lowerSearch)) ||
                (a.note && a.note.toLowerCase().includes(lowerSearch)) ||
                courseName.toLowerCase().includes(lowerSearch)
            ) {
                allResults.push({
                    id: a.id,
                    type: 'assignment',
                    title: a.title,
                    subtitle: `Due: ${format(new Date(a.deadline), 'dd MMM')} • ${courseName}`,
                    icon: FileText,
                    url: '/assignments' // Could pass state to highlight/filter
                });
            }
        });

        // 2. Search Transactions
        transactions.forEach(t => {
            if (
                (t.title && t.title.toLowerCase().includes(lowerSearch)) ||
                (t.category && t.category.toLowerCase().includes(lowerSearch))
            ) {
                allResults.push({
                    id: t.id,
                    type: 'transaction',
                    title: t.title,
                    subtitle: `${t.type === 'expense' ? '-' : '+'} ${t.amount.toLocaleString()} • ${t.category}`,
                    icon: CreditCard,
                    url: '/cashflow'
                });
            }
        });

        // 3. Search Courses
        courses.forEach(c => {
            if (c.name && c.name.toLowerCase().includes(lowerSearch)) {
                allResults.push({
                    id: c.id,
                    type: 'course',
                    title: c.name,
                    subtitle: `${c.sks} SKS • Sem ${c.semester}`,
                    icon: BookOpen,
                    url: '/performance'
                });
            }
        });

        return allResults;
    }, [search, assignments, transactions, courses]);

    const handleSelect = (url: string) => {
        navigate(url);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl p-0 gap-0">
                <DialogHeader className="px-4 pt-4 pb-0">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Search className="h-5 w-5" />
                        Global Search
                    </DialogTitle>
                </DialogHeader>

                <div className="px-4 py-3 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search assignments, transactions, courses..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto p-2">
                    {results.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            {search.length < 2 ? 'Type at least 2 characters to search' : 'No results found'}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {results.map((item) => (
                                <div
                                    key={`${item.type}-${item.id}`}
                                    className="flex items-center gap-3 p-3 rounded-md hover:bg-muted cursor-pointer transition-colors"
                                    onClick={() => handleSelect(item.url)}
                                >
                                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 border">
                                        <item.icon className="h-4 w-4 text-foreground/70" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{item.title}</div>
                                        <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                                    </div>
                                    <div className="text-xs font-medium uppercase text-muted-foreground/50 border px-1.5 py-0.5 rounded">
                                        {item.type}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-4 py-3 border-t bg-muted/50 flex justify-between items-center text-xs text-muted-foreground">
                    <span>{results.length} result{results.length !== 1 && 's'}</span>
                    <span>Press <kbd className="px-1.5 py-0.5 text-xs bg-background border rounded font-mono">Esc</kbd> to close</span>
                </div>
            </DialogContent>
        </Dialog>
    );
};
