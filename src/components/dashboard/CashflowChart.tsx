"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { useStore } from "@/store/useStoreNew"
import { format, subDays, isAfter, isSameDay, eachDayOfInterval } from "date-fns"
import { EXCHANGE_RATES } from "@/lib/constants"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export const description = "An interactive area chart"

const chartConfig = {
    income: {
        label: "Income",
        color: "#10b981", // Emerald-500
    },
    expense: {
        label: "Expense",
        color: "#ef4444", // Red-500
    },
} satisfies ChartConfig

export function CashflowChart() {
    const transactions = useStore(state => state.transactions);
    const currency = useStore(state => state.currency);
    const [timeRange, setTimeRange] = React.useState("90d")

    const chartData = React.useMemo(() => {
        // Generate data for LAST 90 DAYS to cover max range
        const end = new Date();
        const start = subDays(end, 90);
        const days = eachDayOfInterval({ start, end });

        return days.map(day => {
            const dayTx = transactions.filter(t => isSameDay(new Date(t.date), day));
            const income = dayTx.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
            // Handle negative expense values safely
            const expense = dayTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

            return {
                date: format(day, "yyyy-MM-dd"),
                income,
                expense
            };
        });
    }, [transactions]);

    const filteredData = chartData.filter((item) => {
        const date = new Date(item.date)
        const now = new Date()
        let daysToSubtract = 90
        if (timeRange === "30d") {
            daysToSubtract = 30
        } else if (timeRange === "7d") {
            daysToSubtract = 7
        }
        const startDate = subDays(now, daysToSubtract);
        return isAfter(date, startDate) || isSameDay(date, startDate);
    })

    // Calculate totals for description
    const totalIncome = React.useMemo(() => filteredData.reduce((acc, curr) => acc + curr.income, 0), [filteredData]);
    const totalExpense = React.useMemo(() => filteredData.reduce((acc, curr) => acc + curr.expense, 0), [filteredData]);

    const formatMoney = (val: number) => {
        return new Intl.NumberFormat(currency === 'IDR' ? 'id-ID' : 'en-US', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: 0
        }).format(currency === 'IDR' ? val : val / EXCHANGE_RATES.FALLBACK_IDR_TO_USD);
    }

    return (
        <Card className="h-full max-h-[500px] flex flex-col">
            <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
                <div className="grid flex-1 gap-1">
                    <CardTitle>Cashflow</CardTitle>
                    <CardDescription>
                        {timeRange === '90d' ? 'Last 3 months' : timeRange === '30d' ? 'Last 30 days' : 'Last 7 days'}
                        <span className="block text-xs font-normal text-muted-foreground mt-1">
                            Inc: <span className="text-emerald-500">{formatMoney(totalIncome)}</span> • Exp: <span className="text-red-500">{formatMoney(totalExpense)}</span>
                        </span>
                    </CardDescription>
                </div>
                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger
                        className="w-[160px] rounded-lg sm:ml-auto"
                        aria-label="Select a value"
                    >
                        <SelectValue placeholder="Last 3 months" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        <SelectItem value="90d" className="rounded-lg">
                            Last 3 months
                        </SelectItem>
                        <SelectItem value="30d" className="rounded-lg">
                            Last 30 days
                        </SelectItem>
                        <SelectItem value="7d" className="rounded-lg">
                            Last 7 days
                        </SelectItem>
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6 flex-1">
                <ChartContainer
                    config={chartConfig}
                    className="aspect-auto h-full w-full"
                >
                    <AreaChart data={filteredData}>
                        <defs>
                            <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="5%"
                                    stopColor="var(--color-income)"
                                    stopOpacity={0.8}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="var(--color-income)"
                                    stopOpacity={0.1}
                                />
                            </linearGradient>
                            <linearGradient id="fillExpense" x1="0" y1="0" x2="0" y2="1">
                                <stop
                                    offset="5%"
                                    stopColor="var(--color-expense)"
                                    stopOpacity={0.8}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="var(--color-expense)"
                                    stopOpacity={0.1}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={(value) => {
                                const date = new Date(value)
                                return date.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                })
                            }}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    className="min-w-[150px] bg-zinc-900 border-zinc-800 text-zinc-50 shadow-xl"
                                    labelFormatter={(value) => {
                                        return new Date(value).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                        })
                                    }}
                                    formatter={(value) => formatMoney(Number(value))}
                                    indicator="dot"
                                />
                            }
                        />
                        <Area
                            dataKey="expense"
                            type="monotone"
                            fill="url(#fillExpense)"
                            stroke="var(--color-expense)"
                            stackId="a"
                        />
                        <Area
                            dataKey="income"
                            type="monotone"
                            fill="url(#fillIncome)"
                            stroke="var(--color-income)"
                            stackId="a"
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
