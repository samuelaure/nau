# Stage 1: Dependency Installation
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app


# Copy root package.json and lockfile
COPY package.json package-lock.json ./
# Copy app and package manifests
COPY apps/bot/package.json ./apps/bot/package.json
COPY packages/db/package.json ./packages/db/package.json

# Install dependencies
RUN npm install

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client and build db package
RUN cd packages/db && npm run build

# Build the bot
RUN npx tsc -p apps/bot/tsconfig.json


# Stage 3: Runtime
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app


ENV NODE_ENV=production

# Copy built files and necessary artifacts
COPY --from=builder /app/dist/apps/bot ./apps/bot/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# If using Prisma, we need the generated client
COPY --from=builder /app/packages/db ./packages/db


# Command to run the bot with database migrations
CMD ["sh", "-c", "cd packages/db && npx prisma migrate deploy && cd /app && node apps/bot/dist/index.js"]
