#!/usr/bin/env bash
# Check de drift de migrations — compara o que existe em DISCO com o que o BANCO registra.
#
# Por que existe (E018, achado de review da PR #219 pelo Codex): módulo cujo banco NÃO é migrado pelo
# runner do monorepo (`apply_required_migrations.sh`) não tinha nenhum alarme de defasagem. O caso
# concreto foi o `apps/site`, que migra no próprio entrypoint do container:
#
#   - `site` tem `auto_deploy_on_push: false` (dispatch-only), então merge/promote NÃO deploya;
#   - o container existente roda a IMAGEM antiga, e o `migrate` de dentro dela lista `db/migrations/`
#     da imagem — não enxerga SQL que o deploy não levou;
#   - historicamente `apply_required_migrations.sh` era chamado com o diretório `database`, que no
#     site não existe, e saía verde; desde a spec 090 o workflow pula esse runner para o site e o
#     próprio runner falha fechado quando um diretório obrigatório não existe;
#
# Resultado: `015` e `016` ficaram mergeadas e AUSENTES em beta e prod por 7 dias, sem erro em log,
# healthcheck ou CI. Mover `migrate` para antes do guard de `dist` no entrypoint (mesma PR) melhora o
# caso do container recriado, mas NÃO fecha o buraco: sem deploy, o arquivo novo nunca chega à imagem.
# Este check é o alarme que faltava.
#
# Genérico de propósito: aceita o nome da coluna e o glob de arquivo, porque os módulos divergem —
# o runner do monorepo usa `schema_migrations(migration_name)` com `migration_*.sql`, enquanto o site
# usa `schema_migrations(version)` com `NNN_nome.sql` e versão sem a extensão.
#
# Uso:
#   bash scripts/deploy/check_migration_drift.sh <db_service> <db_name> <db_user> <migrations_dir> \
#        [coluna] [glob] [strip_ext]
#
# Saída: 0 quando disco e banco batem; 1 em qualquer divergência (fail-closed).
set -euo pipefail

DB_SERVICE="${1:?db_service é obrigatório}"
DB_NAME="${2:?db_name é obrigatório}"
DB_USER="${3:?db_user é obrigatório}"
MIGRATIONS_DIR="${4:?migrations_dir é obrigatório}"
COLUMN="${5:-migration_name}"
GLOB="${6:-migration_*.sql}"
STRIP_EXT="${7:-false}"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "::error::[drift] diretório ausente: $MIGRATIONS_DIR — não é possível provar conformidade." >&2
  exit 1
fi

# `|| true` porque a tabela pode não existir num banco recém-criado; nesse caso `in_db` fica vazio e
# tudo em disco aparece como pendente, que é a leitura correta para banco novo.
in_db=$(docker exec "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT ${COLUMN} FROM schema_migrations ORDER BY ${COLUMN}" 2>/dev/null || true)

on_disk=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name "$GLOB" -type f -exec basename {} \; | sort)
if [[ "$STRIP_EXT" == "true" ]]; then
  on_disk=$(printf '%s\n' "$on_disk" | sed 's/\.sql$//')
fi

missing_in_db=""
for file in $on_disk; do
  echo "$in_db" | grep -Fxq "$file" || missing_in_db+="  - $file"$'\n'
done

missing_on_disk=""
for mig in $in_db; do
  echo "$on_disk" | grep -Fxq "$mig" || missing_on_disk+="  - $mig"$'\n'
done

status=0

if [[ -n "$missing_in_db" ]]; then
  echo "::error::[drift] ${DB_SERVICE}/${DB_NAME}: migration em disco que o banco NÃO registra:"
  printf '%s' "$missing_in_db"
  echo "  → o schema está defasado. Aplicar antes de considerar o deploy concluído."
  status=1
fi

# Direção inversa: banco à frente do disco. Costuma indicar hotfix manual via SSH que não voltou ao
# repositório — bloqueia o próximo deploy automático se não for reconciliado.
if [[ -n "$missing_on_disk" ]]; then
  echo "::error::[drift] ${DB_SERVICE}/${DB_NAME}: migration registrada no banco e AUSENTE no disco:"
  printf '%s' "$missing_on_disk"
  echo "  → reconciliar com scripts/deploy/reconcile_migrations.sh antes de seguir."
  status=1
fi

if [[ "$status" -eq 0 ]]; then
  total=$(printf '%s\n' "$on_disk" | grep -c . || true)
  echo "[drift] ${DB_SERVICE}/${DB_NAME}: disco e banco batem (${total} migrations)."
fi

exit "$status"
