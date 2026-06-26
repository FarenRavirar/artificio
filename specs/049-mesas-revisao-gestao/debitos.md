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
| D06 | 8 issues P1 das auditorias não tratadas | Fase B | Issues P1-1 a P1-8 documentadas em `auditorias-consolidadas.md`. Escopo: modal a11y (P1-1), labels checkbox (P1-2), focus indicators (P1-3), dirty state guard (P1-4), window.confirm unificação (P1-5), navegação automática (P1-6), design system (P1-7), erro para leitores de tela (P1-8). |
| D07 | ~~adminTablesAutoArchive.test.ts nome engana — testa auto-archive em adminTables.ts, não existe source separado~~ | Legado | **RESOLVIDO (2026-06-24):** renomeado para `adminTables.autoArchive.test.ts` via `git mv`. |
| D08 | ~~DiscordSyncPanel.tsx >500 linhas (543)~~ | ~~Fase E parcial~~ | **RESOLVIDO:** reduzido para 308 linhas via TE10 + TE15. |
| D09 | ~~adminDiscordSync.ts: discovery/sources/fetch/messages/parse-batch não extraídos~~ | TE9: 690 linhas (12 handlers) | **RESOLVIDO (2026-06-24):** adminDiscordSync.ts reduzido de 690→29 linhas. 5 submódulos extraídos: discovery.ts, sources.ts, fetch.ts, messages.ts, parse-batch.ts. Helpers movidos para utils.ts. Build 17/17, lint 15/15, testes 223/223. |
| D10 | ~~adminImportInbox.ts split mais profundo não feito (562 linhas, 8 handlers)~~ | D02 postergado | **RESOLVIDO (2026-06-24):** adminImportInbox.ts reduzido de 573→29 linhas. 4 submódulos extraídos: `inbox/import.ts` (POST /import-text), `inbox/drafts.ts` (5 handlers), `inbox/corrections.ts` (POST /drafts/:id/correction), `inbox/metrics.ts` (GET /metrics). Build 17/17, lint 15/15, testes 223/223. |
| D11 | ~~Routes produzidas (drafts.ts, settings.ts) têm `isAdmin` duplicado~~ | ~~Herdado do padrão TE1-TE4~~ | **RESOLVIDO:** 6 route files migrados para `requireAdmin`. 3 test mocks atualizados. `isAdmin` removido de `inbox/utils.ts`. 42+ linhas eliminadas. Build 17/17 ✅, tests backend 223/223 ✅, frontend 163/163 ✅. |
| D12 | TE9 target <200 linhas inatingível sem extrair discovery/sources/fetch/messages/parse-batch | Escopo TE5-TE7 não cobre | Coberto por D09 |
| D13 | ~~`routes/discord/utils.ts` com `loadSystemsForParser` misturado~~ | Extração TE6 | **RESOLVIDO (2026-06-24):** função movida para `discord/shared.ts`. 3 consumers atualizados. |
| D14 | ~~DEB-017 — Merge parcial de normalized_payload no PATCH de drafts~~ | REV-016 | **RESOLVIDO:** merge shallow implementado em `drafts.ts:104-112`. Frontend nunca envia payload parcial, mas correção preventiva evita perda de dados em chamadas manuais. |
| D15 | ~~CC 56 do POST /import-text (adminImportInbox.ts:18-157)~~ → **RESOLVIDO 2026-06-23** | REV-032 | Extraídos 2 helpers: `calcMissingFields()` (5-field check duplicado eliminado) + `createImportMessage()` (INSERT block extraído). Handler 140→105 linhas. CC ≤7. Tests 223/223 ✅. |
| D16 | ~~parseDiscordMessage() compartilhada — 20 linhas duplicadas entre messageParse.ts e drafts.ts~~ | REV-036 | **RESOLVIDO:** `parseDiscordMessage()` extraída em `utils.ts`. 20 linhas eliminadas. |
| D17 | ~~validateDraftStatusTransition() — 12 linhas duplicadas entre drafts.ts e adminImportInbox.ts + formato erro 422 divergente~~ | REV-037 | **RESOLVIDO:** `validateDraftStatusTransition()` extraída em `utils.ts`. Formato erro 422 padronizado (`details.missing_fields`). |
| D18 | ~~Schemas de PATCH de draft duplicados — drafts.ts updateDraftSchema vs inbox/utils.ts patchDraftSchema (16 linhas)~~ | REV-038 | **RESOLVIDO:** drafts.ts agora importa `patchDraftSchema` de inbox/utils.ts. Definição local removida. |
| D19 | **401 Unauthorized em `POST /api/v1/gm/tables` e `GET /api/v1/notifications` no painel do mesas** — raw `fetch` sem refresh de token JWT expirado (15min). `useCreateTableForm.ts` e `NotificationBell.tsx` usavam `fetch` com `credentials:'include'` mas sem tentar `refreshSession()` no 401. `authenticatedFetch.ts` (com refresh-on-401) já existia mas era usado em só 2 lugares. | Demanda mantenedor 2026-06-24 (`mesas.artificiorpg.com/painel`) | **RESOLVIDO:** `useCreateTableForm.ts:7,229-231` → `authPost`/`authPut`; `NotificationBell.tsx:5,62,93,104` → `authGet`/`authPatch`. Lint 15/15 ✅, build 17/17 ✅. Pendente commit. |
| D20 | (...) | **RESOLVIDO (2026-06-24):** (...) | — |

| D21 | **Erros avulsos pós-refatoração D20.** Auditoria de 38 arquivos modificados no diff: 1 erro de lint corrigido, 2 avisos catalogados. | Descoberto durante auditoria pré-commit D20 (2026-06-24) | **Catálogo D21:** |
| | `apps/mesas/frontend/src/services/apiClient.ts:233` | ✅ Corrigido | `interface FetchOptions extends RequestInit {}` → `type FetchOptions = RequestInit`. Lint 15/15 ✅. |
| | Testes frontend (pre-existing) | 📋 Catalogado | `An update to X inside a test was not wrapped in act(...)` — `DiscordSourceList.test.tsx`, `DiscordSyncPanel.test.tsx`. Pre-existing, testes passam. Não introduzido por D20. Corrigir em spec separada (refatoração de testes). |
| | GestaoPage test ERR_INVALID_URL (pre-existing) | 📋 Catalogado | `ERR_INVALID_URL` — vitest.config.ts zera VITE_API_URL intencionalmente (linha 19). URL relativa `/api/v1/...` já falhava antes do D20 com raw `fetch`. Teste passa (catch interno). Corrigir em spec separada. |
| | `is declared but its value is never read.` | ✅ Nenhum | Zero variáveis não lidas nos 38 arquivos modificados. |
| | **🧮 Total: 1 erro corrigido ✅ + 2 avisos catalogados 📋 + 0 pendências.** | | |
| D22 | Blocos de upload de avatar duplicados em ProfileEditPage.tsx (25 linhas) — profile avatar e GM avatar têm blocos `authPost('/api/v1/upload')` + `authPost('/api/v1/profile/me/google-picture')` quase idênticos. | REV-072 (SonarQube duplication) | Extrair `uploadAvatar(file)` e `importGoogleAvatar()` como funções compartilhadas no mesmo arquivo ou em `utils/upload.ts`. |
| D23 | Bloco `parseDiscordAnnouncement` com 16 campos duplicado entre `parse-batch.ts` e `fetch.ts` (~19 linhas cada). Mesmo padrão do D16. | REV-073/076 (SonarQube duplication) | **RESOLVIDO (2026-06-24):** Ambos os arquivos substituídos pela chamada `parseDiscordMessage(message, systems)` — função criada na REV-036/D16 em `discord/utils.ts`. 19 linhas inline removidas de cada. Testes: 223/223 ✅. |
| D24 | Boilerplate estrutural de PATCH handler duplicado entre `inbox/drafts.ts` e `discord/drafts.ts` (~35 linhas). | REV-074 (SonarQube duplication) | **RESOLVIDO (2026-06-24):** Extraída função `handlePatchDraft(req, config)` em `discord/utils.ts` que encapsula schema parse, fetch, 404, validação de transição, update, return e catch. Ambos os handlers (inbox e discord) agora delegam à função compartilhada com callbacks para lógica específica de cada rota. Testes: 223/223 ✅. |

## Pendências de governança

| # | Débito | Motivo |
|---|--------|--------|
| G01 | Extração para packages/ui requer SDD Completo separado | Spec 049 prevê mas não executa → **ABSORVIDO pela spec 051 (frente F5), 2026-06-25.** Componentes `GestaoStateWrapper`/`ResultGrid`/`ConfirmDialog`/`FileDropzone`. |
| G02 | Schemas Zod duplicados candidatos a packages/content | Igual, requer SDD separado → **ABSORVIDO pela spec 051 (frente F6), 2026-06-25.** Auditar cross-app vs domínio mesas antes de mover. |
