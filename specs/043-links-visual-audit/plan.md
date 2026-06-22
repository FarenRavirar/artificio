# Plano — 043 (links: auditoria visual + shared packages/ui)

## Arquitetura da solução
Esta spec cobre **investigação (Fase 0) + implementação (Fase 1-4)**. Escopo ampliado por decisão do mantenedor para incluir débitos em `packages/ui`.

1. **Fase 0 — Auditoria ✅ (concluída):**
   - ui-design-review: score 64/100, 28 achados
   - nielsen-heuristics-audit: score 6.2/10, 28 issues

2. **Fase 1 — Shared prioritário (`packages/ui`):**
   - T5: logo base64 → asset cacheável
   - T6: skeleton shimmer no header SSO (todos apps)
   - T7: menu toggle ☰→SVG (todos apps)
   - Smoke cross-app obrigatório: build + lint em links, mesas, glossario, site, accounts

3. **Fase 2 — Correções locais (`apps/links`):**
   - T8-T9: shell busca + cores
   - T10-T11: feedback (ReportButton, CTA)
   - T12: tipografia (Oswald)

4. **Fase 3 — Melhorias (`apps/links`):**
   - T15-T20: line-height, sidebar, erros React, emojis, gate adulto, disabled+spinner

5. **Fase 4 — Backlog:**
   - T30-T39: drawer mobile, atalhos, 404, onboarding, etc.

## Arquivos afetados

**Fase 1 (shared):**
- `packages/ui/` — componente de header (logo, session area, menu toggle)
- `apps/*/` — smoke build em todos os consumidores

**Fase 2-4 (links):**
- `apps/links/src/pages/busca/index.astro`
- `apps/links/src/components/LinksSearch.tsx`
- `apps/links/src/components/ReportButton.tsx`
- `apps/links/src/pages/grupo/[slug].astro`
- `apps/links/src/styles/global.css`
- `apps/links/src/pages/index.astro`

## Contratos/interfaces tocados
- `packages/ui` — componente Header e subcomponentes (logo, session, menu toggle)
- Consumidores do header: links, mesas, glossario, site, accounts

## Impacto em consumidores
- **Fase 1 — T5 (logo base64):** 5 consumidores de `brand.ts` — `Header.tsx` (pacote), `accounts/frontend/src/main.tsx:3`, `site/src/lib/content.ts:6`. Migrar para asset exige bundler em `packages/ui` (build atual = `tsc` puro, sem asset bundling).
- **Fase 1 — T6 (shimmer), T7 (menu SVG):** 3 consumidores do `<Header>` — links, glossario, mesas. **NÃO afeta site** (header Astro próprio `SiteHeader.astro`) nem **accounts** (layout minimalista sem Header).
- **Fase 2-4:** apenas `apps/links` — sem impacto cross-app

## Rollback
- Cada task shared tem rollback descrito no `tasks.md`
- Em caso de regressão cross-app: reverter PR do `packages/ui` e re-deploy dos apps afetados

## Validação
- Fase 1: `pnpm build` verde em links + mesas + glossario + site + accounts; verificação visual do header em cada app
- Fase 2-4: `pnpm --filter @artificio/links build` verde; verificação visual das páginas afetadas
