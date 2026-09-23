#!/usr/bin/env bash
# Instala o pnpm via corepack, com retry. Uso: bash scripts/ci/setup-pnpm.sh
# Rodar da raiz do repo, depois do checkout.
#
# A versao NAO e argumento: `corepack install` le o `packageManager` do
# package.json da raiz, que e a fonte unica. Antes o `11.8.0` estava repetido
# nos tres workflows alem do package.json, e atualizar o pnpm exigia lembrar dos
# quatro. Com `corepack enable`, o shim `pnpm` resolve a mesma versao em
# qualquer passo seguinte dentro do repo.
#
# Por que o retry existe: o corepack baixa o pnpm pelo undici embutido no Node,
# e esse undici tem um bug intermitente — se o socket fecha com o parser HTTP
# pausado, `parser.finish()` dispara `AssertionError: assert(!this.paused)` fora
# de qualquer try/catch e o processo morre (nodejs/undici#5360; corrigido no
# undici 8.4.1). Derrubou o job `CI mesas` da PR #332 em 2026-09-23 antes de
# qualquer build ou teste rodar.
#
# Medido em 2026-09-23 no client-h1.js que cada Node embute: a assertion ainda
# existe no 22.23.2 (undici 6.28.0), no 24.20.0 (7.29.0) e no 24.21.0 (7.29.1) —
# o relato de que o 24.21.0 corrige e falso. So o 26.10.0 (undici 8.10.2, linha
# Current) nao tem. Nao ha LTS corrigido para trocar; o corepack roda no Node
# padrao da imagem (22.23.2 na ubuntu24/20260920.314), antes do setup-node.
#
# `pnpm/setup` NAO resolve: baixa o binario com `fetch` global (mesmo undici) e
# sem retry (get-pnpm/src/registry.ts:184). Criterio de saida deste retry: o
# Node que roda o corepack no CI trazer undici >= 8.4.1.
#
# O processo morre inteiro, entao o retry tem de ser por fora, no shell. Tres
# tentativas com espera crescente; falha real (versao inexistente, registry
# fora do ar) continua falhando, so que depois da terceira.
set -euo pipefail

corepack enable

for tentativa in 1 2 3; do
  if corepack install; then
    exit 0
  fi
  if [ "$tentativa" -lt 3 ]; then
    espera=$((tentativa * 5))
    echo "corepack install falhou (tentativa ${tentativa}/3); nova tentativa em ${espera}s" >&2
    sleep "$espera"
  fi
done

echo "ERRO: corepack install falhou 3 vezes (versao do packageManager do package.json)" >&2
exit 1
