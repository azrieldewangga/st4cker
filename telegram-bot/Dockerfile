FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (no native build deps needed — better-sqlite3 removed)
RUN npm install --omit=dev

# Copy app source
COPY . .

# Set environment
ENV NODE_ENV=production

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/health || exit 1

# Start the bot
CMD ["npm", "run", "start"]
