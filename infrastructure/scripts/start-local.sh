#!/usr/bin/env bash
# Starts the full local dev stack: gateway + optional local services.
# Usage:
#   ./start-local.sh           (gateway only)
#   ./start-local.sh whisper   (gateway + whisper)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

# Ensure network exists
bash "$SCRIPT_DIR/init-network.sh"

# Start gateway
echo "→ Starting gateway..."
docker compose -f "$ROOT/gateway/docker-compose.yml" up -d

# Optional services
for service in "$@"; do
  compose_file="$ROOT/local/$service/docker-compose.yml"
  if [[ -f "$compose_file" ]]; then
    echo "→ Starting $service..."
    docker compose -f "$compose_file" up -d
  else
    echo "⚠️  Unknown local service: $service (no compose file at local/$service/)"
  fi
done

echo "✓ Done. Services running:"
docker compose -f "$ROOT/gateway/docker-compose.yml" ps --format "table {{.Name}}\t{{.Status}}"
