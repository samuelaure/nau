# Architecture Decision Record: Render Queue Infrastructure

## Context
Video rendering in Remotion is a highly resource-intensive, asynchronous operation that blocks the main thread and can crash the process under high concurrency. We need a reliable queuing mechanism to handle rendering tasks in the background, ensure jobs are processed sequentially or with strict concurrency limits, and retry rendering failures cleanly. 

The two primary candidates evaluated were:
1. **DB-backed queuing** (e.g., `pg-boss` or custom Prisma table pulling)
2. **Redis-backed queuing** (e.g., `BullMQ` or `Kue`)

## Decision
We chose **BullMQ (Redis-backed)** for the render queue architecture.

### Reasoning
1. **Separation of Concerns:** Video rendering should not contend with standard CRUD operations for PostgreSQL connection pool limits or row locks.
2. **In-Flight Progress Tracking:** Rendering is a multi-step process (bundling, compiling, frame-skipping, audio mapping). BullMQ natively supports sending progress updates (0-100%) which the frontend dashboard easily poles without constantly querying and indexing a database table.
3. **Advanced Retry Mechanisms:** BullMQ has native support for exponential backoffs, stalled job handling, and robust concurrency limiting per-worker—features that are complex to simulate effectively in a naive DB table setup.

## Consequences

**Positive:**
- Extremely robust job tracking and progress.
- Clean concurrency (we limit `RENDER_CONCURRENCY` at the worker boundary reliably without database lock friction).

**Negative (Trade-offs):**
- **Infrastructure Dependency:** The `flownau` ecosystem now strictly requires a Redis instance to function. 
- Deployment complexity is marginally increased (docker-compose must spin up and link Redis before starting the web/worker services).

## Implementation Rules
- The queue name is strictly `flownau-render`. **Do not change this** in production without draining the queue first, otherwise in-flight jobs will be permanently dropped.
- The Render Worker (`render-worker.ts`) must run as a discrete process (or gracefully handled inside the main node event loop via an explicit init) to ensure it doesn't crash the API server during catastrophic `ffmpeg` faults.
