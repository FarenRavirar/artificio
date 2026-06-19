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
2. ✅ Spec 033 criada (spec.md, plan.md, tasks.md — 23 tarefas em 7 fases)
3. 🔜 Aprofundar React e Express — breaking changes, código depreciado (T3, T4)
4. ⏳ Executar fases 1→7 conforme aprovacao

## Checklist de fechamento
- [ ] T0 — pesquisa inicial e criação da spec
- [ ] T1-T4 — fase de pesquisa (inventariar versões + breaking changes + código depreciado)
- [ ] T5-T7 — toolchain base (Node + pnpm + CI)
- [ ] T8-T10 — Express 5 (mesas)
- [ ] T11-T13 — React e deps npm
- [ ] T14-T16 — Docker e infra
- [ ] T17-T19 — VM (apt)
- [ ] T20-T23 — fechamento e documentação

## Critério de conclusão
Smoke prod completo com toolchain alinhado (1 versão de Node, Express 5 em todos, deps npm atualizadas, imagens Docker frescas, VM com apt em dia).

## Arquivos a modificar
- `specs/backlog.md` — atualizar status D-DEP2, D-DEP1, BL-MESAS-EXPRESS5-016
- `specs/README.md` — adicionar spec 033
- `.specify/memory/project-state.md` — registrar toolchain canônico
- `.specify/memory/decisions.md` — D0NN (versão Node alvo)
- `sessoes/index.md` — esta sessão

## Evidências
- VM: Ubuntu 24.04.4 ARM, Docker 29.5.3, Compose v5.1.4, 5 apt upgradable, sem Node/pnpm host
- Node: CI=20, accounts Dockerfile=20, demais Dockerfiles=25.9.0, dev local=25.8.2
- Express: mesas=4.22.2, accounts/glossario/site=5.2.1
- React: 19.2.7 (todos), TypeScript: 5.9.3
- pnpm: 10.12.1, Postgres: 16-alpine (todos)
- Docker: 5 imagens stale de 2026-06-04, node:20-alpine de 2026-04-15
- 6 Dockerfiles, 8 docker-compose files, 2 workflows CI com setup-node

## T5b executado (2026-06-18) — investigação read-only de breaking changes
- Deliverable: `specs/033-infra-toolchain-update/breaking-changes.md` (11 majors, arquivos reais por dep via rg/grep). Path no tasks.md corrigido de `artifacts/033/` → `specs/033-...` (mantenedor: material da spec fica na spec).
- Risco rebaixado p/ 🟢: **zod 3→4** (sem `.email()`/`errorMap` no código, só `.url()` que segue válido), **dotenv**, **express-rate-limit**, **multer** — bumps sem mudança de código.
- 🔴 estrutural só em: **tailwind 3→4** (glossario CSS-first) e **eslint flat** (glossario).
- **ACHADO/bug** → `BL-033-GLOSSARIO-LINT-NEVER-RAN`: `apps/glossario/frontend` não tem config ESLint nenhum (sem `.eslintrc*`/`eslint.config.js`); lint nunca rodaria sob ESLint 8. T64a cria do zero, não "migra legado". Registrado em `specs/backlog.md` (P2) + tasks.md T5b.
- Débito secundário: `BL-033-LUCIDE-1X-GLOSSARIO` (lucide 0.363→1.x, 18 arquivos).
- Backlog atualizado: 2 itens abertos novos. Sem commit/push (tudo local).

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
- `og.ts:201`: `'*'` → `'/*splat'` (path-to-regexp v8)
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

### ⏳ T21 — Deploy beta pendente (requer aprovação nominal)
- PR #63 criado: `infra/033-toolchain-update` → `dev`
- Merge + deploy beta pendentes de aprovação
