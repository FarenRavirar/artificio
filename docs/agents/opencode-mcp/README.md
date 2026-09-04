# opencode-mcp

Servidor MCP (stdio) que expõe o **opencode/DeepSeek** ao **Claude Code**. O
orquestrador (Claude) chama a ferramenta `deepseek` para delegar pesquisa,
revisão crítica/contraditório de código ou implementação.

Diretório gitignored (`/docs/agents/*` em `.gitignore`) — ferramenta pessoal de
orquestração, fora do fluxo de PR do repositório.

## Requisitos

- Node >= 20
- `opencode` instalado (binário nativo)
- `@modelcontextprotocol/sdk` (instalar com `npm install` aqui dentro)

## Instalar

```bash
cd docs/agents/opencode-mcp
npm install
```

## Registrar no Claude Code

Escopo usuário (`~/.claude.json`, chave `mcpServers`) — recomendado, não entra
no git:

```json
{
  "mcpServers": {
    "opencode-deepseek": {
      "command": "node",
      "args": ["C:\\projetos\\artificio\\docs\\agents\\opencode-mcp\\server.mjs"]
    }
  }
}
```

Alternativa de escopo projeto (`.mcp.json` na raiz do repo) funciona igual, mas
o arquivo é versionado e vira compartilhado com o time — use só se quiser isso.

## Ferramenta exposta

- `deepseek` — roda `opencode run "<prompt>"` em sessão nova.

Parâmetros:

| Parâmetro | Tipo   | Obrigatório | Descrição |
|-----------|--------|-------------|-----------|
| `prompt`  | string | sim         | Tarefa completa para o DeepSeek. |
| `model`   | string | não         | `provider/modelo` (ex.: `deepseek/deepseek-v4-pro`). Default: default do opencode. |
| `agent`   | string | não         | Agente opencode (ex.: `artificio-orquestrador`). |
| `cwd`     | string | não         | Diretório de trabalho. Default: raiz do repo. |

## Env vars

Definíveis no bloco `env` do config do MCP:

| Variável                | Default                    | Descrição |
|-------------------------|----------------------------|-----------|
| `OPENCODE_MCP_BIN`      | binário nativo detectado   | Caminho do binário opencode. |
| `OPENCODE_MCP_CWD`      | raiz do repositório        | Diretório de trabalho. |
| `OPENCODE_MCP_TIMEOUT_MS` | `900000` (15 min)        | Timeout do `opencode run`. |

## Por que spawnar o binário nativo (sem shell)

O shim npm (`opencode`, `opencode.cmd`, `opencode.ps1`) não é spawnável por
`child_process.spawn` sem shell no Windows. O binário real é
`%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe`, detectado
automaticamente. Passar o prompt como elemento de `argv` (não por string de
shell) evita o problema de quoting/encoding do Windows — o mesmo que já gerou o
incidente do `U+FFFD` em produção (AGENTS.md, spec 090).

**E fechar o stdin do filho.** Sem `stdio: ["ignore", ...]`, o Node deixa o
stdin do `opencode run` como pipe aberto e ele fica esperando EOF/input
indefinidamente — foi o que travou o primeiro smoke test ponta-a-ponta (o
`tools/call` nunca respondia). O `server.mjs` usa `stdio: ["ignore", "pipe",
"pipe"]`.

## Por que `--auto` (e por que sem ele a falha é silenciosa)

O `opencode.json` da raiz do repo declara `permission: { edit: "ask", bash:
"ask" }`. Em sessão interativa isso pergunta ao mantenedor. Em `opencode run`
(headless) **não há quem responda**, então o opencode auto-rejeita toda chamada
de ferramenta:

```
! permission requested: bash (rtk rg -n "VTT_ALIASES" ...); auto-rejecting
✗ Error: The user rejected permission to use this specific tool call.
```

O veneno é o modo de falhar: ele aborta e **sai com exit 0 e stdout vazio**.
Prompt trivial ("responda PING") funciona, porque não usa ferramenta nenhuma —
então o smoke test passa e o problema só aparece na primeira tarefa real.
Medido em 2026-08-19: o mesmo prompt de leitura de arquivo devolvia
`(sem saída)` sem `--auto`, e a resposta certa com ele.

Por isso o `server.mjs` faz duas coisas:

1. passa `--auto` sempre;
2. trata **exit 0 com stdout vazio como erro**, devolvendo o stderr junto. Antes
   devolvia a string `"(sem saída)"` como se fosse resultado — o orquestrador
   seguia achando que a tarefa tinha rodado.

`--auto` aprova o que não está explicitamente negado. O opencode roda no
repositório com as mesmas travas do `AGENTS.md`; a aprovação nominal do
mantenedor para acionar o outro agente continua valendo, e não é o `--auto` que
a substitui.

## Smoke test

```bash
cd docs/agents/opencode-mcp
printf '%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | node server.mjs
```

A resposta deve listar a ferramenta `deepseek`.

**`tools/list` sozinho não prova nada.** Ele responde igual com o servidor
quebrado — foi o que deixou o bug de permissão passar. O smoke que vale é uma
chamada real que **obrigue o DeepSeek a usar ferramenta** (ler arquivo, rodar
`rtk rg`), porque é só aí que a permissão entra em jogo:

```bash
printf '%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"deepseek","arguments":{"prompt":"Leia apps/mesas/backend/src/discord/shared.ts e responda em 1 linha em que linha o objeto VTT_ALIASES comeca."}}}' \
  | node server.mjs
```

Leva alguns minutos. Resposta correta em 2026-08-19: linha 60, 12 aliases. Se
vier erro de "código 0 mas sem nenhuma saída", é permissão — confira o `--auto`.
