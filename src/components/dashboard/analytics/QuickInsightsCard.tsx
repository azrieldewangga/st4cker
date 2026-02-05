import { useStore } from "@/store/useStoreNew";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export function QuickInsightsCard() {
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
        <Card className="flex flex-col h-full">
            <CardHeader>
                <CardTitle>Quick Insights</CardTitle>
                <CardDescription>Performance Summary</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Completion Rate</span>
                        <span className="text-xl font-bold">{Math.round((relevantAssignments.filter(a => a.status === 'done').length / (relevantAssignments.length || 1)) * 100)}%</span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.round((relevantAssignments.filter(a => a.status === 'done').length / (relevantAssignments.length || 1)) * 100)}%` }}
                        />
                    </div>
                </div>

                <div className="pt-4 border-t">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Most Productive Day</div>
                    <div className="text-2xl font-bold">
                        {(() => {
                            const counts = [0, 0, 0, 0, 0, 0, 0];
                            relevantAssignments.forEach(a => {
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
    );
}
