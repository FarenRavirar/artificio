# Estado do Projeto — Artifício RPG

> Atualizar a cada mudança de estado operacional. Fonte de verdade do "onde estamos".
> Histórico detalhado em `sessoes/` e `specs/`. Este arquivo é **sumário operacional**, não diário.

## Fase atual

**Fase 3 — projetos + conteúdo.** Gates A/B ✅; mesas, glossario e site com Gate D fechado. Site em `artificiorpg.com` (Astro SSG, spec 029/030/031). `beta.artificiorpg.com` = staging. WP desligado da raiz; DNS raiz intocado (Gate C adiado). Migração WP→site concluída (D074, residual zero).

**Todos os 5 apps em prod** (2026-06-21). Promote `dev→main` (run `27894586895`) + redeploy links/glossario/mesas/site/accounts (`27894598616`..`27894601319`) 5/5 ✅. Containers healthy. **Regressão:** Cloudflare cache servia HTML antigo pré-promote → toggle dark/light quebrado + nav sem "WhatsApps" no site. Cache purgado via API (`purge_everything`).

**PRs:** #73 dependabot (aberta). PR #80 **(spec 041 shell)** mergeada em `dev` (`8981c84`). Deploy beta pós-#80 **falhou 2x** (site `@artificio/config` não declarado; glossário+mesas `ERR_PACKAGE_PATH_NOT_EXPORTED ./changelog` — backend CJS importando `@artificio/ui` ESM-only). Corrigido via **PR #82** (pacote leaf `@artificio/changelog` dual ESM+CJS) mergeada (`86e2811`). **Promovido dev→main + deploy PROD** de glossário/mesas/accounts/links = ✅ (2026-06-21). Site fica em beta (raiz = Gate C). **PR #83 (spec 042 duplicate code refactor) mergeada** em `dev` (`fa9b787`, 2026-06-21). CI verde, 154 arquivos, +7663/-3040. 13 revisões resolvidas. Deploy beta mesas/glossario/site disparado.

## Destaque: Spec 041 — Shell unificado (merge 2026-06-21)
- `packages/ui`: Header com busca/changelog/tema/menu cross-app + `useTheme()`/`useChangelogBadge()` hooks + `<ChangelogModal>` centralizado
- 5 apps consumindo shell único (site Astro híbrido, mesas/glossario/links React, accounts tema)
- `/busca` uniformizada em 4 apps; `/conta` no accounts; `/perfil` renomeado no glossario
- Changelogs padronizados em JSON nos 4 apps (glossario migrado de DB)
- Débitos fechados: `BL-SHELL-B13`, `D-SHELL1`, `BL-UI-THEME-REACT-HEADER-VARIANT`, `BL-UI-THEME-TOGGLE-SITE-REGRESSION`, `BL-GLOSSARIO-CHANGELOG-JSON`
- 19 revisões de bots + 15 Sonar aplicados (17 itens, 2 agrupados); auditoria changelog 53 ✅
- **Pós-merge (PR #82):** deploy beta quebrou — contrato de changelog vivia em `@artificio/ui` (ESM-only), backends CJS (glossário/mesas) não conseguiam `require`. Extraído p/ pacote leaf **`@artificio/changelog`** (build dual ESM+CJS, `exports {import,require}`); `@artificio/ui` re-exporta; backends deixam de depender de UI/React. + fix `turbo.json` (`dist-cjs/**` nos outputs). Detalhe em `tasks-2.md` D-041-22/23, `task-revisões.md` §Pós-#80.
- **PROD (2026-06-21):** glossário, mesas, accounts, links com 041 em prod ✅. Site em beta (raiz `artificiorpg.com` = Gate C, adiado).
- **Spec 041 ENCERRADA.**

## Gates

| Gate | Status | Notas |
|------|--------|-------|
| **A** | ✅ | Backups completos/verificados/off-VM |
| **B** | ✅ | SSO `accounts.` no ar, cross-subdomínio provado |
| **C** | ⏸️ | Cutover DNS raiz — adiado (D016). Site já serve em `artificiorpg.com` por redirect Cloudflare, não pelo cutover cerimonial |
| **D** | ✅ | `mesas` (2026-06-08), `glossario` (2026-06-12), `site` (2026-06-18 via spec 029/030/031) |
| **D-link** | 🟡 | `links.artificiorpg.com` **no ar** (2026-06-21, smoke 200/200/200/401). Spec 038 (mídia/reportar/cron) mergeada em `dev` e promovida a `main`. Rebuild forçado na VM resolveu código ausente no container. Falta: T4 reidratar logos em prod, T13 smoke E2E. `BL-UI-THEME-REACT-HEADER-VARIANT` **fechado** (em prod via spec 041, PR #80/#82). |

## Decisões fechadas (resumo)

- Monorepo único `artificio` (pnpm + Turborepo)
- **Topologia subdomínio-por-projeto** (D017/D057): `glossario.`, `mesas.`, `links.`, `accounts.` (SSO). `artificiorpg.com` = site/blog raiz; `beta.artificiorpg.com` = staging. Futuros: `downloads.`, `esferas.`, `srd.`.
- **SSO central `accounts.artificiorpg.com`** (D018): OAuth Google, 2 cookies JWT `Domain=.artificiorpg.com` (`artificio_session` 15min + `artificio_refresh` 7d), HS256 simétrico
- **Blog na raiz** = aposta SEO (D019). Search Console Domain property + GA4 cross-subdomínio (D020). GA4 canônico = `G-8XN5BGPJP3`
- **Stack canônica:** React19/Vite/Tailwind + Express5/Kysely/PG16/Cloudinary + Astro 6 (site)
- **Infra:** Oracle 24GB/200GB, Docker, Cloudflare Tunnel, Watchtower(beta). Imagem buildada na VM (não GHCR).
- **Backup:** `C:\projetos\artificiobackup` (local, 300GB)
- **Acesso VM:** `ssh faren`, read-only sempre permitido, write exige aprovação nominal
- **Tema lua/sol** compartilhado cross-subdomínio (D067): cookie `artificio_theme`, opt-in explícito
- **Laranja canônico** `#FF5722` (D064), navy `#020740` (D040)
- **Linguagem pública:** "projetos" (D063); "módulo" = termo técnico interno
- **Comunicação agentes:** caveman ultra (D068)
- **Branch protection** `dev` (D073): tudo via PR, check `lint + build + test` obrigatório
- **WP EOL resolvido** (D074): migração concluída, residual zero de conteúdo servido com URL WP

## Construído neste monorepo

**Pacotes compartilhados:** `config`, `auth`, `ui`, `content`, `analytics`, `media`, `changelog`, `feedback`

**Apps:** `accounts` (SSO), `mesas` (anúncios de mesa), `glossario` (termos RPG), `site` + `site-admin` (blog/portal), `links` (WhatsApp, em prod)

**Infra/CI:** `deploy.yml` (manifesto declarativo, 5 módulos), `_deploy-module.yml`, `ci.yml` (lint+build+test gate), `deploy-manifest.json`, `docker-cleanup.yml`, `mesas-auto-archive.yml`, CodeQL, Scorecard, lock RW VM-wide

**Governança:** `AGENTS.md`, `.specify/memory/`, `.specify/arquiteture.md`, `docs/agents/`, `sessoes/`, `specs/`

## Próximo passo (ordem)

1. **Spec 041 — Shell único cross-projeto ✅ EM PROD (2026-06-21).** Mergeada (#80) + regressão de deploy corrigida (#82, pacote leaf `@artificio/changelog`) + promovida dev→main + deploy PROD glossário/mesas/accounts/links. `BL-UI-THEME-REACT-HEADER-VARIANT`/`BL-UI-THEME-TOGGLE-SITE-REGRESSION`/`BL-SHELL-B13`/`D-SHELL1` fechados pela unificação. Site em beta (raiz = Gate C). Residual: `SiteFooter.astro` fork (D-041-08); fix `turbo.json dist-cjs/**` viaja no commit do PR #83 (042).
2. **T4 (spec 038/045)** — Logos links: ✅ **12/13 reidratados em prod** (reconciliado spec 045, 2026-06-22). Resta só decidir "Canal de Notícias" null (spec 045 T3). Nav cross-app ✅ prod (site/glossário/mesas).
4. **T13 (spec 038/045)** — Smoke E2E residual: report ponta-a-ponta + cron VM (`crontab -l`). Logos/nav já ✅. (spec 045 T4)
5. **Merge PR #73** (dependabot)
6. **`BL-SEC-AUDIT-DEPS` (spec 039)** — commit + branch+PR `fix/039-sec-audit-deps` (aprovação nominal). `xlsx` 2×HIGH residual → spec 034.
7. **Spec 032** (analytics shared adoption)
8. **Spec 025** (Lighthouse residual)
9. **Spec 028** (biblioteca de mídia VM)
10. **Spec 042** (refatoração código duplicado top 3) — **✅ EM PROD (2026-06-21).** PR #83 mergeada → promovida `dev→main` (run `27926641721`) → deploy prod mesas/glossario/site (runs `27926664572`/`27926665007`/`27926665494`). cpd: 5.57% → 4.60% (-411 linhas, -18 clones). `packages/feedback` (CJS+ESM dual build), `actorNameResolver` (6→1), `suggestionHelpers` (3 factory functions). 13 revisões de PR resolvidas.
11. **Spec 043** (auditoria visual links + shared `packages/ui`) — **PR #84 mergeada em `dev` (`39d2c7c`, 2026-06-22).** Fase 1 T5 (logo base64 → PNG estático) completa. `brand.ts` com `import .png?url`, `ambient.d.ts`, build script. `assetsInlineLimit: 0` nos 5 consumidores. 46 arquivos, +6644/-256. CI verde. Próximo: T6 (auditoria Header shared).
12. **Spec 044** (otimizacao ecossistema OpenCode + Claude Code) — ✅ **FECHADA (2026-06-22).**
13. **Spec 045** (débitos pendentes em limbo) — **Investigação concluída + T1 ✅ (2026-06-22, PR #85).**
14. **Spec 047** (mesas inbox importação) — **fechamento técnico local pré-Git ✅ (2026-06-22).** Backend, sync, corpus/métricas, erros tipados e débitos/reviews implementados. Lint 15/15, build 17/17, backend 21 arquivos/159 testes e diff-check verdes. Sem commit/push/PR/deploy. Próximo: autorizações separadas para fluxo Git; depois deploy beta aplica migration 129 e smoke.

## Log

- 2026-06-21 — **Promote `dev→main` ✅** (run `27894586895`). ~30 commits acumulados promovidos: Node 24 LTS, Vite 8, Tailwind 4, ESLint 10 (spec 033); bump deps (spec 039); PRs #77/#78. Redeploy 5 apps (`27894598616`..`27894601319`) 5/5 ✅. Deploy links `27894598616` — rebuild forçado na VM: código da spec 038 (rehydrate-logos.ts etc.) confirmado no container.
- 2026-06-21 — **Regressão de tema pós-promote.** Site `artificiorpg.com`: toggle dark/light quebrado (só light), nav sem "WhatsApps". Causa: Cloudflare cache servia HTML pré-promote com `Cf-Cache-Status: HIT` + `max-age=7200`. CSP ausente na resposta live vs presente no container confirmou cache antigo. Cache purgado via API (`purge_everything`). **2° bug encontrado:** React `ThemeToggle` (`packages/ui/theme.tsx`) não atualiza `data-variant` no header/footer → nav links/glossario/mesas nunca escurece ao trocar tema. Fix local aplicado (`applyHeaderVariant` integrada em `setTheme`/`applyTheme`). 3 débitos registrados: `BL-UI-THEME-TOGGLE-SITE-REGRESSION`, `BL-UI-THEME-REACT-HEADER-VARIANT`, `D-PROMOTE-033-UPGRADES-REGRESSION`. Sessão: `26-06-21_3_theme-regression.md`.
- 2026-06-21 — **Spec 039 sec-audit-deps executada LOCAL (sem commit).** `pnpm audit` **16→2** (restam só 2×HIGH `xlsx` → spec 034). Fix: bump `dompurify`→3.4.11; `overrides` em `pnpm-workspace.yaml` (pnpm@11.8 NÃO lê `pnpm.overrides` de package.json) p/ form-data/undici(`<8`, pois 8.x quebra jsdom 29)/otel/nanoid/uuid/esbuild — nanoid5+uuid11+esbuild não bloquearam (previsão errada). Build 15/15, test 21/21, smoke DOMPurify OK. **2 bugs de teste PRÉ-EXISTENTES achados e resolvidos:** `BL-TEST-MESAS-SSO-ENV` (`.env` vazava VITE_PUBLIC_SITE_URL → fix `test.env` no vitest.config) e `BL-TEST-SITE-MEDIA-MOCK` (drift contrato spec 036, `isConfigured()` exige 3 vars → fix helper `enableCloudinary`). `BL-AUDIT-033` absorvido. Branch atual = `fix/037`; falta branch+PR `fix/039` (aprovação).
- 2026-06-21 — **PR #78 mergeada** (spec 038: mídia Cloudinary + reidratação + reportar + cron). T1-T11 implementados, 20 fixes de review bots, `html-entities` lib. `lint+build+test` ✅. Rebuild manual na VM necessário (deploy `27894335659` usou cache Docker antigo; `27894598616` rebuild forçado resolveu).
- 2026-06-21 — **links.artificiorpg.com NO AR ✅** (smoke VM 200/200/200/401). Resolvido após 3 falhas: (1/2) `.env` corrompido (`\n` literal do PowerShell em `ssh "...$(grep)..."`); (3) senha presa em volume Postgres (`pg_authid` só grava na 1ª init → `28P01`), diagnóstico enganado por `pg_hba` localhost=`trust` → **E009**. Fix: drop volume `links_pgdata_links_prod` (DB vazio) + redeploy (`27891323485`). Roteamento: mantenedor criou public hostname Tunnel (`links-app:4324`) + CNAME proxied. Prevenção E009 em 4 camadas (errors/runbook/capsule/backlog).
- 2026-06-21 — **Deploy prod ✅** (mesas/glossario/site/accounts).
- 2026-06-21 — **Spec 042 mergeada em `dev`** (PR #83, `fa9b787`). 154 arquivos, +7663/-3040. CI verde. 13 revisões de PR resolvidas. Deploy beta mesas/glossario/site disparado. cpd: 5.57% → 4.60% (-411 linhas, -18 clones).
- 2026-06-22 — **Spec 047 (mesas inbox importação) criada.** Auditoria Fase 0 concluída: 17 arquivos lidos, pipeline Discord mapeado (parse→normalize→sync), adaptador mínimo viável (~15 linhas), 3 opções de arquitetura comparadas (recomendada: Opção B+C — rota separada + tabela paralela). `spec.md`, `plan.md`, `tasks.md`, `reviews.md`, `debitos.md` escritos. 7 fases planejadas (MVP: Fase 1). 3 débitos registrados (DEB-047-01/02/03). Backlog README e project-state atualizados. 3 falsos positivos nas auditorias originais (ReportButton, LinksSearch estados erro, CTA target=\_blank) — auditorias atualizadas com seção "Correções pós-investigação". T5: base64 é arquitetural (tsc puro sem bundler), 5 consumidores de brand.ts. T6/T7: 3 consumidores do `<Header>` (links/glossario/mesas). T10 downgrade Major→Minor (M→L esforço). Branch `feat/043-links-visual-audit` criada, todos arquivos staged sem commit. Sessão: `26-06-21_6_links_visual-audit`.
