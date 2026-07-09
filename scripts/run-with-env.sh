#!/usr/bin/env bash
# Load root .env (handles values with spaces in quotes-free SMTP_FROM, etc.)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi
exec "$@"
