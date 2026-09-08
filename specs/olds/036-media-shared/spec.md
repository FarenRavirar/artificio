# 036 — `packages/media`: upload Cloudinary compartilhado

- **Pacote:** `packages/media` (novo, cross-cutting)
- **Gate:** D (módulo novo)
- **Nível SDD:** **Completo** (shared package: `packages/*`)
- **Origem:** `BL-CLOUDINARY-SHARED` (spec 013 I6, SonarQube PR #74: 4.2% duplication, limite ≤3%)
- **Sessão:** `sessoes/prompt-BL-CLOUDINARY-SHARED.md`

## Problema

3 apps no monorepo (links, site, mesas/discord) duplicam o mesmo padrão Cloudinary `upload_stream` ~20 linhas cada. Também duplicado: `ensureConfig()` lazy, `cloudinaryEnabled()` guard, `delete*()` non-fatal, `uploadFromUrl` com sha256.

## Solução

`packages/media` (`@artificio/media`) com 5 funções atômicas e composíveis, substituindo os 3 blocos duplicados.

## API pública

| Função | Assinatura | Substitui |
|---|---|---|
| `configure(opts?)` | `(opts?: { cloudName?, apiKey?, apiSecret? }): void` | `ensureConfig()` lazy (padrão links+site) |
| `isConfigured()` | `(): boolean` | `cloudinaryEnabled()` com 3 vars (glossario gold) |
| `uploadBuffer(buffer, opts)` | `(buffer: Buffer, opts: { folder, publicId?, resourceType?, overwrite? }): Promise<UploadResult>` | `storeUpload`/`uploadBufferToCloudinary`/`uploadBuffer` |
| `uploadFromUrl(url, opts)` | `(url: string, opts: { folder, maxBytes?, timeout? }): Promise<UploadResult>` | `uploadLogoFromUrl` com 10MB max (compartilhado) |
| `deleteAsset(publicId, opts?)` | `(publicId: string, opts?: { resourceType? }): Promise<void>` | `deleteStoredMedia`/`deleteLogo`/`deleteFromCloudinary` |

## Não incluir

- `uploadScreenshot(dataUri)` — cada app tem lógica própria de base64/decode
- SSRF protection — manter em mesas/services como camada local
- Fallback filesystem — manter em site como comportamento específico
- Dependency injection — pattern do discord, fora do escopo

## Consumidores (ordem de migração)

1. `apps/links` — menor risco, código mais recente
2. `apps/site` — risco médio, tem fallback local
3. `apps/mesas` — maior risco, tem SSRF próprio
