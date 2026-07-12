# Plan — Spec 071 (Downloads-B)

## Fase 0 — Confirmação de contratos externos

- Confirmar API/quota/auth exata de cada provider no momento da implementação (R2, B2, Fastio, Cloudinary) — não assumir detalhe desta spec como imutável, principalmente Fastio (produto externo, pode mudar contrato).

## Fase 1 — Interface

- Desenhar `StorageAdapter` (upload/getPublicUrl/delete/getUsage).
- Garantir que troca de provider é config, nunca condicional no código de negócio.

## Fase 2 — Providers

- Implementar R2.
- Implementar B2.
- Implementar Fastio.
- Implementar Cloudinary `raw`/PDF (último fallback).

## Fase 3 — Failover e cota

- Medição de cota por provider.
- Failover automático para novo upload + log de auditoria.

## Fase 4 — Migração de existentes

- Job de migração entre providers (gated por aprovação nominal por rodada).
- Reconciliação por checksum antes de apagar da origem.

## Fase 5 — Segurança de upload

- Upload sempre mediado pelo backend.
- Validação de tipo real (magic bytes) — só PDF/MD/DOC.

## Fase 6 — Validação

- lint + build + test locais.
- Teste de upload real controlado (ambiente de teste, não prod).

## Gate de saída

Adapter funcional com R2 real testado libera consumo pela spec 073 (CTA de acesso).
