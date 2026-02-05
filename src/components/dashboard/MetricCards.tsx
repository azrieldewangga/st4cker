import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/store/useStoreNew";
import { DollarSign, GraduationCap, BookOpen, Clock } from "lucide-react";


export function MetricCards() {
    const userProfile = useStore(state => state.userProfile);
    const assignments = useStore(state => state.assignments);
    const transactions = useStore(state => state.transactions);
    const courses = useStore(state => state.courses);
    const grades = useStore(state => state.grades);
    const schedule = useStore(state => state.schedule);
    const currency = useStore(state => state.currency);

    // 1. Total Balance (Matching Cashflow.tsx logic)
    const balance = transactions.reduce((acc, tx) => {
        const amount = Number(tx.amount);
        if (isNaN(amount)) return acc;
        if (amount < 0) return acc + amount; // Handle already-negative amounts
        return acc + (tx.type === 'income' ? amount : -amount);
    }, 0);

    const formatter = new Intl.NumberFormat(currency === 'IDR' ? 'id-ID' : 'en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
    const formattedBalance = formatter.format(balance);

    // 2. GPA Calculation
    const gradePoints: Record<string, number> = {
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
    let totalPoints = 0;
    let totalSks = 0;

    courses.forEach(course => {
        const grade = grades[course.id];
        if (grade && gradePoints[grade] !== undefined) {
            const points = gradePoints[grade];
            const sks = course.sks || 0; // Use 0 to match Performance logic
            totalPoints += points * sks;
            totalSks += sks;
        }
    });
    const gpa = totalSks > 0 ? (totalPoints / totalSks).toFixed(2) : "0.00";

    // 3. Active Tasks (Filtered by current semester)
    const currentSemester = userProfile?.semester;
    const activeAssignments = assignments.filter(a => {
        if (a.status === 'done') return false;
        // Filter by semester: check assignment.semester or course.semester
        if (a.semester !== undefined && a.semester !== null) {
            return a.semester === currentSemester;
        }
        // Fallback: check course semester
        const course = courses.find(c => c.id === a.courseId);
        return course ? course.semester === currentSemester : true;
    }).length;

    // 4. Next Class
    // Simple logic: Find next class today
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const now = new Date();
    const currentDay = days[now.getDay()];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeVal = currentHour * 60 + currentMinute;

    const todayClasses = Object.values(schedule).filter((s: any) => s.day === currentDay).map((s: any) => {
        const [h, m] = s.startTime.split(':').map(Number);
        return { ...s, timeVal: h * 60 + m };
    }).sort((a, b) => a.timeVal - b.timeVal);

    const nextClassItem = todayClasses.find(c => c.timeVal > currentTimeVal);

    // Find course name
    let nextClassName = "No classes today";
    let nextClassTime = "";

    if (nextClassItem) {
        // Try getting name from course list or use ID/Name from schedule
        // Schedule item might store 'course' as ID.
        const cProps = courses.find(c => c.id === nextClassItem.course);
        nextClassName = cProps ? cProps.name : (nextClassItem.course || nextClassItem.subject || "Unknown Class");
        // Use subject if course is ID
        if (nextClassName.startsWith('course-')) nextClassName = "Class"; // Fallback

        // Calculate relative time
        const diffMins = nextClassItem.timeVal - currentTimeVal;
        const diffHrs = Math.floor(diffMins / 60);
        const remMins = diffMins % 60;

        if (diffHrs > 0) nextClassTime = `Starts in ${diffHrs}h ${remMins}m`;
        else nextClassTime = `Starts in ${remMins}m`;

    } else if (todayClasses.length > 0 && currentTimeVal > todayClasses[todayClasses.length - 1].timeVal) {
        nextClassName = "Done for today";
        nextClassTime = "Relax!";
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formattedBalance}</div>
                    <p className="text-xs text-muted-foreground">Current available funds</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">GPA</CardTitle>
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{gpa}</div>
                    <p className="text-xs text-muted-foreground">{userProfile?.semester ? `Semester ${userProfile.semester} Target` : 'Target'}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{activeAssignments}</div>
                    <p className="text-xs text-muted-foreground">{activeAssignments > 0 ? 'Assignments due soon' : 'All caught up!'}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Next Class</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold truncate">{nextClassName}</div>
                    <p className="text-xs text-muted-foreground">{nextClassTime}</p>
                </CardContent>
            </Card>
        </div>
    );
}
