FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y \
    ffmpeg \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./
COPY tsconfig.base.json ./

COPY packages ./packages
COPY apps/nauthenticity ./apps/nauthenticity

# Build the Vite dashboard SPA before enabling corepack.
# corepack shims block npm when root package.json declares pnpm as packageManager.
# --ignore-scripts skips husky postinstall from workspace packages.
WORKDIR /app/apps/nauthenticity/dashboard
RUN npm install --ignore-scripts
RUN npm run build

# Enable corepack + install pnpm workspace deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/nauthenticity
RUN npx prisma generate

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
