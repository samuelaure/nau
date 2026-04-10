FROM node:20-bookworm-slim

# Install system dependencies
# ffmpeg: required for Remotion/Video processing
# openssl: required for Prisma
# Remotion Chromium deps: libnss3, libasound2, etc.
RUN apt-get update && apt-get install -y \
    ffmpeg \
    openssl \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Download Chromium binary for Remotion
RUN npx remotion browser install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js
ENV NODE_ENV=production
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
