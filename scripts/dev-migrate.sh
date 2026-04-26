#!/usr/bin/env bash
# Run Prisma migrations for apps whose Docker postgres ports are intercepted
# by the local Windows PostgreSQL service (see docker-compose.dev.yml for context).
#
# Usage: bash scripts/dev-migrate.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

apply_migration() {
  local service="$1"       # docker container name (e.g. dev-flownau-postgres)
  local user="$2"          # postgres user
  local db="$3"            # postgres db name
  local migrations_dir="$4" # absolute path to migrations directory

  echo "▶ Applying migrations for $db via $service..."

  for migration_dir in "$migrations_dir"/*/; do
    migration_name="$(basename "$migration_dir")"
    sql_file="$migration_dir/migration.sql"

    if [[ ! -f "$sql_file" ]]; then continue; fi

    # Check if already applied
    already=$(docker exec "$service" psql -U "$user" -d "$db" -tAc \
      "SELECT 1 FROM _prisma_migrations WHERE migration_name='$migration_name' LIMIT 1;" 2>/dev/null || echo "")

    if [[ "$already" == "1" ]]; then
      echo "  ✓ $migration_name (already applied)"
      continue
    fi

    echo "  → Applying $migration_name..."
    docker exec -i "$service" psql -U "$user" -d "$db" < "$sql_file"

    # Ensure _prisma_migrations table exists, then record
    docker exec "$service" psql -U "$user" -d "$db" -c "
      CREATE TABLE IF NOT EXISTS _prisma_migrations (
        id VARCHAR(36) PRIMARY KEY,
        checksum VARCHAR(64) NOT NULL,
        finished_at TIMESTAMPTZ,
        migration_name VARCHAR(255) NOT NULL,
        logs TEXT,
        rolled_back_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        applied_steps_count INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count)
      VALUES (gen_random_uuid()::text, 'manual-apply', now(), '$migration_name', 1)
      ON CONFLICT (migration_name) DO NOTHING;" 2>/dev/null || true

    echo "  ✓ $migration_name applied"
  done
}

# flownau — port 5433 is Docker-only, must use docker exec
apply_migration \
  "dev-flownau-postgres" "flownau" "flownau" \
  "$ROOT/apps/flownau/prisma/migrations"

# whatsnau — port 5436 is Docker-only, must use docker exec
apply_migration \
  "dev-whatsnau-postgres" "whatsnau" "whatsnau" \
  "$ROOT/apps/whatsnau/packages/backend/prisma/migrations"

echo ""
echo "✅ All Docker-only migrations complete."
