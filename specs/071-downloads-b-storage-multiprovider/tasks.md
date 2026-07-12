# Tasks — Spec 071 (Downloads-B)

## F0 — Confirmação externa

- [ ] T0.1 — Confirmar contrato/API/quota/auth real de R2, B2, Fastio e Cloudinary no momento da implementação.

## F1 — Interface

- [x] T1.1 — `StorageAdapter` (upload/getPublicUrl/delete/getUsage). `src/storage/types.ts`.

## F2 — Providers

- [x] T2.1 — R2 (primário). `src/storage/s3CompatAdapter.ts` (via `@aws-sdk/client-s3`, compat S3).
- [x] T2.2 — B2 (fallback por cota). Mesmo adapter S3-compat, config própria.
- [x] T2.3 — Fastio (3º fallback). `src/storage/fastioAdapter.ts` (REST cru via fetch — **contrato ainda não confirmado contra doc real da Fastio, T0.1 pendente**).
- [x] T2.4 — Cloudinary `raw`/PDF (último fallback). `src/storage/cloudinaryAdapter.ts`, reusa `@artificio/media` (sem lib `cloudinary` própria no app).

## F3 — Failover e cota

- [x] T3.1 — Medição de cota por provider. **Revisado (2026-07-12, regra pétrea do mantenedor):** contagem LOCAL via `download_storage_usage` (migration 010) + `src/storage/usageTracker.ts`, nunca bate no provider pra medir (evita gastar cota Classe B só medindo). Cota do R2 default 90% do free tier real (9GiB / 900k Classe A / 9M Classe B) — zero risco de cobrança. Checagem ANTES de cada operação real (`assertWithinQuota`), registro só após sucesso (`recordUsage`).
- [x] T3.2 — Failover automático + log de auditoria (provider, motivo, timestamp). `src/storage/failover.ts`.

## F4 — Migração de existentes

- [x] T4.1 — Job de migração entre providers (lógica pura, gated por aprovação nominal por rodada em runtime). `src/storage/migration.ts` (`runMigrationBatch`/`migrateItem`). Requer `StorageAdapter.download` (novo método na interface, `src/storage/types.ts`), implementado nos 3 adapters (`s3CompatAdapter`, `fastioAdapter`, `cloudinaryAdapter`).
- [x] T4.2 — Reconciliação por checksum (SHA-256) antes de apagar da origem. Se hash divergir, item fica duplicado (origem + destino) e não apaga nada — aguarda investigação manual. `migrateItem` em `src/storage/migration.ts`.

## F5 — Segurança de upload

- [x] T5.1 — Upload sempre mediado pelo backend (nunca credencial no cliente). Adapters só existem server-side; nenhuma credencial exposta a rota/cliente.
- [x] T5.2 — Validação de tipo real por magic bytes (só PDF/MD/DOC, rejeita `.zip`). `src/storage/fileTypeGuard.ts`.

## F6 — Validação

- [x] T6.1 — lint + build + test locais (verde: 21 testes, `pnpm --filter @artificio/downloads-backend lint/build/test`, 2026-07-12).
- [ ] T6.2 — Teste de upload real em ambiente controlado (R2). **Pendente — exige credencial real, fora do escopo desta rodada (decisão explícita do mantenedor).**
- [x] T6.3 — Teste de failover simulado (mock de cota estourada). `src/storage/failover.test.ts`.
- [x] T6.4 — Teste de migração de arquivo já existente com reconciliação de checksum (mock, sem credencial real). `src/storage/migration.test.ts` (4 testes: migração ok, checksum divergente preserva origem, download falha preserva origem, batch parcialmente falho não trava os demais items).
