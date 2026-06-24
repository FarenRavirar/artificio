# Sessão 26-06-24_1 — infra: guard de migration online-safe (spec 050)

- **Data:** 2026-06-24
- **App/escopo:** infra / `scripts/deploy/` (guard de migration)
- **Gate:** D (mesas)
- **Spec:** `specs/050-infra-migration-guard-online-safe/`
- **Objetivo:** planejar correção do falso-positivo do guard `online-safe` que abortou o deploy prod de mesas + tratar o débito de duplicação do guard. **Claude planeja; DeepSeek implementa.**

## Vínculos
- Origem: deploy prod mesas `run 28125222995` (rollback automático).
- Débito de duplicação já registrado: `BL-DEP-MESAS-LEGACY-SCRIPTS` (backlog) + `specs/035-infra-small-debts/` R0/T6.
- Novo débito: `BL-MESAS-MIGRATION-GUARD-FALSE-POSITIVE`.

## O que foi feito (planejamento + registro)
1. Diagnóstico completo (não corrigido — fora do escopo do mantenedor para esta sessão):
   - Causa raiz: `validate_sql_against_class` (`scripts/deploy/lib_migrations.sh:59`) usa `\bDROP\b` largo demais; barra `DROP NOT NULL`/`DROP CONSTRAINT` de `migration_128` (não destrutivos).
   - Beta passou porque 128/129 já estavam em `schema_migrations` (aplicadas 2026-06-22 por `ci:agent@opencode`); prod parou em 127 e tentou aplicar 128 pela 1ª vez → bloqueio.
   - Achado secundário: 2 cópias divergentes do guard; a ativa é `scripts/deploy/` (flock). `apps/mesas/scripts/deploy/*` são órfãos (= `BL-DEP-MESAS-LEGACY-SCRIPTS`).
2. Spec 050 criada conforme skill `new-spec`: `spec.md` (o quê/porquê + requisitos R1-R7), `plan.md` (regex/arquivos/validação), `tasks.md` (Fases A-D; Fase C dedicada à duplicação cruzando spec 035).
3. Estado de prod: intacto (rollback restaurou 127 + código anterior). Mesas 049 **não** em prod. Beta OK.

## Backlog
- ✅ Atualizado: `BL-MESAS-MIGRATION-GUARD-FALSE-POSITIVE` (novo) + `BL-DEP-MESAS-LEGACY-SCRIPTS` (referência à spec 050).

## Critério de conclusão (da sessão de planejamento)
- [x] Spec 050 com 3 arquivos no template do skill.
- [x] Débito de duplicação verificado contra spec 026/035 e amarrado na Fase C.
- [x] Bug registrado no backlog no mesmo turno.
- [x] project-state atualizado.

## Pendências (para DeepSeek / mantenedor)
- Implementação das Fases A-D (DeepSeek).
- Deletar órfãos (T12) e re-deploy prod (T19) = aprovação nominal do mantenedor.

## Retomada da sessão (2026-06-24) — Investigação Fase F (T26-T29)

> Fases A-E foram implementadas e comitadas (`8395c04` na branch `infra/050-migration-guard`).
> Fase F (T26-T29) pendente — tasks marcadas como `[ ]`. Iniciando investigação item a item.

### Estado atual do repositório
- **Branch:** `infra/050-migration-guard`
- **Último commit:** `8395c04 fix(050): corrige guard de migration online-safe + consolida reconcile canônico` (Fases A-E)
- **Working tree sujo:** `tasks.md` modificado (Fase F adicionada), `backlog.md` modificado (DEB-050-01 a -05), `debitos.md` novo (untracked)
- **reviews.md:** não existe na spec 050
- **PR:** nenhum aberto no momento

### T26 — Investigação completa

**Task:** Corrigir DEB-050-01 (smells SonarCloud nos 3 scripts shell novos)

**Origem:** SonarCloud no PR #95 (2026-06-24) — smells de estilo/manutenção.

**Evidências no código real** (verdade material, não doc):

**1. `scripts/deploy/reconcile_migrations.sh` — `[`→`[[`:**
- L19: `if [ -n "${MOCK_QUERY_RESULT:-}" ]` → ainda usa `[` ⚠️
- L30: `if [ -n "${MOCK_MARK_FILE:-}" ]` → ainda usa `[` ⚠️
- L73: `[ -n "$line" ]` → ainda usa `[` ⚠️
- L90: `[ "$arg" = "--force" ]` → ainda usa `[` ⚠️
- L94: `if [[ "$compose_file" == *prod* ]] && [ "$force" != true ]` → misto, `[` presente ⚠️
- L106: `if [ ! -f "$migrations_dir/$version" ]` → ainda usa `[` ⚠️
- L138: `[ $# -lt 1 ]` → ainda usa `[` ⚠️

**`>&2` já corrigido neste arquivo:** linhas L95, L101, L130 já têm `>&2` — provável que o debito linha L103 esteja com numeração desatualizada. **Não há `>&2` smell pendente neste arquivo.**

**2. `scripts/deploy/test_migration_guard.sh` — `[`→`[[`:**
- L25: `if [ "$rc" -eq 0 ]` → ainda usa `[` ⚠️
- L40: `if [ "$rc" -ne 0 ]` → ainda usa `[` ⚠️
- L102: `if [ "$failed" -gt 0 ]` → ainda usa `[` ⚠️

**`>&2` ausente:**
- L103: `echo "::error::$failed teste(s) falharam no migration guard self-test"` → **sem `>&2`** ⚠️

**3. `scripts/deploy/test_migration_reconcile.sh` — `[`→`[[`:**
- L45: `if [ "$rc" -eq 0 ]` → ainda usa `[` ⚠️
- L58: `if [ "$rc" -ne 0 ]` → ainda usa `[` ⚠️
- L132: `if [ "$failed" -gt 0 ]` → ainda usa `[` ⚠️

**`>&2` ausente:**
- L133: `echo "::error::$failed teste(s) falharam no migration reconcile self-test"` → **sem `>&2`** ⚠️

**Constantes (literais repetidos):**
- L118: `"migration_200_test.sql"` — literal usado 5× no arquivo, sem constante ⚠️
- L125: `"compose.yml"` — literal usado 5× no arquivo, sem constante ⚠️

**Status T26:** ❌ **Não implementado.** Todos os smells do DEB-050-01 estão presentes no código. Nenhuma correção aplicada.

**Achado durante investigação:** a numeração de linhas do `>&2` em `reconcile_migrations.sh` no debitos.md (L103) diverge do código real — a linha já tinha `>&2` (talvez de versão anterior do arquivo). Isso deve ser notado durante a correção.

**Dependências com outras tasks:**
- T26 mexe em `reconcile_migrations.sh`, `test_migration_guard.sh`, `test_migration_reconcile.sh` — mesmos arquivos de T27 e T29 (parcialmente). Ideal fazer em passada única para evitar conflito de linhas.
- T28 mexe em `lib_migrations.sh` — arquivo separado, sem conflito.

### T27 — Investigação completa

**Task:** Corrigir DEB-050-03 (bug parsing de `--force` em `cmd_mark_applied`)

**Arquivo:** `scripts/deploy/reconcile_migrations.sh:83-91`

**Bug confirmado no código real** — linha 84:
```bash
local version="$1" compose_file="$2" db_service="$3" db_user="${4:-admin}" db_name="${5:-mesas_rpg}"
```
... e linha 89:
```bash
for arg in "${@:6}"; do
    [ "$arg" = "--force" ] && force=true
```

`--force` é procurado apenas a partir do 6º argumento (`${@:6}`). Na chamada `--mark-applied <v> <compose-prod> <db_service> --force` (4 args), `--force` cai na posição 4 → vira `db_user="--force"` e o scan posicional não o encontra → `force=false` → gate R9a rejeita mesmo em prod com `--force`.

**Status T27:** ❌ **Não implementado.** Bug presente.

**Impacto:** **Major / correção.** Quebra o caminho de emergência de reconcile em produção. Operador precisa saber passar `admin mesas_rpg` extras antes do `--force`, o que não é documentado nem intuitivo.

**Dependências:** T27 mexe em `reconcile_migrations.sh` + `test_migration_reconcile.sh` — mesmos arquivos de T26 e T29. Conflito potencial se aplicado separadamente.

### T28 — Investigação completa

**Task:** Corrigir DEB-050-04 (strip de comentário multilinha)

**Arquivo:** `scripts/deploy/lib_migrations.sh:62`

**Bug confirmado no código real:**
```bash
if sed -e 's/--.*//' -e 's/\/\*.*\*\///g' "$filepath" | grep -Eiq '...'
```
O `sed s/\/\*.*\*\///g` é line-based (`.` não cruza `\n`). Comentário `/* DROP TABLE */` multilinha:
```sql
/* nota:
   DROP TABLE x;
*/
```
teria `DROP TABLE x` numa linha intermediária sem ser removido → falso-positivo persiste.

**Status T28:** ❌ **Não implementado.** Bug presente.

**Impacto:** **Major / correção.** Mesma classe do bug que originou a spec 050 — falso-positivo do guard online-safe persiste para comentários multilinha.

**Dependências:** T28 mexe em `lib_migrations.sh` + `test_migration_guard.sh` — arquivo diferente dos demais (lib_migrations.sh não é tocado por T26/T27/T29). Pode ser implementado em paralelo sem conflito.

### T29 — Investigação completa

**Task:** Corrigir DEB-050-05 (`--list` engole falhas de docker/psql)

**Arquivo:** `scripts/deploy/reconcile_migrations.sh:68-78`

**Bug confirmado no código real:**
```bash
cmd_list() {
  ...
  while IFS= read -r line; do
    [ -n "$line" ] && echo "  $line"
  done < <(_reconcile_query ...)      # ← process substitution perde exit code

  list_pending_by_set_diff ... || true  # ← || true engole erro
}
```

1. Process substitution `< <(cmd)` não propaga exit code — se `_reconcile_query` falhar, o loop simplesmente não itera e o erro some.
2. `|| true` em `list_pending_by_set_diff` engole erro de docker/psql — falha vira "sucesso com saída vazia".

**Achado extra:** `query_schema_migrations` em `lib_migrations.sh:77` também usa `|| true`:
```bash
docker compose ... psql ... < /dev/null 2>/dev/null || true
```
Isso afeta `list_pending_by_set_diff` também. T29 foca em `cmd_list`, mas o padrão `|| true` em `query_schema_migrations` é relacionado.

**Status T29:** ❌ **Não implementado.** Bug presente.

**Impacto:** **Major / confiabilidade.** Operador acha que não há migrations pendentes quando na verdade o comando falhou. Mascara problemas de conexão/DB.

**Dependências:** T29 mexe em `reconcile_migrations.sh` + `test_migration_reconcile.sh` — mesmos arquivos de T26 e T27. Potencial conflito de linha. Ideal aplicar junto com T26 e T27.

### Análise cruzada de dependências

| Task | Arquivos tocados | Conflita com |
|------|-----------------|--------------|
| T26 | reconcile_migrations.sh, test_migration_guard.sh, test_migration_reconcile.sh | T27, T29 (mesmos arquivos) |
| T27 | reconcile_migrations.sh, test_migration_reconcile.sh | T26, T29 (mesmos arquivos) |
| T28 | lib_migrations.sh, test_migration_guard.sh | Nenhum (arquivos exclusivos) |
| T29 | reconcile_migrations.sh, test_migration_reconcile.sh | T26, T27 (mesmos arquivos) |

**Recomendação:** T26+T27+T29 devem ser aplicados na **mesma passada** para evitar conflitos de linha (todas tocam `reconcile_migrations.sh` e `test_migration_reconcile.sh`). T28 pode ser aplicado separadamente ou junto (arquivos exclusivos) sem risco de conflito.

### Risco de duplicação de código
Nenhum risco identificado. As 4 tasks corrigem bugs específicos e smells localizados, sem introduzir nova lógica duplicada. T26 padroniza estilo (best-practice), T27 corrige parsing posicional, T28 estende strip de comentário, T29 remove `|| true` — todos são correções pontuais sem criar duplicação.

## project-state
- Atualizar: spec 050 planejada; mesas bloqueado para prod até guard corrigido + re-deploy gated.
- **Fase F (T26-T29):** investigada e **IMPLEMENTADA** (2026-06-24). Todos os bugs/smells corrigidos e validados.

### Implementação Fase F — T26+T27+T29 (passada única) + T28

**Arquivos alterados:**
| Arquivo | Mudanças |
|---------|----------|
| `scripts/deploy/lib_migrations.sh:62` | T28: pipeline `perl -0777 -pe 's{/\*.*?\*/}{}gs'` para strip de bloco multilinha + `sed 's/--.*//'` |
| `scripts/deploy/reconcile_migrations.sh:L19,30,73,94,106,138` | T26: 6× `[`→`[[` |
| `scripts/deploy/reconcile_migrations.sh:L18-22` | T29: `MOCK_QUERY_FAIL` stub adicionado em `_reconcile_query` |
| `scripts/deploy/reconcile_migrations.sh:L72-93` | T29: `cmd_list` reescrito — captura output em variável + propaga erros (remove `|| true`) |
| `scripts/deploy/reconcile_migrations.sh:L97-112` | T27: `cmd_mark_applied` reescrito — extrai `--force` de qualquer posição |
| `scripts/deploy/test_migration_guard.sh:L25,40,102-103` | T26: 3× `[`→`[[` + `>&2` adicionado |
| `scripts/deploy/test_migration_guard.sh:L63` | T28: novo caso verde `multiline_block` |
| `scripts/deploy/test_migration_reconcile.sh:L45,58,132-133` | T26: 3× `[`→`[[` + `>&2` adicionado |
| `scripts/deploy/test_migration_reconcile.sh:L81-82,92-133` | T26: constantes `STUB_VERSION`/`STUB_COMPOSE` extraídas (10 ocorrências) |
| `scripts/deploy/test_migration_reconcile.sh:L128-137` | T27: novo caso "prod force sem DB args" + T29: novo caso "query falha propaga erro" |

**Validação:**
| Check | Comando | Resultado |
|-------|---------|-----------|
| ShellCheck (4 scripts) | `shellcheck lib_migrations.sh reconcile_migrations.sh test_migration_guard.sh test_migration_reconcile.sh` | ✅ limpo |
| Guard self-test (29/29) | `bash test_migration_guard.sh` | ✅ 29/29 |
| Reconcile self-test (9/9) | `bash test_migration_reconcile.sh` | ✅ 9/9 |

**Documentação atualizada:**
- `tasks.md`: T26-T29 marcados `[x]` + bloco de evidência adicionado
- `debitos.md`: DEB-050-01, -03, -04, -05 marcados **fechado**
- `sessoes/26-06-24_1_infra_migration-guard-online-safe.md`: esta seção

**Pendências:**
- Commit/push/PR: aguarda autorização do mantenedor
- `backlog.md`: já continha os débitos da Fase F; nenhum débito novo para registrar
- `project-state.md`: ainda não atualizado (pode ser feito junto com o commit)
- DEB-050-02 (convergência scripts antigos): follow-up separado, fora do escopo

**Fase F COMPLETA. Spec 050 100% implementada.**

### Retomada — T30 (2026-06-24, pós-T28)

- **T30 implementado:** `command -v perl` guard falha-fechado no topo de `validate_sql_against_class` (`lib_migrations.sh:55`). Se perl ausente → `return 1` com `::error::`.
- **Validação:** ShellCheck limpo + test_migration_guard.sh 29/29.
- **DEB-050-06** fechado. `tasks.md`, `debitos.md`, `backlog.md` atualizados.
