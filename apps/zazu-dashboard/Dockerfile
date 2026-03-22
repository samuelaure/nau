FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache libc6-compat

# Copy root configurations
COPY package.json package-lock.json ./
COPY tsconfig.json ./

# Copy packages and apps (only what's needed for build)
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

# Copy standalone build output
# Standard Next.js standalone folder: .next/standalone
COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public

EXPOSE 3000

# Next.js standalone entrypoint
CMD ["node", "apps/dashboard/server.js"]
