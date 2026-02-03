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

2. **Run App**:
   ```bash
   npm run dev
   ```

---

## ⚖️ License

**Proprietary Software**

Copyright (c) 2026 **Samuel Aure**. All rights reserved.
Unauthorized copying, modification, or distribution of this software is strictly prohibited.
