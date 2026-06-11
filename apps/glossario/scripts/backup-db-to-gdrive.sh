#!/usr/bin/env bash
set -euo pipefail

# Backup diário dos bancos beta/prod para Google Drive com retenção dos N mais recentes.
# Pré-requisitos:
#   - docker
#   - rclone configurado com um remote Google Drive (ex.: gdrive:)
#
# Uso:
#   ./scripts/backup-db-to-gdrive.sh
#
# Variáveis de ambiente opcionais:
#   PROD_DB_CONTAINER   (default: glossario-db)
#   BETA_DB_CONTAINER   (default: glossario-beta-db)
#   DB_USER             (default: admin)
#   DB_NAME             (default: glossario_v2)
#   LOCAL_BACKUP_DIR    (default: /var/backups/glossario-db)
#   RETENTION_COUNT     (default: 3)
#   GDRIVE_REMOTE       (default: gdrive)
#   GDRIVE_FOLDER       (default: glossario_rpg_artificio/backups)
#   BACKUP_LOG_FILE     (default: /var/log/glossario-db-backup.log)

PROD_DB_CONTAINER="${PROD_DB_CONTAINER:-glossario-db}"
BETA_DB_CONTAINER="${BETA_DB_CONTAINER:-glossario-beta-db}"
DB_USER="${DB_USER:-admin}"
DB_NAME="${DB_NAME:-glossario_v2}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-/var/backups/glossario-db}"
RETENTION_COUNT="${RETENTION_COUNT:-3}"
GDRIVE_REMOTE="${GDRIVE_REMOTE:-gdrive}"
GDRIVE_FOLDER="${GDRIVE_FOLDER:-glossario_rpg_artificio/backups}"
BACKUP_LOG_FILE="${BACKUP_LOG_FILE:-/var/log/glossario-db-backup.log}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_BASENAME="glossario_backup_${TIMESTAMP}"
REMOTE_PATH="${GDRIVE_REMOTE}:${GDRIVE_FOLDER}"

mkdir -p "${LOCAL_BACKUP_DIR}"
touch "${BACKUP_LOG_FILE}"

log() {
  local message="$1"
  local now
  now="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[${now}] ${message}" | tee -a "${BACKUP_LOG_FILE}"
}

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    log "ERRO: comando obrigatório não encontrado: ${cmd}"
    exit 1
  fi
}

cleanup_temp() {
  if [[ -n "${TMP_DIR:-}" && -d "${TMP_DIR}" ]]; then
    rm -rf "${TMP_DIR}"
  fi
}
trap cleanup_temp EXIT

rotate_remote_backups() {
  local remote="$1"
  local keep="$2"
  local prefix='glossario_backup_'
  mapfile -t remote_files < <(rclone lsf "${remote}" --files-only | grep "^${prefix}" | sort || true)

  local total="${#remote_files[@]}"
  if (( total <= keep )); then
    return
  fi

  local to_delete=$((total - keep))
  local i
  for ((i = 0; i < to_delete; i++)); do
    local old_file="${remote_files[$i]}"
    log "Rotação remota: removendo ${old_file}"
    rclone deletefile "${remote}/${old_file}"
  done
}

rotate_local_backups() {
  local dir="$1"
  local keep="$2"
  local pattern='glossario_backup_*.tar.gz'

  mapfile -t local_files < <(find "${dir}" -maxdepth 1 -type f -name "${pattern}" -printf '%f\n' | sort || true)
  local total="${#local_files[@]}"

  if (( total <= keep )); then
    return
  fi

  local to_delete=$((total - keep))
  local i
  for ((i = 0; i < to_delete; i++)); do
    local old_file="${local_files[$i]}"
    log "Rotação local: removendo ${old_file}"
    rm -f "${dir}/${old_file}"
  done
}

require_command docker
require_command rclone

TMP_DIR="$(mktemp -d)"
SNAPSHOT_DIR="${TMP_DIR}/${BACKUP_BASENAME}"
ARCHIVE_FILE="${LOCAL_BACKUP_DIR}/${BACKUP_BASENAME}.tar.gz"

mkdir -p "${SNAPSHOT_DIR}"

log "Iniciando backup ${BACKUP_BASENAME}"
log "Gerando dump de produção (${PROD_DB_CONTAINER})..."
docker exec "${PROD_DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-acl -Fc > "${SNAPSHOT_DIR}/prod.dump"

log "Gerando dump de beta (${BETA_DB_CONTAINER})..."
docker exec "${BETA_DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-acl -Fc > "${SNAPSHOT_DIR}/beta.dump"

log "Gerando backup de roles/globals..."
docker exec "${PROD_DB_CONTAINER}" pg_dumpall -U "${DB_USER}" --globals-only > "${SNAPSHOT_DIR}/globals.sql"

sha256sum "${SNAPSHOT_DIR}/prod.dump" "${SNAPSHOT_DIR}/beta.dump" "${SNAPSHOT_DIR}/globals.sql" > "${SNAPSHOT_DIR}/SHA256SUMS"

log "Compactando snapshot..."
tar -C "${TMP_DIR}" -czf "${ARCHIVE_FILE}" "${BACKUP_BASENAME}"

log "Enviando backup para Google Drive (${REMOTE_PATH})..."
rclone copy "${ARCHIVE_FILE}" "${REMOTE_PATH}"

log "Aplicando rotação remota (manter ${RETENTION_COUNT})..."
rotate_remote_backups "${REMOTE_PATH}" "${RETENTION_COUNT}"

log "Aplicando rotação local (manter ${RETENTION_COUNT})..."
rotate_local_backups "${LOCAL_BACKUP_DIR}" "${RETENTION_COUNT}"

log "Backup concluído com sucesso: ${ARCHIVE_FILE}"

