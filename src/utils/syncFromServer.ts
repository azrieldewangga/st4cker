/**
 * Safe Sync Utility - Fetch data FROM server TO local SQLite
 * WARNING: This will OVERWRITE local data with server data
 * Use this when server data is the "source of truth"
 */

import { API_CONFIG } from '@/config/api';

const API_KEY = import.meta.env.VITE_AGENT_API_KEY || 'ef8c66e5cd6e10d60258c9e63101e330c1d058b3e64d98b25ca3fe98c3c8bb62';

export async function syncFromServer() {
    console.log('[Sync] Starting safe sync from server...');
    
    try {
        // 1. Fetch transactions from server
        const txResponse = await fetch(`${API_CONFIG.BASE_URL}/api/v1/transactions`, {
            headers: { 'X-API-Key': API_KEY }
        });
        
        if (!txResponse.ok) throw new Error('Failed to fetch transactions');
        const txData = await txResponse.json();
        
        // 2. Clear local transactions and insert server data
        if (txData.data && Array.isArray(txData.data)) {
            // Clear local SQLite transactions
            await window.electronAPI.transactions.clear();
            
            // Insert server transactions
            for (const tx of txData.data) {
                await window.electronAPI.transactions.create({
                    id: tx.id,
                    title: tx.title,
                    amount: tx.amount,
                    type: tx.type,
                    category: tx.category,
                    date: tx.date,
                    currency: tx.currency || 'IDR',
                    createdAt: tx.createdAt,
                    updatedAt: tx.updatedAt
                });
            }
            console.log(`[Sync] Synced ${txData.data.length} transactions`);
        }
        
        // 3. Fetch balance from server
        const balanceResponse = await fetch(`${API_CONFIG.BASE_URL}/api/v1/balance`, {
            headers: { 'X-API-Key': API_KEY }
        });
        
        if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json();
            console.log('[Sync] Server balance:', balanceData.data.currentBalance);
        }
        
        // 4. Fetch assignments from server
        const taskResponse = await fetch(`${API_CONFIG.BASE_URL}/api/v1/tasks`, {
            headers: { 'X-API-Key': API_KEY }
        });
        
        if (taskResponse.ok) {
            const taskData = await taskResponse.json();
            
            if (taskData.data && Array.isArray(taskData.data)) {
                // Note: We don't clear assignments here to be safe
                // Just log the count
                console.log(`[Sync] Server has ${taskData.data.length} assignments`);
            }
        }
        
        console.log('[Sync] Complete!');
        return { success: true, message: 'Data synced from server' };
        
    } catch (error) {
        console.error('[Sync] Error:', error);
        return { success: false, error: (error as Error).message };
    }
}

export default syncFromServer;
