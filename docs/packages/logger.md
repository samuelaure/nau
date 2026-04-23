# Package — @nau/logger

- **Location:** `packages/logger`
- **Consumers:** All services and apps

---

## Purpose

Thin wrapper over `pino` providing structured JSON logging with consistent field names across all services.

---

## API

```ts
import { createLogger } from '@nau/logger';

const logger = createLogger({ service: 'flownau' });

logger.info({ brandId, action: 'ideation.start' }, 'Starting ideation run');
logger.warn({ workspaceId }, 'Workspace not found');
logger.error({ err, jobId }, 'Render job failed');
```

Output (JSON, one line per entry):

```json
{ "level": "info", "service": "flownau", "brandId": "...", "action": "ideation.start", "msg": "Starting ideation run", "time": 1714000000000 }
```

---

## Conventions

- Always include a `service` field (set once at logger creation).
- Log entity IDs (`brandId`, `workspaceId`, `jobId`) as structured fields, not interpolated strings.
- `err` field for errors: pass the `Error` object directly — pino serializes it.
- No `console.log` in production code.

---

## Log levels

| Level | Use |
|---|---|
| `fatal` | Unrecoverable startup failure |
| `error` | Runtime error needing attention |
| `warn` | Expected failure / degraded state |
| `info` | Normal operational events |
| `debug` | Development detail (disabled in prod) |

---

## Related

- [../future/observability.md](../future/observability.md)
