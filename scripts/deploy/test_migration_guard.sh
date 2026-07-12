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
echo "=== Verdes: DROP de objeto idempotente com IF EXISTS (achado real 2026-07-12) ==="
# apps/downloads/database/migration_003_download_creator.sql tinha
# "DROP TRIGGER IF EXISTS set_updated_at ON download_creator" (padrao comum antes de
# recriar trigger) e era barrado como falso-positivo — objeto recriavel, nao
# destrutivo de dado, mas fora da allowlist antiga (so cobria DROP de atributo).
assert_pass "drop_trigger_if_exists"  "DROP TRIGGER IF EXISTS trg_audit ON players"
assert_pass "drop_function_if_exists" "DROP FUNCTION IF EXISTS calc_rating"
assert_pass "drop_policy_if_exists"   "DROP POLICY IF EXISTS read_own ON players"
assert_pass "drop_index_if_exists"    "DROP INDEX IF EXISTS idx_name"
assert_pass "drop_view_if_exists"     "DROP VIEW IF EXISTS campaign_summary"
assert_pass "drop_sequence_if_exists" "DROP SEQUENCE IF EXISTS seq_id"

echo ""
echo "=== Vermelhas: DROP de objeto FORA da allowlist idempotente, mesmo com IF EXISTS ==="
# TABLE/COLUMN/DATABASE/SCHEMA/... continuam bloqueados mesmo com IF EXISTS —
# so TRIGGER/FUNCTION/POLICY/INDEX/VIEW/SEQUENCE entraram na allowlist.
assert_block "drop_table_if_exists"    "DROP TABLE IF EXISTS the_campaign"
assert_block "drop_column_if_exists"   "ALTER TABLE t DROP COLUMN IF EXISTS name"

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

echo ""
echo "=== Vermelhas: string literal escondendo destrutivo (DEB-050-08) ==="
# CodeRabbit PR #95: `--` dentro de string nao pode mascarar o DROP real seguinte.
assert_block "dashes_in_string"  "INSERT INTO t(txt) VALUES('--'); DROP TABLE users;"
assert_block "quote_in_string"   "INSERT INTO t(txt) VALUES('x'); TRUNCATE TABLE t;"

echo ""
echo "=== Verdes: destrutivo SO dentro de string literal (DEB-050-08) ==="
# Texto destrutivo que e apenas dado de coluna, sem statement real, deve passar.
assert_pass "drop_text_in_value" "INSERT INTO log(msg) VALUES('DROP TABLE users')"

# ── Resultado ──

total=$((passed + failed))
echo ""
echo "migration_guard_selftest: $passed/$total passaram"

if [[ "$failed" -gt 0 ]]; then
  echo "::error::$failed teste(s) falharam no migration guard self-test" >&2
  exit 1
fi

echo "migration_guard_selftest=ok"
