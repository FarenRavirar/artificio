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
- **126 async route handlers** no mesas sem captura de erro. Express 5 não captura → processo crasha.
- **Imagens stale na VM:** 5 imagens de 2026-06-04.
- **apt VM:** 5 pacotes upgradable (baixo risco, libs de sistema).

### Fora de escopo (specs próprias futuras)

Tailwind 3→4 (glossario), Vite 5→8 (glossario), ESLint 8→9 (glossario), TypeScript 5→6, Astro 5→6, zod 3→4 (accounts/config).

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

- [ ] T6 — **Backup de código antes de mexer no Node**
  - `git tag pre-033-f2-node` (local)
  - Copiar `pnpm-lock.yaml` → `C:\projetos\artificiobackup\spec-033\pnpm-lock.yaml.pre-033-f2`
  - `pnpm list --depth 0 -r` → `artifacts/033/pre-f2-dep-list.txt`
  - `pnpm outdated -r` → `artifacts/033/pre-f2-outdated.txt`
  - **Feito quando:** arquivos salvos; `git tag -l 'pre-033-f2-*'` lista a tag

### 2.1 — Baseline de testes pré-Node

- [ ] T7 — **Executar baseline completa de builds/tests/lint (Node ATUAL, ANTES de mudar)**
  - `turbo build --force 2>&1 | Tee-Object artifacts/033/pre-f2-build.log` — confirmar 13/13 verde
  - `pnpm lint 2>&1 | Tee-Object artifacts/033/pre-f2-lint.log` — registrar estado atual (com falhas conhecidas)
  - `pnpm --filter @artificio/ui test 2>&1 | Tee-Object artifacts/033/pre-f2-ui-test.log`
  - `pnpm --filter @artificio/glossario-backend test 2>&1 | Tee-Object artifacts/033/pre-f2-glossario-test.log`
  - `pnpm --filter @artificio/mesas-backend test 2>&1 | Tee-Object artifacts/033/pre-f2-mesas-test.log` (se existir)
  - **Feito quando:** todos os logs salvos; número de passes/falhas anotado como baseline

### 2.2 — Alteração

- [ ] T8 — **Alinhar Node.js canônico em todo o projeto**
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

- [ ] T9 — **Verificar pnpm (já alinhado)**
  - pnpm `10.12.1` consistente em package.json + CI + dev local
  - Se houver `10.13.x` disponível: bump com mesmo procedimento de backup

### 2.3 — Testes de impacto pós-Node

- [ ] T10 — **Validar impacto do Node novo — build completo**
  - `turbo build --force 2>&1 | Tee-Object artifacts/033/post-f2-build.log`
  - Comparar com baseline: `diff artifacts/033/pre-f2-build.log artifacts/033/post-f2-build.log`
  - **Critério:** 13/13 apps verdes (mesmo número da baseline); zero regressão
  - **Se falhar:** identificar app/pacote que quebrou; documentar breaking change específico; corrigir ou registrar débito

- [ ] T11 — **Validar impacto — lint e testes**
  - `pnpm lint 2>&1 | Tee-Object artifacts/033/post-f2-lint.log`
  - `pnpm --filter @artificio/ui test` — comparar 8/8 com baseline
  - `pnpm --filter @artificio/glossario-backend test` — comparar 22/22 com baseline
  - `pnpm --filter @artificio/mesas-backend test` — se existir
  - **Critério:** mesmo número de passes que baseline; zero nova falha

- [ ] T12 — **Teste de impacto: smoke local por app**
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

- [ ] T13 — **Backup de código e DB antes de migrar Express**
  - `git tag pre-033-f3-express` (local)
  - Copiar `pnpm-lock.yaml` → `artifacts/033/pnpm-lock.yaml.pre-033-f3`
  - Copiar `apps/mesas/backend/package.json` → `artifacts/033/mesas-backend-package.json.pre-033-f3`
  - **Se beta acessível:** dump DB beta mesas (leitura, sem aprovação): `ssh faren 'docker exec mesas-beta-db pg_dump -U admin mesas_rpg' > artifacts/033/pre-f3-mesas-beta-dump.sql`
  - **Se beta inacessível:** registrar na sessão e prosseguir SEM dump — backup de código (`git tag`) permanece obrigatório de qualquer forma
  - **Feito quando:** git tag + lockfile + package.json salvos; dump existe OU ausência justificada na sessão

### 3.1 — Baseline pré-Express

- [ ] T14 — **Executar baseline do mesas-backend (Express 4 ATUAL)**
  - `pnpm --filter @artificio/mesas-backend exec tsc --noEmit 2>&1 | Tee-Object artifacts/033/pre-f3-mesas-tsc.log`
  - `turbo build --filter=@artificio/mesas-backend --force 2>&1 | Tee-Object artifacts/033/pre-f3-mesas-build.log`
  - `pnpm --filter @artificio/mesas-backend test 2>&1 | Tee-Object artifacts/033/pre-f3-mesas-test.log` (se existirem testes)
  - Contar erros de tipo atuais (pré-Express 5)
  - **Feito quando:** baseline registrada; número de erros TS, warnings, e testes documentado

### 3.2 — Alteração

- [ ] T15 — **Migrar mesas-backend para Express 5**
  - `apps/mesas/backend/package.json`: `express: ^4.19.2` → `^5.2.1`; `@types/express: ^4.17.21` → `^5.0.6`
  - `pnpm install` → lockfile sem express 4
  - **Correções (base T3):**
    - `req.query`: verificar `tsc --noEmit` nos ~40 usos. Ajustar tipos se necessário.
    - `router.get('*', ...)` em `og.ts:201`: **RENAME OBRIGATÓRIO** — `'*'` bare quebra no boot do Express 5 (path-to-regexp v8 não aceita wildcard sem nome). Trocar para `'/*splat'` (wildcard nomeado). Verificar também qualquer `:param(regex)`.
    - `res.send(status, body)`, `app.del()`, `req.hostname`: já confirmado ZERO ocorrências
  - **Async error handling (126 handlers): JÁ COBERTO.** `express-async-errors@^3.1.1` já está instalado em `apps/mesas/backend/package.json` e importado em `src/server.ts:33` (`import 'express-async-errors';`). Apenas VERIFICAR que o import permanece e que o error handler global (4 args) está presente. Não há decisão a tomar (express-async-errors vs asyncHandler) — já materializada no código.
  - **Feito quando:** `tsc --noEmit` verde (0 erros NOVOS); build backend OK

- [ ] T15b — **Unificar Express 5 nos demais (eliminar skew `5.1.0` vs `5.2.1`)**
  - Bump `express` para `^5.2.1` em: `apps/accounts` (`^5.1.0`), `apps/site` (`^5.1.0`), `packages/auth` (`^5.1.0`, dep **e** `peerDependencies`). `glossario-backend` já `^5.2.1` — confirmar.
  - `pnpm install` → lockfile com Express único; `pnpm why express` sem múltiplas versões
  - **Teste:** `turbo build --filter=@artificio/accounts --filter=@artificio/site --filter=@artificio/auth --force`; `tsc --noEmit` nos backends afetados
  - **Feito quando:** `pnpm why express` mostra só `5.2.1`; builds verdes
  - Remover `asExpress4Handler` de `rateLimit.ts` (4 exportações)
  - Remover `@types/multer>@types/express` de `pnpm.overrides` no root
  - Bump `express-rate-limit`: mesas `7.5.1` → `8.5.2`, glossario `^7.5.1` → `^8.5.2`
  - Verificar changelog (T5b): ajustar `message` se string não for mais aceita; `keyGenerator` se assinatura mudou
  - **Feito quando:** `tsc --noEmit` verde em mesas-backend + glossario-backend; override removido

### 3.3 — Testes de impacto pós-Express

- [ ] T17 — **Validar build e tipos do mesas-backend**
  - `pnpm --filter @artificio/mesas-backend exec tsc --noEmit 2>&1 | Tee-Object artifacts/033/post-f3-mesas-tsc.log`
  - Comparar com baseline: `diff artifacts/033/pre-f3-mesas-tsc.log artifacts/033/post-f3-mesas-tsc.log`
  - **Critério:** zero erros NOVOS de tipo (baseline pode ter erros pré-existentes)
  - `turbo build --filter=@artificio/mesas-backend --force` verde

- [ ] T18 — **Teste de unidade: rate-limit com Express 5**
  - Criar/verificar teste que chama `publicRateLimiter`, `authRateLimiter`, `strictRateLimiter`, `globalRateLimiter`
  - Criar/verificar teste que chama rate-limiters do glossario (`submitLimiter`, `verifyLimiter`)
  - Verificar que middleware não crasha com Express 5 + rate-limit 8
  - **Feito quando:** testes de rate-limit passam; sem erro de tipo

- [ ] T19 — **Teste de integração: rotas críticas do mesas com Express 5**
  - Criar/verificar teste de integração para:
    - `GET /api/v1/me/options` → 401 (sem cookie)
    - `GET /api/v1/tables` → 200 (catálogo público)
    - `POST /api/v1/tables/:slug/view` → 200 (contador de view)
    - `GET /api/v1/gm/:slug` → 200 (página pública de mesa)
    - `GET /api/v1/og/:type/:slug` → 200 com wildcard (`*`)
  - **Feito quando:** 5+ rotas testadas; zero crash de async não tratado; HTTP status esperado

- [ ] T20 — **Teste de impacto: build de consumidores do mesas**
  - `turbo build --filter=@artificio/mesas-frontend --force` — frontend não muda mas verificar que builda
  - Verificar que `packages/auth` builda (mesas-backend pode importar de lá)
  - **Feito quando:** builds de frontend + pacotes compartilhados verdes

- [ ] T21 — **Validar mesas beta pós-Express 5**
  - PR → merge em `dev` (aprovação nominal)
  - Deploy mesas beta: `deploy.yml -f module=mesas -f mode=deploy` — ⚠️ **Requer aprovação nominal** (ação distinta do merge; aprovação vale por ação)
  - Smoke beta: `/` 200, `/api/v1/me/options` 401, login SSO + criar mesa + arquivar
  - Healthcheck Docker healthy
  - **Feito quando:** deploy beta verde; smokes OK; zero crash em 5min de operação

---

## Fase 4 — Deps npm (incremental, UMA por vez)

> **Regra desta fase:** cada dep é atualizada isoladamente. Build + teste após CADA bump. Se quebrar, reverter a dep e registrar débito. Não bump em lote.

### 4.0 — Backup pré-deps

- [ ] T22 — **Backup antes de mexer em deps**
  - `git tag pre-033-f4-deps`
  - Copiar `pnpm-lock.yaml` → `artifacts/033/pnpm-lock.yaml.pre-033-f4`

### 4.1 — Limpeza (zumbis, sem risco)

- [ ] T23 — **Remover dependências zumbis**
  - Remover `marked` de `apps/mesas/frontend/package.json`
  - Remover `@types/dompurify` de `apps/mesas/frontend/package.json`
  - `pnpm install`
  - **Teste:** `turbo build --filter=@artificio/mesas-frontend` verde
  - **Feito quando:** `rg 'marked|@types/dompurify' apps/mesas/frontend/package.json` = 0

### 4.2 — Patch bumps (grupo seguro, sem breaking changes)

Cada sub-item abaixo é uma task atômica: bump → `pnpm install` → build do(s) app(s) afetado(s) → próximo.

- [ ] T24a — `@types/react` 19.2.16 → 19.2.17
  - **Impacto:** root + accounts + mesas-frontend (build de types)
  - **Teste:** `turbo build --filter=@artificio/ui --filter=@artificio/accounts --filter=@artificio/mesas-frontend --force`

- [ ] T24b — `dompurify` 3.4.8 → 3.4.11
  - **Impacto:** mesas-frontend (sanitização HTML)
  - **Teste:** build mesas-frontend; smoke de página que renderiza HTML sanitizado (ex.: descrição de mesa)

- [ ] T24c — `sanitize-html` 2.17.4 → 2.17.5
  - **Impacto:** site (importador/servidor)
  - **Teste:** build site; `pnpm --filter @artificio/site test`

- [ ] T24d — `turbo` 2.9.16 → 2.9.18
  - **Impacto:** root (build pipeline)
  - **Teste:** `turbo build --force` 13/13 verde (build completo)

- [ ] T24e — `tailwindcss` 4.3.0 → 4.3.1 + `@tailwindcss/postcss` + `@tailwindcss/vite`
  - **Impacto:** mesas-frontend + site
  - **Teste:** build mesas-frontend + build site; CSS gerado sem diferença visual (comparar tamanho de bundle CSS com baseline)

- [ ] T24f — `typescript-eslint` 8.60.1 → 8.61.1
  - **Impacto:** mesas-frontend + root (lint)
  - **Teste:** `pnpm lint` sem novos erros

- [ ] T24g — `eslint-plugin-react-refresh` unificar 0.4.26/0.5.2 → 0.5.3
  - **Impacto:** glossario-frontend + mesas-frontend (lint)
  - **Teste:** lint de glossario-frontend e mesas-frontend

### 4.3 — Minor bumps (compatível, mas verificar)

- [ ] T25a — `react-router-dom` 7.17.0 → 7.18.0
  - **Impacto:** glossario-frontend + mesas-frontend + site-admin
  - **Teste:** build dos 3; smoke de navegação (rotas funcionam, links não quebram)

- [ ] T25b — `google-auth-library` 10.6.2 → 10.7.0
  - **Impacto:** accounts + mesas-backend (auth Google)
  - **Teste:** build accounts + mesas-backend; smoke login SSO localmente

- [ ] T25c — `kysely` 0.28.9/0.28.15 → 0.29.2
  - **Impacto:** accounts + mesas-backend (query builder)
  - **Teste:** build accounts + mesas-backend; `tsc --noEmit` em ambos; testes se existirem

- [ ] T25d — `multer` 2.1.1 → 2.2.0
  - **Impacto:** mesas-backend + site (upload de arquivo)
  - **Teste:** build mesas-backend + site; teste de upload (se disponível)

- [ ] T25e — `sharp` 0.34.5 → 0.35.1
  - **Impacto:** site (processamento de imagem)
  - **Teste:** build site

- [ ] T25f — `axios` 1.17.0 → 1.18.0
  - **Impacto:** glossario-frontend (chamadas HTTP)
  - **Teste:** build glossario-frontend

- [ ] T25g — `zod` 4.3.6 → 4.4.3 (mesas apenas)
  - **Impacto:** mesas-backend + mesas-frontend (schema validation)
  - **Teste:** build mesas-backend + mesas-frontend; verificar `.parse()` não quebrou

- [ ] T25h — `lucide-react` 1.17.0 → 1.21.0 (mesas-frontend)
  - **Impacto:** mesas-frontend (ícones)
  - **Teste:** build mesas-frontend; verificar imports de ícones não quebraram

- [ ] T25i — **Unificar React em `^19.2.7` (última stable 19.x, segura) — NÃO adiar**
  - **Decisão:** atualizar React, não manter. 19.2.7 é a versão mais recente do 19.x.
  - Bump `react` + `react-dom` para `^19.2.7` em TODOS os manifests (7):
    - `apps/accounts` (`^19.1.0` → `^19.2.7`)
    - `apps/glossario/frontend` (`^19.1.0` → `^19.2.7`)
    - `apps/mesas/frontend` (`^19.2.4` → `^19.2.7`)
    - `apps/site-admin` (já `^19.2.7` — apenas CONFIRMAR; site-admin está fora de escopo para *atualização* (D054, stack isolada), mas é a referência da versão-alvo e não recebe bump aqui)
    - `packages/analytics` (dep + `peerDependencies` `^19.1.0` → `^19.2.7`)
    - `packages/auth` (`peerDependencies` `^19.1.0` → `^19.2.7`)
    - `packages/ui` (`^19.1.0` → `^19.2.7`)
  - `pnpm install` → lockfile com React 19.2.7 único; `pnpm why react` sem múltiplas versões
  - **Correções de código (se houver):** rodar `tsc --noEmit` em cada app React; corrigir qualquer API que mudou no 19.x. Fase 1 reportou "código React limpo (sem APIs depreciadas)" — confirmar pós-bump.
  - **Teste de impacto:** `turbo build` dos apps React (accounts, glossario-frontend, mesas-frontend, site-admin) + `pnpm --filter @artificio/ui test` (8/8); verificar peers de **BlockNote, TanStack Query, React Router** resolvem sem warning
  - **Segurança:** `pnpm audit --prod` sem HIGH/CRITICAL em react/react-dom e ecossistema; registrar resultado
  - **Smoke:** páginas que usam editor (BlockNote em mesas), queries (TanStack), navegação (Router) renderizam sem erro de console
  - **Feito quando:** React 19.2.7 único no lockfile; builds verdes; audit limpo; smoke OK

### 4.4 — Major bumps (com breaking changes)

- [ ] T26a — `express-rate-limit` 7.5.1 → 8.5.2 (mesas + glossario)
  - **Pré-requisito:** T16 concluído (Express 5 + shim removido)
  - **Impacto:** mesas-backend + glossario-backend (4 rate limiters)
  - **Teste específico:** T18 (testes de rate-limit)
  - **Teste:** build mesas-backend + glossario-backend; `tsc --noEmit` ambos

- [ ] T26b — `dotenv` 16.4.5/16.4.7 → 17.4.2
  - **Impacto:** mesas-backend + site (carregamento de .env)
  - **Risco:** `dotenv.config()` pode ter assinatura diferente
  - **Teste específico:** script que carrega `.env` e verifica variáveis acessíveis
  - **Teste:** build mesas-backend + site

### 4.5 — Validação final da Fase 4

- [ ] T27 — **Build completo com todas as deps atualizadas**
  - `turbo build --force` 13/13 → `artifacts/033/post-f4-build.log`
  - Comparar com baseline pré-deps
  - **Critério:** 13/13 verde; zero regressão

- [ ] T28 — **Testes completos com todas as deps atualizadas**
  - Todos os vitest: ui (8/8), glossario-backend (22/22), demais
  - `pnpm lint`
  - **Feito quando:** mesmos números da baseline

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
  - **Feito quando:** todas as imagens base com tag explícita

### 5.2 — Teste de impacto

- [ ] T31 — **Build local das imagens Docker**
  - `docker build -t test-accounts accounts/` — verificar que nova imagem node funciona
  - `docker build -t test-site apps/site/` — verificar node:slim novo
  - **Feito quando:** builds Docker locais OK

- [ ] T32 — **Deploy beta com novas imagens**
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
