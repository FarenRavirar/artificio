# 059 — Debitos

> Achados internos de investigacao, lint, build ou auditoria desta spec.

## Abertos

Nenhum debito tecnico separado ainda. Pontos de risco de contrato estao em `spec.md` e `tasks.md`:

- ~~`age_rating`~~ **Fechado.** Fase 1 expoe `age_rating` no detalhe publico `GET /api/v1/tables/:slug` e tipa em `TableDetail`. T1.1, T1.1a implementados.
- ~~`price_type=paga`~~ **Fechado na Fase 0.** "Comissionada" apenas na saida copiar/colar; dado interno continua `paga`. T0.3 decidido e implementado no formatter (Fase 2).
