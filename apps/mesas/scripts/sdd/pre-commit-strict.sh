#!/usr/bin/env bash
# Hook opt-in para trabalho SDD. Para ativar:
#   cp scripts/sdd/pre-commit-strict.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit

set -euo pipefail

# Bloqueia commit se houver arquivos modificados NÃO staged
UNSTAGED=$(git diff --name-only)
if [ -n "$UNSTAGED" ]; then
  echo "❌ COMMIT BLOQUEADO por regra SDD:"
  echo "Há arquivos modificados fora do stage:"
  while IFS= read -r line; do echo "  - $line"; done <<< "$UNSTAGED"
  echo ""
  echo "Trabalho SDD exige commits atômicos. Staging deve ser EXPLÍCITO."
  echo "Decida: ou 'git add <específico>' ou 'git stash' os não-relacionados."
  exit 1
fi

# Bloqueia commit se há mais de 5 arquivos staged (exceto polish)
STAGED_COUNT=$(git diff --cached --name-only | wc -l)
COMMIT_MSG_FILE="${1:-/dev/null}"
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE" 2>/dev/null || echo "")

if [ "$STAGED_COUNT" -gt 5 ]; then
  if ! echo "$COMMIT_MSG" | grep -qi "polish\|docs(\|initial\|bulk"; then
    echo "⚠️  COMMIT com $STAGED_COUNT arquivos staged."
    echo "Trabalho SDD normalmente é atômico (1-3 arquivos)."
    echo "Se este é um commit legítimo de bulk (docs, polish, initial),"
    echo "incluir palavra-chave no commit message: polish, docs(, initial, bulk."
    echo "Caso contrário, revisar staging."
    exit 1
  fi
fi

exit 0
