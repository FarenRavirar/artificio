#!/usr/bin/env bash
set -euo pipefail

# Spec 050 Fase E — Teste da ferramenta de reconcile de migrations
#
# Cobre R8/R9 sem Docker: usa MOCK_QUERY_RESULT e MOCK_MARK_FILE para
# stubs das operacoes de banco (T22).
# - prod sem --force → falha
# - version invalida → falha
# - arquivo ausente → falha
# - ja presente → SKIP
# - caso feliz (stub) → NEW
# - --list com mock → diff listado

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/reconcile_migrations.sh"

tmpdir="$(mktemp -d)"
mock_mark_file="$tmpdir/marks.txt"
passed=0
failed=0

cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

mkstub_migration() {
  local name="$1"
  local dir="$tmpdir/migrations"
  mkdir -p "$dir"
  cat > "$dir/$name" <<SQL
-- @class: online-safe
-- @requires-backup: false
-- @author: test
-- @created: 2026-06-24
-- @description: test migration for reconcile
SELECT 1;
SQL
}

assert_ok() {
  local label="$1"; shift
  local out rc=0
  out="$("$@" 2>&1)" || rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "  ok  $label"
    passed=$((passed + 1))
  else
    echo "  FAIL $label (esperava 0, obteve $rc): $out"
    failed=$((failed + 1))
  fi
}

assert_fail() {
  local label="$1"; shift
  local out rc=0
  out="$("$@" 2>&1)" || rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "  ok  $label (rc=$rc)"
    passed=$((passed + 1))
  else
    echo "  FAIL $label (esperava !=0, obteve 0): $out"
    failed=$((failed + 1))
  fi
}

assert_output_contains() {
  local label="$1" pattern="$2"; shift 2
  local out rc=0
  out="$("$@" 2>&1)" || rc=$?
  if printf '%s' "$out" | grep -qF "$pattern"; then
    echo "  ok  $label"
    passed=$((passed + 1))
  else
    echo "  FAIL $label (nao contem \"$pattern\"): $out"
    failed=$((failed + 1))
  fi
}

# ── Fixtures ──
mkstub_migration "migration_200_test.sql"
STUB_MIGRATIONS_DIR="$tmpdir/migrations"

echo "=== --mark-applied: sem args ==="
assert_fail "sem args" bash "$SCRIPT_DIR/reconcile_migrations.sh" --mark-applied

echo ""
echo "=== --mark-applied: prod sem --force ==="
assert_fail "prod sem force" \
  env MOCK_QUERY_RESULT="" \
  bash "$SCRIPT_DIR/reconcile_migrations.sh" --mark-applied \
  "migration_200_test.sql" "docker-compose-prod.yml" "mesas-db"

echo ""
echo "=== --mark-applied: version invalida ==="
assert_fail "sem prefixo migration_" \
  bash "$SCRIPT_DIR/reconcile_migrations.sh" --mark-applied \
  "foo.sql" "compose.yml" "db"

echo ""
echo "=== --mark-applied: arquivo ausente ==="
assert_fail "arquivo nao existe" \
  bash "$SCRIPT_DIR/reconcile_migrations.sh" --mark-applied \
  "migration_999_nonexistent.sql" "compose.yml" "db"

echo ""
echo "=== --mark-applied: ja presente (idempotente) ==="
assert_output_contains "skip se ja registrada" "SKIP:" \
  env MOCK_QUERY_RESULT="migration_200_test.sql" MIGRATIONS_DIR="$STUB_MIGRATIONS_DIR" \
  bash "$SCRIPT_DIR/reconcile_migrations.sh" --mark-applied \
  "migration_200_test.sql" "compose.yml" "db" admin mesas_rpg

echo ""
echo "=== --mark-applied: caso feliz (stub) ==="
assert_output_contains "mark bem-sucedido" "OK: migration_200_test.sql marcada" \
  env MOCK_QUERY_RESULT="" MOCK_MARK_FILE="$mock_mark_file" MIGRATIONS_DIR="$STUB_MIGRATIONS_DIR" \
  bash "$SCRIPT_DIR/reconcile_migrations.sh" --mark-applied \
  "migration_200_test.sql" "compose.yml" "db" admin mesas_rpg

echo ""
echo "=== --list: com mock (deve mostrar diff) ==="
assert_output_contains "--list mostra pendentes" "pendentes" \
  env MOCK_QUERY_RESULT="" \
  bash "$SCRIPT_DIR/reconcile_migrations.sh" --list \
  "compose.yml" "db" admin mesas_rpg "$STUB_MIGRATIONS_DIR"

# ── Resultado ──
total=$((passed + failed))
echo ""
echo "migration_reconcile_selftest: $passed/$total passaram"

if [ "$failed" -gt 0 ]; then
  echo "::error::$failed teste(s) falharam no migration reconcile self-test"
  exit 1
fi

echo "migration_reconcile_selftest=ok"
