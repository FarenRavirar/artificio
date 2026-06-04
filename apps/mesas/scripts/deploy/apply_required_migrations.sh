#!/usr/bin/env bash
set -euo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-./database}"

# Optional compose project name (for isolated integration tests).
# Em produção (CI), vazio = inferido do diretório. Em teste, setado explicitamente.
COMPOSE_PROJECT_FLAG=""
if [ -n "${COMPOSE_PROJECT:-}" ]; then
  COMPOSE_PROJECT_FLAG="-p $COMPOSE_PROJECT"
fi

if [ "$#" -ne 2 ]; then
  echo "Uso: bash scripts/deploy/apply_required_migrations.sh <compose_file> <db_service>"
  exit 1
fi

COMPOSE_FILE="$1"
DB_SERVICE="$2"
DB_NAME="mesas_rpg"
DB_USER="admin"

LOCK_TIMEOUT_MS="${LOCK_TIMEOUT_MS:-30000}"
STATEMENT_TIMEOUT_MS="${STATEMENT_TIMEOUT_MS:-600000}"
MAX_AUTO_PENDING="${MAX_AUTO_PENDING:-5}"
ALLOW_MANUAL_MIGRATIONS="${ALLOW_MANUAL_MIGRATIONS:-false}"
REQUIRE_PROD_BACKUP_FOR_MANUAL="${REQUIRE_PROD_BACKUP_FOR_MANUAL:-true}"
PROD_BACKUP_FILE="${PROD_BACKUP_FILE:-}"

if [[ "$COMPOSE_FILE" == *"prod"* ]]; then
  IS_PROD=true
else
  IS_PROD=false
fi

# 1. Source lib_migrations
# shellcheck disable=SC1091  # Caminho estático, shellcheck não consegue seguir em tempo de parse
source scripts/deploy/lib_migrations.sh

PG_OPTS="-c lock_timeout=${LOCK_TIMEOUT_MS}ms -c statement_timeout=${STATEMENT_TIMEOUT_MS}ms"

# 2. Bootstrap schema_migrations
echo "[migrations] garantindo tabela schema_migrations..."
# shellcheck disable=SC2086  # COMPOSE_PROJECT_FLAG precisa expandir para nada quando vazio; quotar transforma em string "" literal e quebra o docker compose
docker compose $COMPOSE_PROJECT_FLAG -f "$COMPOSE_FILE" exec -T -e PGOPTIONS="$PG_OPTS" "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by TEXT
);
SQL

# 3. Acquire Lock
if ! acquire_lock "$COMPOSE_FILE" "$DB_SERVICE" "$PG_OPTS"; then
  exit 4
fi

# Ensure release lock on exit
trap 'release_lock "$COMPOSE_FILE" "$DB_SERVICE" "$PG_OPTS"' EXIT

# 4. List pending
PENDING=()
if ! PENDING_OUTPUT=$(list_pending_by_set_diff "$COMPOSE_FILE" "$DB_SERVICE"); then
  exit 1
fi
mapfile -t PENDING <<< "$PENDING_OUTPUT"

if [ ${#PENDING[@]} -eq 0 ] || [ -z "${PENDING[0]}" ]; then
  echo "[migrations] schema em conformidade para runtime."
  exit 0
fi

if [ "${#PENDING[@]}" -gt "$MAX_AUTO_PENDING" ]; then
  echo "::error::Muitas migrations pendentes (${#PENDING[@]} > $MAX_AUTO_PENDING)."
  exit 1
fi

declare -a MANUAL_PENDING=()

# 5. Parse, Validate and Plan
for f_base in "${PENDING[@]}"; do
  if [ -z "$f_base" ]; then continue; fi
  f_path="$MIGRATIONS_DIR/$f_base"

  # parse header
  if ! header_vars=$(parse_header "$f_path"); then
    exit 1
  fi
  eval "$header_vars"

  # validate destrutivas
  if ! validate_sql_against_class "$f_path" "$CLASS"; then
    exit 1
  fi

  if [ "$CLASS" = "manual-risk" ]; then
    MANUAL_PENDING+=("$f_base")
  fi
done

# If there are manual risk migrations, verify permissions
if [ ${#MANUAL_PENDING[@]} -gt 0 ]; then
  if [ "$ALLOW_MANUAL_MIGRATIONS" != "true" ]; then
    echo "::error::Existem migrations manual-risk pendentes. Deploy bloqueado sem ALLOW_MANUAL_MIGRATIONS=true."
    exit 3
  fi

  if [ "$IS_PROD" = true ] && [ "$REQUIRE_PROD_BACKUP_FOR_MANUAL" = "true" ]; then
    if [ -z "$PROD_BACKUP_FILE" ] || [ ! -s "$PROD_BACKUP_FILE" ]; then
      echo "::error::Backup ausente. Defina PROD_BACKUP_FILE para rodar manual-risk em prod."
      exit 3
    fi
  fi
fi

# Execute migrations safely
for f_base in "${PENDING[@]}"; do
  if [ -z "$f_base" ]; then continue; fi
  f_path="$MIGRATIONS_DIR/$f_base"
  
  # Ensure we extract class for log
  header_vars=$(parse_header "$f_path")
  eval "$header_vars"

  echo "[migrations] aplicando $CLASS: $f_base..."

  # Run inside a single transaction if not relying on its own
  # shellcheck disable=SC2086  # COMPOSE_PROJECT_FLAG precisa expandir para nada quando vazio; quotar transforma em string "" literal e quebra o docker compose
  docker compose $COMPOSE_PROJECT_FLAG -f "$COMPOSE_FILE" exec -T -e PGOPTIONS="$PG_OPTS" "$DB_SERVICE" \
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<SQL
BEGIN;
$(cat "$f_path")
INSERT INTO schema_migrations (migration_name, applied_by) VALUES ('${f_base}', 'ci:$(whoami)@$(hostname)');
COMMIT;
SQL
done

echo "[migrations] schema em conformidade para runtime."
exit 0
