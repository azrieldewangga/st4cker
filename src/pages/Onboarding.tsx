
import { useState, useRef } from 'react';
import { useStore } from '@/store/useStoreNew';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, ArrowRight, User as UserIcon, Check, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import ImageCropper from '@/components/shared/ImageCropper';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function Onboarding() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Use direct store access to prevent object recreation
    const updateUserProfile = useStore(state => state.updateUserProfile);

    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        major: '',
        semester: 1,
        cardLast4: '',
        avatar: ''
    });

    const [isCropperOpen, setIsCropperOpen] = useState(false);
    const [tempImage, setTempImage] = useState<string>('');

    const handleNext = () => {
        if (!formData.name || !formData.major) {
            toast.error('Please fill in your name and major.');
            return;
        }
        if (formData.semester < 1 || formData.semester > 8) {
            toast.error('Semester must be between 1 and 8.');
            return;
        }
        setStep(2);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (step === 1) {
                if (formData.name && formData.major) {
                    handleNext();
                }
            } else {
                handleFinish();
            }
        }
    };

    const handleSemesterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // Allow empty string to let user backspace
        if (val === '') {
            setFormData({ ...formData, semester: 0 }); // 0 as temp empty state
            return;
        }

        const num = parseInt(val);
        if (isNaN(num)) return;

        if (num < 1 || num > 8) {
            toast.message('Semester must be between 1 and 8');
            return;
        }

        // Restrict to 1 digit effectively by the range check, but let's be strict if needed
        if (val.length > 1) {
            toast.message('Semester must be a single digit (1-8)');
            return;
        }

        setFormData({ ...formData, semester: num });
    };

    const handleFinish = async () => {
        setLoading(true);
        try {
            // Save Profile
            await updateUserProfile({
                name: formData.name,
                major: formData.major,
                semester: Number(formData.semester) || 1, // Fallback if 0
                cardLast4: formData.cardLast4 || '0000',
                avatar: formData.avatar || `https://ui-avatars.com/api/?name=${formData.name}&background=random`
            });

            // Force fetch to ensure state is in sync
            await useStore.getState().fetchUserProfile();
            navigate('/', { replace: true });
        } catch (error: any) {
            console.error('Onboarding failed:', error);
            toast.error(error.message || 'Failed to create profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

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

    const handleMinimize = () => window.electronAPI.minimize();
    const handleMaximize = () => window.electronAPI.maximize();
    const handleClose = () => window.electronAPI.close();

    return (
        <div className="h-screen w-screen overflow-hidden bg-transparent flex flex-col select-none">
            {/* Custom Window Frame */}
            <div className="flex flex-col h-full w-full bg-background rounded-xl overflow-hidden shadow-2xl border border-border relative ring-1 ring-white/10">
                {/* Title Bar / Header */}
                <div className="border-b bg-card">
                    <div className="flex h-16 items-center px-4 titlebar-drag">
                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* Window Controls */}
                        <div className="no-drag flex items-center">
                            <div className="flex gap-2 ml-4">
                                <button onClick={handleMinimize} aria-label="Minimize" className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 border border-yellow-600/30 transition-colors" />
                                <button onClick={handleMaximize} aria-label="Maximize" className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 border border-green-600/30 transition-colors" />
                                <button onClick={handleClose} aria-label="Close" className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 border border-red-600/30 transition-colors" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex items-center justify-center p-4 bg-muted/10 overflow-y-auto">
                    <Toaster />
                    <Card className="w-full max-w-md border-border/50 shadow-xl bg-card/50 backdrop-blur-xl">
                        <CardHeader className="text-center space-y-2">
                            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                                <GraduationCap className="w-6 h-6 text-primary" />
                            </div>
                            <CardTitle className="text-2xl">Welcome to st4cker</CardTitle>
                            <CardDescription>
                                Let's set up your student profile to get started.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {step === 1 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-2">
                                        <Label>Full Name</Label>
                                        <Input
                                            placeholder="e.g. John Doe"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            onKeyDown={handleKeyDown}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Major / Program</Label>
                                        <Input
                                            placeholder="e.g. Computer Science"
                                            value={formData.major}
                                            onChange={e => setFormData({ ...formData, major: e.target.value })}
                                            onKeyDown={handleKeyDown}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Semester</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={8}
                                                value={formData.semester === 0 ? '' : formData.semester}
                                                onChange={handleSemesterChange}
                                                onKeyDown={handleKeyDown}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Card Last 4 (Optional)</Label>
                                            <Input
                                                placeholder="1234"
                                                maxLength={4}
                                                value={formData.cardLast4}
                                                onChange={e => setFormData({ ...formData, cardLast4: e.target.value })}
                                                onKeyDown={handleKeyDown}
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        className="w-full mt-4"
                                        onClick={handleNext}
                                        disabled={!formData.name || !formData.major}
                                    >
                                        Next Step <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="flex flex-col items-center justify-center gap-4">
                                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/30 hover:border-primary transition-colors">
                                                {formData.avatar ? (
                                                    <img src={formData.avatar} alt="Profile" className="w-full h-full object-cover" />
                                                ) : (
                                                    <UserIcon className="w-8 h-8 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Upload className="w-5 h-5 text-white" />
                                            </div>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleFileChange}
                                            />
                                        </div>
                                        <div className="text-center">
                                            <h4 className="font-medium">Profile Picture</h4>
                                            <p className="text-xs text-muted-foreground">Click image to upload or skip for default</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Button
                                            className="w-full"
                                            size="lg"
                                            onClick={handleFinish}
                                            disabled={loading}
                                        >
                                            {loading ? 'Setting up...' : 'Get Started'}
                                            {!loading && <Check className="w-4 h-4 ml-2" />}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="w-full"
                                            onClick={() => setStep(1)}
                                            disabled={loading}
                                        >
                                            Back
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

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
            </div>
        </div>
    );
}
