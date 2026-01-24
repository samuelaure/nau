# Flownaŭ

**An end-to-end automated video publishing platform.**

Flownaŭ is a unified media factory that orchestrates the entire lifecycle of short-form video content. It combines template-based programmatic rendering (Remotion) with a robust asset management pipeline (R2/FFmpeg) and automated social publishing (Instagram Graph API).

## Core Capabilities
*   **Media Factory**: Upload raw assets, auto-optimize/transcode, and securely store them in Cloudflare R2.
*   **Programmatic Video**: Render dynamic videos based on flexible templates using Remotion.
*   **Automated Publishing**: Schedule and auto-publish content to multiple Instagram accounts.
*   **Multi-Tenancy**: Manage multiple workspaces, projects, and social profiles in a single dashboard.

## Tech Stack
*   **Framework**: Next.js 14 (App Router)
*   **Language**: TypeScript
*   **Database**: PostgreSQL + Prisma
*   **Queue System**: Redis + BullMQ
*   **Rendering**: Remotion + FFmpeg (Headless Chrome)
*   **Storage**: Cloudflare R2
*   **Infrastructure**: Docker (Hetzner Cloud)

## Origins
Flownaŭ is the evolution and unification of two previous projects:
*   [Astromatic](https://github.com/samuelaure/astromatic): The original Remotion-based rendering engine.
*   [R2 Asset Manager](https://github.com/samuelaure/r2-asset-manager): The CLI tool for optimizing and syncing media assets to R2.

---

## License
**Proprietary Software**

Copyright (c) 2026 Samuel Aure. All Rights Reserved.
Unauthorized copying of this file, via any medium, is strictly prohibited.
