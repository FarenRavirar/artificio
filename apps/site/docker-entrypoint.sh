#!/bin/sh
# Pipeline de deploy do site, in-container (D049). DB+WP via env.
# Resiliência de restart (spec 009 R6): se o build ja existe (mesmo container reiniciando por
# OOM/reboot/restart:always), serve DIRETO — sem re-importar WP nem rebuildar (restart instantaneo,
# zero downtime). Rebuild so em container NOVO (deploy/recreate) ou SITE_FORCE_REBUILD=true.
set -e

if [ -f dist/index.html ] && [ "${SITE_FORCE_REBUILD:-false}" != "true" ]; then
  echo "[site] dist presente — serve direto (restart sem rebuild)"
  exec pnpm run serve
fi

echo "[site] migrate (store)"
pnpm run migrate

# Import-on-start = OFF por padrao (cutover beta->principal concluido, D074/spec 029): a migracao WP
# acabou e o store/DB e a fonte de verdade. Rodar import com o WP/Hostinger morto (~EOL 2026-06-20)
# falharia no WP REST e, com `set -e`, derrubaria o boot do site principal. So liga via opt-in
# explicito SITE_IMPORT_ON_START=true (com o WP ainda vivo).
if [ "${SITE_IMPORT_ON_START:-false}" = "true" ]; then
  echo "[site] import WP REST -> store (opt-in)"
  pnpm run import
else
  echo "[site] import pulado (default pos-cutover; export usa o que ja esta no store)"
fi

echo "[site] export + astro build + pagefind"
pnpm run rebuild

echo "[site] serve :${PORT:-4322}"
exec pnpm run serve
