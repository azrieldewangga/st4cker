/**
 * SyncButton - Manual sync trigger with status indicator
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Cloud, CloudOff, CheckCircle2 } from 'lucide-react';
import { useSync } from '@/hooks/useSync';
import { cn } from '@/lib/utils';

interface SyncButtonProps {
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'default' | 'sm' | 'icon';
    className?: string;
    showLabel?: boolean;
}

export function SyncButton({ 
    variant = 'outline', 
    size = 'sm',
    className,
    showLabel = true 
}: SyncButtonProps) {
    const { forceSync, isOnline } = useSync();
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<Date | null>(null);

    const handleSync = async () => {
        if (!isOnline()) {
            return;
        }
        
        setIsSyncing(true);
        try {
            await forceSync();
            setLastSync(new Date());
        } finally {
            setIsSyncing(false);
        }
    };

    const online = isOnline();

    return (
        <Button
            variant={variant}
            size={size}
            onClick={handleSync}
            disabled={isSyncing || !online}
            className={cn('gap-2', className)}
        >
            {isSyncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
            ) : online ? (
                <Cloud className="h-4 w-4" />
            ) : (
                <CloudOff className="h-4 w-4 text-muted-foreground" />
            )}
            
            {showLabel && (
                <span>
                    {isSyncing ? 'Syncing...' : online ? 'Sync' : 'Offline'}
                </span>
            )}
            
            {lastSync && !isSyncing && (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
            )}
        </Button>
    );
}

export default SyncButton;
