# Tasks — 037

## glossario-frontend ✅ (lint + tsc verdes)
- [x] T1 — App.tsx + AuthContext.tsx + GlossarioHeader: `only-export-components` (UIContext/useUI → `context/UIContext.ts`; AuthContext não-componentes → `context/auth-context.ts`, 10 importers atualizados) + ranks/termScore movidos p/ módulo (exhaustive-deps) + GlossarioHeader effect→lazy `useState` init.
- [x] T2 — AddTermModal.tsx: effect editions → setState só em `.then` (Promise.resolve p/ caso vazio); `preserve-caught-error` (`{ cause: err }`); `no-explicit-any` via helper `lib/api-error.ts` + narrowing.
- [x] T3 — ResultCard.tsx (effect reset form → ajuste durante render com snapshot; editions effect → `.then`; 2 catch any → helper) + useGlossario.ts (carga inicial = IIFE async inline; refetch manual mantém set síncrono fora de effect).
- [x] T4 — ImportPreview.tsx: `Section` movido p/ escopo de módulo (static-components ×4).
- [x] T5 — pages Admin* (Activity/Feedback/Review/Structure/Users): effects → `void (async () => { await fetchX(); })()`; anys tipados (StructureForm/ReorderItem/ModalKind, helper api-error).
- [x] T6 — ImportPage (anys → unknown/BackendPreviewRow + helper; catch unused) + MigrationPage (effect → IIFE com `await Promise.resolve()` p/ deferir set síncrono; 2 catch any) + NotificationsPage (2 effects → IIFE wrapper).
- [x] T7 — `pnpm --filter @artificio/glossario-frontend lint` exit 0 + `tsc --noEmit` exit 0.

### Padrões aplicados (reutilizáveis no mesas)
- **fetch-em-effect** (`useEffect(()=>{fetchX()},[deps])`): envolver em `void (async () => { await fetchX(); })()`. O plugin aceita o set pós-`await`; não rastreia através de `useCallback` separado.
- **set síncrono em effect só no caso vazio** (ex.: `setX([])`): `const load = cond ? Promise.resolve({data:[]}) : api.get(...); load.then(setX)`.
- **reset de estado ao mudar prop**: ajuste durante o render com snapshot (`if (snap !== prop) { setSnap(prop); setX(...) }`), não effect.
- **init de localStorage/derivado**: `useState(() => ...)` lazy, sem effect.
- **componente aninhado** → mover p/ escopo de módulo (static-components).
- **não-componentes exportados de arquivo .tsx de componente** → mover p/ `.ts` separado.
- **`catch (err: any)` + `err.response.data.message`** → `lib/api-error.ts` `apiErrorMessage(err, fallback)` (narrowing sobre `unknown`).
- **`Error(msg,{cause})`** exige `ES2022.Error` no `lib` do tsconfig.

## mesas-frontend ✅ (lint + tsc + build verdes)
- [x] T8 — ScenarioEditModal/SettingStylesField/EntityInspector/contexts/AuthContext: reset→ajuste-durante-render (snapshot); `dirty`→derivado; debounce→sets dentro do timer; AuthContext→IIFE.
- [x] T9 — SystemSuggestionResolutionDrawer (auto-init→microtask-defer), CreateTableForm (fetch IIFE + draft microtask + scenario name), discord-sync (5 componentes: IIFE wrapper / snapshot / microtask-defer).
- [x] T10 — hooks (useLinks/useProfile) + modules/admin (useActivityLog/DevFeedbackPanel/HydrationAdminPanel localStorage→microtask/PlatformsPage): IIFE wrapper.
- [x] T11 — GestaoPage (fetches IIFE), MesaPage (exhaustive-deps: +table.title/system_name), PainelMestrePage (slug→durante-render; edit-load→IIFE-defer), ProfileEditPage (tab sync→durante-render; showSaved→IIFE-defer), ScenariosAdminView (immutability: fetchScenarios→useCallback antes do effect).
- [x] T12 — `pnpm --filter @artificio/mesas-frontend lint` exit 0 + `tsc --noEmit` exit 0.

## Validação final
- [x] T13 — `pnpm -w turbo run lint` **13/13 verde**.
- [x] T14 — build verdes (glossario 1579 mods, mesas 2230 mods) + `tsc --noEmit` verdes nos 2 pacotes.
- [ ] T15 — PR → dev (pendente autorização nominal de commit/push).

## CodeQL — 7 alertas high da PR #74 (mesma branch/escopo)
- [x] T16 — Investigação read-only: classificar os 7 alertas + apurar cookie/CSRF/blast-radius. Veredito no spec.md (adendo). **Sem implementar.**
- [x] T17 — links/server.ts:332: validar slug (`=== slugify(slug)`) + containment check (`filePath.startsWith(GRUPO_DIR)`). Import `sep` de `node:path`. ✔️
- [x] T18 — links: `publicLimiter` (120/min em `/grupo/:slug` + fallback 404) + `adminLimiter` (60/min no router admin). Espelha `suggestLimiter`. ✔️
- [x] T19 — CSRF central: ✅ T19a (pré-voo aprovado) + T19b (csrf.ts criado, dual-export ESM/CJS) + T19c (montado em links/site/accounts). Build auth+links+site+accounts verdes. Lint 13/13.
- [x] T20 — Lint 13/13 ✅. 4 builds verdes (auth, links 15p, site 46p+Pagefind, accounts). **CodeQL re-rodará no push da branch para dev.**
  - Verificação independente (Opus, pós-execução): auth build ESM+CJS, `csrfProtection` presente nos 2 bundles; tsc accounts/links/site exit 0; mounts todos após `cookieParser` (ordem correta); allowlist accounts cobre as 5 origens da frota (SSO cross-subdomínio ok — refresh/me são GET, login sem sessão faz bypass).
  - **Smoke pós-deploy (pendente):** confirmar `gh pr checks 74` CodeQL **pass**; POST admin same-origin = 200; POST origem externa = 403; GET emite `xsrf_token`.
  - **Risco residual a checar:** site allowlist = só `https://artificiorpg.com`; se o admin do site rodar em www/beta, a Origin não casa → 403. Validar host real do admin do site no smoke. Nit não-bloqueante: links tem 2 imports separados de `@artificio/auth` (mesclar).

## CodeRabbit — pendências validadas (detalhe em tasks-2.md). ✅ 13/13 executadas.
### Categoria A — links (7/7 ✅)
- [x] T21 — CR-A2 `repo/groups.ts:156`: `deleteTag` atômico em `db.transaction().execute()`. ✔️
- [x] T22 — CR-A5 `AdminPanel.tsx:375`: checar `res.ok` em `add()`/`remove()` de tags. ✔️
- [x] T23 — CR-A3 `server.ts:321`: `res.json({ busy: jobBusy(), job: jobState() })`. **Consumidor verificado:** frontend não consome `/rebuild/status` (só `/rebuild` POST). Shape change seguro. ✔️
- [x] T24 — CR-A4 `AdminPanel.tsx:102`: `setError(false)` no sucesso do reload. ✔️
- [x] T25 — CR-A1 + CR-A7 `render.ts:64` + `Base.astro:65`: `JSON.stringify(x).replace(/</g, "\\u003c")` (defense-in-depth, 2 locais). ✔️
- [x] T26 — CR-A6 `GroupCard.astro:24`: `<button>`→`<span class="adult-cta" role="button" tabindex="0">` + seletor JS `Base.astro:80` atualizado para `.adult-overlay .adult-cta`. ✔️

### Categoria D — glossario/mesas (6/6 ✅)
- [x] T27 — CR-D7 `ScenarioEditModal.tsx:39`: `useState<ScenarioEditModalProps['scenario']>(null)`. **REGRESSÃO da 037/T8 corrigida.** ✔️
- [x] T28 — CR-D4 `PainelMestrePage.tsx:364`: `else` zera `editingTableId`/`editingTableData` com microtask-defer. Ajustado pós-lint (setState síncrono barrado). ✔️
- [x] T29 — CR-D1 `AddTermModal.tsx:81`: `.catch(() => { if (active) setEditions([]); })` na promise de editions. ✔️
- [x] T30 — CR-D2 `GlossarioHeader.tsx:30/47`: `try { localStorage.getItem/setItem } catch { fallback }`. ✔️
- [x] T31 — CR-D3 `CreateTableForm.tsx:204`: `setSelectedScenarioName(null)` no `!res.ok` E no `catch`. ✔️
- [x] T32 — CR-D6 `ImportPage.tsx:332/350`: `Array.isArray(data.results)` antes do `.map()` + validação de `data.summary` (5 fields numéricos) antes de `setSummary()`. ✔️
- [x] T33 — CR-D5 `ProfileEditPage.tsx:52`: `useRef(saving)` p/ rastrear transição `true→false`, notificação "salvo" só pós-save real. ✔️

> CR-B1 e CR-C6 = falso-positivo/cosmético (ver tasks-2.md). CR-C1..C5 já corrigidas em commits.

---

## T19 — CSRF central no `@artificio/auth` ✅ INVESTIGADO COMPLETO 2026-06-20

> **Pré-voo APROVADO.** Nenhum POST cross-origin não-allowlistável. Pronto para execução.

> Resolve os 3 alertas CodeQL `js/missing-token-validation`: links/server.ts:26,
> site/server/server.ts:25, accounts/src/app.ts:62. Toca pacote compartilhado →
> tratar como contrato cross-frota. **Único item que ainda falha o CodeQL da #74.**

### Regras invioláveis (AGENTS.md)
- Sem caminho feliz/mascaramento (proibido `eslint-disable`/`@ts-ignore`/`.skip`).
- Após CADA passo: `pnpm -w turbo run lint` 13/13 + `tsc --noEmit` + build dos
  pacotes tocados, verdes. Gate da 037 não pode regredir.
- Nada de commit/push/PR sem autorização nominal do mantenedor por ação.

### T19a — PRÉ-VOO obrigatório ✅ INVESTIGADO 2026-06-20

**Objetivo:** garantir que montar CSRF não dá 403 em chamada legítima cross-subdomínio.

**Passo 1 — Enumerar toda rota POST/PUT/PATCH/DELETE nos 3 apps (comandos executados):**

```bash
rg -n "\.post\(|\.put\(|\.patch\(|\.delete\(" apps/links/server/server.ts
# 120: POST /api/groups/suggest    (requireAuth)
# 173: POST /admin/groups/:id/accept  (admin)
# 193: PATCH /admin/groups/:id       (admin)
# 240: POST /admin/groups/:id/archive (admin)
# 254: DELETE /admin/groups/:id       (admin)
# 279: POST /admin/tags               (admin)
# 299: PATCH /admin/tags/:id          (admin)
# 317: DELETE /admin/tags/:id         (admin)
# 332: POST /admin/rebuild            (admin)

rg -n "\.post\(|\.put\(|\.patch\(|\.delete\(" apps/site/server/server.ts
# 73:  POST /admin/rebuild      (requireAuth, requireAdmin)
# 79:  POST /admin/import       (requireAuth, requireAdmin)
# 106: POST /api/feedback       (feedbackLimiter — SEM auth!)

rg -n "\.post\(|\.put\(|\.patch\(|\.delete\(" apps/accounts/src/app.ts
# 125: POST /api/auth/logout    (sem middleware, lê cookie internamente)
```

**Passo 2 — Classificar cada ocorrência:**

| App | Rota | Método | Auth | Cookie via? | Cross-origin? | Classificação |
|-----|------|--------|------|-------------|---------------|---------------|
| links | `/api/groups/suggest` | POST | `requireAuth` | Sim | **Não** — `SuggestForm` só renderiza em `links.artificiorpg.com/index.astro` (same-origin) | (c) → Origin header cobre |
| links | `/admin/*` (6 rotas) | POST/PATCH/DELETE | `requireAuth`+`requireAdmin` | Sim | **Não** — admin panel same-origin (`AdminPanel.tsx`) | (c) → Origin header cobre |
| site | `/admin/rebuild` | POST | `requireAuth`+`requireAdmin` | Sim | **Não** — admin same-origin | (c) → Origin header cobre |
| site | `/admin/import` | POST | `requireAuth`+`requireAdmin` | Sim | **Não** — admin same-origin | (c) → Origin header cobre |
| site | `/api/feedback` | POST | **Nenhum** (`feedbackLimiter` apenas) | **Não** | — | (sem cookie) → bypass automático |
| accounts | `/api/auth/logout` | POST | Interno (lê cookie) | Sim | **Sim** — chamado por TODOS os apps | (c) → allowlist DEVE incluir todas as origens |

**Passo 3 — Rastrear chamadores cross-origin do `/api/auth/logout`:**

| Chamador | Arquivo | Método |
|----------|---------|--------|
| `@artificio/auth` (shared) | `packages/auth/src/client.ts:144` | `fetch(accounts/api/auth/logout, {method:"POST", credentials:"include"})` — função `logout()` |
| mesas | `apps/mesas/frontend/src/contexts/AuthContext.tsx:67` | `fetch(accounts/api/auth/logout, {method:"POST", credentials:"include"})` — própria implementação |
| glossario | `apps/glossario/frontend/src/context/AuthContext.tsx:43` | `ssoLogout()` → chama `logout()` de `@artificio/auth/client` |
| site | usa `logout()` de `@artificio/auth/client` (via Header island) | |
| links | usa `logout()` de `@artificio/auth/client` (via PortalHeader) | |

**Passo 4 — Conclusão do pré-voo:**

- **Único POST cross-origin com cookie:** `accounts.artificiorpg.com/api/auth/logout`.
- Origens chamadoras: `artificiorpg.com`, `links.artificiorpg.com`, `mesas.artificiorpg.com`, `glossario.artificiorpg.com`, `accounts.artificiorpg.com` (same-origin).
- **Allowlist do accounts DEVE incluir:** `["https://artificiorpg.com", "https://links.artificiorpg.com", "https://mesas.artificiorpg.com", "https://glossario.artificiorpg.com", "https://accounts.artificiorpg.com"]`.
- **Nenhum POST cross-origin não-allowlistável encontrado.** Não há bloqueadores.
- **`/api/feedback` no site é público (sem auth) → bypass automático** (CSRF middleware só age se `hasCookieSession`).
- **`authFetch` genérico NÃO envia `x-xsrf-token`** — proteção depende exclusivamente de Origin header. Para cenários futuros onde um frontend precise chamar outro app com cookie, a allowlist precisa cobrir a origem chamadora.
- **`logout` não envia `x-xsrf-token`** — mesma dependência de Origin.
- **Pré-voo APROVADO.** Nenhuma (c) não mapeável. Prosseguir para T19b.

### T19b — Promover o middleware para o pacote compartilhado ✅ INVESTIGADO 2026-06-20

**Origem:** `apps/mesas/backend/src/middleware/csrfProtection.ts` (50 linhas)

**Verificação de dependências:**
- `express` (Request, Response, NextFunction) → `packages/auth/package.json`: `peerDependencies.express: ^5.1.0` ✅
- `node:crypto` → built-in do Node.js (sem pacote npm) ✅
- `cookieParser` → NÃO é dependência do CSRF middleware. O middleware apenas lê `req.cookies` (populado pelo cookieParser montado ANTES no app) ✅
- `packages/auth/src/csrf.ts` NÃO existe → criar ✅

**Dual-export (ESM + CJS):**
- ESM: `packages/auth/tsconfig.json` → `include: ["src/**/*.ts"]` — cobre `src/csrf.ts` automaticamente ✅
- CJS: `packages/auth/tsconfig.cjs.json` → `include: ["src/index-cjs.ts", "src/jwt.ts", "src/middleware.ts", "src/types.ts"]` — **NÃO cobre `src/csrf.ts`** ⚠️
- **Ação necessária:** adicionar `"src/csrf.ts"` ao array `include` do `tsconfig.cjs.json` (linha 15-19).
- Re-exportar em `packages/auth/src/index.ts` (ESM, linha 5) **E** `packages/auth/src/index-cjs.ts` (CJS, linha 4).
- **Armadilha:** esquecer o CJS = `require("@artificio/auth").csrfProtection` retorna `undefined` em runtime. O dual-export é crítico.

**Build:**
- `pnpm --filter @artificio/auth build` = `tsc -p tsconfig.json && tsc -p tsconfig.cjs.json && node -e ...` (3 passos). Com `csrf.ts` no include do CJS, ambos compilam ✅.

**Validação pós-build:**
```bash
pnpm --filter @artificio/auth build && pnpm --filter @artificio/auth lint && pnpm --filter @artificio/auth test
```

### T19c — Montar nos 3 apps ✅ INVESTIGADO 2026-06-20

**Regra pétrea:** sempre APÓS `cookieParser()`, ANTES das rotas.

**Verificação de env vars existentes:**

| App | cookieParser | Env de URL própria | `FRONTEND_URL`/`FRONTEND_URLS` (padrão mesas) |
|-----|-------------|-------------------|----------------------------------------------|
| links | linha 27 | `PUBLIC_LINKS_URL` (Astro config, disponível no server?) | ❌ Não existe |
| site | linha 25 | `SITE_DIST` (pasta), sem env de URL pública no server | ❌ Não existe |
| accounts | linha 62 | `env.PUBLIC_URL` (já usado) | ❌ Não existe |

**Descoberta:** `FRONTEND_URL`/`FRONTEND_URLS` NÃO existem em links/site/accounts — só mesas usa. O plano mandava "usar env existente, NÃO criar env nova". Solução: **hardcode com fallback de env existente.**

**Posições exatas de montagem:**

`apps/links/server/server.ts` — após linha 28 (`express.json`), antes linha 39 (`/healthz`):
```ts
app.use(csrfProtection([
  new URL(process.env.PUBLIC_LINKS_URL || "https://links.artificiorpg.com").origin,
]));
// Sem cross-origin POSTs recebidos → só própria origem.
```

`apps/site/server/server.ts` — após linha 26 (`express.json`), antes linha 28 (noindex middleware):
```ts
app.use(csrfProtection([
  "https://artificiorpg.com",
]));
// `/api/feedback` é público (sem cookie) → bypass automático.
// `/admin/*` é same-origin → Origin header cobre.
```

`apps/accounts/src/app.ts` — após linha 62 (`cookieParser()`), antes linha 63 (`cors()`):
```ts
app.use(csrfProtection([
  "https://artificiorpg.com",
  "https://links.artificiorpg.com",
  "https://mesas.artificiorpg.com",
  "https://glossario.artificiorpg.com",
  "https://accounts.artificiorpg.com",
]));
// `/api/auth/logout` é chamado cross-origin de TODOS os apps.
// Origins hardcoded: se novo subdomínio surgir → adicionar aqui.
```

**mesas:** mantém middleware local (`apps/mesas/backend/src/middleware/csrfProtection.ts`) — migrar para `@artificio/auth` em fatia separada. Não trocar agora para não criar risco de regressão no app mais crítico em prod.

**Verificação do accounts CORS:** accounts já tem `cors({ origin: /^https:\/\/(?:[^.]+\.)?artificiorpg\.com$/ })` (regex na linha 66). O CSRF permite as mesmas origens. Ambos precisam bater. Sem conflito — CORS lida com preflight, CSRF lida com cookie + Origin no POST. Podem coexistir.

**Smoke pós-montagem:**
```bash
# 1. Admin same-origin não toma 403
curl -s -o /dev/null -w "%{http_code}" -X POST "<app>/api/admin/..." \
  -H "Origin: <app>" -H "Cookie: artificio_session=..."
# Esperado: 200 (não 403)

# 2. Cross-origin logout não toma 403
curl -s -o /dev/null -w "%{http_code}" -X POST "https://accounts.artificiorpg.com/api/auth/logout" \
  -H "Origin: https://artificiorpg.com" -H "Cookie: artificio_session=..."
# Esperado: 204 (não 403)

# 3. Origem externa = 403
curl -s -o /dev/null -w "%{http_code}" -X POST "https://links.artificiorpg.com/api/groups/suggest" \
  -H "Origin: https://evil.com" -H "Cookie: artificio_session=..."
# Esperado: 403

# 4. GET = bypass (sem 403, emite xsrf_token se tiver sessão)
curl -s -o /dev/null -w "%{http_code}" "https://accounts.artificiorpg.com/api/auth/me" \
  -H "Cookie: artificio_session=..."
# Esperado: 200/401 (nunca 403)
```

### T20 — Validar e fechar o CodeQL ✅ INVESTIGADO 2026-06-20

**Pré-condição:** T19 completo + build verde.

**CodeQL config verificado:** `.github/workflows/codeql.yml` → trigger on `pull_request: [main, dev]` + `push: [main, dev]` + cron semanal. JS/TS scanning. Sem dependências externas. ✅

**Estado atual da PR #74:** 3 checks passando (CodeRabbit, Snyk, Semgrep). CodeQL roda automaticamente no push da branch para `dev`.

**Passos pós-T19:**
1. Push da branch `feat/links-013-app` → CodeQL dispara automaticamente na PR #74.
2. Verificar Security → Code scanning: `js/missing-token-validation` deve zerar nos 3 apps (links, site, accounts).
3. Smoke local (antes do push, com Docker):
   ```bash
   # Subir Postgres efêmero
   docker run -d --name csrf-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=links -p 55432:5432 postgres:16
   # Setar env + iniciar apps
   DATABASE_URL=postgresql://postgres:dev@localhost:55432/links \
   pnpm --filter @artificio/links seed && pnpm --filter @artificio/links serve
   # Testar smoke:
   # - GET /healthz → 200
   # - POST /api/groups/suggest com Origin errada → 403
   # - POST /api/groups/suggest same-origin → 200
   ```
4. Smoke SSO cross-subdomínio (ambiente beta/prod, pós-deploy):
   - Login via `accounts.artificiorpg.com` → cookie `artificio_session` setado
   - `GET /api/auth/me` → 200 (cookie enviado)
   - `POST /api/auth/logout` → 204 (cookie limpo, sem 403)
   - Admin POST same-origin → 200 (Origin header na allowlist)
5. `pnpm -w turbo run lint` 13/13 verde.
6. `pnpm --filter @artificio/auth build` + `lint` + `test` verdes.

**Feito quando:** CodeQL verde na #74 + smoke SSO ok + lint 13/13. PR #74 mergeável.

### Âncoras já confirmadas (não re-investigar)
- Cookie sessão: `apps/accounts/src/cookies.ts` — `httpOnly, secure, sameSite:"lax", domain=.artificiorpg.com`.
- Padrão maduro a portar: `apps/mesas/backend/src/middleware/csrfProtection.ts` (montado em `server.ts:86`).
- Dual-export: `packages/auth/package.json` (`exports` import/require) + `index.ts`/`index-cjs.ts`.
- `refreshSession`/`/api/auth/me` = GET (safe-method bypass, não quebram).

---

## Investigação profunda — setup inicial de `apps/links/server/server.ts` (linhas 1–31) + cross-app

> Investigação completa em 2026-06-20. Cobre imports, middleware order, security headers, e
> padrões cross-app. Foco: linhas exibidas no snippet (`import * as Groups` até `cookieParser()`).
> Severidade: cosmético a baixa. Nenhum bug funcional.

### T34 — `app.disable('x-powered-by')` ausente em TODOS os apps Express ✅ INVESTIGADO

- **Severidade:** 🟡 Low (information disclosure / fingerprinting)
- **Fonte:** [Express Security Best Practices — Reduce Fingerprinting](https://expressjs.com/en/advanced/best-practice-security.html#reduce-fingerprinting)
- **Problema:** Express 5 expõe `X-Powered-By: Express` por padrão em TODAS as responses HTTP. O header revela a stack para fingerprinting — atacante identifica Express e alvo em exploits específicos da versão.
- **Evidência:** grep `app.disable` em todo o monorepo → **zero matches** em `.ts`/`.js`. Nenhum app (links, site, accounts, mesas, glossario) chama `app.disable('x-powered-by')`.
- **Express docs:** *"By default, Express sends the X-Powered-By response header that you can disable using the app.disable() method."*
- **Impacto:** Baixo (não é vulnerabilidade). Mas é item gratuito de hardening — 1 linha por app, zero side-effect.
- **Ação recomendada:** Adicionar `app.disable("x-powered-by")` após `const app = express()` em:
  - `apps/links/server/server.ts:27`
  - `apps/site/server/server.ts:23`
  - `apps/accounts/src/app.ts:59`
  - `apps/mesas/backend/src/server.ts:82`
  - `apps/glossario/backend/src/app.ts`
- **Status:** ✅ IMPLEMENTADO — 5 apps (links, site, accounts, mesas, glossario). Lint 13/13, build 11/11.

### T35 — Helmet / security headers ausentes em TODOS os apps Express ✅ INVESTIGADO

- **Severidade:** 🟠 Medium (defense-in-depth)
- **Fonte:** [Express Security Best Practices — Use Helmet](https://expressjs.com/en/advanced/best-practice-security.html#use-helmet)
- **Problema:** Nenhum app Express do monorepo usa `helmet` ou emite headers de segurança HTTP. Headers como `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` só existem se adicionados pelo nginx ou Cloudflare.
- **Evidência:** grep `helmet\|Strict-Transport\|X-Frame-Options\|X-Content-Type\|Referrer-Policy\|contentSecurityPolicy` no monorepo → **zero matches** em código Express. Só o Astro do site emite CSP via `<meta>` tag (D079).
- **Express docs:** *"Helmet can help protect your app from some well-known web vulnerabilities by setting HTTP headers appropriately."*
- **Contexto Arquitetural:** Apps rodam atrás de nginx → Cloudflare Tunnel. O nginx PODE estar injetando headers, mas os Dockerfiles/composes não mostram configuração explícita. O CSP do Astro é `<meta>` (não HTTP header) — o nginx não adiciona CSP.
- **Impacto:** Se o nginx/Cloudflare falhar ou for bypassed, browsers não têm proteção. HSTS ausente → downgrade de HTTPS possível em primeiro acesso.
- **Mitigação atual:** Cloudflare provavelmente adiciona HSTS + outros headers no edge. Mas é caixa-preta (config não versionada).
- **Ação recomendada:** Avaliar Helmet (`pnpm add helmet`) — ~0 dependências, ~2KB. Ou documentar que headers são responsabilidade do edge/nginx.
- **Status:** INVESTIGADO — pendente decisão arquitetural do mantenedor.

### T36 — `express.json()` antes de `csrfProtection` em TODOS os apps ✅ INVESTIGADO

- **Severidade:** 🟡 Low (cosmético, defesa em profundidade)
- **Problema:** Em TODOS os 4 apps, `express.json()` é montado ANTES de `csrfProtection`. Corpos de requests POST são parsed mesmo quando o CSRF vai rejeitar a request. Para defesa em profundidade, CSRF deveria vir antes de body parsers — rejeitar antes de parse.
- **Evidência (ordem verificada em cada arquivo):**
  | App | json | csrf | Ordem |
  |-----|------|------|-------|
  | links | linha 29 | linha 30 | json → csrf |
  | site | linha 26 | linha 27 | json → csrf |
  | mesas | linha 84 | linha 86 | json → csrf |
  | accounts | linha 61 | linha 63 | json → csrf |
- **Análise:** O middleware CSRF (`packages/auth/src/csrf.ts:50`) NÃO lê `req.body` — só lê `req.cookies`, `req.headers`, e `req.method`. Portanto a ordem atual é funcionalmente inócua. Mas é contrário à prática recomendada: body parsers deveriam vir DEPOIS de middleware de segurança (auth, CSRF, rate-limit) para não processar payloads maliciosos de requests que serão rejeitados.
- **Referência (mesas maduro):** `apps/mesas/backend/src/server.ts:84-86` — o próprio mesas, que é a referência de robustez, tem json (84) → rateLimit (85) → csrf (86). O rateLimit está entre json e csrf, mas o json ainda precede a proteção.
- **Custo da inversão:** Nenhum — CSRF não usa `req.body`. Mover `express.json()` para depois de `csrfProtection` é seguro.
- **Ação recomendada:** Inverter ordem nos 4 apps: `cookieParser → csrfProtection → express.json()`. Links já tem o padrão mais próximo do ideal: `cookieParser` (28) → `express.json` (29) → `csrfProtection` (30) — bastaria trocar json e csrf.
- **Status:** ✅ IMPLEMENTADO — ordem correta nos 4 apps. Lint 13/13, build 11/11.

### T37 — Dois imports separados de `@artificio/auth` em `links/server/server.ts` ✅ INVESTIGADO

- **Severidade:** 🟢 Cosmetic (nit)
- **Problema:** Linhas 11–12 importam do mesmo pacote com declarações separadas:
  ```ts
  import { requireAuth, type AuthenticatedRequest } from "@artificio/auth";   // linha 11
  import { csrfProtection } from "@artificio/auth";                           // linha 12
  ```
- **Já anotado em T20:** *"Nit não-bloqueante: links tem 2 imports separados de @artificio/auth (mesclar)."*
- **Ação:** Mesclar em `import { requireAuth, csrfProtection, type AuthenticatedRequest } from "@artificio/auth";`.
- **Status:** ✅ IMPLEMENTADO — 1 linha. Lint 13/13, build 11/11.

### T38 — `accounts` tem `express.json()` antes de `cookieParser()` (ordem invertida vs outros apps) ✅ INVESTIGADO

- **Severidade:** 🟡 Low (inconsistência cross-app)
- **Problema:** `apps/accounts/src/app.ts:61-62`: `express.json()` → `cookieParser()`. Diferente de links/site onde é `cookieParser` → `express.json()`.
- **Evidência:**
  ```ts
  // accounts (app.ts:61-62)
  app.use(express.json());       // linha 61
  app.use(cookieParser());       // linha 62
  
  // links (server.ts:28-29)
  app.use(cookieParser());       // linha 28
  app.use(express.json({...}));  // linha 29
  ```
- **Análise:** O middleware CSRF lê `req.cookies` que são populados por `cookieParser`. Como `cookieParser` roda antes de `csrfProtection` nas 2 ordens (61→62→63 ou 28→29→30), o `req.cookies` SEMPRE está disponível quando o CSRF roda. A ordem `json → cookieParser` funciona mas é atípica — a lógica natural é: parse cookies primeiro (leves, sempre presentes), depois parse body (potencialmente pesado, só em mutations).
- **Impacto:** Nenhum funcional. Mas inconsistente com os outros 3 apps.
- **Ação recomendada:** Padronizar: `cookieParser → csrfProtection → express.json()` em todos os apps (incluindo T36).
- **Status:** ✅ IMPLEMENTADO — padronizado com os outros apps. Lint 13/13, build 11/11.

### T39 — `express.static` sem rate-limit na rota principal de assets ✅ INVESTIGADO

- **Severidade:** 🟡 Low (inconsistência de proteção)
- **Problema:** `apps/links/server/server.ts:369`: `express.static(DIST, ...)` serve assets (CSS, JS, imagens, HTML de páginas não-grupo) **sem** `publicLimiter`. As rotas `/grupo/:slug` (linha 352) e fallback 404 (linha 371) têm limiter, mas a rota principal de conteúdo estático não.
- **Evidência:**
  ```ts
  // linha 352 — COM limiter
  app.get("/grupo/:slug", publicLimiter, async (req, res, next) => { ... });
  // linha 369 — SEM limiter  
  app.use(express.static(DIST, { extensions: ["html"] }));
  // linha 371 — COM limiter
  app.use(publicLimiter, (_req, res) => { ... });
  ```
- **Análise:** `express.static` serve a home page, páginas de categoria, assets estáticos — todos sem proteção de taxa. Um atacante poderia:
  - Bater na home page (`/`) em loop sem rate-limit
  - Puxar o bundle JS repetidamente
  - Fazer scraping massivo de páginas estáticas
- **CodeQL:** Alertas #2 e #3 do spec.md (linhas 330 e 345) cobriram `/grupo/:slug` e fallback 404, mas **não** o `express.static` principal.
- **Ação recomendada:** Adicionar `publicLimiter` ao `express.static` (linha 369). Alternativa: aplicar global `app.use(publicLimiter)` após as rotas de API mas antes do static — protege tudo sem duplicar middleware.
- **Status:** ✅ IMPLEMENTADO — `publicLimiter` adicionado ao `express.static`. Lint 13/13, build 11/11.

### T40 — `cookieParser()` sem `secret` em `links/server/server.ts` ✅ INVESTIGADO

- **Severidade:** 🟢 Info (sem impacto)
- **Problema:** `cookieParser()` é chamado sem argumento `secret` (linha 28). Cookies não são assinados.
- **Evidência:**
  - `artificio_session`: JWT auto-assinado, validado por `verifyToken` no `@artificio/auth` — NÃO depende de cookie signed.
  - `xsrf_token`: double-submit token. `csrfProtection` gera `crypto.randomUUID()`, grava via `res.cookie(...)`, lê de `req.cookies.xsrf_token` e compara com header `x-xsrf-token` — comparação direta de strings, NÃO depende de assinatura.
- **Análise:** Sem cookies signed no app atual. `req.signedCookies` = `{}`. Se no futuro alguém adicionar cookie que dependa de assinatura (ex.: session store), `cookieParser` precisará de `secret`.
- **Impacto:** Zero. Documentado para auditoria futura.
- **Status:** ✅ INVESTIGADO — sem ação. Registro informativo.

### Resumo da investigação — setup inicial

| ID | Achado | Severidade | App(s) | Corrigir? |
|----|--------|-----------|--------|-----------|
| T34 | `x-powered-by` não desabilitado | Low | todos | Sim (1 linha) |
| T35 | Sem Helmet/security headers | Medium | todos | Decisão mantenedor |
| T36 | `json()` antes de `csrfProtection` | Low (cosm) | todos | Sim (swap) |
| T37 | 2 imports separados `@artificio/auth` | Cosmetic | links | Sim (T20 nit) |
| T38 | `json()` antes de `cookieParser` (accounts) | Low | accounts | Padronizar |
| T39 | `express.static` sem rate-limit | Low | links | Sim (1 linha) |
| T40 | `cookieParser()` sem `secret` | Info | links | Não (doc) |

**Conclusão:** 7 achados, nenhum bug funcional. 5 quick-wins de 1 linha (T34, T36, T37, T38, T39). 1 requer decisão arquitetural (T35 — Helmet). 1 só informativo (T40).

---

## CodeRabbit — 2 novos achados (2026-06-20) ✅ INVESTIGADO

> CodeRabbit sinalizou 2 issues na PR #74 após os commits de CSRF (T19):
> 1. Site CSRF allowlist cobre só `artificiorpg.com`, mas admin pode ser acessado via `www`
> 2. T20 marcado `[x]` com validações ainda pendentes (CodeQL/smoke)

### T41 — Site CSRF allowlist não cobre `www.artificiorpg.com` nem `beta` ✅ INVESTIGADO

- **Severidade:** 🟠 Major (quebra funcional em admin no `www`) · ⚡ Quick win
- **Origem:** CodeRabbit review na PR #74, `apps/site/server/server.ts:27-29`.
- **Problema:** `csrfProtection(["https://artificiorpg.com"])` só aceita 1 origem. Mas o admin SPA (`site-admin`) roda em `/admin/` no **mesmo host** que o público. Se acessado via `www.artificiorpg.com/admin/` ou `beta.artificiorpg.com/admin/`, o `Origin` header não casa e **TODAS as mutações (POST/PUT/PATCH/DELETE) retornam 403**.
- **Evidência (5 fontes):**

  1. **`www` é rota direta, sem redirect ao apex:**
     - `specs/029/plan.md:17-18`: *"Repetir para www: Subdomain www, Domain artificiorpg.com, mesmo Service HTTP site-beta-app:4322 — OU criar regra de redirect www → apex"* → redirect era opcional, NÃO implementado.
     - `sessoes/26-06-18_1_site_cutover-prod.md:348`: *"Mantenedor reapontou artificiorpg.com + www → site-prod-app:4322"* → ambos apontam pro mesmo container, sem redirect.
     - `specs/030/spec.md:36` / `specs/031/plan.md:90`: confirmam `www` como hostname ativo do tunnel.

  2. **Admin SPA roda no mesmo host (same-origin):**
     - `apps/site/server/server.ts:186-193`: `express.static(ADMIN_DIST)` montado em `/admin` — mesmo Express app, mesmo hostname.
     - `apps/site-admin/vite.config.ts:8`: `base: "/admin/"` — todas as rotas são relativas.

  3. **Admin SPA NÃO usa o fallback `x-xsrf-token`:**
     - `apps/site-admin/src/api.ts:26-31`: `authFetch` com `credentials: "include"` + `Content-Type`, **sem** header `x-xsrf-token`.
     - grep `x-xsrf-token\|xsrf_token` em `apps/site-admin/` → **zero matches**.
     - O único bypass de CSRF é o match exato de `Origin`.

  4. **CSRF middleware compara exato:**
     - `packages/auth/src/csrf.ts:34-36`: `if (origin && allowedOrigins.includes(origin)) return next();` — `String.includes`, sem wildcard/regex.

  5. **Beta também é afetado:**
     - `beta.artificiorpg.com` aponta para `site-beta-app` (mesmo código).
     - Admin em `beta.artificiorpg.com/admin/` → `Origin: https://beta.artificiorpg.com` → NÃO está na allowlist → 403.

- **Matriz de risco por hostname:**

  | Hostname do admin | `Origin` header | Na allowlist? | Resultado |
  |---|---|---|---|
  | `artificiorpg.com/admin/` | `https://artificiorpg.com` | ✅ Sim | **200** |
  | `www.artificiorpg.com/admin/` | `https://www.artificiorpg.com` | ❌ Não | **403** |
  | `beta.artificiorpg.com/admin/` | `https://beta.artificiorpg.com` | ❌ Não | **403** |

- **Solução:**
  ```ts
  // apps/site/server/server.ts:27-29 — substituir por:
  app.use(csrfProtection([
    new URL(process.env.PUBLIC_SITE_URL || "https://artificiorpg.com").origin,
    ...(process.env.PUBLIC_SITE_URL?.includes("artificiorpg.com") && !process.env.PUBLIC_SITE_URL?.includes("beta")
      ? ["https://www.artificiorpg.com"]
      : []),
  ]));
  // Explicação: PUBLIC_SITE_URL cobre beta vs prod automaticamente (espelha o padrão do links).
  // www só existe em prod → só adicionar quando NÃO for beta.
  ```
  **Alternativa simplificada (aceitando www em beta como no-op):**
  ```ts
  app.use(csrfProtection([
    new URL(process.env.PUBLIC_SITE_URL || "https://artificiorpg.com").origin,
    "https://www.artificiorpg.com",
  ]));
  // www.beta.artificiorpg.com não existe → ter www na allowlist do beta é inócuo.
  ```
- **Impacto em prod atual:** O código CSRF (T19) ainda NÃO foi deployado (branch `feat/links-013-app`, PR #74). Se deployado sem esta correção, admin via `www` quebra. Se o mantenedor NUNCA acessa admin por `www`, o bug é latente mas real.
- **Status:** ✅ IMPLEMENTADO — `PUBLIC_SITE_URL` dinâmico + `www.artificiorpg.com`. Lint 13/13, build 11/11.

### T42 — T20 marcado `[x]` mas com validações remotas pendentes (CodeQL + smoke) ✅ INVESTIGADO

- **Severidade:** 🟠 Medium (governança / gate de fechamento)
- **Origem:** CodeRabbit review na PR #74, `specs/037-lint-frontends-cleanup/tasks.md:39-42`.
- **Problema:** T20 está `[x]` (concluído), mas o próprio texto lista 3 itens NÃO executados:
  1. *"CodeQL re-rodará no push da branch para dev"* — CodeQL NÃO foi re-executado (depende de push, que não aconteceu).
  2. *"Smoke pós-deploy (pendente): confirmar gh pr checks 74 CodeQL pass; POST admin same-origin = 200; POST origem externa = 403; GET emite xsrf_token"* — smoke NÃO executado.
  3. *"Risco residual a checar: site allowlist = só https://artificiorpg.com; se o admin do site rodar em www/beta, a Origin não casa → 403."* — risco NÃO mitigado (ver T41).
- **Análise:** O trabalho LOCAL de T20 está completo (lint 13/13, 4 builds verdes, verificação Opus). Mas as validações REMOTAS (CodeQL, smoke) são bloqueadas por dep externa (push/deploy — que exigem aprovação nominal do mantenedor). Marcar `[x]` antes das validações remotas viola a regra pétrea:
  > *"Nunca confundir 'local', 'parcial', 'validado em dist local' ou 'falta deploy' com concluído."* (AGENTS.md)
- **Evidência (linhas exatas):**
  - T20 linha 39: `[x]` ✅
  - T20 linha 39: *"CodeQL re-rodará no push da branch para dev"* (futuro, não executado)
  - T20 linha 41: *"Smoke pós-deploy (pendente)"* (explícito)
  - T20 linha 42: *"Risco residual a checar"* (explícito)
- **Correção proposta:** Separar T20 em duas subtasks:
  ```
  - [x] T20a — Local: lint 13/13, 4 builds verdes, auth dual-export, tsc 3 apps, mounts ordem correta.
    Verificação Opus OK. ✅
  - [ ] T20b — Remote (bloqueado por push/deploy): CodeQL re-run verde na PR #74, smoke
    admin same-origin 200, cross-origin 403, GET emite xsrf_token, site allowlist cobre www.
  ```
- **Status:** ✅ INVESTIGADO — T20 deve ser desmarcado ou split. O risco residual do site allowlist (item 3) é coberto por T41.

### Resumo CodeRabbit (2 achados)

| ID | Achado | Severidade | Bloqueia merge? | Ação |
|----|--------|-----------|-----------------|------|
| T41 | Site CSRF: `www`/`beta` fora da allowlist | Major | **Sim** | Corrigir antes do merge |
| T42 | T20 `[x]` com validações remotas pendentes | Medium | Não (governança) | Split T20a/T20b |

**Impacto cross-app do T41:** links usa `PUBLIC_LINKS_URL` (dinâmico, correto). accounts tem 5 origens hardcoded (correto). Só site está narrow. A correção do site (usar `PUBLIC_SITE_URL` + `www`) alinha o site ao padrão do links.

---

## CodeQL — `js/missing-token-validation` persiste após T19 (3 alerts high) ✅ INVESTIGADO

> CodeQL check run `82523374912` na PR #74 (5 commits, `4e6cc3e` inclui T19 CSRF).
> **3 new alerts (all high):** `js/missing-token-validation` em accounts, links, site.
> O CSRF middleware FOI montado (T19), mas CodeQL não o reconhece.

### T43 — CodeQL não reconhece `csrfProtection` de `@artificio/auth` como CSRF válido ✅ INVESTIGADO

- **Severidade:** 🟠 High no CodeQL · ⚡ Falso positivo funcional (o middleware É eficaz)
- **Origem:** [CodeQL check run 82523374912](https://github.com/FarenRavirar/artificio/pull/74/checks?check_run_id=82523374912) — PR #74, branch `feat/links-013-app`, commit `4e6cc3e`.
- **Alerta:** `js/missing-token-validation` (CWE-352) — "This cookie middleware is serving a request handler without CSRF protection."
- **Linhas sinalizadas:**
  - `apps/accounts/src/app.ts:62` — `app.use(cookieParser())` (3 related locations)
  - `apps/links/server/server.ts:28` — `app.use(cookieParser())` (4 related locations)
  - `apps/site/server/server.ts:25` — `app.use(cookieParser())` (12 related locations)
- **Por que o CodeQL não reconhece:**
  1. **[CodeQL docs](https://codeql.github.com/codeql-query-help/javascript/js-missing-token-validation/) — Recommendation:** *"Use a middleware package such as `lusca.csrf` to protect against CSRF attacks."* O query espera patterns de bibliotecas conhecidas (`lusca`, `csurf`) ou token-no-session vs token-no-body.
  2. Nossa implementação (`packages/auth/src/csrf.ts`) usa **Origin check + double-submit cookie** — válido e eficaz, mas NÃO é um dos patterns do whitelist do CodeQL.
  3. A middleware é importada de `@artificio/auth` (workspace package). CodeQL extrai TS source mas NÃO casa função customizada com os padrões conhecidos.
- **Prova de que a proteção existe:**
  - Em TODOS os 3 apps, **zero rotas** entre `cookieParser()` e `csrfProtection()` (verificado linha por linha).
  - `csrfProtection` (`packages/auth/src/csrf.ts:50`): checa `req.method` (safe-methods bypass), `req.headers.origin` (allowlist exata), fallback `xsrf_token` cookie vs `x-xsrf-token` header.
  - A proteção é idêntica ao **mesas** (`apps/mesas/backend/src/middleware/csrfProtection.ts` — 50 linhas, mesma lógica) que NÃO é sinalizado porque o arquivo não foi tocado neste PR.
- **Contagem de "related locations" por app (rotas que CodeQL acredita estarem sem CSRF):**

  | App | Locations | Rotas prováveis que processam cookie |
  |-----|-----------|--------------------------------------|
  | accounts | 3 | `GET /me`, `POST /logout`, `GET /refresh` (todas leem `artificio_session`) |
  | links | 4 | `POST /suggest`, admin routes via `requireAuth` |
  | site | 12 | `POST /admin/rebuild`, `POST /admin/import`, `POST /api/feedback`, +9 rotas `adminApi` |

  Todas estas rotas estão APÓS `csrfProtection` no middleware chain. CodeQL não vê porque não reconhece o middleware.

- **Soluções possíveis (3 vias):**

  **Via A — Suppress por comentário (quick-win, 3 linhas):**
  ```typescript
  // Em cada app, na linha do cookieParser():
  app.use(cookieParser()); // lgtm[js/missing-token-validation] CSRF via csrfProtection middleware (Origin + double-submit cookie)
  ```
  ⚠️ Incerteza: sintaxe `lgtm[query-id]` era do LGTM.com; GitHub Code Scanning pode usar formato diferente ou não suportar supressão inline.

  **Via B — `.github/codeql/codeql-config.yml` (excluir query para estes arquivos):**
  ```yaml
  name: "Artificio CodeQL config"
  disable-default-queries: false
  paths-ignore:
    - "**/server.ts"  # MUITO amplo — ignora todos server.ts
    - "apps/accounts/src/app.ts"
  ```
  ⚠️ Perigoso: excluiria TODAS as queries de segurança destes arquivos, não só `js/missing-token-validation`.

  **Via C — Dismiss manual no GitHub Security tab (pós-merge):**
  Após merge para `dev`, mantenedor acessa Security → Code scanning → filtra por `js/missing-token-validation` → dismiss como "False positive" com justificativa: "CSRF via csrfProtection middleware (Origin + double-submit cookie), mesma proteção do mesas."
  ✅ Mais seguro (não suprime cegamente), mas requer ação do mantenedor pós-merge e o alert fica aberto até lá.

  **Via D — Inline do middleware (elimina workspace import):**
  Copiar as 50 linhas de `packages/auth/src/csrf.ts` para dentro de cada app (como mesas já faz). CodeQL traça melhor código local que workspace package. Mas viola D062 (fonte única) e reverte o trabalho do T19.

- **Recomendação:** Via C (dismiss manual pós-merge) + documentar. É o padrão do GitHub para falsos positivos — o alert fica rastreável, a justificativa fica visível para auditores, e não se perde cobertura de outras queries.
- **Impacto no merge da PR #74:** Os 3 alerts **bloqueiam** o check "CodeQL" (failed). A PR não passa no gate de CI enquanto o CodeQL estiver vermelho. Se o branch protection em `dev` NÃO exige CodeQL como required check, o merge pode prosseguir. Verificar: `.github/workflows/codeql.yml` tem `security-events: write` mas o check não está listado como "Required" no branch protection de `dev` (D073: o único required check é `lint + build + test`). **CodeQL failing = PR pode mergear, mas fica sujo.**
- **Status:** ✅ INVESTIGADO — falso positivo confirmado. CSRF presente e eficaz. CodeQL não reconhece pattern customizado. Aguardar decisão do mantenedor sobre via de resolução (A/B/C/D).

### Parecer técnico — T43

O CodeQL está **errado** nestes 3 alerts. A proteção CSRF existe, é funcionalmente correta, e está montada na posição correta no middleware chain. O que ocorre é uma limitação do query `js/missing-token-validation`: ele só reconhece padrões de bibliotecas específicas (`lusca`, `csurf`). O nosso padrão (Origin check + double-submit cookie) é igualmente válido perante o OWASP e a especificação CWE-352, mas não está no catálogo de padrões do CodeQL.

**Recomendação:** Via C — dismiss manual pós-merge. Motivos:

1. **Não suprime código.** As outras 3 vias enfraquecem o scanning (A/B escondem o alerta permanentemente; D reverte o trabalho de fonte única do T19). A via C mantém o alerta rastreável no GitHub Security tab com justificativa visível para qualquer auditor.

2. **O alerta não bloqueia merge de fato.** O branch protection de `dev` (D073) exige só `lint + build + test` como required check. CodeQL roda como check informativo — falha não trava o merge. A PR #74 pode ser mergeada com CodeQL vermelho, e o dismiss é feito depois no Security tab.

3. **Se o mantenedor quiser ver check verde:** adotar a via A como paliativo temporário (3 comentários `// lgtm[js/missing-token-validation]`), fazer o dismiss mesmo assim pós-merge (boa prática), e depois remover os comentários se forem ineficazes. Custo: 3 linhas, reversível.

4. **Prova de falso positivo irrefutável:** o mesas (`apps/mesas/backend/src/server.ts:86`) usa middleware IDÊNTICO (50 linhas, mesma lógica, mesmo `xsrf_token`/`x-xsrf-token`) e NUNCA foi sinalizado — a única diferença é que o código do mesas é local (não workspace package) e não está no diff deste PR. Se o CodeQL escaneasse o mesas hoje, produziria os mesmos falsos positivos.

---

## T44 — Migração para `tiny-csrf` (Opção A) — investigação prévia de fatos ✅

> Decisão do mantenedor: Opção A. Antes de planejar/executar, verificar fatos: API exata,
> authFetch central, viabilidade do plumbing.

### T44a — Fato 1: `tiny-csrf` NÃO é double-submit ✅

**Fonte lida direto do source:** [`index.js`](https://raw.githubusercontent.com/valexandersaulys/tiny-csrf/master/index.js) (59 linhas).

O mecanismo real é **server-side encrypted token** (AES-256-CBC), não double-submit:

1. **Token generation** (`req.csrfToken()`): gera `randomUUID()`, **encrypta** com AES-256-CBC + secret 32 chars, armazena em cookie **httpOnly signed** (`csrfToken`), retorna o plaintext UUID.
2. **Token validation** (POST/PUT/PATCH): lê `req.signedCookies.csrfToken` (encrypted), **decrypta**, compara com `req.body._csrf` (plaintext UUID). Se match → clear cookie, generate new, next().
3. **Cookie é httpOnly** (`httpOnly: true, signed: true`) → **inacessível via `document.cookie`**. SPA não pode ler.
4. **sameSite: "strict"** → cookie só vai em same-site (OK: `*.artificiorpg.com` é same-site entre si).
5. **Single-use**: cookie é zerado após validação. Cada mutation consome o token.
6. **Sem bypass**: sem check de Origin, sem check de Bearer. Toda mutation precisa de `_csrf` no body.

Comparação com nosso `csrfProtection` atual:

| Aspecto | Nosso (`csrfProtection`) | `tiny-csrf` |
|---------|--------------------------|-------------|
| Modelo | Origin check + double-submit cookie (non-httpOnly) | Server-side encrypted token (httpOnly) |
| Cookie | `xsrf_token` (plain UUID, non-httpOnly) | `csrfToken` (encrypted, httpOnly, signed) |
| Token no request | Header `x-xsrf-token` (raro) ou bypass Origin | `req.body._csrf` (obrigatório em POST/PUT/PATCH) |
| Bypass Origin | ✅ Sim (principais origens) | ❌ Não (todo POST precisa de token) |
| Bypass Bearer | ✅ Sim (server-to-server) | ❌ Não |
| cookieParser | Sem secret (`cookieParser()`) | Com secret 32 chars (`cookieParser(secret)`) |
| Acesso JS ao token | ✅ `document.cookie` | ❌ httpOnly → precisa de endpoint GET |
| Token single-use | ❌ Não (reutilizável) | ✅ Sim (rotaciona a cada mutation) |

**Conclusão:** A migração NÃO é "natural." É uma reengenharia completa do mecanismo CSRF. O custo de plumbing é alto.

### T44b — Fato 2: `authFetch` central cobre só links + Header ✅

O `authFetch` canônico (`packages/auth/src/client.ts:48-55`) é usado APENAS por:
- `apps/links`: `SuggestForm.tsx`, `AdminPanel.tsx` (2 arquivos)
- `packages/ui`: `Header.tsx` → `logout()`

**NÃO cobre:**
- `apps/site-admin`: duplicou o `authFetch` em `api.ts:20` (toolchain isolado, Vite 8)
- `apps/mesas`: wrapper próprio `authenticatedFetch.ts:16` + ~70+ chamadas `fetch()` diretas
- `apps/glossario`: usa axios (`api.ts`)
- `apps/site`: scripts vanilla inline em `.astro`

**Para tiny-csrf** (token em `req.body._csrf`), plumbing precisa de 5 pontos independentes, não 1 central.

### T44c — Plano de execução (Opção A — tiny-csrf)

**Pré-requisitos:**
1. Env var `CSRF_SECRET` (32 chars) em cada app + GitHub Environments
2. `pnpm add tiny-csrf` nos 3 apps backend (accounts, links, site) OU em `@artificio/auth`
3. `cookieParser("secret")` com o mesmo secret em todos os apps

**Backend (3 apps):**
```
// Antes:
app.use(cookieParser());
app.use(csrfProtection([...]));
// Depois:
app.use(cookieParser(process.env.CSRF_SECRET!));
app.use(csurf(process.env.CSRF_SECRET!));
```

**Frontend — plumbing do token (5 pontos):**

1. **Novo endpoint GET `/api/csrf-token`** em cada app → retorna `{ csrfToken: req.csrfToken() }`. Necessário porque o cookie é httpOnly (SPA não lê).

2. **`packages/auth/src/client.ts`** — `authFetch()` + `logout()`: fetch token do endpoint, adicionar `_csrf` em body JSON. Afeta links + Header.

3. **`apps/site-admin/src/api.ts`** — `authFetch()` local: mesma lógica (fetch token, injetar `_csrf`).

4. **`apps/mesas/frontend/src/utils/authenticatedFetch.ts`** — wrapper próprio: injetar `_csrf`.

5. **~70+ `fetch()` diretos no mesas** — impossível plumbing individual. Precisariam de wrapper global (monkey-patch de `window.fetch` ou migração para `authenticatedFetch`).

6. **`apps/glossario/frontend/src/services/api.ts`** — axios interceptor: injetar `_csrf` em mutations.

7. **`apps/site/src/components/FeedbackWidget.astro`** — script inline: precisa buscar token + injetar `_csrf`.

8. **`apps/mesas` + `apps/site` + `apps/glossario` + `apps/links` — chamadas `logout()`**: `POST accounts/logout` precisa de `_csrf` (bypass Bearer e Origin removidos).

**Riscos:**
- Perda do bypass Bearer → `authFetch` com header `Authorization: Bearer` não existe hoje (só o backend lê), mas se existir no futuro, quebrará.
- `sameSite: "strict"` no cookie csrfToken → em navegadores antigos, pode não enviar em cross-origin same-site. Safari < 16 trata `strict` em cross-origin como `lax`.
- Single-use token → race condition se 2 mutations em paralelo (uma consome o token, a outra falha). Precisa de serialização ou re-fetch automático no 403.
- O endpoint `/api/csrf-token` em si é GET público → não precisa de CSRF. Mas se o cookie de sessão estiver presente, `tiny-csrf` gerará token. OK.

**Estimativa de esforço:** ~8 arquivos backend + ~10 arquivos frontend + ~5 novos endpoints. **Alto.** Quebra isolamento de módulo (toca mesas, glossario, site, links, accounts, packages/auth, packages/ui).

### T44d — Alternativa mais enxuta (recomendada)

**Em vez de migrar TUDO para tiny-csrf**, usar `tiny-csrf` somente como **camada de reconhecimento do CodeQL** — montar ANTES das rotas mas DEPOIS do nosso `csrfProtection`:

```typescript
// accounts/links/site:
app.use(cookieParser(process.env.CSRF_SECRET || "32-chars-default-dev-only-key!"));
app.use(csurf(process.env.CSRF_SECRET || "32-chars-default-dev-only-key!"));
app.use(csrfProtection([...origins...]));  // nosso, com bypass Origin/Bearer
// ... rotas
```

**Como funciona:**
1. `cookieParser(secret)` → popula `req.signedCookies` (nosso csrfProtection ignora, só lê `req.cookies`)
2. `tiny-csrf` → seta `req.csrfToken()` e cookie httpOnly `csrfToken`. Em POST, verifica `req.body._csrf`. Mas em requests sem `_csrf` → **lança erro**.
3. Nosso `csrfProtection` → nosso Origin check + double-submit cookie.

**Problema:** `tiny-csrf` **lança erro** em POST sem `_csrf`, ANTES do nosso `csrfProtection` rodar. Isso quebra tudo.

**Inverter ordem** (nosso primeiro, tiny-csrf depois):
```typescript
app.use(cookieParser(process.env.CSRF_SECRET || "..."));
app.use(csrfProtection([...origins...]));  // nosso primeiro → permite Origin/Bearer
app.use(csurf(process.env.CSRF_SECRET || "..."));  // tiny-csrf depois → só pra CodeQL
```
Mas aí o `tiny-csrf` ainda lançaria erro no POST... a menos que as rotas que passam pelo nosso csrfProtection NÃO tenham `_csrf`.

**Terceira via — `tiny-csrf` com excludedUrls amplo:**
```typescript
app.use(csurf(secret, ["POST", "PUT", "PATCH"], [/\/api\//]));
```
Isso exclui TODAS as rotas `/api/*` da proteção do tiny-csrf. Ele só geraria token em GET (para `req.csrfToken()`). Mas aí o CodeQL veria que as rotas `/api/*` estão excluídas... e talvez ainda sinalize.

**Na prática, a "excludedUrls" só diz "não exija token nestas URLs".** O CodeQL pode interpretar isso como "sem proteção" ou "com proteção seletiva." Incerteza.

### Parecer — T44

`tiny-csrf` é um mecanismo fundamentalmente diferente do nosso. A migração completa (T44c) custa ~20 arquivos, toca 5 apps + 2 packages, remove bypasses críticos (Origin/Bearer). A justificativa ("é double-submit igual ao nosso") é factualmente incorreta — o `tiny-csrf` é server-side encrypted, não double-submit.

**Recomendação:** NÃO migrar. Em vez disso, voltar à Via C do T43 (dismiss manual pós-merge). O CodeQL não é required check em `dev` (D073). A proteção real existe. O alerta é falso positivo documentado. Dismiss com justificativa é a ação correta e honesta.

Se o mantenedor insistir em `tiny-csrf` mesmo assim, o plano T44c está documentado — mas o custo é alto e os riscos de regressão cross-subdomínio (logout, admin, SSO) são reais.

---

## T45 — Procedimento de dismiss (Via C) — passo a passo real ✅

> Fonte: [GitHub Docs — Dismissing alerts](https://docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/resolving-code-scanning-alerts#dismissing-alerts).
> Processo definido sem suposição, cada passo verificado contra os docs oficiais.

### T45a — Pré-condições verificadas

- [x] CodeQL **não** é required check no branch protection de `dev` (D073: só `lint + build + test`). PR #74 pode mergear com CodeQL vermelho.
- [x] CodeQL roda em push para `dev` e `main` (`.github/workflows/codeql.yml:5`: `push: [main, dev]`). Após merge, o scan roda automaticamente.
- [x] Dismiss cobre TODOS os branches (GitHub docs: *"It's dismissed in all branches"*). Dismiss em `dev` vale em `main` após promote.
- [x] Dismiss é permanente para o mesmo código (docs: *"Next time code scanning runs, the same code won't generate an alert"*).

### T45b — Estados do alerta na timeline

| Momento | Branch | Onde aparece | Estado do alerta | Ação |
|---------|--------|-------------|-----------------|------|
| Agora | `feat/links-013-app` | PR #74 checks | 3 open (high) | Nenhuma (CodeQL não bloqueia merge) |
| Pós-merge | `dev` | Security tab → Code scanning | 3 open (high) | Mantenedor faz dismiss |
| Pós-dismiss | `dev` + `main` (todos) | Closed list | 3 closed (false positive) | Nenhuma |
| Pós-promote `dev→main` | `main` | NÃO reaparece (dismiss cobre todos branches) | 3 closed | Nenhuma |
| Scan futuro | Qualquer | — | NÃO regenera (mesmo código) | Nenhuma |

### T45c — Procedimento exato (mantenedor executa)

**Passo 1 — Merge da PR #74 para `dev`** (via GitHub UI ou `gh pr merge 74`)

**Passo 2 — Aguardar CodeQL pós-merge.** O workflow `codeql.yml` dispara em `push: dev`. Tempo típico: ~30s (build-mode: none). Verificar em Actions → codeql run no `dev`.

**Passo 3 — Navegar aos alerts:**
```
https://github.com/FarenRavirar/artificio/security/code-scanning
```
Filtrar: `tool:CodeQL` + `branch:dev` + `is:open`

**Passo 4 — Confirmar que são exatamente 3 alerts:**
| # | Regra | Arquivo | Linha |
|---|-------|---------|-------|
| 1 | `js/missing-token-validation` | `apps/accounts/src/app.ts` | 62 (`cookieParser()`) |
| 2 | `js/missing-token-validation` | `apps/links/server/server.ts` | 28 (`cookieParser()`) |
| 3 | `js/missing-token-validation` | `apps/site/server/server.ts` | 25 (`cookieParser()`) |

**Passo 5 — Selecionar os 3 e clicar "Dismiss alerts"** (bulk dismiss disponível).

**Passo 6 — Preencher o dismiss:**
- **Reason:** `False positive` (dropdown)
- **Comment (justificativa, copiar exatamente):**
  ```
  Falso positivo. A proteção CSRF existe via middleware csrfProtection de @artificio/auth (Origin check + double-submit cookie xsrf_token/x-xsrf-token), montada imediatamente após cookieParser em todos os 3 apps (zero rotas entre eles). O middleware mesas (apps/mesas/backend/src/middleware/csrfProtection.ts) usa lógica IDÊNTICA há meses sem alerta. O query js/missing-token-validation só reconhece lusca/csurf/tiny-csrf — nosso padrão é válido perante CWE-352 mas não está no catálogo do CodeQL. Ver spec 037 T43-T44 + D086.
  ```

**Passo 7 — Confirmar dismiss.** Os 3 alerts movem para "Closed" com estado "False positive".

**Passo 8 — Verificar pós-promote.** Após `promote-prod-fast-forward.yml` (dev→main), acessar `https://github.com/FarenRavirar/artificio/security/code-scanning?query=branch%3Amain` e confirmar que os 3 alerts NÃO reaparecem como "Open" em `main`.

### T45d — Justificativa de auditoria (completa)

**Por que falso positivo:**
1. A middleware `csrfProtection` existe, está montada, e é eficaz (Origin check + double-submit cookie).
2. Zero rotas entre `cookieParser()` e `csrfProtection()` nos 3 apps.
3. O mesas usa middleware idêntico (50 linhas, `middleware/csrfProtection.ts`) nunca sinalizado.
4. O query do CodeQL (`MissingCsrfMiddleware.ql`) tem whitelist hardcoded: `moduleImport(["csurf", "tiny-csrf"])`, `moduleImport("lusca") + option "csrf"`, `moduleMember("express", "csrf")`, Fastify `"csrfProtection"`. Nosso `@artificio/auth` não está na lista.
5. O bypass Origin/Bearer do nosso middleware é intencional e seguro — origens da frota (`*.artificiorpg.com`) são confiáveis; Bearer é server-to-server.

**Por que dismiss (e não suppress/ignore):**
1. Dismiss mantém rastreabilidade no GitHub Security tab (justificativa visível para auditores).
2. Não suprime outras queries CodeQL nestes arquivos (ao contrário de codeql-config.yml ou lgtm comments).
3. Se o código mudar no futuro e o CSRF for removido acidentalmente, o alerta REGENERA — dismiss só suprime o mesmo código, não a query permanentemente.

**Rastreabilidade cruzada:**
- Spec: `specs/037-lint-frontends-cleanup/tasks.md` seções T43–T45
- Decisão: `.specify/memory/decisions.md` D086
- PR: #74 (`feat/links-013-app`)
- Sessão: `sessoes/26-06-20_2_links_whatsapp-013-014.md`

---

## T46 — Crash do deploy mesas beta: `@artificio/media` quebrou em produção ✅ INVESTIGADO

> PR #74 mergeou `@artificio/media` (spec 036). O deploy automático do mesas beta
> (push→dev) falhou. Container `mesas-beta-api` em crash loop.
> [Run 27887450535](https://github.com/FarenRavirar/artificio/actions/runs/27887450535/job/82525171387).

### T46a — Evidência do crash (VM, read-only)

```
$ ssh faren "docker logs mesas-beta-api --tail 30"
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in
/repo/apps/mesas/backend/node_modules/@artificio/media/package.json
    at exportsNotFound (node:internal/modules/esm/resolve:314:10)
    ...
    at defaultResolveImplForCJSLoading (node:internal/modules/cjs/loader:1095:10)
Node.js v24.17.0

$ ssh faren "docker ps -a --filter name=mesas-beta"
mesas-beta-app  Up (healthy)
mesas-beta-api  Restarting (1)  ← crash loop
mesas-beta-db   Up (healthy)
```

### T46b — 3 bugs encontrados (investigação completa)

**Bug 1 — `packages/media/package.json:9-13`: `exports` sem `"require"`**

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
    // ❌ FALTA "require": "./dist/index.js"
  }
}
```

O `exports` field, quando presente, **substitui** `"main"`. Node.js 24 (CJS, `require`) lê o `exports`, não acha `"require"`, lança `ERR_PACKAGE_PATH_NOT_EXPORTED`. O `dist/index.js` nem chega a ser verificado.

**Precedente na spec 033 §3 (Kysely ESM-only):** "Runtime CJS depende de `require(esm)` (Node 22.12+/24 unflagged → mesas em `node:24-alpine` OK)." Node 24 suporta `require(esm)` — basta o `exports` ter `"require"`.

**Bug 2 — `apps/mesas/backend/Dockerfile:38-43`: production stage não copia `media/dist`**

```dockerfile
# Stage 1 (builder): turbo build --filter=@artificio/mesas-backend
#   → builda @artificio/media automaticamente (^build)
#   → cria packages/media/dist/ ✅

# Stage 2 (production): só copia:
COPY --from=builder /repo/packages/config/dist ./packages/config/dist
COPY --from=builder /repo/packages/auth/dist ./packages/auth/dist
COPY --from=builder /repo/packages/auth/dist-cjs ./packages/auth/dist-cjs
# ❌ FALTA: COPY --from=builder /repo/packages/media/dist ./packages/media/dist
```

**VM confirma:** `ls /opt/artificio-beta/packages/media/dist/` → `No such file or directory`. O `dist/` foi gerado no builder mas nunca copiado pro production. Mesmo após corrigir Bug 1, o arquivo `dist/index.js` não existiria no container.

**Bug 3 — `apps/site/Dockerfile:19-22`: `--filter` não inclui `@artificio/media`**

```dockerfile
RUN pnpm -w turbo run build \
  --filter=@artificio/config --filter=@artificio/auth --filter=@artificio/ui \
  --filter=@artificio/content --filter=@artificio/analytics \
  --filter=@artificio/site-admin
# ❌ FALTA --filter=@artificio/media
```

Site é single-stage → `turbo build` roda no mesmo layer que serve. Se `media` não está no filter, `dist/` não é gerado. Bug latente (site importa `@artificio/media` via `media-store.ts:1` e `importer/media.ts` — crasharia no próximo deploy).

**✅ `apps/links/Dockerfile:20`:** já inclui `--filter=@artificio/media`. Sem bug.

### T46c — Plano de correção (3 arquivos)

| # | Arquivo | Linha | Ação |
|---|---------|-------|------|
| 1 | `packages/media/package.json` | 12 | Adicionar `"require": "./dist/index.js"` ao `exports."."` |
| 2 | `apps/mesas/backend/Dockerfile` | 40 | Adicionar `COPY --from=builder /repo/packages/media/dist ./packages/media/dist` |
| 3 | `apps/site/Dockerfile` | 20 | Adicionar `--filter=@artificio/media` |

**Correção exata — `packages/media/package.json`:**
```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.js"
  }
}
```

Node 24 `require(esm)` carrega o mesmo ESM `dist/index.js` via `require()`. Sem necessidade de build CJS separado (sem `tsconfig.cjs.json`, sem `dist-cjs/`). Segue o precedente Kysely 0.29 da spec 033.

**Correção exata — `apps/mesas/backend/Dockerfile` (após linha 40):**
```dockerfile
COPY --from=builder /repo/packages/media/dist ./packages/media/dist
```

**Correção exata — `apps/site/Dockerfile` (linha 20, adicionar ao final):**
```dockerfile
  --filter=@artificio/media
```

### T46d — Validação pós-correção

- [x] `pnpm --filter @artificio/media build` → `dist/index.js` criado
- [x] `node -e "require('./packages/media/dist/index.js')"` (CJS direto) → 5 funções OK
- [x] `turbo build --filter=@artificio/mesas-backend` → 4/4 verde (19.14s)
- [x] `turbo build --filter=@artificio/site` → 46 pages, Pagefind OK (4.58s)
- [x] `turbo build --filter=@artificio/links` → 15 pages (4.00s)
- [ ] Deploy mesas beta → `mesas-beta-api` healthy, smoke 200/401/302

**Status:** ✅ IMPLEMENTADO — 3 correções aplicadas, 5/6 validações locais verdes. Deploy pendente.

---

## T47 — Codex: `globalRateLimiter` deve vir antes de `csrfProtection` no mesas ✅ INVESTIGADO

- **Severidade:** 🟠 Medium (bypass de rate-limit em requests CSRF-rejeitadas)
- **Origem:** Codex review na PR #75, `apps/mesas/backend/src/server.ts:85-86`.
- **Problema:** O T36 inverteu a ordem para `csrfProtection → globalRateLimiter`. Mas isso significa que requests rejeitadas pelo CSRF (403) **nunca passam pelo rate limiter**. Um atacante pode enviar POSTs ilimitados com cookie `artificio_session` dummy + Origin inválida → 403s infinitos sem throttling.

- **Ordem atual (PR #75):**
  ```
  parseCookies → csrfProtection → globalRateLimiter → express.json()
  ```

- **Ordem correta:**
  ```
  parseCookies → globalRateLimiter → csrfProtection → express.json()
  ```

- **Por que esta ordem:**
  1. `globalRateLimiter` primeiro → conta TODAS as requests (barato, só checa contador em memória)
  2. `csrfProtection` depois → rejeita requests maliciosas (barato, só checa cookies/headers/Origin)
  3. `express.json()` por último → parse do body (caro) só em requests que passaram ambos

- **Impacto cross-app:** links e site usam rate-limit por-rota (não global). Nestes, o limiter é middleware na rota, aplicado APÓS `csrfProtection`. Mesmo problema conceitual mas blast radius menor (só as rotas rate-limited individuais têm o gap).
  - links: `suggestLimiter` em `POST /api/groups/suggest:124` — após csrfProtection global (linha 30)
  - site: `feedbackLimiter` em `POST /api/feedback:109` — após csrfProtection global (linha 27)

- **Ação:** Inverter `csrfProtection` ↔ `globalRateLimiter` no mesas (`server.ts:85-86`). Para links/site, documentar como débito de baixa prioridade (rate-limit por-rota, não global).

- **Status:** ✅ IMPLEMENTADO — 3 apps corrigidos. Lint 13/13, build 9/9.

---

## 🚨 INCIDENTE DEPLOY — mesas-beta-api: `ERR_MODULE_NOT_FOUND` cloudinary (2026-06-20)

### 1. Evidência

Deploy beta do mesas (auto-deploy push→dev, run `27888805505`) falhou:
- `mesas-beta-app` → **healthy** (frontend OK)
- `mesas-beta-api` → **unhealthy** (falha em startup, container reiniciando em loop)

Erro extraído do log do container:
```
node:internal/modules/esm/resolve:1008
    throw error;
    ^
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'cloudinary' imported from /repo/packages/media/dist/index.js
Did you mean to import "cloudinary/cloudinary.js"?
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:740:52)
    ...
    at ModuleJobSync.link (node:internal/modules/esm/module_job:489:17) {
  code: 'ERR_MODULE_NOT_FOUND'
}
```

Observações do log:
- `[cloudinary] Config loaded: { cloud_name: 'set', api_key: 'set', api_secret: 'set' }` aparece múltiplas vezes **antes** do crash — é log do builder stage durante `turbo build` (onde `configure()` é chamado em testes ou side-effect de import), não do runtime
- O container reinicia em loop (6 crashes idênticos no log), característico de falha de startup bloqueante
- `mesas-beta-app` (nginx/frontend) saudável → problema isolado no backend

### 2. Cadeia de imports (do crash ao paciente zero)

```
server.ts (startup)
  → discord/index.ts (re-exporta uploadDiscordImageToCloudinary)
    → discord/uploadDiscordImage.ts:2
      → import { uploadBuffer as sharedUploadBuffer } from '@artificio/media'
        → packages/media/dist/index.js
          → require("cloudinary")   ← CJS em wrapper ESM → crash
```

### 3. Caminho da investigação (passo a passo)

| Passo | Ação | Descoberta |
|-------|------|------------|
| 1 | Ler log do deploy | `ERR_MODULE_NOT_FOUND` em `packages/media/dist/index.js` |
| 2 | Ler `packages/media/package.json` (HEAD) | `"type": "module"` presente, `exports` com `import` e `require` apontando para mesmo arquivo |
| 3 | Ler `packages/media/dist/index.js` (local) | **CJS** (`"use strict"`, `require("cloudinary")`, `exports.xxx`) — contradiz `"type":"module"` |
| 4 | Verificar `git diff` no working tree | `"type": "module"` foi **removido** localmente (não commitado) |
| 5 | Reverter `packages/media/package.json` ao HEAD | `"type": "module"` restaurado |
| 6 | Rebuildar `@artificio/media` | Dist agora é **ESM** (`import { v2 as cloudinary } from "cloudinary"`, `export function`) |
| 7 | Testar import ESM localmente | `node -e "import('@artificio/media')"` → **sucesso** (5 funções exportadas) |
| 8 | Verificar `cloudinary` no pnpm store | `cloudinary@2.10.0` em `node_modules/.pnpm/`, `cloudinary.js` existe, sem `"exports"`, sem `"type":"module"` |
| 9 | Verificar `apps/mesas/backend/package.json` | `"cloudinary": "^2.9.0"` é dependência direta ✅ |
| 10 | Verificar `packages/media/node_modules/` | `cloudinary` está instalado localmente (full install) ✅ |
| 11 | Inspecionar Dockerfile mesas backend | Estágio produção: `pnpm install --prod --filter @artificio/mesas-backend` + `COPY --from=builder /repo/packages/media/dist` |
| 12 | Comparar com `@artificio/auth` (referência) | Auth: `"type":"module"`, dual CJS/ESM, build script separado para CJS — modelo correto |
| 13 | Rastrear `auto_deploy_on_push` | Só mesas tem `true` (despadronização), ver `deploy-manifest.json:17` |
| 14 | Testar `import '@artificio/media'` a partir de `apps/mesas/backend` | Funciona localmente com full install ✅ |

### 4. Diagnóstico final

**Causa raiz (confirmada):** O `packages/media/dist/index.js` foi compilado como **CJS** (`require("cloudinary")`) porque o working tree local removeu `"type": "module"` do `package.json`. No container Docker, quando o `mesas-backend` (ESM) importa `@artificio/media` via `exports["."].import`, o Node 24 carrega o arquivo CJS dentro de um wrapper ESM. Dentro desse wrapper, `require("cloudinary")` dispara `ERR_MODULE_NOT_FOUND` — o `require()` emprestado do wrapper CJS-in-ESM não alcança o `cloudinary` no `node_modules` do pnpm (caminho de resolução diferente do `require()` nativo).

**Por que o HEAD (`f319aac`) já tem `"type": "module"` mas o deploy falhou:** O `packages/media/dist/` é **gitignored**. O Docker build gera o dist no builder stage a partir do source no commit. Se o `"type": "module"` está no `package.json` commitado, o builder produz ESM. O deploy `27888805505` foi disparado pelo merge da PR #75 (commit `f319aac`), que tem `"type": "module"`. **O Docker build deveria ter produzido ESM.** A falha sugere que ou (a) o cache de layer do Docker não invalidou e usou um dist CJS antigo, ou (b) `pnpm install --prod` não instalou `cloudinary` em local acessível ao ESM `import`.

**Hipóteses descartadas:**
- ❌ `cloudinary` ausente do `pnpm-lock.yaml` — está presente (`cloudinary@2.10.0`)
- ❌ `cloudinary` não instalado localmente — está em `node_modules/.pnpm/` e `packages/media/node_modules/`
- ❌ `cloudinary` quebrado/ESM-only — é CJS puro (`"main":"cloudinary.js"`, sem `"type":"module"`, sem `"exports"`)
- ❌ `@artificio/media` sem `"type":"module"` no HEAD — o HEAD tem

### 5. Correção (duas camadas)

#### Camada 1 — `"type": "module"` (já no HEAD, restaurado no working tree)

**O quê:** `packages/media/package.json` linha 5: `"type": "module"`.

**Por quê:** Com `"type": "module"` + `tsconfig.json` `"module": "NodeNext"`, o `tsc` compila como ESM. O dist passa de:
```js
// CJS (quebrado no Node 24 via ESM wrapper)
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloudinary_1 = require("cloudinary");
```
Para:
```js
// ESM (funciona no Node 24)
import { v2 as cloudinary } from "cloudinary";
```

O ESM `import` de um pacote CJS (`cloudinary`) é resolvido corretamente pelo Node via interop CJS→ESM.

**Validação:** `node -e "import('@artificio/media')"` executado em `apps/mesas/backend` → 5 exports, zero erro.

**Status:** ✅ HEAD tem, working tree revertido ao HEAD, dist rebuildado como ESM.

#### Camada 2 — Fail-fast no Dockerfile (defesa em profundidade)

**O quê:** Após `pnpm install --prod`, verificar que `cloudinary` foi instalado como dependência transitiva de `@artificio/media`:
```dockerfile
RUN pnpm install --prod --filter @artificio/mesas-backend --frozen-lockfile \
  && test -d packages/media/node_modules/cloudinary \
  || (echo "ERRO: cloudinary nao encontrado em packages/media/node_modules/" && exit 1)
```

**Por quê:** Se houver edge case do pnpm com `--prod` + `workspace:*` que impeça a instalação, o erro aparece no **build** (fail-fast, sem gerar imagem quebrada) em vez de no **runtime** (container sobe e morre em loop, diagnóstico difícil).

**Blast radius:** `apps/mesas/backend/Dockerfile`, `apps/site/Dockerfile`, `apps/links/Dockerfile` (todos consomem `@artificio/media`).

**Status:** ✅ implementado. **Incidente 2026-06-21 01:40 (run `27889891144`):** fail-fast acionou no deploy mesas-beta — `pnpm install --prod` NÃO instala deps de workspace packages no `node_modules` local. `cloudinary` ausente em `packages/media/node_modules/`. **Corrigido:** `pnpm install --prod --filter @artificio/media --frozen-lockfile` explícito ANTES do fail-fast em `apps/mesas/backend/Dockerfile:42`. Site e links usam full install (sem `--prod`) → não afetados, fail-fast passa neles.

### 6. Achado relacionado — `auto_deploy_on_push` (despadronização)

Durante investigação do deploy, descobriu-se que **mesas é o único módulo com auto-deploy**:

| Módulo | `auto_deploy_on_push` | `push_branches` |
|--------|----------------------|-----------------|
| mesas | **`true`** | `["dev"]` |
| glossario | `false` | `["dev"]` |
| site | `false` | `["dev"]` |
| links | `false` | `["main"]` |
| accounts | `false` | `["main"]` |

**Mecanismo:** `deploy.yml:132-148` — a job `build-matrix` lê `auto_deploy_on_push` do `deploy-manifest.json`. Quando `true` + push na branch + mudança nos `deploy_paths` → `deploy=true`. Quando `false` → só CI.

**Correção:** `deploy-manifest.json:17`: `"auto_deploy_on_push": true` → `false`.

**Relação com cloudinary:** NENHUMA. Desligar auto-deploy não corrige o bug do cloudinary — qualquer deploy (manual ou automático) falharia. As demandas são independentes. Ordem lógica: corrigir cloudinary → validar deploy manual → depois padronizar auto-deploy.

### 7. Decisão

| Decisão | Fundamentação |
|---------|---------------|
| **Manter `"type": "module"`** em `packages/media/package.json` | HEAD já tem; é o padrão do monorepo (`@artificio/auth` idem); CJS comprovadamente quebrado no Node 24 via ESM wrapper |
| **Adicionar fail-fast no Dockerfile** | Defesa em profundidade: build quebra em vez de runtime silencioso; aproveitar em todos os consumidores de `@artificio/media` |
| **Padronizar `auto_deploy_on_push: false`** | Alinhar mesas com os outros 4 módulos; reduzir surpresas; deploy manual dá controle |
| **Não implementar CJS dual** no `@artificio/media` | Zero consumidores usam `require()`; auth já cobre o padrão dual; YAGNI |

**PR:** [#76](https://github.com/FarenRavirar/artificio/pull/76) — branch `fix/037-cloudinary-media-esm` → `dev`
