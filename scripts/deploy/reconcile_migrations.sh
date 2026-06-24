#!/usr/bin/env bash
set -euo pipefail

# Spec 050 Fase E — Reconcile canônico (recuperação de drift)
# Porta reconcile_migrations.sh órfão para canônico: parametrizado + gates R9 + testável.
#
# Uso:
#   bash scripts/deploy/reconcile_migrations.sh --list <compose> <db_service> [db_user] [db_name] [migrations_dir]
#   bash scripts/deploy/reconcile_migrations.sh --mark-applied <version> <compose> <db_service> [db_user] [db_name] [--force]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib_migrations.sh"

# ── Injectable DB ops (T22 — override via env para CI/test sem Docker) ──

# Stub: MOCK_QUERY_RESULT = newline-separated list of applied migrations
_reconcile_query() {
  if [ -n "${MOCK_QUERY_RESULT:-}" ]; then
    printf '%s\n' "$MOCK_QUERY_RESULT"
    return 0
  fi
  query_schema_migrations "$@"
}

# Stub: MOCK_MARK_FILE = path; marcas são escritas neste arquivo (linha por linha: "version\tapplied_by")
_reconcile_mark_applied() {
  local compose_file="$1" db_service="$2" db_user="$3" db_name="$4" version="$5" applied_by="$6"

  if [ -n "${MOCK_MARK_FILE:-}" ]; then
    printf '%s\t%s\n' "$version" "$applied_by" >> "$MOCK_MARK_FILE"
    echo "$version"
    return 0
  fi

  # shellcheck disable=SC2046
  docker compose $(compose_project_flag) -f "$compose_file" exec -T "$db_service" \
    psql -v ON_ERROR_STOP=1 -U "$db_user" -d "$db_name" \
    -tAc "INSERT INTO schema_migrations (migration_name, applied_by) VALUES ('$(printf '%s' "$version" | sed "s/'/''/g")', '$(printf '%s' "$applied_by" | sed "s/'/''/g")') RETURNING migration_name" \
    < /dev/null || return 1
}

# ── Help ──

usage() {
  cat <<EOF
Uso: $(basename "$0") <comando> [args...]

Comandos:
  --list <compose> <db_service> [db_user] [db_name] [migrations_dir]
    Lista diff entre disco e banco (read-only, reusa list_pending_by_set_diff).
    Defaults: db_user=admin, db_name=mesas_rpg, migrations_dir=./database

  --mark-applied <version> <compose> <db_service> [db_user] [db_name] [--force]
    Marca migration como aplicada SEM executar o SQL.
    Gates de seguranca (R9):
      - Prod requer --force
      - version deve casar migration_NNN_*.sql
      - Arquivo .sql deve existir em migrations_dir
      - Idempotente (skip se ja registrada)
      - Aviso antes de marcar
EOF
  exit 1
}

# ─── --list ──────────────────────────────────────────────────────────

cmd_list() {
  local compose_file="$1" db_service="$2" db_user="${3:-admin}" db_name="${4:-mesas_rpg}" migrations_dir="${5:-./database}"

  echo "=== Migrations no banco ==="
  while IFS= read -r line; do
    [ -n "$line" ] && echo "  $line"
  done < <(_reconcile_query "$compose_file" "$db_service" "$db_user" "$db_name")

  echo ""
  printf '%s\n' "=== Migrations pendentes (disco \\ banco) ==="
  list_pending_by_set_diff "$compose_file" "$db_service" "$db_user" "$db_name" "$migrations_dir" || true
}

# ─── --mark-applied ──────────────────────────────────────────────────

cmd_mark_applied() {
  local version="$1" compose_file="$2" db_service="$3" db_user="${4:-admin}" db_name="${5:-mesas_rpg}"
  local force=false
  local migrations_dir="${MIGRATIONS_DIR:-./database}"

  # busca --force em args restantes (posicao 6+)
  for arg in "${@:6}"; do
    [ "$arg" = "--force" ] && force=true
  done

  # ── R9a: prod exige --force ──
  if [[ "$compose_file" == *prod* ]] && [ "$force" != true ]; then
    echo "::error::$compose_file e prod. Use --force para confirmar." >&2
    return 1
  fi

  # ── R9b: validar formato da versao ──
  if ! printf '%s' "$version" | grep -qP '^migration_[0-9]+_.*\.sql$'; then
    echo "::error::Formato invalido: $version (esperado migration_NNN_*.sql)" >&2
    return 1
  fi

  # ── R9c: arquivo deve existir ──
  if [ ! -f "$migrations_dir/$version" ]; then
    echo "::error::Arquivo nao encontrado: $migrations_dir/$version" >&2
    return 1
  fi

  # ── R9d: idempotente ──
  if _reconcile_query "$compose_file" "$db_service" "$db_user" "$db_name" | grep -Fxq "$version"; then
    echo "SKIP: $version ja registrada em schema_migrations."
    return 0
  fi

  # ── R9e: aviso ──
  echo "=== AVISO ==="
  echo "Voce esta prestes a marcar $version como aplicada SEM executar o SQL."
  echo "Use apenas se a migration ja foi executada manualmente."
  echo ""

  local applied_by
  applied_by="reconcile:$(whoami)@$(hostname)"

  if _reconcile_mark_applied "$compose_file" "$db_service" "$db_user" "$db_name" "$version" "$applied_by"; then
    echo "OK: $version marcada como aplicada (applied_by=$applied_by)."
    return 0
  else
    echo "::error::Falha ao marcar $version." >&2
    return 1
  fi
}

# ─── Main ────────────────────────────────────────────────────────────

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  [ $# -lt 1 ] && usage

  case "$1" in
    --list)
      shift
      cmd_list "$@"
      ;;
    --mark-applied)
      shift
      cmd_mark_applied "$@"
      ;;
    *)
      usage
      ;;
  esac
fi
