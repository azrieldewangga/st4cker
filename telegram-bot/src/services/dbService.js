
import { db } from '../db/index.js';
import { users, transactions, assignments, projects, projectSessions } from '../db/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export class DbService {
    // --- USER ---
    static async ensureUser(telegramUserId) {
        try {
            // Upsert user (create if not exists)
            await db.insert(users)
                .values({ telegramUserId: telegramUserId.toString() })
                .onConflictDoNothing();
            return true;
        } catch (e) {
            console.error('[DB] Ensure User Error:', e);
            return false;
        }
    }

    static async getUser(telegramUserId) {
        const res = await db.select().from(users).where(eq(users.telegramUserId, telegramUserId.toString()));
        return res[0] || null;
    }

    // --- TRANSACTIONS ---
    static async createTransaction(userId, data) {
        // Ensure user exists first
        await DbService.ensureUser(userId);

        // data: { type, amount, category, note, date }
        const id = uuidv4();
        const amount = data.type === 'expense' ? -Math.abs(data.amount) : Math.abs(data.amount);

        // Transaction logic: Insert Tx + Update Balance
        await db.transaction(async (tx) => {
            await tx.insert(transactions).values({
                id: id,
                userId: userId.toString(),
                type: data.type,
                amount: amount,
                category: data.category,
                note: data.note,
                date: data.date,
                title: data.category // default title to category for now
            });

            // Update User Balance
            await tx.update(users)
                .set({
                    currentBalance: sql`${users.currentBalance} + ${amount}`,
                    updatedAt: new Date()
                })
                .where(eq(users.telegramUserId, userId.toString()));
        });

        return { success: true, id };
    }

    static async getTransactions(userId, limit = 10) {
        return await db.select()
            .from(transactions)
            .where(eq(transactions.userId, userId.toString()))
            .orderBy(desc(transactions.date))
            .limit(limit);
    }

    static async getTransactionsByRange(userId, startDate, endDate) {
        return await db.select()
            .from(transactions)
            .where(and(
                eq(transactions.userId, userId.toString()),
                sql`${transactions.date} >= ${startDate}`,
                sql`${transactions.date} <= ${endDate}`
            ))
            .orderBy(desc(transactions.date));
    }

    static async getTransactionById(txId) {
        const res = await db.select().from(transactions).where(eq(transactions.id, txId)).limit(1);
        return res[0] || null;
    }

    static async deleteTransaction(txId) {
        const txRec = await DbService.getTransactionById(txId);
        if (!txRec) return { success: false, message: 'Transaction not found' };

        await db.transaction(async (tx) => {
            // 1. Delete
            await tx.delete(transactions).where(eq(transactions.id, txId));

            // 2. Revert Balance (Inverse operation)
            // If income (+), we subtract. If expense (-), we add (subtract negative).
            const amount = txRec.amount; // Signed amount

            await tx.update(users)
                .set({
                    currentBalance: sql`${users.currentBalance} - ${amount}`,
                    updatedAt: new Date()
                })
                .where(eq(users.telegramUserId, txRec.userId));
        });
        return { success: true, transaction: txRec };
    }

    static async updateTransaction(txId, updates) {
        // updates: { amount?, note? }
        const txRec = await DbService.getTransactionById(txId);
        if (!txRec) return { success: false, message: 'Transaction not found' };

        await db.transaction(async (tx) => {
            if (updates.amount !== undefined) {
                // Determine new signed amount
                const oldAmount = txRec.amount;
                const newRaw = Math.abs(updates.amount);
                const newSigned = txRec.type === 'expense' ? -newRaw : newRaw;

                // Update Transaction
                await tx.update(transactions)
                    .set({ amount: newSigned, updatedAt: new Date() })
                    .where(eq(transactions.id, txId));

                // Update Balance: Remove Old, Add New
                await tx.update(users)
                    .set({
                        currentBalance: sql`${users.currentBalance} - ${oldAmount} + ${newSigned}`,
                        updatedAt: new Date()
                    })
                    .where(eq(users.telegramUserId, txRec.userId));
            }

            if (updates.note !== undefined) {
                await tx.update(transactions)
                    .set({ note: updates.note, updatedAt: new Date() })
                    .where(eq(transactions.id, txId));
            }
        });

        return { success: true };
    }


    // --- TASKS (Assignments) ---
    static async createTask(userId, data) {
        // Ensure user exists
        await DbService.ensureUser(userId);

        const id = uuidv4();
        await db.insert(assignments).values({
            id,
            userId: userId.toString(),
            title: data.title,
            course: data.course,
            type: data.type,
            deadline: data.deadline,
            status: 'pending',
            note: data.note,
            semester: data.semester || 1
        });
        return { success: true, id };
    }

    static async getTasks(userId) {
        // Return pending/in-progress tasks usually (not completed)
        return await db.select()
            .from(assignments)
            .where(and(
                eq(assignments.userId, userId.toString()),
                sql`${assignments.status} != 'completed'`
            ))
            .orderBy(desc(assignments.deadline));
    }

    static async getTaskById(taskId) {
        const res = await db.select().from(assignments).where(eq(assignments.id, taskId)).limit(1);
        return res[0] || null;
    }

    static async deleteTask(taskId) {
        try {
            await db.delete(assignments).where(eq(assignments.id, taskId));
            return { success: true };
        } catch (e) {
            console.error('[DB] Delete Task Error:', e);
            return { success: false, message: e.message };
        }
    }

    static async updateTask(taskId, updates) {
        try {
            await db.update(assignments)
                .set({ ...updates, updatedAt: new Date() })
                .where(eq(assignments.id, taskId));
            return { success: true };
        } catch (e) {
            console.error('[DB] Update Task Error:', e);
            return { success: false, message: e.message };
        }
    }

    static async getDueTasks(dateStr) {
        // Find tasks due on specific date (YYYY-MM-DD)
        // Adjust logic if deadline stores full ISO
        return await db.select()
            .from(assignments)
            .where(and(
                eq(assignments.deadline, dateStr),
                sql`${assignments.status} != 'completed'`
            ));
    }


    // --- PROJECTS ---
    static async createProject(userId, data) {
        // Ensure user exists
        await DbService.ensureUser(userId);

        const id = uuidv4();
        await db.insert(projects).values({
            id,
            userId: userId.toString(),
            title: data.title,
            description: data.description || '',
            deadline: data.deadline || null,
            priority: data.priority || 'medium',
            type: data.type || 'personal',
            courseId: data.courseId || null,
            courseName: data.courseName || '',
            status: 'active',
            totalProgress: 0
        });
        return { success: true, id };
    }

    static async getProjects(userId) {
        return await db.select()
            .from(projects)
            .where(and(
                eq(projects.userId, userId.toString()),
                eq(projects.status, 'active')
            ));
    }

    static async getProjectById(projectId) {
        const res = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        return res[0] || null;
    }

    static async updateProject(projectId, updates) {
        try {
            await db.update(projects)
                .set({ ...updates, updatedAt: new Date() })
                .where(eq(projects.id, projectId));
            return { success: true };
        } catch (e) {
            console.error('[DB] Update Project Error:', e);
            return { success: false, message: e.message };
        }
    }

    static async deleteProject(projectId) {
        try {
            await db.delete(projects).where(eq(projects.id, projectId));
            return { success: true };
        } catch (e) {
            console.error('[DB] Delete Project Error:', e);
            return { success: false, message: e.message };
        }
    }

    static async createProjectLog(projectId, data) {
        const id = uuidv4();
        // data: { sessionDate, duration, note, progressBefore, progressAfter }
        // Also update Project progress
        await db.transaction(async (tx) => {
            // 1. Insert Log
            await tx.insert(projectSessions).values({
                id,
                projectId,
                sessionDate: data.sessionDate, // ISO String
                duration: data.duration, // integer minutes
                note: data.note,
                progressBefore: data.progressBefore,
                progressAfter: data.progressAfter,
                createdAt: new Date()
            });

            // 2. Update Project Progress
            if (data.progressAfter !== undefined) {
                await tx.update(projects)
                    .set({
                        totalProgress: data.progressAfter,
                        updatedAt: new Date()
                    })
                    .where(eq(projects.id, projectId));
            }
        });

        return { success: true, id };
    }
}
