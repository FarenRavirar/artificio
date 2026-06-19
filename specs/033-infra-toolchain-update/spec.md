# 033 — Atualização de Toolchain, Runtime e Dependências (D-DEP2 + Express + React)

- **Módulo/Pacote:** infra (VM + CI/CD) + todos os `apps/*` + `packages/*`
- **Gate relacionado:** B (aprovado; guardrail continua) · D (por app, smoke pós-update)
- **Absorve:** D-DEP2 (apt/Node/pnpm/imagens/deps npm), D-DEP1 (Express 5 do mesas), BL-MESAS-EXPRESS5-016
- **SDD:** Completo (infra + runtime + todos os apps + packages compartilhados)
- **Pesquisa:** `sessoes/26-06-12_2_debitos_ux-marca.md:163-170` · `specs/backlog.md:46` · `specs/026-infra-workflows-audit/tasks.md:88-91`

## Problema

O toolchain do projeto está com divergências críticas e pacotes desatualizados que acumulam risco operacional:

1. **Node.js divergente (3 versões):** CI roda Node `20` (`setup-node@v4`), containers usam `25.9.0` (site/glossario/mesas) exceto `accounts` que usa `20`. Build no CI (Node 20) ≠ runtime (Node 25). Não há `.nvmrc`/`.node-version`/campo `engines` no `package.json`.

2. **Express 4 vs 5 misturado + skew no próprio 5:** `mesas` é o único app ainda em Express 4 (`^4.19.2`); os demais já estão em Express 5 mas divergem entre si — `accounts`, `site` e `packages/auth` em `^5.1.0`, `glossario` em `^5.2.1`. O override `@types/multer>@types/express` no root `package.json` é gambiarra que existe só por causa do mesas (E004).

3. **Deps npm:** sem auditoria formal; imagens base Docker com tags desatualizadas; imagens stale de 2026-06-04 na VM ocupando disco.

4. **VM:** Ubuntu 24.04.4 com 5 pacotes apt upgradable; sem Node/pnpm no host (só dentro de containers — OK pelo modelo atual, mas precisa documentar).

5. **Código depreciado:** APIs que mudaram entre Node 20→25, Express 4→5 e React 19.x→19.y precisam ser identificadas e corrigidas.

6. **React desalinhado (3 versões):** `^19.1.0` (accounts, glossario-frontend, `packages/{analytics,auth,ui}`), `^19.2.4` (mesas-frontend), `^19.2.7` (site-admin). Skew de patch/minor a unificar.

7. **Toolchain de build com skew de major:** zod `3.25.57`/`4.3.6`; TypeScript `5.4.5`/`5.8.3`/`5.9.3`; Vite `5.2.0`/`6.3.5`/`8.x`; Tailwind `3.4.3`/`4.2.2`; ESLint `8.57`/`9.x`; Astro `5.5.0`. `glossario-frontend` é o lanterna (Vite 5 + Tailwind 3 + ESLint 8 legado `.eslintrc`). Decisão: unificar tudo numa versão única por dep AGORA (R4B), não adiar.

## Requisitos

### R1 — Alinhar Node.js a uma única major em todo o projeto
- **Versão alvo = Node 24 LTS** (Active LTS desde out/2025, EOL abr/2028). Node 25 descartado (ímpar/Current, EOL ~jun/2026, não-LTS); Node 22 LTS (EOL abr/2027) é fallback conservador.
- Atualizar: CI (`setup-node` em `ci.yml` e `_deploy-module.yml`), Dockerfiles (6 arquivos), e documentar
- Adicionar `.nvmrc` e campo `engines.node` no `package.json` raiz
- Verificar compatibilidade de TODAS as libs com a versão escolhida

### R2 — Alinhar Express 5 em todo o monorepo (versão única `^5.2.1`)
- Migrar `apps/mesas/backend` de Express `^4.19.2` → `^5.2.1`
- Unificar os já-em-5: `accounts`, `site`, `packages/auth` de `^5.1.0` → `^5.2.1` (glossario já está em `^5.2.1`)
- Lockfile com Express único (`pnpm why express` sem skew)
- Remover o override `@types/multer>@types/express` do `package.json` raiz
- Resolver breaking changes: tipagem de `Request`/`Response`, middleware error handler, `req.query`, rotas com regex
- Smoke de todas as rotas autenticadas do mesas pós-migração

### R3 — Atualizar React e deps do ecossistema
- **Decisão: unificar React em `^19.2.7`** (última stable 19.x, segura). Hoje há skew: `^19.1.0` (accounts, glossario-frontend, analytics, auth, ui), `^19.2.4` (mesas-frontend), `^19.2.7` (site-admin).
- Atualização feita JÁ na Fase 4 (T25i), não adiada. Corrigir código que mudou no 19.x + teste de segurança no mesmo passo.
- Identificar breaking changes entre versões (ex.: forwardRef, context, hooks behavior)
- Bump para a última 19.x, não `latest`/major cego
- Verificar compatibilidade com React Router, TanStack Query, BlockNote, e demais deps do ecossistema React

### R4 — Atualizar deps npm com auditoria
- Rodar `pnpm audit` em todos os apps e packages
- Corrigir vulnerabilidades (se houver)
- Bump deps com breaking changes uma por vez, com build/smoke por app

### R4B — Unificar TODOS os majors do toolchain (versão ÚNICA por dep) — SEM adiamento
- **Princípio:** zero skew. Cada dep numa única versão em todo o monorepo, na última stable que cobre nosso uso. Nada de "cada app numa versão". Feito AGORA (Fase 4B), não vira débito.
- Versões-alvo únicas (peers validados): **zod `^4.4.3`**, **TypeScript `6.0.3`**, **Vite `8.0.16`**, **Tailwind `4.3.1`**, **ESLint `10.5.0`** (+ typescript-eslint `8.61.1`), **Astro `6.4.8`** (site).
- Cada major migrado com ciclo completo: **backup (git tag próprio) → investigação (changelog/arquivos impactados) → migração (config+código) → teste (build/lint/smoke/bundle) → doc (`breaking-changes.md`)**.
- `glossario-frontend` é o lanterna: Vite 5→8 + Tailwind 3→4 (CSS-first) + ESLint 8→flat 10 numa migração combinada.
- Peers confirmados: `typescript-eslint@8.61.1` aceita ESLint ^10 e TS <6.1.0; `eslint-plugin-react-hooks` aceita ESLint 10; Astro 6 exige Node ≥22.12 (Node 24 OK).

### R5 — Atualizar imagens base Docker
- Alinhar `FROM node:X` em todos os Dockerfiles à versão definida em R1
- Atualizar `postgres:16-alpine` para a imagem mais recente (sem bump de major — 16→17 é migração de dados, fora de escopo)
- Atualizar `nginx:alpine` nos frontends (glossario, mesas)
- Atualizar `cloudflare/cloudflared:latest`
- Atualizar `curlimages/curl` (duas versões 8.8.0 e 8.11.1 presentes)

### R6 — Atualizar pacotes apt da VM
- `apt update && apt upgrade` em janela controlada com backup
- Verificar impacto em Docker, rede, e serviços em execução
- Rollback documentado

### R7 — Identificar e corrigir código depreciado
- APIs Node.js removidas/depreciadas entre 20→25
- APIs Express removidas/depreciadas entre 4→5 (ex.: `req.query`, `res.send(status, body)`, `app.del()`)
- APIs React depreciadas (ex.: `defaultProps` em function components, `forwardRef` sem ref, etc.)
- Varredura por padrões conhecidos com grep/ast

### R8 — Documentar o toolchain canônico
- Versão de Node, pnpm, e ferramentas no `README.md` ou `CONTEXT.md`
- Campo `engines` no `package.json`
- `.nvmrc` na raiz

## Critérios de aceite

- [ ] `node --version` retorna a mesma major em CI, Dockerfiles, e dev local
- [ ] `pnpm --version` = `10.12.1` (ou versão atualizada decidida) em todos os ambientes
- [ ] Campo `engines.node` presente no `package.json` raiz com a versão canônica
- [ ] `.nvmrc` presente na raiz
- [ ] Todos os apps em Express 5 unificados em `^5.2.1`; zero `express@4` no lockfile; `pnpm why express` sem skew
- [ ] Override `@types/multer>@types/express` removido; build TS verde em todo o monorepo
- [ ] `pnpm audit` sem vulnerabilidades HIGH/CRITICAL (ou com justificativa documentada)
- [ ] `turbo build` verde em todos os apps
- [ ] `pnpm lint` verde (ou sem regressão sobre estado atual)
- [ ] Deploy beta verde de todos os apps (accounts, mesas, glossario, site)
- [ ] Smoke prod verde de todos os apps
- [ ] Imagens Docker stale removidas da VM
- [ ] `apt upgrade` executado na VM; rollback documentado
- [ ] Zero código depreciado conhecido sem item de backlog registrado
- [ ] React unificado em `^19.2.7` em todos os manifests (7); lockfile com versão única (`pnpm why react` sem skew); audit limpo; smoke BlockNote/TanStack/Router OK
- [ ] **Zero skew de toolchain:** `pnpm why <dep>` retorna versão única para zod (`4.4.3`), TypeScript (`6.0.3`), Vite (`8.0.16`), Tailwind (`4.3.1`), ESLint (`10.5.0`), Astro (`6.4.8` no site)
- [ ] glossario-frontend migrado: Vite 8 + Tailwind 4 (CSS-first) + ESLint 10 flat; build/lint verdes; estilos íntegros
- [ ] D054 revisitada após Astro 6

## Fora de escopo

- Bump de major do Postgres (16→17 exige dump/restore com plano de migração separado)
- Mudança de runtime (ex.: trocar Node por Bun/Deno)
- Alteração de stack canônica (React 19/Express 5/Postgres 16)
- Instalar Node/pnpm no host da VM (modelo atual sem runtime de host é OK)
- Alterar WAF/DNS/Tunnel Cloudflare
- Gate C (cutover DNS raiz)

> **Nota:** Tailwind 4, Vite 8, ESLint 10, TypeScript 6, Astro 6 e zod 4 **NÃO estão mais fora de escopo** — foram trazidos para dentro (R4B / Fase 4B) por decisão de unificar agora. `site-admin` já está na stack-alvo (React 19.2.7 / Vite 8) → apenas confirmação, sem bump. Astro 6 obriga **revisitar D054**.

## Riscos e impacto em outros módulos

| Risco | Severidade | Mitigação |
|---|---|---|
| Node major quebrar lib incompatível | ALTO | Testar build+smoke por app em beta antes de prod |
| Express 5 quebrar rotas/middleware do mesas | ALTO | Spec 016 já mapeou breaking changes; rodar E2E de rotas críticas autenticadas |
| `pnpm audit` introduzir breaking change em cascata | MÉDIO | Bump incremental, um pacote por vez, com build/smoke |
| React update quebrar BlockNote/TanStack | MÉDIO | Verificar peer dependencies e changelogs antes do bump |
| Tailwind 3→4 (CSS-first) quebrar estilos do glossario | ALTO | `@tailwindcss/upgrade` + revisão de diff + smoke visual público/admin; backup de config; git tag próprio |
| Vite 5→8 quebrar build/plugins | MÉDIO | Migração por app, plugin-react compatível, diff de bundle vs baseline |
| ESLint 8→flat 10 (glossario) | MÉDIO | Espelhar flat config de mesas/config; typescript-eslint 8.61.1 confirma compat |
| TypeScript 5→6 checagem mais estrita | MÉDIO | `tsc --noEmit` por pacote; corrigir/registrar erro a erro; peer TS-eslint <6.1.0 |
| Astro 5→6 quebrar build do site | MÉDIO | Migração isolada; D054 revisitada; verificar dist/blog/sitemap |
| zod 3→4 mudar API de validação | MÉDIO | Mapear usos (`rg`); ajustar `z.email()` etc.; teste de schema |
| `apt upgrade` reiniciar Docker/serviços | MÉDIO | Janela de manutenção + pg_dump ALL + novo snapshot Oracle (aprovação nominal própria) + rollback documentado |
| Quebrar auth/SSO (`packages/auth` compartilhado) | ALTO | Auth é sagrado — smoke de login/me/logout em todos os consumidores |
| Deploy beta contaminar prod | BAIXO | Beta isolado por DB/env; gate `main ⊆ dev` no promote |

**Matriz mínima de smoke (pós-update):**
- `accounts`: `/health` 200, `/login` 200, `/api/auth/me` 401 (sem cookie), login real + cookie + `/api/auth/me` 200 + `/api/auth/logout`
- `glossario`: `/` 200, `/api/terms` 200, login SSO + sessão + perfil
- `mesas`: `/` 200, `/api/v1/me/options` 401 (sem cookie), login SSO + `/painel` 200 + criar mesa + arquivar
- `site`: raiz 200, `/blog/<slug>` 200, `/healthz` 200, `/sitemap-index.xml` 200, rebuild admin
