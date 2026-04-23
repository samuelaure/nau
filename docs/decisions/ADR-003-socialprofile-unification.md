# ADR-003 — Unify `SocialAccount`, `IgProfile`, and `BrandTarget` into one `SocialProfile` entity

- **Status:** 🟢 Accepted
- **Date:** 2026-04-23

## Context

The pre-refactor codebase had three concepts representing "a social media profile":

- **`SocialAccount`** in flownaŭ — a brand's own Instagram/TikTok account, with OAuth tokens for publishing.
- **`IgProfile`** in nauthenticity — a competitor/benchmark Instagram profile being scraped.
- **`BrandTarget`** in nauthenticity — a join row connecting a brand to an `IgProfile` with a `targetType` (`monitored`, `benchmark`, `single_post`).

The names alone generated confusion: `nauthenticity.dashboard/accounts` showed `IgProfile`s (scraped competitors), while flownaŭ's UI showed `SocialAccount`s (the brand's own posting profiles). Same label, completely different things. Users and developers had no way to tell from a URL or variable name which one was meant.

Underlying truth: **all three are the same kind of entity** — a social-platform presence (Instagram handle, TikTok handle, …). What differs is the **role that presence plays relative to a brand**.

From the platform owner:

> "A social profile is always that, no matter the use/position it has in the app. So, instead of creating different entities of the same thing based on its use, we should extend the same entity using interfaces."

## Decision

**One entity: `SocialProfile`.** The role is a column (`role` enum), not a separate table.

```prisma
model SocialProfile {
  id            String               @id @default(cuid())
  brandId       String
  platform      SocialPlatform                        // INSTAGRAM | TIKTOK | ...
  platformId    String?                               // platform-native stable ID (optional)
  username      String
  profileImage  String?
  role          SocialProfileRole                     // OWNED | COMMENT_TARGET | BENCHMARK_TARGET | INSPIRATION
  isActive      Boolean              @default(true)
  isDefault     Boolean              @default(false)
  config        Json                 @default("{}")   // role-specific settings
  createdAt     DateTime             @default(now())
  updatedAt     DateTime             @updatedAt

  @@unique([platform, platformId])
  @@index([brandId, role])
}

enum SocialProfileRole {
  OWNED
  COMMENT_TARGET
  BENCHMARK_TARGET
  INSPIRATION
}
```

- Role-specific settings live in `config` JSON (validated by zod per role — `@nau/types`).
- OAuth credentials for `OWNED` role live in flownaŭ's `SocialProfileCredentials` table (keyed by `socialProfileId`). Separating credentials isolates sensitive data from the identity entity.
- Scraped content (Posts, Media, Transcripts) in nauthenticity is keyed by `(platform, platformId)` — so two brands benchmarking the same competitor share the scraped data.

## Alternatives considered

### A. Original proposal — two tables: `SocialProfile` + `BrandSocialProfile`

An identity table (`SocialProfile`) and a link table (`BrandSocialProfile { brandId, socialProfileId, role }`).

Rejected per user's simplicity principle:
- Forces a JOIN on every query
- Adds a concept developers have to internalize without meaningful gain for the platform's use case
- The cardinality "one profile, many brands monitoring it for different reasons" is rare in practice; the straightforward workaround is duplicate rows (one per brand × role), which is acceptable at the scale where this matters.

### B. Separate tables per role

Back to the status quo. Rejected.

### C. Inheritance via Prisma (not supported) or discriminator columns

Prisma doesn't support true polymorphic inheritance. Using a discriminator is exactly what the `role` column does — this is a naming choice more than a structural one.

## Consequences

### Positive

- **One entity, one name, one UI component.** "Social profile" means the same thing everywhere.
- **Extensible roles**: adding `ADVERTISING_TARGET` or any future role is one enum value, no new table.
- **Role-based queries are fast**: `@@index([brandId, role])` serves the common query.
- **Config JSON flexibility** accommodates role-specific settings without schema churn. Validated via zod in `@nau/types` so JSON blob isn't a free-for-all.

### Negative

- **Duplicate rows** when the same `@nike` is monitored by multiple brands for different reasons. Acceptable — that's a handful of rows, not millions. At SaaS scale with 10K tenants, maybe 50K–100K total `SocialProfile` rows. Trivial for Postgres.
- **Scraped-content deduplication not automatic**: nauthenticity must key its scraped data by `(platform, platformId)`, not by `socialProfileId`, so it's shared across rows. Documented explicitly in [../services/nauthenticity.md](../services/nauthenticity.md).

### Naming consequences

See [../platform/NAMING.md](../platform/NAMING.md) for the forbidden-name list derived from this decision. In short:

- `SocialAccount` → forbidden; use `SocialProfile`.
- `IgProfile` → forbidden; use `SocialProfile`.
- `BrandTarget` → forbidden; use `SocialProfile` with `role=COMMENT_TARGET` or `BENCHMARK_TARGET`.

## References

- [../platform/ENTITIES.md §2.5 SocialProfile](../platform/ENTITIES.md#socialprofile)
- [../platform/NAMING.md](../platform/NAMING.md)
- [ADR-001](ADR-001-entity-centralization.md) (`SocialProfile` lives in 9naŭ API per centralization)
