#!/usr/bin/env bash
set -euo pipefail

main_ref="${1:-origin/main}"
dev_ref="${2:-origin/dev}"

if ! git merge-base --is-ancestor "$main_ref" "$dev_ref"; then
  echo "ERRO: invariante quebrado: $main_ref nao e ancestral de $dev_ref."
  echo "Prod bloqueado: primeiro promova/main->dev ou reconcilie dev."
  exit 1
fi

echo "branch_invariant_ok=true"
