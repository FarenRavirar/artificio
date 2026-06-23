# Plano — 049

## Arquitetura da solução

Seis fases sequenciais, cada uma gerando artefato para a próxima. Ferramentas obrigatórias por fase:

| Fase | codebase-memory-mcp | Serena MCP | LSP | Skills | jscpd |
|------|---------------------|------------|-----|--------|-------|
| A | search_graph, trace_path, get_architecture | find_symbol, find_referencing_symbols, get_symbols_overview | get_diagnostics_for_file | — | — |
| B | — | — | — | nielsen-heuristics-audit, ui-design-review, wcag-accessibility-audit, ux-audit-rethink | — |
| C | — | — | — | duplicate-code-detector | ✅ |
| D | search_graph, query_graph | find_referencing_symbols | get_diagnostics_for_file | — | — |
| E | trace_path (pré-validação) | replace_symbol_body, insert_after_symbol, insert_before_symbol, rename_symbol | get_diagnostics_for_file (pós cada edição) | — | — |
| F | get_architecture, search_graph | get_diagnostics_for_file | get_diagnostics_for_file | — | — |

### Fase A — Mapeamento e Inventário (codebase-memory-mcp + Serena + LSP)

Fluxo para cada arquivo alvo:
1. `serena_get_symbols_overview` no arquivo → lista símbolos top-level
2. `serena_get_diagnostics_for_file` → diagnóstico LSP atual (baseline)
3. `codebase-memory-mcp_search_graph` por nome do arquivo → nós no grafo
4. `codebase-memory-mcp_trace_path` nas funções principais → dependências
5. `serena_find_referencing_symbols` nos símbolos públicos → quem consome
6. Para cada rota: `codebase-memory-mcp_trace_path` mode=cross_service → HTTP calls

### Fase B — Auditorias de Design/UX (skills + sub-agentes)

Cada auditoria roda como sub-agente `explorer` com a skill carregada:
- TB1: `nielsen-heuristics-audit` — 10 heurísticas, severidade 0-4
- TB2: `ui-design-review` — 10 dimensões visuais, score 0-10
- TB3: `ux-audit-rethink` — 7 fatores + 5 características + 5 dimensões
- TB4: `wcag-accessibility-audit` — nível AA, POUR principles
- TB5: Compilação manual dos 4 relatórios em um consolidado com issues P0-P3

Critério de severidade consolidado:
- **P0 (Catastrófico):** bloqueia tarefa, perda de dados, violação de segurança/acessibilidade grave
- **P1 (Alto):** frustração significativa, barreira para usuário com deficiência
- **P2 (Médio):** inconsistência, atrito moderado
- **P3 (Baixo):** cosmético, melhoria sem urgência

### Fase C — Detecção de Código Duplicado (skill duplicate-code-detector + jscpd)

1. Verificar/instalar jscpd
2. Rodar com `--reporters json` em:
   - `apps/mesas/backend/src/routes/` (adminDiscordSync, adminHydration, adminTablesAutoArchive)
   - `apps/mesas/backend/src/discord/`
   - `apps/mesas/backend/src/validators/`
   - `apps/mesas/frontend/src/features/discord-sync/`
   - `apps/mesas/frontend/src/pages/`
3. Extrair métricas com `jq`, classificar por tipo (exact/near/structural) e impacto
4. Cruzar com achados das auditorias (ex.: duplicação que gera inconsistência visual)

### Fase D — Proposta de Reorganização (codebase-memory-mcp + Serena + LSP)

Antes de propor:
1. `codebase-memory-mcp_query_graph` para encontrar nós com alto fan-out (candidatos a split)
2. `serena_find_referencing_symbols` nos símbolos mais acoplados
3. `codebase-memory-mcp_get_architecture` para entender clusters atuais
4. `serena_get_diagnostics_for_file` em cada arquivo alvo

Artefato: `specs/049-mesas-revisao-gestao/proposta-reorganizacao.md` contendo:
- Nova árvore de diretórios (backend + frontend)
- Responsabilidades por módulo
- Contratos entre módulos
- Componentes candidatos a extração para packages/ui (sem execução)
- Priorização e estimativa de esforço

### Fase E — Refatoração (execução com Serena + codebase-memory-mcp + LSP)

Cada task segue o fluxo:
1. `codebase-memory-mcp_trace_path` nas funções afetadas (impacto)
2. `serena_get_diagnostics_for_file` antes (baseline)
3. Edição via `serena_replace_symbol_body` ou `serena_insert_after_symbol` ou `serena_insert_before_symbol`
4. `serena_get_diagnostics_for_file` depois (regressão LSP)
5. `codebase-memory-mcp_trace_path` depois (confirmar que contracto não quebrou)
6. `pnpm run build` no escopo do mesas
7. `pnpm run lint` no escopo do mesas
8. `pnpm run test` no escopo do mesas

Cada task em branch + PR separado com smoke obrigatório.

### Fase F — Verificação Pós-Refatoração

- `codebase-memory-mcp_get_architecture` — comparar clusters antes/depois
- `serena_get_diagnostics_for_file` em cada arquivo modificado — zero diagnostics
- `pnpm run build` repo-wide
- `pnpm run lint` repo-wide
- Testes backend + frontend do mesas
- Verificação manual de /gestao

## Arquivos afetados (por módulo/pacote)

### Backend (`apps/mesas/backend/src/`)
- `routes/adminDiscordSync.ts` — ~1000+ linhas, candidato principal a split em:
  - `routes/discord/sync.ts` — handlers de sync
  - `routes/discord/import.ts` — handlers de import JSON
  - `routes/discord/preview.ts` — handler de preview JSON
  - `routes/discord/settings.ts` — handler de settings
  - `routes/discord/drafts.ts` — handler de drafts
  - `routes/discord/upload.ts` — handler de upload de imagem
- `routes/adminTablesAutoArchive.ts` — pequeno, avaliar se funde ou mantém
- `routes/adminHydration.ts` — avaliar
- `discord/chatExporterImportService.ts` — serviço de import
- `discord/chatExporterAdapter.ts` — adaptador Zod
- `discord/settingsCrypto.ts` — criptografia de settings
- `discord/ingestMessages.ts` — ingestão de mensagens
- `discord/uploadDiscordImage.ts` — upload Cloudinary
- `validators/` — schemas Zod (avaliar centralização em packages/content)

### Frontend (`apps/mesas/frontend/src/`)
- `features/discord-sync/components/DiscordSyncPanel.tsx` — painel principal, candidato a split
- `features/discord-sync/components/DiscordJsonImportPanel.tsx` — import JSON
- `features/discord-sync/api/discordSyncApi.ts` — API layer
- `pages/gestao/` — layout e sub-rotas

### Pacotes compartilhados (proposta apenas, sem execução)
- `packages/ui` — componentes de grid de resultado, cards de preview, formulário de upload
- `packages/content` — schemas Zod de DiscordChatExporter

## Contratos/interfaces tocados

- Rotas REST: **nenhuma muda**. Apenas reorganização interna de handlers.
- API frontend (`discordSyncApi.ts`): **nenhuma função muda de nome ou assinatura**. Apenas extração de implementação.
- Componentes React: props podem mudar se houver extração para sub-componentes, mas interface pública (export) permanece mesma.

## Impacto em consumidores

- Nenhum — /gestao é admin-only, consumido pelo próprio frontend do mesas
- Rotas REST permanecem idênticas; clientes HTTP não percebem mudança
- Se extrair para packages/ui, afeta consumers futuros mas não quebra existentes (cópia → import do pacote)

## Rollback

- Cada refatoração é em PR separado → reversão é reverter o PR
- Manter snapshot de testes smoke antes de cada PR
- Se PR quebrar algo, reverter imediatamente e abrir task de diagnóstico

## Validação

### Por task
- `pnpm run build` no app (backend ou frontend)
- `pnpm run lint` no app
- `pnpm run test` no app
- `serena_get_diagnostics_for_file` — zero diagnostics nos arquivos modificados

### Por fase
- Fim da Fase E: `pnpm run build` repo-wide + `pnpm run lint` repo-wide + testes backend + frontend

### Final
- `pnpm run build` — zero erros, repo-wide
- `pnpm run lint` — zero warnings, repo-wide
- Testes backend 183/183, frontend 19/19
- Verificação manual: /gestao carrega, todas as sub-abas operam, import JSON funcional, preview funcional, sync funcional
