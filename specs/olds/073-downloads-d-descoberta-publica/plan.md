# Plan — Spec 073 (Downloads-D)

## Fase 0 — Preparação

- Confirmar que specs 070/071/072 estão localmente verdes (lint/build/test) antes de consumir suas APIs.

## Fase 1 — Rotas e navegação

- Rotas de T4.1.
- Header global + submenu + sidebar (T4.2), reaproveitando `packages/ui`.

## Fase 2 — Busca/filtro/ordenação/paginação

- Estado único em URL (T4.3).
- Facetas do MVP.

## Fase 3 — Card e ficha

- Componente de card (T4.4).
- Página de ficha com ordem de seções fixada.
- CTA de acesso com evento de funil.

## Fase 4 — Perfil de criador

- `/criadores/:slug` com créditos sem conta.

## Fase 5 — AA/responsivo

- Wireframes de T4.5 aplicados.
- Auditoria AA básica local (contraste, foco, zoom, reduced-motion).

## Fase 6 — Validação

- lint + build + test.
- Teste de componente (card/ficha/filtros).
- E2e leve: busca→filtro→ficha→CTA.

## Gate de saída

Catálogo público funcional localmente libera spec 074 (painel reaproveita os mesmos componentes).
