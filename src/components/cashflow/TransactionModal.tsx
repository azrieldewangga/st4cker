import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { format } from 'date-fns';
import { TransactionSchema, validateData } from '@/lib/validation';
import { AlertCircle } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { cn } from "@/lib/utils";

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TransactionModal = ({ isOpen, onClose }: TransactionModalProps) => {
    const { addTransaction, currency } = useStore();

    const [formData, setFormData] = useState({
        title: '',
        amount: '',
        type: 'expense' as 'income' | 'expense',
        category: 'Food',
        date: new Date()
    });

    const [errors, setErrors] = useState<string[]>([]);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                title: '',
                amount: '',
                type: 'expense',
                category: 'Food',
                date: new Date()
            });
            setErrors([]);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate Data
        const validationResult = validateData(TransactionSchema, {
            title: formData.title,
            amount: parseFloat(formData.amount),
            type: formData.type,
            category: formData.category,
            date: formData.date.toISOString(),
            currency
        });

        if (!validationResult.success) {
            setErrors((validationResult as any).errors);
            return;
        }

        try {
            await addTransaction({
                title: formData.title,
                amount: parseFloat(formData.amount) * (formData.type === 'expense' ? -1 : 1),
                type: formData.type,
                category: formData.category,
                date: formData.date.toISOString() // Fix: Use ISO string for Zod validation
            });

            onClose();
        } catch (error) {
            console.error("Failed to add transaction:", error);
            // Optionally set error state here if you want to show it in UI
        }
    };

    const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Subscription', 'Transfer', 'Salary'];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>New Transaction</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    {errors.length > 0 && (
                        <div className="bg-destructive/15 text-destructive p-3 rounded-md flex items-start gap-2 text-sm">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <ul className="list-disc pl-4 space-y-1">
                                {errors.map((err, i) => (
                                    <li key={i}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {/* Type Toggle */}
                    <div className="space-y-2">
                        <Label>Type</Label>
                        <div className="flex gap-2 bg-muted p-1 rounded-lg">
                            <Button
                                type="button"
                                variant={formData.type === 'income' ? 'default' : 'ghost'}
                                size="sm"
                                className={cn(
                                    "flex-1",
                                    formData.type === 'income' && "bg-emerald-600 hover:bg-emerald-700"
                                )}
                                onClick={() => setFormData({ ...formData, type: 'income' })}
                            >
                                Income
                            </Button>
                            <Button
                                type="button"
                                variant={formData.type === 'expense' ? 'default' : 'ghost'}
                                size="sm"
                                className={cn(
                                    "flex-1",
                                    formData.type === 'expense' && "bg-rose-600 hover:bg-rose-700"
                                )}
                                onClick={() => setFormData({ ...formData, type: 'expense' })}
                            >
                                Expense
                            </Button>
                        </div>
                    </div>

                    {/* Date */}
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <DatePicker
                            date={formData.date}
                            setDate={(date) => date && setFormData({ ...formData, date: date })}
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="title">Description</Label>
                        <Input
                            id="title"
                            placeholder="e.g. Lunch, Freelance"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>

                    {/* Amount & Category */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                    {currency === 'USD' ? '$' : 'Rp'}
                                </span>
                                <Input
                                    id="amount"
                                    type="number"
                                    placeholder="0"
                                    className="pl-10"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select
                                value={formData.category}
                                onValueChange={(value) => setFormData({ ...formData, category: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4">
                        <Button type="submit" className="w-full">
                            Add Transaction
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default TransactionModal;
