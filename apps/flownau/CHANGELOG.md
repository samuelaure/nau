# Changelog

All notable changes to this project will be documented in this file.

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
