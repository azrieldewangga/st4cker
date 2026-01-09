import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStoreNew';
import { Project, ProjectAttachment } from '@/types/models';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Link as LinkIcon, FileText, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface ProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingId: string | null;
    initialData: Project | null;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, editingId, initialData }) => {
    // Use new store directly to avoid object creation
    const addProject = useStore(state => state.addProject);
    const updateProject = useStore(state => state.updateProject);
    const getProjectById = useStore(state => state.getProjectById);
    const courses = useStore(state => state.courses);
    const userProfile = useStore(state => state.userProfile);
    const fetchProjectAttachments = useStore(state => state.fetchProjectAttachments);
    const addProjectAttachment = useStore(state => state.addProjectAttachment);
    const deleteProjectAttachment = useStore(state => state.deleteProjectAttachment);
    const projectAttachments = useStore(state => state.projectAttachments);

    // Form State
    const [projectType, setProjectType] = useState<'course' | 'personal'>('course');
    const [formData, setFormData] = useState({
        title: '',
        courseId: null as string | null,
        description: '',
        priority: 'medium' as 'low' | 'medium' | 'high',
        status: 'active' as 'active' | 'completed' | 'on-hold',
        startDate: new Date(),
        deadline: new Date(),
    });

    // Attachment State
    const [localAttachments, setLocalAttachments] = useState<ProjectAttachment[]>([]);
    const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<string[]>([]);
    const [isAddingLink, setIsAddingLink] = useState(false);
    const [linkForm, setLinkForm] = useState({ title: '', url: '' });
    const [isDragging, setIsDragging] = useState(false);
    const dropRef = React.useRef<HTMLDivElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                // @ts-ignore
                const path = window.electronAPI.utils.getPathForFile(file);
                if (path) {
                    const newAtt: ProjectAttachment = {
                        id: crypto.randomUUID(),
                        projectId: '',
                        type: 'file',
                        name: file.name,
                        path: path,
                        createdAt: new Date().toISOString()
                    };
                    setLocalAttachments(prev => [...prev, newAtt]);
                }
            });
            e.target.value = '';
        }
    };

    // Initial Data Load
    useEffect(() => {
        if (isOpen) {
            setDeletedAttachmentIds([]);
            setLocalAttachments([]); // Reset attachments

            if (initialData) {
                setFormData({
                    title: initialData.title,
                    courseId: initialData.courseId,
                    description: initialData.description || '',
                    priority: initialData.priority,
                    status: initialData.status || 'active',
                    startDate: new Date(initialData.startDate),
                    deadline: new Date(initialData.deadline),
                });
                setProjectType(initialData.courseId === null ? 'personal' : 'course');
                fetchProjectAttachments(initialData.id);
            } else if (editingId) {
                const loadProject = async () => {
                    const project = await getProjectById(editingId);
                    if (project) {
                        setFormData({
                            title: project.title,
                            courseId: project.courseId,
                            description: project.description || '',
                            priority: project.priority,
                            status: project.status || 'active',
                            startDate: new Date(project.startDate),
                            deadline: new Date(project.deadline),
                        });
                        setProjectType(project.courseId === null ? 'personal' : 'course');
                        fetchProjectAttachments(editingId);
                    }
                };
                loadProject();
            } else {
                setFormData({
                    title: '',
                    courseId: null,
                    description: '',
                    priority: 'medium',
                    status: 'active',
                    startDate: new Date(),
                    deadline: new Date(),
                });
                setProjectType('course');
                setLocalAttachments([]);
            }
        }
    }, [isOpen, initialData, editingId]);

    // Sync Local Attachments with Store when Editing
    useEffect(() => {
        if (isOpen && (editingId || initialData?.id)) {
            const id = editingId || initialData?.id;
            if (id && projectAttachments[id]) {
                if (localAttachments.length === 0 && deletedAttachmentIds.length === 0) {
                    setLocalAttachments([...projectAttachments[id]]);
                }
            }
        }
    }, [isOpen, projectAttachments, editingId, initialData]);

    // Drag & Drop Logic
    useEffect(() => {
        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (dropRef.current && dropRef.current.contains(e.target as Node)) {
                setIsDragging(true);
            } else {
                setIsDragging(false);
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) {
                setIsDragging(false);
            }
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);

            if (dropRef.current && dropRef.current.contains(e.target as Node)) {
                const files = Array.from(e.dataTransfer?.files || []);
                files.forEach(file => {
                    // @ts-ignore
                    const path = window.electronAPI.utils.getPathForFile(file);
                    if (path) {
                        const newAtt: ProjectAttachment = {
                            id: crypto.randomUUID(),
                            projectId: '',
                            type: 'file',
                            name: file.name,
                            path: path,
                            createdAt: new Date().toISOString()
                        };
                        setLocalAttachments(prev => [...prev, newAtt]);
                    }
                });
            }
        };

        if (isOpen) {
            window.addEventListener('dragover', handleDragOver);
            window.addEventListener('dragleave', handleDragLeave);
            window.addEventListener('drop', handleDrop);
        }

        return () => {
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('drop', handleDrop);
        };
    }, [isOpen]);

    const handleAddLink = () => {
        if (linkForm.title && linkForm.url) {
            const newAtt: ProjectAttachment = {
                id: crypto.randomUUID(),
                projectId: '',
                type: 'link',
                name: linkForm.title,
                path: linkForm.url,
                createdAt: new Date().toISOString()
            };
            setLocalAttachments([...localAttachments, newAtt]);
            setLinkForm({ title: '', url: '' });
            setIsAddingLink(false);
        }
    };

    const handleDeleteAttachment = (id: string) => {
        setLocalAttachments(prev => prev.filter(a => a.id !== id));
        setDeletedAttachmentIds(prev => [...prev, id]);
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const projectData = {
            title: formData.title,
            description: formData.description,
            priority: formData.priority,
            courseId: projectType === 'course' ? formData.courseId : null, // Reverted to use projectType state
            startDate: formData.startDate.toISOString(),
            deadline: formData.deadline.toISOString(),
            semester: userProfile?.semester || 1,
            status: formData.status, // Kept formData.status as per instruction, but note original had editingId logic
            totalProgress: 0,
        };

        try {
            let targetProjectId = editingId;

            if (editingId) {
                await updateProject(editingId, projectData);
                toast.success("Project Updated", {
                    description: `"${formData.title}" has been successfully updated.`
                });
            } else {
                const newProject = await addProject(projectData);
                if (newProject) {
                    targetProjectId = newProject.id;
                    toast.success("Project Created", {
                        description: `"${formData.title}" has been successfully created.`
                    });
                }
            }

            if (targetProjectId) {
                for (const delId of deletedAttachmentIds) {
                    await deleteProjectAttachment(delId, targetProjectId);
                }

                const originalAttachments = projectAttachments[targetProjectId] || [];
                const originalIds = new Set(originalAttachments.map(a => a.id));

                for (const att of localAttachments) {
                    if (!originalIds.has(att.id)) {
                        await addProjectAttachment({
                            projectId: targetProjectId,
                            type: att.type,
                            name: att.name,
                            path: att.path
                        });
                    }
                }
            }

            onClose();
        } catch (error) {
            console.error("Failed to save project:", error);
            toast.error("Operation Failed", {
                description: "There was an error saving your project. Please try again."
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>{editingId ? 'Edit Project' : 'New Project'}</DialogTitle>
                    <DialogDescription>
                        {editingId ? 'Update your project details' : 'Create a new long-term project to track'}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[calc(90vh-120px)]">
                    <form onSubmit={handleSubmit} className="space-y-4 p-2 pr-4">
                        {/* Timeline */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date *</Label>
                                <DatePicker
                                    date={formData.startDate}
                                    setDate={(date) => date && setFormData(prev => ({ ...prev, startDate: date }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Deadline *</Label>
                                <DatePicker
                                    date={formData.deadline}
                                    setDate={(date) => date && setFormData(prev => ({ ...prev, deadline: date }))}
                                />
                            </div>
                        </div>

                        {/* Project Title */}
                        <div className="space-y-2">
                            <Label htmlFor="title">Project Title *</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Final Year Thesis"
                                required
                            />
                        </div>

                        {/* Project Type */}
                        <div className="space-y-4">
                            <Label>Project Type *</Label>
                            <RadioGroup
                                value={projectType}
                                onValueChange={(val) => setProjectType(val as 'course' | 'personal')}
                                className="flex flex-col gap-2"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="course" id="r-course" />
                                    <Label htmlFor="r-course" className="font-normal cursor-pointer">Course Project</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="personal" id="r-personal" />
                                    <Label htmlFor="r-personal" className="font-normal cursor-pointer">Personal Project</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {/* Priority and Course Selection */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="priority">Priority *</Label>
                                <Select
                                    value={formData.priority}
                                    onValueChange={(val) => setFormData({ ...formData, priority: val as 'low' | 'medium' | 'high' })}
                                >
                                    <SelectTrigger id="priority">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {projectType === 'course' && (
                                <div className="space-y-2">
                                    <Label htmlFor="course-select">Course/Subject *</Label>
                                    <Select
                                        value={formData.courseId || ''}
                                        onValueChange={(val) => setFormData({ ...formData, courseId: val })}
                                    >
                                        <SelectTrigger id="course-select">
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
                                </div>
                            )}
                        </div>

                        {/* Status (Edit only) */}
                        {editingId && (
                            <div className="w-1/2 pr-2 mb-4">
                                <Label htmlFor="status">Status *</Label>
                                <Select
                                    value={formData.status || 'active'}
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, status: val as 'active' | 'completed' | 'on-hold' }))}
                                >
                                    <SelectTrigger id="status">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="on-hold">On Hold</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Develop a web-based student productivity dashboard..."
                                rows={3}
                            />
                        </div>

                        {/* Attachments */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Attachments</Label>
                                <div className="flex gap-2">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        multiple
                                        onChange={handleFileSelect}
                                    />
                                    <Button type="button" variant="outline" size="sm" onClick={() => setIsAddingLink(!isAddingLink)}>
                                        <LinkIcon className="w-3 h-3 mr-2" />
                                        Add Link
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                        <FileText className="w-3 h-3 mr-2" />
                                        Add Material
                                    </Button>
                                </div>
                            </div>

                            {isAddingLink && (
                                <div className="p-3 bg-muted rounded-md space-y-2 animate-in slide-in-from-top-2 border">
                                    <Input
                                        placeholder="Title (e.g., References)"
                                        value={linkForm.title}
                                        onChange={e => setLinkForm(p => ({ ...p, title: e.target.value }))}
                                        className="h-8 bg-background"
                                    />
                                    <Input
                                        placeholder="URL"
                                        value={linkForm.url}
                                        onChange={e => setLinkForm(p => ({ ...p, url: e.target.value }))}
                                        className="h-8 bg-background"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddLink();
                                            }
                                        }}
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button type="button" size="sm" variant="ghost" onClick={() => setIsAddingLink(false)}>Cancel</Button>
                                        <Button type="button" size="sm" onClick={handleAddLink} disabled={!linkForm.url || !linkForm.title}>Add Link</Button>
                                    </div>
                                </div>
                            )}

                            <div
                                ref={dropRef}
                                className={cn(
                                    "rounded-md border p-4 space-y-2 min-h-[100px] transition-colors flex flex-col justify-center items-center",
                                    isDragging ? "border-primary bg-primary/5 border-dashed" : "border-dashed border-border bg-muted/30"
                                )}
                            >
                                {localAttachments.length === 0 ? (
                                    <div className="text-center text-sm text-muted-foreground">
                                        {isDragging ? (
                                            <p className="font-medium text-primary">Drop files here to upload</p>
                                        ) : (
                                            <>
                                                <p>Drag & drop files here</p>
                                                <p className="text-xs opacity-70 mt-1">or add a link above</p>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="w-full space-y-2">
                                        {localAttachments.map((att) => (
                                            <div key={att.id} className="flex items-center justify-between p-2 bg-background border rounded-md group">
                                                <div className="flex items-center gap-2 truncate flex-1 md:max-w-xs">
                                                    {att.type === 'link' ? <LinkIcon className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-orange-500" />}
                                                    <span className="text-sm truncate">
                                                        {/* @ts-ignore */}
                                                        {att.title || att.name}
                                                    </span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleDeleteAttachment(att.id)}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        {isDragging && (
                                            <div className="text-center py-2 text-xs text-primary font-medium border-t border-dashed mt-2">
                                                Drop more files to add
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                {editingId ? 'Update Project' : 'Create Project'}
                            </Button>
                        </div>
                    </form>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default ProjectModal;
