#!/bin/sh
# Pipeline de deploy do site, in-container (D049): migra o store, importa do WP, exporta,
# builda o Astro estático e sobe o server (Express serve dist/ + admin). DB+WP via env.
set -e

echo "[site] migrate (store)"
pnpm run migrate

if [ "${SITE_IMPORT_ON_START:-true}" = "true" ]; then
  echo "[site] import WP REST -> store"
  pnpm run import
else
  echo "[site] import pulado (SITE_IMPORT_ON_START=false)"
fi

echo "[site] export + astro build + pagefind"
pnpm run rebuild

echo "[site] serve :${PORT:-4322}"
exec pnpm run serve
