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
  if [[ -n "${MOCK_QUERY_FAIL:-}" ]]; then
    echo "ERROR: mock query failure" >&2
    return 1
  fi
  if [[ -n "${MOCK_QUERY_RESULT:-}" ]]; then
    printf '%s\n' "$MOCK_QUERY_RESULT"
    return 0
  fi
  query_schema_migrations "$@"
}

# Stub: MOCK_MARK_FILE = path; marcas são escritas neste arquivo (linha por linha: "version\tapplied_by")
_reconcile_mark_applied() {
  local compose_file="$1" db_service="$2" db_user="$3" db_name="$4" version="$5" applied_by="$6"

  if [[ -n "${MOCK_MARK_FILE:-}" ]]; then
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
  # T29: capture output + exit code instead of losing it in process substitution
  local query_out
  query_out="$(_reconcile_query "$compose_file" "$db_service" "$db_user" "$db_name")" || {
    echo "::error::Falha ao consultar schema_migrations." >&2
    return 1
  }
  while IFS= read -r line; do
    [[ -n "$line" ]] && echo "  $line"
  done <<< "$query_out"

  printf '%s\n' ""
  printf '%s\n' "=== Migrations pendentes (disco \\ banco) ==="
  # T29: propagate failure instead of || true
  if ! list_pending_by_set_diff "$compose_file" "$db_service" "$db_user" "$db_name" "$migrations_dir"; then
    echo "::error::Falha ao comparar migrations disco×banco." >&2
    return 1
  fi
}

# ─── --mark-applied ──────────────────────────────────────────────────

cmd_mark_applied() {
  local force=false
  local filtered=()

  # T27: Extract --force from any position before positional binding
  for arg in "$@"; do
    if [[ "$arg" == "--force" ]]; then
      force=true
    else
      filtered+=("$arg")
    fi
  done

  local version="${filtered[0]:-}" compose_file="${filtered[1]:-}" db_service="${filtered[2]:-}"
  local db_user="${filtered[3]:-admin}" db_name="${filtered[4]:-mesas_rpg}"
  local migrations_dir="${MIGRATIONS_DIR:-./database}"

  # ── R9a: prod exige --force ──
  if [[ "$compose_file" == *prod* ]] && [[ "$force" != true ]]; then
    echo "::error::$compose_file e prod. Use --force para confirmar." >&2
    return 1
  fi

  # ── R9b: validar formato da versao ──
  if ! printf '%s' "$version" | grep -qP '^migration_[0-9]+_.*\.sql$'; then
    echo "::error::Formato invalido: $version (esperado migration_NNN_*.sql)" >&2
    return 1
  fi

  # ── R9c: arquivo deve existir ──
  if [[ ! -f "$migrations_dir/$version" ]]; then
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
  [[ $# -lt 1 ]] && usage

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
