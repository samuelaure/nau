# /recover — Incident Response

You are the **Incident Commander**. When something goes wrong in production, follow this protocol. Improvising during an incident is the #1 cause of extended downtime.

**Do NOT introduce new features or optimize during recovery. Get to known-good state first.**

---

## Phase 1: Triage (< 5 minutes)

Answer these before doing anything else:

```
1. What is DOWN?         [service / endpoint / feature]
2. Since when?           [approximate time]
3. What is the impact?   [who is affected / what stops working]
4. Is data at risk?      [signs of data loss or corruption?]
5. Is this a breach?     [unexpected outbound traffic, unauthorized access?]
```

Quick status:
```bash
ssh nau "docker ps --format 'table {{.Names}}\t{{.Status}}'"
```

**Classify severity:**

| Level | Criteria | Response Time |
|-------|----------|---------------|
| 🔴 CRITICAL | Data breach, full platform down, data loss | Immediate |
| 🟠 HIGH | Core service down, users blocked | < 15 min |
| 🟡 MEDIUM | Non-critical service degraded | < 1 hour |
| 🟢 LOW | Minor issue, workaround available | Next session |

---

## Phase 2: Isolate

Stop the bleeding before diagnosing.

### Service crashed / restart loop:
```bash
ssh nau "docker update --restart=no <container> && docker stop <container>"
```

### Bad deployment caused it:
```bash
# Pin previous image SHA in .env on server: TAG=sha-<previous-sha>
ssh nau "cd ~/apps/<service> && docker compose up -d"
```

### Nauthenticity workers interrupted mid-job:
```bash
# WorkersService.recoverStuckRuns() re-enqueues automatically on next boot
ssh nau "cd ~/apps/nauthenticity && docker compose restart nauthenticity"
ssh nau "docker logs nauthenticity --tail=30 -f"
# Look for: [Recovery] Run ... stuck in ... — re-triggering ...
```

### Security breach — immediate containment:
```bash
ssh nau "
  ufw deny 6379
  ufw deny 5432
  docker stop <compromised-container>
"
```

---

## Phase 3: Diagnose

```bash
ssh nau "docker logs <container> --tail=200"
ssh nau "dmesg | grep -i 'oom\|killed' | tail -20"
ssh nau "df -h /"
ssh nau "ss -tulpn"

# nauthenticity queue state
ssh nau "docker exec nauthenticity curl -s http://localhost:3000/queue | jq ."

# Stuck scraping runs
ssh nau "docker exec nauthenticity-postgres psql -U nauthenticity nauthenticity -c \"SELECT id, username, phase, status FROM \\\"ScrapingRun\\\" WHERE status = 'pending';\""
```

---

## Phase 4: Restore

### Path A — Service crash, no data issue
```bash
ssh nau "cd ~/apps/<service> && docker compose up -d"
```

### Path B — Bad deployment, rollback
Each push creates a `sha-<git-sha>` tag in GHCR:
```bash
# Edit ~/apps/<service>/.env on server: TAG=sha-<previous-sha>
ssh nau "cd ~/apps/<service> && docker compose up -d"
```

### Path C — Data corruption, restore from backup
```bash
ssh nau "
  docker compose stop <service>
  docker exec nau-backup ls /backups/<db>/
  gunzip -c /backups/<db>/<date>.sql.gz | docker exec -i <db-container> psql -U <user> <db>
  docker compose up -d
"
```

### Path D — Security breach, full containment
```bash
# Restrict server to your IP only while you work
ssh nau "ufw default deny incoming && ufw allow from <your-ip> to any && ufw enable"
# Rotate ALL credentials: DB passwords, AUTH_SECRET, service secrets, API keys (OpenAI, Apify, R2)
# Assess damage — what data was accessible from the compromised container?
# Restore normal firewall rules after cleanup
# Deploy clean version from known-good git SHA
```

### Path E — nauthenticity run stuck after deploy
```bash
ssh nau "cd ~/apps/nauthenticity && docker compose restart nauthenticity"
ssh nau "docker logs nauthenticity --tail=40 -f"
# Wait for: "All BullMQ workers ready" + [Recovery] logs
```

---

## Phase 5: Post-Mortem (Mandatory)

Every incident gets a post-mortem. Create `docs/incidents/YYYY-MM-DD-<name>.md`:

```markdown
# Incident: [title]
**Date:** [date]
**Duration:** [how long impacted]
**Severity:** 🔴/🟠/🟡/🟢

## What Happened
[Timeline, factual]

## Root Cause
[The actual technical reason]

## Impact
[What/who was affected, any data exposure?]

## Response Actions
[What was done to resolve]

## What Slowed Us Down
[What we didn't know / what was unclear]

## Prevention
- [ ] [Protocol change]
- [ ] [Infrastructure fix]
- [ ] [Monitoring to add]
```

If a protocol gap caused this, update `docs/platform/DEPLOYMENT.md`.

---

## Known Incident Patterns

### Redis publicly exposed
```bash
ssh nau "ufw deny 6379 && docker stop <redis-container>"
# Fix docker-compose: remove ports: mapping, ensure requirepass is set
# Rotate all secrets that passed through Redis
# Redeploy
```

### Nauthenticity worker job stall (post-deploy)
Startup recovery fires automatically on container restart. If it doesn't advance the run, restart again and watch logs. Worst case: manually update the `ScrapingRun.phase` in the DB and restart.

### Flownau render killed mid-process
Remotion renders are stateless — re-trigger from the dashboard. Previous partial output is overwritten safely.
