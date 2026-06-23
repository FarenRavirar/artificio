# Proposta de Reorganização — /gestao

> Baseada em: inventário (Fase A), auditorias (Fase B), duplicação (Fase C)

## 1. Nova Árvore de Diretórios — Backend

### Atual
```
routes/
  adminDiscordSync.ts        ← 1421 linhas (26 endpoints)
  adminImportInbox.ts        ← 639 linhas (8 endpoints)
  adminHydration.ts          ← 489 linhas (1 endpoint)
  adminTables.ts             ← 137 linhas (3 endpoints)
  adminProfile.ts            ← 84 linhas (3 endpoints)
  adminSettingSuggestions.ts ← 173 linhas (4 endpoints)
discord/
  (service layer — ok, manter)
```

### Proposto
```
routes/admin/
  index.ts                   ← monta todos sub-routers
  discord/
    settings.ts              ← GET/PUT/DELETE /settings (~100 linhas)
    discovery.ts             ← GET /discovery/guilds, /channels (~80 linhas)
    sources.ts               ← CRUD /sources (~150 linhas)
    fetch.ts                 ← POST /fetch, /reingest-force (~150 linhas)
    messages.ts              ← GET/PATCH /messages, /parse, /diagnose (~200 linhas)
    drafts.ts                ← CRUD drafts (COMPARTILHADO com import-inbox) (~250 linhas)
    sync.ts                  ← POST /sync, /sync-ready (~100 linhas)
    import-json.ts           ← POST /import-json/preview, /import-json (~100 linhas)
    image-uploads.ts         ← GET /image-uploads/summary, /refresh-image (~80 linhas)
  import-inbox/
    index.ts                 ← router principal
    import-text.ts           ← POST /import-text (~80 linhas)
    drafts.ts                ← monta mesmo sub-router de discord/drafts.ts (~20 linhas)
    corrections.ts           ← POST /correction (~100 linhas)
    metrics.ts               ← GET /metrics (~50 linhas)
  hydration/
    sync.ts                  ← POST /sync/hydrate (~489 linhas → mantém)
  tables/
    index.ts                 ← DELETE/PUT /tables, POST /auto-archive (~137 linhas)
  profiles/
    index.ts                 ← GET/PATCH /users (~84 linhas)
  suggestions/
    index.ts                 ← handler genérico parametrizado por tipo (~200 linhas)
    scenarios.ts             ← specific overrides (~50 linhas)
    systems.ts               ← specific overrides (~50 linhas)
```

### Ganhos esperados
- Nenhum arquivo >300 linhas (vs 1421 hoje)
- Elimina duplicação draft entre discord-sync e import-inbox
- Elimina duplicação scenarioSuggestions ↔ systemSuggestions
- Separação clara de responsabilidades por domínio

## 2. Nova Árvore de Diretórios — Frontend

### Atual
```
features/discord-sync/
  components/
    DiscordSyncPanel.tsx          ← 543 linhas
    DiscordJsonImportPanel.tsx    ← 353 linhas
    DiscordSourceList.tsx         ← 415 linhas
    DiscordDraftReviewTable.tsx   ← 208 linhas
    DraftEditorTab.tsx            ← 187 linhas
    DiscordSettingsPanel.tsx      ← 185 linhas
    DiscordDraftPreview.tsx       ← 146 linhas
  api/
    discordSyncApi.ts             ← 279 linhas (26 métodos)
  hooks/
    useDraftForm.ts               ← 332 linhas
  utils/
    draftFormUtils.ts             ← 235 linhas
  types.ts                        ← 174 linhas
  constants.ts
pages/
  GestaoPage.tsx                  ← 859 linhas
```

### Proposto
```
features/gestao/
  index.tsx                       ← re-exporta DiscordSyncPanel + outros
  discord-sync/
    panels/
      DiscordSyncPanel.tsx         ← apenas tabs + layout (~150 linhas)
    tabs/
      SyncTab.tsx                  ← sync ready + actions (~100 linhas)
      SourcesTab.tsx               ← migrado de DiscordSourceList (~300 linhas)
      MessagesTab.tsx              ← novo (~150 linhas)
      DraftsTab.tsx                ← migrado de DiscordDraftReviewTable (~150 linhas)
      ImportJsonTab.tsx            ← migrado de DiscordJsonImportPanel (~250 linhas)
      SettingsTab.tsx              ← migrado de DiscordSettingsPanel (~120 linhas)
      UploadsTab.tsx               ← novo (~80 linhas)
    components/
      FileDropzone.tsx             ← extraído de DiscordJsonImportPanel (~80 linhas)
      ImportResultGrid.tsx         ← extraído de DiscordJsonImportPanel (~100 linhas)
      JsonPreviewCard.tsx          ← extraído de DiscordJsonImportPanel (~60 linhas)
      DraftPreview.tsx             ← migrado de DiscordDraftPreview (~120 linhas)
      DraftEditorTab.tsx           ← mantém (~180 linhas)
      ConfirmDialog.tsx            ← NOVO — componente de confirmação unificado (~60 linhas)
      GestaoStateWrapper.tsx       ← NOVO — loading/error/empty states padronizados (~80 linhas)
      ResultGrid.tsx               ← NOVO — grid genérico de resultados (~100 linhas)
    api/
      discordSyncApi.ts            ← mantém estrutura mas separa em domain files (~200 linhas)
    hooks/
      useDiscordSync.ts            ← extraído de DiscordSyncPanel (~100 linhas)
      useJsonImport.ts             ← extraído de DiscordJsonImportPanel (~120 linhas)
      useDraftForm.ts              ← mantém (~300 linhas)
    utils/
      draftFormUtils.ts            ← mantém (~200 linhas)
      importUtils.ts               ← NOVO — parse, validation helpers (~80 linhas)
    types.ts                       ← mantém (~150 linhas)
    constants.ts                   ← mantém
  suggestions/
    SystemSuggestionList.tsx       ← extraído de GestaoPage (~200 linhas)
    ScenarioSuggestionList.tsx     ← extraído de GestaoPage (~200 linhas)
  tables/
    TableManagementList.tsx        ← extraído de GestaoPage (~150 linhas)
pages/
  GestaoPage.tsx                   ← apenas layout + imports (~150 linhas, vs 859)
```

### Ganhos esperados
- Nenhum arquivo >300 linhas (vs 859 hoje)
- Componentes reusáveis (ResultGrid, GestaoStateWrapper, ConfirmDialog)
- Separação clara concerns por domínio
- Padronização de loading/error/empty states
- Candidatos claros para extração futura para packages/ui

## 3. Contratos entre módulos

### Rotas REST — NENHUMA MUDA

A reorganização do backend é puramente estrutural. Todos os endpoints mantêm path, método, request/response idênticos. O router principal (`routes/admin/index.ts`) monta os sub-routers nos mesmos prefixos.

### API Frontend — NENHUMA MUDA

`discordSyncApi.ts` pode ser fatorado em domain files internos, mas o objeto exportado (`discordSyncApi`) mantém mesmos 26 métodos com mesmas assinaturas.

### Componentes React — PROPS MUDAM (para melhor)

| Componente | Props atuais | Props nova |
|-----------|-------------|------------|
| DiscordSyncPanel | nenhuma | `onError?: (err) => void` |
| ImportResultGrid | (inline no panel) | `result: ImportResult; failed: number` |
| FileDropzone | (inline no panel) | `onFile: (file: File) => void; accept: string; maxSize: number` |
| ResultGrid | (não existe) | `columns: Column[]; rows: Row[]; failedKey?: string` |
| GestaoStateWrapper | (não existe) | `loading: boolean; error?: string; empty: boolean; emptyMessage: string; children` |
| ConfirmDialog | (não existe) | `open: boolean; title: string; message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; variant: 'danger'|'info'` |

## 4. Componentes candidatos a extração para packages/ui (proposta)

| Componente | Motivo | Consumidores potenciais |
|-----------|--------|------------------------|
| GestaoStateWrapper | Loading/error/empty é padrão em todo admin | Todos apps admin |
| ResultGrid | Grid de dados com colunas configuráveis | Glossario, site-admin |
| ConfirmDialog | Diálogo de confirmação destrutiva com variantes | Todos apps |
| FileDropzone | Upload de arquivo com drag-and-drop | Downloads, site |

**⚠️ Extração para packages/ui requer SDD Completo separado com aprovação explícita.**

## 5. Schemas Zod candidatos a centralização em packages/content

| Schema | Local atual | Motivo |
|--------|------------|--------|
| `updateDraftSchema` / `patchDraftSchema` | adminDiscordSync.ts + adminImportInbox.ts | Duplicado entre routers |
| `discordChatExporterExportSchema` | chatExporterAdapter.ts | Já compartilhado, verificar se move |
| Schemas de sugestão (system, scenario) | scenarioSuggestions.ts + systemSuggestions.ts | Duplicado |

## 6. Priorização e Esforço

| Prioridade | Task | Esforço | Depende de | Issues resolvidas |
|-----------|------|---------|-----------|-------------------|
| 🔴 P0 | Extrair draft CRUD compartilhado (back-end) | M (4h) | — | Duplicação P0 + 2 schemas |
| 🔴 P0 | Extrair GestaoStateWrapper + usar em todas tabs | P (2h) | — | P2-5, P2-6 |
| 🔴 P0 | Criar ConfirmDialog + substituir window.confirm() | P (2h) | — | P1-5, Nielsen H4 |
| 🟡 P1 | Extrair adminDiscordSync em módulos de domínio | G (12h) | P0 drafts | TA1-TA6 |
| 🟡 P1 | Extrair scenarioSuggestions/systemSuggestions genérico | M (4h) | — | Duplicação P1 |
| 🟡 P1 | Adicionar focus visible + aria-labels + role modal | P (2h) | — | P1-1, P1-2, P1-3, P1-8 |
| 🟡 P1 | Separar GestaoPage em sub-páginas | M (6h) | — | TA2 |
| 🟢 P2 | Substituir componentes por packages/ui primitives | G (12h) | P0 GestaoStateWrapper | P1-7 |
| 🟢 P2 | Unificar estilos de tabs | M (4h) | — | P2-1 |
| 🟢 P2 | Extrair hooks useDiscordSync + useJsonImport | P (2h) | — | TA5 |
| 🔵 P3 | Aumentar font-size para 14px | P (1h) | — | P2-2 |
| 🔵 P3 | Adicionar ordenação na tabela de drafts | M (4h) | — | P2-8 |
| 🔵 P3 | Extrair componentes reusáveis (ResultGrid, FileDropzone) | M (4h) | — | TE12-TE14 |

**Esforço total estimado:** ~55h (P0=8h, P1=26h, P2=18h, P3=9h)

## 7. Risco e Mitigação

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Quebrar rotas REST durante split | Baixa | Testes existentes + smoke manual |
| Perder feedback visual durante refatoração UI | Média | Manter snapshot visual antes/depois |
| Extração para packages/ui quebrar consumers | Média (só se executada) | SDD Completo separado + smoke todos consumers |
| Regressão de acessibilidade | Baixa | Re-auditar P0-P1 pós-refatoração (TF7) |
