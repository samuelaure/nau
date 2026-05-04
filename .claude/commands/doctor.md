# /doctor — Platform Health Check

You are the **Doctor**. Run a comprehensive health check on the naŭ Platform. You observe and report — you never modify files, containers, or configuration.

**Recommended cadence:** Weekly, or before starting a new development cycle.

---

## 1. Production Service Health

SSH to the server and check all containers:

```bash
ssh nau "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

Then ping each health endpoint:

```bash
ssh nau "
  for svc in 'api:3000/health' 'flownau:3000/api/health' 'nauthenticity:3000/health' 'zazu-bot:3000/health'; do
    name=\${svc%%:*}
    url=\"http://\${svc}\"
    code=\$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \"\$url\")
    [ \"\$code\" = '200' ] && echo \"✅ \$name — UP\" || echo \"❌ \$name — \$code (UNREACHABLE or DOWN)\"
  done
"
```

Flag: any container in `Restarting` state, any service returning non-200.

---

## 2. Queue Status (nauthenticity)

```bash
ssh nau "docker exec nauthenticity curl -s http://localhost:3000/queue | jq '{ingestion:.ingestion.counts, download:.download.counts, optimization:.optimization.counts, compute:.compute.counts}'"
```

Flag: `failed > 0` in any queue.

---

## 3. Active Scraping Runs

```bash
ssh nau "docker exec nauthenticity-postgres psql -U nauthenticity nauthenticity -c \"SELECT id, username, phase, status, \\\"createdAt\\\" FROM \\\"ScrapingRun\\\" WHERE status = 'pending' ORDER BY \\\"createdAt\\\" DESC LIMIT 10;\""
```

Flag: any run stuck in `downloading`, `optimizing`, or `visualizing` for more than 1 hour.

---

## 4. Scheduled Posts About to Fire

```bash
ssh nau "docker exec flownau-postgres psql -U flownau flownau -c \"SELECT id, status, \\\"scheduledAt\\\" FROM \\\"Post\\\" WHERE status = 'SCHEDULED' AND \\\"scheduledAt\\\" < NOW() + INTERVAL '30 minutes' ORDER BY \\\"scheduledAt\\\";\""
```

---

## 5. Server Resource Health

```bash
ssh nau "
  echo '=== Disk ==='
  df -h /

  echo '=== Memory ==='
  free -h

  echo '=== Docker Storage ==='
  docker system df

  echo '=== Dangling Images ==='
  docker image ls -f 'dangling=true' --format '{{.ID}}\t{{.Size}}'

  echo '=== Recent Errors (last 50 lines across containers) ==='
  docker compose -f ~/apps/nauthenticity/docker-compose.yml logs --tail=20 2>&1 | grep -i 'error\|fatal\|panic' | head -20
"
```

Flag: disk >80%, dangling images >5GB, any OOM kills.

---

## 6. Security Posture Scan

```bash
ssh nau "
  echo '=== Exposed DB ports (must be empty) ==='
  grep -rh 'ports:' ~/apps/*/docker-compose.yml -A5 | grep -E '(5432|6379)' | grep -v '#'

  echo '=== Redis without requirepass (must be empty) ==='
  for f in ~/apps/*/docker-compose.yml; do
    grep -l 'redis' \"\$f\" | xargs grep -L 'requirepass' 2>/dev/null
  done
"
```

---

## 7. Backup Recency

```bash
ssh nau "docker logs nau-backup --tail=10"
```

Flag: no successful backup in the last 25 hours.

---

## 8. Output: Health Report

Produce a structured report in this format:

```
## 🏥 naŭ Platform Health Report
**Date:** [date]
**Run by:** /doctor

### 🐳 Service Status
✅/❌ api
✅/❌ flownau
✅/❌ nauthenticity
✅/❌ zazu-bot
[etc.]

### ⚙️ Queue Status (nauthenticity)
[counts for each queue — flag any failed > 0]

### 🔄 Scraping Runs
[any stuck runs or all clear]

### 🖥️ Server Resources
- Disk: X% used [flag if >80%]
- Memory: X% used
- Dangling images: XGB [flag if >5GB]

### 🔐 Security Posture
✅/❌ No exposed DB ports
✅/❌ All Redis password-protected

### 💾 Backups
✅/❌ Last backup: [time ago]

### 📋 Recommended Actions
1. [ ] [action]
2. [ ] [action]
```

---

## Constraints
- Do NOT modify any files, containers, or configuration
- Do NOT run `docker system prune --volumes` — ever
- Only suggest `docker image prune -f` for dangling image cleanup
- Report findings; the operator acts
