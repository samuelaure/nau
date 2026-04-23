# Package — @nau/sdk

- **Location:** `packages/sdk`
- **Consumers:** flownaŭ, nauthenticity, zazu-bot, zazu-dashboard, accounts, 9naŭ app, mobile

---

## Purpose

Typed HTTP client for 9naŭ API. No service may call `api.9nau.com` via raw `fetch`. All calls go through `@nau/sdk`.

---

## Instantiation

```ts
// User-context client (Next.js server action / API route)
const sdk = createNauClient({ baseUrl: process.env.NAU_API_URL, token: accessToken });

// Service-context client (service-to-service)
const sdk = createNauServiceClient({
  baseUrl: process.env.NAU_API_URL,
  serviceSecret: process.env.MY_SERVICE_SECRET,
  serviceSlug: 'flownau',
  targetSlug: '9nau-api',
});
```

---

## API surface

```ts
sdk.workspaces.list(): Promise<Workspace[]>
sdk.workspaces.get(id: string): Promise<Workspace>
sdk.workspaces.create(dto): Promise<Workspace>
sdk.workspaces.update(id, dto): Promise<Workspace>
sdk.workspaces.delete(id): Promise<void>

sdk.brands.list(workspaceId: string): Promise<Brand[]>
sdk.brands.get(id: string): Promise<Brand>
sdk.brands.create(workspaceId, dto): Promise<Brand>
sdk.brands.update(id, dto): Promise<Brand>
sdk.brands.delete(id): Promise<void>

sdk.socialProfiles.list(brandId: string): Promise<SocialProfile[]>
sdk.socialProfiles.get(id: string): Promise<SocialProfile>
sdk.socialProfiles.create(brandId, dto): Promise<SocialProfile>
sdk.socialProfiles.update(id, dto): Promise<SocialProfile>
sdk.socialProfiles.delete(id): Promise<void>

sdk.prompts.list(filter: PromptFilter): Promise<Prompt[]>
sdk.prompts.get(id: string): Promise<Prompt>
sdk.prompts.upsert(dto): Promise<Prompt>

sdk.users.me(): Promise<User>
sdk.users.update(dto): Promise<User>

sdk.triage.submit(dto): Promise<TriageResult>
```

---

## Error handling

SDK throws typed errors:

```ts
class NauApiError extends Error {
  status: number;
  code: string;
}
```

Consumers catch `NauApiError` and handle `401` (redirect to login), `403` (show permission error), `404` (not found UI), etc.

---

## Types

All entity types exported from `@nau/types` and re-exported from `@nau/sdk` for convenience. No duplication.

---

## Related

- [../platform/API-CONTRACT.md](../platform/API-CONTRACT.md)
- [types.md](types.md)
- [../decisions/ADR-001-entity-centralization.md](../decisions/ADR-001-entity-centralization.md)
