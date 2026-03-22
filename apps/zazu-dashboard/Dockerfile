FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache libc6-compat

# --- BUILD PHASE ---
COPY package.json package-lock.json tsconfig.json ./
COPY packages/db ./packages/db
COPY apps/dashboard ./apps/dashboard

RUN npm install
RUN npm run build --workspace=@zazu/db
RUN npm run build --workspace=@zazu/dashboard

# --- RUNNER PHASE ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# STANDALONE output Mode handles monorepos by putting the server.js in its root or nested path
# In Next.js 15+ monorepo, it puts the whole structure in standalone/
COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public

# REDUNDANCY: Map the standalone root .next/static which the server looks for at runtime
RUN mkdir -p .next && cp -r apps/dashboard/.next/static .next/static

EXPOSE 3000

# Next.js standalone entrypoint for workspace app
CMD ["node", "apps/dashboard/server.js"]
