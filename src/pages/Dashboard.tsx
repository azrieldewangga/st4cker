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

export default function Dashboard() {
    const { transactions, currency, userProfile } = useStore();

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
                        <TabsTrigger value="notifications">Notifications</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview" className="space-y-4">
                    <MetricCards />
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <Card className="col-span-4">
                            <CardHeader>
                                <CardTitle>Cashflow</CardTitle>
                                <CardDescription>
                                    Your income vs expense overview for the current semester.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pl-2">
                                <CashflowChart />
                            </CardContent>
                        </Card>
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
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                <DollarSign size={16} /> {/* Reusing import if available or need new */}
                                            </div>
                                            <div>
                                                <p className="font-medium">Monthly Limit</p>
                                                <p className="text-xs text-muted-foreground">Spend wisely</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-medium">{percentage}%</p>
                                        </div>
                                    </div>
                                    {/* Progress Bar */}
                                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full transition-all duration-500 ease-in-out"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground text-center pt-1">
                                        You have spent {formatter.format(monthlyExpense)} this month
                                    </p>
                                </div>

                                <div className="h-[220px]">
                                    <CreditCard />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Placeholder Content for other tabs */}
                <TabsContent value="analytics" className="h-[400px] flex items-center justify-center border rounded-lg border-dashed bg-muted/20">
                    <div className="text-center space-y-2">
                        <p className="text-muted-foreground font-medium">Detailed Analytics coming soon.</p>
                        <p className="text-xs text-muted-foreground">Check Cashflow page for more charts.</p>
                    </div>
                </TabsContent>
                <TabsContent value="reports" className="h-[400px] flex items-center justify-center border rounded-lg border-dashed bg-muted/20">
                    <div className="text-center space-y-2">
                        <p className="text-muted-foreground font-medium">No reports generated yet.</p>
                        <Button variant="outline" size="sm">Generate PDF Report</Button>
                    </div>
                </TabsContent>
                <TabsContent value="notifications" className="h-[400px] flex items-center justify-center border rounded-lg border-dashed bg-muted/20">
                    <div className="text-center space-y-2">
                        <p className="text-muted-foreground font-medium">No new notifications.</p>
                        <p className="text-xs text-muted-foreground">We'll notify you about deadlines and expenses.</p>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
