#!/usr/bin/env bash
# Creates the nau-network Docker bridge network if it doesn't exist.
# Run once before starting any service. Safe to re-run.
set -euo pipefail

NETWORK="nau-network"

if docker network inspect "$NETWORK" &>/dev/null; then
  echo "✓ $NETWORK already exists"
else
  docker network create "$NETWORK"
  echo "✓ $NETWORK created"
fi
