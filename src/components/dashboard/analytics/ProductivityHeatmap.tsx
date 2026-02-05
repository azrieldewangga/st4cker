import { useMemo } from 'react';
import { useStore } from "@/store/useStoreNew";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    format,
    eachDayOfInterval,
    startOfWeek,
    isSameMonth
} from 'date-fns';

export function ProductivityHeatmap() {
    const assignments = useStore(state => state.assignments);
    const courses = useStore(state => state.courses);
    const userProfile = useStore(state => state.userProfile);

    // Filter assignments by current semester
    const currentSemester = userProfile?.semester;
    const relevantAssignments = assignments.filter(a => {
        if (a.semester !== undefined && a.semester !== null) {
            return a.semester === currentSemester;
        }
        // Fallback: check course semester
        const course = courses.find(c => c.id === a.courseId);
        return course ? course.semester === currentSemester : true;
    });

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
        relevantAssignments.forEach(a => {
            if (a.status === 'done' && a.updatedAt) {
                const dateKey = format(new Date(a.updatedAt), 'yyyy-MM-dd');
                completionMap[dateKey] = (completionMap[dateKey] || 0) + 1;
            }
        });

        // Group by weeks
        const weeks: { days: { date: Date; level: number; count: number }[] }[] = [];
        let currentWeek: { date: Date; level: number; count: number }[] = [];

        days.forEach((day) => {
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
    }, [relevantAssignments, startDate]);

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

    return (
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
    );
}
