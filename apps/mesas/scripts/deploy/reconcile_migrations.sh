#!/usr/bin/env bash
set -euo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-./database}"

if [ "$#" -lt 3 ]; then
  echo "Uso:"
  echo "bash scripts/deploy/reconcile_migrations.sh --list <compose> <db-service>"
  echo "bash scripts/deploy/reconcile_migrations.sh --mark-applied <version> <compose> <db-service> [--force]"
  exit 1
fi

COMMAND="$1"

if [ "$COMMAND" = "--list" ]; then
  COMPOSE_FILE="$2"
  DB_SERVICE="$3"
  
  echo "=== RECONCILE LIST ==="
  echo "Disco:"
  find "$MIGRATIONS_DIR" -maxdepth 1 -name "migration_*.sql" -exec basename {} \; | sort
  echo "Banco:"
  docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" psql -U admin -d mesas_rpg -tAc "SELECT migration_name FROM schema_migrations ORDER BY migration_name" < /dev/null 2>/dev/null || echo ""
  exit 0
fi

if [ "$COMMAND" = "--mark-applied" ]; then
  VERSION="$2"
  COMPOSE_FILE="$3"
  DB_SERVICE="$4"
  FORCE="${5:-}"

  if [[ "$COMPOSE_FILE" == *"prod"* ]] && [ "$FORCE" != "--force" ]; then
    echo "::error::Reconciliacao em producao exige flag --force"
    exit 1
  fi

  # Validate if file exists in base directory
  FILEPATH="$MIGRATIONS_DIR/$VERSION"
  if [ ! -f "$FILEPATH" ]; then
    echo "[reconcile] $VERSION: ERRO - arquivo .sql correspondente ausente em $MIGRATIONS_DIR/"
    exit 1
  fi

  # Check if already applied
  EXISTS=$(docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" psql -U admin -d mesas_rpg -tAc "SELECT 1 FROM schema_migrations WHERE migration_name='${VERSION}' LIMIT 1" < /dev/null 2>/dev/null || echo "")

  if [ "$EXISTS" = "1" ]; then
    echo "[reconcile] $VERSION: SKIP - already present in schema_migrations"
    exit 0
  fi

  APPLIED_BY="reconcile:$(whoami)@$(hostname)"

  docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
    psql -v ON_ERROR_STOP=1 -U admin -d mesas_rpg \
    -c "INSERT INTO schema_migrations (migration_name, applied_by) VALUES ('${VERSION}', '${APPLIED_BY}');" < /dev/null > /dev/null

  echo "[reconcile] $VERSION: NEW - registered in schema_migrations"
  exit 0
fi

echo "Comando desconhecido."
exit 1
