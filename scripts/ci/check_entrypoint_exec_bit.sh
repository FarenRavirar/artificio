#!/usr/bin/env bash
# Guard (spec 009 R2): scripts referenciados em ENTRYPOINT/CMD ["./x.sh"] num Dockerfile
# devem estar 100755 no git, senao o container falha com "permission denied" no deploy.
set -euo pipefail

status=0
found_any=0

while IFS= read -r df; do
  [ -z "$df" ] && continue
  dir=$(dirname "$df")
  # Forma exec JSON: ENTRYPOINT ["./algo.sh", ...] ou CMD ["./algo.sh", ...]
  refs=$(grep -hoE '(ENTRYPOINT|CMD)[^]]*"\./[^"]+\.sh"' "$df" 2>/dev/null \
    | grep -oE '"\./[^"]+\.sh"' | tr -d '"' | sed 's|^\./||' | sort -u || true)
  [ -z "$refs" ] && continue
  while IFS= read -r script; do
    [ -z "$script" ] && continue
    found_any=1
    path="$dir/$script"
    mode=$(git ls-files -s -- "$path" 2>/dev/null | awk '{print $1}')
    if [ -z "$mode" ]; then
      echo "::warning file=$df::ENTRYPOINT/CMD referencia '$script' nao trackeado no git ($path)"
      continue
    fi
    if [ "$mode" != "100755" ]; then
      echo "::error file=$path::script de entrypoint sem bit exec (mode=$mode). Rode: git add --chmod=+x $path"
      status=1
    else
      echo "ok: $path (100755)"
    fi
  done <<< "$refs"
done < <(git ls-files '*Dockerfile' 'Dockerfile' '*.Dockerfile')

if [ "$found_any" = "0" ]; then
  echo "nenhum ENTRYPOINT/CMD com ./*.sh encontrado; nada a checar."
fi
exit "$status"
