#!/usr/bin/env bash
set -euo pipefail

environment="${1:-}"
backup_name="${2:-}"
case "$environment" in
  staging|production) ;;
  *)
    echo "Usage: $0 staging|production BACKUP.dump" >&2
    exit 2
    ;;
esac

if [[ -z "$backup_name" || "$backup_name" == */* || "$backup_name" != *.dump ]]; then
  echo "Provide the name of a .dump file inside deploy/backups/$environment." >&2
  exit 2
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="$root_dir/deploy/.env.$environment"
backup_dir="$root_dir/deploy/backups/$environment"
backup_file="$backup_dir/$backup_name"
checksum_file="$backup_file.sha256"
compose_file="$root_dir/deploy/compose.yml"
project_name="shop-$environment"

if [[ ! -f "$env_file" ]]; then
  echo "Missing deployment settings: $env_file" >&2
  exit 1
fi
if [[ ! -f "$backup_file" || ! -f "$checksum_file" ]]; then
  echo "Backup or checksum file is missing: $backup_file" >&2
  exit 1
fi

expected_hash="$(awk 'NR == 1 { print $1 }' "$checksum_file")"
if [[ ! "$expected_hash" =~ ^[[:xdigit:]]{64}$ ]]; then
  echo "Backup checksum file is invalid: $checksum_file" >&2
  exit 1
fi
actual_hash="$(sha256sum "$backup_file" | awk '{ print $1 }')"
if [[ "$actual_hash" != "$expected_hash" ]]; then
  echo "Backup checksum does not match: $backup_file" >&2
  exit 1
fi

compose() {
  docker compose \
    --project-name "$project_name" \
    --env-file "$env_file" \
    -f "$compose_file" "$@"
}

if ! compose ps --status running database | grep -q database; then
  echo "Database container is not running; refusing to restore." >&2
  exit 1
fi

if ! compose exec -T database pg_restore --list <"$backup_file" >/dev/null; then
  echo "Backup archive validation failed." >&2
  exit 1
fi

if [[ ! -t 0 ]]; then
  echo "Restore requires an interactive terminal for its destructive confirmation." >&2
  exit 1
fi

printf 'This replaces the %s database. Type RESTORE %s to continue: ' \
  "$environment" "$environment" >&2
IFS= read -r confirmation
if [[ "$confirmation" != "RESTORE $environment" ]]; then
  echo "Restore cancelled." >&2
  exit 1
fi

restore_id="$(date -u +%Y%m%d%H%M%S)-$$"
restore_id="${restore_id//-/}"
restore_db="shop_restore_$restore_id"
old_db="shop_before_restore_$restore_id"
restore_copy=""
restore_database_created=0
services_stopped=0
database_switched=0

cleanup() {
  local result=$?
  trap - EXIT
  set +e

  if [[ -n "$restore_copy" ]]; then
    rm -f -- "$restore_copy"
  fi

  if [[ "$restore_database_created" == 1 && "$database_switched" != 1 ]]; then
    compose exec -T \
      -e "SHOP_RESTORE_DB=$restore_db" \
      database sh -ec '
        psql --username "$POSTGRES_USER" --dbname postgres \
          --set=ON_ERROR_STOP=1 --set=restore_db="$SHOP_RESTORE_DB" <<SQL
DROP DATABASE IF EXISTS :"restore_db";
SQL
      '
  fi

  if [[ "$services_stopped" == 1 ]]; then
    if ! compose up -d api web caddy; then
      echo "Could not restart application services after restore." >&2
      [[ "$result" != 0 ]] || result=1
    fi
  fi

  exit "$result"
}
trap cleanup EXIT

mkdir -p "$root_dir/deploy/.state"
restore_copy="$(mktemp "$root_dir/deploy/.state/restore-$environment.XXXXXX.dump")"
cp -- "$backup_file" "$restore_copy"
copied_hash="$(sha256sum "$restore_copy" | awk '{ print $1 }')"
if [[ "$copied_hash" != "$expected_hash" ]]; then
  echo "Backup changed while preparing restore; refusing to continue." >&2
  exit 1
fi

echo "Creating a fresh safety backup before restore..."
"$root_dir/deploy/scripts/backup.sh" "$environment"

echo "Restoring the archive into a temporary database..."
compose exec -T \
  -e "SHOP_RESTORE_DB=$restore_db" \
  database sh -ec '
    psql --username "$POSTGRES_USER" --dbname postgres \
      --set=ON_ERROR_STOP=1 --set=restore_db="$SHOP_RESTORE_DB" \
      --set=db_user="$POSTGRES_USER" <<SQL
CREATE DATABASE :"restore_db" OWNER :"db_user";
SQL
  '
restore_database_created=1

if ! compose exec -T \
  -e "SHOP_RESTORE_DB=$restore_db" \
  database sh -ec '
    pg_restore --clean --if-exists --exit-on-error --no-owner --no-privileges \
      --username "$POSTGRES_USER" --dbname "$SHOP_RESTORE_DB"
  ' <"$restore_copy"; then
  echo "Restore into the temporary database failed; the current database is unchanged." >&2
  exit 1
fi

compose exec -T \
  -e "SHOP_RESTORE_DB=$restore_db" \
  database sh -ec '
    psql --username "$POSTGRES_USER" --dbname "$SHOP_RESTORE_DB" \
      --set=ON_ERROR_STOP=1 --command "SELECT 1" >/dev/null
  '

echo "Stopping application services for the database switch..."
compose stop api web caddy
services_stopped=1

if ! compose exec -T \
  -e "SHOP_RESTORE_DB=$restore_db" \
  -e "SHOP_OLD_DB=$old_db" \
  database sh -ec '
    psql --username "$POSTGRES_USER" --dbname postgres \
      --set=ON_ERROR_STOP=1 --set=target_db="$POSTGRES_DB" \
      --set=restore_db="$SHOP_RESTORE_DB" --set=old_db="$SHOP_OLD_DB" <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname IN (:'target_db', :'restore_db')
  AND pid <> pg_backend_pid();
SQL
    if psql --username "$POSTGRES_USER" --dbname postgres \
      --set=ON_ERROR_STOP=1 --set=target_db="$POSTGRES_DB" \
      --set=restore_db="$SHOP_RESTORE_DB" --set=old_db="$SHOP_OLD_DB" <<SQL
ALTER DATABASE :"target_db" RENAME TO :"old_db";
ALTER DATABASE :"restore_db" RENAME TO :"target_db";
SQL
    then
      exit 0
    fi
    psql --username "$POSTGRES_USER" --dbname postgres \
      --set=ON_ERROR_STOP=1 --set=target_db="$POSTGRES_DB" \
      --set=old_db="$SHOP_OLD_DB" <<SQL
ALTER DATABASE :"old_db" RENAME TO :"target_db";
SQL
    exit 1
  '; then
  echo "Database switch failed; the original database was retained where possible." >&2
  exit 1
fi

database_switched=1
restore_database_created=0
echo "Checking API and storefront health..."
compose up -d api web caddy
for attempt in {1..30}; do
  if compose ps --status running api web caddy | grep -q caddy \
    && compose exec -T api node -e \
      "fetch('http://127.0.0.1:4000/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" \
    && compose exec -T web node -e \
      "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
    services_stopped=0
    break
  fi
  if [[ "$attempt" == 30 ]]; then
    echo "Restored database is active, but application health checks failed." >&2
    exit 1
  fi
  sleep 2
done

echo "Database restored for $environment."
echo "Previous database retained as $old_db until you verify the restored data."
