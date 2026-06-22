# Debitos — 044

Debitos acionaveis tambem devem aparecer em `specs/backlog.md`.

| ID | Titulo | Origem | Task | Review | Severidade | Prioridade | Status | Backlog |
|---|---|---|---|---|---|---|---|---|
| DEB-044-01 | Investigar/avaliar Serena MCP para navegacao semantica | spec 044 T11 | T11 | — | Baixa | Baixa | aberto | `BL-ECOSYSTEM-SERENA` |
| DEB-044-02 | Investigar/avaliar codebase-memory-mcp para grafo persistente | spec 044 T12 | T12 | — | Baixa | Baixa | aberto | `BL-ECOSYSTEM-CODEBASE-MEMORY` |

## DEB-044-01 — Investigar/avaliar Serena MCP

- **Origem:** Spec 044 T11 — investigacao de ferramentas MCP para ecossistema de desenvolvimento.
- **Task vinculada:** T11
- **Review vinculado:** —
- **Evidencia aprofundada (2026-06-22):**
  - **OpenCode compat:** Serena lista "opencode" em "Terminal-Based Clients", mas refere-se a `sst/opencode` (projeto diferente), NAO ao `anomalyco/opencode` usado pelo Artificio. Nao ha documentacao especifica de integracao com OpenCode (anomalyco). Caminho: usar contexto `ide` generico + `serena start-mcp-server --context ide --project <path>`.
  - **Monorepo:** Suporte nativo via `additional_workspace_folders` no `project.yml` para cross-package references. **TypeScript e a unica linguagem com suporte a cross-package references.** Relevante para Artificio (monorepo TS). Porem cada workspace folder adicional aumenta startup time.
  - **Setup real:** (1) instalar `uv` (Python), (2) `uv tool install -p 3.13 serena-agent`, (3) `serena init`, (4) `serena project create --language typescript`, (5) `serena project index`, (6) configurar MCP no OpenCode (stdio: `serena start-mcp-server --context ide --project C:\projetos\artificio`), (7) onboarding por projeto. Multiplos arquivos de config: `serena_config.yml` + `.serena/project.yml` + `.serena/project.local.yml`.
  - **Dependencias:** Python ~200MB (uv + Serena) + TypeScript language server (ja presente no Node do projeto). Nao requer Docker.
  - **Hooks:** Serena tem sistema de hooks para Claude Code/VSCode/Codex — nada documentado para OpenCode. Possivel drifts de ferramenta sem hooks.
- **Impacto real (revisado):** Navegacao semantica cross-package em monorepo TS e o valor real. `find_referencing_symbols` que atravessa `apps/*` e `packages/*` seria util. Porem `rg` + `ast-grep` + LSP do OpenCode + grep do proprio agente cobrem ~90% dos casos de uso diarios. O ganho marginal (10%) nao justifica o custo de setup (~1-2h inicial + manutencao continua).
- **Severidade:** Baixa.
- **Prioridade:** Baixa — reavaliar quando: (a) monorepo tiver 30+ packages/apps, (b) cross-package refactors forem frequentes, (c) OpenCode (anomalyco) tiver integracao documentada com Serena.
- **Status:** implementado local (2026-06-22) — `serena-agent` v1.5.3, 549 arquivos TS indexados, MCP config no `opencode.json`, `.serena/` gitignored.
- **Backlog geral:** sim (`BL-ECOSYSTEM-SERENA`)
- **OpenCode:** ja configurado (`opencode.json` MCP + `serena project`).
- **Claude Code:** configurado 2026-06-22 via `claude mcp add` (scope `local`, gravado em `~/.claude.json` por projeto — **não-versionado**). Smoke real OK nesta data (`find_symbol("fetchOgImage")` → `apps/links/server/lib/og.ts:48-80`; `list_memories` → 1). Contexto `ide-assistant` (Claude Code), distinto do `ide` do OpenCode.
- **Ativação para AGENTE FRIO (Claude Code, clone novo):** o registro vive em `~/.claude.json` (gitignored) → clone limpo **não** tem Serena. Para ativar: (1) `serena` instalado (`uv tool install -p 3.13 serena-agent`); (2) `claude mcp add serena -- serena start-mcp-server --context ide-assistant --project C:/projetos/artificio` (forward slashes — bash come backslash); (3) **reiniciar a sessão Claude Code** (MCP carrega no startup). Verificar: `claude mcp get serena` → `✔ Connected`. Reverter: `claude mcp remove serena -s local`. Sem isso, baseline = `rg`/glob + `codebase-memory-mcp` (ver bloco "Semantic Symbol Navigation (Serena MCP)" no `AGENTS.md`).
- **Criterio de resolucao:** smoke test em sessao real (ambos agentes). · ✅ OpenCode + Claude Code 2026-06-22.
- **Decisao do mantenedor 2026-06-22:** Instalar localmente (uv + serena-agent), `.serena/` inteiro no `.gitignore`, OpenCode MCP config no `opencode.json`. Sem commit de configs do Serena.
- **Implementacao 2026-06-22:** `uv tool install -p 3.13 serena-agent` → v1.5.3 (73 pacotes Python). `serena init` → `C:\Users\paulo\.serena\serena_config.yml`. `serena project create --language typescript` → `.serena/project.yml`. `serena project index` → 549 arquivos TS em 17s. `.serena/` adicionado ao `.gitignore`. MCP config `"serena"` adicionada ao `opencode.json` (tipo `local`, comando `serena start-mcp-server --context ide --project C:\projetos\artificio`). Proximo passo: reiniciar OpenCode para carregar MCP server.

## DEB-044-02 — Investigar/avaliar codebase-memory-mcp

- **Origem:** Spec 044 T12 — investigacao de ferramentas MCP para ecossistema de desenvolvimento.
- **Task vinculada:** T12
- **Review vinculado:** —
- **Evidencia aprofundada (2026-06-22):**
  - **Maturidade REAL (muito alem do v0.8.1):** 10.7k estrelas, 805 forks, 863 commits, 5604 testes passando, artigo academico no arXiv (2603.27277). Publicado em npm, PyPI, Homebrew, Scoop, Winget, Chocolatey, AUR. CI ativo, OpenSSF Scorecard, SLSA Level 3, VirusTotal 70+ engines (zero deteccoes).
  - **OpenCode integracao:** `install` auto-detecta OpenCode e configura `opencode.json` (MCP entry) **E** `AGENTS.md` (instrucoes). **RISCO: `install` modifica AGENTS.md** — pode corromper governanca do Artificio. Solucao: config MCP manual (so `opencode.json`), pular `install`.
  - **TypeScript suporte:** Tier "Excellent" (90%+). Hybrid LSP para TypeScript: generics, JSX component dispatch, JSDoc, `.d.ts`, module re-exports, method chaining. 158 linguagens, 11 com Hybrid LSP completo.
  - **Performance no Artificio:** Tree-sitter index em ~6-10s (Django = 6s para 49K nos). Auto-sync watcher detecta mudancas via git. DB SQLite em `~/.cache/codebase-memory-mcp/`.
  - **Seguranca:** 100% local (zero rede apos download). Binary estatico unico. Assinado (cosign), checksum SHA-256.
  - **Setup:** `npm install -g codebase-memory-mcp` + config manual no `opencode.json`. Sem Python, sem Docker, sem deps. `.codebase-memory/` (artifact opcional) pode ser gitignored.
  - **Coexistencia com Serena:** Ferramentas diferentes, sem overlap. Serena = IDE symbol-level (find refs, rename). CBM = graph intelligence (trace paths, arquitetura, dead code, Cypher). Rodam juntos.
- **Impacto real (revisado):** MUITO superior ao esperado. 14 ferramentas MCP: `search_graph`, `trace_path`, `get_architecture`, `query_graph` (Cypher), `detect_changes` (git diff → impacto), `search_code`, dead code detection, cross-service HTTP linking. 120x menos tokens comprovado em benchmarks academicos. Valor direto para monorepo: `trace_path` cross-package, `get_architecture` automatico, `detect_changes` pre-commit.
- **Severidade:** Media (oportunidade real, nao so possibilidade).
- **Prioridade:** Media — instalar com cautela (config manual, nao usar `install` que mexe no AGENTS.md).
- **Riscos identificados:**
  1. ~~`codebase-memory-mcp install` modifica AGENTS.md~~ → **RESOLVIDO.** Usa marcadores HTML (`<!-- codebase-memory-mcp:start -->` / `<!-- end -->`). Appende, nao sobrescreve. Uninstall reverte. Seguro.
  2. v0.8.1 — breaking changes possiveis entre versoes. Atualizar com `codebase-memory-mcp update`.
  3. Binary externo — mitigado por VirusTotal 0 deteccoes + SLSA 3 + cosign + checksum.
  4. Indexacao consome RAM durante build inicial — monorepo Artificio (~549 arquivos TS) e leve.
- **Status:** implementado local (2026-06-22) — v0.8.1 instalado via npm, 10.6k nos / 18.1k edges em 4.1s, MCP no `opencode.json`, bloco instrucoes no `AGENTS.md`, OpenCode nao auto-detectado (config manual).
- **Backlog geral:** sim (`BL-ECOSYSTEM-CODEBASE-MEMORY`)
- **OpenCode:** ja configurado (`opencode.json` MCP manual).
- **Claude Code:** ja configurado (`.claude/.mcp.json` + `.claude.json` pelo `cbm install`). MCP server reutilizado.
- **Criterio de resolucao:** smoke test em sessao real (ambos agentes).
- **Revisao 2026-06-22:** Recomendacao inicial ("aguardar v1.0") REVISADA. Maturidade real (10.7k stars, 863 commits, SLSA 3) justifica instalar. Install usa marcadores HTML no AGENTS.md (seguro). Porem `install` nao auto-detectou OpenCode no Windows (npm global `.ps1` shim) → MCP adicionado manualmente ao `opencode.json`.
- **Implementacao 2026-06-22:** `npm install -g codebase-memory-mcp` v0.8.1. `install` detectou 6 agentes (Claude Code, Codex, Gemini, VS Code, Cursor, Kiro) — OpenCode ausente. MCP manual + bloco instrucoes no AGENTS.md. Index: 1097 arquivos, 10627 nos, 18119 edges em 4168ms. `search_graph("*Header*", Function)` → 13 funcoes com assinatura/callers/complexity. Proximo: reiniciar OpenCode + testar MCP tools na sessao.
