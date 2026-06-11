#!/usr/bin/env bash
set -euo pipefail

# Compara schema-only entre produção e beta na VM.
# Uso:
#   ./scripts/compare-schema-beta-prod.sh
#   PROD_DB_CONTAINER=glossario-db BETA_DB_CONTAINER=glossario-beta-db ./scripts/compare-schema-beta-prod.sh

PROD_DB_CONTAINER="${PROD_DB_CONTAINER:-glossario-db}"
BETA_DB_CONTAINER="${BETA_DB_CONTAINER:-glossario-beta-db}"
DB_USER="${DB_USER:-admin}"
DB_NAME="${DB_NAME:-glossario_v2}"
OUT_DIR="${OUT_DIR:-/tmp}"

TS="$(date +%Y%m%d_%H%M%S)"
PROD_SCHEMA_FILE="${OUT_DIR}/schema_prod_${TS}.sql"
BETA_SCHEMA_FILE="${OUT_DIR}/schema_beta_${TS}.sql"
DIFF_FILE="${OUT_DIR}/schema_diff_${TS}.txt"

echo "[M-000] Exportando schema da produção (${PROD_DB_CONTAINER})..."
docker exec "${PROD_DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --schema-only > "${PROD_SCHEMA_FILE}"

echo "[M-000] Exportando schema do beta (${BETA_DB_CONTAINER})..."
docker exec "${BETA_DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --schema-only > "${BETA_SCHEMA_FILE}"

echo "[M-000] Gerando diff..."
if diff -u "${PROD_SCHEMA_FILE}" "${BETA_SCHEMA_FILE}" > "${DIFF_FILE}"; then
  echo "[M-000] OK: schema alinhado (diff vazio)."
else
  echo "[M-000] ATENÇÃO: divergências detectadas."
  echo "Arquivo de diff: ${DIFF_FILE}"
  exit 2
fi

echo "[M-000] Arquivos gerados:"
echo "  - ${PROD_SCHEMA_FILE}"
echo "  - ${BETA_SCHEMA_FILE}"
echo "  - ${DIFF_FILE}"

