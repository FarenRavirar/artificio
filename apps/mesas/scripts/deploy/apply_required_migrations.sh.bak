#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Uso: bash scripts/deploy/apply_required_migrations.sh <compose_file> <db_service>"
  exit 1
fi

COMPOSE_FILE="$1"
DB_SERVICE="$2"
DB_NAME="mesas_rpg"
DB_USER="admin"
MIGRATIONS_DIR="./database"

LOCK_TIMEOUT="${LOCK_TIMEOUT:-5s}"
STATEMENT_TIMEOUT="${STATEMENT_TIMEOUT:-120s}"
MAX_AUTO_PENDING="${MAX_AUTO_PENDING:-5}"
ALLOW_MANUAL_MIGRATIONS="${ALLOW_MANUAL_MIGRATIONS:-false}"
REQUIRE_PROD_BACKUP_FOR_MANUAL="${REQUIRE_PROD_BACKUP_FOR_MANUAL:-true}"
PROD_BACKUP_FILE="${PROD_BACKUP_FILE:-}"

ONLINE_SAFE_MIGRATIONS=(
  "migration_101_add_banner_crop_data.sql"
  "migration_102_add_name_pt.sql"
  "migration_103_scenario_suggestions.sql"
  "migration_104_unify_node_type_check.sql"
  "migration_105_communication_platforms.sql"
  "migration_105_system_suggestions_align.sql"
  "migration_106_notifications_action_metadata.sql"
  "migration_106_vtt_logo_filenames.sql"
  "migration_107_gm_public_profile_v2.sql"
  "migration_107_scenarios_aliases_fields.sql"
  "migration_108_activity_log.sql"
  "migration_108_gm_profile_metrics.sql"
  "migration_108_systems_logo_website.sql"
  "migration_109_links_og_metadata_cache.sql"
  "migration_111_gm_preferred_vtt_platforms.sql"
  "migration_112_gm_contact_info.sql"
  "migration_113_benchmark_snapshots.sql"
)

# Migrations classificadas como risco/execucao manual.
# Exemplo de uso futuro:
# MANUAL_RISK_MIGRATIONS=("migration_104_backfill_heavy.sql")
MANUAL_RISK_MIGRATIONS=(
  "migration_104_drop_tables_frequency_columns.sql"
)

# Falha-fechada para evitar migrations novas sem classificacao.
# Mantemos corte em >=104 para nao interferir no legado inicial do projeto.
ENFORCE_CLASSIFICATION_FROM="${ENFORCE_CLASSIFICATION_FROM:-104}"

is_true() {
  case "${1,,}" in
    1|true|yes|y) return 0 ;;
    *) return 1 ;;
  esac
}

validate_migration_classification() {
  local unclassified_migrations=()
  local migration_path migration_name migration_number
  declare -A classified_migrations=()

  for migration in "${ONLINE_SAFE_MIGRATIONS[@]}" "${MANUAL_RISK_MIGRATIONS[@]}"; do
    classified_migrations["$migration"]=1
  done

  while IFS= read -r migration_path; do
    migration_name="$(basename "$migration_path")"

    if [[ ! "$migration_name" =~ ^migration_([0-9]+)_.*\.sql$ ]]; then
      continue
    fi

    migration_number="${BASH_REMATCH[1]}"
    if [ "$migration_number" -lt "$ENFORCE_CLASSIFICATION_FROM" ]; then
      continue
    fi

    if [ -z "${classified_migrations[$migration_name]+x}" ]; then
      unclassified_migrations+=("$migration_name")
    fi
  done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name 'migration_*.sql' | sort)

  if [ "${#unclassified_migrations[@]}" -gt 0 ]; then
    echo "ERRO: Existem migrations sem classificacao (online-safe/manual-risk)."
    echo "Inclua cada migration em ONLINE_SAFE_MIGRATIONS ou MANUAL_RISK_MIGRATIONS."
    printf ' - %s\n' "${unclassified_migrations[@]}"
    exit 1
  fi
}

sql_escape_literal() {
  local raw="$1"
  printf "%s" "$raw" | sed "s/'/''/g"
}

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERRO: Compose file nao encontrado: $COMPOSE_FILE"
  exit 1
fi

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ERRO: Diretorio de migrations nao encontrado: $MIGRATIONS_DIR"
  exit 1
fi

validate_migration_classification

if [[ "$COMPOSE_FILE" == *"prod"* ]]; then
  IS_PROD=true
else
  IS_PROD=false
fi

PG_OPTS="-c lock_timeout=${LOCK_TIMEOUT} -c statement_timeout=${STATEMENT_TIMEOUT}"

echo "[migrations] garantindo tabela schema_migrations..."
docker compose -f "$COMPOSE_FILE" exec -T -e PGOPTIONS="$PG_OPTS" "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

is_applied() {
  local migration_name="$1"
  local escaped_name
  escaped_name="$(sql_escape_literal "$migration_name")"

  docker compose -f "$COMPOSE_FILE" exec -T -e PGOPTIONS="$PG_OPTS" "$DB_SERVICE" \
    psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1 FROM schema_migrations WHERE migration_name='${escaped_name}' LIMIT 1;"
}

PENDING_ONLINE=()
for migration in "${ONLINE_SAFE_MIGRATIONS[@]}"; do
  migration_path="$MIGRATIONS_DIR/$migration"
  if [ ! -f "$migration_path" ]; then
    echo "ERRO: Migration online-safe nao encontrada: $migration_path"
    exit 1
  fi

  applied=$(is_applied "$migration")
  if [ "$applied" != "1" ]; then
    PENDING_ONLINE+=("$migration")
  fi
done

PENDING_MANUAL=()
for migration in "${MANUAL_RISK_MIGRATIONS[@]}"; do
  migration_path="$MIGRATIONS_DIR/$migration"
  if [ ! -f "$migration_path" ]; then
    echo "ERRO: Migration manual/risk nao encontrada: $migration_path"
    exit 1
  fi

  applied=$(is_applied "$migration")
  if [ "$applied" != "1" ]; then
    PENDING_MANUAL+=("$migration")
  fi
done

if [ "${#PENDING_ONLINE[@]}" -gt "$MAX_AUTO_PENDING" ]; then
  echo "ERRO: Muitas migrations online-safe pendentes (${#PENDING_ONLINE[@]} > $MAX_AUTO_PENDING)."
  echo "ABORTANDO deploy automatico para execucao controlada."
  printf ' - %s\n' "${PENDING_ONLINE[@]}"
  exit 1
fi

if [ "${#PENDING_MANUAL[@]}" -gt 0 ]; then
  if ! is_true "$ALLOW_MANUAL_MIGRATIONS"; then
    echo "ERRO: Existem migrations classificadas como MANUAL/RISK pendentes."
    echo "Deploy automatico bloqueado. Execute fluxo manual com janela e backup."
    printf ' - %s\n' "${PENDING_MANUAL[@]}"
    exit 1
  fi

  if [ "$IS_PROD" = true ] && is_true "$REQUIRE_PROD_BACKUP_FOR_MANUAL"; then
    if [ -z "$PROD_BACKUP_FILE" ] || [ ! -s "$PROD_BACKUP_FILE" ]; then
      echo "ERRO: Backup obrigatorio de producao ausente para migration manual/risk."
      echo "Defina PROD_BACKUP_FILE com caminho valido para dump recente antes de prosseguir."
      exit 1
    fi
  fi
fi

for migration in "${PENDING_ONLINE[@]}"; do
  migration_path="$MIGRATIONS_DIR/$migration"

  if grep -Eiv '^[[:space:]]*--' "$migration_path" | grep -Eiq '\b(TRUNCATE|DROP[[:space:]]+TABLE|DROP[[:space:]]+COLUMN|DELETE[[:space:]]+FROM)\b'; then
    echo "ERRO: Migration online-safe contem comando destrutivo: $migration"
    echo "Reclassifique como MANUAL_RISK_MIGRATIONS e use fluxo manual com backup."
    exit 1
  fi

  echo "[migrations] aplicando online-safe: $migration..."
  cat "$migration_path" | docker compose -f "$COMPOSE_FILE" exec -T -e PGOPTIONS="$PG_OPTS" "$DB_SERVICE" \
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME"

  escaped_migration="$(sql_escape_literal "$migration")"

  docker compose -f "$COMPOSE_FILE" exec -T -e PGOPTIONS="$PG_OPTS" "$DB_SERVICE" \
    psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
    -c "INSERT INTO schema_migrations (migration_name) VALUES ('${escaped_migration}') ON CONFLICT (migration_name) DO NOTHING;"
done

if [ "${#PENDING_MANUAL[@]}" -gt 0 ] && is_true "$ALLOW_MANUAL_MIGRATIONS"; then
  for migration in "${PENDING_MANUAL[@]}"; do
    migration_path="$MIGRATIONS_DIR/$migration"
    echo "[migrations] aplicando manual/risk: $migration..."

    cat "$migration_path" | docker compose -f "$COMPOSE_FILE" exec -T -e PGOPTIONS="$PG_OPTS" "$DB_SERVICE" \
      psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME"

    escaped_migration="$(sql_escape_literal "$migration")"

    docker compose -f "$COMPOSE_FILE" exec -T -e PGOPTIONS="$PG_OPTS" "$DB_SERVICE" \
      psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
      -c "INSERT INTO schema_migrations (migration_name) VALUES ('${escaped_migration}') ON CONFLICT (migration_name) DO NOTHING;"
  done
fi

echo "[migrations] validando schema minimo esperado..."
docker compose -f "$COMPOSE_FILE" exec -T -e PGOPTIONS="$PG_OPTS" "$DB_SERVICE" \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'system_suggestions'
      AND column_name = 'name_pt'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: coluna system_suggestions.name_pt ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'system_suggestions'
      AND column_name = 'rejection_reason'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: coluna system_suggestions.rejection_reason ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'scenario_suggestions'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: tabela scenario_suggestions ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'scenario_suggestions'
      AND column_name = 'subgenres'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: coluna scenario_suggestions.subgenres ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'scenarios'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: tabela scenarios ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'scenarios'
      AND column_name = 'description'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: coluna scenarios.description ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'scenario_aliases'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: tabela scenario_aliases ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'systems'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: tabela systems ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'systems'
      AND column_name = 'logo_filename'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: coluna systems.logo_filename ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'systems'
      AND column_name = 'website_url'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: coluna systems.website_url ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'notifications'
      AND column_name = 'action_url'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: coluna notifications.action_url ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'notifications'
      AND column_name = 'metadata'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: coluna notifications.metadata ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'gm_profiles'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: tabela gm_profiles ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'gm_profiles'
      AND column_name = 'preferred_vtt_platforms'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: coluna gm_profiles.preferred_vtt_platforms ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'gm_profiles'
      AND column_name = 'contact_methods'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: coluna gm_profiles.contact_methods ausente';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'benchmark_snapshots'
  ) THEN
    RAISE EXCEPTION 'Schema invalido: tabela benchmark_snapshots ausente';
  END IF;
END $$;
SQL

echo "[migrations] schema em conformidade para runtime."
