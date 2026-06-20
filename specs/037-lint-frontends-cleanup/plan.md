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
- **mesas-frontend: PENDENTE** — 29 erros (28 `set-state-in-effect`, 1
  `exhaustive-deps`, 1 `immutability`). Aplicar os padrões reutilizáveis
  documentados em `tasks.md`. `@artificio/mesas#lint` só delega ao frontend;
  `@artificio/mesas-backend` tem `lint=none` (fora de escopo).
