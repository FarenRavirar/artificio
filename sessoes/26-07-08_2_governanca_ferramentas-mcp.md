# Sessão 26-07-08_2 — Governança das ferramentas MCP/agentes

**Data:** 2026-07-08  
**Escopo:** governança documental / `AGENTS.md`  
**Objetivo:** reorganizar apenas a parte das ferramentas locais (`LSP`, `Serena MCP`, `codebase-memory-mcp`, `artificio-api-governance`) para uso por Codex, Claude Code e OpenCode.

## Vínculos

- `AGENTS.md`
- Spec 044 / DEB-044-01 e DEB-044-02
- Spec 055 / DEB-055-06
- `docs/api/README.md`

## Plano

- [x] Revisar blocos existentes no `AGENTS.md`.
- [x] Verificar registros históricos em specs/sessões das ferramentas.
- [x] Reorganizar sem perder decisões/acontecimentos.
- [x] Remover redundância entre bloco principal e "Ferramentas preferidas".
- [x] Registrar LSP como ferramenta explícita e importante de diagnóstico automático.
- [x] Reforçar T0: caveman ultra obrigatório + uso obrigatório das ferramentas disponíveis.
- [x] Registrar evidência.

## Evidência

- `rtk rg -n "Ferramentas|codebase-memory|Serena|artificio-api-governance|api:mcp|MCP|OpenCode|Claude|Codex" ...`
- `rtk git diff -- AGENTS.md`
- `rtk rg -n "Ferramentas MCP / Agentes|LSP|Serena MCP|codebase-memory-mcp|artificio-api-governance|Ferramentas preferidas" AGENTS.md`

## Resultado

- `AGENTS.md` agora tem uma seção única `Ferramentas MCP / Agentes`.
- A seção cobre:
  - LSP como diagnóstico automático importante;
  - origem/registro de cada ferramenta;
  - função;
  - ferramentas esperadas;
  - quando usar;
  - quando não usar;
  - disciplina/fallback;
  - diferença de config entre OpenCode, Claude Code e Codex.
- A lista `Ferramentas preferidas` no fluxo OpenCode virou resumo apontando para a seção única.
- Ajuste pós-feedback do mantenedor: LSP não fica implícito dentro de Serena/OpenCode; virou item próprio na ordem de uso.
- Ajuste pós-feedback do mantenedor: T0 (`context-capsule.md`) agora deixa explícito que caveman ultra é obrigatório e que agentes devem usar `rtk`, `artificio-api-governance`, LSP, Serena e `codebase-memory-mcp` quando disponíveis.
- `project-state.md` resume D088; `decisions.md` ganhou D088 append-only.

## Backlog

Nada a atualizar: não foi descoberto bug/débito novo; mudança é reorganização documental de governança já existente.

## Fechamento

- [x] Sessão registrada.
- [x] Sem commit/push/PR.
- [x] Sem mudança de código runtime.
