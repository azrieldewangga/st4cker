import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStoreNew';
import { format } from 'date-fns';
import { AssignmentType } from '@/types/models';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";


interface AssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingId?: string | null;
}

const AssignmentModal = ({ isOpen, onClose, editingId }: AssignmentModalProps) => {
    // Use direct store access to prevent object recreation and modal flickering
    const addAssignment = useStore(state => state.addAssignment);
    const updateAssignment = useStore(state => state.updateAssignment);
    const courses = useStore(state => state.courses);
    const fetchCourses = useStore(state => state.fetchCourses);
    const assignments = useStore(state => state.assignments);
    const userProfile = useStore(state => state.userProfile);

    const [formData, setFormData] = useState({
        courseName: '',
        type: 'Tugas' as AssignmentType,
        deadline: new Date(),
        note: ''
    });

    // Fetch courses when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchCourses();
        }
    }, [isOpen]); // Removed fetchCourses from deps

    // Reset or populate form based on edit mode
    useEffect(() => {
        if (isOpen) {
            if (editingId) {
                const item = assignments.find(a => a.id === editingId);
                if (item) {
                    setFormData({
                        courseName: item.courseId,
                        type: item.type,
                        deadline: new Date(item.deadline),
                        note: item.note || ''
                    });
                }
            } else {
                setFormData({
                    courseName: courses[0]?.id || '',
                    type: 'Tugas',
                    deadline: new Date(),
                    note: ''
                });
            }
        }
    }, [isOpen, editingId, assignments, courses]);

    // Set default course when courses load
    useEffect(() => {
        if (isOpen && !editingId && courses.length > 0 && !formData.courseName) {
            setFormData(prev => ({ ...prev, courseName: courses[0].id }));
        }
    }, [courses, isOpen, editingId, formData.courseName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.courseName) return;

        const courseNameForTitle = courses.find(c => c.id === formData.courseName)?.name || formData.courseName;
        const finalTitle = `${formData.type} - ${courseNameForTitle}`;

        try {
            if (editingId) {
                await updateAssignment(editingId, {
                    courseId: formData.courseName,
                    title: finalTitle,
                    type: formData.type,
                    deadline: formData.deadline.toISOString(),
                    note: formData.note
                });
                toast.success("Assignment Updated", {
                    description: `"${finalTitle}" has been updated successfully.`
                });
            } else {
                await addAssignment({
                    courseId: formData.courseName,
                    title: finalTitle,
                    type: formData.type,
                    deadline: formData.deadline.toISOString(),
                    status: 'to-do',
                    note: formData.note
                });
                toast.success("Assignment Created", {
                    description: `"${finalTitle}" has been added successfully.`
                });
            }
            onClose();
        } catch (error: any) {
            toast.error(error.message || "Failed to save assignment");
        }
    };

    const assignmentTypes: AssignmentType[] = ['Tugas', 'Laporan Pendahuluan', 'Laporan Sementara', 'Laporan Resmi'];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{editingId ? 'Edit Assignment' : 'New Assignment'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    {/* Course Selection */}
                    <div className="space-y-2">
                        <Label>Course</Label>
                        <Select
                            value={formData.courseName}
                            onValueChange={(value) => setFormData({ ...formData, courseName: value })}
                            disabled={!userProfile}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a course" />
                            </SelectTrigger>
                            <SelectContent>
                                {courses.map((course) => (
                                    <SelectItem key={course.id} value={course.id}>
                                        {course.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {userProfile && courses.length === 0 && (
                            <p className="text-sm text-amber-500">
                                No courses found for Semester {userProfile.semester}. Check your settings.
                            </p>
                        )}
                    </div>

                    {/* Type and Deadline */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(value) => setFormData({ ...formData, type: value as AssignmentType })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {assignmentTypes.map((type) => (
                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Deadline</Label>
                            <DatePicker
                                date={formData.deadline}
                                setDate={(date) => date && setFormData({ ...formData, deadline: date })}
                            />
                        </div>
                    </div>

                    {/* Note */}
                    <div className="space-y-2">
                        <Label>Note</Label>
                        <Textarea
                            placeholder="Additional notes... (Press Enter to save, Shift+Enter for new line)"
                            value={formData.note}
                            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                            className="h-24"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit">
                            {editingId ? 'Update Assignment' : 'Create Assignment'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AssignmentModal;
