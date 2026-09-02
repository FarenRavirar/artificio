#!/usr/bin/env bash
# Sincroniza a fonte da skill com a cópia que o Claude Code serve.
#
# Existe porque no Windows o `ln -s` do Git Bash NÃO cria symlink — copia. Editar
# só a fonte deixa a cópia congelada, e a skill roda uma versão antiga sem avisar:
# medido em 2026-09-02, a invocação carregou 141 linhas enquanto a fonte tinha 371.
#
# Uso: bash .agents/skills/ciclo-de-review/sync.sh
set -euo pipefail

raiz="$(git rev-parse --show-toplevel)"
fonte="$raiz/.agents/skills/ciclo-de-review/SKILL.md"
copia="$raiz/.claude/skills/ciclo-de-review/SKILL.md"

[ -f "$fonte" ] || { echo "fonte não encontrada: $fonte" >&2; exit 1; }

if [ -L "$copia" ]; then
  echo "ok — $copia é symlink de verdade, nada a copiar"
  exit 0
fi

mkdir -p "$(dirname "$copia")"
cp "$fonte" "$copia"

a=$(wc -l < "$fonte"); b=$(wc -l < "$copia")
[ "$a" = "$b" ] || { echo "divergiram após copiar: $a vs $b" >&2; exit 1; }
echo "sincronizado — $a linhas"
