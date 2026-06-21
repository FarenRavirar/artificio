# Estado do Projeto — Artifício RPG

> Atualizar a cada mudança de estado operacional. Fonte de verdade do "onde estamos".
> Histórico detalhado em `sessoes/` e `specs/`. Este arquivo é **sumário operacional**, não diário.

## Fase atual

**Fase 3 — projetos + conteúdo.** Gates A/B ✅; mesas, glossario e site com Gate D fechado. Site em `artificiorpg.com` (Astro SSG, spec 029/030/031). `beta.artificiorpg.com` = staging. WP desligado da raiz; DNS raiz intocado (Gate C adiado). Migração WP→site concluída (D074, residual zero).

**✅ `mesas-beta` NO AR** (2026-06-21 ~02:00). PR #77 mergeada → deploy `27890193745` verde. Containers healthy. Smoke: home 200, me_no_cookie 401, auth_redirect 302. Correção em duas camadas: `"type": "module"` (ESM, PR #76) + `pnpm install --prod --filter @artificio/media` explícito (pnpm bug, PR #77). Fail-fast validado no deploy #1 (`27889891144`) — provou o diagnóstico e protegeu o runtime.

**PRs abertas:** #73 dependabot. PRs #74, #75, #76, #77 mergeadas. `auto_deploy_on_push: false` em efeito. Betas glossario/site/accounts ✅ (runs `27889891463`/`27889891603`/`27889892103`).

## Gates

| Gate | Status | Notas |
|------|--------|-------|
| **A** | ✅ | Backups completos/verificados/off-VM |
| **B** | ✅ | SSO `accounts.` no ar, cross-subdomínio provado |
| **C** | ⏸️ | Cutover DNS raiz — adiado (D016). Site já serve em `artificiorpg.com` por redirect Cloudflare, não pelo cutover cerimonial |
| **D** | ✅ | `mesas` (2026-06-08), `glossario` (2026-06-12), `site` (2026-06-18 via spec 029/030/031) |
| **D-link** | 🟡 | `links.artificiorpg.com` **no ar** (2026-06-21, smoke 200/200/200/401); Tunnel+DNS ok. Falta: spec 038 (mídia/reportar/cron) + propagar nav cross-app |

## Decisões fechadas (resumo)

- Monorepo único `artificio` (pnpm + Turborepo)
- **Topologia subdomínio-por-projeto** (D017/D057): `glossario.`, `mesas.`, `downloads.`, `esferas.`, `srd.`, `links.`, `accounts.` (SSO). `artificiorpg.com` = site/blog raiz; `beta.artificiorpg.com` = staging.
- **SSO central `accounts.artificiorpg.com`** (D018): OAuth Google, cookie JWT `Domain=.artificiorpg.com`
- **Blog na raiz** = aposta SEO (D019). Search Console Domain property + GA4 cross-subdomínio (D020). GA4 canônico = `G-8XN5BGPJP3`
- **Stack canônica:** React19/Vite/Tailwind + Express5/Kysely/PG16/Cloudinary + Astro 6 (site)
- **Infra:** Oracle 24GB/200GB, Docker, Cloudflare Tunnel, GHCR, Watchtower(beta)
- **Backup:** `C:\projetos\artificiobackup` (local, 300GB)
- **Acesso VM:** `ssh faren`, read-only sempre permitido, write exige aprovação nominal
- **Tema lua/sol** compartilhado cross-subdomínio (D067): cookie `artificio_theme`, opt-in explícito
- **Laranja canônico** `#FF5722` (D064), navy `#020740` (D040)
- **Linguagem pública:** "projetos" (D063); "módulo" = termo técnico interno
- **Comunicação agentes:** caveman ultra (D068)
- **Branch protection** `dev` (D073): tudo via PR, check `lint + build + test` obrigatório
- **WP EOL resolvido** (D074): migração concluída, residual zero de conteúdo servido com URL WP

## Construído neste monorepo

**Pacotes compartilhados:** `config`, `auth`, `ui`, `content`, `analytics`, `media`

**Apps:** `accounts` (SSO), `mesas` (anúncios de mesa), `glossario` (termos RPG), `site` + `site-admin` (blog/portal), `links` (WhatsApp, em `dev`)

**Infra/CI:** `deploy.yml` (manifesto declarativo, 5 módulos), `_deploy-module.yml`, `ci.yml` (lint+build+test gate), `deploy-manifest.json`, `docker-cleanup.yml`, `mesas-auto-archive.yml`, CodeQL, Scorecard, lock RW VM-wide

**Governança:** `AGENTS.md`, `.specify/memory/`, `.specify/arquiteture.md`, `docs/agents/`, `sessoes/`, `specs/`

## Próximo passo (ordem)

1. **Merge PR #76** → `dev` (fix cloudinary — desbloqueia mesas-beta)
2. **Deploy beta mesas** (dispatch manual — `auto_deploy_on_push: false` já aplicado) → validar fix
3. **Deploy beta glossario/site/accounts** (dispatch manual; glossario/accounts não afetados pelo cloudinary, site ganha fail-fast)
4. **Merge PR #73** (dependabot) → `dev`
5. **Promote `dev→main`** (41 commits: PRs #63-#72 spec 033 toolchain, #73 dependabot, #74 links+CSRF+lint+media, #75 csrf fix, #76 cloudinary fix)
6. **Deploy prod** mesas/glossario/site/accounts
7. **Deploy links** — depende de `BL-CF-TUNNEL-TOKEN-SCOPE` (mantenedor: adicionar permissões Tunnel no token CF) + secrets/env VM
8. **Spec 032** (analytics shared adoption — convergir para GA4 `G-8XN5BGPJP3`)
9. **Spec 025** (Lighthouse residual — mesas perf, headers, a11y, terceiros)
10. **Spec 028** (biblioteca de mídia VM + re-host dos 6 PDFs resgatados)

## Log

- 2026-06-21 — **links.artificiorpg.com NO AR ✅** (smoke VM 200/200/200/401). Resolvido após 3 falhas: (1/2) `.env` corrompido (`\n` literal do PowerShell em `ssh "...$(grep)..."`); (3) senha presa em volume Postgres (`pg_authid` só grava na 1ª init → `28P01`), diagnóstico enganado por `pg_hba` localhost=`trust` → **E009**. Fix: drop volume `links_pgdata_links_prod` (DB vazio) + redeploy (`27891323485`). Roteamento: mantenedor criou public hostname Tunnel (`links-app:4324`) + CNAME proxied; A record cru removido. Prevenção E009 em 4 camadas (errors/runbook/capsule/backlog). **Spec 038 criada** (mídia Cloudinary/reportar/cron) + 2 bugs (nav cross-app, grupos sem logo).
- 2026-06-21 — **Deploy prod ✅** (mesas/glossario/site/accounts).
- 2026-06-21 — **PR #77 aberta** — deploy #1 (`27889891144`) falhou: fail-fast acionou, provou que `pnpm --prod` não instala deps de workspace packages. Rollback preservou containers.
- 2026-06-20 — **PR #76 aberta** (`fix/037-cloudinary-media-esm`). Corrige `ERR_MODULE_NOT_FOUND cloudinary`: `@artificio/media` ESM + fail-fast Dockerfiles + `auto_deploy_on_push: false`. PRs #74 e #75 mergeadas. Spec 037 lint 13/13, CSRF central no `@artificio/auth`.
- 2026-06-20 — **`apps/links` app completo em `dev`** (spec 013, PR #74). Bloqueado: `BL-CF-TUNNEL-TOKEN-SCOPE` (token CF sem permissão Tunnel) + secrets/env VM.
- 2026-06-19 — **Spec 033 toolchain update** (PRs #63-#72). Node 24, pnpm 11.8, Express 5.2, Kysely 0.29.2, TS 6, Vite 8, Tailwind 4.3, Astro 6.4. CSP via meta tag. Dockerfiles rootless.
- 2026-06-18 — **Site prod próprio** (spec 030/031). `site-prod-app` healthy, raiz `artificiorpg.com` → prod. Beta com noindex.
- 2026-06-17 — **Cutover beta→raiz** (spec 029, D075). WP desligado. Migração WP concluída (D074, residual zero).
