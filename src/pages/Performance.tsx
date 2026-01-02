import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { GraduationCap, Download } from 'lucide-react';
import { exportToCSV } from '../utils/export';
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { SkeletonCard, SkeletonTable } from '../components/shared/Skeleton';
import { EmptyState } from '../components/shared/EmptyState';

const Performance = () => {
    const { grades, fetchGrades, updateGrade, userProfile, getSemesterCourses } = useStore();



    useEffect(() => {
        fetchGrades();
    }, [userProfile]);

    const [viewSemester, setViewSemester] = useState(1);

    useEffect(() => {
        if (userProfile?.semester) {
            setViewSemester(userProfile.semester);
        }
    }, [userProfile?.semester]);

    const chartData = useMemo(() => {
        if (!userProfile) return [];

        const gradeValues: Record<string, number> = {
            'A': 4.00,
            'A-': 3.75,
            'AB': 3.50,
            'B+': 3.25,
            'B': 3.00,
            'BC': 2.50,
            'C': 2.00,
            'D': 1.00,
            'E': 0.00
        };

        const currentSem = userProfile.semester ? parseInt(userProfile.semester.toString()) : 1;
        const validSem = isNaN(currentSem) ? 1 : currentSem;

        const data = [];
        for (let i = 1; i <= validSem; i++) {
            const courses = getSemesterCourses(i);
            let totalSks = 0;
            let totalPoints = 0;
            let hasGrades = false;

            courses.forEach(course => {
                const grade = grades[course.id];
                if (grade && gradeValues[grade] !== undefined) {
                    const sks = course.sks || 0;
                    totalPoints += gradeValues[grade] * sks;
                    totalSks += sks;
                    hasGrades = true;
                }
            });

            const ips = totalSks > 0 ? (totalPoints / totalSks) : 0;

            data.push({
                semester: `Sem ${i}`,
                ips: parseFloat(ips.toFixed(2)),
                rawSem: i
            });
        }
        return data;
    }, [userProfile, grades, getSemesterCourses]);

    // We want to show ALL semesters up to the current one (or more if they have data).
    // Requirement: "Performance memperlihatkan isi seluruh semester".
    // We will render a list of semesters.

    // Derive list of semester numbers to show (1 to userProfile.semester)
    const semesterList = useMemo(() => {
        if (!userProfile || !userProfile.semester) return [1];
        const semCount = typeof userProfile.semester === 'string' ? parseInt(userProfile.semester) : userProfile.semester;
        if (isNaN(semCount) || semCount < 1) return [1];

        const list = [];
        for (let i = 1; i <= semCount; i++) {
            list.push(i);
        }
        return list;
    }, [userProfile]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <GraduationCap />
                    Prestasi Akademik
                </h1>
                <Button variant="outline" size="sm" onClick={async () => {
                    // Flatten grade data for export
                    const data = [];
                    const currentSem = userProfile?.semester ? parseInt(userProfile.semester.toString()) : 1;

                    for (let i = 1; i <= currentSem; i++) {
                        const courses = getSemesterCourses(i);
                        courses.forEach(c => {
                            data.push({
                                Semester: i,
                                Course: c.name,
                                SKS: c.sks,
                                Grade: grades[c.id] || '-'
                            });
                        });
                    }

                    const { success, filePath, error } = await exportToCSV(data, `Academic_Performance_${new Date().toISOString().split('T')[0]}.csv`);

                    if (success) {
                        toast("Export Successful", {
                            description: `File saved to: ${filePath}`,
                        });
                    }
                    else if (error) toast.error(`Export failed: ${error}`);
                }}>
                    <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
            </div>

            {/* IPS Trend Chart */}
            {/* IPS Trend Chart */}
            <Card>
                <CardHeader>
                    <CardTitle>Grafik IPS</CardTitle>
                </CardHeader>
                <CardContent className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={chartData}
                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="colorIps" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                            <XAxis dataKey="semester" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis domain={[0, 4]} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--popover)', borderColor: 'var(--border)', color: 'var(--popover-foreground)', borderRadius: '8px' }}
                                itemStyle={{ color: 'var(--primary)' }}
                                labelStyle={{ color: 'var(--popover-foreground)' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="ips"
                                stroke="var(--primary)"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorIps)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>



            {/* Access View Semester Courses */}
            {(() => {
                const semesterCourses = getSemesterCourses(viewSemester);

                return (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                            <CardTitle className="text-base font-bold">Mata Kuliah - Semester {viewSemester}</CardTitle>
                            <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md">
                                {semesterCourses.length} Courses
                            </span>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">No</TableHead>
                                        <TableHead>Mata Kuliah</TableHead>
                                        <TableHead>SKS</TableHead>
                                        <TableHead className="text-right">Nilai</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {semesterCourses.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                                No courses found for this semester.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        semesterCourses.map((course, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>{idx + 1}</TableCell>
                                                <TableCell className="font-medium">{course.name}</TableCell>
                                                <TableCell>{course.sks}</TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="outline" size="sm" className="w-[60px]">
                                                                {grades[course.id] || '-'}
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {['A', 'A-', 'AB', 'B+', 'B', 'BC', 'C', 'D', 'E'].map(g => (
                                                                <DropdownMenuItem
                                                                    key={g}
                                                                    onClick={() => updateGrade(course.id, g)}
                                                                >
                                                                    {g}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                );
            })()}

            {/* Bottom Semester Pagination (Shadcn Style) */}
            <Pagination className="mt-6 pb-6">
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                if (viewSemester > 1) setViewSemester(viewSemester - 1);
                            }}
                            className={viewSemester <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                    </PaginationItem>

                    {(() => {
                        const total = semesterList.length;
                        let start = viewSemester - 1;
                        if (start < 1) start = 1;
                        let end = start + 2;
                        if (end > total) {
                            end = total;
                            start = Math.max(1, end - 2);
                        }

                        const visiblePages = [];
                        for (let i = start; i <= end; i++) {
                            visiblePages.push(i);
                        }

                        return visiblePages.map((sem) => (
                            <PaginationItem key={sem}>
                                <PaginationLink
                                    href="#"
                                    isActive={viewSemester === sem}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setViewSemester(sem);
                                    }}
                                >
                                    {sem}
                                </PaginationLink>
                            </PaginationItem>
                        ));
                    })()}

                    <PaginationItem>
                        <PaginationNext
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                if (viewSemester < semesterList.length) setViewSemester(viewSemester + 1);
                            }}
                            className={viewSemester >= semesterList.length ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>

        </div>
    );
};

export default Performance;
