# Relatório de Divergência de API — api:check

**Gerado em:** 1970-01-01T00:00:00.000Z
**Exit code:** 0 (inicial (sem bloqueios))
**Modo:** inicial

---

## Sumário

| Estado | Quantidade | Bloqueia? |
|--------|-----------|:---------:|
| ✅ OK | 212 | ❌ |
| ⚠️ CODE_ONLY | 0 | ✅ (se novo) |
| 📄 CONTRACT_ONLY | 4 | ❌ |
| 🔍 CONSUMER_ONLY | 9 | ✅ (se new + high) |
| 🕳️ UNUSED_ROUTE | 117 | ❌ |
| 👻 ORPHAN_SUSPECT | 39 | ❌ |
| ❓ UNCERTAIN | 0 | ❌ |

## Detalhamento por app

### accounts (12 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| GET | `/` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/admin/secrets/:name` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/auth/google` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/auth/google/callback` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/auth/me` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/auth/refresh` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/conta` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/health` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/internal/users/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/login` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/auth/logout` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/admin/secrets/:name` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |

### downloads (61 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/api/v1/collections/:id/items/:materialId` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/comments/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/favorites/:materialId` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/reports/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/creators` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/email-log` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/links` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/materials/:id/link-history` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/media` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/metrics` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/rejection-categories` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/scraper/run/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/scraper/runs` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/summary` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/changelog` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/collections` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/collections/:id/items` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/comments/:materialId` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/creators/:slug` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/creators/me` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/destinations/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/favorites` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/health` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/material-metadata/:materialId` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/materials` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/materials/:slug` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/materials/:id/history` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/materials/mine` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/moderation/queue` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/notifications` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/organizations` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/organizations/:id/members` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/ratings/:materialId` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/reports` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/reports/abuse-check/:userId` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/reports/mine` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/rejection-categories/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/materials/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/moderation/batch/:action` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/notifications/:id/read` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/reports/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/email-log/:id/retry` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/materials/:id/check-link` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/materials/:id/evidence/upload` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/rejection-categories` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/sanitize-preview` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/scraper/ingest` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/scraper/run` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/collections` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/collections/:id/items` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/comments` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/downloads` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/favorites` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/materials` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/moderation/:id/approve` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/moderation/:id/reject` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/moderation/:id/submit` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/organizations` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/reports` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/material-metadata/:materialId` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/ratings` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |

### glossario (47 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/api/admin/feedback/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/categories/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/scenarios/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/social/comments/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/systems/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/systems/editions/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
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
| GET | `/api/systems/health` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/terms` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/terms/:id/history` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/users/admin` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/og/termo/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/sitemap.xml` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/admin/feedback/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/notifications/:id/read` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/notifications/read-all` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/terms/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/terms/:id/approve` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/users/profile` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/auth/login` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/auth/register` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
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

### glossario-frontend (0 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 🆕 Novo (não bloqueante) |

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
| GET | `/api/groups/:slug` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/tags` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/grupo/:slug` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
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

### mesas (183 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/api/v1/admin/dev-feedback/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/admin/discord/chat-exporter/profiles/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/admin/discord/drafts/rejected` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/admin/discord/settings/bot-token` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/admin/discord/sources/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/admin/setting-suggestions/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/admin/tables/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/communication-platforms/admin/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/gm/tables/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/profile/links/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/profile/me/connect/discord` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/profile/systems/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/scenarios/admin/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/systems/admin/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/v1/vtt-platforms/admin/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| DELETE | `/auth/discord/disconnect` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/activity` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/dev-feedback` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/automation/config` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/automation/eval` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/automation/llm-activity` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/automation/parse-eval` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/chat-exporter/config` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/chat-exporter/profiles` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/chat-exporter/profiles/:id/delta` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/discovery/guilds` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/discovery/guilds/:guildId/channels` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/drafts` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/drafts/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/drafts/:id/duplicates` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/messages` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/metrics` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/metrics/shadow` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/settings` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/discord/sources` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/import/drafts` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/import/drafts/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/scenario-suggestions` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/setting-suggestions` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/system-suggestions` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/system-suggestions/:id/candidates` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/tables` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/tables/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/tables/duplicates` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/users` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/admin/users/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/auth/google` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/auth/google/callback` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/communication-platforms` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/communication-platforms/admin` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/:slug` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/:slug/insights` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/:slug/reviews` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/insights` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/me` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/tables` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/gm/tables/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/me` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/me/options` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/profile/links` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/profile/me` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/profile/me/discord` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/scenario-suggestions/mine` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/scenarios` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/scenarios/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/settings/suggest-styles` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/system-suggestions/mine` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/systems` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/systems/health` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/tables` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/tables/:slug` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/tables/:slug/favorite` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/tables/style-facets` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/vtt-platforms` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/vtt-platforms/admin` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/auth/discord/callback` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/auth/discord/connect` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/auth/google` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/auth/google/callback` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/og/:type/:slug` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/dev-feedback/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/discord/chat-exporter/profiles/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/discord/drafts/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/discord/drafts/batch` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/discord/duplicate-candidates/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/discord/messages/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/discord/messages/batch` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/discord/sources/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/import/drafts/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/scenario-suggestions/:id/approve` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/scenario-suggestions/:id/reject` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/system-suggestions/:id/approve` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/system-suggestions/:id/reject` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/table-duplicate-candidates/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/admin/users/:id/covil` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/gm/tables/:id/archive` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/gm/tables/:id/status` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/notifications/read-all` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/profile/gm` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/profile/links/reorder` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/profile/me` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/profile/me/gm` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/profile/me/player` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/profile/me/profile` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/v1/profile/player` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/dev-feedback/merge` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/automation/auto-approval/guard` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/chat-exporter/profiles` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/chat-exporter/profiles/:id/run` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/chat-exporter/profiles/:id/test` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/chat-exporter/run` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/chat-exporter/test` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/chat-exporter/validate-token` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/drafts/:id/audit-completeness` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/drafts/:id/audit-field/:field` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/drafts/{id}/correction` | 📄 CONTRACT_ONLY | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/drafts/{id}/correction/retry-learning` | 📄 CONTRACT_ONLY | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/drafts/:id/refresh-image` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/drafts/:id/reparse` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/drafts/:id/sync` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/fetch` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/import-json` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/import-json/file` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/import-json/preview` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/import-json/preview/file` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/import-json/reparse` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/messages/:id/diagnose-content` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/messages/:id/parse` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/messages/parse-batch` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/sources` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/sources/:sourceId/reingest-force` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/discord/sync-ready` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/import/drafts/{id}/correction` | 📄 CONTRACT_ONLY | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/import/drafts/{id}/correction/retry-learning` | 📄 CONTRACT_ONLY | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/import/drafts/:id/reparse` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/import/drafts/:id/sync` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/import/import-text` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/setting-suggestions` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/sync/enrich` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/system-suggestions/:id/resolve` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/systems/projection-sync` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/tables/auto-archive` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/tables/batch` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/admin/tables/duplicates/scan` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/auth/logout` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/communication-platforms/admin` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/dev-feedback` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/:slug/contact` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/:slug/contact-click` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/:slug/reviews` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/:slug/view` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/parse-preview` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/profile` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/tables` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/tables/:id/click` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/tables/:id/contact` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/tables/:id/favorite` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/gm/tables/:slug/view` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/profile/links` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/profile/me/connect/discord` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/profile/me/google-picture` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/profile/systems` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/scenario-suggestions` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/scenarios/admin` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/system-suggestions` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/systems/admin` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/tables/:slug/click` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/tables/:slug/favorite` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/tables/:slug/report` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/tables/:slug/view` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/upload` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/upload/url` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/vtt-platforms/admin` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/v1/vtt-platforms/suggest` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/auth/discord/verify-covil` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/auth/logout` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/admin/discord/chat-exporter/config` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/admin/discord/settings/bot-token` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/admin/setting-suggestions/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/admin/tables/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/communication-platforms/admin/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/gm/profile` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/gm/tables/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/me/preferences` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/scenarios/admin/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/systems/admin/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/v1/vtt-platforms/admin/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |

### mesas-frontend (0 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| GET | `/api/v1/masters/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/v1/profile/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/:param` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 🆕 Novo (não bloqueante) |

### site (43 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| DELETE | `/api/admin/v1/feedback/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/admin/v1/media/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/admin/v1/pages/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| DELETE | `/api/admin/v1/posts/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/admin/preview/:type/:id` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/admin/status` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/catalog/health` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/catalog/nodes/:idOrSlug` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/catalog/resolve` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/catalog/snapshot` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/catalog/systems` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/feedback` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/media` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/pages` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/pages/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/posts` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/posts/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/redirects` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/slug-check` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/admin/v1/taxonomies` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| GET | `/api/catalog/v1/health` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/catalog/v1/nodes/:idOrSlug` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/catalog/v1/resolve` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/catalog/v1/snapshot` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| GET | `/api/catalog/v1/systems` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PATCH | `/api/admin/v1/feedback/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/admin/import` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/admin/rebuild` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/catalog/nodes` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/media` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/pages` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/pages/:id/status` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/posts` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/posts/:id/status` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/preview` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/redirects` | 🕳️ UNUSED_ROUTE | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| POST | `/api/admin/v1/taxonomies` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/api/catalog/v1/nodes` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |
| PUT | `/api/admin/v1/catalog/nodes/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/admin/v1/media/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/admin/v1/pages/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/admin/v1/posts/:id` | ✅ OK | ✅ | ✅ | 🆕 Novo (não bloqueante) |
| PUT | `/api/catalog/v1/nodes/:id` | 👻 ORPHAN_SUSPECT | ✅ | ❌ | 🆕 Novo (não bloqueante) |

### site-admin (0 rotas no inventário)

| Method | Path | Estado | OpenAPI | Consumidor | Obs |
|--------|------|:-----:|:-------:|:----------:|-----|
| GET | `/api/admin/v1` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/media` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 🆕 Novo (não bloqueante) |
| POST | `/preview` | 🔍 CONSUMER_ONLY | ❌ | ✅ | 🆕 Novo (não bloqueante) |

## Rotas órfãs suspeitas

Rotas existentes no código/OpenAPI, sem consumidor detectado e sem classificação que justifique.

### accounts (1 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| GET | `/internal/users/:id` | ✅ | public | Sem consumidor e scope não justifica |
### downloads (29 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| DELETE | `/api/v1/collections/:id/items/:materialId` | ✅ | public | Sem consumidor e scope não justifica |
| DELETE | `/api/v1/comments/:id` | ✅ | public | Sem consumidor e scope não justifica |
| DELETE | `/api/v1/favorites/:materialId` | ✅ | public | Sem consumidor e scope não justifica |
| DELETE | `/api/v1/reports/:id` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/collections` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/collections/:id/items` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/comments/:materialId` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/creators/:slug` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/creators/me` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/destinations/:id` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/favorites` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/material-metadata/:materialId` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/materials` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/materials/:slug` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/materials/:id/history` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/organizations` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/organizations/:id/members` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/v1/ratings/:materialId` | ✅ | public | Sem consumidor e scope não justifica |
| PATCH | `/api/v1/materials/:id` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/collections` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/collections/:id/items` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/comments` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/downloads` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/favorites` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/materials` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/organizations` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/v1/reports` | ✅ | public | Sem consumidor e scope não justifica |
| PUT | `/api/v1/material-metadata/:materialId` | ✅ | public | Sem consumidor e scope não justifica |
| PUT | `/api/v1/ratings` | ✅ | public | Sem consumidor e scope não justifica |
### glossario (1 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| GET | `/sitemap.xml` | ✅ | public | Sem consumidor e scope não justifica |
### mesas (2 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| PATCH | `/api/v1/profile/me/gm` | ✅ | public | Sem consumidor e scope não justifica |
| PATCH | `/api/v1/profile/me/player` | ✅ | public | Sem consumidor e scope não justifica |
### site (6 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| GET | `/api/catalog/v1/nodes/:idOrSlug` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/catalog/v1/resolve` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/catalog/v1/snapshot` | ✅ | public | Sem consumidor e scope não justifica |
| GET | `/api/catalog/v1/systems` | ✅ | public | Sem consumidor e scope não justifica |
| POST | `/api/catalog/v1/nodes` | ✅ | public | Sem consumidor e scope não justifica |
| PUT | `/api/catalog/v1/nodes/:id` | ✅ | public | Sem consumidor e scope não justifica |

## Consumidores sem rota (CONSUMER_ONLY)

| App | Method | Path | Confidence |
|-----|--------|------|:---------:|
| glossario-frontend | DELETE | `/:param` | medium |
| links-frontend | DELETE | `/api/groups/:param/report` | medium |
| site-admin | GET | `/api/admin/v1` | low |
| mesas-frontend | GET | `/api/v1/masters/:param` | medium |
| mesas-frontend | GET | `/api/v1/profile/:param` | medium |
| mesas-frontend | POST | `/:param` | medium |
| site-admin | POST | `/media` | medium |
| site-admin | POST | `/preview` | medium |
| glossario-frontend | PUT | `/:param` | medium |

## Recomendação de allowlist

Para aceitar as divergências atuais como legado e não bloquear, execute:

```bash
pnpm api:check --generate-allowlist
```
