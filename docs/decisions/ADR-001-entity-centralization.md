# ADR-001 — Centralize identity entities in 9naŭ API

- **Status:** 🟢 Accepted
- **Date:** 2026-04-23
- **Supersedes:** the `[2026-04-18] nauthenticity = Brand Registry SoT` decision partially (only the structural ownership half).

## Context

The platform evolved organically. Early on, `nauthenticity` was the first service to own a concept of "Brand" (it scraped Instagram, so brand identity grew from there). flownaŭ later added its own `Workspace` and `SocialAccount` tables. As more services entered (zazu, 9naŭ mobile), each evolved its own view of "who is this user, what brand are they working on, which profile".

Result: data duplication, drift, bugs. Renaming a workspace in flownaŭ didn't propagate. Brand deletion didn't cascade. Zazu used one user ID and flownaŭ another. A user with workspace-role `member` in 9naŭ could, via a missing check, create SocialAccounts anywhere.

Logs of this history are in the old `.agent/DOCUMENTATION.md`. An earlier decision (2026-04-19) moved structural Brand ownership to 9naŭ but did not consolidate all identity entities, leaving inconsistencies.

## Decision

**All identity entities are owned exclusively by 9naŭ API.**

Specifically, 9naŭ API is the sole writer for:

- `User`
- `Session`
- `ServiceClient`
- `AuthLinkToken`
- `Workspace`
- `WorkspaceMember`
- `Brand` (including all "DNA" fields: `voicePrompt`, `commentStrategy`, `timezone`, `mainSocialProfileId`)
- `SocialProfile` (all roles: owned, monitored, benchmark, inspiration)
- `Prompt`

Other services **reference these by ID** (strings) and **store their own domain data** keyed by those IDs.

- flownaŭ stores OAuth credentials (per-profile), assets, templates, compositions — all scoped by `brandId` or `socialProfileId`.
- nauthenticity stores scraped posts, transcripts, embeddings, inspo items, syntheses — all scoped by `brandId` or keyed by `(platform, platformId)`.
- zazu stores Telegram link and conversation state only.

See [../platform/ENTITIES.md](../platform/ENTITIES.md) for field-by-field schemas.

## Alternatives considered

### A. Continue the current split (partial centralization)

Keep `BrandIntelligence` in nauthenticity with voice/strategy fields; keep structural `Brand` in 9naŭ API.

Rejected because:
- Distributed transactions on brand create/update (two services to coordinate)
- Two sources of truth for "what is this brand called, what's its voice"
- Complicates zazu (has to read from both services)

### B. Per-service IDs with lookup service

Each service has its own Brand row; a "Brand Registry" service resolves cross-references.

Rejected as essentially the same as current state with extra indirection.

### C. Monolithic database

All services share one Postgres. Eliminates the need for cross-service coordination.

Rejected because:
- Breaks service autonomy
- Single point of failure
- Eliminates the ability to scale/migrate services independently
- Industry pattern for multi-tenant SaaS strongly favors per-service DBs

## Consequences

### Positive

- **Single source of truth** for every identity entity. No drift possible.
- **Simple mental model** for developers: "who owns X?" answered by consulting one table in [ENTITIES.md](../platform/ENTITIES.md).
- **Atomic brand creation** becomes possible (one transaction in 9naŭ API); see [../future/atomic-brand-lifecycle.md](../future/atomic-brand-lifecycle.md).
- **Authorization centralization**: `assertMembership` exists in exactly one place.

### Negative

- **Every downstream service depends on 9naŭ API availability** for identity lookups. Mitigated via:
  - Caching brand DNA in consumer services with short TTL
  - Graceful degradation when 9naŭ API is slow (stale-while-revalidate)
  - 9naŭ API is lightweight and highly available (sub-100ms responses expected)
- **Migration cost**: nauthenticity and flownaŭ must drop their local Brand/Workspace tables and refactor to consume 9naŭ API. Absorbed into Phases 5–6 of the roadmap.

### Neutral

- Each downstream service still has its own DB. Cross-boundary data access happens via API calls, not SQL JOINs — which was already the pattern.

## References

- [../platform/ARCHITECTURE.md](../platform/ARCHITECTURE.md) §4 (rules of the platform)
- [../platform/ENTITIES.md](../platform/ENTITIES.md) §3 (entity ownership table)
- [ADR-002](ADR-002-prompt-unification.md) (related — prompts too are centralized)
- [ADR-003](ADR-003-socialprofile-unification.md) (related — SocialProfile is one of the centralized entities)
