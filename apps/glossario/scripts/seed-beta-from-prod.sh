#!/usr/bin/env bash
set -euo pipefail

# Restaura o banco beta a partir de produção e aplica anonimização básica.
# Uso:
#   ./scripts/seed-beta-from-prod.sh
# Ajustes opcionais por env:
#   PROD_DB_CONTAINER, BETA_DB_CONTAINER, DB_USER, DB_NAME, DUMP_DIR

PROD_DB_CONTAINER="${PROD_DB_CONTAINER:-glossario-db}"
BETA_DB_CONTAINER="${BETA_DB_CONTAINER:-glossario-beta-db}"
DB_USER="${DB_USER:-admin}"
DB_NAME="${DB_NAME:-glossario_v2}"
DUMP_DIR="${DUMP_DIR:-/tmp}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DUMP_FILE="${DUMP_DIR}/prod_seed_${TIMESTAMP}.sql"

echo "[M-006] Iniciando reset beta com snapshot da produção em ${TIMESTAMP}"
echo "[1/5] Gerando dump de produção..."
docker exec "${PROD_DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-acl > "${DUMP_FILE}"
echo "      Dump salvo em: ${DUMP_FILE}"

echo "[2/5] Resetando schema público no beta..."
docker exec "${BETA_DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "[3/5] Restaurando dump no beta..."
cat "${DUMP_FILE}" | docker exec -i "${BETA_DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}"

echo "[4/5] Anonimizando usuários não-admin no beta..."
docker exec "${BETA_DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "
  UPDATE public.users
     SET email = 'user_' || id::text || '@beta.test',
         username = 'beta_user_' || id::text
   WHERE role <> 'admin';
"

echo "[5/5] Seed concluído."
echo "      Arquivo de dump mantido em: ${DUMP_FILE}"
echo "      Remoção manual (opcional): rm -f ${DUMP_FILE}"

