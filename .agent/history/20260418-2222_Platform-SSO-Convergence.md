# Platform SSO & Convergence Archive

> **Date:** 2026-04-18
> **Status:** Phase 4 Terminated - Platform Standardized

---

## MASTER PLAN Content

# MASTER PLAN — naŭ Platform Evolution

> **Created:** 2026-04-10  
> **Scope:** Cross-ecosystem architectural convergence  
> **Classification:** Multi-project plan coordinating 5 services

---

## A. Constraints & Principles

1. **MVP First**: Deliver complete, usable features before moving to the next one
2. **Domain Ownership**: Each service owns its domain — no duplication
3. **Single Source of Truth**: 9naŭ = user data, nauthenticity = IG intelligence + Brand Registry, flownaŭ = content creation
4. **Monorepo for 9naŭ**: API + Web + Mobile share the Block type system via Turborepo
5. **Brand Identity is Global**: A brand exists platform-wide. nauthenticity is the canonical registry. All services reference brands by `nauBrandId`.
6. **Workspace is Platform-Wide**: The Workspace grouping unit (users + brands) is centralized in nauthenticity. Services may cache locally but always defer to the canonical record.
7. **Brand DNA Ownership**: nauthenticity owns Brand DNA (voicePrompt). Services consuming it fetch via API with graceful degradation to local cache.
8. **Soft Delete**: Brand deletion is soft by default (recoverable). Hard delete is explicit and cascading.
15. **echonau = absorbed**: Its triage engine reimplemented in 9naŭ API (Node.js/TypeScript). Repo deprecated.
16. **carousel-automation = absorbed**: Its capabilities reimplemented in flownaŭ. Repo deprecated.
17. **nau-ig = absorbed**: Becomes `9nau/apps/mobile`. Repo deprecated.
18. **komunikadoj = absorbed**: Best code merged into `9nau/apps/api`. Repo deprecated.
19. **astromatic = deprecated**: flownaŭ replaces it. Repo deprecated.
20. **Storage Strategy**: Abandoned Telegram Vault in favor of Cloudflare R2 for all platform media.

---

## B. 9naŭ Monorepo Architecture

### Repository: `9nau`

```
9nau/
├── apps/
│   ├── api/                     ← NestJS backend (absorbs komunikadoj)
│   │   ├── src/
│   │   │   ├── blocks/          ← Block CRUD, factory, remindable queries
│   │   │   ├── events/          ← Event tracking (done, reminded, snoozed)
│   │   │   ├── relations/       ← BlocksRelation management
│   │   │   ├── schedule/        ← RRULE scheduling engine
│   │   │   ├── triage/          ← Voice triage AI module (absorbs echonau)
│   │   │   ├── sync/            ← Delta Sync push/pull endpoints (from nau-ig plan)
│   │   │   ├── journal/         ← Periodic summaries engine
│   │   │   ├── search/          ← pgvector semantic search
│   │   │   ├── prisma/          ← Prisma service
│   │   │   └── common/          ← Guards, filters, pipes
│   │   ├── prisma/
│   │   │   └── schema.prisma    ← Unified schema (see Data Model below)
│   │   └── test/
│   │
│   ├── app/                     ← Next.js SaaS application (app.9nau.com, formerly 'web')
│   │   └── src/
│   │       ├── app/             ← App router
│   │       ├── components/
│   │       │   ├── dashboard/   ← Daily dashboard
│   │       │   ├── inbox/       ← GTD inbox view
│   │       │   ├── journal/     ← Journal view with period summaries
│   │       │   └── notes/       ← Note cards, grid, input
│   │       ├── hooks/           ← API hooks
│   │       └── lib/             ← State stores, API client
│   │
│   ├── accounts/                ← NEW: Next.js SSO Hub (accounts.9nau.com)
│   │
│   └── mobile/                  ← Expo/React Native (absorbs nau-ig)
│       └── src/
│           ├── components/      ← CaptureModal, FeedItem, SpecialFunctions
│           ├── screens/         ← Feed, Settings
│           ├── db/              ← SQLite (offline cache, sync metadata)
│           ├── services/        ← SyncService, ApiService
│           └── repositories/    ← PostRepository (sync-aware)
│
├── packages/
│   ├── types/                   ← Shared TypeScript interfaces (Block, Schedule, Relation, etc.)
│   ├── core/                    ← Shared business logic (recurrence, date helpers)
│   └── ui/                      ← Shared UI components (web only for now)
│
├── docker-compose.yml           ← 9nau-postgres, 9nau-redis
├── turbo.json
└── package.json
```

---

## PHASE 1: Platform Identity

 estabelecer 9naŭ como o Provedor de Identidade (Usuário/Autenticação/Espaço de trabalho) através de JWTs. Estabelecer nauthenticity como o Registro de Marca canônico. Aplicar as especificações da Convenção de Nomeação de Entidades v1.0. Redefinir todos os históricos de migração para um novo começo.

---

## PHASE 2: Intelligent Voice Note Brand Routing

Conclua o pipeline de ideias capturadas para que as notas de voz gravadas através do Zazŭ sejam selecionadas, encaminhadas por marca e cheguem na fila de ideias de conteúdo do flownaŭ para a marca correta.

---

## PHASE 3: Platform-Wide Cloudflare Storage Implementation

Refatore `9nau-api` e `9nau/mobile` para substituir o Telegram Vault pelo Cloudflare R2 usando URLs pré-assinadas.

---

## PHASE 4: Unified Platform SSO UI Pattern

Implemente um fluxo de redirecionamento SSO padrão da indústria sob um subdomínio dedicado `accounts.9nau.com`. O monorepo 9naŭ é reestruturado: o `apps/web` existente é renomeado para `apps/app` (contexto SaaS) e um novo `apps/accounts` é criado como o Identity Hub central.
