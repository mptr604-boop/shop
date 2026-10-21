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
current_file="$state_dir/$environment.current"
previous_file="$state_dir/$environment.previous"
project_name="shop-$environment"

if [[ ! -f "$env_file" || ! -f "$previous_file" || ! -f "$current_file" ]]; then
  echo "Deployment settings or rollback history are missing for $environment." >&2
  exit 1
fi

current_release="$(<"$current_file")"
previous_release="$(<"$previous_file")"
if [[ -z "$current_release" || -z "$previous_release" ]]; then
  echo "Deployment history contains an empty release tag." >&2
  exit 1
fi

compose() {
  RELEASE_TAG="$previous_release" docker compose \
    --project-name "$project_name" \
    --env-file "$env_file" \
    -f "$compose_file" "$@"
}

compose up -d --no-build api web caddy

for attempt in {1..30}; do
  if compose ps --status running api web caddy | grep -q caddy \
    && compose exec -T api node -e \
    "fetch('http://127.0.0.1:4000/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" \
    && compose exec -T web node -e \
      "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
    printf '%s\n' "$previous_release" >"$current_file.tmp"
    printf '%s\n' "$current_release" >"$previous_file.tmp"
    mv "$current_file.tmp" "$current_file"
    mv "$previous_file.tmp" "$previous_file"
    echo "Rolled $environment back to $previous_release."
    echo "Database schema/data was not rolled back."
    exit 0
  fi
  sleep 2
done

echo "Rollback release $previous_release failed its health checks." >&2
exit 1
