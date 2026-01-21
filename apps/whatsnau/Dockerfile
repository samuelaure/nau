# Build Stage
FROM node:20-slim AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy root config files
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./

# Install all dependencies (including dev)
RUN npm install

# Build Backend
COPY src ./src/
RUN npm run prisma:generate
RUN npm run build

# Build Frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Production Stage
FROM node:20-slim
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/frontend/dist ./frontend/dist

# Environment setup
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "start"]
