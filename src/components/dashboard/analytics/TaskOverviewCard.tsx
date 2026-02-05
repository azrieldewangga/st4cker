import { useStore } from "@/store/useStoreNew";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export function TaskOverviewCard() {
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

    return (
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
                    <span className="font-bold">{relevantAssignments.filter(a => a.status === 'to-do').length}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-sm font-medium">In Progress</span>
                    </div>
                    <span className="font-bold">{relevantAssignments.filter(a => a.status === 'progress').length}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-sm font-medium">Completed</span>
                    </div>
                    <span className="font-bold">{relevantAssignments.filter(a => a.status === 'done').length}</span>
                </div>
            </CardContent>
        </Card>
    );
}
