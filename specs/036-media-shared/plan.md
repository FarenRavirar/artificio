# 036 — Plano de execução

## Fase 1: Criar `packages/media`

1. `package.json` — `@artificio/media`, type module, dep `cloudinary`, scripts build/lint
2. `tsconfig.json` — estende `packages/config/tsconfig.base.json`, NodeNext
3. `src/index.ts` — 5 funções exportadas
4. Validar: `tsc --noEmit` + `pnpm --filter @artificio/media build`

## Fase 2: Consumidor 1 — `apps/links`

- `server/lib/cloudinary.ts`: substituir `ensureConfig`/`cloudinaryEnabled`/`uploadBuffer`/`uploadLogoFromUrl`/`deleteLogo` por imports de `@artificio/media`
- `db/seed.ts`: ajustar imports
- `server/server.ts`: ajustar imports
- Remover: uploadBuffer local, ensureConfig local, cloudinaryEnabled local, deleteLogo local, uploadLogoFromUrl local
- MAX_LOGO_BYTES (2MB app-specific) → `maxBytes` em `uploadFromUrl` opts

## Fase 3: Consumidor 2 — `apps/site`

- `server/lib/media-store.ts`: `configure()` no boot de `server.ts`, `isConfigured()` para gate, `uploadBuffer()` com folder `artificio/uploads`, `deleteAsset()`. Manter fallback filesystem local (UPLOADS_DIR).
- `importer/media.ts`: trocar `cloudinaryEnabled()` frágil (só CLOUDINARY_CLOUD_NAME) por `isConfigured()` do pacote. Não tocar upload em massa (cloudinary.uploader.upload direto é legacy da migração WP).

## Fase 4: Consumidor 3 — `apps/mesas`

- `discord/uploadDiscordImage.ts`: trocar `uploadBufferToCloudinary` local por `uploadBuffer` do pacote com folder `discord-imports`. Manter SSRF, DI, categorizeFetchError.

## Fase 5: Validação

- `tsc --noEmit` em packages/media
- `tsc --noEmit` em apps/links, apps/site, apps/mesas/backend
- Build Astro em apps/links (15 páginas) e apps/site
- `turbo build` dos 3 consumidores
- Verificar que imports dos cloudinary.ts locais foram removidos/atualizados

## Rollback

Reverter commits da branch. Sem migration de DB. Sem alteração de runtime (funções são equivalentes).
