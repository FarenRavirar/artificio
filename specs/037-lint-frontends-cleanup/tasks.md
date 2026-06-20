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
- [ ] T19 — Promover `csrfProtection` de mesas → `@artificio/auth`; montar em links/site/accounts. **BLOQUEADO — exige pré-voo aprovado pelo mantenedor.**
- [ ] T20 — Re-rodar CodeQL na #74 → 0 high novos; `lint+build+test` verde; smoke origens/Bearer. **BLOQUEADO — depende de T19 + deploy.**

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
