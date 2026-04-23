# Architecture Decision Records (ADRs)

> Each ADR captures one significant decision, its context, the alternatives, and the consequences. We follow the [Michael Nygard ADR template](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/locales/en/templates/decision-record-template-by-michael-nygard/index.md).

## Status legend

- 🟢 **Accepted** — in force
- 🟡 **Proposed** — pending decision
- 🔵 **Superseded** — replaced by a newer ADR
- 🔴 **Rejected** — considered and declined

## Index

| # | Status | Title | Decided |
|---|---|---|---|
| [001](ADR-001-entity-centralization.md) | 🟢 | Centralize identity entities in 9naŭ API | 2026-04-23 |
| [002](ADR-002-prompt-unification.md) | 🟢 | Unify all prompts in a single `Prompt` table | 2026-04-23 |
| [003](ADR-003-socialprofile-unification.md) | 🟢 | Unify `SocialAccount` + `IgProfile` + `BrandTarget` into one `SocialProfile` entity | 2026-04-23 |
| [004](ADR-004-auth-model.md) | 🟢 | Access + refresh token model with per-service client JWTs | 2026-04-23 |
| [005](ADR-005-monorepo-consolidation.md) | 🟢 | Consolidate into a single pnpm + turbo monorepo | 2026-04-23 |
| [006](ADR-006-nestjs-on-nauthenticity.md) | 🟢 | Migrate nauthenticity from Fastify to NestJS | 2026-04-23 |
| [007](ADR-007-naming-canon.md) | 🟢 | Enforce a single naming canon across the platform | 2026-04-23 |

## Writing a new ADR

- Number it next in sequence.
- Filename: `ADR-NNN-kebab-case-slug.md`.
- Status starts `🟡 Proposed`; moves to 🟢 Accepted once merged.
- Link from this index.
