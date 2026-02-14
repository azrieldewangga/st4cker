import { initDatabase } from './db/init.js';

// Initialize database first, then start services
await initDatabase();

import './server.js';
import './bot.js';

console.log('🚀 st4cker Telegram Bot & WebSocket Server started');
console.log('📱 Bot is polling for Telegram messages');
console.log('🔌 WebSocket server ready for connections');
console.log('✅ Phase 1 implementation ready!');
