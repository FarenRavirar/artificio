# 049 — Revisão da aba /gestao do mesas

- **Módulo/Pacote:** apps/mesas (frontend + backend), possível extração para packages/ui
- **Gate relacionado:** D (complementar à 048)
- **Relação com 048:** specs separadas mas tratadas como uma só no escopo do projeto. 048 cobre importador DiscordChatExporter; 049 cobre reorganização da aba /gestao inteira.
- **Tipo:** SDD Completo (toca packages/ui em proposta, requer aprovação explícita para extração)

## Problema

A aba `/gestao` foi construída em remendos sucessivos — cada feature adicionou seu próprio painel, rota e componente sem revisão de arquitetura geral. Resultado:

- Arquivos enormes com responsabilidade difusa (alguns >1000 linhas, ex.: `adminDiscordSync.ts` (~1278 linhas pós-TE1-TE4), `DiscordSyncPanel.tsx`)
- Rotas com lógica duplicada entre si (parse de JSON, validação Zod, tratamento de erros)
- Backend e frontend sem padronização de erros, loading states e validação
- Mix de padrões de componente (classes Tailwind inline vs. componentes compartilhados de packages/ui)
- UX inconsistente entre sub-abas (sync, drafts, import JSON, preview, upload imagem, auto-archive, hydration)
- Sem cobertura de testes para a maior parte dos fluxos de gestão
- Nenhuma auditoria de design, usabilidade, acessibilidade ou duplicação foi feita até hoje
- Código duplicado entre handlers de sync, import e preview no backend; entre componentes de grid, resultado e formulário no frontend

## Requisitos

1. Mapear exaustivamente o estado atual: rotas, componentes, fluxos, states, erros — usando **codebase-memory-mcp** para search_graph + trace_path e **Serena MCP** para find_symbol + find_referencing_symbols + get_diagnostics_for_file
2. Aplicar auditorias de design/UX segundo skills disponíveis (Nielsen Heuristics, UI Design Review, WCAG Accessibility, UX Audit & Rethink) — cada uma rodada como sub-agente dedicado com skill carregada
3. Detectar código duplicado via jscpd nos diretórios de backend e frontend de mesas
4. Cruzar resultados das auditorias + duplicação + diagnóstico LSP (Serena diagnostics) em relatório consolidado
5. Propor nova arquitetura de diretórios e responsabilidades com base nas evidências
6. Implementar refatoração em tasks curtas e testáveis (TDD onde aplicável), cada uma em branch + PR separado
7. Validar cada etapa com `pnpm run build`, `pnpm run lint`, `pnpm run test` no escopo do mesas + repo-wide

## Critérios de aceite

- [ ] Relatório de auditorias compilado com issues classificadas por severidade (P0-P3) — 4 relatórios + 1 consolidado
- [ ] Relatório de duplicação com todos os grupos >20 impacto classificados (exact/near/structural)
- [ ] Diagnóstico LSP (Serena `get_diagnostics_for_file`) registrado para cada arquivo alvo antes e depois
- [ ] Proposta de reorganização (árvore de arquivos alvo, responsabilidades por módulo, contratos) documentada
- [ ] Tasks de refatoração executadas com smoke test passando em cada PR
- [ ] Nenhuma regressão funcional nos fluxos de gestão existentes (verificado manualmente após última refatoração)
- [ ] Casa limpa: nenhum arquivo >500 linhas nos diretórios de /gestao, nenhuma função com complexidade ciclomática >15
- [ ] Se houver extração para packages/ui: SDD Completo adicional aprovado + smoke em todos consumidores

## Fora de escopo

- Mudança no schema do banco
- Mudança em rotas públicas (apenas /gestao)
- Refatoração de auth/SSO
- Adição de features novas não previstas nas auditorias
- Correção de bugs descobertos durante a spec (exceto se P0 catastrófico; bugs viram débito em backlog)

## Riscos e impacto em outros módulos

- Risco médio: arquivos grandes podem esconder dependências sutis — codebase-memory-mcp trace_path + Serena find_referencing_symbols reduzem esse risco
- Impacto zero esperado em outros apps (escopo restrito a apps/mesas)
- Impacto potencial em packages/ui se auditoria recomendar padronização de componentes — extração requer SDD Completo separado com aprovação explícita
- Impacto em testes: refatoração pode quebrar testes existentes se acoplamento não for detectado — cobertura de testes pré-refatoração é obrigatória
