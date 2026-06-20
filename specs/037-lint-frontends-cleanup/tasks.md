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
