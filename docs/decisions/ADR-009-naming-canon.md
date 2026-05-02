# ADR-007 — Enforce a single naming canon across the platform

- **Status:** 🟢 Accepted
- **Date:** 2026-04-23

## Context

The platform accumulated naming inconsistencies as services grew independently:

| Concept | Variants used |
|---|---|
| Brand's own publishing Instagram account | `SocialAccount` (flownaŭ), `Account` (mobile UI), `IgAccount` (internal) |
| Monitored competitor profile | `IgProfile` (nauthenticity), `BrandTarget` (join), `Target` (UI) |
| Brand's AI identity fields | `BrandIntelligence` (nauthenticity), `Brand` (9naŭ) |
| Workspace ID foreign key | `workspaceId` (9naŭ), `platformWorkspaceId` (flownaŭ legacy), `nauWorkspaceId` (zazu legacy) |
| Service-auth header | `x-nau-service-key` (canonical), `x-service-key` (bug), `Authorization: Bearer <serviceKey>` (wrong) |
| Access token cookie | `nau_token` (pre-refactor) vs new `nau_at` |

Every inconsistency is a small ongoing tax: code review mistakes, search misses, onboarding confusion, subtle bugs when two concepts silently drift.

## Decision

**Adopt a single naming canon as platform law.** Documented in [../platform/NAMING.md](../platform/NAMING.md).

The canon covers:

1. Entity names (including a **forbidden names** list — the deprecated aliases to be eliminated).
2. Field names (foreign keys, timestamps, booleans, enums).
3. URL paths (kebab-case resources, canonical REST verbs, prefix rules per subdomain type).
4. HTTP headers (`Authorization`, `x-nau-csrf`, cookie names).
5. Environment variables (`NAU_` prefix rules, service-specific prefixes, third-party prefixes).
6. File and folder naming (kebab-case for packages, PascalCase for React components, etc.).

The canon is enforced by:

- **Code reviewers** using the doc as reference.
- **Lint rules** (future) — custom ESLint rules flag usage of forbidden names.
- **`@nau/sdk`** — exports typed interfaces using canonical names, making it impossible to reference entities by old names from client code.

## Alternatives considered

### A. Document conventions informally

Write a style guide in the team wiki. Rely on reviewer vigilance.

Rejected because:
- Conventions not backed by a single authoritative doc drift and fragment over time.
- New developers have no single reference.
- Disputes over naming recur indefinitely.

### B. Allow multiple names per concept with aliasing

Accept that legacy code uses old names; new code uses new names.

Rejected because:
- Platform is pre-launch — no legacy to protect.
- Allowing divergence now guarantees it compounds.
- This is the moment to set the canon once, forever.

## Consequences

### Positive

- **Searchability**: `grep -r 'SocialProfile'` returns every reference to the concept, in every language, every file.
- **Unambiguous communication**: "social profile" means one thing.
- **Predictable URLs**: given a concept name, a developer can infer the URL without reading docs.
- **SDK discoverability**: `sdk.socialProfiles.list({ brandId })` is the first guess that works.

### Negative

- **Refactor cost** during Phases 2–6 to align all existing code with the canon. Absorbed into the refactor roadmap; pre-launch state makes it cheap.
- **Canon maintenance**: [NAMING.md](../platform/NAMING.md) must be kept current. Ownership: whoever adds a new canonical name updates the doc in the same PR.

### Enforcement mechanics (post-refactor)

Lint rules (future, low priority):

```js
// .eslintrc.js
rules: {
  'nau/no-forbidden-names': ['error', {
    forbidden: {
      'SocialAccount': 'Use SocialProfile (ADR-003)',
      'IgProfile': 'Use SocialProfile with role=BENCHMARK_TARGET or COMMENT_TARGET (ADR-003)',
      'BrandIntelligence': 'Use Brand (ADR-001)',
      'BrandPersona': 'Use Prompt with type=CONTENT_PERSONA (ADR-002)',
      // ...
    }
  }]
}
```

For now, reviewer discipline + the doc is sufficient.

## References

- [../platform/NAMING.md](../platform/NAMING.md) — the canon itself
- [ADR-001](ADR-001-entity-centralization.md), [ADR-002](ADR-002-prompt-unification.md), [ADR-003](ADR-003-socialprofile-unification.md) — the rename sources
