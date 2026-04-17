# 🌊 Flownaŭ

> **The Unified Media Engine.** Orchestrating the future of programmatic short-form video.

Flownaŭ is a high-performance, end-to-end media factory designed to automate the entire lifecycle of video content—from raw asset ingestion and programmatic rendering to automated social publishing.

## 🚀 Vision

Built for creators and enterprises who need to scale their video presence without the manual overhead. Flownaŭ unifies the power of **Remotion**, **Cloudflare R2**, and the **Instagram Graph API** into a single, cohesive engine.

## ✨ Key Features

- **Deterministic Rendering**: Programmatic video generation using React and Remotion.
- **Intelligent Asset Pipeline**: Automated optimization and storage via R2 and custom FFmpeg routines.
- **Social Orchestration**: Direct integration with Instagram for scheduled, hands-free publishing.
- **Multi-Tenant Architecture**: Manage multiple brands and workflows within a unified dashboard.

## 🛠 Tech Stack

- **Frontend**: Next.js 15 (App Router), Tailwind CSS (User Request), Framer Motion.
- **Backend**: Node.js, Prisma ORM, PostgreSQL.
- **Media**: Remotion (v4), FFmpeg, Cloudflare R2.
- **Auth**: NextAuth.js with Instagram OAuth.
- **Infrastructure**: Dockerized deployments on Hetzner CX23.

## 📁 Repository Structure

```text
├── prisma/             # Database schema and migrations
├── public/             # Static assets
├── src/
│   ├── app/            # Next.js App Router (Pages & APIs)
│   ├── components/     # Reusable UI components
│   ├── lib/            # Core business logic (R2, Instagram, etc.)
│   └── remotion/       # Video templates and configurations
└── docker-compose.yml  # Orchestration
```

## 🛠 Getting Started

### 1. Standard Setup (Standalone)

Ideal for new developers. Everything runs in isolated containers.

1. **Clone & Install**:
   ```bash
   npm install
   ```
2. **Environment**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. **Start Infrastructure**:
   Start the specialized database and redis containers:
   ```bash
   docker compose up -d
   ```
4. **Database Migration**:
   ```bash
   npx prisma migrate dev
   ```
5. **Run App**:
   ```bash
   npm run dev
   ```

### 2. Shared Infrastructure (Advanced/Prod)

Use this if you have a `shared-mesh` network with existing Postgres/Redis services.

1. **Activate Shared Mode**:
   Copy the shared configuration to the override file. Docker automatically reads `docker-compose.override.yml`.

   ```bash
   cp docker-compose.override.yml.example docker-compose.override.yml
   ```

   _This disables the local containers and connects to the `shared-mesh` network._

   ```bash
   npm run dev
   ```

## ⚙️ Operations & Deployment

### Environment Requirements
Flownaŭ actively validates its environment dependencies at runtime (`src/modules/shared/env-validation.ts`).
- **Database:** `DATABASE_URL` (Must be a valid Postgres connection string starting with `postgres`).
- **AI Models:** Requires at least one of `OPENAI_API_KEY` or `GROQ_API_KEY`.
- **R2 Storage:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_DOMAIN` are mandatory.
- **Background Queue:** Requires at least `REDIS_URL` or `REDIS_HOST`. 
- **Formatting limits:** Optional `RENDER_CONCURRENCY` controls how many concurrent chromium workers are spawned during rendering.

### Bootstrapping Initial Environment
If launching against a completely fresh database, an Admin user and default dependencies must be bootstrapped.
```bash
# Provide initial credentials 
INITIAL_ADMIN_EMAIL=admin@flownau.com \
INITIAL_ADMIN_PASSWORD=secure_password \
npm run db:bootstrap
```

### Cron Configurations
The engine is driven by three primary serverless cron jobs (secured via standard header mappings):
- `GET /api/cron/composer` (Frequency: Hourly) - Compiles approved `ContentIdeas` into Render queued `Compositions`.
- `GET /api/cron/publisher` (Frequency: Ex: Every 15 min) - Pushes completed Renders to Instagram if within posting windows.
- `GET /api/cron/token-refresh` (Frequency: Daily) - Uses distributed lock to scan and proactively refresh expiring IG Access Tokens.

### Triage & Manual Overrides
**Token Refresh Override:**
Navigate to `Workspace Settings -> Connect Instagram` to manually trigger an Instagram OAuth link if the background cron refresh drops completely.

**Common Log Signatures:**
- `[SceneComposer] Groq returned invalid JSON`: This means the Groq AI failed to structure its response. It automatically retries once.
- `[RenderWorker] Failed to clean up temp file`: Usually implies file lock collisions under heavy Windows/Docker concurrency. Should not break the process.
- `[TokenRefresh] Skipped: another instance is already running`: Redis correctly locked concurrent cron signals. Normal behavior.

---

## ⚖️ License

**Proprietary Software**

Copyright (c) 2026 **Samuel Aure**. All rights reserved.
Unauthorized copying, modification, or distribution of this software is strictly prohibited.
