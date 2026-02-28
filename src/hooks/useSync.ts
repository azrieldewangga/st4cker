/**
 * useSync Hook - Comprehensive Sync System
 * 
 * Features:
 * 1. Auto-polling (every 5 minutes)
 * 2. Manual sync trigger
 * 3. Online/offline detection
 * 4. BroadcastChannel for cross-tab sync
 * 5. OpenClaw change detection
 */

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store/useStoreNew';
import { toast } from 'sonner';

const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SYNC_CHANNEL = 'st4cker-sync-channel';

export function useSync() {
    const store = useStore();
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const channelRef = useRef<BroadcastChannel | null>(null);
    const isOnlineRef = useRef<boolean>(navigator.onLine);

    // Sync functions
    const syncAll = useCallback(async (showToast = false) => {
        console.log('[useSync] Starting full sync...');
        
        try {
            // Push local changes first (if any in queue)
            await store.syncAssignmentsToBackend?.();
            await store.syncTransactionsToBackend?.();
            await store.syncProjectsToBackend?.();
            await store.syncScheduleToBackend?.();

            // Then fetch from backend
            await Promise.all([
                store.fetchAssignmentsFromBackend?.(),
                store.fetchTransactionsFromBackend?.(),
                store.fetchProjectsFromBackend?.(),
                store.fetchScheduleFromBackend?.()
            ]);

            if (showToast) {
                toast.success('Data tersinkron!', {
                    description: 'Semua data sudah up-to-date'
                });
            }
            
            console.log('[useSync] Full sync completed');
            return true;
        } catch (error) {
            console.error('[useSync] Sync failed:', error);
            if (showToast) {
                toast.error('Gagal sinkron', {
                    description: 'Cek koneksi internet dan coba lagi'
                });
            }
            return false;
        }
    }, [store]);

    const syncAssignments = useCallback(async () => {
        try {
            await store.syncAssignmentsToBackend?.();
            await store.fetchAssignmentsFromBackend?.();
            console.log('[useSync] Assignments synced');
        } catch (error) {
            console.error('[useSync] Assignment sync failed:', error);
        }
    }, [store]);

    const syncTransactions = useCallback(async () => {
        try {
            await store.syncTransactionsToBackend?.();
            await store.fetchTransactionsFromBackend?.();
            console.log('[useSync] Transactions synced');
        } catch (error) {
            console.error('[useSync] Transaction sync failed:', error);
        }
    }, [store]);

    const syncSchedule = useCallback(async () => {
        try {
            await store.syncScheduleToBackend?.();
            await store.fetchScheduleFromBackend?.();
            console.log('[useSync] Schedule synced');
        } catch (error) {
            console.error('[useSync] Schedule sync failed:', error);
        }
    }, [store]);

    // Broadcast to other tabs
    const broadcastSync = useCallback((type: string) => {
        if (channelRef.current) {
            channelRef.current.postMessage({
                type: 'SYNC',
                payload: { syncType: type, timestamp: Date.now() }
            });
        }
    }, []);

    // Setup polling
    useEffect(() => {
        const startPolling = () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
            
            pollingRef.current = setInterval(() => {
                console.log('[useSync] Auto-polling triggered');
                syncAll(false);
            }, POLLING_INTERVAL);
            
            console.log('[useSync] Polling started (5 min interval)');
        };

        const stopPolling = () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
                console.log('[useSync] Polling stopped');
            }
        };

        // Start polling when online
        if (navigator.onLine) {
            startPolling();
        }

        // Handle online/offline
        const handleOnline = () => {
            console.log('[useSync] Browser went online');
            isOnlineRef.current = true;
            startPolling();
            
            // Immediate sync when back online
            toast.info('Koneksi kembali', { description: 'Menyinkronkan data...' });
            syncAll(false).then(() => {
                toast.success('Sinkronisasi selesai');
            });
        };

        const handleOffline = () => {
            console.log('[useSync] Browser went offline');
            isOnlineRef.current = false;
            stopPolling();
            toast.warning('Mode offline', { 
                description: 'Perubahan akan disimpan lokal dan sync saat online' 
            });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            stopPolling();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [syncAll]);

    // Setup BroadcastChannel for cross-tab communication
    useEffect(() => {
        if (typeof BroadcastChannel !== 'undefined') {
            channelRef.current = new BroadcastChannel(SYNC_CHANNEL);
            
            channelRef.current.onmessage = (event) => {
                const { type, payload } = event.data;
                
                if (type === 'SYNC') {
                    console.log('[useSync] Received sync broadcast from another tab', payload);
                    // Refresh data without showing toast
                    store.fetchAssignments?.();
                    store.fetchTransactions?.();
                }
                
                if (type === 'OPENCLAW_CHANGE') {
                    console.log('[useSync] Received OpenClaw change', payload);
                    // Specific sync based on change type
                    if (payload.entity === 'task') {
                        store.fetchAssignmentsFromBackend?.();
                    } else if (payload.entity === 'transaction') {
                        store.fetchTransactionsFromBackend?.();
                    } else if (payload.entity === 'schedule') {
                        store.fetchScheduleFromBackend?.();
                    }
                    
                    toast.info(`Update dari OpenClaw: ${payload.action}`, {
                        description: payload.details
                    });
                }
            };
        }

        return () => {
            channelRef.current?.close();
        };
    }, [store]);

    // Listen for custom events (from OpenClaw webhook)
    useEffect(() => {
        const handleOpenClawEvent = (event: CustomEvent) => {
            const { entity, action, data } = event.detail;
            console.log('[useSync] OpenClaw event received:', entity, action);
            
            // Broadcast to other tabs
            broadcastSync('OPENCLAW_CHANGE');
            
            // Sync specific entity
            if (entity === 'task') {
                store.fetchAssignmentsFromBackend?.();
            } else if (entity === 'transaction') {
                store.fetchTransactionsFromBackend?.();
            } else if (entity === 'schedule') {
                store.fetchScheduleFromBackend?.();
            }
        };

        window.addEventListener('openclaw-update' as any, handleOpenClawEvent);
        
        return () => {
            window.removeEventListener('openclaw-update' as any, handleOpenClawEvent);
        };
    }, [store, broadcastSync]);

    // Force sync function (for manual trigger)
    const forceSync = useCallback(async () => {
        toast.info('Menyinkronkan...', { description: 'Mohon tunggu' });
        const success = await syncAll(true);
        if (success) {
            broadcastSync('MANUAL');
        }
        return success;
    }, [syncAll, broadcastSync]);

    // Sync specific entity
    const syncProjects = useCallback(async () => {
        try {
            await store.syncProjectsToBackend?.();
            await store.fetchProjectsFromBackend?.();
            console.log('[useSync] Projects synced');
        } catch (error) {
            console.error('[useSync] Project sync failed:', error);
        }
    }, [store]);

    const syncEntity = useCallback(async (entity: 'assignments' | 'transactions' | 'projects' | 'schedule') => {
        toast.info(`Sync ${entity}...`);
        
        switch (entity) {
            case 'assignments':
                await syncAssignments();
                break;
            case 'transactions':
                await syncTransactions();
                break;
            case 'projects':
                await syncProjects();
                break;
            case 'schedule':
                await syncSchedule();
                break;
        }
        
        toast.success(`${entity} tersinkron!`);
        broadcastSync(`ENTITY_${entity.toUpperCase()}`);
    }, [syncAssignments, syncTransactions, syncProjects, syncSchedule, broadcastSync]);

    return {
        syncAll,
        forceSync,
        syncEntity,
        syncAssignments,
        syncTransactions,
        syncProjects,
        syncSchedule,
        isOnline: () => navigator.onLine,
        lastSync: null // Could track this in the future
    };
}

export default useSync;
