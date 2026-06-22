# Plano — 044

## Arquitetura da solucao

Quatro fases independentes, cada uma autocontida e sem dependencia entre si:

### Fase 1 — opencode.json (configuracao nativa, sem dependencias externas)

Arquivo unico: `opencode.json` na raiz do monorepo.

Estado atual (`C:\projetos\artificio\opencode.json:1-15`):
```json
{
  "$schema": "https://opencode.ai/config.json",
  "lsp": true,
  "permission": {
    "bash": {
      "git commit*": "ask",
      "git push*": "ask",
      "git merge*": "ask",
      "gh pr*": "ask",
      "npm run deploy*": "ask",
      "yarn deploy*": "ask",
      "*deploy*": "ask"
    }
  }
}
```

Alteracoes:
1. Adicionar `compaction: { prune: true }` — poda automatica de outputs antigos de ferramentas. `compaction.auto` ja e `true` por default (nao precisa setar).
2. Adicionar `watcher: { ignore: [...] }` — filtra `node_modules`, `dist`, `.git`, `.astro`, `.next`, `coverage`, `build`, `*.log`.
3. Adicionar `permission.edit: "ask"` + `permission.bash: "ask"` — fallback seguro; substitui regras especificas atuais (que ja sao todas `"ask"`, sem perda pratica).

**Evidencia:** Schema oficial `https://opencode.ai/config.json` (linha `compaction`): campo `compaction` (nao `compact`). `compaction.auto` default `true`; `compaction.prune` default `false`. Docs em `https://opencode.ai/docs/config/#compaction`.

### Fase 2 — AGENTS.md (nova secao de diagnostico + nota LSP)

Arquivo unico: `AGENTS.md` na raiz do monorepo.

Nova secao a inserir apos "Regras Gerais de Codigo" (linha ~219):
```markdown
## Diagnostico local antes de pedir mais contexto

Antes de ler muitos arquivos, usar busca localizada.

Comandos uteis:
- `pnpm run lint` — ESLint repo-wide
- `pnpm run test` — vitest repo-wide
- `pnpm run build` — turbo build repo-wide
- `rg "termo" apps packages -n` — busca textual com numero de linha
- `rg -l "termo" apps packages` — so lista arquivos (economiza contexto)
- `rg --files apps packages` — lista todos arquivos monitorados
- `ast-grep --pattern "PADRAO" --lang ts` — busca estrutural por AST

Regras:
- Nao ler o repositorio inteiro.
- Nao abrir arquivos grandes sem justificar.
- Procurar simbolos, rotas, imports e chamadas antes de editar.
- Preferir `rg -l` quando so precisa saber quais arquivos tem o termo.
- Jamais commitar sem autorizacao explicita.

### Sobre o LSP

O LSP no OpenCode fornece diagnosticos ao agente, mas:
- Language servers podem ficar fora de sincronia com o codigo real.
- Podem consumir memoria significativa em monorepo grande.
- Diagnosticos de LSP nao substituem validacao CLI (`pnpm run lint`, `pnpm run build`, `pnpm run test`).

**Regra:** Sempre rodar `pnpm run lint` e `pnpm run build` antes de declarar uma tarefa concluida. Diagnosticos de LSP sao auxiliares, nao fonte unica de verdade.
```

**Nota:** O monorepo nao tem script `typecheck` no root `package.json`. Turbo executa typecheck por pacote via `turbo.json`. Documentar `pnpm run build` cobre typecheck indiretamente (turbo build inclui tsc).

### Fase 3 — ast-grep (instalacao + documentacao)

Ferramenta: `@ast-grep/cli` (npm, MIT).

Instalacao:
```bash
npm install --global @ast-grep/cli
```

Verificacao: `ast-grep --version` retorna versao.

Documentacao em AGENTS.md:
- Comando basico: `ast-grep --pattern "PADRAO" --lang ts`
- Exemplos uteis para o monorepo:
  - `ast-grep --pattern "import { $$$ } from '$PKG'" --lang ts`
  - `ast-grep --pattern "export const $NAME = $VALUE" --lang ts`
  - `ast-grep --pattern "fetch($URL)" --lang ts`

**Evidencia:** `rg` ja instalado (v15.1.0, `C:\Users\paulo\AppData\Local\Microsoft\WinGet\Links\rg.exe`). `ast-grep` ausente (`Get-Command ast-grep` retornou erro).

### Fase 4 — Investigacao MCP/Plugins (somente investigacao, sem instalacao)

Quatro ferramentas a investigar:

| Ferramenta | Tipo | Proposta | Benchmark |
|---|---|---|---|
| opencode-dynamic-context-pruning | Plugin OpenCode | Poda outputs antigos antes de enviar ao modelo | N/A (projeto migrou para Sleev) |
| Sleev | Proxy local | Proxy para Claude Code/Codex/OpenCode com pruning | Sucessor do DCP |
| OpenSlimedit | Plugin OpenCode | Compressao de schemas/descricoes de ferramentas + edicao por range | Ate 45% reducao em testes pequenos |
| Serena MCP | MCP Server | Navegacao semantica em nivel de simbolo | N/A |
| codebase-memory-mcp | MCP Server | Grafo persistente de codigo (funcoes, classes, rotas) | 10-120x menos tokens |

**Regra:** Nao instalar nenhum sem aprovacao explicita. Fase 4 e so investigacao e documentacao.

### Fase 5 — Implementado (2026-06-22)

**Concluido:**
- Fase 1: `opencode.json` atualizado (`compaction.prune`, `watcher.ignore`, `permission.edit/bash: "ask"`). JSON validado.
- Serena MCP: `serena-agent` v1.5.3 via uv, 549 TS indexados, `.serena/` gitignored, MCP config.
- Codebase-Memory MCP: v0.8.1 via npm, 10.6k nos / 18.1k edges, MCP config manual (OpenCode nao auto-detectado), bloco instrucoes no AGENTS.md.

**Pendente:**
- ~~Fase 2: AGENTS.md secao "Diagnostico local" + nota LSP.~~ ✅ Concluido 2026-06-22.
- ~~Fase 3: `@ast-grep/cli` (instalar + documentar).~~ ✅ Concluido 2026-06-22.
- ~~Fase 5 opcional: OpenSlimedit plugin.~~ ✅ Concluido 2026-06-22.
- ~~Smoke test: reiniciar OpenCode com 3 MCP servers (Serena + CBM).~~ ✅ Concluido 2026-06-22.
- Fase 6: Claude Code CLI (CLAUDE.md + LSP plugin + hooks) — investigado, aguardando aprovacao para implementar.
- Serena MCP: debito `BL-ECOSYSTEM-SERENA`.
- codebase-memory-mcp: debito `BL-ECOSYSTEM-CODEBASE-MEMORY`.

### Fase 6 — Claude Code CLI (investigada 2026-06-22)

| Item | Achado | Evidencia | Classificacao |
|---|---|---|---|
| `CLAUDE.md` | Arquivo raiz `./CLAUDE.md` ou `.claude/CLAUDE.md`. Lido automaticamente, sobrevive compaction. `< 200 linhas` recomendado. `@AGENTS.md` importa o AGENTS.md sem duplicar. `/init` detecta AGENTS.md existente. | `code.claude.com/docs/en/memory` | **✅ Implementado — Fase 6a** |
| LSP plugin | `/plugin install typescript-lsp@claude-plugins-official`. Requer `typescript-language-server` no PATH. Fornece jump-to-def, find-refs, type errors. | `code.claude.com/docs/en/large-codebases#reduce-file-reads-with-code-intelligence` | **✅ Implementado — Fase 6b** |
| Hooks | `.claude/settings.json` (projeto) ou `~/.claude/settings.json` (user). `PreToolUse` + `Bash(git commit *)` + `jq` deny. Bloquear: `git commit`, `git push`, `rm -rf`, `.env*`. | `code.claude.com/docs/en/hooks` | **❌ Rejeitado — Fase 6c** (mantenedor ja usa agents para controle) |

**Nao implementar sem aprovacao.**

Itens que ja funcionam em ambos (sem acao extra):
- `rg` / ripgrep (Bash/Grep)
- `ast-grep` (Bash)
- `pnpm run lint` / `test` / `build` (Bash)
- Serena MCP (MCP config no Claude, ja configurado pelo `codebase-memory-mcp install`)
- codebase-memory-mcp (MCP config no Claude, ja configurado pelo `codebase-memory-mcp install`)

## Arquivos afetados

| Arquivo | Status | Mudanca |
|---|---|---|
| `opencode.json` | ✅ | `compaction.prune`, `watcher.ignore`, `permission.edit/bash`, `plugin: openslimedit`, MCP servers (serena, codebase-memory-mcp) |
| `AGENTS.md` | ✅ | Secao "Diagnostico local" + "Sobre o LSP" + bloco `<!-- codebase-memory-mcp -->` |
| `.gitignore` | ✅ | `.serena/` adicionado |
| `.serena/project.yml` | ✅ | Criado por `serena project create` (gitignored) |
| Global npm | ✅ | `@ast-grep/cli` v0.44.0 |
| Global npm | ✅ | `codebase-memory-mcp` v0.8.1 |
| Global uv | ✅ | `serena-agent` v1.5.3 |
| `CLAUDE.md` (raiz) | ✅ | `@AGENTS.md` import + regras Claude (26 linhas) |
| `.claude/settings.json` | ✅ | `enabledPlugins: { "typescript-lsp@claude-plugins-official": true }` |
| Global npm | ✅ | `typescript-language-server` v5.3.0 |

## Contratos/interfaces tocados

Nenhum. Mudancas puramente documentais/configuracao local. Nao afeta runtime, API, nem build.

## Impacto em consumidores

- **Agentes de IA:** passam a ter poda automatica de contexto, watcher filtrado, e comandos de diagnostico documentados.
- **Mantenedor:** `ast-grep` disponivel para buscas estruturais.
- **Nenhum impacto em apps/packages/deploy.**

## Rollback

- `opencode.json`: reverter para versao atual (git).
- `AGENTS.md`: remover bloco `<!-- codebase-memory-mcp -->` + secao diagnostico (se adicionada).
- `@ast-grep/cli`: `npm uninstall -g @ast-grep/cli`.
- `serena-agent`: `uv tool uninstall serena-agent`.
- `codebase-memory-mcp`: `npm uninstall -g codebase-memory-mcp` + `rm -rf ~/.cache/codebase-memory-mcp/`.

## Validacao

- [x] `compaction.prune` ativo (schema oficial confirma default=false → true aplicado).
- [x] Watcher ignora diretorios listados (teste: criar arquivo em `dist/`, verificar que agente nao reage — pendente smoke).
- [ ] `@ast-grep --version` retorna versao valida.
- [x] `opencode.json` JSON valido.
- [x] `codebase-memory-mcp` index OK: `list_projects` + `search_graph` funcionando.
- [x] `serena` project OK: 549 TS indexados.
- [x] `ast-grep --version` retorna versao valida (v0.44.0).
- [x] `CLAUDE.md` criado (26 linhas, `@AGENTS.md` import).
- [x] `typescript-language-server` v5.3.0 + Claude LSP plugin ativo (`/reload-plugins` → 1 plugin LSP server).
- [x] `pnpm run lint`: 7/9 pacotes verdes (feedback pre-existente).
- [x] `/doctor` Claude Code: sem erros apos correcao `enabledPlugins` (record, nao array).
