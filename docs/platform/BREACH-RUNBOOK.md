# Security Breach Response Runbook

## Severity levels

| Level | Description | Response time |
|---|---|---|
| P0 | Active exploit, data exfiltration in progress | Immediate |
| P1 | Credential exposure, unauthorized access confirmed | < 1 hour |
| P2 | Suspected breach, anomalous access patterns | < 4 hours |
| P3 | Vulnerability discovered, no active exploitation | < 24 hours |

---

## P0 / P1 — Immediate response

### 1. Isolate

```bash
# Take affected service offline
ssh nau
cd ~/apps/<service>
docker compose stop

# Revoke all active sessions (api database)
docker exec api-db psql -U postgres -d api -c "DELETE FROM \"Session\";"
```

### 2. Rotate all secrets

Rotate in this order — any one exposure can cascade:

1. `AUTH_SECRET` — shared JWT signing key across all services
2. `OPENAI_API_KEY` — revoke in OpenAI dashboard, generate new
3. `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — rotate in Cloudflare
4. `APIFY_TOKEN` — rotate in Apify dashboard
5. Database passwords (`DATABASE_PASSWORD` per service)
6. Redis passwords (`REDIS_PASSWORD` per service)
7. Telegram bot token — revoke via @BotFather

After rotation, update every `.env.production` file and re-run:
```bash
bash scripts/set-gh-secrets.sh
```

Then redeploy all services:
```bash
ssh nau
for svc in api accounts app flownau nauthenticity zazu-bot zazu-dashboard; do
  cd ~/apps/$svc && docker compose pull && docker compose up -d
done
```

### 3. Preserve evidence

```bash
# Before taking anything offline, capture logs
ssh nau "docker logs api --since 24h > /tmp/api-$(date +%Y%m%d%H%M%S).log"
ssh nau "docker logs nauthenticity --since 24h > /tmp/nauthenticity-$(date +%Y%m%d%H%M%S).log"
# Copy off server
scp nau:/tmp/*.log ./incident-evidence/
```

---

## P2 — Investigation

### Check for anomalous patterns

```bash
# Unusual auth activity
ssh nau "docker logs api --since 2h | grep -i 'login\|unauthorized\|forbidden'"

# High usage spikes (potential token abuse)
ssh nau "docker logs nauthenticity --since 2h | grep -i 'openai\|apify'"

# Check active sessions count
docker exec api-db psql -U postgres -d api -c "SELECT COUNT(*) FROM \"Session\";"
```

### Check infrastructure

```bash
# Look for unexpected processes
ssh nau "ps aux | grep -v expected"

# Check for unexpected network connections
ssh nau "ss -tulnp"

# Check Traefik access logs for unusual patterns
ssh nau "docker logs nau-gateway --since 2h | grep -v '200'"
```

---

## GDPR notification obligations

Under GDPR Article 33, data breaches involving personal data must be reported to the supervisory authority **within 72 hours** of becoming aware.

**What counts as personal data in naŭ Platform:**
- User email addresses
- Instagram OAuth tokens (if stored)
- Brand/workspace data linked to identifiable persons
- Usage logs containing userId

**Steps if personal data was exposed:**
1. Document: what data, whose data, how many records, time window
2. Assess risk: likely consequences to data subjects
3. Notify supervisory authority within 72 hours (if high risk)
4. If high risk to individuals: notify affected users directly (Article 34)
5. Log the incident in the internal breach register

---

## Post-incident

1. Write an internal incident report (what happened, root cause, timeline)
2. File in `docs/incidents/YYYY-MM-DD-<summary>.md`
3. Add to audit log in [AUDIT-PLAN.md](../AUDIT-PLAN.md)
4. Implement preventive measures
5. Review and update this runbook if the response revealed gaps
