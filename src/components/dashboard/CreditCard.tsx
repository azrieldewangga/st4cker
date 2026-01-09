import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStoreNew';
import clsx from 'clsx';
import { Wifi } from 'lucide-react';

const CreditCard = () => {
    const navigate = useNavigate();
    const userProfile = useStore(state => state.userProfile);
    const cardRef = useRef<HTMLDivElement>(null);
    const [rotate, setRotate] = useState({ x: 0, y: 0 });
    const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

    const last4 = userProfile?.cardLast4 || '8888';
    const name = userProfile?.name || 'Card Holder';

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;

        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Calculate rotation (max 15 degrees)
        const rotateX = ((y - centerY) / centerY) * -15; // Invert Y axis
        const rotateY = ((x - centerX) / centerX) * 15;

        // Calculate glare position
        const glareX = (x / rect.width) * 100;
        const glareY = (y / rect.height) * 100;

        setRotate({ x: rotateX, y: rotateY });
        setGlare({ x: glareX, y: glareY, opacity: 1 });
    };

    const handleMouseLeave = () => {
        setRotate({ x: 0, y: 0 });
        setGlare(prev => ({ ...prev, opacity: 0 }));
    };

    return (
        <div
            className="w-full h-full cursor-pointer perspective-1000"
            style={{ perspective: '1000px' }}
            onClick={() => navigate('/cashflow')}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            ref={cardRef}
        >
            {/* CARD CONTENT */}
            <div
                className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl transition-all duration-200 ease-out"
                style={{
                    transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale(${rotate.x !== 0 ? 1.05 : 1})`,
                    transformStyle: 'preserve-3d',
                    boxShadow: Math.abs(rotate.x) + Math.abs(rotate.y) > 0
                        ? `${-rotate.y}px ${rotate.x}px 20px rgba(0,0,0,0.4)`
                        : '0 10px 30px rgba(0,0,0,0.2)'
                }}
            >

                {/* Metallic Background */}
                <div className="absolute inset-0 bg-neutral-900">
                    {/* Metallic Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-black to-gray-900 opacity-90"></div>
                    {/* Brushed Metal Texture imitation */}
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/brushed-alum.png')]"></div>

                    {/* Dynamic Glare */}
                    <div
                        className="absolute inset-0 pointer-events-none mix-blend-overlay transition-opacity duration-200"
                        style={{
                            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 80%)`,
                            opacity: glare.opacity
                        }}
                    ></div>
                </div>

                {/* Card Elements (Raised Z-Index for Depth) */}
                <div className="relative z-10 p-6 flex flex-col justify-between h-full font-mono text-white/90" style={{ transform: 'translateZ(30px)' }}>

                    {/* Top Row: Chip & Wifi */}
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4 items-center">
                            {/* Chip */}
                            <div className="w-12 h-9 bg-yellow-500/80 rounded-md border border-yellow-400/50 relative overflow-hidden flex items-center justify-center shadow-sm">
                                <div className="absolute inset-0 border-[0.5px] border-black/20 rounded-md"></div>
                                {/* Chip Lines */}
                                <div className="w-full h-[1px] bg-black/30 absolute top-1/2 -translate-y-1/2"></div>
                                <div className="h-full w-[1px] bg-black/30 absolute left-1/2 -translate-x-1/2"></div>
                                <div className="w-8 h-6 border border-black/20 rounded-sm"></div>
                            </div>
                            <Wifi className="rotate-90 opacity-70" size={24} />
                        </div>
                        {/* Mastercard Logo (Simplified CSS/SVG) */}
                        <div className="flex relative items-center">
                            <div className="w-8 h-8 rounded-full bg-red-600/90 mix-blend-screen shadow-lg"></div>
                            <div className="w-8 h-8 rounded-full bg-yellow-500/90 mix-blend-screen -ml-4 shadow-lg"></div>
                        </div>
                    </div>

                    {/* Middle: Number */}
                    <div className="mt-4">
                        <div className="text-xl tracking-[0.2em] flex items-center gap-4 opacity-90 shadow-black drop-shadow-md">
                            <span>****</span>
                            <span>****</span>
                            <span>****</span>
                            <span className="text-2xl">{last4}</span>
                        </div>
                    </div>

                    {/* Bottom: Details */}
                    <div className="flex justify-between items-end mt-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] opacity-50 uppercase tracking-widest">Card Holder</span>
                            <span className="font-semibold tracking-wider text-sm truncate max-w-[180px]">{name.toUpperCase()}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] opacity-50 uppercase tracking-widest">Expires</span>
                            <span className="font-semibold tracking-wider text-sm">12/05</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default CreditCard;
