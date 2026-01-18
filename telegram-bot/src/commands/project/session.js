// Local in-memory session store
// Best Practice: Map for O(1) key access (Rule 7.11)
const projectSessions = new Map();

export function clearSession(userId) {
    projectSessions.delete(userId.toString());
}

export function getSession(userId) {
    return projectSessions.get(userId.toString());
}

export function updateSession(userId, data) {
    const uid = userId.toString();
    const existing = projectSessions.get(uid) || {};

    if (data.state === 'IDLE') {
        projectSessions.delete(uid);
    } else {
        projectSessions.set(uid, {
            ...existing,
            ...data
        });
    }
}
