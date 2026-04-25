FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y \
    ffmpeg \
    openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

WORKDIR /app

COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./
COPY tsconfig.base.json ./

COPY packages ./packages
COPY apps/nauthenticity ./apps/nauthenticity

RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/nauthenticity
RUN npx prisma generate

# Build the Vite dashboard SPA (uses npm, not pnpm — not a workspace package)
WORKDIR /app/apps/nauthenticity/dashboard
RUN npm install --frozen-lockfile
RUN npm run build

WORKDIR /app
RUN pnpm build --filter=nauthenticity

FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y \
    ffmpeg \
    openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

WORKDIR /app
COPY --from=builder /app ./

ENV NODE_ENV=production

CMD ["sh", "-c", "cd apps/nauthenticity && npx prisma migrate deploy && node dist/main"]
