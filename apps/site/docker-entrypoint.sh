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
if [ -f dist/index.html ] && [ "${SITE_FORCE_REBUILD:-false}" != "true" ]; then
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

echo "[site] export + astro build + pagefind"
pnpm run rebuild

echo "[site] serve :${PORT:-4322}"
exec pnpm run serve
