# ============================================================
# Runtime-only Dockerfile — Next.js is pre-built by GHA
# ============================================================
# The build step (npm run build) happens in the GHA runner where
# a real PostgreSQL service is available. This image only packages
# the pre-built standalone output with its runtime dependencies.
# ============================================================

FROM node:20-bookworm-slim

# Install runtime system dependencies
# ffmpeg: required for Remotion video processing
# openssl: required for Prisma
# Chromium deps: libnss3, libasound2, etc.
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

# Copy the pre-built standalone server (built in GHA)
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public

# Copy Prisma schema + migrations + config for runtime migrate deploy
COPY prisma ./prisma
COPY prisma.config.js ./

# Install prisma locally so `prisma/config` module is resolvable by prisma.config.js
# This is required by Prisma 7 — the config file imports from 'prisma/config'
RUN npm install prisma@^7.3.0

# Install Remotion globally to download the browser.
# Doing this locally breaks the Next.js standalone node_modules tree (missing `ws`, etc.)
# because standalone uses a deeply pruned and custom resolution structure.
RUN npm install -g @remotion/cli @remotion/renderer
RUN remotion browser install

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
