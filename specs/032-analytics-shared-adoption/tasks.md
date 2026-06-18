# Tasks — 032

> Execução por **opencode** (fatias isoladas por app/pacote). Planejamento/revisão = Claude.
> Cada fatia que toca `packages/analytics` = SDD Completo + smoke dos consumidores.

## Pacote (base — habilita o resto)
- [x] **T1** — `@artificio/analytics`: add `initGtag(id, opts)` client-side, loader idempotente, `send_page_view:false`, `anonymize_ip`. · FEITO (opencode ses_123ff84e, 2026-06-18; verificado por Claude — gtag.ts:27, idempotente via querySelector, test 15/15).
- [x] **T2** — `@artificio/analytics`: novo subpath `/react` com hook `useAnalyticsPageviews()` (escuta route change → `trackPageview`). peerDeps react/react-router-dom. · FEITO (src/react.ts novo; package.json exports `./react`; peerDeps opcionais → Astro não puxa react. Verificado).
- [x] **T3** — `@artificio/analytics`: catálogo de eventos em `events.ts` recebe `trackSearch` + nomes padronizados; export em `index.ts`. · FEITO (trackSearch/trackViewTermo/trackSelectMesa/trackFilterSistema/trackFilterApply + cleanParams; exportados em index.ts. Verificado).

## glossario
- [x] **T4** — Remover bloco gtag hardcoded (`G-XMRHY3FE58`) de `apps/glossario/frontend/index.html`. · FEITO (opencode ses_123f58b2; grep limpo, verificado).
- [x] **T5** — Deletar `src/utils/analytics.ts` dup + `src/types/gtag.d.ts`; trocar imports por `@artificio/analytics`. · FEITO (ambos deletados; imports do pacote em App.tsx/ResultCard/main; dep workspace:*. Verificado).
- [x] **T6** — Boot: `initGtag(VITE_GA_ID)` + `useAnalyticsPageviews()`; env `VITE_GA_ID=G-8XN5BGPJP3`. · FEITO (main.tsx initGtag gated; `<AnalyticsPageviews/>` dentro de `<BrowserRouter>`; .env/.env.example; Dockerfile+composes com build arg. Verificado).

## mesas
- [x] **T7** — Substituir `services/analytics.ts` placeholder por wrapper sobre `@artificio/analytics`. · FEITO (ses_123e6daf; `track`→`trackEvent`; `identify`/`setGlobalProperties` no-op R8; assinatura preservada, callers useProfileQuery/ProfileEditPage compilam. Verificado).
- [x] **T8** — Boot: `initGtag(VITE_GA_ID)` + `useAnalyticsPageviews()`; env `VITE_GA_ID=G-8XN5BGPJP3`. · FEITO (main.tsx gated; `<AnalyticsPageviews/>` sob BrowserRouter; .env/.env.example/Dockerfile/composes build arg. Build verde, bundle com G-8XN5BGPJP3. Verificado).

## Eventos de BI (gestão — agregado, sem PII)
- [x] **T6b** — glossario: instrumentar `view_termo` (`termo_id`,`termo`,`sistema`). · FEITO + bug corrigido: 1ª versão disparava no mount de cada card (impressão, fere R8). FIX (ses_123f58b2): IntersectionObserver threshold 0.5, `sentRef` one-shot, `ref={cardRef}` no root (ResultCard.tsx:119,156,404), SSR no-op. 1 evento por termo realmente visto. Build verde. Verificado.
- [x] **T8b** — mesas: instrumentar `select_mesa` + `filter_sistema`. · FEITO: `select_mesa` em MesaPage.tsx:96 (deps `[table?.id,slug]`, 1x por mesa aberta, não impressão); `filter_sistema` em CatalogoPage.tsx:157 (guard `newSystem!==filters.system`, só na aplicação). Sem PII. Verificado.

## site
- [ ] **T9** — Preencher `PUBLIC_GA_ID=G-8XN5BGPJP3` no `.env` da VM + rebuild. **Write VM + deploy PROD = aprovação nominal (BLOQUEADO).** Mecanismo: env runtime; `docker-entrypoint.sh` rebuilda dist Astro no boot c/ `SITE_FORCE_REBUILD=true`. Site já em PROD (`site-prod-app`, cutover spec 029); `.env` em `/opt/artificio/apps/site/.env` sem a var. mesas/glossario: env análogo na VM, mas só após código T1–T8 commitado→PR→deployado. · feito quando: `curl` HTML carrega `gtag/js?id=G-8XN5BGPJP3` nos 3 hosts.

## Validação + manutenção do mapa
- [ ] **T10** — Smoke local/preview dos 3 apps: 1 property, page_view por rota, cookie `_ga` Domain raiz, sem `G-XMRHY3FE58`. · feito quando: evidência (curl/Network/DebugView) na sessão.
- [ ] **T11** — Atualizar `specs/backlog.md` (fechar `BL-ANALYTICS`, anotar `BL-QA-THIRD-PARTY`), nota em D020 (`decisions.md`), `project-state.md`, `specs/README.md` status 032. · feito quando: backlog/decisions/state coerentes.
- [ ] **T12** (follow-up mantenedor, não-código) — GA4 admin: confirmar exclusão de referral interno + data streams na property `G-8XN5BGPJP3`; aposentar property `G-XMRHY3FE58`. · feito quando: mantenedor confirma no painel.
- [ ] **T13** (follow-up mantenedor, não-código) — GA4 admin: registrar **custom dimensions** dos params de BI (`sistema`, `mesa_nome`, `termo`, `search_term`, `filter_value`) para virarem rankings em Explorações. · feito quando: dimensões aparecem nos relatórios e top-N de mesas/sistemas/termos é visível.
