# Relatório de Rotas Órfãs e Duplicadas

**Gerado em:** 1970-01-01T00:00:00.000Z
**Modo:** inicial
**Este relatório NÃO bloqueia o build.**

---

## Sumário

| Categoria | Quantidade | Bloqueia? |
|-----------|:----------:|:---------:|
| 👻 Órfãs suspeitas (ORPHAN_SUSPECT) | 38 | ❌ |
| 🔀 Duplicatas suspeitas (score ≥ 80) | 99 | ❌ |

## Rotas órfãs suspeitas

Rotas existentes no código/OpenAPI, sem consumidor detectado e sem classificação que justifique ausência de uso.

### accounts (5 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| GET | `/` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/auth/google` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/auth/google/callback` | ✅ | public | Scope "public" sem consumidor |
| GET | `/conta` | ✅ | public | Scope "public" sem consumidor |
| GET | `/login` | ✅ | public | Scope "public" sem consumidor |
### glossario (6 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| DELETE | `/api/categories/:id` | ✅ | public | Scope "public" sem consumidor |
| DELETE | `/api/scenarios/:id` | ✅ | public | Scope "public" sem consumidor |
| DELETE | `/api/systems/:id` | ✅ | public | Scope "public" sem consumidor |
| DELETE | `/api/systems/editions/:id` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/auth/login` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/auth/register` | ✅ | public | Scope "public" sem consumidor |
### links (2 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| GET | `/api/groups/:slug` | ✅ | public | Scope "public" sem consumidor |
| GET | `/grupo/:slug` | ✅ | public | Scope "public" sem consumidor |
### mesas (25 rota(s))

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
| GET | `/auth/google` | ✅ | public | Scope "public" sem consumidor |
| GET | `/auth/google/callback` | ✅ | public | Scope "public" sem consumidor |
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
| POST | `/auth/logout` | ✅ | public | Scope "public" sem consumidor |
| PUT | `/api/v1/gm/tables/:id` | ✅ | public | Scope "public" sem consumidor |

### Observações

- Rotas sem OpenAPI (CODE_ONLY) não têm classificação `x-artificio-*` — podem ser admin/cron/legacy legítimas mas ainda não documentadas.
- Rotas com scope `public` sem consumidor: revisar se são realmente necessárias ou se o consumidor não foi detectado (confidence low).

---

## Rotas Duplicadas Suspeitas

Pares de rotas com similaridade ≥ 90 e tokenSimilarity ≥ 0.5. Score máximo = 100 (method 40 + token 40 + owner 10 + scope 10).

### Score ≥ 80 (alta probabilidade)

| Score | Method | Rota A | Rota B | App | Observação |
|:----:|:-----:|--------|--------|:---:|------------|
| **100** | GET | `/api/admin/v1/pages` | `/api/admin/v1/pages/:id` | site | Mesmo app e scope |
| **100** | GET | `/api/admin/v1/posts` | `/api/admin/v1/posts/:id` | site | Mesmo app e scope |
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
| **92** | POST | `/api/v1/admin/discord/drafts/{id}/correction` | `/api/v1/admin/discord/drafts/:id/refresh-image` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/drafts/{id}/correction` | `/api/v1/admin/discord/drafts/:id/reparse` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/drafts/{id}/correction` | `/api/v1/admin/discord/drafts/:id/sync` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/discord/drafts/{id}/correction` | `/api/v1/admin/import/drafts/{id}/correction` | mesas | Mesmo app e scope |
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
| **92** | POST | `/api/v1/admin/import/drafts/{id}/correction` | `/api/v1/admin/import/drafts/:id/reparse` | mesas | Mesmo app e scope |
| **92** | POST | `/api/v1/admin/import/drafts/{id}/correction` | `/api/v1/admin/import/drafts/:id/sync` | mesas | Mesmo app e scope |
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
| **90** | POST | `/api/admin/v1/pages` | `/api/admin/v1/pages/:id/status` | site | Mesmo app e scope |
| **90** | POST | `/api/admin/v1/pages/:id/status` | `/api/admin/v1/posts/:id/status` | site | Mesmo app e scope |
| **90** | POST | `/api/admin/v1/posts` | `/api/admin/v1/posts/:id/status` | site | Mesmo app e scope |
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

### Considerações

- Rotas intencionalmente similares (ex: `contact` vs `contact-click`) geram falso positivo. Avaliar manualmente antes de consolidar.
- Duplicatas entre subsistemas diferentes (ex: discord vs inbox) podem ser arquiteturais, não erros.
- Threshold atual: 90 com tokenSimilarity mínimo de 0.5. Calibrado de 75→90 (DEB-055-16, 2026-06-28) após análise de FP rate ~100%.

## Recomendações

1. **Órfãs:** Revisar cada rota órfã e decidir: remover, marcar como `legacy` no OpenAPI, ou justificar com scope adequado.
2. **Duplicatas:** Avaliar se as rotas com score ≥ 80 devem ser consolidadas ou se são intencionalmente distintas.
3. Para ajustar thresholds ou desabilitar o relatório, editar a seção Fase 6 em `scripts/api/check-api.ts`.
