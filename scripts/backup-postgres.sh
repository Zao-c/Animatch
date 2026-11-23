#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-backups}"

cd "$ROOT_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy .env.production.example and fill production values first." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

timestamp="$(date +%Y%m%d-%H%M%S)"
output_path="$BACKUP_DIR/animatch-${timestamp}.sql.gz"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  | gzip -c > "$output_path"

echo "Backup written to $output_path"
