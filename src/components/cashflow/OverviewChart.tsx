"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { format } from "date-fns"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart"
import { useStore } from "@/store/useStore"

export const description = "An interactive bar chart"

const chartConfig = {
    balance: {
        label: "Total Balance",
        color: "#10b981", // Emerald 500
    },
} satisfies ChartConfig

interface OverviewChartProps {
    data: any[];
    period: 'Weekly' | 'Monthly' | 'Yearly';
    headerAction?: React.ReactNode;
}

export function OverviewChart({ data, period, headerAction }: OverviewChartProps) {
    // Default to showing Balance or Income? The user wants "Overview".
    // The interactive chart usually toggles. If I remove buttons, I should pick one main metric.
    // But wait, the user said "change the buttons to 'Highest'". 
    // Maybe they still want to SEE the bars for both? 
    // No, shadcn interactive is single-bar view toggled.
    // Mapping data keys to chart structure
    const chartData = React.useMemo(() => {
        return data.map(d => ({
            date: d.name,
            balance: d.balance
        }));
    }, [data]);

    const activeChart = "balance";

    // Calculate Highest Balance
    const highest = React.useMemo(() => {
        if (chartData.length === 0) return { month: "-", value: 0 };
        const maxItem = chartData.reduce((prev, current) => {
            return (prev.balance > current.balance) ? prev : current
        });
        return { month: maxItem.date, value: maxItem.balance };
    }, [chartData]);

    const { currency } = useStore();
    const formatMoney = (val: number) => {
        return new Intl.NumberFormat(currency === 'IDR' ? 'id-ID' : 'en-US', {
            style: 'currency', currency: currency, maximumFractionDigits: 0
        }).format(val);
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-col items-stretch border-b !p-0 sm:flex-row">
                <div className="flex flex-1 items-center justify-between px-6 pt-4 pb-3 sm:!py-0">
                    <div className="flex flex-col gap-1">
                        <CardTitle>Cashflow Overview</CardTitle>
                        <CardDescription>
                            Total balance trend ({period.toLowerCase()})
                        </CardDescription>
                    </div>
                    {headerAction && <div className="ml-4">{headerAction}</div>}
                </div>
                <div className="flex">
                    <div className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6 min-w-[160px]">
                        <span className="text-muted-foreground text-xs font-bold">
                            Tertinggi : {highest.month}
                        </span>
                        <span className="text-lg leading-none font-bold sm:text-2xl text-emerald-500">
                            {formatMoney(highest.value)}
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-2 sm:p-6 flex-1">
                <ChartContainer
                    config={chartConfig}
                    className="aspect-auto h-full w-full min-h-[250px]"
                >
                    <BarChart
                        accessibilityLayer
                        data={chartData}
                        margin={{
                            left: 12,
                            right: 12,
                        }}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            interval={0}
                        />
                        <ChartTooltip
                            content={
                                <ChartTooltipContent
                                    className="w-[150px]"
                                    nameKey="balance"
                                    labelFormatter={(value) => value}
                                />
                            }
                        />
                        <Bar dataKey="balance" fill={chartConfig.balance.color} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
