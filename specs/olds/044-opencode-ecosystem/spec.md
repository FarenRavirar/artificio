# 044 — Otimizacao do Ecossistema de Agentes (OpenCode + Claude Code)

- **Modulo/Pacote:** governanca/dev-tools (AGENTS.md + opencode.json + CLAUDE.md)
- **Gate relacionado:** nenhum (ferramentas internas de desenvolvimento)
- **Status:** fechada — OpenCode + Claude Code (2026-06-22)
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

## Estado atual (2026-06-22) — CONCLUIDO

**OpenCode (100%):**
- `opencode.json`: `compaction.prune`, `watcher.ignore` (8 patterns), `permission.edit/bash: "ask"`, `plugin: openslimedit`
- AGENTS.md: secao "Diagnostico local" + "Sobre o LSP" (topo, T0) + bloco `codebase-memory-mcp`
- MCP: Serena v1.5.3 + codebase-memory-mcp v0.8.1 (3 servidores ativos)
- Ferramentas: `rg` v15.1.0, `@ast-grep/cli` v0.44.0
- `.serena/` gitignored, `.gitignore` atualizado

**Claude Code (100%):**
- `CLAUDE.md`: raiz (26 linhas), `@AGENTS.md` import
- LSP: `typescript-lsp@claude-plugins-official` cacheado, `typescript-language-server` v5.3.0
- `.claude/settings.json`: `enabledPlugins` com plugin LSP
- MCP: Serena + codebase-memory-mcp (configurados pelo `cbm install`)
- Hooks: rejeitado (mantenedor usa agents)

**Rejeitado:**
- Sleev/DCP (proxy proprietario, risco seguranca)
- Hooks Claude Code 6c (mantenedor usa agents para controle)

**Validacao:**
- `pnpm run lint`: 7/9 pacotes verdes (feedback pre-existente)
- `codebase-memory-mcp`: 10.6k nos, 18.1k edges, `search_graph` OK
- `serena`: `find_symbol("Header")` OK, 549 TS indexados
- `ast-grep`: v0.44.0 funcional
- `/reload-plugins` Claude: 1 plugin LSP server ativo

## Riscos e impacto em outros modulos

- **Risco baixo:** `opencode.json` e AGENTS.md sao arquivos de configuracao local — nao afetam runtime de producao.
- **Risco medio:** `ast-grep` e ferramenta externa — precisa ser instalada no ambiente do mantenedor. Falha de instalacao nao bloqueia desenvolvimento (rg cobre fallback).
- **Risco baixo:** MCP/plugins sao so investigacao — zero impacto em codigo existente.
- **Nao toca apps/packages** — isolamento total.

---

## Compatibilidade Claude Code CLI

Tabela de classificacao cruzada entre OpenCode e Claude Code CLI:

| Item | Funciona no Claude CLI | Forma de uso | Recomendacao | Fase |
|---|---|---|---|---|
| `rg` / ripgrep | Sim | Shell / Grep tool | Uso imediato. `rg -l` (lista), `rg -n` (linha), `rg --files` | ✅ Concluido |
| `ast-grep` | Sim | Shell / Bash tool | Uso imediato. `ast-grep -p "PADRAO" --lang ts` | ✅ Concluido |
| LSP / Code Intelligence | Sim, mas diferente | **Claude:** plugin LSP (`typescript-language-server`). **OpenCode:** `lsp: true` no `opencode.json` | Claude: investigar instalacao do plugin. OpenCode: ja ativo | 🔍 Claude pendente |
| `CLAUDE.md` | Sim | Arquivo raiz do repo | Adaptar regras do AGENTS.md para Claude | 🔍 Pendente |
| Hooks Claude Code | Sim | `.claude/settings.json` via `hooks` | Investigacao separada (bloquear `git commit`, `.env*`) | 🔍 Debito separado |
| Serena MCP | Sim | MCP (`serena start-mcp-server`) | Debito separado. Setup pesado (Python/uv) | 🔍 `BL-ECOSYSTEM-SERENA` |
| codebase-memory-mcp | Sim | MCP (`codebase-memory-mcp`) | Debito separado. Promissor, projeto jovem | 🔍 `BL-ECOSYSTEM-CODEBASE-MEMORY` |
| OpenSlimedit | **Nao** | **Exclusivo OpenCode** (`plugin` no `opencode.json`) | Nao aplicavel ao Claude | ❌ OpenCode only |
| `opencode.json` (`compaction`, `watcher`, `permission`) | **Nao** | **Exclusivo OpenCode** | Nao misturar com config do Claude | ❌ OpenCode only |
| Sleev | Nao recomendado | Proxy MITM proprietario | Risco operacional e de seguranca | ❌ Rejeitado |

### Detalhamento por item

#### `rg` / ripgrep
- **Claude CLI:** disponivel via ferramenta Bash/Grep nativa.
- **OpenCode:** documentado no AGENTS.md (secao "Diagnostico local").
- **Uso recomendado:** `rg -l "termo" apps packages` (lista arquivos), `rg -n` (numero linha), `rg --files` (todos arquivos).
- **Evidencia:** `rg` v15.1.0 instalado (`C:\Users\paulo\AppData\Local\Microsoft\WinGet\Links\rg.exe`).

#### `ast-grep`
- **Claude CLI:** disponivel via Bash (comando global `ast-grep`).
- **OpenCode:** documentado no AGENTS.md.
- **Uso recomendado:** `ast-grep -p "PADRAO" --lang ts` para busca estrutural em TypeScript.
- **Evidencia:** `@ast-grep/cli` v0.44.0, npm global.

#### LSP / Code Intelligence
- **OpenCode:** `lsp: true` no `opencode.json`. Ja ativo. Documentado no AGENTS.md com limitacoes.
- **Claude Code:** plugin `typescript-lsp@claude-plugins-official`. Instalado via `/plugin install`, cacheado. Requer `typescript-language-server` no PATH. Fornece jump-to-definition, find-references, type errors.
- **Config repo:** `.claude/settings.json` com `enabledPlugins: { "typescript-lsp@claude-plugins-official": true }`.
- **Evidencia:** docs oficiais (`code.claude.com/docs/en/large-codebases`). `/reload-plugins` → 1 plugin LSP server ativo. `typescript-language-server` v5.3.0 global.
- **Classificacao:** implementado. Fase 6b concluida.

#### `CLAUDE.md`
- **Claude Code:** arquivo `CLAUDE.md` na raiz do repo (ou `.claude/CLAUDE.md`). Lido automaticamente em toda sessao. Sobrevive `/compact`. Recomendado < 200 linhas.
- **AGENTS.md integration:** Claude NAO le `AGENTS.md`. Solucao: `@AGENTS.md` no topo do `CLAUDE.md` (importa conteudo sem duplicar). `/init` detecta AGENTS.md automaticamente.
- **Evidencia:** docs oficiais (`code.claude.com/docs/en/memory`). `C:\Users\paulo\.codex\AGENTS.md` ja existe (criado pelo `codebase-memory-mcp install`). `C:\Users\paulo\.claude\skills\codebase-memory\SKILL.md` ja existe.
- **Conteudo proposto (adaptado do AGENTS.md):**
  - `@AGENTS.md` (importa governanca completa)
  - Regras Claude-especificas: nao ler repo inteiro, usar `rg`/`ast-grep` antes de abrir arquivos, `pnpm run lint` antes de declarar concluido, nao commitar sem autorizacao, parar e perguntar em duvida.
- **Classificacao:** implementado. Fase 6a concluida. `CLAUDE.md` na raiz (26 linhas).

#### Hooks do Claude Code
- **Configuracao:** `.claude/settings.json` (projeto, commitavel) ou `~/.claude/settings.json` (user, local).
- **Evento:** `PreToolUse` com matcher `Bash` + `if: "Bash(git commit *)"` para bloquear comandos especificos.
- **Schema (bloquear git commit/push):**
  ```json
  {
    "hooks": {
      "PreToolUse": [
        {
          "matcher": "Bash",
          "hooks": [
            {
              "type": "command",
              "if": "Bash(git commit *)",
              "command": "jq -n '{hookSpecificOutput:{hookEventName:\"PreToolUse\",permissionDecision:\"deny\",permissionDecisionReason:\"git commit bloqueado por hook\"}}'"
            }
          ]
        }
      ]
    }
  }
  ```
- **O que bloquear:** `git commit`, `git push`, `rm -rf`, acesso a `.env*` (`Bash(cat .env*)`).
- **Evidencia:** docs oficiais (`code.claude.com/docs/en/hooks`). `C:\Users\paulo\.claude\hooks\` ja tem hooks `cbm-*` + `caveman-*`. `C:\Users\paulo\.claude\.mcp.json` + `.claude.json` ja configurados.
- **Classificacao:** rejeitado. Mantenedor ja usa agents para controle de git commit/push. Fase 6c cancelada.

#### Serena MCP
- **Compatibilidade:** sim, via MCP (stdio: `serena start-mcp-server --context ide --project <path>`).
- **Classificacao:** debito `BL-ECOSYSTEM-SERENA`. Instalado localmente (v1.5.3), mas setup pesado.
- **Evidencia:** `opencode.json:24-28` (OpenCode MCP). `C:\Users\paulo\.claude\.mcp.json` (Claude MCP, configurado pelo `install`).

#### codebase-memory-mcp
- **Compatibilidade:** sim, via MCP (stdio: `codebase-memory-mcp`).
- **Classificacao:** debito `BL-ECOSYSTEM-CODEBASE-MEMORY`. Promissor (10.7k stars, paper arXiv), mas v0.8.1.
- **Evidencia:** `opencode.json:29-33` (OpenCode MCP). `C:\Users\paulo\.claude\.mcp.json` + `.claude.json` (Claude MCP, configurado pelo `install`). `AGENTS.md:307-329` (bloco instrucoes com marcadores HTML).

#### OpenSlimedit
- **Exclusivo OpenCode.** Plugin `"plugin": ["openslimedit@latest"]` no `opencode.json`.
- **Nao aplicavel ao Claude Code.**
- **Evidencia:** `opencode.json:21`.

#### `opencode.json` (`compaction`, `watcher`, `permission`)
- **Exclusivo OpenCode.** Configuracoes nativas do OpenCode sem equivalente no Claude.
- **Nao misturar com configuracao do Claude Code.**

#### Sleev
- **Nao recomendado** para nenhum ambiente.
- Motivo: proxy proprietario/intermediario (MITM), risco operacional e de seguranca.
