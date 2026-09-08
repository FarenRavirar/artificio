# Plano — 037

## Arquitetura da solução

Refator por arquivo, agrupado por regra. Sem afrouxar config. Cada `useEffect`
que chama `setState` síncrono é convertido para o padrão correto:

- Estado que deriva de props/estado → calcular em render ou `useMemo` (eliminar
  o effect).
- Sincronização legítima com sistema externo (fetch) → mover o `setState` para
  callback assíncrono (`.then`/`await`), que a regra permite.
- `static-components` → mover componentes definidos dentro de componente para
  fora (escopo de módulo).
- `only-export-components` → mover constantes/contextos não-componente para
  arquivo separado.
- `no-explicit-any` → tipo concreto ou `unknown` + narrowing.
- `preserve-caught-error` → `throw new Error(msg, { cause: err })`.
- `immutability` → não mutar estado/props; copiar.

## Arquivos afetados (por módulo/pacote)

### apps/glossario/frontend (50)
- `src/App.tsx`, `src/components/{AddTermModal,GlossarioHeader,ImportPreview,ResultCard}.tsx`,
  `src/context/AuthContext.tsx`, `src/hooks/useGlossario.ts`,
  `src/pages/{AdminActivityPage,AdminFeedbackPage,AdminReviewPage,AdminStructurePage,AdminUsersPage,ImportPage,MigrationPage,NotificationsPage}.tsx`

### apps/mesas/frontend (29)
- `src/components/{ScenarioEditModal,SettingStylesField,SystemSuggestionResolutionDrawer}.tsx`,
  `src/contexts/AuthContext.tsx`,
  `src/features/admin/components/EntityInspector.tsx`,
  `src/features/create-table/components/CreateTableForm.tsx`,
  `src/features/discord-sync/components/{DiscordDraftPreview,DiscordDraftReviewTable,DiscordSettingsPanel,DiscordSyncPanel}.tsx`,
  `src/hooks/{useLinks,useProfile}.ts`,
  `src/modules/admin/...`, `src/pages/{GestaoPage,MesaPage,PainelMestrePage,ProfileEditPage,ScenariosAdminView}.tsx`

## Contratos/interfaces tocados

Nenhum: só código interno dos frontends. Sem auth/accounts/DNS/schema.

## Impacto em consumidores

Nenhum externo. Apps isolados por subdomínio.

## Rollback

`git revert` da PR. Sem migração/estado.

## Validação

- `pnpm --filter <pkg> lint` exit 0 (2 pacotes).
- `pnpm -w turbo run lint` 13/13.
- `pnpm --filter <pkg> build` + `tsc --noEmit` verdes.
- Smoke manual das telas refatoradas (effects de fetch/derivação).

## Estado da execução

- **glossario-frontend: CONCLUÍDO** — lint exit 0 + `tsc --noEmit` exit 0.
  Arquivos novos: `src/context/UIContext.ts`, `src/context/auth-context.ts`,
  `src/lib/api-error.ts`. `tsconfig.json` ganhou `ES2022.Error` no `lib`.
- **mesas-frontend: CONCLUÍDO** — lint exit 0 + `tsc --noEmit` exit 0.
- **CodeQL (T17–T18): CONCLUÍDO** — path-injection (T17) + rate-limit (T18) em links/server.ts.
  T19 (CSRF `@artificio/auth`) **BLOQUEADO** — exige pré-voo cross-frota aprovado.
  T20 (re-run CodeQL) **BLOQUEADO** — depende de T19 + deploy.
- **CodeRabbit Categoria A (T21–T26): CONCLUÍDO** — 6 bugs em links corrigidos:
  deleteTag transacional, res.ok em add/remove, jobBusy, setError(false),
  JSON-LD escape (2 locais), button→span + seletor JS.
- **CodeRabbit Categoria D (T27–T33): CONCLUÍDO** — 7 bugs em glossario/mesas corrigidos:
  ScenarioEditModal regressão 037/T8, PainelMestrePage else+defer, AddTermModal .catch,
  GlossarioHeader localStorage try-catch, CreateTableForm stale clear,
  ImportPage Array.isArray+summary, ProfileEditPage ref de transição.
- **Validação final:** lint 13/13 ✅, glossario build 1579 mods ✅, mesas build 2230 mods ✅, links build 15p ✅.
- **NADA commitado.** Branch corrente: `feat/links-013-app` (PR #74).

---

## Handoff — execução por outra IA (CodeQL T17–T20 + CodeRabbit T21–T33)

> Auditado read-only 2026-06-20. Contrato de execução. Atualiza a nota acima:
> o trabalho de CSRF **toca `@artificio/auth` (pacote compartilhado)** — deixou
> de ser "só frontends". Tratar como contrato cross-frota.

### Regras invioláveis (AGENTS.md)
- **Sem caminho feliz, sem mascarar.** Proibido `eslint-disable`/`@ts-ignore`/
  `continue-on-error`/`.skip` pra "passar". Erro achado = corrige de verdade ou PARA e pergunta.
- **Gate da 037 não pode regredir.** Após CADA task: `pnpm -w turbo run lint`
  13/13 + `tsc --noEmit` + build dos pacotes tocados, todos verdes.
- **Nada de commit/push/PR** sem autorização nominal do mantenedor por ação.

### Prontidão por task
**PRONTAS (instrução completa):**
- **T17** path-injection links/server.ts:332 — validar `slug === slugify(slug)`
  (import de `./lib/slug.js`) + containment `filePath.startsWith(resolve(DIST,"grupo") + sep)`
  (import `sep` de `node:path`); falha → `next()` (404 normal). Não tocar disco antes da validação.
- **T18** rate-limit — espelhar `suggestLimiter` (server.ts:95, `express-rate-limit`,
  `standardHeaders:true, legacyHeaders:false`). `publicLimiter` (~120/min) em
  `/grupo/:slug` (linha 330) e no fallback 404 (linha 345); `adminLimiter` (~60/min)
  no `admin.use(...)` (linha 127). `trust proxy` já setado (linha 25).
- **T21** deleteTag — `db.transaction().execute(async (trx) => { ... })`, trocar `db`→`trx`
  nas 2 ops (groups.ts:157,159); `sql\`array_remove\`` inalterado.
- **T22, T24** AdminPanel — checar `res.ok` antes de `setLabel("")/onChanged()`; `setError(false)` no sucesso do reload.
- **T25** JSON-LD — `JSON.stringify(x).replace(/</g, "\\u003c")` em render.ts:64 E Base.astro:65 (2 locais).
- **T26** GroupCard.astro:24 — `<button>`→`<span role="button" tabindex="0">` + ATUALIZAR seletor JS `Base.astro:80` (`.adult-overlay button` → novo seletor). Sem atualizar o seletor = overlay quebra.
- **T27** ScenarioEditModal:39 — `useState<Scenario | null>(null)` (REGRESSÃO da 037/T8). Mesmo padrão em qualquer outro snapshot inicializado com a prop.
- **T28** PainelMestrePage:364 — adicionar else: quando `!editIdFromUrl`, zerar `editingTableId`/`editingTableData` (não só `return`).
- **T29–T33** — conforme tasks.md (catch, localStorage try-catch, clear stale, Array.isArray, ref de transição).

**INSTRUÇÃO INCOMPLETA — completar antes de executar:**
- **T23** jobBusy — trocar linha 321 p/ `res.json({ busy: jobBusy(), job: jobState() })`
  MUDA o shape de `/rebuild/status`. **Verificar e ajustar o consumidor no frontend**
  (AdminPanel — polling de rebuild) na MESMA task, senão o painel quebra.

**🛑 NÃO EXECUTAR sem pré-voo — T19 (CSRF central):**
- **Pré-voo obrigatório:** enumerar TODA escrita autenticada cross-origin da frota
  (POST/PUT/PATCH/DELETE de links/mesas/glossario/site → outra app, com cookie
  `artificio_session`). Confirmado já: `refreshSession` e `/api/auth/me` são GET
  (bypass safe-method, OK). Qualquer mutação cross-origin não-Bearer e não-allowlistada
  tomará 403. Sem esse mapa completo, **não montar** CSRF global no accounts.
- **Implementação (após pré-voo):** promover `apps/mesas/backend/src/middleware/csrfProtection.ts`
  para `packages/auth/src/csrf.ts` (parametrizado: `csrfProtection(allowedOrigins)`).
  Re-exportar em `index.ts` **E** `index-cjs.ts` (dual ESM/CJS — senão `require` quebra).
  Montar em links/site/accounts **logo após** `cookieParser()`. Allowlist via
  `FRONTEND_URL`/`FRONTEND_URLS` (padrão mesas), **incluindo a própria origem pública
  do app** (admin same-origin manda header `Origin`). mesas mantém o middleware atual
  (ou migra depois, fora desta leva).
- **Aceite T19:** CodeQL `js/missing-token-validation` zera nos 3; SSO (login/refresh/
  logout/me) funciona cross-subdomínio; admin same-origin não toma 403; lint+build do
  pacote auth e dos 3 apps verdes.

### Ordem sugerida
1. Alta + pronta: T17, T21, T22, T27, T28. 2. T18, T23 (com consumidor), T24–T26, T29–T33.
3. T19 só após pré-voo aprovado pelo mantenedor.
