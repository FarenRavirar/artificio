# Estado do Projeto — Artifício RPG

> Atualizar a cada mudança de estado operacional. Fonte de verdade do "onde estamos".
> Histórico detalhado em `sessoes/` e `specs/`. Este arquivo é **sumário operacional**, não diário.

## Fase atual

**Fase 3 — projetos + conteúdo.** Gates A/B ✅; mesas, glossario e site com Gate D fechado. Site em `artificiorpg.com` (Astro SSG, spec 029/030/031). `beta.artificiorpg.com` = staging. WP desligado da raiz; DNS raiz intocado (Gate C adiado). Migração WP→site concluída (D074, residual zero).

**🚨 `mesas-beta` FORA DO AR** desde 2026-06-20 ~21:00. O merge da PR #75 em `dev` (commit `f319aac`) introduziu `@artificio/media` (spec 036) como dependência do mesas-backend. O auto-deploy disparado pelo push falhou: `mesas-beta-api` não sobe (`ERR_MODULE_NOT_FOUND cloudinary`). `mesas-beta-app` (frontend) healthy. Causa: `packages/media/dist/index.js` compilado como CJS (`require("cloudinary")`) quebrou no Node 24 via ESM wrapper.

**PR #76** (`fix/037-cloudinary-media-esm` → `dev`) contém a correção: `"type": "module"` + fail-fast nos 3 Dockerfiles + `auto_deploy_on_push: false`. **24/24 checks verdes**, pronta para merge. Após merge, `dev` terá o fix mas NÃO disparará deploy automático (manifesto agora tem `auto_deploy_on_push: false`). Será necessário **dispatch manual** `deploy.yml module=mesas mode=deploy` para subir o beta.

**Demais módulos:** glossario, site, accounts e links NÃO usam `@artificio/media` (exceto site, que tem install completo sem `--prod`). Seus betas não foram afetados. `apps/links` app completo em `dev` (spec 013, PR #74), bloqueado para deploy por `BL-CF-TUNNEL-TOKEN-SCOPE` (token CF sem permissão Tunnel).

**Stack:** Node 24, pnpm 11.8, TS 6, React 19.2, Express 5.2, Kysely 0.29.2, Tailwind 4.3, Astro 6.4. **PRs abertas:** #76 (fix cloudinary) e #73 (dependabot). **PRs #74 e #75** mergeadas. **Spec 037** lint 13/13 verde, CSRF central no `@artificio/auth`, CodeQL/CodeRabbit fixes — tudo em `dev`.

## Gates

| Gate | Status | Notas |
|------|--------|-------|
| **A** | ✅ | Backups completos/verificados/off-VM |
| **B** | ✅ | SSO `accounts.` no ar, cross-subdomínio provado |
| **C** | ⏸️ | Cutover DNS raiz — adiado (D016). Site já serve em `artificiorpg.com` por redirect Cloudflare, não pelo cutover cerimonial |
| **D** | ✅ | `mesas` (2026-06-08), `glossario` (2026-06-12), `site` (2026-06-18 via spec 029/030/031) |
| **D-link** | 🔴 | `apps/links` código pronto, bloqueado por tunnel/secrets mantenedor |

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

- 2026-06-20 — **PR #76 aberta** (`fix/037-cloudinary-media-esm` → `dev`). Corrige `ERR_MODULE_NOT_FOUND cloudinary` no deploy mesas-beta: `@artificio/media` compila ESM (`"type":"module"`) + fail-fast nos 3 Dockerfiles (`test -d packages/media/node_modules/cloudinary`) + `auto_deploy_on_push: false` no mesas. PRs #74 e #75 mergeadas em `dev`. Spec 037 lint 13/13, CSRF central no `@artificio/auth` (CodeQL ok), CodeRabbit fixes. Spec 036 (`@artificio/media`) commitada.
- 2026-06-20 — **`apps/links` app completo em `dev`** (spec 013, PR #74). Astro+Express+Kysely+Cloudinary+SSO, 15 páginas. Bloqueado: tunnel `links.` (token CF sem escopo, 403) + secrets/env VM.
- 2026-06-19 — **Spec 033 toolchain update concluída** (PRs #63-#72). Node 24, pnpm 11.8, Express 5.2, Kysely 0.29.2, TS 6, Vite 8, Tailwind 4.3, Astro 6.4. CSP Astro 6 via `<meta>`. GitHub Actions endurecido (pnpm 11 `allowBuilds`, `persist-credentials: false`). Dockerfiles rootless.
- 2026-06-18 — **Site prod próprio** (spec 030/031). `site-prod-app` healthy, seed 125p/10p/82t/444m/25c, raiz `artificiorpg.com` → prod. Beta isolado com noindex. Sync prod→beta = truncate + restore manual idempotente.
- 2026-06-17 — **Cutover beta→raiz** (spec 029, D075). `artificiorpg.com` serve site novo. WP desligado da raiz. `beta.artificiorpg.com` = staging. `SITE_IMPORT_ON_START=false`. **Migração WP→site concluída** (D074): 332 mídias migradas, 9 falhas, residual servido zero.
