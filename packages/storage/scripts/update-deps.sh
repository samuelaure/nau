#!/usr/bin/env bash
# Run this script after publishing nau-storage to npm.
# It replaces the file: references with the published npm version.
#
# Usage: bash packages/storage/scripts/update-deps.sh

set -e

VERSION=$(node -p "require('./packages/storage/package.json').version")
echo "Updating apps to nau-storage@$VERSION"

APPS=(
  "flownau/package.json"
  "nauthenticity/package.json"
  "9nau/apps/api/package.json"
)

ROOT=$(cd "$(dirname "$0")/../../.." && pwd)

for app in "${APPS[@]}"; do
  file="$ROOT/$app"
  if [ -f "$file" ]; then
    sed -i "s|\"nau-storage\": \"file:[^\"]*\"|\"nau-storage\": \"^$VERSION\"|g" "$file"
    echo "  Updated $app"
  fi
done

echo ""
echo "Done. Run 'npm install' (or 'pnpm install') in each app to pull from npm."
