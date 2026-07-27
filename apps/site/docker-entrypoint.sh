#!/bin/sh
# Pipeline de deploy do site, in-container (D049). DB via env.
set -e

# Migration SEMPRE roda, antes de qualquer decisão sobre rebuild (E018, 2026-07-27).
#
# Até esta data, `migrate` morava DEPOIS do guard de `dist` abaixo, que faz `exec pnpm run serve` —
# ou seja, todo restart de container existente pulava a migração, e só container novo (sem `dist`) ou
# `SITE_FORCE_REBUILD=true` aplicava. Como os containers do site sobem uma vez e ficam semanas no ar,
# `015_catalog_material_types` e `016_catalog_material_types_seed` ficaram mergeadas mas AUSENTES em
# beta e prod por 7 dias, sem erro em log, healthcheck ou CI — descoberto só quando o ingest do
# Downloads dependeu da taxonomia central (spec 088).
#
# Migrar aqui não custa o restart instantâneo que o guard protege: `db/migrate.ts` consulta
# `schema_migrations` e é no-op quando não há pendência. O que o guard evita é o REBUILD (export +
# astro build + pagefind), que continua condicional logo abaixo.
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
# desde então. Além de morto, era um pé de mina: `WP_BASE` tinha default apontando para
# `https://artificiorpg.com/wp-json/wp/v2`, que hoje é o próprio site Astro — ligar
# `SITE_IMPORT_ON_START=true` por engano faria o importer bater no próprio site, receber 404/HTML e,
# com `set -e`, derrubar o boot de produção.

echo "[site] export + astro build + pagefind"
pnpm run rebuild

echo "[site] serve :${PORT:-4322}"
exec pnpm run serve
