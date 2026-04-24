# ============================================================
# App Dockerfile — Next.js pre-built by GHA, runtime via base
# ============================================================
# Inherits from ghcr.io/samuelaure/flownau/base which includes:
#   - ffmpeg, Chromium, all system libs (pre-cached, rarely changes)
# This image only layers the pre-built Next.js standalone output
# and Prisma client on top — keeps rebuilds to < 2 minutes.
# ============================================================

ARG REPO=samuelaure/flownau
FROM ghcr.io/$REPO/base:latest

WORKDIR /app

# Copy the pre-built Next.js standalone output (built in GHA runner)
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public

# Copy Prisma schema + migrations + config for runtime migrate deploy
COPY prisma ./prisma
COPY prisma.config.js ./

# Install only prisma runtime — standalone already has node_modules pruned.
# Required by Prisma 7: prisma.config.js imports from 'prisma/config'
RUN npm install prisma@^7.3.0 --no-save

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

