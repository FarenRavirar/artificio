# Plano — 050

## Arquitetura da solução

O defeito é um único `grep -Eiq` largo demais em `validate_sql_against_class`. A correção é **estreitar o padrão** para uma lista branca de DROP de objeto + deleção de dado, deixando passar os DROP de atributo (não-destrutivos). Sem mudança de fluxo, lock, ou contrato de header.

### Comportamento alvo (contrato do guard)

Sobre migration `online-safe`, **bloquear (return 1)**:
- `DROP <objeto>`: `TABLE`, `DATABASE`, `SCHEMA`, `COLUMN`, `VIEW`, `MATERIALIZED VIEW`, `SEQUENCE`, `TYPE`, `INDEX`, `FUNCTION`, `TRIGGER`, `RULE`, `EXTENSION`, `TABLESPACE`, `ROLE`, `USER`
- `TRUNCATE`
- `DELETE FROM`

**Permitir (não-destrutivo de dado):**
- `DROP NOT NULL`, `DROP CONSTRAINT`, `DROP DEFAULT`, `DROP IDENTITY`, `DROP EXPRESSION`

### Regex proposto (referência — DeepSeek valida contra os testes)

```bash
grep -Eiq '\b(DROP[[:space:]]+(TABLE|DATABASE|SCHEMA|COLUMN|VIEW|MATERIALIZED|SEQUENCE|TYPE|INDEX|FUNCTION|TRIGGER|RULE|EXTENSION|TABLESPACE|ROLE|USER)|TRUNCATE|DELETE[[:space:]]+FROM)\b'
```

Notas de implementação:
- `MATERIALIZED` cobre `DROP MATERIALIZED VIEW` (o `VIEW` seguinte não precisa estar no grupo).
- Manter `-i` (case-insensitive) e `\b` nas bordas.
- Manter o strip de comentário antes do grep. **Recomendado** estender o strip para blocos `/* */` (a cópia órfã já fazia) — evita falso-positivo de DROP comentado em bloco. Decisão D3.

### Decisões a confirmar (registrar a escolha em `tasks.md`/sessão)

- **D1 — `DROP INDEX`:** recomendação = **bloquear** (drop de índice online é caro/arriscado; migration que precise → `manual-risk`). Manter na lista de bloqueio salvo objeção.
- **D2 — `DROP CONSTRAINT`:** **permitir** (definido; `migration_128` depende).
- **D3 — comentário `/* */`:** recomendação = **passar a remover** no strip.
- **D4 — duplicação (`BL-DEP-MESAS-LEGACY-SCRIPTS` / spec 035 T6a):** escopo de remoção **A** (só `apps/mesas/scripts/deploy/`) ou **B** (`apps/mesas/scripts/` inteiro). Recomendação = **A**, conservador. Deletar = aprovação nominal.

## Arquivos afetados (por módulo/pacote)

| Arquivo | Mudança |
|---|---|
| `scripts/deploy/lib_migrations.sh` | corrigir regex em `validate_sql_against_class` (~linha 59) + (D3) estender strip de comentário |
| `scripts/deploy/test_migration_guard.sh` *(novo)* | teste shell verde+vermelho (modelo: `scripts/deploy/test_migration_lock.sh`) |
| `.github/workflows/_lint-shell.yml` | plugar o novo teste (ao lado de `test_migration_lock.sh`) |
| `apps/mesas/scripts/deploy/lib_migrations.sh` + `apply_required_migrations.sh` + `.bak` | **remover** (D4-A) após reconfirmar órfãos — OU sincronizar regex se mantedor optar por manter |
| `specs/035-infra-small-debts/tasks.md` | marcar T6a-T6d / R0a-R0e |
| `specs/backlog.md` | novo débito do falso-positivo + fechar `BL-DEP-MESAS-LEGACY-SCRIPTS` |
| `.specify/memory/errors.md` | novo `E0xx` (guard online-safe falso-positivo) |
| `.specify/memory/project-state.md` | estado/seguimento |
| `scripts/deploy/reconcile_migrations.sh` *(novo, Fase E)* | port canônico parametrizado da ferramenta de reconcile + gates R9 |
| `scripts/deploy/test_migration_reconcile.sh` *(novo, Fase E)* | teste shell do reconcile via injeção de função (sem Docker) |

## Consolidação do `reconcile_migrations.sh` canônico (Fase E — R8/R9)

A versão órfã (`apps/mesas/scripts/deploy/reconcile_migrations.sh`, removida em T12) é uma ferramenta break-glass de recuperação de drift de migration. O canônico **não tem equivalente** (só `list_pending_by_set_diff` detecta drift, não recupera). Portar para `scripts/deploy/reconcile_migrations.sh`, corrigindo os defeitos da órfã.

### Defeitos da órfã a corrigir no port

| Defeito (órfã) | Correção (canônico) |
|---|---|
| `psql -U admin -d mesas_rpg` hardcoded | parametrizar `db_user`/`db_name` (como `query_schema_migrations`) |
| `docker compose -f` sem `-p` | usar `compose_project_flag` da lib |
| não sourceia lib | `source "$SCRIPT_DIR/lib_migrations.sh"` (fonte única) |
| `${VERSION}` interpolado em SQL sem validação | validar `^migration_[0-9]+_.*\.sql$` antes de qualquer SQL |
| não deixa claro que só marca, não executa | imprimir aviso explícito |

### Contrato do canônico

```
bash scripts/deploy/reconcile_migrations.sh --list <compose> <db_service> [db_user] [db_name] [migrations_dir]
bash scripts/deploy/reconcile_migrations.sh --mark-applied <version> <compose> <db_service> [db_user] [db_name] [--force]
```

- **`--list`**: imprime migrations no disco (`find migration_*.sql | sort`) × no banco (`query_schema_migrations`); idealmente reusa `list_pending_by_set_diff` para mostrar o diff pendente. Read-only.
- **`--mark-applied <version>`**: insere `version` em `schema_migrations` (com `applied_by="reconcile:$(whoami)@$(hostname)"`, `ON_ERROR_STOP=1`) **sem rodar o SQL** — assume que a migration já foi aplicada out-of-band. Gates (R9):
  1. compose `*prod*` exige `--force` (senão erro).
  2. `<version>` deve casar `^migration_[0-9]+_.*\.sql$`.
  3. arquivo `.sql` deve existir em `migrations_dir`.
  4. idempotente: se já em `schema_migrations` → `SKIP`, exit 0.
  5. aviso: "marca como aplicada SEM executar o SQL — use só se a migration já foi aplicada manualmente".

### Testabilidade (R9 — sem Docker no CI)

Refatorar as chamadas Docker/psql atrás de funções injetáveis (padrão `query_fn` que `list_pending_by_set_diff` já usa). `scripts/deploy/test_migration_reconcile.sh` (novo) cobre, com stubs:
- prod sem `--force` → falha (exit ≠ 0)
- `<version>` fora do padrão → falha
- arquivo ausente → falha
- já presente → SKIP (exit 0)
- caso feliz (stub de insert) → NEW

Plugar em `_lint-shell.yml` ao lado de `test_migration_guard.sh`.

## Contratos/interfaces tocados

- **Header de migration:** inalterado (parse_header não muda). Convenção `@class`/`@requires-backup` preservada.
- **Schema/DB:** nenhum. Não toca SQL de migration, só o validador.
- **Auth/accounts/DNS/tunnel:** nenhum.
- **CI:** adiciona um step de teste em `_lint-shell.yml` (gate novo, só endurece após verde — regra pétrea).

## Impacto em consumidores

- `apply_required_migrations.sh` (root) consome `validate_sql_against_class` → comportamento muda só para os casos antes falso-bloqueados. Migrations destrutivas reais seguem bloqueadas.
- Deploy de **qualquer** app com `database/` usa esse guard (mesas hoje). Site usa Kysely (no-op). Verificar que nenhuma migration `online-safe` existente passa a ser **destravada indevidamente**: rodar o guard corrigido contra **todas** as migrations atuais de `apps/mesas/database/` e conferir que nenhuma destrutiva real estava marcada online-safe (se houver, é outro achado).

## Rollback

`git revert` do commit (mudança isolada em scripts + workflow + docs). Sem efeito em runtime/prod até o próximo deploy. Cópias removidas voltam pelo revert.

## Validação (como provo que funciona)

1. `shellcheck scripts/deploy/lib_migrations.sh scripts/deploy/test_migration_guard.sh` → limpo (R5).
2. `bash scripts/deploy/test_migration_guard.sh` → todos os casos passam (R1/R2/R4).
3. Guard real contra a 128: source da lib + `validate_sql_against_class apps/mesas/database/migration_128_import_messages.sql online-safe; echo $?` → `0` (R3).
4. Guard contra `migration_129` → `0`.
5. Guard contra fixtures sintéticas (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE FROM`) marcadas online-safe → `1` (R2).
6. Guard contra **todas** as migrations existentes de mesas → nenhuma destrava indevida.
7. Re-rodar `R0a-R0e` da spec 035 → reconfirmar cópias órfãs antes de remover (R6).
8. `pnpm --filter @artificio/mesas-backend build` + `--filter @artificio/mesas-frontend build` verdes (T6c spec 035).
9. `shellcheck scripts/deploy/reconcile_migrations.sh scripts/deploy/test_migration_reconcile.sh` → limpo + `bash scripts/deploy/test_migration_reconcile.sh` → todos os casos passam (R8/R9).
10. **Não** executa deploy real nem `--mark-applied` real em prod — follow-up gated por aprovação nominal do mantenedor.
