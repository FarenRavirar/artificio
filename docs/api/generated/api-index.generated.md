# Índice de API — Artifício RPG (gerado)

> **Fonte primária de descoberta de API para agentes de IA.** Gerado por `scripts/api/bundle-api.ts`.
> Bundle machine-readable: `docs/api/generated/artificio-api.bundle.json`.
> Não editar à mão. Regenerar com `pnpm api:bundle` (faz parte de `pnpm verify:api`).

Total: **264 operações**.

## accounts (11)

| Método | Path | Scope | Auth | Status | Consumidores | Resumo |
|--------|------|-------|------|--------|--------------|--------|
| GET | `/` | public | none | active | — | — |
| GET | `/admin/secrets/{name}` | admin | admin | active | — | — |
| PUT | `/admin/secrets/{name}` | admin | admin | active | — | — |
| GET | `/api/auth/google` | public | none | active | — | — |
| GET | `/api/auth/google/callback` | public | none | active | — | — |
| POST | `/api/auth/logout` | cross-app | user | active | mesas-frontend, glossario-frontend, links-frontend, site-admin | — |
| GET | `/api/auth/me` | cross-app | user | active | mesas-frontend, glossario-frontend, links-frontend, site-admin | — |
| GET | `/api/auth/refresh` | cross-app | user | active | mesas-frontend, glossario-frontend, links-frontend, site-admin | — |
| GET | `/conta` | public | none | active | — | — |
| GET | `/health` | internal | none | active | — | — |
| GET | `/login` | public | none | active | — | — |

## glossario (46)

| Método | Path | Scope | Auth | Status | Consumidores | Resumo |
|--------|------|-------|------|--------|--------------|--------|
| GET | `/api/admin/activity` | admin | admin | active | — | — |
| GET | `/api/admin/feedback` | admin | admin | active | — | — |
| DELETE | `/api/admin/feedback/{id}` | admin | admin | active | — | — |
| PATCH | `/api/admin/feedback/{id}` | admin | admin | active | — | — |
| POST | `/api/auth/login` | public | user | active | — | — |
| GET | `/api/auth/me` | public | user | active | — | — |
| POST | `/api/auth/register` | public | user | active | — | — |
| GET | `/api/categories` | public | none | active | — | — |
| POST | `/api/categories` | public | user | active | — | — |
| DELETE | `/api/categories/{id}` | public | user | active | — | — |
| PUT | `/api/categories/{id}` | public | user | active | — | — |
| GET | `/api/changelog` | public | none | active | — | — |
| GET | `/api/export/matecat` | public | none | active | — | — |
| POST | `/api/feedback` | public | user | active | — | — |
| POST | `/api/migration/claim` | public | user | active | — | — |
| POST | `/api/migration/verify` | public | user | active | — | — |
| GET | `/api/notifications` | public | user | active | — | — |
| PATCH | `/api/notifications/{id}/read` | public | user | active | — | — |
| PATCH | `/api/notifications/read-all` | public | user | active | — | — |
| GET | `/api/scenarios` | public | none | active | — | — |
| POST | `/api/scenarios` | public | user | active | — | — |
| DELETE | `/api/scenarios/{id}` | public | user | active | — | — |
| PUT | `/api/scenarios/{id}` | public | user | active | — | — |
| GET | `/api/social/{id}/comments` | public | none | active | — | — |
| POST | `/api/social/{id}/comments` | public | user | active | — | — |
| POST | `/api/social/{id}/vote` | public | user | active | — | — |
| DELETE | `/api/social/comments/{id}` | public | user | active | — | — |
| GET | `/api/systems` | public | none | active | — | — |
| POST | `/api/systems` | public | user | active | — | — |
| DELETE | `/api/systems/{id}` | public | user | active | — | — |
| PUT | `/api/systems/{id}` | public | user | active | — | — |
| GET | `/api/systems/{systemId}/editions` | public | none | active | — | — |
| POST | `/api/systems/{systemId}/editions` | public | user | active | — | — |
| DELETE | `/api/systems/editions/{id}` | public | user | active | — | — |
| PUT | `/api/systems/editions/{id}` | public | user | active | — | — |
| GET | `/api/terms` | public | none | active | — | — |
| POST | `/api/terms` | public | user | active | — | — |
| DELETE | `/api/terms/{id}` | public | user | active | — | — |
| PATCH | `/api/terms/{id}` | public | user | active | — | — |
| PATCH | `/api/terms/{id}/approve` | public | user | active | — | — |
| GET | `/api/terms/{id}/history` | public | none | active | — | — |
| POST | `/api/terms/import` | public | user | active | — | — |
| GET | `/api/users/admin` | admin | admin | active | — | — |
| POST | `/api/users/admin/{id}/ban` | admin | admin | active | — | — |
| PATCH | `/api/users/profile` | public | user | active | — | — |
| GET | `/health` | internal | none | active | — | — |

## links (22)

| Método | Path | Scope | Auth | Status | Consumidores | Resumo |
|--------|------|-------|------|--------|--------------|--------|
| GET | `/api/admin/v1/groups` | admin | admin | active | — | — |
| DELETE | `/api/admin/v1/groups/{id}` | admin | admin | active | — | — |
| PATCH | `/api/admin/v1/groups/{id}` | admin | admin | active | — | — |
| POST | `/api/admin/v1/groups/{id}/accept` | admin | admin | active | — | — |
| POST | `/api/admin/v1/groups/{id}/archive` | admin | admin | active | — | — |
| POST | `/api/admin/v1/groups/rehydrate-logos` | admin | admin | active | — | — |
| GET | `/api/admin/v1/groups/rehydrate-logos/status` | admin | admin | active | — | — |
| POST | `/api/admin/v1/rebuild` | admin | admin | active | — | — |
| GET | `/api/admin/v1/rebuild/status` | admin | admin | active | — | — |
| GET | `/api/admin/v1/reports` | admin | admin | active | — | — |
| PATCH | `/api/admin/v1/reports/{id}` | admin | admin | active | — | — |
| GET | `/api/admin/v1/tags` | admin | admin | active | — | — |
| POST | `/api/admin/v1/tags` | admin | admin | active | — | — |
| DELETE | `/api/admin/v1/tags/{id}` | admin | admin | active | — | — |
| PATCH | `/api/admin/v1/tags/{id}` | admin | admin | active | — | — |
| GET | `/api/groups` | public | none | active | — | — |
| GET | `/api/groups/{slug}` | public | none | active | — | — |
| POST | `/api/groups/{slug}/report` | public | user | active | — | — |
| POST | `/api/groups/suggest` | public | user | active | — | — |
| GET | `/api/tags` | public | none | active | — | — |
| GET | `/grupo/{slug}` | public | none | active | — | — |
| GET | `/healthz` | internal | none | active | — | — |

## mesas (153)

| Método | Path | Scope | Auth | Status | Consumidores | Resumo |
|--------|------|-------|------|--------|--------------|--------|
| GET | `/api/v1/admin/activity` | admin | admin | active | — | — |
| GET | `/api/v1/admin/dev-feedback` | admin | admin | active | — | — |
| DELETE | `/api/v1/admin/dev-feedback/{id}` | admin | admin | active | — | — |
| PATCH | `/api/v1/admin/dev-feedback/{id}` | admin | admin | active | — | — |
| POST | `/api/v1/admin/dev-feedback/merge` | admin | admin | active | — | — |
| GET | `/api/v1/admin/discord/discovery/guilds` | admin | admin | active | — | — |
| GET | `/api/v1/admin/discord/discovery/guilds/{guildId}/channels` | admin | admin | active | — | — |
| GET | `/api/v1/admin/discord/drafts` | admin | admin | active | — | — |
| GET | `/api/v1/admin/discord/drafts/{id}` | admin | admin | active | — | — |
| PATCH | `/api/v1/admin/discord/drafts/{id}` | admin | admin | active | — | — |
| POST | `/api/v1/admin/discord/drafts/{id}/correction` | admin | admin | provisional | — | Registra correção manual em draft de Discord |
| POST | `/api/v1/admin/discord/drafts/{id}/refresh-image` | admin | admin | active | — | — |
| POST | `/api/v1/admin/discord/drafts/{id}/reparse` | admin | admin | active | — | — |
| POST | `/api/v1/admin/discord/drafts/{id}/sync` | admin | admin | active | — | — |
| POST | `/api/v1/admin/discord/fetch` | admin | admin | active | — | — |
| POST | `/api/v1/admin/discord/import-json` | admin | admin | active | — | — |
| POST | `/api/v1/admin/discord/import-json/file` | admin | admin | active | — | — |
| POST | `/api/v1/admin/discord/import-json/preview` | admin | admin | active | — | — |
| POST | `/api/v1/admin/discord/import-json/preview/file` | admin | admin | active | — | — |
| POST | `/api/v1/admin/discord/import-json/reparse` | admin | admin | active | — | — |
| GET | `/api/v1/admin/discord/messages` | admin | admin | active | — | — |
| PATCH | `/api/v1/admin/discord/messages/{id}` | admin | admin | active | — | — |
| POST | `/api/v1/admin/discord/messages/{id}/diagnose-content` | admin | admin | active | — | — |
| POST | `/api/v1/admin/discord/messages/{id}/parse` | admin | admin | active | — | — |
| POST | `/api/v1/admin/discord/messages/parse-batch` | admin | admin | active | — | — |
| GET | `/api/v1/admin/discord/metrics` | admin | admin | active | — | — |
| GET | `/api/v1/admin/discord/metrics/shadow` | admin | admin | active | — | — |
| GET | `/api/v1/admin/discord/settings` | admin | admin | active | — | — |
| DELETE | `/api/v1/admin/discord/settings/bot-token` | admin | admin | active | — | — |
| PUT | `/api/v1/admin/discord/settings/bot-token` | admin | admin | active | — | — |
| GET | `/api/v1/admin/discord/sources` | admin | admin | active | — | — |
| POST | `/api/v1/admin/discord/sources` | admin | admin | active | — | — |
| DELETE | `/api/v1/admin/discord/sources/{id}` | admin | admin | active | — | — |
| PATCH | `/api/v1/admin/discord/sources/{id}` | admin | admin | active | — | — |
| POST | `/api/v1/admin/discord/sources/{sourceId}/reingest-force` | admin | admin | active | — | — |
| POST | `/api/v1/admin/discord/sync-ready` | admin | admin | active | — | — |
| GET | `/api/v1/admin/import/drafts` | admin | admin | active | — | — |
| GET | `/api/v1/admin/import/drafts/{id}` | admin | admin | active | — | — |
| PATCH | `/api/v1/admin/import/drafts/{id}` | admin | admin | active | — | — |
| POST | `/api/v1/admin/import/drafts/{id}/correction` | admin | admin | provisional | — | Registra correção manual em draft de importação |
| POST | `/api/v1/admin/import/drafts/{id}/reparse` | admin | admin | active | — | — |
| POST | `/api/v1/admin/import/drafts/{id}/sync` | admin | admin | active | — | — |
| POST | `/api/v1/admin/import/import-text` | admin | admin | active | — | — |
| GET | `/api/v1/admin/import/metrics` | admin | admin | active | — | — |
| GET | `/api/v1/admin/scenario-suggestions` | admin | admin | active | — | — |
| PATCH | `/api/v1/admin/scenario-suggestions/{id}/approve` | admin | admin | active | — | — |
| PATCH | `/api/v1/admin/scenario-suggestions/{id}/reject` | admin | admin | active | — | — |
| GET | `/api/v1/admin/setting-suggestions` | admin | admin | active | — | — |
| POST | `/api/v1/admin/setting-suggestions` | admin | admin | active | — | — |
| DELETE | `/api/v1/admin/setting-suggestions/{id}` | admin | admin | active | — | — |
| PUT | `/api/v1/admin/setting-suggestions/{id}` | admin | admin | active | — | — |
| POST | `/api/v1/admin/sync/enrich` | admin | admin | active | — | — |
| GET | `/api/v1/admin/system-suggestions` | admin | admin | active | — | — |
| PATCH | `/api/v1/admin/system-suggestions/{id}/approve` | admin | admin | active | — | — |
| GET | `/api/v1/admin/system-suggestions/{id}/candidates` | admin | admin | active | — | — |
| PATCH | `/api/v1/admin/system-suggestions/{id}/reject` | admin | admin | active | — | — |
| POST | `/api/v1/admin/system-suggestions/{id}/resolve` | admin | admin | active | — | — |
| DELETE | `/api/v1/admin/tables/{id}` | admin | admin | active | — | — |
| PUT | `/api/v1/admin/tables/{id}` | admin | admin | active | — | — |
| POST | `/api/v1/admin/tables/auto-archive` | admin | admin | active | — | — |
| GET | `/api/v1/admin/users` | admin | admin | active | — | — |
| GET | `/api/v1/admin/users/{id}` | admin | admin | active | — | — |
| PATCH | `/api/v1/admin/users/{id}/covil` | admin | admin | active | — | — |
| GET | `/api/v1/auth/google` | public | user | active | — | — |
| GET | `/api/v1/auth/google/callback` | public | user | active | — | — |
| POST | `/api/v1/auth/logout` | public | user | active | — | — |
| GET | `/api/v1/changelog` | public | none | active | — | — |
| GET | `/api/v1/communication-platforms` | public | user | active | — | — |
| GET | `/api/v1/communication-platforms/admin` | admin | admin | active | — | — |
| POST | `/api/v1/communication-platforms/admin` | admin | admin | active | — | — |
| DELETE | `/api/v1/communication-platforms/admin/{id}` | admin | admin | active | — | — |
| PUT | `/api/v1/communication-platforms/admin/{id}` | admin | admin | active | — | — |
| POST | `/api/v1/dev-feedback` | public | user | active | — | — |
| GET | `/api/v1/gm/{slug}` | public | user | active | — | — |
| POST | `/api/v1/gm/{slug}/contact` | public | user | active | — | — |
| POST | `/api/v1/gm/{slug}/contact-click` | public | user | active | — | — |
| GET | `/api/v1/gm/{slug}/insights` | public | user | active | — | — |
| POST | `/api/v1/gm/{slug}/view` | public | user | active | — | — |
| GET | `/api/v1/gm/insights` | public | user | active | — | — |
| GET | `/api/v1/gm/me` | public | user | active | — | — |
| POST | `/api/v1/gm/profile` | public | user | active | — | — |
| PUT | `/api/v1/gm/profile` | public | user | active | — | — |
| GET | `/api/v1/gm/tables` | public | user | active | — | — |
| POST | `/api/v1/gm/tables` | public | user | active | — | — |
| DELETE | `/api/v1/gm/tables/{id}` | public | user | active | — | — |
| GET | `/api/v1/gm/tables/{id}` | public | user | active | — | — |
| PUT | `/api/v1/gm/tables/{id}` | public | user | active | — | — |
| PATCH | `/api/v1/gm/tables/{id}/archive` | public | user | active | — | — |
| POST | `/api/v1/gm/tables/{id}/click` | public | user | active | — | — |
| POST | `/api/v1/gm/tables/{id}/contact` | public | user | active | — | — |
| POST | `/api/v1/gm/tables/{id}/favorite` | public | user | active | — | — |
| PATCH | `/api/v1/gm/tables/{id}/status` | public | user | active | — | — |
| POST | `/api/v1/gm/tables/{slug}/view` | public | user | active | — | — |
| GET | `/api/v1/health` | internal | none | active | — | — |
| GET | `/api/v1/me` | public | user | active | — | — |
| GET | `/api/v1/me/options` | public | user | active | — | — |
| PUT | `/api/v1/me/preferences` | public | user | active | — | — |
| GET | `/api/v1/notifications` | public | user | active | — | — |
| PATCH | `/api/v1/notifications/{id}/read` | public | user | active | — | — |
| PATCH | `/api/v1/notifications/read-all` | public | user | active | — | — |
| PATCH | `/api/v1/profile/gm` | public | user | active | — | — |
| GET | `/api/v1/profile/links` | public | user | active | — | — |
| POST | `/api/v1/profile/links` | public | user | active | — | — |
| DELETE | `/api/v1/profile/links/{id}` | public | user | active | — | — |
| PATCH | `/api/v1/profile/links/reorder` | public | user | active | — | — |
| GET | `/api/v1/profile/me` | public | user | active | — | — |
| PATCH | `/api/v1/profile/me` | public | user | active | — | — |
| DELETE | `/api/v1/profile/me/connect/discord` | public | user | active | — | — |
| POST | `/api/v1/profile/me/connect/discord` | public | user | active | — | — |
| GET | `/api/v1/profile/me/discord` | public | user | active | — | — |
| PATCH | `/api/v1/profile/me/gm` | public | user | active | — | — |
| POST | `/api/v1/profile/me/google-picture` | public | user | active | — | — |
| PATCH | `/api/v1/profile/me/player` | public | user | active | — | — |
| PATCH | `/api/v1/profile/me/profile` | public | user | active | — | — |
| POST | `/api/v1/profile/me/systems` | public | user | active | — | — |
| DELETE | `/api/v1/profile/me/systems/{id}` | public | user | active | — | — |
| PATCH | `/api/v1/profile/player` | public | user | active | — | — |
| POST | `/api/v1/profile/systems` | public | user | active | — | — |
| DELETE | `/api/v1/profile/systems/{id}` | public | user | active | — | — |
| POST | `/api/v1/scenario-suggestions` | public | user | active | — | — |
| GET | `/api/v1/scenario-suggestions/mine` | public | none | active | — | — |
| GET | `/api/v1/scenarios` | public | none | active | — | — |
| GET | `/api/v1/scenarios/{id}` | public | none | active | — | — |
| POST | `/api/v1/scenarios/admin` | admin | admin | active | — | — |
| DELETE | `/api/v1/scenarios/admin/{id}` | admin | admin | active | — | — |
| PUT | `/api/v1/scenarios/admin/{id}` | admin | admin | active | — | — |
| GET | `/api/v1/settings/suggest-styles` | public | user | active | — | — |
| POST | `/api/v1/system-suggestions` | public | user | active | — | — |
| GET | `/api/v1/system-suggestions/mine` | public | none | active | — | — |
| GET | `/api/v1/systems` | public | none | active | — | — |
| POST | `/api/v1/systems/admin` | admin | admin | active | — | — |
| DELETE | `/api/v1/systems/admin/{id}` | admin | admin | active | — | — |
| PUT | `/api/v1/systems/admin/{id}` | admin | admin | active | — | — |
| GET | `/api/v1/tables` | public | none | active | — | — |
| GET | `/api/v1/tables/{slug}` | public | none | active | — | — |
| POST | `/api/v1/tables/{slug}/click` | public | user | active | — | — |
| POST | `/api/v1/tables/{slug}/view` | public | user | active | — | — |
| POST | `/api/v1/upload` | public | user | active | — | — |
| POST | `/api/v1/upload/url` | public | user | active | — | — |
| GET | `/api/v1/vtt-platforms` | public | user | active | — | — |
| GET | `/api/v1/vtt-platforms/admin` | admin | admin | active | — | — |
| POST | `/api/v1/vtt-platforms/admin` | admin | admin | active | — | — |
| DELETE | `/api/v1/vtt-platforms/admin/{id}` | admin | admin | active | — | — |
| PUT | `/api/v1/vtt-platforms/admin/{id}` | admin | admin | active | — | — |
| POST | `/api/v1/vtt-platforms/suggest` | public | user | active | — | — |
| GET | `/auth/discord/callback` | public | user | active | — | — |
| GET | `/auth/discord/connect` | public | user | active | — | — |
| DELETE | `/auth/discord/disconnect` | public | user | active | — | — |
| POST | `/auth/discord/verify-covil` | public | user | active | — | — |
| GET | `/auth/google` | public | user | active | — | — |
| GET | `/auth/google/callback` | public | user | active | — | — |
| POST | `/auth/logout` | public | user | active | — | — |
| GET | `/og/{type}/{slug}` | public | none | active | — | — |

## site (32)

| Método | Path | Scope | Auth | Status | Consumidores | Resumo |
|--------|------|-------|------|--------|--------------|--------|
| POST | `/admin/import` | admin | admin | active | — | — |
| GET | `/admin/preview/{type}/{id}` | admin | admin | active | — | — |
| POST | `/admin/rebuild` | admin | admin | active | — | — |
| GET | `/admin/status` | admin | admin | active | — | — |
| GET | `/api/admin/v1/feedback` | admin | admin | active | — | — |
| DELETE | `/api/admin/v1/feedback/{id}` | admin | admin | active | — | — |
| PATCH | `/api/admin/v1/feedback/{id}` | admin | admin | active | — | — |
| GET | `/api/admin/v1/media` | admin | admin | active | — | — |
| POST | `/api/admin/v1/media` | admin | admin | active | — | — |
| DELETE | `/api/admin/v1/media/{id}` | admin | admin | active | — | — |
| PUT | `/api/admin/v1/media/{id}` | admin | admin | active | — | — |
| GET | `/api/admin/v1/pages` | admin | admin | active | — | — |
| POST | `/api/admin/v1/pages` | admin | admin | active | — | — |
| DELETE | `/api/admin/v1/pages/{id}` | admin | admin | active | — | — |
| GET | `/api/admin/v1/pages/{id}` | admin | admin | active | — | — |
| PUT | `/api/admin/v1/pages/{id}` | admin | admin | active | — | — |
| POST | `/api/admin/v1/pages/{id}/status` | admin | admin | active | — | — |
| GET | `/api/admin/v1/posts` | admin | admin | active | — | — |
| POST | `/api/admin/v1/posts` | admin | admin | active | — | — |
| DELETE | `/api/admin/v1/posts/{id}` | admin | admin | active | — | — |
| GET | `/api/admin/v1/posts/{id}` | admin | admin | active | — | — |
| PUT | `/api/admin/v1/posts/{id}` | admin | admin | active | — | — |
| POST | `/api/admin/v1/posts/{id}/status` | admin | admin | active | — | — |
| POST | `/api/admin/v1/preview` | admin | admin | active | — | — |
| POST | `/api/admin/v1/rebuild` | admin | admin | active | — | — |
| GET | `/api/admin/v1/redirects` | admin | admin | active | — | — |
| POST | `/api/admin/v1/redirects` | admin | admin | active | — | — |
| GET | `/api/admin/v1/slug-check` | admin | admin | active | — | — |
| GET | `/api/admin/v1/taxonomies` | admin | admin | active | — | — |
| POST | `/api/admin/v1/taxonomies` | admin | admin | active | — | — |
| POST | `/api/feedback` | public | user | active | — | — |
| GET | `/healthz` | internal | none | active | — | — |

