import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export function TelegramTab() {
    const [pairingCode, setPairingCode] = useState('');
    const [isPaired, setIsPaired] = useState(false);
    const [status, setStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
    const [isVerifying, setIsVerifying] = useState(false);
    const [showUnpairDialog, setShowUnpairDialog] = useState(false);

    useEffect(() => {
        // Check pairing status on mount
        window.electronAPI?.telegramSync?.getPairingStatus().then(({ paired, status }) => {
            setIsPaired(paired);
            setStatus(status);
        }).catch(() => {
            // Telegram sync not yet implemented
            setIsPaired(false);
            setStatus('unknown');
        });

        // Listen to WebSocket status changes
        const cleanup = window.electronAPI?.telegramSync?.onStatusChange?.((_, newStatus: string) => {
            setStatus(newStatus as 'connected' | 'disconnected' | 'unknown');
        });

        return () => cleanup?.();
    }, []);

    const handlePair = async () => {
        if (!pairingCode.trim() || pairingCode.length !== 6) {
            toast.error('Please enter a valid 6-character code');
            return;
        }

        setIsVerifying(true);
        try {
            const result = await window.electronAPI.telegramSync.verifyPairingCode(pairingCode);

            if (result.success) {
                setIsPaired(true);
                setPairingCode('');
                toast.success('Successfully paired with Telegram! 🎉');
            } else {
                toast.error(result.error || 'Invalid or expired code');
            }
        } catch (error) {
            toast.error('Failed to verify code. Please try again.');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleUnpair = async () => {
        try {
            await window.electronAPI.telegramSync.unpair();
            setIsPaired(false);
            setStatus('unknown');
            setShowUnpairDialog(false);
            toast.info('Telegram unpaired successfully');
        } catch (error) {
            toast.error('Failed to unpair. Please try again.');
        }
    };

    const handleSync = async () => {
        const toastId = toast.loading('Syncing data...');
        try {
            const result = await window.electronAPI.telegramSync.syncNow();
            if (result.success) {
                toast.success('Data synced successfully!', { id: toastId });
            } else {
                toast.error(`Sync failed: ${result.error}`, { id: toastId });
            }
        } catch (error) {
            toast.error('Sync failed', { id: toastId });
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Telegram Quick Input</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Add tasks, expenses, and projects directly from your phone
                    </p>
                </CardHeader>
                <CardContent>
                    {!isPaired ? (
                        <div className="space-y-4">
                            {/* Pairing Instructions */}
                            <div className="p-4 bg-muted rounded-lg space-y-3">
                                <h4 className="font-medium">Setup Instructions</h4>
                                <ol className="text-sm space-y-2 list-decimal list-inside">
                                    <li>Open Telegram and search for <code className="px-1 py-0.5 bg-background rounded">@st4cker_bot</code></li>
                                    <li>Send <code className="px-1 py-0.5 bg-background rounded">/start</code> command</li>
                                    <li>Click "🔐 Generate Pairing Code" button</li>
                                    <li>Enter the 6-character code below (valid 5 minutes)</li>
                                </ol>
                            </div>

                            {/* Pairing Code Input */}
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Enter code (e.g., ABC123)"
                                    value={pairingCode}
                                    onChange={(e) => {
                                        const upperCode = e.target.value.toUpperCase();
                                        console.log('[Pairing] Code input:', upperCode);
                                        setPairingCode(upperCode);
                                    }}
                                    maxLength={6}
                                    className="font-mono text-lg tracking-wider"
                                    disabled={isVerifying}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && pairingCode.length === 6) {
                                            handlePair();
                                        }
                                    }}
                                />
                                <Button onClick={handlePair} disabled={isVerifying || pairingCode.length !== 6}>
                                    {isVerifying ? 'Verifying...' : 'Pair Device'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Connected Status */}
                            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium flex items-center gap-2">
                                        ✅ Telegram Connected
                                        {status === 'connected' && (
                                            <span className="flex items-center gap-1 text-xs text-green-600">
                                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                                Live
                                            </span>
                                        )}
                                        {status === 'disconnected' && (
                                            <span className="flex items-center gap-1 text-xs text-gray-500">
                                                <span className="w-2 h-2 bg-gray-500 rounded-full" />
                                                Offline
                                            </span>
                                        )}
                                    </h4>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={handleSync}>
                                            Sync Now
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => setShowUnpairDialog(true)}>
                                            Unpair
                                        </Button>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {status === 'connected' && '🟢 Real-time sync active'}
                                    {status === 'disconnected' && '🔴 Offline - changes will sync when connection restored'}
                                    {status === 'unknown' && '⚪ Checking connection...'}
                                </p>
                            </div>

                            {/* Quick Command Reference */}
                            <div className="p-4 bg-muted rounded-lg">
                                <h4 className="font-medium mb-3">Quick Commands</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                                    <div>
                                        <code className="text-blue-600">/task</code> - Add assignment
                                    </div>
                                    <div>
                                        <code className="text-blue-600">/expense</code> - Record expense
                                    </div>
                                    <div>
                                        <code className="text-blue-600">/income</code> - Record income
                                    </div>
                                    <div>
                                        <code className="text-blue-600">/project</code> - Create project
                                    </div>
                                    <div>
                                        <code className="text-blue-600">/progress</code> - Log progress
                                    </div>
                                    <div>
                                        <code className="text-blue-600">/help</code> - See all commands
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Custom Unpair Confirmation Dialog */}
            <AlertDialog open={showUnpairDialog} onOpenChange={setShowUnpairDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unpair Telegram Bot?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You will need to generate a new pairing code to reconnect your desktop app.
                            All pending changes will sync when you reconnect.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUnpair}>
                            Unpair
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
