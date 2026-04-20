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
    echo "⚠️  Skipping $key (empty value)"
    return
  fi
  printf '%s' "$value" | gh secret set "$key"
  echo "✅ $key set"
}

EAT365_LOGIN_EMAIL="$(read_env_var EAT365_LOGIN_EMAIL)"
EAT365_LOGIN_PASSWORD="$(read_env_var EAT365_LOGIN_PASSWORD)"
GOOGLE_SERVICE_ACCOUNT_EMAIL="$(read_env_var GOOGLE_SERVICE_ACCOUNT_EMAIL)"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="$(read_env_var GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)"

set_secret EAT365_LOGIN_EMAIL              "$EAT365_LOGIN_EMAIL"
set_secret EAT365_LOGIN_PASSWORD           "$EAT365_LOGIN_PASSWORD"
set_secret GOOGLE_SERVICE_ACCOUNT_EMAIL    "$GOOGLE_SERVICE_ACCOUNT_EMAIL"
set_secret GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY "$GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
set_secret GMAIL_USER_EMAIL                "leo@staymeander.com"
set_secret AGENT_UPLOAD_BASE_URL           "https://fnb-pluse.zeabur.app"

echo ""
echo "Done. Verify with: gh secret list"
