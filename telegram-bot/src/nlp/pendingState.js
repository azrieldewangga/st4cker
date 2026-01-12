// pendingState.js - Manage clarification state for multi-turn conversations

const pendingStates = new Map(); // chatId -> state

const TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Set pending state for a chat
 * @param {number} chatId - Telegram chat ID
 * @param {Object} state - Pending state object
 */
export function setPending(chatId, state) {
    pendingStates.set(chatId, {
        ...state,
        created_at: Date.now(),
        expires_at: Date.now() + TTL_MS
    });
}

/**
 * Get pending state for a chat
 * @param {number} chatId - Telegram chat ID
 * @returns {Object|null} Pending state or null if expired/not found
 */
export function getPending(chatId) {
    const state = pendingStates.get(chatId);

    if (!state) return null;

    // Check if expired
    if (Date.now() > state.expires_at) {
        pendingStates.delete(chatId);
        return null;
    }

    return state;
}

/**
 * Clear pending state for a chat
 * @param {number} chatId - Telegram chat ID
 */
export function clearPending(chatId) {
    pendingStates.delete(chatId);
}

/**
 * Update specific fields in pending state
 * @param {number} chatId - Telegram chat ID
 * @param {Object} updates - Fields to update
 */
export function updatePending(chatId, updates) {
    const state = getPending(chatId);
    if (state) {
        setPending(chatId, { ...state, ...updates });
    }
}

/**
 * Check if chat has pending state
 * @param {number} chatId - Telegram chat ID
 * @returns {boolean}
 */
export function hasPending(chatId) {
    return getPending(chatId) !== null;
}

/**
 * Get all pending states (for debugging)
 * @returns {Map}
 */
export function getAllPending() {
    return pendingStates;
}
