
import { checkConnection } from '../src/db/index.js';

async function verify() {
    console.log('[Verify] Attempting to connect to Railway PostgreSQL...');
    const connected = await checkConnection();

    if (connected) {
        console.log('[Verify] ✅ Connection SUCCESS!');
        process.exit(0);
    } else {
        console.error('[Verify] ❌ Connection FAILED.');
        process.exit(1);
    }
}

verify();
