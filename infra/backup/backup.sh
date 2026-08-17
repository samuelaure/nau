#!/bin/sh
# Nightly backup of every Postgres database on the host.
#
# Ordering matters and is deliberate: dump everything, then upload everything,
# then verify, and only delete a local dump once its upload is confirmed. The
# previous version uploaded and deleted per database under `set -e`, so the first
# failed upload aborted the whole run — for months only `api` was ever dumped,
# and nothing said so.
#
# Failure of one database must not stop the others, and any failure must be
# loud. Local copies are retained regardless of upload success, so a dead R2
# credential degrades the backup instead of eliminating it.

DATE=$(date -u +%Y-%m-%d)
STAGING="/backups/${DATE}"
LOCAL_RETENTION_DAYS=7
REMOTE_RETENTION_DAYS=30

BUCKET=":s3:${R2_BUCKET_NAME}/backups"
RCLONE_FLAGS="--s3-provider=Cloudflare \
  --s3-access-key-id=${R2_ACCESS_KEY_ID} \
  --s3-secret-access-key=${R2_SECRET_ACCESS_KEY} \
  --s3-endpoint=${R2_ENDPOINT} \
  --s3-no-check-bucket \
  --log-level ERROR"

mkdir -p "$STAGING"

FAILURES=""
DUMPED=""
UPLOADED=""

log()  { echo "[backup] $*"; }
fail() { log "FAIL — $1: $2"; FAILURES="${FAILURES}\n  - $1: $2"; }

# name | host | user | db | password
DATABASES="
api|api-postgres|nau_api|nau_api|${API_DB_PASSWORD}
flownau|flownau-postgres|flownau|flownau|${FLOWNAU_DB_PASSWORD}
nauthenticity|nauthenticity-postgres|nauthenticity|nauthenticity|${NAUTHENTICITY_DB_PASSWORD}
zazu|zazu-postgres|zazu|zazu|${ZAZU_DB_PASSWORD}
connect|connect-postgres|connect|connect|${CONNECT_DB_PASSWORD}
violeta_listmonk|violeta-listmonk-postgres|listmonk|listmonk|${VIOLETA_LISTMONK_DB_PASSWORD}
karenexplora_freescout|karenexplora-freescout-db|freescout|freescout|${FREESCOUT_DB_PASSWORD}
"

log "Starting backup — ${DATE}"

# ── Phase 1: dump everything ─────────────────────────────────────────────────
# A host that is down is skipped, not treated as a failure: services are
# intentionally stopped sometimes and that should not page anyone.
for entry in $DATABASES; do
  [ -z "$entry" ] && continue
  name=$(echo "$entry" | cut -d'|' -f1)
  host=$(echo "$entry" | cut -d'|' -f2)
  user=$(echo "$entry" | cut -d'|' -f3)
  db=$(echo   "$entry" | cut -d'|' -f4)
  pass=$(echo "$entry" | cut -d'|' -f5)

  if ! pg_isready -h "$host" -U "$user" -t 5 >/dev/null 2>&1; then
    log "skip ${name} — ${host} not accepting connections"
    continue
  fi

  file="${STAGING}/${name}.sql.gz"
  if PGPASSWORD="$pass" pg_dump -h "$host" -U "$user" -d "$db" \
       --no-owner --no-privileges 2>/dev/null | gzip > "$file"; then
    # A dump that produced an unreadable or empty archive is a failure even
    # though pg_dump exited zero.
    if gzip -t "$file" 2>/dev/null && [ -s "$file" ]; then
      DUMPED="${DUMPED} ${name}"
      log "dumped ${name} ($(du -h "$file" | cut -f1))"
    else
      fail "$name" "dump produced an invalid or empty archive"
      rm -f "$file"
    fi
  else
    fail "$name" "pg_dump failed"
    rm -f "$file"
  fi
done

# ── Phase 2: upload everything ───────────────────────────────────────────────
for name in $DUMPED; do
  file="${STAGING}/${name}.sql.gz"
  if rclone copyto "$file" "${BUCKET}/${name}/${name}-${DATE}.sql.gz" $RCLONE_FLAGS 2>&1; then
    UPLOADED="${UPLOADED} ${name}"
  else
    fail "$name" "upload to R2 failed"
  fi
done

# ── Phase 3: verify what was uploaded actually landed ────────────────────────
# rclone copy exiting zero is not proof the object is readable at the far end.
VERIFIED=""
for name in $UPLOADED; do
  enc="${STAGING}/${name}.sql.gz.age"
  local_size=$(stat -c %s "$enc" 2>/dev/null)
  remote_size=$(rclone size "${BUCKET}/${name}/${name}-${DATE}.sql.gz.age" \
                  --json $RCLONE_FLAGS 2>/dev/null \
                | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p')

  if [ -n "$remote_size" ] && [ "$local_size" = "$remote_size" ]; then
    VERIFIED="${VERIFIED} ${name}"
  else
    fail "$name" "verification failed (local ${local_size}B, remote ${remote_size:-absent})"
  fi
done

# ── Phase 4: retention ───────────────────────────────────────────────────────
# Local dumps are kept for a week whether or not the upload worked, so a broken
# remote leaves a usable copy behind instead of nothing.
find /backups -maxdepth 1 -type d -name '20*' -mtime "+${LOCAL_RETENTION_DAYS}" \
  -exec rm -rf {} + 2>/dev/null

# Remote pruning only runs when everything verified. Deleting old backups on a
# run that failed to produce new ones is how a bad night becomes a lost archive.
if [ -z "$FAILURES" ] && [ -n "$VERIFIED" ]; then
  for name in $VERIFIED; do
    rclone delete "${BUCKET}/${name}/" --min-age "${REMOTE_RETENTION_DAYS}d" $RCLONE_FLAGS 2>/dev/null
  done
else
  log "skipping remote prune — this run had failures"
fi

# ── Phase 5: report ──────────────────────────────────────────────────────────
count_of() { echo "$1" | wc -w | tr -d ' '; }

SUMMARY="dumped $(count_of "$DUMPED"), uploaded $(count_of "$UPLOADED"), verified $(count_of "$VERIFIED")"
log "$SUMMARY"

if [ -n "$FAILURES" ]; then
  MESSAGE="🔴 Backup FAILED — ${DATE}
${SUMMARY}
Failures:$(printf "%b" "$FAILURES")"
  log "run finished WITH FAILURES"
else
  MESSAGE="✅ Backup OK — ${DATE}
${SUMMARY}"
  log "run finished clean"
fi

# Alerting goes straight to Telegram rather than through the platform: an alert
# path that depends on the system being backed up is not an alert path.
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$ADMIN_TELEGRAM_ID" ]; then
  if [ -n "$FAILURES" ] || [ "$BACKUP_NOTIFY_ON_SUCCESS" = "true" ]; then
    curl -sS -m 20 -o /dev/null \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${ADMIN_TELEGRAM_ID}" \
      --data-urlencode "text=${MESSAGE}" \
      || log "WARNING: could not send Telegram alert"
  fi
else
  log "WARNING: TELEGRAM_BOT_TOKEN / ADMIN_TELEGRAM_ID unset — failures will be silent"
fi

# Status file for the healthcheck, so a stale or failing job is visible without
# reading logs.
if [ -n "$FAILURES" ]; then
  echo "FAILED ${DATE}" > /backups/LAST_RUN
  exit 1
fi

echo "OK ${DATE}" > /backups/LAST_RUN
