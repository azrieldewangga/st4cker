import React, { useEffect, useState, useCallback } from 'react';
import { Project } from '@/types/models';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Calendar, Clock, Maximize2, Trash2, Edit2 } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
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

import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

import ProjectModal from './ProjectModal';
import ProjectDetailsModal from './ProjectDetailsModal';
import LogProgressDialog from './LogProgressDialog';
import { ProjectCardSkeleton } from '@/components/ui/skeleton';

// Performance optimizations - use custom hooks
import { useFilteredProjects, useProjectHelpers } from '@/hooks/useFilteredProjects';
import { useStore } from '@/store/useStoreNew';

interface ProjectsTabProps {
    isModalOpen: boolean;
    setIsModalOpen: (open: boolean) => void;
}

const ProjectsTab: React.FC<ProjectsTabProps> = ({ isModalOpen, setIsModalOpen }) => {
    // Use stable selectors - NO object destructuring to prevent re-renders
    const projects = useStore(state => state.projects);
    const courses = useStore(state => state.courses);

    // Get actions directly (stable references)
    const fetchProjects = useStore(state => state.fetchProjects);
    const deleteProject = useStore(state => state.deleteProject);
    const undo = useStore(state => state.undo);

    // Dialog State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [viewingProjectId, setViewingProjectId] = useState<string | null>(null);

    // Log Progress State
    const [logProgressProjectId, setLogProgressProjectId] = useState<string | null>(null);
    const [logProgressCurrent, setLogProgressCurrent] = useState(0);

    // Filters
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'on-hold'>('all');
    const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
    const [sortOption, setSortOption] = useState<string>('deadline-asc');
    const [searchQuery, setSearchQuery] = useState('');

    // Context Menu & Delete
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, projectId: string } | null>(null);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const ITEMS_PER_PAGE = 6;

    useEffect(() => {
        fetchProjects().finally(() => setIsLoading(false));
    }, []); // Empty deps - only fetch once on mount

    // Close menu on click anywhere
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, priorityFilter, sortOption, searchQuery]);

    const handleContextMenu = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault();
        e.stopPropagation();

        let x = e.clientX;
        let y = e.clientY;

        if (x + 150 > window.innerWidth) x = window.innerWidth - 160;
        if (y + 100 > window.innerHeight) y = window.innerHeight - 110;

        setContextMenu({ x, y, projectId });
    };

    const confirmDelete = async () => {
        if (projectToDelete) {
            await deleteProject(projectToDelete.id);
            toast.success("Project Deleted", {
                description: `"${projectToDelete.title}" has been removed.`,
                action: {
                    label: "Undo",
                    onClick: () => undo(),
                },
            });
            setProjectToDelete(null);
        }
    };

    const getProjectType = (project: Project) => {
        if (project.courseId === null) {
            return "Personal Project";
        }
        const course = courses.find(c => c.id === project.courseId);
        return course?.name || "Unknown Course";
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge variant="default">● Active</Badge>;
            case 'completed':
                return <Badge variant="secondary" className="bg-green-500/10 text-green-500">✓ Completed</Badge>;
            case 'on-hold':
                return <Badge variant="secondary" className="bg-gray-500/10 text-gray-500">⏸ On Hold</Badge>;
            default:
                return null;
        }
    };

    // Performance optimization - use memoized filtering
    const filteredProjects = useFilteredProjects(projects, {
        statusFilter,
        priorityFilter,
        sortOption: sortOption as any,
        searchQuery,
    });

    // Use memoized helper functions
    const { getDaysRemaining, getPriorityColor, getPriorityIcon } = useProjectHelpers();

    return (
        <div className="space-y-6">
            {/* Controls Header */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="flex flex-col sm:flex-row gap-3 w-full items-center">
                    <div className="relative w-full sm:w-[260px]">
                        <Input
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
                        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="on-hold">On Hold</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={priorityFilter} onValueChange={(val) => setPriorityFilter(val as any)}>
                        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Priorities</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={sortOption} onValueChange={setSortOption}>
                        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sort By" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="deadline-asc">Deadline (Closest)</SelectItem>
                            <SelectItem value="deadline-desc">Deadline (Furthest)</SelectItem>
                            <SelectItem value="progress-desc">Progress (Highest)</SelectItem>
                            <SelectItem value="progress-asc">Progress (Lowest)</SelectItem>
                            <SelectItem value="priority-high">Priority (High-Low)</SelectItem>
                            <SelectItem value="priority-low">Priority (Low-High)</SelectItem>
                            <SelectItem value="title-asc">Title (A-Z)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(6)].map((_, i) => (
                        <ProjectCardSkeleton key={i} />
                    ))}
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <div className="text-muted-foreground">
                        <p className="text-lg font-medium">No projects found</p>
                        <p className="text-sm mt-2">
                            {projects.length === 0 ? "Create your first project to start tracking progress" : "Try adjusting your search or filters"}
                        </p>
                    </div>
                    {projects.length === 0 && (
                        <Button className="mt-4" onClick={() => setIsModalOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Project
                        </Button>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredProjects.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((project) => {
                            const daysLeft = getDaysRemaining(project.deadline);
                            return (
                                <div
                                    key={project.id}
                                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                                    onContextMenu={(e) => handleContextMenu(e, project.id)}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={getPriorityColor(project.priority)}>{getPriorityIcon(project.priority)}</span>
                                                <h3 className="font-semibold text-sm line-clamp-1">{project.title}</h3>
                                            </div>
                                            <p className="text-xs text-muted-foreground">{getProjectType(project)}</p>
                                        </div>
                                        {getStatusBadge(project.status)}
                                    </div>
                                    <div className="mb-3">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-muted-foreground">Progress</span>
                                            <span className="font-medium">{project.totalProgress}%</span>
                                        </div>
                                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={cn("h-full transition-all", project.status === 'completed' ? "bg-green-500" : "bg-primary")}
                                                style={{ width: `${project.totalProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            <span>{daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? 'Due today' : `${Math.abs(daysLeft)} days overdue`}</span>
                                        </div>
                                        {project.lastSessionDate && (
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                <span>{format(new Date(project.lastSessionDate), 'MMM d')}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-center gap-2 mt-3 w-full">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs px-4"
                                            onClick={(e: React.MouseEvent) => {
                                                e.stopPropagation();
                                                setViewingProjectId(project.id);
                                            }}
                                        >
                                            <Maximize2 className="w-3 h-3 mr-1" />
                                            Detail
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs px-4"
                                            onClick={(e: React.MouseEvent) => {
                                                e.stopPropagation();
                                                setLogProgressProjectId(project.id);
                                                setLogProgressCurrent(project.totalProgress);
                                            }}
                                        >
                                            <Clock className="w-3 h-3 mr-1" />
                                            Log Progress
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {filteredProjects.length > ITEMS_PER_PAGE && (
                        <div className="mt-8">
                            <Pagination>
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious
                                            href="#"
                                            onClick={(e) => { e.preventDefault(); if (currentPage > 1) setCurrentPage(p => p - 1); }}
                                            className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                                        />
                                    </PaginationItem>
                                    {Array.from({ length: Math.ceil(filteredProjects.length / ITEMS_PER_PAGE) }).map((_, i) => (
                                        <PaginationItem key={i}>
                                            <PaginationLink
                                                href="#"
                                                isActive={currentPage === i + 1}
                                                onClick={(e) => { e.preventDefault(); setCurrentPage(i + 1); }}
                                            >
                                                {i + 1}
                                            </PaginationLink>
                                        </PaginationItem>
                                    ))}
                                    <PaginationItem>
                                        <PaginationNext
                                            href="#"
                                            onClick={(e) => { e.preventDefault(); if (currentPage < Math.ceil(filteredProjects.length / ITEMS_PER_PAGE)) setCurrentPage(p => p + 1); }}
                                            className={currentPage === Math.ceil(filteredProjects.length / ITEMS_PER_PAGE) ? "pointer-events-none opacity-50" : ""}
                                        />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        </div>
                    )}
                </>
            )}

            <ProjectModal
                isOpen={isModalOpen || !!editingId}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingId(null);
                }}
                editingId={editingId}
                initialData={editingId ? projects.find(p => p.id === editingId) || null : null}
            />

            <ProjectDetailsModal
                isOpen={!!viewingProjectId}
                onClose={() => setViewingProjectId(null)}
                projectId={viewingProjectId}
                onEdit={(p) => {
                    setEditingId(p.id);
                }}
                onLogProgress={(p) => {
                    setLogProgressProjectId(p.id);
                    setLogProgressCurrent(p.totalProgress);
                }}
            />

            <LogProgressDialog
                isOpen={logProgressProjectId !== null}
                onClose={() => setLogProgressProjectId(null)}
                projectId={logProgressProjectId || ''}
                currentProgress={logProgressCurrent}
            />

            {contextMenu && createPortal(
                <div
                    className="fixed z-[9999] bg-popover text-popover-foreground border shadow-md rounded-md p-1 min-w-[150px] animate-in fade-in zoom-in-95"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Button
                        variant="ghost"
                        className="w-full justify-start h-8 text-sm"
                        onClick={() => {
                            setEditingId(contextMenu.projectId);
                            setContextMenu(null);
                        }}
                    >
                        <Edit2 className="w-3 h-3 mr-2" /> Edit
                    </Button>
                    <div className="h-px bg-border my-1" />
                    <Button
                        variant="ghost"
                        className="w-full justify-start h-8 text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                            const p = projects.find(pr => pr.id === contextMenu.projectId);
                            setProjectToDelete(p || null);
                            setContextMenu(null);
                        }}
                    >
                        <Trash2 className="w-3 h-3 mr-2" /> Delete
                    </Button>
                </div>,
                document.body
            )}

            <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the project
                            "{projectToDelete?.title}" and remove all associated data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ProjectsTab;
