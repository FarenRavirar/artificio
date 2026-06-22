# 043 — links: auditoria visual (ui-design-review + nielsen-heuristics-audit) + shared `packages/ui`
- **Módulo/Pacote:** apps/links + `packages/ui`
- **Gate relacionado:** D (projeto links — em curso)
- **Escopo ampliado (2026-06-22):** T20-T22 (shared packages/ui) promovidos a prioridade máxima por decisão do mantenedor. Spec cobre tudo em um só lugar.

## Problema
O módulo `links.artificiorpg.com` foi lançado recentemente (2026-06-21) e está no ar em produção. A construção foi focada em funcionalidade (catálogo de grupos, busca, reportar, admin, SSO, Cloudinary), sem uma revisão sistemática de qualidade visual e usabilidade. O CSS custom (`global.css`, 624 linhas) e os componentes React (7 ilhas) precisam de uma auditoria para identificar:

1. **Problemas de design visual** — tipografia, cor, espaçamento, hierarquia, consistência com a marca e com o design system (`@artificio/ui`).
2. **Problemas de usabilidade** — heurísticas de Nielsen (visibilidade de status, controle do usuário, consistência, prevenção de erro, reconhecimento, flexibilidade, estética, recuperação de erro, ajuda).

Sem essa auditoria, débitos visuais e de UX acumulam silenciosamente e viram retrabalho caro depois.

## Requisitos (numerados, testáveis)
- **R1 — ui-design-review.** Executar a skill `ui-design-review` sobre o módulo links, cobrindo tipografia, cor, espaçamento, hierarquia, consistência, branding. Gerar relatório com achados e recomendações.
- **R2 — nielsen-heuristics-audit.** Executar a skill `nielsen-heuristics-audit` sobre o módulo links, cobrindo as 10 heurísticas de Nielsen. Gerar relatório com achados e recomendações.
- **R3 — Compilação de débitos.** Consolidar os achados de R1 e R2 em tarefas acionáveis no `tasks.md`, com prioridade e esforço estimado.
- **R4 — Priorização.** Marcar o que é "fase 1" (corrigir agora, baixo esforço/alto impacto) vs "fase 2" (melhoria contínua, maior esforço).

## Critérios de aceite
- Relatório de `ui-design-review` gerado com achados específicos por componente/tela (home, busca, grupo, admin).
- Relatório de `nielsen-heuristics-audit` gerado com violações e recomendações por heurística.
- `tasks.md` populado com tarefas derivadas dos achados, priorizadas (F1/F2).
- Nenhum código alterado nesta spec — é investigação pura. Implementação = specs ou fatias futuras.

## Fora de escopo
- Alterar código ou CSS do links nesta spec.
- Auditoria de acessibilidade (WCAG) — spec futura se necessário.
- Auditoria de performance/Lighthouse.
- Tocar outros apps (mesas, glossario, site, accounts).
- Mudanças em `packages/ui` — se a auditoria encontrar débito compartilhado, registrar para spec própria.

## Riscos e impacto em outros módulos
- **Nenhum risco de regressão** — spec é só investigação, sem alteração de código.
- **Possível descoberta de débito em `packages/ui`:** confirmado — 3 débitos shared (logo base64, shimmer SSO, menu emoji). Promovidos a F1 máxima prioridade. Correções em `packages/ui` beneficiam todos os apps (links, mesas, glossario, site, accounts). Smoke cross-app obrigatório.
- **Escopo pode crescer:** uma auditoria visual básica pode revelar problemas estruturais (ex.: shell quebrado no mobile, contraste insuficiente, cards inconsistentes com outros apps). Cada classe de problema vira tarefa ou spec derivada.
