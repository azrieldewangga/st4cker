import crypto from 'crypto';
import db from './database.js';

// Generate random 6-character alphanumeric code
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// Generate UUID v4
function generateSessionToken() {
    return crypto.randomUUID();
}

// Create pairing code
export function createPairingCode(telegramUserId) {
    const now = Date.now();
    const code = generateCode();
    const expiresAt = now + (5 * 60 * 1000); // 5 minutes

    // Check rate limiting (max 3 attempts per 10 minutes)
    const recentCodes = db.prepare(`
    SELECT COUNT(*) as count 
    FROM pairing_codes 
    WHERE telegram_user_id = ? 
      AND created_at > ?
  `).get(telegramUserId, now - (10 * 60 * 1000));

    if (recentCodes.count >= 3) {
        throw new Error('Rate limit exceeded. Wait 10 minutes before generating new code.');
    }

    // Delete old codes for this user
    db.prepare('DELETE FROM pairing_codes WHERE telegram_user_id = ?')
        .run(telegramUserId);

    // Insert new code
    db.prepare(`
    INSERT INTO pairing_codes (code, telegram_user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(code, telegramUserId, now, expiresAt);

    console.log(`[Pairing] Generated code ${code} for user ${telegramUserId}`);

    return { code, expiresAt };
}

// Verify pairing code and create session
export function verifyPairingCode(code) {
    const now = Date.now();

    // Find code
    const pairingCode = db.prepare(`
    SELECT * FROM pairing_codes 
    WHERE code = ?
  `).get(code);

    if (!pairingCode) {
        return { success: false, error: 'Invalid code' };
    }

    // Check if expired
    if (now > pairingCode.expires_at) {
        db.prepare('DELETE FROM pairing_codes WHERE code = ?').run(code);
        return { success: false, error: 'Code expired' };
    }

    // Check if already used
    if (pairingCode.used) {
        return { success: false, error: 'Code already used' };
    }

    // Generate session
    const sessionToken = generateSessionToken();
    const deviceId = crypto.randomUUID();
    const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 days

    // Create session
    db.prepare(`
    INSERT INTO sessions (session_token, telegram_user_id, device_id, created_at, expires_at, last_activity)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionToken, pairingCode.telegram_user_id, deviceId, now, expiresAt, now);

    // Mark code as used
    db.prepare('UPDATE pairing_codes SET used = 1 WHERE code = ?').run(code);

    console.log(`[Pairing] Code ${code} verified, session created for user ${pairingCode.telegram_user_id}`);

    return {
        success: true,
        sessionToken,
        deviceId,
        telegramUserId: pairingCode.telegram_user_id,
        expiresAt
    };
}

// Validate session token
export function validateSession(sessionToken) {
    const now = Date.now();

    const session = db.prepare(`
    SELECT * FROM sessions WHERE session_token = ?
  `).get(sessionToken);

    if (!session) {
        return { valid: false, error: 'Session not found' };
    }

    if (now > session.expires_at) {
        db.prepare('DELETE FROM sessions WHERE session_token = ?').run(sessionToken);
        return { valid: false, error: 'Session expired' };
    }

    // Update last activity
    db.prepare(`
    UPDATE sessions SET last_activity = ? WHERE session_token = ?
  `).run(now, sessionToken);

    return {
        valid: true,
        telegramUserId: session.telegram_user_id,
        deviceId: session.device_id
    };
}

// Unpair (delete session)
export function unpairSession(sessionToken) {
    db.prepare('DELETE FROM sessions WHERE session_token = ?').run(sessionToken);
    return true;
}

// Get sessions for a telegram user
export function getUserSessions(telegramUserId) {
    return db.prepare('SELECT * FROM sessions WHERE telegram_user_id = ?').all(telegramUserId);
}

// Helper: Check if user has active session
export function hasActiveSession(telegramUserId) {
    const session = db.prepare(`
        SELECT session_token 
        FROM sessions 
        WHERE telegram_user_id = ? AND expires_at > ?
        LIMIT 1
    `).get(telegramUserId, Date.now());

    return !!session;
}

// Helper: Get session info
export function getSessionInfo(telegramUserId) {
    return db.prepare(`
        SELECT * 
        FROM sessions 
        WHERE telegram_user_id = ? AND expires_at > ?
        LIMIT 1
    `).get(telegramUserId, Date.now());
}

// Helper: Revoke session (alias for unpair)
export function revokeSession(sessionToken) {
    return unpairSession(sessionToken);
}
