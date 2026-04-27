# Health Checks & Service Connectivity Validation Strategy

**Status**: Planning  
**Target Release**: Post-MVP deployment  
**Priority**: Medium  
**Effort**: 2-3 sprints

---

## Overview

This document outlines the future implementation of comprehensive health checks and service connectivity validation for the 9naŭ platform microservices. These checks ensure that post-deployment, all services are operational and can communicate across the Docker network.

---

## Motivation

Currently, deployments assume all services come up correctly and can reach each other. In production, this can mask:
- Database connection failures (wrong credentials, network isolation)
- Service startup failures (missing migrations, bad config)
- Inter-service connectivity issues (DNS failures, firewall rules, wrong internal URLs)
- Cascading failures (API fails, brings down dependent services)

Health checks prevent deployment of broken configurations and catch issues early.

---

## Architecture

### 1. Container-Level Health Checks

Every service container should expose a health probe endpoint.

**For each service type:**

| Service | Endpoint | Status Code | Response |
|---------|----------|-------------|----------|
| NestJS (API, Nauthenticity, Zazu-bot) | `GET /health` | 200 | `{"status": "ok"}` |
| Next.js (App, Accounts, Flownau, Zazu-dashboard) | `GET /api/health` or `/_next/health` | 200 | `{"status": "ok"}` |
| PostgreSQL | `pg_isready` command | 0 (exit code) | N/A (already in docker-compose) |
| Redis | `redis-cli ping` | PONG | (already in docker-compose) |

**Docker Compose Example**:
```yaml
services:
  api:
    image: ghcr.io/samuelaure/nau/api:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      api-postgres:
        condition: service_healthy
      api-redis:
        condition: service_healthy
```

**Implementation Tasks**:
1. Add `GET /health` endpoint to each NestJS service (API, Nauthenticity, Zazu-bot)
   - Return 200 + `{"status": "ok"}`
   - Check database connectivity
   - Check Redis connectivity
   - Return 503 + error details if dependencies fail

2. Add `GET /api/health` to each Next.js service (App, Accounts, Flownau, Zazu-dashboard)
   - Lightweight health check (no external calls)
   - Return 200 + `{"status": "ok"}`

3. Update all docker-compose*.yml files with healthcheck directives
   - Set `depends_on: condition: service_healthy` for dependent services

---

### 2. Post-Deployment Service Connectivity Validation

After all containers are running, validate that services can communicate.

**Connectivity Matrix** (inter-service calls to validate):

```
API → {Database, Redis, Nauthenticity, Flownau, Zazu-bot}
Flownau → {Database, Redis, API, Nauthenticity, Zazu-bot}
Nauthenticity → {Database, Redis, API, Flownau}
Zazu-bot → {Database, API, Nauthenticity}
Zazu-dashboard → {Database, API, Nauthenticity}
Accounts → {API}
App → {API}
```

**Validation Method**:
- Curl each service's `/health` endpoint from another service container
- Test both short hostname (via Docker network DNS) and full hostname
- Log successes and failures
- Exit with non-zero if any connection fails

**Example Validation Script** (to run after deployment):
```bash
#!/bin/bash
# Validate service connectivity

check_service() {
  local name=$1
  local endpoint=$2
  
  echo -n "  Checking $name ... "
  if curl -sf "$endpoint" > /dev/null 2>&1; then
    echo "✓"
    return 0
  else
    echo "✗ (endpoint: $endpoint)"
    return 1
  fi
}

echo "Validating service connectivity..."
all_ok=true

check_service "API" "http://api:3000/health" || all_ok=false
check_service "Flownau" "http://flownau:3000/health" || all_ok=false
check_service "Nauthenticity" "http://nauthenticity:3000/health" || all_ok=false
check_service "Zazu-bot" "http://zazu-bot:3000/health" || all_ok=false

if $all_ok; then
  echo "✓ All services reachable"
  exit 0
else
  echo "✗ Some services unreachable"
  exit 1
fi
```

---

### 3. Deployment Workflow Integration

**Integration Point**: CI/CD pipeline after `docker compose up -d`

**New GHA Job: `validate-deployment`** (added to each app's workflow):

```yaml
  validate:
    name: Validate deployment health
    runs-on: ubuntu-latest
    needs: deploy
    steps:
      - uses: actions/checkout@v4
      - name: Wait for services
        run: sleep 10
      - name: Run connectivity validation
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_SSH_HOST }}
          username: root
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            bash ~/scripts/validate-connectivity.sh
```

**Deployment Failure Handling**:
- If validation fails, emit alert to Slack/email
- Optionally: Auto-rollback previous version (future)
- Log validation results for debugging

---

## Implementation Roadmap

### Phase 1: Health Endpoint Implementation (1-2 sprints)
- [ ] Add `GET /health` to API (NestJS)
- [ ] Add `GET /health` to Nauthenticity
- [ ] Add `GET /health` to Zazu-bot
- [ ] Add `GET /api/health` to App (Next.js)
- [ ] Add `GET /api/health` to Accounts
- [ ] Add `GET /api/health` to Flownau
- [ ] Add `GET /api/health` to Zazu-dashboard
- [ ] Test health endpoints locally
- [ ] Update docker-compose files with healthcheck directives

### Phase 2: Validation Script & Monitoring (1 sprint)
- [ ] Create `scripts/validate-connectivity.sh`
- [ ] Test script against staging environment
- [ ] Add logging/metrics collection
- [ ] Create Slack/email alert template

### Phase 3: CI/CD Integration (1 sprint)
- [ ] Add `validate` job to each workflow
- [ ] Test validation in staging
- [ ] Configure alerting channels
- [ ] Document troubleshooting guide

### Phase 4: Auto-Remediation (Future)
- [ ] Implement automatic rollback on validation failure
- [ ] Canary deployment checks
- [ ] Gradual traffic shifting

---

## Success Metrics

- [ ] 100% of services report healthy status within 2 minutes of deployment
- [ ] All inter-service connectivity tests pass
- [ ] Failed deployments caught before production traffic reaches them
- [ ] Troubleshooting time reduced by 50% (when issues occur)
- [ ] False positive rate < 5% (avoid alert fatigue)

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Health endpoint performance regression | Medium | Medium | Use lightweight checks, mock dependencies in tests |
| False positives (transient network issues) | Medium | Low | Implement retry logic (3 attempts, 10s timeout) |
| Validation timing issues (services still starting) | High | Low | Use `start_period` in healthcheck, add 10-20s delay |
| Missing dependencies in health checks | Medium | High | Audit each service's critical dependencies |

---

## References

- Docker healthcheck best practices: https://docs.docker.com/compose/compose-file/compose-file-v3/#healthcheck
- Kubernetes liveness/readiness probes: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- Microservice testing patterns: https://microservices.io/patterns/observability/service-mesh.html

---

## Appendix: Health Endpoint Response Formats

**NestJS Services** (API, Nauthenticity, Zazu-bot):
```json
{
  "status": "ok",
  "timestamp": "2026-04-27T12:34:56Z",
  "dependencies": {
    "database": "ok",
    "redis": "ok"
  }
}
```

**Next.js Services** (App, Accounts, Flownau, Zazu-dashboard):
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-04-27T12:34:56Z"
}
```

---

**Created**: 2026-04-27  
**Last Updated**: 2026-04-27  
**Owner**: Platform Engineering  
**Status**: Planning
