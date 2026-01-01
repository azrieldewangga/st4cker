import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { Calendar, Clock, Search, X, MapPin, User as UserIcon, RefreshCw, Trash2, Edit2, Link as LinkIcon, FileText, ExternalLink, Plus } from 'lucide-react';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { toast } from "sonner";

// Shadcn Components
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

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const TIMES = [
    '08:00', '08:50', '09:00', '09:40', '10:00',
    '10:30', '11:00', '11:20', '12:00', '13:00',
    '13:50', '14:00', '14:40', '15:00', '16:00'
];

// Tailwind v4 / Shadcn variables for grid colors
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
    const {
        courses,
        fetchCourses,
        userProfile,
        schedule,
        fetchSchedule,
        setScheduleItem,
        performanceRecords,
        theme,
        fetchMaterials,
        materials,
        addMaterial,
        deleteMaterial,
        undo
    } = useStore();

    // Interaction States
    const [searchTerm, setSearchTerm] = useState('');

    // Selector State (Popover)
    const [activeSlot, setActiveSlot] = useState<{ day: string, time: string } | null>(null);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

    // Detail State (Dialog)
    const [detailSlot, setDetailSlot] = useState<{ day: string, time: string, data: any } | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Editing State
    const [isEditingDetail, setIsEditingDetail] = useState(false);
    const [editForm, setEditForm] = useState({ room: '', lecturer: '' });

    // Link Form
    const [isAddingLink, setIsAddingLink] = useState(false);
    const [linkForm, setLinkForm] = useState({ title: '', url: '' });

    // Context Menu State (Custom)
    const [contextMenu, setContextMenu] = useState<{ day: string, time: string, x: number, y: number } | null>(null);

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
            course = courses.find(c => c.name === item.course || c.name.toLowerCase() === item.course.toLowerCase());
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

    const handleSelectCourse = (courseId: string) => {
        if (!activeSlot) return;
        if (courseId) {
            const course = courses.find(c => c.id === courseId);
            setScheduleItem(activeSlot.day, activeSlot.time, courseId, 'dynamic', course?.location || '', course?.lecturer || '');
        } else {
            setScheduleItem(activeSlot.day, activeSlot.time, '', '');
        }
        setIsSelectorOpen(false);
    };

    const handleSaveDetail = async () => {
        if (!detailSlot) return;
        await setScheduleItem(detailSlot.day, detailSlot.time, detailSlot.data.course.id, 'dynamic', editForm.room, editForm.lecturer);

        // Update upsert
        if (detailSlot.data.course) {
            const updatedCourse = {
                ...detailSlot.data.course,
                location: editForm.room,
                lecturer: editForm.lecturer,
                updatedAt: new Date().toISOString()
            };
            // @ts-ignore
            if (window.electronAPI) await window.electronAPI.performance.upsertCourse(updatedCourse);
            fetchCourses();
            toast("Details have been updated", {
                description: detailSlot.data.course.name,
            });
        }
        setIsEditingDetail(false);
        setIsDetailOpen(false);
        setDetailSlot(null);
    };

    const handleAddMaterial = async (type: 'link' | 'file') => {
        if (!detailSlot) return;
        if (type === 'link') {
            if (!linkForm.url || !linkForm.title) return;
            await addMaterial(detailSlot.data.course.id, 'link', linkForm.title, linkForm.url);
            setIsAddingLink(false);
            setLinkForm({ title: '', url: '' });
        } else {
            // @ts-ignore
            const result = await window.electronAPI.dialog.openFile();
            if (!result.canceled && result.filePaths.length > 0) {
                const path = result.filePaths[0];
                const fileName = path.split('\\').pop() || 'File';
                await addMaterial(detailSlot.data.course.id, 'file', fileName, path);
            }
        }
    };

    // Filtered courses for selector
    const filteredCourses = courses.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Schedule</h2>
                    <p className="text-muted-foreground">Manage your weekly classes.</p>
                </div>
            </div>

            <Card className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
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
                        <div className="max-h-[300px] overflow-y-auto space-y-1">
                            {filteredCourses.map(course => (
                                <Button
                                    key={course.id}
                                    variant="ghost"
                                    className="w-full justify-start font-normal h-auto py-3"
                                    onClick={() => handleSelectCourse(course.id)}
                                >
                                    <div className="flex flex-col items-start gap-1">
                                        <span className="font-medium">{course.name}</span>
                                        <Badge variant="outline" className="text-[10px]">{course.sks} SKS</Badge>
                                    </div>
                                </Button>
                            ))}
                            {filteredCourses.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No courses found</p>}
                        </div>
                        <Button variant="destructive" className="w-full" onClick={() => handleSelectCourse('')}>Clear Slot</Button>
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
                                <div className="rounded-md border p-2 space-y-2 max-h-[150px] overflow-auto">
                                    {((detailSlot && materials[detailSlot.data.course.id]) || []).length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic p-2">No materials added.</p>
                                    ) : (
                                        (materials[detailSlot!.data.course.id] || []).map(m => (
                                            <div key={m.id} className="flex items-center justify-between text-sm p-1 hover:bg-muted rounded group">
                                                <a
                                                    href="#"
                                                    className="flex items-center gap-2 truncate flex-1"
                                                    onClick={(e) => {
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
                                    <Button variant="secondary" size="sm" onClick={() => setIsAddingLink(!isAddingLink)}><LinkIcon className="w-3 h-3 mr-2" /> Add Link</Button>
                                    <Button variant="secondary" size="sm" onClick={() => handleAddMaterial('file')}><FileText className="w-3 h-3 mr-2" /> Add File</Button>
                                </div>
                                {isAddingLink && (
                                    <div className="p-3 bg-muted rounded-md space-y-2 animate-in slide-in-from-top-2">
                                        <Input placeholder="Title" value={linkForm.title} onChange={e => setLinkForm(p => ({ ...p, title: e.target.value }))} className="h-8" />
                                        <Input placeholder="URL" value={linkForm.url} onChange={e => setLinkForm(p => ({ ...p, url: e.target.value }))} className="h-8" />
                                        <Button size="sm" onClick={() => handleAddMaterial('link')} disabled={!linkForm.url}>Save Link</Button>
                                    </div>
                                )}

                                {/* Show Materials List in Edit Mode with Delete Button */}
                                <div className="rounded-md border p-2 space-y-2 max-h-[150px] overflow-auto mt-2">
                                    {((detailSlot && materials[detailSlot.data.course.id]) || []).length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic p-2">No materials added yet.</p>
                                    ) : (
                                        (materials[detailSlot!.data.course.id] || []).map(m => (
                                            <div key={m.id} className="flex items-center justify-between text-sm p-1 hover:bg-muted rounded group">
                                                <div className="flex items-center gap-2 truncate flex-1 opacity-70">
                                                    {m.type === 'link' ? <LinkIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                                    <span className="truncate">{m.title}</span>
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => {
                                                    deleteMaterial(m.id, detailSlot!.data.course.id);
                                                }}>
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
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
            {contextMenu && createPortal(
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
                        }}>
                            <Trash2 className="w-3 h-3 mr-2" /> Clear Slot
                        </Button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Schedule;
