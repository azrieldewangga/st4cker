import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { AssignmentStatus, Assignment } from '../types/models';
import { Plus, GripVertical, MoreHorizontal, Search, Trash2, Copy, Edit } from 'lucide-react';
import { toast } from "sonner";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AssignmentModal from '../components/assignments/AssignmentModal';

// --- Sortable Row Component ---
interface SortableRowProps {
    assignment: Assignment;
    index: number;
    updateAssignment: (id: string, data: Partial<Assignment>) => void;
    onEditClick: (id: string) => void;
    duplicateAssignment: (id: string) => Promise<void>;
    onDeleteClick: (id: string) => void;
    isFiltered: boolean;
}

const SortableRow = ({
    assignment,
    updateAssignment,
    onEditClick,
    duplicateAssignment,
    onDeleteClick,
    isFiltered
}: SortableRowProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: assignment.id, disabled: isFiltered });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={cn(
                "group",
                isDragging && "opacity-50 bg-muted/50 z-10 relative"
            )}
        >
            {/* Drag Grip */}
            <TableCell className="w-[50px] p-2">
                {!isFiltered && (
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity flex justify-center"
                    >
                        <GripVertical size={16} className="text-muted-foreground" />
                    </div>
                )}
            </TableCell>

            {/* Deadline */}
            <TableCell className="font-medium whitespace-nowrap">
                <div className="flex flex-col">
                    <span>{format(new Date(assignment.deadline), 'MMMM d, yyyy')}</span>
                    <span className="text-xs text-muted-foreground">
                        {format(new Date(assignment.deadline), 'HH:mm')}
                    </span>
                </div>
            </TableCell>

            {/* Status Dropdown */}
            <TableCell>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 hover:bg-transparent p-0">
                            {(() => {
                                let config = { label: 'To Do', className: 'bg-slate-500/15 text-slate-400 hover:bg-slate-500/25 border-0' };
                                if (assignment.status === 'done') config = { label: 'Completed', className: 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border-0' };
                                if (assignment.status === 'progress') config = { label: 'In Progress', className: 'bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border-0' };

                                return (
                                    <Badge variant="outline" className={cn("font-medium px-3 py-1", config.className)}>
                                        {config.label}
                                    </Badge>
                                );
                            })()}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => updateAssignment(assignment.id, { status: 'to-do' })}>
                            To Do
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateAssignment(assignment.id, { status: 'progress' })}>
                            In Progress
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateAssignment(assignment.id, { status: 'done' })}>
                            Completed
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>

            {/* Mata Kuliah */}
            <TableCell>
                <div className="font-medium">
                    {(() => {
                        const cId = assignment.courseId || '';
                        if (cId.startsWith("generic")) {
                            return ((assignment.title || '').split('-')[1]?.trim() || (assignment.title || '')).replace(/MW-|MPK-/g, '');
                        }
                        const foundCourse = useStore.getState().courses.find(c => c.id === cId);
                        if (foundCourse) return foundCourse.name;
                        return cId.replace(/MW-|MPK-/g, '');
                    })()}
                </div>
            </TableCell>

            {/* Jenis Laporan */}
            <TableCell>
                <Badge variant="secondary" className="font-normal">
                    {assignment.type}
                </Badge>
            </TableCell>

            {/* Note */}
            <TableCell className="max-w-[200px] truncate text-muted-foreground" title={assignment.note}>
                {(() => {
                    const note = assignment.note || '';
                    // Regex to detect URLs (including simple domains like google.com)
                    // Matches: (optional protocol)(optional www)(domain)(TLD)(optional path)
                    const urlRegex = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/i;

                    if (urlRegex.test(note)) {
                        let href = note;
                        if (!/^https?:\/\//i.test(note)) {
                            href = 'https://' + note;
                        }
                        return (
                            <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline cursor-pointer"
                                onClick={(e) => {
                                    e.preventDefault(); // Stop default anchor behavior (opening new window)
                                    e.stopPropagation();
                                    // Use Electron to open external link if available, otherwise default
                                    // @ts-ignore
                                    if (window.electronAPI) window.electronAPI.utils.openExternal(href);
                                }}
                            >
                                {note}
                            </a>
                        );
                    }
                    return note;
                })()}
            </TableCell>

            {/* Actions */}
            <TableCell className="text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => onEditClick(assignment.id)}
                        >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => {
                            await duplicateAssignment(assignment.id);
                        }}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive font-bold"
                            onClick={() => onDeleteClick(assignment.id)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    );
};

// --- Main Component ---
const Assignments = () => {
    const { assignments, fetchAssignments, updateAssignment, reorderAssignments, courses, fetchCourses, duplicateAssignment, deleteAssignment, userProfile, undo } = useStore();

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Filters State
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'all'>('all');
    const [courseFilter, setCourseFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'deadline' | 'custom'>('deadline');

    // Delete confirmation modal state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [assignmentToDelete, setAssignmentToDelete] = useState<string | null>(null);

    const handleDeleteClick = (id: string) => {
        setAssignmentToDelete(id);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (assignmentToDelete) {
            const assignment = assignments.find(a => a.id === assignmentToDelete);
            deleteAssignment(assignmentToDelete);
            toast("Assignment has been deleted", {
                description: assignment?.title || "Untitled Assignment",
                action: {
                    label: "Undo",
                    onClick: () => undo(),
                },
            });
        }
        setDeleteModalOpen(false);
        setAssignmentToDelete(null);
    };

    useEffect(() => {
        fetchAssignments();
        fetchCourses();
    }, [fetchAssignments, fetchCourses]);

    // Filtering & Sorting
    const filteredAssignments = useMemo(() => {
        let result = [...assignments];

        if (!userProfile) return [];

        if (userProfile.semester) {
            result = result.filter(a => {
                if (a.semester !== undefined && a.semester !== null) {
                    return a.semester === userProfile.semester;
                }
                return false;
            });
        }

        if (search) {
            const s = search.toLowerCase();
            result = result.filter(a =>
                a.title.toLowerCase().includes(s) ||
                a.courseId.toLowerCase().includes(s) ||
                (a.note && a.note.toLowerCase().includes(s))
            );
        }
        if (statusFilter !== 'all') {
            result = result.filter(a => a.status === statusFilter);
        }
        if (courseFilter !== 'all') {
            result = result.filter(a => a.courseId === courseFilter);
        }

        if (sortBy === 'deadline') {
            result.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
        } else {
            result.sort((a, b) => (a.customOrder || 0) - (b.customOrder || 0));
        }

        return result;
    }, [assignments, search, statusFilter, courseFilter, sortBy, courses, userProfile]);

    const isFiltered = assignments.length !== filteredAssignments.length || (search !== '' || statusFilter !== 'all' || courseFilter !== 'all');

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = assignments.findIndex((item) => item.id === active.id);
            const newIndex = assignments.findIndex((item) => item.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                if (sortBy !== 'custom') setSortBy('custom');
                const newOrder = arrayMove(assignments, oldIndex, newIndex);
                reorderAssignments(newOrder);
            }
        }
    };

    if (!userProfile) {
        return <div className="p-8 text-center text-muted-foreground">Loading assignments...</div>;
    }

    return (
        <div className="h-full flex flex-col space-y-8 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Assignments</h2>
                    <p className="text-muted-foreground">Manage your tasks and deadlines.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button onClick={() => { setEditingId(null); setIsModalOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> New Assignment
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between space-x-2">
                <div className="flex flex-1 items-center space-x-2">
                    <Input
                        placeholder="Filter tasks..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8 w-[150px] lg:w-[250px]"
                    />

                    {/* Course Filter */}
                    <Select value={courseFilter} onValueChange={setCourseFilter}>
                        <SelectTrigger className="h-8 w-[150px]">
                            <SelectValue placeholder="All Courses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Courses</SelectItem>
                            {courses.map(c => (
                                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Status Filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 border-dashed">
                                {statusFilter === 'all' ? 'Status' : statusFilter === 'to-do' ? 'To Do' : statusFilter === 'progress' ? 'In Progress' : 'Completed'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuCheckboxItem checked={statusFilter === 'all'} onCheckedChange={() => setStatusFilter('all')}>All</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={statusFilter === 'to-do'} onCheckedChange={() => setStatusFilter('to-do')}>To Do</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={statusFilter === 'progress'} onCheckedChange={() => setStatusFilter('progress')}>In Progress</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={statusFilter === 'done'} onCheckedChange={() => setStatusFilter('done')}>Completed</DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Sort Toggle */}
                    <Button variant="outline" size="sm" className="h-8 ml-auto" onClick={() => setSortBy(sortBy === 'deadline' ? 'custom' : 'deadline')}>
                        Sort: {sortBy === 'deadline' ? 'Deadline' : 'Manual'}
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-card">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>Deadline</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Course</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Note</TableHead>
                                <TableHead className="text-right"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <SortableContext
                                items={filteredAssignments.map(a => a.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {filteredAssignments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            No assignments found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredAssignments.map((assignment, index) => (
                                        <SortableRow
                                            key={assignment.id}
                                            assignment={assignment}
                                            index={index}
                                            updateAssignment={updateAssignment}
                                            onEditClick={(id) => { setEditingId(id); setIsModalOpen(true); }}
                                            duplicateAssignment={duplicateAssignment}
                                            onDeleteClick={handleDeleteClick}
                                            isFiltered={isFiltered}
                                        />
                                    ))
                                )}
                            </SortableContext>
                        </TableBody>
                    </Table>
                </DndContext>
            </div>

            {/* Alert Dialog for Delete */}
            <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the assignment.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleConfirmDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AssignmentModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingId(null); }}
                editingId={editingId}
            />
        </div>
    );
};

export default Assignments;
