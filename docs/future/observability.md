# Future — Observability

> Metrics, tracing, and alerting for the platform as it scales.

**Status:** not scoped for the current refactor. Trigger to start: first on-call incident or sustained user-visible latency.

---

## Current state

- Structured logs via pino (after Phase 1 `@nau/logger` lands — before that, mix of `console.log` and Fastify logs).
- No centralized log aggregation.
- No distributed tracing.
- No metrics endpoint.
- No alerting beyond Docker container health.

## Target

Three pillars, minimal complexity, cost-proportionate-to-scale.

### 1. Logs

- **Producers:** every service uses `@nau/logger` (pino).
- **Aggregation:** ship logs to a central system.
  - MVP: Grafana Loki (single Hetzner container, self-hosted).
  - Mid-scale: Axiom (managed, generous free tier).
  - Large-scale: Datadog / New Relic.
- **Standard fields:** `service, requestId, userId?, workspaceId?, brandId?, operation, durationMs`.

### 2. Metrics

- **Producers:** each service exposes `/metrics` (Prometheus text format).
  - NestJS: `@willsoto/nestjs-prometheus`.
  - Next.js: `prom-client` hooked into middleware.
- **Collection:** self-hosted Prometheus or managed (Grafana Cloud, New Relic).
- **Key metrics:**
  - HTTP: `http_requests_total{method,path,status}`, `http_request_duration_seconds{method,path}`
  - Queue: `bullmq_jobs_total{queue,status}`, `bullmq_job_duration_seconds{queue}`
  - Business: `brands_created_total`, `compositions_published_total`, `comment_suggestions_generated_total`
  - Auth: `auth_login_attempts_total{outcome}`, `auth_refresh_total`
  - External API: `openai_calls_total{model,outcome}`, `openai_tokens_used_total`

### 3. Tracing

- **Producers:** OpenTelemetry SDK in each service.
- **Collection:** Jaeger (self-hosted MVP) or Grafana Tempo / Honeycomb (managed).
- **Instrumentation:**
  - Auto: HTTP server, Prisma (via OTEL instrumentation).
  - Manual: wrap cross-service `@nau/sdk` calls and queue job processors.
- **Context propagation:** `traceparent` header flows from client → 9naŭ API → downstream services.

## Dashboards

### Platform health (Grafana)

- Request rate, error rate, p50/p95/p99 latency per service.
- Queue depth + processing lag per BullMQ queue.
- Database connection pool utilization.
- External API error rates (OpenAI, Apify, Instagram, Telegram).
- JWT verification failures / refresh denials.

### Business

- Brands created per day.
- Compositions published per brand.
- Inspo captures per user.
- Comment suggestions generated vs. used (from `CommentFeedback`).

## Alerts

### Pager-level (wake someone up)

- Any service down for >5 min.
- Error rate >5% for >5 min.
- Database connection pool exhausted.
- Queue depth growing unboundedly (>10x baseline for >10 min).

### Daily digest

- Slow queries (>1s) from Prisma.
- Unusual API error spikes.
- Expiring Instagram tokens within 7 days.
- High OpenAI spend vs. baseline.

## Cost-tier plan

| Scale | Stack | Cost |
|---|---|---|
| Pre-launch / few users | Pino → stdout, no aggregation | $0 |
| Launch / <1k users | Loki + Prometheus + Grafana (self-hosted on existing Hetzner) | $0 (uses existing infra) |
| Growth / 1k–10k users | Axiom for logs, Grafana Cloud for metrics | ~$100/mo |
| Scale / 10k+ users | Datadog or New Relic full stack | $500+/mo |

## Execution plan

Three sub-phases:

1. **Logs first** — shared `@nau/logger` already lands in Phase 1 of the [roadmap](ROADMAP.md). Aggregation can be added without touching app code (container log driver).
2. **Metrics second** — add `/metrics` endpoints in a follow-up PR per service.
3. **Tracing third** — most complex; add when a cross-service latency incident demands it.

## Related

- [../packages/logger.md](../packages/logger.md) — `@nau/logger` package
- [ROADMAP.md](ROADMAP.md) — where observability sits relative to other work
