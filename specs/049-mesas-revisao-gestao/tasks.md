# Tasks — 049

> **Ferramentas obrigatórias por task** (especificadas no prefixo):
> - `[cm]` — codebase-memory-mcp
> - `[sr]` — Serena MCP
> - `[lsp]` — LSP (get_diagnostics_for_file)
> - `[sk]` — Skill
> - `[sh]` — Shell/bash
> - `[au]` — Sub-agente (explorer/general)

---

## Fase A — Mapeamento e Inventário (cm + sr + lsp) ✅

- [x] TA1 `[cm][sr]` — Listar todas as rotas REST de /gestao: `search_graph` por rotas + `serena_search_for_pattern` nos 3 admin routers → 45 endpoints catalogados em `inventario.md` §1
- [x] TA2 `[cm][sr]` — Listar todos os componentes React em /gestao: `serena_get_symbols_overview` em 12+ arquivos + `search_graph` → `inventario.md` §2
- [x] TA3 `[sr]` — Mapear fluxos: `trace_path` em extractJsonPayload, importDiscordChatExporterJson, DiscordSyncPanel + find_referencing_symbols → `inventario.md` §3
- [x] TA4 `[cm]` — Dependency graph: `get_architecture` (clusters/fan-out/boundaries) + `trace_path` mode=cross_service → `inventario.md` §4
- [x] TA5 `[sr][lsp]` — Top 5 linhas + diagnostics: `wc -l` + `serena_get_diagnostics_for_file` em todos → 10 diagnostics Zod deprecado em adminDiscordSync.ts
- [x] TA6 `[cm]` — Complexidade: `query_graph` com `f.file_path CONTAINS 'apps/mesas'` → 3 funções >15: GestaoPage(47), DiscordSyncPanel(24), DiscordSourceList(18). Query corrigida de `f.file` para `f.file_path`
- [x] TA7 `[au]` — Consolidar inventário em `specs/049-mesas-revisao-gestao/inventario.md`

## Fase B — Auditorias de Design/UX (sk + au) ✅

- [x] TB1 `[sk][au]` — Nielsen Heuristics Audit: 52 issues, nota 7/10. Relatório em `nielsen-heuristics-audit.md`
- [x] TB2 `[sk][au]` — UI Design Review: score 47/100 (F). Relatório em `ui-design-review.md`
- [x] TB3 `[sk][au]` — WCAG Accessibility Audit: 26 issues (5 Critical). Relatório em `wcag-accessibility-audit.md`
- [x] TB4 `[sk][au]` — UX Audit & Rethink: score 53/85 (C−). Relatório em `ux-audit-rethink.md`
- [x] TB5 — Compilar relatório consolidado das 4 auditorias em `auditorias-consolidadas.md` — matriz de sobreposição, 8 P1, 17 P2, 27 P3, recomendações priorizadas

## Fase C — Detecção de Código Duplicado (sk + sh) ✅

- [x] TC1 `[sh]` — jscpd disponível globalmente
- [x] TC2 `[sh]` — jscpd no backend: `--min-lines 5 --min-tokens 30 apps/mesas/backend/src/routes apps/mesas/backend/src/discord` (sem `--gitignore`, Windows compat)
- [x] TC3 `[sh]` — jscpd no frontend: mesmo padrão em `apps/mesas/frontend/src/features/discord-sync`
- [x] TC4 `[sh]` — Extrair métricas via Node.js: backend 310 clones, 2863 linhas, 17.3%; frontend 5 clones, 46 linhas, 1.5%
- [x] TC5 — Classificar grupos: destaque adminDiscordSync ↔ adminImportInbox (28 linhas, near-duplicate, Extract Module)
- [x] TC6 — Cruzar com auditorias: duplicação de drafts ligada à inconsistência UX (P2-16)
- [x] TC7 `[au]` — Consolidar em `specs/049-mesas-revisao-gestao/duplicacao.md`

## Fase D — Proposta de Reorganização (cm + sr + lsp + sh) ✅

- [x] TD1 `[cm]` — Analisar clusters atuais: `get_architecture` executado — 13 clusters identificados; mesas é core com fan-in 258
- [x] TD2 `[cm]` — Nós de alto acoplamento: query_graph sem dados de out_degree (grafo não indexa CALLS count como property); análise substituída por top arquivos por linha + complexidade
- [x] TD3 `[sr]` — Validar dependências suspeitas: `trace_path` executado nos handlers principais — contratos confirmados (nenhuma rota pública consome /gestao)
- [x] TD4 `[lsp]` — Baseline diagnostics: 10 deprecações Zod em adminDiscordSync.ts; zero nos demais
- [x] TD5 — Nova árvore backend: modular por domínio (discord/, import-inbox/, hydration/, tables/, profiles/, suggestions/)
- [x] TD6 — Nova árvore frontend: `features/gestao/discord-sync/tabs/` + componentes reusáveis
- [x] TD7 — Componentes candidatos a extração p/ packages/ui: GestaoStateWrapper, ResultGrid, ConfirmDialog, FileDropzone
- [x] TD8 — Schemas Zod candidatos a packages/content: schemas de draft (duplicados), schemas de sugestão
- [x] TD9 — Esforço estimado: 13 tasks priorizadas, ~55h total (P0=8h, P1=26h, P2=18h, P3=9h)
- [x] TD10 — Proposta documentada em `specs/049-mesas-revisao-gestao/proposta-reorganizacao.md`

## Fase E — Refatoração (execução com cm + sr + lsp + sh)

### Pré-requisito: cobertura de testes ✅

- [x] TE0a `[sr]` — Verificar cobertura de testes existente: backend tem 22 test files (183 tests), frontend 4 test files (19 tests)
- [x] TE0b `[sh]` — Coverage backend baseline: **16.7% statements, 66.51% branches, 50% functions**
- [x] TE0c `[sh]` — Coverage frontend baseline: **49.74% statements, 42.68% branches, 43.47% functions**
- [x] TE0d — Lacunas identificadas: backend 7 arquivos sem teste direto (adminTables, adminProfile, adminSettingSuggestions, chatExporterImportService, syncDiscordDraftToTable, discovery); frontend **TODOS os 11 arquivos** do discord-sync sem teste. Regra de não refatorar código não testado sem adicionar testes continua valendo — crítico para frontend.

### Backend — Extração de módulos

- [ ] TE1 `[cm][sr][lsp][sh]` — Extrair `extractJsonPayload()` e lógica de parse do DiscordChatExporter do `adminDiscordSync.ts` para `discord/chatExporterImportService.ts`
  - `serena_replace_symbol_body` + `serena_insert_after_symbol`
  - Validar: `serena_get_diagnostics_for_file` zero diagnostics, testes passando
- [ ] TE2 `[sr][lsp][sh]` — Separar handlers de preview (`POST /import-json/preview`) do `adminDiscordSync.ts` para novo arquivo `routes/discord/preview.ts`
  - `serena_insert_after_symbol` para criar novo módulo
  - Manter rota registrada no router original
- [ ] TE3 `[sr][lsp][sh]` — Separar handlers de import (`POST /import-json`) do `adminDiscordSync.ts` para `routes/discord/import.ts`
- [ ] TE4 `[sr][lsp][sh]` — Separar handlers de sync (`POST /sync`, `POST /sync/message`, etc.) para `routes/discord/sync.ts`
- [ ] TE5 `[sr][lsp][sh]` — Separar handlers de settings (`GET /settings`, `POST /settings`) para `routes/discord/settings.ts`
- [ ] TE6 `[sr][lsp][sh]` — Separar handlers de drafts (`GET /drafts`, `PATCH /drafts/:id`) para `routes/discord/drafts.ts`
- [ ] TE7 `[sr][lsp][sh]` — Separar handlers de upload (`POST /upload-image`) para `routes/discord/upload.ts`
- [ ] TE8 — Unificar schema de erro REST em todos os endpoints de /gestao (mesmo formato JSON para erro de validação, erro de servidor, erro de negócio)
- [ ] TE9 — Verificar que `adminDiscordSync.ts` original foi reduzido para <200 linhas (só router + imports)

### Frontend — Extração de componentes e hooks

- [ ] TE10 `[sr][lsp][sh]` — Extrair hook `useDiscordSync` do `DiscordSyncPanel.tsx` para `features/discord-sync/hooks/useDiscordSync.ts`
  - Estado: tab ativa, sync status, resultado
  - `serena_insert_after_symbol` para criar hook
- [ ] TE11 `[sr][lsp][sh]` — Extrair hook `useJsonImport` do `DiscordJsonImportPanel.tsx` para `features/discord-sync/hooks/useJsonImport.ts`
  - Estado: rawJson, preview, resultado, erro, drag state
- [ ] TE12 `[sr][lsp][sh]` — Extrair componente de grid de resultado (`ImportResultGrid`) do `DiscordJsonImportPanel.tsx` para componente separado
- [ ] TE13 `[sr][lsp][sh]` — Extrair componente de preview card (`JsonPreviewCard`) do `DiscordJsonImportPanel.tsx` para componente separado
- [ ] TE14 `[sr][lsp][sh]` — Extrair componente de dropzone/file select (`FileDropzone`) para componente separado
- [ ] TE15 — Quebrar `DiscordSyncPanel.tsx` em sub-componentes por tab (SyncPanel, ImportPanel, DraftsPanel, SettingsPanel)
- [ ] TE16 — Unificar loading/error/empty states: criar componente `GestaoStateWrapper` ou similar que padroniza os 3 estados para todas as sub-abas
- [ ] TE17 `[lsp][sh]` — Padronizar grid de resultados: criar componente `ResultGrid` reusável entre preview e import com props para colunas, destaque de failed, etc.

### Verificação de fim de fase

- [ ] TE18 `[sh]` — `pnpm run build` no mesas (backend + frontend) — zero erros
- [ ] TE19 `[sh]` — `pnpm run lint` no mesas (backend + frontend) — zero warnings
- [ ] TE20 `[sh]` — Testes backend + frontend do mesas — todos verdes
- [ ] TE21 `[lsp]` — `serena_get_diagnostics_for_file` em todos arquivos modificados — zero diagnostics
- [ ] TE22 — Verificar que nenhum arquivo em `features/discord-sync/` ou `routes/discord/` ultrapassa 500 linhas
- [ ] TE23 — Verificar manualmente que /gestao carrega, todas as sub-abas funcionam, import + preview + sync operam

## Fase F — Verificação Pós-Refatoração (cm + sr + lsp + sk + sh)

- [ ] TF1 `[cm]` — Comparar clusters arquiteturais antes/depois: `codebase-memory-mcp_get_architecture(project="mesas-backend")` + `codebase-memory-mcp_get_architecture(project="mesas-frontend")`
- [ ] TF2 `[sr][lsp]` — Verificar diagnostics zero em todos arquivos de /gestao: `serena_get_diagnostics_for_file` iterando por arquivo
- [ ] TF3 `[sh]` — `pnpm run build` repo-wide — zero erros
- [ ] TF4 `[sh]` — `pnpm run lint` repo-wide — zero warnings
- [ ] TF5 `[sh]` — `pnpm --filter @artificio/mesas-backend test` — 183/183
- [ ] TF6 `[sh]` — `pnpm --filter @artificio/mesas-frontend test` — 19/19
- [ ] TF7 `[sk][au]` — Re-auditar (by diff, não full) as issues P0-P1 das auditorias para confirmar tratamento: sub-agente `explorer` com skills carregadas, escopo reduzido a regressão
- [ ] TF8 — Atualizar `.specify/memory/project-state.md` com status da spec 049
- [ ] TF9 — Atualizar `specs/backlog.md` com débitos descobertos durante a spec (bugs, inconsistências, extrações para packages/ui)
- [ ] TF10 — Atualizar `sessoes/` com registro de conclusão da spec
- [ ] TF11 `[cm]` — Se houve extração para packages/ui: rodar `codebase-memory-mcp_index_repository` com mode=full nos pacotes alterados para atualizar grafo
- [ ] TF12 `[sr]` — Registrar memórias Serena (opcional): `serena_write_memory` com resumo da arquitetura pós-refatoração para referência futura

## Resumo de tasks por fase

| Fase | Tasks | Ferramentas principais |
|------|-------|----------------------|
| A — Mapeamento | TA1-TA7 (7) | cm, sr, lsp |
| B — Auditorias | TB1-TB5 (5) | sk, au |
| C — Duplicação | TC1-TC7 (7) | sk, sh |
| D — Proposta | TD1-TD10 (10) | cm, sr, lsp, sh |
| E — Refatoração | TE0a-TE23 (27) | cm, sr, lsp, sh |
| F — Verificação | TF1-TF12 (12) | cm, sr, lsp, sk, sh |
| **Total** | **68 tasks** | |
