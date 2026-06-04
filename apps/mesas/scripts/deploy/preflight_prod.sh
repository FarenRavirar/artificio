#!/usr/bin/env bash
set -euo pipefail

# Scripts roda no runner do github actions durante puxada de PR para main.

SSH_CONFIG=${SSH_CONFIG:-C:\\projetos\\config}
DB_CONTAINER_BETA=${DB_CONTAINER_BETA:-mesas-beta-db}
DB_CONTAINER_PROD=${DB_CONTAINER_PROD:-mesas-db}
DB_USER=${DB_USER:-admin}
DB_NAME=${DB_NAME:-mesas_rpg}
BETA_DEPLOY_LOCK=${BETA_DEPLOY_LOCK:-/tmp/mesas-beta-deploy.lock}

wait_for_db_container() {
  local container="$1"
  local lock_file="${2:-}"
  local lock_prefix=""

  if [ -n "$lock_file" ]; then
    lock_prefix="exec 9>${lock_file}; flock -w 300 9;"
  fi

  ssh -F "$SSH_CONFIG" faren "set -euo pipefail; ${lock_prefix} for i in \$(seq 1 60); do if docker inspect '${container}' >/dev/null 2>&1 && docker exec '${container}' pg_isready -U '${DB_USER}' -d '${DB_NAME}' >/dev/null 2>&1; then exit 0; fi; sleep 2; done; docker ps --filter name='${container}'; exit 1"
}

echo "Conectando em beta..."
wait_for_db_container "$DB_CONTAINER_BETA" "$BETA_DEPLOY_LOCK"
PG_BETA=$(ssh -F "$SSH_CONFIG" faren "docker exec ${DB_CONTAINER_BETA} psql -U ${DB_USER} -d ${DB_NAME} -tAc 'SELECT version();'")
DB_BETA=$(ssh -F "$SSH_CONFIG" faren "docker exec ${DB_CONTAINER_BETA} psql -U ${DB_USER} -d ${DB_NAME} -tAc 'SELECT migration_name FROM schema_migrations ORDER BY migration_name;' 2>/dev/null" || echo "")

echo "Conectando em prod..."
wait_for_db_container "$DB_CONTAINER_PROD"
PG_PROD=$(ssh -F "$SSH_CONFIG" faren "docker exec ${DB_CONTAINER_PROD} psql -U ${DB_USER} -d ${DB_NAME} -tAc 'SELECT version();'")
DB_PROD=$(ssh -F "$SSH_CONFIG" faren "docker exec ${DB_CONTAINER_PROD} psql -U ${DB_USER} -d ${DB_NAME} -tAc 'SELECT migration_name FROM schema_migrations ORDER BY migration_name;' 2>/dev/null" || echo "")

DISK_HEAD=$(find ./database -maxdepth 1 -name "migration_*.sql" -exec basename {} \; | sort)

REPORT_FILE="/tmp/preflight_report.md"

cat <<EOF > "$REPORT_FILE"
## Preflight Report

**PostgreSQL Beta:** $PG_BETA
**PostgreSQL Prod:** $PG_PROD

EOF

# Analisa Prod vs Head (bloqueante)
MISSING_PROD=0
cat <<EOF >> "$REPORT_FILE"
### Prod vs HEAD (Main pós-merge simulada)
EOF

for f in $DISK_HEAD; do
  if ! echo "$DB_PROD" | grep -Fxq "$f"; then
    echo "- $f (Pendente em Prod)" >> "$REPORT_FILE"
    MISSING_PROD=$((MISSING_PROD + 1))
  fi
done

for db_mig in $DB_PROD; do
  if ! echo "$DISK_HEAD" | grep -Fxq "$db_mig"; then
     # shellcheck disable=SC2129  # Múltiplos redirects intencionais para legibilidade
     echo "- **DRIFT FATAL (I2):** $db_mig existe no banco de Producao mas ausente na branch." >> "$REPORT_FILE"
     echo "" >> "$REPORT_FILE"
     echo "# :stop_sign: BLOCKED" >> "$REPORT_FILE"
     exit 1
  fi
done

cat <<EOF >> "$REPORT_FILE"
### Beta vs HEAD (Informativo)
EOF

for f in $DISK_HEAD; do
  if ! echo "$DB_BETA" | grep -Fxq "$f"; then
    echo "- $f (Pendente em Beta)" >> "$REPORT_FILE"
  fi
done

echo "" >> "$REPORT_FILE"

if [ "$MISSING_PROD" -gt 0 ]; then
  echo "# :warning: ATTENTION" >> "$REPORT_FILE"
else
  echo "# :white_check_mark: GO" >> "$REPORT_FILE"
fi

exit 0
