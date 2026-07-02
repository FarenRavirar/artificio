# Índice de API — Artifício RPG (gerado)

> **Fonte primária de descoberta de API para agentes de IA.** Gerado por `scripts/api/bundle-api.ts`.
> Bundle machine-readable: `docs/api/generated/artificio-api.bundle.json`.
> Não editar à mão. Regenerar com `pnpm api:bundle` (faz parte de `pnpm verify:api`).

Total: **282 operações**.

## accounts (11)

| Método | Path | Scope | Auth | Status | Consumidores | Resumo |
|--------|------|-------|------|--------|--------------|--------|
| GET | `/` | public-page | none | active | — | Consulta raiz |
| GET | `/admin/secrets/{name}` | admin | service | provisional | mesas-backend | Recupera um segredo descriptografado (admin ou service-token) |
| PUT | `/admin/secrets/{name}` | admin | admin | provisional | — | Armazena um segredo criptografado (admin) |
| GET | `/api/auth/google` | external | none | active | — | Consulta api auth google |
| GET | `/api/auth/google/callback` | external | none | active | — | Consulta api auth google callback |
| POST | `/api/auth/logout` | cross-app | user | active | mesas-frontend, glossario-frontend, links-frontend, site-admin | Cria ou executa api auth logout |
| GET | `/api/auth/me` | cross-app | user | active | mesas-frontend, glossario-frontend, links-frontend, site-admin | Consulta api auth me |
| GET | `/api/auth/refresh` | cross-app | user | active | mesas-frontend, glossario-frontend, links-frontend, site-admin | Consulta api auth refresh |
| GET | `/conta` | public-page | none | active | — | Consulta conta |
| GET | `/health` | internal | none | active | — | Consulta health |
| GET | `/login` | public-page | none | active | — | Consulta login |

## glossario (46)

| Método | Path | Scope | Auth | Status | Consumidores | Resumo |
|--------|------|-------|------|--------|--------------|--------|
| GET | `/api/admin/activity` | admin | admin | active | — | Consulta api admin activity |
| GET | `/api/admin/feedback` | admin | admin | active | — | Consulta api admin feedback |
| DELETE | `/api/admin/feedback/{id}` | admin | admin | active | — | Remove api admin feedback id |
| PATCH | `/api/admin/feedback/{id}` | admin | admin | active | — | Atualiza api admin feedback id |
| POST | `/api/auth/login` | legacy | none | legacy | — | Cria ou executa api auth login |
| GET | `/api/auth/me` | public | user | active | — | Consulta api auth me |
| POST | `/api/auth/register` | legacy | none | legacy | — | Cria ou executa api auth register |
| GET | `/api/categories` | public | none | active | — | Consulta api categories |
| POST | `/api/categories` | public | user | active | — | Cria ou executa api categories |
| DELETE | `/api/categories/{id}` | admin | admin | active | — | Remove api categories id |
| PUT | `/api/categories/{id}` | admin | admin | active | — | Substitui api categories id |
| GET | `/api/changelog` | public | none | active | — | Consulta api changelog |
| GET | `/api/export/matecat` | public | none | active | — | Consulta api export matecat |
| POST | `/api/feedback` | public | user | active | — | Cria ou executa api feedback |
| POST | `/api/migration/claim` | public | user | active | — | Cria ou executa api migration claim |
| POST | `/api/migration/verify` | public | user | active | — | Cria ou executa api migration verify |
| GET | `/api/notifications` | public | user | active | — | Consulta api notifications |
| PATCH | `/api/notifications/{id}/read` | public | user | active | — | Atualiza api notifications id read |
| PATCH | `/api/notifications/read-all` | public | user | active | — | Atualiza api notifications read-all |
| GET | `/api/scenarios` | public | none | active | — | Consulta api scenarios |
| POST | `/api/scenarios` | public | user | active | — | Cria ou executa api scenarios |
| DELETE | `/api/scenarios/{id}` | admin | admin | active | — | Remove api scenarios id |
| PUT | `/api/scenarios/{id}` | admin | admin | active | — | Substitui api scenarios id |
| GET | `/api/social/{id}/comments` | public | none | active | — | Consulta api social id comments |
| POST | `/api/social/{id}/comments` | public | user | active | — | Cria ou executa api social id comments |
| POST | `/api/social/{id}/vote` | public | user | active | — | Cria ou executa api social id vote |
| DELETE | `/api/social/comments/{id}` | public | user | active | — | Remove api social comments id |
| GET | `/api/systems` | public | none | active | — | Consulta api systems |
| POST | `/api/systems` | public | user | active | — | Cria ou executa api systems |
| DELETE | `/api/systems/{id}` | admin | admin | active | — | Remove api systems id |
| PUT | `/api/systems/{id}` | admin | admin | active | — | Substitui api systems id |
| GET | `/api/systems/{systemId}/editions` | public | none | active | — | Consulta api systems systemId editions |
| POST | `/api/systems/{systemId}/editions` | public | user | active | — | Cria ou executa api systems systemId editions |
| DELETE | `/api/systems/editions/{id}` | admin | admin | active | — | Remove api systems editions id |
| PUT | `/api/systems/editions/{id}` | admin | admin | active | — | Substitui api systems editions id |
| GET | `/api/terms` | public | none | active | — | Consulta api terms |
| POST | `/api/terms` | public | user | active | — | Cria ou executa api terms |
| DELETE | `/api/terms/{id}` | public | user | active | — | Remove api terms id |
| PATCH | `/api/terms/{id}` | public | user | active | — | Atualiza api terms id |
| PATCH | `/api/terms/{id}/approve` | public | user | active | — | Atualiza api terms id approve |
| GET | `/api/terms/{id}/history` | public | none | active | — | Consulta api terms id history |
| POST | `/api/terms/import` | public | user | active | — | Cria ou executa api terms import |
| GET | `/api/users/admin` | admin | admin | active | — | Consulta api users admin |
| POST | `/api/users/admin/{id}/ban` | admin | admin | active | — | Cria ou executa api users admin id ban |
| PATCH | `/api/users/profile` | public | user | active | — | Atualiza api users profile |
| GET | `/health` | internal | none | active | — | Consulta health |

## links (22)

| Método | Path | Scope | Auth | Status | Consumidores | Resumo |
|--------|------|-------|------|--------|--------------|--------|
| GET | `/api/admin/v1/groups` | admin | admin | active | — | Consulta api admin v1 groups |
| DELETE | `/api/admin/v1/groups/{id}` | admin | admin | active | — | Remove api admin v1 groups id |
| PATCH | `/api/admin/v1/groups/{id}` | admin | admin | active | — | Atualiza api admin v1 groups id |
| POST | `/api/admin/v1/groups/{id}/accept` | admin | admin | active | — | Cria ou executa api admin v1 groups id accept |
| POST | `/api/admin/v1/groups/{id}/archive` | admin | admin | active | — | Cria ou executa api admin v1 groups id archive |
| POST | `/api/admin/v1/groups/rehydrate-logos` | admin | admin | active | — | Cria ou executa api admin v1 groups rehydrate-logos |
| GET | `/api/admin/v1/groups/rehydrate-logos/status` | admin | admin | active | — | Consulta api admin v1 groups rehydrate-logos status |
| POST | `/api/admin/v1/rebuild` | admin | admin | active | — | Cria ou executa api admin v1 rebuild |
| GET | `/api/admin/v1/rebuild/status` | admin | admin | active | — | Consulta api admin v1 rebuild status |
| GET | `/api/admin/v1/reports` | admin | admin | active | — | Consulta api admin v1 reports |
| PATCH | `/api/admin/v1/reports/{id}` | admin | admin | active | — | Atualiza api admin v1 reports id |
| GET | `/api/admin/v1/tags` | admin | admin | active | — | Consulta api admin v1 tags |
| POST | `/api/admin/v1/tags` | admin | admin | active | — | Cria ou executa api admin v1 tags |
| DELETE | `/api/admin/v1/tags/{id}` | admin | admin | active | — | Remove api admin v1 tags id |
| PATCH | `/api/admin/v1/tags/{id}` | admin | admin | active | — | Atualiza api admin v1 tags id |
| GET | `/api/groups` | public | none | active | — | Consulta api groups |
| GET | `/api/groups/{slug}` | public-page | none | active | — | Consulta api groups slug |
| POST | `/api/groups/{slug}/report` | public | user | active | — | Cria ou executa api groups slug report |
| POST | `/api/groups/suggest` | self-service | user | active | — | Cria ou executa api groups suggest |
| GET | `/api/tags` | public | none | active | — | Consulta api tags |
| GET | `/grupo/{slug}` | public-page | none | active | — | Consulta grupo slug |
| GET | `/healthz` | internal | none | active | — | Consulta healthz |

## mesas (171)

| Método | Path | Scope | Auth | Status | Consumidores | Resumo |
|--------|------|-------|------|--------|--------------|--------|
| GET | `/api/v1/admin/activity` | admin | admin | active | — | Consulta api v1 admin activity |
| GET | `/api/v1/admin/dev-feedback` | admin | admin | active | — | Consulta api v1 admin dev-feedback |
| DELETE | `/api/v1/admin/dev-feedback/{id}` | admin | admin | active | — | Remove api v1 admin dev-feedback id |
| PATCH | `/api/v1/admin/dev-feedback/{id}` | admin | admin | active | — | Atualiza api v1 admin dev-feedback id |
| POST | `/api/v1/admin/dev-feedback/merge` | admin | admin | active | — | Cria ou executa api v1 admin dev-feedback merge |
| POST | `/api/v1/admin/discord/automation/auto-approval/guard` | admin | admin | active | — | Executa guard de auto-aprovação Discord |
| GET | `/api/v1/admin/discord/automation/config` | admin | admin | active | — | Consulta api v1 admin discord automation config |
| GET | `/api/v1/admin/discord/automation/eval` | admin | admin | active | — | Consulta eval offline da automação Discord |
| GET | `/api/v1/admin/discord/chat-exporter/config` | admin | admin | active | — | Consulta api v1 admin discord chat-exporter config |
| PUT | `/api/v1/admin/discord/chat-exporter/config` | admin | admin | active | — | Substitui api v1 admin discord chat-exporter config |
| GET | `/api/v1/admin/discord/chat-exporter/profiles` | admin | admin | active | — | Consulta api v1 admin discord chat-exporter profiles |
| POST | `/api/v1/admin/discord/chat-exporter/profiles` | admin | admin | active | — | Cria ou executa api v1 admin discord chat-exporter profiles |
| DELETE | `/api/v1/admin/discord/chat-exporter/profiles/{id}` | admin | admin | active | — | Remove api v1 admin discord chat-exporter profiles id |
| PATCH | `/api/v1/admin/discord/chat-exporter/profiles/{id}` | admin | admin | active | — | Atualiza api v1 admin discord chat-exporter profiles id |
| GET | `/api/v1/admin/discord/chat-exporter/profiles/{id}/delta` | admin | admin | active | — | Consulta api v1 admin discord chat-exporter profiles id delta |
| POST | `/api/v1/admin/discord/chat-exporter/profiles/{id}/run` | admin | admin | active | — | Cria ou executa api v1 admin discord chat-exporter profiles id run |
| POST | `/api/v1/admin/discord/chat-exporter/profiles/{id}/test` | admin | admin | active | — | Cria ou executa api v1 admin discord chat-exporter profiles id test |
| POST | `/api/v1/admin/discord/chat-exporter/run` | admin | admin | active | — | Cria ou executa api v1 admin discord chat-exporter run |
| POST | `/api/v1/admin/discord/chat-exporter/test` | admin | admin | active | — | Cria ou executa api v1 admin discord chat-exporter test |
| POST | `/api/v1/admin/discord/chat-exporter/validate-token` | admin | admin | active | — | Cria ou executa api v1 admin discord chat-exporter validate-token |
| GET | `/api/v1/admin/discord/discovery/guilds` | admin | admin | active | — | Consulta api v1 admin discord discovery guilds |
| GET | `/api/v1/admin/discord/discovery/guilds/{guildId}/channels` | admin | admin | active | — | Consulta api v1 admin discord discovery guilds guildId channels |
| GET | `/api/v1/admin/discord/drafts` | admin | admin | active | — | Consulta api v1 admin discord drafts |
| GET | `/api/v1/admin/discord/drafts/{id}` | admin | admin | active | — | Consulta api v1 admin discord drafts id |
| PATCH | `/api/v1/admin/discord/drafts/{id}` | admin | admin | active | — | Atualiza api v1 admin discord drafts id |
| POST | `/api/v1/admin/discord/drafts/{id}/correction` | admin | admin | provisional | — | Registra correção manual em draft de Discord |
| POST | `/api/v1/admin/discord/drafts/{id}/refresh-image` | admin | admin | active | — | Cria ou executa api v1 admin discord drafts id refresh-image |
| POST | `/api/v1/admin/discord/drafts/{id}/reparse` | admin | admin | active | — | Cria ou executa api v1 admin discord drafts id reparse |
| POST | `/api/v1/admin/discord/drafts/{id}/sync` | admin | admin | active | — | Cria ou executa api v1 admin discord drafts id sync |
| PATCH | `/api/v1/admin/discord/drafts/batch` | admin | admin | active | — | Atualiza api v1 admin discord drafts batch |
| DELETE | `/api/v1/admin/discord/drafts/rejected` | admin | admin | active | — | Apaga drafts descartados (status=rejected) |
| POST | `/api/v1/admin/discord/fetch` | admin | admin | active | — | Cria ou executa api v1 admin discord fetch |
| POST | `/api/v1/admin/discord/import-json` | admin | admin | active | — | Cria ou executa api v1 admin discord import-json |
| POST | `/api/v1/admin/discord/import-json/file` | admin | admin | active | — | Cria ou executa api v1 admin discord import-json file |
| POST | `/api/v1/admin/discord/import-json/preview` | admin | admin | active | — | Cria ou executa api v1 admin discord import-json preview |
| POST | `/api/v1/admin/discord/import-json/preview/file` | admin | admin | active | — | Cria ou executa api v1 admin discord import-json preview file |
| POST | `/api/v1/admin/discord/import-json/reparse` | admin | admin | active | — | Cria ou executa api v1 admin discord import-json reparse |
| GET | `/api/v1/admin/discord/messages` | admin | admin | active | — | Consulta api v1 admin discord messages |
| PATCH | `/api/v1/admin/discord/messages/{id}` | admin | admin | active | — | Atualiza api v1 admin discord messages id |
| POST | `/api/v1/admin/discord/messages/{id}/diagnose-content` | admin | admin | active | — | Cria ou executa api v1 admin discord messages id diagnose-content |
| POST | `/api/v1/admin/discord/messages/{id}/parse` | admin | admin | active | — | Cria ou executa api v1 admin discord messages id parse |
| PATCH | `/api/v1/admin/discord/messages/batch` | admin | admin | active | — | Atualiza api v1 admin discord messages batch |
| POST | `/api/v1/admin/discord/messages/parse-batch` | admin | admin | active | — | Cria ou executa api v1 admin discord messages parse-batch |
| GET | `/api/v1/admin/discord/metrics` | admin | admin | active | — | Consulta api v1 admin discord metrics |
| GET | `/api/v1/admin/discord/metrics/shadow` | admin | admin | active | — | Consulta api v1 admin discord metrics shadow |
| GET | `/api/v1/admin/discord/settings` | admin | admin | active | — | Consulta api v1 admin discord settings |
| DELETE | `/api/v1/admin/discord/settings/bot-token` | admin | admin | active | — | Remove api v1 admin discord settings bot-token |
| PUT | `/api/v1/admin/discord/settings/bot-token` | admin | admin | active | — | Substitui api v1 admin discord settings bot-token |
| GET | `/api/v1/admin/discord/sources` | admin | admin | active | — | Consulta api v1 admin discord sources |
| POST | `/api/v1/admin/discord/sources` | admin | admin | active | — | Cria ou executa api v1 admin discord sources |
| DELETE | `/api/v1/admin/discord/sources/{id}` | admin | admin | active | — | Remove api v1 admin discord sources id |
| PATCH | `/api/v1/admin/discord/sources/{id}` | admin | admin | active | — | Atualiza api v1 admin discord sources id |
| POST | `/api/v1/admin/discord/sources/{sourceId}/reingest-force` | admin | admin | active | — | Cria ou executa api v1 admin discord sources sourceId reingest-force |
| POST | `/api/v1/admin/discord/sync-ready` | admin | admin | active | — | Cria ou executa api v1 admin discord sync-ready |
| GET | `/api/v1/admin/import/drafts` | admin | admin | active | — | Consulta api v1 admin import drafts |
| GET | `/api/v1/admin/import/drafts/{id}` | admin | admin | active | — | Consulta api v1 admin import drafts id |
| PATCH | `/api/v1/admin/import/drafts/{id}` | admin | admin | active | — | Atualiza api v1 admin import drafts id |
| POST | `/api/v1/admin/import/drafts/{id}/correction` | admin | admin | provisional | — | Registra correção manual em draft de importação |
| POST | `/api/v1/admin/import/drafts/{id}/reparse` | admin | admin | active | — | Cria ou executa api v1 admin import drafts id reparse |
| POST | `/api/v1/admin/import/drafts/{id}/sync` | admin | admin | active | — | Cria ou executa api v1 admin import drafts id sync |
| POST | `/api/v1/admin/import/import-text` | admin | admin | active | — | Cria ou executa api v1 admin import import-text |
| GET | `/api/v1/admin/scenario-suggestions` | admin | admin | active | — | Consulta api v1 admin scenario-suggestions |
| PATCH | `/api/v1/admin/scenario-suggestions/{id}/approve` | admin | admin | active | — | Atualiza api v1 admin scenario-suggestions id approve |
| PATCH | `/api/v1/admin/scenario-suggestions/{id}/reject` | admin | admin | active | — | Atualiza api v1 admin scenario-suggestions id reject |
| GET | `/api/v1/admin/setting-suggestions` | admin | admin | active | — | Consulta api v1 admin setting-suggestions |
| POST | `/api/v1/admin/setting-suggestions` | admin | admin | active | — | Cria ou executa api v1 admin setting-suggestions |
| DELETE | `/api/v1/admin/setting-suggestions/{id}` | admin | admin | active | — | Remove api v1 admin setting-suggestions id |
| PUT | `/api/v1/admin/setting-suggestions/{id}` | admin | admin | active | — | Substitui api v1 admin setting-suggestions id |
| POST | `/api/v1/admin/sync/enrich` | admin | admin | active | — | Cria ou executa api v1 admin sync enrich |
| GET | `/api/v1/admin/system-suggestions` | admin | admin | active | — | Consulta api v1 admin system-suggestions |
| PATCH | `/api/v1/admin/system-suggestions/{id}/approve` | admin | admin | active | — | Atualiza api v1 admin system-suggestions id approve |
| GET | `/api/v1/admin/system-suggestions/{id}/candidates` | admin | admin | active | — | Consulta api v1 admin system-suggestions id candidates |
| PATCH | `/api/v1/admin/system-suggestions/{id}/reject` | admin | admin | active | — | Atualiza api v1 admin system-suggestions id reject |
| POST | `/api/v1/admin/system-suggestions/{id}/resolve` | admin | admin | active | — | Cria ou executa api v1 admin system-suggestions id resolve |
| DELETE | `/api/v1/admin/tables/{id}` | admin | admin | active | — | Remove api v1 admin tables id |
| PUT | `/api/v1/admin/tables/{id}` | admin | admin | active | — | Substitui api v1 admin tables id |
| POST | `/api/v1/admin/tables/auto-archive` | admin | admin | active | — | Cria ou executa api v1 admin tables auto-archive |
| POST | `/api/v1/admin/tables/batch` | admin | admin | active | — | Cria ou executa api v1 admin tables batch |
| GET | `/api/v1/admin/users` | admin | admin | active | — | Consulta api v1 admin users |
| GET | `/api/v1/admin/users/{id}` | admin | admin | active | — | Consulta api v1 admin users id |
| PATCH | `/api/v1/admin/users/{id}/covil` | admin | admin | active | — | Atualiza api v1 admin users id covil |
| GET | `/api/v1/auth/google` | external | none | active | — | Consulta api v1 auth google |
| GET | `/api/v1/auth/google/callback` | external | none | active | — | Consulta api v1 auth google callback |
| POST | `/api/v1/auth/logout` | self-service | user | active | — | Cria ou executa api v1 auth logout |
| GET | `/api/v1/changelog` | public | none | active | — | Consulta api v1 changelog |
| GET | `/api/v1/communication-platforms` | public | user | active | — | Consulta api v1 communication-platforms |
| GET | `/api/v1/communication-platforms/admin` | admin | admin | active | — | Consulta api v1 communication-platforms admin |
| POST | `/api/v1/communication-platforms/admin` | admin | admin | active | — | Cria ou executa api v1 communication-platforms admin |
| DELETE | `/api/v1/communication-platforms/admin/{id}` | admin | admin | active | — | Remove api v1 communication-platforms admin id |
| PUT | `/api/v1/communication-platforms/admin/{id}` | admin | admin | active | — | Substitui api v1 communication-platforms admin id |
| POST | `/api/v1/dev-feedback` | public | user | active | — | Cria ou executa api v1 dev-feedback |
| GET | `/api/v1/gm/{slug}` | public | user | active | — | Consulta api v1 gm slug |
| POST | `/api/v1/gm/{slug}/contact` | telemetry | none | active | — | Cria ou executa api v1 gm slug contact |
| POST | `/api/v1/gm/{slug}/contact-click` | public | user | active | — | Cria ou executa api v1 gm slug contact-click |
| GET | `/api/v1/gm/{slug}/insights` | public | user | active | — | Consulta api v1 gm slug insights |
| POST | `/api/v1/gm/{slug}/view` | telemetry | none | active | — | Cria ou executa api v1 gm slug view |
| GET | `/api/v1/gm/insights` | public | user | active | — | Consulta api v1 gm insights |
| GET | `/api/v1/gm/me` | public | user | active | — | Consulta api v1 gm me |
| POST | `/api/v1/gm/profile` | public | user | active | — | Cria ou executa api v1 gm profile |
| PUT | `/api/v1/gm/profile` | public | user | active | — | Substitui api v1 gm profile |
| GET | `/api/v1/gm/tables` | public | user | active | — | Consulta api v1 gm tables |
| POST | `/api/v1/gm/tables` | public | user | active | — | Cria ou executa api v1 gm tables |
| DELETE | `/api/v1/gm/tables/{id}` | public | user | active | — | Remove api v1 gm tables id |
| GET | `/api/v1/gm/tables/{id}` | public | user | active | — | Consulta api v1 gm tables id |
| PUT | `/api/v1/gm/tables/{id}` | public | user | active | — | Substitui api v1 gm tables id |
| PATCH | `/api/v1/gm/tables/{id}/archive` | public | user | active | — | Atualiza api v1 gm tables id archive |
| POST | `/api/v1/gm/tables/{id}/click` | telemetry | none | active | — | Cria ou executa api v1 gm tables id click |
| POST | `/api/v1/gm/tables/{id}/contact` | telemetry | none | active | — | Cria ou executa api v1 gm tables id contact |
| POST | `/api/v1/gm/tables/{id}/favorite` | telemetry | none | active | — | Cria ou executa api v1 gm tables id favorite |
| PATCH | `/api/v1/gm/tables/{id}/status` | public | user | active | — | Atualiza api v1 gm tables id status |
| POST | `/api/v1/gm/tables/{slug}/view` | telemetry | none | active | — | Cria ou executa api v1 gm tables slug view |
| GET | `/api/v1/health` | internal | none | active | — | Consulta api v1 health |
| GET | `/api/v1/me` | public | user | active | — | Consulta api v1 me |
| GET | `/api/v1/me/options` | public | user | active | — | Consulta api v1 me options |
| PUT | `/api/v1/me/preferences` | public | user | active | — | Substitui api v1 me preferences |
| GET | `/api/v1/notifications` | public | user | active | — | Consulta api v1 notifications |
| PATCH | `/api/v1/notifications/{id}/read` | public | user | active | — | Atualiza api v1 notifications id read |
| PATCH | `/api/v1/notifications/read-all` | public | user | active | — | Atualiza api v1 notifications read-all |
| PATCH | `/api/v1/profile/gm` | public | user | active | — | Atualiza api v1 profile gm |
| GET | `/api/v1/profile/links` | public | user | active | — | Consulta api v1 profile links |
| POST | `/api/v1/profile/links` | public | user | active | — | Cria ou executa api v1 profile links |
| DELETE | `/api/v1/profile/links/{id}` | public | user | active | — | Remove api v1 profile links id |
| PATCH | `/api/v1/profile/links/reorder` | public | user | active | — | Atualiza api v1 profile links reorder |
| GET | `/api/v1/profile/me` | public | user | active | — | Consulta api v1 profile me |
| PATCH | `/api/v1/profile/me` | public | user | active | — | Atualiza api v1 profile me |
| DELETE | `/api/v1/profile/me/connect/discord` | self-service | user | active | — | Remove api v1 profile me connect discord |
| POST | `/api/v1/profile/me/connect/discord` | self-service | user | active | — | Cria ou executa api v1 profile me connect discord |
| GET | `/api/v1/profile/me/discord` | self-service | user | active | — | Consulta api v1 profile me discord |
| PATCH | `/api/v1/profile/me/gm` | public | user | active | — | Atualiza api v1 profile me gm |
| POST | `/api/v1/profile/me/google-picture` | public | user | active | — | Cria ou executa api v1 profile me google-picture |
| PATCH | `/api/v1/profile/me/player` | public | user | active | — | Atualiza api v1 profile me player |
| PATCH | `/api/v1/profile/me/profile` | public | user | active | — | Atualiza api v1 profile me profile |
| POST | `/api/v1/profile/me/systems` | public | user | active | — | Cria ou executa api v1 profile me systems |
| DELETE | `/api/v1/profile/me/systems/{id}` | public | user | active | — | Remove api v1 profile me systems id |
| PATCH | `/api/v1/profile/player` | public | user | active | — | Atualiza api v1 profile player |
| POST | `/api/v1/profile/systems` | public | user | active | — | Cria ou executa api v1 profile systems |
| DELETE | `/api/v1/profile/systems/{id}` | public | user | active | — | Remove api v1 profile systems id |
| POST | `/api/v1/scenario-suggestions` | public | user | active | — | Cria ou executa api v1 scenario-suggestions |
| GET | `/api/v1/scenario-suggestions/mine` | self-service | user | active | — | Consulta api v1 scenario-suggestions mine |
| GET | `/api/v1/scenarios` | public | none | active | — | Consulta api v1 scenarios |
| GET | `/api/v1/scenarios/{id}` | public | none | active | — | Consulta api v1 scenarios id |
| POST | `/api/v1/scenarios/admin` | admin | admin | active | — | Cria ou executa api v1 scenarios admin |
| DELETE | `/api/v1/scenarios/admin/{id}` | admin | admin | active | — | Remove api v1 scenarios admin id |
| PUT | `/api/v1/scenarios/admin/{id}` | admin | admin | active | — | Substitui api v1 scenarios admin id |
| GET | `/api/v1/settings/suggest-styles` | self-service | user | active | — | Consulta api v1 settings suggest-styles |
| POST | `/api/v1/system-suggestions` | public | user | active | — | Cria ou executa api v1 system-suggestions |
| GET | `/api/v1/system-suggestions/mine` | self-service | user | active | — | Consulta api v1 system-suggestions mine |
| GET | `/api/v1/systems` | public | none | active | — | Consulta api v1 systems |
| POST | `/api/v1/systems/admin` | admin | admin | active | — | Cria ou executa api v1 systems admin |
| DELETE | `/api/v1/systems/admin/{id}` | admin | admin | active | — | Remove api v1 systems admin id |
| PUT | `/api/v1/systems/admin/{id}` | admin | admin | active | — | Substitui api v1 systems admin id |
| GET | `/api/v1/tables` | public | none | active | — | Consulta api v1 tables |
| GET | `/api/v1/tables/{slug}` | public | none | active | — | Consulta api v1 tables slug |
| POST | `/api/v1/tables/{slug}/click` | telemetry | none | active | — | Cria ou executa api v1 tables slug click |
| POST | `/api/v1/tables/{slug}/view` | telemetry | none | active | — | Cria ou executa api v1 tables slug view |
| POST | `/api/v1/upload` | public | user | active | — | Cria ou executa api v1 upload |
| POST | `/api/v1/upload/url` | public | user | active | — | Cria ou executa api v1 upload url |
| GET | `/api/v1/vtt-platforms` | public | user | active | — | Consulta api v1 vtt-platforms |
| GET | `/api/v1/vtt-platforms/admin` | admin | admin | active | — | Consulta api v1 vtt-platforms admin |
| POST | `/api/v1/vtt-platforms/admin` | admin | admin | active | — | Cria ou executa api v1 vtt-platforms admin |
| DELETE | `/api/v1/vtt-platforms/admin/{id}` | admin | admin | active | — | Remove api v1 vtt-platforms admin id |
| PUT | `/api/v1/vtt-platforms/admin/{id}` | admin | admin | active | — | Substitui api v1 vtt-platforms admin id |
| POST | `/api/v1/vtt-platforms/suggest` | self-service | user | active | — | Cria ou executa api v1 vtt-platforms suggest |
| GET | `/auth/discord/callback` | external | none | active | — | Consulta auth discord callback |
| GET | `/auth/discord/connect` | external | none | active | — | Consulta auth discord connect |
| DELETE | `/auth/discord/disconnect` | public | user | active | — | Remove auth discord disconnect |
| POST | `/auth/discord/verify-covil` | self-service | user | active | — | Cria ou executa auth discord verify-covil |
| GET | `/auth/google` | external | none | active | — | Consulta auth google |
| GET | `/auth/google/callback` | external | none | active | — | Consulta auth google callback |
| POST | `/auth/logout` | self-service | user | active | — | Cria ou executa auth logout |
| GET | `/og/{type}/{slug}` | media | none | active | — | Consulta og type slug |

## site (32)

| Método | Path | Scope | Auth | Status | Consumidores | Resumo |
|--------|------|-------|------|--------|--------------|--------|
| POST | `/admin/import` | admin | admin | active | — | Cria ou executa admin import |
| GET | `/admin/preview/{type}/{id}` | admin | admin | active | — | Consulta admin preview type id |
| POST | `/admin/rebuild` | admin | admin | active | — | Cria ou executa admin rebuild |
| GET | `/admin/status` | admin | admin | active | — | Consulta admin status |
| GET | `/api/admin/v1/feedback` | admin | admin | active | — | Consulta api admin v1 feedback |
| DELETE | `/api/admin/v1/feedback/{id}` | admin | admin | active | — | Remove api admin v1 feedback id |
| PATCH | `/api/admin/v1/feedback/{id}` | admin | admin | active | — | Atualiza api admin v1 feedback id |
| GET | `/api/admin/v1/media` | admin | admin | active | — | Consulta api admin v1 media |
| POST | `/api/admin/v1/media` | admin | admin | active | — | Cria ou executa api admin v1 media |
| DELETE | `/api/admin/v1/media/{id}` | admin | admin | active | — | Remove api admin v1 media id |
| PUT | `/api/admin/v1/media/{id}` | admin | admin | active | — | Substitui api admin v1 media id |
| GET | `/api/admin/v1/pages` | admin | admin | active | — | Consulta api admin v1 pages |
| POST | `/api/admin/v1/pages` | admin | admin | active | — | Cria ou executa api admin v1 pages |
| DELETE | `/api/admin/v1/pages/{id}` | admin | admin | active | — | Remove api admin v1 pages id |
| GET | `/api/admin/v1/pages/{id}` | admin | admin | active | — | Consulta api admin v1 pages id |
| PUT | `/api/admin/v1/pages/{id}` | admin | admin | active | — | Substitui api admin v1 pages id |
| POST | `/api/admin/v1/pages/{id}/status` | admin | admin | active | — | Cria ou executa api admin v1 pages id status |
| GET | `/api/admin/v1/posts` | admin | admin | active | — | Consulta api admin v1 posts |
| POST | `/api/admin/v1/posts` | admin | admin | active | — | Cria ou executa api admin v1 posts |
| DELETE | `/api/admin/v1/posts/{id}` | admin | admin | active | — | Remove api admin v1 posts id |
| GET | `/api/admin/v1/posts/{id}` | admin | admin | active | — | Consulta api admin v1 posts id |
| PUT | `/api/admin/v1/posts/{id}` | admin | admin | active | — | Substitui api admin v1 posts id |
| POST | `/api/admin/v1/posts/{id}/status` | admin | admin | active | — | Cria ou executa api admin v1 posts id status |
| POST | `/api/admin/v1/preview` | admin | admin | active | — | Cria ou executa api admin v1 preview |
| POST | `/api/admin/v1/rebuild` | admin | admin | active | — | Cria ou executa api admin v1 rebuild |
| GET | `/api/admin/v1/redirects` | admin | admin | active | — | Consulta api admin v1 redirects |
| POST | `/api/admin/v1/redirects` | admin | admin | active | — | Cria ou executa api admin v1 redirects |
| GET | `/api/admin/v1/slug-check` | admin | admin | active | — | Consulta api admin v1 slug-check |
| GET | `/api/admin/v1/taxonomies` | admin | admin | active | — | Consulta api admin v1 taxonomies |
| POST | `/api/admin/v1/taxonomies` | admin | admin | active | — | Cria ou executa api admin v1 taxonomies |
| POST | `/api/feedback` | public | user | active | — | Cria ou executa api feedback |
| GET | `/healthz` | internal | none | active | — | Consulta healthz |

