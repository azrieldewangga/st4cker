import { useMemo } from 'react';
import { useStore } from "@/store/useStoreNew";
import { TrendingUp } from "lucide-react";
import { CartesianGrid, Dot, Line, LineChart } from "recharts";
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

export function AcademicTrendChart() {
    const userProfile = useStore(state => state.userProfile);
    const grades = useStore(state => state.grades);
    const getSemesterCourses = useStore(state => state.getSemesterCourses);

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

    // Calculate percentage trend (mock or real) - For now just show "Latest"
    const lastIps = academicData.length > 0 ? academicData[academicData.length - 1].ips : 0;
    const prevIps = academicData.length > 1 ? academicData[academicData.length - 2].ips : 0;
    const ipsDiff = (lastIps - prevIps).toFixed(2);
    const ipsTrend = parseFloat(ipsDiff) >= 0 ? 'up' : 'down';

    return (
        <Card className="col-span-4 lg:col-span-4 flex flex-col">
            <CardHeader>
                <CardTitle>Academic Trend</CardTitle>
                <CardDescription>IPS History (Semester 1 - Now)</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer config={academicConfig} className="w-full h-[180px]">
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
    );
}
