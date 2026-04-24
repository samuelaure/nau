# naŭ Platform

Multi-tenant SaaS monorepo for AI-powered brand intelligence, content automation, and creator tools.

## What's inside

| App / Package | Path | Description |
|---|---|---|
| **api** | `apps/api` | Platform control plane. Owns identity, workspaces, brands, prompts. Issues JWTs. |
| **accounts** | `apps/accounts` | SSO identity provider UI — login, register, Telegram linking. |
| **app** | `apps/app` | Second Brain UI — blocks, journal, voice capture. |
| **mobile** | `apps/mobile` | Instagram overlay + mobile Second Brain (Expo). |
| **flownau** | `apps/flownau` | Content engine — ideation → composition → Remotion render → Instagram publish. |
| **nauthenticity** | `apps/nauthenticity` | Brand intelligence — scraping, transcription, embeddings, comment suggestions. |
| **zazu-bot** | `apps/zazu-bot` | Telegram bot — voice journal, triage, proactive delivery. |
| **zazu-dashboard** | `apps/zazu-dashboard` | Telegram Mini App — brand management UI. |
| **whatsnau** | `apps/whatsnau` | WhatsApp CRM (standalone). |
| `@nau/auth` | `packages/auth` | JWT signing/verification, NestJS guards, cookie builders. |
| `@nau/types` | `packages/types` | Canonical enums and DTOs shared across all services. |
| `@nau/sdk` | `packages/sdk` | Typed API client for consuming `api`. |
| `@nau/logger` | `packages/logger` | Structured logging (pino). |
| `@nau/config` | `packages/config` | Shared config helpers. |
| `@nau/storage` | `packages/storage` | Cloudflare R2 client. |

## Stack

- **Backend:** NestJS · Prisma · PostgreSQL · Redis · BullMQ
- **Frontend:** Next.js 15 (App Router) · React 19
- **Mobile:** Expo · React Native
- **Infra:** Docker · Traefik · Hetzner CX23
- **Tooling:** pnpm workspaces · Turborepo · TypeScript 5

## Getting started

```bash
# Install all dependencies (hoisted via pnpm workspaces)
pnpm install

# Build all shared packages first (apps depend on them)
pnpm build:packages

# Run a specific app in dev mode
pnpm turbo dev --filter=api
pnpm turbo dev --filter=flownau

# Typecheck everything
pnpm typecheck

# Build everything (Turbo caches unchanged apps)
pnpm build
```

## Local infrastructure

```bash
# Create the shared Docker network (once)
docker network create nau-network

# Start the Traefik gateway
docker compose up -d
```

Each app has its own `docker-compose.yml`. Start apps individually from their directory.

## Architecture

See [`docs/platform/ARCHITECTURE.md`](docs/platform/ARCHITECTURE.md) for the full platform architecture, entity ownership rules, and data flow diagrams.

Auth model: [`docs/platform/AUTH.md`](docs/platform/AUTH.md)  
API contract: [`docs/platform/API-CONTRACT.md`](docs/platform/API-CONTRACT.md)  
Decisions (ADRs): [`docs/decisions/`](docs/decisions/)
