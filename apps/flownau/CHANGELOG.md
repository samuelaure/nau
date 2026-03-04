# Changelog

All notable changes to this project will be documented in this file.

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
