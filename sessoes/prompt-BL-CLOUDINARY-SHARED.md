# Prompt — BL-CLOUDINARY-SHARED

```
T0 lido. SDD COMPLETO (cross-cutting, packages/*). Débito BL-CLOUDINARY-SHARED —
extrair padrão de upload Cloudinary duplicado em 3 apps (site, mesas/discord, links)
para um pacote compartilhado @artificio/media.

Origem: spec 013 (I6), SonarQube PR #74 reportando 4.2% duplication (limite ≤3%).
Investigações: C1, I5, I6 na sessão sessoes/26-06-20_2_links_whatsapp-013-014.md.
Registrado em: specs/backlog.md linha 61.

CONTEXTO:
  5 apps no monorepo usam Cloudinary. 3 compartilham o mesmo padrão upload_stream
  duplicado ~20 linhas cada:

  | Padrão                     | site       | mesas/discord | links      |
  |----------------------------|:----------:|:-------------:|:----------:|
  | upload_stream + callback   | ✅ storeUpload | ✅ uploadBufferToCloudinary | ✅ uploadBuffer |
  | ensureConfig() lazy        | ✅         | — eager       | ✅         |
  | cloudinaryEnabled() guard  | ✅ (frágil)| —             | ✅         |
  | delete*(publicId)          | ✅         | ✅            | ✅         |
  | sha256 como public_id      | —          | ✅            | ✅         |
  | uploadFromUrl (fetch→upload)| —         | ✅ SSRF-safe  | ✅         |
  | Fallback local filesystem  | ✅ (único) | —             | —          |

  mesas/services e glossario usam cloudinary.uploader.upload() direto (dataURI/URL) —
  NÃO usam upload_stream. Não são consumidores do pacote (fora do escopo).

  Não existe packages/media hoje.

SOLUÇÃO ÚNICA — @artificio/media (packages/media):

  API pública do pacote (mínima, cada função é atômica e composível):

    configure(opts?: { cloudName?, apiKey?, apiSecret? })
      → Lê CLOUDINARY_URL ou trio. Idempotente (flag configured).
      → Padrão links+site (lazy), não eager.

    isConfigured(): boolean
      → CLOUDINARY_URL || (CLOUDINARY_CLOUD_NAME && API_KEY && API_SECRET)
      → Padrão glossario+links (checa 3 vars, não só CLOUDINARY_CLOUD_NAME).

    uploadBuffer(buffer: Buffer, opts: { folder, publicId, resourceType?, overwrite? }): Promise<{ url, public_id }>
      → Readable.from(buffer).pipe(cloudinary.uploader.upload_stream(...))
      → callback padrão: err→reject, !secure_url→reject, resolve({url, public_id}).
      → opts.overwrite default false.

    uploadFromUrl(sourceUrl: string, opts: { folder, maxBytes?, timeout? }): Promise<{ url, public_id }>
      → fetch → content-length pre-check → arrayBuffer → content-type check → uploadBuffer.
      → maxBytes default 10MB (compartilhado). timeout default 10s.
      → sha256(content) como public_id (idempotente).
      → NÃO inclui SSRF/DNS rebinding (mesas/services tem, mas é 170+ linhas;
        apps que precisam mantêm própria camada de fetch seguro).

    deleteAsset(publicId: string, opts?: { resourceType? }): Promise<void>
      → cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).
      → Non-fatal: try/catch + console.error. No-op se !publicId.

  NÃO incluir no pacote:
    - uploadScreenshot(dataUri) → cada app tem lógica própria de base64/decode.
    - SSRF protection → manter em mesas/services como camada local.
    - Fallback filesystem → manter em site como comportamento específico.
    - Dependency injection → pattern do discord, fora do escopo.

  package.json: @artificio/media, dependência cloudinary ^2.9 (peer? direta?).
  Build: tsc (commonjs ou esm, consistente com o resto dos packages).
  Export: index.ts com as 5 funções.

PLANO DE MIGRAÇÃO (por consumidor, em ordem de risco):

  CONSUMIDOR 1 — apps/links (menor risco, código mais recente):
    Arquivo: apps/links/server/lib/cloudinary.ts
    Substituir: ensureConfig → configure(), cloudinaryEnabled → isConfigured(),
      uploadBuffer → uploadBuffer(), uploadLogoFromUrl → uploadFromUrl() com folder:'artificio/links',
      deleteLogo → deleteAsset(). Manter MAX_LOGO_BYTES local (2MB app-specific →
      passar como maxBytes no opts de uploadFromUrl).
    Remover: uploadBuffer local, ensureConfig local, cloudinaryEnabled local,
      deleteLogo local, uploadLogoFromUrl local.
    Atualizar imports em: db/seed.ts, server/server.ts.

  CONSUMIDOR 2 — apps/site (risco médio, tem fallback local):
    Arquivo: apps/site/server/lib/media-store.ts
    Substituir: ensureConfig → configure(), cloudinaryEnabled → isConfigured(),
      storeUpload → uploadBuffer() com folder:'artificio/uploads',
      deleteStoredMedia → deleteAsset().
    Manter: fallback filesystem local (UPLOADS_DIR) — comportamento único do site,
      wrapper storeUpload que decide Cloudinary vs local baseado em isConfigured().
    Atualizar imports nos consumidores de media-store.ts.
    NOTA: site também tem apps/site/importer/media.ts com cloudinaryEnabled frágil
    (só CLOUDINARY_CLOUD_NAME) — unificar para isConfigured() do pacote.

  CONSUMIDOR 3 — apps/mesas (maior risco, tem SSRF próprio):
    Arquivo: apps/mesas/backend/src/discord/uploadDiscordImage.ts
    Substituir: uploadBufferToCloudinary → uploadBuffer() com folder:'discord-imports'.
    Manter: camada SSRF própria (isPrivateIp, resolvePublicAddresses, fetchPublicRemoteImage),
      dependency injection (UploadDiscordImageDeps), categorizeFetchError,
      DiscordImageUploadFailureStatus.
    uploadRemoteImageToCloudinary já chama uploadBufferToCloudinary → trocar para
    uploadBuffer() do pacote ou uploadFromUrl().
    Atualizar imports.

VALIDAÇÃO (OBRIGATÓRIA, pétrea de shared package):
  - tsc --noEmit em packages/media
  - tsc --noEmit em apps/links, apps/site, apps/mesas/backend
  - Build Astro em apps/links (15 páginas) e apps/site
  - Build turbo dos 3 consumidores
  - Verificar que imports de cloudinary.ts locais foram removidos/atualizados
  - Verificar que SonarQube duplication report <3% (não validável localmente,
    mas a extração deve eliminar os 3 blocos duplicados)
  - Smoke matrix: links (grupos + admin + rebuild), site (CMS upload + delete),
    mesas (discord import)

REGRAS:
  SDD COMPLETO (packages/* cross-cutting). Não commitar.
  Se encontrar outros padrões Cloudinary não mapeados, investigar e registrar débito.
  Documentar tudo na sessão + backlog.md + project-state.md.
  Após aplicar, atualizar BL-CLOUDINARY-SHARED no backlog.md para fechado.
```
