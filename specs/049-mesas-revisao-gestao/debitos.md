# Débitos — 049

> Débitos descobertos durante a spec, não corrigidos no escopo atual.

## Pendências técnicas

| # | Débito | Origem | Próximo passo |
|---|--------|--------|---------------|
| D01 | ~~adminDiscordSync.ts com 1278 linhas~~ → 708 linhas (44%) | TE5-TE9 implementados | settings, drafts, upload extraídos. Restam 15+ handlers para <500 — fase E complementar necessária |
| D02 | ~~adminImportInbox.ts com 639 linhas~~ → 562 linhas | loadSystemsForParser duplicado removido, schemas extraídos para inbox/utils.ts | Redução modesta. Split mais profundo (domínios import/drafts/corrections) avaliado mas postergado |
| D03 | ~~adminHydration.ts com 489 linhas — candidato a split~~ | ~~Fase D proposta~~ | **RESOLVIDO:** SYNC_FIELDS extraído para `hydration/config.ts`. adminHydration.ts -27 linhas. |
| D04 | ~~Nenhuma task de frontend executada (TE10-TE17)~~ | ~~Fase E parcial~~ | **RESOLVIDO:** 2 hooks (useDiscordSync, useJsonImport) + 5 componentes (ImportResultGrid, JsonPreviewCard, FileDropzone, MessagesToolbar, GestaoStateWrapper, StatCard). DiscordSyncPanel 543→308, DiscordJsonImportPanel 356→115. Build 17/17 ✅, tests backend 223/223 ✅, frontend 163/163 ✅. |
| D05 | Fase F (verificação pós-refatoração) não iniciada | Fase E incompleta | TF1-TF12 após todas as tasks de refatoração |
| D06 | 8 issues P1 das auditorias não tratadas | Fase B | Corrigir após refatoração estrutural completa |
| D07 | adminTablesAutoArchive.test.ts nome engana — testa auto-archive em adminTables.ts, não existe source separado | Legado | Renomear ou ignorar (funcional) |
| D08 | ~~DiscordSyncPanel.tsx >500 linhas (543)~~ | ~~Fase E parcial~~ | **RESOLVIDO:** reduzido para 308 linhas via TE10 + TE15. |
| D09 | adminDiscordSync.ts: discovery/sources/fetch/messages/parse-batch não extraídos | TE9: 708 linhas, muito acima de <200 | Extrair discovery→routes/discord/discovery.ts, sources→routes/discord/sources.ts, fetch→routes/discord/fetch.ts, messages→routes/discord/messages.ts, parse-batch→routes/discord/parse-batch.ts |
| D10 | adminImportInbox.ts split mais profundo não feito (562 linhas, 8 handlers) | D02 postergado | Separar por domínio: import/, drafts/, corrections/ — só se houver nova refatoração |
| D11 | ~~Routes produzidas (drafts.ts, settings.ts) têm `isAdmin` duplicado~~ | ~~Herdado do padrão TE1-TE4~~ | **RESOLVIDO:** 6 route files migrados para `requireAdmin`. 3 test mocks atualizados. `isAdmin` removido de `inbox/utils.ts`. 42+ linhas eliminadas. Build 17/17 ✅, tests backend 223/223 ✅, frontend 163/163 ✅. |
| D12 | TE9 target <200 linhas inatingível sem extrair discovery/sources/fetch/messages/parse-batch | Escopo TE5-TE7 não cobre | Coberto por D09 |
| D13 | `routes/discord/utils.ts` com `loadSystemsForParser` (DB query) misturado a utilidades de rota — candidato a mover para `discord/shared.ts` | Extração TE6 | Mover para `discord/shared.ts` se houver nova refatoração no parser |
| D14 | ~~DEB-017 — Merge parcial de normalized_payload no PATCH de drafts~~ | REV-016 | **RESOLVIDO:** merge shallow implementado em `drafts.ts:104-112`. Frontend nunca envia payload parcial, mas correção preventiva evita perda de dados em chamadas manuais. |
| D15 | ~~CC 56 do POST /import-text (adminImportInbox.ts:18-157)~~ → **RESOLVIDO 2026-06-23** | REV-032 | Extraídos 2 helpers: `calcMissingFields()` (5-field check duplicado eliminado) + `createImportMessage()` (INSERT block extraído). Handler 140→105 linhas. CC ≤7. Tests 223/223 ✅. |
| D16 | `parseDiscordMessage()` compartilhada — messageParse.ts e drafts.ts têm 20 linhas idênticas no mapeamento message→parseDiscordAnnouncement | REV-036 | Extrair função `parseDiscordMessage(message, systems)` em utils.ts/shared.ts que encapsule mapeamento + normalizeDiscordTableDraft. Elimina duplicata de REV-015 (cópia em vez de extração). |
| D17 | `validateDraftStatusTransition()` compartilhada — drafts.ts PATCH /:id e adminImportInbox.ts PATCH /drafts/:id têm bloco `normalizeDraftPayload`+`assertDraftReadyTransition` duplicado (12 linhas) + estrutura de handler (26 linhas) | REV-037 | Extrair função `validateDraftStatusTransition(parsedData, currentDraft)` em shared.ts. Padronizar formato de erro 422 (details.missing_fields vs missing_fields no root). |
| D18 | Schemas de PATCH de draft duplicados — `drafts.ts` (updateDraftSchema, local) e `inbox/utils.ts` (patchDraftSchema, exportado) têm 16 linhas quase idênticas | REV-038 | Unificar schemas de PATCH de draft em local único (ex.: `draftSchemas.ts`). Remover definição local de `drafts.ts`, usar o compartilhado. |

## Pendências de governança

| # | Débito | Motivo |
|---|--------|--------|
| G01 | Extração para packages/ui requer SDD Completo separado | Spec 049 prevê mas não executa |
| G02 | Schemas Zod duplicados candidatos a packages/content | Igual, requer SDD separado |
