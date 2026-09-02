#!/usr/bin/env bash
# Sincroniza a fonte da skill com a copia que o Claude Code serve.
#
# Existe porque no Windows o `ln -s` do Git Bash NAO cria symlink - copia. Editar
# so a fonte deixa a copia congelada, e a skill roda uma versao antiga sem avisar:
# medido em 2026-09-02, a invocacao carregou 141 linhas enquanto a fonte tinha 371.
#
# Uso: bash .agents/skills/ciclo-de-review/sync.sh
set -euo pipefail

raiz="$(git rev-parse --show-toplevel)"
fonte="$raiz/.agents/skills/ciclo-de-review/SKILL.md"
copia="$raiz/.claude/skills/ciclo-de-review/SKILL.md"

[[ -f "$fonte" ]] || { echo "fonte nao encontrada: $fonte" >&2; exit 1; }

# `-L` sozinho so diz que E um symlink: um link QUEBRADO, ou apontando para outro
# SKILL.md, passava nessa condicao e o script saia 0 sem sincronizar nada -
# exatamente a falha silenciosa que ele existe para evitar. Resolver o alvo e
# comparar com a fonte. Achado do CodeRabbit na PR #304.
if [[ -L "$copia" ]]; then
  alvo="$(readlink -f "$copia" 2>/dev/null || true)"
  fonte_real="$(readlink -f "$fonte")"
  if [[ "$alvo" == "$fonte_real" ]]; then
    echo "ok - $copia e symlink para a fonte, nada a copiar"
    exit 0
  fi
  echo "symlink DIVERGENTE em $copia" >&2
  echo "  aponta para: ${alvo:-<quebrado>}" >&2
  echo "  deveria ser: $fonte_real" >&2
  echo "  remova-o a mao se a intencao e passar a copiar." >&2
  exit 1
fi

mkdir -p "$(dirname "$copia")"

# Escrita ATOMICA: copiar direto sobre o destino deixa uma janela em que a copia
# esta truncada, e uma invocacao da skill nesse instante carrega meio arquivo.
# `mv` no mesmo diretorio e atomico. Achado do CodeRabbit na PR #304.
tmp="$(mktemp "$(dirname "$copia")/.SKILL.md.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
cp "$fonte" "$tmp"
mv -f "$tmp" "$copia"
trap - EXIT

# Comparar o CONTEUDO, nao a contagem de linhas: dois arquivos diferentes com o
# mesmo numero de linhas passavam como sincronizados. Achado do CodeRabbit.
if ! cmp -s "$fonte" "$copia"; then
  echo "divergiram apos copiar - conteudo diferente" >&2
  exit 1
fi
echo "sincronizado - $(wc -l < "$copia") linhas, conteudo identico"
