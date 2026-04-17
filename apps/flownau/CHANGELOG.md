# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.2.0](https://github.com/samuelaure/flownau/compare/v1.1.1...v1.2.0) (2026-04-17)


### Features

* **api:** expand ideation and persona endpoints for granular control ([f0a3f5e](https://github.com/samuelaure/flownau/commit/f0a3f5ee06fd8dc14475f2aa457c4cdc13a73a90))
* **ci:** implement secure sequential deployment and buildx caching ([19deb0d](https://github.com/samuelaure/flownau/commit/19deb0d11c0764f4f534cfc04086f2439683815b))
* **ideation:** enhance ideation engine with manual concepts and priority tracking ([e3e76f3](https://github.com/samuelaure/flownau/commit/e3e76f321b5ea9d0fe1b84db1d26823a529207e4))
* **ideation:** implement manual InspoBase trigger for automatic flow testing ([662072a](https://github.com/samuelaure/flownau/commit/662072a65d4c5b5c8aaca327f1db0bb68a2ba418))
* **ideation:** implement mechanical brand digest ingestion and autonomous ideation trigger ([c9661ae](https://github.com/samuelaure/flownau/commit/c9661ae8e1daf4dd34a2ba7d77d8a0c6bf92a0ee))
* **infra:** implement strict environment variable validation ([cd690d3](https://github.com/samuelaure/flownau/commit/cd690d30aa9a0ac5a9405b601fb1ebb48ba0bac9))
* **persona:** harden ideation defaults to require review ([19b1a44](https://github.com/samuelaure/flownau/commit/19b1a44575aceb7f9bbe850aad0f03e99cdf5eeb))
* **security:** implement cron secret validation for internal routes ([9da4a03](https://github.com/samuelaure/flownau/commit/9da4a039e41ab6477d67fa729038db2eff507b2d))
* **shared:** implement distributed locking and slide-window rate limiting ([b0df939](https://github.com/samuelaure/flownau/commit/b0df93912d2ae877597e81118a37cab116830386))
* **ui:** implement full idea lifecycle management with manual text editing ([addd464](https://github.com/samuelaure/flownau/commit/addd464b03ccc6ee4975fc816c32a02c26ec7586))
* **ui:** implement granular generation rituals in persona dashboard ([b56faf8](https://github.com/samuelaure/flownau/commit/b56faf832ac06fe75120c89fc54d3e872e4b3fab))
* **workspace:** implement governance UI for brand settings and user management ([f2bbec0](https://github.com/samuelaure/flownau/commit/f2bbec0591f77a91c888de68842454b7ba769f63))
* **workspaces:** implement workspace management and member settings ([764a1fd](https://github.com/samuelaure/flownau/commit/764a1fdb41d42aecc3293d95d259a824ac87dacf))


### Bug Fixes

* **core:** improve error handling, response validation, and infra reliability ([e3b1e8f](https://github.com/samuelaure/flownau/commit/e3b1e8fbff6ade01e5a2360286c864f42dce06a5))
* **infra:** add timeouts and error resilience to external AI calls ([d90b39f](https://github.com/samuelaure/flownau/commit/d90b39fe68a0b710f15f0b2424d022dc36f51a5f))

## [1.0.0] - 2026-04-13

### Added

- **Frontend Dashboard Refactoring (Phase 6)**:
  - **Compositions Workspace**: Created master list and detail views mapping to the v2 `Composition` DB models, fully replacing legacy `Render` patterns.
  - **Daily Plans Center**: New per-account daily plan UI featuring piece states, script generation outputs, date navigation, and platform alerts.
  - **Ideas Bank**: New global repository tracking localized InspoItems with inline approval/rejection and compositional bridging.
  - **Account Health Monitoring**: Extended Account detail headers with automatic `tokenExpiresAt` health pills and native `Compositions` tab.

## [0.6.2] - 2026-04-13

### Fixed

- **Deployment Config**: Injected missing `NAU_SERVICE_KEY` and `NAUTHENTICITY_URL` environment variables into `deploy.yml` to allow v1 API authentication and cross-service ideation fetching.

## [0.6.1] - 2026-04-13

### Fixed

- **Database Migration Hotfix**: Generated and committed the missing migration file for Phase 5 schema changes (`Composition.sceneTypes`, `Template` fields, `RenderJob`, `ContentPlan`) which caused a `P2022: The column (not available) does not exist` runtime error on production.

## [0.6.0] - 2026-04-13

### Added

- **Platform Integration & Daily Planning (Phase 5)**:
  - **Daily Content Plan Engine**: Implemented `generateDailyPlan` service which counts rendered vs scheduled pieces, predicts what is needed based on `PostingSchedule`, and calculates alerts (token expiry, low ideas, exhausted asset pool).
  - **Head Talk Detection**: Automated detection of face-to-camera concepts. Identifies keywords (e.g. "opinion", "hot take") and automatically extracts recording scripts.
  - **v1 Universal API**: Standardized cross-service routes protected by `NAU_SERVICE_KEY`:
    - `POST /api/v1/compose`: Exposes a reactive composition trigger for echonau/triage with an `autoApprove` flag for instant pipeline processing.
    - `POST /api/v1/ideas/ingest`: Bulk ingestion with duplicate checking (7-day window).
    - `GET /api/v1/daily-plan/:accountId`: Delivers the plan for Zazŭ (includes a `?reminder=true` compacted form).
    - `GET /api/v1/compositions`: Poll rendering statuses for orchestration.
  - **nauthenticity Connection**: Implemented the `InspoItems` source adapter fetching localized context with seamless graceful degradation.
  - **Diversity Tracking**: Added `sceneTypes` and `topicHash` metrics to schema. Ideation cron now analyzes past 14 days of content sequences to prevent creative repetition.

## [0.5.0] - 2026-04-10

### Added

- **Production Readiness & Automation (Phase 1)**:
  - **Instagram Publishing Pipeline**: Fully integrated Instagram Graph API for automated video publishing. Includes support for "SCHEDULED" posts and auto-posted "APPROVED" drafts based on account-level frequency rules.
  - **Automation Generator Cron**: New daily cron task that consumes approved ideas, orchestrates the AI creative agent, and prepares compositions for publishing.
  - **Enhanced Publishing Resilience**: Implemented a 3-attempt automated retry mechanism with error logging and status fallback (Draft -> Scheduled -> Published/Failed).
  - **Global Feature Inventory**: Integrated with the naŭ platform decentralized documentation protocol for continuous capability tracking.

### Fixed

- **Asset Caching & Performance**:
  - **Deterministic Caching**: Refactored `AIBuilderTab` to enforce library slicing prior to shuffling. This guarantees stable per-brand asset caches (max 9 videos/audios) and eliminates infinite downloading loops in the live preview.
  - **Logic Extraction**: Migrated critical media offset and asset mapping logic from components to unit-tested utilities, significantly improving architectural hygiene and stability.

### Infrastructure

- **Standardization**:
  - Hardened Docker configuration: switched to `nau-network`, enforced `REDIS_PASSWORD`, and capped resource limits (384MB/0.4 CPU) per service tier (S1-S11 compliance).
  - **CI/CD Pipeline**: Established GitHub Actions deployment workflow with automated GHCR builds, secure secret injection, and zero-downtime database migrations.
  - **Production Dockerfile**: Authored multi-stage build including all FFmpeg and Chromium headless rendering prerequisites.

All notable changes to this project will be documented in this file.

## [0.4.0] - 2026-03-12

### Added

- **Autonomous Content Engine (Phase 2)**:
  - **AI Template Builder**: Integrated a chat-first builder interface for iterative template modification via LLM.
  - **State Stack & Undo**: Implemented a robust React state stack for the builder allowing instant Undo/Redo of AI iterations.
  - **Dynamic Asset Mapping**: Engineered automatic mapping of R2-synced assets to template slots with real-time availability checks.
  - **Deficient Asset UI**: Added high-visibility warnings and deep-linking for accounts with insufficient assets for a chosen template.
  - **Ideation Compiler**: Automated generation of system prompts from final template structures to ensure deterministic AI video generation.

### Fixed

- **Rendering Hygiene**:
  - Isolated text layer compositing to eliminate color bleed and flickering in overlays.
  - Transitioned overlay compositing to RGBA color space for consistent visual depth.
- **Performance & Reliability**:
  - Implementation of a deferred player mounting strategy to prevent "missing asset" crashes during sync.
  - Optimized local asset reservoir caching to limit memory footprint while maintaining remix stability.
  - Enhanced bulk upload progress tracking and management in the Assets dashboard.

## [0.3.1] - 2026-03-03

### Fixed

- **Infrastructure Stabilization**:
  - Dismantled the "Drift Detected" crash loop in Docker development by squashing inconsistent migration history into a single clean baseline (`init_stable_v0`).
  - Fortified `db:bootstrap` script with a non-interactive fallback (db push), preventing container restart loops in non-production environments.
- **AI Agent Resilience**:
  - Implemented a **Self-Correction Loop** in the `composeVideoWithAgent` engine. The agent now automatically reflects on and fixes its own JSON validation errors during technical mapping.
  - Resolved "Hallucination" issues by enforcing stricter system prompts and providing explicit multi-step planning (Director -> Creative -> Technical).

### Added

- **Manual Redo Capability**:
  - Introduced a **"Redo Composition"** button in the Ideas Backlog, allowing users to manually trigger new AI generations if the initial result is unsatisfactory.
- **Expanded Model Library**:
  - Integrated support for DeepSeek R1, GPT-4o, O1, and Llama 3.3 across all persona settings.

## [0.3.0] - 2026-03-01

### Added

- **Autonomous Content Engine (Phase 1-6)**
  - Engineered JSON-based database layout representing the new Autonomous Content Engine Models (`VideoTemplate`, `BrandPersona`, `PostingSchedule`, `Composition`).
  - Scaffolded Next.js Segment CRUD routes targeting templates and personas decoupled from Airtable.
  - Developed the AI-assisted Builder UI modifying raw Remotion component geometries securely via `zod` and Groq.
  - Empowered `DynamicTemplateMaster` interpreting variable data arrays bounding constraints dynamically mapping text boundaries and media dimensions.
  - Scaffolded the "Brand Persona" global constraints mapping 1-click Idea Generators fetching 5 constrained concepts.
  - Refactored `agent.ts` to output deterministic structural maps targeting database-controlled `VideoTemplate` structures.
  - Implemented real-time Kanban draft approval layout feeding direct dynamic `APPROVED` compositions ready for publishing.
  - Created standard Account-scoped Posting Scheduler mappings bridging automatic IG executions rendering headless Remotion lambdas safely pushing MP4 outputs over Cloudflare R2 securely into Meta APIs.

### Changed

- **Code Health and Reliability**
  - Updated ESLint configuration logic enabling smoother integration loops gracefully passing React's strict boundary inferences against generic Remotion component types.

## [0.2.1] - 2026-02-20

### Added

- **Asset Management Enhancements**
  - Implemented multi-selection capabilities within the Assets Manager.
  - Added a floating toolbar for bulk actions including copying multiple URLs.
  - Implemented bulk deletion for efficient asset curation.
  - Integrated `fluent-ffmpeg` to automatically extract and upload video thumbnails at the 1-second mark during the upload process.
  - Updated Prisma schema to support `thumbnailUrl` for media items.

### Fixed

- **De-Sentinel Architecture**
  - Fully decoupled the project from shared infrastructure constraints.
  - Secured Redis and Postgres with proper local passwords and internal network isolation.
  - Restored local mapping for Postgres (`5434:5432`) and Redis (`6380:6379`) to circumvent conflicts with other hosted environments on the machine.
  - Safely configured Prisma to connect to the new mapped ports, enabling migrations without phantom authentication failures.
  - Dynamically resolved cross-platform FFMpeg paths between host and container boundaries.

## [0.2.0] - 2026-02-05

### Changed

- **Infrastructure Standardization (Phase 1)**
  - Enforced a **Zero-Error Policy** across the entire codebase (Linting/Types/Tests).
  - Standardized all imports to ES6 modules (purged `require()`).
  - Hardened Type System: Eliminated `any` sprawl in critical video/account modules.
  - Optimized React Stability: Resolved synchronous `setState` anti-patterns in hooks.
  - Local Cloud Mesh: Verified `docker-compose.override` alignment for shared infrastructure pivot.

### Technical Wins

- **Type Sovereignty**: Complete elimination of `any` types in core business logic.
- **Hygiene**: `npm run verify` now passes with 0 errors.

## [0.1.9] - 2026-02-05

### Added

- **Phase 8: Polish & Monitoring (Premium UX Enhancement)**
  - Advanced Loading States:
    - Implemented high-performance Skeleton UI for `AssetBrowser` using CSS transforms and shimmer animations.
    - Integrated CSS Font Loading API with explicit indicators to eliminate FOUT (Flash of Unstyled Text).
    - Specialized asset and folder card skeletons for responsive grid and list views.
  - User Onboarding System:
    - Interactive 7-step "First Visit" guide with dynamic element highlighting using a consolidated pierced backdrop strategy.
    - Modern welcome modal with priority feature highlights and persistence using Zustand + LocalStorage.
    - Spotlight effect for guided tours that respects stacking contexts (remediated with radial-gradient overlay).
  - Performance Monitoring (Dev Tools):
    - Real-time FPS counter with 60-frame rolling average and color-coded status.
    - Component-specific render time tracking using High-Resolution Time and Performance API marks/measures.
    - Expandable diagnostics panel with performance warnings for low-frame-rate scenarios.
    - Multi-subscriber support for monitoring utilities to ensure system-wide resilience.

### Fixed

- Remediated Tutorial Spotlight positioning where coordinates were static.
- Fixed `FPSMonitor` singleton vulnerability by implementing an observer pattern for multiple hooks.
- Improved z-index resilience of highlighted elements using a radial-gradient "piercing" overlay.

### Technical Wins

- **Architectural Integrity**: Decoupled performance monitoring logic from UI components using clean observable patterns.
- **Resilience**: Established bulletproof component-level highlighting that survives complex nested stacking contexts.
- **Performance**: Zero production overhead for dev-only monitoring tools; GPU-accelerated skeletal animations.

---
