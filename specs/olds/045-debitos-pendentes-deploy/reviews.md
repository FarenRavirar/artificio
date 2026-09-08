# Reviews — 045 (PR #85)

> Veredicto por achado de revisão. Governança: agente NÃO responde bots no PR; veredicto vive aqui.

## PR #85

| # | Bot | Achado | Bug real? | Veredicto |
|---|---|---|---|---|
| 1 | amazon-q-developer | "Logic Error: trocar `artifacts/lighthouse/`→`artifacts/` não destrackeia os 16 já no índice; falta `git rm --cached`." | **NÃO — falso positivo** | O `git rm --cached` dos 16 JÁ foi feito no commit `289364d` (16 `delete mode`/name-status `D`). Prova: `git ls-files artifacts/` = **0** na branch. O bot revisou só o diff do `.gitignore`, não o commit que contém as remoções do índice. Nenhuma ação. |
| 2 | chatgpt-codex-connector | "P2: tornar uso do grafo MCP condicional — `AGENTS.md` manda `ALWAYS prefer MCP graph tools`, mas o server `codebase-memory-mcp` não é versionado (`opencode.json` gitignored); clones/Codex/reviewers não têm as ferramentas." | **SIM — procede** | Válido. `AGENTS.md` bloco auto-gerado tinha `ALWAYS` incondicional. Fix: `ALWAYS`→`When these MCP graph tools are available` + nota durável **fora** dos marcadores `start/end` (sobrevive a regen) explicando que MCP não é versionado e o baseline é grep/glob. Fix durável da incondicionalidade no template do gerador = follow-up (o bloco regenera). Commit no PR #85. |

### Evidência (FP #1)
- `git ls-files artifacts/` → `0`
- `git show 289364d --name-status --diff-filter=D` → 16 arquivos `D` (15 `artifacts/033/*` + 1 `artifacts/cloudinary/*`)
- `.gitignore:45` → `artifacts/` (linha única, sem duplicata)
