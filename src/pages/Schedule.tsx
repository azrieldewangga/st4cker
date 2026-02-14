import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStoreNew';
import { Calendar, Clock, Search, X, MapPin, User as UserIcon, RefreshCw, Trash2, Edit2, Link as LinkIcon, FileText, ExternalLink, Plus } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { toast } from "sonner";

// Shadcn Components
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { SkeletonCard } from '../components/shared/Skeleton';
import { EmptyState } from '../components/shared/EmptyState';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const TIMES = [
    '08:00', '08:50', '09:00', '09:40', '10:00',
    '10:30', '11:00', '11:20', '12:00', '13:00',
    '13:50', '14:00', '14:40', '15:00', '16:00'
];

// Grid Colors
// Dynamic colors that look good in both light and dark themes
const COLOR_VARIANTS = [
    "bg-blue-500/20 dark:bg-blue-400/20 text-blue-700 dark:text-blue-300 border-blue-500/30 dark:border-blue-400/40",
    "bg-emerald-500/20 dark:bg-emerald-400/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 dark:border-emerald-400/40",
    "bg-purple-500/20 dark:bg-purple-400/20 text-purple-700 dark:text-purple-300 border-purple-500/30 dark:border-purple-400/40",
    "bg-amber-500/20 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300 border-amber-500/30 dark:border-amber-400/40",
    "bg-rose-500/20 dark:bg-rose-400/20 text-rose-700 dark:text-rose-300 border-rose-500/30 dark:border-rose-400/40",
    "bg-cyan-500/20 dark:bg-cyan-400/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 dark:border-cyan-400/40",
    "bg-indigo-500/20 dark:bg-indigo-400/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 dark:border-indigo-400/40",
];

const Schedule = () => {
    // Use direct store access to prevent object recreation
    const courses = useStore(state => state.courses);
    const fetchCourses = useStore(state => state.fetchCourses);
    const userProfile = useStore(state => state.userProfile);
    const schedule = useStore(state => state.schedule);
    const fetchSchedule = useStore(state => state.fetchSchedule);
    const setScheduleItem = useStore(state => state.setScheduleItem);
    const syncScheduleToBackend = useStore(state => state.syncScheduleToBackend);
    const performanceRecords = useStore(state => state.performanceRecords);
    const theme = useStore(state => state.theme);
    const fetchMaterials = useStore(state => state.fetchMaterials);
    const materials = useStore(state => state.materials);
    const addMaterial = useStore(state => state.addMaterial);
    const deleteMaterial = useStore(state => state.deleteMaterial);
    const undo = useStore(state => state.undo);
    const [isSyncing, setIsSyncing] = useState(false);

    // UI State
    const [searchTerm, setSearchTerm] = useState('');

    // Popover State
    const [activeSlot, setActiveSlot] = useState<{ day: string, time: string } | null>(null);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

    // Dialog State
    const [detailSlot, setDetailSlot] = useState<{ day: string, time: string, data: any } | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Editing State
    const [isEditingDetail, setIsEditingDetail] = useState(false);
    const [editForm, setEditForm] = useState({ room: '', lecturer: '' });

    // Link Form
    const [isAddingLink, setIsAddingLink] = useState(false);
    const [linkForm, setLinkForm] = useState({ title: '', url: '' });

    // Material State
    const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
    const [editMaterialForm, setEditMaterialForm] = useState({ title: '', url: '', type: 'link' as 'link' | 'file' });
    const [localMaterials, setLocalMaterials] = useState<any[]>([]); // Deferred materials state

    // Context Menu
    const [contextMenu, setContextMenu] = useState<{ day: string, time: string, x: number, y: number } | null>(null);

    // Sync local materials when entering edit mode
    useEffect(() => {
        if (isEditingDetail && detailSlot) {
            setLocalMaterials([...(materials[detailSlot.data.course.id] || [])]);
        }
    }, [isEditingDetail, detailSlot]);

    useEffect(() => {
        fetchCourses();
        fetchSchedule();
        const closeContextMenu = () => setContextMenu(null);
        window.addEventListener('click', closeContextMenu);
        return () => window.removeEventListener('click', closeContextMenu);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setContextMenu(null);
        };
        if (contextMenu) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [contextMenu]);

    // Helper: Logic to resolve course from slot
    const getCourseForSlot = (day: string, time: string) => {
        const item = schedule[`${day}-${time}`];
        if (!item || !item.course) return null;

        let course = courses.find(c => c.id === item.course);
        // Fallbacks logic (legacy/db mismatch)
        if (!course && item.course) {
            course = courses.find(c => c.name === item.course || (c.name && item.course && c.name.toLowerCase() === item.course.toLowerCase()));
        }
        if (!course && performanceRecords) {
            course = performanceRecords.find(c => c.id === item.course);
            if (!course && item.course) {
                course = performanceRecords.find(c => c.name === item.course || (c.name && c.name.toLowerCase() === item.course.toLowerCase()));
            }
        }
        // Minimal fallback
        if (!course && item.course) {
            course = {
                id: item.course,
                name: item.course,
                sks: 0,
                semester: userProfile?.semester || 1,
                grade: undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }

        // Color Logic
        let className = "bg-muted text-muted-foreground border-border";
        if (course) {
            const hash = (course.id || course.name).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            className = COLOR_VARIANTS[hash % COLOR_VARIANTS.length];
        }

        return {
            ...item,
            course,
            className,
            room: item.location || '',
            lecturer: item.lecturer || ''
        };
    };

    // Handlers
    const handleSlotClick = async (day: string, time: string, slotData: any) => {
        if (slotData) {
            const data = getCourseForSlot(day, time);
            if (data?.course?.id) await fetchMaterials(data.course.id);

            setDetailSlot({ day, time, data });
            setEditForm({ room: data?.room || '', lecturer: data?.lecturer || '' });
            setIsEditingDetail(false);
            setIsDetailOpen(true);
        } else {
            setActiveSlot({ day, time });
            setSearchTerm('');
            setIsSelectorOpen(true);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, day: string, time: string, slotData: any) => {
        if (slotData) {
            e.preventDefault();
            e.stopPropagation();

            // Calculate position with viewport bounds
            const menuWidth = 160;
            const menuHeight = 80;
            let x = e.clientX;
            let y = e.clientY;

            // Adjust for right edge
            if (x + menuWidth > window.innerWidth) {
                x = window.innerWidth - menuWidth - 10;
            }
            // Adjust for bottom edge
            if (y + menuHeight > window.innerHeight) {
                y = window.innerHeight - menuHeight - 10;
            }

            setContextMenu({ day, time, x, y });
        }
    };

    const handleSelectCourse = async (courseId: string) => {
        if (!activeSlot) return;
        setIsSyncing(true);
        try {
            if (courseId) {
                const course = courses.find(c => c.id === courseId);
                await setScheduleItem(activeSlot.day, activeSlot.time, courseId, 'dynamic', course?.location || '', course?.lecturer || '');
            } else {
                await setScheduleItem(activeSlot.day, activeSlot.time, '', '');
            }
            // Auto-sync to backend
            if (syncScheduleToBackend) {
                await syncScheduleToBackend();
                toast.success('Schedule synced to server');
            }
        } catch (error) {
            toast.error('Failed to sync schedule');
        } finally {
            setIsSyncing(false);
            setIsSelectorOpen(false);
        }
    };

    const handleSaveDetail = async () => {
        if (!detailSlot) return;
        await setScheduleItem(detailSlot.day, detailSlot.time, detailSlot.data.course.id, 'dynamic', editForm.room, editForm.lecturer);

        // Update Course Info
        if (detailSlot.data.course) {
            const updatedCourse = {
                ...detailSlot.data.course,
                location: editForm.room,
                lecturer: editForm.lecturer,
                updatedAt: new Date().toISOString()
            };
            // @ts-ignore
            if (window.electronAPI) await window.electronAPI.performance.upsertCourse(updatedCourse);

            // --- Save Materials Changes ---
            const originalMaterials = materials[detailSlot.data.course.id] || [];

            // 1. Find Deletions (In original but not in local)
            const localIds = new Set(localMaterials.map(m => m.id));
            const toDelete = originalMaterials.filter(m => !localIds.has(m.id));

            for (const m of toDelete) {
                await deleteMaterial(m.id, detailSlot.data.course.id);
            }

            // 2. Find Additions (In local but not in original, OR temp IDs)
            const originalIds = new Set(originalMaterials.map(m => m.id));
            const toAdd = localMaterials.filter(m => m.id.startsWith('temp-') || !originalIds.has(m.id));

            for (const m of toAdd) {
                await addMaterial(detailSlot.data.course.id, m.type, m.title, m.url);
            }

            // 3. Find Updates
            const toUpdate = localMaterials.filter(m => {
                if (m.id.startsWith('temp-')) return false; // Already handled in add
                const orig = originalMaterials.find(o => o.id === m.id);
                if (!orig) return false;
                return orig.title !== m.title || orig.url !== m.url;
            });

            for (const m of toUpdate) {
                await deleteMaterial(m.id, detailSlot.data.course.id);
                await addMaterial(detailSlot.data.course.id, m.type, m.title, m.url);
            }

            await fetchCourses();
            await fetchMaterials(detailSlot.data.course.id);
            
            // Auto-sync to backend
            if (syncScheduleToBackend) {
                await syncScheduleToBackend();
                toast.success('Schedule synced to server');
            } else {
                toast.success("Details Updated", {
                    description: detailSlot.data.course.name,
                });
            }
        }
        setIsEditingDetail(false);
        setIsDetailOpen(false);
        setDetailSlot(null);
    };

    const handleAddMaterial = async (type: 'link' | 'file') => {
        if (!detailSlot) return;

        let newItem: any = {
            id: `temp-${Date.now()}`,
            courseId: detailSlot.data.course.id,
            type,
            title: '',
            url: ''
        };

        if (type === 'link') {
            if (!linkForm.url || !linkForm.title) return;
            // Normalize URL
            let normalizedUrl = linkForm.url.trim();
            if (!normalizedUrl.match(/^https?:\/\//i)) {
                normalizedUrl = 'https://' + normalizedUrl;
            }
            newItem.title = linkForm.title;
            newItem.url = normalizedUrl;

            setLocalMaterials(prev => [...prev, newItem]);
            setIsAddingLink(false);
            setLinkForm({ title: '', url: '' });
        } else {
            // @ts-ignore
            const result = await window.electronAPI.dialog.openFile();
            if (!result.canceled && result.filePaths.length > 0) {
                const path = result.filePaths[0];
                const fileName = path.split('\\').pop() || 'File';

                newItem.title = fileName;
                newItem.url = path;
                setLocalMaterials(prev => [...prev, newItem]);
            }
        }
    };

    // DnD State
    const [isDragging, setIsDragging] = useState(false);

    // Dialog mount listener
    const dropRef = useCallback((node: HTMLDivElement | null) => {
        if (!node) return;

        const handleEnter = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
        };

        const handleOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
            setIsDragging(true);
        };

        const handleLeave = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (node.contains(e.relatedTarget as Node)) return;
            setIsDragging(false);
        };

        const handleDropNative = async (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);

            if (!detailSlot || !e.dataTransfer?.files || e.dataTransfer.files.length === 0) return;

            const files = Array.from(e.dataTransfer.files);
            const newItems: any[] = [];

            for (const file of files) {
                // @ts-ignore
                let path = file.path;
                // @ts-ignore
                if (!path && window.electronAPI?.utils?.getPathForFile) {
                    // @ts-ignore
                    path = window.electronAPI.utils.getPathForFile(file);
                }

                if (path) {
                    newItems.push({
                        id: `temp-${Date.now()}-${Math.random()}`,
                        courseId: detailSlot.data.course.id,
                        type: 'file',
                        title: file.name,
                        url: path
                    });
                } else {
                    toast.error("Path missing. Try a local file.");
                }
            }

            if (newItems.length > 0) {
                setLocalMaterials(prev => [...prev, ...newItems]);
                toast.info("Files Staged", { description: "Don't forget to click Save Changes" });
            }
        };

        node.addEventListener('dragenter', handleEnter);
        node.addEventListener('dragover', handleOver);
        node.addEventListener('dragleave', handleLeave);
        node.addEventListener('drop', handleDropNative);

        return () => {
            node.removeEventListener('dragenter', handleEnter);
            node.removeEventListener('dragover', handleOver);
            node.removeEventListener('dragleave', handleLeave);
            node.removeEventListener('drop', handleDropNative);
        };
    }, [detailSlot]);



    const handleUpdateMaterial = async () => {
        if (!detailSlot || !editingMaterialId || !editMaterialForm.title || !editMaterialForm.url) return;

        // Normalize URL if it's a link - add https:// if missing protocol
        let normalizedUrl = editMaterialForm.url.trim();
        if (editMaterialForm.type === 'link' && !normalizedUrl.match(/^https?:\/\//i)) {
            normalizedUrl = 'https://' + normalizedUrl;
        }

        // Update Local State
        setLocalMaterials(prev => prev.map(m => {
            if (m.id === editingMaterialId) {
                return { ...m, title: editMaterialForm.title, url: normalizedUrl, type: editMaterialForm.type };
            }
            return m;
        }));

        setEditingMaterialId(null);
        setEditMaterialForm({ title: '', url: '', type: 'link' });
    };

    const handleDeleteMaterial = (id: string) => {
        setLocalMaterials(prev => prev.filter(m => m.id !== id));
    };

    // Filtered courses for selector
    const filteredCourses = courses.filter(c => c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <ScrollArea className="h-[calc(100vh-3rem)]">
        <div className="flex flex-col space-y-6 p-6 pr-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Schedule</h2>
                    <p className="text-sm text-muted-foreground mt-1">Manage your weekly classes.</p>
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={async () => {
                        setIsSyncing(true);
                        try {
                            await syncScheduleToBackend?.();
                            toast.success('Schedule synced to server');
                        } catch (e) {
                            toast.error('Failed to sync schedule');
                        } finally {
                            setIsSyncing(false);
                        }
                    }}
                    disabled={isSyncing}
                    className="gap-2"
                >
                    <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                    {isSyncing ? 'Syncing...' : 'Sync to Server'}
                </Button>
            </div>

            <Card className="flex-1 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1 h-full" orientation="horizontal">
                    <div className="min-w-[800px]">
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-muted/50 sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th className="p-4 w-20 border-b font-medium text-muted-foreground">Time</th>
                                {DAYS.map(day => (
                                    <th key={day} className="p-4 border-b font-medium min-w-[150px]">{day}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {TIMES.map(time => (
                                <tr key={time} className="group">
                                    <td className="p-2 border-r border-b text-xs text-muted-foreground font-mono bg-muted/20 sticky left-0 text-center">
                                        {time}
                                    </td>
                                    {DAYS.map(day => {
                                        const slotData = getCourseForSlot(day, time);
                                        return (
                                            <td key={`${day}-${time}`} className="p-1 border-b border-r last:border-r-0 h-16 relative">
                                                <div
                                                    onClick={() => handleSlotClick(day, time, slotData)}
                                                    onContextMenu={(e) => handleContextMenu(e, day, time, slotData)}
                                                    className={cn(
                                                        "w-full h-full rounded-md p-2 cursor-pointer transition-all border text-xs flex flex-col justify-center items-center text-center",
                                                        slotData ? slotData.className : "border-transparent hover:bg-muted/50 opacity-0 hover:opacity-100 placeholder-slot"
                                                    )}
                                                >
                                                    {slotData ? (
                                                        <>
                                                            <div className="font-semibold truncate w-full">{slotData.course?.name}</div>
                                                            {slotData.room && (
                                                                <div className="flex items-center justify-center gap-1 opacity-70 mt-1 text-[10px]">
                                                                    <MapPin size={10} /> {slotData.room}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center justify-center h-full">
                                                            <Plus className="w-4 h-4 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </ScrollArea>
            </Card>

            {/* Selector Popover */}
            <Dialog open={isSelectorOpen} onOpenChange={setIsSelectorOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Select Course</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search course..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <ScrollArea className="h-[300px]">
                            <div className="space-y-1 p-1">
                                {filteredCourses.map(course => (
                                    <Button
                                        key={course.id}
                                        variant="ghost"
                                        className="w-full justify-start font-normal h-auto py-3"
                                        onClick={() => handleSelectCourse(course.id)}
                                    >
                                        <div className="flex flex-col items-start gap-1 w-full overflow-hidden">
                                            <span className="font-medium truncate w-full text-left">{course.name}</span>
                                            <Badge variant="outline" className="text-[10px]">{course.sks} SKS</Badge>
                                        </div>
                                    </Button>
                                ))}
                                {filteredCourses.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No courses found</p>}
                            </div>
                        </ScrollArea>
                        <Button variant="destructive" className="w-full" onClick={() => handleSelectCourse('')} aria-label="Clear selected slot">Clear Slot</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{detailSlot?.data.course?.name}</DialogTitle>
                    </DialogHeader>
                    {!isEditingDetail ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground text-xs uppercase">Room</Label>
                                    <div className="flex items-center gap-2 font-medium">
                                        <MapPin className="w-4 h-4" /> {detailSlot?.data.room || '-'}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground text-xs uppercase">Lecturer</Label>
                                    <div className="flex items-center gap-2 font-medium">
                                        <UserIcon className="w-4 h-4" /> {detailSlot?.data.lecturer || '-'}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-muted-foreground text-xs uppercase">Materials</Label>
                                </div>
                                <div
                                    ref={dropRef}
                                    className={cn(
                                        "rounded-md border p-2 space-y-2 max-h-[150px] min-h-[100px] overflow-auto transition-colors flex flex-col justify-center select-text no-drag",
                                        isDragging ? "border-primary bg-primary/10 border-dashed" : "border-transparent"
                                    )}
                                >
                                    {((detailSlot && materials[detailSlot.data.course.id]) || []).length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic p-2 text-center pointer-events-none">
                                            No materials added yet. <span className="text-xs opacity-70 block mt-1">(Drag files here to add)</span>
                                        </p>
                                    ) : (
                                        (materials[detailSlot!.data.course.id] || []).map(m => (
                                            <div key={m.id} className="flex items-center justify-between text-sm p-1 hover:bg-muted rounded group">
                                                <a
                                                    href="#"
                                                    className="flex items-center gap-2 truncate flex-1"
                                                    onClick={(e: React.MouseEvent) => {
                                                        e.preventDefault();
                                                        // @ts-ignore
                                                        if (m.type === 'link') window.electronAPI.utils.openExternal(m.url);
                                                        // @ts-ignore
                                                        else window.electronAPI.utils.openPath(m.url);
                                                    }}
                                                >
                                                    {m.type === 'link' ? <LinkIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                                    <span className="truncate">{m.title}</span>
                                                </a>
                                                {/* Delete button removed in View Mode */}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsEditingDetail(true)}>Edit Details</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label>Room</Label>
                                <Input value={editForm.room} onChange={e => setEditForm(prev => ({ ...prev, room: e.target.value }))} placeholder="GK1-100" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Lecturer</Label>
                                <Input value={editForm.lecturer} onChange={e => setEditForm(prev => ({ ...prev, lecturer: e.target.value }))} placeholder="Lecturer Name" />
                            </div>

                            <div className="space-y-2 pt-4 border-t">
                                <Label>Add Material</Label>
                                <div className="flex gap-2">
                                    <Button variant="secondary" size="sm" onClick={() => setIsAddingLink(!isAddingLink)} aria-label="Add Link"><LinkIcon className="w-3 h-3 mr-2" /> Add Link</Button>
                                    <Button variant="secondary" size="sm" onClick={() => handleAddMaterial('file')} aria-label="Add File"><FileText className="w-3 h-3 mr-2" /> Add File</Button>
                                </div>
                                {isAddingLink && (
                                    <div className="p-3 bg-muted rounded-md space-y-2 animate-in slide-in-from-top-2">
                                        <Input
                                            placeholder="Title"
                                            value={linkForm.title}
                                            onChange={e => setLinkForm(p => ({ ...p, title: e.target.value }))}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && linkForm.url && linkForm.title) {
                                                    e.preventDefault();
                                                    handleAddMaterial('link');
                                                }
                                            }}
                                            className="h-8"
                                        />
                                        <Input
                                            placeholder="URL"
                                            value={linkForm.url}
                                            onChange={e => setLinkForm(p => ({ ...p, url: e.target.value }))}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && linkForm.url && linkForm.title) {
                                                    e.preventDefault();
                                                    handleAddMaterial('link');
                                                }
                                            }}
                                            className="h-8"
                                        />
                                        <Button size="sm" onClick={() => handleAddMaterial('link')} disabled={!linkForm.url}>Save Link</Button>
                                    </div>
                                )}

                                {/* Show Materials List in Edit Mode with Edit and Delete Buttons */}
                                <div
                                    ref={dropRef}
                                    className={cn(
                                        "rounded-md border p-2 space-y-2 max-h-[150px] min-h-[100px] overflow-auto mt-2 transition-colors flex flex-col justify-center select-text no-drag",
                                        isDragging ? "border-primary bg-primary/10 border-dashed" : "border-border"
                                    )}
                                >
                                    {localMaterials.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic p-2 text-center pointer-events-none">
                                            {isDragging ? "!!! DROP FILES NOW !!!" : (
                                                <>No materials added yet. <span className="text-xs opacity-70 block mt-1">(Drag files here to add)</span></>
                                            )}
                                        </p>
                                    ) : (
                                        localMaterials.map(m => (
                                            editingMaterialId === m.id ? (
                                                <div key={m.id} className="p-2 bg-muted/50 rounded space-y-2">
                                                    <Input
                                                        placeholder="Title"
                                                        value={editMaterialForm.title}
                                                        onChange={e => setEditMaterialForm(p => ({ ...p, title: e.target.value }))}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && editMaterialForm.title && editMaterialForm.url) {
                                                                e.preventDefault();
                                                                handleUpdateMaterial();
                                                            }
                                                        }}
                                                        className="h-7 text-xs"
                                                    />
                                                    <Input
                                                        placeholder="URL"
                                                        value={editMaterialForm.url}
                                                        onChange={e => setEditMaterialForm(p => ({ ...p, url: e.target.value }))}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && editMaterialForm.title && editMaterialForm.url) {
                                                                e.preventDefault();
                                                                handleUpdateMaterial();
                                                            }
                                                        }}
                                                        className="h-7 text-xs"
                                                    />
                                                    <div className="flex gap-1">
                                                        <Button size="sm" className="h-6 text-xs" onClick={handleUpdateMaterial}>Save</Button>
                                                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingMaterialId(null)}>Cancel</Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div key={m.id} className="flex items-center justify-between text-sm p-1 hover:bg-muted rounded group">
                                                    <div className="flex items-center gap-2 truncate flex-1 opacity-70">
                                                        {m.type === 'link' ? <LinkIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                                        <span className="truncate">{m.title}</span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 hover:bg-muted"
                                                            onClick={() => {
                                                                setEditingMaterialId(m.id);
                                                                setEditMaterialForm({ title: m.title, url: m.url, type: m.type });
                                                            }}
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleDeleteMaterial(m.id)}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="ghost" onClick={() => setIsEditingDetail(false)}>Cancel</Button>
                                <Button onClick={handleSaveDetail}>Save Changes</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Context Menu (Portal) */}
            {
                contextMenu && createPortal(
                    <div
                        className="fixed inset-0 z-[9999]"
                        onClick={() => setContextMenu(null)}
                        onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
                    >
                        <div
                            className="fixed bg-popover text-popover-foreground border border-border shadow-md rounded-md p-1 min-w-[150px] animate-in fade-in zoom-in-95"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                        >
                            <Button variant="ghost" className="w-full justify-start h-8 text-sm" onClick={() => {
                                const data = getCourseForSlot(contextMenu.day, contextMenu.time);
                                setDetailSlot({ day: contextMenu.day, time: contextMenu.time, data });
                                setEditForm({ room: data?.room || '', lecturer: data?.lecturer || '' });
                                setIsEditingDetail(true);
                                setIsDetailOpen(true);
                            }}>
                                <Edit2 className="w-3 h-3 mr-2" /> Edit
                            </Button>
                            <div className="h-px bg-border my-1" />
                            <Button variant="ghost" className="w-full justify-start h-8 text-sm text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => {
                                setScheduleItem(contextMenu.day, contextMenu.time, '', '', '', '');
                                setContextMenu(null);
                                toast.success("Slot Cleared", {
                                    action: { label: "Undo", onClick: () => undo() }
                                });
                            }}>
                                <Trash2 className="w-3 h-3 mr-2" /> Clear Slot
                            </Button>
                        </div>
                    </div>,
                    document.body
                )
            }
        </div>
        </ScrollArea>
    );
};

export default Schedule;
