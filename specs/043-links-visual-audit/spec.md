# 043 — links: auditoria visual (ui-design-review + nielsen-heuristics-audit) + shared `packages/ui`

- **Módulo/Pacote:** apps/links + `packages/ui`
- **Gate relacionado:** D (projeto links — em curso)
- **Status:** em andamento — Fase 4 com 9/10 implementados (T34 ignorado, DEB-014 resolvido)
- **Sessão:** `sessoes/26-06-21_6_links_visual-audit.md`
- **Docs:** `tasks.md` (checklist executiva) · `debitos.md` (DEB-001 a DEB-014) · `reviews.md` (REV-001 a REV-017)
- **Escopo ampliado (2026-06-22):** spec passou de investigação pura para implementação completa. Cobre `apps/links` + `packages/ui`. Fases 0-3 concluídas. Fase 4 com 9/10 resolvidos.

## Problema
O módulo `links.artificiorpg.com` foi lançado recentemente (2026-06-21) e está no ar em produção. A construção foi focada em funcionalidade (catálogo de grupos, busca, reportar, admin, SSO, Cloudinary), sem uma revisão sistemática de qualidade visual e usabilidade. O CSS custom (`global.css`, 624 linhas) e os componentes React (7 ilhas) precisam de uma auditoria para identificar:

1. **Problemas de design visual** — tipografia, cor, espaçamento, hierarquia, consistência com a marca e com o design system (`@artificio/ui`).
2. **Problemas de usabilidade** — heurísticas de Nielsen (visibilidade de status, controle do usuário, consistência, prevenção de erro, reconhecimento, flexibilidade, estética, recuperação de erro, ajuda).

## Status atual (2026-06-22)

| Fase | Tasks | Status |
|------|-------|--------|
| F0 — Auditoria | T1-T4 | ✅ |
| F1 — Shared (`packages/ui`) | T5-T7 | ✅ |
| F2 — Local (`apps/links`) | T8-T12 | ✅ |
| F3 — Melhorias | T15-T20 | ✅ |
| F4 — Backlog | T30-T39 | ✅ 9/10 (T34 ignorado) |

**Débitos:** 14 registrados em `debitos.md` — 14 resolvidos (DEB-014 resolvido 2026-06-22).

## Requisitos (numerados, testáveis)
- **R1 — ui-design-review.** ✅ Executado — score 64/100 (C).
- **R2 — nielsen-heuristics-audit.** ✅ Executado — score 6.2/10 (Fair).
- **R3 — Compilação de débitos.** ✅ `tasks.md` populado + `debitos.md` com 14 débitos rastreáveis.
- **R4 — Priorização.** ✅ Fases 0-4 executadas em ordem de prioridade.

## Critérios de aceite
- Relatório de `ui-design-review` gerado ✅
- Relatório de `nielsen-heuristics-audit` gerado ✅
- `tasks.md` populado com tarefas priorizadas ✅
- Implementações validadas com build ✅ (17 páginas, ~4s)
- ~~Nenhum código alterado~~ → **Escopo revisado:** implementação completa de 11/12 tarefas da Fase 4

## Fora de escopo
- ~~Alterar código ou CSS do links nesta spec.~~ → **Escopo revisado:** implementação autorizada para Fases 0-4.
- Auditoria de acessibilidade (WCAG) — spec futura se necessário.
- Auditoria de performance/Lighthouse.
- Tocar outros apps (mesas, glossario, site, accounts) — exceto `packages/ui` (Fase 1).

## Pendências (pós-implementação)
- **DEB-014 / REV-001:** Âncoras da sidebar (`#cat-*`/`#regra-*`/`#comunidade`) quebram em `/busca/` e `/404.html`. Correção investigada: prefixar `/` em 3 `href` do `Sidebar.astro`. 3 caracteres. Não implementado.

## Riscos e impacto em outros módulos
- **Especificação original** era investigação pura, sem risco de regressão. **Escopo revisado** inclui implementação em `apps/links` + `packages/ui`.
- **`packages/ui`:** 3 correções shared (logo base64, shimmer SSO, menu SVG). Smoke cross-app executado. Sem regressão.
- **`apps/links`:** 12 débitos implementados. Build verde (17 páginas, ~4s). CSS cresceu de 624 para ~790 linhas (+27%). Nenhum outro app afetado.
