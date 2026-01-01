"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { useStore } from "@/store/useStore"
import { useMemo } from "react"
import { format, isSameMonth, eachDayOfInterval } from "date-fns"

export function CashflowChart() {
    const { transactions, currency } = useStore()
    const RATE = 16000

    const formatMoney = (amountIDR: number) => {
        if (currency === 'IDR') {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amountIDR)
        } else {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountIDR / RATE)
        }
    }

    const chartData = useMemo(() => {
        const currentYear = new Date().getFullYear()
        const start = new Date(currentYear, 0, 1) // Jan 1
        const end = new Date(currentYear, 11, 31) // Dec 31

        // Get start of each month
        const months = eachDayOfInterval({ start, end }).filter(d => d.getDate() === 1)

        let runningBalance = 0
        return months.map(monthStart => {
            const monthName = format(monthStart, 'MMM')
            const monthTx = transactions.filter(t => isSameMonth(new Date(t.date), monthStart))

            const inc = monthTx.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0)
            const exp = monthTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0)

            runningBalance += (inc - exp)

            return {
                name: monthName,
                val: runningBalance
            }
        })
    }, [transactions])

    return (
        <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
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
                        contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            borderColor: 'hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--popover-foreground))'
                        }}
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
    )
}
