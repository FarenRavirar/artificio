#!/bin/sh
# Pipeline de deploy do links, in-container. DB requer DATABASE_URL.
# Resiliência: se o dist já existe (container reiniciando), serve direto — sem rebuild.
# Só rebuilda em container NOVO (deploy/recreate) ou LINKS_FORCE_REBUILD=true.
set -e

if [ -f dist/index.html ] && [ "${LINKS_FORCE_REBUILD:-false}" != "true" ]; then
  echo "[links] dist presente — serve direto (restart sem rebuild)"
  exec pnpm run serve
fi

echo "[links] migrate"
pnpm run migrate

# Seed idempotente (ON CONFLICT invite_url; vocabulário de tags + curados).
# Sem CLOUDINARY_* as logos ficam nulas (placeholder) — ok, sobem depois no rebuild/admin.
echo "[links] seed"
pnpm run seed || echo "[links] seed ignorado (erro não-fatal, tabelas podem já existir)"

echo "[links] astro build"
pnpm run rebuild

echo "[links] serve :${PORT:-4324}"
exec pnpm run serve
