> **⚠️ SUPERADA por D117 (2026-07-20):** GA4 mudou de property única (D020) para 1 property por app. `G-8XN5BGPJP3` abaixo é a property antiga aposentada.

# Plano — 032

## Arquitetura da solução

`@artificio/analytics` continua a **única fonte** do snippet GA4 e dos helpers. Hoje cobre bem SSR (Astro/site). Faltam dois pontos para os apps React (glossario, mesas):

1. **Carregar gtag 1x** no boot do app React (injetar `<script>` loader + inline config com `send_page_view:false`).
2. **page_view por route change** (React Router) — helper/hook reutilizável.

Estratégia: estender o pacote com um helper client (`initGtag(id, opts)` que injeta o loader idempotente) e um hook React (`useAnalyticsPageviews()`) que escuta `useLocation()` e chama `trackPageview`. Catálogo de eventos central (`events.ts`) ganha os eventos de domínio hoje soltos (ex.: `trackSearch`). gtag nativo, zero-dep — sem `react-ga4` (mantém leveza da stack).

Convergência de id: `G-8XN5BGPJP3` em todos via env público (`PUBLIC_GA_ID` no site, `VITE_GA_ID` nos React).

## Arquivos afetados (por módulo/pacote)

**packages/analytics:**
- `src/gtag.ts` — add `initGtag(id, opts)` client-side (injeta loader idempotente; `send_page_view:false`; `anonymize_ip`).
- `src/events.ts` — add `trackSearch` (migrado do glossário) + outros eventos de domínio que surgirem; manter catálogo nomeado.
- `src/react.ts` (novo) — `useAnalyticsPageviews()` hook (depende de react-router-dom como peerDependency).
- `src/index.ts` — exportar novos símbolos. Subpath `@artificio/analytics/react` p/ não forçar react no consumidor SSR.
- `src/analytics.test.ts` — cobrir initGtag idempotente + page_view.
- `package.json` — peerDeps `react`, `react-router-dom` (opcionais via subpath).

**apps/glossario/frontend:**
- `index.html` — **remover** bloco gtag hardcoded (`G-XMRHY3FE58`).
- `src/utils/analytics.ts` — **deletar** (duplicado); trocar imports por `@artificio/analytics`.
- ponto de boot (`main.tsx`/App) — `initGtag(VITE_GA_ID)` + `useAnalyticsPageviews()`.
- `src/types/gtag.d.ts` — remover se o pacote já declara `Window.gtag` (evitar conflito).
- `.env`/`.env.example` + compose/deploy — `VITE_GA_ID=G-8XN5BGPJP3`.

**apps/mesas/frontend:**
- `src/services/analytics.ts` — substituir placeholder genérico por wrapper fino sobre `@artificio/analytics` (ou conectar `GA4Provider` real ao pacote). Decidir: manter interface provider OU simplificar p/ helpers diretos.
- boot/App — `initGtag(VITE_GA_ID)` + `useAnalyticsPageviews()`; instrumentar rotas públicas.
- `index.html` / `.env` / compose — `VITE_GA_ID=G-8XN5BGPJP3`.

**apps/site:**
- Sem mudança de código (já consome o pacote). Só **preencher `PUBLIC_GA_ID=G-8XN5BGPJP3`** no `.env` da VM (beta + prod-when-Gate-C) e rebuild. Write VM = aprovação.

**Docs:** `.specify/memory/decisions.md` (nota em D020), `specs/backlog.md` (fechar `BL-ANALYTICS`, anotar `BL-QA-THIRD-PARTY`), `.specify/memory/project-state.md`, `specs/README.md` (status 032).

## Contratos/interfaces tocados

- **auth/accounts?** Não. Analytics não toca SSO.
- **subdomínio/DNS?** Não. cookie_domain raiz já no pacote.
- **schema/banco?** Não.
- **packages/analytics API:** adiciona exports (não-breaking p/ site). Novo subpath `/react` isola dep React do consumidor Astro.
- **env:** `VITE_GA_ID` novo (glossario, mesas); `PUBLIC_GA_ID` passa a ser preenchido (site). Id é público, não segredo.

## Impacto em consumidores

- `@artificio/analytics`: consumidores = site (SSR helpers — **não pode quebrar**), glossario, mesas (novos). Smoke nos 3.
- Astro/site importa só `gtagSrc`/`gtagInlineConfig` — garantir que o novo código React fique em subpath separado p/ não puxar react no build Astro.

## Rollback

- Pacote: reverter export; apps voltam ao estado anterior (glossario tinha gtag hardcoded funcional; mesas tinha placeholder inerte).
- site: limpar `PUBLIC_GA_ID` na VM + rebuild = volta a não trackear (estado atual).
- Cada fatia é PR isolado → revert por PR.

## Validação (como provo que funciona)

1. **Build local** dos 3 apps + `pnpm test` no pacote (initGtag idempotente, page_view).
2. **Bundle grep:** glossario/mesas dist contém `G-8XN5BGPJP3` e **não** `G-XMRHY3FE58`.
3. **Runtime local/preview:** Network mostra 1 request `gtag/js?id=G-8XN5BGPJP3`; route change dispara `page_view` (DebugView/console).
4. **Pós-deploy beta:** `curl` HTML dos 3 hosts → só id canônico; cookie `_ga` Domain raiz; GA4 Realtime mostra os 3 na mesma property.
5. Registrar evidência na sessão; smoke dos consumidores SSO inalterado (analytics não toca auth).
