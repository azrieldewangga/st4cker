import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStoreNew';
import { useUIPreferencesStore } from '../store/useUIPreferencesStore';
import {
    PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Sector,
    LineChart, Line, AreaChart, Area, CartesianGrid, Tooltip, TooltipProps
} from 'recharts';
import { 
    Wallet, TrendingUp, TrendingDown, DollarSign, MoreHorizontal, Plus, Download, 
    CreditCard, ArrowUpRight, ArrowDownRight, ListTodo, CheckCircle2, Calendar,
    ShoppingBag, Music, Coffee, Zap, Home, GraduationCap, Smartphone, Utensils, Car, FileText,
    ChartLine, Filter, Settings2, Share2, Maximize2, RefreshCw, ChevronRight as ChevronRightIcon,
    BarChart2, BarChart3, LineChartIcon, TrendingUpIcon, Grid3X3, Check,
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, AlertCircle
} from 'lucide-react';
import { format, isSameMonth, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isAfter, isSameDay, subDays, isWithinInterval } from 'date-fns';
import { cn } from "@/lib/utils";
import { exportToCSV } from '../utils/export';
import { toast } from "sonner";

// Shadcn Components
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { DatePicker } from "@/components/ui/date-picker";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import TransactionModal from '../components/cashflow/TransactionModal';

// ==================== STATS CARDS ====================
function StatsCards() {
    const transactions = useStore((state) => state.transactions);
    const currency = useStore((state) => state.currency);
    const exchangeRate = useStore((state) => state.exchangeRate);
    const currentMonthDate = new Date();
    const lastMonthDate = subMonths(currentMonthDate, 1);

    const formatMoney = (amountIDR: number) => {
        if (currency === 'IDR') {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amountIDR);
        } else {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountIDR / exchangeRate);
        }
    };

    // Total Balance
    const totalBalance = useMemo(() => {
        return transactions.reduce((acc, tx) => {
            const amount = Number(tx.amount);
            if (amount < 0) return acc + amount;
            return acc + (tx.type === 'income' ? amount : -amount);
        }, 0);
    }, [transactions]);

    // Monthly calculations
    const { monthlyIncome, monthlyExpense, lastMonthIncome, lastMonthExpense } = useMemo(() => {
        return transactions.reduce((acc, tx) => {
            const amount = Number(tx.amount);
            const txDate = new Date(tx.date);
            
            if (isSameMonth(txDate, currentMonthDate)) {
                if (amount < 0) acc.monthlyExpense += Math.abs(amount);
                else if (tx.type === 'income') acc.monthlyIncome += amount;
                else acc.monthlyExpense += amount;
            }
            
            if (isSameMonth(txDate, lastMonthDate)) {
                if (amount < 0) acc.lastMonthExpense += Math.abs(amount);
                else if (tx.type === 'income') acc.lastMonthIncome += amount;
                else acc.lastMonthExpense += amount;
            }
            
            return acc;
        }, { monthlyIncome: 0, monthlyExpense: 0, lastMonthIncome: 0, lastMonthExpense: 0 });
    }, [transactions]);

    const expenseTrend = lastMonthExpense > 0 ? ((monthlyExpense - lastMonthExpense) / lastMonthExpense) * 100 : 0;
    const incomeTrend = lastMonthIncome > 0 ? ((monthlyIncome - lastMonthIncome) / lastMonthIncome) * 100 : 0;
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0;

    const statsData = [
        {
            title: "Account Balance",
            value: formatMoney(totalBalance),
            change: incomeTrend >= 0 ? "+" : "",
            changeValue: `${incomeTrend.toFixed(0)}%`,
            subText: "vs last month",
            isPositive: incomeTrend >= 0,
            icon: Wallet,
            showProgress: false,
        },
        {
            title: "Monthly Income",
            value: formatMoney(monthlyIncome),
            change: incomeTrend >= 0 ? "+" : "",
            changeValue: `${Math.abs(incomeTrend).toFixed(0)}%`,
            subText: "vs last month",
            isPositive: incomeTrend >= 0,
            icon: TrendingUp,
            showProgress: false,
        },
        {
            title: "Monthly Expense",
            value: formatMoney(monthlyExpense),
            change: expenseTrend <= 0 ? "" : "+",
            changeValue: `${Math.abs(expenseTrend).toFixed(0)}%`,
            subText: "vs last month",
            isPositive: expenseTrend <= 0,
            icon: TrendingDown,
            showProgress: false,
        },
        {
            title: "Savings Rate",
            value: `${Math.round(savingsRate)}%`,
            change: savingsRate >= 20 ? "Good" : "Low",
            changeValue: "",
            subText: savingsRate >= 20 ? "Keep it up!" : "Try to save more",
            isPositive: savingsRate >= 20,
            icon: CheckCircle2,
            showProgress: true,
            progressValue: Math.max(0, Math.min(100, savingsRate)),
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 rounded-xl border bg-card p-4 sm:p-5">
            {statsData.map((stat, index) => (
                <div key={stat.title} className="flex items-start">
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <stat.icon className="size-4" />
                            <span className="text-xs font-medium truncate">
                                {stat.title}
                            </span>
                        </div>
                        <p className="text-2xl font-semibold leading-tight tracking-tight">
                            {stat.value}
                        </p>
                        {stat.showProgress && (
                            <div className="w-full">
                                <Progress value={stat.progressValue} className="h-1.5" />
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 text-xs">
                            <span className={stat.isPositive ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                                {stat.change}{stat.changeValue}
                            </span>
                            <span className="text-muted-foreground">{stat.subText}</span>
                        </div>
                    </div>
                    {index < statsData.length - 1 && (
                        <div className="hidden lg:block w-px h-full bg-border mx-4" />
                    )}
                </div>
            ))}
        </div>
    );
}

// ==================== SPENDING HABIT CHART ====================
const timeRangeLabels = {
    "7days": "Last 7 days",
    "30days": "Last 30 days",
    "90days": "Last 90 days",
};

function SpendingHabitChart() {
    const [timeRange, setTimeRange] = useState<"7days" | "30days" | "90days">("30days");
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const transactions = useStore((state) => state.transactions);
    const currency = useStore((state) => state.currency);

    const spendingData = useMemo(() => {
        const now = new Date();
        const daysBack = timeRange === "7days" ? 7 : timeRange === "30days" ? 30 : 90;
        const startDate = subDays(now, daysBack);

        const expenses = transactions.filter((t) => {
            const d = new Date(t.date);
            return (
                t.type === "expense" &&
                (isAfter(d, startDate) || isSameDay(d, startDate))
            );
        });

        const categoryMap: Record<string, number> = {};
        const allowedCategories = ["Food", "Transport", "Shopping", "Bills", "Subscription", "Others"];
        allowedCategories.forEach((c) => (categoryMap[c] = 0));

        expenses.forEach((t) => {
            let cat = t.category || "Others";
            if (cat === "Education") cat = "Subscription";
            if (allowedCategories.includes(cat)) {
                categoryMap[cat] += Math.abs(Number(t.amount));
            }
        });

        const colors: Record<string, string> = {
            Food: "#35b9e9",
            Transport: "#6e3ff3",
            Shopping: "#375dfb",
            Bills: "#e255f2",
            Subscription: "#10b981",
            Others: "#94a3b8",
        };

        return allowedCategories
            .map((cat) => ({ name: cat, value: categoryMap[cat], color: colors[cat] }))
            .filter((d) => d.value > 0);
    }, [transactions, timeRange]);

    const totalSpending = spendingData.reduce((acc, item) => acc + item.value, 0);

    const formatMoney = (val: number) => {
        return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
        }).format(val);
    };

    const formatShort = (val: number) => {
        if (currency === "IDR") {
            if (val >= 1000000) {
                return `${(val / 1000000).toFixed(2)} JT`;
            }
            if (val >= 1000) {
                return `${(val / 1000).toFixed(0)} Rb`;
            }
        } else {
            if (val >= 1000000) {
                return `${(val / 1000000).toFixed(2)}M`;
            }
            if (val >= 1000) {
                return `${(val / 1000).toFixed(1)}K`;
            }
        }
        return val.toString();
    };

    const onPieEnter = (_: unknown, index: number) => setActiveIndex(index);
    const onPieLeave = () => setActiveIndex(null);

    const renderActiveShape = (props: unknown) => {
        const typedProps = props as {
            cx: number;
            cy: number;
            innerRadius: number;
            outerRadius: number;
            startAngle: number;
            endAngle: number;
            fill: string;
        };
        return (
            <g>
                <Sector
                    cx={typedProps.cx}
                    cy={typedProps.cy}
                    innerRadius={typedProps.innerRadius}
                    outerRadius={typedProps.outerRadius + 8}
                    startAngle={typedProps.startAngle}
                    endAngle={typedProps.endAngle}
                    fill={typedProps.fill}
                />
            </g>
        );
    };

    return (
        <div className="flex flex-col gap-4 p-4 sm:p-6 rounded-xl border bg-card w-full xl:w-[340px]">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-2.5">
                    <Button variant="outline" size="icon" className="size-7 sm:size-8">
                        <ChartLine className="size-4 sm:size-[18px] text-muted-foreground" />
                    </Button>
                    <span className="text-sm sm:text-base font-medium">Spending Habit</span>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7 sm:size-8">
                            <MoreHorizontal className="size-4 text-muted-foreground" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[180px]">
                        <DropdownMenuLabel>Time Range</DropdownMenuLabel>
                        {(Object.keys(timeRangeLabels) as Array<keyof typeof timeRangeLabels>).map((range) => (
                            <DropdownMenuCheckboxItem
                                key={range}
                                checked={timeRange === range}
                                onCheckedChange={() => setTimeRange(range)}
                            >
                                {timeRangeLabels[range]}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Vertical Layout: Donut center, Labels below */}
            <div className="flex flex-col items-center gap-4">
                {/* Donut Chart */}
                <div className="relative shrink-0 size-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={spendingData}
                                cx="50%"
                                cy="50%"
                                innerRadius="42%"
                                outerRadius="70%"
                                paddingAngle={2}
                                dataKey="value"
                                strokeWidth={0}
                                activeIndex={activeIndex !== null ? activeIndex : undefined}
                                activeShape={renderActiveShape}
                                onMouseEnter={onPieEnter}
                                onMouseLeave={onPieLeave}
                            >
                                {spendingData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-semibold">{formatShort(totalSpending)}</span>
                        <span className="text-[10px] text-muted-foreground">Total</span>
                    </div>
                </div>

                {/* 2 Column Labels Grid */}
                <div className="w-full max-w-[280px] grid grid-cols-2 gap-x-6 gap-y-2 justify-items-start">
                    {spendingData.map((item, index) => (
                        <div
                            key={item.name}
                            className={`flex items-center gap-2 cursor-pointer transition-opacity ${activeIndex !== null && activeIndex !== index ? "opacity-50" : ""
                                }`}
                            onMouseEnter={() => setActiveIndex(index)}
                            onMouseLeave={() => setActiveIndex(null)}
                        >
                            <div
                                className="w-1 h-4 rounded-sm shrink-0"
                                style={{ backgroundColor: item.color }}
                            />
                            <div className="flex flex-col min-w-0">
                                <span className="text-[10px] text-muted-foreground leading-none truncate">{item.name}</span>
                                <span className="text-xs font-semibold tabular-nums leading-tight">{formatMoney(item.value)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Settings2 className="size-3" />
                <span>{timeRangeLabels[timeRange]}</span>
            </div>
        </div>
    );
}

// ==================== CASHFLOW CHART ====================
const periodLabels = {
    "3months": "Last 3 Months",
    "6months": "Last 6 Months",
    year: "Full Year",
};

type ChartType = "bar" | "line" | "area";
type TimePeriod = "3months" | "6months" | "year";

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
    if (!active || !payload?.length) return null;

    const income = payload.find((p) => p.dataKey === "income")?.value || 0;
    const expense = payload.find((p) => p.dataKey === "expense")?.value || 0;
    const diff = Number(income) - Number(expense);

    return (
        <div className="bg-popover border border-border rounded-lg p-2 sm:p-3 shadow-lg">
            <p className="text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">{label}</p>
            <div className="space-y-1 sm:space-y-1.5">
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="size-2 sm:size-2.5 rounded-full" style={{ background: "#6e3ff3" }} />
                    <span className="text-[10px] sm:text-sm text-muted-foreground">Income:</span>
                    <span className="text-[10px] sm:text-sm font-medium text-foreground">
                        Rp {Number(income).toLocaleString()}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="size-2 sm:size-2.5 rounded-full" style={{ background: "#e255f2" }} />
                    <span className="text-[10px] sm:text-sm text-muted-foreground">Expense:</span>
                    <span className="text-[10px] sm:text-sm font-medium text-foreground">
                        Rp {Number(expense).toLocaleString()}
                    </span>
                </div>
                <div className="pt-1 border-t border-border mt-1">
                    <span className={`text-[10px] sm:text-xs font-medium ${diff >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {diff >= 0 ? "+" : ""}{diff.toLocaleString()} net
                    </span>
                </div>
            </div>
        </div>
    );
}

function getDataForPeriod(data: { month: string; income: number; expense: number }[], period: TimePeriod) {
    switch (period) {
        case "3months":
            return data.slice(-3);
        case "6months":
            return data.slice(-6);
        case "year":
        default:
            return data;
    }
}

function CashflowChart() {
    const [currentInsight, setCurrentInsight] = useState(0);

    const transactions = useStore((state) => state.transactions);
    const currency = useStore((state) => state.currency);
    
    // Use persisted state from separate UI preferences store (separate from Dashboard)
    const { 
        cashflowChartType: chartType, 
        cashflowPeriod: period, 
        cashflowShowGrid: showGrid, 
        cashflowShowIncome: showIncome, 
        cashflowShowExpense: showExpense, 
        cashflowSmoothCurve: smoothCurve,
        setCashflowChartType: setChartType,
        setCashflowPeriod: setPeriod,
        setCashflowShowGrid: setShowGrid,
        setCashflowShowIncome: setShowIncome,
        setCashflowShowExpense: setShowExpense,
        setCashflowSmoothCurve: setSmoothCurve
    } = useUIPreferencesStore();

    // Generate monthly data from transactions
    const fullYearData = useMemo(() => {
        const now = new Date();
        const months: { month: string; income: number; expense: number }[] = [];

        for (let i = 11; i >= 0; i--) {
            const monthStart = startOfMonth(subMonths(now, i));
            const monthEnd = endOfMonth(subMonths(now, i));
            const monthName = format(monthStart, "MMM");

            const monthTx = transactions.filter((t) => {
                const d = new Date(t.date);
                return isWithinInterval(d, { start: monthStart, end: monthEnd });
            });

            const income = monthTx
                .filter((t) => t.type === "income")
                .reduce((sum, t) => sum + Number(t.amount), 0);
            const expense = monthTx
                .filter((t) => t.type === "expense")
                .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

            months.push({ month: monthName, income, expense });
        }

        return months;
    }, [transactions]);

    const chartData = getDataForPeriod(fullYearData, period);

    const totalIncome = chartData.reduce((acc, item) => acc + item.income, 0);
    const totalExpense = chartData.reduce((acc, item) => acc + item.expense, 0);

    // Helper function to format money - must be defined before useMemo
    const formatMoney = (val: number) => {
        return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
        }).format(val);
    };

    // Generate insights based on data
    const insights = useMemo(() => {
        const ins: string[] = [];
        if (chartData.length === 0) return ["No data available for the selected period"];

        const maxIncome = chartData.reduce((max, item) => item.income > max.income ? item : max, chartData[0]);
        ins.push(`${maxIncome.month} has the highest income of ${formatMoney(maxIncome.income)}`);

        const maxExpense = chartData.reduce((max, item) => item.expense > max.expense ? item : max, chartData[0]);
        ins.push(`${maxExpense.month} has the highest spending of ${formatMoney(maxExpense.expense)}`);

        const avgIncome = totalIncome / chartData.length;
        ins.push(`Average monthly income is ${formatMoney(avgIncome)}`);

        const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : "0";
        ins.push(`Savings rate is ${savingsRate}% for the selected period`);

        return ins;
    }, [chartData, totalIncome, totalExpense, formatMoney]);

    return (
        <div className="flex-1 flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 rounded-xl border bg-card min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-2.5 flex-1">
                    <Button variant="outline" size="icon" className="size-7 sm:size-8">
                        <BarChart2 className="size-4 sm:size-[18px] text-muted-foreground" />
                    </Button>
                    <span className="text-sm sm:text-base font-medium">Cashflow</span>
                </div>
                <div className="hidden sm:flex items-center gap-3 sm:gap-5">
                    <div className="flex items-center gap-1.5">
                        <div className="size-2.5 sm:size-3 rounded-full" style={{ background: "#6e3ff3" }} />
                        <span className="text-[10px] sm:text-xs text-muted-foreground">Income</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="size-2.5 sm:size-3 rounded-full" style={{ background: "#e255f2" }} />
                        <span className="text-[10px] sm:text-xs text-muted-foreground">Expense</span>
                    </div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7 sm:size-8">
                            <MoreHorizontal className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Chart Options</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <BarChart3 className="size-4 mr-2" />
                                Chart Type
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={() => setChartType("bar")}>
                                    <BarChart3 className="size-4 mr-2" />
                                    Bar Chart
                                    {chartType === "bar" && <Check className="size-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setChartType("line")}>
                                    <LineChartIcon className="size-4 mr-2" />
                                    Line Chart
                                    {chartType === "line" && <Check className="size-4 ml-auto" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setChartType("area")}>
                                    <TrendingUp className="size-4 mr-2" />
                                    Area Chart
                                    {chartType === "area" && <Check className="size-4 ml-auto" />}
                                </DropdownMenuItem>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Calendar className="size-4 mr-2" />
                                Time Period
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                {(Object.keys(periodLabels) as TimePeriod[]).map((key) => (
                                    <DropdownMenuItem key={key} onClick={() => setPeriod(key)}>
                                        {periodLabels[key]}
                                        {period === key && <Check className="size-4 ml-auto" />}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem checked={showGrid} onCheckedChange={setShowGrid}>
                            <Grid3X3 className="size-4 mr-2" />
                            Show Grid Lines
                        </DropdownMenuCheckboxItem>
                        {(chartType === "line" || chartType === "area") && (
                            <DropdownMenuCheckboxItem checked={smoothCurve} onCheckedChange={setSmoothCurve}>
                                <TrendingUp className="size-4 mr-2" />
                                Smooth Curve
                            </DropdownMenuCheckboxItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs">Data Series</DropdownMenuLabel>
                        <DropdownMenuCheckboxItem checked={showIncome} onCheckedChange={setShowIncome}>
                            <div className="size-3 rounded-full mr-2" style={{ background: "#6e3ff3" }} />
                            Show Income
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={showExpense} onCheckedChange={setShowExpense}>
                            <div className="size-3 rounded-full mr-2" style={{ background: "#e255f2" }} />
                            Show Expense
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => {
                                setChartType("bar");
                                setPeriod("6months");
                                setShowGrid(true);
                                setShowIncome(true);
                                setShowExpense(true);
                                setSmoothCurve(true);
                            }}
                        >
                            <RefreshCw className="size-4 mr-2" />
                            Reset to Default
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-10 flex-1 min-h-0">
                <div className="flex flex-col gap-4 w-full lg:w-[200px] xl:w-[220px] shrink-0">
                    <div className="space-y-2 sm:space-y-4">
                        <p className="text-xl sm:text-2xl lg:text-[28px] font-semibold leading-tight tracking-tight">
                            {formatMoney(totalIncome)}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground">Total Income ({periodLabels[period]})</p>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
                        <p className="text-xs sm:text-sm font-semibold">🏆 Best Performing Month</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                            {insights[currentInsight]}
                        </p>
                        <div className="flex items-center gap-2.5 sm:gap-3.5">
                            <ChevronLeft
                                className="size-3 sm:size-3.5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                                onClick={() =>
                                    setCurrentInsight((prev) =>
                                        prev === 0 ? insights.length - 1 : prev - 1
                                    )
                                }
                            />
                            <div className="flex-1 flex items-center gap-1">
                                {insights.map((_, index) => (
                                    <div
                                        key={index}
                                        className={`flex-1 h-0.5 rounded-full transition-colors ${index === currentInsight
                                            ? "bg-foreground"
                                            : "bg-muted-foreground/30"
                                            }`}
                                    />
                                ))}
                            </div>
                            <ChevronRight
                                className="size-3 sm:size-3.5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                                onClick={() =>
                                    setCurrentInsight((prev) =>
                                        prev === insights.length - 1 ? 0 : prev + 1
                                    )
                                }
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 aspect-[16/9] min-w-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        {chartType === "bar" ? (
                            <BarChart data={chartData} barGap={2}>
                                <defs>
                                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6e3ff3" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#6e3ff3" stopOpacity={0.6} />
                                    </linearGradient>
                                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#e255f2" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#e255f2" stopOpacity={0.6} />
                                    </linearGradient>
                                </defs>
                                {showGrid && <CartesianGrid strokeDasharray="0" stroke="#e4e4e7" vertical={false} />}
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dx={-5} width={50} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f4f4f5", radius: 4 }} />
                                {showIncome && <Bar dataKey="income" fill="url(#incomeGradient)" radius={[4, 4, 0, 0]} maxBarSize={28} />}
                                {showExpense && <Bar dataKey="expense" fill="url(#expenseGradient)" radius={[4, 4, 0, 0]} maxBarSize={28} />}
                            </BarChart>
                        ) : chartType === "line" ? (
                            <LineChart data={chartData}>
                                {showGrid && <CartesianGrid strokeDasharray="0" stroke="#e4e4e7" vertical={false} />}
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dx={-5} width={50} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#d4d4d8" }} />
                                {showIncome && (
                                    <Line
                                        type={smoothCurve ? "monotone" : "linear"}
                                        dataKey="income"
                                        stroke="#6e3ff3"
                                        strokeWidth={2}
                                        dot={{ fill: "#6e3ff3", strokeWidth: 0, r: 3 }}
                                        activeDot={{ r: 5, fill: "#6e3ff3" }}
                                    />
                                )}
                                {showExpense && (
                                    <Line
                                        type={smoothCurve ? "monotone" : "linear"}
                                        dataKey="expense"
                                        stroke="#e255f2"
                                        strokeWidth={2}
                                        dot={{ fill: "#e255f2", strokeWidth: 0, r: 3 }}
                                        activeDot={{ r: 5, fill: "#e255f2" }}
                                    />
                                )}
                            </LineChart>
                        ) : (
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="incomeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6e3ff3" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#6e3ff3" stopOpacity={0.05} />
                                    </linearGradient>
                                    <linearGradient id="expenseAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#e255f2" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#e255f2" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                {showGrid && <CartesianGrid strokeDasharray="0" stroke="#e4e4e7" vertical={false} />}
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 10 }} dx={-5} width={50} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#d4d4d8" }} />
                                {showIncome && (
                                    <Area type={smoothCurve ? "monotone" : "linear"} dataKey="income" stroke="#6e3ff3" strokeWidth={2} fill="url(#incomeAreaGradient)" />
                                )}
                                {showExpense && (
                                    <Area type={smoothCurve ? "monotone" : "linear"} dataKey="expense" stroke="#e255f2" strokeWidth={2} fill="url(#expenseAreaGradient)" />
                                )}
                            </AreaChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

// ==================== RECENT TRANSACTIONS TABLE ====================
function RecentTransactionsTable() {
    const transactions = useStore((state) => state.transactions);
    const currency = useStore((state) => state.currency);
    const exchangeRate = useStore((state) => state.exchangeRate);

    const formatMoney = (amountIDR: number) => {
        if (currency === 'IDR') {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amountIDR);
        } else {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountIDR / exchangeRate);
        }
    };

    const sortedTransactions = useMemo(() => {
        return [...transactions]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10);
    }, [transactions]);

    const getCategoryIcon = (category: string) => {
        switch (category.toLowerCase()) {
            case 'food': return Coffee;
            case 'transport': return Zap;
            case 'shopping': return ShoppingBag;
            case 'bills': return Home;
            case 'education': return GraduationCap;
            default: return DollarSign;
        }
    };

    return (
        <div className="rounded-xl border bg-card">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:px-6 sm:py-3.5">
                <div className="flex items-center gap-2 sm:gap-2.5 flex-1">
                    <Button variant="outline" size="icon" className="size-7 sm:size-8 shrink-0">
                        <ListTodo className="size-4 sm:size-[18px] text-muted-foreground" />
                    </Button>
                    <span className="text-sm sm:text-base font-medium">Recent Transactions</span>
                    <Badge variant="secondary" className="ml-1 text-[10px] sm:text-xs">
                        {sortedTransactions.length}
                    </Badge>
                </div>
                <div className="relative flex-1 sm:flex-none">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-4 sm:size-5 text-muted-foreground" />
                    <Input
                        placeholder="Search..."
                        className="pl-9 sm:pl-10 w-full sm:w-[160px] lg:w-[200px] h-8 sm:h-9 text-sm"
                    />
                </div>
            </div>

            <div className="px-3 sm:px-6 pb-3 sm:pb-4 overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="w-[40px] font-medium text-muted-foreground text-xs sm:text-sm">#</TableHead>
                            <TableHead className="min-w-[100px] font-medium text-muted-foreground text-xs sm:text-sm">Title</TableHead>
                            <TableHead className="min-w-[80px] font-medium text-muted-foreground text-xs sm:text-sm">Category</TableHead>
                            <TableHead className="min-w-[80px] font-medium text-muted-foreground text-xs sm:text-sm">Date</TableHead>
                            <TableHead className="min-w-[100px] font-medium text-muted-foreground text-xs sm:text-sm text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedTransactions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-sm">
                                    No transactions found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedTransactions.map((tx, index) => {
                                const Icon = getCategoryIcon(tx.category);
                                const isIncome = tx.type === 'income';
                                return (
                                    <TableRow key={tx.id}>
                                        <TableCell className="font-medium text-xs sm:text-sm">{index + 1}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center justify-center size-6 sm:size-7 rounded-md bg-muted text-[10px] font-bold shrink-0">
                                                    <Icon className="size-3 sm:size-4" />
                                                </div>
                                                <span className="font-medium text-xs sm:text-sm truncate">{tx.title}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs sm:text-sm">{tx.category}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs sm:text-sm">
                                            {format(new Date(tx.date), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell className={`text-right font-medium text-xs sm:text-sm ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {isIncome ? '+' : '-'}{formatMoney(Math.abs(Number(tx.amount)))}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

// ==================== MAIN COMPONENT ====================
const Cashflow = () => {
    const fetchTransactions = useStore(state => state.fetchTransactions);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchTransactions();
        const handleRefresh = () => fetchTransactions();
        // @ts-ignore
        const api = window.electronAPI;
        if (api && typeof api.onRefreshData === 'function') {
            api.onRefreshData(handleRefresh);
        }
        return () => {
            // @ts-ignore
            const api = window.electronAPI;
            if (api && typeof api.offRefreshData === 'function') {
                api.offRefreshData();
            }
        }
    }, [fetchTransactions]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const cmdKey = isMac ? e.metaKey : e.ctrlKey;
            if (cmdKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                setIsModalOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <ScrollArea className="h-[calc(100vh-3rem)]">
            <div className="flex flex-col space-y-6 p-6 pr-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">Cashflow</h2>
                        <p className="text-sm text-muted-foreground mt-1">Monitor financial health and transactions.</p>
                    </div>
                    <Button onClick={() => setIsModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Add Transaction
                    </Button>
                </div>

                {/* Stats Cards */}
                <StatsCards />

                {/* Charts Row */}
                <div className="flex flex-col xl:flex-row gap-4 sm:gap-6">
                    <SpendingHabitChart />
                    <CashflowChart />
                </div>

                {/* Recent Transactions Table */}
                <RecentTransactionsTable />

                {/* Subscriptions Section */}
                <SubscriptionsSection />
            </div>
            <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </ScrollArea>
    );
};

// ==================== SUBSCRIPTIONS SECTION ====================
function SubscriptionsSection() {
    const subscriptions = useStore(state => state.subscriptions);
    const addSubscription = useStore(state => state.addSubscription);
    const deleteSubscription = useStore(state => state.deleteSubscription);
    const currency = useStore((state) => state.currency);
    const exchangeRate = useStore((state) => state.exchangeRate);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newSub, setNewSub] = useState<{
        name: string;
        cost: string;
        date: Date;
    }>({
        name: '',
        cost: '',
        date: new Date()
    });
    const [deleteDialog, setDeleteDialog] = useState<{
        isOpen: boolean;
        subscription: any | null;
    }>({ isOpen: false, subscription: null });

    const formatMoney = (amountIDR: number) => {
        if (currency === 'IDR') {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amountIDR);
        } else {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountIDR / exchangeRate);
        }
    };

    const handleAdd = () => {
        if (!newSub.name || !newSub.cost || !newSub.date) return;
        addSubscription({
            name: newSub.name,
            cost: parseFloat(newSub.cost.replace(/,/g, '')),
            dueDay: newSub.date.getDate(),
        });
        setIsAddOpen(false);
        setNewSub({ name: '', cost: '', date: new Date() });
    };

    const handleDeleteClick = (e: React.MouseEvent, sub: any) => {
        e.stopPropagation();
        setDeleteDialog({ isOpen: true, subscription: sub });
    };

    const handleConfirmDelete = () => {
        const sub = deleteDialog.subscription;
        if (!sub) return;
        deleteSubscription(sub.id);
        setDeleteDialog({ isOpen: false, subscription: null });
    };

    const totalMonthly = useMemo(() => {
        return subscriptions.reduce((acc, sub) => acc + sub.cost, 0);
    }, [subscriptions]);

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Monthly Cost</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatMoney(totalMonthly)}</div>
                        <p className="text-xs text-muted-foreground">
                            Based on {subscriptions.length} active subscriptions
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Subscriptions Count</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{subscriptions.length}</div>
                        <p className="text-xs text-muted-foreground">Active recurring payments</p>
                    </CardContent>
                </Card>
            </div>

            {/* Subscriptions Table */}
            <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Subscriptions</CardTitle>
                        <p className="text-sm text-muted-foreground">Manage your recurring payments.</p>
                    </div>
                    <Button onClick={() => setIsAddOpen(true)} size="sm">
                        <Plus className="mr-2 h-4 w-4" /> Add Subscription
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-3 sm:px-6 pb-3 sm:pb-4 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="w-[40px] font-medium text-muted-foreground text-xs sm:text-sm">#</TableHead>
                                    <TableHead className="min-w-[150px] font-medium text-muted-foreground text-xs sm:text-sm">Name</TableHead>
                                    <TableHead className="min-w-[100px] font-medium text-muted-foreground text-xs sm:text-sm">Cost</TableHead>
                                    <TableHead className="min-w-[100px] font-medium text-muted-foreground text-xs sm:text-sm">Due Day</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {subscriptions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-sm">
                                            No subscriptions found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    subscriptions.map((sub, index) => (
                                        <TableRow key={sub.id}>
                                            <TableCell className="font-medium text-xs sm:text-sm">{index + 1}</TableCell>
                                            <TableCell className="font-medium text-xs sm:text-sm">{sub.name}</TableCell>
                                            <TableCell className="text-xs sm:text-sm">{formatMoney(sub.cost)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs">Day {sub.dueDay}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="size-7 sm:size-8" onClick={(e: React.MouseEvent) => handleDeleteClick(e, sub)}>
                                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Add Subscription Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Subscription</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label>Name</Label>
                            <Input placeholder="Netflix, Spotify..." value={newSub.name} onChange={e => setNewSub({ ...newSub, name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Amount</Label>
                                <NumberStepper
                                    value={newSub.cost}
                                    onChange={(val) => setNewSub({ ...newSub, cost: val })}
                                    placeholder="0"
                                    min={0}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Subscription Date</Label>
                                <DatePicker
                                    date={newSub.date}
                                    setDate={(date) => date && setNewSub({ ...newSub, date: date })}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleAdd}>Add Subscription</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialog.isOpen} onOpenChange={(open) => !open && setDeleteDialog({ isOpen: false, subscription: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Subscription?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <span className="font-semibold">{deleteDialog.subscription?.name}</span>? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default Cashflow;
