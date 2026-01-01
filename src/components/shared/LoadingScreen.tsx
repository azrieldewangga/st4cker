import React from 'react';

const LoadingScreen = () => {
    return (
        <div className="h-screen w-screen bg-background text-foreground flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/5 rounded-full blur-3xl animate-pulse delay-700"></div>

            {/* Logo Animation */}
            <div className="relative z-10 flex flex-col items-center gap-6">
                <div className="relative">
                    <div className="w-20 h-20 bg-primary/20 rounded-2xl animate-ping absolute inset-0"></div>
                    <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-xl relative z-10">
                        <span className="text-3xl font-bold text-white font-display">CD</span>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground font-display animate-fade-in-up">CampusDash</h1>
                    <div className="flex gap-1">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-0"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoadingScreen;
