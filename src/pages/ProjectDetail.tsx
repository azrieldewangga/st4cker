import { ScrollArea } from "@/components/ui/scroll-area";
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '@/store/useStoreNew';
import { useState, useMemo, useEffect } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ArrowLeft, Edit2, Clock, Trash2, Calendar, Target, BarChart3, FileText, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
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
import ProjectModal from '@/components/projects/ProjectModal';
import LogProgressDialog from '@/components/projects/LogProgressDialog';

const ProjectDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const projects = useStore(state => state.projects);
    const courses = useStore(state => state.courses);
    const deleteProject = useStore(state => state.deleteProject);
    const fetchProjects = useStore(state => state.fetchProjects);
    const undo = useStore(state => state.undo);

    // Attachments Store
    const projectAttachments = useStore(state => state.projectAttachments);
    const fetchProjectAttachments = useStore(state => state.fetchProjectAttachments);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isLogProgressOpen, setIsLogProgressOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const [isLoading, setIsLoading] = useState(true);

    // Fetch projects on mount if not already loaded
    useEffect(() => {
        if (projects.length === 0) {
            fetchProjects().finally(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, []);

    // Fetch attachments when project id available
    useEffect(() => {
        if (id) {
            fetchProjectAttachments(id);
        }
    }, [id]);

    const project = useMemo(() => {
        return projects.find(p => p.id === id);
    }, [projects, id]);

    const attachments = useMemo(() => {
        if (!id) return [];
        return projectAttachments[id] || [];
    }, [projectAttachments, id]);

    const handleOpenAttachment = async (attachment: any) => {
        try {
            if (attachment.type === 'link') {
                await window.electronAPI.utils.openExternal(attachment.path);
            } else {
                await window.electronAPI.utils.openPath(attachment.path);
            }
        } catch (e) {
            console.error('Failed to open attachment:', e);
            toast.error("Failed to open file/link");
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-muted-foreground">Loading project...</p>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <h2 className="text-2xl font-bold">Project not found</h2>
                <p className="text-muted-foreground">The project you're looking for doesn't exist.</p>
                <Button onClick={() => navigate('/assignments')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Projects
                </Button>
            </div>
        );
    }

    const daysLeft = differenceInDays(new Date(project.deadline), new Date());
    const courseName = project.courseId
        ? courses.find(c => c.id === project.courseId)?.name || 'Unknown Course'
        : 'Personal Project';

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

    const getPriorityBadge = (priority: string) => {
        const colors = {
            high: 'bg-red-500/10 text-red-500',
            medium: 'bg-blue-500/10 text-blue-500',
            low: 'bg-green-500/10 text-green-500',
        };
        return (
            <Badge variant="secondary" className={colors[priority as keyof typeof colors] || ''}>
                {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
            </Badge>
        );
    };

    const handleDelete = async () => {
        await deleteProject(project.id);
        toast.success("Project Deleted", {
            description: `"${project.title}" has been removed.`,
            action: { label: "Undo", onClick: () => undo() },
        });
        navigate('/assignments?tab=projects');
    };

    return (
        <ScrollArea className="h-[calc(100vh-3rem)]">
        <div className="space-y-6 p-6 pr-4">
            {/* Header with Back Button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/assignments?tab=projects')}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold">{project.title}</h1>
                            {getStatusBadge(project.status)}
                        </div>
                        <p className="text-muted-foreground">{courseName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setIsLogProgressOpen(true)}>
                        <Clock className="w-4 h-4 mr-2" />
                        Log Progress
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit
                    </Button>
                    <Button variant="destructive" className="text-white" onClick={() => setIsDeleteDialogOpen(true)}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            Progress
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{project.totalProgress}%</div>
                        <Progress value={project.totalProgress} className="mt-2 h-2" />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Deadline
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{format(new Date(project.deadline), 'MMM d')}</div>
                        <p className={cn(
                            "text-sm mt-1",
                            daysLeft < 0 ? "text-red-500" : daysLeft <= 3 ? "text-amber-500" : "text-muted-foreground"
                        )}>
                            {daysLeft < 0
                                ? `${Math.abs(daysLeft)} days overdue`
                                : daysLeft === 0
                                    ? 'Due today'
                                    : `${daysLeft} days left`}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            Priority
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {getPriorityBadge(project.priority)}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Sessions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{(project as any).progressHistory?.length || 0}</div>
                        <p className="text-sm text-muted-foreground">Total sessions</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs Content */}
            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="progress">Progress History</TabsTrigger>
                    <TabsTrigger value="assets">Assets & Files</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    {project.description && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Description</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground whitespace-pre-wrap">{project.description}</p>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Details</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Created</p>
                                <p>{format(new Date(project.createdAt), 'MMMM d, yyyy')}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Deadline</p>
                                <p>{format(new Date(project.deadline), 'MMMM d, yyyy')}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Status</p>
                                <p className="capitalize">{project.status}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Priority</p>
                                <p className="capitalize">{project.priority}</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="progress" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Progress History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!(project as any).progressHistory || (project as any).progressHistory.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>No progress logged yet.</p>
                                    <Button
                                        variant="outline"
                                        className="mt-4"
                                        onClick={() => setIsLogProgressOpen(true)}
                                    >
                                        Log Your First Progress
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {(project as any).progressHistory.map((entry: any, idx: number) => (
                                        <div key={idx} className="flex items-start gap-4 pb-4 border-b last:border-0">
                                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {entry.progress}%
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium">{entry.note || 'Progress update'}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {format(new Date(entry.date), 'MMM d, yyyy h:mm a')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="assets" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Assets & Files</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {attachments.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>No files or links attached yet.</p>
                                    <p className="text-sm mt-2 font-medium cursor-pointer text-primary hover:underline" onClick={() => setIsEditModalOpen(true)}>Manage in Edit Project</p>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {attachments.map((attachment) => (
                                        <div
                                            key={attachment.id}
                                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors group cursor-pointer"
                                            onClick={() => handleOpenAttachment(attachment)}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden w-full">
                                                <div className="h-10 w-10 flex-shrink-0 rounded bg-primary/10 flex items-center justify-center text-primary">
                                                    {attachment.type === 'link' ? (
                                                        <LinkIcon className="w-5 h-5" />
                                                    ) : (
                                                        <FileText className="w-5 h-5" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium truncate" title={attachment.name}>{attachment.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                        {attachment.type === 'link' ? 'Open Link' : 'Open File'}
                                                        <ExternalLink className="w-3 h-3" />
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modals */}
            <ProjectModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                editingId={project.id}
                initialData={project}
            />

            <LogProgressDialog
                isOpen={isLogProgressOpen}
                onClose={() => setIsLogProgressOpen(false)}
                projectId={project.id}
                currentProgress={project.totalProgress}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete "{project.title}" and all its progress history.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
        </ScrollArea>
    );
};

export default ProjectDetail;
