import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { User, Save, Cloud, CheckCircle, RefreshCw, Trash2, Clock, Upload, RotateCcw } from 'lucide-react';
import { cn } from "@/lib/utils";

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
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import ImageCropper from "@/components/shared/ImageCropper";

const GoogleDriveCard = () => {
    const { showNotification } = useStore();

    // G-Drive State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(false);
    const [lastBackup, setLastBackup] = useState<number | undefined>(undefined);
    const [isDisconnectModalOpen, setDisconnectModalOpen] = useState(false);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        // @ts-ignore
        if (window.electronAPI?.drive) {
            // @ts-ignore
            const auth = await window.electronAPI.drive.isAuthenticated();
            setIsAuthenticated(auth);
            // @ts-ignore
            const last = await window.electronAPI.drive.getLastBackup();
            setLastBackup(last);
        }
    };

    const handleConnect = async () => {
        setLoading(true);
        try {
            // @ts-ignore
            const success = await window.electronAPI.drive.authenticate();
            if (success) {
                setIsAuthenticated(true);
                showNotification('Connected to Google Drive!', 'success');
            } else {
                showNotification('Connection flow cancelled or failed.', 'warning');
            }
        } catch (e: any) {
            console.error(e);
            showNotification('Error connecting: ' + (e.message || e), 'error');
        }
        setLoading(false);
    };

    const confirmDisconnect = async () => {
        // @ts-ignore
        await window.electronAPI.drive.logout();
        setIsAuthenticated(false);
        setLastBackup(undefined);
        setDisconnectModalOpen(false);
        showNotification('Google Drive disconnected.', 'info');
    };

    const handleBackupNow = async () => {
        setLoading(true);
        try {
            // @ts-ignore
            await window.electronAPI.drive.upload();
            showNotification('Backup uploaded successfully!', 'success');
            checkStatus();
        } catch (e: any) {
            console.error(e);
            showNotification('Backup failed: ' + (e.message || e), 'error');
        }
        setLoading(false);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Cloud className="h-5 w-5 text-primary" />
                            <div>
                                <CardTitle className="text-base">Google Drive Backup</CardTitle>
                                <CardDescription>Autosave your database weekly</CardDescription>
                            </div>
                        </div>
                        {isAuthenticated && (
                            <div className="flex items-center gap-1 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                                <CheckCircle size={12} /> Connected
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <span className={isAuthenticated ? "text-emerald-500 font-medium" : "text-amber-500 font-medium"}>
                            {isAuthenticated ? 'Active' : 'Not Connected'}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Last Backup</span>
                        <span>{lastBackup ? new Date(lastBackup).toLocaleDateString() : 'Never'}</span>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between gap-2">
                    {!isAuthenticated ? (
                        <Button onClick={handleConnect} disabled={loading} className="w-full">
                            {loading ? "Connecting..." : "Connect Google Drive"}
                        </Button>
                    ) : (
                        <div className="flex gap-2 w-full">
                            <div className="flex-1 flex items-center justify-center gap-2 px-3 bg-muted rounded-md text-xs opacity-70 border cursor-help" title="Backups run automatically every 7 days">
                                <Clock size={14} />
                                <span>Weekly Auto-backup</span>
                            </div>
                            <Button size="icon" onClick={handleBackupNow} disabled={loading} title="Backup Now">
                                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                            <Button variant="destructive" size="icon" onClick={() => setDisconnectModalOpen(true)} disabled={loading} title="Disconnect">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </CardFooter>
            </Card>

            <AlertDialog open={isDisconnectModalOpen} onOpenChange={setDisconnectModalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Auto-backups will stop and you will need to reconnect to back up your data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDisconnect} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Disconnect</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

const Settings = () => {
    const { userProfile, updateUserProfile, showNotification } = useStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [searchParams] = useSearchParams();
    const view = searchParams.get('view') || 'preferences'; // Default to preferences if null

    // Local state for form
    const [formData, setFormData] = useState({
        name: '',
        semester: 1,
        avatar: '',
        cardLast4: '',
        major: ''
    });

    const [isCropperOpen, setIsCropperOpen] = useState(false);
    const [tempImage, setTempImage] = useState<string>('');

    useEffect(() => {
        if (userProfile && !formData.name) {
            setFormData({
                name: userProfile.name,
                semester: userProfile.semester,
                avatar: userProfile.avatar,
                cardLast4: userProfile.cardLast4 || '',
                major: userProfile.major || ''
            });
        }
    }, [userProfile?.id]);

    // Polling removed - using integrated modal now

    // Startup State
    const [runAtStartup, setRunAtStartup] = useState(false);

    useEffect(() => {
        // @ts-ignore
        if (window.electronAPI?.settings) {
            // @ts-ignore
            window.electronAPI.settings.getStartupStatus().then(setRunAtStartup);
        }
    }, []);

    const toggleStartup = async (val: boolean) => {
        // @ts-ignore
        if (window.electronAPI?.settings) {
            // @ts-ignore
            const newState = await window.electronAPI.settings.toggleStartup(val);
            setRunAtStartup(newState);
            if (newState) showNotification('App will run at startup', 'success');
            else showNotification('App will not run at startup', 'info');
        }
    };

    const handleSubmit = async (e: React.FormEvent | React.KeyboardEvent) => {
        e.preventDefault();
        await updateUserProfile(formData);
        useStore.getState().fetchUserProfile();
        showNotification('Profile saved successfully!', 'success');
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
        <div className="flex flex-col gap-6 p-1 max-w-4xl mx-auto pb-10">
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
                                    <Button variant="ghost" size="sm" onClick={handleInitialChange} className="mt-2">
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
                // --- PREFERENCES VIEW ---
                <>
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
                                    <p className="text-sm text-muted-foreground">Automatically launch CampusDash when you log in</p>
                                </div>
                                <Switch checked={runAtStartup} onCheckedChange={toggleStartup} />
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Monthly Spending Limit</Label>
                                    <p className="text-sm text-muted-foreground">Set your target budget limit for the dashboard</p>
                                </div>
                                <div className="w-[150px] flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Rp</span>
                                    <Input
                                        type="number"
                                        defaultValue={useStore.getState().monthlyLimit}
                                        onChange={(e) => useStore.getState().setMonthlyLimit(parseInt(e.target.value) || 0)}
                                        className="text-right"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Data Management */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Save className="h-4 w-4" /> Local Data
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-medium">Backup</div>
                                        <div className="text-xs text-muted-foreground">Save to file</div>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={async (e) => {
                                        e.preventDefault();
                                        // @ts-ignore
                                        const res = await window.electronAPI.backup.export();
                                        if (res && res.success) showNotification('Local Backup Successful!', 'success');
                                        else if (res && res.error) showNotification('Backup Failed: ' + res.error, 'error');
                                    }}>
                                        Backup
                                    </Button>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-medium">Restore</div>
                                        <div className="text-xs text-muted-foreground">Load from file</div>
                                    </div>
                                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={async (e) => {
                                        e.preventDefault();
                                        if (confirm('WARNING: Restoring will OVERWRITE all current data. The app will restart automatically. Continue?')) {
                                            // @ts-ignore
                                            const res = await window.electronAPI.backup.import();
                                            if (res && !res.success && res.error) showNotification('Restore Failed: ' + res.error, 'error');
                                        }
                                    }}>
                                        Restore
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <GoogleDriveCard />
                    </div>
                </>
            )}

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
        </div>
    );
};

export default Settings;
