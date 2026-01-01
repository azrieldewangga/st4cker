"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userProfile = void 0;
const index_cjs_1 = require("./index.cjs");
exports.userProfile = {
    get: () => {
        const db = (0, index_cjs_1.getDB)();
        // DEBUG: What is in meta?
        try {
            const allMeta = db.prepare("SELECT * FROM meta").all();
            console.log('[DEBUG] userProfile.get() sees META:', allMeta);
        }
        catch (e) {
            console.log('[DEBUG] userProfile.get() ERROR reading meta:', e);
        }
        const name = db.prepare("SELECT value FROM meta WHERE key = 'user_name'").get();
        const semester = db.prepare("SELECT value FROM meta WHERE key = 'user_semester'").get();
        const avatar = db.prepare("SELECT value FROM meta WHERE key = 'user_avatar'").get();
        const cardLast4 = db.prepare("SELECT value FROM meta WHERE key = 'user_card_last4'").get();
        const major = db.prepare("SELECT value FROM meta WHERE key = 'user_major'").get();
        console.log('[DEBUG] userProfile.get() found:', { name, semester, cardLast4, major });
        if (name && semester) {
            return {
                id: 'user-default-1', // Static ID for single user
                name: name.value,
                semester: parseInt(semester.value),
                avatar: avatar ? avatar.value : '',
                cardLast4: cardLast4 ? cardLast4.value : '',
                major: major ? major.value : '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }
        return null;
    },
    update: (data) => {
        const db = (0, index_cjs_1.getDB)();
        if (data.name !== undefined)
            db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('user_name', ?)").run(data.name);
        if (data.semester !== undefined)
            db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('user_semester', ?)").run(String(data.semester));
        if (data.avatar !== undefined)
            db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('user_avatar', ?)").run(data.avatar);
        if (data.cardLast4 !== undefined)
            db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('user_card_last4', ?)").run(data.cardLast4);
        if (data.major !== undefined)
            db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('user_major', ?)").run(data.major);
        return exports.userProfile.get();
    }
};
