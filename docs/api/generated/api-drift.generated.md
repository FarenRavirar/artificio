# Relatório de Divergência de API — api:check

**Gerado em:** 2026-06-28T13:21:55.664Z
**Exit code:** 0 (inicial (sem bloqueios))
**Modo:** inicial

---

## Sumário

| Estado | Quantidade | Bloqueia? |
|--------|-----------|:---------:|
| ✅ OK | 88 | ❌ |
| ⚠️ CODE_ONLY | 53 | ✅ (se novo) |
| 📄 CONTRACT_ONLY | 0 | ❌ |
| 🔍 CONSUMER_ONLY | 123 | ✅ (se new + high) |
| 🕳️ UNUSED_ROUTE | 69 | ❌ |
| 👻 ORPHAN_SUSPECT | 66 | ❌ |
| ❓ UNCERTAIN | 0 | ❌ |

## Detalhamento por app

### accounts (10 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| GET | `/` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/auth/google` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/auth/google/callback` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/auth/me` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/auth/refresh` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/conta` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/health` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/login` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/auth/logout` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| USE | `<factory>` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |

### accounts-frontend (0 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| PUT | `/admin/secrets/deepseek_api_key` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `<logout>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |

### glossario (59 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/api/admin/feedback/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| DELETE | `/api/categories/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| DELETE | `/api/scenarios/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| DELETE | `/api/social/comments/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| DELETE | `/api/systems/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| DELETE | `/api/systems/editions/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| DELETE | `/api/terms/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/admin/activity` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/admin/feedback` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/categories` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/changelog` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/export/matecat` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/notifications` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/scenarios` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/social/:id/comments` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/systems` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/systems/:systemId/editions` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/terms` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/terms/:id/history` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/users/admin` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/admin/feedback/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/notifications/:id/read` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/notifications/read-all` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/terms/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/terms/:id/approve` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/users/profile` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/auth/login` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/auth/register` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/categories` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/feedback` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/migration/claim` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/migration/verify` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/scenarios` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/social/:id/comments` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/social/:id/vote` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/systems` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/systems/:systemId/editions` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/terms` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/terms/import` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/users/admin/:id/ban` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| PUT | `/api/categories/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| PUT | `/api/scenarios/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| PUT | `/api/systems/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| PUT | `/api/systems/editions/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/admin/activity` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/admin/feedback` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/auth` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/categories` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/changelog` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/export` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/feedback` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/migration` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/notifications` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/scenarios` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/social` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/systems` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/terms` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/terms/import` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/users` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |

### glossario-frontend (0 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/admin/feedback/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| DELETE | `/social/comments/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| DELETE | `/terms/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| DELETE | `route` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/admin/activity` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/admin/feedback` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/auth/me` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/categories` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/changelog` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/export/matecat` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/notifications` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/scenarios` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/social/:param/comments` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/systems` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/systems/:param/editions` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/terms` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/terms/:param/history` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/users/admin` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PATCH | `/admin/feedback/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PATCH | `/notifications/:param/read` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PATCH | `/notifications/read-all` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PATCH | `/terms/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PATCH | `/terms/:param/approve` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PATCH | `/users/profile` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/categories` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/feedback` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/migration/claim` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/migration/verify` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/scenarios` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/social/:param/comments` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/social/:param/vote` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/systems` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/systems/:param/editions` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/terms` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/terms/import` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/users/admin/:param/ban` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PUT | `/categories/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PUT | `/scenarios/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PUT | `/systems/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PUT | `/systems/editions/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PUT | `<unknown>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PUT | `route` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `<refreshSession>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |

### links (23 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/api/admin/v1/groups/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/admin/v1/tags/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/groups` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/groups/rehydrate-logos/status` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/rebuild/status` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/admin/v1/reports` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/admin/v1/tags` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/groups` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/groups/:slug` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/tags` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/grupo/:slug` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/healthz` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/admin/v1/groups/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/admin/v1/reports/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/admin/v1/tags/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/admin/v1/groups/:id/accept` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/groups/:id/archive` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/groups/rehydrate-logos` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/rebuild` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/admin/v1/tags` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/groups/:slug/report` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/groups/suggest` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| USE | `/api/admin/v1` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |

### links-frontend (0 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/api/groups/:param/report` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/api/admin/v1/reports:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `inviteUrl` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |

### mesas (184 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/api/v1/admin/dev-feedback/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/admin/discord/settings/bot-token` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| DELETE | `/api/v1/admin/discord/sources/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| DELETE | `/api/v1/admin/setting-suggestions/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| DELETE | `/api/v1/admin/tables/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/communication-platforms/admin/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| DELETE | `/api/v1/gm/tables/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| DELETE | `/api/v1/profile/links/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/profile/me/connect/discord` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| DELETE | `/api/v1/profile/me/systems/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/profile/systems/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/scenarios/admin/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/systems/admin/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/vtt-platforms/admin/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| DELETE | `/auth/discord/disconnect` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/activity` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/dev-feedback` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/discord/discovery/guilds` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/discord/discovery/guilds/:guildId/channels` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/discord/drafts` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/drafts/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/discord/messages` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/metrics` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/discord/metrics/shadow` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/discord/settings` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/discord/sources` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/import/drafts` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/import/drafts/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/import/metrics` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/scenario-suggestions` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/setting-suggestions` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/system-suggestions` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/system-suggestions/:id/candidates` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/users` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/users/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/auth/google` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/auth/google/callback` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/changelog` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/communication-platforms` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/communication-platforms/admin` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/gm/:slug` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/:slug/insights` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/insights` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/me` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/tables` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/tables/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/health` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/me` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/me/options` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/notifications` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/profile/links` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/profile/me` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/profile/me/discord` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/scenario-suggestions/mine` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/scenarios` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/scenarios/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/settings/suggest-styles` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/system-suggestions/mine` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/api/v1/systems` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/tables` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/tables/:slug` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/vtt-platforms` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/vtt-platforms/admin` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/auth/discord/callback` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/auth/discord/connect` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| GET | `/auth/google` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| GET | `/auth/google/callback` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| GET | `/og/{*splat}` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| GET | `/og/:type/:slug` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/v1/admin/dev-feedback/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/discord/drafts/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/v1/admin/discord/messages/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/v1/admin/discord/sources/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/v1/admin/import/drafts/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/v1/admin/scenario-suggestions/:id/approve` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/v1/admin/scenario-suggestions/:id/reject` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/v1/admin/system-suggestions/:id/approve` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/v1/admin/system-suggestions/:id/reject` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| PATCH | `/api/v1/admin/users/:id/covil` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
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
| POST | `/api/v1/admin/discord/drafts/:id/refresh-image` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/drafts/:id/reparse` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/drafts/:id/sync` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/fetch` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/import-json` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/import-json/file` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/import-json/preview` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/import-json/preview/file` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/import-json/reparse` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/messages/:id/diagnose-content` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/messages/:id/parse` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/messages/parse-batch` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/sources` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/sources/:sourceId/reingest-force` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/sync-ready` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/import/drafts/:id/reparse` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/import/drafts/:id/sync` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/import/import-text` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/setting-suggestions` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/sync/enrich` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/system-suggestions/:id/resolve` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/tables/auto-archive` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/auth/logout` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/communication-platforms/admin` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/dev-feedback` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/:slug/contact` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/:slug/contact-click` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/:slug/view` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/profile` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/tables` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/gm/tables/:id/click` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/gm/tables/:id/contact` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/gm/tables/:id/favorite` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/gm/tables/:slug/view` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/profile/links` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/profile/me/connect/discord` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/profile/me/google-picture` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/profile/me/systems` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/profile/systems` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/scenario-suggestions` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/scenarios/admin` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/system-suggestions` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/systems/admin` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/tables/:slug/click` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/tables/:slug/view` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/upload` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/upload/url` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/vtt-platforms/admin` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/api/v1/vtt-platforms/suggest` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/auth/discord/verify-covil` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| POST | `/auth/logout` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| PUT | `/api/v1/admin/discord/settings/bot-token` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| PUT | `/api/v1/admin/setting-suggestions/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| PUT | `/api/v1/admin/tables/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/communication-platforms/admin/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| PUT | `/api/v1/gm/profile` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/gm/tables/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 📋 Na allowlist (legado) |
| PUT | `/api/v1/me/preferences` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/scenarios/admin/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/systems/admin/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/vtt-platforms/admin/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/admin` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/admin/discord` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/admin/discord/discovery` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/admin/discord/drafts` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/admin/discord/import-json` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/admin/discord/messages` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/admin/discord/metrics` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/admin/discord/settings` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/admin/discord/sources` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/admin/import` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/admin/import/drafts` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/admin/import/import-text` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/admin/import/metrics` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/admin/setting-suggestions` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/auth` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/changelog` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/communication-platforms` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/dev-feedback` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/gm` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/me` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/notifications` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/profile` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/scenario-suggestions` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/scenarios` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/settings` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/system-suggestions` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/systems` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/tables` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/api/v1/vtt-platforms` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/auth` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |
| USE | `/og` | ⚠️ CODE_ONLY | ❌ | ❌ | 📋 Na allowlist (legado) |

### mesas-frontend (0 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `:param/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| DELETE | `:param/auth/discord/disconnect` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| DELETE | `/api/v1/admin/discord/deleteDiscordBotToken` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| DELETE | `/api/v1/admin/discord/deleteSource` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| DELETE | `deleteEndpoint` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| DELETE | `endpoint` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `:param:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `:param/api/v1/systems?view=tree` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `:param/auth/discord/connect` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `:param/health` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/activity:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/dev-feedback:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/discord/discordSettings` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/scenario-suggestions:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/api/v1/admin/system-suggestions:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/api/v1/masters/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/api/v1/profile/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `<unknown>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `endpoint` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `url` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PATCH | `<unknown>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PATCH | `endpoint` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `:param:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `:param/api/auth/logout` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/createSource` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/importFile` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/importJson` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/discord/reingestForce` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/api/v1/admin/import/importText` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `endpoint` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `uploadEndpoint` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `url` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PUT | `:param/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PUT | `/api/v1/admin/discord/updateMessage` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PUT | `/api/v1/admin/discord/updateSource` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PUT | `endpoint` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PUT | `url` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `/api/v1/admin/discord/diagnoseMessageContent` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `/api/v1/admin/discord/discoverChannels` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `/api/v1/admin/discord/discoverGuilds` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `/api/v1/admin/discord/parseBatch` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `/api/v1/admin/discord/parseMessage` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `/api/v1/admin/discord/previewFile` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `/api/v1/admin/discord/previewJson` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `/api/v1/admin/discord/saveDiscordBotToken` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `/api/v1/admin/discord/submitCorrection` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |

### packages/auth (0 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| GET | `:param/api/auth/refresh` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `input` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `meUrl` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |

### site-admin (0 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/api/admin/v1/<deleteFeedback>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| DELETE | `/api/admin/v1/<deleteMedia>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| DELETE | `/api/admin/v1/<deletePage>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| DELETE | `/api/admin/v1/<deletePost>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/api/admin/v1/<getPage>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/api/admin/v1/<getPost>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/api/admin/v1/<listFeedback>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/api/admin/v1/<listMedia>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/api/admin/v1/<listPages>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/api/admin/v1/<listPosts>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `/api/admin/v1/<listTerms>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| GET | `BASEpath` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `:param/media` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `:param/preview` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/api/admin/v1/<createPage>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/api/admin/v1/<createPost>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| POST | `/api/admin/v1/<createTerm>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PUT | `/api/admin/v1/<updateFeedback>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PUT | `/api/admin/v1/<updateMedia>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PUT | `/api/admin/v1/<updatePage>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| PUT | `/api/admin/v1/<updatePost>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `/api/admin/v1/<previewHtml>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `/api/admin/v1/<setPageStatus>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `/api/admin/v1/<setPostStatus>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `/api/admin/v1/<slugCheck>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |
| UNKNOWN | `/api/admin/v1/<uploadMedia>` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 📋 Na allowlist (legado) |

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
### glossario (37 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| DELETE | `/api/categories/:id` | ✅ | public | Sem consumidor e scope não justifica |
| DELETE | `/api/scenarios/:id` | ✅ | public | Sem consumidor e scope não justifica |
| DELETE | `/api/social/comments/:id` | ✅ | public | Sem consumidor e scope não justifica |
| DELETE | `/api/systems/:id` | ✅ | public | Sem consumidor e scope não justifica |
| DELETE | `/api/systems/editions/:id` | ✅ | public | Sem consumidor e scope não justifica |
| DELETE | `/api/terms/:id` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/categories` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/changelog` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/export/matecat` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/notifications` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/scenarios` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/social/:id/comments` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/systems` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/systems/:systemId/editions` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/terms` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/terms/:id/history` | ✅ | public | Sem consumidor e scope não justifica |
| PATCH | `/api/notifications/:id/read` | ✅ | public | Sem consumidor e scope não justifica |
| PATCH | `/api/notifications/read-all` | ✅ | public | Sem consumidor e scope não justifica |
| PATCH | `/api/terms/:id` | ✅ | public | Sem consumidor e scope não justifica |
| PATCH | `/api/terms/:id/approve` | ✅ | public | Sem consumidor e scope não justifica |
| PATCH | `/api/users/profile` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/auth/login` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/auth/register` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/categories` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/migration/claim` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/migration/verify` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/scenarios` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/social/:id/comments` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/social/:id/vote` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/systems` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/systems/:systemId/editions` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/terms` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/terms/import` | ✅ | public | Sem consumidor e scope não justifica |
| PUT | `/api/categories/:id` | ✅ | public | Sem consumidor e scope não justifica |
| PUT | `/api/scenarios/:id` | ✅ | public | Sem consumidor e scope não justifica |
| PUT | `/api/systems/:id` | ✅ | public | Sem consumidor e scope não justifica |
| PUT | `/api/systems/editions/:id` | ✅ | public | Sem consumidor e scope não justifica |
### links (2 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| GET | `/api/groups/:slug` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/grupo/:slug` | ✅ | public | Sem consumidor e scope não justifica |
### mesas (22 rota(s))

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
| PUT | `/api/v1/gm/tables/:id` | ✅ | public | Sem consumidor e scope não justifica |

## Rotas sem OpenAPI (CODE_ONLY)

| App | Method | Path | Confidence |
|-----|--------|------|:---------:|
| mesas | GET | `/auth/google` | high |
| mesas | GET | `/auth/google/callback` | high |
| mesas | GET | `/og/{*splat}` | high |
| mesas | POST | `/auth/logout` | high |
| glossario | USE | `/api/admin/activity` | high |
| glossario | USE | `/api/admin/feedback` | high |
| links | USE | `/api/admin/v1` | high |
| glossario | USE | `/api/auth` | high |
| glossario | USE | `/api/categories` | high |
| glossario | USE | `/api/changelog` | high |
| glossario | USE | `/api/export` | high |
| glossario | USE | `/api/feedback` | high |
| glossario | USE | `/api/migration` | high |
| glossario | USE | `/api/notifications` | high |
| glossario | USE | `/api/scenarios` | high |
| glossario | USE | `/api/social` | high |
| glossario | USE | `/api/systems` | high |
| glossario | USE | `/api/terms` | high |
| glossario | USE | `/api/terms/import` | high |
| glossario | USE | `/api/users` | high |
| mesas | USE | `/api/v1` | high |
| mesas | USE | `/api/v1/admin` | high |
| mesas | USE | `/api/v1/admin/discord` | high |
| mesas | USE | `/api/v1/admin/discord/discovery` | high |
| mesas | USE | `/api/v1/admin/discord/drafts` | high |
| mesas | USE | `/api/v1/admin/discord/import-json` | high |
| mesas | USE | `/api/v1/admin/discord/messages` | high |
| mesas | USE | `/api/v1/admin/discord/metrics` | high |
| mesas | USE | `/api/v1/admin/discord/settings` | high |
| mesas | USE | `/api/v1/admin/discord/sources` | high |
| mesas | USE | `/api/v1/admin/import` | high |
| mesas | USE | `/api/v1/admin/import/drafts` | high |
| mesas | USE | `/api/v1/admin/import/import-text` | high |
| mesas | USE | `/api/v1/admin/import/metrics` | high |
| mesas | USE | `/api/v1/admin/setting-suggestions` | high |
| mesas | USE | `/api/v1/auth` | high |
| mesas | USE | `/api/v1/changelog` | high |
| mesas | USE | `/api/v1/communication-platforms` | high |
| mesas | USE | `/api/v1/dev-feedback` | high |
| mesas | USE | `/api/v1/gm` | high |
| mesas | USE | `/api/v1/me` | high |
| mesas | USE | `/api/v1/notifications` | high |
| mesas | USE | `/api/v1/profile` | high |
| mesas | USE | `/api/v1/scenario-suggestions` | high |
| mesas | USE | `/api/v1/scenarios` | high |
| mesas | USE | `/api/v1/settings` | high |
| mesas | USE | `/api/v1/system-suggestions` | high |
| mesas | USE | `/api/v1/systems` | high |
| mesas | USE | `/api/v1/tables` | high |
| mesas | USE | `/api/v1/vtt-platforms` | high |
| mesas | USE | `/auth` | high |
| mesas | USE | `/og` | high |
| accounts | USE | `<factory>` | low |

## Consumidores sem rota (CONSUMER_ONLY)

| App | Method | Path | Confidence |
|-----|--------|------|:---------:|
| mesas-frontend | DELETE | `:param/:param` | medium |
| mesas-frontend | DELETE | `:param/auth/discord/disconnect` | medium |
| glossario-frontend | DELETE | `/admin/feedback/:param` | medium |
| site-admin | DELETE | `/api/admin/v1/<deleteFeedback>` | low |
| site-admin | DELETE | `/api/admin/v1/<deleteMedia>` | low |
| site-admin | DELETE | `/api/admin/v1/<deletePage>` | low |
| site-admin | DELETE | `/api/admin/v1/<deletePost>` | low |
| links-frontend | DELETE | `/api/groups/:param/report` | medium |
| mesas-frontend | DELETE | `/api/v1/admin/discord/deleteDiscordBotToken` | medium |
| mesas-frontend | DELETE | `/api/v1/admin/discord/deleteSource` | medium |
| glossario-frontend | DELETE | `/social/comments/:param` | medium |
| glossario-frontend | DELETE | `/terms/:param` | medium |
| mesas-frontend | DELETE | `deleteEndpoint` | low |
| mesas-frontend | DELETE | `endpoint` | low |
| glossario-frontend | DELETE | `route` | low |
| mesas-frontend | GET | `:param:param` | medium |
| packages/auth | GET | `:param/api/auth/refresh` | medium |
| mesas-frontend | GET | `:param/api/v1/systems?view=tree` | medium |
| mesas-frontend | GET | `:param/auth/discord/connect` | medium |
| mesas-frontend | GET | `:param/health` | medium |
| glossario-frontend | GET | `/admin/activity` | high |
| glossario-frontend | GET | `/admin/feedback` | high |
| site-admin | GET | `/api/admin/v1/<getPage>` | low |
| site-admin | GET | `/api/admin/v1/<getPost>` | low |
| site-admin | GET | `/api/admin/v1/<listFeedback>` | low |
| site-admin | GET | `/api/admin/v1/<listMedia>` | low |
| site-admin | GET | `/api/admin/v1/<listPages>` | low |
| site-admin | GET | `/api/admin/v1/<listPosts>` | low |
| site-admin | GET | `/api/admin/v1/<listTerms>` | low |
| links-frontend | GET | `/api/admin/v1/reports:param` | medium |
| mesas-frontend | GET | `/api/v1/admin/activity:param` | medium |
| mesas-frontend | GET | `/api/v1/admin/dev-feedback:param` | medium |
| mesas-frontend | GET | `/api/v1/admin/discord/discordSettings` | medium |
| mesas-frontend | GET | `/api/v1/admin/scenario-suggestions:param` | medium |
| mesas-frontend | GET | `/api/v1/admin/system-suggestions:param` | medium |
| mesas-frontend | GET | `/api/v1/masters/:param` | medium |
| mesas-frontend | GET | `/api/v1/profile/:param` | medium |
| glossario-frontend | GET | `/auth/me` | high |
| glossario-frontend | GET | `/categories` | high |
| glossario-frontend | GET | `/changelog` | high |
| glossario-frontend | GET | `/export/matecat` | high |
| glossario-frontend | GET | `/notifications` | high |
| glossario-frontend | GET | `/scenarios` | high |
| glossario-frontend | GET | `/social/:param/comments` | medium |
| glossario-frontend | GET | `/systems` | high |
| glossario-frontend | GET | `/systems/:param/editions` | medium |
| glossario-frontend | GET | `/terms` | high |
| glossario-frontend | GET | `/terms/:param/history` | medium |
| glossario-frontend | GET | `/users/admin` | high |
| mesas-frontend | GET | `<unknown>` | low |
| site-admin | GET | `BASEpath` | low |
| mesas-frontend | GET | `endpoint` | low |
| packages/auth | GET | `input` | low |
| links-frontend | GET | `inviteUrl` | low |
| packages/auth | GET | `meUrl` | low |
| mesas-frontend | GET | `url` | low |
| glossario-frontend | PATCH | `/admin/feedback/:param` | medium |
| glossario-frontend | PATCH | `/notifications/:param/read` | medium |
| glossario-frontend | PATCH | `/notifications/read-all` | high |
| glossario-frontend | PATCH | `/terms/:param` | medium |
| glossario-frontend | PATCH | `/terms/:param/approve` | medium |
| glossario-frontend | PATCH | `/users/profile` | high |
| mesas-frontend | PATCH | `<unknown>` | low |
| mesas-frontend | PATCH | `endpoint` | low |
| mesas-frontend | POST | `:param:param` | medium |
| mesas-frontend | POST | `:param/api/auth/logout` | medium |
| site-admin | POST | `:param/media` | medium |
| site-admin | POST | `:param/preview` | medium |
| site-admin | POST | `/api/admin/v1/<createPage>` | low |
| site-admin | POST | `/api/admin/v1/<createPost>` | low |
| site-admin | POST | `/api/admin/v1/<createTerm>` | low |
| mesas-frontend | POST | `/api/v1/admin/discord/createSource` | medium |
| mesas-frontend | POST | `/api/v1/admin/discord/importFile` | medium |
| mesas-frontend | POST | `/api/v1/admin/discord/importJson` | medium |
| mesas-frontend | POST | `/api/v1/admin/discord/reingestForce` | medium |
| mesas-frontend | POST | `/api/v1/admin/import/importText` | medium |
| glossario-frontend | POST | `/categories` | high |
| glossario-frontend | POST | `/feedback` | high |
| glossario-frontend | POST | `/migration/claim` | high |
| glossario-frontend | POST | `/migration/verify` | high |
| glossario-frontend | POST | `/scenarios` | high |
| glossario-frontend | POST | `/social/:param/comments` | medium |
| glossario-frontend | POST | `/social/:param/vote` | medium |
| glossario-frontend | POST | `/systems` | high |
| glossario-frontend | POST | `/systems/:param/editions` | medium |
| glossario-frontend | POST | `/terms` | high |
| glossario-frontend | POST | `/terms/import` | high |
| glossario-frontend | POST | `/users/admin/:param/ban` | medium |
| mesas-frontend | POST | `endpoint` | low |
| mesas-frontend | POST | `uploadEndpoint` | low |
| mesas-frontend | POST | `url` | low |
| mesas-frontend | PUT | `:param/:param` | medium |
| accounts-frontend | PUT | `/admin/secrets/deepseek_api_key` | high |
| site-admin | PUT | `/api/admin/v1/<updateFeedback>` | low |
| site-admin | PUT | `/api/admin/v1/<updateMedia>` | low |
| site-admin | PUT | `/api/admin/v1/<updatePage>` | low |
| site-admin | PUT | `/api/admin/v1/<updatePost>` | low |
| mesas-frontend | PUT | `/api/v1/admin/discord/updateMessage` | medium |
| mesas-frontend | PUT | `/api/v1/admin/discord/updateSource` | medium |
| glossario-frontend | PUT | `/categories/:param` | medium |
| glossario-frontend | PUT | `/scenarios/:param` | medium |
| glossario-frontend | PUT | `/systems/:param` | medium |
| glossario-frontend | PUT | `/systems/editions/:param` | medium |
| glossario-frontend | PUT | `<unknown>` | low |
| mesas-frontend | PUT | `endpoint` | low |
| glossario-frontend | PUT | `route` | low |
| mesas-frontend | PUT | `url` | low |
| site-admin | UNKNOWN | `/api/admin/v1/<previewHtml>` | low |
| site-admin | UNKNOWN | `/api/admin/v1/<setPageStatus>` | low |
| site-admin | UNKNOWN | `/api/admin/v1/<setPostStatus>` | low |
| site-admin | UNKNOWN | `/api/admin/v1/<slugCheck>` | low |
| site-admin | UNKNOWN | `/api/admin/v1/<uploadMedia>` | low |
| mesas-frontend | UNKNOWN | `/api/v1/admin/discord/diagnoseMessageContent` | medium |
| mesas-frontend | UNKNOWN | `/api/v1/admin/discord/discoverChannels` | medium |
| mesas-frontend | UNKNOWN | `/api/v1/admin/discord/discoverGuilds` | medium |
| mesas-frontend | UNKNOWN | `/api/v1/admin/discord/parseBatch` | medium |
| mesas-frontend | UNKNOWN | `/api/v1/admin/discord/parseMessage` | medium |
| mesas-frontend | UNKNOWN | `/api/v1/admin/discord/previewFile` | medium |
| mesas-frontend | UNKNOWN | `/api/v1/admin/discord/previewJson` | medium |
| mesas-frontend | UNKNOWN | `/api/v1/admin/discord/saveDiscordBotToken` | medium |
| mesas-frontend | UNKNOWN | `/api/v1/admin/discord/submitCorrection` | medium |
| accounts-frontend | UNKNOWN | `<logout>` | low |
| glossario-frontend | UNKNOWN | `<refreshSession>` | low |

## Recomendação de allowlist

Para aceitar as divergências atuais como legado e não bloquear, execute:

```bash
pnpm api:check --generate-allowlist
```
