/**
 * SyncStatus - Online/Offline status indicator
 */

import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncStatusProps {
    className?: string;
}

export function SyncStatus({ className }: SyncStatusProps) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <div className={cn('flex items-center gap-2 text-xs', className)}>
            {isOnline ? (
                <>
                    <Cloud className="h-3 w-3 text-green-500" />
                    <span className="text-green-600">Online</span>
                </>
            ) : (
                <>
                    <CloudOff className="h-3 w-3 text-amber-500" />
                    <span className="text-amber-600">Offline</span>
                </>
            )}
        </div>
    );
}

export default SyncStatus;
