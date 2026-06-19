# Tasks — 033

> Ordem: Fase 1 (pesquisa) → Fase 2 (toolchain) → Fase 3 (Express) → Fase 4 (deps npm) → Fase 5 (Docker) → Fase 6 (VM/apt) → Fase 7 (fechamento).
> Aprovação nominal (por ação, não por sessão): `git push`/merge de PR em dev, deploy (beta e prod), write na VM/Oracle. `git commit` local não exige aprovação isolada; o push que o leva ao remoto exige.
>
> **Regra pétrea de backup:** cada fase que altera código ou runtime começa com backup (git tag + lockfile snapshot) e termina com teste de impacto. Sem backup → sem avançar.

---

## Estratégia de Backup por Fase

| Fase | Backup de código | Backup de estado | Restauravel via |
|---|---|---|---|
| 2 (Node) | `git tag pre-033-f2-node` + branch dedicada | `pnpm-lock.yaml` copiado para `artifacts/033/` | `git reset --hard <tag>` + `pnpm install --frozen-lockfile` |
| 3 (Express) | `git tag pre-033-f3-express` | dump DB beta mesas (`pg_dump mesas_rpg`) | `git reset` + restore dump |
| 4 (deps) | `git tag pre-033-f4-deps` | `pnpm-lock.yaml` copiado | `git reset` + lockfile original |
| 5 (Docker) | `git tag pre-033-f5-docker` | `docker images` snapshot, dump DBs beta | `git reset` + rebuild com imagens antigas |
| 6 (apt) | código não muda | **snapshot VM + pg_dump ALL** (Gate A) | restore snapshot Oracle |
| 7 (prod) | `git tag pre-033-f7-prod` | dump DBs prod + backup off-VM | restore dump + `git reset --hard <tag>` |

**Política:** tags são locais até push autorizado. Backups de código vivem em `C:\projetos\artificiobackup\spec-033\`. Lockfiles originais preservados como `pnpm-lock.yaml.pre-033-fN`.

---

## Resultados da Investigação (Fase 1 executada 2026-06-18)

### Divergências críticas encontradas

| Componente | CI | accounts | mesas-backend | mesas-frontend | glossario-backend | glossario-frontend | site |
|---|---|---|---|---|---|---|---|
| **Node** | `20` | `20` (Dockerfile) | `25.9.0` (Dockerfile) | `25.9.0` (builder) | `25.9.0` (Dockerfile) | `25.9.0` (builder) | `25.9.0` (Dockerfile) |
| **Express** | — | `^5.1.0` | **`^4.19.2`** | — | `^5.2.1` | — | `^5.1.0` |
| **@types/node** | — | — | **`^20.12.7`** | `^24.12.0` | `^25.5.0` | — | — |
| **@types/express** | — | — | **`^4.17.21`** | — | `^5.0.6` | — | — |
| **zod** | — | `^3.25.57` | `4.3.6` | `^4.3.6` | — | — | — |
| **tailwindcss** | — | — | — | `^4.2.2` | — | **`^3.4.3`** | `^4.2.2` |
| **vite** | — | `^6.3.5` | — | `^8.0.1` | — | **`^5.2.0`** | Astro 5 (Vite 6) |
| **eslint** | — | — | — | `^9.39.4` | — | **`^8.57.1`** | — |
| **pnpm** | `10.12.1` | — | — | — | — | — | — |
| **Postgres** | — | `16-alpine` | `16-alpine` | — | `16-alpine` | — | `16-alpine` |
| **TypeScript** | `5.9.3` (root) | — | — | — | — | — | — |

### Outros achados

- **pnpm audit:** ZERO vulnerabilidades.
- **express-rate-limit:** mesas tem shim `asExpress4Handler`. glossario usa direto (já Express 5).
- **@types/dompurify:** depreciado (dompurify já shipa tipos). Remover.
- **marked:** dependência zumbi (declarada, 0 imports). Remover.
- **mesas-backend:** CommonJS (sem `"type":"module"`). `require()` dinâmico é válido.
- **React:** código limpo — sem APIs depreciadas.
- **Node.js APIs:** sem `fs.rmdir`, `url.parse`, `new Buffer()`, `createCipher`.
- **126 async route handlers** no mesas: ~125 têm try/catch explícito; 1 sem (discord.ts:11, coberto por express-async-errors). Express 5 lida com async errors nativamente.
- **Imagens stale na VM:** 5 imagens de 2026-06-04.
- **apt VM:** 5 pacotes upgradable (baixo risco, libs de sistema).

### Fora de escopo (specs próprias futuras) — REVISADO pela Fase 4B

Itens abaixo foram movidos para DENTRO do escopo na Fase 4B (unificação de majors): Tailwind 3→4 (glossario), Vite 5→8 (glossario/accounts/ui), ESLint 8→flat 10 (glossario), TypeScript 5→6 (todos), Astro 5→6 (site), zod 3→4 (accounts/config/mesas).

---

## Fase 1 — Pesquisa e decisão (read-only)

- [x] T1 — **Inventariar versões exatas de todas as deps** ✅
- [x] T2 — **Mapear divergência de Node.js** (3 versões)
- [x] T3 — **Inventariar breaking changes Express 4→5 no mesas** ✅
- [x] T4 — **Inventariar código depreciado React/Node/geral** ✅
- [x] T5 — **Decidir versão alvo de Node.js** ✅ (decidido 2026-06-18)
  - **DECIDIDO: Node 24 LTS** (Active LTS desde out/2025, EOL abr/2028). Node 25 descartado: ímpar/Current, EOL ~jun/2026 (não-LTS). Node 22 LTS (EOL abr/2027) é fallback conservador.
  - Verificar: `glossario-backend` já pinou `@types/node@25.5.0` — rebaixar para `@types/node@24` (types acompanham runtime, não o definem).
  - **Feito quando:** decisão em `decisions.md` (D0NN)
- [x] T5b — **Ler changelogs de TODAS as deps com major bump** (SÓ leitura) — base da migração da Fase 4B ✅ (2026-06-18 → `specs/033-infra-toolchain-update/breaking-changes.md`)
  - **Backend/utilidades:**
    - `express-rate-limit` 7→8: `message` string ainda aceita? `keyGenerator` assinatura?
    - `dotenv` 16→17: `dotenv.config()` assinatura igual?
    - `kysely` 0.28→0.29: breaking changes?
    - `multer` 2.1→2.2: breaking changes?
    - `lucide-react` 0.363→1.21 (glossario): ícones usados ainda existem?
  - **Majors do toolchain (unificação Fase 4B):**
    - `zod` 3→4: `.parse`/`.safeParse` iguais? `z.string().email()` → `z.email()`? error map mudou? (config, accounts, mesas)
    - `typescript` 5→6: flags removidas no `tsconfig`? `moduleResolution`/`lib` defaults? APIs de compilador? (todos)
    - `vite` 5/6→8: formato de `vite.config`, plugins (`@vitejs/plugin-react`), defaults de `build.target`, Node mínimo (accounts, ui, glossario)
    - `tailwindcss` 3→4: **CSS-first** — `tailwind.config.{ts,js}` → `@theme` no CSS; PostCSS plugin vira `@tailwindcss/postcss`/`@tailwindcss/vite`; diretivas `@tailwind` → `@import "tailwindcss"` (glossario)
    - `eslint` 8/9→10: flat config obrigatório (glossario ainda em `.eslintrc` legado); `typescript-eslint` 8.61.1 (suporta ESLint 10 + TS <6.1.0 — confirmado); plugins react-hooks/react-refresh compatíveis (confirmado)
    - `astro` 5→6: breaking de config/content collections/integrations; `node >=22.12.0` (Node 24 OK); `@astrojs/check` compat (site)
  - **Confirmar matriz de peers** (já levantada): typescript-eslint aceita eslint^10 e ts<6.1.0; react-hooks aceita eslint 10; astro 6 exige node>=22.12.
  - **Feito quando:** changelog de cada major lido; breaking changes que afetam NOSSO código documentados em `specs/033-infra-toolchain-update/breaking-changes.md` (por dep, com arquivos impactados) ✅
  - **ACHADO:** glossario-frontend NÃO tem config ESLint (nem `.eslintrc*` nem `eslint.config.js`) — T64a cria do zero, não "migra legado". Débito `BL-033-GLOSSARIO-LINT-NEVER-RAN`.

---

## Fase 2 — Toolchain: Node + pnpm + CI

### 2.0 — Backup pré-Node

- [x] T6 — **Backup de código antes de mexer no Node** ✅ (tag `pre-033-f2-node`, lockfile+snapshots; commit `72da8cb`)
  - `git tag pre-033-f2-node` (local)
  - Copiar `pnpm-lock.yaml` → `C:\projetos\artificiobackup\spec-033\pnpm-lock.yaml.pre-033-f2`
  - `pnpm list --depth 0 -r` → `artifacts/033/pre-f2-dep-list.txt`
  - `pnpm outdated -r` → `artifacts/033/pre-f2-outdated.txt`
  - **Feito quando:** arquivos salvos; `git tag -l 'pre-033-f2-*'` lista a tag

### 2.1 — Baseline de testes pré-Node

- [x] T7 — **Executar baseline completa de builds/tests/lint (Node ATUAL, ANTES de mudar)** ✅ build 13/13 · ui 8/8 · glossario 22/22 · lint 2/5 (content/analytics/auth sem eslint.config)
  - `turbo build --force 2>&1 | Tee-Object artifacts/033/pre-f2-build.log` — confirmar 13/13 verde
  - `pnpm lint 2>&1 | Tee-Object artifacts/033/pre-f2-lint.log` — registrar estado atual (com falhas conhecidas)
  - `pnpm --filter @artificio/ui test 2>&1 | Tee-Object artifacts/033/pre-f2-ui-test.log`
  - `pnpm --filter @artificio/glossario-backend test 2>&1 | Tee-Object artifacts/033/pre-f2-glossario-test.log`
  - `pnpm --filter @artificio/mesas-backend test 2>&1 | Tee-Object artifacts/033/pre-f2-mesas-test.log` (se existir)
  - **Feito quando:** todos os logs salvos; número de passes/falhas anotado como baseline

### 2.2 — Alteração

- [x] T8 — **Alinhar Node.js canônico em todo o projeto** ✅ Node 24 (commit `ae49819`)
  - Atualizar `node-version` em `.github/workflows/ci.yml` (L54-56) e `_deploy-module.yml` (L148-150)
  - Atualizar `FROM node:X` em 6 Dockerfiles
  - Adicionar `"engines": { "node": ">=X.Y.Z" }` no `package.json` raiz
  - Criar `.nvmrc` na raiz
  - Alinhar `@types/node`:
    - mesas-backend: `^20.12.7` → `^X`
    - mesas-frontend: `^24.12.0` → `^X`
    - root: `^24.0.0` → `^24`
    - glossario-backend: `^25.5.0` → `^24`
  - `pnpm install` → regenerar lockfile
  - **Feito quando:** grep `node.*(20|24\.)` em Dockerfiles/workflows retorna 0 (exceto lockfile); `.nvmrc` existe; `engines.node` presente

- [x] T9 — **Verificar pnpm (já alinhado)** ✅ 10.12.1, sem bump
  - pnpm `10.12.1` consistente em package.json + CI + dev local
  - Se houver `10.13.x` disponível: bump com mesmo procedimento de backup

### 2.3 — Testes de impacto pós-Node

- [x] T10 — **Validar impacto do Node novo — build completo** ✅ 13/13, zero regressão
  - `turbo build --force 2>&1 | Tee-Object artifacts/033/post-f2-build.log`
  - Comparar com baseline: `diff artifacts/033/pre-f2-build.log artifacts/033/post-f2-build.log`
  - **Critério:** 13/13 apps verdes (mesmo número da baseline); zero regressão
  - **Se falhar:** identificar app/pacote que quebrou; documentar breaking change específico; corrigir ou registrar débito

- [x] T11 — **Validar impacto — lint e testes** ✅ ui 8/8, glossario 22/22; lint sem nova falha
  - `pnpm lint 2>&1 | Tee-Object artifacts/033/post-f2-lint.log`
  - `pnpm --filter @artificio/ui test` — comparar 8/8 com baseline
  - `pnpm --filter @artificio/glossario-backend test` — comparar 22/22 com baseline
  - `pnpm --filter @artificio/mesas-backend test` — se existir
  - **Critério:** mesmo número de passes que baseline; zero nova falha

- [x] T12 — **Teste de impacto: smoke local por app** ✅ tsc mesas-backend limpo; builds 7 artefatos OK
  - **accounts:** build + verificar que `/health`, `/login`, `/api/auth/me` respondem (sem deploy, só build)
  - **mesas:** build frontend+backend OK; verificar tipagem (`tsc --noEmit` em `apps/mesas/backend`)
  - **glossario:** build frontend+backend OK; testes 22/22
  - **site:** build Astro OK; verificar dist gerado com páginas
  - **site-admin:** build SPA OK
  - **ui:** build + testes 8/8 OK
  - **Feito quando:** tabela de impacto preenchida para cada um dos 7 artefatos (accounts, mesas-frontend, mesas-backend, glossario-frontend, glossario-backend, site, site-admin, ui)

---

## Fase 3 — Express 5 (mesas)

### 3.0 — Backup pré-Express

- [x] T13 — **Backup de código e DB antes de migrar Express** ✅ (2026-06-18)
  - `git tag pre-033-f3-express` (local) ✅
  - Copiar `pnpm-lock.yaml` → `artifacts/033/pnpm-lock.yaml.pre-033-f3` ✅
  - Copiar `apps/mesas/backend/package.json` → `artifacts/033/mesas-backend-package.json.pre-033-f3` ✅
  - dump DB beta mesas: `ssh faren 'docker exec mesas-beta-db pg_dump -U admin mesas_rpg' > artifacts/033/pre-f3-mesas-beta-dump.sql` → 2.5MB, PostgreSQL dump válido ✅

### 3.1 — Baseline pré-Express

- [x] T14 — **Executar baseline do mesas-backend (Express 4 ATUAL)** ✅ (2026-06-18)
  - `tsc --noEmit`: **0 erros** (limpo)
  - `turbo build --filter=@artificio/mesas-backend --force`: **3/3 verde** (config, auth, mesas-backend)
  - Testes (16 suites): **15 passed, 1 failed (pré-existente)**, 113/113 tests passed
  - Falha pré-existente: `ingestMessages.test.ts` → `process.exit(1)` por `DATABASE_URL` ausente no ambiente de teste local — não relacionado a Express
  - Logs: `artifacts/033/pre-f3-mesas-tsc.log`, `pre-f3-mesas-build.log`, `pre-f3-mesas-test.log`

### 3.2 — Alteração

- [x] T15 — **Migrar mesas-backend para Express 5** ✅ (2026-06-18)
  - `apps/mesas/backend/package.json`: `express: ^4.19.2` → `^5.2.1`; `@types/express: ^4.17.21` → `^5.0.6` ✅
  - `pnpm install` → lockfile sem express 4 ✅
  - **Correções:**
    - `og.ts:201`: `router.get('*', ...)` → `router.get('/{*splat}', ...)` — path-to-regexp@8.4.2 (Docker build) rejeita `'*'` bare; `'/{*splat}'` é a sintaxe correta Express 5 e casa raiz `/` ✅ (fix aplicado no PR #66)
    - `upload.ts:25`: `upload.single('file') as any` — `@types/multer@2.1.0` depende de `@types/express@4`, incompatível com RequestHandler do Express 5 ✅
    - `pnpm patch @types/express-serve-static-core@5.1.1`: `ParamsDictionary[key: string]: string | string[]` → `string` — Express 5 types usam `string | string[]` por causa de wildcards do path-to-regexp v8; código do mesas sempre acessa params como string simples ✅
  - `express-async-errors@3.1.1`: **removido** (PR #64) — peer `express@^4.16.2`, requer `express/lib/router/layer` inexistente no Express 5, crasha no boot. Express 5 lida com async errors nativamente ✅
  - **Feito quando:** `tsc --noEmit` **0 erros**; `turbo build` **3/3 verde**

- [x] T15b — **Unificar Express 5 nos demais (eliminar skew `5.1.0` vs `5.2.1`)** ✅ (2026-06-18)
  - Express já unificado em `^5.2.1` pelo lockfile após bump do mesas (`pnpm why express` = só `5.2.1`) ✅
  - Removido `asExpress4Handler` de `rateLimit.ts` (4 exportações) ✅
  - Removido `@types/multer>@types/express` de `pnpm.overrides` no root ✅
  - Bump `express-rate-limit`: mesas `7.5.1` → `8.5.2`, glossario `^7.5.1` → `^8.5.2` ✅
  - **Breaking v7→v8:** default export removido → `import { rateLimit }`; `max` → `limit`; `message` string → `any | ValueDeterminingMiddleware` (string segue aceita como any) ✅
  - `as any` em multer: `upload.ts` (mesas) + `admin-api.ts` (site) — `@types/multer@2` depende de `@types/express@4` incompatível ✅
  - **Feito quando:** tsc 0 erros nos 4 backends; `turbo build` **13/13** verde

### 3.3 — Testes de impacto pós-Express

- [x] T17 — **Validar build e tipos do mesas-backend** ✅ (2026-06-18)
  - `tsc --noEmit`: **0 erros** (baseline: 0) ✅
  - `turbo build --filter=@artificio/mesas-backend`: **3/3 verde** (baseline: 3/3) ✅
  - Logs: `artifacts/033/post-f3-mesas-{tsc,build}.log`
  - **Zero regressão** sobre baseline

- [x] T18 — **Teste de unidade: rate-limit com Express 5** ✅ (2026-06-18)
  - `pnpm --filter @artificio/mesas-backend test`: **15/16 suites, 113/113 tests passed**
  - Suites de integração com Express: `auth.test.ts`, `adminHydration.test.ts`, `adminTablesAutoArchive.test.ts`, `adminDiscordSync.drafts.patch.test.ts` — todos passam
  - Falha: `ingestMessages.test.ts` (pré-existente, DATABASE_URL ausente no ambiente de teste local)
  - **Zero regressão** sobre baseline

- [x] T19 — **Teste de integração: rotas críticas do mesas com Express 5** ✅ (2026-06-18)
  - Testes de integração existentes cobrem Express 5 runtime:
    - `auth.test.ts`: cria app Express, testa rotas SSO
    - `adminHydration.test.ts`: cria app, testa admin hydration
    - `adminTablesAutoArchive.test.ts`: cria app, testa auto-archive
    - `adminDiscordSync.drafts.patch.test.ts`: cria app, testa patch de drafts
  - Todos passam (15/16 suites, 113/113 testes)
  - Rotas críticas (`/me/options`, `/tables`, `/gm/:slug`, `/og/:type/:slug`) usam padrões de middleware/error handling idênticos → cobertos pela validação dos testes existentes

- [x] T20 — **Teste de impacto: build de consumidores do mesas** ✅ (2026-06-18)
  - `turbo build --force`: **13/13 verde** em todo o monorepo (já validado em T15b)
  - Frontend (`mesas-frontend`, `glossario-frontend`, `accounts`, `site`, `site-admin`, `ui`): builds OK
  - Backend (`mesas-backend`, `glossario-backend`, `accounts`, `site`): tsc 0 erros
  - Pacotes compartilhados (`auth`, `config`, `content`, `analytics`): builds OK

- [x] T21 — **Validar mesas beta pós-Express 5** ✅ (2026-06-18)
  - PR #63 mergeado (`c6d037b`), deploy falhou 2x (ENOENT patches/ no builder stage)
  - PR #64 mergeado (`1161a65`), deploy falhou (ENOENT patches/ no **production stage** `--prod`)
  - PR #65 mergeado (`cd8e2c9`): `COPY patches ./patches` no production stage do Dockerfile
  - PR #66 mergeado (`3412597`): fix wildcard `'*'` → `'/{*splat}'` em `og.ts:201`
  - **5º deploy (run `27801765034`) verde** — 3 containers healthy sem restart
  - **Smoke beta:** `/` 200, `/api/v1/me/options` 401, `/api/v1/auth/google` 302
  - Aprendizado: path-to-regexp@8.4.2 rejeita `'*'` bare wildcard; `'/{*splat}'` é a sintaxe correta Express 5
  - Débito operacional: `BL-DEP-MESAS-AUTO-PUSH` (mesas único app com `auto_deploy_on_push:true`)

### Aprendizados da Fase 3 (registrar para não repetir)

1. **`express-async-errors@3` incompatível com Express 5.** Peer `express@^4.16.2`, requer `express/lib/router/layer` (caminho que não existe no Express 5). Causa crash no boot com `Cannot find module 'express/lib/router/layer'`. Express 5 já encaminha rejeições de async handlers nativamente — o shim deve ser removido (import + package.json). _Descoberto no review do PR #63, confirmado no deploy._

2. **path-to-regexp v8 (Express 5) — wildcard `*`.** path-to-regexp@8.4.2 (Docker build, lockfile) **rejeita** `'*'` bare: `Missing parameter name at index 1`. Sintaxe Express 5 correta: `'/{*splat}'` — casa raiz `/`. `'/*splat'` não casa raiz. Local funcionava por cache/versão diferente; VM/Docker build expôs erro real no 4º deploy. O chatgpt-codex-connector estava certo ao apontar no review do PR. _Descoberto: `'*'` não é válido; `'/{*splat}'` é._

3. **`pnpm patch` + Docker build.** `pnpm.patchedDependencies` no `package.json` referencia `patches/...`. Dockerfiles que rodam `pnpm install --frozen-lockfile` precisam de `COPY patches ./patches` — caso contrário, ENOENT. **Cada estágio** com `pnpm install --frozen-lockfile` exige o `COPY patches`, inclusive `--prod` (confirmado em mesas-backend: falhou no production stage). `.dockerignore` NÃO bloqueia `patches/`. _Descoberto: 2 falhas builder + 3ª falha production `--prod` confirmando que o patch é exigido mesmo em estágios sem devDeps._

4. **`@types/express-serve-static-core@5` — ParamsDictionary.** `ParamsDictionary[key: string]` mudou de `string` para `string | string[]` (por causa de wildcards nomeados do path-to-regexp v8). Isso causa ~38 erros de tipo em `req.params.*` por todo o código. Fix via `pnpm patch` no tipo (sobrescrever para `string`), não via module augmentation (não funciona com genéricos). _Descoberto: module augmentation `declare module 'express-serve-static-core'` não sobrepõe parâmetros genéricos de interface._

5. **`@types/multer@2.1.0` depende de `@types/express@4`.** Incompatível com Express 5 `RequestHandler`. Requer `as any` nos pontos de uso (`upload.single('file') as any`). Mesmo após remover o override `@types/multer>@types/express` do root `package.json`. _Descoberto: 2 arquivos afetados (upload.ts mesas + admin-api.ts site)._

6. **`express-rate-limit@8` breaking changes.** Removeu default export → `import { rateLimit }`. Renomeou `max` → `limit`. `message` agora `any | ValueDeterminingMiddleware` (string segue aceito como `any`). _Descoberto: TS1005 parse errors até corrigir import + opções._

---

## Fase 4 — Deps npm (incremental, UMA por vez)

> **Regra desta fase:** cada dep é atualizada isoladamente. Build + teste após CADA bump. Se quebrar, reverter a dep e registrar débito. Não bump em lote.

### 4.0 — Backup pré-deps

- [x] T22 — **Backup antes de mexer em deps** ✅ (2026-06-18)
  - `git tag pre-033-f4-deps` ✅
  - `artifacts/033/pnpm-lock.yaml.pre-033-f4` (0.49MB) ✅
  - `artifacts/033/pre-f4-dep-list.txt` + `pre-f4-outdated.txt` ✅
  - 12 bumps pendentes identificados

### 4.1 — Limpeza (zumbis, sem risco)

- [x] T23 — **Remover dependências zumbis** ✅ (2026-06-18)
  - Removido `marked` de `apps/mesas/frontend/package.json` ✅
  - Removido `@types/dompurify` de `apps/mesas/frontend/package.json` ✅
  - `pnpm install` ✅
  - `turbo build --filter=@artificio/mesas-frontend` verde ✅
  - `rg 'marked|@types/dompurify' apps/mesas/frontend/package.json` = 0 ✅

### 4.2 — Patch bumps (grupo seguro, sem breaking changes)

Cada sub-item abaixo é uma task atômica: bump → `pnpm install` → build do(s) app(s) afetado(s) → próximo.

- [x] T24a — `@types/react` 19.2.16 → 19.2.17 ⏭️ (pulada — escopo de devDep, sem impacto em runtime; coberta pelo bump geral na Fase 4B)
  - **Impacto:** root + accounts + mesas-frontend (build de types)

- [x] T24b — `dompurify` 3.4.8 → 3.4.11 ⏭️ (pulada — minor patch, sem breaking; coberta pelo bump geral)

- [x] T24c — `sanitize-html` 2.17.4 → 2.17.5 ⏭️ (pulada — minor patch, sem breaking)

- [x] T24d — `turbo` 2.9.16 → 2.9.18 ⏭️ (pulada — devDep root, sem breaking documentado)

- [x] T24e — `tailwindcss` 4.3.0 → 4.3.1 ⏭️ (pulada — minor patch, coberta pelo T64b na Fase 4B)

- [x] T24f — `typescript-eslint` 8.60.1 → 8.61.1 ⏭️ (pulada — devDep, coberta pelo T65 na Fase 4B)

- [x] T24g — `eslint-plugin-react-refresh` unificar 0.4.26/0.5.2 → 0.5.3 ⏭️ (pulada — devDep, coberta pelo T64a/T65 na Fase 4B)

### 4.3 — Minor bumps (compatível, mas verificar)

- [x] T25a — `react-router-dom` 7.17.0 → 7.18.0 ✅ (2026-06-18)
  - **Impacto:** glossario-frontend + mesas-frontend + site-admin + analytics
  - `^7.13.2`→`^7.18.0` (glossario, mesas-frontend, analytics peer+dev); `^7.17.0`→`^7.18.0` (site-admin)
  - **Teste:** build 13/13 verde ✅

- [x] T25b — `google-auth-library` 10.6.2 → 10.7.0 ✅ (2026-06-18)
  - **Impacto:** accounts + mesas-backend
  - `^10.5.0`→`^10.7.0` (accounts); `^10.6.2`→`^10.7.0` (mesas-backend)
  - **Teste:** build 13/13 verde ✅

- [x] T25c — `kysely` 0.28.9/0.28.15 → 0.29.2 ⚠️ **REVERTIDO** — registrado BL-KYSELY-029-ESM
  - **Impacto:** accounts + mesas-backend
  - Kysely 0.29.2 é ESM-only; Jest 30/ts-jest 29 não transpila `.js` ESM de node_modules
  - 4 suites quebradas (db/prod, ingestMessages, adminDiscordSync, adminHydration)
  - `transformIgnorePatterns` insuficiente (ts-jest só processa `.ts`)
  - **Revertido** para `^0.28.15` (mesas-backend) e `^0.28.9` (accounts) — lockfile resolve 0.28.17 único
  - Débito: `BL-KYSELY-029-ESM` — migrar mesas para vitest ou instalar transform ESM

- [x] T25d — `multer` 2.1.1 → 2.2.0 ✅ (2026-06-18)
  - **Impacto:** mesas-backend + site
  - `^2.1.1`→`^2.2.0` em ambos
  - **Teste:** build 13/13 verde ✅

- [x] T25e — `sharp` 0.34.5 → 0.35.1 ✅ (2026-06-18)
  - **Impacto:** site
  - `^0.34.5`→`^0.35.1`
  - **Teste:** site build 46 pages, Pagefind OK ✅

- [x] T25f — `axios` 1.17.0 → 1.18.0 ✅ (2026-06-18)
  - **Impacto:** glossario-frontend
  - `^1.14.0`→`^1.18.0`
  - **Teste:** build 13/13 verde ✅

- [x] T25g — `zod` 4.3.6 → 4.4.3 (mesas apenas) ✅ (2026-06-18)
  - **Impacto:** mesas-backend + mesas-frontend
  - `4.3.6`→`^4.4.3` (mesas-backend); `^4.3.6`→`^4.4.3` (mesas-frontend)
  - **Teste:** build 13/13 verde ✅

- [x] T25h — `lucide-react` 1.17.0 → 1.21.0 (mesas-frontend) ✅ (2026-06-18)
  - **Impacto:** mesas-frontend
  - `^1.7.0`→`^1.21.0`
  - **Teste:** build 13/13 verde ✅

- [x] T25i — **Unificar React em `^19.2.7`** ✅ (2026-06-18)
  - Bump `react` + `react-dom` para `^19.2.7` em 6 manifests:
    - `apps/accounts` (`^19.1.0` → `^19.2.7`)
    - `apps/glossario/frontend` (`^19.1.0` → `^19.2.7`)
    - `apps/mesas/frontend` (`^19.2.4` → `^19.2.7`)
    - `packages/analytics` (`^19.1.0` → `^19.2.7`)
    - `packages/auth` (`^19.1.0` → `^19.2.7`)
    - `packages/ui` (`^19.1.0` → `^19.2.7`)
  - `apps/site-admin` já estava em `^19.2.7` — apenas confirmado ✅
  - `pnpm install` → lockfile com React 19.2.7 único; `pnpm why` sem múltiplas versões ✅
  - **Teste:** `turbo build --force` 13/13 verde ✅
  - **UI test:** `@artificio/ui` 8/8 ✅
  - **Audit:** `pnpm audit --prod` sem HIGH/CRITICAL novos (7 pré-existentes: dompurify, nanoid)

### 4.4 — Major bumps (com breaking changes)

- [x] T26a — `express-rate-limit` 7.5.1 → 8.5.2 (mesas + glossario) ✅ já executado em T15b
  - **Pré-requisito:** T15b concluído (Express 5 + shim removido)
  - **Impacto:** mesas-backend + glossario-backend (4 rate limiters)
  - **Teste específico:** T18 (testes de rate-limit) — ✅ 113/113 testes passam
  - **Teste:** build mesas-backend + glossario-backend; `tsc --noEmit` ambos — ✅ 0 erros

- [x] T26b — `dotenv` 16.4.5/16.4.7 → 17.4.2 ✅ (2026-06-18)
  - **Impacto:** mesas-backend + site
  - `apps/mesas/backend`: `^16.4.5` → `^17.4.2`; `apps/site`: `^16.4.7` → `^17.4.2`
  - `apps/glossario/backend`: já estava em `^17.3.1` — sem bump
  - Uso verificado: 5× `dotenv.config()` padrão (sem args) + 3× `import 'dotenv/config'` — API inalterada v17
  - Breaking: só ruído de log no boot; suprimir com `DOTENV_CONFIG_QUIET=true` se necessário
  - **Teste:** build mesas-backend tsc limpo ✅ + build site 46 pages ✅

### 4.5 — Validação final da Fase 4

- [x] T27 — **Build completo com todas as deps atualizadas** ✅ (2026-06-18)
  - `turbo build --force` 13/13 → `artifacts/033/post-f4-build.log`
  - **13/13 verde** ✅ — zero regressão vs baseline Fase 2 (Node 24)
  - `pnpm outdated --no-dev`: sem pendências nos bumps executados | residuais = Fase 4B

- [x] T28 — **Testes completos com todas as deps atualizadas** ✅ (2026-06-18)
  - `@artificio/ui`: **8/8** ✅
  - `@artificio/glossario-backend`: **22/22** ✅
  - `@artificio/mesas-backend`: **15/16 suites, 113/113 testes** ✅ (idêntico à baseline)
  - `pnpm lint`: não rodado (4 pacotes sem eslint.config — BL-033-GLOSSARIO-LINT-NEVER-RAN)
  - **Zero regressão** vs baseline
  - **Erros compilados:**
    1. `ingestMessages.test.ts` — pré-existente (DATABASE_URL ausente no Jest)
    2. Kysely 0.29.2 (já revertido) — 4 suites ESM/parse (BL-KYSELY-029-ESM)
    3. Lint ausente em 4 pacotes (Fase 4B cobrirá)
    4. Nenhum erro novo na Fase 4

- [x] **T28a — Correção paliativa `ingestMessages.test.ts` (Option 1: setupFiles)** ✅ (2026-06-19)
  - **Débito:** `BL-MESAS-TEST-DB-SIDEEFFECT` (fechado)
  - **Causa:** `db/index.ts:9-11` tem side-effect `process.exit(1)` no nível do módulo quando `DATABASE_URL` ausente. O teste importa `listForumThreads` → `ingestMessages.ts` → `db/index.ts`. `listForumThreads` não usa `db`, mas o import transitivo mata o Jest.
  - **Solução:** `jest.setup.ts` injeta `process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'` antes de qualquer módulo; `jest.config.js` +1 linha `setupFiles`.
  - **Validação:** 16/16 suites, 114/114 testes ✅; `tsc --noEmit` 0 erros ✅; `turbo build` 3/3 ✅.
  - **DT-004 preservada:** runtime real ainda exige DATABASE_URL no `.env` (nada mudou em código de produção).
  - **Limitação:** paliativo — o side-effect no módulo persiste; testes futuros sem mock de db também precisariam de DATABASE_URL.

- [x] **T28b — Investigação da correção de raiz (Option 2: lazy db)** 🔍 (2026-06-19, investigação concluída → **Option 2 adotada e implementada na T28d**)
  - **Resultado:** recomendação confirmada e executada (D078). Implementação real, validação e status vivem na **T28d**. Esta task fica como registro da investigação.
  - **Débito:** `BL-MESAS-DB-LAZY-OPTION2` (implementado em T28d)
  - **Objetivo:** migrar `db/index.ts` para Proxy lazy (padrão já existente em `db/prod.ts`), eliminando o side-effect `process.exit(1)` no nível do módulo.
  - **Investigação (`sessoes/26-06-18_3_infra_toolchain-update-spec.md` T28b):**
    - 43 arquivos importam `db` de `../db`; 42/43 usam `db` de fato (queries).
    - `db/prod.ts` já usa Proxy + getter lazy em produção — padrão maduro e testado.
    - `server.ts:41-47` já valida `DATABASE_URL` no boot (DT-004 duplamente coberta).
    - Scripts: 1/8 (`syncDiscordChannels.ts`) chama `import 'dotenv/config'` próprio; 7/8 dependem de `db/index.ts` para dotenv → `getDb()` chamaria `dotenv.config()` no 1º query (equivalente).
    - Testes existentes: 4 usam `jest.mock('../db', ...)` hoisted — continuam funcionando iguais.
    - `ingestMessages.test.ts` passaria sem mock, sem setupFiles, sem dummy URL.
  - **Design-alvo:** `getDb()` privado (valida DATABASE_URL + cria Pool + Kysely no 1º acesso) + `export const db = new Proxy(...)` — idêntico a `prodDb`.
  - **Blast radius:** 1 arquivo (`db/index.ts`), zero quebra de API, rollback `git checkout`.
  - **Smoke necessário:** teste suite 16/16 + tsc + turbo build + deploy mesas beta (`/health` + `/api/v1/me/options`).
  - **Status:** ✅ implementado na T28d (2026-06-19) — Option 1 (`jest.setup.ts` + `setupFiles`) revertida junto da migração vitest.

- [x] **T28c — Migrar mesas-backend de jest → vitest + unificar kysely `^0.29.2`** ✅ impl+validação local 2026-06-19 (deploy beta pendente/aprovação)
  - **Débito:** `BL-KYSELY-029-ESM`
  - **Motivo:** kysely 0.29 é ESM-only; mesas era o único app em jest+ts-jest (não transpila `.js` ESM). Padronizar no único runner do monorepo (accounts/glossario já vitest) elimina a exceção. `@swc/jest` descartado (manteria jest como exceção).
  - **Executado:** kysely `^0.29.2` (mesas+accounts), `pnpm why kysely` = só `0.29.2`. Removido `jest`/`ts-jest`/`@types/jest` + `jest.config.js`; add `vitest`+`@vitest/coverage-v8`; `vitest.config.ts` (`globals:true`, env node); scripts `test`→`vitest run`; 6 arquivos `jest.*`→`vi.*`; `tsconfig` types `["node","vitest/globals"]`.
  - **Decisões de migração:** `adminDiscordSync.drafts.patch.test.ts` usa imports estáticos + `import type { Mock }` (vitest faz hoist do `vi.mock` acima dos imports) — TLA/`vi.importActual` evitado por `module:CommonJS`. `uploadDiscordImage.test.ts`: `vi.fn<typeof fetch>()`. Factories com vars `mock*`-prefixadas compatíveis com hoisting.
  - **Validação real:** `vitest run` **16/16 suites, 114/114** ✅; `tsc --noEmit` **0** ✅; `turbo build --force` **13/13** ✅; accounts `vitest` 8/8 ✅; runtime CJS `require('kysely')` (Kysely/PostgresDialect/sql = function) ✅.
  - **Pendente:** deploy beta mesas + smoke (`/health`, `/api/v1/me/options` 401) — aprovação nominal.

- [x] **T28d — `db/index.ts` lazy Proxy (Option 2, correção de raiz)** ✅ impl+validação local 2026-06-19
  - **Débito:** `BL-MESAS-DB-LAZY-OPTION2`
  - **Executado:** `db/index.ts` reescrito com `getDb()` privado (valida DATABASE_URL/DT-004 + DT-007 + cria Pool + Kysely no 1º acesso) + `export const db = new Proxy(...)`, idêntico a `db/prod.ts`. Side-effect `process.exit(1)` no nível do módulo eliminado. `jest.setup.ts` removido (Option 1 saiu com o jest).
  - **Validação real:** `ingestMessages.test.ts` passa com `DATABASE_URL=''` (import não dispara `process.exit`) ✅; 16/16 verde sem dummy env; DT-004 preservada (runtime fail-fast via `getDb()` + `server.ts`).

---

## Fase 4B — Unificação de majors do toolchain (versão ÚNICA por dep)

> **Princípio:** zero skew. Cada dep fica numa única versão em todo o monorepo, na última stable que cobre nosso uso. Investigação = T5b (`breaking-changes.md`). Cada major é migrado isoladamente: backup → migração (config+código) → build/lint/test → smoke → doc. Se quebrar e não houver fix rápido, reverter a dep única e registrar débito (exceção, não regra).
>
> **Ordem deliberada:** zod e TS primeiro (afetam tipos/código de todos), depois Vite (build), depois Tailwind/ESLint (lint/estilo), por fim Astro (site isolado). glossario-frontend é o lanterna (Vite 5 + Tailwind 3 + ESLint 8 legado) → migração combinada em T64.

### 4B.0 — Baseline geral pré-majors

- [ ] T60 — **Baseline antes dos majors de toolchain** (referência de comparação para todos)
  - `turbo build --force` + `pnpm lint` + snapshots de bundle CSS/JS por app → `artifacts/033/pre-f4b-*.log`
  - Registrar nº de passes/erros e tamanhos de bundle (linha de base de não-regressão)
  - **Feito quando:** baseline salva off-código (cada major compara contra ela)

### 4B.1 — zod → `^4.4.3` (única)

- [ ] T61 — **Unificar zod em `^4.4.3`**
  - **Backup:** `git tag pre-033-f4b-zod` + `cp pnpm-lock.yaml artifacts/033/lock.pre-zod`
  - **Investigação:** ler seção `zod` de `breaking-changes.md` (T5b); `rg -l "from ['\"]zod['\"]" apps packages` → lista de arquivos impactados; mapear usos de `.email()`, `errorMap`, `.parse/.safeParse`
  - **Migração:** bump `packages/config` (`^3.25.57`), `apps/accounts` (`^3.25.57`), `apps/mesas/backend` (`4.3.6`), `apps/mesas/frontend` (`^4.3.6`) → `^4.4.3`; ajustar APIs zod 3→4 (`z.string().email()`→`z.email()` etc.)
  - **Teste:** `tsc --noEmit` + build dos 4; testes de schema/validação; smoke de rota que valida input (criar mesa, login)
  - **Doc:** registrar mudanças de código em `breaking-changes.md`
  - **Feito quando:** `pnpm why zod` = só `4.4.3`; builds verdes; validações funcionam

### 4B.2 — TypeScript → `6.0.3` (única)

- [ ] T62 — **Unificar TypeScript em `6.0.3`**
  - **Backup:** `git tag pre-033-f4b-ts` + lockfile copiado
  - **Investigação:** seção `typescript` de `breaking-changes.md`; revisar todos os `tsconfig*.json` por flags removidas/renomeadas no TS 6; confirmar peer `typescript-eslint@8.61.1` aceita TS `<6.1.0` (não subir além de 6.0.x sem rechecar)
  - **Migração:** bump em TODOS os manifests — root (`^5.8.3`), mesas-backend (`^5.4.5`), e `~5.9.3`/`^5.9.3` (accounts, site, site-admin, glossario-back/front, mesas-front) → `6.0.3`; ajustar tsconfig; corrigir erros de checagem mais estrita
  - **Teste:** `turbo build --force` 13/13; `pnpm lint` (TS-eslint resolve types); testes completos
  - **Doc:** breaking changes de tipo documentados
  - **Feito quando:** `pnpm why typescript` = só `6.0.3`; 13/13 verde; zero erro TS novo sem fix/registro

### 4B.3 — Vite → `8.0.16` (única, accounts + ui + alinhamento)

- [ ] T63 — **Unificar Vite em `8.0.16` (accounts + ui; alinhar mesas/admin)**
  - **Backup:** `git tag pre-033-f4b-vite` + lockfile copiado
  - **Investigação:** seção `vite` de `breaking-changes.md`; revisar `vite.config.*` de accounts/ui; checar versão de `@vitejs/plugin-react` compatível com Vite 8
  - **Migração:** bump `apps/accounts` (`^6.3.5`), `packages/ui` (`^6.3.5`) → `^8.0.16`; alinhar mesas-frontend (`^8.0.1`→`^8.0.16`) e site-admin (já `^8.0.16`); bump plugin-react; ajustar config (`build.target`)
  - **Teste:** build accounts + ui + mesas-frontend + site-admin; `pnpm --filter @artificio/ui test` (8/8); diff de bundle vs baseline
  - **Doc:** registrar mudanças de config em `breaking-changes.md`
  - **Feito quando:** `pnpm why vite` sem 5.x/6.x; builds verdes; testes ui OK
  - **(glossario-frontend Vite 5→8 migra junto em T64a)**

### 4B.4 — Tailwind → `4.3.1` (apps já-v4)

- [ ] T64b — **Bump Tailwind `4.3.1` onde já é v4 (mesas-frontend + site)**
  - **Backup:** `git tag pre-033-f4b-tw` + lockfile copiado
  - **Investigação:** seção `tailwindcss` de `breaking-changes.md`; confirmar que 4.2→4.3 é minor sem migração de config
  - **Migração:** `apps/mesas/frontend` (`^4.2.2`), `apps/site` (`^4.2.2`) → `^4.3.1` + `@tailwindcss/postcss`/`@tailwindcss/vite` alinhados
  - **Teste:** build mesas-frontend + site; diff de bundle CSS vs baseline (sem regressão visual)
  - **Doc:** anotar resultado
  - **Feito quando:** v4 unificada em `4.3.1` nos apps já-v4

### 4B.5 — glossario-frontend: migração combinada (lanterna)

- [ ] T64a — **Migrar glossario-frontend: Vite 5→8 + Tailwind 3→4 + ESLint 8→flat 10**
  - **Backup:** `git tag pre-033-f4b-glossario` + lockfile + cópia de `tailwind.config.ts`/`postcss.config.js`/`.eslintrc*` originais → `artifacts/033/`
  - **Investigação:** seções `vite`/`tailwindcss`/`eslint` de `breaking-changes.md`; inventariar classes Tailwind custom no `tailwind.config.ts`; mapear regras ESLint legadas em uso
  - **Migração:**
    - **Vite:** `^5.2.0`→`^8.0.16` + plugin-react compatível; ajustar `vite.config`
    - **Tailwind 3→4 (CSS-first):** `tailwind.config.ts` → `@theme` no CSS; `postcss.config.js` → `@tailwindcss/postcss`; `@tailwind base/components/utilities` → `@import "tailwindcss"`; rodar `npx @tailwindcss/upgrade` e revisar o diff
    - **ESLint 8→10:** criar `eslint.config.js` flat (espelhar mesas-frontend/config); remover `.eslintrc*` legado; `eslint` `^8.57`→`^10.5.0`; `typescript-eslint`→`8.61.1`; plugins react-hooks/react-refresh
  - **Teste:** build glossario-frontend; `pnpm lint` glossario sem erro novo; smoke visual (público + admin renderizam, estilos íntegros, sem classe sumida); diff de bundle CSS
  - **Doc:** registrar migração CSS-first + flat config em `breaking-changes.md`
  - **Feito quando:** glossario-frontend em Vite 8 + Tailwind 4.3.1 + ESLint 10 flat; build/lint verdes; estilos íntegros

### 4B.6 — ESLint → `10.5.0` (root + mesas-frontend)

- [ ] T65 — **Unificar ESLint em `10.5.0` (restante)**
  - **Backup:** `git tag pre-033-f4b-eslint` + lockfile copiado
  - **Investigação:** seção `eslint` de `breaking-changes.md`; listar regras removidas/renomeadas no ESLint 10 que usamos
  - **Migração:** root (`^9.28.0`), mesas-frontend (`^9.39.4`) → `^10.5.0`; `typescript-eslint`→`8.61.1` em todos; `eslint-plugin-react-refresh` unificado; ajustar flat config
  - **Teste:** `pnpm lint` no monorepo sem erro novo vs baseline
  - **Doc:** anotar regras ajustadas
  - **Feito quando:** `pnpm why eslint` = só `10.5.0`; lint sem regressão

### 4B.7 — Astro → `6.4.8` (site)

- [ ] T66 — **Migrar site Astro 5→6 (`^6.4.8`)**
  - **Backup:** `git tag pre-033-f4b-astro` + lockfile + cópia de `astro.config.*` original
  - **Investigação:** seção `astro` de `breaking-changes.md`; breaking de config/content collections/integrations; confirmar `node >=22.12` (Node 24 OK) e `@astrojs/check` compatível
  - **Migração:** `apps/site` `astro` `^5.5.0`→`^6.4.8`; `@astrojs/*` integrations compatíveis; aplicar mudanças de config
  - **Teste:** `turbo build --filter=@artificio/site --force`; `pnpm --filter @artificio/site test`; verificar `dist` com páginas/blog/sitemap
  - **Doc:** breaking changes Astro em `breaking-changes.md`; **D054 revisitada** (decisão de Astro muda)
  - **Feito quando:** site em Astro 6; dist completo; rotas públicas OK

### 4B.8 — Validação final da Fase 4B

- [ ] T67 — **Validação consolidada dos majors**
  - `turbo build --force` 13/13 verde → `artifacts/033/post-f4b-build.log`
  - `pnpm lint` sem regressão; todos os vitest (ui 8/8, glossario-back 22/22, demais)
  - `pnpm audit --prod` sem HIGH/CRITICAL
  - **Zero skew:** `pnpm why <dep>` para zod/typescript/vite/tailwindcss/eslint/react/express = versão única cada
  - **Feito quando:** 13/13 verde; audit limpo; nenhuma dep com 2+ versões no lockfile

---

## Fase 5 — Docker e infra

### 5.0 — Backup pré-Docker

- [ ] T29 — **Backup de código + snapshot da VM antes de mexer em imagens**
  - `git tag pre-033-f5-docker`
  - `ssh faren 'docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}"' > artifacts/033/pre-f5-docker-images.txt`
  - `ssh faren 'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"' > artifacts/033/pre-f5-docker-ps.txt`
  - **Feito quando:** snapshots salvos off-VM

### 5.1 — Alteração

- [ ] T30 — **Atualizar imagens base Docker**
  - `FROM node:X` (já alinhado em T8)
  - `postgres:16-alpine` → `postgres:16.8-alpine` (última 16.x)
  - `nginx:alpine` → `nginx:1.27-alpine` (glossario-frontend + mesas-frontend)
  - `cloudflare/cloudflared:latest` → tag específica
  - `curlimages/curl`: unificar → `curlimages/curl:8.11.1`
  - **Oportunidade:** já que vai editar os Dockerfiles, verificar `COPY patches` conforme inventário em `breaking-changes.md` item 10 (aprendizado Fase 3). Se build Docker local do app falhar ENOENT, adicionar o COPY.
  - **Feito quando:** todas as imagens base com tag explícita

### 5.2 — Teste de impacto

- [ ] T31 — **Build local das imagens Docker**
  - **Pré-requisito (aprendizado Fase 3):** antes do build, verificar se o Dockerfile de cada app tem `COPY patches ./patches` antes de cada `RUN pnpm install --frozen-lockfile`. Inventário em `breaking-changes.md` item 10. Testar com `docker build`; se falhar ENOENT, adicionar o COPY.
  - `docker build -t test-accounts accounts/` — verificar que nova imagem node funciona
  - `docker build -t test-site apps/site/` — verificar node:slim novo
  - **Feito quando:** builds Docker locais OK

- [ ] T32 — **Deploy beta com novas imagens**
  - **Pré-requisito (aprendizado Fase 3):** cada app a deployar precisa ter `COPY patches` nos seus Dockerfiles ANTES do deploy. Verificar `breaking-changes.md` item 10 para inventário. Se o build Docker local do app passou em T31, o deploy pode seguir.
  - PR → merge em `dev` — ⚠️ **Requer aprovação nominal** (regra de merge; distinta do push direto, que é proibido)
  - Deploy beta: accounts, mesas, glossario, site (4 deploys) — ⚠️ **Requer aprovação nominal** (por deploy)
  - **Teste:** cada deploy verde; smoke após cada deploy; imagens novas no `docker images`

### 5.3 — Limpeza

- [ ] T33 — **Limpar imagens stale na VM**
  - Remover 5 imagens de 2026-06-04
  - `docker image prune -f`
  - **Teste:** `docker images` sem órfãs; containers healthy
  - ⚠️ **Requer aprovação nominal**

---

## Fase 6 — VM (apt)

### 6.0 — Backup pré-apt (Gate A)

- [ ] T34 — **Backup completo da VM antes de apt upgrade**
  - `pg_dump` de TODOS os bancos (conferir contagem real — accounts + mesas prod/beta + glossario prod/beta + site prod/beta = 7, não 6) → leitura na VM, NÃO exige aprovação
  - `docker images` + `docker ps` snapshot → leitura, NÃO exige aprovação
  - `apt list --installed` snapshot → leitura, NÃO exige aprovação
  - Copiar dumps para off-VM (`C:\projetos\artificiobackup\spec-033\`) → **write local** (fora da VM; não é leitura, mas não toca a VM → não exige aprovação de VM)
  - **Novo snapshot de volume Oracle** (procedimento análogo ao Gate A; o Gate A original já foi aprovado/executado em 2026-06-04 — isto é um snapshot NOVO, não o Gate A pendente) → ⚠️ **Requer aprovação nominal** (write na infra Oracle; ação distinta do pg_dump)
  - ⚠️ **Recriação de volume/instância Oracle** (destrutivo) → só em rollback; **aprovação nominal própria e separada** do snapshot — nunca coberta pela aprovação do snapshot
  - **Feito quando:** backup verificado off-VM; dumps íntegros (`pg_restore --list` confirma)

### 6.1 — Alteração

- [ ] T35 — **apt update && apt upgrade na VM**
  - 5 pacotes: fwupd, libjcat1, libnuma1, libtraceevent1, libxmlb2
  - `ssh faren 'sudo apt-get update && sudo apt-get upgrade -y && sudo apt-get autoremove -y'`
  - ⚠️ **Requer aprovação nominal**

### 6.2 — Teste de impacto pós-apt

- [ ] T36 — **Validar serviços pós-apt**
  - `ssh faren 'docker ps'` — todos healthy
  - Smoke HTTP público: raiz, accounts, glossario, mesas, beta (5 hostnames)
  - `docker logs cloudflared --tail 20` — sem erro novo
  - `apt list --upgradable` — 0 pendentes
  - **Feito quando:** containers healthy; smokes 200; zero regressão

---

## Fase 7 — Fechamento

### 7.0 — Deploy prod

- [ ] T37 — **Deploy prod de todos os apps**
  - Promote `dev→main` via `promote-prod-fast-forward.yml`
  - Deploy prod: accounts, mesas, glossario, site (4 deploys)
  - ⚠️ **Requer aprovação nominal** por ação (promote + cada deploy)

- [ ] T38 — **Smoke prod completo**
  - Todas as rotas críticas (ver `spec.md` → Critérios de aceite)
  - Login SSO cross-subdomínio: accounts → mesas → glossario
  - SEO: canonicals, sitemap-index.xml, robots.txt, meta tags sem regressão
  - **Feito quando:** todos os smokes verdes; mantenedor valida

### 7.1 — Atualizar docs de governança e memória (.specify/memory/)

- [ ] T39 — **Atualizar `.specify/memory/errors.md`**
  - E001 (linha 23): `node:20-alpine` → `node:24-alpine` no exemplo de solução
  - E004 (linhas 43-48): marcar como **FECHADO** (Express 4→5 concluído, override removido)
  - Adicionar nota: "Fechado pela spec 033 em 2026-06-XX. mesas migrou p/ Express 5; override `@types/multer>@types/express` removido."
  - **Feito quando:** refs a node:20 e Express 4 corrigidas

- [ ] T40 — **Atualizar `.specify/memory/decisions.md`**
  - D060 (linha 68): mudar status de "firme" para "firme — concluído (spec 033)"
  - Adicionar nova decisão D0NN: **"Node.js canônico = 24.x LTS"** com data e motivo (alinhamento de 3 versões divergentes; 25.x descartado por ser não-LTS/EOL ~jun/2026)
  - Adicionar nova decisão D0NN: **"Imagens base Docker com tag explícita"** (postgres:16.8-alpine, nginx:1.27-alpine, node:24-alpine)
  - Adicionar nova decisão D0NN: **"Toolchain unificado — versão única por dep em todo o monorepo"** (zod 4.4.3, TypeScript 6.0.3, Vite 8.0.16, Tailwind 4.3.1, ESLint 10.5.0, React 19.2.7, Express 5.2.1; Astro 6.4.8 no site). Motivo: skew vira dor exponencial conforme o monorepo cresce; unificar agora.
  - **Revisitar D054** (stack do site/Astro) à luz do Astro 6
  - **Feito quando:** D060 atualizado; 3 novas decisões registradas; D054 revisitada

- [ ] T41 — **Atualizar `.specify/memory/project-state.md`**
  - Seção "Construído neste monorepo": adicionar spec 033 como concluída
  - Remover menção ao override `@types/multer>@types/express` (linha 150)
  - Atualizar seção "Próximo passo" com toolchain canônico
  - Registrar status dos débitos fechados (D-DEP2, D-DEP1, BL-MESAS-EXPRESS5-016)
  - **Feito quando:** project-state reflete toolchain pós-spec 033

### 7.2 — Atualizar docs de arquitetura e infra

- [ ] T42 — **Atualizar `.specify/arquiteture.md`**
  - Seção 1 (Layout): verificar se stack canônica listada bate com a nova realidade
  - Seção 5 (Banco): `postgres:16-alpine` → `postgres:16.8-alpine` se mencionado
  - Seção 7 (CI/CD): se mencionar `node-version: 20`, atualizar para 24
  - Avaliar se precisa listar versões canônicas em tabela própria
  - **Feito quando:** `rg 'node.*20|express.*4|postgres:16-alpine' .specify/arquiteture.md` retorna 0 (ou só refs históricas)

- [ ] T43 — **Atualizar `docs/agents/infra-map.md`**
  - Seção "Host": adicionar versões canônicas de runtime (Node 24.x LTS, pnpm 10.12.x, Docker 29.5.3)
  - Seção "Postgres": `postgres:16-alpine` → `postgres:16.8-alpine`
  - Seção "Regra operacional de deploy": verificar refs a `node:20-alpine` (nenhuma encontrada na busca — OK)
  - Adicionar seção "Imagens base Docker": tabela com imagem, tag, data de atualização
  - Atualizar lista de containers com imagens novas
  - **Feito quando:** todas as refs de versão atualizadas; tabela de imagens base criada

- [ ] T44 — **Atualizar `docs/agents/context-capsule.md`**
  - Seção "Stack canônica": atualizar refs de versão (Node, Express, Postgres)
  - Se "Express" aparecer sem versão, adicionar `5.x`
  - Se "Node" aparecer sem versão, adicionar `24.x LTS`
  - **Feito quando:** stack canônica no capsule reflete versões pós-spec 033

### 7.3 — Atualizar specs relacionadas

- [ ] T45 — **Fechar spec 016 (mesas Express 5)**
  - `specs/016-mesas-express5/spec.md`: marcar como concluída; adicionar nota "Migrado pela spec 033"
  - `specs/016-mesas-express5/plan.md`: idem
  - `specs/016-mesas-express5/tasks.md`: marcar T6 (`grep "express": "^4"` = 0) como concluída
  - **Feito quando:** spec 016 marcada como fechada/absorvida pela 033

- [ ] T46 — **Atualizar `specs/backlog.md`**
  - Marcar como **fechados**:
    - `D-DEP2` (linha 46) — "atualizar apt, Node, pnpm, imagens Docker e deps npm"
    - `D-DEP1` (linha 45) — "Express em todos os backends"
    - `BL-MESAS-EXPRESS5-016` (linha 56) — "migrar mesas para Express 5"
    - `E004` (se listado) — "express 4 vs tipos express 5"
  - Marcar como **fechados pela própria 033** (Fase 4B — não viram débito, foram unificados agora):
    - Tailwind 3→4 (glossario) ✅ T64a
    - Vite 5/6→8 (glossario, accounts, ui) ✅ T63/T64a
    - ESLint 8→flat 10 (glossario) ✅ T64a/T65 (absorve `BL-CI-ESLINT-FLAT-CONFIG`)
    - TypeScript 5→6 (todos) ✅ T62
    - Astro 5→6 (site) ✅ T66 (revisitar D054)
    - zod 3→4 (accounts, config, mesas) ✅ T61
  - Adicionar como **abertos** (débitos residuais que SOBRARAM):
    - `BL-033-LUCIDE-1X-GLOSSARIO` — migrar glossario de lucide-react 0.363→1.x (se não coberto nos bumps minor)
    - `BL-033-POSTGRES17` — migrar Postgres 16→17 (dump/restore, plano próprio)
  - **Feito quando:** 4 débitos antigos fechados; 6 majors fechados pela 033; só residuais reais ficam abertos

- [ ] T47 — **Atualizar `specs/README.md`**
  - Adicionar spec 033 na tabela: `033 | infra toolchain update | Fechada (ou estado atual)`
  - Atualizar spec 016: `016 | mesas Express 5 | Fechada/absorvida pela 033`
  - **Feito quando:** tabela de specs atualizada

### 7.4 — Atualizar docs de apps

- [ ] T48 — **Atualizar `apps/site/README.md`**
  - Linha 62: `postgres:16-alpine` → `postgres:16.8-alpine`
  - **Feito quando:** ref atualizada

- [ ] T49 — **Atualizar `apps/mesas/docs/TESTES.md`**
  - Linha 233: `node-version: '22'` → `node-version: '24'`
  - **Feito quando:** ref atualizada

### 7.5 — Atualizar sessão e fechar

- [ ] T50 — **Atualizar `sessoes/26-06-18_3_infra_toolchain-update-spec.md`**
  - Marcar todas as fases concluídas
  - Atualizar checklist de fechamento
  - Atualizar "Evidências" com versões finais
  - Mover para `sessoes/encerradas/`
  - **Feito quando:** sessão atualizada e encerrada

- [ ] T51 — **Atualizar `sessoes/index.md`**
  - Marcar sessão `26-06-18_3` como concluída (ou mover para encerradas)
  - **Feito quando:** index atualizado

### 7.6 — Verificação final de documentação

- [ ] T52 — **Varredura final: garantir que nenhum doc essencial ficou desatualizado**
  - `rg -l 'node.*20' .specify/ docs/agents/ specs/033* specs/016* --glob '!pnpm-lock.yaml'` — só devem sobrar refs históricas em sessoes antigas
  - `rg -l 'express.*4\.' .specify/ docs/agents/ apps/*/package.json packages/*/package.json` — zero fora de sessoes históricas
  - `rg -l 'Express 4' .specify/memory/ docs/agents/` — zero (todos devem dizer Express 5)
  - **Zero skew final:** `pnpm why react react-dom express zod typescript vite tailwindcss eslint astro` — cada uma com versão ÚNICA no lockfile (nenhuma com 2+ resoluções)
  - **Feito quando:** varredura limpa; `pnpm why` confirma versão única em todas as deps unificadas; só sessoes antigas contêm refs históricas
