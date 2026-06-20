# 036 — Tasks

## Fase 1 — `packages/media`

- [ ] T1 — `package.json` (name, type, exports, scripts, deps)
- [ ] T2 — `tsconfig.json` (NodeNext, estende base)
- [ ] T3 — `src/index.ts` (5 funções: configure, isConfigured, uploadBuffer, uploadFromUrl, deleteAsset)
- [ ] T4 — `tsc --noEmit` verde
- [ ] T5 — `pnpm --filter @artificio/media build` verde

## Fase 2 — apps/links

- [ ] T6 — Substituir `server/lib/cloudinary.ts` (imports de @artificio/media; remover funções duplicadas)
- [ ] T7 — Ajustar `db/seed.ts` (imports atualizados)
- [ ] T8 — Ajustar `server/server.ts` (imports atualizados)
- [ ] T9 — Adicionar `@artificio/media: workspace:*` em apps/links/package.json

## Fase 3 — apps/site

- [ ] T10 — Substituir `server/lib/media-store.ts` (Cloudinary via @artificio/media; manter fallback local)
- [ ] T11 — `importer/media.ts`: trocar `cloudinaryEnabled()` frágil por `isConfigured()` do pacote
- [ ] T12 — Adicionar `@artificio/media: workspace:*` em apps/site/package.json

## Fase 4 — apps/mesas

- [ ] T13 — `discord/uploadDiscordImage.ts`: trocar `uploadBufferToCloudinary` local por `uploadBuffer` do pacote
- [ ] T14 — Adicionar `@artificio/media: workspace:*` em apps/mesas/backend/package.json

## Fase 5 — Validação + documentação

- [ ] T15 — `pnpm install` (lockfile)
- [ ] T16 — `tsc --noEmit` em packages/media + apps/links + apps/site + apps/mesas/backend
- [ ] T17 — `turbo run build` nos consumidores
- [ ] T18 — Atualizar `specs/backlog.md` (BL-CLOUDINARY-SHARED → fechado)
- [ ] T19 — Atualizar `project-state.md`
- [ ] T20 — Sessão final
