# Relatório de Breaking Changes — api:diff

**Gerado em:** 1970-01-01T00:00:00.000Z
**Base:** dev
**Modo:** inicial (não bloqueante)

---

## Sumário

| App | Breaking | Non-breaking | Unclassified |
|-----|:--------:|:------------:|:------------:|
| mesas | ❌ 4 | ✅ 1 | ⚪ 0 |

---

### mesas

#### ❌ Breaking Changes (4)

| Path | Method | Ação | Código |
|------|--------|------|--------|
| `/api/v1/gm/tables/:id/click` |  | remove | `path.remove` |
| `/api/v1/gm/tables/:id/contact` |  | remove | `path.remove` |
| `/api/v1/gm/tables/:id/favorite` |  | remove | `path.remove` |
| `/api/v1/gm/tables/:slug/view` |  | remove | `path.remove` |

#### ✅ Non-breaking (1)

| Path | Method | Ação |
|------|--------|------|
| `/api/v1/tables/:slug/contact` |  | add |

