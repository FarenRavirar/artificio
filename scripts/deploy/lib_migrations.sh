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

  if [[ "$class" != "online-safe" ]]; then
    return 0
  fi

  # DEB-050-07 (spec 050): ALLOWLIST — bloqueia QUALQUER `DROP` que não seja atributo
  # seguro conhecido (NOT NULL, CONSTRAINT, DEFAULT, IDENTITY, EXPRESSION), além de
  # TRUNCATE e DELETE FROM. A denylist anterior (lista fixa de tipos de objeto) era
  # furada: DROP POLICY/DOMAIN/FOREIGN TABLE/PUBLICATION/SERVER/... escapavam como online-safe.
  # DEB-050-08 (CodeRabbit PR #95): o strip naive `s{--...}{}g` engolia `--` DENTRO de
  # string literal ('...'), escondendo o resto da linha — ex.: INSERT ... VALUES('--'); DROP
  # TABLE x; passava como online-safe. Trocado por tokenizer de 1 passada que ignora o
  # CONTEÚDO de comentário (/* */, --) e de string literal ('...', "..."), emitindo só o
  # "código" para o match. Dollar-quote ($$...$$) fica como código de propósito (fail-closed:
  # DROP dentro de corpo de função ainda bloqueia). Tudo em perl (já mandatório).
  # Fail-closed (T30/DEB-050-06): perl ausente ou quebrado → exit fora de {0,1} → return 1.
  # Só relevante no caminho online-safe (manual-risk retorna acima sem usar perl).
  perl -0777 -ne '
    my $s = $_; my $n = length($s); my $i = 0; my $code = "";
    while ($i < $n) {
      my $c = substr($s, $i, 1);
      my $c2 = substr($s, $i, 2);
      if ($c2 eq "/*") {                       # comentario de bloco
        my $e = index($s, "*/", $i + 2);
        $i = ($e < 0) ? $n : $e + 2;
      } elsif ($c2 eq "--") {                   # comentario de linha
        my $e = index($s, "\n", $i + 2);
        $i = ($e < 0) ? $n : $e;
      } elsif ($c eq "\x27") {                  # string literal '...'
        $i++;
        while ($i < $n) {
          if (substr($s, $i, 1) eq "\x27") {
            if (substr($s, $i + 1, 1) eq "\x27") { $i += 2; next; }  # '' escapado
            $i++; last;
          }
          $i++;
        }
      } elsif ($c eq "\x22") {                  # identificador "..."
        $i++;
        while ($i < $n) {
          if (substr($s, $i, 1) eq "\x22") { $i++; last; }
          $i++;
        }
      } else {
        $code .= $c; $i++;
      }
    }
    exit 1 if $code =~ /\bDROP\b(?!\s+(?:NOT\s+NULL|CONSTRAINT|DEFAULT|IDENTITY|EXPRESSION)\b)/i;
    exit 1 if $code =~ /\bTRUNCATE\b/i;
    exit 1 if $code =~ /\bDELETE\s+FROM\b/i;
    exit 0;
  ' "$filepath"
  local rc=$?

  if [[ "$rc" -eq 0 ]]; then
    return 0
  fi
  if [[ "$rc" -eq 1 ]]; then
    echo "::error::$filepath esta marcada online-safe mas contem instrucao destrutiva." >&2
    return 1
  fi
  echo "::error::perl ausente ou falhou ao processar $filepath — guard fail-closed." >&2
  return 1
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
