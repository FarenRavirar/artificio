# Plano — 060

## Arquitetura da solução

Backend: estender `adminTables.ts` com 2 rotas novas (`GET /admin/tables`,
`GET /admin/tables/:id`), reusando a query já existente em `gmPanel.ts`
(linha ~780) menos o filtro `where gm_id`. Novo método
`TableRepository.findById` (sem `AndGm`).

Frontend: `ConteudoSection.tsx` troca a fonte de dados da aba de mesas de
`GET /api/v1/tables` (pública, active-only) para `GET /admin/tables`
(novo, todos status). Adiciona dropdown de filtro por status. Remove o
guard que bloqueia `draft` em `handleToggleTableStatus`.

**Gate de copia:** ao carregar draft/outros status alem de active, o botao
"Copiar anuncio" (spec 059) deve ficar oculto/desabilitado para mesas com
`status !== 'active'` ou `archived_at is not null`, seguindo a decisao da
spec 059: copiar somente mesas publicadas/ativas e nao arquivadas. Nao
expor acao de copia para rascunho/cancelada/arquivada.

## Arquivos afetados

- `apps/mesas/backend/src/repositories/tableRepository.ts` — método novo
  `findById(tableId)`.
- `apps/mesas/backend/src/routes/adminTables.ts` — `GET /tables` (lista,
  com `?status=`), `GET /tables/:id` (detalhe).
- `apps/mesas/frontend/src/features/admin/components/ConteudoSection.tsx`
  — troca fonte de dados, filtro de status, remove guard de draft.
- Testes: `apps/mesas/backend/src/routes/adminTables.test.ts` (casos
  novos), smoke frontend se houver suite de `ConteudoSection`.

## Contratos/interfaces tocados

- API pública nova: `GET /api/v1/admin/tables`, `GET /api/v1/admin/tables/:id`.
  Precisa passar por `pnpm verify:api` (gera OpenAPI automaticamente).
- Sem mudança em `packages/*`, sem mudança em auth/SSO.

## Impacto em consumidores

- Só `ConteudoSection.tsx` consome a rota nova nesta spec. Nenhum outro
  app/módulo é afetado.
- Rotas existentes (`GET /api/v1/tables`, `GET /gm/tables`) não mudam —
  sem regressão no catálogo público nem no painel de GM.

## Rollback

- Reverter PR: rotas novas são aditivas (não alteram comportamento de
  rotas existentes), revert simples sem migration.

## Validação

- `pnpm run lint` + `pnpm run build` (mesas backend + frontend).
- Testes automatizados novos para as 2 rotas (`role !== admin` → 403;
  filtro de status; leitura por ID sem gm_id).
- Smoke manual descrito no critério de aceite da spec.
