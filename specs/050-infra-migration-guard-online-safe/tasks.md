# Tasks — 050

> Planejamento por Claude Code. **Implementação por DeepSeek.** Tasks pequenas e verificáveis. Atualizar a sessão a cada etapa. Deletar arquivo e qualquer push/PR/deploy exigem aprovação nominal do mantenedor.

## Fase A — Correção do guard canônico

- [x] **T1** — Estreitar o regex em `validate_sql_against_class` (`scripts/deploy/lib_migrations.sh:~59`) para a lista branca do `plan.md` (bloqueia DROP de objeto + TRUNCATE + DELETE FROM; permite DROP de atributo). · feito quando: o arquivo casa o contrato e `shellcheck` passa. ✅ 2026-06-24
- [x] **T2** — (D3) Estender o strip de comentário para remover blocos `/* */` antes do grep. · feito quando: um `/* DROP TABLE */` comentado não dispara bloqueio no teste. ✅ 2026-06-24
- [x] **T3** — Registrar as decisões D1 (DROP INDEX = bloquear) e D3 na sessão/tasks. · feito quando: escolha escrita com justificativa. ✅ 2026-06-24

> **T1+T2 implementados (2026-06-24):**
> - **Arquivo:** `scripts/deploy/lib_migrations.sh:59-62` — regex substituído pela lista branca de objetos + strip de bloco `/* */` adicionado
> - **Regex antigo:** `\b(DROP|TRUNCATE|DELETE[[:space:]]+FROM)\b`
> - **Regex novo:** `\b(DROP[[:space:]]+(TABLE|DATABASE|SCHEMA|COLUMN|VIEW|MATERIALIZED|SEQUENCE|TYPE|INDEX|FUNCTION|TRIGGER|RULE|EXTENSION|TABLESPACE|ROLE|USER)|TRUNCATE|DELETE[[:space:]]+FROM)\b`
> - **Strip:** `sed -e 's/--.*//' -e 's/\/\*.*\*\///g'` (antes era só `s/--.*//`)
> - **Decisões confirmadas (conforme plano):**
>   - **D1 — DROP INDEX:** bloquear (drop de índice online é caro/arriscado; migration que precise → `manual-risk`)
>   - **D3 — strip `/* */`:** remover comentários de bloco antes do grep (evita falso-positivo de DROP comentado)
>   - **D4 — escopo remoção:** A (conservador, só `apps/mesas/scripts/deploy/`)
> - **Validação R3 (migrations reais):** `migration_128` → 0 ✅, `migration_129` → 0 ✅
> - **Validação R1/R2 (fixtures sintéticas):** 5/5 bloqueios corretos, 5/5 permissões corretas
> - **Shellcheck:** limpo ✅

## Fase B — Teste automatizado + CI

- [x] **T4** — Criar `scripts/deploy/test_migration_guard.sh` (modelo: `test_migration_lock.sh`): fixtures temporárias online-safe — verdes (`DROP NOT NULL`, `DROP CONSTRAINT`, `DROP DEFAULT`) e vermelhas (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE FROM`); asserta return 0/1. · feito quando: o script roda local e todos os casos passam. ✅ 2026-06-24
- [x] **T5** — Plugar o teste em `.github/workflows/_lint-shell.yml` (ao lado de `test_migration_lock.sh`). · feito quando: o step existe e referencia o script. **Endurecer gate só após verde local comprovado** (regra pétrea). ✅ 2026-06-24 — verde local comprovado (28/28)

> **T4+T5 implementados (2026-06-24):**
> - **Arquivo criado:** `scripts/deploy/test_migration_guard.sh` (99 linhas) — fonte a lib, cria fixtures temporárias, asserta 0/1
> - **28 cenários:** 10 verdes (DROP NOT NULL, CONSTRAINT, DEFAULT, IDENTITY, EXPRESSION, comentários bloco/linha/inline, migrations 128+129 reais) + 18 vermelhos (DROP TABLE, COLUMN, INDEX, DATABASE, SCHEMA, VIEW, MATERIALIZED, SEQUENCE, TYPE, FUNCTION, TRIGGER, RULE, EXTENSION, TABLESPACE, ROLE, USER, DELETE FROM, TRUNCATE)
> - **Shellcheck:** limpo ✅
> - **Local:** 28/28 passando ✅
> - **CI:** step `Migration guard self-test` plugado em `_lint-shell.yml:~29-31` (entre lock e branch invariant)
- [x] **T6** — Rodar o guard corrigido contra a 128 e a 129 reais → ambos return 0 (R3). · feito quando: saída `0` registrada na sessão. ✅ 2026-06-24
- [x] **T7** — Rodar o guard contra **todas** as migrations de `apps/mesas/database/` → nenhuma destrava indevida; se alguma destrutiva real estava online-safe, registrar como achado novo. · feito quando: varredura registrada. ✅ 2026-06-24

> **T6+T7 varredura (2026-06-24):**
> - **Total de migrations:** 62 arquivos
> - **Online-safe passaram:** 58 ✅ (incluindo 128 e 129 que motivaram a spec)
> - **Manual-risk ignoradas:** 3 ✅ (18_drop_imgur_legacy, 99_drop_aggregator_tables, 104_drop_tables_frequency_columns — todas corretamente marcadas manual-risk e o guard as ignora)
> - **Online-safe bloqueada:** 1 🔍
> 
> ### 🟡 Achado novo: `migration_11_sistemas_json.sql` — ONLINE-SAFE + TRUNCATE
> 
> A migration 11 tem `TRUNCATE TABLE systems CASCADE` (linha 20) mas está marcada `@class: online-safe`. O guard corrigido bloqueou **corretamente** — não é falso-positivo. A migration é legado com comentário "Pode zerar tudo. até hoje subimos nada em produção".
> 
> **Status:** não corrigir agora (fora do escopo da spec 050). A migration 11 já foi aplicada em prod há meses; reclassificar para `manual-risk` é acadêmico. Se o mantenedor quiser reclassificar, basta trocar o header. Nenhum impacto funcional: a migration 11 nunca mais será reaplicada (já está em `schema_migrations` de todos os ambientes).
> 
> **Conclusão T7:** varredura confirma que o guard corrigido não destrava indevidamente nenhuma migration existente. O único bloqueio é um achado legítimo, não um falso-positivo. R1/R2/R3 comprovados.

## Fase C — Duplicação do guard (verificação + resolução · `BL-DEP-MESAS-LEGACY-SCRIPTS`)

> Esta fase atende o pedido explícito do mantenedor: **verificar a questão de duplicação do guard já registrada**. Cruza `BL-DEP-MESAS-LEGACY-SCRIPTS` (backlog) + `specs/035-infra-small-debts/tasks.md` R0/T6.

- [x] **T8** — Reconfirmar canonicidade: `grep -n apply_required_migrations .github/workflows/_deploy-module.yml` mostra path root; `rg -n "apps/mesas/scripts/deploy"` em `.github/` + `scripts/` → 0 referências vivas (spec 035 R0b/R0c). · feito quando: provado que `apps/mesas/scripts/deploy/*` é órfão. ✅ 2026-06-24

> **T8 canonicidade confirmada (2026-06-24):**
> - **Canônico:** `scripts/deploy/lib_migrations.sh` é sourceado por:
>   - `scripts/deploy/apply_required_migrations.sh:5` (invocado pelo deploy: `../../scripts/deploy/apply_required_migrations.sh`)
>   - `scripts/deploy/test_migration_lock.sh:6` (CI `_lint-shell.yml`)
>   - `scripts/deploy/test_migration_guard.sh:6` (CI `_lint-shell.yml`)
> - **Deploy usa root:** `_deploy-module.yml:449` → `bash ../../scripts/deploy/apply_required_migrations.sh`
> - **Órfão comprovado:** `rg "apps/mesas/scripts/deploy" .github/ scripts/` → **0 referências**
> - **6 arquivos órfãos:** `apply_required_migrations.sh`, `.bak`, `deploy-prod.sh`, `lib_migrations.sh`, `preflight_prod.sh`, `reconcile_migrations.sh`
> - **BL-DEP-MESAS-LEGACY-SCRIPTS** (backlog L45): aberto; `spec 050 absorve R0a-e/T6a-d`
- [x] **T9** — `diff apps/mesas/scripts/deploy/lib_migrations.sh scripts/deploy/lib_migrations.sh` e idem `apply_required_migrations.sh` — documentar a divergência (lock, mensagem, strip) na sessão (spec 035 R0d). · feito quando: diff registrado. ✅ 2026-06-24
- [x] **T10** — Scan de segredos nos scripts órfãos antes de qualquer ação (`rg -i "secret|token|password|BEGIN" apps/mesas/scripts/`) (spec 035 R0e). · feito quando: saída limpa registrada. ✅ 2026-06-24

> **T9 divergência documentada (2026-06-24):**
> 
> `lib_migrations.sh` (canônico vs órfão):
> | Aspecto | Canônico (`scripts/deploy/`) | Órfão (`apps/mesas/scripts/deploy/`) |
> |---------|------------------------------|---------------------------------------|
> | **Regex guard** | REV-077 estreito (lista branca objetos) | Largo original (`\bDROP\b`) ⚠️ |
> | **Lock** | `flock` (arquivo) | `pg_advisory_lock` (Postgres) ⚠️ |
> | **DB params** | Parametrizado (db_user, db_name) | Hardcoded (`admin`, `mesas_rpg`) |
> | **Funções** | `compose_project_flag`, `query_schema_migrations`, `acquire_migration_lock` | `_compose_project_flag`, `_default_query_schema_migrations`, `acquire_lock` |
> | **Strip bloco** | ✅ `s/\/\*.*\*\///g` | ✅ mesmo |
> 
> `apply_required_migrations.sh` (canônico vs órfão):
> | Aspecto | Canônico | Órfão |
> |---------|----------|-------|
> | **Args** | 2-5 (flexível) | Exatamente 2 |
> | **Source** | `$SCRIPT_DIR/lib_migrations.sh` | Nenhum (inline ou old copy) |
> | **Header validation** | `load_header_vars()` + valida class/backup | Não tem |
> | **Lock** | `acquire_migration_lock` (flock) | `acquire_lock` (pg_advisory) |
> 
> **Conclusão T9:** cópias são **forks divergentes**, não meras duplicatas. O canônico é mais moderno (REV-077, flock, parametrizado). O órfão está desatualizado e inseguro (regex largo, hardcoded creds).
> 
> **T10 scan segredos (2026-06-24):**
> - Padrões críticos (`ghp_`, `github_pat_`, `refresh_token`, `-----BEGIN RSA`, `postgres://.*@`): **0 ocorrências** ✅
> - Falso positivo: `BEGIN;` (SQL transaction em `apply_required_migrations.sh:132`) — não é segredo
> - Conclusão: diretório limpo, sem risco de vazamento ao remover
- [x] **T11** — (R7) Enquanto a órfã existir, **não deixá-la divergir mais**: aplicar a mesma correção de regex na cópia `apps/mesas/scripts/deploy/lib_migrations.sh` OU removê-la em T12 no mesmo escopo. · feito quando: as duas coerentes ou a órfã removida. ✅ 2026-06-24 — sincronizada (REV-077 aplicado, validado)

> **T11 decisão + sincronização (2026-06-24):**
> - **Decisão:** sincronizar (não deixar divergir). Motivo: R7 manda "Enquanto a cópia órfã existir, a correção não pode deixá-la divergir mais". Sincronizar é a opção mais durável e segura — se o arquivo for acidentalmente invocado antes de T12, estará correto.
> - **Arquivo:** `apps/mesas/scripts/deploy/lib_migrations.sh:60-66` — regex largo substituído pelo REV-077 idêntico ao canônico
> - **Validação:** DROP NOT NULL passa ✅, DROP CONSTRAINT passa ✅, DROP TABLE bloqueia ✅, migration_128 passa ✅
- [x] **T12** — 🟦 **Decisão A/B + remoção (aprovação nominal do mantenedor para deletar):** escopo **A** = `apps/mesas/scripts/deploy/` (6 arquivos incl. `.bak`) | **B** = `apps/mesas/scripts/` inteiro. Remover conforme decisão (spec 035 T6a/T6b). · feito quando: arquivos removidos com aprovação registrada, ou decisão de manter+sincronizar documentada. ✅ 2026-06-24 — escopo A removido (6 arquivos)
- [x] **T13** — `pnpm --filter @artificio/mesas-backend build` + `--filter @artificio/mesas-frontend build` verdes pós-remoção (spec 035 T6c). · feito quando: builds verdes. ✅ 2026-06-24

> **T12 remoção + T13 validação (2026-06-24):**
> - **Escopo:** A (conservador) — 6 arquivos em `apps/mesas/scripts/deploy/`
> - **Arquivos removidos:** `apply_required_migrations.sh`, `.bak`, `deploy-prod.sh`, `lib_migrations.sh`, `preflight_prod.sh`, `reconcile_migrations.sh`
> - **Aprovação:** mantenedor autorizou nominalmente
> - **Preservados:** `deploy-beta.ps1`, `ops/`, `pre-commit`, `README.md`, `sdd/` (fora do escopo A)
> - **Build backend:** tsc ✅
> - **Build frontend:** vite ✅
- [x] **T14** — Fechar `BL-DEP-MESAS-LEGACY-SCRIPTS` no backlog + marcar `specs/035-infra-small-debts/tasks.md` R0a-R0e / T6a-T6d (spec 035 T6d). · feito quando: backlog e spec 035 atualizados. ✅ 2026-06-24

> **T14 fechamento (2026-06-24):**
> - **`specs/backlog.md:45`:** BL-DEP-MESAS-LEGACY-SCRIPTS marcado `fechado` com referência à spec 050 T12
> - **`specs/035-infra-small-debts/tasks.md:189-199`:** R0a-R0e e T6a-T6d todos `[x]` com referência à spec 050
> - **Fase C da spec 050 completamente encerrada** ✅

## Fase D — Documentação + débito + entrega

- [x] **T15** — Registrar débito do falso-positivo em `specs/backlog.md` (ex.: `BL-MESAS-MIGRATION-GUARD-FALSE-POSITIVE`, origem run `28125222995`, evidência, escopo, fechado por esta spec). · feito quando: linha no backlog. ✅ 2026-06-24
- [x] **T16** — Novo erro conhecido em `.specify/memory/errors.md` (`E010`: guard online-safe barra DROP de atributo; sintoma = deploy abortado "contem instrucao destrutiva"; solução = regex estreito). · feito quando: entrada criada. ✅ 2026-06-24

> **T15 débito + T16 erro (2026-06-24):**
> - **`specs/backlog.md:46`:** `BL-MESAS-MIGRATION-GUARD-FALSE-POSITIVE` fechado — regex corrigido + teste CI
> - **`.specify/memory/errors.md:~91-108`:** `E010` criado — sintoma (deploy abortado), causa (regex largo), solução (spec 050), prevenção (teste shell 28 cenários no CI)
- [x] **T17** — Atualizar `.specify/memory/project-state.md` (estado: guard corrigido, mesas pronto para re-deploy prod gated). · feito quando: log/seguimento escrito. ✅ 2026-06-24

> **T17 project-state atualizado (2026-06-24):**
> - **Fase atual (L10):** aviso de deploy falhou atualizado — agora indica "Spec 050 corrigiu o guard. Pronto para re-deploy prod (gated)"
> - **Log (L81):** nova entrada resumindo Fases A-D concluídas + 2 débitos fechados + E010 + R0/T6 spec 035
- [x] **T18** — Validação final: `shellcheck` verde, `test_migration_guard.sh` verde, guard real verde na 128/129, builds verdes. · feito quando: tudo registrado na sessão. ✅ 2026-06-24

> **T18 validação final consolidada (2026-06-24):**
> 
> | Check | Comando | Resultado |
> |-------|---------|-----------|
> | Shellcheck (3 scripts) | `npx shellcheck scripts/deploy/*.sh` | ✅ limpo |
> | Guard self-test | `bash test_migration_guard.sh` | ✅ 28/28 |
> | migration_128 real | `validate_sql_against_class` | ✅ return 0 |
> | migration_129 real | `validate_sql_against_class` | ✅ return 0 |
> | Backend build | `tsc` | ✅ |
> | Frontend build | `vite build` | ✅ |
> 
> **R1-R5 todos comprovados.** Spec 050 pronta para entrega.
- [x] **T19** — Registrar follow-up: **re-deploy prod mesas** (`gh workflow run deploy.yml --ref main -f module=mesas -f mode=deploy -f env=prod`) — ação do mantenedor, aprovação nominal; aplica 128+129. · feito quando: follow-up no project-state/sessão (NÃO executar). ✅ 2026-06-24 — documentado

## Fase E — Reconcile canônico (recuperação de drift · R8/R9 · `BL-MIGRATION-RECONCILE-TOOL`)

> Não perder a ferramenta break-glass de reconcile ao remover os órfãos (T12). Port canônico parametrizado + gates de segurança. Implementação: DeepSeek. Detalhe de design em `plan.md` §Consolidação.

- [x] **T20** — Criar `scripts/deploy/reconcile_migrations.sh` canônico: `source lib_migrations.sh`; `--list <compose> <db_service> [db_user] [db_name] [migrations_dir]` (disco × `query_schema_migrations`, reusar `list_pending_by_set_diff` p/ diff). · feito quando: `--list` roda parametrizado, sem hardcode `admin`/`mesas_rpg`, usando `compose_project_flag`. ✅ 2026-06-24
- [x] **T21** — Implementar `--mark-applied <version> <compose> <db_service> [db_user] [db_name] [--force]` com os gates R9: (a) prod exige `--force`; (b) `<version>` casa `^migration_[0-9]+_.*\.sql$`; (c) arquivo `.sql` existe; (d) idempotente (skip se já em `schema_migrations`); (e) aviso "marca SEM executar o SQL". · feito quando: os 5 gates presentes e o INSERT usa `ON_ERROR_STOP=1` + `applied_by="reconcile:$(whoami)@$(hostname)"`. ✅ 2026-06-24
- [x] **T22** — Refatorar chamadas Docker/psql atrás de função injetável (padrão `query_fn` da lib) para permitir teste sem Docker. · feito quando: lógica pura testável com stub. ✅ 2026-06-24 — `MOCK_QUERY_RESULT` e `MOCK_MARK_FILE` env vars
- [x] **T23** — Criar `scripts/deploy/test_migration_reconcile.sh` (modelo dos testes existentes) cobrindo: prod sem `--force` → falha; version inválida → falha; arquivo ausente → falha; já presente → SKIP; caso feliz (stub) → NEW. · feito quando: roda local, todos os casos passam. ✅ 2026-06-24 — 7/7
- [x] **T24** — Plugar `test_migration_reconcile.sh` no `.github/workflows/_lint-shell.yml` (ao lado de `test_migration_guard.sh`). `shellcheck` limpo nos 2 novos arquivos. · feito quando: step existe + verde local comprovado (endurecer só após verde, regra pétrea). ✅ 2026-06-24 — shellcheck limpo, verde local 7/7
- [x] **T25** — Registrar `BL-MIGRATION-RECONCILE-TOOL` em `specs/backlog.md` (aberto → fechado por esta Fase E) + atualizar `project-state.md`/sessão. · feito quando: backlog e estado atualizados. ✅ 2026-06-24

> **Fase E — T20 a T25 implementados (2026-06-24):**
>
> **Arquivos criados:**
> - `scripts/deploy/reconcile_migrations.sh` (156 linhas) — `--list` (read-only diff disco×banco) + `--mark-applied` (INSERT com gates R9)
> - `scripts/deploy/test_migration_reconcile.sh` (139 linhas) — 7 cenários com stubs (`MOCK_QUERY_RESULT`/`MOCK_MARK_FILE`)
>
> **Gates R9 em `--mark-applied`:**
> | Gate | Condição | Comportamento |
> |------|----------|---------------|
> | R9a | compose `*prod*` sem `--force` | erro exit 1 |
> | R9b | version não casa `^migration_[0-9]+_.*\.sql$` | erro exit 1 |
> | R9c | `.sql` não existe em `MIGRATIONS_DIR` | erro exit 1 |
> | R9d | version já em `schema_migrations` | SKIP exit 0 |
> | R9e | antes de marcar | aviso "SEM executar o SQL" |
>
> **Testes (7/7):**
> - sem args → exit 1 ✅
> - prod sem `--force` → exit 1 ✅
> - version inválida → exit 1 ✅
> - arquivo ausente → exit 1 ✅
> - já presente → SKIP ✅
> - caso feliz → NEW (`MOCK_MARK_FILE` preenchido) ✅
> - `--list` com mock → saída contém "pendentes" ✅
>
> **CI:** step `Migration reconcile self-test` plugado em `_lint-shell.yml` (entre guard e branch invariant)
> **BL-MIGRATION-RECONCILE-TOOL:** fechado em `specs/backlog.md:47`
> **Shellcheck:** ambos novos arquivos limpos ✅

## Gate de entrega (autorização do mantenedor por ação)

- Commit/push/PR para `dev`: aprovação nominal (código de infra → branch + PR, regra pétrea).
- Deletar arquivos órfãos (T12): aprovação nominal.
- Re-deploy prod (T19): aprovação nominal, fora desta spec.
- `--mark-applied` real contra DB de prod (T21 em uso operacional): aprovação nominal + read-only-first; o teste (T23) usa stub, nunca DB real.
