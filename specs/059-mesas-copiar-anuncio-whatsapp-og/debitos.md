# 059 — Debitos

> Achados internos de investigacao, lint, build ou auditoria desta spec.

## Abertos

Nenhum debito tecnico separado ainda. Pontos de risco de contrato estao em `spec.md` e `tasks.md` Fase 0/Fase 1:

- `age_rating` existe em `tables`, tipos e pipeline de importacao/sync, mas nao esta exposto em `GET /api/v1/tables/:slug` nem tipado em `TableDetail`.
- Resolvido na Fase 0: `price_type=paga` vira "Comissionada" apenas na saida copiar/colar; dado interno continua `paga`.
