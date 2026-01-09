import React, { useState, useEffect } from 'react';
import { useStore } from '@/store/useStoreNew';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface LogProgressDialogProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    currentProgress: number;
}

const LogProgressDialog: React.FC<LogProgressDialogProps> = ({
    isOpen,
    onClose,
    projectId,
    currentProgress
}) => {
    const addProjectSession = useStore(state => state.addProjectSession);
    const updateProject = useStore(state => state.updateProject);
    const [formData, setFormData] = useState({
        sessionDate: new Date(),
        durationPreset: '120' as '30' | '60' | '120' | 'custom',
        customDuration: '',
        note: '',
        progressAfter: currentProgress,
        status: 'active' as 'active' | 'completed' | 'on-hold' // manual status control
    });

    const [showCompletionConfirm, setShowCompletionConfirm] = useState(false);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                sessionDate: new Date(),
                durationPreset: '120',
                customDuration: '',
                note: '',
                progressAfter: currentProgress,
                status: 'active', // Default to active unless changed
            });
            setShowCompletionConfirm(false);
        }
    }, [isOpen, currentProgress]);

    const handleLogSession = async (finalProgress: number, finalStatus: 'active' | 'completed' | 'on-hold') => {
        const durationNum = formData.durationPreset === 'custom'
            ? parseInt(formData.customDuration) || 0
            : parseInt(formData.durationPreset);

        // 1. Log Session
        await addProjectSession({
            projectId,
            sessionDate: formData.sessionDate.toISOString(),
            duration: durationNum,
            note: formData.note,
            progressBefore: currentProgress,
            progressAfter: finalProgress,
        });

        // 2. Update Status if needed
        // Update if logic: if we are forcing a status (like completed from modal) OR if user manually changed it from dropdown
        if (finalStatus !== 'active' || formData.status !== 'active') { // Simplified check
            // In real scenario, we should compare with current project status, but updateProject handles merge
            await updateProject(projectId, { status: finalStatus });
        }

        // 3. User Feedback (Toast)
        const progressDiff = finalProgress - currentProgress;
        const statusLabel = finalStatus === 'active' ? formData.status : finalStatus; // 'active' | 'completed' | 'on-hold'
        const displayStatus = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1);

        toast.success("Session Logged", {
            description: `Progress: ${finalProgress}% (${progressDiff > 0 ? '+' : ''}${progressDiff}%) • Status: ${displayStatus}`
        });

        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Check for 100% completion trigger
        if (formData.progressAfter === 100) {
            setShowCompletionConfirm(true);
            return;
        }

        // Normal submit
        await handleLogSession(formData.progressAfter, formData.status);
    };

    const progressChange = formData.progressAfter - currentProgress;

    // View: Completion Confirmation
    if (showCompletionConfirm) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <div className="mx-auto bg-green-100 p-3 rounded-full mb-4">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <DialogTitle className="text-center">Project Completed?</DialogTitle>
                        <DialogDescription className="text-center">
                            You've reached 100% progress. Would you like to mark this project as <strong>Completed</strong>?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-3 mt-4">
                        <Button
                            className="w-full bg-green-600 hover:bg-green-700"
                            onClick={() => handleLogSession(100, 'completed')}
                        >
                            Yes, Mark as Completed
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => handleLogSession(99, 'active')}
                        >
                            No, keep at 99% (Active)
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // View: Log Form
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Log Progress</DialogTitle>
                    <DialogDescription>
                        Record your work session and update project progress
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[calc(90vh-120px)]">
                    <form onSubmit={handleSubmit} className="space-y-5 p-2 pr-4">
                        {/* Session Date & Status - Grid 50/50 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label>Session Date *</Label>
                                <DatePicker
                                    date={formData.sessionDate}
                                    setDate={(date) => date && setFormData({ ...formData, sessionDate: date })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Project Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(val) => setFormData({ ...formData, status: val as any })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="on-hold">On Hold</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Duration - Dropdown with Custom Side-by-Side (Patented 50%) */}
                        <div className="space-y-2">
                            <Label htmlFor="duration">Duration (minutes)</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <Select
                                    value={formData.durationPreset}
                                    onValueChange={(val) => setFormData({ ...formData, durationPreset: val as any })}
                                >
                                    <SelectTrigger id="duration">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="30">30 minutes</SelectItem>
                                        <SelectItem value="60">60 minutes (1 hour)</SelectItem>
                                        <SelectItem value="120">120 minutes (2 hours)</SelectItem>
                                        <SelectItem value="custom">Custom</SelectItem>
                                    </SelectContent>
                                </Select>

                                {formData.durationPreset === 'custom' && (
                                    <Input
                                        type="number"
                                        min="1"
                                        value={formData.customDuration}
                                        onChange={(e) => setFormData({ ...formData, customDuration: e.target.value.replace(/\D/g, '') })}
                                        placeholder="Enter minutes"
                                        required
                                        className="h-10"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Progress Slider */}
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <Label>New Progress *</Label>
                                <span className="text-sm text-muted-foreground">
                                    Current: {currentProgress}%
                                </span>
                            </div>

                            <div className="space-y-2">
                                <Slider
                                    value={[formData.progressAfter]}
                                    onValueChange={(vals) => setFormData({ ...formData, progressAfter: vals[0] })}
                                    min={0}
                                    max={100}
                                    step={1}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>0%</span>
                                    <span className="font-medium text-foreground text-base">
                                        {formData.progressAfter}%
                                    </span>
                                    <span>100%</span>
                                </div>
                                {progressChange !== 0 && (
                                    <p className={`text-xs font-medium ${progressChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {progressChange > 0 ? '+' : ''}{progressChange}% change
                                    </p>
                                )}
                            </div>
                        </div>



                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="note">Session Notes</Label>
                            <Textarea
                                id="note"
                                value={formData.note}
                                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                                placeholder="Completed chapter 3, implemented login feature..."
                                rows={3}
                                maxLength={500}
                            />
                            <p className="text-xs text-muted-foreground text-right">
                                {formData.note.length}/500 characters
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                Log Progress
                            </Button>
                        </div>
                    </form>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default LogProgressDialog;
