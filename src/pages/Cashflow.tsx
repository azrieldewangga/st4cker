import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { Wallet, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, ShoppingBag, Music, Coffee, Zap, Home, GraduationCap, Smartphone, MoreHorizontal, Plus } from 'lucide-react';
import { format, isSameMonth, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { cn } from "@/lib/utils";

// Shadcn Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import SubscriptionsTab from '../components/cashflow/SubscriptionsTab';
import TransactionModal from '../components/cashflow/TransactionModal';
import { Separator } from "@/components/ui/separator";

const RATE = 16000;

const Cashflow = () => {
    const { transactions, fetchTransactions, currency, setCurrency } = useStore();
    const [period, setPeriod] = useState<'Weekly' | 'Monthly' | 'Yearly'>('Yearly');
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchTransactions();
    }, []);

    const formatMoney = (amountIDR: number) => {
        if (currency === 'IDR') {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amountIDR);
        } else {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountIDR / RATE);
        }
    };

    // --- Dynamic Calculations (Same logic as before) ---
    const currentMonthDate = new Date();
    const sortedTransactions = useMemo(() => {
        return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions]);

    const totalBalance = useMemo(() => {
        return transactions.reduce((acc, tx) => {
            const amount = Number(tx.amount);
            if (amount < 0) return acc + amount;
            return acc + (tx.type === 'income' ? amount : -amount);
        }, 0);
    }, [transactions]);

    const { monthlyIncome, monthlyExpense } = useMemo(() => {
        return transactions.reduce((acc, tx) => {
            if (isSameMonth(new Date(tx.date), currentMonthDate)) {
                const amount = Number(tx.amount);
                if (amount < 0) {
                    acc.monthlyExpense += Math.abs(amount);
                } else if (tx.type === 'income') {
                    acc.monthlyIncome += amount;
                } else {
                    acc.monthlyExpense += amount;
                }
            }
            return acc;
        }, { monthlyIncome: 0, monthlyExpense: 0 });
    }, [transactions]);

    const financialData = useMemo(() => {
        if (period === 'Yearly') {
            const start = new Date(currentMonthDate.getFullYear(), 0, 1);
            const end = new Date(currentMonthDate.getFullYear(), 11, 31);
            const months = eachDayOfInterval({ start, end }).filter(d => d.getDate() === 1);
            return months.map(monthStart => {
                const monthName = format(monthStart, 'MMM');
                const monthTx = transactions.filter(t => isSameMonth(new Date(t.date), monthStart));
                const inc = monthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
                const exp = monthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
                return { name: monthName, income: inc, expense: exp, balance: inc - exp };
            });
        } else if (period === 'Monthly') {
            const startOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1);
            const endOfCurrentMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0);
            const weeks = [];
            let currentStart = startOfMonth;
            let weekCount = 1;
            while (currentStart <= endOfCurrentMonth) {
                const currentEnd = endOfWeek(currentStart, { weekStartsOn: 1 });
                const actualEnd = currentEnd > endOfCurrentMonth ? endOfCurrentMonth : currentEnd;
                const weekTx = transactions.filter(t => {
                    const d = new Date(t.date);
                    return d >= currentStart && d <= actualEnd;
                });
                const inc = weekTx.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
                const exp = weekTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
                weeks.push({ name: `Week ${weekCount}`, income: inc, expense: exp, balance: inc - exp });
                currentStart = new Date(currentEnd);
                currentStart.setDate(currentStart.getDate() + 1);
                weekCount++;
            }
            return weeks;
        } else {
            const start = startOfWeek(currentMonthDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentMonthDate, { weekStartsOn: 1 });
            const days = eachDayOfInterval({ start, end });
            return days.map(d => {
                const dayName = format(d, 'EEE');
                const dayTx = transactions.filter(t => isSameDay(new Date(t.date), d));
                const inc = dayTx.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
                const exp = dayTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
                return { name: dayName, income: inc, expense: exp, balance: inc - exp };
            });
        }
    }, [period, transactions, currentMonthDate]);

    const dataIncome = useMemo(() => financialData.map(d => ({ name: d.name, val: d.income })), [financialData]);
    const dataExpense = useMemo(() => financialData.map(d => ({ name: d.name, val: d.expense })), [financialData]);
    const dataBalance = useMemo(() => {
        let running = 0;
        return financialData.map(d => {
            running += d.balance;
            return { name: d.name, val: running };
        });
    }, [financialData]);

    const getIcon = (category: string) => {
        switch (category.toLowerCase()) {
            case 'food': return Coffee;
            case 'transport': return Zap;
            case 'shopping': return ShoppingBag;
            case 'entertainment': return Music;
            case 'bills': return Home;
            case 'education': return GraduationCap;
            case 'others': return MoreHorizontal;
            case 'transfer': return DollarSign;
            default: return DollarSign;
        }
    };

    return (
        <div className="flex flex-col space-y-6">
            <div className="flex items-center justify-between space-y-2 mb-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Cashflow</h2>
                    <p className="text-muted-foreground">Monitor financial health and subscriptions.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button onClick={() => setCurrency(currency === 'IDR' ? 'USD' : 'IDR')} variant="outline">
                        {currency} Mode
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="tracker" className="space-y-4">
                <TabsList className="w-fit">
                    <TabsTrigger value="tracker">Tracker</TabsTrigger>
                    <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
                </TabsList>

                <TabsContent value="tracker" className="space-y-4">
                    {/* KPI Cards */}
                    <Card className="flex flex-col shadow-sm">
                        {/* Top: KPI Row with Separators */}
                        <div className="flex flex-col lg:flex-row p-6 lg:space-x-4 space-y-4 lg:space-y-0 text-clip">
                            {/* Total Balance */}
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between text-sm font-medium">
                                        Total Balance
                                        <Wallet className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">{formatMoney(totalBalance)}</div>
                                        <div className="h-[40px] mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={dataBalance}>
                                                    <defs>
                                                        <linearGradient id="colorBalanceSmall" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <Area type="monotone" dataKey="val" stroke="#10b981" fill="url(#colorBalanceSmall)" strokeWidth={2} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator orientation="vertical" className="hidden lg:block h-auto w-[1px]" />

                            {/* Monthly Income */}
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between text-sm font-medium">
                                        Monthly Income
                                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-emerald-500">{formatMoney(monthlyIncome)}</div>
                                        <div className="h-[40px] mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={dataIncome}>
                                                    <defs>
                                                        <linearGradient id="colorIncomeSmall" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <Area type="monotone" dataKey="val" stroke="#10b981" fill="url(#colorIncomeSmall)" strokeWidth={2} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator orientation="vertical" className="hidden lg:block h-auto w-[1px]" />

                            {/* Monthly Expense */}
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between text-sm font-medium">
                                        Monthly Expense
                                        <ArrowDownRight className="h-4 w-4 text-rose-500" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-rose-500">{formatMoney(monthlyExpense)}</div>
                                        <div className="h-[40px] mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={dataExpense}>
                                                    <defs>
                                                        <linearGradient id="colorExpenseSmall" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <Area type="monotone" dataKey="val" stroke="#f43f5e" fill="url(#colorExpenseSmall)" strokeWidth={2} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator orientation="vertical" className="hidden lg:block h-auto w-[1px]" />

                            {/* Net Savings */}
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between text-sm font-medium">
                                        Net Savings
                                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <div className={cn("text-2xl font-bold", monthlyIncome - monthlyExpense >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                            {formatMoney(monthlyIncome - monthlyExpense)}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {monthlyIncome - monthlyExpense >= 0 ? "You're saving money!" : "Spending more than income."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Bottom: Use flex-col for layout structure, children are standard divs imitating Card header/content */}
                        <div className="flex flex-col lg:flex-row">
                            {/* Left: Overview */}
                            <div className="flex-[4] flex flex-col min-w-0">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>Overview</CardTitle>
                                        <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                                            <SelectTrigger className="w-[120px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Weekly">Weekly</SelectItem>
                                                <SelectItem value="Monthly">Monthly</SelectItem>
                                                <SelectItem value="Yearly">Yearly</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardHeader>
                                <CardContent className="pl-2 pb-6">
                                    <div className="h-[350px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={dataBalance}>
                                                <defs>
                                                    <linearGradient id="colorOverview" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <XAxis
                                                    dataKey="name"
                                                    stroke="#888888"
                                                    fontSize={12}
                                                    tickLine={false}
                                                    axisLine={false}
                                                />
                                                <YAxis
                                                    stroke="#888888"
                                                    fontSize={12}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tickFormatter={(value) => `${value / 1000}k`}
                                                />
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                                                    itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                                    formatter={(value: number) => [formatMoney(value), 'Balance']}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="val"
                                                    stroke="hsl(var(--primary))"
                                                    strokeWidth={2}
                                                    fillOpacity={1}
                                                    fill="url(#colorOverview)"
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </div>

                            <Separator orientation="vertical" className="hidden lg:block h-auto w-[1px]" />

                            {/* Right: Recent Transactions */}
                            <div className="flex-[3] flex flex-col min-w-0">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle>Recent Transactions</CardTitle>
                                    <Button size="sm" onClick={() => setIsModalOpen(true)}>
                                        <Plus className="mr-2 h-4 w-4" /> Add
                                    </Button>
                                </CardHeader>
                                <CardContent className="pr-2 flex flex-col flex-1 h-[400px]">
                                    <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                                        {sortedTransactions.length === 0 ? (
                                            <p className="text-sm text-center text-muted-foreground py-10">No transactions recorded.</p>
                                        ) : (
                                            sortedTransactions.map((tx) => {
                                                const Icon = getIcon(tx.category);
                                                const isIncome = tx.type === 'income';
                                                return (
                                                    <div key={tx.id} className="flex items-center justify-between">
                                                        <div className="flex items-center space-x-4">
                                                            <div className={cn("p-2 rounded-full bg-muted", isIncome ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10")}>
                                                                <Icon className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium leading-none">{tx.title}</p>
                                                                <p className="text-xs text-muted-foreground">{tx.category} • {format(new Date(tx.date), 'MMM d')}</p>
                                                            </div>
                                                        </div>
                                                        <div className={cn("font-medium text-sm", isIncome ? "text-emerald-500" : "")}>
                                                            {isIncome ? "+" : "-"}{formatMoney(Math.abs(tx.amount))}
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>

                                    <div className="mt-4 pt-4 border-t">
                                        <Button variant="outline" className="w-full" onClick={(e) => {
                                            e.preventDefault();
                                            // @ts-ignore
                                            if (window.electronAPI) window.electronAPI.openWindow('/history', 900, 600);
                                        }}>
                                            View Full History
                                        </Button>
                                    </div>
                                </CardContent>
                            </div>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="subscriptions">
                    <SubscriptionsTab formatMoney={formatMoney} />
                </TabsContent>
            </Tabs>

            <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
};

export default Cashflow;
