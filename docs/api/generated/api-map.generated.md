# Mapa de Rotas — Artifício RPG

> Gerado automaticamente por `scripts/api/inventory.ts` em 1970-01-01.
> **Não editar manualmente.** Fonte: `docs/api/generated/api-inventory.generated.json`.

## Convenção de Auth (DEB-055-08)

A resolução de auth por AST tem limitações (middleware dentro do arquivo de rota).
Use esta convenção como fallback documentado:

- Rotas com prefixo `/admin` → escopo **admin** (restrito a admins)
- Rotas com prefixo `/gm` → escopo **user** (usuário logado, dono do recurso)
- Rotas sem prefixo restrito → escopo **public** ou **user** (depende do app)
- Rotas `/health`, `/api/auth/*` → escopo **internal**/**public** (sem auth)

Para informação granular (auth exata, rate-limit, payload), consulte os contratos OpenAPI em `docs/api/openapi/*.yaml` e os metadados `x-artificio-*`.

## Estatísticas

| App | Total | HIGH | MEDIUM | LOW | Methods |
|-----|-------|------|--------|-----|---------|
| accounts | 11 | 11 | 0 | 0 | GET, POST, PUT |
| downloads | 65 | 65 | 0 | 0 | DELETE, GET, PATCH, POST, PUT, USE |
| glossario | 62 | 62 | 0 | 0 | DELETE, GET, PATCH, POST, PUT, USE |
| links | 23 | 23 | 0 | 0 | DELETE, GET, PATCH, POST, USE |
| mesas | 229 | 229 | 0 | 0 | DELETE, GET, PATCH, POST, PUT, USE |
| site | 52 | 52 | 0 | 0 | DELETE, GET, PATCH, POST, PUT, USE |
| **Total** | **442** | 442 | 0 | 0 | |

## accounts

| Método | Path | Confiança | Arquivo | Linha |
|--------|------|-----------|---------|------|
| GET | `/` | ✅ high | `apps/accounts/src/app.ts` | 178 |
| GET | `/admin/secrets/:name` | ✅ high | `apps/accounts/src/adminSecretsRoutes.ts` | 112 |
| PUT | `/admin/secrets/:name` | ✅ high | `apps/accounts/src/adminSecretsRoutes.ts` | 73 |
| GET | `/api/auth/google` | ✅ high | `apps/accounts/src/app.ts` | 93 |
| GET | `/api/auth/google/callback` | ✅ high | `apps/accounts/src/app.ts` | 106 |
| POST | `/api/auth/logout` | ✅ high | `apps/accounts/src/app.ts` | 144 |
| GET | `/api/auth/me` | ✅ high | `apps/accounts/src/app.ts` | 140 |
| GET | `/api/auth/refresh` | ✅ high | `apps/accounts/src/app.ts` | 149 |
| GET | `/conta` | ✅ high | `apps/accounts/src/app.ts` | 178 |
| GET | `/health` | ✅ high | `apps/accounts/src/app.ts` | 89 |
| GET | `/login` | ✅ high | `apps/accounts/src/app.ts` | 178 |

## downloads

| Método | Path | Confiança | Arquivo | Linha |
|--------|------|-----------|---------|------|
| USE | `/api/v1/admin` | ✅ high | `apps/downloads/backend/src/server.ts` | 87 |
| GET | `/api/v1/admin/links` | ✅ high | `apps/downloads/backend/src/routes/admin.ts` | 93 |
| POST | `/api/v1/admin/materials/:id/check-link` | ✅ high | `apps/downloads/backend/src/routes/admin.ts` | 59 |
| POST | `/api/v1/admin/materials/:id/evidence/upload` | ✅ high | `apps/downloads/backend/src/routes/admin.ts` | 147 |
| GET | `/api/v1/admin/materials/:id/link-history` | ✅ high | `apps/downloads/backend/src/routes/admin.ts` | 43 |
| GET | `/api/v1/admin/metrics` | ✅ high | `apps/downloads/backend/src/routes/admin.ts` | 117 |
| POST | `/api/v1/admin/sanitize-preview` | ✅ high | `apps/downloads/backend/src/routes/admin.ts` | 207 |
| GET | `/api/v1/admin/summary` | ✅ high | `apps/downloads/backend/src/routes/admin.ts` | 15 |
| GET | `/api/v1/changelog` | ✅ high | `apps/downloads/backend/src/routes/changelog.ts` | 16 |
| USE | `/api/v1/changelog` | ✅ high | `apps/downloads/backend/src/server.ts` | 88 |
| GET | `/api/v1/collections` | ✅ high | `apps/downloads/backend/src/routes/collections.ts` | 20 |
| POST | `/api/v1/collections` | ✅ high | `apps/downloads/backend/src/routes/collections.ts` | 31 |
| USE | `/api/v1/collections` | ✅ high | `apps/downloads/backend/src/server.ts` | 84 |
| GET | `/api/v1/collections/:id/items` | ✅ high | `apps/downloads/backend/src/routes/collections.ts` | 60 |
| POST | `/api/v1/collections/:id/items` | ✅ high | `apps/downloads/backend/src/routes/collections.ts` | 87 |
| DELETE | `/api/v1/collections/:id/items/:materialId` | ✅ high | `apps/downloads/backend/src/routes/collections.ts` | 107 |
| POST | `/api/v1/comments` | ✅ high | `apps/downloads/backend/src/routes/comments.ts` | 16 |
| USE | `/api/v1/comments` | ✅ high | `apps/downloads/backend/src/server.ts` | 78 |
| DELETE | `/api/v1/comments/:id` | ✅ high | `apps/downloads/backend/src/routes/comments.ts` | 61 |
| GET | `/api/v1/comments/:materialId` | ✅ high | `apps/downloads/backend/src/routes/comments.ts` | 46 |
| USE | `/api/v1/creators` | ✅ high | `apps/downloads/backend/src/server.ts` | 79 |
| GET | `/api/v1/creators/:slug` | ✅ high | `apps/downloads/backend/src/routes/creators.ts` | 22 |
| GET | `/api/v1/creators/me` | ✅ high | `apps/downloads/backend/src/routes/creators.ts` | 13 |
| USE | `/api/v1/destinations` | ✅ high | `apps/downloads/backend/src/server.ts` | 80 |
| GET | `/api/v1/destinations/:id` | ✅ high | `apps/downloads/backend/src/routes/destinations.ts` | 10 |
| POST | `/api/v1/downloads` | ✅ high | `apps/downloads/backend/src/routes/downloads.ts` | 18 |
| USE | `/api/v1/downloads` | ✅ high | `apps/downloads/backend/src/server.ts` | 81 |
| GET | `/api/v1/favorites` | ✅ high | `apps/downloads/backend/src/routes/favorites.ts` | 14 |
| POST | `/api/v1/favorites` | ✅ high | `apps/downloads/backend/src/routes/favorites.ts` | 26 |
| USE | `/api/v1/favorites` | ✅ high | `apps/downloads/backend/src/server.ts` | 83 |
| DELETE | `/api/v1/favorites/:materialId` | ✅ high | `apps/downloads/backend/src/routes/favorites.ts` | 52 |
| GET | `/api/v1/health` | ✅ high | `apps/downloads/backend/src/server.ts` | 64 |
| USE | `/api/v1/material-metadata` | ✅ high | `apps/downloads/backend/src/server.ts` | 75 |
| GET | `/api/v1/material-metadata/:materialId` | ✅ high | `apps/downloads/backend/src/routes/materialMetadata.ts` | 37 |
| PUT | `/api/v1/material-metadata/:materialId` | ✅ high | `apps/downloads/backend/src/routes/materialMetadata.ts` | 61 |
| GET | `/api/v1/materials` | ✅ high | `apps/downloads/backend/src/routes/materials.ts` | 75 |
| POST | `/api/v1/materials` | ✅ high | `apps/downloads/backend/src/routes/materials.ts` | 242 |
| USE | `/api/v1/materials` | ✅ high | `apps/downloads/backend/src/server.ts` | 74 |
| PATCH | `/api/v1/materials/:id` | ✅ high | `apps/downloads/backend/src/routes/materials.ts` | 267 |
| GET | `/api/v1/materials/:id/history` | ✅ high | `apps/downloads/backend/src/routes/materials.ts` | 161 |
| GET | `/api/v1/materials/:slug` | ✅ high | `apps/downloads/backend/src/routes/materials.ts` | 191 |
| GET | `/api/v1/materials/mine` | ✅ high | `apps/downloads/backend/src/routes/materials.ts` | 147 |
| USE | `/api/v1/moderation` | ✅ high | `apps/downloads/backend/src/server.ts` | 76 |
| POST | `/api/v1/moderation/:id/approve` | ✅ high | `apps/downloads/backend/src/routes/moderation.ts` | 127 |
| POST | `/api/v1/moderation/:id/reject` | ✅ high | `apps/downloads/backend/src/routes/moderation.ts` | 71 |
| POST | `/api/v1/moderation/:id/submit` | ✅ high | `apps/downloads/backend/src/routes/moderation.ts` | 17 |
| PATCH | `/api/v1/moderation/batch/:action` | ✅ high | `apps/downloads/backend/src/routes/moderation.ts` | 196 |
| GET | `/api/v1/moderation/queue` | ✅ high | `apps/downloads/backend/src/routes/moderation.ts` | 54 |
| GET | `/api/v1/notifications` | ✅ high | `apps/downloads/backend/src/routes/notifications.ts` | 12 |
| USE | `/api/v1/notifications` | ✅ high | `apps/downloads/backend/src/server.ts` | 86 |
| PATCH | `/api/v1/notifications/:id/read` | ✅ high | `apps/downloads/backend/src/routes/notifications.ts` | 24 |
| GET | `/api/v1/organizations` | ✅ high | `apps/downloads/backend/src/routes/organizations.ts` | 16 |
| POST | `/api/v1/organizations` | ✅ high | `apps/downloads/backend/src/routes/organizations.ts` | 27 |
| USE | `/api/v1/organizations` | ✅ high | `apps/downloads/backend/src/server.ts` | 85 |
| GET | `/api/v1/organizations/:id/members` | ✅ high | `apps/downloads/backend/src/routes/organizations.ts` | 51 |
| PUT | `/api/v1/ratings` | ✅ high | `apps/downloads/backend/src/routes/ratings.ts` | 39 |
| USE | `/api/v1/ratings` | ✅ high | `apps/downloads/backend/src/server.ts` | 82 |
| GET | `/api/v1/ratings/:materialId` | ✅ high | `apps/downloads/backend/src/routes/ratings.ts` | 28 |
| GET | `/api/v1/reports` | ✅ high | `apps/downloads/backend/src/routes/reports.ts` | 142 |
| POST | `/api/v1/reports` | ✅ high | `apps/downloads/backend/src/routes/reports.ts` | 34 |
| USE | `/api/v1/reports` | ✅ high | `apps/downloads/backend/src/server.ts` | 77 |
| DELETE | `/api/v1/reports/:id` | ✅ high | `apps/downloads/backend/src/routes/reports.ts` | 96 |
| PATCH | `/api/v1/reports/:id` | ✅ high | `apps/downloads/backend/src/routes/reports.ts` | 162 |
| GET | `/api/v1/reports/abuse-check/:userId` | ✅ high | `apps/downloads/backend/src/routes/reports.ts` | 126 |
| GET | `/api/v1/reports/mine` | ✅ high | `apps/downloads/backend/src/routes/reports.ts` | 83 |

## glossario

| Método | Path | Confiança | Arquivo | Linha |
|--------|------|-----------|---------|------|
| GET | `/api/admin/activity` | ✅ high | `apps/glossario/backend/src/routes/adminActivityRoutes.ts` | 8 |
| USE | `/api/admin/activity` | ✅ high | `apps/glossario/backend/src/index.ts` | 92 |
| GET | `/api/admin/feedback` | ✅ high | `apps/glossario/backend/src/routes/feedbackAdminRoutes.ts` | 11 |
| USE | `/api/admin/feedback` | ✅ high | `apps/glossario/backend/src/index.ts` | 94 |
| DELETE | `/api/admin/feedback/:id` | ✅ high | `apps/glossario/backend/src/routes/feedbackAdminRoutes.ts` | 13 |
| PATCH | `/api/admin/feedback/:id` | ✅ high | `apps/glossario/backend/src/routes/feedbackAdminRoutes.ts` | 12 |
| USE | `/api/auth` | ✅ high | `apps/glossario/backend/src/index.ts` | 80 |
| POST | `/api/auth/login` | ✅ high | `apps/glossario/backend/src/routes/authRoutes.ts` | 10 |
| GET | `/api/auth/me` | ✅ high | `apps/glossario/backend/src/routes/authRoutes.ts` | 13 |
| POST | `/api/auth/register` | ✅ high | `apps/glossario/backend/src/routes/authRoutes.ts` | 9 |
| GET | `/api/categories` | ✅ high | `apps/glossario/backend/src/routes/categoryRoutes.ts` | 9 |
| POST | `/api/categories` | ✅ high | `apps/glossario/backend/src/routes/categoryRoutes.ts` | 10 |
| USE | `/api/categories` | ✅ high | `apps/glossario/backend/src/index.ts` | 85 |
| DELETE | `/api/categories/:id` | ✅ high | `apps/glossario/backend/src/routes/categoryRoutes.ts` | 12 |
| PUT | `/api/categories/:id` | ✅ high | `apps/glossario/backend/src/routes/categoryRoutes.ts` | 11 |
| GET | `/api/changelog` | ✅ high | `apps/glossario/backend/src/routes/changelogRoutes.ts` | 6 |
| USE | `/api/changelog` | ✅ high | `apps/glossario/backend/src/index.ts` | 88 |
| USE | `/api/export` | ✅ high | `apps/glossario/backend/src/index.ts` | 90 |
| GET | `/api/export/matecat` | ✅ high | `apps/glossario/backend/src/routes/exportRoutes.ts` | 9 |
| POST | `/api/feedback` | ✅ high | `apps/glossario/backend/src/routes/feedbackRoutes.ts` | 18 |
| USE | `/api/feedback` | ✅ high | `apps/glossario/backend/src/index.ts` | 93 |
| USE | `/api/migration` | ✅ high | `apps/glossario/backend/src/index.ts` | 81 |
| POST | `/api/migration/claim` | ✅ high | `apps/glossario/backend/src/routes/migrationRoutes.ts` | 25 |
| POST | `/api/migration/verify` | ✅ high | `apps/glossario/backend/src/routes/migrationRoutes.ts` | 22 |
| GET | `/api/notifications` | ✅ high | `apps/glossario/backend/src/routes/notificationRoutes.ts` | 12 |
| USE | `/api/notifications` | ✅ high | `apps/glossario/backend/src/index.ts` | 91 |
| PATCH | `/api/notifications/:id/read` | ✅ high | `apps/glossario/backend/src/routes/notificationRoutes.ts` | 14 |
| PATCH | `/api/notifications/read-all` | ✅ high | `apps/glossario/backend/src/routes/notificationRoutes.ts` | 13 |
| GET | `/api/scenarios` | ✅ high | `apps/glossario/backend/src/routes/scenarioRoutes.ts` | 9 |
| POST | `/api/scenarios` | ✅ high | `apps/glossario/backend/src/routes/scenarioRoutes.ts` | 10 |
| USE | `/api/scenarios` | ✅ high | `apps/glossario/backend/src/index.ts` | 87 |
| DELETE | `/api/scenarios/:id` | ✅ high | `apps/glossario/backend/src/routes/scenarioRoutes.ts` | 12 |
| PUT | `/api/scenarios/:id` | ✅ high | `apps/glossario/backend/src/routes/scenarioRoutes.ts` | 11 |
| USE | `/api/social` | ✅ high | `apps/glossario/backend/src/index.ts` | 89 |
| GET | `/api/social/:id/comments` | ✅ high | `apps/glossario/backend/src/routes/socialRoutes.ts` | 14 |
| POST | `/api/social/:id/comments` | ✅ high | `apps/glossario/backend/src/routes/socialRoutes.ts` | 15 |
| POST | `/api/social/:id/vote` | ✅ high | `apps/glossario/backend/src/routes/socialRoutes.ts` | 11 |
| DELETE | `/api/social/comments/:id` | ✅ high | `apps/glossario/backend/src/routes/socialRoutes.ts` | 16 |
| GET | `/api/systems` | ✅ high | `apps/glossario/backend/src/routes/systemRoutes.ts` | 10 |
| POST | `/api/systems` | ✅ high | `apps/glossario/backend/src/routes/systemRoutes.ts` | 11 |
| USE | `/api/systems` | ✅ high | `apps/glossario/backend/src/index.ts` | 86 |
| DELETE | `/api/systems/:id` | ✅ high | `apps/glossario/backend/src/routes/systemRoutes.ts` | 13 |
| PUT | `/api/systems/:id` | ✅ high | `apps/glossario/backend/src/routes/systemRoutes.ts` | 12 |
| GET | `/api/systems/:systemId/editions` | ✅ high | `apps/glossario/backend/src/routes/systemRoutes.ts` | 16 |
| POST | `/api/systems/:systemId/editions` | ✅ high | `apps/glossario/backend/src/routes/systemRoutes.ts` | 17 |
| DELETE | `/api/systems/editions/:id` | ✅ high | `apps/glossario/backend/src/routes/systemRoutes.ts` | 19 |
| PUT | `/api/systems/editions/:id` | ✅ high | `apps/glossario/backend/src/routes/systemRoutes.ts` | 18 |
| GET | `/api/systems/health` | ✅ high | `apps/glossario/backend/src/routes/systemRoutes.ts` | 9 |
| GET | `/api/terms` | ✅ high | `apps/glossario/backend/src/routes/termRoutes.ts` | 10 |
| POST | `/api/terms` | ✅ high | `apps/glossario/backend/src/routes/termRoutes.ts` | 14 |
| USE | `/api/terms` | ✅ high | `apps/glossario/backend/src/index.ts` | 83 |
| DELETE | `/api/terms/:id` | ✅ high | `apps/glossario/backend/src/routes/termRoutes.ts` | 19 |
| PATCH | `/api/terms/:id` | ✅ high | `apps/glossario/backend/src/routes/termRoutes.ts` | 18 |
| PATCH | `/api/terms/:id/approve` | ✅ high | `apps/glossario/backend/src/routes/termRoutes.ts` | 17 |
| GET | `/api/terms/:id/history` | ✅ high | `apps/glossario/backend/src/routes/termRoutes.ts` | 11 |
| POST | `/api/terms/import` | ✅ high | `apps/glossario/backend/src/routes/importRoutes.ts` | 15 |
| USE | `/api/terms/import` | ✅ high | `apps/glossario/backend/src/index.ts` | 82 |
| USE | `/api/users` | ✅ high | `apps/glossario/backend/src/index.ts` | 84 |
| GET | `/api/users/admin` | ✅ high | `apps/glossario/backend/src/routes/userRoutes.ts` | 13 |
| POST | `/api/users/admin/:id/ban` | ✅ high | `apps/glossario/backend/src/routes/userRoutes.ts` | 14 |
| PATCH | `/api/users/profile` | ✅ high | `apps/glossario/backend/src/routes/userRoutes.ts` | 10 |
| GET | `/health` | ✅ high | `apps/glossario/backend/src/index.ts` | 75 |

## links

| Método | Path | Confiança | Arquivo | Linha |
|--------|------|-----------|---------|------|
| USE | `/api/admin/v1` | ✅ high | `apps/links/server/server.ts` | 455 |
| GET | `/api/admin/v1/groups` | ✅ high | `apps/links/server/server.ts` | 227 |
| DELETE | `/api/admin/v1/groups/:id` | ✅ high | `apps/links/server/server.ts` | 320 |
| PATCH | `/api/admin/v1/groups/:id` | ✅ high | `apps/links/server/server.ts` | 259 |
| POST | `/api/admin/v1/groups/:id/accept` | ✅ high | `apps/links/server/server.ts` | 239 |
| POST | `/api/admin/v1/groups/:id/archive` | ✅ high | `apps/links/server/server.ts` | 306 |
| POST | `/api/admin/v1/groups/rehydrate-logos` | ✅ high | `apps/links/server/server.ts` | 446 |
| GET | `/api/admin/v1/groups/rehydrate-logos/status` | ✅ high | `apps/links/server/server.ts` | 451 |
| POST | `/api/admin/v1/rebuild` | ✅ high | `apps/links/server/server.ts` | 434 |
| GET | `/api/admin/v1/rebuild/status` | ✅ high | `apps/links/server/server.ts` | 440 |
| GET | `/api/admin/v1/reports` | ✅ high | `apps/links/server/server.ts` | 398 |
| PATCH | `/api/admin/v1/reports/:id` | ✅ high | `apps/links/server/server.ts` | 413 |
| GET | `/api/admin/v1/tags` | ✅ high | `apps/links/server/server.ts` | 336 |
| POST | `/api/admin/v1/tags` | ✅ high | `apps/links/server/server.ts` | 345 |
| DELETE | `/api/admin/v1/tags/:id` | ✅ high | `apps/links/server/server.ts` | 383 |
| PATCH | `/api/admin/v1/tags/:id` | ✅ high | `apps/links/server/server.ts` | 365 |
| GET | `/api/groups` | ✅ high | `apps/links/server/server.ts` | 71 |
| GET | `/api/groups/:slug` | ✅ high | `apps/links/server/server.ts` | 90 |
| POST | `/api/groups/:slug/report` | ✅ high | `apps/links/server/server.ts` | 173 |
| POST | `/api/groups/suggest` | ✅ high | `apps/links/server/server.ts` | 148 |
| GET | `/api/tags` | ✅ high | `apps/links/server/server.ts` | 105 |
| GET | `/grupo/:slug` | ✅ high | `apps/links/server/server.ts` | 461 |
| GET | `/healthz` | ✅ high | `apps/links/server/server.ts` | 60 |

## mesas

| Método | Path | Confiança | Arquivo | Linha |
|--------|------|-----------|---------|------|
| USE | `/api/v1` | ✅ high | `apps/mesas/backend/src/server.ts` | 141 |
| USE | `/api/v1/admin` | ✅ high | `apps/mesas/backend/src/server.ts` | 118 |
| USE | `/api/v1/admin` | ✅ high | `apps/mesas/backend/src/server.ts` | 126 |
| USE | `/api/v1/admin` | ✅ high | `apps/mesas/backend/src/server.ts` | 127 |
| USE | `/api/v1/admin` | ✅ high | `apps/mesas/backend/src/server.ts` | 130 |
| USE | `/api/v1/admin` | ✅ high | `apps/mesas/backend/src/server.ts` | 131 |
| USE | `/api/v1/admin` | ✅ high | `apps/mesas/backend/src/server.ts` | 132 |
| USE | `/api/v1/admin` | ✅ high | `apps/mesas/backend/src/server.ts` | 133 |
| GET | `/api/v1/admin/activity` | ✅ high | `apps/mesas/backend/src/routes/activityLog.ts` | 67 |
| GET | `/api/v1/admin/dev-feedback` | ✅ high | `apps/mesas/backend/src/routes/devFeedbackAdmin.ts` | 67 |
| DELETE | `/api/v1/admin/dev-feedback/:id` | ✅ high | `apps/mesas/backend/src/routes/devFeedbackAdmin.ts` | 180 |
| PATCH | `/api/v1/admin/dev-feedback/:id` | ✅ high | `apps/mesas/backend/src/routes/devFeedbackAdmin.ts` | 107 |
| POST | `/api/v1/admin/dev-feedback/merge` | ✅ high | `apps/mesas/backend/src/routes/devFeedbackAdmin.ts` | 228 |
| USE | `/api/v1/admin/discord` | ✅ high | `apps/mesas/backend/src/server.ts` | 128 |
| USE | `/api/v1/admin/discord` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 24 |
| USE | `/api/v1/admin/discord` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 34 |
| USE | `/api/v1/admin/discord/automation` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 38 |
| POST | `/api/v1/admin/discord/automation/auto-approval/guard` | ✅ high | `apps/mesas/backend/src/routes/discord/automation.ts` | 23 |
| GET | `/api/v1/admin/discord/automation/config` | ✅ high | `apps/mesas/backend/src/routes/discord/automation.ts` | 12 |
| GET | `/api/v1/admin/discord/automation/eval` | ✅ high | `apps/mesas/backend/src/routes/discord/automation.ts` | 44 |
| GET | `/api/v1/admin/discord/automation/llm-activity` | ✅ high | `apps/mesas/backend/src/routes/discord/automation.ts` | 106 |
| GET | `/api/v1/admin/discord/automation/parse-eval` | ✅ high | `apps/mesas/backend/src/routes/discord/automation.ts` | 86 |
| USE | `/api/v1/admin/discord/chat-exporter` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 39 |
| GET | `/api/v1/admin/discord/chat-exporter/config` | ✅ high | `apps/mesas/backend/src/routes/discord/chatExporterAutomation.ts` | 361 |
| PUT | `/api/v1/admin/discord/chat-exporter/config` | ✅ high | `apps/mesas/backend/src/routes/discord/chatExporterAutomation.ts` | 369 |
| GET | `/api/v1/admin/discord/chat-exporter/profiles` | ✅ high | `apps/mesas/backend/src/routes/discord/chatExporterAutomation.ts` | 389 |
| POST | `/api/v1/admin/discord/chat-exporter/profiles` | ✅ high | `apps/mesas/backend/src/routes/discord/chatExporterAutomation.ts` | 402 |
| DELETE | `/api/v1/admin/discord/chat-exporter/profiles/:id` | ✅ high | `apps/mesas/backend/src/routes/discord/chatExporterAutomation.ts` | 470 |
| PATCH | `/api/v1/admin/discord/chat-exporter/profiles/:id` | ✅ high | `apps/mesas/backend/src/routes/discord/chatExporterAutomation.ts` | 434 |
| GET | `/api/v1/admin/discord/chat-exporter/profiles/:id/delta` | ✅ high | `apps/mesas/backend/src/routes/discord/chatExporterAutomation.ts` | 502 |
| POST | `/api/v1/admin/discord/chat-exporter/profiles/:id/run` | ✅ high | `apps/mesas/backend/src/routes/discord/chatExporterAutomation.ts` | 557 |
| POST | `/api/v1/admin/discord/chat-exporter/profiles/:id/test` | ✅ high | `apps/mesas/backend/src/routes/discord/chatExporterAutomation.ts` | 527 |
| POST | `/api/v1/admin/discord/chat-exporter/run` | ✅ high | `apps/mesas/backend/src/routes/discord/chatExporterAutomation.ts` | 614 |
| POST | `/api/v1/admin/discord/chat-exporter/test` | ✅ high | `apps/mesas/backend/src/routes/discord/chatExporterAutomation.ts` | 588 |
| POST | `/api/v1/admin/discord/chat-exporter/validate-token` | ✅ high | `apps/mesas/backend/src/routes/discord/chatExporterAutomation.ts` | 344 |
| USE | `/api/v1/admin/discord/discovery` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 23 |
| GET | `/api/v1/admin/discord/discovery/guilds` | ✅ high | `apps/mesas/backend/src/routes/discord/discovery.ts` | 18 |
| GET | `/api/v1/admin/discord/discovery/guilds/:guildId/channels` | ✅ high | `apps/mesas/backend/src/routes/discord/discovery.ts` | 28 |
| GET | `/api/v1/admin/discord/drafts` | ✅ high | `apps/mesas/backend/src/routes/discord/drafts.ts` | 47 |
| USE | `/api/v1/admin/discord/drafts` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 27 |
| USE | `/api/v1/admin/discord/drafts` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 28 |
| USE | `/api/v1/admin/discord/drafts` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 29 |
| GET | `/api/v1/admin/discord/drafts/:id` | ✅ high | `apps/mesas/backend/src/routes/discord/drafts.ts` | 84 |
| PATCH | `/api/v1/admin/discord/drafts/:id` | ✅ high | `apps/mesas/backend/src/routes/discord/drafts.ts` | 334 |
| POST | `/api/v1/admin/discord/drafts/:id/audit-completeness` | ✅ high | `apps/mesas/backend/src/routes/discord/drafts.ts` | 176 |
| POST | `/api/v1/admin/discord/drafts/:id/audit-field/:field` | ✅ high | `apps/mesas/backend/src/routes/discord/drafts.ts` | 192 |
| GET | `/api/v1/admin/discord/drafts/:id/duplicates` | ✅ high | `apps/mesas/backend/src/routes/discord/duplicates.ts` | 84 |
| POST | `/api/v1/admin/discord/drafts/:id/refresh-image` | ✅ high | `apps/mesas/backend/src/routes/discord/drafts.ts` | 356 |
| POST | `/api/v1/admin/discord/drafts/:id/reparse` | ✅ high | `apps/mesas/backend/src/routes/discord/drafts.ts` | 372 |
| POST | `/api/v1/admin/discord/drafts/:id/sync` | ✅ high | `apps/mesas/backend/src/routes/discord/sync.ts` | 9 |
| PATCH | `/api/v1/admin/discord/drafts/batch` | ✅ high | `apps/mesas/backend/src/routes/discord/drafts.ts` | 207 |
| DELETE | `/api/v1/admin/discord/drafts/rejected` | ✅ high | `apps/mesas/backend/src/routes/discord/drafts.ts` | 270 |
| USE | `/api/v1/admin/discord/duplicate-candidates` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 30 |
| PATCH | `/api/v1/admin/discord/duplicate-candidates/:id` | ✅ high | `apps/mesas/backend/src/routes/discord/duplicates.ts` | 120 |
| POST | `/api/v1/admin/discord/fetch` | ✅ high | `apps/mesas/backend/src/routes/discord/fetch.ts` | 159 |
| POST | `/api/v1/admin/discord/import-json` | ✅ high | `apps/mesas/backend/src/routes/discord/import.ts` | 150 |
| USE | `/api/v1/admin/discord/import-json` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 35 |
| USE | `/api/v1/admin/discord/import-json` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 36 |
| POST | `/api/v1/admin/discord/import-json/file` | ✅ high | `apps/mesas/backend/src/routes/discord/import.ts` | 171 |
| POST | `/api/v1/admin/discord/import-json/preview` | ✅ high | `apps/mesas/backend/src/routes/discord/preview.ts` | 58 |
| POST | `/api/v1/admin/discord/import-json/preview/file` | ✅ high | `apps/mesas/backend/src/routes/discord/preview.ts` | 75 |
| POST | `/api/v1/admin/discord/import-json/reparse` | ✅ high | `apps/mesas/backend/src/routes/discord/import.ts` | 202 |
| GET | `/api/v1/admin/discord/messages` | ✅ high | `apps/mesas/backend/src/routes/discord/messages.ts` | 63 |
| USE | `/api/v1/admin/discord/messages` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 31 |
| USE | `/api/v1/admin/discord/messages` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 32 |
| USE | `/api/v1/admin/discord/messages` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 33 |
| PATCH | `/api/v1/admin/discord/messages/:id` | ✅ high | `apps/mesas/backend/src/routes/discord/messages.ts` | 122 |
| POST | `/api/v1/admin/discord/messages/:id/diagnose-content` | ✅ high | `apps/mesas/backend/src/routes/discord/messages.ts` | 144 |
| POST | `/api/v1/admin/discord/messages/:id/parse` | ✅ high | `apps/mesas/backend/src/routes/discord/messageParse.ts` | 8 |
| PATCH | `/api/v1/admin/discord/messages/batch` | ✅ high | `apps/mesas/backend/src/routes/discord/messages.ts` | 101 |
| POST | `/api/v1/admin/discord/messages/parse-batch` | ✅ high | `apps/mesas/backend/src/routes/discord/parse-batch.ts` | 10 |
| GET | `/api/v1/admin/discord/metrics` | ✅ high | `apps/mesas/backend/src/routes/discord/metrics.ts` | 10 |
| USE | `/api/v1/admin/discord/metrics` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 37 |
| GET | `/api/v1/admin/discord/metrics/shadow` | ✅ high | `apps/mesas/backend/src/routes/discord/metrics.ts` | 85 |
| GET | `/api/v1/admin/discord/settings` | ✅ high | `apps/mesas/backend/src/routes/discord/settings.ts` | 27 |
| USE | `/api/v1/admin/discord/settings` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 26 |
| DELETE | `/api/v1/admin/discord/settings/bot-token` | ✅ high | `apps/mesas/backend/src/routes/discord/settings.ts` | 119 |
| PUT | `/api/v1/admin/discord/settings/bot-token` | ✅ high | `apps/mesas/backend/src/routes/discord/settings.ts` | 72 |
| GET | `/api/v1/admin/discord/sources` | ✅ high | `apps/mesas/backend/src/routes/discord/sources.ts` | 24 |
| POST | `/api/v1/admin/discord/sources` | ✅ high | `apps/mesas/backend/src/routes/discord/sources.ts` | 39 |
| USE | `/api/v1/admin/discord/sources` | ✅ high | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 25 |
| DELETE | `/api/v1/admin/discord/sources/:id` | ✅ high | `apps/mesas/backend/src/routes/discord/sources.ts` | 94 |
| PATCH | `/api/v1/admin/discord/sources/:id` | ✅ high | `apps/mesas/backend/src/routes/discord/sources.ts` | 69 |
| POST | `/api/v1/admin/discord/sources/:sourceId/reingest-force` | ✅ high | `apps/mesas/backend/src/routes/discord/fetch.ts` | 201 |
| POST | `/api/v1/admin/discord/sync-ready` | ✅ high | `apps/mesas/backend/src/routes/discord/sync.ts` | 39 |
| USE | `/api/v1/admin/import` | ✅ high | `apps/mesas/backend/src/server.ts` | 129 |
| GET | `/api/v1/admin/import/drafts` | ✅ high | `apps/mesas/backend/src/routes/inbox/drafts.ts` | 19 |
| USE | `/api/v1/admin/import/drafts` | ✅ high | `apps/mesas/backend/src/routes/adminImportInbox.ts` | 14 |
| USE | `/api/v1/admin/import/drafts` | ✅ high | `apps/mesas/backend/src/routes/adminImportInbox.ts` | 15 |
| GET | `/api/v1/admin/import/drafts/:id` | ✅ high | `apps/mesas/backend/src/routes/inbox/drafts.ts` | 104 |
| PATCH | `/api/v1/admin/import/drafts/:id` | ✅ high | `apps/mesas/backend/src/routes/inbox/drafts.ts` | 164 |
| POST | `/api/v1/admin/import/drafts/:id/reparse` | ✅ high | `apps/mesas/backend/src/routes/inbox/drafts.ts` | 201 |
| POST | `/api/v1/admin/import/drafts/:id/sync` | ✅ high | `apps/mesas/backend/src/routes/inbox/drafts.ts` | 75 |
| POST | `/api/v1/admin/import/import-text` | ✅ high | `apps/mesas/backend/src/routes/inbox/import.ts` | 60 |
| USE | `/api/v1/admin/import/import-text` | ✅ high | `apps/mesas/backend/src/routes/adminImportInbox.ts` | 13 |
| GET | `/api/v1/admin/scenario-suggestions` | ✅ high | `apps/mesas/backend/src/routes/scenarioSuggestionsAdmin.ts` | 13 |
| PATCH | `/api/v1/admin/scenario-suggestions/:id/approve` | ✅ high | `apps/mesas/backend/src/routes/scenarioSuggestionsAdmin.ts` | 17 |
| PATCH | `/api/v1/admin/scenario-suggestions/:id/reject` | ✅ high | `apps/mesas/backend/src/routes/scenarioSuggestionsAdmin.ts` | 154 |
| GET | `/api/v1/admin/setting-suggestions` | ✅ high | `apps/mesas/backend/src/routes/adminSettingSuggestions.ts` | 23 |
| POST | `/api/v1/admin/setting-suggestions` | ✅ high | `apps/mesas/backend/src/routes/adminSettingSuggestions.ts` | 42 |
| USE | `/api/v1/admin/setting-suggestions` | ✅ high | `apps/mesas/backend/src/server.ts` | 137 |
| DELETE | `/api/v1/admin/setting-suggestions/:id` | ✅ high | `apps/mesas/backend/src/routes/adminSettingSuggestions.ts` | 161 |
| PUT | `/api/v1/admin/setting-suggestions/:id` | ✅ high | `apps/mesas/backend/src/routes/adminSettingSuggestions.ts` | 98 |
| POST | `/api/v1/admin/sync/enrich` | ✅ high | `apps/mesas/backend/src/routes/adminEnrichment.ts` | 19 |
| GET | `/api/v1/admin/system-suggestions` | ✅ high | `apps/mesas/backend/src/routes/systemSuggestionsAdmin.ts` | 304 |
| PATCH | `/api/v1/admin/system-suggestions/:id/approve` | ✅ high | `apps/mesas/backend/src/routes/systemSuggestionsAdmin.ts` | 428 |
| GET | `/api/v1/admin/system-suggestions/:id/candidates` | ✅ high | `apps/mesas/backend/src/routes/systemSuggestionsAdmin.ts` | 308 |
| PATCH | `/api/v1/admin/system-suggestions/:id/reject` | ✅ high | `apps/mesas/backend/src/routes/systemSuggestionsAdmin.ts` | 468 |
| POST | `/api/v1/admin/system-suggestions/:id/resolve` | ✅ high | `apps/mesas/backend/src/routes/systemSuggestionsAdmin.ts` | 1081 |
| GET | `/api/v1/admin/tables` | ✅ high | `apps/mesas/backend/src/routes/adminTables.ts` | 175 |
| DELETE | `/api/v1/admin/tables/:id` | ✅ high | `apps/mesas/backend/src/routes/adminTables.ts` | 227 |
| GET | `/api/v1/admin/tables/:id` | ✅ high | `apps/mesas/backend/src/routes/adminTables.ts` | 202 |
| PUT | `/api/v1/admin/tables/:id` | ✅ high | `apps/mesas/backend/src/routes/adminTables.ts` | 116 |
| POST | `/api/v1/admin/tables/auto-archive` | ✅ high | `apps/mesas/backend/src/routes/adminTables.ts` | 17 |
| POST | `/api/v1/admin/tables/batch` | ✅ high | `apps/mesas/backend/src/routes/adminTables.ts` | 56 |
| GET | `/api/v1/admin/users` | ✅ high | `apps/mesas/backend/src/routes/adminProfile.ts` | 76 |
| GET | `/api/v1/admin/users/:id` | ✅ high | `apps/mesas/backend/src/routes/adminProfile.ts` | 161 |
| PATCH | `/api/v1/admin/users/:id/covil` | ✅ high | `apps/mesas/backend/src/routes/adminProfile.ts` | 32 |
| USE | `/api/v1/auth` | ✅ high | `apps/mesas/backend/src/server.ts` | 112 |
| GET | `/api/v1/auth/google` | ✅ high | `apps/mesas/backend/src/routes/auth.ts` | 21 |
| GET | `/api/v1/auth/google/callback` | ✅ high | `apps/mesas/backend/src/routes/auth.ts` | 27 |
| POST | `/api/v1/auth/logout` | ✅ high | `apps/mesas/backend/src/routes/auth.ts` | 31 |
| GET | `/api/v1/changelog` | ✅ high | `apps/mesas/backend/src/routes/changelog.ts` | 12 |
| USE | `/api/v1/changelog` | ✅ high | `apps/mesas/backend/src/server.ts` | 140 |
| GET | `/api/v1/communication-platforms` | ✅ high | `apps/mesas/backend/src/routes/communicationPlatforms.ts` | 22 |
| USE | `/api/v1/communication-platforms` | ✅ high | `apps/mesas/backend/src/server.ts` | 139 |
| GET | `/api/v1/communication-platforms/admin` | ✅ high | `apps/mesas/backend/src/routes/communicationPlatforms.ts` | 40 |
| POST | `/api/v1/communication-platforms/admin` | ✅ high | `apps/mesas/backend/src/routes/communicationPlatforms.ts` | 57 |
| DELETE | `/api/v1/communication-platforms/admin/:id` | ✅ high | `apps/mesas/backend/src/routes/communicationPlatforms.ts` | 175 |
| PUT | `/api/v1/communication-platforms/admin/:id` | ✅ high | `apps/mesas/backend/src/routes/communicationPlatforms.ts` | 105 |
| POST | `/api/v1/dev-feedback` | ✅ high | `apps/mesas/backend/src/routes/devFeedback.ts` | 21 |
| USE | `/api/v1/dev-feedback` | ✅ high | `apps/mesas/backend/src/server.ts` | 124 |
| USE | `/api/v1/gm` | ✅ high | `apps/mesas/backend/src/server.ts` | 134 |
| USE | `/api/v1/gm` | ✅ high | `apps/mesas/backend/src/server.ts` | 135 |
| GET | `/api/v1/gm/:slug` | ✅ high | `apps/mesas/backend/src/routes/gm.ts` | 98 |
| POST | `/api/v1/gm/:slug/contact` | ✅ high | `apps/mesas/backend/src/routes/gm.ts` | 471 |
| POST | `/api/v1/gm/:slug/contact-click` | ✅ high | `apps/mesas/backend/src/routes/gm.ts` | 536 |
| GET | `/api/v1/gm/:slug/insights` | ✅ high | `apps/mesas/backend/src/routes/gm.ts` | 418 |
| POST | `/api/v1/gm/:slug/view` | ✅ high | `apps/mesas/backend/src/routes/gm.ts` | 350 |
| GET | `/api/v1/gm/insights` | ✅ high | `apps/mesas/backend/src/routes/gmPanel.ts` | 1388 |
| GET | `/api/v1/gm/me` | ✅ high | `apps/mesas/backend/src/routes/gmPanel.ts` | 451 |
| POST | `/api/v1/gm/profile` | ✅ high | `apps/mesas/backend/src/routes/gmPanel.ts` | 140 |
| PUT | `/api/v1/gm/profile` | ✅ high | `apps/mesas/backend/src/routes/gmPanel.ts` | 259 |
| GET | `/api/v1/gm/tables` | ✅ high | `apps/mesas/backend/src/routes/gmPanel.ts` | 847 |
| POST | `/api/v1/gm/tables` | ✅ high | `apps/mesas/backend/src/routes/gmPanel.ts` | 534 |
| DELETE | `/api/v1/gm/tables/:id` | ✅ high | `apps/mesas/backend/src/routes/gmPanel.ts` | 1180 |
| GET | `/api/v1/gm/tables/:id` | ✅ high | `apps/mesas/backend/src/routes/gmPanel.ts` | 491 |
| PUT | `/api/v1/gm/tables/:id` | ✅ high | `apps/mesas/backend/src/routes/gmPanel.ts` | 648 |
| PATCH | `/api/v1/gm/tables/:id/archive` | ✅ high | `apps/mesas/backend/src/routes/gmPanel.ts` | 1121 |
| POST | `/api/v1/gm/tables/:id/click` | ✅ high | `apps/mesas/backend/src/routes/gmPanel.ts` | 1279 |
| POST | `/api/v1/gm/tables/:id/contact` | ✅ high | `apps/mesas/backend/src/routes/gmPanel.ts` | 1315 |
| POST | `/api/v1/gm/tables/:id/favorite` | ✅ high | `apps/mesas/backend/src/routes/gmPanel.ts` | 1351 |
| PATCH | `/api/v1/gm/tables/:id/status` | ✅ high | `apps/mesas/backend/src/routes/gmPanel.ts` | 994 |
| POST | `/api/v1/gm/tables/:slug/view` | ✅ high | `apps/mesas/backend/src/routes/gmPanel.ts` | 1237 |
| GET | `/api/v1/health` | ✅ high | `apps/mesas/backend/src/server.ts` | 93 |
| GET | `/api/v1/me` | ✅ high | `apps/mesas/backend/src/routes/me.ts` | 69 |
| USE | `/api/v1/me` | ✅ high | `apps/mesas/backend/src/server.ts` | 115 |
| GET | `/api/v1/me/options` | ✅ high | `apps/mesas/backend/src/routes/me.ts` | 122 |
| PUT | `/api/v1/me/preferences` | ✅ high | `apps/mesas/backend/src/routes/me.ts` | 179 |
| GET | `/api/v1/notifications` | ✅ high | `apps/mesas/backend/src/routes/notifications.ts` | 10 |
| USE | `/api/v1/notifications` | ✅ high | `apps/mesas/backend/src/server.ts` | 125 |
| PATCH | `/api/v1/notifications/:id/read` | ✅ high | `apps/mesas/backend/src/routes/notifications.ts` | 55 |
| PATCH | `/api/v1/notifications/read-all` | ✅ high | `apps/mesas/backend/src/routes/notifications.ts` | 33 |
| USE | `/api/v1/profile` | ✅ high | `apps/mesas/backend/src/server.ts` | 116 |
| USE | `/api/v1/profile` | ✅ high | `apps/mesas/backend/src/server.ts` | 117 |
| PATCH | `/api/v1/profile/gm` | ✅ high | `apps/mesas/backend/src/routes/profile.ts` | 189 |
| GET | `/api/v1/profile/links` | ✅ high | `apps/mesas/backend/src/routes/links.ts` | 11 |
| POST | `/api/v1/profile/links` | ✅ high | `apps/mesas/backend/src/routes/links.ts` | 33 |
| DELETE | `/api/v1/profile/links/:id` | ✅ high | `apps/mesas/backend/src/routes/links.ts` | 81 |
| PATCH | `/api/v1/profile/links/reorder` | ✅ high | `apps/mesas/backend/src/routes/links.ts` | 115 |
| GET | `/api/v1/profile/me` | ✅ high | `apps/mesas/backend/src/routes/profile.ts` | 17 |
| PATCH | `/api/v1/profile/me` | ✅ high | `apps/mesas/backend/src/routes/profile.ts` | 37 |
| DELETE | `/api/v1/profile/me/connect/discord` | ✅ high | `apps/mesas/backend/src/routes/profile.ts` | 287 |
| POST | `/api/v1/profile/me/connect/discord` | ✅ high | `apps/mesas/backend/src/routes/profile.ts` | 261 |
| GET | `/api/v1/profile/me/discord` | ✅ high | `apps/mesas/backend/src/routes/profile.ts` | 241 |
| PATCH | `/api/v1/profile/me/gm` | ✅ high | `apps/mesas/backend/src/routes/profile.ts` | 187 |
| POST | `/api/v1/profile/me/google-picture` | ✅ high | `apps/mesas/backend/src/routes/profile.ts` | 307 |
| PATCH | `/api/v1/profile/me/player` | ✅ high | `apps/mesas/backend/src/routes/profile.ts` | 134 |
| PATCH | `/api/v1/profile/me/profile` | ✅ high | `apps/mesas/backend/src/routes/profile.ts` | 79 |
| PATCH | `/api/v1/profile/player` | ✅ high | `apps/mesas/backend/src/routes/profile.ts` | 136 |
| POST | `/api/v1/profile/systems` | ✅ high | `apps/mesas/backend/src/routes/profile.ts` | 192 |
| DELETE | `/api/v1/profile/systems/:id` | ✅ high | `apps/mesas/backend/src/routes/profile.ts` | 219 |
| POST | `/api/v1/scenario-suggestions` | ✅ high | `apps/mesas/backend/src/routes/scenarioSuggestions.ts` | 15 |
| USE | `/api/v1/scenario-suggestions` | ✅ high | `apps/mesas/backend/src/server.ts` | 123 |
| GET | `/api/v1/scenario-suggestions/mine` | ✅ high | `apps/mesas/backend/src/routes/scenarioSuggestions.ts` | 95 |
| GET | `/api/v1/scenarios` | ✅ high | `apps/mesas/backend/src/routes/scenarios.ts` | 31 |
| USE | `/api/v1/scenarios` | ✅ high | `apps/mesas/backend/src/server.ts` | 121 |
| GET | `/api/v1/scenarios/:id` | ✅ high | `apps/mesas/backend/src/routes/scenarios.ts` | 106 |
| POST | `/api/v1/scenarios/admin` | ✅ high | `apps/mesas/backend/src/routes/scenarios.ts` | 132 |
| DELETE | `/api/v1/scenarios/admin/:id` | ✅ high | `apps/mesas/backend/src/routes/scenarios.ts` | 234 |
| PUT | `/api/v1/scenarios/admin/:id` | ✅ high | `apps/mesas/backend/src/routes/scenarios.ts` | 176 |
| USE | `/api/v1/settings` | ✅ high | `apps/mesas/backend/src/server.ts` | 136 |
| GET | `/api/v1/settings/suggest-styles` | ✅ high | `apps/mesas/backend/src/routes/settings.ts` | 11 |
| POST | `/api/v1/system-suggestions` | ✅ high | `apps/mesas/backend/src/routes/systemSuggestions.ts` | 61 |
| USE | `/api/v1/system-suggestions` | ✅ high | `apps/mesas/backend/src/server.ts` | 122 |
| GET | `/api/v1/system-suggestions/mine` | ✅ high | `apps/mesas/backend/src/routes/systemSuggestions.ts` | 174 |
| GET | `/api/v1/systems` | ✅ high | `apps/mesas/backend/src/routes/systems.ts` | 38 |
| USE | `/api/v1/systems` | ✅ high | `apps/mesas/backend/src/server.ts` | 120 |
| POST | `/api/v1/systems/admin` | ✅ high | `apps/mesas/backend/src/routes/systems.ts` | 83 |
| DELETE | `/api/v1/systems/admin/:id` | ✅ high | `apps/mesas/backend/src/routes/systems.ts` | 139 |
| PUT | `/api/v1/systems/admin/:id` | ✅ high | `apps/mesas/backend/src/routes/systems.ts` | 109 |
| GET | `/api/v1/systems/health` | ✅ high | `apps/mesas/backend/src/routes/systems.ts` | 28 |
| GET | `/api/v1/tables` | ✅ high | `apps/mesas/backend/src/routes/tables.ts` | 35 |
| USE | `/api/v1/tables` | ✅ high | `apps/mesas/backend/src/server.ts` | 119 |
| GET | `/api/v1/tables/:slug` | ✅ high | `apps/mesas/backend/src/routes/tables.ts` | 330 |
| POST | `/api/v1/tables/:slug/click` | ✅ high | `apps/mesas/backend/src/routes/tables.ts` | 566 |
| POST | `/api/v1/tables/:slug/view` | ✅ high | `apps/mesas/backend/src/routes/tables.ts` | 527 |
| GET | `/api/v1/tables/style-facets` | ✅ high | `apps/mesas/backend/src/routes/tables.ts` | 307 |
| POST | `/api/v1/upload` | ✅ high | `apps/mesas/backend/src/routes/upload.ts` | 25 |
| POST | `/api/v1/upload/url` | ✅ high | `apps/mesas/backend/src/routes/upload.ts` | 59 |
| GET | `/api/v1/vtt-platforms` | ✅ high | `apps/mesas/backend/src/routes/vttPlatforms.ts` | 43 |
| USE | `/api/v1/vtt-platforms` | ✅ high | `apps/mesas/backend/src/server.ts` | 138 |
| GET | `/api/v1/vtt-platforms/admin` | ✅ high | `apps/mesas/backend/src/routes/vttPlatforms.ts` | 172 |
| POST | `/api/v1/vtt-platforms/admin` | ✅ high | `apps/mesas/backend/src/routes/vttPlatforms.ts` | 202 |
| DELETE | `/api/v1/vtt-platforms/admin/:id` | ✅ high | `apps/mesas/backend/src/routes/vttPlatforms.ts` | 359 |
| PUT | `/api/v1/vtt-platforms/admin/:id` | ✅ high | `apps/mesas/backend/src/routes/vttPlatforms.ts` | 265 |
| POST | `/api/v1/vtt-platforms/suggest` | ✅ high | `apps/mesas/backend/src/routes/vttPlatforms.ts` | 72 |
| USE | `/auth` | ✅ high | `apps/mesas/backend/src/server.ts` | 113 |
| USE | `/auth` | ✅ high | `apps/mesas/backend/src/server.ts` | 114 |
| GET | `/auth/discord/callback` | ✅ high | `apps/mesas/backend/src/routes/discord.ts` | 63 |
| GET | `/auth/discord/connect` | ✅ high | `apps/mesas/backend/src/routes/discord.ts` | 30 |
| DELETE | `/auth/discord/disconnect` | ✅ high | `apps/mesas/backend/src/routes/discord.ts` | 164 |
| POST | `/auth/discord/verify-covil` | ✅ high | `apps/mesas/backend/src/routes/discord.ts` | 194 |
| GET | `/auth/google` | ✅ high | `apps/mesas/backend/src/routes/auth.ts` | 21 |
| GET | `/auth/google/callback` | ✅ high | `apps/mesas/backend/src/routes/auth.ts` | 27 |
| POST | `/auth/logout` | ✅ high | `apps/mesas/backend/src/routes/auth.ts` | 31 |
| USE | `/og` | ✅ high | `apps/mesas/backend/src/server.ts` | 142 |
| GET | `/og/:type/:slug` | ✅ high | `apps/mesas/backend/src/routes/og.ts` | 159 |
| GET | `/og/{*splat}` | ✅ high | `apps/mesas/backend/src/routes/og.ts` | 293 |

## site

| Método | Path | Confiança | Arquivo | Linha |
|--------|------|-----------|---------|------|
| USE | `/admin` | ✅ high | `apps/site/server/server.ts` | 248 |
| USE | `/admin` | ✅ high | `apps/site/server/server.ts` | 250 |
| POST | `/admin/import` | ✅ high | `apps/site/server/server.ts` | 129 |
| GET | `/admin/preview/:type/:id` | ✅ high | `apps/site/server/server.ts` | 220 |
| POST | `/admin/rebuild` | ✅ high | `apps/site/server/server.ts` | 123 |
| GET | `/admin/status` | ✅ high | `apps/site/server/server.ts` | 108 |
| USE | `/api/admin/v1` | ✅ high | `apps/site/server/server.ts` | 213 |
| USE | `/api/admin/v1/catalog` | ✅ high | `apps/site/server/server.ts` | 211 |
| GET | `/api/admin/v1/catalog/health` | ✅ high | `apps/site/server/catalog-api.ts` | 10 |
| POST | `/api/admin/v1/catalog/nodes` | ✅ high | `apps/site/server/catalog-api.ts` | 79 |
| PUT | `/api/admin/v1/catalog/nodes/:id` | ✅ high | `apps/site/server/catalog-api.ts` | 88 |
| GET | `/api/admin/v1/catalog/nodes/:idOrSlug` | ✅ high | `apps/site/server/catalog-api.ts` | 41 |
| GET | `/api/admin/v1/catalog/resolve` | ✅ high | `apps/site/server/catalog-api.ts` | 45 |
| GET | `/api/admin/v1/catalog/snapshot` | ✅ high | `apps/site/server/catalog-api.ts` | 75 |
| GET | `/api/admin/v1/catalog/systems` | ✅ high | `apps/site/server/catalog-api.ts` | 25 |
| GET | `/api/admin/v1/feedback` | ✅ high | `apps/site/server/admin-api.ts` | 277 |
| DELETE | `/api/admin/v1/feedback/:id` | ✅ high | `apps/site/server/admin-api.ts` | 300 |
| PATCH | `/api/admin/v1/feedback/:id` | ✅ high | `apps/site/server/admin-api.ts` | 286 |
| GET | `/api/admin/v1/media` | ✅ high | `apps/site/server/admin-api.ts` | 209 |
| POST | `/api/admin/v1/media` | ✅ high | `apps/site/server/admin-api.ts` | 219 |
| DELETE | `/api/admin/v1/media/:id` | ✅ high | `apps/site/server/admin-api.ts` | 258 |
| PUT | `/api/admin/v1/media/:id` | ✅ high | `apps/site/server/admin-api.ts` | 248 |
| GET | `/api/admin/v1/pages` | ✅ high | `apps/site/server/admin-api.ts` | 128 |
| POST | `/api/admin/v1/pages` | ✅ high | `apps/site/server/admin-api.ts` | 138 |
| DELETE | `/api/admin/v1/pages/:id` | ✅ high | `apps/site/server/admin-api.ts` | 169 |
| GET | `/api/admin/v1/pages/:id` | ✅ high | `apps/site/server/admin-api.ts` | 131 |
| PUT | `/api/admin/v1/pages/:id` | ✅ high | `apps/site/server/admin-api.ts` | 143 |
| POST | `/api/admin/v1/pages/:id/status` | ✅ high | `apps/site/server/admin-api.ts` | 156 |
| GET | `/api/admin/v1/posts` | ✅ high | `apps/site/server/admin-api.ts` | 60 |
| POST | `/api/admin/v1/posts` | ✅ high | `apps/site/server/admin-api.ts` | 77 |
| DELETE | `/api/admin/v1/posts/:id` | ✅ high | `apps/site/server/admin-api.ts` | 117 |
| GET | `/api/admin/v1/posts/:id` | ✅ high | `apps/site/server/admin-api.ts` | 69 |
| PUT | `/api/admin/v1/posts/:id` | ✅ high | `apps/site/server/admin-api.ts` | 85 |
| POST | `/api/admin/v1/posts/:id/status` | ✅ high | `apps/site/server/admin-api.ts` | 103 |
| POST | `/api/admin/v1/preview` | ✅ high | `apps/site/server/admin-api.ts` | 267 |
| POST | `/api/admin/v1/rebuild` | ✅ high | `apps/site/server/admin-api.ts` | 311 |
| GET | `/api/admin/v1/redirects` | ✅ high | `apps/site/server/admin-api.ts` | 194 |
| POST | `/api/admin/v1/redirects` | ✅ high | `apps/site/server/admin-api.ts` | 195 |
| GET | `/api/admin/v1/slug-check` | ✅ high | `apps/site/server/admin-api.ts` | 46 |
| GET | `/api/admin/v1/taxonomies` | ✅ high | `apps/site/server/admin-api.ts` | 180 |
| POST | `/api/admin/v1/taxonomies` | ✅ high | `apps/site/server/admin-api.ts` | 183 |
| USE | `/api/catalog/v1` | ✅ high | `apps/site/server/server.ts` | 202 |
| GET | `/api/catalog/v1/health` | ✅ high | `apps/site/server/catalog-api.ts` | 10 |
| POST | `/api/catalog/v1/nodes` | ✅ high | `apps/site/server/catalog-api.ts` | 79 |
| PUT | `/api/catalog/v1/nodes/:id` | ✅ high | `apps/site/server/catalog-api.ts` | 88 |
| GET | `/api/catalog/v1/nodes/:idOrSlug` | ✅ high | `apps/site/server/catalog-api.ts` | 41 |
| GET | `/api/catalog/v1/resolve` | ✅ high | `apps/site/server/catalog-api.ts` | 45 |
| GET | `/api/catalog/v1/snapshot` | ✅ high | `apps/site/server/catalog-api.ts` | 75 |
| GET | `/api/catalog/v1/systems` | ✅ high | `apps/site/server/catalog-api.ts` | 25 |
| POST | `/api/feedback` | ✅ high | `apps/site/server/server.ts` | 156 |
| GET | `/healthz` | ✅ high | `apps/site/server/server.ts` | 97 |
| USE | `/uploads` | ✅ high | `apps/site/server/server.ts` | 217 |

