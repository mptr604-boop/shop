#!/usr/bin/env bash
set -euo pipefail
umask 077

environment="${1:-}"
case "$environment" in
  staging|production) ;;
  *)
    echo "Usage: $0 staging|production" >&2
    exit 2
    ;;
esac

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="$root_dir/deploy/.env.$environment"
state_dir="$root_dir/deploy/backups/$environment"
compose_file="$root_dir/deploy/compose.yml"

if [[ ! -f "$env_file" ]]; then
  echo "Missing deployment settings: $env_file" >&2
  exit 1
fi

mkdir -p "$state_dir"
backup_file="$state_dir/$(date -u +%Y%m%dT%H%M%SZ).dump"
project_name="shop-$environment"

if ! docker compose --project-name "$project_name" --env-file "$env_file" \
  -f "$compose_file" exec -T database sh -ec \
  'pg_dump --format=custom --username "$POSTGRES_USER" "$POSTGRES_DB"' \
  >"$backup_file"; then
  rm -f "$backup_file"
  echo "Database backup failed." >&2
  exit 1
fi

find "$state_dir" -type f -name '*.dump' -mtime +14 -delete
echo "Database backup saved: $backup_file"
