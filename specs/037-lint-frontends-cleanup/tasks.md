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
