# Relatório de Breaking Changes — api:diff

**Gerado em:** 1970-01-01T00:00:00.000Z
**Base:** dev
**Modo:** inicial (não bloqueante)

---

## Sumário

| App | Breaking | Non-breaking | Unclassified |
|-----|:--------:|:------------:|:------------:|
| mesas | ❌ 6 | ✅ 6 | ⚪ 0 |
| glossario | ❌ 5 | ✅ 6 | ⚪ 0 |

---

### mesas

#### ❌ Breaking Changes (6)

| Path | Method | Ação | Código |
|------|--------|------|--------|
| `/api/v1/gm/:slug` |  | remove | `path.remove` |
| `/api/v1/gm/:slug/contact` |  | remove | `path.remove` |
| `/api/v1/gm/:slug/contact-click` |  | remove | `path.remove` |
| `/api/v1/gm/:slug/insights` |  | remove | `path.remove` |
| `/api/v1/gm/:slug/reviews` |  | remove | `path.remove` |
| `/api/v1/gm/:slug/view` |  | remove | `path.remove` |

#### ✅ Non-breaking (6)

| Path | Method | Ação |
|------|--------|------|
| `/api/v1/gm/perfis/:slug` |  | add |
| `/api/v1/gm/perfis/:slug/contact` |  | add |
| `/api/v1/gm/perfis/:slug/contact-click` |  | add |
| `/api/v1/gm/perfis/:slug/insights` |  | add |
| `/api/v1/gm/perfis/:slug/reviews` |  | add |
| `/api/v1/gm/perfis/:slug/view` |  | add |

---

### glossario

#### ❌ Breaking Changes (5)

| Path | Method | Ação | Código |
|------|--------|------|--------|
| `/api/social/:id/comments` |  | remove | `path.remove` |
| `/api/social/:id/vote` |  | remove | `path.remove` |
| `/api/social/comments/:id` |  | remove | `path.remove` |
| `/api/systems/:systemId/editions` |  | remove | `path.remove` |
| `/api/systems/editions/:id` |  | remove | `path.remove` |

#### ✅ Non-breaking (6)

| Path | Method | Ação |
|------|--------|------|
| `/api/social/comment/:id` |  | add |
| `/api/social/terms/:id/comments` |  | add |
| `/api/social/terms/:id/vote` |  | add |
| `/api/systems/catalog-health` |  | add |
| `/api/systems/edition/:id` |  | add |
| `/api/systems/system/:systemId/editions` |  | add |

