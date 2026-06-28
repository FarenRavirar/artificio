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

## Recomendações

1. **Órfãs:** Revisar cada rota órfã e decidir: remover, marcar como `legacy` no OpenAPI, ou justificar com scope adequado.
2. **Duplicatas:** Avaliar se as rotas com score ≥ 80 devem ser consolidadas ou se são intencionalmente distintas.
3. Para ajustar thresholds ou desabilitar o relatório, editar a seção Fase 6 em `scripts/api/check-api.ts`.
