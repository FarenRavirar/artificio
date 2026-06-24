#!/usr/bin/env bash
set -euo pipefail

# Spec 050 — T4: teste automatizado do guard validate_sql_against_class
# Garante que a regex bloqueia DROP de objeto, TRUNCATE e DELETE FROM,
# mas permite DROP de atributo (NOT NULL, CONSTRAINT, DEFAULT, etc.).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib_migrations.sh"

tmpdir="$(mktemp -d)"
failed=0
passed=0

cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

assert_pass() {
  local label="$1"; shift
  local file="$tmpdir/$label.sql"
  printf '%s\n' "$@" > "$file"
  local out rc=0
  out="$(validate_sql_against_class "$file" online-safe 2>&1)" || rc=$?
  if [[ "$rc" -eq 0 ]]; then
    echo "  ok  $label"
    passed=$((passed + 1))
  else
    echo "  FAIL $label (esperava 0, obteve $rc): $out"
    failed=$((failed + 1))
  fi
}

assert_block() {
  local label="$1"; shift
  local file="$tmpdir/$label.sql"
  printf '%s\n' "$@" > "$file"
  local out rc=0
  out="$(validate_sql_against_class "$file" online-safe 2>&1)" || rc=$?
  if [[ "$rc" -ne 0 ]]; then
    echo "  ok  $label"
    passed=$((passed + 1))
  else
    echo "  FAIL $label (esperava !=0, obteve 0)"
    failed=$((failed + 1))
  fi
}

# ── Fixtures verdes (devem passar — DROP de atributo) ──

echo "=== Verdes: DROP de atributo (permitidos) ==="
assert_pass "drop_not_null"  "ALTER COLUMN discord_message_id DROP NOT NULL"
assert_pass "drop_constraint" "ALTER TABLE t DROP CONSTRAINT IF EXISTS chk"
assert_pass "drop_default"    "ALTER COLUMN x DROP DEFAULT"
assert_pass "drop_identity"   "ALTER COLUMN y DROP IDENTITY IF EXISTS"
assert_pass "drop_expression" "ALTER COLUMN z DROP EXPRESSION"

echo ""
echo "=== Verdes: comentários (não devem disparar) ==="
assert_pass "block_comment"   "/* DROP TABLE test */ SELECT 1"
assert_pass "line_comment"    "-- DROP TABLE destroyed CASCADE"
assert_pass "inline_comment"  "SELECT 1 -- DROP TABLE test"
# T28: multilinha
assert_pass "multiline_block" "/* nota:" "   DROP TABLE x;" "*/" "SELECT 1"

echo ""
echo "=== Verdes: migrations reais 128 e 129 ==="
SCRIPT_DIR_REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
assert_pass "migration_128_real" "$(cat "$SCRIPT_DIR_REPO/apps/mesas/database/migration_128_import_messages.sql")"
assert_pass "migration_129_real" "$(cat "$SCRIPT_DIR_REPO/apps/mesas/database/migration_129_import_corrections.sql")"

# ── Fixtures vermelhas (devem bloquear — DROP de objeto + DELETE/TRUNCATE) ──

echo ""
echo "=== Vermelhas: DROP de objeto (bloqueados) ==="
assert_block "drop_table"      "DROP TABLE the_campaign"
assert_block "drop_column"     "DROP COLUMN name"
assert_block "drop_index"      "DROP INDEX idx_name"
assert_block "drop_database"   "DROP DATABASE production"
assert_block "drop_schema"     "DROP SCHEMA public CASCADE"
assert_block "drop_view"       "DROP VIEW campaign_summary"
assert_block "drop_materialized" "DROP MATERIALIZED VIEW mat_view"
assert_block "drop_sequence"   "DROP SEQUENCE seq_id"
assert_block "drop_type"       "DROP TYPE mood"
assert_block "drop_function"   "DROP FUNCTION calc_rating"
assert_block "drop_trigger"    "DROP TRIGGER trg_audit ON players"
assert_block "drop_rule"       "DROP RULE notify_rule ON events"
assert_block "drop_extension"  "DROP EXTENSION pg_trgm"
assert_block "drop_tablespace" "DROP TABLESPACE fastspace"
assert_block "drop_role"       "DROP ROLE readonly"
assert_block "drop_user"       "DROP USER john"

echo ""
echo "=== Vermelhas: DROP fora da denylist antiga (allowlist DEB-050-07) ==="
assert_block "drop_policy"        "DROP POLICY sel_policy ON players"
assert_block "drop_domain"        "DROP DOMAIN positive_int"
assert_block "drop_foreign_table" "DROP FOREIGN TABLE remote_t"
assert_block "drop_publication"   "DROP PUBLICATION pub1"
assert_block "drop_server"        "DROP SERVER fdw_server"
assert_block "drop_aggregate"     "DROP AGGREGATE myavg(int)"
assert_block "drop_owned"         "DROP OWNED BY olduser"

echo ""
echo "=== Vermelhas: DELETE / TRUNCATE (bloqueados) ==="
assert_block "delete_from"     "DELETE FROM campaigns WHERE id=1"
assert_block "truncate_table"  "TRUNCATE TABLE campaigns"

# ── Resultado ──

total=$((passed + failed))
echo ""
echo "migration_guard_selftest: $passed/$total passaram"

if [[ "$failed" -gt 0 ]]; then
  echo "::error::$failed teste(s) falharam no migration guard self-test" >&2
  exit 1
fi

echo "migration_guard_selftest=ok"
