FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache libc6-compat

# --- BUILD PHASE ---
COPY package.json package-lock.json tsconfig.json ./
COPY packages/db ./packages/db
COPY apps/dashboard ./apps/dashboard

RUN npm install

# Inyectamos variables dummy solo para que el build no falle por validaciones de Auth.js o Prisma
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV AUTH_SECRET="7ef44a4289280436f1e5e709fab0e7d86d3d84b2f91670feacc67f4ee139c077"
ENV NEXTAUTH_URL="https://zazu.9nau.com"

RUN npm run build --workspace=@zazu/db
RUN npm run build --workspace=@zazu/dashboard

# --- RUNNER PHASE ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy standalone build output
COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public

# REDUNDANCY for Middleware and Static resolution
RUN mkdir -p .next && ln -s /app/apps/dashboard/.next/static /app/.next/static

EXPOSE 3000

# Next.js standalone entrypoint
CMD ["node", "apps/dashboard/server.js"]
