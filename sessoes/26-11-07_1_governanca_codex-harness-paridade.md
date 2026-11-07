# Sessão 26-11-07_1 — Paridade do harness Codex

## Objetivo

Parear o harness do Codex com o fluxo já usado no Claude Code, preservando a governança do Artifício RPG e as diferenças reais entre os dois clientes.

## Decisões do mantenedor

- A spec 101 permanece arquivada; esta retomada usa uma sessão nova.
- `codebase-memory` foi removido e não deve permanecer ativo em hooks, MCPs, instruções ou catálogo de skills.
- Headroom não atua como provider nem proxy. A configuração inválida deve permanecer removida.
- Caveman continua como provider ativo do Codex.
- Nenhum commit foi autorizado.

## Paridade aplicada

- `.codex/hooks.json`: RTK nativo do Codex antes dos gates compartilhados; gates de leitura, commit, autorização, deploy e beta antes de produção; hooks `Stop` de registro e resposta `ultra`.
- `.codex/config.toml`: hooks habilitados; MCPs `context7@4.4.4` e `magic@0.2.3` alinhados ao `.mcp.json`; nenhuma configuração Headroom.
- `C:\Users\paulo\.codex\hooks.json`: Caveman Blocks usa `--harness codex`; hooks ativos de `codebase-memory` removidos.
- `C:\Users\paulo\.codex\config.toml`: MCPs `codebase-memory-mcp` e Headroom removidos; provider ativo continua `caveman`.
- `C:\Users\paulo\.codex\AGENTS.md`: instrução de `codebase-memory` removida.
- `.claude/hooks/registro-anti-compactacao.js`: leitura compatível com transcript Claude e rollout Codex; `sessoes/*.md` vale como registro quando a sessão foi pedida.
- `C:\Users\paulo\.agents\skills\improve-codebase-architecture`: port da única skill funcional do Claude que faltava ao catálogo compartilhado.
- `C:\Users\paulo\.codex\skills\codebase-memory`: symlink ativo removido; alvo do gerenciador preservado em `C:\Users\paulo\.skills-manager\skills\codebase-memory` para recuperação.

## Diferenças intencionais de harness

- Claude usa `Bash|PowerShell`; Codex expõe shell ao hook como `Bash`.
- Codex inclui `apply_patch` no gate de deploy; Claude usa `Edit|Write`.
- O gate Claude `Grep|Glob` para delegação ao `ajudante-haiku` não foi copiado: Codex não expõe essas tools e a governança atual exige autorização nominal para outro agente.
- Caveman usa eventos nativos disponíveis em cada cliente; Codex acrescenta `PermissionRequest` e `PostCompact`, enquanto Claude possui `PostToolUseFailure`.

## Medições

- Documentação oficial: hooks não gerenciados exigem confiança vinculada ao hash atual; `/hooks` é o navegador canônico de revisão. Fonte: https://developers.openai.com/plugins/build/plugins
- `/hooks`, após corrigir `$comment` para `description`: `PreToolUse 9/9` ativos e `Stop 3/3` ativos; nenhum erro de parse. Nove hashes do projeto foram gravados em `C:\Users\paulo\.codex\config.toml`.
- Suíte completa: `rtk node --test .claude/hooks/*.test.js` executou 9 arquivos, 9 passaram, com 200 casos internos e zero falhas.
- Skills: 32 skills Claude com `SKILL.md`; todas presentes em `C:\Users\paulo\.agents\skills`; Codex possui ainda `megacave` e `ultracave`.
- MCPs do projeto: `.mcp.json` contém `code-review-graph`, `context7` e `magic`; `codex mcp list` mostrou os três habilitados.
- Busca ativa por `codebase-memory|headroom` em `.codex` e nos três arquivos globais do Codex retornou zero em duas medições independentes.
- `codex doctor`: config parse `ok`, 11 MCPs configurados, provider `caveman`, 21 checks `ok`, zero falhas. Warnings restantes: Defender, Dev Drive, variáveis opcionais do Node REPL e inconsistências antigas de rollouts.

## Resultado

Harness Codex pareado para o trabalho no Artifício RPG. Hooks do projeto carregados, ativos e confiados; MCPs e skills essenciais disponíveis; `codebase-memory` e Headroom fora da configuração ativa.
