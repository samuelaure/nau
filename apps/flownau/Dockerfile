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
# outputFileTracingRoot=../../ means standalone mirrors the monorepo tree:
# node_modules/ at root, server.js at apps/flownau/server.js.
COPY .next/standalone ./
COPY .next/static ./apps/flownau/.next/static
COPY public ./apps/flownau/public

# Copy Prisma schema + migrations + config for runtime migrate deploy
COPY prisma ./prisma
COPY prisma.config.js ./

# Install runtime-only packages not captured by the standalone tracer in pnpm monorepos.
# @swc/helpers: pnpm virtual-store layout prevents nft from hoisting it.
# prisma + @prisma/client: Turbopack doesn't trace native .so engine into standalone output.
# pino-std-serializers: transitive dep of pino not hoisted correctly by nft.
RUN npm install prisma@^7.3.0 @prisma/client@^7.3.0 @swc/helpers@^0.5.5 @next/env \
      pino-std-serializers @pinojs/redact pg-types quick-format-unescaped --no-save && \
    node_modules/.bin/prisma generate --schema=prisma/schema.prisma

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/flownau/server.js"]

