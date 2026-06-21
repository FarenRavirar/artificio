# Mapa de Auditoria de Débitos e Tarefas — Artifício RPG

> **View consolidada.** Fonte canônica = [`specs/backlog.md`](backlog.md). Este arquivo = resumo derivado.
> Atualizado 2026-06-21 ~02:00. PRs #76 e #77 mergeadas. **mesas-beta ✅ NO AR.** PR #73 (dependabot) aberta.

## Débitos e tarefas

| Ref | Status | Evidência / Estado |
|:---|:---|:---|
| **BL-LINKS-013** | ✅ Fechado | PR #74 mergeada `dev` (`5d83a6e`). App completo: Astro+Express+Kysely+Cloudinary+SSO. 15p build verde. 🟦 pendente: deploy (tunnel/secrets/dispatch). |
| **BL-NAV-LINKS-014** | ✅ Fechado | "WhatsApps" em `modules.ts` mergeado via #74. |
| **BL-CLOUDINARY-SHARED** | ✅ Fechado | `@artificio/media` criado (spec 036), 3 consumidores, mergeado na #74. |
| **BL-INFRA-WORKFLOWS-026** | ✅ Fechado | Auditoria 100%. F1-F5/F10/F-SEC fechados. Subsistentes viram itens individuais. |
| **BL-INFRA-CACHE-CAP-F10** | ✅ Fechado | Build cache prune em prod-beta. |
| **BL-CDX-310** | ✅ Fechado (prod) | accounts via `_deploy-module`, healthcheck healthy. |
| **BL-INFRA-SEC-SCAN** | ✅ Fechado | PR #40 mergeado. 7 workflows de segurança ativos. |
| **BL-KYSELY-029-ESM** | ✅ Fechado | Kysely 0.29, mesas jest→vitest, Node 24 require(esm) provado. |
| **BL-MESAS-TEST-DB-SIDEEFFECT** | ✅ Fechado | Proxy lazy em `db/index.ts`. |
| **BL-MESAS-DB-LAZY-OPTION2** | ✅ Fechado | Idem, deploy beta verde. |
| **BL-PNPM-11** | ✅ Fechado | pnpm 11.8.0, allowBuilds enumerado (D080). |
| **BL-INFRA-DEFAULT-BRANCH** | ✅ Fechado | `dev` = default, branch protection ativo (D073). |
| **BL-INFRA-CI-EFFICIENCY-F11** | ✅ Fechado | Cache pnpm/turbo em `_deploy-module.yml`. |
| **BL-DEP-PATHFILTERS** | ✅ Fechado | Manifests raiz nos `paths:`. |
| **BL-DEP-MESAS-DISPATCH-ENV** | ✅ Fechado | F3 absorveu; env derivado central. |
| **BL-MESAS-BETA-MIGRATION-DRIFT** | ✅ Fechado | Drift não reproduziu. |
| **BL-SITE-PROD-PARITY-030** | ✅ Fechado | Site em paridade total (specs 030/031). |
| **BL-SITE-DATA-FLUXO-031** | ✅ Fechado | Seed, flip autoria/rota, noindex beta. D075 aposentado. |
| **BL-SITE-CUTOVER-029** | ✅ Fechado | Beta→raiz efetivado em prod (D075). |
| **BL-QA-SITE-IMAGES** | ✅ Fechado | Residual wp-content servido = 0 (D074). |
| **BL-SITE-MEDIA-ERR-SERIAL** | ✅ Fechado | PR #50, importador tolerante. |
| **BL-SITE-AVIF-FAIL** | ✅ Fechado | 3 AVIF migrados (resgate por bytes). |
| **BL-SITE-NONIMG-MEDIA** | ✅ Fechado | Webm migrado, PDFs salvos p/ re-host. |
| **BL-SITE-MEDIA-REMOTE-403** | ✅ Fechado | Resgate por bytes (PR #55). |
| **BL-QA-SHELL-CLS** | ✅ Fechado | CLS glossario 0.000862 (baseline 0.647). |
| **BL-QA-GLOSSARIO-PERF** | ✅ Fechado | Bundle ~340kB, perf 12→61. |
| **BL-QA-ROBOTS-SEO** | ✅ Fechado | Cloudflare Managed robots desativado, origem OK. |
| **BL-QA-LH-HARNESS** | ✅ Fechado | Lighthouse harness funcional. |
| **BL-QA-LH-MULTIURL** | ✅ Fechado | Parser multi-url corrigido. |
| **BL-ASTRO6-CSP** | ✅ Fechado | CSP via meta tag Astro 6, 46/46 páginas. |
| **BL-UI-COPYRIGHT-027** | ✅ Fechado | Página + rodapé universal publicados. |
| **BL-UI-B12-FONTS** | ✅ Fechado | Fontes locais, sem Google Fonts. |
| **BL-UI-B3-HEADERACTION** | ✅ Fechado | `HeaderAction` no `packages/ui`. |
| **BL-UI-B4-PRIMITIVES** | ✅ Fechado | Primitives implementadas e testadas. |
| **BL-UI-B2-STATIC** | ✅ Fechado | `@artificio/ui/static` criado. |
| **D-SITE-REQUIREADMIN** | ✅ Fechado | Corrigido (mesmo fix do links). |
| **D-SITE-ADVISORY-LOCK** | ✅ Fechado | Interface `Db` + `getClient()` + lock. |
| **BL-ROOTLESS-CONTAINERS** | ✅ Fechado | 4 Dockerfiles corrigidos. |
| **D-DEP1 / BL-MESAS-EXPRESS5-016** | ✅ Fechado | Monorepo 100% Express 5. |
| **BL-DOCS-BACKLOG-INDEX-DRIFT** | ✅ Fechado | Auditoria leve executada. |
| **BL-MESAS-EXPRESS5-016** | ✅ Fechado | Mesas em Express 5.2.1. |
| **D-MESAS1** | ✅ Fechado | Arquivar mesas + MESAS_CRON_SECRET. |
| **BL-REALIP-023** | ✅ Fechado | Contrato Real IP geral (D069). |
| **Spec 025 baseline** | ✅ Fechado | Baseline Lighthouse limpo (2026-06-16). |
| **Spec 033 Fases 1-4B** | ✅ Fechado | Toolchain update completo. |
| **Spec 033 Fase 5 (Docker)** | ✅ Fechado | Dockerfiles atualizados. |
| **Spec 033 Fase 5c (pnpm 11)** | ✅ Fechado | PR #72 mergeado. |
| **Spec 033 Fase 6 (apt VM)** | ✅ Fechado | apt na VM atualizado. |
| | | |
| **PR #76 — fix(037)** | ✅ Mergeado | `fix/037-cloudinary-media-esm` mergeado (`c12167e`). ESM `"type":"module"` + fail-fast Dockerfiles + `auto_deploy_on_push: false`. |
| **PR #77 — fix(037)** | ✅ Mergeado | `fix/037-cloudinary-pnpm-prod-media` mergeado. `pnpm install --prod --filter @artificio/media` explícito (pnpm bug). 3 RUNs merged. Docs. **mesas-beta deploy ✅** (`27890193745`). |
| **BL-ACCOUNTS-PORT** | 🟡 Local | Composes alterados (expose), build verde. 🟦 deploy prod pendente. |
| **BL-CI-ESLINT-FLAT-CONFIG** | ✅ Fechado | Spec 037: 13/13 lint verde. `continue-on-error` removido. Configs criados em todos os pacotes. |
| **BL-033-SECRET-BLOCK** | ⚪ Aberto | `.gitignore` trocar `artifacts/lighthouse/` → `artifacts/` + destrackear 16 arquivos. |
| **BL-DEP-MESAS-AUTO-PUSH** | ✅ Fechado (PR #76) | `auto_deploy_on_push: false` implementado na PR #76. Mesas agora dispatch-only como os outros 4. |
| **BL-AUDIT-033** | ⚪ Aberto | dompurify bump + form-data override + xlsx→spec 034. |
| **BL-DEP-MESAS-LEGACY-SCRIPTS** | ⚪ Aberto | Limpar `apps/mesas/scripts/deploy/`. Spec 035 T6a-d. |
| **BL-MESAS-AUTO-ARCHIVE-CF** | ⚪ Aberto | Migrar cron p/ SSH interno (padrão docker-cleanup). Spec 035 T8a-d. |
| **BL-SITE-PRINCIPAL-GAPS** | ⚪ Aberto | GA_ID, newsletter, sitemap.xml, contato, json sujos. Spec 035 T9a-f. |
| **BL-SITE-ADMIN-WP-PUBLISH-GUARD** | ⚪ Aberto | Guard no save/publish p/ rejeitar wp-content/uploads. Spec 035 T10a. |
| **BL-BETA-HYDRATE** | 🔴 Bloqueado | `PROD_DB_URL` ausente no `.env.beta`. Mantenedor seta segredo. Spec 035 T-HYDa-d. |
| **BL-CF-TUNNEL-TOKEN-SCOPE** | 🔴 Bloqueado (mantenedor) | Token CF sem permissão Tunnel Read/Edit. |
| **BL-ANALYTICS (Spec 032)** | ⚪ Aberto | Código T1-T8b pronto. T9: deploy mesas prod com GA. |
| **BL-SITE-VM-MEDIA-LIBRARY (Spec 028)** | ⚪ Aberto | 14 tasks, SDD Completo. Re-host 6 PDFs + biblioteca de mídia VM. |
| **BL-SITE-CMS-PARITY (Spec 011)** | ⚪ Aberto | CRUD taxonomias, lista editorial, agendamento, roles. |
| **BL-GLOSSARIO-LEGACY-CLEAN** | ⚪ Aberto | Limpar `password_hash` BCrypt de 2 users SSO. Backup + UPDATE. |
| **BL-CONFIG-AUTH** | ⚪ Aberto | Domínios canônicos + auth HTTP client compartilhado. SDD Completo. |
| **BL-INFRA-GHCR-F12** | ⚪ Aberto | Build CI→GHCR vs cache incremental VM. Decisão pendente. |
| **D-DEP2** | ⚪ Aberto | Atualizar toolchain (turbo, @types/react patches). |
| **BL-SITE-GATED** | ⚪ Aberto | Gate D site: 4 débitos filhos + E2E mantenedor. |
| **BL-SHELL-B13 / D-SHELL1** | ⚪ Aberto | Nav/footer fonte única; residual Astro markup/accounts. |
| **BL-UI-PRIMITIVES-CONSUMERS** | ⚪ Aberto | Piloto em `site-admin` com Button/Badge/controles. |
| **Spec 022 (vars semânticas)** | ⚪ Aberto | Rollout em mesas (catálogo/painel/forms). |
| **BL-QA-MESAS-PERF** | ⚪ Aberto | Reduzir TBT/main-thread mesas. |
| **BL-QA-SECURITY-HEADERS** | ⚪ Aberto | CSP/HSTS/COOP/XFO nos apps Express. |
| **BL-QA-A11Y-SWEEP** | ⚪ Aberto | Contraste, nomes acessíveis, touch targets. |
| **BL-QA-THIRD-PARTY** | ⚪ Aberto | Inventariar scripts live por host. |
| **BL-SEO-SHARED** | ⚪ Aberto | Helpers SEO por projeto. |
| **BL-NORMALIZERS** | ⚪ Aberto | Normalização de payload externo. |
| **BL-COPY-PUBLICA** | ⚪ Aberto | Textos públicos compartilhados. |
| **BL-022-MESAS-*** (T8-T15) | ⚪ Aberto | Rollout UI mesas (catálogo, painel, forms, remap). |
| **BL-022-ACCOUNTS-R7** | ⚪ Aberto | Migrar accounts p/ tokens globais. |
| **BL-FEEDBACK-MESAS-ANTIDRIFT** | ⚪ Aberto | Mesas consumir `@artificio/ui/feedback`. |
| **D-SYNC1** | ⚪ Aberto | Sync cross-app sistemas/cenários. |
| **Spec 001 T4/T6/T7/T13** | ⚪ Aberto | Backup WP final, órfãos, rotação secrets, teste restore. |
| **BL-CODERABBIT-CONFIG** | ⚪ Aberto | Criar `.coderabbit.yaml` (spec 035 Apêndice A). |
| **BL-SITE-ADMIN-TS-VARIANCE** | 🟢 Baixo | `as any` em admin-api.ts:220, cosmético. |
| **BL-SITE-RESCUE-STRIPPED** | 🟢 Baixo | Avatar Jason Bulmahn, gap menor. |
| **BL-GLOSSARIO-NONGOOGLE-E2E** | 🟢 Baixo | E2E opcional p/ fluxo legado. |
| **BL-DEP-CONTAINER-NAMES** | 🔵 Futuro | `container_name` fixo → nomes por projeto compose. |
| **BL-FEEDBACK-MERGE** | 🔵 Futuro | Unificar feedbacks entre projetos. |

## Spec 037 — achados de segurança/qualidade (PR #75 mergeada, PR #76 aberta)

| Ref | Status | Descrição |
|:---|:---|:---|
| **D086** | ✅ Decisão | CodeQL `js/missing-token-validation` = falso positivo. Dismiss pós-merge. |
| **T34** | ✅ Implementado (PR #75) | `app.disable("x-powered-by")` em 5 apps |
| **T35** | 📋 Investigado | Helmet/security headers — decisão mantenedor |
| **T36** | ✅ Implementado (PR #75) | `csrfProtection` antes de `express.json()` nos 4 apps |
| **T37** | ✅ Implementado (PR #75) | Merge 2 imports `@artificio/auth` em links |
| **T38** | ✅ Implementado (PR #75) | `cookieParser` antes de `json` no accounts |
| **T39** | ✅ Implementado (PR #75) | `publicLimiter` no `express.static` do links |
| **T40** | 📋 Info | `cookieParser()` sem `secret` — sem ação |
| **T41** | ✅ Implementado (PR #75) | Site CSRF allowlist: `PUBLIC_SITE_URL` + `www` |
| **T46** | ⚠️ Bug (PR #75) → ✅ Corrigido (PR #76) | `@artificio/media` CJS quebrou deploy mesas-beta. PR #76 corrige: `"type":"module"` + fail-fast Dockerfiles |
| **T47** | ✅ Implementado (PR #75) | `globalRateLimiter` antes de `csrfProtection` nos 3 apps |

## Bloqueios / decisões pendentes

- **`BL-BETA-HYDRATE`**: `PROD_DB_URL` no `.env.beta` — mantenedor seta segredo (write VM).
- **`BL-CF-TUNNEL-TOKEN-SCOPE`**: Token CF sem permissão Tunnel — mantenedor dashboard CF.
- **`apps/links` deploy**: Tunnel `links.` + `.env`/secrets VM + dispatch — mantenedor.
- **PR #73**: dependabot dev-dependencies → aguardando merge.
- **CodeQL dismiss**: 3 alerts `js/missing-token-validation` — mantenedor Security tab.
- **Promote dev→main**: ✅ concluído (`27890320975`). `main` = `dev` = `df4336e`.
- **Deploy prod**: 🔄 em andamento (mesas/glossario/site/accounts).

Legenda: ✅ feito · 🟡 local/parcial · 📋 investigado · 🔴 bloqueado · ⚪ aberto · 🟢 baixo · 🔵 futuro.
