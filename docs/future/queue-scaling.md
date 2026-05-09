# Future: Queue Scaling for Multi-Brand / Multi-User Load

## Context

All queues in flownau and nauthenticity are global — all brands and users share the same BullMQ queues. At the current scale (single VPS, small user base) this is fine. As the platform grows, the following improvements become worth investing in.

---

## 1. Per-brand rate limiting

**Problem**: A single brand can submit hundreds of assets at once and monopolize the optimization or render queue for all other brands.

**Solution**: BullMQ's built-in rate limiter keyed by `brandId` — each brand gets a maximum of N jobs per time window, regardless of how many they submit. Excess jobs are delayed, not rejected.

**When**: When individual brands start flooding the queue and causing visible wait times for others (>2 min queue depth regularly).

---

## 2. Per-brand fair queue (round-robin)

**Problem**: FIFO ordering means brand A's 100 jobs all run before brand B's 1 job, even though brand B submitted after just brand A's first job.

**Solution**: A scheduler layer that pulls one job per brand per tick (round-robin), so all active brands get turns interleaved. BullMQ Pro has `Job Groups` for this natively. The open-source equivalent is a thin scheduler that groups jobs by `brandId` and picks the next brand in rotation.

**When**: When fairness between brands/users becomes a product requirement (multi-tenant SaaS with paying customers).

---

## 3. Separate worker containers per workload

**Problem**: All workers (render + optimization) share the same `flownau-renderer` container. A memory spike in one starves the other.

**Solution**: Split into dedicated containers, each with its own resource limits and scaling policy:
- `flownau-renderer` — Remotion/Chromium only
- `flownau-optimizer` — ffmpeg only

Each can be scaled independently based on queue depth.

**When**: When render jobs regularly queue behind optimization jobs or vice versa (queue depth crosses >5 for either regularly).

---

## 4. Horizontal worker autoscaling

**Problem**: A single worker process handles all jobs sequentially. On a bigger server or with more users, throughput is capped by single-instance concurrency.

**Solution**: Workers become stateless containers. A controller watches queue depth and starts/stops worker containers:
- Queue depth > N → spin up an additional worker container
- Queue idle → scale back to zero

On Hetzner: achievable with a small cron that polls BullMQ queue counts and calls the Hetzner API to resize or add worker nodes. More complex alternative: migrate to Kubernetes + KEDA (event-driven autoscaling on queue metrics).

**When**: When average queue wait time exceeds acceptable SLA (e.g., >5 min for optimization, >10 min for rendering).

---

## Current safe concurrency defaults

| Worker | Env var | Default | Notes |
|---|---|---|---|
| Render (Remotion threads) | `RENDER_CONCURRENCY` | 1 | Chromium is ~2GB RAM peak — keep at 1 per instance |
| Optimization (ffmpeg jobs) | `OPTIMIZATION_CONCURRENCY` | 1 | ffmpeg on large video is ~500MB RAM — raise to 2 only if RAM headroom confirmed |
| BullMQ render worker jobs | hardcoded | 1 | One render job at a time per worker process |
