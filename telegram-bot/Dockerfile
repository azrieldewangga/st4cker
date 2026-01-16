FROM node:18-bullseye

# Install build dependencies for better-sqlite3 and other native modules
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including native builds
RUN npm install --omit=dev

# Copy app source
COPY . .

# Set environment
ENV NODE_ENV=production

# Start the bot
CMD ["npm", "run", "start"]
