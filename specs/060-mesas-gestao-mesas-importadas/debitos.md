# Débitos — 060

## Achados internos de investigação (não são review externo)

- Cadeia completa de isolamento de mesas importadas (`gm_id: null`)
  mapeada em 2026-07-08: `GET /api/v1/tables` filtra `active`-only,
  `GET /gm/tables*` filtra por `gm_id` do usuário, `adminTables.ts` não
  tem nenhum `GET`. Mesa sincronizada só é "publicável" durante a janela
  em que o operador ainda vê o draft original — depois disso, sem UI de
  descoberta. Esta spec resolve a causa raiz.
- `TableRepository` só expõe `findByIdAndGm` — não existe leitura
  admin-agnóstica hoje. T1 desta spec cobre.
