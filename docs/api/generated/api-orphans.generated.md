# Relatório de Rotas Órfãs e Duplicadas

**Gerado em:** 2026-06-28T13:21:55.659Z
**Modo:** inicial
**Este relatório NÃO bloqueia o build.**

---

## Sumário

| Categoria | Quantidade | Bloqueia? |
|-----------|:----------:|:---------:|
| 👻 Órfãs suspeitas (ORPHAN_SUSPECT) | 119 | ❌ |
| 🔀 Duplicatas suspeitas (score ≥ 80) | 200 | ❌ |

## Rotas órfãs suspeitas

Rotas existentes no código/OpenAPI, sem consumidor detectado e sem classificação que justifique ausência de uso.

### accounts (6 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| GET | `/` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/auth/google` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/auth/google/callback` | ✅ | public | Scope "public" sem consumidor |
| GET | `/conta` | ✅ | public | Scope "public" sem consumidor |
| GET | `/login` | ✅ | public | Scope "public" sem consumidor |
| USE | `<factory>` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
### glossario (52 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| DELETE | `/api/categories/:id` | ✅ | public | Scope "public" sem consumidor |
| DELETE | `/api/scenarios/:id` | ✅ | public | Scope "public" sem consumidor |
| DELETE | `/api/social/comments/:id` | ✅ | public | Scope "public" sem consumidor |
| DELETE | `/api/systems/:id` | ✅ | public | Scope "public" sem consumidor |
| DELETE | `/api/systems/editions/:id` | ✅ | public | Scope "public" sem consumidor |
| DELETE | `/api/terms/:id` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/categories` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/changelog` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/export/matecat` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/notifications` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/scenarios` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/social/:id/comments` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/systems` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/systems/:systemId/editions` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/terms` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/terms/:id/history` | ✅ | public | Scope "public" sem consumidor |
| PATCH | `/api/notifications/:id/read` | ✅ | public | Scope "public" sem consumidor |
| PATCH | `/api/notifications/read-all` | ✅ | public | Scope "public" sem consumidor |
| PATCH | `/api/terms/:id` | ✅ | public | Scope "public" sem consumidor |
| PATCH | `/api/terms/:id/approve` | ✅ | public | Scope "public" sem consumidor |
| PATCH | `/api/users/profile` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/auth/login` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/auth/register` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/categories` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/migration/claim` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/migration/verify` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/scenarios` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/social/:id/comments` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/social/:id/vote` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/systems` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/systems/:systemId/editions` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/terms` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/terms/import` | ✅ | public | Scope "public" sem consumidor |
| PUT | `/api/categories/:id` | ✅ | public | Scope "public" sem consumidor |
| PUT | `/api/scenarios/:id` | ✅ | public | Scope "public" sem consumidor |
| PUT | `/api/systems/:id` | ✅ | public | Scope "public" sem consumidor |
| PUT | `/api/systems/editions/:id` | ✅ | public | Scope "public" sem consumidor |
| USE | `/api/admin/activity` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/admin/feedback` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/auth` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/categories` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/changelog` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/export` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/feedback` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/migration` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/notifications` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/scenarios` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/social` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/systems` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/terms` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/terms/import` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/users` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
### links (3 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| GET | `/api/groups/:slug` | ✅ | public | Scope "public" sem consumidor |
| GET | `/grupo/:slug` | ✅ | public | Scope "public" sem consumidor |
| USE | `/api/admin/v1` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
### mesas (58 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| DELETE | `/api/v1/gm/tables/:id` | ✅ | public | Scope "public" sem consumidor |
| DELETE | `/api/v1/profile/me/connect/discord` | ✅ | public | Scope "public" sem consumidor |
| DELETE | `/auth/discord/disconnect` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/auth/google` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/auth/google/callback` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/profile/me/discord` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/scenario-suggestions/mine` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/system-suggestions/mine` | ✅ | public | Scope "public" sem consumidor |
| GET | `/auth/discord/callback` | ✅ | public | Scope "public" sem consumidor |
| GET | `/auth/discord/connect` | ✅ | public | Scope "public" sem consumidor |
| GET | `/auth/google` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| GET | `/auth/google/callback` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| GET | `/og/{*splat}` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| GET | `/og/:type/:slug` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/auth/logout` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/gm/tables` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/gm/tables/:id/click` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/gm/tables/:id/contact` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/gm/tables/:id/favorite` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/gm/tables/:slug/view` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/profile/me/connect/discord` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/system-suggestions` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/vtt-platforms/suggest` | ✅ | public | Scope "public" sem consumidor |
| POST | `/auth/discord/verify-covil` | ✅ | public | Scope "public" sem consumidor |
| POST | `/auth/logout` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| PUT | `/api/v1/gm/tables/:id` | ✅ | public | Scope "public" sem consumidor |
| USE | `/api/v1` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/admin` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/admin/discord` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/admin/discord/discovery` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/admin/discord/drafts` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/admin/discord/import-json` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/admin/discord/messages` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/admin/discord/metrics` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/admin/discord/settings` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/admin/discord/sources` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/admin/import` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/admin/import/drafts` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/admin/import/import-text` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/admin/import/metrics` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/admin/setting-suggestions` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/auth` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/changelog` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/communication-platforms` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/dev-feedback` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/gm` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/me` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/notifications` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/profile` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/scenario-suggestions` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/scenarios` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/settings` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/system-suggestions` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/systems` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/tables` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/api/v1/vtt-platforms` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/auth` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |
| USE | `/og` | ❌ | — (sem OpenAPI) | CODE_ONLY sem classificação |

### Observações

- Rotas sem OpenAPI (CODE_ONLY) não têm classificação `x-artificio-*` — podem ser admin/cron/legacy legítimas mas ainda não documentadas.
- Rotas com scope `public` sem consumidor: revisar se são realmente necessárias ou se o consumidor não foi detectado (confidence low).

---

## Rotas Duplicadas Suspeitas

Pares de rotas com similaridade ≥ 75 e tokenSimilarity ≥ 0.5. Score máximo = 100 (method 40 + token 40 + owner 10 + scope 10).

### Score ≥ 80 (alta probabilidade)

| Score | Method | Rota A | Rota B | App | Observação |
|:----:|:-----:|--------|--------|:---:|------------|
| **100** | GET | `/api/groups` | `/api/groups/:slug` | links | Mesmo app e scope |
| **100** | GET | `/api/v1/admin/discord/drafts` | `/api/v1/admin/discord/drafts/:id` | mesas | Mesmo app e scope |
| **100** | GET | `/api/v1/admin/import/drafts` | `/api/v1/admin/import/drafts/:id` | mesas | Mesmo app e scope |
| **100** | GET | `/api/v1/admin/users` | `/api/v1/admin/users/:id` | mesas | Mesmo app e scope |
| **100** | GET | `/api/v1/gm/:slug/insights` | `/api/v1/gm/insights` | mesas | Mesmo app e scope |
| **100** | GET | `/api/v1/gm/tables` | `/api/v1/gm/tables/:id` | mesas | Mesmo app e scope |
| **100** | GET | `/api/v1/scenarios` | `/api/v1/scenarios/:id` | mesas | Mesmo app e scope |
| **100** | GET | `/api/v1/tables` | `/api/v1/tables/:slug` | mesas | Mesmo app e scope |
| **93** | GET | `/api/v1/admin/discord/discovery/guilds` | `/api/v1/admin/discord/discovery/guilds/:guildId/channels` | mesas | Mesmo app e scope |
| **93** | POST | `/api/v1/admin/discord/import-json/preview` | `/api/v1/admin/discord/import-json/preview/file` | mesas | Mesmo app e scope |
| **92** | GET | `/api/v1/admin/discord/metrics` | `/api/v1/admin/discord/metrics/shadow` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/drafts/:id/refresh-image` | `/api/v1/admin/discord/drafts/:id/reparse` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/drafts/:id/refresh-image` | `/api/v1/admin/discord/drafts/:id/sync` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/drafts/:id/reparse` | `/api/v1/admin/discord/drafts/:id/sync` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/drafts/:id/reparse` | `/api/v1/admin/discord/import-json/reparse` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/drafts/:id/reparse` | `/api/v1/admin/import/drafts/:id/reparse` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/drafts/:id/sync` | `/api/v1/admin/import/drafts/:id/sync` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/import-json` | `/api/v1/admin/discord/import-json/file` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/import-json` | `/api/v1/admin/discord/import-json/preview` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/import-json` | `/api/v1/admin/discord/import-json/reparse` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/import-json/file` | `/api/v1/admin/discord/import-json/preview` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/import-json/file` | `/api/v1/admin/discord/import-json/reparse` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/import-json/preview` | `/api/v1/admin/discord/import-json/reparse` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/messages/:id/diagnose-content` | `/api/v1/admin/discord/messages/:id/parse` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/messages/:id/diagnose-content` | `/api/v1/admin/discord/messages/parse-batch` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/messages/:id/parse` | `/api/v1/admin/discord/messages/parse-batch` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/sources` | `/api/v1/admin/discord/sources/:sourceId/reingest-force` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/import/drafts/:id/reparse` | `/api/v1/admin/import/drafts/:id/sync` | mesas | Mesmo app e scope |
| **90** | GET | `/api/auth/google` | `/api/auth/google/callback` | accounts | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/drafts` | `/api/v1/admin/discord/messages` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/drafts` | `/api/v1/admin/discord/metrics` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/drafts` | `/api/v1/admin/discord/settings` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/drafts` | `/api/v1/admin/discord/sources` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/drafts` | `/api/v1/admin/import/drafts` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/drafts` | `/api/v1/admin/import/drafts/:id` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/drafts/:id` | `/api/v1/admin/discord/messages` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/drafts/:id` | `/api/v1/admin/discord/metrics` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/drafts/:id` | `/api/v1/admin/discord/settings` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/drafts/:id` | `/api/v1/admin/discord/sources` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/drafts/:id` | `/api/v1/admin/import/drafts` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/drafts/:id` | `/api/v1/admin/import/drafts/:id` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/messages` | `/api/v1/admin/discord/metrics` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/messages` | `/api/v1/admin/discord/settings` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/messages` | `/api/v1/admin/discord/sources` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/metrics` | `/api/v1/admin/discord/settings` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/metrics` | `/api/v1/admin/discord/sources` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/metrics` | `/api/v1/admin/import/metrics` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/discord/settings` | `/api/v1/admin/discord/sources` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/import/drafts` | `/api/v1/admin/import/metrics` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/import/drafts/:id` | `/api/v1/admin/import/metrics` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/admin/system-suggestions` | `/api/v1/admin/system-suggestions/:id/candidates` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/auth/google` | `/api/v1/auth/google/callback` | mesas | Mesmo app e scope |
| **90** | GET | `/api/v1/profile/me` | `/api/v1/profile/me/discord` | mesas | Mesmo app e scope |
| **90** | GET | `/og/{*splat}` | `/og/:type/:slug` | mesas | Mesmo app |
| **90** | PATCH | `/api/v1/admin/discord/drafts/:id` | `/api/v1/admin/discord/messages/:id` | mesas | Mesmo app e scope |
| **90** | PATCH | `/api/v1/admin/discord/drafts/:id` | `/api/v1/admin/discord/sources/:id` | mesas | Mesmo app e scope |
| **90** | PATCH | `/api/v1/admin/discord/drafts/:id` | `/api/v1/admin/import/drafts/:id` | mesas | Mesmo app e scope |
| **90** | PATCH | `/api/v1/admin/discord/messages/:id` | `/api/v1/admin/discord/sources/:id` | mesas | Mesmo app e scope |
| **90** | PATCH | `/api/v1/admin/scenario-suggestions/:id/approve` | `/api/v1/admin/scenario-suggestions/:id/reject` | mesas | Mesmo app e scope |
| **90** | PATCH | `/api/v1/admin/scenario-suggestions/:id/approve` | `/api/v1/admin/system-suggestions/:id/approve` | mesas | Mesmo app e scope |
| **90** | PATCH | `/api/v1/admin/scenario-suggestions/:id/reject` | `/api/v1/admin/system-suggestions/:id/reject` | mesas | Mesmo app e scope |
| **90** | PATCH | `/api/v1/admin/system-suggestions/:id/approve` | `/api/v1/admin/system-suggestions/:id/reject` | mesas | Mesmo app e scope |
| **90** | PATCH | `/api/v1/gm/tables/:id/archive` | `/api/v1/gm/tables/:id/status` | mesas | Mesmo app e scope |
| **90** | PATCH | `/api/v1/profile/me` | `/api/v1/profile/me/gm` | mesas | Mesmo app e scope |
| **90** | PATCH | `/api/v1/profile/me` | `/api/v1/profile/me/player` | mesas | Mesmo app e scope |
| **90** | PATCH | `/api/v1/profile/me` | `/api/v1/profile/me/profile` | mesas | Mesmo app e scope |
| **90** | PATCH | `/api/v1/profile/me/gm` | `/api/v1/profile/me/player` | mesas | Mesmo app e scope |
| **90** | PATCH | `/api/v1/profile/me/gm` | `/api/v1/profile/me/profile` | mesas | Mesmo app e scope |
| **90** | PATCH | `/api/v1/profile/me/player` | `/api/v1/profile/me/profile` | mesas | Mesmo app e scope |
| **90** | POST | `/api/admin/v1/groups/:id/accept` | `/api/admin/v1/groups/:id/archive` | links | Mesmo app e scope |
| **90** | POST | `/api/admin/v1/groups/:id/accept` | `/api/admin/v1/groups/rehydrate-logos` | links | Mesmo app e scope |
| **90** | POST | `/api/admin/v1/groups/:id/archive` | `/api/admin/v1/groups/rehydrate-logos` | links | Mesmo app e scope |
| **90** | POST | `/api/v1/admin/discord/fetch` | `/api/v1/admin/discord/import-json` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/admin/discord/fetch` | `/api/v1/admin/discord/sources` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/admin/discord/fetch` | `/api/v1/admin/discord/sync-ready` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/admin/discord/import-json` | `/api/v1/admin/discord/sources` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/admin/discord/import-json` | `/api/v1/admin/discord/sync-ready` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/admin/discord/sources` | `/api/v1/admin/discord/sync-ready` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/gm/tables` | `/api/v1/gm/tables/:id/click` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/gm/tables` | `/api/v1/gm/tables/:id/contact` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/gm/tables` | `/api/v1/gm/tables/:id/favorite` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/gm/tables` | `/api/v1/gm/tables/:slug/view` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/gm/tables/:id/click` | `/api/v1/gm/tables/:id/contact` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/gm/tables/:id/click` | `/api/v1/gm/tables/:id/favorite` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/gm/tables/:id/click` | `/api/v1/gm/tables/:slug/view` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/gm/tables/:id/contact` | `/api/v1/gm/tables/:id/favorite` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/gm/tables/:id/contact` | `/api/v1/gm/tables/:slug/view` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/gm/tables/:id/favorite` | `/api/v1/gm/tables/:slug/view` | mesas | Mesmo app e scope |
| **90** | POST | `/api/v1/profile/me/google-picture` | `/api/v1/profile/me/systems` | mesas | Mesmo app e scope |
| **87** | DELETE | `/api/systems/:id` | `/api/systems/editions/:id` | glossario | Mesmo app e scope |
| **87** | DELETE | `/api/admin/v1/groups/:id` | `/api/admin/v1/tags/:id` | links | Mesmo app e scope |
| **87** | DELETE | `/api/v1/admin/dev-feedback/:id` | `/api/v1/admin/setting-suggestions/:id` | mesas | Mesmo app e scope |
| **87** | DELETE | `/api/v1/admin/dev-feedback/:id` | `/api/v1/admin/tables/:id` | mesas | Mesmo app e scope |
| **87** | DELETE | `/api/v1/admin/setting-suggestions/:id` | `/api/v1/admin/tables/:id` | mesas | Mesmo app e scope |
| **87** | DELETE | `/api/v1/communication-platforms/admin/:id` | `/api/v1/scenarios/admin/:id` | mesas | Mesmo app e scope |
| **87** | DELETE | `/api/v1/communication-platforms/admin/:id` | `/api/v1/systems/admin/:id` | mesas | Mesmo app e scope |
| **87** | DELETE | `/api/v1/communication-platforms/admin/:id` | `/api/v1/vtt-platforms/admin/:id` | mesas | Mesmo app e scope |
| **87** | DELETE | `/api/v1/profile/links/:id` | `/api/v1/profile/systems/:id` | mesas | Mesmo app e scope |
| **87** | DELETE | `/api/v1/scenarios/admin/:id` | `/api/v1/systems/admin/:id` | mesas | Mesmo app e scope |
| **87** | DELETE | `/api/v1/scenarios/admin/:id` | `/api/v1/vtt-platforms/admin/:id` | mesas | Mesmo app e scope |
| **87** | DELETE | `/api/v1/systems/admin/:id` | `/api/v1/vtt-platforms/admin/:id` | mesas | Mesmo app e scope |
| **87** | GET | `/api/auth/me` | `/api/auth/refresh` | accounts | Mesmo app e scope |
| **87** | GET | `/api/admin/activity` | `/api/admin/feedback` | glossario | Mesmo app e scope |
| **87** | GET | `/api/systems` | `/api/systems/:systemId/editions` | glossario | Mesmo app e scope |
| **87** | GET | `/api/terms` | `/api/terms/:id/history` | glossario | Mesmo app e scope |
| **87** | GET | `/api/admin/v1/groups` | `/api/admin/v1/reports` | links | Mesmo app e scope |
| **87** | GET | `/api/admin/v1/groups` | `/api/admin/v1/tags` | links | Mesmo app e scope |
| **87** | GET | `/api/admin/v1/reports` | `/api/admin/v1/tags` | links | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/activity` | `/api/v1/admin/dev-feedback` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/activity` | `/api/v1/admin/scenario-suggestions` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/activity` | `/api/v1/admin/setting-suggestions` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/activity` | `/api/v1/admin/system-suggestions` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/activity` | `/api/v1/admin/users` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/activity` | `/api/v1/admin/users/:id` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/dev-feedback` | `/api/v1/admin/scenario-suggestions` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/dev-feedback` | `/api/v1/admin/setting-suggestions` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/dev-feedback` | `/api/v1/admin/system-suggestions` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/dev-feedback` | `/api/v1/admin/users` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/dev-feedback` | `/api/v1/admin/users/:id` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/scenario-suggestions` | `/api/v1/admin/setting-suggestions` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/scenario-suggestions` | `/api/v1/admin/system-suggestions` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/scenario-suggestions` | `/api/v1/admin/users` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/scenario-suggestions` | `/api/v1/admin/users/:id` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/setting-suggestions` | `/api/v1/admin/system-suggestions` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/setting-suggestions` | `/api/v1/admin/users` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/setting-suggestions` | `/api/v1/admin/users/:id` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/system-suggestions` | `/api/v1/admin/users` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/admin/system-suggestions` | `/api/v1/admin/users/:id` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/communication-platforms/admin` | `/api/v1/vtt-platforms/admin` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/gm/:slug` | `/api/v1/gm/:slug/insights` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/gm/:slug` | `/api/v1/gm/insights` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/gm/:slug` | `/api/v1/gm/me` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/gm/:slug` | `/api/v1/gm/tables` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/gm/:slug` | `/api/v1/gm/tables/:id` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/gm/:slug/insights` | `/api/v1/gm/me` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/gm/:slug/insights` | `/api/v1/gm/tables` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/gm/:slug/insights` | `/api/v1/gm/tables/:id` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/gm/insights` | `/api/v1/gm/me` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/gm/insights` | `/api/v1/gm/tables` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/gm/insights` | `/api/v1/gm/tables/:id` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/gm/me` | `/api/v1/gm/tables` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/gm/me` | `/api/v1/gm/tables/:id` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/gm/me` | `/api/v1/profile/me` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/me` | `/api/v1/me/options` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/profile/links` | `/api/v1/profile/me` | mesas | Mesmo app e scope |
| **87** | GET | `/api/v1/scenario-suggestions/mine` | `/api/v1/system-suggestions/mine` | mesas | Mesmo app e scope |
| **87** | GET | `/auth/discord/callback` | `/auth/discord/connect` | mesas | Mesmo app e scope |
| **87** | PATCH | `/api/notifications/:id/read` | `/api/notifications/read-all` | glossario | Mesmo app e scope |
| **87** | PATCH | `/api/terms/:id` | `/api/terms/:id/approve` | glossario | Mesmo app e scope |
| **87** | PATCH | `/api/admin/v1/groups/:id` | `/api/admin/v1/reports/:id` | links | Mesmo app e scope |
| **87** | PATCH | `/api/admin/v1/groups/:id` | `/api/admin/v1/tags/:id` | links | Mesmo app e scope |
| **87** | PATCH | `/api/admin/v1/reports/:id` | `/api/admin/v1/tags/:id` | links | Mesmo app e scope |
| **87** | PATCH | `/api/v1/notifications/:id/read` | `/api/v1/notifications/read-all` | mesas | Mesmo app e scope |
| **87** | PATCH | `/api/v1/profile/gm` | `/api/v1/profile/me` | mesas | Mesmo app e scope |
| **87** | PATCH | `/api/v1/profile/gm` | `/api/v1/profile/player` | mesas | Mesmo app e scope |
| **87** | PATCH | `/api/v1/profile/me` | `/api/v1/profile/player` | mesas | Mesmo app e scope |
| **87** | POST | `/api/admin/v1/rebuild` | `/api/admin/v1/tags` | links | Mesmo app e scope |
| **87** | POST | `/api/groups/:slug/report` | `/api/groups/suggest` | links | Mesmo app e scope |
| **87** | POST | `/api/auth/login` | `/api/auth/register` | glossario | Mesmo app e scope |
| **87** | POST | `/api/migration/claim` | `/api/migration/verify` | glossario | Mesmo app e scope |
| **87** | POST | `/api/social/:id/comments` | `/api/social/:id/vote` | glossario | Mesmo app e scope |
| **87** | POST | `/api/systems` | `/api/systems/:systemId/editions` | glossario | Mesmo app e scope |
| **87** | POST | `/api/terms` | `/api/terms/import` | glossario | Mesmo app e scope |
| **87** | POST | `/api/v1/admin/discord/import-json` | `/api/v1/admin/discord/import-json/preview/file` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/admin/discord/import-json/file` | `/api/v1/admin/discord/import-json/preview/file` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/admin/discord/import-json/preview/file` | `/api/v1/admin/discord/import-json/reparse` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/communication-platforms/admin` | `/api/v1/scenarios/admin` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/communication-platforms/admin` | `/api/v1/systems/admin` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/communication-platforms/admin` | `/api/v1/vtt-platforms/admin` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/gm/:slug/contact` | `/api/v1/gm/:slug/contact-click` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/gm/:slug/contact` | `/api/v1/gm/:slug/view` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/gm/:slug/contact` | `/api/v1/gm/profile` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/gm/:slug/contact` | `/api/v1/gm/tables` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/gm/:slug/contact-click` | `/api/v1/gm/:slug/view` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/gm/:slug/contact-click` | `/api/v1/gm/profile` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/gm/:slug/contact-click` | `/api/v1/gm/tables` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/gm/:slug/view` | `/api/v1/gm/profile` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/gm/:slug/view` | `/api/v1/gm/tables` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/gm/:slug/view` | `/api/v1/tables/:slug/view` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/gm/profile` | `/api/v1/gm/tables` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/profile/links` | `/api/v1/profile/systems` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/scenarios/admin` | `/api/v1/systems/admin` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/scenarios/admin` | `/api/v1/vtt-platforms/admin` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/systems/admin` | `/api/v1/vtt-platforms/admin` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/tables/:slug/click` | `/api/v1/tables/:slug/view` | mesas | Mesmo app e scope |
| **87** | POST | `/api/v1/upload` | `/api/v1/upload/url` | mesas | Mesmo app e scope |
| **87** | PUT | `/api/systems/:id` | `/api/systems/editions/:id` | glossario | Mesmo app e scope |
| **87** | PUT | `/api/v1/admin/setting-suggestions/:id` | `/api/v1/admin/tables/:id` | mesas | Mesmo app e scope |
| **87** | PUT | `/api/v1/communication-platforms/admin/:id` | `/api/v1/scenarios/admin/:id` | mesas | Mesmo app e scope |
| **87** | PUT | `/api/v1/communication-platforms/admin/:id` | `/api/v1/systems/admin/:id` | mesas | Mesmo app e scope |
| **87** | PUT | `/api/v1/communication-platforms/admin/:id` | `/api/v1/vtt-platforms/admin/:id` | mesas | Mesmo app e scope |
| **87** | PUT | `/api/v1/gm/profile` | `/api/v1/gm/tables/:id` | mesas | Mesmo app e scope |
| **87** | PUT | `/api/v1/scenarios/admin/:id` | `/api/v1/systems/admin/:id` | mesas | Mesmo app e scope |
| **87** | PUT | `/api/v1/scenarios/admin/:id` | `/api/v1/vtt-platforms/admin/:id` | mesas | Mesmo app e scope |
| **87** | PUT | `/api/v1/systems/admin/:id` | `/api/v1/vtt-platforms/admin/:id` | mesas | Mesmo app e scope |
| **84** | DELETE | `/api/v1/admin/discord/settings/bot-token` | `/api/v1/admin/discord/sources/:id` | mesas | Mesmo app e scope |
| **84** | DELETE | `/api/v1/profile/me/connect/discord` | `/api/v1/profile/me/systems/:id` | mesas | Mesmo app e scope |
| **84** | GET | `/api/admin/v1/groups` | `/api/admin/v1/groups/rehydrate-logos/status` | links | Mesmo app e scope |
| **84** | GET | `/api/v1/admin/discord/discovery/guilds` | `/api/v1/admin/discord/drafts` | mesas | Mesmo app e scope |
| **84** | GET | `/api/v1/admin/discord/discovery/guilds` | `/api/v1/admin/discord/drafts/:id` | mesas | Mesmo app e scope |

### Considerações

- Rotas intencionalmente similares (ex: `contact` vs `contact-click`) geram falso positivo. Avaliar manualmente antes de consolidar.
- Duplicatas entre subsistemas diferentes (ex: discord vs inbox) podem ser arquiteturais, não erros.
- Threshold atual: 75 com tokenSimilarity mínimo de 0.5. Para reduzir ruído, subir para 80.

## Recomendações

1. **Órfãs:** Revisar cada rota órfã e decidir: remover, marcar como `legacy` no OpenAPI, ou justificar com scope adequado.
2. **Duplicatas:** Avaliar se as rotas com score ≥ 80 devem ser consolidadas ou se são intencionalmente distintas.
3. Para ajustar thresholds ou desabilitar o relatório, editar a seção Fase 6 em `scripts/api/check-api.ts`.
