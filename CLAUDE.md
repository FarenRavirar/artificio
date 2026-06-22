# CLAUDE.md — Artificio RPG (Claude Code)

@AGENTS.md

## Claude Code — Regras operacionais

Antes de agir, ler o T0 completo (`.specify/memory/project-state.md` + `docs/agents/context-capsule.md` + `.specify/memory/decisions.md`).

### Diagnostico local

- `rg "termo" apps packages -n` — busca textual
- `rg -l "termo" apps packages` — lista arquivos (economiza contexto)
- `rg --files apps packages` — todos arquivos monitorados
- `ast-grep -p "PADRAO" --lang ts` — busca estrutural
- `pnpm run lint` — ESLint repo-wide

### Regras

- Nao ler o repositorio inteiro. Usar `rg` e `ast-grep` antes de abrir arquivos.
- Nao abrir arquivos grandes sem justificar.
- Procurar simbolos, rotas, imports e chamadas antes de editar.
- `pnpm run lint` e `pnpm run build` antes de declarar tarefa concluida.
- `pnpm run test` e `pnpm run build` sao pesados localmente — CI cobre o repo completo.
- Jamais commitar sem autorizacao explicita do mantenedor.
- Duvida → parar e perguntar. Nao inferir autorizacao.
- Comunicacao com mantenedor: portugues, caveman ultra.
