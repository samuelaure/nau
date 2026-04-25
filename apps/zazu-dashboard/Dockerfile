FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
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
COPY apps/zazu-dashboard ./apps/zazu-dashboard

RUN pnpm install --frozen-lockfile

# Dummy build-time vars — real values are injected at runtime via env_file
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV AUTH_SECRET="build-time-placeholder-not-a-real-secret"
ENV NEXTAUTH_URL="https://zazu.9nau.com"

RUN cd packages/zazu-db && npx prisma generate
RUN pnpm turbo build --filter=@zazu/dashboard

# Stage the engine at a stable path so the runner can copy it without glob
RUN find /app/node_modules -name "libquery_engine-linux-musl-openssl-3.0.x.so.node" \
      -exec cp {} /app/prisma-engine.so.node \; 2>/dev/null || true

RUN mkdir -p apps/zazu-dashboard/public apps/zazu-dashboard/.next/static

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/zazu-dashboard/.next/standalone ./
COPY --from=builder /app/apps/zazu-dashboard/.next/static ./apps/zazu-dashboard/.next/static
COPY --from=builder /app/apps/zazu-dashboard/public ./apps/zazu-dashboard/public
# Prisma engine — not traced into standalone by Next.js file tracer in pnpm monorepos
COPY --from=builder /app/prisma-engine.so.node ./apps/zazu-dashboard/.next/server/libquery_engine-linux-musl-openssl-3.0.x.so.node

RUN mkdir -p .next && ln -s /app/apps/zazu-dashboard/.next/static /app/.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "apps/zazu-dashboard/server.js"]
