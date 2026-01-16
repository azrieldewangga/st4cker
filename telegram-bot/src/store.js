import db from './database.js';

// Save user data
export function saveUserData(telegramUserId, data) {
    if (!telegramUserId) return false;

    try {
        console.log('[UserData] Checking existing record...');
        const existing = db.prepare('SELECT telegram_user_id FROM user_data WHERE telegram_user_id = ?').get(telegramUserId);

        const dataString = JSON.stringify(data);
        console.log(`[UserData] Saving data for ${telegramUserId}, length: ${dataString.length}. Updated existing: ${!!existing}`);

        if (existing) {
            console.log('[UserData] Executing UPDATE...');
            db.prepare('UPDATE user_data SET data = ?, updated_at = ? WHERE telegram_user_id = ?')
                .run(dataString, Date.now(), telegramUserId);
        } else {
            console.log('[UserData] Executing INSERT...');
            db.prepare('INSERT INTO user_data (telegram_user_id, data, updated_at) VALUES (?, ?, ?)')
                .run(telegramUserId, dataString, Date.now());
        }
        console.log('[UserData] Save completed.');
        return true;
    } catch (error) {
        console.error('[UserData] Save error:', error);
        return false;
    }
}

// Get user data
export function getUserData(telegramUserId) {
    try {
        const row = db.prepare('SELECT data FROM user_data WHERE telegram_user_id = ?').get(telegramUserId);
        if (row && row.data) {
            const data = JSON.parse(row.data);
            console.log(`[UserData] Retrieved data for ${telegramUserId} with keys:`, data ? Object.keys(data) : 'null');
            return data;
        }
        console.log(`[UserData] No data found for ${telegramUserId}`);
        return null;
    } catch (error) {
        console.error('[UserData] Get error:', error);
        return null;
    }
}
