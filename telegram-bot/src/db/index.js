
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.warn('[DB] DATABASE_URL is not set. Database features will not work.');
}

// Create connection pool
const pool = new pg.Pool({
    connectionString: connectionString,
});

export const db = drizzle(pool, { schema });

// Helper to check connection
export async function checkConnection() {
    try {
        await pool.query('SELECT 1');
        console.log('[DB] Connected to PostgreSQL via Drizzle');
        return true;
    } catch (e) {
        console.error('[DB] Connection failed:', e.message);
        return false;
    }
}
