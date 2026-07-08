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

## Achados CodeRabbit (PR #138, 2026-07-08) — trivial, não bloqueante

- `GET /api/v1/admin/tables` sem paginação — diferente de `GET
  /api/v1/tables` (limita em 50), a rota admin retorna todas as mesas
  de uma vez. Tende a crescer sem controle conforme catálogo aumenta.
  Não implementado agora: overlay OpenAPI sobrescreveria a operação
  gerada por AST inteira (risco de contrato divergir do código real
  quando `adminTables.ts` mudar) e a UI ainda não provou necessidade
  real de paginação nesse volume. Revisar quando o catálogo crescer.
- Parâmetro de query `?status=` não documentado no OpenAPI gerado
  (mesmo motivo acima — overlay reescreveria a operação inteira).
