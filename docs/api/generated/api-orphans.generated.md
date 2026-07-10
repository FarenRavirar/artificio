# Relatório de Rotas Órfãs e Duplicadas

**Gerado em:** 1970-01-01T00:00:00.000Z
**Modo:** inicial
**Este relatório NÃO bloqueia o build.**

---

## Sumário

| Categoria | Quantidade | Bloqueia? |
|-----------|:----------:|:---------:|
| 👻 Órfãs suspeitas (ORPHAN_SUSPECT) | 2 | ❌ |

## Rotas órfãs suspeitas

Rotas existentes no código/OpenAPI, sem consumidor detectado e sem classificação que justifique ausência de uso.

### mesas (2 rota(s))

| Method | Path | Tem OpenAPI? | Scope | Razão |
|--------|------|:-----------:|-------|-------|
| PATCH | `/api/v1/profile/me/gm` | ✅ | public | Scope "public" sem consumidor |
| PATCH | `/api/v1/profile/me/player` | ✅ | public | Scope "public" sem consumidor |

### Observações

- Rotas sem OpenAPI (CODE_ONLY) não têm classificação `x-artificio-*` — podem ser admin/cron/legacy legítimas mas ainda não documentadas.
- Rotas com scope `public` sem consumidor: revisar se são realmente necessárias ou se o consumidor não foi detectado (confidence low).

## Recomendações

1. **Órfãs:** Revisar cada rota órfã e decidir: remover, marcar como `legacy` no OpenAPI, ou justificar com scope adequado.
2. **Duplicatas:** Avaliar se as rotas com score ≥ 80 devem ser consolidadas ou se são intencionalmente distintas.
3. Para ajustar thresholds ou desabilitar o relatório, editar a seção Fase 6 em `scripts/api/check-api.ts`.
