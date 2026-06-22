# 044 — Otimizacao do Ecossistema OpenCode

- **Modulo/Pacote:** governanca/dev-tools (AGENTS.md + opencode.json)
- **Gate relacionado:** nenhum (ferramentas internas de desenvolvimento)
- **Status:** em andamento (Fase 1 ✅, Fase 2 pendente, Fases 3/4 investigadas, DEB-044-01 ✅, DEB-044-02 ✅)
- **Sessao:** `sessoes/26-06-22_7_opencode-ecosystem.md`
- **Reviews:** `reviews.md`
- **Debitos:** `debitos.md`

## Problema

O monorepo Artificio tem ~3 meses de desenvolvimento, N chats, N agentes. O OpenCode e a plataforma de agentes ainda operam com configuracao default, sem otimizacao de contexto/ruido/ferramentas. Cada sessao gasta tokens com:

1. **Outputs antigos de ferramentas** acumulando no contexto sem poda automatica.
2. **Watcher sem filtro** — arquivos em `node_modules`, `dist`, `.git` geram eventos que podem distrair o agente.
3. **Falta de comandos de diagnostico documentados** — agentes abrem arquivos em vez de usar `rg`/`lint`/`build` para validacao rapida.
4. **LSP silencioso** — AGENTS.md nao documenta que LSP pode dessincronizar, nem orienta validacao CLI como fallback.
5. **`ast-grep` ausente** — buscas baseadas em AST (imports, funcoes, componentes) sao mais precisas que grep textual e economizam leitura de arquivos.
6. **Ferramentas MCP/plugins nao avaliadas** — `opencode-dynamic-context-pruning`, `OpenSlimedit`, `Serena MCP`, `codebase-memory-mcp` podem reduzir tokens e tool calls em 10-120x segundo benchmarks.

## Requisitos

- **R1:** `opencode.json` com `compaction.prune: true` para poda automatica de outputs antigos.
- **R2:** `opencode.json` com `watcher.ignore` cobrindo `node_modules/**`, `dist/**`, `.git/**`, `.astro/**`, `.next/**`, `coverage/**`, `build/**`, `*.log`.
- **R3:** `opencode.json` com `permission.edit: "ask"` + `permission.bash: "ask"` (reforco de seguranca; bash ja tem regras especificas mas falta default).
- **R4:** AGENTS.md com secao "Diagnostico local antes de pedir mais contexto" — comandos `lint`, `test`, `build`, `rg`, `ast-grep`, regras de nao abrir arquivo grande sem justificar, procurar simbolos/imports antes de editar.
- **R5:** AGENTS.md documentando limitacao do LSP (dessincronizacao, memoria) e reforcando validacao CLI como fonte primaria de diagnostico.
- **R6:** `ast-grep` instalado globalmente (`npm install -g @ast-grep/cli`) e documentado em AGENTS.md com exemplos de uso.
- **R7:** Investigar `opencode-dynamic-context-pruning` (ou `Sleev`) e `OpenSlimedit` — documentar achados, riscos, recomendacao. Nao instalar sem aprovacao.
- **R8:** Investigar `Serena MCP` e `codebase-memory-mcp` — documentar achados, custo/beneficio para monorepo, recomendacao. Nao instalar sem aprovacao.

## Criterios de aceite

- [x] `opencode.json` com as 3 otimizacoes aplicadas e validadas (nao quebra fluxo existente). → Fase 1 concluida 2026-06-22.
- [ ] AGENTS.md com nova secao de diagnostico + nota LSP. → T4-impl / T5-impl pendentes.
- [ ] `ast-grep --version` retorna versao valida. → T7-impl pendente.
- [x] Relatorio de investigacao dos 4 MCP/plugins. → T9/T10/T11/T12 investigados. 2 instalados (Serena + CBM), 1 rejeitado (DCP/Sleev), 1 pendente (OpenSlimedit).
- [ ] `turbo run lint build test` verde apos alteracoes. → AGENTS.md e opencode.json editados (so config/docs), sem impacto em build.

## Fora de escopo

- Instalar MCP/plugins sem aprovacao explicita do mantenedor.
- Alterar codigo de apps/packages.
- Criar workflows CI/CD novos.
- Modificar `turbo.json` ou `pnpm-workspace.yaml`.
- Alterar `.claude/agents/` ou subagentes.

## Estado atual (2026-06-22)

**Concluido:**
- `opencode.json`: `compaction.prune`, `watcher.ignore` (8 patterns), `permission.edit/bash: "ask"`. JSON validado.
- AGENTS.md: bloco `codebase-memory-mcp` (marcadores HTML) adicionado ao final.
- `serena-agent` v1.5.3: instalado via uv, 549 arquivos TS indexados, `.serena/` gitignored, MCP config no `opencode.json`.
- `codebase-memory-mcp` v0.8.1: instalado via npm, 10.6k nos / 18.1k edges em 4.1s, MCP config manual no `opencode.json`.
- `rg` v15.1.0: ja instalado.
- `opencode.json` com 3 MCP servers: serena + codebase-memory-mcp.

**Pendente:**
- T4-impl/T5-impl: secao "Diagnostico local" + nota LSP no AGENTS.md.
- T7-impl/T8: instalar `@ast-grep/cli` + documentar no AGENTS.md.
- T10: OpenSlimedit (Fase 5 opcional).
- Smoke test: reiniciar OpenCode para carregar MCP servers + testar ferramentas em sessao real.
- T-final: atualizar backlog/sessao/project-state com estado final.

## Riscos e impacto em outros modulos

- **Risco baixo:** `opencode.json` e AGENTS.md sao arquivos de configuracao local — nao afetam runtime de producao.
- **Risco medio:** `ast-grep` e ferramenta externa — precisa ser instalada no ambiente do mantenedor. Falha de instalacao nao bloqueia desenvolvimento (rg cobre fallback).
- **Risco baixo:** MCP/plugins sao so investigacao — zero impacto em codigo existente.
- **Nao toca apps/packages** — isolamento total.
