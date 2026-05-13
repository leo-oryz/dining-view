#!/usr/bin/env bash
# Uploads the download-agent secrets from .env.local into GitHub Actions
# for this repository. Safe to re-run — gh secret set overwrites.
#
# Prerequisites: `gh auth status` shows you are logged in.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "Error: .env.local not found in $(pwd)" >&2
  exit 1
fi

read_env_var() {
  local key="$1"
  # Values are single-line in .env.local (private key uses \n escapes).
  awk -v k="$key" -F= '$1==k { sub("^"k"=",""); print; exit }' .env.local
}

set_secret() {
  local key="$1"
  local value="$2"
  if [ -z "$value" ]; then
    echo "⚠️  Skipping $key (empty value in .env.local)"
    return
  fi
  printf '%s' "$value" | gh secret set "$key"
  echo "✅ $key set"
}

# Core: read by the iPOS Playwright agent + all sync scripts to talk to Supabase.
NEXT_PUBLIC_SUPABASE_URL="$(read_env_var NEXT_PUBLIC_SUPABASE_URL)"
SUPABASE_SERVICE_ROLE_KEY="$(read_env_var SUPABASE_SERVICE_ROLE_KEY)"

# Optional: needed by anomaly-detect curl step + non-iPOS sync jobs.
AGENT_UPLOAD_BASE_URL="$(read_env_var AGENT_UPLOAD_BASE_URL)"
GOOGLE_SERVICE_ACCOUNT_EMAIL="$(read_env_var GOOGLE_SERVICE_ACCOUNT_EMAIL)"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="$(read_env_var GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)"
GA4_PROPERTY_ID="$(read_env_var GA4_PROPERTY_ID)"
GSC_SITE_URL="$(read_env_var GSC_SITE_URL)"
APIFY_API_TOKEN="$(read_env_var APIFY_API_TOKEN)"
APIFY_ACTOR_ID="$(read_env_var APIFY_ACTOR_ID)"

set_secret NEXT_PUBLIC_SUPABASE_URL           "$NEXT_PUBLIC_SUPABASE_URL"
set_secret SUPABASE_SERVICE_ROLE_KEY          "$SUPABASE_SERVICE_ROLE_KEY"
set_secret AGENT_UPLOAD_BASE_URL              "$AGENT_UPLOAD_BASE_URL"
set_secret GOOGLE_SERVICE_ACCOUNT_EMAIL       "$GOOGLE_SERVICE_ACCOUNT_EMAIL"
set_secret GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY "$GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
set_secret GA4_PROPERTY_ID                    "$GA4_PROPERTY_ID"
set_secret GSC_SITE_URL                       "$GSC_SITE_URL"
set_secret APIFY_API_TOKEN                    "$APIFY_API_TOKEN"
set_secret APIFY_ACTOR_ID                     "$APIFY_ACTOR_ID"

echo ""
echo "Done. Verify with: gh secret list"
