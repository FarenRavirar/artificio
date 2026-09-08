# 050 — Guard de migrations: falso-positivo destrutivo em `online-safe`

- **Módulo/Pacote:** infra (`scripts/deploy/` — guard de migration do deploy)
- **Gate relacionado:** D (mesas) — desbloqueia promoção de mesas para prod
- **Tipo:** SDD Completo (infra / CI/CD / deploy / guard de migration)
- **Origem:** deploy prod mesas `run 28125222995` (2026-06-24) abortado + rollback automático
- **Autor do plano:** Claude Code (planejamento). **Implementação:** DeepSeek (OpenCode).
- **Status:** planejada (não implementada)

> **Nota de governança:** este `spec.md` descreve **o quê e por quê** (problema + requisitos testáveis). A solução técnica (regex, edição de arquivo, testes) está em `plan.md`/`tasks.md`.

---

## Problema

O deploy prod de `mesas` (`run 28125222995`, 2026-06-24) **falhou e fez rollback automático** ao aplicar `migration_128_import_messages.sql`:

```
Error: database/migration_128_import_messages.sql esta marcada online-safe mas contem instrucao destrutiva.
ROLLBACK: restaurando snapshot e containers de mesas...
```

### Causa raiz

O guard `validate_sql_against_class` (`scripts/deploy/lib_migrations.sh:59`) bloqueia qualquer migration `@class: online-safe` cujo SQL case com `\b(DROP|TRUNCATE|DELETE FROM)\b`. O token `\bDROP\b` é **largo demais**: casa também `DROP NOT NULL`, `DROP CONSTRAINT` e `DROP DEFAULT`, que são alterações de schema **sem perda de dado** — não são o tipo de instrução destrutiva que o guard pretende barrar.

`migration_128` é **semanticamente online-safe de verdade**. Seus únicos `DROP`:
- `ALTER COLUMN discord_message_id DROP NOT NULL` (linha 33) — relaxa nullability, não apaga dado.
- `DROP CONSTRAINT IF EXISTS chk_...` (linha 40) — remove CHECK e **re-adiciona** logo abaixo (linhas 42-46).

Logo: **falso-positivo do guard**, não migration mal-classificada.

### Por que beta passou e prod não

- **Beta** (`mesas-beta-db`): `migration_128` e `migration_129` já aplicadas em **2026-06-22** (`ci:agent@opencode`). Deploy beta pula migrations já em `schema_migrations` (set-diff) → nunca reexecutou o guard sobre a 128.
- **Prod** (`mesas-db`): parado em `migration_127`; tentou aplicar 128 pela primeira vez → guard barrou → rollback.
- `migration_129_import_corrections.sql` é `online-safe` e **não tem DROP** → passa. Único bloqueio = a 128.

### Achado secundário — duplicação divergente do guard (débito já registrado)

Existem **duas cópias** divergentes do guard:

| Arquivo | Lock | Mensagem | Usado em CI/deploy? |
|---|---|---|---|
| `scripts/deploy/lib_migrations.sh` | `flock` | "instrucao destrutiva" (singular) | **SIM** — `_deploy-module.yml:449` |
| `apps/mesas/scripts/deploy/lib_migrations.sh` | `pg_advisory_lock` | "instrucoes destrutivas" (plural) | **NÃO** — zero ref em workflow |

Mais `apps/mesas/scripts/deploy/apply_required_migrations.sh` + `apply_required_migrations.sh.bak` (órfãos). O guard canônico/ativo é o de `scripts/deploy/` (log de deploy usa `flock`).

**Esta duplicação NÃO é débito novo** — cruzar antes de agir:
- **`BL-DEP-MESAS-LEGACY-SCRIPTS`** (backlog, **aberto**; origem `specs/019` FSU-012/B4): limpar scripts legados `apps/mesas/scripts/deploy/*` quando `_deploy-module` for fonte única.
- **Spec 035** (`infra-small-debts`, `spec.md:213-220`, `tasks.md:182-205`) re-investigou: concluiu que **NÃO é "app duplica root"** — conjuntos **disjuntos** (só `lib_migrations.sh` e `apply_required_migrations.sh` coincidem em nome, divergindo em SHA). Tem `R0a-R0e` + `T6a-T6d` (decisão de escopo **A**/**B**, remoção, build, fechar débito) **não executadas** (checkboxes abertos).

Spec 050 é o momento natural de fechar isso (está corrigindo o guard canônico). A spec **absorve** `R0a-e`/`T6a-d` em vez de criar limpeza paralela.

---

## Requisitos (numerados, testáveis)

- **R1** — Uma migration `online-safe` contendo apenas DROP de **atributo** (`DROP NOT NULL`, `DROP CONSTRAINT`, `DROP DEFAULT`, `DROP IDENTITY`, `DROP EXPRESSION`) **passa** no guard canônico (`validate_sql_against_class` retorna 0).
- **R2** — Uma migration `online-safe` contendo DROP de **objeto** (`DROP TABLE/COLUMN/DATABASE/SCHEMA/VIEW/MATERIALIZED VIEW/SEQUENCE/TYPE/INDEX/FUNCTION/TRIGGER/RULE/EXTENSION/TABLESPACE/ROLE/USER`), `TRUNCATE` ou `DELETE FROM` continua **bloqueada** (retorna 1).
- **R3** — `apps/mesas/database/migration_128_import_messages.sql` real **passa** no guard após a correção; `migration_129` continua passando.
- **R4** — O comportamento de R1/R2 é coberto por teste shell automatizado que roda no CI (`_lint-shell.yml`), com casos verde e vermelho.
- **R5** — `shellcheck` permanece limpo nos scripts tocados (gate do `_lint-shell.yml`).
- **R6** — A duplicação do guard (`BL-DEP-MESAS-LEGACY-SCRIPTS`) é **reconfirmada e resolvida** (eliminada conforme decisão A/B da spec 035, ou sincronizada), com débito e checkboxes da spec 035 atualizados. Deletar arquivos exige aprovação nominal do mantenedor.
- **R7** — Enquanto a cópia órfã existir, a correção não pode deixá-la divergir mais do guard canônico (corrigir ambas ou remover a órfã no mesmo escopo).
- **R8** — A capacidade de recuperação de drift de migration (`reconcile`, antes só na cópia órfã) **não se perde**: existe um `scripts/deploy/reconcile_migrations.sh` **canônico** com `--list` (disco × banco) e `--mark-applied <version> [--force]`, parametrizado (`db_user`/`db_name`/project flag) e sourceando `lib_migrations.sh` (fonte única). Sem hardcode de `admin`/`mesas_rpg`.
- **R9** — O `reconcile` canônico endurece gates de segurança vs a versão órfã: (a) `--mark-applied` em compose `*prod*` exige `--force`; (b) `<version>` é validado contra `^migration_[0-9]+_.*\.sql$` antes de entrar em SQL (anti-injeção/typo); (c) o arquivo `.sql` correspondente deve existir no disco; (d) idempotente (skip se já em `schema_migrations`); (e) avisa explicitamente que **apenas marca** como aplicada, **não executa** o SQL. O comportamento puro (parsing/validação/guard de prod) é coberto por teste shell no CI via injeção de função de query (sem depender de Docker/DB).

## Critérios de aceite

- [x] R1 e R2 provados por execução real do guard (self-test 28/28; sanity `DROP TABLE`→block). ✅
- [x] R3: guard roda contra a 128/129 reais e retorna 0 (verificado 2026-06-24). ✅
- [x] R4: `scripts/deploy/test_migration_guard.sh` existe, cobre verde+vermelho, plugado no `_lint-shell.yml`. ✅
- [~] R5: `shellcheck` verde — comprovado por DeepSeek via `npx shellcheck`; gate roda no CI `_lint-shell.yml` (shellcheck não instalado local). Confirmar no PR.
- [x] R6: `BL-DEP-MESAS-LEGACY-SCRIPTS` fechado + `specs/035/tasks.md` T6 marcado; decisão A registrada. ✅
- [x] Débito do falso-positivo registrado em `specs/backlog.md` + erro `E010` em `errors.md` + `project-state.md` atualizado. ✅
- [x] Follow-up registrado: re-deploy prod mesas (mantenedor, aprovação nominal) aplica 128+129. ✅
- [ ] R8: `scripts/deploy/reconcile_migrations.sh` canônico existe, parametrizado, sourceando a lib; `--list` e `--mark-applied` funcionam.
- [ ] R9: gates de segurança (prod-force, validação de `<version>`, file-exists, idempotência, aviso "só marca") + teste shell no `_lint-shell.yml`.

## Fora de escopo

- Re-disparar deploy prod de mesas (ação do mantenedor, gated por aprovação nominal — vira follow-up).
- Alterar headers de `migration_128`/`migration_129` (corretos como `online-safe`; o defeito é o guard).
- Reescrever o mecanismo de lock (`flock`/`pg_advisory_lock`) ou o fluxo de set-diff.
- Unificar os dois mecanismos de lock divergentes além do necessário para fechar `BL-DEP-MESAS-LEGACY-SCRIPTS`.

## Débitos tratados pela spec

| ID | Estado | Como esta spec aplica/fecha |
|---|---|---|
| `BL-MESAS-MIGRATION-GUARD-FALSE-POSITIVE` | **fechado (spec 050)** | Falso-positivo do guard que abortou o deploy prod de mesas. Fechado pelas Fases A/B: regex estreito (lista branca de DROP de objeto) em `scripts/deploy/lib_migrations.sh` + teste shell `test_migration_guard.sh` (28/28) plugado no CI `_lint-shell.yml` + erro `E010`. R1-R5 comprovados (128/129 passam; destrutivos reais bloqueiam). |
| `BL-DEP-MESAS-LEGACY-SCRIPTS` | **fechado (spec 050 T12)** | Duplicação divergente do guard (cópias órfãs em `apps/mesas/scripts/deploy/`). Fechado pela Fase C: canonicidade reconfirmada (T8), divergência documentada (T9), scan de segredos limpo (T10), regex sincronizado na transição (T11), 6 arquivos removidos escopo A (T12, aprovação nominal), builds verdes (T13), `specs/035` R0a-e/T6a-d marcados (T14). |
| `BL-MIGRATION-RECONCILE-TOOL` | **aberto → fechado pela Fase E** | Ao remover os órfãos (T12), a única ferramenta de recuperação de drift de migration (`reconcile_migrations.sh`: `--list`/`--mark-applied`) sumiu — o canônico só **detecta** drift (`DRIFT ERROR`), não **recupera**. Risco concreto: drift beta↔prod (beta tinha 128/129 out-of-band; prod não). Fechado pela Fase E (R8/R9): port canônico parametrizado + gates de segurança + teste. |

> **Follow-up (não é débito desta spec):** re-deploy prod mesas (`deploy.yml --ref main -f module=mesas -f env=prod`) aplica `migration_128`+`129` — ação do mantenedor, aprovação nominal.

## Riscos e impacto em outros módulos

- **Regex permissivo demais** deixaria passar destrutivo real → mitigado por lista branca explícita (só atributos) + teste vermelho obrigatório (R2/R4).
- **Deletar cópia órfã** que afinal é usada por caminho não mapeado → mitigado por re-execução de `R0a-R0e` (spec 035) antes de deletar + aprovação nominal.
- **Impacto cross-módulo:** o guard canônico (`scripts/deploy/`) é usado pelo deploy de **todos** os apps com `database/` (mesas hoje; site usa Kysely, no-op). Mudança no guard afeta o pipeline de migration de qualquer app futuro → exige teste de regressão (R4) antes de endurecer.
- **Não** altera contrato de auth/SSO, DNS/tunnel, nem schema de banco.
