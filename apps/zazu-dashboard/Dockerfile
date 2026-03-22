FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache libc6-compat

# Copy root configurations
COPY package.json package-lock.json ./
COPY tsconfig.json ./

# Copy packages and apps
COPY packages/db ./packages/db
COPY apps/dashboard ./apps/dashboard

# Install and build
RUN npm install
RUN cd packages/db && npm run build
RUN cd apps/dashboard && npm run build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# --- STANDALONE MONOREPO STRUCTURE ---
# Next.js Standalone puts everything inside .next/standalone
# We copy from there to our runner root
COPY --from=builder /app/apps/dashboard/.next/standalone ./

# IMPORTANT: Static files MUST be in the root .next folder for Standalone to serve them
# and also in the public folder
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public

# Redundancy: Some Next.js versions look at the root .next for static assets
RUN mkdir -p .next && ln -s /app/apps/dashboard/.next/static /app/.next/static

EXPOSE 3000

# Next.js standalone entrypoint in monorepo is inside the app folder
CMD ["node", "apps/dashboard/server.js"]
