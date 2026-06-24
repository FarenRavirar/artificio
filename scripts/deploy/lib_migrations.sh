#!/usr/bin/env bash
set -euo pipefail

compose_project_flag() {
  if [ -n "${COMPOSE_PROJECT:-}" ]; then
    printf '%s\n' "-p $COMPOSE_PROJECT"
  fi
}

parse_header() {
  local filepath="$1"
  local class=""
  local req_backup=""
  local author=""
  local created=""
  local desc=""

  if [ ! -f "$filepath" ]; then
    echo "::error::Arquivo $filepath nao existe"
    return 1
  fi

  while IFS= read -r line; do
    if [[ "$line" =~ --[[:space:]]*@class:[[:space:]]*(online-safe|manual-risk)$ ]]; then
      class="${BASH_REMATCH[1]}"
    elif [[ "$line" =~ --[[:space:]]*@requires-backup:[[:space:]]*(true|false)$ ]]; then
      req_backup="${BASH_REMATCH[1]}"
    elif [[ "$line" =~ --[[:space:]]*@author:[[:space:]]*(.+)$ ]]; then
      author="${BASH_REMATCH[1]}"
    elif [[ "$line" =~ --[[:space:]]*@created:[[:space:]]*(.+)$ ]]; then
      created="${BASH_REMATCH[1]}"
    elif [[ "$line" =~ --[[:space:]]*@description:[[:space:]]*(.+)$ ]]; then
      desc="${BASH_REMATCH[1]}"
    fi
  done < <(head -n 20 "$filepath")

  if [ -z "$class" ] || [ -z "$req_backup" ] || [ -z "$author" ] || [ -z "$created" ] || [ -z "$desc" ]; then
    echo "::error::$filepath falhou na validacao de campos do cabecalho."
    return 1
  fi

  if [ "$req_backup" = "true" ] && [ "$class" = "online-safe" ]; then
    echo "::error::$filepath: requires-backup=true exige class=manual-risk."
    return 1
  fi

  echo "CLASS=$class"
  echo "REQUIRES_BACKUP=$req_backup"
}

validate_sql_against_class() {
  local filepath="$1"
  local class="$2"

  if [ "$class" != "online-safe" ]; then
    return 0
  fi

  # T30: guard fail-closed — perl faz o strip multilinha de comentários (REV-077 T28).
  # Só relevante no caminho online-safe (manual-risk retorna acima sem usar perl).
  # Captura a saída e checa o exit do perl: perl ausente OU com falha em runtime
  # → fail-closed (return 1), nunca deixa passar por saída vazia/parcial.
  local stripped
  if ! stripped=$(perl -0777 -pe 's{/\*.*?\*/}{}gs' "$filepath"); then
    echo "::error::perl ausente ou falhou ao processar $filepath — guard fail-closed."
    return 1
  fi

  # REV-077 (spec 050): regex estreito — permite DROP de atributo (NOT NULL, CONSTRAINT, DEFAULT, IDENTITY, EXPRESSION),
  # bloqueia DROP de objeto (TABLE, DATABASE, SCHEMA, COLUMN, VIEW, MATERIALIZED, SEQUENCE, TYPE, INDEX, FUNCTION, TRIGGER,
  # RULE, EXTENSION, TABLESPACE, ROLE, USER), TRUNCATE e DELETE FROM. Comentário de linha (-- via sed) removido antes do grep.
  if printf '%s\n' "$stripped" | sed 's/--.*//' | grep -Eiq '\b(DROP[[:space:]]+(TABLE|DATABASE|SCHEMA|COLUMN|VIEW|MATERIALIZED|SEQUENCE|TYPE|INDEX|FUNCTION|TRIGGER|RULE|EXTENSION|TABLESPACE|ROLE|USER)|TRUNCATE|DELETE[[:space:]]+FROM)\b'; then
    echo "::error::$filepath esta marcada online-safe mas contem instrucao destrutiva."
    return 1
  fi
}

query_schema_migrations() {
  local compose_file="$1"
  local db_service="$2"
  local db_user="$3"
  local db_name="$4"

  # shellcheck disable=SC2046
  docker compose $(compose_project_flag) -f "$compose_file" exec -T "$db_service" \
    psql -U "$db_user" -d "$db_name" -tAc "SELECT migration_name FROM schema_migrations ORDER BY migration_name" \
    < /dev/null 2>/dev/null || true
}

list_pending_by_set_diff() {
  local compose_file="$1"
  local db_service="$2"
  local db_user="$3"
  local db_name="$4"
  local migrations_dir="$5"

  local in_db
  in_db=$(query_schema_migrations "$compose_file" "$db_service" "$db_user" "$db_name")

  local on_disk
  if [ -d "$migrations_dir" ]; then
    on_disk=$(find "$migrations_dir" -maxdepth 1 -name "migration_*.sql" -type f -exec basename {} \; | sort)
  else
    on_disk=""
  fi

  local fail_drift=0
  local to_apply=()

  for db_mig in $in_db; do
    if ! echo "$on_disk" | grep -Fxq "$db_mig"; then
      echo "DRIFT ERROR: banco possui migration ausente no disco: $db_mig" >&2
      fail_drift=1
    fi
  done

  if [ "$fail_drift" -eq 1 ]; then
    return 1
  fi

  for file in $on_disk; do
    if ! echo "$in_db" | grep -Fxq "$file"; then
      to_apply+=("$file")
    fi
  done

  if [ "${#to_apply[@]}" -gt 0 ]; then
    printf "%s\n" "${to_apply[@]}"
  fi
}

_migration_lock_file() {
  local db_service="$1"
  local db_name="$2"
  local scope=""

  if [ -n "${MIGRATION_FLOCK_FILE:-}" ]; then
    printf '%s\n' "$MIGRATION_FLOCK_FILE"
    return 0
  fi

  scope="${COMPOSE_PROJECT:-default}-${db_service}-${db_name}"
  scope=$(printf '%s' "$scope" | tr -c 'A-Za-z0-9_.-' '_')
  printf '/tmp/artificio-migrations-%s.lock\n' "$scope"
}

acquire_migration_lock() {
  local db_service="$1"
  local db_name="$2"
  local lock_file=""
  local timeout="${MIGRATION_FLOCK_TIMEOUT:-180}"

  lock_file=$(_migration_lock_file "$db_service" "$db_name")
  mkdir -p "$(dirname "$lock_file")"

  exec 8>"$lock_file"
  echo "[migrations] tentando flock: $lock_file"
  if ! flock -w "$timeout" 8; then
    echo "::error::flock de migrations falhou apos ${timeout}s: $lock_file"
    return 1
  fi
  echo "[migrations] flock adquirido."
}

release_migration_lock() {
  flock -u 8 2>/dev/null || true
  echo "[migrations] flock liberado."
}
