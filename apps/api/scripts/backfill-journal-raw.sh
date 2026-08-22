#!/usr/bin/env bash
#
# Recovers `properties.raw` for journal entries that predate the field.
#
# Journal entries store the text the author's capture was reduced to. Until now
# there was no record on the entry of what was actually said — the untouched
# transcription lived only in Zazŭ's `Voicenote` table, in a different service
# and a different database. Every entry created from a voice note carries the
# voicenote id in `properties.sourceBlockId`, which is what makes the two
# joinable.
#
# Cross-database, so this cannot be a Prisma migration: it reads from the zazu
# database and writes to the api one. It is idempotent — entries that already
# have `raw` are left alone — and it never overwrites, only fills.
#
# Usage, on the host running both containers:
#   ./backfill-journal-raw.sh          # report only
#   ./backfill-journal-raw.sh --apply  # write
set -euo pipefail

API_CONTAINER=${API_CONTAINER:-api-postgres}
ZAZU_CONTAINER=${ZAZU_CONTAINER:-zazu-postgres}
APPLY=${1:-}

api_psql() { docker exec -i "$API_CONTAINER" psql -U nau_api -d nau_api -v ON_ERROR_STOP=1 "$@"; }
zazu_psql() { docker exec -i "$ZAZU_CONTAINER" psql -U zazu -d zazu -v ON_ERROR_STOP=1 "$@"; }

echo "== Before =="
api_psql -c "
  SELECT count(*) AS entries,
         count(*) FILTER (WHERE properties ? 'raw') AS with_raw,
         count(*) FILTER (WHERE properties ? 'sourceBlockId') AS joinable
  FROM \"Block\" WHERE type = 'journal_entry' AND \"deletedAt\" IS NULL;"

# The mapping, as literal UPDATEs. Generating SQL rather than streaming a
# temp table keeps this to two psql calls and leaves an auditable artefact.
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

zazu_psql -t -A -c "
  SELECT format(
    'UPDATE \"Block\" SET properties = properties || jsonb_build_object(''raw'', %L) WHERE type = ''journal_entry'' AND \"deletedAt\" IS NULL AND NOT (properties ? ''raw'') AND properties->>''sourceBlockId'' = %L;',
    \"rawTranscription\", id)
  FROM \"Voicenote\"
  WHERE \"rawTranscription\" IS NOT NULL AND \"rawTranscription\" <> '';" > "$TMP"

echo "== Generated $(grep -c . "$TMP") update statements from Zazŭ voicenotes =="

if [ "$APPLY" != "--apply" ]; then
  echo "Dry run. Re-run with --apply to write."
  exit 0
fi

api_psql -1 -f /dev/stdin < "$TMP"

echo "== After =="
api_psql -c "
  SELECT count(*) AS entries,
         count(*) FILTER (WHERE properties ? 'raw') AS with_raw,
         count(*) FILTER (WHERE properties->>'raw' = properties->>'summary') AS raw_equals_clean
  FROM \"Block\" WHERE type = 'journal_entry' AND \"deletedAt\" IS NULL;"
