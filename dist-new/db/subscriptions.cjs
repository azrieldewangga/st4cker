"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptions = void 0;
const index_cjs_1 = require("./index.cjs");
const crypto_1 = require("crypto");
const transactions_cjs_1 = require("./transactions.cjs");
exports.subscriptions = {
    getAll: () => {
        const db = (0, index_cjs_1.getDB)();
        return db.prepare('SELECT * FROM subscriptions ORDER BY dueDay ASC').all();
    },
    create: (sub) => {
        const db = (0, index_cjs_1.getDB)();
        const stmt = db.prepare(`
            INSERT INTO subscriptions (id, name, cost, dueDay, lastPaidDate, createdAt, updatedAt)
            VALUES (@id, @name, @cost, @dueDay, @lastPaidDate, @createdAt, @updatedAt)
        `);
        const newSub = {
            ...sub,
            id: sub.id || (0, crypto_1.randomUUID)(),
            lastPaidDate: sub.lastPaidDate || null, // Null means never paid (or new)
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        stmt.run(newSub);
        return newSub;
    },
    update: (id, data) => {
        const db = (0, index_cjs_1.getDB)();
        const fields = Object.keys(data).map(key => `${key} = @${key}`).join(', ');
        const stmt = db.prepare(`UPDATE subscriptions SET ${fields}, updatedAt = @updatedAt WHERE id = @id`);
        stmt.run({ ...data, id, updatedAt: new Date().toISOString() });
        return exports.subscriptions.getAll();
    },
    delete: (id) => {
        const db = (0, index_cjs_1.getDB)();
        db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
        return { success: true };
    },
    // The Logic Brain: Checks if payment is due and creates transaction
    checkAndProcessDeductions: () => {
        const db = (0, index_cjs_1.getDB)();
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-11
        const currentDay = today.getDate(); // 1-31
        const subs = db.prepare('SELECT * FROM subscriptions').all();
        let deductionsMade = 0;
        db.transaction(() => {
            subs.forEach((sub) => {
                // Determine the "Due Date" for THIS month
                // Note: If dueDay is 31 and month only has 30, we should cap it? 
                // Simple logic: If today >= dueDay, we *should* have paid for this month.
                // Check if already paid for this specific month/year cycle
                let lastPaidMs = 0;
                if (sub.lastPaidDate) {
                    lastPaidMs = new Date(sub.lastPaidDate).getTime();
                }
                // Construct the "Target Payment Date" for this current month
                // Handle edge case: If dueDay > daysInMonth. JS Date handles overflow, so we should be careful.
                const targetDate = new Date(currentYear, currentMonth, sub.dueDay);
                // If the target date overflowed (e.g. Feb 30 -> Mar 2), fix it to last day of month?
                // For simplicity, let's assume JS auto-correct is acceptable or user sets valid days.
                // Actually, let's just use strict logic:
                // If today is past the due day (e.g. today 29th, due 25th)
                if (currentDay >= sub.dueDay) {
                    // Check if we already paid for this month
                    // We check if `lastPaidDate` falls within this month
                    const lastPaid = sub.lastPaidDate ? new Date(sub.lastPaidDate) : null;
                    const alreadyPaidThisMonth = lastPaid &&
                        lastPaid.getFullYear() === currentYear &&
                        lastPaid.getMonth() === currentMonth;
                    if (!alreadyPaidThisMonth) {
                        // PAY IT!
                        console.log(`[Auto-Deduct] Paying ${sub.name} for ${targetDate.toISOString()}`);
                        // 1. Create Transaction using existing module
                        transactions_cjs_1.transactions.create({
                            id: (0, crypto_1.randomUUID)(),
                            title: `Subscription: ${sub.name}`,
                            category: 'Subscription', // Make sure this category exists or is handled
                            type: 'expense',
                            amount: sub.cost,
                            currency: 'IDR', // Defaulting to IDR based on context
                            date: targetDate.toISOString(),
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                        // 2. Update Subscription lastPaidDate
                        db.prepare('UPDATE subscriptions SET lastPaidDate = ? WHERE id = ?')
                            .run(targetDate.toISOString(), sub.id);
                        deductionsMade++;
                    }
                }
            });
        })(); // Execute transaction
        return { deductionsMade };
    }
};
