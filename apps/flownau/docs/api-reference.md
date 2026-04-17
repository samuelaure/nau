# naŭ Platform API Reference

The `flownau` service exposes two main namespaces:

1. `v1/` - General external and programmatic access.
2. `agent/` - AI-specific and automated workflows context.

## Authentication

Unless noted otherwise, all external API routes require Server-to-Server authentication.
Include the `authorization` header with the configured `NAU_SERVICE_KEY`.

```http
Authorization: Bearer <NAU_SERVICE_KEY>
```

---

## 1. System Endpoints

### `GET /api/v1/health`

Health check endpoint providing application version and status.
**Auth:** None required.

**Response:**

```json
{
  "status": "ok",
  "service": "flownau",
  "version": "1.1.1",
  "timestamp": 1713374291123
}
```

---

## 2. Ideation & Content

### `POST /api/v1/ideas/ingest`

Ingests external ideas (e.g. from 9naŭ mobile quick-captures) into the Ideation Engine backlog.

**Request Schema:**

```json
{
  "accountId": "string (UUID)",
  "ideas": [
    {
      "text": "string (min 1 char)",
      "source": "inspo | user_input | reactive | captured",
      "sourceRef": "string (optional UUID)"
    }
  ]
}
```

**Response:**

```json
{
  "created": 1,
  "ids": ["idea-uuid"]
}
```

_Note: Ideas with source `captured` immediately trigger the Composer cron securely in the background for priority processing._

---

## 3. Composition Pipeline (Agent)

### `POST /api/agent/compose`

Triggers the AI Scene Composer for an explicit string or `ideaText`. Useful for reactive generation from an incoming stimulus.
**Rate Limiting:** 10 requests per minute per IP. Returns `429 Too Many Requests` on breach.

**Request Schema:**

```json
{
  "prompt": "string",
  "accountId": "string (UUID)",
  "format": "reel | carousel | single_image",
  "personaId": "string (optional UUID)"
}
```

**Response:**

```json
{
  "message": "Creative direction composed and stored",
  "compositionId": "comp-uuid"
}
```

### `POST /api/agent/idea-generation`

Invokes the IdeationService to generate `ContentIdea` drafts from the brand's DNA and InspoBase context.

**Request Schema:**

```json
{
  "accountId": "string (UUID)",
  "personaId": "string (UUID)",
  "frameworkId": "string (optional UUID)",
  "count": "number (default: 5)"
}
```

**Response:**

```json
{
  "message": "Generated new ideas",
  "createdCount": 5
}
```

---

## 4. Internal Cron Workflows

Cron endpoints drive the automated state-machine. They must be called with a specific Vercel/Internal cron header (e.g. `Authorization: Bearer CRON_SECRET`) which maps to internal config.

### `GET /api/cron/composer`

Finds `APPROVED` ideas, composes them via AI, compiles timeline schemas using synced media assets, and transitions them into `DRAFT` or `queued` compositions for rendering.

### `GET /api/cron/publisher`

Queries completed renderings and publishes them to the Instagram Graph API. Scans for optimal hourly posting windows.

### `GET /api/cron/token-refresh`

Checks all linked Instagram OAuth access tokens. Proactively refreshes them if within the expiry buffer window (default 7 days).
**Locking:** Uses distributed Redis lock to prevent concurrent redundant renewals.
