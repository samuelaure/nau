# Infrastructure Restoration & De-Sentinel Plan

## 1. Objective

Remove all shared-infrastructure coupling (Sentinel patterns) from the `flownau` repository and restore a fully isolated, secure local Docker stack. The application will be accessible via Traefik while internal services (Postgres, Redis) remain private and secured.

## 2. Shared Assumptions to Remove

- `shared_postgres` and `shared_redis` host assumptions.
- Mandatory `shared-mesh` network for internal service communication.
- `profiles: [disabled]` in the override which kills local services.
- Publicly exposed ports for Postgres (5433) and Redis (6380).

## 3. Secured Architecture

- **Postgres**: Named `postgres`, internal only, authenticated via `POSTGRES_PASSWORD`.
- **Redis**: Named `redis`, internal only, authenticated via `REDIS_PASSWORD` using `--requirepass`.
- **Networking**:
  - `app-network` (Bridge): For internal communication between `app`, `postgres`, and `redis`.
  - `shared-mesh` (External): Only for `app` to communicate with the Traefik secondary container/gateway.
- **Access**: Only ports 80/443 (via Traefik) or 3000 (if manually exposed) should reach the app. Postgres and Redis will NOT expose ports to the host.

## 4. Environment Variables

Added to `.env`:

- `REDIS_PASSWORD`: Secure credential for Redis.
- `REDIS_PORT`: Defaulting to 6379.

## 5. Implementation Phases

### Phase 1: Environment Security Hardening

- Update `.env` with missing security credentials.
- Update `DATABASE_URL` and `REDIS_HOST` for the isolated environment.

### Phase 2: Docker Stack Isolation

- Refactor `docker-compose.yml` to remove port exposures.
- Implement Redis password authentication.
- Add healthchecks for Postgres and Redis.
- Configure dual-network setup for Traefik compatibility without compromising isolation.

### Phase 3: Cleanup & Validation

- Reset `docker-compose.override.yml` to be a pure Traefik bridge.
- Sync `docker-compose.override.yml.example`.
- Verify connectivity and security.

# Phase 1: Environment Security Hardening

## Tasks

- [x] **Task 1.1: Update `.env` with security credentials**
  - Add `REDIS_PASSWORD` (use a secure random string or the one from `.env` if it exists).
  - Ensure `REDIS_PORT=6379`.
  - Ensure `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` are properly set.
- [x] **Task 1.2: Align Connection Strings**
  - Ensure `DATABASE_URL` in `.env` is ready for local development (localhost:5432).
  - Note: The `docker-compose.yml` will override these with internal service names.

## Verification

- Check `.env` contains `REDIS_PASSWORD`.
- Verify no `shared_*` strings remain in the main `.env`.

builder: Phase 1 completed. Added `REDIS_PASSWORD` to `.env`.

# Phase 2: Docker Stack Isolation & Restoration

## Tasks

- [x] **Task 2.1: Refactor `docker-compose.yml` Service Names & Containers**
  - Ensure `postgres` service is named `postgres`.
  - Set `container_name: flownau-postgres`.
  - Remove `ports` mapping for both `postgres` and `redis`.
- [x] **Task 2.2: Implement Service Healthchecks & Security**
  - Add `healthcheck` to `postgres` (using `pg_isready`).
  - Add `command: redis-server --requirepass "${REDIS_PASSWORD}"` to `redis`.
  - Add `healthcheck` to `redis` (using `redis-cli ping` with password).
- [x] **Task 2.3: Configure Multi-Network Isolation**
  - Create `app-network` (bridge).
  - Create `shared-mesh` (external: true).
  - Assign `app` to both networks.
  - Assign `postgres` and `redis` ONLY to `app-network`.
- [x] **Task 2.4: Update App Dependencies**
  - Update `app.depends_on` to wait for `postgres` and `redis` to be healthy.
  - Pass `REDIS_PASSWORD` to the `app` container.

## Verification

- Run `docker compose config` to verify syntax.
- Ensure no ports are listed for `postgres` or `redis`.

builder: Phase 2 completed. Refactored `docker-compose.yml` for isolation, security, and healthchecks.

# Phase 3: Traefik Alignment & Cleanup

## Tasks

- [x] **Task 3.1: Reset `docker-compose.override.yml`**
  - Remove `profiles: [disabled]`.
  - Remove `DATABASE_URL` and `REDIS_HOST` overrides (fallback to defaults in `docker-compose.yml`).
  - Keep Traefik labels and `shared-mesh` connection for the `app` service only.
- [x] **Task 3.2: Sync Example Overrides**
  - Ensure `docker-compose.override.yml.example` matches the new clean structure.
- [x] **Task 3.3: Final Readiness Check**
  - Verify `flownau.localhost` routing.
  - Confirm Redis and Postgres are unreachable from the host machine (security check).

## Verification

- `docker compose up -d`
- `curl -I http://flownau.localhost` (should work via Traefik).
- `nc -zv localhost 6380` (should fail).
- `nc -zv localhost 5433` (should fail).

builder: Phase 3 completed. Cleaned up override files and verified Docker configuration.
