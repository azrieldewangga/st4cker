import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { format } from 'date-fns';
import { MoreHorizontal, Trash2, Edit2, X, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import clsx from 'clsx';
import { Transaction } from '../../types/models';
import { toast } from "sonner";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

// Standalone page, no props needed
const TransactionHistoryModal = () => {
    const {
        transactions,
        fetchTransactions,
        deleteTransaction,
        updateTransaction,
        clearTransactions,
        undo
    } = useStore();
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Read theme from URL query parameter (passed by parent window)
    const urlParams = new URLSearchParams(window.location.search);
    const themeFromUrl = urlParams.get('theme');
    const fallbackTheme = localStorage.getItem('vite-ui-theme') || 'dark';
    const [currentTheme, setCurrentTheme] = useState(themeFromUrl || fallbackTheme);

    useEffect(() => {
        // Apply theme to document
        document.documentElement.setAttribute('data-theme', currentTheme);
        if (currentTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // Listen for storage changes (sync with main window)
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'theme' && e.newValue) {
                setCurrentTheme(e.newValue);
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [currentTheme]);


    useEffect(() => {
        // Initial fetch
        fetchTransactions();

        // Listen for sync events
        const handleRefresh = () => fetchTransactions();
        // @ts-ignore
        window.electronAPI.onRefreshData(handleRefresh);
        // @ts-ignore
        return () => window.electronAPI.offRefreshData();
    }, []);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            // @ts-ignore
            if (e.key === 'Escape') window.electronAPI.close();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    // @ts-ignore
    const handleClose = () => window.electronAPI.close();
    // @ts-ignore
    const handleMinimize = () => window.electronAPI.minimize();
    // @ts-ignore
    const handleMaximize = () => window.electronAPI.maximize();

    // Confirm Modal State
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'danger' | 'warning';
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'warning',
        onConfirm: () => { }
    });

    const sortedTransactions = useMemo(() => {
        return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions]);

    const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);
    const currentTransactions = sortedTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const checkPageValidity = () => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    };

    const handleDelete = (id: string, title: string) => {
        setConfirmState({
            isOpen: true,
            title: 'Delete Transaction',
            message: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
            type: 'warning',
            onConfirm: async () => {
                await deleteTransaction(id);
                toast("Transaction has been deleted", {
                    description: title,
                    action: {
                        label: "Undo",
                        onClick: () => undo(),
                    },
                });
                checkPageValidity();
                setConfirmState(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleClearAll = () => {
        setConfirmState({
            isOpen: true,
            title: 'Clear All History',
            message: 'Are you sure you want to delete ALL transaction history? This will reset your data to the base values.',
            type: 'danger',
            onConfirm: async () => {
                await clearTransactions();
                toast("History has been cleared", {
                    description: "All transactions have been deleted.",
                });
                setConfirmState(prev => ({ ...prev, isOpen: false }));
                // handleClose(); // Optional: close history window after clearing
            }
        });
    };


    const handleEdit = (t: Transaction) => {
        setEditingTransaction({
            ...t,
            amount: Number(t.amount)
        });
    };

    // Edit Modal State
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    const handleSaveEdit = async () => {
        if (!editingTransaction) return;
        await updateTransaction(editingTransaction.id, {
            title: editingTransaction.title,
            amount: editingTransaction.amount,
            category: editingTransaction.category,
            type: editingTransaction.type
        });
        toast("Transaction has been updated", {
            description: editingTransaction.title,
        });
        setEditingTransaction(null);
        // @ts-ignore
        window.electronAPI.notifyDataChanged();
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground overflow-hidden">
            {/* Traffic Lights / Header */}
            <div className="titlebar-drag h-10 px-4 flex items-center justify-between border-b bg-muted/50 shrink-0">
                {/* Left: Clear All/Actions */}
                <div className="flex w-20 no-drag items-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs px-2"
                        onClick={handleClearAll}
                    >
                        <Trash2 size={12} className="mr-1" /> Clear
                    </Button>
                </div>

                {/* Center: Title */}
                <div className="flex-1 text-center font-bold text-sm tracking-wide opacity-80">
                    Transaction History
                </div>

                {/* Right: Traffic Lights */}
                <div className="flex gap-2 w-20 justify-end no-drag items-center">
                    <button onClick={handleMinimize} className="w-3 h-3 rounded-full bg-[#febc2e] hover:brightness-75 border border-black/10 shadow-sm transition-all" />
                    <button onClick={handleMaximize} className="w-3 h-3 rounded-full bg-[#28c840] hover:brightness-75 border border-black/10 shadow-sm transition-all" />
                    <button onClick={handleClose} className="w-3 h-3 rounded-full bg-[#ff5f57] hover:brightness-75 border border-black/10 shadow-sm transition-all" />
                </div>
            </div>

            {/* Content Area */}
            <ScrollArea className="flex-1 bg-background p-0 h-full">
                <div className="w-full">
                    <table className="w-full text-sm caption-bottom">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Date</th>
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Title</th>
                                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Category</th>
                                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">Amount</th>
                                <th className="h-10 px-4 text-center align-middle font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {currentTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center opacity-50">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-2">
                                                <X size={24} className="opacity-20" />
                                            </div>
                                            No transactions found
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                currentTransactions.map((t) => (
                                    <tr key={t.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted group">
                                        <td className="p-4 align-middle font-mono text-xs opacity-70 w-32">
                                            {format(new Date(t.date), 'MMM dd, yyyy')}
                                        </td>
                                        <td className="p-4 align-middle font-medium">
                                            {t.title}
                                        </td>
                                        <td className="p-4 align-middle">
                                            <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 capitalize">
                                                {t.category}
                                            </div>
                                        </td>
                                        <td className={clsx(
                                            "p-4 align-middle text-right font-mono font-bold",
                                            t.type === 'income' ? "text-emerald-500" : "text-rose-500"
                                        )}>
                                            {t.type === 'income' ? '+' : '-'}{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(t.amount)}
                                        </td>
                                        <td className="p-4 align-middle w-16 text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEdit(t)}>
                                                        <Edit2 className="mr-2 h-4 w-4" /> Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDelete(t.id, t.title)} className="text-destructive focus:text-destructive font-bold">
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </ScrollArea>

            {/* Pagination Footer */}
            {
                totalPages > 1 && (
                    <div className="p-2 border-t bg-background flex justify-center items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-mono opacity-70 mx-2">
                            Page {currentPage} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                )
            }

            {/* Confirm Dialog */}
            <AlertDialog open={confirmState.isOpen} onOpenChange={(open) => !open && setConfirmState(prev => ({ ...prev, isOpen: false }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirmState.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmState.message}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmState.onConfirm}
                            className={confirmState.type === 'danger' ? 'bg-destructive hover:bg-destructive/90' : ''}
                        >
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit Transaction Dialog */}
            <Dialog open={!!editingTransaction} onOpenChange={(open) => !open && setEditingTransaction(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Transaction</DialogTitle>
                    </DialogHeader>
                    {editingTransaction && (
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    value={editingTransaction.title}
                                    onChange={(e) => setEditingTransaction({ ...editingTransaction, title: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="amount">Amount (IDR)</Label>
                                <Input
                                    id="amount"
                                    type="text"
                                    value={
                                        typeof editingTransaction.amount === 'number'
                                            ? editingTransaction.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })
                                            : '0'
                                    }
                                    onChange={(e) => {
                                        const input = e.target.value;
                                        // Remove all non-digit characters except decimal point
                                        const numericValue = input.replace(/[^\d.]/g, '');
                                        // Parse to number
                                        const num = parseFloat(numericValue);
                                        setEditingTransaction({ ...editingTransaction, amount: isNaN(num) ? 0 : num });
                                    }}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="type">Type</Label>
                                    <Select
                                        value={editingTransaction.type}
                                        onValueChange={(value: 'income' | 'expense') => setEditingTransaction({ ...editingTransaction, type: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="income">Income</SelectItem>
                                            <SelectItem value="expense">Expense</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Select
                                        value={editingTransaction.category}
                                        onValueChange={(value) => setEditingTransaction({ ...editingTransaction, category: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Food">Food</SelectItem>
                                            <SelectItem value="Transport">Transport</SelectItem>
                                            <SelectItem value="Shopping">Shopping</SelectItem>
                                            <SelectItem value="Entertainment">Entertainment</SelectItem>
                                            <SelectItem value="Bills">Bills</SelectItem>
                                            <SelectItem value="Education">Education</SelectItem>
                                            <SelectItem value="Transfer">Transfer</SelectItem>
                                            <SelectItem value="Others">Others</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTransaction(null)}>Cancel</Button>
                        <Button onClick={handleSaveEdit}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
};

export default TransactionHistoryModal;
