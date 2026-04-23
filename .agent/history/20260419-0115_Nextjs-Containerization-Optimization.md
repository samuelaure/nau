# naŭ Platform — 9naŭ Frontends Containerization Plan

## 1. Context & Objective
Following the platform-wide convergence on `accounts.9nau.com` as the canonical SSO hub and the renaming of `apps/web` to `apps/app`, the platform is ready to deploy these Next.js frontend applications to the Hetzner CX23 production server. Currently, `9nau/docker-compose.yml` only runs the API layer (`9nau-api`), PostgreSQL, and Redis.

**The goal** is to dockerize `apps/app` and `apps/accounts` using Next.js standalone output, configure them in `9nau/docker-compose.yml` with proper Traefik routing, and augment the `deploy.yml` GitHub Actions pipeline to automatically build, push, and deploy them.

## 2. Scope of Evolution
- **Next.js Config Optimization**: Enable `output: 'standalone'` in both applications for minimized, efficient Docker images.
- **Dockerization (apps/app)**: Create an optimized Dockerfile for `app.9nau.com`.
- **Dockerization (apps/accounts)**: Create an optimized Dockerfile for `accounts.9nau.com`.
- **Composition**: Map the containers in `9nau/docker-compose.yml` to the `nau-network` with proper Traefik host routing rules (`Host(`app.9nau.com`)` and `Host(`accounts.9nau.com`)`). Ensure minimal resource limit allocations per Hetzner CX23 constraints.
- **CI/CD Pipeline**: Update the `deploy.yml` GitHub action to build three images (`api`, `app`, `accounts`) and deploy them in one cohesive pull operation on the VPS.

## 3. Project Type & Constraints
- **Type**: A (Platform Service Frontend Extensions)
- **Environment**: Next.js 14, Node.js 20, pnpm workspaces, Debian/Alpine-based Docker images.
- **Server Resources**: Explicit limits must be set in `docker-compose.yml`. We will allocate e.g. 128MB/192MB memory and appropriate CPU limits per frontend to avoid starving the VPS.
- **Atomicity**: Changes to `.github/workflows/deploy.yml` are high-risk; they dictate production deployments.

## 4. Execution Roadmap
- **Phase 1: Containerization & Deployment Pipeline** (Active Phase)
  - Next.js config `standalone` enablement.
  - Custom Dockerfiles for frontends built with Turborepo pruning.
  - `docker-compose.yml` Traefik integration.
  - `deploy.yml` augmentation.
# PHASE 1: Frontends Containerization & Pipeline Setup

## Objectives
Containerize the `apps/app` and `apps/accounts` Next.js applications natively within the `9nau` monorepo. Augment the `9nau/docker-compose.yml` to define traefik routing for `app.9nau.com` and `accounts.9nau.com`. Finalize the process by hooking the build and rollout logic into the existing `.github/workflows/deploy.yml` pipeline.

## Tasks

- [ ] **Next.js Config Optimization**
  - Update `9nau/apps/app/next.config.mjs` to include `output: 'standalone'`.
  - Update `9nau/apps/accounts/next.config.mjs` to include `output: 'standalone'`.

- [ ] **Dockerfiles Creation**
  - Create `9nau/apps/app/Dockerfile` implementing a multi-stage standalone build (builder, installer, runner).
  - Create `9nau/apps/accounts/Dockerfile` implementing a multi-stage standalone build.
  - Implement `.dockerignore` improvements if necessary to prevent bloated context uploads.

- [ ] **Docker Compose Integration**
  - Add `9nau_app` service to `9nau/docker-compose.yml` mapped to the `ghcr.io/samuelaure/9nau/app` image.
  - Add `9nau_accounts` service to `9nau/docker-compose.yml` mapped to the `ghcr.io/samuelaure/9nau/accounts` image.
  - Bind both services to the `nau-network` externally.
  - Configure Traefik routing rules (`traefik.http.routers.9nau-app.rule=Host(\`app.9nau.com\`)` and `traefik.http.routers.9nau-accounts.rule=Host(\`accounts.9nau.com\`)`).
  - Attach standard logging and resource limit limits (192M memory max per frontend).
  - Ensure correct Next.js port binding mappings (typically port 3000 exposed to Traefik).

- [ ] **GitHub Actions Deployment Augmentation**
  - Update the `build` steps in `.github/workflows/deploy.yml` to also build and push the `app` and `accounts` containers using their respective Dockerfiles.
  - Add required frontend environment variables injection (like `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ACCOUNTS_URL`, `NEXT_PUBLIC_APP_URL`) inside the deployment server stub in the SSH script.
  - Ensure `docker compose pull` appropriately pulls all updated tags before `docker compose up -d`.

## Verification Criteria
- [ ] Both `app` and `accounts` packages can successfully compile to `.next/standalone`.
- [ ] GHA deployment workflow YAML has no syntax errors and clearly defines the newly added contexts.
- [ ] Output configuration is structurally prepared without risking regressions on the API service deployment logic.
