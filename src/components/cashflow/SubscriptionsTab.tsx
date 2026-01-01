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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";

interface SubscriptionsTabProps {
    formatMoney: (amount: number) => string;
}

const SubscriptionsTab: React.FC<SubscriptionsTabProps> = ({ formatMoney }) => {
    const { subscriptions, addSubscription, deleteSubscription } = useStore();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newSub, setNewSub] = useState({
        name: '',
        cost: '',
        dueDay: ''
    });

    const handleAdd = () => {
        if (!newSub.name || !newSub.cost || !newSub.dueDay) return;
        addSubscription({
            name: newSub.name,
            cost: parseFloat(newSub.cost),
            dueDay: parseInt(newSub.dueDay),
        });
        setIsAddOpen(false);
        setNewSub({ name: '', cost: '', dueDay: '' });
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
                                            <Button variant="ghost" size="icon" onClick={() => deleteSubscription(sub.id)}>
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
                                <Label>Due Day (1-31)</Label>
                                <NumberStepper
                                    value={newSub.dueDay}
                                    onChange={(val) => setNewSub({ ...newSub, dueDay: val })}
                                    placeholder="1"
                                    min={1}
                                    max={31}
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
        </div>
    );
};

export default SubscriptionsTab;
