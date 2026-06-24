# Duplicação de Código — /gestao

> Gerado via jscpd em 2026-06-23. Modo: --min-lines 5 --min-tokens 30

## Resumo

| Área | Total Clones | Linhas Duplicadas | Percentual |
|------|-------------|-------------------|------------|
| Backend (routes + discord) | 310 | 2863 | **17.3%** |
| Frontend (discord-sync) | 5 | 46 | **1.5%** |

## Análise Backend — Top 15 grupos

### 1. adminDiscordSync.ts ↔ adminImportInbox.ts (28 linhas, 172 tokens) — CRÍTICO

**Tipo:** Near-duplicate (exact pattern, nomes diferentes)
**Classificação:** Extract Module
**Padrão:** Ambos implementam handlers de draft (PATCH, POST sync, POST reparse) com mesma estrutura de validação Zod → service call → response.
**Refactoring:** Extrair draft CRUD comum para `routes/drafts.ts` ou `services/draftService.ts`. `adminDiscordSync.ts` e `adminImportInbox.ts` podem montar o mesmo sub-router.

### 2-5. Auto-duplicação dentro do mesmo arquivo (systems.ts, tableSchedules.ts, adminSettingSuggestions.ts)

**Tipo:** Exact
**Classificação:** Extract Function / Parameterize
**Padrão:** Mesmo pattern de handler repetido com parâmetros diferentes (ex.: `res.json({data, error})` com tratamento idêntico).
**Refactoring:** Factory function de handler com parametrização.

### 6. scenarioSuggestions.ts ↔ systemSuggestions.ts (21 linhas, 127 tokens) — ALTO

**Tipo:** Near-duplicate
**Classificação:** Template Method
**Padrão:** CRUD de sugestões de cenário/sistema com 95% de código idêntico. Schemas, handlers, paginação, tudo paralelo.
**Refactoring:** Handler genérico de sugestões parametrizado por tipo.

### 7-15. Auto-duplicação em gmPanel.ts, tables.ts, etc.

**Tipo:** Exact/Near
**Padrão:** Mesmo boilerplate de CRUD (GET list, GET by id, POST create) copiado entre módulos.

## Análise Frontend — 4 grupos

### 1. DiscordJsonImportPanel.tsx self-duplicate (17 linhas)

**Tipo:** Exact
**Classificação:** Extract Function
**Padrão:** Bloco `try/catch` com fetch repetido (similar patterns for preview and import).
**Refactoring:** Extrair helper `handleImportAction`.

### 2. DiscordSourceList.tsx self-duplicate (11 linhas)

**Tipo:** Exact
**Padrão:** Construção de `FetchWindowOption` repetida (mesma lógica de cálculo de datas).
**Refactoring:** Extrair factory `buildFetchWindowOptions`.

### 3. DiscordSourceList.tsx ↔ DiscordSyncPanel.tsx (9 linhas)

**Tipo:** Near
**Padrão:** Import pattern e declarações de tipo similares.
**Refactoring:** Centralizar tipos compartilhados.

## Classificação Consolidada

| Grupo | Tipo | Impacto | Refactoring Pattern | Prioridade |
|-------|------|---------|--------------------|------------|
| adminDiscordSync ↔ adminImportInbox (drafts) | Near | **Crítico** — duplicação funcional real | Extract Module + Shared Router | 🔴 P0 |
| scenarioSuggestions ↔ systemSuggestions | Near | **Alto** — 95% código idêntico | Template Method / Generic Handler | 🟡 P1 |
| Auto-duplicação interna (systems, tables, etc.) | Exact | Médio — boilerplate | Factory Function | 🟢 P2 |
| Frontend self-duplicate (JsonImportPanel) | Exact | Baixo — 17 linhas | Extract Function | 🔵 P3 |
| Frontend self-duplicate (SourceList) | Exact | Baixo — 11 linhas | Extract Function | 🔵 P3 |
| Frontend cross-file (SourceList ↔ SyncPanel) | Near | Mínimo — 9 linhas | Centralize types | 🔵 P3 |

## Cruzamento com Auditorias

- A duplicação `adminDiscordSync ↔ adminImportInbox` cria **inconsistência UX** (comportamento de drafts difere sutilmente entre as duas rotas). Capturado nas auditorias como P2-16.
- A auto-duplicação de boilerplate de handler contribui para a **alta complexidade ciclomática** dos arquivos grandes (adminDiscordSync = 1421 linhas).
- A duplicação de schemas Zod (`updateDraftSchema` vs `patchDraftSchema`) foi identificada no diagnóstico LSP como deprecações de Zod API — corrigir a duplicação resolve as deprecações.

## Recomendação

1. **Extração imediata**: unificar draft CRUD entre `adminDiscordSync` e `adminImportInbox` em um `routes/drafts.ts` compartilhado (resolve P0 + 28 linhas duplicadas + 2 schemas duplicados)
2. **Factory de handlers**: criar `createCrudHandler(table, schema)` para reduzir boilerplate de CRUD nos módulos de admin
3. **Duplicação frontend**: extrair `buildFetchWindowOptions` e `handleImportAction` como funções compartilhadas
