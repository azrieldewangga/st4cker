import { useMemo } from 'react';
import { useStore } from "@/store/useStore";
import { TrendingUp } from "lucide-react";
import { CartesianGrid, Dot, Line, LineChart, PolarAngleAxis, PolarRadiusAxis, PolarGrid, Radar, RadarChart } from "recharts";
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
import {
    subDays,
    format,
    eachDayOfInterval,
    startOfWeek,
    endOfWeek,
    subWeeks,
    isSameMonth,
    getDay,
    addDays,
    isSameDay
} from 'date-fns';
import { cn } from "@/lib/utils";

export function AnalyticsTab() {
    const { userProfile, grades, getSemesterCourses, transactions, assignments, currency } = useStore();

    // --- 1. Academic Trend (Line Chart with Dots) ---
    const academicData = useMemo(() => {
        if (!userProfile) return [];
        const gradeValues: Record<string, number> = {
            'A': 4.00, 'A-': 3.75, 'AB': 3.50, 'B+': 3.25, 'B': 3.00, 'BC': 2.50, 'C': 2.00, 'D': 1.00, 'E': 0.00
        };
        const currentSem = userProfile.semester ? parseInt(userProfile.semester.toString()) : 1;
        const data = [];
        for (let i = 1; i <= currentSem; i++) {
            const courses = getSemesterCourses(i);
            let totalSks = 0;
            let totalPoints = 0;
            courses.forEach(course => {
                const grade = grades[course.id];
                if (grade && gradeValues[grade] !== undefined) {
                    const sks = course.sks || 0;
                    totalPoints += gradeValues[grade] * sks;
                    totalSks += sks;
                }
            });
            const ips = totalSks > 0 ? (totalPoints / totalSks) : 0;
            data.push({
                semester: `Sem ${i}`,
                ips: parseFloat(ips.toFixed(2)),
                fill: "var(--color-ips)"
            });
        }
        return data; // [{ semester: "Sem 1", ips: 3.5, fill: ... }]
    }, [userProfile, grades, getSemesterCourses]);

    const academicConfig = {
        ips: {
            label: "IPS",
            color: "var(--chart-1)",
        },
    } satisfies ChartConfig;

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


    // --- 3. Productivity Heatmap (GitHub Style) ---
    // Last ~6 months equivalent (26 weeks)
    // Fixed Semester Logic (Jan-Jun or Jul-Dec)
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const semesterStart = currentMonth < 6 ? new Date(currentYear, 0, 1) : new Date(currentYear, 6, 1);
    const semesterLabel = currentMonth < 6 ? "Jan - Jun" : "Jul - Dec";
    const totalWeeks = 26;
    // Align to start of week (Sunday)
    const startDate = startOfWeek(semesterStart, { weekStartsOn: 2 });

    const heatmapData = useMemo(() => {
        // Generate range based on totalWeeks
        // We use an arbitrary end date that covers the range
        const days = eachDayOfInterval({ start: startDate, end: new Date(startDate.getTime() + totalWeeks * 7 * 24 * 60 * 60 * 1000) });



        // Map completions
        const completionMap: Record<string, number> = {};
        assignments.forEach(a => {
            if (a.status === 'done' && a.updatedAt) {
                const dateKey = format(new Date(a.updatedAt), 'yyyy-MM-dd');
                completionMap[dateKey] = (completionMap[dateKey] || 0) + 1;
            }
        });

        // Group by weeks
        const weeks: { days: { date: Date; level: number; count: number }[] }[] = [];
        let currentWeek: { date: Date; level: number; count: number }[] = [];

        days.forEach((day, idx) => {
            const key = format(day, 'yyyy-MM-dd');
            const count = completionMap[key] || 0;
            // Level 0-4
            const level = count === 0 ? 0 : count <= 1 ? 1 : count <= 2 ? 2 : count <= 3 ? 3 : 4;

            currentWeek.push({ date: day, level, count });

            if (currentWeek.length === 7) {
                weeks.push({ days: currentWeek });
                currentWeek = [];
            }
        });

        // Push remaining if any (shouldn't be if using full weeks)
        if (currentWeek.length > 0) weeks.push({ days: currentWeek });

        return weeks;
    }, [assignments]);

    // Helper to generate month labels
    // We scan the weeks. If a week contains the 1st of a month (or first week of data for that month), we label it.
    const monthLabels = useMemo(() => {
        const labels: { text: string; index: number }[] = [];
        const isSecondSem = semesterLabel.startsWith('Jul');
        // Filter to ensure we don't show "Dec" of previous year in Jan-Jun semester
        const allowedMonths = isSecondSem ? [6, 7, 8, 9, 10, 11] : [0, 1, 2, 3, 4, 5];

        heatmapData.forEach((week, wIndex) => {
            const firstDay = week.days[0].date;
            const prevDate = wIndex > 0 ? heatmapData[wIndex - 1].days[0].date : null;

            if (wIndex === 0 || (prevDate && !isSameMonth(prevDate, firstDay))) {
                // Only add label if it's within the current semester's months
                if (allowedMonths.includes(firstDay.getMonth())) {
                    labels.push({ text: format(firstDay, 'MMM'), index: wIndex });
                }
            }
        });
        return labels;
    }, [heatmapData, semesterLabel]);


    const formatMoney = (val: number) => {
        return new Intl.NumberFormat(currency === 'IDR' ? 'id-ID' : 'en-US', {
            style: 'currency', currency: currency, minimumFractionDigits: 0
        }).format(val);
    };

    // Calculate percentage trend (mock or real) - For now just show "Latest"
    const lastIps = academicData.length > 0 ? academicData[academicData.length - 1].ips : 0;
    const prevIps = academicData.length > 1 ? academicData[academicData.length - 2].ips : 0;
    const ipsDiff = (lastIps - prevIps).toFixed(2);
    const ipsTrend = parseFloat(ipsDiff) >= 0 ? 'up' : 'down';

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* 1. Academic Trend */}
                <Card className="col-span-4 lg:col-span-4 flex flex-col">
                    <CardHeader>
                        <CardTitle>Academic Trend</CardTitle>
                        <CardDescription>IPS History (Semester 1 - Now)</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 pb-0">
                        <ChartContainer config={academicConfig} className="w-full h-[250px]">
                            <LineChart
                                accessibilityLayer
                                data={academicData}
                                margin={{
                                    top: 24,
                                    left: 24,
                                    right: 24,
                                    bottom: 24
                                }}
                            >
                                <defs>
                                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#60a5fa" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#2563eb" stopOpacity={1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} />
                                <ChartTooltip
                                    cursor={false}
                                    content={
                                        <ChartTooltipContent
                                            indicator="line"
                                            nameKey="ips"
                                            hideLabel
                                        />
                                    }
                                />
                                <Line
                                    dataKey="ips"
                                    type="natural"
                                    stroke="url(#lineGradient)"
                                    strokeWidth={2}
                                    dot={({ payload, ...props }) => {
                                        return (
                                            <Dot
                                                key={payload.semester}
                                                r={5}
                                                cx={props.cx}
                                                cy={props.cy}
                                                fill="#2563eb"
                                                stroke="#2563eb"
                                            />
                                        )
                                    }}
                                />
                            </LineChart>
                        </ChartContainer>
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-2 text-sm pt-4">
                        <div className="flex gap-2 leading-none font-medium">
                            {ipsTrend === 'up' ? 'Trending up' : 'Trending down'} by {Math.abs(parseFloat(ipsDiff))} points <TrendingUp className={`h-4 w-4 ${ipsTrend === 'up' ? '' : 'rotate-180'}`} />
                        </div>
                        <div className="text-muted-foreground leading-none">
                            Showing IPS for semesters 1-{academicData.length}
                        </div>
                    </CardFooter>
                </Card>

                {/* 2. Spending Habit */}
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
                                    fill="var(--color-amount)"
                                    fillOpacity={0.6}
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
            </div>

            {/* Row 2: Heatmap, Distribution, Insights */}
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-[43%_1fr_1fr]">
                {/* 3. Productivity Heatmap (3 cols) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Productivity Heatmap</CardTitle>
                        <CardDescription>Assignments ({semesterLabel} {currentYear})</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col w-full">
                            {/* Month Labels (Absolute) */}
                            <div className="relative h-5 w-full mb-2 pr-6">
                                {monthLabels.map((label, i) => (
                                    <div
                                        key={i}
                                        className="absolute top-0 text-xs text-muted-foreground"
                                        style={{
                                            // 32px (pl-8 equivalent) + index * 16px (pitch)
                                            left: `${32 + (label.index * 16)}px`
                                        }}
                                    >
                                        {label.text}
                                    </div>
                                ))}
                            </div>

                            <div className="flex">
                                {/* Day Labels (Mon, Wed, Fri) */}
                                <div className="flex flex-col gap-1 w-8 shrink-0 pr-2 text-[10px] text-muted-foreground pt-0 text-right">
                                    {/* 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun */}
                                    <div className="h-3 leading-3">Tue</div>
                                    <div className="h-3"></div>
                                    <div className="h-3 leading-3">Thu</div>
                                    <div className="h-3"></div>
                                    <div className="h-3 leading-3">Sat</div>
                                    <div className="h-3"></div>
                                    <div className="h-3"></div>
                                </div>

                                {/* The Grid */}
                                <div className="flex pr-6">
                                    {heatmapData.map((week, wIndex) => (
                                        <div
                                            key={wIndex}
                                            className={`flex flex-col gap-1 shrink-0 mr-1 ${week.days.every(d => {
                                                const m = d.date.getMonth();
                                                return semesterLabel.startsWith('Jul') ? m === 0 : m >= 6;
                                            }) ? 'hidden' : ''}`}
                                        >
                                            {week.days.map((day, dIndex) => {
                                                let bgClass = 'bg-muted/50';

                                                const month = day.date.getMonth();
                                                const isSecondSem = semesterLabel.startsWith('Jul');

                                                // Pre-Semester (Before start): Use invisible to preserve alignment
                                                // Jan-Jun: Pre is Dec (11). Jul-Dec: Pre is Jun (5).
                                                const isPre = isSecondSem ? (month < 6) : (month === 11);

                                                // Post-Semester (After end): Use hidden to truncate tail
                                                // Jan-Jun: Post is >= 6. Jul-Dec: Post is Jan (0).
                                                const isPost = isSecondSem ? (month === 0) : (month >= 6);

                                                if (isPost) {
                                                    return <div key={dIndex} className="hidden"></div>;
                                                }
                                                if (isPre) {
                                                    return <div key={dIndex} className="w-3 h-3 invisible"></div>;
                                                }

                                                if (day.level === 1) bgClass = 'bg-emerald-500/30';
                                                if (day.level === 2) bgClass = 'bg-emerald-500/50';
                                                if (day.level === 3) bgClass = 'bg-emerald-500/70';
                                                if (day.level === 4) bgClass = 'bg-emerald-500';

                                                return (
                                                    <div
                                                        key={dIndex}
                                                        className={`w-3 h-3 rounded-[2px] ${bgClass} shadow-sm dark:shadow-none`}
                                                        title={`${format(day.date, 'yyyy-MM-dd')}: ${day.count} tasks`}
                                                    ></div>
                                                )
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground pl-8">
                                <span>Less</span>
                                <div className="flex gap-1">
                                    <div className="w-3 h-3 rounded-[2px] bg-muted/50 shadow-sm dark:shadow-none"></div>
                                    <div className="w-3 h-3 rounded-[2px] bg-emerald-500/30 shadow-sm dark:shadow-none"></div>
                                    <div className="w-3 h-3 rounded-[2px] bg-emerald-500/50 shadow-sm dark:shadow-none"></div>
                                    <div className="w-3 h-3 rounded-[2px] bg-emerald-500/70 shadow-sm dark:shadow-none"></div>
                                    <div className="w-3 h-3 rounded-[2px] bg-emerald-500 shadow-sm dark:shadow-none"></div>
                                </div>
                                <span>More</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Task Distribution (New - 2 cols) */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle>Task Overview</CardTitle>
                        <CardDescription>Current Status Breakdown</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-center gap-3">
                        {/* Status Items */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 shadow-sm dark:shadow-none">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-slate-500" />
                                <span className="text-sm font-medium">To Do</span>
                            </div>
                            <span className="font-bold">{assignments.filter(a => a.status === 'to-do').length}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 shadow-sm dark:shadow-none">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-sm font-medium">In Progress</span>
                            </div>
                            <span className="font-bold">{assignments.filter(a => a.status === 'progress').length}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 shadow-sm dark:shadow-none">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-sm font-medium">Completed</span>
                            </div>
                            <span className="font-bold">{assignments.filter(a => a.status === 'done').length}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 5. Quick Insights (2 cols) */}
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle>Quick Insights</CardTitle>
                        <CardDescription>Performance Summary</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">Completion Rate</span>
                                <span className="text-xl font-bold">{Math.round((assignments.filter(a => a.status === 'done').length / (assignments.length || 1)) * 100)}%</span>
                            </div>
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary"
                                    style={{ width: `${Math.round((assignments.filter(a => a.status === 'done').length / (assignments.length || 1)) * 100)}%` }}
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <div className="text-sm font-medium text-muted-foreground mb-1">Most Productive Day</div>
                            <div className="text-2xl font-bold">
                                {(() => {
                                    const counts = [0, 0, 0, 0, 0, 0, 0];
                                    assignments.forEach(a => {
                                        if (a.status === 'done' && a.updatedAt) counts[new Date(a.updatedAt).getDay()]++;
                                    });
                                    const max = Math.max(...counts);
                                    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                    return counts.every(c => c === 0) ? '-' : days[counts.indexOf(max)];
                                })()}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
