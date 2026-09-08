# Plano — 033

## Arquitetura da solução

### Fatias (ordem de execução)

Cada fase segue o ciclo: **backup → baseline de testes → alteração → testes de impacto → validação**.

```
Fase 1: Pesquisa e decisão (read-only, executada 2026-06-18)
   T1-T4: Inventário completo de versões, breaking changes, código depreciado ✅
   T5: Decidir versão alvo de Node
   T5b: Ler changelogs de deps com major bump

Fase 2: Toolchain base (Node + pnpm + CI)
   BACKUP: git tag + lockfile snapshot
   BASELINE: build 13/13, lint, testes (pré-Node novo)
   ALTERAÇÃO: alinhar Node em CI/Dockerfiles/.nvmrc/engines/@types/node
   TESTES: build completo, lint, testes, smoke local por app (7 artefatos)
   CRITÉRIO: 13/13 verde, zero regressão sobre baseline

Fase 3: Express 5 (mesas)
   BACKUP: git tag + lockfile + dump DB beta mesas
   BASELINE: tsc --noEmit, build, testes (Express 4 atual)
   ALTERAÇÃO: mesas Express 4.19.2→5.2.1 + unificar accounts/site/auth 5.1.0→5.2.1, remover shim+override, bump rate-limit
   TESTES: tsc, build, teste de rate-limit, teste de integração (5+ rotas), build consumidores
   VALIDAÇÃO: deploy beta + smoke autenticado + zero crash

Fase 4: Deps npm (incremental, UMA por vez)
   BACKUP: git tag + lockfile
   ALTERAÇÃO: remover zumbis → patch bumps (8) → minor bumps (8) → major bumps (2)
   TESTE POR DEP: build do(s) app(s) afetado(s) após cada bump
   VALIDAÇÃO FINAL: build 13/13 + testes completos

Fase 4B: Unificação de majors do toolchain (versão ÚNICA por dep)
   POR MAJOR (zod, TS, Vite, Tailwind, ESLint, Astro): backup (git tag próprio) → investigação (breaking-changes.md) → migração (config+código) → teste (build/lint/smoke/bundle) → doc
   ORDEM: zod → TS → Vite → Tailwind(v4 apps) → glossario combinado (Vite5→8 + TW3→4 + ESLint8→10) → ESLint restante → Astro
   ALVO ÚNICO: zod 4.4.3, TS 6.0.3, Vite 8.0.16, Tailwind 4.3.1, ESLint 10.5.0, Astro 6.4.8
   VALIDAÇÃO FINAL: build 13/13 + audit + `pnpm why` sem skew em nenhuma dep

Fase 5: Docker e infra
   BACKUP: git tag + snapshot docker images/ps na VM
   ALTERAÇÃO: atualizar imagens base (node, postgres, nginx, cloudflared, curl)
   TESTES: build Docker local + deploy beta (4 apps) + smoke
   LIMPEZA: remover 5 imagens stale (aprovação nominal)

Fase 6: VM (apt)
   BACKUP: pg_dump ALL (leitura) + NOVO snapshot de volume Oracle (procedimento análogo ao Gate A; Gate A original já aprovado/executado 2026-06-04 — este é snapshot novo, aprovação nominal própria)
   ALTERAÇÃO: apt update && upgrade (5 pacotes, baixo risco)
   TESTES: docker ps healthy + smoke HTTP 5 hostnames

Fase 7: Fechamento
   DEPLOY PROD: promote dev→main + deploy 4 apps (aprovação nominal)
   SMOKE PROD: matriz completa + SSO cross-subdomínio + SEO
   DOCS: backlog, decisions, project-state, infra-map, context-capsule
```

### Estratégia de backup por fase

| Fase | Backup de código | Backup de runtime | Restauravel via |
|---|---|---|---|
| 2 (Node) | `git tag pre-033-f2-node` + lockfile em `artifacts/033/` | — | `git reset --hard <tag>` |
| 3 (Express) | `git tag pre-033-f3-express` + lockfile + package.json | dump DB beta mesas | `git reset` + restore dump |
| 4 (deps) | `git tag pre-033-f4-deps` + lockfile | — | `git reset` + lockfile original |
| 4B (majors) | **um `git tag pre-033-f4b-<dep>` por major** + lockfile por etapa + cópia de configs migrados (tailwind/postcss/eslint/astro) | — | `git reset <tag do major>` + lockfile da etapa |
| 5 (Docker) | `git tag pre-033-f5-docker` | snapshot `docker images`/`ps` | rebuild com imagens antigas |
| 6 (apt) | código não muda | **pg_dump ALL** (leitura) + **novo snapshot Oracle** (análogo ao Gate A; aprovação nominal própria) | restore snapshot Oracle (recriação = aprovação separada) |
| 7 (prod) | `git tag pre-033-f7-prod` | dump DBs prod + backup off-VM | restore dump + `git reset` |

### Estratégia de teste por atualização

Cada alteração é testada **isoladamente** antes de avançar:

1. **Baseline antes:** capturar estado atual (builds, lint, testes, erros TS)
2. **Alteração atômica:** uma dep/ferramenta por vez
3. **Teste de impacto imediato:** build + testes do(s) app(s) afetado(s)
4. **Comparação com baseline:** zero regressão (mesmo número de passes)
5. **Se falhar:** reverter a dep + registrar débito + avançar para a próxima

### Estratégia de rollback por fatia
- **Node/pnpm/CI:** reverter commit + re-deploy beta
- **Express 5:** manter snapshot DB antes da migration (se houver); reverter código + deploy
- **Deps npm:** `pnpm-lock.yaml` versionado → reverter arquivo único
- **Imagens Docker:** imagens antigas ficam na VM até `prune` explícito
- **apt upgrade:** snapshot VM + restore se necessário (Oracle backup de volume)

## Arquivos afetados

### CI/CD
- `.github/workflows/ci.yml` — `setup-node` node-version
- `.github/workflows/_deploy-module.yml` — `setup-node` node-version, `corepack prepare pnpm`

### Dockerfiles (6)
- `apps/accounts/Dockerfile` — `FROM node:20-alpine` → `node:24-alpine`
- `apps/site/Dockerfile` — `FROM node:25.9.0-slim` → `node:24-slim`
- `apps/glossario/backend/Dockerfile` — `FROM node:25.9.0-alpine` → `node:24-alpine`
- `apps/glossario/frontend/Dockerfile` — `FROM node:25.9.0-alpine` → `node:24-alpine`
- `apps/mesas/backend/Dockerfile` — `FROM node:25.9.0-alpine` → `node:24-alpine`
- `apps/mesas/frontend/Dockerfile` — `FROM node:25.9.0-alpine` → `node:24-alpine`

### Docker compose (8)
- Todos os `docker-compose.*.yml` — `image: postgres:16-alpine` (SHA digest se disponível)
- Frontends — `image: nginx:alpine`

### Raiz do monorepo
- `package.json` — `engines.node`, `packageManager.pnpm`
- `.nvmrc` (novo)
- `pnpm-lock.yaml` — atualizado por bumps

### Express 5 (unificação `^5.2.1`)
- `apps/mesas/backend/package.json` — `express ^4.19.2 → ^5.2.1`, `@types/express`
- `apps/accounts/package.json` — `express ^5.1.0 → ^5.2.1`
- `apps/site/package.json` — `express ^5.1.0 → ^5.2.1`
- `packages/auth/package.json` — `express ^5.1.0 → ^5.2.1` (dep + peer)
- `apps/glossario/backend/package.json` — já `^5.2.1` (confirmar)
- `apps/mesas/backend/src/` — breaking changes:
  - `req.query` (Express 5 usa `req.query` como `ParsedQs` via `qs`; tipagem mudou)
  - `res.send(status, body)` → `res.status(status).send(body)`
  - `app.del()` → `app.delete()`
  - Error handler middleware (4 args obrigatórios; Express 5 não captura erro de async automaticamente)
  - Route parameter regex syntax
  - `req.hostname` → `req.host`

### apps/mesas/frontend (React, se houver bump)
- `apps/mesas/frontend/package.json` — `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`

### packages/* (React, se houver bump)
- `packages/ui/package.json` — `react`, `react-dom`
- `packages/auth/package.json` — (se usa React, verificar)
- `packages/analytics/package.json` — (se usa React, verificar)

### Root package.json
- Remover `pnpm.overrides` `"@types/multer>@types/express"` (pós-Express 5)

### Majors do toolchain (Fase 4B — versão única por dep)
- **zod `^4.4.3`:** `packages/config`, `apps/accounts`, `apps/mesas/backend`, `apps/mesas/frontend`
- **TypeScript `6.0.3`:** todos os manifests (root + apps + packages) + revisão de `tsconfig*.json`
- **Vite `8.0.16`:** `apps/accounts`, `packages/ui`, `apps/mesas/frontend`, `apps/site-admin` (+ `@vitejs/plugin-react`)
- **Tailwind `4.3.1`:** `apps/mesas/frontend`, `apps/site` (já v4); `apps/glossario/frontend` (3→4, CSS-first: `tailwind.config.ts`+`postcss.config.js` → `@theme`/`@tailwindcss/postcss`)
- **ESLint `10.5.0`:** root, `apps/mesas/frontend`; `apps/glossario/frontend` (8 legado→flat); `typescript-eslint@8.61.1` em todos
- **Astro `6.4.8`:** `apps/site` (`astro.config.*` + `@astrojs/*`) → **revisitar D054**

## Contratos/interfaces tocados

- **`packages/auth`**: intocado em runtime; só verificar compatibilidade de build com Node novo
- **SSO**: intocado; smoke de login/me/logout garante
- **Auth middleware**: Express 5 pode mudar assinatura; testar em todos os consumidores
- **Subdomínio/DNS/Tunnel**: intocado
- **Schema/DB**: intocado (só Express 5 pode exigir migration nova se mudar comportamento de rota)
- **`packages/ui`**: intocado; só verificar build com React/Node novos

## Impacto em consumidores

| Consumidor | Impacto | Mitigação |
|---|---|---|
| `accounts` | Node novo no Dockerfile | Build + smoke SSO |
| `glossario` | Node novo nos Dockerfiles + deps npm | Build + smoke público + admin |
| `mesas` | Express 5 + Node novo + deps npm | Build + smoke autenticado |
| `site` | Node novo + deps npm | Build + smoke público + admin |
| `site-admin` | React bump se aplicável | Build isolado (D054) |

## Validação

### Por fatia (mínimo)
1. **Toolchain base:** `node --version` idêntico em CI/Dockerfiles/local; `turbo build` 13/13 verde
2. **Express 5:** `grep -r 'express.*4\.' apps/mesas/backend/package.json` = 0; `turbo build --filter=@artificio/mesas-backend` verde; smoke beta mesas: `/` 200, `/api/v1/me/options` 401, login+criar mesa+arquivar
3. **React/deps:** `turbo build` 13/13 verde; `pnpm audit` sem HIGH/CRITICAL; smoke beta todos os apps
4. **Docker:** `docker images` na VM sem tags stale; `docker system df` sem reclaimable anormal
5. **apt:** `apt list --upgradable` ≈ 0; serviços healthy (`docker ps` todos healthy)
6. **Final:** smoke prod completo; matriz de login SSO cross-subdomínio verde

### Ferramentas de verificação
- `pnpm list --depth 0 -r` — versões exatas instaladas
- `pnpm audit` — vulnerabilidades
- `grep -r '<padrão depreciado>' apps/ packages/` — código depreciado
- `git diff --stat` — arquivos alterados
- `ssh faren 'docker ps --format "table {{.Names}}\t{{.Status}}"'` — containers healthy
- `ssh faren 'apt list --upgradable'` — pacotes pendentes
