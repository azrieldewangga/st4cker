import React, { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { Plus, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { DatePicker } from "@/components/ui/date-picker";

interface SubscriptionsTabProps {
    formatMoney: (amount: number) => string;
}

const SubscriptionsTab: React.FC<SubscriptionsTabProps> = ({ formatMoney }) => {
    const { subscriptions, addSubscription, deleteSubscription } = useStore();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newSub, setNewSub] = useState<{
        name: string;
        cost: string;
        date: Date;
    }>({
        name: '',
        cost: '',
        date: new Date()
    });

    // State for delete confirmation
    const [deleteDialog, setDeleteDialog] = useState<{
        isOpen: boolean;
        subscription: any | null;
    }>({ isOpen: false, subscription: null });

    const handleAdd = () => {
        if (!newSub.name || !newSub.cost || !newSub.date) return;
        addSubscription({
            name: newSub.name,
            cost: parseFloat(newSub.cost.replace(/,/g, '')),
            dueDay: newSub.date.getDate(),
        });
        setIsAddOpen(false);
        setNewSub({ name: '', cost: '', date: new Date() });
    };

    // Function to show delete confirmation
    const handleDeleteClick = (e: React.MouseEvent, sub: any) => {
        e.stopPropagation();
        setDeleteDialog({ isOpen: true, subscription: sub });
    };

    // Function to confirm deletion
    const handleConfirmDelete = () => {
        const sub = deleteDialog.subscription;
        if (!sub) return;

        deleteSubscription(sub.id);
        setDeleteDialog({ isOpen: false, subscription: null });
    };

    const totalMonthly = useMemo(() => {
        return subscriptions.reduce((acc, sub) => acc + sub.cost, 0);
    }, [subscriptions]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Monthly Cost</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatMoney(totalMonthly)}</div>
                        <p className="text-xs text-muted-foreground">
                            Based on {subscriptions.length} active subscriptions
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Subscriptions Count</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{subscriptions.length}</div>
                        <p className="text-xs text-muted-foreground">Active recurring payments</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Subscriptions</CardTitle>
                        <CardDescription>Manage your recurring payments.</CardDescription>
                    </div>
                    <Button onClick={() => setIsAddOpen(true)} size="sm">
                        <Plus className="mr-2 h-4 w-4" /> Add Subscription
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Cost</TableHead>
                                <TableHead>Due Day</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {subscriptions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No subscriptions found.</TableCell>
                                </TableRow>
                            ) : (
                                subscriptions.map(sub => (
                                    <TableRow key={sub.id}>
                                        <TableCell className="font-medium">{sub.name}</TableCell>
                                        <TableCell>{formatMoney(sub.cost)}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">Day {sub.dueDay}</Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={(e) => handleDeleteClick(e, sub)}>
                                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Subscription</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label>Name</Label>
                            <Input placeholder="Netflix, Spotify..." value={newSub.name} onChange={e => setNewSub({ ...newSub, name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Amount</Label>
                                <NumberStepper
                                    value={newSub.cost}
                                    onChange={(val) => setNewSub({ ...newSub, cost: val })}
                                    placeholder="0"
                                    min={0}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Subscription Date</Label>
                                <DatePicker
                                    date={newSub.date}
                                    setDate={(date) => date && setNewSub({ ...newSub, date: date })}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleAdd}>Add Subscription</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialog.isOpen} onOpenChange={(open) => !open && setDeleteDialog({ isOpen: false, subscription: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Subscription?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <span className="font-semibold">{deleteDialog.subscription?.name}</span>? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default SubscriptionsTab;
