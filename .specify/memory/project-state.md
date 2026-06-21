# Estado do Projeto — Artifício RPG

> Atualizar a cada mudança de estado operacional. Fonte de verdade do "onde estamos".
> Histórico detalhado em `sessoes/` e `specs/`. Este arquivo é **sumário operacional**, não diário.

## Fase atual

**Fase 3 — projetos + conteúdo.** Gates A/B ✅; mesas, glossario e site com Gate D fechado. Site em `artificiorpg.com` (Astro SSG, spec 029/030/031). `beta.artificiorpg.com` = staging. WP desligado da raiz; DNS raiz intocado (Gate C adiado). Migração WP→site concluída (D074, residual zero).

**Todos os 5 apps em prod** (2026-06-21). Promote `dev→main` (run `27894586895`) + redeploy links/glossario/mesas/site/accounts (`27894598616`..`27894601319`) 5/5 ✅. Containers healthy. **Regressão:** Cloudflare cache servia HTML antigo pré-promote → toggle dark/light quebrado + nav sem "WhatsApps" no site. Cache purgado via API (`purge_everything`).

**PRs abertas:** #73 dependabot. PR #80 **(spec 041 shell unificação)** mergeada em `dev` (`8981c84`). Deploy beta disparado para site/glossario/mesas.

## Destaque: Spec 041 — Shell unificado (merge 2026-06-21)
- `packages/ui`: Header com busca/changelog/tema/menu cross-app + `useTheme()`/`useChangelogBadge()` hooks + `<ChangelogModal>` centralizado
- 5 apps consumindo shell único (site Astro híbrido, mesas/glossario/links React, accounts tema)
- `/busca` uniformizada em 4 apps; `/conta` no accounts; `/perfil` renomeado no glossario
- Changelogs padronizados em JSON nos 4 apps (glossario migrado de DB)
- Débitos fechados: `BL-SHELL-B13`, `D-SHELL1`, `BL-UI-THEME-REACT-HEADER-VARIANT`, `BL-UI-THEME-TOGGLE-SITE-REGRESSION`, `BL-GLOSSARIO-CHANGELOG-JSON`
- 19 revisões de bots + 15 Sonar aplicados (17 itens, 2 agrupados); auditoria changelog 53 ✅

## Gates

| Gate | Status | Notas |
|------|--------|-------|
| **A** | ✅ | Backups completos/verificados/off-VM |
| **B** | ✅ | SSO `accounts.` no ar, cross-subdomínio provado |
| **C** | ⏸️ | Cutover DNS raiz — adiado (D016). Site já serve em `artificiorpg.com` por redirect Cloudflare, não pelo cutover cerimonial |
| **D** | ✅ | `mesas` (2026-06-08), `glossario` (2026-06-12), `site` (2026-06-18 via spec 029/030/031) |
| **D-link** | 🟡 | `links.artificiorpg.com` **no ar** (2026-06-21, smoke 200/200/200/401). Spec 038 (mídia/reportar/cron) mergeada em `dev` e promovida a `main`. Rebuild forçado na VM resolveu código ausente no container. Falta: T4 reidratar logos em prod, T13 smoke E2E. **Bug ativo:** `BL-UI-THEME-REACT-HEADER-VARIANT` — React `ThemeToggle` não atualiza `data-variant` no header ao trocar tema (nav fica claro). Fix local em `packages/ui/src/theme.tsx` (sem commit). |

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

1. **Commmit fix `BL-UI-THEME-REACT-HEADER-VARIANT`** — `packages/ui/src/theme.tsx` (aprov. nominal p/ commit/push/PR)
2. **Rebuild/redeploy consumidores React** — links/glossario/mesas/accounts (SDD Completo — shared package)
3. **Spec 041 — Shell único cross-projeto EXECUTADA (local, sem commit)** — Fases F0→F7 concluídas 2026-06-21. Núcleo (`packages/ui`): `useTheme()`, `useChangelogBadge()`, `Header` com busca/changelog/tema/menu de conta padronizados. Consumidores: mesas/glossario/links/accounts/site adotados. Site híbrido (Astro + ilha React), busca uniformizada `/busca` nos 4 apps, `/conta` no accounts. **Débitos fechados:** `BL-SHELL-B13`, `D-SHELL1`, `BL-UI-THEME-REACT-HEADER-VARIANT`, `BL-UI-THEME-TOGGLE-SITE-REGRESSION` (unificação previne recorrência). Build 15/15 ✅. Zero `MutationObserver`/`useSyncExternalStore`/`themeBtn` manual fora de `packages/ui`. `SiteFooter.astro` permanece fork (D-041-08 pendente). **Aguardando commit + PR** (Fase 8, aprovação nominal).
3. **T4 (spec 038)** — Reidratar logos links em prod (aprovação nominal)
4. **T13 (spec 038)** — Smoke E2E (logos Cloudinary, report, cron VM, nav cross-app, theme toggle)
5. **Merge PR #73** (dependabot)
6. **`BL-SEC-AUDIT-DEPS` (spec 039)** — commit + branch+PR `fix/039-sec-audit-deps` (aprovação nominal). `xlsx` 2×HIGH residual → spec 034.
7. **Spec 032** (analytics shared adoption)
8. **Spec 025** (Lighthouse residual)
9. **Spec 028** (biblioteca de mídia VM)

## Log

- 2026-06-21 — **Promote `dev→main` ✅** (run `27894586895`). ~30 commits acumulados promovidos: Node 24 LTS, Vite 8, Tailwind 4, ESLint 10 (spec 033); bump deps (spec 039); PRs #77/#78. Redeploy 5 apps (`27894598616`..`27894601319`) 5/5 ✅. Deploy links `27894598616` — rebuild forçado na VM: código da spec 038 (rehydrate-logos.ts etc.) confirmado no container.
- 2026-06-21 — **Regressão de tema pós-promote.** Site `artificiorpg.com`: toggle dark/light quebrado (só light), nav sem "WhatsApps". Causa: Cloudflare cache servia HTML pré-promote com `Cf-Cache-Status: HIT` + `max-age=7200`. CSP ausente na resposta live vs presente no container confirmou cache antigo. Cache purgado via API (`purge_everything`). **2° bug encontrado:** React `ThemeToggle` (`packages/ui/theme.tsx`) não atualiza `data-variant` no header/footer → nav links/glossario/mesas nunca escurece ao trocar tema. Fix local aplicado (`applyHeaderVariant` integrada em `setTheme`/`applyTheme`). 3 débitos registrados: `BL-UI-THEME-TOGGLE-SITE-REGRESSION`, `BL-UI-THEME-REACT-HEADER-VARIANT`, `D-PROMOTE-033-UPGRADES-REGRESSION`. Sessão: `26-06-21_3_theme-regression.md`.
- 2026-06-21 — **Spec 039 sec-audit-deps executada LOCAL (sem commit).** `pnpm audit` **16→2** (restam só 2×HIGH `xlsx` → spec 034). Fix: bump `dompurify`→3.4.11; `overrides` em `pnpm-workspace.yaml` (pnpm@11.8 NÃO lê `pnpm.overrides` de package.json) p/ form-data/undici(`<8`, pois 8.x quebra jsdom 29)/otel/nanoid/uuid/esbuild — nanoid5+uuid11+esbuild não bloquearam (previsão errada). Build 15/15, test 21/21, smoke DOMPurify OK. **2 bugs de teste PRÉ-EXISTENTES achados e resolvidos:** `BL-TEST-MESAS-SSO-ENV` (`.env` vazava VITE_PUBLIC_SITE_URL → fix `test.env` no vitest.config) e `BL-TEST-SITE-MEDIA-MOCK` (drift contrato spec 036, `isConfigured()` exige 3 vars → fix helper `enableCloudinary`). `BL-AUDIT-033` absorvido. Branch atual = `fix/037`; falta branch+PR `fix/039` (aprovação).
- 2026-06-21 — **PR #78 mergeada** (spec 038: mídia Cloudinary + reidratação + reportar + cron). T1-T11 implementados, 20 fixes de review bots, `html-entities` lib. `lint+build+test` ✅. Rebuild manual na VM necessário (deploy `27894335659` usou cache Docker antigo; `27894598616` rebuild forçado resolveu).
- 2026-06-21 — **links.artificiorpg.com NO AR ✅** (smoke VM 200/200/200/401). Resolvido após 3 falhas: (1/2) `.env` corrompido (`\n` literal do PowerShell em `ssh "...$(grep)..."`); (3) senha presa em volume Postgres (`pg_authid` só grava na 1ª init → `28P01`), diagnóstico enganado por `pg_hba` localhost=`trust` → **E009**. Fix: drop volume `links_pgdata_links_prod` (DB vazio) + redeploy (`27891323485`). Roteamento: mantenedor criou public hostname Tunnel (`links-app:4324`) + CNAME proxied. Prevenção E009 em 4 camadas (errors/runbook/capsule/backlog).
- 2026-06-21 — **Deploy prod ✅** (mesas/glossario/site/accounts).
