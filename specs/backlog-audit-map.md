# Mapa de Auditoria de Débitos e Tarefas — Artifício RPG

> **View consolidada.** Fonte canônica = [`specs/backlog.md`](backlog.md).
> Atualizado 2026-06-22 ~16:30 (auditoria linha a linha + reordenação). Todos os itens verificados com evidência.

> **⚠️ REGRA DE MANUTENÇÃO (pétrea deste arquivo):** este mapa existe para um humano se orientar de relance. **Ao concluir ou mudar o status de um item, MOVA a linha para a seção correta** (✅ concluído → 🟡 local → 🟡 em andamento → ⚪ aberto) e **reordene dentro da seção** (do mais próximo de concluir ao mais distante). Nunca deixe item ✅ sob header 🟡/⚪ nem o contrário. Mudou de estado = move + reordena, no mesmo turno. Mapa fora de ordem é pior que sem mapa: confunde em vez de orientar.

## Ordenação: do mais próximo de concluir ao mais distante

| Ref | Status | Fase | Specs | O que falta |
|:---|:---|:---|:---|:---|
| — | — | — | **✅ CONCLUÍDO (fechado / em prod)** | — |
| BL-LINKS-013 | ✅ Prod | Completo | 013, 014, 038 | — (app completo em prod, deploy 2026-06-21) |
| BL-LINKS-VISUAL-AUDIT-043 | ✅ PR #84 | F1-F4 | 043 | — (14 DEBs + 17 REVs resolvidos; aguardando merge) |
| BL-DUPLICATE-042 | ✅ Prod | Completo | 042 | — (PR #83, 154 arquivos, cpd 4.60%) |
| BL-SHELL-B13 / D-SHELL1 | ✅ Prod | Completo | 041 | — (shell único cross-app em prod; residual SiteFooter.astro fork) |
| BL-UI-THEME-REACT-HEADER-VARIANT | ✅ Prod | Completo | 041 | — (applyHeaderVariant em prod, 4 apps React) |
| BL-UI-THEME-TOGGLE-SITE-REGRESSION | ✅ Beta | Completo | 041 | — (toggle funcional em beta; raiz = Gate C) |
| BL-GLOSSARIO-CHANGELOG-JSON | ✅ Prod | Completo | 041 | — (13 entradas DB→JSON; dropar update_log no próximo deploy) |
| BL-UI-COPYRIGHT-027 | ✅ Prod | Completo | 027 | — (/termos-de-uso + rodapé universal) |
| BL-SEC-AUDIT-DEPS | ✅ Prod | Completo | 039, 041 | — (pnpm audit 16→2; overrides em pnpm-workspace.yaml) |
| BL-TEST-MESAS-SSO-ENV | ✅ Prod | Completo | 039, 041 | — (test.env fix em vitest.config.ts) |
| BL-TEST-SITE-MEDIA-MOCK | ✅ Prod | Completo | 039, 041 | — (enableCloudinary helper) |
| BL-CLOUDINARY-SHARED | ✅ Prod | Completo | 036, 037 | — (@artificio/media, 3 consumidores) |
| BL-ROOTLESS-CONTAINERS | ✅ Prod | Completo | 037-042 | — (USER node nos 5 Dockerfiles) |
| D-DOCKERFILE-LONGLINES | ✅ Prod | Completo | 037 | — (5 fixes commitados em bfa98be) |
| BL-CI-ESLINT-FLAT-CONFIG | ✅ Prod | Completo | 037 | — (16/16 eslint.config.js, lint = gate obrigatório) |
| BL-PNPM-11 | ✅ Prod | Completo | 033 | — (pnpm 11.8.0, allowBuilds enumerado) |
| BL-KYSELY-029-ESM | ✅ Prod | Completo | 033 | — (Kysely 0.29, mesas jest→vitest) |
| BL-MESAS-TEST-DB-SIDEEFFECT | ✅ Prod | Completo | 033 | — (Proxy lazy em db/index.ts) |
| BL-MESAS-DB-LAZY-OPTION2 | ✅ Prod | Completo | 033 | — |
| D-DEP1 / BL-MESAS-EXPRESS5-016 | ✅ Prod | Completo | 033, 016 | — (Express 5 em 4/4 backends) |
| BL-ASTRO6-CSP | ✅ Prod | Completo | 033 | — (CSP via meta tag, 46/46 páginas) |
| BL-INFRA-WORKFLOWS-026 | ✅ Concluído | Auditoria | 026 | — (F1-F5/F10/F-SEC fechados) |
| BL-INFRA-CACHE-CAP-F10 | ✅ Prod | Completo | 026 | — (docker builder prune em prod) |
| BL-INFRA-CI-EFFICIENCY-F11 | ✅ Prod | Completo | 026, 033 | — (cache pnpm+turbo) |
| BL-CDX-310 | ✅ Prod | Completo | 026 | — (accounts via _deploy-module) |
| BL-DEP-PATHFILTERS | ✅ Prod | Completo | 026 | — |
| BL-DEP-MESAS-DISPATCH-ENV | ✅ Prod | Completo | 026 | — (env derivado central) |
| BL-DEP-MESAS-AUTO-PUSH | ✅ Prod | Completo | 076 | — (auto_deploy_on_push: false) |
| BL-INFRA-DEFAULT-BRANCH | ✅ Prod | Completo | — | — (dev=default, branch protection) |
| BL-INFRA-SEC-SCAN | ✅ Prod | Completo | 040 | — (7 workflows segurança ativos) |
| BL-SITE-PROD-PARITY-030 | ✅ Prod | Completo | 030, 031 | — (site em paridade total) |
| BL-SITE-DATA-FLUXO-031 | ✅ Prod | Completo | 030, 031 | — (seed, flip autoria/rota) |
| BL-SITE-CUTOVER-029 | ✅ Prod | Completo | 029 | — (beta→raiz, D075) |
| BL-QA-SITE-IMAGES | ✅ Prod | Completo | 017 | — (residual wp-content = 0) |
| BL-SITE-MEDIA-ERR-SERIAL | ✅ Prod | Completo | 050 | — (commit 4b0d073) |
| BL-SITE-AVIF-FAIL | ✅ Prod | Completo | 050, 055 | — (3 AVIF migrados) |
| BL-SITE-NONIMG-MEDIA | ✅ Prod | Completo | 051-055 | — (webm+PDFs) |
| BL-SITE-MEDIA-REMOTE-403 | ✅ Prod | Completo | 055 | — (resgate por bytes) |
| BL-UI-B3-HEADERACTION | ✅ Prod | Completo | 020 | — (HeaderAction no packages/ui) |
| BL-UI-B4-PRIMITIVES | ✅ Prod | Completo | 020 | — (Button/Badge/Field/Modal/Drawer) |
| BL-UI-B12-FONTS | ✅ Prod | Completo | 020 | — (fontes locais, sem Google Fonts) |
| BL-UI-B2-STATIC | ✅ Prod | Completo | 020 | — (@artificio/ui/static) |
| BL-QA-SHELL-CLS | ✅ Prod | Completo | 025, 020 | — (CLS 0.000862) |
| BL-QA-GLOSSARIO-PERF | ✅ Prod | Completo | 025 | — (perf 12→61, bundle ~340kB) |
| BL-QA-ROBOTS-SEO | ✅ Prod | Completo | 025 | — (robots.txt origem OK) |
| BL-QA-LH-HARNESS | ✅ Concluído | Harness | 025 | — (Lighthouse harness funcional) |
| BL-QA-LH-MULTIURL | ✅ Concluído | Harness | 025 | — (parser multi-url) |
| D-SITE-REQUIREADMIN | ✅ Prod | Completo | — | — (fix requireAdmin site) |
| D-SITE-ADVISORY-LOCK | ✅ Prod | Completo | — | — (Db.getClient + lock) |
| BL-MESAS-BETA-MIGRATION-DRIFT | ✅ Verificado | — | — | — (drift não reproduziu) |
| BL-DOCS-BACKLOG-INDEX-DRIFT | ✅ Concluído | Auditoria | — | — (auditoria leve) |
| D-PROMOTE-033-UPGRADES-REGRESSION | ✅ Concluído | Investigação | 041 | — (causa = Cloudflare cache, não código) |
| BL-AUDIT-CHANGELOG-ABORT-NOOP | ✅ Prod | Completo | — | — (AbortController + signal) |
| BL-AUDIT-033 | ✅ Absorvido | — | 039 | — (absorvido por BL-SEC-AUDIT-DEPS) |
| BL-REALIP-023 | ✅ Prod | Completo | 023 | — (contrato Real IP) |
| BL-UI-B6-E2E / BL-UI-B7-E2E | ✅ Prod | Completo | 020 | — (dark readiness + perfil) |
| D-UX1 / D-UX2 / D-UX3 | ✅ Prod | Completo | 017, 020 | — (lua/sol, toggle, rodapé) |
| D-MARCA1 / D-MARCA2 | ✅ / Superado | — | 018, 020 | — (rename módulos→projetos; cor canônica) |
| D-INFRA1 / D-INFRA2 | ✅ Concluído | — | 017, 019 | — (favicon fonte única; auditoria) |
| D-MESAS1 / D-CONT1 / D-MESAS-UI1 | ✅ Prod | — | — | — (arquivamento, changelog, badge) |
| D-GLOS-CTA / D-CSS1 | ✅ / Stale | — | — | — (CTA; higiene local) |
| DEB-001 a DEB-014 | ✅ PR #84 | Completo | 043 | — (14 débitos spec 043 resolvidos) |
| D-LINKS-REPORT-UNDO-ERROR | ✅ PR #84 | Completo | 043 | — |
| D-LINKS-REPORT-TRIGGER-FOCUS | ✅ Falso + | — | 043 | — (focus-visible já existe) |
| BL-DOCS-AUDIT-024 | ✅ Concluído | Auditoria | 024 | — (auditoria documental) |
| BL-BUILD-CACHE-PRUNE-ALL | ✅ Prod | Completo | 045 | — `prune --all` em `_deploy-module.yml:502`+`docker-cleanup.yml:159` (commit `bfa98be`, em main) |
| BL-LINKS-NAV-CROSSAPP | ✅ Prod | Completo | 038, 045 | — nav em site/glossário/mesas; accounts sem nav by design (spec 045 §2) |
| BL-033-SECRET-BLOCK | ✅ PR #85 | Completo | 045 | — `.gitignore artifacts/` + 16 destrackeados (`git ls-files artifacts/`=0, commit `289364d`) |
| — | — | — | **🟡 LOCAL / COMMITADO (falta deploy ou merge)** | — |
| **BL-054-GESTAO-IA** | 🟢 Prod | **Encerrada** | **054** | FECHADO 2026-06-30: Fases 1-4 implementadas, reviews 001-025 corrigidos. PR mergeada → deploy beta + smoke + promote prod ✅. O que não foi feito foi descartado. 053 Frente A destravada. |
| BL-LINKS-GROUP-LOGOS | 🟢 Quase | **12/13 em prod** (Cloudinary) | 038, 045 | Decidir "Canal de Notícias" null (reidratar ou aceitar) — spec 045 T3 |
| BL-ACCOUNTS-PORT | 🟡 Local | T1-T4 OK | 023, 035, 045 | Deploy prod (expose:["3000"]) — aprovação nominal (spec 045 T2) |
| BL-LINKS-MEDIA-038 | 🟡 Local | T1-T11 mergeado; T12 nav + reidratar ✅ prod | 038, 045 | Só **T13 smoke E2E** (report + cron VM) → fechar (spec 045 T4) |
| — | — | — | **🟡 EM ANDAMENTO (fase 1 ok, falta robustez)** | — |
| BL-DEPLOY-SSH-KEEPALIVE | 🟡 Fase 1 ok | Keepalive commitado | 040 | Robusto: setsid+logfile+sentinel (SDD Completo) |
| — | — | — | **⚪ ABERTO — PRIORITÁRIO (afeta múltiplos apps)** | — |
| BL-ANALYTICS | ⚪ Aberto | Código T1-T8b pronto | 032 | Deploy mesas prod com GA + env por app (mantenedor T9/T12/T13) |
| BL-SITE-PRINCIPAL-GAPS | ⚪ Aberto | Investigado | — | GA_ID, newsletter, sitemap.xml, contato (pós-cutover) |
| BL-INFRA-GHCR-F12 | ⚪ Aberto | Planejado | 026 | Build CI → push GHCR → VM pull (SDD Completo) |
| BL-DEPLOY-ENV-PGPASS-FAILFAST | ⚪ Aberto | Investigado | 037 | Script .env à prova de \n + fail-fast 28P01 no deploy |
| SPEC-047 | ⚪ Aberto | Auditoria F0 concluída | 047 | Inbox de importação de mesas — texto colado → draft. 7 fases. | T1.1 + aprovação mantenedor |
| — | — | — | **⚪ ABERTO — NORMAL (app/projeto específico)** | — |
| BL-SITE-GATED | ⚪ Aberto | Planejado | 008, 011 | Gate D site: paridade editorial, E2E admin, SEO |
| BL-SITE-CMS-PARITY | ⚪ Aberto | Planejado | 011 | CRUD editorial, lixeira, agendamento, roles |
| BL-SITE-VM-MEDIA-LIBRARY | ⚪ Aberto | Spec escrita | 028 | SDD Completo: re-host 6 PDFs + biblioteca VM (T1=volume) |
| BL-UI-PRIMITIVES-CONSUMERS | ⚪ Aberto | Planejado | 020 | Piloto site-admin com Button/Badge/controles |
| BL-022-SEMANTIC-VARS | ⚪ Aberto | Planejado | 022 | Variáveis semânticas + checklist AA |
| BL-022-MESAS-CATALOGO | ⚪ Aberto | Planejado | 022 | Paleta/tokens no catálogo público mesas |
| BL-022-MESAS-PAINEL | ⚪ Aberto | Planejado | 022 | Paleta/tokens no painel mestre mesas |
| BL-022-MESAS-FORMS | ⚪ Aberto | Planejado | 022 | Forms/modais/toasts no mesas |
| BL-022-MESAS-REMOVE-REMAP | ⚪ Aberto | Depende T9-T11 | 022 | Remover remap [data-theme="light"] local |
| BL-022-ACCOUNTS-R7 | ⚪ Aberto | Planejado | 022 | Migrar accounts p/ tokens globais |
| BL-022-MESAS-T8-BETA | ⚪ Validação | Local/branch | 022 | Prova visual com dados vivos em beta |
| BL-QA-MESAS-PERF | ⚪ Aberto | Planejado | 025 | Reduzir TBT/main-thread mesas |
| BL-QA-SECURITY-HEADERS | ⚪ Aberto | Planejado | 025 | CSP/HSTS/COOP/XFO (Gate C/WP fora) |
| BL-QA-A11Y-SWEEP | ⚪ Aberto | Planejado | 025 | Contraste, nomes acessíveis, touch targets |
| BL-QA-THIRD-PARTY | ⚪ Aberto | Planejado | 025, 032 | Inventariar scripts live por host |
| BL-MESAS-AUTO-ARCHIVE-CF | ⚪ Aberto | Bug ativo | — | WAF Cloudflare bloqueia cron → migrar p/ SSH interno |
| BL-CONFIG-AUTH | ⚪ Aberto | Planejado | 019 | Domínios canônicos + auth HTTP client (SDD Completo) |
| BL-SEO-SHARED | ⚪ Aberto | Planejado | 019 | Helpers SEO por projeto |
| BL-NORMALIZERS | ⚪ Aberto | Planejado | 019 | Normalização payload externo |
| BL-COPY-PUBLICA | ⚪ Aberto | Planejado | 019 | Textos públicos compartilhados |
| BL-GLOSSARIO-LEGACY-CLEAN | ⚪ Aberto | Planejado | — | Limpar password_hash BCrypt (2 users) |
| BL-GLOSSARIO-CHANGELOG-CLEANUP | ⚪ Aberto | Planejado | — | Dropar tabela update_log + scripts obsoletos |
| BL-SITE-ADMIN-WP-PUBLISH-GUARD | ⚪ Aberto | Planejado | — | Guard wp-content/uploads no save/publish |
| BL-FEEDBACK-MESAS-ANTIDRIFT | ⚪ Aberto | Planejado | 021 | Mesas consumir @artificio/ui/feedback |
| D-SYNC1 | ⚪ Aberto | Planejado | — | Sync cross-app sistemas/cenários (SDD Completo) |
| D-DEP2 | ⚪ Aberto | Planejado | — | Atualizar apt/Node/pnpm/imagens na VM |
| BL-CF-TOKEN-DOC-GAP | ⚪ Aberto | Processo | — | Regra AGENTS.md: pendência infra → backlog |
| D-LINKS-ADMIN-UUID-VALIDATION | ⚪ Aberto | Parcial | — | UUID validation nas 6 rotas restantes (PATCH já ok) |
| D-DOCKERFILE-CHOWN-ORDER | ⚪ Aberto | Planejado | — | Mover chown antes do pnpm install (4 Dockerfiles) |
| BL-DEP-MESAS-LEGACY-SCRIPTS | ⚪ Aberto | Planejado | — | Limpar apps/mesas/scripts/deploy/ |
| SPEC-044 | ⚪ Aberto | Spec criada | 044 | Aprovar → executar T2/T4/T5/T7 (opencode ecosystem) |
| — | — | — | **🔴 BLOQUEADO (depende de ação externa)** | — |
| BL-BETA-HYDRATE | 🔴 Bloqueado | Aguardando | 005 | Mantenedor setar PROD_DB_URL no .env.beta |
| BL-CF-TUNNEL-TOKEN-SCOPE | 🔴 Bloqueado | Aguardando | — | Mantenedor: adicionar permissões Tunnel no token CF |
| BL-022-FINAL | 🔴 Bloqueado | Depende T2-T14 | 022 | Só fecha depois das fatias anteriores completas |
| — | — | — | **🟢 BAIXO / 🔵 FUTURO (sem urgência)** | — |
| BL-SITE-RESCUE-STRIPPED | 🟢 Baixo | Gap menor | — | Avatar Jason Bulmahn; importador descartável |
| BL-SITE-ADMIN-TS-VARIANCE | 🟢 Baixo | Cosmético | — | TS2345 multer x express; runtime OK |
| BL-GLOSSARIO-NONGOOGLE-E2E | 🟢 Baixo | Opcional | 015 | E2E fluxo legado não-Google |
| BL-UI-T5-THEME-DEDUP | 🟢 Baixo | Tier 4 | 020 | Deduplicar helpers de tema |
| BL-UI-RADIUS-SPACING | 🟢 Baixo | Planejado | 019 | Escala visual radius/shadow/spacing |
| BL-DEP-CONTAINER-NAMES | 🔵 Futuro | Adiado | 009 | container_name → nomes por projeto compose |
| BL-FEEDBACK-MERGE | 🔵 Futuro | Adiado | 021 | Unificar feedbacks entre projetos |
| D-FEEDBACK1 | 🔵 Futuro | Validação | 021 | Validar admin/beta quando retomar site |
| BL-ECOSYSTEM-SERENA | 🔵 Futuro | Investigado | 044 | Reavaliar quando monorepo crescer (50+ apps) |
| BL-ECOSYSTEM-CODEBASE-MEMORY | 🔵 Futuro | Investigado | 044 | Aguardar v1.0+ do codebase-memory-mcp |

## Spec 037 — achados de segurança/qualidade (PRs #75, #76 mergeadas)

| Ref | Status | Descrição |
|:---|:---|:---|
| D086 | ✅ Decisão | CodeQL missing-token-validation = falso positivo |
| T34 | ✅ PR #75 | app.disable("x-powered-by") em 5 apps |
| T35 | 📋 Investigado | Helmet/security headers — decisão mantenedor |
| T36 | ✅ PR #75 | csrfProtection antes de express.json() nos 4 apps |
| T37 | ✅ PR #75 | Merge 2 imports @artificio/auth em links |
| T38 | ✅ PR #75 | cookieParser antes de json no accounts |
| T39 | ✅ PR #75 | publicLimiter no express.static do links |
| T40 | 📋 Info | cookieParser() sem secret — sem ação |
| T41 | ✅ PR #75 | Site CSRF allowlist: PUBLIC_SITE_URL + www |
| T46 | ✅ Corrigido (PR #76) | @artificio/media CJS → ESM |
| T47 | ✅ PR #75 | globalRateLimiter antes de csrfProtection |

## Bloqueios / decisões pendentes

- **BL-BETA-HYDRATE**: Mantenedor setar PROD_DB_URL no .env.beta
- **BL-CF-TUNNEL-TOKEN-SCOPE**: Mantenedor dashboard CF → permissões Tunnel
- **PR #73**: dependabot dev-dependencies
- **CodeQL dismiss**: 3 alerts missing-token-validation
- **Spec 043**: PR #84 aberta, aguardando merge

Legenda: ✅ concluído · 🟡 local/parcial · 📋 investigado · 🔴 bloqueado · ⚪ aberto · 🟢 baixo · 🔵 futuro.
