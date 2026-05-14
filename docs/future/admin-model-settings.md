# Admin Model Settings Panel

**Status:** Planned — not started  
**Priority:** Medium (cost optimization + operational flexibility)  
**Effort:** ~1 day  
**Prerequisite:** None — additive schema change, no breaking changes

---

## Problem

All LLM feature→model assignments in the platform are hardcoded in `packages/llm-client/src/features.ts`. Switching any model (e.g. transcription from OpenAI Whisper to Groq) requires a code change, PR, and full CI deploy cycle (~15 min) even though the change is purely operational.

---

## Goal

A single admin UI in `apps/accounts` where the platform owner can select which LLM model handles each named feature across the entire platform. Changes apply within 60 seconds to all running services — no code change, no restart, no deploy.

---

## Architecture

### Resolution order in `resolveFeatureModel()` (3 levels)

```
1. Env var    LLM_MODEL_<FEATURE>          ← emergency / dev override (unchanged)
2. DB row     PlatformModelConfig (api)    ← admin UI (new)
3. Hardcoded  DEFAULT_FEATURE_MODELS       ← safe fallback (unchanged)
```

### Data flow

```
Admin (accounts UI)
  → PUT /api/admin/models/:feature        (accounts route handler, proxies)
  → PUT /admin/platform-config/:feature   (api NestJS endpoint)
  → upsert PlatformModelConfig row in api-postgres

Services (zazu, flownau, nauthenticity)
  → getClientForFeatureAsync('transcription')
  → fetchRemoteConfig() [60s TTL in-memory cache]
  → GET /admin/platform-config             (api, service JWT auth)
  → resolved modelId → createProviderClient()
```

---

## Implementation Plan

### Phase 1 — API: Schema + Endpoints

**File:** `apps/api/prisma/schema.prisma`

Add model (additive — safe to deploy anytime):
```prisma
model PlatformModelConfig {
  id        String   @id @default(cuid())
  feature   String   @unique   // "transcription" | "ideation" | etc.
  modelId   String             // registryId e.g. "groq/whisper-large-v3-turbo"
  updatedAt DateTime @updatedAt
}
```

Run migration:
```bash
pnpm --filter api prisma migrate dev --name add_platform_model_config
```

**New module:** `apps/api/src/platform-config/`
- `platform-config.service.ts` — `getAll()`, `upsert(feature, modelId)`. Validate `modelId` exists in `MODEL_REGISTRY` (imported from `@nau/llm-client`) before persisting.
- `platform-config.controller.ts`:
  - `GET /admin/platform-config` → `{ feature, modelId }[]`
  - `PUT /admin/platform-config/:feature` → body `{ modelId: string }` → upsert
  - Auth: `req.user.email === process.env.ADMIN_EMAIL` guard
- `platform-config.module.ts` — register and add to `AppModule`

### Phase 2 — llm-client: Remote config layer

**File:** `packages/llm-client/src/features.ts`

Add below imports:
```ts
// Remote config cache (60s TTL)
let _configCache: Record<string, string> | null = null
let _cacheExpiry = 0

async function fetchRemoteConfig(): Promise<Record<string, string>> {
  if (_configCache && Date.now() < _cacheExpiry) return _configCache
  try {
    const apiUrl = process.env.NAU_API_URL
    if (!apiUrl) return {}
    const res = await fetch(`${apiUrl}/admin/platform-config`, {
      headers: { Authorization: `Bearer ${process.env.SERVICE_JWT}` },
    })
    if (!res.ok) return _configCache ?? {}
    const rows: { feature: string; modelId: string }[] = await res.json()
    _configCache = Object.fromEntries(rows.map(r => [r.feature, r.modelId]))
    _cacheExpiry = Date.now() + 60_000
    return _configCache
  } catch {
    return _configCache ?? {}
  }
}
```

Add async resolver:
```ts
export async function resolveFeatureModelAsync(feature: LLMFeature): Promise<ModelDefinition> {
  const envOverride = process.env[featureEnvKey(feature)]
  if (envOverride) return resolveModel(envOverride)
  const remote = await fetchRemoteConfig()
  const remoteOverride = remote[feature]
  if (remoteOverride) return resolveModel(remoteOverride)
  return resolveModel(DEFAULT_FEATURE_MODELS[feature])
}
```

**File:** `packages/llm-client/src/index.ts`

Add alongside `getClientForFeature`:
```ts
export async function getClientForFeatureAsync(feature: LLMFeature): Promise<FeatureClient> {
  const modelDef = await resolveFeatureModelAsync(feature)
  const client = createProviderClient(modelDef.provider)
  return { client, model: modelDef.apiModel, registryId: modelDef.id, provider: modelDef.provider }
}
```

### Phase 3 — Migrate call sites to async

Grep and update in all services:
```bash
grep -rn "getClientForFeature(" apps/zazu apps/flownau apps/nauthenticity \
  --include="*.ts" | grep -v "getClientForFeatureAsync"
```

Each call site is already inside an `async` function — just add `await` and rename.

### Phase 4 — Accounts: Admin UI

**Page:** `apps/accounts/src/app/admin/models/page.tsx`
- Server component — same auth guard pattern as `admin/zazu/page.tsx`
- Fetch current config from api + pass `MODEL_REGISTRY` (already exported from `@nau/llm-client`) as prop

**Component:** `apps/accounts/src/app/admin/models/ModelSettingsDashboard.tsx`
- Table: one row per `LLMFeature`
- Columns: Feature name · Current model · Dropdown (filtered by compatible capability) · Provider badge · Save button
- Capability filter: `transcription` feature only shows models with `capabilities.includes('transcription')`, etc.
- On save: POST to local route handler

**Route handler:** `apps/accounts/src/app/api/admin/models/[feature]/route.ts`
- Validates admin session
- Proxies to `${NAU_API_URL}/admin/platform-config/:feature` with service token

---

## Capability → Feature mapping

For the UI dropdown filtering:

| Feature | Required capability |
|---|---|
| `transcription` | `transcription` |
| `embedding` | `embedding` |
| `ideation`, `composition`, `triage`, `planning`, `template_compile`, `journal_summary`, `comment_suggestions`, `post_intelligence`, `synthesis`, `benchmark`, `default` | `chat` or `structured` |

---

## Verification Criteria

- `GET /admin/platform-config` returns current DB rows (empty array if none set — services fall through to defaults)
- Changing `transcription` in the UI → within 60s a new voicenote in Zazŭ logs `provider: groq` instead of `openai`
- If `NAU_API_URL` is unreachable, `resolveFeatureModelAsync` silently returns the hardcoded default — no service outage
- Existing `getClientForFeature()` (sync) continues to work unchanged — only new call sites use the async variant

---

## Notes

- The `MODEL_REGISTRY` is already exported from `@nau/llm-client` — the UI can use it directly to build dropdowns without duplication
- `getFeatureModelMap()` is also already exported and useful for the initial page load (shows current effective model per feature including env overrides)
- `SERVICE_JWT` auth on the api endpoint means no cross-service secret sharing — aligned with architecture rule 5
- This is the same pattern described in the existing comment in `features.ts`: _"Future: this mapping will also be readable from a DB settings table"_
