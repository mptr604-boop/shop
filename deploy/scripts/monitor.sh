#!/usr/bin/env bash
set -euo pipefail
umask 077

environment="${1:-}"
site_url="${2:-}"
api_url="${3:-}"

if [[ ! "$environment" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "Usage: $0 environment https://shop.example.com https://api.shop.example.com" >&2
  exit 2
fi

if [[ "$site_url" != https://* || "$api_url" != https://* ]]; then
  echo "Site and API URLs must use HTTPS." >&2
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to check service health." >&2
  exit 1
fi

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
state_dir="$root_dir/deploy/.state"
mkdir -p "$state_dir"
chmod 700 "$state_dir"

send_alert() {
  local message="$1"
  local payload
  payload="$(MESSAGE="$message" python3 -c \
    'import json, os; print(json.dumps({"text": os.environ["MESSAGE"]}))')" || {
    echo "Could not encode alert payload; ensure Python 3 is installed." >&2
    return 1
  }

  if [[ -z "${ALERT_WEBHOOK_URL:-}" ]]; then
    echo "ALERT_WEBHOOK_URL is not set; cannot deliver: $message" >&2
    return 1
  fi
  if [[ "$ALERT_WEBHOOK_URL" != https://* ]]; then
    echo "ALERT_WEBHOOK_URL must use HTTPS." >&2
    return 1
  fi

  curl --fail --silent --show-error \
    --connect-timeout 5 --max-time 10 \
    --header "Content-Type: application/json" \
    --data "$payload" \
    "$ALERT_WEBHOOK_URL" >/dev/null
}

check_target() {
  local service="$1"
  local url="$2"
  local state_file="$state_dir/monitor-$environment-$service"
  local previous_state="up"
  local current_state="up"
  local http_status

  if [[ -f "$state_file" ]]; then
    previous_state="$(<"$state_file")"
  fi

  if ! http_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
    --connect-timeout 5 --max-time 10 "$url")" \
    || [[ ! "$http_status" =~ ^2[0-9][0-9]$ ]]; then
    current_state="down"
  fi

  if [[ "$current_state" == "$previous_state" ]]; then
    if [[ "$current_state" == "down" ]]; then
      echo "$environment $service is still unavailable (HTTP ${http_status:-000})." >&2
      return 1
    fi
    return 0
  fi

  local message
  if [[ "$current_state" == "down" ]]; then
    message="[$environment] ALERT: $service is unavailable at $url (HTTP ${http_status:-000})."
  else
    message="[$environment] RECOVERED: $service is responding again at $url."
  fi

  if ! send_alert "$message"; then
    return 1
  fi

  printf '%s\n' "$current_state" >"$state_file.tmp"
  mv "$state_file.tmp" "$state_file"
  echo "$message"
  [[ "$current_state" == "up" ]]
}

exit_code=0
check_target "web" "${site_url%/}/" || exit_code=1
check_target "api" "${api_url%/}/ready" || exit_code=1
exit "$exit_code"
