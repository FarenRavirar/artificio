# CLAUDE.md — Artificio RPG (Claude Code)

@AGENTS.md

O `AGENTS.md` é a fonte canônica de governança e vale integralmente aqui — inclusive
o T0, a regra do `rtk`, autorização por ação e conclusão de tarefa. Este arquivo só
acrescenta o que é **específico do Claude Code**; nada que já esteja no `AGENTS.md`
se repete aqui, porque instrução duplicada em dois arquivos entra em conflito e o
modelo gasta raciocínio decidindo qual vence antes de agir.

## Específico do Claude Code

- **Skills:** `.agents/skills/` é a pasta única do repo (20 skills, todas com gatilho
  na descrição). Não criar skill em `.claude/skills/` — essa pasta foi consolidada e
  removida em 2026-09-10.
- **Hooks ativos** (`~/.claude/hooks/`, só neste harness até a spec 101 versioná-los):
  `rtk-enforce` reescreve/bloqueia comando cru; `rtk-read-gate` bloqueia leitura
  integral de arquivo grande; `git-commit-msg-gate` bloqueia `-m @'` e `--amend`;
  `deploy-contract-gate` cobra a seção de `deploy-flow.md` ao editar `Dockerfile`,
  lockfile, `migration_*.sql` ou workflow.
- **`ast-grep` roda cru** — busca estrutural (`ast-grep -p "PADRAO" --lang ts`). O hook
  do `rtk` não o reescreve (medido: `No rewrite for`), diferente de `rg`/`git`/`pnpm`.
- **Ferramentas de navegação:** LSP para diagnóstico semântico e `codebase-memory-mcp`
  para mapa estrutural vêm antes de busca textual (`AGENTS.md` §Ordem de uso).
