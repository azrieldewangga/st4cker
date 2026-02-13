FROM node:20-alpine

# Baileys needs git for some dependencies
RUN apk add --no-cache git

WORKDIR /app

COPY package.json .
RUN npm install --omit=dev

COPY . .

CMD ["node", "index.js"]
