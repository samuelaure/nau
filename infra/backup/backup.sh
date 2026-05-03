#!/bin/sh
set -e

DATE=$(date +%Y-%m-%d)
BUCKET="s3:${R2_BUCKET_NAME}"

echo "[backup] Starting nau platform backup — ${DATE}"

dump_db() {
  local name="$1"
  local host="$2"
  local user="$3"
  local db="$4"
  local pass="$5"
  local file="/tmp/${name}-${DATE}.sql.gz"

  echo "[backup] Dumping ${name}..."
  PGPASSWORD="$pass" pg_dump -h "$host" -U "$user" -d "$db" --no-owner --no-privileges \
    | gzip > "$file"

  echo "[backup] Uploading ${name}..."
  rclone copy "$file" "${BUCKET}/${name}/" \
    --s3-provider=Cloudflare \
    --s3-access-key-id="${R2_ACCESS_KEY_ID}" \
    --s3-secret-access-key="${R2_SECRET_ACCESS_KEY}" \
    --s3-endpoint="${R2_ENDPOINT}" \
    --s3-no-check-bucket

  rm -f "$file"
  echo "[backup] ${name} done."
}

dump_db "api"           "api-postgres"           "nau_api"        "nau_api"        "$API_DB_PASSWORD"
dump_db "flownau"       "flownau-postgres"       "flownau"        "flownau"        "$FLOWNAU_DB_PASSWORD"
dump_db "nauthenticity" "nauthenticity-postgres" "nauthenticity"  "nauthenticity"  "$NAUTHENTICITY_DB_PASSWORD"
dump_db "zazu"          "zazu-postgres"          "zazu"           "zazu"           "$ZAZU_DB_PASSWORD"
dump_db "whatsnau"      "whatsnau-postgres"      "whatsnau"       "whatsnau"       "$WHATSNAU_DB_PASSWORD"

# Prune backups older than 30 days
echo "[backup] Pruning old backups..."
for db in api flownau nauthenticity zazu whatsnau; do
  rclone delete "${BUCKET}/${db}/" \
    --min-age 30d \
    --s3-provider=Cloudflare \
    --s3-access-key-id="${R2_ACCESS_KEY_ID}" \
    --s3-secret-access-key="${R2_SECRET_ACCESS_KEY}" \
    --s3-endpoint="${R2_ENDPOINT}" \
    --s3-no-check-bucket
done

echo "[backup] All done."
