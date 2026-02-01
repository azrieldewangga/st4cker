import crypto from 'crypto';
import { db } from './db/index.js';
import { pairingCodes, sessions, devices, users } from './db/schema.js';
import { eq, and, gt, sql, desc } from 'drizzle-orm';

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

/**
 * Create pairing code
 */
export async function createPairingCode(telegramUserId) {
    const now = new Date();
    const code = generateCode();
    const expiresAt = new Date(now.getTime() + (5 * 60 * 1000)); // 5 minutes

    // Check rate limiting (max 3 attempts per 10 minutes)
    const tenMinutesAgo = new Date(now.getTime() - (10 * 60 * 1000));
    const recentCodes = await db.select({ count: sql`count(*)` })
        .from(pairingCodes)
        .where(and(
            eq(pairingCodes.telegramUserId, telegramUserId.toString()),
            gt(pairingCodes.createdAt, tenMinutesAgo)
        ));

    if (Number(recentCodes[0].count) >= 3) {
        throw new Error('Rate limit exceeded. Wait 10 minutes before generating new code.');
    }

    // Delete old codes for this user
    await db.delete(pairingCodes).where(eq(pairingCodes.telegramUserId, telegramUserId.toString()));

    // Insert new code
    await db.insert(pairingCodes).values({
        code,
        telegramUserId: telegramUserId.toString(),
        createdAt: now,
        expiresAt
    });

    console.log(`[Pairing] Generated code ${code} for user ${telegramUserId}`);

    return { code, expiresAt };
}

/**
 * Verify pairing code and create session
 */
export async function verifyPairingCode(code) {
    const now = new Date();

    // Find code
    const res = await db.select().from(pairingCodes).where(eq(pairingCodes.code, code.toUpperCase())).limit(1);
    const pairingCode = res[0];

    if (!pairingCode) {
        return { success: false, error: 'Invalid code' };
    }

    // Check if expired
    if (now > pairingCode.expiresAt) {
        await db.delete(pairingCodes).where(eq(pairingCodes.code, code.toUpperCase()));
        return { success: false, error: 'Code expired' };
    }

    // Check if already used
    if (pairingCode.used) {
        return { success: false, error: 'Code already used' };
    }

    // Generate session
    const sessionToken = generateSessionToken();
    const deviceId = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

    // Create session in transaction
    await db.transaction(async (tx) => {
        // 1. Mark code as used
        await tx.update(pairingCodes).set({ used: true }).where(eq(pairingCodes.code, code.toUpperCase()));

        // 2. Create session
        await tx.insert(sessions).values({
            sessionToken,
            telegramUserId: pairingCode.telegramUserId,
            deviceId,
            createdAt: now,
            expiresAt,
            lastActivity: now
        });
    });

    console.log(`[Pairing] Code ${code} verified, session created for user ${pairingCode.telegramUserId}`);

    return {
        success: true,
        sessionToken,
        deviceId,
        telegramUserId: pairingCode.telegramUserId,
        expiresAt: expiresAt.getTime()
    };
}

/**
 * Validate session token
 */
export async function validateSession(sessionToken) {
    const now = new Date();

    const res = await db.select().from(sessions).where(eq(sessions.sessionToken, sessionToken)).limit(1);
    const session = res[0];

    if (!session) {
        return { valid: false, error: 'Session not found' };
    }

    if (now > session.expiresAt) {
        await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
        return { valid: false, error: 'Session expired' };
    }

    // Update last activity
    await db.update(sessions)
        .set({ lastActivity: now })
        .where(eq(sessions.sessionToken, sessionToken));

    return {
        valid: true,
        telegramUserId: session.telegramUserId,
        deviceId: session.deviceId
    };
}

/**
 * Unpair (delete session)
 */
export async function unpairSession(sessionToken) {
    await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
    return true;
}

/**
 * Get sessions for a telegram user
 */
export async function getUserSessions(telegramUserId) {
    return await db.select().from(sessions)
        .where(eq(sessions.telegramUserId, telegramUserId.toString()))
        .orderBy(desc(sessions.lastActivity));
}

/**
 * Helper: Check if user has active session
 */
export async function hasActiveSession(telegramUserId) {
    const now = new Date();
    const res = await db.select({ id: sessions.sessionToken })
        .from(sessions)
        .where(and(
            eq(sessions.telegramUserId, telegramUserId.toString()),
            gt(sessions.expiresAt, now)
        ))
        .limit(1);

    return res.length > 0;
}

/**
 * Helper: Get session info
 */
export async function getSessionInfo(telegramUserId) {
    const now = new Date();
    const res = await db.select().from(sessions)
        .where(and(
            eq(sessions.telegramUserId, telegramUserId.toString()),
            gt(sessions.expiresAt, now)
        ))
        .limit(1);

    return res[0] || null;
}

/**
 * Helper: Revoke session (alias for unpair)
 */
export async function revokeSession(sessionToken) {
    return await unpairSession(sessionToken);
}
