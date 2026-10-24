# Dziennik wdrożeń: jedna linia JSON na akcję w deploy/.state/journal.jsonl.
# Użycie: source journal.sh; journal_init <root> <env> <akcja> <wersja> [notatka]
# Wpis zapisuje się sam przy wyjściu ze skryptu (sukces albo błąd).
# Dziennik NIE cofa bazy danych - to zawsze decyzja człowieka z backupu.

journal_escape() {
  local value="${1//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/ }"
  printf '%s' "$value"
}

journal_init() {
  journal_file="$1/deploy/.state/journal.jsonl"
  journal_env="$2"
  journal_action="$3"
  journal_version="$4"
  journal_note="${5:-}"
  journal_commit="$(git -C "$1" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"
  journal_done=0
  trap 'journal_finish $?' EXIT
}

journal_finish() {
  local code="${1:-$?}" result=ok
  [[ "${journal_done:-1}" == 0 ]] || return 0
  journal_done=1
  [[ "$code" == 0 ]] || result=failed
  mkdir -p "$(dirname "$journal_file")"
  printf '{"time":"%s","action":"%s","result":"%s","environment":"%s","version":"%s","user":"%s","commit":"%s","note":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$journal_action" "$result" "$journal_env" \
    "$(journal_escape "$journal_version")" "$(journal_escape "${SUDO_USER:-${USER:-unknown}}")" \
    "$journal_commit" "$(journal_escape "$journal_note")" >>"$journal_file"
  return 0
}
