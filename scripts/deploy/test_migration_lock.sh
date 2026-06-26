#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib_migrations.sh"

tmpdir="$(mktemp -d)"
lock_file="$tmpdir/migrations.lock"
log_file="$tmpdir/lock.log"

cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

worker() {
  local name="$1"
  (
    export MIGRATION_FLOCK_FILE="$lock_file"
    acquire_migration_lock "stub-db" "stub"
    printf '%s:start\n' "$name" >> "$log_file"
    sleep 1
    printf '%s:end\n' "$name" >> "$log_file"
    release_migration_lock
  )
}

worker one &
pid_one=$!

for _ in $(seq 1 50); do
  if grep -q '^one:start$' "$log_file" 2>/dev/null; then
    break
  fi
  sleep 0.1
done

if ! grep -q '^one:start$' "$log_file" 2>/dev/null; then
  echo "::error::worker one nao iniciou lock a tempo" >&2
  wait "$pid_one" || true
  exit 1
fi

worker two &
pid_two=$!

wait "$pid_one"
wait "$pid_two"

expected=$'one:start\none:end\ntwo:start\ntwo:end'
actual="$(grep -E '^(one|two):(start|end)$' "$log_file" || true)"

if [[ "$actual" != "$expected" ]]; then
  echo "::error::flock nao serializou execucoes de migration" >&2
  printf 'expected:\n%s\nactual:\n%s\n' "$expected" "$actual"
  exit 1
fi

echo "migration_flock_selftest=ok"
