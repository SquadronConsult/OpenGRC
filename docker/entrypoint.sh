#!/usr/bin/env bash
set -euo pipefail

# Start PostgreSQL (official image entrypoint initializes data dir on first run).
/usr/local/bin/docker-entrypoint.sh postgres &
PG_PID=$!

PGHOST="${DB_HOST:-127.0.0.1}"
PGPORT="${DB_PORT:-5432}"
PGUSER="${POSTGRES_USER:-grc}"

for _ in $(seq 1 120); do
  if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

if [ -z "${AUTH_JWT_SECRET:-}" ]; then
  echo "WARN: AUTH_JWT_SECRET not set; using insecure dev default" >&2
  export AUTH_JWT_SECRET=dev-local-change-me-in-production
fi

cd /app/api
node dist/main.js &
API_PID=$!

API_PORT="${PORT:-3000}"
for _ in $(seq 1 120); do
  if curl -sf "http://127.0.0.1:${API_PORT}/health" >/dev/null; then
    break
  fi
  sleep 0.25
done

cd /app/web
PORT=3001 HOSTNAME=0.0.0.0 node node_modules/.bin/next start -p 3001 &
WEB_PID=$!

term() {
  kill "$WEB_PID" "$API_PID" "$PG_PID" 2>/dev/null || true
}
trap term SIGTERM SIGINT

wait
