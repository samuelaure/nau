# naŭ Platform — Entity Specification

> Every entity in the platform, field by field, with ownership and references.
> This is the data model canon. If you're modeling something that touches `Workspace`, `Brand`, `SocialProfile`, or `Prompt` — start here.

---

## 1. Identity entities (owned by 9naŭ API)

### `User`

```prisma
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  name         String?
  telegramId   String?   @unique
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  sessions          Session[]
  workspaceMembers  WorkspaceMember[]
  authLinkTokens    AuthLinkToken[]

  @@index([email])
}
```

- **Owned by:** 9naŭ API
- **Referenced by:** every service (via `sub` claim in JWT)
- **Notes:** `telegramId` is set when a user links via zazu. Unique constraint prevents double-linking.

---

### `Session`

```prisma
model Session {
  id                String    @id @default(cuid())
  userId            String
  refreshTokenHash  String    @unique   // bcrypt(refreshToken)
  userAgent         String?
  ipAddress         String?
  expiresAt         DateTime
  revokedAt         DateTime?
  replacedBySessionId String?          // on refresh rotation
  createdAt         DateTime  @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

- **Owned by:** 9naŭ API
- **Purpose:** track refresh tokens for rotation + revocation. See [AUTH.md](AUTH.md).
- **Notes:** raw refresh token is never stored — only bcrypt hash. On rotation, old session is marked `revokedAt` and linked via `replacedBySessionId`.

---

### `ServiceClient`

```prisma
model ServiceClient {
  id          String   @id                    // e.g. "flownau", "nauthenticity", "zazu"
  name        String                          // display name
  secretHash  String                          // bcrypt(clientSecret)
  scopes      String[]                        // allowed scopes
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  rotatedAt   DateTime?
}
```

- **Owned by:** 9naŭ API
- **Purpose:** replaces single shared `NAU_SERVICE_KEY`. Each caller service has its own credentials.
- **Secret generation:** 32-byte random. Stored as bcrypt hash. Plaintext shown to operator once at creation.
- **Usage:** caller signs a JWT with its secret, puts in `Authorization: Bearer <jwt>`, 9naŭ API looks up by `iss` claim and verifies. See [AUTH.md](AUTH.md#service-to-service-auth).

---

### `AuthLinkToken`

```prisma
model AuthLinkToken {
  id         String    @id @default(cuid())
  userId     String
  token      String    @unique
  purpose    AuthLinkPurpose                 // TELEGRAM_LINK | PASSWORD_RESET | EMAIL_VERIFY
  expiresAt  DateTime
  consumedAt DateTime?
  createdAt  DateTime  @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum AuthLinkPurpose {
  TELEGRAM_LINK
  PASSWORD_RESET
  EMAIL_VERIFY
}
```

- **Owned by:** 9naŭ API
- **Purpose:** one-time tokens for out-of-band flows. TTL typically 5–15 minutes depending on purpose.

---

## 2. Tenancy entities (owned by 9naŭ API)

### `Workspace`

```prisma
model Workspace {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members  WorkspaceMember[]
  brands   Brand[]
}
```

- **Owned by:** 9naŭ API
- **Meaning:** a collaboration group of users who together manage a fleet of brands.
- **Use case:** Andi manages "Andi Universo" with a co-manager. Both are `WorkspaceMember`s of the same Workspace; the Workspace has one or more `Brand`s.

---

### `WorkspaceMember`

```prisma
model WorkspaceMember {
  id          String        @id @default(cuid())
  userId      String
  workspaceId String
  role        WorkspaceRole @default(MEMBER)
  createdAt   DateTime      @default(now())

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace  Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([userId, workspaceId])
}

enum WorkspaceRole {
  OWNER
  ADMIN
  MEMBER
}
```

- **Permissions:**
  - `OWNER` — full control; can delete workspace, transfer ownership, manage members, manage brands.
  - `ADMIN` — can manage brands, members (except ownership changes), prompts.
  - `MEMBER` — can use the platform within the workspace (create content, suggestions); cannot change structural settings.
- **Invariant:** a workspace must have at least one `OWNER` at all times.

---

### `Brand`

All brand-level fields live here. No `BrandIntelligence` duplication in nauthenticity.

```prisma
model Brand {
  id                   String   @id @default(cuid())
  workspaceId          String
  name                 String
  timezone             String   @default("UTC")
  isActive             Boolean  @default(true)
  isDefault            Boolean  @default(false)     // pinned/main within workspace
  mainSocialProfileId  String?                      // brand's primary publishing profile

  // Brand DNA — consumed by flownaŭ (content gen) + nauthenticity (comments)
  voicePrompt          String?  @db.Text            // the canonical brand voice
  commentStrategy      String?  @db.Text            // strategy for reactive comments
  suggestionsCount     Int      @default(3)         // comments generated per request
  windowStart          String?                      // HH:mm delivery window for comment suggestions
  windowEnd            String?

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  workspace        Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  socialProfiles   SocialProfile[]
  prompts          Prompt[]                           // see Prompt ownership below

  @@unique([workspaceId, isDefault], map: "one_default_per_workspace_when_true")
  @@index([workspaceId])
}
```

- **Owned by:** 9naŭ API
- **Scope:** a brand is scoped to a workspace. All workspace members can work with all brands in it.
- **Fleet model:** all brands in a workspace are **peers**. There is no parent/satellite hierarchy (confirmed 2026-04-23). A "main" brand is indicated by `isDefault: true` (at most one per workspace; enforced by partial unique index).
- **DNA fields:** `voicePrompt` and `commentStrategy` are convenience columns for the brand's primary prompts. For variants (multiple personas, multiple frameworks), use the `Prompt` table.
- **References:**
  - flownaŭ: `SocialProfileCredentials.socialProfileId → brand via sp.brandId`, `Asset.brandId`, `Composition.brandId`, `ContentIdea.brandId`
  - nauthenticity: `InspoItem.brandId`, `BrandSynthesis.brandId`, `CommentFeedback.brandId`

---

### `SocialProfile`

**ONE entity for any social profile, any role.** A profile owned for publishing and a profile monitored for benchmark are both `SocialProfile` rows — distinguished by the `role` column.

```prisma
model SocialProfile {
  id            String               @id @default(cuid())
  brandId       String
  platform      SocialPlatform                        // INSTAGRAM | TIKTOK | YOUTUBE | ...
  platformId    String?                               // platform-native stable ID (optional)
  username      String                                // handle (may change over time)
  profileImage  String?
  role          SocialProfileRole                     // OWNED | COMMENT_TARGET | BENCHMARK_TARGET | INSPIRATION
  isActive      Boolean              @default(true)
  isDefault     Boolean              @default(false)  // e.g. the default OWNED profile to post to
  config        Json                 @default("{}")   // role-specific settings

  createdAt     DateTime             @default(now())
  updatedAt     DateTime             @updatedAt

  brand  Brand  @relation(fields: [brandId], references: [id], onDelete: Cascade)

  @@unique([platform, platformId])                    // null platformIds allowed to coexist
  @@index([brandId, role])
  @@index([platform, username])
}

enum SocialPlatform {
  INSTAGRAM
  TIKTOK
  YOUTUBE
  TWITTER
  LINKEDIN
}

enum SocialProfileRole {
  OWNED              // brand publishes from this profile (flownaŭ stores credentials)
  COMMENT_TARGET     // nauthenticity monitors for reactive comment suggestions
  BENCHMARK_TARGET   // nauthenticity downloads in bulk for benchmark chat / analysis
  INSPIRATION        // captured ad-hoc via mobile; feeds InspoBase
}
```

- **Owned by:** 9naŭ API
- **Role-specific config** lives in the `config` JSON column — validated by a zod schema per role (see `packages/types`).

    | Role | Example `config` fields |
    |---|---|
    | `OWNED` | `{ directorPromptId?, creationPromptId?, shortCode? }` |
    | `COMMENT_TARGET` | `{ profileStrategy?, isActive }` |
    | `BENCHMARK_TARGET` | `{ initialDownloadCount: 20, autoUpdate: false }` |
    | `INSPIRATION` | `{ autoProcess: true }` |

- **Uniqueness:** a single profile (platform + platformId) can appear multiple times across brands/roles. That's intentional — brand A can benchmark `@nike` while brand B monitors `@nike` for comments. The `@@unique([platform, platformId])` constraint is scoped so nullable platformIds coexist (multiple unidentified handles allowed).
- **Scraped data deduplication:** nauthenticity stores `Post`, `Media`, etc. keyed by `(platform, platformId)`, so the underlying content is scraped once and shared across brands monitoring the same profile. See [nauthenticity.md](../services/nauthenticity.md).

---

### `Prompt`

**One table for every prompt in the platform.** Replaces the previous per-feature tables (`BrandPersona`, `IdeasFramework`, `ContentCreationPrinciples`, strategist/director/caption prompts on templates).

```prisma
model Prompt {
  id              String         @id @default(cuid())
  ownerType       PromptOwnerType
  ownerId         String                                 // polymorphic: brandId | workspaceId | socialProfileId | templateId | "platform"
  type            PromptType
  name            String
  content         String         @db.Text
  modelSelection  AIModel?                               // optional override
  isDefault       Boolean        @default(false)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([ownerType, ownerId, type])
  @@index([type])
}

enum PromptOwnerType {
  PLATFORM        // global defaults (Graceful Defaulting)
  WORKSPACE
  BRAND
  SOCIAL_PROFILE
  TEMPLATE
}

enum PromptType {
  VOICE                 // brand tone + personality
  COMMENT_STRATEGY      // how comments should be crafted
  CONTENT_PERSONA       // content-gen persona (flownaŭ)
  IDEAS_FRAMEWORK       // content idea generation framework (flownaŭ)
  CONTENT_PRINCIPLES    // content creation principles (flownaŭ)
  STRATEGIST            // content planning strategist (flownaŭ)
  DIRECTOR              // per-profile creative director (flownaŭ)
  CREATION              // template creation prompt (flownaŭ)
  CAPTION               // template caption prompt (flownaŭ)
  SYSTEM                // generic system prompt
}

enum AIModel {
  OPENAI_GPT_4O
  OPENAI_GPT_4O_MINI
  OPENAI_GPT_4_1
  OPENAI_O1
  GROQ_LLAMA_3_3
  GROQ_LLAMA_3_1_70B
  // ... extensible
}
```

- **Owned by:** 9naŭ API
- **Graceful defaulting:** when a service needs `(BRAND, brandId, VOICE)` and none exists, it falls back to `(PLATFORM, "platform", VOICE)` — the platform default prompt. This preserves the low-friction onboarding pattern.
- **Resolution pattern:** service calls `GET /brands/:id/prompts?type=VOICE` → 9naŭ API returns the most specific matching Prompt, walking up `BRAND → WORKSPACE → PLATFORM` until it finds one.
- **Ownership mapping from old schemas:**

    | Old schema | New representation |
    |---|---|
    | `BrandPersona` | `Prompt { ownerType: BRAND, type: CONTENT_PERSONA }` |
    | `IdeasFramework` | `Prompt { ownerType: BRAND, type: IDEAS_FRAMEWORK }` |
    | `ContentCreationPrinciples` | `Prompt { ownerType: BRAND, type: CONTENT_PRINCIPLES }` |
    | `ContentPlanner.strategistPrompt` | `Prompt { ownerType: BRAND, type: STRATEGIST }` |
    | `SocialAccount.directorPrompt` | `Prompt { ownerType: SOCIAL_PROFILE, type: DIRECTOR }` |
    | `SocialAccount.creationPrompt` | `Prompt { ownerType: SOCIAL_PROFILE, type: CREATION }` |
    | `Template.systemPrompt` | `Prompt { ownerType: TEMPLATE, type: SYSTEM }` |
    | `Template.creationPrompt` | `Prompt { ownerType: TEMPLATE, type: CREATION }` |
    | `Template.captionPrompt` | `Prompt { ownerType: TEMPLATE, type: CAPTION }` |
    | `BrandIntelligence.voicePrompt` | `Brand.voicePrompt` (or `Prompt { ownerType: BRAND, type: VOICE }` for variants) |
    | `BrandIntelligence.commentStrategy` | `Brand.commentStrategy` (same pattern) |

---

## 3. flownaŭ domain entities (owned by flownaŭ)

All scoped to `brandId` or `socialProfileId` strings referencing 9naŭ API entities.

### `SocialProfileCredentials`

OAuth tokens for `OWNED` profiles. Isolated from 9naŭ for security (credentials live only where they're used).

```prisma
model SocialProfileCredentials {
  socialProfileId   String    @id                     // = 9naŭ SocialProfile.id
  accessToken       String    @db.Text
  refreshToken      String?   @db.Text
  tokenExpiresAt    DateTime?
  tokenRefreshedAt  DateTime?
  shortCode         String?
  assetsRoot        String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

### Domain models (summary — full spec in [services/flownau.md](../services/flownau.md))

- `Asset` — uploaded media (images, videos, audio), keyed by `socialProfileId`
- `Template` — Remotion templates, per `socialProfileId`, with `schemaJson` + `slotSchema`
- `AccountTemplateConfig` — enabled templates + auto-approve settings per profile
- `Composition` — a planned post (idea + template + slots + payload)
- `RenderJob` — composition rendering state
- `ContentIdea` — raw ideas before composition
- `ContentPlan` — daily plan of pieces + scripts
- `ContentPlanner` — per-brand planning config

See [services/flownau.md](../services/flownau.md) for complete schemas.

---

## 4. nauthenticity domain entities (owned by nauthenticity)

All scoped to `brandId` or keyed by `(platform, platformId)` for scraped content.

### Scraped content (shared across brands)

- `Post { platform, platformId, username, caption, postedAt, engagement, ... }` — unique by `(platform, platformId)`
- `Media` — images/videos attached to Posts, stored in R2
- `Transcript` — audio→text extracted from media
- `Embedding { transcriptId, vector(1536), model }` — pgvector
- `ScrapingRun` — Apify job tracking

### Per-brand operational

- `InspoItem { brandId, socialProfileId?, postId?, status, extractedHook, extractedTheme, ... }` — the user-captured inspiration items
- `BrandSynthesis { brandId, type, content, attachedUrls }` — AI-generated syntheses (patterns, themes)
- `CommentFeedback { brandId, postId, commentText, isSelected, sentAt }` — tracking which suggestions the user used

See [services/nauthenticity.md](../services/nauthenticity.md) for complete schemas.

---

## 5. zazu domain entities (owned by zazu-bot)

Minimal local state. User identity delegated to 9naŭ API via SSO.

```prisma
model TelegramUser {
  nauUserId    String  @id                  // = 9naŭ User.id
  telegramId   BigInt  @unique
  linkedAt     DateTime @default(now())
}

model ConversationState {
  userId       String   @id                  // = 9naŭ User.id
  context      Json
  updatedAt    DateTime @updatedAt
}
```

---

## 6. 9naŭ Second Brain entities (owned by 9naŭ API)

Block-based architecture. Separate subsystem inside 9naŭ API, not shared across platform services.

- `Block` — polymorphic typed block (note, task, event, voice_capture, journal_summary, …)
- `Relation` — graph edges between blocks
- `Schedule` — scheduled reminders
- `JournalEntry` — per-period synthesis

See [services/9nau-api.md](../services/9nau-api.md) for complete Second Brain spec.

---

## 7. Cascade rules

Enforced at the Prisma level via `onDelete`.

- **Delete User** → cascades to `Session`, `WorkspaceMember` (user leaves all workspaces), `AuthLinkToken`, `TelegramUser` (zazu).
- **Delete Workspace** (owner action) → cascades to `WorkspaceMember`, `Brand`. Downstream: flownaŭ and nauthenticity subscribe to `workspace.deleted` events (future: outbox) and purge their `workspaceId`-scoped data.
- **Delete Brand** → cascades to `SocialProfile`, brand-scoped `Prompt`. Downstream: flownaŭ purges `SocialProfileCredentials`, `Asset`, `Composition`, etc. via event subscription.
- **Delete SocialProfile** → cascades to flownaŭ `SocialProfileCredentials` and downstream domain data.
- **Scraped content** (`Post`, `Media`, `Embedding`) in nauthenticity is NOT cascaded from Brand deletion — it may be referenced by other brands. Orphan cleanup is a separate periodic job.

---

## 8. Related docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — platform overview
- [AUTH.md](AUTH.md) — auth entities + token lifecycle
- [NAMING.md](NAMING.md) — naming rules
- [../decisions/ADR-001-entity-centralization.md](../decisions/ADR-001-entity-centralization.md)
- [../decisions/ADR-002-prompt-unification.md](../decisions/ADR-002-prompt-unification.md)
- [../decisions/ADR-003-socialprofile-unification.md](../decisions/ADR-003-socialprofile-unification.md)
