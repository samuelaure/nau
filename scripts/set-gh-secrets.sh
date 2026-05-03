#!/usr/bin/env bash
# Sets all GitHub Actions secrets required for CI/CD.
#
# Prerequisites:
#   1. gh CLI authenticated: gh auth login
#   2. Each app's .env.production file filled in locally:
#        apps/<service>/.env.production
#
# Windows safety: tr -d '\r' strips CRLF before sending — GitHub stores
# the secret as-is and the deploy job writes it to disk on Linux. Any \r
# left in a secret becomes a literal character in the env file on the server,
# breaking variable parsing. Always strip before setting.
#
# Usage: bash scripts/set-gh-secrets.sh

set -euo pipefail

REPO="samuelaure/nau"

# Helper: read file, strip \r, pipe body to gh secret set
set_secret_from_file() {
  local name="$1"
  local file="$2"

  if [[ ! -f "$file" ]]; then
    echo "⚠  SKIP $name — $file not found. Create it first."
    return
  fi

  # tr -d '\r' ensures LF-only content regardless of Windows CRLF
  gh secret set "$name" --repo "$REPO" --body "$(tr -d '\r' < "$file")"
  echo "✓  $name"
}

set_secret_value() {
  local name="$1"
  local value="$2"
  gh secret set "$name" --repo "$REPO" --body "$value"
  echo "✓  $name"
}

echo "Setting deployment secrets..."

# SSH credentials — host is not sensitive but kept with secrets for consistency
set_secret_value "DEPLOY_SSH_HOST" "46.62.252.13"
set_secret_from_file "DEPLOY_SSH_KEY" "$HOME/.ssh/nau_hetzner"

echo ""
echo "Setting per-service env files..."

set_secret_from_file "ROOT_ENV_FILE"           ".env.production"
set_secret_from_file "API_ENV_FILE"            "apps/api/.env.production"
set_secret_from_file "ACCOUNTS_ENV_FILE"       "apps/accounts/.env.production"
set_secret_from_file "APP_ENV_FILE"            "apps/app/.env.production"
set_secret_from_file "FLOWNAU_ENV_FILE"        "apps/flownau/.env.production"
set_secret_from_file "NAUTHENTICITY_ENV_FILE"  "apps/nauthenticity/.env.production"
set_secret_from_file "ZAZU_BOT_ENV_FILE"       "apps/zazu-bot/.env.production"
set_secret_from_file "ZAZU_DASHBOARD_ENV_FILE" "apps/zazu-dashboard/.env.production"
set_secret_from_file "WHATSNAU_ENV_FILE"       "apps/whatsnau/.env.production"

echo ""
echo "Done. Verify at: https://github.com/$REPO/settings/secrets/actions"
