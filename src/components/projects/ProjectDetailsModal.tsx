import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Project, ProjectAttachment } from '@/types/models';
import { useStore } from '@/store/useStoreNew';
import {
    Calendar, Clock, FileText, Link as LinkIcon,
    Download, ExternalLink, Plus
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ProjectDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string | null;
    onEdit: (project: Project) => void;
    onLogProgress: (project: Project) => void;
}

const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({ isOpen, onClose, projectId, onEdit, onLogProgress }) => {
    // Use direct store access to avoid object recreation
    const projects = useStore(state => state.projects);
    const fetchProjectSessions = useStore(state => state.fetchProjectSessions);
    const fetchProjectAttachments = useStore(state => state.fetchProjectAttachments);
    const projectSessions = useStore(state => state.projectSessions);
    const projectAttachments = useStore(state => state.projectAttachments);
    const courses = useStore(state => state.courses);

    const project = projectId ? projects.find(p => p.id === projectId) : null;
    const sessions = projectId ? (projectSessions[projectId] || []) : [];
    const attachments = projectId ? (projectAttachments[projectId] || []) : [];

    useEffect(() => {
        if (isOpen && projectId) {
            // Only fetch if we don't have data yet
            if (!projectSessions[projectId]) {
                fetchProjectSessions(projectId);
            }
            if (!projectAttachments[projectId]) {
                fetchProjectAttachments(projectId);
            }
        }
    }, [isOpen, projectId]); // Removed functions from dependencies

    if (!project) return null;

    const course = courses.find(c => c.id === project.courseId);

    // Stats Calculation
    const totalMinutes = sessions.reduce((acc, s) => acc + s.duration, 0);
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const sessionCount = sessions.length;
    const avgSessionMinutes = sessionCount > 0 ? Math.round(totalMinutes / sessionCount) : 0;
    const avgHours = Math.floor(avgSessionMinutes / 60);
    const avgRemMinutes = avgSessionMinutes % 60;

    const daysLeft = project.deadline && !isNaN(new Date(project.deadline).getTime())
        ? differenceInDays(new Date(project.deadline), new Date())
        : 0;
    const isValidDeadline = project.deadline && !isNaN(new Date(project.deadline).getTime());

    const handleOpenAttachment = (att: ProjectAttachment) => {
        if (att.type === 'link') {
            // @ts-ignore
            window.electronAPI.utils.openExternal(att.path);
        } else {
            // @ts-ignore
            window.electronAPI.utils.openPath(att.path);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 overflow-hidden bg-background">
                <div className="p-6 pb-2">
                    {/* Header */}
                    <div className="mb-4">
                        <DialogTitle className="text-2xl font-bold tracking-tight mb-2">{project.title}</DialogTitle>
                        <DialogDescription className="hidden">
                            Detailed view of project {project.title}
                        </DialogDescription>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {course && (
                                <>
                                    <span className="font-medium text-primary">{course.name}</span>
                                    <span>•</span>
                                </>
                            )}
                            <span className={daysLeft < 0 ? 'text-destructive' : ''}>
                                Due: {isValidDeadline ? format(new Date(project.deadline), 'MMM d, yyyy') : 'No Deadline'}
                            </span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex items-center gap-4 mb-6">
                        <span className="text-sm font-medium w-24">Progress: {project.totalProgress}%</span>
                        <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-500 ease-out"
                                style={{ width: `${project.totalProgress}%` }}
                            />
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border border-border/50 mb-6">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Time</p>
                            <p className="font-mono text-lg font-medium">
                                {totalHours}h {remainingMinutes}m
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Sessions</p>
                            <p className="font-mono text-lg font-medium">{sessionCount}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Session</p>
                            <p className="font-mono text-lg font-medium">
                                {avgHours}h {avgRemMinutes}m
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Days Left</p>
                            <p className={cn("font-mono text-lg font-medium", daysLeft < 3 ? "text-destructive" : "")}>
                                {daysLeft}
                            </p>
                        </div>
                    </div>
                </div>

                <ScrollArea className="max-h-[calc(90vh-300px)] px-6 pb-6 pr-8">
                    <div className="space-y-8 pr-2">
                        {/* Attachments */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                Attachments
                                <Badge variant="secondary" className="text-xs h-5 px-1.5">{attachments.length}</Badge>
                            </h3>

                            <div className="bg-card border rounded-md divide-y">
                                {attachments.length > 0 ? (
                                    attachments.map(att => (
                                        <div key={att.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors group">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                                                    {att.type === 'link' ? <LinkIcon className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-orange-500" />}
                                                </div>
                                                <div className="min-w-0">
                                                    {/* @ts-ignore */}
                                                    <p className="text-sm font-medium truncate">{att.title || att.name || "Attachment"}</p>
                                                    {att.size && <p className="text-xs text-muted-foreground">{(att.size / 1024 / 1024).toFixed(1)} MB</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenAttachment(att)}>
                                                    {att.type === 'link' ? <ExternalLink className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-sm text-muted-foreground">No attachments</div>
                                )}
                            </div>
                        </div>

                        {/* Progress History */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold">Progress History</h3>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs whitespace-nowrap flex-shrink-0"
                                    onClick={() => onLogProgress(project)}
                                >
                                    Log Progress
                                </Button>
                            </div>

                            <div className="relative border-l-2 border-muted ml-3 space-y-6 pl-6 py-2">
                                {sessions.length > 0 ? (
                                    sessions.sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()).map((session) => (
                                        <div key={session.id} className="relative">
                                            <div className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 mb-1">
                                                <div className="text-sm font-medium">
                                                    {format(new Date(session.sessionDate), 'MMM d, yyyy - HH:mm')}
                                                </div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                    <Badge variant="outline" className="font-mono text-[10px]">
                                                        {Math.floor(session.duration / 60)}h {session.duration % 60}m
                                                    </Badge>
                                                    <span className={`font-medium ${(session.progressAfter - session.progressBefore) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {(session.progressAfter - session.progressBefore) > 0 ? '+' : ''}{session.progressAfter - session.progressBefore}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-sm text-muted-foreground bg-muted/40 p-3 rounded-md mt-2">
                                                "{session.note || 'No description provided'}"
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm text-muted-foreground">No sessions logged yet.</div>
                                )}
                            </div>
                            {sessions.length > 3 && (
                                <div className="text-center pt-2">
                                    <Button variant="link" size="sm" className="text-muted-foreground">Load More...</Button>
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default ProjectDetailsModal;
