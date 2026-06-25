#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 2 || "$#" -gt 5 ]]; then
  echo "Uso: bash scripts/deploy/apply_required_migrations.sh <compose_file> <db_service> [db_name] [db_user] [migrations_dir]" >&2
  exit 1
fi

COMPOSE_FILE="$1"
DB_SERVICE="$2"
DB_NAME="${3:-${DB_NAME:-mesas_rpg}}"
DB_USER="${4:-${DB_USER:-admin}}"
MIGRATIONS_DIR="${5:-${MIGRATIONS_DIR:-./apps/mesas/database}}"

LOCK_TIMEOUT_MS="${LOCK_TIMEOUT_MS:-30000}"
STATEMENT_TIMEOUT_MS="${STATEMENT_TIMEOUT_MS:-600000}"
MAX_AUTO_PENDING="${MAX_AUTO_PENDING:-5}"
MIGRATION_LOCK_ID="${MIGRATION_LOCK_ID:-918273645}"
ALLOW_MANUAL_MIGRATIONS="${ALLOW_MANUAL_MIGRATIONS:-false}"
REQUIRE_PROD_BACKUP_FOR_MANUAL="${REQUIRE_PROD_BACKUP_FOR_MANUAL:-true}"
PROD_BACKUP_FILE="${PROD_BACKUP_FILE:-}"
PG_OPTS="-c lock_timeout=${LOCK_TIMEOUT_MS}ms -c statement_timeout=${STATEMENT_TIMEOUT_MS}ms"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib_migrations.sh"

load_header_vars() {
  local path="$1"
  local header_vars=""
  local key=""
  local value=""

  CLASS=""
  REQUIRES_BACKUP=""

  header_vars=$(parse_header "$path") || return 1
  while IFS='=' read -r key value; do
    case "$key" in
      CLASS) CLASS="$value" ;;
      REQUIRES_BACKUP) REQUIRES_BACKUP="$value" ;;
    esac
  done <<< "$header_vars"

  if [[ -z "$CLASS" || -z "$REQUIRES_BACKUP" ]]; then
    echo "::error::$path falhou ao carregar cabecalho parseado." >&2
    return 1
  fi
}

if ! [[ "$MIGRATION_LOCK_ID" =~ ^-?[0-9]+$ ]]; then
  echo "::error::MIGRATION_LOCK_ID precisa ser numerico." >&2
  exit 1
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "[migrations] diretorio ausente: $MIGRATIONS_DIR; nada a aplicar."
  exit 0
fi

acquire_migration_lock "$DB_SERVICE" "$DB_NAME"
trap 'release_migration_lock' EXIT

echo "[migrations] garantindo schema_migrations em $DB_NAME..."
# shellcheck disable=SC2046
docker compose $(compose_project_flag) -f "$COMPOSE_FILE" exec -T -e PGOPTIONS="$PG_OPTS" "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by TEXT
);
SQL

PENDING=()
if ! PENDING_OUTPUT=$(list_pending_by_set_diff "$COMPOSE_FILE" "$DB_SERVICE" "$DB_USER" "$DB_NAME" "$MIGRATIONS_DIR"); then
  exit 1
fi
mapfile -t PENDING <<< "$PENDING_OUTPUT"

if [[ "${#PENDING[@]}" -eq 0 || -z "${PENDING[0]:-}" ]]; then
  echo "[migrations] schema em conformidade."
  exit 0
fi

if [[ "${#PENDING[@]}" -gt "$MAX_AUTO_PENDING" ]]; then
  echo "::error::Muitas migrations pendentes (${#PENDING[@]} > $MAX_AUTO_PENDING)." >&2
  exit 1
fi

MANUAL_PENDING=()
for file in "${PENDING[@]}"; do
  [[ -z "$file" ]] && continue
  path="$MIGRATIONS_DIR/$file"
  load_header_vars "$path"
  validate_sql_against_class "$path" "$CLASS"
  if [[ "$CLASS" == "manual-risk" ]]; then
    MANUAL_PENDING+=("$file")
  fi
done

if [[ "${#MANUAL_PENDING[@]}" -gt 0 ]]; then
  if [[ "$ALLOW_MANUAL_MIGRATIONS" != "true" ]]; then
    echo "::error::Existem migrations manual-risk pendentes. Use ALLOW_MANUAL_MIGRATIONS=true." >&2
    exit 3
  fi
  if [[ "$REQUIRE_PROD_BACKUP_FOR_MANUAL" == "true" && ( -z "$PROD_BACKUP_FILE" || ! -s "$PROD_BACKUP_FILE" ) ]]; then
    echo "::error::Backup PROD_BACKUP_FILE ausente para manual-risk." >&2
    exit 3
  fi
fi

for file in "${PENDING[@]}"; do
  [[ -z "$file" ]] && continue
  path="$MIGRATIONS_DIR/$file"
  load_header_vars "$path"
  echo "[migrations] aplicando $CLASS: $file"

  # shellcheck disable=SC2046
  docker compose $(compose_project_flag) -f "$COMPOSE_FILE" exec -T -e PGOPTIONS="$PG_OPTS" "$DB_SERVICE" \
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<SQL
BEGIN;
SELECT pg_advisory_xact_lock($MIGRATION_LOCK_ID);
$(cat "$path")
INSERT INTO schema_migrations (migration_name, applied_by) VALUES ('$file', 'ci:$(whoami)@$(hostname)');
COMMIT;
SQL
done

echo "[migrations] schema em conformidade."
