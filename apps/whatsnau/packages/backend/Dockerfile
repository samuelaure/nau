# Build Stage
FROM node:20-slim AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy root workspace config
COPY package.json package-lock.json ./

# Copy backend package files
COPY packages/backend/package.json packages/backend/
COPY packages/backend/prisma packages/backend/prisma/
COPY packages/backend/tsconfig.json packages/backend/

# Copy frontend package files
COPY packages/frontend/package.json packages/frontend/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/backend/src packages/backend/src/
COPY packages/frontend/ packages/frontend/

# Build Backend
WORKDIR /app/packages/backend
RUN npm run prisma:generate
RUN npm run build

# Build Frontend
WORKDIR /app/packages/frontend
RUN npm run build

# Production Stage
FROM node:20-slim
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy root node_modules (production deps are mixed with dev deps usually, 
# unless we prune. For simplicity, copy all, or run install --prod. 
# But workspaces make this tricky. Copying existing modules is safer/faster.)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy backend artifacts
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/package.json ./packages/backend/
COPY --from=builder /app/packages/backend/prisma ./packages/backend/prisma

# Copy frontend artifacts
COPY --from=builder /app/packages/frontend/dist ./packages/frontend/dist

# Environment setup
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start command
WORKDIR /app/packages/backend
CMD npm start
