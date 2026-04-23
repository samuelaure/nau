# Future — Atomic Brand Lifecycle (event-driven)

> Replacing fire-and-forget cross-service writes with an outbox + events pattern for guaranteed consistency at SaaS scale.

**Status:** not urgent pre-launch. Becomes important as tenant count grows.

---

## Problem

Brand create/update/delete touches multiple services:

- `Brand` row in 9naŭ API (master)
- `SocialProfileCredentials` cleanup in flownaŭ on brand delete
- Scraped content cleanup / orphan handling in nauthenticity on brand delete

In the current model (Phase 2 of the [roadmap](ROADMAP.md)), downstream services LAZILY create domain rows on first use. Writes flow one direction (9naŭ → world). No explicit events.

This works until:
- A brand delete needs to cascade across services — currently each service polls for orphans or lazily skips deleted brands.
- High-consistency guarantees are needed (e.g., billing ties to brand count).
- Third-party integrations (Zapier, webhooks to user's tools) need brand-event streams.

## Target

**Transactional outbox pattern** in 9naŭ API:

1. Brand mutations write to a local `OutboxEvent` table in the same Postgres transaction.
2. A background worker tails the outbox, publishes events to a stream (Redis streams or PostgreSQL LISTEN/NOTIFY for MVP; NATS/Kafka at scale).
3. Consumer services subscribe, process events idempotently.

### Schema (9naŭ API)

```prisma
model OutboxEvent {
  id          String         @id @default(cuid())
  aggregate   String                          // e.g. "brand"
  aggregateId String
  eventType   String                          // e.g. "brand.created", "brand.deleted"
  payload     Json
  occurredAt  DateTime       @default(now())
  publishedAt DateTime?

  @@index([publishedAt, occurredAt])
}
```

### Event shape

```json
{
  "eventId": "...",
  "eventType": "brand.deleted",
  "aggregate": "brand",
  "aggregateId": "cmXXX",
  "occurredAt": "2026-04-23T12:00:00Z",
  "payload": {
    "brandId": "cmXXX",
    "workspaceId": "cmYYY",
    "deletedBy": "userId"
  }
}
```

### Consumers

- **flownaŭ** subscribes to `brand.deleted` → deletes all domain rows where `brandId = payload.brandId` in a transaction.
- **nauthenticity** subscribes to `brand.deleted` → deletes `InspoItem`, `BrandSynthesis`, `CommentFeedback` where `brandId = payload.brandId`. Scraped content dedup (`Post`, `Media`) is NOT cascaded here — orphan cleanup job.

### Idempotency

Consumers store `last_processed_event_id` per subscriber. Events are processed at-least-once. Consumer operations must be idempotent (DELETE WHERE brandId = X is naturally idempotent).

## Transport choice

| Option | Pros | Cons | Fit |
|---|---|---|---|
| **Postgres LISTEN/NOTIFY** | Zero infra | Not durable (messages lost on consumer disconnect), limited throughput | Good for MVP, single-digit services |
| **Redis Streams** | Durable, already in infra for BullMQ | Adds coupling to Redis uptime | Good for 10s of services |
| **NATS JetStream** | Lightweight, durable, streaming | Extra service to operate | Good for 50+ services |
| **Kafka** | Industry standard, huge ecosystem | Heavy, over-engineered until very high scale | Overkill for this platform for years |

**Recommendation:** Start with Redis Streams when this phase comes. Migrate to NATS only if needed.

## Alternative: two-phase commit / saga

Saga pattern (each service writes locally, compensates on failure) is more complex than outbox and offers marginal benefits for this platform's use case. Outbox is simpler and sufficient.

## Execution plan

Post-launch. Trigger to start:

- First customer complaint about brand delete not cascading cleanly, OR
- Planned webhook / Zapier integration needs event stream.

## Related

- [../platform/ARCHITECTURE.md](../platform/ARCHITECTURE.md) — current data flow (synchronous)
- [../platform/ENTITIES.md](../platform/ENTITIES.md) — cascade rules (current)
- [../decisions/ADR-001-entity-centralization.md](../decisions/ADR-001-entity-centralization.md) — centralization requires this pattern to scale
