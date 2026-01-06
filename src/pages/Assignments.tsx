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

// UI Components
import { Button } from "@/components/ui/button";
import confetti from 'canvas-confetti';
import { AnimatedIcon } from "@/components/ui/animated/AnimatedIcon";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { SkeletonTable } from '../components/shared/Skeleton';
import { EmptyState } from '../components/shared/EmptyState';

// Sortable Row
interface SortableRowProps {
    assignment: Assignment;
    index: number;
    updateAssignment: (id: string, data: Partial<Assignment>) => void;
    onEditClick: (id: string) => void;
    duplicateAssignment: (id: string) => Promise<void>;
    onDeleteClick: (id: string) => void;
    isFiltered: boolean;
    isSelected: boolean;
    onToggleSelect: (id: string) => void;
}

const SortableRow = ({
    assignment,
    updateAssignment,
    onEditClick,
    duplicateAssignment,
    onDeleteClick,
    isFiltered,
    isSelected,
    onToggleSelect
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
            {/* Drag Grip & Checkbox */}
            <TableCell className="w-[50px] p-2">
                <div className="flex items-center gap-2">
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                            // Event handling for row selection
                            onToggleSelect(assignment.id);
                        }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()} // Prevent row click
                    // Removed translation for better alignment
                    />
                    {!isFiltered && (
                        <div
                            {...attributes}
                            {...listeners}
                            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity flex justify-center"
                        >
                            <GripVertical size={16} className="text-muted-foreground" />
                        </div>
                    )}
                </div>
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
                {(() => {
                    let typeConfig = { className: 'bg-slate-500/15 text-slate-400 border-0' };
                    if (assignment.type === 'Tugas') typeConfig = { className: 'bg-blue-500/15 text-blue-400 border-0' };
                    if (assignment.type === 'Laporan Pendahuluan') typeConfig = { className: 'bg-purple-500/15 text-purple-400 border-0' };
                    if (assignment.type === 'Laporan Sementara') typeConfig = { className: 'bg-orange-500/15 text-orange-400 border-0' };
                    if (assignment.type === 'Laporan Resmi') typeConfig = { className: 'bg-emerald-500/15 text-emerald-400 border-0' };

                    return (
                        <Badge variant="outline" className={cn("font-normal px-3 py-1", typeConfig.className)}>
                            {assignment.type}
                        </Badge>
                    );
                })()}
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
                                onClick={(e: React.MouseEvent) => {
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
                            <AnimatedIcon icon={Edit} className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                            void (async () => {
                                await duplicateAssignment(assignment.id);
                            })();
                        }}>
                            <AnimatedIcon icon={Copy} className="mr-2 h-4 w-4" />
                            Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive font-bold"
                            onClick={() => onDeleteClick(assignment.id)}
                        >
                            <AnimatedIcon icon={Trash2} className="mr-2 h-4 w-4" />
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
    // ... hooks ...

    // Confetti Helper
    const triggerConfetti = () => {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
    };



    // Wrap updateAssignment for single row use if needed, passed down
    const handleSingleStatusUpdate = (id: string, data: Partial<Assignment>) => {
        updateAssignment(id, data);
        if (data.status === 'done') triggerConfetti();
    }

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
    const [isBulkDelete, setIsBulkDelete] = useState(false);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredAssignments.length && filteredAssignments.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredAssignments.map(a => a.id)));
        }
    };

    const handleBulkDelete = () => {
        setIsBulkDelete(true);
        setDeleteModalOpen(true);
    };

    const handleBulkStatus = async (status: AssignmentStatus) => {
        const ids = Array.from(selectedIds);
        for (const id of ids) {
            await updateAssignment(id, { status });
        }
        if (status === 'done') {
            triggerConfetti();
        }
        setSelectedIds(new Set());
        // Neutral toast color
        toast(`Updated ${ids.length} assignments to ${status}`);
    };

    const handleDeleteClick = (id: string) => {
        setIsBulkDelete(false);
        setAssignmentToDelete(id);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (isBulkDelete) {
            const ids = Array.from(selectedIds);
            for (const id of ids) {
                await deleteAssignment(id);
            }
            setSelectedIds(new Set());
            toast(`Deleted ${ids.length} assignments`);
        } else if (assignmentToDelete) {
            const assignment = assignments.find(a => a.id === assignmentToDelete);
            await deleteAssignment(assignmentToDelete);
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
        setIsBulkDelete(false);
    };

    useEffect(() => {
        fetchAssignments();
        fetchCourses();
    }, [fetchAssignments, fetchCourses]);

    // Keyboard Shortcut: Ctrl+N to open New Assignment, ESC to deselect
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const cmdKey = isMac ? e.metaKey : e.ctrlKey;

            // Ctrl + N: New Assignment
            if (cmdKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                setEditingId(null);
                setIsModalOpen(true);
            }

            // ESC: Deselect All
            if (e.key === 'Escape') {
                setSelectedIds(new Set());
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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
        return (
            <div className="h-full flex flex-col space-y-8 p-8 pt-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Assignments</h2>
                        <p className="text-muted-foreground">Manage your tasks and deadlines.</p>
                    </div>
                </div>
                <SkeletonTable rows={8} />
            </div>
        );
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
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={filteredAssignments.length > 0 && selectedIds.size === filteredAssignments.length}
                                        onCheckedChange={toggleSelectAll}
                                        className="translate-y-[2px]"
                                    />
                                </TableHead>
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
                                        <TableCell colSpan={7}>
                                            <EmptyState
                                                icon={Plus}
                                                title="No assignments yet"
                                                description={isFiltered ? "No assignments match your filters. Try adjusting your search criteria." : "Get started by creating your first assignment. Click the button above to add one."}
                                                actionLabel={!isFiltered ? "New Assignment" : undefined}
                                                onAction={!isFiltered ? () => { setEditingId(null); setIsModalOpen(true); } : undefined}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredAssignments.map((assignment, index) => (
                                        <SortableRow
                                            key={assignment.id}
                                            assignment={assignment}
                                            index={index}
                                            updateAssignment={(id, data) => handleSingleStatusUpdate(id, data)}
                                            onEditClick={(id) => { setEditingId(id); setIsModalOpen(true); }}
                                            duplicateAssignment={duplicateAssignment}
                                            onDeleteClick={handleDeleteClick}
                                            isFiltered={isFiltered}
                                            isSelected={selectedIds.has(assignment.id)}
                                            onToggleSelect={toggleSelection}
                                        />
                                    ))
                                )}
                            </SortableContext>
                        </TableBody>
                    </Table>
                </DndContext>
            </div>

            {/* Bulk Action Toolbar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-popover border shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-bottom-5 z-50">
                    <span className="text-sm font-medium mr-2">{selectedIds.size} selected</span>
                    <div className="h-4 w-px bg-border mx-1" />
                    <Button variant="ghost" size="sm" onClick={() => handleBulkStatus('done')} className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 h-8">
                        Mark Done
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleBulkStatus('to-do')} className="h-8">
                        Mark To Do
                    </Button>
                    <div className="h-4 w-px bg-border mx-1" />
                    <Button variant="ghost" size="sm" onClick={handleBulkDelete} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8">
                        Delete
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedIds(new Set())} className="h-6 w-6 rounded-full ml-1">
                        <span className="sr-only">Close</span>
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-3 w-3"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.1929 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.1929 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                    </Button>
                </div>
            )}

            {/* Alert Dialog for Delete */}
            <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isBulkDelete
                                ? `This will permanently delete ${selectedIds.size} selected assignments. This action cannot be undone.`
                                : "This action cannot be undone. This will permanently delete the assignment."
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white border-0"
                            onClick={handleConfirmDelete}
                        >
                            Delete
                        </AlertDialogAction>
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
