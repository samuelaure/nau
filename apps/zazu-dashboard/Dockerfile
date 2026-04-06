FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

# Copy ALL workspace package manifests first to leverage layer caching
COPY package*.json tsconfig.json ./
COPY apps/bot/package.json ./apps/bot/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY apps/dashboard/package.json ./apps/dashboard/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/skills-core/package.json ./packages/skills-core/package.json
COPY packages/skill-comment-suggester/package.json ./packages/skill-comment-suggester/package.json
COPY packages/feature-conversational/package.json ./packages/feature-conversational/package.json
COPY packages/feature-brand-manager/package.json ./packages/feature-brand-manager/package.json

RUN npm install

# Copy all source code
COPY . .

# Dummy env vars so Next.js build doesn't fail on missing vars at build time
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV AUTH_SECRET="7ef44a4289280436f1e5e709fab0e7d86d3d84b2f91670feacc67f4ee139c077"
ENV NEXTAUTH_URL="https://zazu.9nau.com"

RUN npm run build --workspace=@zazu/db
RUN npm run build --workspace=@zazu/dashboard

# --- RUNNER PHASE ---
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy Next.js standalone output
COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public

# Symlink for static resolution in Next.js standalone mode
RUN mkdir -p .next && ln -s /app/apps/dashboard/.next/static /app/.next/static

EXPOSE 3000

CMD ["node", "apps/dashboard/server.js"]
