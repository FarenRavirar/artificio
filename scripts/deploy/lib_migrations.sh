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

  if sed -e 's/--.*//' "$filepath" | grep -Eiq '\b(DROP|TRUNCATE|DELETE[[:space:]]+FROM)\b'; then
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

acquire_lock() {
  local compose_file="$1"
  local db_service="$2"
  local db_user="$3"
  local db_name="$4"
  local pg_opts="$5"
  local lock_id="${MIGRATION_LOCK_ID:-918273645}"
  local retry=0
  local max_retries="${MIGRATION_LOCK_RETRIES:-60}"

  echo "[migrations] tentando pg_advisory_lock..."
  while [ "$retry" -lt "$max_retries" ]; do
    local locked
    # shellcheck disable=SC2046
    locked=$(docker compose $(compose_project_flag) -f "$compose_file" exec -T -e PGOPTIONS="$pg_opts" "$db_service" \
      psql -U "$db_user" -d "$db_name" -tAc "SELECT pg_try_advisory_lock($lock_id);" < /dev/null 2>/dev/null || echo "f")

    if [ "$locked" = "t" ]; then
      echo "[migrations] pg_advisory_lock adquirido."
      return 0
    fi

    if [ "$retry" -eq 30 ]; then
      echo "[migrations] warning: lock >30s."
    fi
    retry=$((retry + 1))
    sleep 1
  done

  echo "::error::pg_advisory_lock falhou apos timeout."
  return 1
}

release_lock() {
  local compose_file="$1"
  local db_service="$2"
  local db_user="$3"
  local db_name="$4"
  local pg_opts="$5"
  local lock_id="${MIGRATION_LOCK_ID:-918273645}"

  echo "[migrations] liberando pg_advisory_lock..."
  # shellcheck disable=SC2046
  docker compose $(compose_project_flag) -f "$compose_file" exec -T -e PGOPTIONS="$pg_opts" "$db_service" \
    psql -U "$db_user" -d "$db_name" -tAc "SELECT pg_advisory_unlock($lock_id);" \
    < /dev/null >/dev/null 2>&1 || true
}
