# Inventário — Aba /gestao do mesas

> Gerado via codebase-memory-mcp (search_graph, trace_path, get_architecture, query_graph) + Serena MCP (get_symbols_overview, get_diagnostics_for_file, find_referencing_symbols)

## 1. Rotas REST de /gestao

### adminDiscordSync.ts (1421 linhas) — 26 endpoints

Prefix: `/api/v1/admin/discord-sync` (montado via router)
authMiddleware em todos.

| Método | Path | Handler | Linha |
|--------|------|---------|-------|
| GET | /settings | router.get | 393 |
| PUT | /settings/bot-token | router.put | 439 |
| DELETE | /settings/bot-token | router.delete | 487 |
| GET | /discovery/guilds | router.get | 504 |
| GET | /discovery/guilds/:guildId/channels | router.get | 515 |
| GET | /sources | router.get | 533 |
| POST | /sources | router.post | 549 |
| PATCH | /sources/:id | router.patch | 580 |
| DELETE | /sources/:id | router.delete | 606 |
| POST | /fetch | router.post | 627 |
| POST | /sources/:sourceId/reingest-force | router.post | 686 |
| POST | /messages/parse-batch | router.post | 731 |
| GET | /messages | router.get | 834 |
| PATCH | /messages/:id | router.patch | 872 |
| POST | /messages/:id/diagnose-content | router.post | 895 |
| GET | /drafts | router.get | 940 |
| GET | /drafts/:id | router.get | 967 |
| GET | /image-uploads/summary | router.get | 984 |
| POST | /drafts/:id/refresh-image | router.post | 1030 |
| PATCH | /drafts/:id | router.patch | 1046 |
| POST | /messages/:id/parse | router.post | 1094 |
| POST | /drafts/:id/reparse | router.post | 1196 |
| POST | /drafts/:id/sync | router.post | 1269 |
| POST | /sync-ready | router.post | 1302 |
| POST | /import-json/preview | router.post | 1354 |
| POST | /import-json | router.post | 1390 |

### adminImportInbox.ts (639 linhas) — 8 endpoints

| Método | Path | Handler | Linha |
|--------|------|---------|-------|
| POST | /import-text | router.post | 71 |
| GET | /drafts | router.get | 215 |
| POST | /drafts/:id/sync | router.post | 268 |
| GET | /drafts/:id | router.get | 299 |
| PATCH | /drafts/:id | router.patch | 371 |
| POST | /drafts/:id/reparse | router.post | 434 |
| POST | /drafts/:id/correction | router.post | 513 |
| GET | /metrics | router.get | 601 |

### adminHydration.ts (489 linhas) — 1 endpoint

| Método | Path | Handler | Linha |
|--------|------|---------|-------|
| POST | /sync/hydrate | router.post | 36 |

### adminTables.ts (137 linhas) — 3 endpoints

| Método | Path | Handler | Linha |
|--------|------|---------|-------|
| DELETE | /tables/:id | router.delete | — |
| POST | /tables/auto-archive | router.post | — |
| PUT | /tables/:id | router.put | — |

### adminProfile.ts (84 linhas) — 3 endpoints

| Método | Path | Handler | Linha |
|--------|------|---------|-------|
| GET | /users | router.get | — |
| GET | /users/:id | router.get | — |
| PATCH | /users/:id/covil | router.patch | — |

### adminSettingSuggestions.ts (173 linhas) — 4 endpoints

| Método | Path | Handler | Linha |
|--------|------|---------|-------|
| GET | / | router.get | — |
| POST | / | router.post | — |
| PUT | /:id | router.put | — |
| DELETE | /:id | router.delete | — |

### Total de rotas admin: ~45 endpoints

## 2. Componentes React da aba /gestao

### Página principal
- **GestaoPage.tsx** (859 linhas) — página monolítica que gerencia:
  - Sugestões de sistemas (CRUD + aprovação/rejeição)
  - Sugestões de cenários (CRUD + aprovação/rejeição)
  - Mesas (listagem + deleção + alteração de status)
  - Importa e renderiza `<DiscordSyncPanel />`

### Components de Discord Sync
- **DiscordSyncPanel.tsx** (543 linhas) — container principal de sync:
  - Abas: Sync, Sources, Messages, Drafts, Import JSON, Settings, Uploads
  - Estado: `MessageWindowOption[]`, `PanelTab`, loading/error states
  - `MESSAGE_STATUS_COLORS`, `MESSAGE_STATUS_LABELS`, `REVIEW_ACTIONS`
- **DiscordJsonImportPanel.tsx** (353 linhas) — import JSON:
  - Preview automático (debounce 400ms), grid de resultado 5 colunas
  - Dropzone + file select nativo
  - `ImportResult`, `PreviewResult` interfaces
- **DiscordSourceList.tsx** (415 linhas) — gerenciamento de fontes:
  - Lista sources, descobre guilds/channels, cria/edita/deleta fontes
  - `buildFetchWindow`, `getChannelKindLabel`, `getChannelPrefix`
- **DiscordDraftReviewTable.tsx** (208 linhas) — tabela de drafts:
  - Filtros por status, sync ready
  - `DRAFT_STATUS_COLORS`, `DRAFT_STATUS_LABELS`
- **DraftEditorTab.tsx** (187 linhas) — editor de draft
- **DiscordSettingsPanel.tsx** (185 linhas) — configurações de bot token
- **DiscordDraftPreview.tsx** (146 linhas) — preview modal de draft

### Hooks e utils
- **useDraftForm.ts** (332 linhas) — hook de formulário de draft com reducer
- **discordSyncApi.ts** (279 linhas) — API layer: `discordSyncApi` object com 26 métodos
- **draftFormUtils.ts** (235 linhas) — utilitários de formulário
- **types.ts** (174 linhas) — tipos compartilhados
- **constants.ts** — constantes

## 3. Fluxos mapeados (codebase-memory-mcp trace_path)

### Fluxo de Import JSON
```
GestaoPage → DiscordSyncPanel (import da aba Import JSON)
  → DiscordJsonImportPanel
    → discordSyncApi.previewJson(file)
      → POST /import-json/preview
        → extractJsonPayload() (adminDiscordSync.ts)
          → validate DiscordChatExporterExport (Zod schema)
    → discordSyncApi.importJson(file)
      → POST /import-json
        → importDiscordChatExporterJson (chatExporterImportService.ts)
          → parseDiscordChatExporterJson (chatExporterAdapter.ts)
          → adaptMessageToImportRaw (chatExporterAdapter.ts)
          → ensureDiscordImportSource (chatExporterImportService.ts)
          → getContentHash (shared.ts)
          → persistMessages via SQL
```

### Fluxo de Sync Discord
```
GestaoPage → DiscordSyncPanel
  → DiscordSourceList
    → discordSyncApi.discoverGuilds() → GET /discovery/guilds
    → discordSyncApi.discoverChannels() → GET /discovery/guilds/:id/channels
    → discordSyncApi.createSource() → POST /sources
    → discordSyncApi.fetchMessages() → POST /fetch
      → ingestMessages (ingestMessages.ts)
        → fetchChannelMessages (ingestMessages.ts)
        → persistMessages (ingestMessages.ts)
```

### Fluxo de Drafts
```
adminImportInbox.ts: GET /drafts, PATCH /drafts/:id, POST /drafts/:id/sync
adminDiscordSync.ts: GET /drafts, PATCH /drafts/:id, POST /drafts/:id/sync, POST /drafts/:id/reparse

Ambos chamam:
  → syncDiscordDraftToTable (syncDiscordDraftToTable.ts)
  → normalizeDraftPayload (syncHelpers.ts)
  → uploadCoverForDraft (syncHelpers.ts)
```

## 4. Top arquivos por linha (gestao-related)

| # | Arquivo | Linhas | Candidato a split |
|---|---------|--------|-------------------|
| 1 | adminDiscordSync.ts | 1421 | ✅ Sim — 26 endpoints num arquivo |
| 2 | GestaoPage.tsx | 859 | ✅ Sim — gerencia sistemas, cenários, mesas + importa sync |
| 3 | adminImportInbox.ts | 639 | ✅ Sim — 8 endpoints, duplicado parcial com discord-sync |
| 4 | DiscordSyncPanel.tsx | 543 | ✅ Sim — 7+ abas num componente |
| 5 | syncHelpers.ts | 508 | ✅ Sim — várias responsabilidades |
| 6 | parseDiscordAnnouncement.ts | 500 | ⚠️ Médio — parser, pode ficar |
| 7 | adminHydration.ts | 489 | ⚠️ Médio — 1 handler só |
| 8 | ingestMessages.ts | 440 | ⚠️ Médio — ingestão lógica central |
| 9 | DiscordSourceList.tsx | 415 | ✅ Sim — descobrir guilds + CRUD sources |
| 10 | DiscordJsonImportPanel.tsx | 353 | ⚠️ Médio — pode ter sub-componentes |
| 11 | useDraftForm.ts | 332 | ⚠️ Médio — hook grande com reducer |
| 12 | discordSyncApi.ts | 279 | ⚠️ Médio — API layer, 26 métodos |

## 5. Diagnóstico LSP (Serena get_diagnostics_for_file)

| Arquivo | Diagnostics | Severidade |
|---------|-------------|------------|
| adminDiscordSync.ts | 10 | Hint — Zod API deprecada (`.flatten()` e loose schemas) |
| adminImportInbox.ts | 0 | — |
| adminHydration.ts | 0 | — |
| adminTables.ts | 0 | — |
| DiscordSyncPanel.tsx | 0 | — |
| DiscordJsonImportPanel.tsx | 0 | — |
| DiscordSourceList.tsx | 0 | — |
| DiscordDraftReviewTable.tsx | 0 | — |
| discordSyncApi.ts | 0 | — |
| chatExporterImportService.ts | 0 | — |
| ingestMessages.ts | 0 | — |
| settingsCrypto.ts | 0 | — |
| syncHelpers.ts | 0 | — |
| syncDiscordDraftToTable.ts | 0 | — |
| GestaoPage.tsx | 0 | — |

## 6. Duplicações identificadas (mapeamento preliminar)

1. **Draft CRUD duplicado** — `adminDiscordSync.ts` e `adminImportInbox.ts` têm handlers quase idênticos para drafts (GET, PATCH, POST sync, POST reparse)
2. **Schemas Zod de draft** — `updateDraftSchema`/`updateDraftPayloadSchema`/`updateDraftTableSchema` em adminDiscordSync.ts vs `patchDraftSchema`/`patchDraftTableSchema`/`patchNormalizedPayloadSchema` em adminImportInbox.ts
3. **Normalização de payload** — `normalizeDiscordTableDraft.ts` e `syncHelpers.ts` têm lógica de normalização sobreposta
4. **Loading/Error states** — cada componente implementa seu próprio loading, error e empty state sem padronização

## 7. Top funções por complexidade ciclomática (gestao-related)

### Backend
| Função | Complexidade | Arquivo | Linhas |
|--------|-------------|---------|--------|
| syncDiscordDraftToTable | 14 | `syncDiscordDraftToTable.ts` | 138 |
| validateDraftForSync | 10 | `syncDiscordDraftToTable.ts` | 17 |
| parseDiscordAnnouncement | 10 | `parseDiscordAnnouncement.ts` | 105 |
| findSystemMatch | 10 | `parseDiscordAnnouncement.ts` | 47 |
| listForumThreads | 9 | `ingestMessages.ts` | 45 |

Nenhuma função backend do gestao ultrapassa complexidade 15 (limiar de risco). As maiores estão em `syncDiscordDraftToTable.ts` (14) e `parseDiscordAnnouncement.ts` (10).

### Frontend
| Função | Complexidade | Arquivo | Linhas |
|--------|-------------|---------|--------|
| **GestaoPage** | **47** ⚠️ | `GestaoPage.tsx` | 711 |
| **DiscordSyncPanel** | **24** ⚠️ | `DiscordSyncPanel.tsx` | 472 |
| **DiscordSourceList** | **18** ⚠️ | `DiscordSourceList.tsx` | 364 |
| DiscordDraftReviewTable | 14 | `DiscordDraftReviewTable.tsx` | 161 |
| useDraftForm | 12 | `useDraftForm.ts` | 332 |

⚠️ 3 componentes frontend excedem complexidade 15. `GestaoPage` (47) é o mais crítico — caso claro de componente monolítico que gerencia sugestões, mesas, sync, tudo no mesmo escopo.

## 8. Resumo

| Métrica | Valor |
|---------|-------|
| Total arquivos backend gestao | ~15 |
| Total arquivos frontend gestao | ~12 |
| Total linhas backend gestao | ~4500 |
| Total linhas frontend gestao | ~3500 |
| Endpoints REST admin | ~45 |
| Componentes React | ~10 |
| Hooks customizados | ~4 |
| Diagnostics LSP ativos | 10 (Zod deprecado) |
