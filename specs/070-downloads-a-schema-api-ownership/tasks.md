# Tasks — Spec 070 (Downloads-A)

## F0 — Preparação

- [x] T0.1 — Reler estado vigente da API central 062 (não usar memória desta spec como fonte). Confirmado via `artificio-api-governance`: `GET /api/catalog/v1/systems` (público) e `/api/admin/v1/catalog/systems` (admin) já em prod no app `site`; `packages/catalog-client` já existe como cliente compartilhado (`catalogFetch`, `checkCatalogHealth`, `flattenTree`).
- [x] T0.2 — Levantar padrão de schema/migration mais recente (referência: `apps/mesas`). Confirmado header pétreo de 5 campos (`apps/mesas/database/migration_144_...sql`), padrão `db/index.ts` (Kysely + Proxy lazy singleton) e `db/types.ts` (Selectable/Insertable/Updateable) via Serena.

## F1 — Schema

- [x] T1.1 — Migration `download_material` + `download_material_version` (com histórico por campo).
- [x] T1.2 — Migration `download_material_metadata`.
- [x] T1.3 — Migration `download_creator`.
- [x] T1.4 — Migration `download_evidence` (sem coluna de expurgo).
- [x] T1.5 — Migration `download_report`.
- [x] T1.6 — Migration `download_favorite`, `download_collection`, `download_collection_item`.
- [x] T1.7 — Migration `download_link_check`.
- [x] T1.8 — Migration `download_metric_daily` (ou agregado equivalente).
- [x] T1.9 — Índices mínimos (slug único, composto catálogo, moderação, trigram, criador_id).
- [x] T1.10 — Tipos Kysely.

## F2 — API base

- [x] T2.1 — Rotas de leitura pública (catálogo/ficha) sem sessão. (Só ficha por slug — listagem/busca é escopo da 073, DEB-070-02.)
- [x] T2.2 — Rotas de escrita autenticadas (criar/editar material).
- [x] T2.3 — Middleware de auth via `@artificio/auth`.
- [x] T2.4 — Cliente de consumo da API central 062 (leitura de sistema/edição). Via `@artificio/catalog-client` (reuso, sem duplicação).

## F3 — Ownership

- [x] T3.1 — Roles (usuário, publicador, moderador, admin).
- [x] T3.2 — Teste de integração: publicador não edita material de terceiro. `materials.ownership.test.ts` — 2/2 verde.

## F4 — Governança

- [x] T4.1 — `pnpm verify:api` verde. Exigiu registrar `downloads` em 5 scripts (`inventory.ts`, `diff-api.ts`, `build-docs.ts`, `lint-openapi.ts`, `generate-openapi.ts`, `traffic.ts`) — autorizado nominalmente pelo mantenedor por tocar `scripts/api/**` (infra compartilhada).
- [x] T4.2 — Bundle de governança atualizado. `downloads` aparece com 4 rotas (`getapi_v1_health`, `postapi_v1_materials`, `patchapi_v1_materials_id`, `getapi_v1_materials_slug`).

## F5 — Validação

- [x] T5.1 — lint + build + test locais. `pnpm run lint` 20/20 ✅; `pnpm run build` 20/20 ✅; `pnpm --filter @artificio/downloads-backend test` 1 arquivo/2 testes ✅; `pnpm verify:api` exit 0 ✅.
- [x] T5.2 — Registrar evidência na sessão; sem commit até autorização nominal. Registrado em `debitos.md` (DEB-070-01/02/03) e `project-state.md`. **Nenhum commit feito.**
