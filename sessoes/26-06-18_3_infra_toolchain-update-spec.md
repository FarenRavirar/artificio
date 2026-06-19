# Sessão 26-06-18_3 — Spec 033: Atualização de Toolchain (D-DEP2 + Express + React)

- **Data:** 2026-06-18
- **Objetivo:** Criar spec SDD Completo para atualização de toolchain (apt/Node/pnpm/Docker/deps npm) + Express 5 (mesas) + React + código depreciado
- **App/Projeto:** infra + todos `apps/*` + `packages/*`
- **Gate:** B (guardrail) · D (por app, pós-update)

## Vínculos
- Débito: `specs/backlog.md` D-DEP2 (apt/Node/pnpm/imagens/deps) + D-DEP1/BL-MESAS-EXPRESS5-016 (Express 5)
- Spec: `specs/033-infra-toolchain-update/` (spec.md, plan.md, tasks.md)
- Pesquisa: `sessoes/26-06-12_2_debitos_ux-marca.md:163-170`
- Spec 026 F8/F9: referência cruzada

## Plano
1. ✅ Pesquisa profunda read-only na VM e codebase
2. ✅ Spec 033 criada (spec.md, plan.md, tasks.md — 52 tarefas em 7 fases)
3. ✅ Fases 1-3 concluídas (pesquisa + toolchain + Express 5)
4. ⏳ Fases 4-7 pendentes (deps npm + Docker + VM + fechamento)

## Checklist de fechamento
- [x] Fase 1 — Pesquisa e decisão (T0-T5b)
- [x] Fase 2 — Toolchain Node + pnpm + CI (T6-T12)
- [x] Fase 3 — Express 5 mesas + unificação (T13-T21)
- [ ] Fase 4 — Deps npm incrementais (T22-T28)
- [ ] Fase 4B — Unificação majors toolchain (T60-T67)
- [ ] Fase 5 — Docker e infra (T29-T33)
- [ ] Fase 6 — VM apt (T34-T36)
- [ ] Fase 7 — Fechamento (T37-T52)

## Critério de conclusão
Smoke prod completo com toolchain alinhado (1 versão de Node, Express 5 em todos, deps npm atualizadas, imagens Docker frescas, VM com apt em dia).

## Arquivos a modificar
- `specs/backlog.md` — atualizar status D-DEP2, D-DEP1, BL-MESAS-EXPRESS5-016
- `specs/README.md` — adicionar spec 033
- `.specify/memory/project-state.md` — registrar toolchain canônico
- `.specify/memory/decisions.md` — D0NN (versão Node alvo)
- `sessoes/index.md` — esta sessão

## Evidências (estado atual)
- Node: 24-alpine (todos Dockerfiles) · 24 no CI · `.nvmrc`/`engines.node` = `>=24`
- Express: 5.2.1 unificado (todos backends), zero Express 4 no lockfile
- TypeScript: 5.9.3 (todos), React: 19.2.7 (todos)
- express-rate-limit: 8.5.2 (todos), zod: 4.3.6 (mesas) / 3.25.57 (accounts/config)
- pnpm: 10.12.1 · Postgres: 16-alpine (todos)
- Deploy mesas beta Express 5: run `27801765034` verde, 3 containers healthy, smoke 200/401/302
- Breaking changes: `breaking-changes.md` itens 1-11 (achados prévios + correções pós-execução)
- PRs mergeados em dev: #63/#64/#65/#66 (commits `c6d037b`/`1161a65`/`cd8e2c9`/`3412597`)
- Débito: `BL-DEP-MESAS-AUTO-PUSH` (auto_deploy_on_push:true)

## T5b executado (2026-06-18) — investigação read-only de breaking changes
- Deliverable: `specs/033-infra-toolchain-update/breaking-changes.md` (11 majors, arquivos reais por dep via rg/grep). Path no tasks.md corrigido de `artifacts/033/` → `specs/033-...` (mantenedor: material da spec fica na spec).
- Risco rebaixado p/ 🟢: **zod 3→4** (sem `.email()`/`errorMap` no código, só `.url()` que segue válido), **dotenv**, **express-rate-limit**, **multer** — bumps sem mudança de código.
- 🔴 estrutural só em: **tailwind 3→4** (glossario CSS-first) e **eslint flat** (glossario).
- **ACHADO/bug** → `BL-033-GLOSSARIO-LINT-NEVER-RAN`: `apps/glossario/frontend` não tem config ESLint nenhum (sem `.eslintrc*`/`eslint.config.js`); lint nunca rodaria sob ESLint 8. T64a cria do zero, não "migra legado". Registrado em `specs/backlog.md` (P2) + tasks.md T5b.
- Débito secundário: `BL-033-LUCIDE-1X-GLOSSARIO` (lucide 0.363→1.x, 18 arquivos).
- Backlog atualizado: 2 itens abertos novos. Sem commit/push (tudo local).

## Fase 4 — Deps npm (incremental)

### T22 — Backup pré-deps ✅ (2026-06-18)
- `git tag pre-033-f4-deps` (local)
- `artifacts/033/pnpm-lock.yaml.pre-033-f4` — 0.49MB
- `artifacts/033/pre-f4-dep-list.txt` + `pre-f4-outdated.txt`
- Outdated mostra: 12 bumps disponíveis (patch: @types/react, dompurify, sanitize-html, turbo, tailwindcss; minor: axios, google-auth-library, etc.)

### T23 — Remover zumbis (marked, @types/dompurify) ✅ (2026-06-18)
- `apps/mesas/frontend/package.json`: removido `marked` + `@types/dompurify`
- `pnpm install` OK, `pnpm --filter @artificio/mesas-frontend build` verde
- grep `marked|@types/dompurify` no package.json = ZERO

### T25i — Unificar React `^19.2.7` ✅ (2026-06-18)
- Bump em 6 manifests: accounts (19.1→), glossario-frontend (19.1→), mesas-frontend (19.2→), analytics peer+dev (19.1→), auth peer+dev (19.1→), ui (19.1→)
- site-admin já estava em `^19.2.7` — sem alteração
- `pnpm why` lockfile: `react@19.2.7` único, zero 19.0-19.6
- `@artificio/ui test`: **8/8** ✅
- `turbo build --force`: **13/13** ✅
- `pnpm audit --prod`: 7 vulns pré-existentes (dompurify, nanoid) — nenhum novo do React

### T27-T28 — Validação final da Fase 4 ✅ (2026-06-18)
- `turbo build --force`: **13/13** verde → `artifacts/033/post-f4-build.log`
- `@artificio/ui test`: 8/8 ✅
- `@artificio/glossario-backend test`: 22/22 ✅
- `@artificio/mesas-backend test`: **15/16 suites, 113/113 testes** — idêntico à baseline ✅
- `pnpm lint`: não rodado (4 pacotes sem config — BL-033-GLOSSARIO-LINT-NEVER-RAN)

### Erros do T28 (compilado)

**1. 🔴 `ingestMessages.test.ts` — falha pré-existente (baseline)**
- Erro: `process.exit(1)` — `DATABASE_URL` ausente no ambiente de teste local (Jest)
- Arquivo: `apps/mesas/backend/src/discord/__tests__/ingestMessages.test.ts`
- Causa: o teste importa `kysely` → código do bootstrap tenta conectar → sem `DATABASE_URL` setada → `process.exit(1)`
- Status: pré-existente desde a baseline (Fase 2/T7); NÃO é regressão da Fase 4
- Ação futura: setar `DATABASE_URL` de teste no jest config ou mockar a conexão DB

**2. 🔴 Kysely 0.29.2 — 4 suites quebradas (T25c, já revertido)**
- Erro: `Jest failed to parse a file` → `export * from './kysely.js'` em `node_modules/kysely@0.29.2/dist/index.js`
- Arquivos afetados (4): `db/prod.test.ts`, `ingestMessages.test.ts`, `adminDiscordSync.drafts.patch.test.ts`, `adminHydration.test.ts`
- Causa raiz: kysely 0.29.2 é ESM-only (`"type":"module"`, `exports` sem CJS fallback); Jest 30 + ts-jest 29 não transpila `.js` ESM de node_modules
- Tentativas de fix: `transformIgnorePatterns` (insuficiente — ts-jest só processa `.ts`); custom `transform` para `.js` (ts-jest não lida com `.js` ESM)
- Resolução: **revertido** para `^0.28.15` (accounts) / `^0.28.9` (mesas-backend) → lockfile resolve `0.28.17` único
- Débito: `BL-KYSELY-029-ESM` — migrar mesas de Jest para vitest, ou instalar `@swc/jest`, ou esperar ts-jest com suporte ESM nativo

**3. 🟡 `pnpm lint` — 4 pacotes sem config ESLint**
- Erro: `ESLint couldn't find an eslint.config file` em 4 pacotes
- Pacotes: `apps/glossario/frontend`, `packages/content`, `packages/analytics`, `packages/auth`
- Causa: migração ESLint 8→9→10 requer flat config; glossario-frontend nem nunca teve config (BL-033-GLOSSARIO-LINT-NEVER-RAN)
- Status: coberto por T64a/T65 (Fase 4B) — não é escopo da Fase 4
- Impacto no T28: lint não pôde ser validado nestes pacotes; sem regressão demonstrável

**4. 🟢 Zero regressão nos demais**
- `@artificio/ui`: 8/8 passam
- `@artificio/glossario-backend`: 22/22 passam
- `@artificio/mesas-backend`: 15/16 suites = baseline; 12 de 16 suites passam 100%
- `apps/mesas/backend`: `^16.4.5` → `^17.4.2`
- `apps/site`: `^16.4.7` → `^17.4.2`
- `apps/glossario/backend`: já estava em `^17.3.1` — sem bump necessário
- Uso verificado: 5× `dotenv.config()` padrão + 3× `import 'dotenv/config'` — API inalterada no 17
- Build mesas-backend + site verdes ✅
- **T25a — react-router-dom `^7.18.0`:** mesas-frontend (7.13→), glossario-frontend (7.13→), site-admin (7.17→), analytics peer+dev (7.13→)
- **T25b — google-auth-library `^10.7.0`:** accounts (10.5→), mesas-backend (10.6→)
- **T25c — kysely `^0.29.2`:** accounts (0.28.9→), mesas-backend (0.28.15→)
- **T25d — multer `^2.2.0`:** mesas-backend (2.1→), site (2.1→)
- **T25e — sharp `^0.35.1`:** site (0.34→)
- **T25f — axios `^1.18.0`:** glossario-frontend (1.14→)
- **T25g — zod `^4.4.3` (mesas):** mesas-backend (4.3→), mesas-frontend (4.3→)
- **T25h — lucide-react `^1.21.0`:** mesas-frontend (1.7→)
- `turbo build --force`: **13/13 verde** ✅
- `pnpm outdated --no-dev`: zero pendências nos bumps executados; residuais são Fase 4B (zod 3→4 accounts/config, TS6, Vite8, etc.)

---

## Fase 3 — Express 5 (mesas)

### T13 — Backup pré-Express (2026-06-18) ✅
- `git tag pre-033-f3-express` (local)
- `artifacts/033/pnpm-lock.yaml.pre-033-f3`
- `artifacts/033/mesas-backend-package.json.pre-033-f3`
- `artifacts/033/pre-f3-mesas-beta-dump.sql` — 2.5MB, PostgreSQL dump válido
- Beta acessível: `mesas-beta-db Up 4 hours (healthy)`

### T14 — Baseline pré-Express (2026-06-18) ✅
- `tsc --noEmit`: **0 erros** (limpo)
- `turbo build`: **3/3 verde** (config, auth, mesas-backend)
- Testes (16 suites): **15 passed, 1 failed (pré-existente)**, 113/113 tests passed
- Falha pré-existente: `ingestMessages.test.ts` → `process.exit(1)` por `DATABASE_URL` ausente
- Logs: `artifacts/033/pre-f3-mesas-{tsc,build,test}.log`

### T15 — Migrar mesas-backend Express 4→5 (2026-06-18) ✅
- `express ^4.19.2` → `^5.2.1`, `@types/express ^4.17.21` → `^5.0.6`
- `og.ts:201`: `'*'` → `'/{*splat}'` (path-to-regexp v8)
- `upload.ts:25`: `as any` (incompat `@types/multer@2` com Express 5)
- `pnpm patch @types/express-serve-static-core@5.1.1`: `ParamsDictionary[key]` → `string`
- **tsc 0 erros, build 3/3 verde**

### T15b — Unificar Express 5 + remover shim/override + bump rate-limit (2026-06-18) ✅
- Express já unificado em `5.2.1` (lockfile único após bump mesas)
- `pnpm.overrides`: removido `@types/multer>@types/express`
- `rateLimit.ts`: removido `asExpress4Handler` shim (4 limiters)
- `express-rate-limit` 7→8: `import { rateLimit }` (v8 sem default export), `max`→`limit`, `message` string OK
- `as any` multer: `upload.ts` (mesas) + `admin-api.ts` (site)
- tsc 0 erros (4 backends), **turbo build 13/13 verde**

### T17-T20 — Testes de impacto (2026-06-18) ✅
- T17: tsc 0 erros, build 3/3 (zero regressão vs baseline)
- T18: 15/16 suites, 113/113 testes (zero regressão)
- T19: testes de integração existentes passam (auth, adminHydration, adminTablesAutoArchive, adminDiscordSync)
- T20: build 13/13 monorepo completo (já validado em T15b)

### T21 — Deploy mesas beta ✅ (2026-06-18)
- PR #63 mergeado em dev (`c6d037b`), deploy falhou 2x (ENOENT patches/)
- PR #64 mergeado em dev (`1161a65`): remove express-async-errors + fix og (review PR #63)
- PR #65 mergeado em dev (`cd8e2c9`): `COPY patches` production stage + docs
- PR #66 mergeado em dev (`3412597`): fix wildcard `'*'` → `'/{*splat}'` + docs
- **5º deploy (run `27801765034`) verde** — 3 containers healthy, sem restart
- **Smoke beta:** `/` 200, `/api/v1/me/options` 401, `/api/v1/auth/google` 302
- 4 falhas de deploy diagnosticadas e corrigidas antes do sucesso:
  1. Builder stage sem `COPY patches` → ENOENT (fix PR #64)
  2. Idem 1 — confirmação
  3. Production stage `--prod` sem `COPY patches` → ENOENT (fix PR #65)
  4. `og.ts` `'*'` bare wildcard → `PathError: Missing parameter name at index 1` (fix PR #66)
- **Aprendizado:** path-to-regexp@8.4.2 **rejeita** `'*'` bare wildcard na VM (Docker build). `'/{*splat}'` é a sintaxe correta Express 5.
- **Deploy auto-disparado** (mesas = único app com `auto_deploy_on_push:true`) → débito `BL-DEP-MESAS-AUTO-PUSH`

### Correção T28 #1 — ingestMessages.test.ts DATABASE_URL side-effect ✅ (2026-06-19)

- **Causa raiz:** `db/index.ts:9-11` tem side-effect `process.exit(1)` no nível do módulo quando `DATABASE_URL` ausente. O teste `ingestMessages.test.ts` importa `listForumThreads`, que importa `ingestMessages.ts`, que importa `{ db } from '../db'`. `listForumThreads` não usa o `db`, mas o import transitivo mata o processo Jest antes de rodar qualquer assert.
- **Solução (Option 1 — setupFiles):** `jest.setup.ts` injeta `process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'` antes de qualquer módulo carregar. Zero mudança em código de produção; DT-004 preservada (runtime real ainda exige DATABASE_URL no `.env`).
- **Arquivos modificados:** `apps/mesas/backend/jest.setup.ts` (novo), `apps/mesas/backend/jest.config.js` (+1 linha `setupFiles`).
- **Validação real:** `pnpm --filter @artificio/mesas-backend test` → **16/16 suites, 114/114 testes** ✅ (antes 15/16, 113). `tsc --noEmit` 0 erros ✅. `turbo build --filter=@artificio/mesas-backend` 3/3 verde ✅.
- **Débito:** `BL-MESAS-TEST-DB-SIDEEFFECT` — aberto e fechado nesta correção no `specs/backlog.md`.
- **Sem commit/push** — código local, aguarda autorização.

### T28b — Investigação Option 2 (lazy db, correção de raiz) (2026-06-19)

**Objetivo:** investigar migração de `db/index.ts` para lazy (Proxy), eliminando o side-effect `process.exit(1)` no nível do módulo — como `db/prod.ts` já faz. Só investigação; sem implementação.

#### Inventário de consumidores

- **43 arquivos** importam `{ db } from '../db'` (ou `'../db/index'`)
- **42/43 USAM `db` de fato** (queries, transações, etc.)
- **1/43 não usa nos paths exercitados pelo teste:** `ingestMessages.ts` — `listForumThreads()` só faz HTTP (Discord API), mas `persistMessages`/`ingestMessages`/`ingestForumMessages` usam `db`. O import arrasta o side-effect para o teste que só chama `listForumThreads`.

| Categoria | Arquivos | Usam db? |
|---|---|---|
| Entrypoint | `server.ts` | Sim (health check) |
| Routes (18) | `activityLog, adminDiscordSync, adminHydration, adminSettingSuggestions, adminTables, communicationPlatforms, devFeedback, devFeedbackAdmin, discord, gm, gmPanel, me, notifications, og, scenarios, scenarioSuggestions, scenarioSuggestionsAdmin, settings, systems, systemSuggestions, systemSuggestionsAdmin, tableSchedules, tables, vttPlatforms` | Todos usam |
| Services (6) | `activityLogger, adminNotifications, benchmarkService, linkService, profileService, tableArchiving, tableService` | Todos usam |
| Middleware (1) | `auth` | Sim |
| Repositories (1) | `tableRepository` | Sim |
| Discord (3) | `config, ingestMessages, syncDiscordDraftToTable` | Todos usam |
| Scripts (8) | `cleanupLinkMetadataCache, cleanupMetricEvents, importCenarios, importSistemas, processLinkMetadataJobs, retryDiscordImageUploads, syncDiscordChannels, systemsTreeImport` | Todos usam |

#### Padrão lazy existente: `db/prod.ts`

`prodDb` (linhas 9-38) já usa Proxy com getter lazy — modelo maduro e testado:
- `_prodDbInstance` privado, singleton
- `getProdDb()` valida `PROD_DB_URL` + cria Pool + Kysely **no primeiro acesso**
- Proxy intercepta `get`: `isProdConnection` retorna `true` sem inicializar; métodos são bound ao instance real
- Teste `prod.test.ts` prova que `prodDb.isProdConnection` funciona sem inicializar pool

#### Como ficaria o `db/index.ts` (Option 2)

```typescript
// Pseudocódigo do design-alvo
let _dbInstance: Kysely<Database> | null = null;

function getDb(): Kysely<Database> {
  if (_dbInstance) return _dbInstance;
  dotenv.config();
  if (!process.env.DATABASE_URL) {
    console.error('[DB] ERRO CRÍTICO: DATABASE_URL não está definida no .env');
    process.exit(1);
  }
  // ... validação de URL (DT-007) ...
  const dialect = new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }),
  });
  _dbInstance = new Kysely<Database>({ dialect });
  return _dbInstance;
}

export const db = new Proxy({} as Kysely<Database>, {
  get(_target, prop) {
    const instance = getDb();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
```

#### Análise de impacto

| Aspecto | Situação atual | Com Option 2 |
|---|---|---|
| `import { db } from '../db'` | `process.exit(1)` se sem DATABASE_URL | Sempre seguro (Proxy vazio) |
| Primeiro `db.selectFrom(...)` | Pool já aberto | Abre pool na hora (lazy) |
| `jest.mock('../db', ...)` | Hoisted, ignora side-effect | Continua funcionando idêntico |
| Teste sem mock (ex: ingestMessages) | `process.exit(1)` ❌ | Passa ✅ (listForumThreads não toca db) |
| `dotenv.config()` | Executa no import do módulo | Move para `getDb()` — idempotente, roda no 1º query |
| DT-004 (validação DATABASE_URL) | Module-level `process.exit(1)` | Dentro de `getDb()` — mesmo comportamento em runtime |
| `server.ts` fallback | Linhas 41-47 já validam DATABASE_URL | Redundante com `getDb()`, mas seguro (fail-fast no boot) |
| Scripts sem dotenv próprio (7/8) | Recebem dotenv do import de `db/index.ts` | Recebem dotenv do 1º `db.xxx()` — equivalente, pois todos usam db |
| `syncDiscordChannels.ts` | Chama `import 'dotenv/config'` próprio | Sem alteração necessária |

#### Blast radius

- **Arquivos a modificar:** 1 (`db/index.ts`) — reescrever ~20 linhas para padrão Proxy
- **Arquivos a adicionar dotenv próprio:** 0 — `getDb()` chama `dotenv.config()`; todos os 42 consumidores chegam ao `getDb()` no 1º uso real
- **API de consumo:** ZERO mudança — `import { db } from '../db'` idêntico; `db.selectFrom(...)` idêntico
- **Testes existentes:** ZERO quebra — `jest.mock` hoisted funciona igual; `prod.test.ts` prova que Proxy é compatível
- **Teste corrigido:** `ingestMessages.test.ts` passa SEM `jest.setup.ts` (a Option 1 vira desnecessária)
- **Rollback:** 1 arquivo (`git checkout -- apps/mesas/backend/src/db/index.ts`)
- **Smoke necessário:** `pnpm --filter @artificio/mesas-backend test` (16/16) + `tsc --noEmit` + `turbo build` + deploy mesas beta com smoke `/health` (usa `db`) + `/api/v1/me/options` (usa `db` via auth middleware)

#### Decisão pendente

**Option 2 (lazy db) é superior à Option 1 (setupFiles) em todos os aspectos:**
- Corrige a causa raiz (antipadrão side-effect no módulo)
- Zero configuração de teste necessária (sem `jest.setup.ts`, sem `setupFiles`)
- Reusa padrão já provado em produção (`db/prod.ts`)
- Blast radius mínimo: 1 arquivo, sem quebra de API
- Rollback trivial
- `ingestMessages.test.ts` + qualquer teste futuro que importe `db` transitivamente passa sem mock

**Custo da Option 1 (já aplicada):** 2 arquivos locais que podem ser revertidos quando a Option 2 for implementada.

**Próximo passo:** aprovação do mantenedor para implementar Option 2; reverter `jest.setup.ts` + `setupFiles` (tornados redundantes).

### T28 — Re-investigação dos erros + decisão de padronização (2026-06-19)

Mantenedor pediu investigar os erros do T28 e resolver kysely (#2) "dentro do plano da versão idealizada" e "evitando exceções".

**Descoberta corrigida (breaking-changes.md item 3 estava errado):** kysely 0.29 é **ESM-only** — deixou de shipar CommonJS (0.28.17 ainda era dual `import`+`require`). `dist/esm/`→`dist/`; target es2023; TS mín 5.4; `sql.value/literal` removidos e migration exports movidos (**ambos não usados** no código). Fonte: release v0.29.0.

**Mapa de impacto real:** só `apps/mesas/backend` (25 src) + `apps/accounts` usam kysely; glossario/site usam `pg`. accounts + glossario-backend já são **vitest** (ESM nativo) → 0.29 ok sem mexer. mesas é o **único em jest+ts-jest** (ts-jest só transpila `.ts`, não o `.js` ESM) → foi o que reverteu o T25c. accounts não tem teste importando kysely.

**Footprint da migração vitest:** 16 suites, só **6 arquivos** usam `jest.*` (`jest.fn`×23, `jest.mock`×11, `jest.Mock`×2, `requireMock`/`requireActual`/`restoreAllMocks`/`clearAllMocks`×1). Nenhuma suite importa `@jest/globals` → `globals:true` cobre. Caso delicado único: `adminDiscordSync.drafts.patch.test.ts` (`requireActual`/`requireMock` viram `await vi.importActual/importMock`).

**Decisão (D078) — princípio do mantenedor: padronizar, eliminar exceções:**
1. kysely `^0.29.2` unificado (mesas+accounts).
2. **mesas jest → vitest** (1 runner no monorepo). `@swc/jest` descartado (manteria jest como exceção).
3. **db/index.ts → lazy Proxy (Option 2/T28d)** junto: remove o side-effect e o hack `jest.setup.ts` (Option 1) de vez.

Tasks criadas: T28c (vitest+kysely) + T28d (lazy db). Registros: D078 (decisions.md), breaking-changes.md item 3 reescrito, BL-KYSELY-029-ESM + BL-MESAS-DB-LAZY-OPTION2 → "decidido (impl pendente)". Sem commit/push (tudo local).

#### T28c + T28d — IMPLEMENTADO + validado local (2026-06-19)

Arquivos:
- `apps/mesas/backend/package.json`: kysely `^0.29.2`; removido jest/ts-jest/@types/jest; add vitest+@vitest/coverage-v8; scripts `vitest run`.
- `apps/accounts/package.json`: kysely `^0.29.2`.
- novo `apps/mesas/backend/vitest.config.ts` (`globals:true`, env node); removidos `jest.config.js` + `jest.setup.ts`.
- `tsconfig.json`: `types:["node","vitest/globals"]`.
- `db/index.ts`: reescrito p/ Proxy lazy (`getDb()` igual `prodDb`; DT-004/DT-007 dentro; sem side-effect no import).
- 6 test files `jest.*`→`vi.*`. `adminDiscordSync.drafts.patch.test.ts`: imports estáticos + `import type { Mock }` (sem TLA, `module:CommonJS`). `uploadDiscordImage.test.ts`: `vi.fn<typeof fetch>()`.

Validação real:
- `pnpm why kysely` = só `0.29.2`.
- vitest mesas-backend: **16/16 suites, 114/114 testes** (ingestMessages passa com `DATABASE_URL=''` → lazy db provado).
- `tsc --noEmit` mesas: **0**. accounts vitest: **8/8**. `turbo build --force`: **13/13**.
- runtime CJS: `node -e require('kysely')` → Kysely/PostgresDialect/sql = function (require(esm) OK).

Status: BL-KYSELY-029-ESM + BL-MESAS-DB-LAZY-OPTION2 + BL-MESAS-TEST-DB-SIDEEFFECT = impl+validado local; **deploy beta mesas + smoke pendente (aprovação nominal)** p/ fechar de vez. Sem commit/push.

### Aprendizados da Fase 3
1. **express-async-errors@3 crasha no Express 5** — requer `express/lib/router/layer` (inexistente). Remover.
2. **path-to-regexp v8 (Express 5) wildcard:** `'*'` bare **NÃO** funciona no Docker build (path-to-regexp@8.4.2 do lockfile rejeita: `Missing parameter name at index 1`). Sintaxe correta: `'/{*splat}'` — casa raiz `/`. `'/*splat'` não casa raiz. Local funcionava por cache/versão diferente; VM/Docker build expôs o erro real.
3. **pnpm patch + Docker:** `COPY patches ./patches` obrigatório nos Dockerfiles, em CADA estágio com `pnpm install --frozen-lockfile`, inclusive `--prod`.
4. **ParamsDictionary:** `@types/express-serve-static-core@5` mudou `[key]` → `string | string[]`. Module augmentation não funciona com genéricos.
5. **@types/multer@2** depende de `@types/express@4` → `as any` nos pontos de uso.
6. **express-rate-limit@8:** sem default export, `max`→`limit`.
