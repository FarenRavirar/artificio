# Sessão 26-11-07_1 — Paridade do harness Codex

## Objetivo

Parear o harness do Codex com o fluxo já usado no Claude Code, preservando a governança do Artifício RPG e as diferenças reais entre os dois clientes.

## Decisões do mantenedor

- A spec 101 permanece arquivada; esta retomada usa uma sessão nova.
- `codebase-memory` foi removido e não deve permanecer ativo em hooks, MCPs, instruções ou catálogo de skills.
- Headroom não atua como provider nem proxy. A configuração inválida deve permanecer removida.
- Caveman continua como provider ativo do Codex.

## Paridade aplicada

- `.codex/hooks.json`: RTK nativo do Codex antes dos gates compartilhados; `PreToolUse` bloqueia, `PermissionRequest` libera leitura remota reconhecida ou preserva o prompt de autorização; hooks `Stop` de registro e resposta `ultra`.
- `.codex/rules/governanca.rules`: regras versionadas de `allow`, `prompt` e `forbidden`, cobrindo comandos obrigatoriamente prefixados por `rtk` e as formas cruas defensivas.
- `.codex/config.toml`: hooks habilitados; MCPs `context7@4.4.4` e `magic@0.2.3` alinhados ao `.mcp.json`; nenhuma configuração Headroom.
- `C:\Users\paulo\.codex\hooks.json`: Caveman Blocks usa `--harness codex`; hooks ativos de `codebase-memory` removidos.
- `C:\Users\paulo\.codex\config.toml`: MCPs `codebase-memory-mcp` e Headroom removidos; provider ativo continua `caveman`.
- `C:\Users\paulo\.codex\AGENTS.md`: instrução de `codebase-memory` removida.
- `.claude/hooks/registro-anti-compactacao.js`: leitura compatível com transcript Claude e rollout Codex; reconhece patches multilinha e strings com `\n` escapado; só aceita `apply_patch` concluído; delimita turno humano pela proveniência; `sessoes/*.md` vale como registro quando a sessão foi pedida.
- `.mcp.json`: `context7` inicia por `npx` sem shell específico; Magic usa bootstrap Node portátil, preserva `API_KEY_21ST` do processo e consulta o escopo User do Windows somente quando ausente.
- `C:\Users\paulo\.agents\skills\improve-codebase-architecture`: port da única skill funcional do Claude que faltava ao catálogo compartilhado.
- `C:\Users\paulo\.codex\skills\codebase-memory`: symlink ativo removido; alvo do gerenciador preservado em `C:\Users\paulo\.skills-manager\skills\codebase-memory` para recuperação.

## Diferenças intencionais de harness

- Claude usa `Bash|PowerShell`; Codex expõe shell ao hook como `Bash`.
- Codex inclui `apply_patch` no gate de deploy; Claude usa `Edit|Write`.
- O gate Claude `Grep|Glob` para delegação ao `ajudante-haiku` não foi copiado: Codex não expõe essas tools e a governança atual exige autorização nominal para outro agente.
- Caveman usa eventos nativos disponíveis em cada cliente; Codex acrescenta `PermissionRequest` e `PostCompact`, enquanto Claude possui `PostToolUseFailure`.
- Codex não suporta `permissionDecision: "ask"` em `PreToolUse`; o equivalente correto é regra `prompt` seguida de `PermissionRequest` sem decisão, preservando o prompt normal.

## Medições

- Documentação oficial: hooks não gerenciados exigem confiança vinculada ao hash atual; `/hooks` é o navegador canônico de revisão. Fonte: https://developers.openai.com/plugins/build/plugins
- `/hooks`, após corrigir `$comment` para `description`: `PreToolUse 9/9` ativos e `Stop 3/3` ativos; nenhum erro de parse. Nove hashes do projeto foram gravados em `C:\Users\paulo\.codex\config.toml`.
- Documentação oficial do Codex: `PreToolUse.permissionDecision: "ask"` falha e deixa a chamada continuar; `PermissionRequest` aceita `allow`/`deny`, e ausência de decisão preserva o prompt normal. Fonte: https://developers.openai.com/codex/hooks
- `codex execpolicy check` antes da correção: `rtk git commit` e `rtk ssh faren docker ps` retornaram `matchedRules: []`; depois, retornaram `prompt`, com a leitura remota também casando a regra `allow` antes da decisão mais restritiva.
- Achados automatizados reproduzidos e cobertos: patch Codex com `\n` escapado; patch sem resultado ou rejeitado; mensagem humana sem `input_text`; contexto `role:user` injetado pelo harness; `head -c` com nome simples, opção anexada, pipeline e caminho entre aspas.
- `git check-ignore -q .codex/rules/governanca.rules` devolveu exit 1, e `git status --untracked-files=all` listou `?? .codex/rules/governanca.rules`.
- Suíte completa: `rtk node --test .claude/hooks/*.test.js` executou 9 arquivos, 9 passaram, com 218 casos internos e zero falhas.
- Skills: 32 skills Claude com `SKILL.md`; todas presentes em `C:\Users\paulo\.agents\skills`; Codex possui ainda `megacave` e `ultracave`.
- MCPs do projeto: `.mcp.json` parseou com `context7.command=npx` e `magic.command=node`; `scripts/mcp/launch-magic.js` passou em `node --check`; o wrapper Windows por `ComSpec` executou `npx --version` com exit 0. A forma direta `spawn('npx.cmd')` foi descartada após reproduzir `spawn EINVAL`.
- Busca ativa por `codebase-memory|headroom` em `.codex` e nos três arquivos globais do Codex retornou zero em duas medições independentes.
- `codex doctor`: config parse `ok`, 11 MCPs configurados, provider `caveman`, 21 checks `ok`, zero falhas. Warnings restantes: Defender, Dev Drive, variáveis opcionais do Node REPL e inconsistências antigas de rollouts.
- Falha repetida de hook identificada fora do repo: o comando Caveman de `C:\Users\paulo\.codex\hooks.json` usava `&` de PowerShell; sob `cmd /c` devolveu exit 1 com `& foi inesperado neste momento.`. As 11 entradas foram reescritas para uma chamada sem operador e sem caminhos com espaços, válida nos dois shells; payload `PostToolUse` via `cmd /c` devolveu exit 0. A configuração global do Claude não foi alterada.

## Resultado

Harness versionado cobre os três resultados de autorização sem schema incompatível, inclui as rules na revisão dos bots e fecha os achados procedentes da PR. A falha global Caveman do Codex no Windows também foi corrigida sem tocar a configuração global do Claude.
