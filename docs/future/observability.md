# Future — Observability

> Metrics, tracing, and alerting for the platform as it scales.

**Status:** uptime monitoring is live. Two capabilities remain future work: centralized log aggregation and distributed tracing.

---

## Current state

- Structured logs via `@nau/logger` (pino) active in all NestJS/Express services.
- Global exception filter in api and nauthenticity — all unhandled errors logged with path, method, and stack.
- Health endpoints at `/health` for api and nauthenticity.
- Docker log rotation configured (json-file, 10m/3 files per service).
- ✅ **Uptime monitoring active** — `.github/workflows/uptime.yml`, every 5 min, Telegram alerts.
- No centralized log aggregation.
- No distributed tracing.
- No Prometheus metrics endpoints.

---

## Two remaining future capabilities

### 1. ~~Uptime monitoring~~ ✅ Implemented

See [DEPLOYMENT.md → Uptime monitoring](../platform/DEPLOYMENT.md#uptime-monitoring).

---

**How:**
- [BetterStack Uptime](https://betterstack.com/uptime) — free tier covers 10 monitors, 3-min check intervals, Telegram/email alerts.
- [UptimeRobot](https://uptimerobot.com) — free tier, 5-min intervals.
- Configure one monitor per service pointing at its `/health` endpoint.
- Alert channel: Telegram (same bot token already configured).

**Estimated effort:** 15 minutes.

---

### 2. Centralized log aggregation

**What it is:** shipping all container stdout logs to a queryable central store so you can search across services, filter by `requestId` or `userId`, and correlate events without SSHing into individual containers.

**Why you need it:** `docker logs api --tail=100` is fine for one service in development. In production, when a user reports "it broke around 3pm", you need to search across all 7 services simultaneously, filter by user ID, and see the full request chain. Without aggregation you're blind — you SSH to one container, grep manually, then move to the next. It takes 20 minutes to find what aggregation would surface in 10 seconds.

**When to add it:** when you have real users and the first "what happened to user X?" question takes more than 5 minutes to answer. Before that, `docker logs` via SSH is sufficient.

**How:**
- **MVP (self-hosted, $0):** Grafana Loki + Promtail on the same Hetzner server. Promtail reads Docker container logs and ships to Loki. Add a Grafana container for the UI. Total overhead: ~300MB RAM.
- **Managed (~$25/mo):** [Axiom](https://axiom.co) — generous free tier (50GB/month), no infrastructure to manage, excellent search UI. Ship via the `axiom` Docker log driver.
- **Standard fields to emit:** `service`, `requestId`, `userId`, `workspaceId`, `brandId`, `operation`, `durationMs` — `@nau/logger` already structures logs this way.

**Estimated effort:** 2–4 hours for Loki self-hosted, 30 minutes for Axiom managed.

---

### 3. Distributed tracing (OpenTelemetry)

**What it is:** attaching a `traceId` to every incoming request and propagating it through every service call, queue job, and database query, so you can see the full execution tree of a single user action across multiple services — including exactly how long each hop took.

**Why you need it:** when a user says "content generation is slow", you need to know whether the bottleneck is in flownau's Next.js server action, the `@nau/sdk` call to the API, the API's Prisma query, or the nauthenticity call for brand context. Without tracing, each service's logs are a separate timeline and you have to mentally reconstruct the causality. With tracing, you open one waterfall diagram and immediately see `flownau → api (12ms) → nauthenticity (2.3s)` — the nauthenticity call is the problem.

**When to add it:** when you have a cross-service latency complaint you can't diagnose from logs alone. Don't add it speculatively — OTEL instrumentation adds ~5–10ms overhead per request and complexity to every service's startup.

**How:**
- **Instrumentation:** OpenTelemetry SDK in each service. NestJS has first-class OTEL support via `@opentelemetry/sdk-node`. Next.js supports it via `instrumentation.ts` (stable in Next.js 15).
- **Auto-instrumented:** HTTP server, Prisma (via `@prisma/instrumentation`), BullMQ jobs.
- **Manually instrumented:** `@nau/sdk` outbound calls (add `traceparent` header), queue job processors.
- **Collector options:**
  - Self-hosted: [Jaeger](https://jaegertracing.io) (in-memory for dev, Cassandra/Elasticsearch for prod).
  - Managed: [Grafana Tempo](https://grafana.com/oss/tempo/) (free on Grafana Cloud), [Honeycomb](https://honeycomb.io) (excellent DX, paid after 20M events/mo).
- **Context propagation:** `traceparent` / `tracestate` W3C headers — `@nau/sdk` needs to forward these on all outbound calls.

**Estimated effort:** 1–2 days to instrument all services + set up a collector.

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
