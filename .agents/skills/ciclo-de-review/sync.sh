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
# `readlink -f` e GNU: o BSD do macOS nao tem a flag, e ali a L23 (sem `|| true`)
# mataria o script sob `set -e` — falha de ambiente disfarcada de erro de skill.
# Resolucao POSIX equivalente: seguir o link com `readlink` simples (que existe
# nos dois) e canonizar o diretorio com `cd -P` + `pwd -P`, que e builtin.
# Achado do CodeRabbit.
resolver() {
  local alvo="$1" dir base
  # Um nivel de symlink basta aqui: a copia so pode apontar para a fonte ou nao.
  if [[ -L "$alvo" ]]; then
    local destino
    destino="$(readlink "$alvo")" || return 1
    # Destino relativo se resolve contra o diretorio do PROPRIO link.
    [[ "$destino" = /* ]] || destino="$(dirname "$alvo")/$destino"
    alvo="$destino"
  fi
  dir="$(dirname "$alvo")"
  base="$(basename "$alvo")"
  [[ -d "$dir" ]] || return 1
  printf %s "$(cd "$dir" && pwd -P)/$base"
}

if [[ -L "$copia" ]]; then
  alvo="$(resolver "$copia" || true)"
  fonte_real="$(resolver "$fonte")"
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
