# Stage 1: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# Copy ALL workspace package manifests first to leverage layer caching
COPY package*.json ./
COPY apps/bot/package.json ./apps/bot/package.json

COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/skills-core/package.json ./packages/skills-core/package.json
COPY packages/skill-comment-suggester/package.json ./packages/skill-comment-suggester/package.json
COPY packages/feature-conversational/package.json ./packages/feature-conversational/package.json
COPY packages/feature-brand-manager/package.json ./packages/feature-brand-manager/package.json

RUN npm install

# Copy all source code
COPY . .

# Build dependency chain sequentially to avoid race conditions
RUN npm run build --workspace=@zazu/db
RUN npm run build --workspace=@zazu/skills-core
RUN npm run build --workspace=@zazu/skill-comment-suggester
RUN npm run build --workspace=@zazu/feature-conversational
RUN npm run build --workspace=@zazu/feature-brand-manager
RUN npm run build --workspace=@zazu/bot

# Stage 2: Runtime
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

# Copy the entire built monorepo (node_modules + compiled packages + app)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/bot ./apps/bot

CMD ["sh", "-c", "cd packages/db && npx prisma migrate deploy && cd /app && node apps/bot/dist/index.js"]
