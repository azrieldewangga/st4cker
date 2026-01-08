
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/useStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell, Calendar, AlertCircle, CheckCircle2, CreditCard, RefreshCcw } from "lucide-react";
import { format, differenceInDays, isPast, isToday, isTomorrow, addMonths, setDate } from "date-fns";
import { useMemo, useState } from "react";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
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

type NotificationItem = {
    id: string;
    type: 'assignment' | 'subscription' | 'system';
    title: string;
    description: string;
    date: Date;
    priority: 'high' | 'medium' | 'low';
    actionLabel?: string;
    metadata?: any; // Added metadata property
};

export function NotificationsTab() {
    const { assignments, subscriptions, userProfile, transactions, addTransaction, currency } = useStore();
    const navigate = useNavigate();

    // State for confirmation dialog
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        subscription: any | null;
    }>({ isOpen: false, subscription: null });

    const handleNotificationClick = (type: string) => {
        if (type === 'assignment') {
            navigate('/assignments');
        } else if (type === 'subscription') {
            navigate('/cashflow');
        }
    };

    // Function to show confirmation dialog
    const handlePaySubscription = (e: React.MouseEvent, sub: any) => {
        e.stopPropagation(); // Prevent navigation when button is clicked
        setConfirmDialog({ isOpen: true, subscription: sub });
    };

    // Function to confirm payment
    const handleConfirmPay = async () => {
        const sub = confirmDialog.subscription;
        if (!sub) return;

        await addTransaction({
            type: 'expense',
            amount: sub.cost,
            category: 'Subscription',
            title: `Payment for ${sub.name}`,
            date: new Date().toISOString()
        });

        setConfirmDialog({ isOpen: false, subscription: null });
    };

    // Helper to format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat(currency === 'IDR' ? 'id-ID' : 'en-US', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const notifications = useMemo(() => {
        const items: NotificationItem[] = [];
        const now = new Date();

        // 1. Assignment Notifications
        assignments.forEach(a => {
            if (a.status === 'done') return; // Skip completed

            const dueDate = new Date(a.deadline);
            const daysLeft = differenceInDays(dueDate, now);

            // Overdue
            if (isPast(dueDate) && !isToday(dueDate)) {
                items.push({
                    id: `overdue-${a.id}`,
                    type: 'assignment',
                    title: `Overdue: ${a.title}`,
                    description: `This assignment was due on ${format(dueDate, 'MMM d, yyyy')}.`,
                    date: dueDate,
                    priority: 'high',
                });
            }
            // Due Soon (within 3 days)
            else if (daysLeft >= 0 && daysLeft <= 3) {
                const priority = daysLeft <= 1 ? 'high' : 'medium';
                const timeStr = isToday(dueDate) ? 'Today' : isTomorrow(dueDate) ? 'Tomorrow' : `in ${daysLeft} days`;

                items.push({
                    id: `due-${a.id}`,
                    type: 'assignment',
                    title: `Due ${timeStr}: ${a.title}`,
                    description: `Don't forget to submit your ${a.type} for ${a.courseId}.`,
                    date: dueDate,
                    priority: priority,
                });
            }
        });

        // 2. Subscription Notifications
        subscriptions.forEach(sub => {
            // Calculate candidate date in CURRENT month
            let candidate = setDate(now, sub.dueDay);

            // If candidate is in the past (e.g. today 10th, due 5th), then next due is next month
            if (isPast(candidate) && !isToday(candidate)) {
                candidate = addMonths(candidate, 1);
            }
            // Logic check: if today 2nd, due 30th -> candidate is 30th (future) -> OK.

            // CHECK IF ALREADY PAID THIS CYCLE
            const isPaid = transactions.some(t =>
                t.type === 'expense' &&
                t.category === 'Subscription' &&
                t.title.includes(sub.name) &&
                new Date(t.date).getMonth() === candidate.getMonth() &&
                new Date(t.date).getFullYear() === candidate.getFullYear()
            );

            if (isPaid) return; // Skip if already paid

            const daysUntil = differenceInDays(candidate, now);

            if (daysUntil >= 0 && daysUntil <= 7) { // Notify 7 days in advance
                const priority = daysUntil <= 2 ? 'high' : 'low';
                const timeStr = isToday(candidate) ? 'Today' : isTomorrow(candidate) ? 'Tomorrow' : `in ${daysUntil} days`;

                items.push({
                    id: `sub-${sub.id}`,
                    type: 'subscription',
                    title: `Subscription Renewal: ${sub.name}`,
                    description: `Automated payment of ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(sub.cost)} due ${timeStr}.`,
                    date: candidate,
                    priority: priority,
                    metadata: sub // Store the full subscription object for the action button
                });
            }
        });

        // Sort by priority (high > medium > low), then by date
        return items.sort((a, b) => {
            const pMap = { high: 0, medium: 1, low: 2 };
            if (pMap[a.priority] !== pMap[b.priority]) {
                return pMap[a.priority] - pMap[b.priority];
            }
            return a.date.getTime() - b.date.getTime();
        });

    }, [assignments, subscriptions, transactions]); // Added transactions to dependency array

    if (notifications.length === 0) {
        return (
            <Empty className="from-muted/50 to-background min-h-[600px] bg-gradient-to-b from-30%">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Bell />
                    </EmptyMedia>
                    <EmptyTitle>No Notifications</EmptyTitle>
                    <EmptyDescription>
                        You&apos;re all caught up. New notifications will appear here.
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </EmptyContent>
            </Empty>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-4">
                {notifications.map((item) => (
                    <Card
                        key={item.id}
                        className={`transition-all duration-200 hover:border-primary/50 cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${item.priority === 'high' ? 'border-l-4 border-l-red-500' : ''}`}
                        onClick={() => handleNotificationClick(item.type)}
                    >
                        <CardContent className="p-4 flex items-start gap-4">
                            <div className={`p-2 rounded-lg mt-1 shrink-0 ${item.type === 'assignment' ? 'bg-blue-500/10 text-blue-500' :
                                item.type === 'subscription' ? 'bg-emerald-500/10 text-emerald-500' :
                                    'bg-gray-100 text-gray-500'
                                }`}>
                                {item.type === 'assignment' ? <Calendar size={20} /> :
                                    item.type === 'subscription' ? <CreditCard size={20} /> :
                                        <AlertCircle size={20} />}
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold text-sm">{item.title}</p>
                                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                                        {format(item.date, 'MMM d')}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {item.description}
                                </p>
                                {/* Render "Mark as Paid" button for subscription notifications */}
                                {item.type === 'subscription' && item.metadata && (
                                    <div className="mt-2">
                                        <Button
                                            size="sm"
                                            className="h-7 text-xs bg-emerald-500 text-white hover:bg-emerald-600"
                                            onClick={(e: React.MouseEvent) => handlePaySubscription(e, item.metadata)}
                                        >
                                            Mark as Paid
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Custom Confirmation Dialog */}
            <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog({ isOpen: false, subscription: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Mark as Paid?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will create a transaction for <span className="font-semibold">{confirmDialog.subscription?.name}</span> ({formatCurrency(confirmDialog.subscription?.cost || 0)}) and remove the notification.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmPay} className="bg-emerald-600 hover:bg-emerald-700">
                            Mark as Paid
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
