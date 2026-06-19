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

- [x] **T28c — Migrar mesas-backend de jest → vitest + unificar kysely `^0.29.2`** ✅ FECHADO 2026-06-19 (PR #67 `85063da`, deploy beta verde)
  - **Débito:** `BL-KYSELY-029-ESM`
  - **Motivo:** kysely 0.29 é ESM-only; mesas era o único app em jest+ts-jest (não transpila `.js` ESM). Padronizar no único runner do monorepo (accounts/glossario já vitest) elimina a exceção. `@swc/jest` descartado (manteria jest como exceção).
  - **Executado:** kysely `^0.29.2` (mesas+accounts), `pnpm why kysely` = só `0.29.2`. Removido `jest`/`ts-jest`/`@types/jest` + `jest.config.js`; add `vitest`+`@vitest/coverage-v8`; `vitest.config.ts` (`globals:true`, env node); scripts `test`→`vitest run`; 6 arquivos `jest.*`→`vi.*`; `tsconfig` types `["node","vitest/globals"]`.
  - **Decisões de migração:** `adminDiscordSync.drafts.patch.test.ts` usa imports estáticos + `import type { Mock }` (vitest faz hoist do `vi.mock` acima dos imports) — TLA/`vi.importActual` evitado por `module:CommonJS`. `uploadDiscordImage.test.ts`: `vi.fn<typeof fetch>()`. Factories com vars `mock*`-prefixadas compatíveis com hoisting.
  - **Validação real:** `vitest run` **16/16 suites, 114/114** ✅; `tsc --noEmit` **0** ✅; `turbo build --force` **13/13** ✅; accounts `vitest` 8/8 ✅; runtime CJS `require('kysely')` (Kysely/PostgresDialect/sql = function) ✅.
  - **Deploy beta ✅:** PR #67 mergeado em dev (`85063da`, squash); mesas beta auto-deploy SUCCESS (run `27805626853`); smoke `/` 200, `/api/v1/me/options` 401, `/api/v1/auth/google` 302. Runtime `require(esm)` provado na VM. **Fixes de revisão (Amazon Q/CodeRabbit/Snyk/codex): Reflect.get(instance,prop,instance), process.exit→throw, vi.hoisted() — ver sessão.**

- [x] **T28d — `db/index.ts` lazy Proxy (Option 2, correção de raiz)** ✅ FECHADO 2026-06-19 (PR #67, deploy beta verde)
  - **Débito:** `BL-MESAS-DB-LAZY-OPTION2`
  - **Executado:** `db/index.ts` reescrito com `getDb()` privado (valida DATABASE_URL/DT-004 + DT-007 + cria Pool + Kysely no 1º acesso) + `export const db = new Proxy(...)`, idêntico a `db/prod.ts`. Side-effect `process.exit(1)` no nível do módulo eliminado. `jest.setup.ts` removido (Option 1 saiu com o jest).
  - **Validação real:** `ingestMessages.test.ts` passa com `DATABASE_URL=''` ✅; 16/16 verde sem dummy env; DT-004 preservada (boot fail-fast `server.ts:43-47` + `throw` no 1º uso). Review: `process.exit`→`throw` (não mata server em request); `Reflect.get(instance,prop,instance)` no Proxy (getters Kysely precisam `this`=instância). Deploy beta verde.

---

## Fase 4B — Unificação de majors do toolchain (versão ÚNICA por dep)

> **Princípio:** zero skew. Cada dep fica numa única versão em todo o monorepo, na última stable que cobre nosso uso. Investigação = T5b (`breaking-changes.md`). Cada major é migrado isoladamente: backup → migração (config+código) → build/lint/test → smoke → doc. Se quebrar e não houver fix rápido, reverter a dep única e registrar débito (exceção, não regra).
>
> **Ordem deliberada:** zod e TS primeiro (afetam tipos/código de todos), depois Vite (build), depois Tailwind/ESLint (lint/estilo), por fim Astro (site isolado). glossario-frontend é o lanterna (Vite 5 + Tailwind 3 + ESLint 8 legado) → migração combinada em T64.

### 4B.0 — Baseline geral pré-majors

- [x] T60 — **Baseline antes dos majors de toolchain** ✅ (2026-06-19)
  - `turbo build --force` **13/13** verde → `artifacts/033/pre-f4b-build.log`
  - `pnpm lint` **2/5** (config+mesas-frontend OK; content/analytics/auth/glossario-frontend sem eslint.config) → `artifacts/033/pre-f4b-lint.log`
  - Bundle sizes baseline (CSS/JS KB): accounts 4.3/202.8, glossario 51.2/1123.8, mesas 203.3/1328.0, site-admin 218.2/1737.9, site 35.0/231.3
  - Skew confirmado: zod 3.x/4.x, TS 5.9.3, Vite 5/6/8, Tailwind 3/4, ESLint 8/9/sem, Astro 5
  - **Feito quando:** baseline salva off-código (cada major compara contra ela)

### 4B.1 — zod → `^4.4.3` (única)

- [x] T61 — **Unificar zod em `^4.4.3`** ✅ (2026-06-19)
  - **Backup:** ✅ `git tag pre-033-f4b-zod` (local); lockfile off-código `C:\projetos\artificiobackup\spec-033\pnpm-lock.yaml.pre-033-f4b-zod`; lockfile on-repo `artifacts/033/lock.pre-zod`. Rollback: `git reset --hard pre-033-f4b-zod` + restaurar lockfile.
  - **Investigação:** ✅ `rg "from.*zod" apps packages -g '!node_modules'` → 8 arquivos. `rg "z\.string\(\)\.url" apps packages -g '!node_modules'` → 7 ocorrências deprecated em 3 arquivos. `rg "\.email\(\)" apps packages -l -g '!node_modules'` → 0. `rg "errorMap" apps packages -l -g '!node_modules'` → 0. mesas já em zod `4.4.3` (T25g). Só `packages/config` (`^3.25.57`) e `apps/accounts` (`^3.25.57`) precisam de bump.
  - **Substituições deprecated→nativo (7 ocorrências, 3 arquivos):**
    - `apps/accounts/src/env.ts:6` — `z.string().url()` → `z.url()` ✅
    - `apps/accounts/src/env.ts:7` — `z.string().url()` → `z.url()` ✅
    - `apps/accounts/src/env.ts:13` — `z.string().url().default(...)` → `z.url().default(...)` ✅
    - `apps/mesas/backend/src/validators/tableValidators.ts:28` — `z.string().url('URL do Discord inválida')` → `z.url('URL do Discord inválida')` ✅
    - `apps/mesas/backend/src/validators/tableValidators.ts:87` — `z.string().url().nullable().optional()` → `z.url().nullable().optional()` ✅
    - `apps/mesas/backend/src/validators/tableValidators.ts:94` — `z.string().url().nullable().optional()` → `z.url().nullable().optional()` ✅
    - `apps/mesas/frontend/src/schemas/profileSchemas.ts:48` — `z.string().url().safeParse(val)` → `z.url().safeParse(val)` ✅
  - **API zod 4:** `z.url()` (`params?: string | { message, ... }`); compatível com `.nullable()`, `.optional()`, `.default()`, `.safeParse()`. Fonte: `zod/v4/classic/schemas.ts:653`.
  - **Execução real:** (1) bump 2 manifests → (2) `pnpm install` (lockfile sem zod 3.x, `zod@4.4.3` único) → (3) 7 edições em 3 arquivos → (4) `turbo build --force` **13/13 verde** → (5) `rg -g '!**/node_modules/**' "z\.string\(\)\.url" apps packages` = **0** → (6) `pnpm list zod -r --depth 0` = **4.4.3** único (accounts, config, mesas-backend, mesas-frontend)
  - **Aprendizado:** ordem importa — bump manifests + `pnpm install` ANTES de editar código (senão `z.url()` não existe no zod 3.x do accounts). `z.string().url('msg')` → `z.url('msg')` (string param = mensagem, compatível). `.nullable()`, `.optional()`, `.default()`, `.safeParse()` encadeiam em `z.url()` sem quebra.
  - **Verificação review:** PR #68, coderabbit alegou que `z.url('string')` não aceita string como 1º param em zod 4.4.3. **Falso.** Evidência do tipo: `zod@4.4.3/v4/classic/index.d.ts:197` → `export declare function url(params?: string | core.$ZodURLParams): ZodURL`. `string` é suportado como mensagem de erro. Build 13/13 confirma. Veredicto registrado, sem resposta ao bot (regra pétrea).
  - **Pós-merge:** pin `^6.0.3` → `~6.0.3` nos 7 manifests (T62) — `typescript-eslint@8.60.1` peer `<6.1.0`, `^` deixaria resolver 6.1+
  - **Feito quando:** `pnpm list zod -r --depth 0` = só `4.4.3`; `turbo build` 13/13; zero `z.string().url` deprecated no código-fonte

### 4B.2 — TypeScript → `6.0.3` (única)

- [x] T62 — **Unificar TypeScript em `6.0.3`** ✅ (2026-06-19)
  - **Backup:** ✅ `git tag pre-033-f4b-ts` (local); lockfile off-código `C:\projetos\artificiobackup\spec-033\pnpm-lock.yaml.pre-033-f4b-ts`. Rollback: `git reset --hard pre-033-f4b-ts` + restaurar lockfile.
  - **Investigação:** ✅ 7 manifests com TS (root `^5.8.3`, glossario-back `^5.9.3`, glossario-front `^5.9.3`, site `~5.9.3`, mesas-front `~5.9.3`, mesas-back `^5.4.5`, site-admin `~5.9.3`). accounts sem dep direto. `typescript-eslint@8.60.1` peer `>=4.8.4 <6.1.0` → OK. 17 tsconfig versionados revisados.
  - **Execução real (3 iterações de correção + pin pós-merge):**
    - (1) Bump 7 manifests → `pnpm install` (lockfile `typescript@6.0.3` único)
    - (2a) `packages/auth/tsconfig.cjs.json`: `moduleResolution: "Node"` → `"node10"` + `ignoreDeprecations: "6.0"` (TS5107; correção: `"Node"` não removido, `"node10"` é que disparou)
    - (2b) `tsconfig.base.json`: `moduleResolution: "Bundler"` → `"bundler"` (lowercase)
    - (2c) `apps/glossario/frontend/tsconfig.json`: remove `baseUrl` (TS5101 deprecated com bundler), mantém `allowImportingTsExtensions` (necessário para `.tsx` imports)
    - (2d) `apps/mesas/frontend/tsconfig.app.json` + `tsconfig.node.json`: mantém `allowImportingTsExtensions` (necessário para `.tsx` imports)
    - (2e) `apps/mesas/frontend/src/test/setup.ts`: adiciona `scrollMargin` ao mock `IntersectionObserver` (TS 6 lib DOM mais estrita)
     - (2f) Pós-merge: pin `^6.0.3` → `~6.0.3` nos 7 manifests (`typescript-eslint` peer `<6.1.0`). **CI quebrou:** lockfile não regenerado após o pin — `pnpm install --frozen-lockfile` rejeitou mismatch (`lockfile: ^6.0.3, manifest: ~6.0.3`). `pnpm install` local regenerou lockfile; commit `25f7ea7` corrigiu. CI re-executou, todos os checks passaram (lint+build+test SUCCESS, CodeQL SUCCESS, OSV SUCCESS, Semgrep SUCCESS, TruffleHog SUCCESS, deploy mesas/glossario/site/accounts SUCCESS). PR #68 mergeado em `dev` 2026-06-19 14:48 UTC.
  - **Aprendizado:** `allowImportingTsExtensions` NÃO foi removido no TS 6 — necessário em projetos que importam `.tsx` com extensão. `moduleResolution: "Node"` NÃO foi removido no TS 6, apenas `@deprecated` (ainda funciona; quem disparou TS5107 foi `"node10"`). `baseUrl` deprecated com `moduleResolution: bundler`. `IntersectionObserver` ganhou `scrollMargin` na lib DOM do TS 6. TS pinado `~6.0.3` (não `^`) porque `typescript-eslint@8.60.1` peer `<6.1.0`.
  - **Verificação:** `turbo build --force` **13/13** ✅; `pnpm list typescript -r --depth 0` = **6.0.3** único ✅

### 4B.3 — Vite → `8.0.16` (única, accounts + ui + alinhamento)

- [x] T63 — **Unificar Vite em `8.0.16` (accounts + ui; alinhar mesas/admin)** ✅ (2026-06-19)
  - **Backup:** `git tag pre-033-f4b-vite` + lockfile copiado
  - **Investigação (completa, 2026-06-19):**
    - **Versões atuais (lockfile):**
      | App/Pacote | Vite (lockfile) | Manifesto | Plugin-react (lockfile) | Manifesto |
      |---|---|---|---|---|
      | `accounts` | 6.4.3 | `^6.3.5` | 4.5.2 | `^4.5.2` |
      | `mesas-frontend` | 8.0.16 | `^8.0.1` | 6.0.1 | `^6.0.1` |
      | `site-admin` | 8.0.16 | `^8.0.16` | 6.0.2 | `^6.0.2` |
      | `ui` | 6.4.3 | `^6.3.5` | 4.5.2 | `^4.5.2` |
      | `glossario-frontend` | 5.4.21 | `^5.2.0` | 4.2.1 | `^4.2.1` |
    - **@vitejs/plugin-react:** última compatível com Vite 8 = `6.0.2` (latest). Plugin-react v4 (accounts/ui/glossario) é incompatível com Vite 8 → bump obrigatório para `^6.0.2`.
    - **Configs review (4 arquivos):**
      - `apps/accounts/vite.config.ts`: `react()`, `root:"frontend"`, `build.outDir` — sem `build.target` explícito; Vite 8 default é `modules` (OK).
      - `apps/mesas/frontend/vite.config.ts`: `react()`, `tailwindcss()`, `manualChunks`, `chunkSizeWarningLimit` — sem `build.target`; Vite 8 nativo OK.
      - `apps/site-admin/vite.config.ts`: `react()`, `base:"/admin/"`, `proxy` dev — já Vite 8 + plugin-react 6 ✅.
      - `packages/ui`: **sem `vite.config`**. Vite usado só no script `preview` (dev); build é `tsc -p tsconfig.json`. Mesmo assim, `@vitejs/plugin-react` listado como devDep e usado no preview — bump para não quebrar preview local.
    - **Build target:** Nenhuma config especifica `build.target` → usa default do Vite. Vite 6 default = `modules` (ES2015+), Vite 8 default = `modules` (browserslist-to-esbuild). Compatível sem ajuste.
    - **Blast radius:** bumps em 3 manifests (accounts, ui, mesas-frontend) + 1 (glossario-frontend via T64a); site-admin sem alteração. Nenhuma mudança de código prevista além dos bumps. `turbo build` cobre 4 apps: accounts, mesas-frontend, site-admin, + ui (tsc). glossario-frontend build em T64a.
    - **Risco:** 🟡 baixo — configs simples, sem `build.target`/plugins custom. Rollback via `git tag pre-033-f4b-vite` + lockfile.
  - **Migração:** bump `apps/accounts` (`^6.3.5` → `^8.0.16`) + `@vitejs/plugin-react` (`^4.5.2` → `^6.0.2`); bump `packages/ui` (`^6.3.5` → `^8.0.16`) + `@vitejs/plugin-react` (`^4.5.2` → `^6.0.2`); alinhar `apps/mesas/frontend` (`^8.0.1` → `^8.0.16`) + `@vitejs/plugin-react` (`^6.0.1` → `^6.0.2`); `apps/site-admin` já `^8.0.16` + `^6.0.2` ✅. `pnpm install`; sem ajuste de config (`build.target` default OK).
  - **Teste:** `turbo build --force` accounts + mesas-frontend + site-admin + ui (13/13 esperado); `pnpm --filter @artificio/ui test` (8/8); `pnpm why vite` = só `8.0.16`; `pnpm why @vitejs/plugin-react` = só `6.0.2`; diff de bundle vs baseline (sem regressão).
  - **Doc:** registrar resultado da migração em `breaking-changes.md` (seção 8)
  - **Feito quando:** `pnpm why vite` sem 5.x/6.x; builds verdes; testes ui OK
  - **(glossario-frontend Vite 5→8 migra junto em T64a)**
  - **Execução (2026-06-19):** ✅ bumps em 3 manifests (accounts, ui, mesas-frontend) + `pnpm install`. `pnpm list vite -r` = 8.0.16 único (exceto glossario 5.4.21). `pnpm list @vitejs/plugin-react -r` = 6.0.2 único (exceto glossario 4.7.0). `turbo build --force` 13/13 ✅; `@artificio/ui test` 8/8 ✅. Sem ajuste de config. **Achado:** Vite 8 usa rolldown nativo (não rollup) — chunk names diferentes, bundles mesas-frontend 208.2/1360.4 KB vs baseline 203.3/1328.0 (estável).

### 4B.4 — Tailwind → `4.3.1` (apps já-v4)

- [x] T64b — **Bump Tailwind `4.3.1` onde já é v4 (mesas-frontend + site)** ✅ (2026-06-19)
  - **Backup:** `git tag pre-033-f4b-tw` + lockfile copiado em `artifacts/033/` e `artificiobackup/spec-033/`
  - **Investigação:** `tailwindcss` 4.3.0→4.3.1 = patch (bugfixes + cosmetica CSS: `calc(var(--spacing)*0)`→`0`, `calc(var(--spacing)*1)`→`var(--spacing)`). Sem breaking, sem migração de config. `@tailwindcss/postcss`/`@tailwindcss/vite` 4.3.0→4.3.1 alinhados.
  - **Migração:** bumps 5 linhas em 2 manifests: `apps/mesas/frontend` (3 bumps: `tailwindcss`, `@tailwindcss/postcss`, `@tailwindcss/vite` → `^4.3.1`), `apps/site` (2 bumps: `tailwindcss`, `@tailwindcss/vite` → `^4.3.1`). Zero alteração de código/config.
  - **Execução (2026-06-19):** ✅ `pnpm install` OK. Builds: mesas-frontend 1530.9 KB CSS+JS (baseline ~1360 KB JS-only, variance normal rolldown); site 46 pages OK. `pnpm list` = 4.3.1 único nos apps já-v4 (glossario 3.4.19 → T64a).
  - **Feito quando:** v4 unificada em `4.3.1` nos apps já-v4

### 4B.5 — glossario-frontend: migração combinada (lanterna)

- [x] T64a — **Migrar glossario-frontend: Vite 5→8 + Tailwind 3→4 + ESLint 8→flat 10** ✅ (2026-06-19)
  - **Backup:** `git tag pre-033-f4b-glossario` + lockfile off-código + `artifacts/033/glossario-{tailwind.config,postcss.config,vite.config}.*`
  - **Investigação (2026-06-19):**
    - **Vite:** `vite.config.ts` simples (só `react()` + alias `@`) — **zero ajuste de config** além de adicionar plugin `@tailwindcss/vite`. `@vitejs/plugin-react` `^4.2.1`→`^6.0.2` (peer `vite^8` ✅). Sem `build.target` custom, sem API deprecated. Precedente accounts (T63, mesma config) sem alteração de código.
    - **Tailwind (CORREÇÃO ao plano):** tasks.md dizia `postcss.config.js → @tailwindcss/postcss`. **ERRADO para Vite.** O correto: **deletar** `postcss.config.js`, usar plugin `@tailwindcss/vite` no `vite.config.ts` (como mesas-frontend/site). `@tailwindcss/postcss` é para builds sem Vite. `autoprefixer` e `postcss` viram devDeps desnecessários (Tailwind v4 inclui autoprefixer, @tailwindcss/vite dispensa postcss standalone). `npx @tailwindcss/upgrade@4.3.1` existe — automatiza darkMode selector→@custom-variant e colors→@theme.
      - Cores custom: `azul-escuro #1B2A4A`, `laranja #FF5722`, `branco #FFFFFF`, `cinza-fundo #F4F4F4`, `cinza-texto #555555`, `azul-medio #2E4A7A` → `@theme { --color-azul-escuro: #1B2A4A; ... }`
      - Dark mode: `darkMode: ['selector', '[data-theme="dark"]']` → `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))`
      - Index.css: `@tailwind base/components/utilities` → `@import "tailwindcss"`
      - 0 usos de `@apply`, 0 classes utilitárias `bg-white`/`text-gray-*` nativas — componentes usam CSS vars de `@artificio/ui` → baixo risco de quebra visual
    - **ESLint:** Sem config existente (confirmado: sem `.eslintrc*`, sem `eslint.config.*`). Criar `eslint.config.js` flat espelhando `apps/mesas/frontend/eslint.config.js` (23 linhas, TS+React). Deps:
      - `eslint` `^8.57.0`→`^10.5.0` (latest) ✅
      - `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` (v7) → unificar em `typescript-eslint` `^8.61.1` (latest) ✅ — peer eslint `^8.57\|^9\|^10` ✅, peer TS `<6.1.0` ✅ (~6.0.3)
      - `eslint-plugin-react-hooks` `^4.6.0`→`^7.1.1` (latest, peer eslint `^3..^10` ✅)
      - `eslint-plugin-react-refresh` `^0.4.6`→`^0.5.3` (latest, peer eslint `^9\|^10` ✅)
      - Adicionar: `@eslint/js` `^10.0.1`, `globals` `^17.6.0`
      - Script lint: remover `--ext ts,tsx` (flat config não usa)
    - **Resumo de correções ao plano original:** (1) Tailwind: `@tailwindcss/postcss`→`@tailwindcss/vite` (plugin Vite, não PostCSS); (2) Tailwind: remover `postcss`+`autoprefixer` devDeps; (3) Vite: sem ajuste de config além de adicionar plugin tailwind; (4) ESLint: pacotes renomeados, versões verificadas
  - **Migração:**
    - **Vite:** `^5.2.0`→`^8.0.16` + plugin-react `^4.2.1`→`^6.0.2`; adicionar `@tailwindcss/vite` no `vite.config.ts`; sem ajuste de config
    - **Tailwind 3→4 (CSS-first):** deletar `postcss.config.js`; `tailwind.config.ts` → `@theme` no `index.css` + `@custom-variant dark`; `@tailwind base/components/utilities` → `@import "tailwindcss"`; remover `autoprefixer`+`postcss` devDeps; rodar `npx @tailwindcss/upgrade` e revisar o diff
    - **ESLint 8→10:** criar `eslint.config.js` flat (espelhar mesas-frontend/config); remover deps legados `@typescript-eslint/{eslint-plugin,parser}`; adicionar `typescript-eslint`, `@eslint/js`, `globals`; remover `--ext` do script lint
  - **Teste:** build glossario-frontend ✅; `pnpm lint` glossario sem erro novo (52 pré-existentes) ✅; smoke visual (público + admin renderizam, estilos íntegros, dark D065 intacto) ✅; diff de bundle CSS (61.2 KB) ✅
  - **Doc:** ✅ registrar migração CSS-first + flat config em `breaking-changes.md` seções 8/9/10 (completado 2026-06-19)
  - **Feito quando:** glossario-frontend em Vite 8 + Tailwind 4.3.1 + ESLint 10 flat; build/lint verdes; estilos íntegros ✅
  - **Execução (2026-06-19):** ✅ `vite ^5.2.0`→`^8.0.16`, `@vitejs/plugin-react ^4.2.1`→`^6.0.2`, `tailwindcss ^3.4.3`→`^4.3.1`. Removidos: `postcss`, `autoprefixer`, `@typescript-eslint/*` legados. Adicionados: `@tailwindcss/vite`, `@eslint/js`, `globals`, `typescript-eslint`. Tailwind: deletado `postcss.config.js` + `tailwind.config.ts`; `index.css` migrado (`@import` + `@theme` + `@custom-variant dark`); `@tailwindcss/vite` adicionado ao `vite.config.ts` (13→15 linhas). ESLint: `eslint.config.js` criado (23 linhas, espelho mesas). Build ✅ (`vite build` 982ms, 30 chunks, CSS 61.2 KB). Lint: **52 problemas (50 erros + 2 warnings) — TODOS pré-existentes** (`set-state-in-effect`, `no-explicit-any`, `static-components`, `no-unused-vars`, `preserve-caught-error`, `react-refresh/only-export-components`). O eslint agora RODA (antes não tinha config). **Fix pós-migração (commit `315d483`, PR #69):** `--font-family-sans` → `--font-sans` (token Tailwind v4 correto). Débito existente: `BL-033-GLOSSARIO-LINT-NEVER-RAN` — lint não rodava; 52 problemas a corrigir em T66.

### 4B.6 — ESLint → `10.5.0` (root + mesas-frontend)

- [x] T65 — **Unificar ESLint em `10.5.0` (restante)** ✅ (2026-06-19)
  - **Backup:** `git tag pre-033-f4b-eslint` ✅ (2026-06-19)
  - **Investigação (2026-06-19):** completa em `breaking-changes.md` §11 + `sessoes/26-06-18_3_infra_toolchain-update-spec.md` (T65)
    - **Escopo:** root (`^9.28.0`→`^10.5.0`, typescript-eslint `^8.33.1`→`^8.61.1`, @eslint/js `^9.28.0`→`^10.0.1`) + mesas-frontend (`^9.39.4`→`^10.5.0`, typescript-eslint `^8.57.0`→`^8.61.1`, @eslint/js `^9.39.4`→`^10.0.1`, react-hooks `^7.0.1`→`^7.1.1`, react-refresh `^0.5.2`→`^0.5.3`, globals `^17.4.0`→`^17.6.0`). packages/config sem deps próprios → recebe hoisting do root.
    - **Peer deps (verificados `npm view`):** todos compatíveis. typescript-eslint 8.61.1 peer eslint `^8.57||^9||^10` + TS `>=4.8.4 <6.1.0` → TS `6.0.3` ✅. react-hooks 7.1.1 peer eslint até `^10` ✅. eslint 10.5.0 engine `>=24` → Node 26.3.0 ✅.
    - **`jiti` — NÃO é risco:** eslint 10.5.0 lista `jiti: *` mas `peerDependenciesMeta.jiti.optional=true` → peer opcional, pnpm não warna. Só p/ config `.ts`; configs são `.js`. **Não adicionar jiti.**
    - **Revisão da investigação (2026-06-19, testada):** versões atuais/target confirmadas; ambos configs usam `js.configs.recommended`; `eslint-env` zero ocorrências; jiti ausente do workspace; baseline mesas reconfirmado 29 err + 1 warn. Único risco real = delta das 3 regras novas.
    - **Breaking changes ESLint 9→10 relevantes:**
      1. **3 novas regras em `eslint:recommended`:** `no-unassigned-vars`, `no-useless-assignment`, `preserve-caught-error`. Ambos configs usam `js.configs.recommended` → **novos erros esperados**.
      2. **JSX reference tracking:** `<Component>` vira referência → pode reduzir falsos-positivos de `no-unused-vars` no mesas-frontend.
      3. **`eslint/config` (`defineConfig`/`globalIgnores`):** mantidos no ESLint 10, compatível.
      4. **`eslint-env` comments:** zero ocorrências, sem impacto.
      5. **`no-shadow-restricted-names`** reporta `globalThis`: improvável impacto.
      6. **Config lookup cwd→file-based:** cada package tem config na raiz, sem impacto.
    - **Baseline lint pré-T65:** `turbo run lint` falha (auth/content/analytics sem config — débito BL-033). mesas-frontend: **29 errors + 1 warning** (todos `react-hooks/set-state-in-effect` + 1 `immutability` + 1 `exhaustive-deps`). Pré-existentes do ESLint 9.39.4 + react-hooks 7.0.1.
    - **Seção breaking-changes:** `## 11. eslint 9 → 10 (root + mesas-frontend)` em `breaking-changes.md`.
  - **Migração:**
    1. Bump root: `eslint ^10.5.0`, `@eslint/js ^10.0.1`, `typescript-eslint ^8.61.1`.
    2. Bump mesas-frontend: idem + `react-hooks ^7.1.1`, `react-refresh ^0.5.3`, `globals ^17.6.0`.
    3. `packages/config` sem edição (hoisting). **Não** adicionar jiti.
    4. `pnpm install`; confirmar zero erro de peer.
  - **Teste:** lint **por pacote** (não turbo agregado, cai por BL-033): `pnpm --filter @artificio/config lint` + mesas `eslint .`. Delta vs baseline (mesas 29 err + 1 warn) registrado. `pnpm why eslint`/`@eslint/js`/`typescript-eslint` = versão única cada.
  - **Doc:** regras novas + delta de erros em `breaking-changes.md` §11 + session + esta task.
  - **Triagem:** erros das 3 regras novas (`no-unassigned-vars`/`no-useless-assignment`/`preserve-caught-error`) → corrigir mínimo agora OU virar débito BL-033 documentado. Nunca fechar escondendo regressão.
   - **Feito quando:** `pnpm why eslint` = só `10.5.0`; lint roda; delta documentado (sem regressão silenciosa)
   - **Execução (2026-06-19):** ✅ bumps aplicados (root: eslint `^10.5.0` + @eslint/js `^10.0.1` + typescript-eslint `^8.61.1`; mesas-frontend: idem + react-hooks `^7.1.1` + react-refresh `^0.5.3` + globals `^17.6.0`). `pnpm install` limpo (zero peer warnings novos, jiti não adicionado). **`pnpm why eslint` = 10.5.0 único** ✅. **`pnpm why typescript-eslint` = 8.61.1 único** ✅. **`pnpm why @eslint/js` = 10.0.1 único** ✅.
     - **packages/config lint:** 0 erros ✅ (sem delta — as 3 regras novas não geraram erro em packages/config).
     - **mesas-frontend lint:** **31 errors + 1 warning** (baseline era 29+1; delta +2). 29 `set-state-in-effect` + 1 `immutability` + 1 `exhaustive-deps` = pré-existentes (inalterados). **Delta +2 = `preserve-caught-error`** (nova regra `eslint:recommended`):
       - `src/schemas/profileSchemas.ts:159` — `throw new Error(...)` sem `cause` no catch
       - `src/services/apiClient.ts:180` — idem
     - **`no-unassigned-vars` e `no-useless-assignment`**: zero ocorrências (código limpo).
      - **ZERO regressão:** nenhum erro novo além dos 2 previstos de `eslint:recommended`.

- [x] T65b — **Corrigir `preserve-caught-error` (+2 delta T65)** ✅ (2026-06-19)
  - **Erro 1:** `src/schemas/profileSchemas.ts:159` — `catch (error)` → `throw new Error(firstError.message)` sem `cause: error`
  - **Erro 2:** `src/services/apiClient.ts:180` — `catch (err)` → `throw new Error(message)` sem `cause: err`
  - **Fix:** adicionar `{ cause: <erro original> }` ao `new Error()`
  - **Erros pré-existentes (30):** 29 `set-state-in-effect` + 1 `immutability` + 1 `exhaustive-deps` → NÃO corrigir agora (T66 / BL-033)
  - **Teste:** `pnpm --filter @artificio/mesas-frontend lint` → 30 erros (delta 0 vs baseline pré-T65 29+1)
  - **Feito quando:** 2 `preserve-caught-error` corrigidos; lint mesas = baseline 29+1 + 0 novos

### 4B.7 — Astro → `6.4.8` (site)

- [x] T66 — **Migrar site Astro 5→6 (`^6.4.8`)**
  - **Backup:** ✅ `git tag pre-033-f4b-astro` + `pnpm-lock.yaml.pre-astro.bak` + `astro.config.mjs.pre-astro.bak`
  - **Investigação (2026-06-19):** ✅ breaking changes analisados item a item (ver `breaking-changes.md` §12). **Risco BAIXO.** Site não usa Content Collections, islands React, SSR, ViewTransitions, Astro.glob, @astrojs/check. `@tailwindcss/vite` compat Vite 7. `@astrojs/sitemap`/`@astrojs/rss` já no latest compat Astro 6. ZERO mudanças de config. Migração = bump mecânico `astro ^5.5.0`→`^6.4.8`.
  - **Migração (2026-06-19):** ✅ `astro ^5.5.0`→`^6.4.8` em `apps/site/package.json`. `pnpm install` limpo (+31/-5 packages, zero peer warnings novos). Nenhuma integração `@astrojs/*` precisou bump (já no latest).
  - **Teste (2026-06-19):** ✅ `astro build` + pagefind: 46 páginas, 6.60s, sitemap-index.xml OK. `turbo build --force` 13/13 verde (1m15s). `vitest` 22/22 pass. `dist` verificado: rss.xml (5027B), robots.txt (76B), sitemap-index.xml (187B), canonical OK, 0 `.astro` legacy.
  - **Doc:** breaking changes Astro em `breaking-changes.md` §12 com resultado de execução; **D054 revisitada** (Astro 6 usa Vite 7 interno, sem conflito com plugins do workspace)
  - **Feito quando:** site em Astro 6.4.8; dist completo 46p; turbo 13/13 verde; vitest 22/22 ✅

- [x] **T66b — Análise de features Astro 6 aplicáveis ao projeto (2026-06-19)**
  - **CSP Nativa:** Astro 6 gera hashes automáticos para `<script is:inline>`. Site tem 5 inline scripts. Investigação inicial assumiu que exigia adapter HTTP (Node/Vercel/Cloudflare) — **corrigido**: CSP Astro 6 usa `<meta http-equiv>` tag, funciona em SSG sem adapter. ✅ Implementado (ver abaixo).
  - **Fonts API:** Site usa fontes de sistema (sem Google Fonts/Fontsource). **Não se aplica.**
  - **Live Content Collections:** Conteúdo do site é JSON estático (`posts.json`/`pages.json`), não content collections. **Não se aplica.**
  - **Sätteri Markdown (Rust):** Site não tem conteúdo markdown. Melhoria de build automática sem ação. **Zero impacto.**
  - **Queued Rendering:** Melhoria interna do Astro (memória na geração de páginas). **Zero ação.**
  - **Cloudflare adapter (`@astrojs/cloudflare`):** Não instalado. Site é SSG sem adapter de runtime. **Não se aplica.** Cloudflare Tunnel (`cloudflared`) + Cloudinary (imagens) não têm relação com o adapter Astro.
  - **`output: 'hybrid'` removido:** Site usa `static` (default). **Zero impacto.**
  - **Breaking changes adicionais:** Nenhum outro afeta (Node 22 ✅, Zod 4 ✅, sem `Astro.glob`/`ViewTransitions`/`astro:schema` usados).
  - **Conclusão:** Nenhuma feature Astro 6 demanda ação. CSP implementado via meta tag (abaixo).
  - **CSP implementado (2026-06-19):** ✅ `security.csp` em `astro.config.mjs`. Astro 6 gera `<meta http-equiv="content-security-policy">` com 5 hashes SHA-256 (inline scripts). Diretivas: `default-src 'self'`, `img-src 'self' data: https://res.cloudinary.com`, `connect-src 'self' https://accounts.artificiorpg.com https://www.google-analytics.com`, `script-src 'self' https://www.googletagmanager.com` + hashes auto. 46/46 páginas com CSP. `turbo build --force` 13/13 verde. Vitest 22/22. `BL-ASTRO6-CSP` FECHADO.

### 4B.8 — Validação final da Fase 4B

- [x] T67 — **Validação consolidada dos majors (2026-06-19)**
  - ✅ `turbo build --force` 13/13 verde → `artifacts/033/post-f4b-build.log`
  - ✅ `pnpm lint` sem regressão. 3 pacotes sem config (`auth`, `content`, `analytics`) = `BL-CI-ESLINT-FLAT-CONFIG` pré-existente (ci.yml `continue-on-error`). Pacotes com config (config, glossario-frontend, mesas-frontend) todos 0/0.
  - ⚠️ `pnpm audit --prod`: 7 vulns (3 HIGH) — todos pré-existentes em transitive deps (xlsx, form-data, dompurify, nanoid, uuid). Nenhum introduzido pela Fase 4B.
  - ✅ **Zero skew:**
    - **zod:** 4.4.3 em todos os workspaces. Extra: `lighthouse > zod@3.25.76` (devDependency, não runtime, inofensivo)
    - **typescript:** 6.0.3 único
    - **vite:** 8.0.16 em todos os consumers (accounts, mesas-frontend, glossario-frontend, site-admin, ui). Root `vitest@3.2.6` = vite 7.3.5 (próprio, separado)
    - **tailwindcss:** 4.3.1 único
    - **eslint:** 10.5.0 único
    - **react:** 19.2.7 único
    - **express:** 5.2.1 único
  - **Feito quando:** 13/13 verde; sem regressão de lint; skew documentado; audit com ressalvas pré-existentes ✅

**Fase 4B CONCLUÍDA.** Todas as majors unificadas: zod 4.4.3, TS 6.0.3, Vite 8.0.16, Tailwind 4.3.1, ESLint 10.5.0, React 19.2.7, Express 5.2.1, Astro 6.4.8, Kysely 0.29.2.

---

## Fase 5 — Docker e infra

### 5.0 — Backup pré-Docker

- [x] T29 — **Backup de código + snapshot da VM antes de mexer em imagens** ✅ (2026-06-19)
  - `git tag pre-033-f5-docker` ✅
  - `ssh faren 'docker images ...' > artifacts/033/pre-f5-docker-images.txt` ✅ 1662B, 24 imagens
  - `ssh faren 'docker ps ...' > artifacts/033/pre-f5-docker-ps.txt` ✅ 1472B, 18 containers (todos healthy)
  - **Imagens stale identificadas (candidatas a T33):**
    - `node:20-alpine` — base antiga, nenhum container usa (Fase 2 migrou p/ 24-alpine)
    - `glossario-beta-api-beta` / `glossario-beta-app-beta` (861a99a0/d7a587cc) — naming antigo pré-monorepo, não em uso
    - `glossario-api-prod` / `glossario-app-prod` (4e81d924/51e7527a) — naming antigo pré-monorepo, não em uso
    - `curlimages/curl:8.8.0` — versão velha (8.11.1 já presente)
    - `site-beta-site-beta-app` (04899288) — imagem presente mas container **não está rodando** (site beta dispatch-only, pendente pós-Fase 4B)
  - **Containers ausentes:** `site-beta-app` + `site-beta-db` não estão rodando (esperado — dispatch-only não deployado no push pós-merge PR #70)
  - **Feito quando:** snapshots salvos off-VM

### 5.1 — Alteração

- [x] T30 — **Atualizar imagens base Docker** ✅ (2026-06-19 — escopo reduzido após investigação)
  - **Node:** ✅ já alinhado em T8. Zero edições.
  - **Postgres:** ✅ mantido `postgres:16-alpine` (Opção A, decisão 2026-06-19). Zero edições.
  - **Nginx:** ✅ `nginx:alpine` → `nginx:1.31-alpine` em 2 Dockerfiles:
    - `apps/glossario/frontend/Dockerfile:28`
    - `apps/mesas/frontend/Dockerfile:43`
    - **Corrigido 2026-06-19:** plano original `1.27` estava errado — `nginx:alpine` resolve para 1.31.2 (confirmado nos 4 containers rodando). 1.27 seria downgrade.
  - **Cloudflared:** fora de escopo (não versionado). Documentado em `docs/agents/infra-map.md`.
  - **Curl:** fora de escopo (só imagem stale na VM). → T33.
  - **Feito quando:** grep `nginx:alpine` em Dockerfiles = 0; grep `nginx:1.31-alpine` = 2 ✅

### 5.2 — Teste de impacto

- [ ] T31 — **Build local das imagens Docker** (plano revisado 2026-06-19 — Docker indisponível no Windows)
  - **T31a — `COPY patches` em todos os Dockerfiles:** ✅ (2026-06-19)
    - Inventário validado contra `breaking-changes.md` §10 — sem drift
    - Adicionado `COPY patches ./patches` (ou `COPY --from=build /repo/patches ./patches`) em 4 Dockerfiles que faltavam:
      - `apps/accounts/Dockerfile` — estágio deps (L7) + runtime (L20)
      - `apps/glossario/backend/Dockerfile` — estágio builder (L15) + production (L31)
      - `apps/glossario/frontend/Dockerfile` — estágio builder (L22)
      - `apps/site/Dockerfile` — estágio único (L14)
    - Verificação: 9 `COPY patches` para 9 `RUN pnpm install --frozen-lockfile` em 6 Dockerfiles ✅
  - **T31b — Build Docker (VM):** impossível localmente (sem Docker no Windows). Validação real = deploy beta (T32) — `docker build` roda na VM
  - **Nota:** `docker build` local removido do escopo (sem Docker). Substituído por verificação estrutural + deploy beta como prova real
  - **Feito quando:** todos os Dockerfiles com `COPY patches` antes de cada `pnpm install --frozen-lockfile` ✅

- [x] T32 — **Deploy beta com novas imagens** ✅ (2026-06-19)
  - **PR #71** mergeado em `dev` (`734e10a`)
  - **mesas beta:** ✅ automático (run `27844601842`). 3 containers healthy, nginx 1.31.2, smoke 200/401/302
  - **glossario beta:** ✅ dispatch (run `27844800289`). 3 containers healthy, nginx 1.31.2, smoke 200
  - **site beta:** ✅ dispatch (run `27845020946`). 2 containers healthy, smoke 200/200/200
  - **nginx:1.31-alpine** pullada e presente na VM (`docker images`)
  - **Feito quando:** 3 deploys beta verdes; smoke OK; nginx:1.31-alpine no `docker images` da VM ✅

### 5.2b — GitHub Actions: eliminar warnings Node 20

- [x] T33a — **Atualizar `dependency-review-action` v4→v5 (node24)** ✅ (2026-06-19)
  - Investigação (2026-06-19): todos os SHA pins de `actions/checkout` (v6.0.3), `actions/setup-node` (v6.4.0), `actions/cache` (v5.0.5) e `actions/setup-python` (v6.2.0) já usam `runs.using: node24`. O warning de Node 20 vem **unicamente** de `actions/dependency-review-action@3b139cfc...` (v4.5.0, `runs.using: node20`).
  - Ação: trocar SHA `3b139cfc5fae8b618d3eae3675e383bb1769c019` (v4.5.0) pelo SHA de v5.0.0 (`a1d282b36b6f3519aa1f3fc636f609c47dddb294`, node24, 2026-05-08).
  - **Arquivo:** `.github/workflows/dependency-review.yml:24` (1 SHA, 1 linha)
  - **Feito quando:** deploy sem warning `Node.js 20 is deprecated`

- [x] T33b — **Atualizar `actions/checkout` v6→v7 (opcional, cosmético)** ✅ (2026-06-19)
  - v7.0.0 lançado 2026-06-17. Upgrade ESM interno, sem breaking changes para consumidores. v6.0.3 já roda em node24.
  - Breaking change de v7 (bloqueio de fork PR em `pull_request_target`/`workflow_run`) não nos afeta — não usamos esses eventos.
  - Ação: trocar SHA `df4cb1c069e1874edd31b4311f1884172cec0e10` (v6.0.3) pelo SHA de v7.0.0 (`9c091bb6f51ef654c96127f7b33352a2ff591fcb`) nos 17 `uses:` + comentários.
  - **Arquivos:** 13 workflows em `.github/workflows/*.yml` (17 ocorrências)
  - **Feito quando:** PR checks passam com checkout v7 em todos os workflows

### 5.2c — pnpm 10→11 (major bump)

- [x] T33c — **Migrar pnpm 10.12.1 → 11.8.0** ✅ (2026-06-19)
  - **Investigação:** apenas 1 breaking change nos afeta — campo `pnpm` em `package.json` não é mais lido. `onlyBuiltDependencies`/`npm_config_*`/`.npmrc`: zero uso no repo (sem migração necessária).
  - **`package.json`:** `packageManager: pnpm@11.8.0`; campo `pnpm` removido (overrides era `{}` vazio, sem efeito).
  - **`pnpm-workspace.yaml`:** `patchedDependencies` migrado + `allowBuilds: "*": true` (preserva comportamento pnpm 10; `strictDepBuilds` é `true` por default no 11 e bloquearia scripts de build).
  - **6 Dockerfiles:** 9 ocorrências de `pnpm@10.12.1` → `pnpm@11.8.0` (`npm install -g` + `corepack prepare`).
  - **Arquivos:** `package.json`, `pnpm-workspace.yaml`, `apps/accounts/Dockerfile`, `apps/site/Dockerfile`, `apps/glossario/backend/Dockerfile`, `apps/glossario/frontend/Dockerfile`, `apps/mesas/backend/Dockerfile`, `apps/mesas/frontend/Dockerfile`
  - **Feito quando:** Docker build sem warning `Update available!` e `pnpm install --frozen-lockfile` passa com lockfile auto-migrado

### 5.4 — Limpeza

- [ ] T34 — **Limpar imagens stale na VM** (investigado 2026-06-19)
  - **Investigação completa:** 20 containers rodando, zero parados. 25 imagens (15 ativas, 10 inativas). `docker system df`: 1.2GB reclaimable.
  - **9 imagens stale identificadas (2.56GB):**

  | # | Imagem | Data | Tamanho | OBS |
  |---|---|---|---|---|
  | 1 | `mesas-beta-mesas-beta-frontend:latest` | Jun 4 | 94MB | nome antigo |
  | 2 | `glossario-beta-api-beta:latest` | Jun 4 | 270MB | nome antigo |
  | 3 | `glossario-beta-app-beta:latest` | Jun 4 | 102MB | nome antigo |
  | 4 | `glossario-api-prod:latest` | Jun 4 | 270MB | nome antigo |
  | 5 | `glossario-app-prod:latest` | Jun 4 | 102MB | nome antigo |
  | 6 | `site-site-beta-app:latest` | Jun 18 | 1.46GB | substituído |
  | 7 | `node:20-alpine` | Abr 15 | 194MB | substituído por 24 |
  | 8 | `curlimages/curl:8.8.0` | Mai 2024 | 37MB | versão antiga |
  | 9 | `curlimages/curl:8.11.1` | Dez 2024 | 35MB | não usado |

  - **1 tag flutuante:** `nginx:alpine` (mesmo ID de `nginx:1.31-alpine`). Só remover tag, sem economia de espaço.
  - **NÃO remover:** `nginx:1.31-alpine` (base de build dos frontends), `postgres:16-alpine` (ativo, 3 beta DBs), imagem dangling `16bc17c64a57` (4 prod DBs ativos — ver T34a).
  - **Comando:** `docker rmi <cada uma das 9>` — NÃO usar `prune -a` (removeria `nginx:1.31-alpine`).
  - **Teste:** `docker images` sem as 9 stale; 20 containers healthy.
  - ⚠️ **Requer aprovação nominal**

- [ ] T34a — **Corrigir fluxo de deploy para manter DBs atualizados + corrigir containers stale** (achado T34, investigado 2026-06-19)

  **Evidência:** 4 containers prod de DB (`site-prod-db`, `mesas-db`, `glossario-db`, `accounts-db`) usam imagem postgres sem tag (`sha256:16bc17c64a57`, Mai 14, 389MB). 3 beta DBs usam `postgres:16-alpine` (Jun 16, `e013e867e712`). `docker ps` mostra SHA em vez de tag para os prod DBs — sinal de que a tag foi movida para imagem mais nova após a criação do container.

  **Root cause — fluxo de deploy não puxa `image:` services:**

  O script de deploy (`_deploy-module.yml` linhas 421-443) faz nesta ordem:
  1. `docker compose up -d "$DB_SERVICE"` — inicia DB com imagem local (linha 421)
  2. `docker compose down --remove-orphans` — derruba tudo (441)
  3. `docker compose build --no-cache --pull` — builda APPs com `--pull` (442). **Mas `--pull` no `docker compose build` só puxa imagens base dos Dockerfiles (`FROM`), NÃO puxa serviços definidos com `image:` (como `postgres:16-alpine`).**
  4. `docker compose up -d --force-recreate` — recria containers com a mesma imagem local cacheada (443)
  5. `docker image prune -f` — remove dangling mas o postgres velho fica (491) pois está em uso

  **8× docker-compose afetados** (todos os DBs usam `image: postgres:16-alpine` sem `build:`):

  | Arquivo | DB service | Status imagem |
  |---|---|---|
  | `accounts/docker-compose.prod.yml` | `accounts-db` | stale (Mai 14) |
  | `glossario/docker-compose.prod.yml` | `glossario-db` | stale (Mai 14) |
  | `mesas/docker-compose.prod.yml` | `mesas-db` | stale (Mai 14) |
  | `site/docker-compose.prod.yml` | `site-prod-db` | stale (Mai 14) |
  | `glossario/docker-compose.beta.yml` | `glossario-beta-db` | atual (Jun 16) |
  | `mesas/docker-compose.beta.yml` | `mesas-beta-db` | atual (Jun 16) |
  | `site/docker-compose.beta.yml` | `site-beta-db` | atual (Jun 16) |

  **Política em vigor:** `postgres:16-alpine` floating major (Opção A, T30) = patches automáticos. O fluxo de deploy deveria usar sempre a imagem mais recente.

  **Correção de fluxo (evitar recorrência):**

  Adicionar `docker compose pull "$DB_SERVICE"` ANTES de `docker compose up -d "$DB_SERVICE"` no `_deploy-module.yml`:

  ```bash
  # Puxa imagem fresca do DB (postgres:16-alpine floating) antes de subir.
  # Sem isto, o deploy reusa imagem cacheada local mesmo que o registry
  # tenha patch novo (ex.: Mai 14 -> Jun 16). build --pull só cobre FROM,
  # não serviços image:.
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$env_file_name" pull "$DB_SERVICE"
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" --env-file "$env_file_name" up -d "$DB_SERVICE"
  ```

  **Impacto do `pull`:**
  - Baixo risco: `16-alpine` é major pin, patches são seguros
  - Rollback coberto: snapshot pré-deploy (linha 434) + função rollback (linhas 360-370)
  - Não adiciona latência significativa (imagem ~400MB, pull condicional — só baixa se houver atualização)
  - **Não afeta builds:** `build --no-cache --pull` na linha 442 continua puxando bases dos Dockerfiles

  **Correção dos 4 containers stale (ação única):**

  Após o `pull` ser adicionado ao fluxo, o próximo deploy de cada app prod corrige automaticamente o container stale (o `pull` traz a imagem nova, o `up --force-recreate` recria o container). Nenhuma ação manual necessária.

  **Alternativa com `pull_policy: always`:** adicionar `pull_policy: always` no serviço DB de cada compose. Mais explícito mas requer editar 7 composes + manter consistência. `docker compose pull` no script é mais simples e centralizado.

  **Arquivos a modificar:**
  - `.github/workflows/_deploy-module.yml` — adicionar `pull "$DB_SERVICE"` antes do `up`
  - Zero alteração nos 7 docker-compose files

  **Feito quando:**
  1. `_deploy-module.yml` com `pull "$DB_SERVICE"` no fluxo
  2. Próximo deploy prod de cada app mostra `postgres:16-alpine` (não SHA) no `docker ps`
  3. `docker images` sem postgres dangling (`<none>:<none>`) em uso por containers

  ⚠️ **Requer aprovação nominal** para editar `_deploy-module.yml` (infra compartilhada, SDD Completo)

---

## Fase 6 — VM (apt)

### 6.0 — Backup pré-apt (Gate A)

- [ ] T35 — **Backup completo da VM antes de apt upgrade**
  - `pg_dump` de TODOS os bancos (conferir contagem real — accounts + mesas prod/beta + glossario prod/beta + site prod/beta = 7, não 6) → leitura na VM, NÃO exige aprovação
  - `docker images` + `docker ps` snapshot → leitura, NÃO exige aprovação
  - `apt list --installed` snapshot → leitura, NÃO exige aprovação
  - Copiar dumps para off-VM (`C:\projetos\artificiobackup\spec-033\`) → **write local** (fora da VM; não é leitura, mas não toca a VM → não exige aprovação de VM)
  - **Novo snapshot de volume Oracle** (procedimento análogo ao Gate A; o Gate A original já foi aprovado/executado em 2026-06-04 — isto é um snapshot NOVO, não o Gate A pendente) → ⚠️ **Requer aprovação nominal** (write na infra Oracle; ação distinta do pg_dump)
  - ⚠️ **Recriação de volume/instância Oracle** (destrutivo) → só em rollback; **aprovação nominal própria e separada** do snapshot — nunca coberta pela aprovação do snapshot
  - **Feito quando:** backup verificado off-VM; dumps íntegros (`pg_restore --list` confirma)

### 6.1 — Alteração

- [ ] T36 — **apt update && apt upgrade na VM**
  - 5 pacotes: fwupd, libjcat1, libnuma1, libtraceevent1, libxmlb2
  - `ssh faren 'sudo apt-get update && sudo apt-get upgrade -y && sudo apt-get autoremove -y'`
  - ⚠️ **Requer aprovação nominal**

### 6.2 — Teste de impacto pós-apt

- [ ] T37 — **Validar serviços pós-apt**
  - `ssh faren 'docker ps'` — todos healthy
  - Smoke HTTP público: raiz, accounts, glossario, mesas, beta (5 hostnames)
  - `docker logs cloudflared --tail 20` — sem erro novo
  - `apt list --upgradable` — 0 pendentes
  - **Feito quando:** containers healthy; smokes 200; zero regressão

---

## Fase 7 — Fechamento

### 7.0 — Deploy prod

- [ ] T38 — **Deploy prod de todos os apps**
  - Promote `dev→main` via `promote-prod-fast-forward.yml`
  - Deploy prod: accounts, mesas, glossario, site (4 deploys)
  - ⚠️ **Requer aprovação nominal** por ação (promote + cada deploy)

- [ ] T39 — **Smoke prod completo**
  - Todas as rotas críticas (ver `spec.md` → Critérios de aceite)
  - Login SSO cross-subdomínio: accounts → mesas → glossario
  - SEO: canonicals, sitemap-index.xml, robots.txt, meta tags sem regressão
  - **Feito quando:** todos os smokes verdes; mantenedor valida

### 7.1 — Atualizar docs de governança e memória (.specify/memory/)

- [ ] T40 — **Atualizar `.specify/memory/errors.md`**
  - E001 (linha 23): `node:20-alpine` → `node:24-alpine` no exemplo de solução
  - E004 (linhas 43-48): marcar como **FECHADO** (Express 4→5 concluído, override removido)
  - Adicionar nota: "Fechado pela spec 033 em 2026-06-XX. mesas migrou p/ Express 5; override `@types/multer>@types/express` removido."
  - **Feito quando:** refs a node:20 e Express 4 corrigidas

- [ ] T41 — **Atualizar `.specify/memory/decisions.md`**
  - D060 (linha 68): mudar status de "firme" para "firme — concluído (spec 033)"
  - Adicionar nova decisão **D081**: **"Node.js canônico = 24.x LTS"** com data e motivo (alinhamento de 3 versões divergentes; 25.x descartado por ser não-LTS/EOL ~jun/2026)
  - Adicionar nova decisão **D082**: **"Imagens base Docker com tag explícita"** (postgres:16.8-alpine, nginx:1.27-alpine, node:24-alpine)
  - Adicionar nova decisão **D083**: **"Toolchain unificado — versão única por dep em todo o monorepo"** (zod 4.4.3, TypeScript 6.0.3, Vite 8.0.16, Tailwind 4.3.1, ESLint 10.5.0, React 19.2.7, Express 5.2.1; Astro 6.4.8 no site). Motivo: skew vira dor exponencial conforme o monorepo cresce; unificar agora.
  - **Revisitar D054** (stack do site/Astro) à luz do Astro 6
  - **Nota (PR #72):** D080 já registrada (política pnpm 11 `allowBuilds`); próximos IDs livres a partir de D081.
  - **Feito quando:** D060 atualizado; decisões D081/D082/D083 registradas; D054 revisitada

- [ ] T42 — **Atualizar `.specify/memory/project-state.md`**
  - Seção "Construído neste monorepo": adicionar spec 033 como concluída
  - Remover menção ao override `@types/multer>@types/express` (linha 150)
  - Atualizar seção "Próximo passo" com toolchain canônico
  - Registrar status dos débitos fechados (D-DEP2, D-DEP1, BL-MESAS-EXPRESS5-016)
  - **Feito quando:** project-state reflete toolchain pós-spec 033

### 7.2 — Atualizar docs de arquitetura e infra

- [ ] T43 — **Atualizar `.specify/arquiteture.md`**
  - Seção 1 (Layout): verificar se stack canônica listada bate com a nova realidade
  - Seção 5 (Banco): `postgres:16-alpine` → `postgres:16.8-alpine` se mencionado
  - Seção 7 (CI/CD): se mencionar `node-version: 20`, atualizar para 24
  - Avaliar se precisa listar versões canônicas em tabela própria
  - **Feito quando:** `rg 'node.*20|express.*4|postgres:16-alpine' .specify/arquiteture.md` retorna 0 (ou só refs históricas)

- [ ] T44 — **Atualizar `docs/agents/infra-map.md`**
  - Seção "Host": adicionar versões canônicas de runtime (Node 24.x LTS, pnpm 11.8.0, Docker 29.5.3)
  - Adicionar nota da política pnpm 11 `allowBuilds` enumerado (D080): dep nova com build-script → enumerar + revalidar `--frozen-lockfile`; nunca `"*": true`
  - Seção "Postgres": `postgres:16-alpine` → `postgres:16.8-alpine`
  - Seção "Regra operacional de deploy": verificar refs a `node:20-alpine` (nenhuma encontrada na busca — OK)
  - Adicionar seção "Imagens base Docker": tabela com imagem, tag, data de atualização
  - Atualizar lista de containers com imagens novas
  - **Feito quando:** todas as refs de versão atualizadas; tabela de imagens base criada

- [ ] T45 — **Atualizar `docs/agents/context-capsule.md`**
  - Seção "Stack canônica": atualizar refs de versão (Node, Express, Postgres)
  - Se "Express" aparecer sem versão, adicionar `5.x`
  - Se "Node" aparecer sem versão, adicionar `24.x LTS`
  - **Feito quando:** stack canônica no capsule reflete versões pós-spec 033

### 7.3 — Atualizar specs relacionadas

- [ ] T46 — **Fechar spec 016 (mesas Express 5)**
  - `specs/016-mesas-express5/spec.md`: marcar como concluída; adicionar nota "Migrado pela spec 033"
  - `specs/016-mesas-express5/plan.md`: idem
  - `specs/016-mesas-express5/tasks.md`: marcar T6 (`grep "express": "^4"` = 0) como concluída
  - **Feito quando:** spec 016 marcada como fechada/absorvida pela 033

- [ ] T47 — **Atualizar `specs/backlog.md`**
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

- [ ] T48 — **Atualizar `specs/README.md`**
  - Adicionar spec 033 na tabela: `033 | infra toolchain update | Fechada (ou estado atual)`
  - Atualizar spec 016: `016 | mesas Express 5 | Fechada/absorvida pela 033`
  - **Feito quando:** tabela de specs atualizada

### 7.4 — Atualizar docs de apps

- [ ] T49 — **Atualizar `apps/site/README.md`**
  - Linha 62: `postgres:16-alpine` → `postgres:16.8-alpine`
  - **Feito quando:** ref atualizada

- [ ] T50 — **Atualizar `apps/mesas/docs/TESTES.md`**
  - Linha 233: `node-version: '22'` → `node-version: '24'`
  - **Feito quando:** ref atualizada

### 7.5 — Atualizar sessão e fechar

- [ ] T51 — **Atualizar `sessoes/26-06-18_3_infra_toolchain-update-spec.md`**
  - Marcar todas as fases concluídas
  - Atualizar checklist de fechamento
  - Atualizar "Evidências" com versões finais
  - Mover para `sessoes/encerradas/`
  - **Feito quando:** sessão atualizada e encerrada

- [ ] T52 — **Atualizar `sessoes/index.md`**
  - Marcar sessão `26-06-18_3` como concluída (ou mover para encerradas)
  - **Feito quando:** index atualizado

### 7.6 — Verificação final de documentação

- [ ] T53 — **Varredura final: garantir que nenhum doc essencial ficou desatualizado**
  - `rg -l 'node.*20' .specify/ docs/agents/ specs/033* specs/016* --glob '!pnpm-lock.yaml'` — só devem sobrar refs históricas em sessoes antigas
  - `rg -l 'express.*4\.' .specify/ docs/agents/ apps/*/package.json packages/*/package.json` — zero fora de sessoes históricas
  - `rg -l 'Express 4' .specify/memory/ docs/agents/` — zero (todos devem dizer Express 5)
  - **Zero skew final:** `pnpm why react react-dom express zod typescript vite tailwindcss eslint astro` — cada uma com versão ÚNICA no lockfile (nenhuma com 2+ resoluções)
  - **Feito quando:** varredura limpa; `pnpm why` confirma versão única em todas as deps unificadas; só sessoes antigas contêm refs históricas
