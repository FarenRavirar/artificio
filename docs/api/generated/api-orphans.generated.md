# Relatório de Rotas Órfãs e Duplicadas

**Gerado em:** 1970-01-01T00:00:00.000Z
**Modo:** inicial
**Este relatório NÃO bloqueia o build.**

---

## Sumário

| Categoria | Quantidade | Bloqueia? |
|-----------|:----------:|:---------:|
| 👻 Órfãs suspeitas (ORPHAN_SUSPECT) | 38 | ❌ |

## Rotas órfãs suspeitas

Rotas existentes no código/OpenAPI, sem consumidor detectado e sem classificação que justifique ausência de uso.

### downloads (29 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| DELETE | `/api/v1/collections/:id/items/:materialId` | ✅ | public | Scope "public" sem consumidor |
| DELETE | `/api/v1/comments/:id` | ✅ | public | Scope "public" sem consumidor |
| DELETE | `/api/v1/favorites/:materialId` | ✅ | public | Scope "public" sem consumidor |
| DELETE | `/api/v1/reports/:id` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/collections` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/collections/:id/items` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/comments/:materialId` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/creators/:slug` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/creators/me` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/destinations/:id` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/favorites` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/material-metadata/:materialId` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/materials` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/materials/:slug` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/materials/:id/history` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/organizations` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/organizations/:id/members` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/v1/ratings/:materialId` | ✅ | public | Scope "public" sem consumidor |
| PATCH | `/api/v1/materials/:id` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/collections` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/collections/:id/items` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/comments` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/downloads` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/favorites` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/materials` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/organizations` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/v1/reports` | ✅ | public | Scope "public" sem consumidor |
| PUT | `/api/v1/material-metadata/:materialId` | ✅ | public | Scope "public" sem consumidor |
| PUT | `/api/v1/ratings` | ✅ | public | Scope "public" sem consumidor |
### glossario (1 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| GET | `/sitemap.xml` | ✅ | public | Scope "public" sem consumidor |
### mesas (2 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| PATCH | `/api/v1/profile/me/gm` | ✅ | public | Scope "public" sem consumidor |
| PATCH | `/api/v1/profile/me/player` | ✅ | public | Scope "public" sem consumidor |
### site (6 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| GET | `/api/catalog/v1/nodes/:idOrSlug` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/catalog/v1/resolve` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/catalog/v1/snapshot` | ✅ | public | Scope "public" sem consumidor |
| GET | `/api/catalog/v1/systems` | ✅ | public | Scope "public" sem consumidor |
| POST | `/api/catalog/v1/nodes` | ✅ | public | Scope "public" sem consumidor |
| PUT | `/api/catalog/v1/nodes/:id` | ✅ | public | Scope "public" sem consumidor |

### Observações

- Rotas sem OpenAPI (CODE_ONLY) não têm classificação `x-artificio-*` — podem ser admin/cron/legacy legítimas mas ainda não documentadas.
- Rotas com scope `public` sem consumidor: revisar se são realmente necessárias ou se o consumidor não foi detectado (confidence low).

## Recomendações

1. **Órfãs:** Revisar cada rota órfã e decidir: remover, marcar como `legacy` no OpenAPI, ou justificar com scope adequado.
2. **Duplicatas:** Avaliar se as rotas com score ≥ 80 devem ser consolidadas ou se são intencionalmente distintas.
3. Para ajustar thresholds ou desabilitar o relatório, editar a seção Fase 6 em `scripts/api/check-api.ts`.
