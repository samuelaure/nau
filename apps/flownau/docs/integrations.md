# naŭ Platform Integrations

Flownaŭ is not an isolated monolith. It acts as the execution layer (Layer 1 Platform Service) for surrounding naŭ ecosystem utilities and external creative intelligence APIs.

This document serves as the integration contract for all third-party and internal network boundaries.

## 1. External AI Providers

Flownaŭ relies heavily on generative AI to map abstract ideas into structured `CreativeDirection` objects. It gracefully handles provider instability.

### OpenAI (Structured Outputs)

- **Role:** Generates JSON configurations that rigidly match our internal `Zod` schemas for composition rendering.
- **Library:** OpenAI Node SDK (`chat.completions.parse`).
- **Resiliency Constraint:** Network timeouts and JSON truncation are common.
  - **Logic:** Handled within `callAI()` in `SceneComposer`. An initial failure provides feedback to the AI on its failure surface (e.g. invalid string length), retries once, then bubbles up a tracked failure if still unparseable.

### Groq (Fallback)

- **Role:** High-speed, lower-cost alternative running LLama 3.3.
- **Limitation:** Groq does not natively support `zodResponseFormat`.
  - **Logic:** If `OPENAI_API_KEY` is absent, the fallback parser requests raw JSON, strips markdown fences, and manually validates against `CreativeDirectionSchema`. Fails cleanly via ZodError extraction.

---

## 2. Internal Integrations: 9naŭ

`9naŭ` serves as a quick-capture interface and mobile-first triage environment.

### Capture Ingestion (Webhook)

- **Path:** `POST /api/v1/ideas/ingest`
- **Trigger:** A user on mobile selects a captured note and marks it for video generation.
- **Behavior:**
  - 9naŭ sends a payload with `[ { text: "idea", source: "captured" } ]`.
  - **Priority Bypass:** Flownaŭ detects `source: "captured"`. It grants standard Idea Generation a priority `1` (Highest).
  - **Autonomous Generation Engine:** Since this implies high user-intent, Flownaŭ's ingestor fires a non-blocking asynchronous `fetch` to `/api/cron/composer`. This immediately processes the Idea into a Draft Composition without waiting for the hourly cron.

### Reactive Compositions

- **Path:** `POST /api/v1/compose`
- **Behavior:** Allows 9naŭ to explicitly command Flownaŭ to generate and attach a composition natively back to an external entity.

---

## 3. Internal Integrations: Nauthenticity

`Nauthenticity` is the core curation hub.

### InspoBase Generation

- **Role:** Flownaŭ's _Automatic_ Idea Generation leverages Nauthenticity's curated content concepts (`InspoItems`).
- **Data Flow:**
  - Flownaŭ invokes `fetch(NAUTHENTICITY_URL + '/api/inspo')`.
  - The Ideation engine maps these items into new content angles via the Groq provider.
- **Fallback Logic:** If Nauthenticity is down (e.g. `ECONNREFUSED` on `nau-network`), the IdeationEngine degrades gracefully to only use internal _Brand DNA_ context for generating standard thematic ideas.

---

## Integration Contracts (Auth)

All communication over the `nau-network` strictly requires the inclusion of the universal service key:

```http
Authorization: Bearer NAU_SERVICE_KEY
```

Failure to provide this key returns a strict `401 Unauthorized`. In a shared docker-compose `v3` architecture, requests skip the Traefik router layers by hitting the direct internal DNS aliases (e.g. `http://nauthenticity:3000`).
