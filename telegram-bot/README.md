# st4cker Telegram Bot

Event-sourced Telegram bot for quick input to st4cker desktop app.

## Features

- ✅ Secure pairing via time-limited codes
- ✅ Session-based authentication with random tokens
- ✅ WebSocket real-time sync
- ✅ Event-sourcing architecture
- ✅ Persistent SQLite storage (survives restarts)

## Quick Start

### 1. Install Dependencies
```bash
cd telegram-bot
npm install
```

### 2. Configure Environment
Edit `.env`:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
PORT=3000
```

### 3. Run Locally
```bash
npm run dev
```

### 4. Test Pairing Flow
1. Send `/start` to your bot in Telegram
2. Click "Generate Pairing Code"
3. Code is valid for 5 minutes

## API Endpoints

### POST /api/generate-pairing
Generate pairing code for Telegram user.

**Request:**
```json
{ "telegramUserId": "123456789" }
```

**Response:**
```json
{
  "code": "ABC123",
  "expiresAt": 1234567890000
}
```

### POST /api/verify-pairing
Verify code and create session.

**Request:**
```json
{ "code": "ABC123" }
```

**Response:**
```json
{
  "success": true,
  "sessionToken": "uuid-v4-token",
  "expiresAt": 1234567890000
}
```

### POST /api/unpair
Delete session.

**Request:**
```json
{ "sessionToken": "uuid-v4-token" }
```

## WebSocket

**Authentication:**
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'session-token-uuid' }
});
```

**Events:**
- `telegram-event` - Receive events from Telegram bot

## Project Structure

```
telegram-bot/
├── src/
│   ├── index.js      # Main entry point
│   ├── server.js     # Express + Socket.io
│   ├── bot.js        # Telegram bot logic
│   ├── database.js   # SQLite schemas
│   └── pairing.js    # Pairing & session management
├── data/
│   └── bot.db        # SQLite database (auto-created)
├── package.json
└── .env
```

## Deployment

See parent IMPLEMENTATION_PLAN.md for Railway.app deployment instructions.
