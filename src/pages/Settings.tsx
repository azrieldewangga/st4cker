import { ScrollArea } from "@/components/ui/scroll-area";
import React, { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStoreNew';
import { User, Save, Cloud, CheckCircle, RefreshCw, Trash2, Clock, Upload, RotateCcw, Moon, Sun, Laptop } from 'lucide-react';
import { cn } from "@/lib/utils";
import SettingsIntegrations, { Integration } from "@/components/ui/settings-integrations";

// Shadcn Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from "@/components/ui/input-otp";
import ImageCropper from "@/components/shared/ImageCropper";



const Settings = () => {
    // Use direct store access to prevent object recreation
    const userProfile = useStore(state => state.userProfile);
    const updateUserProfile = useStore(state => state.updateUserProfile);
    const showNotification = useStore(state => state.showNotification);
    const autoTheme = useStore(state => state.autoTheme);
    const setAutoTheme = useStore(state => state.setAutoTheme);
    const theme = useStore(state => state.theme);
    const setTheme = useStore(state => state.setTheme);
    const themeSchedule = useStore(state => state.themeSchedule);
    const setThemeSchedule = useStore(state => state.setThemeSchedule);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [searchParams] = useSearchParams();
    const view = searchParams.get('view') || 'preferences'; // Default to preferences if null
    const isTelegramView = view === 'telegram';

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        semester: 1,
        avatar: '',
        cardLast4: '',
        major: ''
    });

    const [isCropperOpen, setIsCropperOpen] = useState(false);
    const [tempImage, setTempImage] = useState<string>('');

    // Google Drive State
    const [isGDriveAuthenticated, setIsGDriveAuthenticated] = useState(false);
    const [gDriveLoading, setGDriveLoading] = useState(false);
    const [lastBackup, setLastBackup] = useState<number | undefined>(undefined);

    // Telegram State
    const [pairingCode, setPairingCode] = useState('');
    const [isPaired, setIsPaired] = useState(false);
    const [telegramStatus, setTelegramStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
    const [isVerifying, setIsVerifying] = useState(false);
    const [showOTPDialog, setShowOTPDialog] = useState(false);
    const [telegramSyncLoading, setTelegramSyncLoading] = useState(false);

    const handleTelegramSyncNow = async () => {
        setTelegramSyncLoading(true);
        try {
            // @ts-ignore
            const result = await window.electronAPI.telegramSync.syncNow();
            if (result.success) {
                toast.success('Sync with Telegram successful!', { icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> });
            } else {
                toast.error('Sync failed: ' + (result.error || 'Unknown error'));
            }
        } catch (error: any) {
            toast.error('Sync error: ' + error.message);
        } finally {
            setTelegramSyncLoading(false);
        }
    };

    useEffect(() => {
        if (userProfile && !formData.name) {
            setFormData({
                name: userProfile.name,
                semester: userProfile.semester,
                avatar: userProfile.avatar || '',
                cardLast4: userProfile.cardLast4 || '',
                major: userProfile.major || ''
            });
        }
    }, [userProfile?.id]);

    // Check Google Drive status
    useEffect(() => {
        const checkGDriveStatus = async () => {
            // @ts-ignore
            if (window.electronAPI?.drive) {
                // @ts-ignore
                const auth = await window.electronAPI.drive.isAuthenticated();
                setIsGDriveAuthenticated(auth);
                // @ts-ignore
                const last = await window.electronAPI.drive.getLastBackup();
                setLastBackup(last);
            }
        };
        checkGDriveStatus();
    }, []);

    // Check Telegram status
    useEffect(() => {
        // Check pairing status on mount
        window.electronAPI?.telegramSync?.getPairingStatus().then(({ paired, status }) => {
            setIsPaired(paired);
            setTelegramStatus(status);
        }).catch(() => {
            setIsPaired(false);
            setTelegramStatus('unknown');
        });

        // Listen to WebSocket status changes
        const cleanup = window.electronAPI?.telegramSync?.onStatusChange?.((_, newStatus: string) => {
            setTelegramStatus(newStatus as 'connected' | 'disconnected' | 'unknown');
        });

        return () => cleanup?.();
    }, []);

    // App Preferences
    const [runAtStartup, setRunAtStartup] = useState(false);
    const [showTips, setShowTips] = useState(true);

    useEffect(() => {
        // @ts-ignore
        if (window.electronAPI?.settings) {
            // @ts-ignore
            window.electronAPI.settings.getStartupStatus().then(setRunAtStartup);
        }

        // Load preferences
        const tipsEnabled = localStorage.getItem('tips-enabled');
        setShowTips(tipsEnabled !== 'false'); // Default to true

        const notifEnabled = localStorage.getItem('notifications-enabled');
        setNotificationsEnabled(notifEnabled !== 'false'); // Default to true
    }, []);

    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    const toggleNotifications = (val: boolean) => {
        setNotificationsEnabled(val);
        localStorage.setItem('notifications-enabled', String(val));
        if (val) {
            toast('Desktop notifications enabled', { icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> });
            // @ts-ignore
            if (window.electronAPI?.notifications) {
                // @ts-ignore
                window.electronAPI.notifications.send("Notifications Enabled", "You will now receive desktop alerts.");
            }
        } else {
            showNotification('Desktop notifications disabled', 'info');
        }
    };

    const toggleStartup = async (val: boolean) => {
        // @ts-ignore
        if (window.electronAPI?.settings) {
            // @ts-ignore
            const newState = await window.electronAPI.settings.toggleStartup(val);
            setRunAtStartup(newState);
            if (newState) toast('App will run at startup', { icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> });
            else showNotification('App will not run at startup', 'info');
        }
    };

    const toggleTips = (val: boolean) => {
        setShowTips(val);
        localStorage.setItem('tips-enabled', String(val));
        if (val) {
            localStorage.removeItem('tips-dismissed'); // Reset dismissed state
            toast('Tips enabled', { icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> });
        } else {
            showNotification('Tips disabled', 'info');
        }
    };

    // Google Drive Handlers
    const handleGDriveConnect = async () => {
        setGDriveLoading(true);
        try {
            // @ts-ignore
            const success = await window.electronAPI.drive.authenticate();
            if (success) {
                setIsGDriveAuthenticated(true);
                toast('Connected to Google Drive!', { icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> });
                // Refresh status
                // @ts-ignore
                const last = await window.electronAPI.drive.getLastBackup();
                setLastBackup(last);
            } else {
                showNotification('Connection flow cancelled or failed.', 'warning');
            }
        } catch (e: any) {
            console.error(e);
            showNotification('Error connecting: ' + (e.message || e), 'error');
        }
        setGDriveLoading(false);
    };

    const handleGDriveDisconnect = async () => {
        try {
            // @ts-ignore
            await window.electronAPI.drive.logout();
            setIsGDriveAuthenticated(false);
            setLastBackup(undefined);
            showNotification('Google Drive disconnected.', 'info');
        } catch (e: any) {
            showNotification('Error disconnecting: ' + (e.message || e), 'error');
        }
    };

    const handleGDriveBackupNow = async () => {
        setGDriveLoading(true);
        try {
            // @ts-ignore
            await window.electronAPI.drive.upload();
            toast('Backup uploaded successfully!', { icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> });
            // Refresh status
            // @ts-ignore
            const last = await window.electronAPI.drive.getLastBackup();
            setLastBackup(last);
        } catch (e: any) {
            console.error(e);
            showNotification('Backup failed: ' + (e.message || e), 'error');
        }
        setGDriveLoading(false);
    };

    // Telegram Handlers
    const handleTelegramConnect = async () => {
        setShowOTPDialog(true);
    };

    const handleTelegramDisconnect = async () => {
        try {
            await window.electronAPI.telegramSync.unpair();
            setIsPaired(false);
            setTelegramStatus('unknown');
            toast.info('Telegram unpaired successfully');
        } catch (error) {
            toast.error('Failed to unpair. Please try again.');
        }
    };

    const handleOTPSubmit = async (code: string) => {
        setIsVerifying(true);
        try {
            const result = await window.electronAPI.telegramSync.verifyPairingCode(code);

            if (result.success) {
                setIsPaired(true);
                setPairingCode('');
                setShowOTPDialog(false);
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

    // Integration data for HextaUI component
    const integrations: Integration[] = [
        {
            id: 'google-drive',
            name: 'Google Drive',
            description: 'Autosave your database weekly',
            status: isGDriveAuthenticated ? 'connected' : 'disconnected',
            scopes: ['drive.file'],
        },
        {
            id: 'telegram',
            name: 'Telegram Bot',
            description: 'Add tasks, expenses, and projects from your phone',
            status: isPaired ? (telegramStatus === 'connected' ? 'connected' : (telegramStatus === 'disconnected' ? 'disconnected' : 'error')) : 'disconnected',
            scopes: ['read:messages', 'write:data'],
        },
    ];

    const handleIntegrationConnect = async (integrationId: string) => {
        if (integrationId === 'google-drive') {
            await handleGDriveConnect();
        } else if (integrationId === 'telegram') {
            await handleTelegramConnect();
        }
    };

    const handleIntegrationDisconnect = async (integrationId: string) => {
        if (integrationId === 'google-drive') {
            await handleGDriveDisconnect();
        } else if (integrationId === 'telegram') {
            await handleTelegramDisconnect();
        }
    };

    const handleSubmit = async (e: React.FormEvent | React.KeyboardEvent) => {
        e.preventDefault();
        await updateUserProfile(formData);
        useStore.getState().fetchUserProfile();
        toast('Profile saved successfully!', { icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> });
    };

    const handleInitialChange = () => {
        const newAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random`;
        setFormData({ ...formData, avatar: newAvatar });
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setTempImage(base64String);
                setIsCropperOpen(true);
            };
            reader.readAsDataURL(file);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCropApply = (base64: string) => {
        setFormData(prev => ({ ...prev, avatar: base64 }));
        setIsCropperOpen(false);
        setTempImage('');
    };

    const isProfileView = view === 'profile';

    return (
        <ScrollArea className="h-[calc(100vh-3rem)]">
        <div className="flex flex-col gap-6 max-w-4xl mx-auto p-6 pb-10 pr-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
                    <p className="text-sm text-muted-foreground mt-1">Manage your preferences and account.</p>
                </div>
            </div>

            {isProfileView ? (
                // --- PROFILE VIEW ---
                <>
                    {/* Profile Section */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Profile</CardTitle>
                                    <CardDescription>Update your photo and details.</CardDescription>
                                </div>
                            </div>

                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col md:flex-row items-center gap-8">
                                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-primary/20 bg-muted">
                                        <img src={formData.avatar || "https://ui-avatars.com/api/?name=User"} alt="Avatar" className="h-full w-full object-cover" />
                                    </div>
                                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Upload className="text-white h-6 w-6" />
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                </div>
                                <div className="flex-1 space-y-1 text-center md:text-left">
                                    <h4 className="font-semibold">{formData.name || 'User'}</h4>
                                    <p className="text-sm text-muted-foreground">Click the image to upload a new photo. Max size 2MB.</p>
                                    <Button variant="ghost" size="sm" onClick={handleInitialChange} className="mt-2" aria-label="Reset avatar to initials">
                                        <RotateCcw className="mr-2 h-3 w-3" /> Reset to Initials
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Display Name</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Major / Program</Label>
                                    <Input
                                        value={formData.major || ''}
                                        onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                                        placeholder="Computer Science"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Semester</Label>
                                    <Select value={String(formData.semester)} onValueChange={(v) => setFormData({ ...formData, semester: parseInt(v) })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select semester" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                                                <SelectItem key={sem} value={String(sem)}>Semester {sem}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Card Last 4 Digits (Visual)</Label>
                                    <Input
                                        value={formData.cardLast4}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                            setFormData({ ...formData, cardLast4: val });
                                        }}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                                        placeholder="8888"
                                        className="font-mono"
                                        maxLength={4}
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="justify-end bg-muted/20 py-3">
                            <Button onClick={handleSubmit} className="btn-action-save">
                                <Save className="mr-2 h-4 w-4" /> Save Changes
                            </Button>
                        </CardFooter>
                    </Card>
                </>
            ) : (
                // Preferences Section
                <>
                    {/* Appearance */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Appearance</CardTitle>
                            <CardDescription>Manage application theme and auto-switching.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Auto-switch Theme</Label>
                                    <p className="text-sm text-muted-foreground">Automatically switch between light and dark mode based on time</p>
                                </div>
                                <Switch
                                    checked={autoTheme}
                                    onCheckedChange={setAutoTheme}
                                    aria-label="Toggle auto-switch theme"
                                />
                            </div>

                            {/* Schedule Config */}
                            {autoTheme ? (
                                <div className="grid grid-cols-2 gap-4 animate-fade-in pl-1">
                                    <div className="space-y-2">
                                        <Label>Dark Mode Starts</Label>
                                        <div className="relative">
                                            <Moon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="time"
                                                className="pl-9"
                                                value={themeSchedule.start}
                                                onChange={(e) => setThemeSchedule({ ...themeSchedule, start: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Light Mode Starts</Label>
                                        <div className="relative">
                                            <Sun className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="time"
                                                className="pl-9"
                                                value={themeSchedule.end}
                                                onChange={(e) => setThemeSchedule({ ...themeSchedule, end: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Manual Theme Selection */
                                <div className="grid grid-cols-3 gap-2 animate-fade-in">
                                    <Button
                                        variant={theme === 'light' ? 'default' : 'outline'}
                                        onClick={() => setTheme('light')}
                                        className="w-full justify-start"
                                    >
                                        <Sun className="mr-2 h-4 w-4" /> Light
                                    </Button>
                                    <Button
                                        variant={theme === 'dark' ? 'default' : 'outline'}
                                        onClick={() => setTheme('dark')}
                                        className="w-full justify-start"
                                    >
                                        <Moon className="mr-2 h-4 w-4" /> Dark
                                    </Button>
                                    <Button
                                        variant={theme === 'system' ? 'default' : 'outline'}
                                        onClick={() => setTheme('system')}
                                        className="w-full justify-start"
                                    >
                                        <Laptop className="mr-2 h-4 w-4" /> System
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* App Preferences */}
                    <Card>
                        <CardHeader>
                            <CardTitle>App Preferences</CardTitle>
                            <CardDescription>Customize application behavior.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Run at Startup</Label>
                                    <p className="text-sm text-muted-foreground">Automatically launch st4cker when you log in</p>
                                </div>
                                <Switch checked={runAtStartup} onCheckedChange={toggleStartup} aria-label="Toggle run at startup" />
                            </div>

                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Show Tips</Label>
                                    <p className="text-sm text-muted-foreground">Display helpful tips and keyboard shortcuts</p>
                                </div>
                                <Switch checked={showTips} onCheckedChange={toggleTips} aria-label="Toggle tips" />
                            </div>

                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Desktop Notifications</Label>
                                    <p className="text-sm text-muted-foreground">Receive alerts for deadlines and due dates</p>
                                </div>
                                <Switch checked={notificationsEnabled} onCheckedChange={toggleNotifications} aria-label="Toggle desktop notifications" />
                            </div>



                        </CardContent>
                    </Card>

                    {/* Data Management - Backups & Integrations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Backups Card (LEFT) */}
                        <Card className="w-full shadow-xs">
                            <CardHeader>
                                <div className="flex flex-col gap-2">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        Backups & Sync
                                    </CardTitle>
                                    <CardDescription>
                                        Manage local, cloud backups, and data sync
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Local Backup */}
                                <div className="flex items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-medium">Local Backup</div>
                                        <div className="text-xs text-muted-foreground">Save to file</div>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={(e: React.MouseEvent) => {
                                        e.preventDefault();
                                        // @ts-ignore
                                        window.electronAPI.backup.export().then((res: any) => {
                                            if (res && res.success) toast('Local Backup Successful!', { icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> });
                                            else if (res && res.error) showNotification('Backup Failed: ' + res.error, 'error');
                                        });
                                    }}>
                                        Backup
                                    </Button>
                                </div>

                                {/* Google Drive Backup (only show if connected) */}
                                {isGDriveAuthenticated && (
                                    <div className="flex items-center justify-between rounded-lg border p-3">
                                        <div className="space-y-0.5">
                                            <div className="text-sm font-medium">Google Drive</div>
                                            <div className="text-xs text-muted-foreground">
                                                {lastBackup ? `Last: ${new Date(lastBackup).toLocaleDateString()}` : 'Backup to cloud'}
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleGDriveBackupNow}
                                            disabled={gDriveLoading}
                                        >
                                            {gDriveLoading ? (
                                                <><RefreshCw className="h-3 w-3 animate-spin mr-1" /> Uploading</>
                                            ) : (
                                                'Backup Now'
                                            )}
                                        </Button>
                                    </div>
                                )}

                                {/* Telegram Sync (Only if Paired) */}
                                {isPaired && (
                                    <div className="flex items-center justify-between rounded-lg border p-3 bg-blue-50/50 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900">
                                        <div className="space-y-0.5">
                                            <div className="text-sm font-medium text-blue-700 dark:text-blue-400">Telegram Data</div>
                                            <div className="text-xs text-muted-foreground">Force sync to bot</div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950 dark:text-blue-400 dark:border-blue-900"
                                            onClick={handleTelegramSyncNow}
                                            disabled={telegramSyncLoading}
                                        >
                                            {telegramSyncLoading ? (
                                                <><RefreshCw className="h-3 w-3 animate-spin mr-1" /> Syncing</>
                                            ) : (
                                                'Sync Now'
                                            )}
                                        </Button>
                                    </div>
                                )}


                                {/* Local Restore */}
                                <div className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-medium">Local Restore</div>
                                        <div className="text-xs text-muted-foreground">Load from file</div>
                                    </div>
                                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={(e: React.MouseEvent) => {
                                        e.preventDefault();
                                        if (confirm('WARNING: Restoring will OVERWRITE all current data. The app will restart automatically. Continue?')) {
                                            // @ts-ignore
                                            window.electronAPI.backup.import().then((res: any) => {
                                                if (res && !res.success && res.error) showNotification('Restore Failed: ' + res.error, 'error');
                                            });
                                        }
                                    }}>
                                        Restore
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Integrations Card (RIGHT) */}
                        <SettingsIntegrations
                            integrations={integrations}
                            onConnect={handleIntegrationConnect}
                            onDisconnect={handleIntegrationDisconnect}
                        />
                    </div>


                </>
            )
            }

            <Dialog open={isCropperOpen} onOpenChange={setIsCropperOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Crop Profile Picture</DialogTitle>
                    </DialogHeader>
                    {tempImage && (
                        <ImageCropper
                            imageSrc={tempImage}
                            onCancel={() => setIsCropperOpen(false)}
                            onApply={handleCropApply}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* OTP Verify Dialog for Telegram Pairing */}
            <Dialog open={showOTPDialog} onOpenChange={setShowOTPDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Pair Telegram Bot</DialogTitle>
                        <CardDescription>Get your code by texting @st4cker_bot on Telegram with /start</CardDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                        <Label htmlFor="otp-input">Verification code *</Label>
                        <InputOTP
                            maxLength={6}
                            value={pairingCode}
                            onChange={(val) => setPairingCode(val.toUpperCase())}
                            disabled={isVerifying}
                            id="otp-input"
                        >
                            <InputOTPGroup>
                                <InputOTPSlot index={0} className="w-10 h-12 text-base" />
                                <InputOTPSlot index={1} className="w-10 h-12 text-base" />
                                <InputOTPSlot index={2} className="w-10 h-12 text-base" />
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup>
                                <InputOTPSlot index={3} className="w-10 h-12 text-base" />
                                <InputOTPSlot index={4} className="w-10 h-12 text-base" />
                                <InputOTPSlot index={5} className="w-10 h-12 text-base" />
                            </InputOTPGroup>
                        </InputOTP>
                        <p className="text-xs text-muted-foreground">Enter the 6-character code (valid 5 minutes)</p>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => handleOTPSubmit(pairingCode)}
                            disabled={isVerifying || pairingCode.length !== 6}
                        >
                            {isVerifying ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                'Pair Device'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
        </ScrollArea>
    );
};

export default Settings;
