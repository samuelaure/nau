FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

WORKDIR /app
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./
COPY tsconfig.base.json ./

COPY packages/auth ./packages/auth
COPY packages/types ./packages/types
COPY packages/logger ./packages/logger
COPY packages/zazu-db ./packages/zazu-db
COPY packages/skills-core ./packages/skills-core
COPY packages/feature-conversational ./packages/feature-conversational
COPY apps/zazu-bot ./apps/zazu-bot

RUN pnpm install --frozen-lockfile

RUN cd packages/zazu-db && npx prisma generate
RUN pnpm turbo build --filter=@zazu/bot

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app ./

EXPOSE 3000

CMD ["sh", "-c", "cd packages/zazu-db && npx prisma migrate deploy && cd /app && node apps/zazu-bot/dist/index.js"]
