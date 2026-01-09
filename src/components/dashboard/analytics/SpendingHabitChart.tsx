import { useMemo } from 'react';
import { useStore } from "@/store/useStoreNew";
import { PolarAngleAxis, PolarRadiusAxis, PolarGrid, Radar, RadarChart } from "recharts";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";

export function SpendingHabitChart() {
    const transactions = useStore(state => state.transactions);

    // --- 2. Spending Habit (Radar Chart) ---
    const spendingData = useMemo(() => {
        const now = new Date();
        const currentMonthExpenses = transactions.filter(t => {
            const d = new Date(t.date);
            return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const categoryMap: Record<string, number> = {};
        const allowedCategories = ['Food', 'Transport', 'Shopping', 'Bills', 'Subscription', 'Transfer'];

        // Initialize allowed with 0 to show shape even if empty
        allowedCategories.forEach(c => categoryMap[c] = 0);

        currentMonthExpenses.forEach(t => {
            let cat = t.category || 'Others';
            // Map legacy 'Education' to 'Subscription' for the chart if needed, or if user meant simply rename the slice.
            if (cat === 'Education') cat = 'Subscription';

            // Map capital cases if needed or just exact match
            // Assuming categories are standard Title Case.
            if (allowedCategories.includes(cat)) {
                categoryMap[cat] += Math.abs(Number(t.amount));
            }
        });

        return allowedCategories.map(cat => ({
            category: cat,
            amount: categoryMap[cat]
        }));
    }, [transactions]);

    const spendingConfig = {
        amount: {
            label: "Amount",
            color: "var(--chart-1)",
        },
    } satisfies ChartConfig;

    return (
        <Card className="col-span-3 lg:col-span-3 flex flex-col">
            <CardHeader className="items-center pb-4">
                <CardTitle>Spending Habit</CardTitle>
                <CardDescription>
                    This Month's Breakdown (Top 6)
                </CardDescription>
            </CardHeader>
            <CardContent className="pb-0 flex-1 flex items-center justify-center">
                <ChartContainer
                    config={spendingConfig}
                    className="mx-auto aspect-square max-h-[250px] w-full"
                >
                    <RadarChart data={spendingData}>
                        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                        <PolarGrid />
                        <PolarAngleAxis dataKey="category" />
                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                        <Radar
                            dataKey="amount"
                            fill="hsl(var(--chart-1))"
                            fillOpacity={0.6}
                            stroke="hsl(var(--chart-1))"
                            strokeWidth={2}
                            dot={{
                                r: 4,
                                fillOpacity: 1,
                            }}
                        />
                    </RadarChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col gap-2 text-sm pt-4">
                <div className="flex items-center gap-2 leading-none font-medium">
                    Total tracked in major categories
                </div>
            </CardFooter>
        </Card>
    );
}
