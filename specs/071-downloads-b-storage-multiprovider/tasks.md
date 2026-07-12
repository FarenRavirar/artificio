# Tasks — Spec 071 (Downloads-B)

## F0 — Confirmação externa

- [ ] T0.1 — Confirmar contrato/API/quota/auth real de R2, B2, Fastio e Cloudinary no momento da implementação.

## F1 — Interface

- [ ] T1.1 — `StorageAdapter` (upload/getPublicUrl/delete/getUsage).

## F2 — Providers

- [ ] T2.1 — R2 (primário).
- [ ] T2.2 — B2 (fallback por cota).
- [ ] T2.3 — Fastio (3º fallback).
- [ ] T2.4 — Cloudinary `raw`/PDF (último fallback).

## F3 — Failover e cota

- [ ] T3.1 — Medição de cota por provider.
- [ ] T3.2 — Failover automático + log de auditoria (provider, motivo, timestamp).

## F4 — Migração de existentes

- [ ] T4.1 — Job de migração entre providers, gated por aprovação nominal por rodada.
- [ ] T4.2 — Reconciliação por checksum antes de apagar da origem.

## F5 — Segurança de upload

- [ ] T5.1 — Upload sempre mediado pelo backend (nunca credencial no cliente).
- [ ] T5.2 — Validação de tipo real por magic bytes (só PDF/MD/DOC, rejeita `.zip`).

## F6 — Validação

- [ ] T6.1 — lint + build + test locais.
- [ ] T6.2 — Teste de upload real em ambiente controlado (R2).
- [ ] T6.3 — Teste de failover simulado (mock de cota estourada).
- [ ] T6.4 — Teste de migração de arquivo já existente com reconciliação de checksum.
