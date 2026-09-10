# CLAUDE.md — Artificio RPG (Claude Code)

@AGENTS.md

O `AGENTS.md` é a fonte canônica de governança e vale integralmente aqui — inclusive
o T0, a regra do `rtk`, autorização por ação e conclusão de tarefa. Este arquivo só
acrescenta o que é **específico do Claude Code**; nada que já esteja no `AGENTS.md`
se repete aqui, porque instrução duplicada em dois arquivos entra em conflito e o
modelo gasta raciocínio decidindo qual vence antes de agir.

## Específico do Claude Code

- **Skills:** `.agents/skills/` é a pasta única do repo (22 skills, todas com gatilho
  na descrição). Não criar skill em `.claude/skills/` — essa pasta foi consolidada e
  removida em 2026-09-10.
- **Hooks ativos** (`.claude/hooks/`, versionados e rodando nos três harnesses
  desde a spec 101 F0.7): `rtk-enforce` reescreve/bloqueia comando cru;
  `rtk-read-gate` bloqueia leitura integral de arquivo grande;
  `git-commit-msg-gate` bloqueia `-m @'` e `--amend`; `deploy-contract-gate` cobra
  a seção de `deploy-flow.md` ao editar `Dockerfile`, lockfile, `migration_*.sql`
  ou workflow; `autorizacao-gate` cobra a §Autorização nas formas que as regras
  declarativas não alcançam (caminho absoluto, `git -C`, `bash -lc` aninhado).
- **Regras de permissão** (`permissions` em `.claude/settings.json`, spec 101 F4):
  `deny` no que não tem exceção (desligar a VM, `--amend`, `push --force`); `ask`
  no que exige autorização por ação (commit, worktree, escrita na VM, SQL write,
  pacote novo). Push e abertura de PR ficaram liberados por decisão do mantenedor.
  Equivalentes: `.codex/rules/governanca.rules` e `permission.bash` no `opencode.json`.
- **`ast-grep` roda cru** — busca estrutural (`ast-grep -p "PADRAO" --lang ts`). O hook
  do `rtk` não o reescreve (medido: `No rewrite for`), diferente de `rg`/`git`/`pnpm`.
- **Ferramentas de navegação:** LSP para diagnóstico semântico e `codebase-memory-mcp`
  para mapa estrutural vêm antes de busca textual (`AGENTS.md` §Ordem de uso).
