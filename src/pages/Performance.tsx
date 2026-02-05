import { useEffect, useState, useMemo } from 'react';
import Pencil1Icon from '../components/icons/Pencil1Icon';
import { useStore } from '../store/useStoreNew';
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from '../components/shared/EmptyState';

const Performance = () => {
    // Use direct store access to prevent object recreation
    const grades = useStore(state => state.grades);
    const fetchGrades = useStore(state => state.fetchGrades);
    const updateGrade = useStore(state => state.updateGrade);
    const userProfile = useStore(state => state.userProfile);
    const getSemesterCourses = useStore(state => state.getSemesterCourses);
    const addCourse = useStore(state => state.addCourse);
    const updateCourse = useStore(state => state.updateCourse);
    const deleteCourse = useStore(state => state.deleteCourse);



    useEffect(() => {
        fetchGrades();
    }, [userProfile]);

    const [viewSemester, setViewSemester] = useState(1);
    const [isEditing, setIsEditing] = useState(false);

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
        <ScrollArea className="h-[calc(100vh-3rem)]">
        <div className="space-y-6 p-6 pr-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <GraduationCap className="h-6 w-6" />
                        Prestasi Akademik
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Track your academic performance and grades.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                    void (async () => {
                        // Prepare export data
                        if (!userProfile) return;

                        const data: any[] = [];
                        const currentSem = userProfile.semester ? parseInt(userProfile.semester.toString()) : 1;

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
                    })();
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
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md">
                                    {semesterCourses.length} Courses
                                </span>
                                <Button
                                    variant={isEditing ? "destructive" : "secondary"}
                                    size="sm"
                                    onClick={() => setIsEditing(!isEditing)}
                                    className="h-8 w-8 p-0"
                                >
                                    {isEditing ? <span className="text-xs">✕</span> : <Pencil1Icon size={14} color="currentColor" />}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">No</TableHead>
                                        <TableHead>Mata Kuliah</TableHead>
                                        <TableHead className="w-[100px]">SKS</TableHead>
                                        <TableHead className="text-right w-[120px]">Nilai</TableHead>
                                        {isEditing && <TableHead className="w-[50px]"></TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {semesterCourses.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={isEditing ? 5 : 4} className="text-center h-24 text-muted-foreground">
                                                No courses found for this semester.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        semesterCourses.map((course, idx) => (
                                            <TableRow key={course.id || idx}>
                                                <TableCell>{idx + 1}</TableCell>
                                                <TableCell className="font-medium">
                                                    {isEditing ? (
                                                        <input
                                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                            defaultValue={course.name}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.currentTarget.blur();
                                                                }
                                                            }}
                                                            onBlur={async (e) => {
                                                                if (e.target.value !== course.name && e.target.value.trim() !== "") {
                                                                    try {
                                                                        await updateCourse({ ...course, name: e.target.value });
                                                                    } catch (err: any) {
                                                                        toast.error(err.message);
                                                                        e.target.value = course.name; // Revert
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    ) : course.name}
                                                </TableCell>
                                                <TableCell>
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                            defaultValue={course.sks}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.currentTarget.blur();
                                                                }
                                                            }}
                                                            onBlur={async (e) => {
                                                                const val = parseInt(e.target.value);
                                                                if (!isNaN(val) && val !== course.sks) {
                                                                    try {
                                                                        await updateCourse({ ...course, sks: val });
                                                                    } catch (err: any) {
                                                                        toast.error(err.message);
                                                                        e.target.value = course.sks?.toString() || ''; // Revert
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    ) : course.sks}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild disabled={!isEditing}>
                                                            <Button variant="outline" size="sm" className={`w-[60px] ${!isEditing ? 'opacity-100 cursor-default' : ''}`}>
                                                                {grades[course.id] || '-'}
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {['-', 'A', 'A-', 'AB', 'B+', 'B', 'BC', 'C', 'D', 'E'].map(g => (
                                                                <DropdownMenuItem
                                                                    key={g}
                                                                    onClick={() => updateGrade(course.id, g === '-' ? '' : g)}
                                                                >
                                                                    {g}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                                {isEditing && (
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:text-destructive/90"
                                                            onClick={() => {
                                                                void (async () => {
                                                                    if (confirm('Delete this course?')) {
                                                                        await deleteCourse(course.id);
                                                                    }
                                                                })();
                                                            }}
                                                        >
                                                            <span className="text-lg">🗑️</span>
                                                        </Button>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))
                                    )}
                                    {isEditing && (
                                        <>
                                            <TableRow>
                                                <TableCell colSpan={5} className="p-2">
                                                    <Button variant="outline" className="w-full border-dashed" onClick={() => addCourse(viewSemester)}>
                                                        + Add Course
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell colSpan={5} className="p-2 pt-0 border-none">
                                                    <Button
                                                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                                                        onClick={() => {
                                                            setIsEditing(false);
                                                            toast("Changes Saved", {
                                                                description: `Performance data for Semester ${viewSemester} has been updated.`
                                                            });
                                                        }}
                                                    >
                                                        Save Changes
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        </>
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
                            onClick={(e: React.MouseEvent) => {
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
                                    onClick={(e: React.MouseEvent) => {
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
                            onClick={(e: React.MouseEvent) => {
                                e.preventDefault();
                                if (viewSemester < semesterList.length) setViewSemester(viewSemester + 1);
                            }}
                            className={viewSemester >= semesterList.length ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>

        </div>
        </ScrollArea>
    );
};

export default Performance;
