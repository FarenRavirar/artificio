#!/bin/sh
# Pipeline de deploy do site, in-container (D049). DB via env.
set -e

# Migration roda antes de qualquer decisão sobre rebuild (E018, 2026-07-27).
#
# Até esta data `migrate` morava DEPOIS do guard de `dist` abaixo, que faz `exec pnpm run serve`, e
# todo restart de container existente pulava a migração. Migrar aqui não custa o restart instantâneo
# que o guard protege: `db/migrate.ts` consulta `schema_migrations` e é no-op sem pendência. O que o
# guard evita é o REBUILD (export + astro build + pagefind), que continua condicional logo abaixo.
#
# ATENÇÃO — isto NÃO garante schema em dia (achado do Codex, review da PR #219). O `migrate` lista
# `db/migrations/` de DENTRO da imagem: SQL que o deploy não levou não existe aqui, e o comando sai
# com `0 new` sem aplicar nada. Como o site é `auto_deploy_on_push: false`, merge/promote não
# deploya, e o container segue com a imagem antiga. Foi assim que `015`/`016` ficaram mergeadas e
# ausentes em beta e prod por 7 dias, sem erro em log, healthcheck ou CI.
#
# O alarme de verdade é `scripts/deploy/check_migration_drift.sh`, rodado pelo deploy após o
# health-check: compara disco contra `schema_migrations` e falha com rollback se divergirem.
echo "[site] migrate (store)"
pnpm run migrate

# Resiliência de restart (spec 009 R6): se o build já existe (mesmo container reiniciando por
# OOM/reboot/restart:always), serve DIRETO — sem rebuildar (restart instantâneo, zero downtime).
# Rebuild só em container NOVO (deploy/recreate) ou SITE_FORCE_REBUILD=true.
#
# `dist/.seed-build` distingue os dois casos (2026-08-17, sessão 26-08-17_1): a imagem agora traz um
# `dist` buildado do seed versionado (8 posts), e ele NÃO pode ser servido como se fosse o conteúdo
# real do banco (125 posts). Com a marca presente, o guard não dispara e o rebuild roda; sem ela, o
# `dist` veio de um rebuild real e o restart é instantâneo, como sempre foi.
if [ -f dist/index.html ] && [ ! -f dist/.seed-build ] && [ "${SITE_FORCE_REBUILD:-false}" != "true" ]; then
  echo "[site] dist presente — serve direto (restart sem rebuild)"
  exec pnpm run serve
fi

# O importador do WordPress foi REMOVIDO em 2026-07-27. O WP saiu do ar e o store Postgres é a fonte
# de verdade desde o cutover beta->principal (D074/spec 029); o import já estava desligado por padrão
# desde então.
#
# `SITE_IMPORT_ON_START` e `WP_BASE` não são mais lidas por este script nem pelo compose: definir
# qualquer uma hoje é simplesmente IGNORADO. Antes da remoção era diferente — `WP_BASE` tinha default
# apontando para `https://artificiorpg.com/wp-json/wp/v2`, que hoje é o próprio site Astro, e ligar
# `SITE_IMPORT_ON_START=true` faria o importer bater no próprio site, receber 404/HTML e, com
# `set -e`, derrubar o boot de produção. Esse risco deixou de existir junto com o importador.

# Rebuild com conteúdo FRESCO do banco. Só se chega aqui em duas situações: `SITE_FORCE_REBUILD=true`
# (pedido explícito) ou `dist` ausente na imagem — que o fail-fast do Dockerfile impede de acontecer.
#
# O rebuild NUNCA derruba o container (2026-08-17, sessão 26-08-17_1). Antes ele rodava sob `set -e`:
# qualquer falha — heap estourado, banco fora, SQL quebrado — matava o boot, e com `restart: always`
# o container repetia a mesma falha determinística para sempre, queimando um core da VM. Medido no
# incidente: 127% de CPU, `RestartCount` 8→31 em ~20 min, já depois do deploy ter feito rollback.
#
# Agora a falha degrada em vez de derrubar: serve-se o `dist` da imagem, que é conteúdo real e
# completo (só não traz posts publicados após o build da imagem). Site no ar com conteúdo levemente
# defasado é incomparavelmente melhor que site fora do ar em loop — e o erro fica no log, visível,
# em vez de escondido atrás de um container que reinicia sem parar.
echo "[site] export + astro build + pagefind"
# `rebuild_rc` capturado na hora: dentro do `elif` o `$?` já refletiria o teste da condição, e o log
# sairia com o código de saída errado — ruído justamente no momento em que alguém está diagnosticando.
rebuild_rc=0
pnpm run rebuild || rebuild_rc=$?
if [ "$rebuild_rc" -eq 0 ]; then
  echo "[site] rebuild OK — conteudo atualizado a partir do banco"
elif [ -f dist/index.html ] && [ ! -f dist/.seed-build ]; then
  echo "[site] AVISO: rebuild falhou (exit $rebuild_rc). Servindo o dist do build anterior."
  echo "[site] O site fica NO AR com o conteudo do ultimo rebuild bem-sucedido; posts publicados"
  echo "[site] depois dele nao aparecem ate isto ser corrigido. Diagnostique nos logs acima."
elif [ -f dist/index.html ]; then
  # Só o seed da imagem disponível: 8 posts contra 125 no banco. Servir isto calado leria como
  # perda de conteúdo, então o aviso é deliberadamente barulhento — mas o site fica NO AR, porque
  # site parcial com alarme é melhor que site fora do ar, e muito melhor que container em loop.
  echo "[site] ALERTA: rebuild falhou (exit $rebuild_rc) e o unico dist disponivel e o SEED DA IMAGEM."
  echo "[site] O site sobe com conteudo PARCIAL (seed versionado, ~8 posts) — NAO e o acervo completo."
  echo "[site] Isto NAO e perda de dados: o banco esta intacto e o conteudo volta assim que o"
  echo "[site] rebuild rodar. Corrija a causa da falha acima e refaca o deploy."
else
  echo "[site] ERRO: rebuild falhou e nao ha dist para servir. Container nao tem o que entregar."
  exit 1
fi

echo "[site] serve :${PORT:-4322}"
exec pnpm run serve
