---
description: Autorizar fase de investigação read-only da spec atual.
agent: artificio-orquestrador
---

Comando: `/investigar-spec`
Argumentos: `$ARGUMENTS`

Fase autorizada: investigação.

Atue como `artificio-orquestrador`.
Atualize `.opencode/artificio-flow/state.md` com fase `investigação`, escopo e bloqueios.
Delegue ao `artificio-investigador` uma investigação read-only.

Permissões herdadas:
- pode usar LSP, Serena MCP e codebase-memory-mcp;
- pode usar `rg`, leitura de arquivos, `git status`, `git diff` e `git log`;
- não pode editar;
- não pode implementar;
- não pode commitar.

Ao final, consolide a investigação e proponha `/implementar-spec ...` ou `/registrar-spec ...`, conforme o resultado.
