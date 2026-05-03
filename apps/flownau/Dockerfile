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
# pino + pg: Turbopack externalises these with fingerprinted IDs (pkg-HASH) derived from
#   the build-time pnpm virtual-store path. We install the real packages then create
#   symlinks named pkg-HASH -> pkg by extracting the hashes from the built SSR chunks.
RUN npm install prisma@^7.3.0 @prisma/client@^7.3.0 @swc/helpers@^0.5.5 @next/env --no-save && \
    node_modules/.bin/prisma generate --schema=prisma/schema.prisma && \
    cd apps/flownau/.next/node_modules && \
    npm install pino@^10.3.1 pino-pretty@^13.1.3 pg pg-connection-string pg-types "@prisma/adapter-pg@^7.3.0" --no-save && \
    for h in $(grep -rh 'pg-[0-9a-f]' ../server/chunks/ 2>/dev/null | grep -o '"pg-[0-9a-f]\{16\}"' | tr -d '"' | sort -u); do \
        ln -sfn pg "$h" 2>/dev/null || true; \
    done && \
    for h in $(grep -rh 'adapter-pg-[0-9a-f]' ../server/chunks/ 2>/dev/null | grep -o '"@prisma/adapter-pg-[0-9a-f]\{16\}"' | tr -d '"' | sed 's|@prisma/||' | sort -u); do \
        mkdir -p @prisma && ln -sfn adapter-pg "@prisma/$h" 2>/dev/null || true; \
    done && \
    for h in $(grep -rh 'pino-[0-9a-f]' ../server/chunks/ 2>/dev/null | grep -o '"pino-[0-9a-f]\{16\}"' | tr -d '"' | sort -u); do \
        ln -sfn pino "$h" 2>/dev/null || true; \
    done

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/flownau/server.js"]

