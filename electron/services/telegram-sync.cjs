// Telegram Bot Sync Handlers
// Store for Telegram session (encrypted via Electron safeStorage)
const Store = require('electron-store');
const { io: ioClient } = require('socket.io-client');
const { ipcMain, BrowserWindow } = require('electron');

const telegramStore = new Store({
    name: 'telegram-sync',
    encryptionKey: 'st4cker-telegram-encryption-key'
});

let telegramSocket = null;
const WEBSOCKET_URL = process.env.TELEGRAM_WEBSOCKET_URL || 'https://elegant-heart-production.up.railway.app';

// Initialize WebSocket connection
function initTelegramWebSocket(sessionToken) {
    if (telegramSocket?.connected) {
        console.log('[Telegram] Already connected');
        return;
    }

    console.log(`[Telegram] Connecting to ${WEBSOCKET_URL}`);

    telegramSocket = ioClient(WEBSOCKET_URL, {
        auth: { token: sessionToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10
    });

    telegramSocket.on('connect', () => {
        console.log('[Telegram] WebSocket connected');
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('telegram:status-change', 'connected');
        });
    });

    telegramSocket.on('disconnect', () => {
        console.log('[Telegram] WebSocket disconnected');
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('telegram:status-change', 'disconnected');
        });
    });

    telegramSocket.on('connect_error', (error) => {
        console.error('[Telegram] Connection error:', error.message);
    });

    telegramSocket.on('telegram-event', async (event) => {
        console.log('[Telegram] Received event:', event.eventType);
        // TODO: Process event (Phase 4 implementation)
        // For now, just log it
    });
}

// Check if paired on app start
function checkTelegramPairing() {
    const paired = telegramStore.get('paired', false) as boolean;
    const sessionToken = telegramStore.get('sessionToken') as string | undefined;

    if (paired && sessionToken) {
        console.log('[Telegram] Found existing pairing, connecting...');
        initTelegramWebSocket(sessionToken);
    }
}

// IPC Handlers
ipcMain.handle('telegram:verify-pairing', async (_, code) => {
    try {
        const response = await fetch(`${WEBSOCKET_URL}/api/verify-pairing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });

        const data = await response.json();

        if (data.success) {
            // Store session token
            telegramStore.set('sessionToken', data.sessionToken);
            telegramStore.set('paired', true);
            telegramStore.set('expiresAt', data.expiresAt);

            // Initialize WebSocket connection
            initTelegramWebSocket(data.sessionToken);

            return { success: true };
        }

        return { success: false, error: data.error || 'Invalid code' };
    } catch (error) {
        console.error('[Telegram] Verify pairing error:', error);
        return { success: false, error: 'Connection failed' };
    }
});

ipcMain.handle('telegram:unpair', async () => {
    const sessionToken = telegramStore.get('sessionToken') as string | undefined;

    if (sessionToken) {
        // Notify server
        try {
            await fetch(`${WEBSOCKET_URL}/api/unpair`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken })
            });
        } catch (error) {
            console.error('[Telegram] Unpair API error:', error);
        }
    }

    // Close WebSocket
    if (telegramSocket) {
        telegramSocket.close();
        telegramSocket = null;
    }

    // Clear local data
    telegramStore.delete('sessionToken');
    telegramStore.delete('paired');
    telegramStore.delete('expiresAt');

    return { success: true };
});

ipcMain.handle('telegram:get-status', () => {
    const paired = telegramStore.get('paired', false);
    const expiresAt = telegramStore.get('expiresAt');
    const connected = telegramSocket?.connected || false;

    return {
        paired,
        expiresAt,
        status: paired ? (connected ? 'connected' : 'disconnected') : 'unknown'
    };
});

// Export for main.cts
module.exports = {
    checkTelegramPairing
};
