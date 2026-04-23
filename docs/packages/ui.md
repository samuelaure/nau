# Package — @nau/ui

- **Location:** `packages/ui`
- **Consumers:** flownaŭ, nauthenticity, accounts, zazu-dashboard, 9naŭ app

---

## Purpose

Shared React component library. Avoids duplicating basic UI across Next.js apps.

---

## Scope

Only platform-agnostic, stateless presentational components belong here. Components that depend on `@nau/sdk`, session state, or Next.js router do NOT belong here.

Examples of what belongs:
- Design system primitives: `Button`, `Input`, `Select`, `Modal`, `Toast`, `Spinner`
- Layout shells: `PageContainer`, `Sidebar`, `TopNav`
- Brand/workspace display components: `BrandAvatar`, `WorkspaceSwitcher` (display-only)

---

## Stack

- React 18 + TypeScript
- Tailwind CSS (shared config from `packages/config/tailwind.config.ts`)
- Radix UI primitives for accessible headless components

---

## Usage

```tsx
import { Button, Input } from '@nau/ui';
```

---

## Status

🔴 Not yet created. Placeholder for Phase 8 (monorepo consolidation).

---

## Related

- [../decisions/ADR-005-monorepo-consolidation.md](../decisions/ADR-005-monorepo-consolidation.md)
