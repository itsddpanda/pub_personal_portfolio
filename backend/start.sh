#!/bin/bash
set -euo pipefail

log() {
  local level="$1"
  local stage="$2"
  shift 2
  printf '[%s] [%s] [%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$level" "$stage" "$*"
}

fail() {
  local stage="$1"
  shift
  log "ERROR" "$stage" "$*"
  exit 1
}

require_bin() {
  local bin="$1"
  command -v "$bin" >/dev/null 2>&1 || fail "preflight" "Missing required binary: '$bin'. Add it to the container image and retry."
}

require_file() {
  local file="$1"
  [[ -f "$file" ]] || fail "preflight" "Missing required file: '$file'. Verify image build context and mounted volumes."
}

require_env() {
  local var="$1"
  [[ -n "${!var:-}" ]] || fail "preflight" "Missing required environment variable: $var. Set it in backend/.env or compose env_file."
}

run_step() {
  local stage="$1"
  shift
  log "INFO" "$stage" "Starting"
  if "$@"; then
    log "INFO" "$stage" "Completed"
  else
    fail "$stage" "Failed while executing: $*"
  fi
}

init_db() {
  /usr/local/bin/python -c "from app.db.engine import create_db_and_tables; create_db_and_tables()"
  sqlite3 /data/mfa.db "PRAGMA journal_mode=WAL;"
}

sync_nav() {
  /usr/local/bin/python /app/scripts/sync_amfi.py
}

generate_map() {
  /usr/local/bin/python -c "from app.utils.master_data import generate_isin_map; generate_isin_map()"
}

start_cron() {
  service cron start

  # Export environment variables for cron, following Debian best practices.
  printenv | grep -v "no_proxy" | grep -vE "^(LANG|LC_|LANGUAGE)" >> /etc/environment
  echo "LANG=C.UTF-8" > /etc/default/locale
  echo "LC_ALL=C.UTF-8" >> /etc/default/locale
}

log "INFO" "preflight" "Running startup preflight checks"
for b in service python sqlite3 uvicorn; do
  require_bin "$b"
done

require_file "/app/main.py"
require_file "/app/scripts/sync_amfi.py"
require_env "DATABASE_URL"
require_env "CORS_ORIGINS"

UVICORN_WORKERS="${UVICORN_WORKERS:-2}"
if ! [[ "$UVICORN_WORKERS" =~ ^[1-9][0-9]*$ ]]; then
  fail "preflight" "UVICORN_WORKERS must be a positive integer (received: '$UVICORN_WORKERS')."
fi

run_step "cron" start_cron
run_step "db_init" init_db
run_step "nav_sync" sync_nav
run_step "map_generation" generate_map

log "INFO" "app_boot" "Starting uvicorn on 0.0.0.0:8001 with workers=$UVICORN_WORKERS"
exec uvicorn main:app --host 0.0.0.0 --port 8001 --workers "$UVICORN_WORKERS"
