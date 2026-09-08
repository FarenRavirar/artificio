# Spec 071 — Downloads-B: Storage multi-provider

## Origem

Spec filha da `061-downloads-definicao-produto` (§F7/T7.3). Decisões de produto já fechadas: D091 (ordem de fallback), D111 item 8 (migração também move arquivo existente), D111 item 9 (Fastio confirmado e mantido).

## Pré-requisito

Depende da spec 070 (Downloads-A): schema `download_material_version` com campo `storage_provider` precisa existir antes.

## Objetivo

Implementar o adapter de storage único (`StorageAdapter`) cobrindo, nesta ordem fixa: Cloudflare R2 (primário) → Backblaze B2 (fallback por cota) → Fastio (`fast.io`, storage para agentes de IA, REST API própria — confirmado real) → Cloudinary `raw`/PDF (último fallback). Capas de material continuam no Cloudinary compartilhado já usado pelos outros módulos (T3.5), fora do escopo desta spec.

## Escopo

- Interface `StorageAdapter` (`upload`, `getPublicUrl`, `delete`, `getUsage`) plugável — trocar provider é config, nunca condicional espalhada.
- Implementação real dos 4 providers, na ordem fixa acima.
- Upload sempre mediado pelo backend (signed/credential nunca no cliente) — mesma regra pétrea já aplicada a Cloudinary.
- URL pública estável no domínio Artifício (ex.: `downloads.artificiorpg.com/arquivos/:id`), nunca expõe URL crua do provider.
- Medição de cota e failover automático para novo upload, registrado em log de auditoria (provider, motivo, timestamp).
- Migração de arquivo já existente entre providers: **também migra** (D111 item 8), sempre atrás de aprovação nominal por rodada + reconciliação por checksum antes de apagar da origem.
- Tipos de arquivo aceitos no MVP: apenas documentos — PDF, Markdown (`.md`), Word (`.doc`/`.docx`). Sem `.zip`/pacote compactado (D111 item 10).
- Validação de tipo real (magic bytes), não só extensão/MIME declarado (mitigação de T5.5).

## Fora de escopo

- Capas (Cloudinary shared, já resolvido em T3.5, spec própria se precisar mexer).
- Upload de imagem solta, VTT, mapas/tokens — fora do MVP (D111 item 10).
- Link externo (não é storage — é o outro braço de `origin`, tratado em spec 072/073).

## Critérios de aceite

1. Upload real de teste sobe com sucesso em R2 (provider primário) em ambiente controlado.
2. Failover simulado (mock de cota estourada) comprovado localmente, log de auditoria registra troca.
3. Migração de arquivo já existente funciona com aprovação nominal simulada + reconciliação de checksum antes de apagar da origem.
4. URL pública nunca muda ao trocar de provider.
5. Upload rejeita tipo de arquivo fora de PDF/MD/DOC, mesmo com extensão forjada (checagem por magic bytes).
6. Nenhuma credencial de provider aparece no client-side.

## Dependências

- Spec 070 (schema).
- Pode rodar em paralelo com spec 072.
