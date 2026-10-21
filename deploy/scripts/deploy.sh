#!/usr/bin/env bash
set -euo pipefail

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
compose_file="$root_dir/deploy/compose.yml"
state_dir="$root_dir/deploy/.state"
project_name="shop-$environment"
release_tag="$(git -C "$root_dir" rev-parse --short=12 HEAD)"

if [[ ! -f "$env_file" ]]; then
  echo "Missing deployment settings: $env_file" >&2
  echo "Copy deploy/.env.$environment.example and configure it first." >&2
  exit 1
fi

if [[ -n "$(git -C "$root_dir" status --porcelain)" ]]; then
  echo "Refusing to deploy with uncommitted changes." >&2
  exit 1
fi

mkdir -p "$state_dir"
current_file="$state_dir/$environment.current"
previous_file="$state_dir/$environment.previous"
old_release=""
if [[ -f "$current_file" ]]; then
  old_release="$(<"$current_file")"
fi

compose() {
  RELEASE_TAG="$release_tag" docker compose \
    --project-name "$project_name" \
    --env-file "$env_file" \
    -f "$compose_file" "$@"
}

echo "Building release $release_tag for $environment..."
compose build api web migrator

if compose ps --status running database | grep -q database; then
  "$root_dir/deploy/scripts/backup.sh" "$environment"
else
  echo "Database container is not running; starting database before backup."
  compose up -d database
  for attempt in {1..30}; do
    if compose exec -T database sh -ec \
      'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null; then
      break
    fi
    if [[ "$attempt" == 30 ]]; then
      echo "Database did not become ready; aborting deployment." >&2
      exit 1
    fi
    sleep 2
  done
  "$root_dir/deploy/scripts/backup.sh" "$environment"
fi

if ! compose run --rm migrator; then
  echo "Database migration failed; current application release was not changed." >&2
  exit 1
fi

rollback_application() {
  if [[ -z "$old_release" ]]; then
    echo "No previous application release is available for rollback." >&2
    return 1
  fi
  echo "Health check failed; restoring application release $old_release." >&2
  RELEASE_TAG="$old_release" docker compose \
    --project-name "$project_name" \
    --env-file "$env_file" \
    -f "$compose_file" up -d --no-build api web caddy
  exit 1
}

compose up -d --no-build api web caddy

for attempt in {1..30}; do
  if compose ps --status running api web caddy | grep -q caddy \
    && compose exec -T api node -e \
      "fetch('http://127.0.0.1:4000/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" \
    && compose exec -T web node -e \
      "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
    printf '%s\n' "$release_tag" >"$current_file.tmp"
    if [[ -n "$old_release" ]]; then
      printf '%s\n' "$old_release" >"$previous_file.tmp"
      mv "$previous_file.tmp" "$previous_file"
    fi
    mv "$current_file.tmp" "$current_file"
    echo "Release $release_tag deployed successfully to $environment."
    exit 0
  fi
  sleep 2
done

rollback_application
