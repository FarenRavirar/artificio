#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

git -C "$tmp_dir" init -q
git -C "$tmp_dir" config user.email "ci@example.invalid"
git -C "$tmp_dir" config user.name "CI"

printf 'base\n' > "$tmp_dir/file.txt"
git -C "$tmp_dir" add file.txt
git -C "$tmp_dir" commit -q -m base
git -C "$tmp_dir" branch main
git -C "$tmp_dir" branch dev

git -C "$tmp_dir" checkout -q dev
printf 'dev\n' >> "$tmp_dir/file.txt"
git -C "$tmp_dir" commit -am dev -q

git -C "$tmp_dir" remote add origin "$tmp_dir"
git -C "$tmp_dir" update-ref refs/remotes/origin/main refs/heads/main
git -C "$tmp_dir" update-ref refs/remotes/origin/dev refs/heads/dev

git -C "$tmp_dir" checkout -q main
(
  cd "$tmp_dir"
  bash "$repo_root/scripts/deploy/validate_branch_invariant.sh" origin/main origin/dev >/tmp/branch-invariant-ok.log
)

printf 'main-only\n' >> "$tmp_dir/file.txt"
git -C "$tmp_dir" commit -am main-only -q
git -C "$tmp_dir" update-ref refs/remotes/origin/main refs/heads/main

if git -C "$tmp_dir" merge-base --is-ancestor origin/main origin/dev; then
  echo "ERRO: setup de teste invalido; main deveria estar fora de dev"
  exit 1
fi

if (
  cd "$tmp_dir"
  bash "$repo_root/scripts/deploy/validate_branch_invariant.sh" origin/main origin/dev >/tmp/branch-invariant-block.log 2>&1
); then
  echo "ERRO: invariante nao bloqueou main fora de dev"
  exit 1
fi

echo "branch_invariant_self_test_ok=true"
