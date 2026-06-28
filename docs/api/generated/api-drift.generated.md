# Relatório de Divergência de API — api:check

**Gerado em:** 1970-01-01T00:00:00.000Z
**Exit code:** 0 (inicial (sem bloqueios))
**Modo:** inicial

---

## Sumário

| Estado | Quantidade | Bloqueia? |
|--------|-----------|:---------:|
| ✅ OK | 169 | ❌ |
| ⚠️ CODE_ONLY | 0 | ✅ (se novo) |
| 📄 CONTRACT_ONLY | 2 | ❌ |
| 🔍 CONSUMER_ONLY | 3 | ✅ (se new + high) |
| 🕳️ UNUSED_ROUTE | 50 | ❌ |
| 👻 ORPHAN_SUSPECT | 38 | ❌ |
| ❓ UNCERTAIN | 0 | ❌ |

## Detalhamento por app

### accounts (11 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| GET | `/` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/admin/secrets/:name` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/auth/google` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/auth/google/callback` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/auth/me` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/auth/refresh` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/conta` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/health` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/login` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/auth/logout` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PUT | `/admin/secrets/:name` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |

### glossario (44 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/api/admin/feedback/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/categories/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/scenarios/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/social/comments/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/systems/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/systems/editions/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/terms/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/activity` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/feedback` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/categories` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/changelog` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/export/matecat` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/notifications` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/scenarios` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/social/:id/comments` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/systems` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/systems/:systemId/editions` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/terms` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/terms/:id/history` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/users/admin` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/admin/feedback/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/notifications/:id/read` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/notifications/read-all` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/terms/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/terms/:id/approve` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/users/profile` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/auth/login` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/auth/register` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/categories` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/feedback` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/migration/claim` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/migration/verify` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/scenarios` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/social/:id/comments` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/social/:id/vote` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/systems` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/systems/:systemId/editions` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/terms` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/terms/import` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/users/admin/:id/ban` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/categories/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/scenarios/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/systems/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/systems/editions/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |

### links (22 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/api/admin/v1/groups/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/admin/v1/tags/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/groups` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/groups/rehydrate-logos/status` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/rebuild/status` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/reports` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/tags` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/groups` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/groups/:slug` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/tags` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/grupo/:slug` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/healthz` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/admin/v1/groups/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/admin/v1/reports/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/admin/v1/tags/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/groups/:id/accept` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/groups/:id/archive` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/groups/rehydrate-logos` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/rebuild` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/tags` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/groups/:slug/report` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/groups/suggest` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |

### links-frontend (0 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/api/groups/:param/report` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 🆕 Novo (não bloqueante) |

### mesas (151 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/api/v1/admin/dev-feedback/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/admin/discord/settings/bot-token` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/admin/discord/sources/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/admin/setting-suggestions/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/admin/tables/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/communication-platforms/admin/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/gm/tables/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/profile/links/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/profile/me/connect/discord` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/profile/me/systems/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/profile/systems/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/scenarios/admin/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/systems/admin/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/vtt-platforms/admin/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/auth/discord/disconnect` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/activity` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/dev-feedback` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/discovery/guilds` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/discovery/guilds/:guildId/channels` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/drafts` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/drafts/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/messages` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/metrics` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/metrics/shadow` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/settings` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/sources` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/import/drafts` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/import/drafts/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/import/metrics` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/scenario-suggestions` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/setting-suggestions` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/system-suggestions` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/system-suggestions/:id/candidates` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/users` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/users/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/auth/google` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/auth/google/callback` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/changelog` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/communication-platforms` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/communication-platforms/admin` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/:slug` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/:slug/insights` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/insights` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/me` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/tables` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/tables/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/health` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/me` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/me/options` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/notifications` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/profile/links` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/profile/me` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/profile/me/discord` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/scenario-suggestions/mine` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/scenarios` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/scenarios/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/settings/suggest-styles` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/system-suggestions/mine` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/systems` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/tables` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/tables/:slug` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/vtt-platforms` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/vtt-platforms/admin` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/auth/discord/callback` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/auth/discord/connect` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/auth/google` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/auth/google/callback` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/og/:type/:slug` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/dev-feedback/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/discord/drafts/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/discord/messages/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/discord/sources/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/import/drafts/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/scenario-suggestions/:id/approve` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/scenario-suggestions/:id/reject` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/system-suggestions/:id/approve` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/system-suggestions/:id/reject` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/users/:id/covil` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/gm/tables/:id/archive` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/gm/tables/:id/status` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/notifications/:id/read` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/notifications/read-all` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/profile/gm` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/profile/links/reorder` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/profile/me` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/profile/me/gm` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/profile/me/player` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/profile/me/profile` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/profile/player` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/dev-feedback/merge` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/drafts/{id}/correction` | 📄 CONTRACT_ONLY | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/drafts/:id/refresh-image` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/drafts/:id/reparse` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/drafts/:id/sync` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/fetch` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/import-json` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/import-json/file` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/import-json/preview` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/import-json/preview/file` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/import-json/reparse` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/messages/:id/diagnose-content` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/messages/:id/parse` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/messages/parse-batch` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/sources` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/sources/:sourceId/reingest-force` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/sync-ready` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/import/drafts/{id}/correction` | 📄 CONTRACT_ONLY | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/import/drafts/:id/reparse` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/import/drafts/:id/sync` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/import/import-text` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/setting-suggestions` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/sync/enrich` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/system-suggestions/:id/resolve` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/tables/auto-archive` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/auth/logout` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/communication-platforms/admin` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/dev-feedback` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/:slug/contact` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/:slug/contact-click` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/:slug/view` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/profile` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/tables` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/tables/:id/click` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/tables/:id/contact` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/tables/:id/favorite` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/tables/:slug/view` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/profile/links` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/profile/me/connect/discord` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/profile/me/google-picture` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/profile/me/systems` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/profile/systems` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/scenario-suggestions` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/scenarios/admin` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/system-suggestions` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/systems/admin` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/tables/:slug/click` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/tables/:slug/view` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/upload` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/upload/url` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/vtt-platforms/admin` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/vtt-platforms/suggest` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/auth/discord/verify-covil` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/auth/logout` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/admin/discord/settings/bot-token` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/admin/setting-suggestions/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/admin/tables/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/communication-platforms/admin/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/gm/profile` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/gm/tables/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/me/preferences` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/scenarios/admin/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/systems/admin/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/vtt-platforms/admin/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |

### mesas-frontend (0 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| GET | `/api/v1/masters/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/profile/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 🆕 Novo (não bloqueante) |

### site (29 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/api/admin/v1/feedback/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/admin/v1/media/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/admin/v1/pages/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/admin/v1/posts/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/admin/preview/:type/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/admin/status` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/feedback` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/media` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/pages` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/pages/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/posts` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/posts/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/redirects` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/slug-check` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/taxonomies` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/admin/v1/feedback/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/admin/import` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/admin/rebuild` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/media` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/pages` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/pages/:id/status` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/posts` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/posts/:id/status` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/preview` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/redirects` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/taxonomies` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/admin/v1/media/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/admin/v1/pages/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/admin/v1/posts/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |

## Rotas órfãs suspeitas

Rotas existentes no código/OpenAPI, sem consumidor detectado e sem classificação que justifique.

### accounts (5 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| GET | `/` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/auth/google` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/auth/google/callback` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/conta` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/login` | ✅ | public | Sem consumidor e scope não justifica |
### glossario (6 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| DELETE | `/api/categories/:id` | ✅ | public | Sem consumidor e scope não justifica |
| DELETE | `/api/scenarios/:id` | ✅ | public | Sem consumidor e scope não justifica |
| DELETE | `/api/systems/:id` | ✅ | public | Sem consumidor e scope não justifica |
| DELETE | `/api/systems/editions/:id` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/auth/login` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/auth/register` | ✅ | public | Sem consumidor e scope não justifica |
### links (2 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| GET | `/api/groups/:slug` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/grupo/:slug` | ✅ | public | Sem consumidor e scope não justifica |
### mesas (25 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| DELETE | `/api/v1/gm/tables/:id` | ✅ | public | Sem consumidor e scope não justifica |
| DELETE | `/api/v1/profile/me/connect/discord` | ✅ | public | Sem consumidor e scope não justifica |
| DELETE | `/auth/discord/disconnect` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/auth/google` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/auth/google/callback` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/profile/me/discord` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/scenario-suggestions/mine` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/system-suggestions/mine` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/auth/discord/callback` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/auth/discord/connect` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/auth/google` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/auth/google/callback` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/og/:type/:slug` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/auth/logout` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/gm/tables` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/gm/tables/:id/click` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/gm/tables/:id/contact` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/gm/tables/:id/favorite` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/gm/tables/:slug/view` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/profile/me/connect/discord` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/system-suggestions` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/vtt-platforms/suggest` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/auth/discord/verify-covil` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/auth/logout` | ✅ | public | Sem consumidor e scope não justifica |
| PUT | `/api/v1/gm/tables/:id` | ✅ | public | Sem consumidor e scope não justifica |

## Consumidores sem rota (CONSUMER_ONLY)

| App | Method | Path | Confidence |
|-----|--------|------|:---------:|
| links-frontend | DELETE | `/api/groups/:param/report` | medium |
| mesas-frontend | GET | `/api/v1/masters/:param` | medium |
| mesas-frontend | GET | `/api/v1/profile/:param` | medium |

## Recomendação de allowlist

Para aceitar as divergências atuais como legado e não bloquear, execute:

```bash
pnpm api:check --generate-allowlist
```
