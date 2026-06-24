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
| D09 | ~~adminDiscordSync.ts: discovery/sources/fetch/messages/parse-batch não extraídos~~ | TE9: 690 linhas (12 handlers) | **RESOLVIDO (2026-06-24):** adminDiscordSync.ts reduzido de 690→29 linhas. 5 submódulos extraídos: discovery.ts, sources.ts, fetch.ts, messages.ts, parse-batch.ts. Helpers movidos para utils.ts. Build 17/17, lint 15/15, testes 223/223. |
| D10 | adminImportInbox.ts split mais profundo não feito (562 linhas, 8 handlers) | D02 postergado | Separar por domínio: import/, drafts/, corrections/ — só se houver nova refatoração |
| D11 | ~~Routes produzidas (drafts.ts, settings.ts) têm `isAdmin` duplicado~~ | ~~Herdado do padrão TE1-TE4~~ | **RESOLVIDO:** 6 route files migrados para `requireAdmin`. 3 test mocks atualizados. `isAdmin` removido de `inbox/utils.ts`. 42+ linhas eliminadas. Build 17/17 ✅, tests backend 223/223 ✅, frontend 163/163 ✅. |
| D12 | TE9 target <200 linhas inatingível sem extrair discovery/sources/fetch/messages/parse-batch | Escopo TE5-TE7 não cobre | Coberto por D09 |
| D13 | ~~`routes/discord/utils.ts` com `loadSystemsForParser` misturado~~ | Extração TE6 | **RESOLVIDO (2026-06-24):** função movida para `discord/shared.ts`. 3 consumers atualizados. |
| D14 | ~~DEB-017 — Merge parcial de normalized_payload no PATCH de drafts~~ | REV-016 | **RESOLVIDO:** merge shallow implementado em `drafts.ts:104-112`. Frontend nunca envia payload parcial, mas correção preventiva evita perda de dados em chamadas manuais. |
| D15 | ~~CC 56 do POST /import-text (adminImportInbox.ts:18-157)~~ → **RESOLVIDO 2026-06-23** | REV-032 | Extraídos 2 helpers: `calcMissingFields()` (5-field check duplicado eliminado) + `createImportMessage()` (INSERT block extraído). Handler 140→105 linhas. CC ≤7. Tests 223/223 ✅. |
| D16 | ~~parseDiscordMessage() compartilhada — 20 linhas duplicadas entre messageParse.ts e drafts.ts~~ | REV-036 | **RESOLVIDO:** `parseDiscordMessage()` extraída em `utils.ts`. 20 linhas eliminadas. |
| D17 | ~~validateDraftStatusTransition() — 12 linhas duplicadas entre drafts.ts e adminImportInbox.ts + formato erro 422 divergente~~ | REV-037 | **RESOLVIDO:** `validateDraftStatusTransition()` extraída em `utils.ts`. Formato erro 422 padronizado (`details.missing_fields`). |
| D18 | ~~Schemas de PATCH de draft duplicados — drafts.ts updateDraftSchema vs inbox/utils.ts patchDraftSchema (16 linhas)~~ | REV-038 | **RESOLVIDO:** drafts.ts agora importa `patchDraftSchema` de inbox/utils.ts. Definição local removida. |

## Pendências de governança

| # | Débito | Motivo |
|---|--------|--------|
| G01 | Extração para packages/ui requer SDD Completo separado | Spec 049 prevê mas não executa |
| G02 | Schemas Zod duplicados candidatos a packages/content | Igual, requer SDD separado |
