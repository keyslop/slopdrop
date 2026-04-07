FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/ ./server/
COPY tsconfig.json ./

# tsx runs TypeScript directly
RUN npx tsx --version > /dev/null

EXPOSE 3847

CMD ["npx", "tsx", "server/index.ts"]
