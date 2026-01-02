import { Button } from "@/components/ui/button"
import { DollarSign } from "lucide-react"
import { useStore } from "@/store/useStore"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"

import { MetricCards } from "@/components/dashboard/MetricCards"
import { CashflowChart } from "@/components/dashboard/CashflowChart"
import { RecentTransactions } from "@/components/dashboard/RecentTransactions"
import CreditCard from "@/components/dashboard/CreditCard"
import { AnalyticsTab } from "@/components/dashboard/AnalyticsTab"
import { ReportsTab } from "@/components/dashboard/ReportsTab"
import { NotificationsTab } from "@/components/dashboard/NotificationsTab"
import { useMemo } from "react"
import { differenceInDays, isPast, isToday, setDate, addMonths } from "date-fns"

export default function Dashboard() {
    const { transactions, currency, userProfile, assignments, subscriptions } = useStore();

    // Calculate Notification Count
    const notificationCount = useMemo(() => {
        let count = 0;
        const now = new Date();

        assignments.forEach(a => {
            if (a.status === 'done') return;
            const dueDate = new Date(a.deadline);
            const daysLeft = differenceInDays(dueDate, now);
            // Overdue or Due Soon (<= 3 days)
            if ((isPast(dueDate) && !isToday(dueDate)) || (daysLeft >= 0 && daysLeft <= 3)) {
                count++;
            }
        });

        subscriptions.forEach(sub => {
            let candidate = setDate(now, sub.dueDay);
            if (isPast(candidate) && !isToday(candidate)) {
                candidate = addMonths(candidate, 1);
            }

            // Check if paid
            const isPaid = transactions.some(t =>
                t.type === 'expense' &&
                t.category === 'Subscription' &&
                t.title.includes(sub.name) &&
                new Date(t.date).getMonth() === candidate.getMonth() &&
                new Date(t.date).getFullYear() === candidate.getFullYear()
            );

            if (isPaid) return;

            const daysUntil = differenceInDays(candidate, now);
            if (daysUntil >= 0 && daysUntil <= 7) {
                count++;
            }
        });

        return count;
    }, [assignments, subscriptions, transactions]);

    // Calculate Monthly Expense
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyExpense = transactions
        .filter(t => {
            const date = new Date(t.date);
            return t.type === 'expense' && date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        })
        .reduce((acc, t) => acc + t.amount, 0);

    const { monthlyLimit } = useStore();
    const percentage = Math.min(Math.round((monthlyExpense / monthlyLimit) * 100), 100);

    const formatter = new Intl.NumberFormat(currency === 'IDR' ? 'id-ID' : 'en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });

    return (
        <div className="flex-1 space-y-4">
            {/* Header Section */}
            <div>
                {/* Row 1: Welcome Message */}
                <h2 className="text-3xl font-bold tracking-tight">Welcome in, {userProfile?.name || 'Student'}</h2>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                {/* Row 2: Dashboard Title + Tabs */}
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold tracking-tight text-muted-foreground">Dashboard</h3>
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                        <TabsTrigger value="reports">Reports</TabsTrigger>
                        <TabsTrigger value="notifications" className="relative">
                            Notifications
                            {notificationCount > 0 && (
                                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white shadow-sm ring-1 ring-blue-500/20">
                                    {notificationCount}
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview" className="space-y-4">
                    <MetricCards />
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <div className="col-span-4">
                            <CashflowChart />
                        </div>
                        <Card className="col-span-3">
                            <CardHeader>
                                <CardTitle>Wallet</CardTitle>
                                <CardDescription>
                                    Recent transactions and card status.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                <DollarSign size={16} />
                                            </div>
                                            <div>
                                                <p className="font-medium">Current Balance</p>
                                                <p className="text-xs text-muted-foreground">Available funds</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-lg text-emerald-500">
                                                {formatter.format(
                                                    transactions.reduce((acc, t) => {
                                                        const val = Number(t.amount);
                                                        if (val < 0) return acc + val;
                                                        return t.type === 'income' ? acc + val : acc - val;
                                                    }, 0)
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    {/* Monthly Summary */}
                                    <div className="flex items-center justify-center gap-4 text-xs pt-2 border-t border-border/50">
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                                            <span className="text-muted-foreground">Income:</span>
                                            <span className="font-medium text-emerald-500">
                                                {formatter.format(
                                                    transactions
                                                        .filter(t => {
                                                            const date = new Date(t.date);
                                                            return t.type === 'income' && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                                                        })
                                                        .reduce((acc, t) => acc + t.amount, 0)
                                                )}
                                            </span>
                                        </div>
                                        <div className="h-3 w-px bg-border"></div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                            <span className="text-muted-foreground">Expense:</span>
                                            <span className="font-medium text-red-500">
                                                {formatter.format(monthlyExpense)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full aspect-[1.58/1] mt-4">
                                    <CreditCard />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Placeholder Content for other tabs */}
                <TabsContent value="analytics" className="space-y-4">
                    <AnalyticsTab />
                </TabsContent>
                <TabsContent value="reports" className="space-y-4">
                    <ReportsTab />
                </TabsContent>
                <TabsContent value="notifications" className="space-y-4">
                    <NotificationsTab />
                </TabsContent>
            </Tabs>
        </div>
    )
}
