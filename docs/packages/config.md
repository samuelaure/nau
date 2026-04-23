# Package — @nau/config

- **Location:** `packages/config`
- **Consumers:** All services and apps

---

## Purpose

Centralizes environment variable validation and typed config access. Each service declares its required env vars once; startup fails fast with a clear error if any are missing.

---

## Pattern

```ts
import { createConfig } from '@nau/config';
import { z } from 'zod';

export const config = createConfig(z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  NAU_API_URL: z.string().url(),
  OPENAI_API_KEY: z.string(),
}));

// Usage:
config.DATABASE_URL  // typed string, throws if missing
```

`createConfig` validates `process.env` against the schema at module load time. Throws `ConfigError` with a list of all missing/invalid vars.

---

## Shared base schemas

```ts
// Re-exported helpers for common vars:
export const baseApiSchema    // DATABASE_URL, REDIS_URL, NAU_API_URL, AUTH_SECRET
export const baseNextSchema   // NEXT_PUBLIC_APP_URL, NAU_API_URL, AUTH_SECRET
```

Services extend the base schema with their own vars.

---

## Related

- [../services/](../services/) — each service doc lists its required env vars
