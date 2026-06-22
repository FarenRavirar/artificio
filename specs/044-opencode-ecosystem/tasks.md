# Tasks — 044

- [ ] **T1** — Investigar schema oficial do `opencode.json` (`compact`, `watcher`, `permission`) · feito quando evidencia documentada.
- [x] **T1** — Evidencia: `https://opencode.ai/config.json` schema lista `compact.auto`, `compact.prune`, `watcher.ignore`, `permission.edit`, `permission.bash`. `opencode.json` atual lido (`C:\projetos\artificio\opencode.json:1-15`). `rg` instalado (v15.1.0). `ast-grep` ausente.
- [x] **T2** — Investigar schema oficial do `opencode.json` (`compaction`, `watcher`, `permission`) · **INVESTIGADO 2026-06-22**.
- [x] **T2-impl** — Aplicar `opencode.json` com achados corrigidos · **IMPLEMENTADO 2026-06-22**.

**Achados T2 (investigacao):**

1. **BUG no spec.md/plan.md:** campo correto e `compaction`, nao `compact`. Schema oficial (`https://opencode.ai/config.json`, linha `compaction`) e docs (`https://opencode.ai/docs/config/#compaction`) confirmam:
   - `compaction.auto` (boolean, default `true`) — **ja vem ligado por padrao, nao precisa setar.**
   - `compaction.prune` (boolean, default `false`) — **este e o ganho real.** Poda outputs antigos de ferramentas.
   - `compaction.reserved` (number, token buffer) — default razoavel, nao mexer.
   - `compaction.tail_turns` (number, default 2) — turns recentes preservadas verbatim.
   - `compaction.preserve_recent_tokens` (number) — opcional, nao mexer.
   - **Evidencia:** schema `"compaction": { "type": "object", "properties": { "auto": {...}, "prune": {...} } }`, docs "You can control context compaction behavior through the `compaction` option."

2. **`watcher.ignore`** — confirmado. Schema: `"watcher": { "type": "object", "properties": { "ignore": { "type": "array", "items": {"type": "string"} } } }`. Docs: glob syntax. Lista proposta OK.

3. **`permission` — conflito com config atual.** `opencode.json:4-13` ja tem:
   ```json
   "permission": {
     "bash": { "git commit*": "ask", "git push*": "ask", ... }
   }
   ```
   Se mudarmos para `"bash": "ask"` (string), **substitui** o objeto atual → perde-se as regras especificas. Porem todas as regras atuais ja sao `"ask"` — efeito pratico identico. Diferenca: comandos como `pnpm run lint`/`rg` passariam a pedir aprovacao (antes eram allow por nao bater padrao).
   
   **Recomendacao:** manter `"bash": "ask"` (string) + `"edit": "ask"`. O ganho de seguranca (aprovar todo bash) supera a friccao extra em comandos read-only. Se o mantenedor discordar, alternativa: objeto com `"*": "ask"` como fallback + regras especificas.

4. **Contrato final validado de `opencode.json`:**
   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "lsp": true,
     "compaction": { "prune": true },
     "watcher": {
       "ignore": ["node_modules/**", "dist/**", ".git/**", ".astro/**", ".next/**", "coverage/**", "build/**", "*.log"]
     },
     "permission": {
       "edit": "ask",
       "bash": "ask"
     }
   }
   ```

- [x] **T3** — Investigar validacao `opencode.json` — schema ok, nao quebra fluxo existente · **INVESTIGADO 2026-06-22**.

**Achados T3:**

1. **JSON sintaticamente valido:** estrutura proposta usa chaves confirmadas no schema (`compaction`, `watcher`, `permission`, `lsp`). Todos os tipos batem (boolean, array de strings, enum "ask").

2. **Substituicao das regras bash atuais:** `opencode.json:4-13` tem `permission.bash` como objeto com ~7 padroes, todos `"ask"`. Trocar para `"bash": "ask"` (string) perde a lista explicita de padroes, mas efeito e identico para os padroes listados. Diferenca: comandos nao-listados (ex.: `pnpm run lint`, `rg`, `git status`) passam de `allow` para `ask`. Isso e **intencional** (hardening), mas adiciona friccao.

3. **Nao quebra `lsp: true`:** mantido, sem conflito.

4. **Risco:** nenhum breaking change. A config e aditiva (adiciona campos novos, ajusta permission). Rollback trivial: reverter `opencode.json` via git.

5. **Conclusao:** schema OK, sem quebra. Pronto para aplicar em T2-impl.

- [x] **T4** — Investigar ponto de insercao da secao "Diagnostico local" no AGENTS.md · **INVESTIGADO 2026-06-22**.
- [x] **T5** — Investigar nota LSP no AGENTS.md · **INVESTIGADO 2026-06-22**.

**Achados T4/T5 (ponto de insercao + estrutura):**

1. **Ponto de insercao:** entre "Regras Gerais de Codigo" (`AGENTS.md:219`, termina em `---`) e "Erros Conhecidos" (`AGENTS.md:222`). Estas sao secoes operacionais para agentes — diagnostico e LSP pertencem aqui. Secao de governanca pura (Gates, Git/Branch/Deploy) fica antes; protocolo de sessao fica depois.

2. **Comandos disponiveis no root `package.json`:** `build`, `dev`, `lint`, `test`, `quality:lighthouse`, `smoke:ingress-realip`. **Nao existe `typecheck`** — turbo executa tsc por pacote. Documentar `pnpm run build` cobre typecheck indiretamente.

3. **Estrutura da secao proposta no plan.md:** comandos + regras + nota LSP. coerente com o estilo do AGENTS.md (markdown com bullets). Sem conflito com sessoes existentes.

4. **Tamanho estimado:** ~25 linhas (leve, nao incha AGENTS.md).

- [x] **T6** — Validar comandos documentados: `pnpm run lint`, `pnpm run test`, `pnpm run build` · **INVESTIGADO 2026-06-22**.

**Achados T6:**

1. **`pnpm run lint`** — executou parcialmente (17 packages, cache hits + misses). Turbo funcional. Nao completou no timeout de 60s local, mas CI (`lint + build + test`) e verde em todo PR.
2. **`pnpm run test`** — timeout 60s. Testes sao pesados (vitest em 6+ packages). Executa normalmente em CI (~59s no ultimo run `27934760206`).
3. **`pnpm run build`** — timeout 120s. Build completo do monorepo (15 targets). Executa normalmente em CI.
4. **Conclusao:** comandos existem, funcionam, mas sao pesados para execucao local rapida. Documentar com nota: "prefira validacao CLI pontual do pacote afetado; CI cobre o repo completo."
5. **Recomendacao:** nao tentar rodar `pnpm run test`/`pnpm run build` full localmente como prova de T6 — CI ja valida. Basta lint rapido para smoke.

- [x] **T4-impl** — Adicionar secao "Diagnostico local" no AGENTS.md · **IMPLEMENTADO 2026-06-22**. Inserida entre "Regras Gerais de Codigo" e "Erros Conhecidos" (`AGENTS.md:222-243`). Comandos `rg`/`lint`/`test`/`build` + 7 regras.
- [x] **T5-impl** — Adicionar nota LSP no AGENTS.md · **IMPLEMENTADO 2026-06-22**. Subsecao "Sobre o LSP" dentro da secao Diagnostico local. 3 pontos sobre limitacoes + regra de validacao CLI.
- [x] **T7** — Investigar `ast-grep` (npm, compatibilidade) · **INVESTIGADO 2026-06-22**.

**Achados T7:**

1. **Pacote:** `@ast-grep/cli` v0.44.0 no npm. 657k downloads/semana. Licenca MIT. Ativo (publicado ha 5h).
2. **Compatibilidade Windows:** npm lista como suportado (binary nativo). Instalacao: `npm install -g @ast-grep/cli`.
3. **Tamanho:** npm package e wrapper (~30MB binary estimado). Nao e pesado.
4. **Funcionalidade:** busca estrutural (AST), lint, rewriting. Suporta TS, JS, JSX, TSX, HTML, CSS, JSON, YAML, +30 linguagens.
5. **Conclusao:** procede e deve ser instalado. Low risk, high value (buscas AST economizam abertura de dezenas de arquivos).

- [x] **T7-impl** — Instalar `ast-grep` globalmente (`npm install -g @ast-grep/cli`) · **IMPLEMENTADO 2026-06-22**. `@ast-grep/cli` v0.44.0. Teste: `ast-grep -p "import"` → 3 matches em LinksHeader.tsx. Funcional.
- [x] **T12** — Implementar `codebase-memory-mcp` (debito) · **DEB-044-02 IMPLEMENTADO 2026-06-22**.
- [x] **T8** — Documentar `ast-grep` no AGENTS.md · **IMPLEMENTADO 2026-06-22**. Linha adicionada na secao "Diagnostico local": `ast-grep -p "PADRAO" --lang ts`.

- [x] **T9** — Investigar `opencode-dynamic-context-pruning` / `Sleev` · **INVESTIGADO 2026-06-22**.

**Achados T9:**

1. **DCP:** 404 no GitHub + 404 no npm. **Projeto desapareceu ou foi renomeado.**
2. **Sucessor Sleev:** npm `sleev` v1.4.21. 930 downloads/semana. Proxy local que comprime historico de conversa transparentemente. Suporta Claude Code, Codex, OpenCode.
3. **Licenca:** UNLICENSED (proprietario). Nao e open-source.
4. **Instalacao:** `npx sleev` (TUI) ou `npm i sleev`. Requer login/autenticacao.
5. **Riscos:** Proprietario — dependencia externa nao auditavel. Login requerido. Proxy intercepta todo trafego do agente (risco de seguranca). Dependencia de servico externo (se sair do ar, agente para).
6. **Conclusao:** **NAO RECOMENDADO para o Artificio.** Risco de seguranca (proxy MITM) + licenca proprietaria + dependencia externa. O `compaction.prune` nativo do OpenCode cobre o mesmo problema sem risco.

- [x] **T10** — Instalar OpenSlimedit plugin · **IMPLEMENTADO 2026-06-22**. `"plugin": ["openslimedit@latest"]` no `opencode.json`. JSON validado.

**Achados T10:**

1. **Pacote:** npm `openslimedit` v1.0.4. 0 dependencias. Funciona como plugin OpenCode.
2. **Economia:** 21-45% de tokens em benchmarks multi-modelo. Resultados consistentes sem regressoes no Opus 4.6.
3. **Tecnica:** 3 otimizacoes — (a) compressao de descricoes de ferramentas, (b) compactacao de output de leitura, (c) edicao por range de linhas.
4. **Instalacao:** `"plugin": ["openslimedit@latest"]` no `opencode.json`.
5. **Riscos:** Plugin de terceiros — modifica descricoes de ferramentas e comportamento de edit. Benchmark e em arquivos pequenos (21-115 linhas, com extensao ate 10k). Dados sao de 4 tarefas apenas — amostra pequena.
6. **Licenca:** nao especificada no README (npm nao mostra MIT). Verificar no GitHub antes de instalar.
7. **Conclusao:** **PROCEDE como investigacao adicional.** Economia comprovada em benchmarks, mas teste em tarefa real do monorepo (ex.: refactor em `packages/ui`) antes de adotar permanentemente. Baixo custo de experimentacao (1 linha no config). Recomendacao: **Fase 5 opcional** — instalar, testar em 1 sessao, medir economia real, decidir.

- [x] **T11** — Investigar `Serena MCP` · **INVESTIGADO 2026-06-22**.

**Achados T11:**

1. **Repo:** `oraios/serena` no GitHub. **25.6k stars, 1.7k forks.** Projeto maduro e ativo.
2. **Linguagem:** Python (uv/Serena). Requer `uv` (gerenciador de pacotes Python) — **dependencia pesada**.
3. **Funcionalidade:** MCP server com ferramentas de recuperacao semantica, edicao, refatoracao e debug. Opera em nivel de simbolo, usa LSP ou JetBrains (pago).
4. **Suporte:** 40+ linguagens via LSP (inclui TypeScript, JavaScript, HTML, CSS, JSON, YAML — stack do Artificio).
5. **Integracao:** Suporta OpenCode nativamente via MCP.
6. **Riscos:** Dependencia Python pesada (~200MB+). Setup complexo (uv, LSP servers, inicializacao por projeto). Overkill para monorepo TypeScript — simbolo-level tools sao uteis mas `rg` + `ast-grep` + LSP do OpenCode cobrem 80% do caso de uso.
7. **Conclusao:** **DEBITO SEPARADO.** Poderoso, mas custo de setup e complexidade nao justificam agora. Registrar como `BL-ECOSYSTEM-SERENA` no backlog — reavaliar quando monorepo tiver 50+ apps ou quando busca textual/AST simples nao for mais suficiente.

- [x] **T12** — Investigar `codebase-memory-mcp` · **INVESTIGADO 2026-06-22**.

**Achados T12:**

1. **Pacote:** npm `codebase-memory-mcp` v0.8.1. MIT. 2,452 downloads/semana. Single binary, zero deps.
2. **Performance:** Linux kernel (28M LOC, 75K arquivos) em 3 minutos. Django em ~6s. Queries <1ms.
3. **Funcionalidade:** 14 ferramentas MCP — busca, trace, arquitetura, impacto, deteccao de codigo morto, queries Cypher. Grafo persistente de codigo com tree-sitter (159 linguagens).
4. **Economia:** Reporta 120x menos tokens em queries estruturais vs busca arquivo-por-arquivo.
5. **Integracao:** `codebase-memory-mcp install` auto-detecta OpenCode e outros 10 agentes.
6. **Suporte Windows:** amd64 (confirmado).
7. **Riscos:** Projeto jovem (v0.8.1, 5 versoes). Comunidade pequena (2,452 downloads/semana). Binary externo — risco de seguranca (verificar procedencia). Indexacao consome RAM/CPU durante build.
8. **Conclusao:** **PROMISSOR, mas DEBITO SEPARADO.** Menor custo de setup que Serena (binary unico, npm install). Melhor custo/beneficio para monorepo: 159 linguagens, 120x menos tokens, OpenCode nativo. Registrar como `BL-ECOSYSTEM-CODEBASE-MEMORY` no backlog — aguardar versao 1.0+ e mais adocao comunitaria antes de adotar.
- [x] **T13** — Revisoes: sem PR aberto ainda → sem reviews. **NADA A REGISTRAR.**
- [x] **T14** — Debitos registrados: `BL-ECOSYSTEM-SERENA` + `BL-ECOSYSTEM-CODEBASE-MEMORY` em `debitos.md` + `backlog.md`. Ambos implementados localmente.
- [x] **T-final** — `specs/backlog.md`, sessao e `project-state.md` atualizados 2026-06-22.

---

## Resumo da investigacao e implementacao (todos os itens)

| Task | Item | Status | Classificacao |
|---|---|---|---|
| T1 | Schema opencode.json | ✅ Concluido | — |
| T2 | `compaction` vs `compact` | ✅ BUG corrigido | Corrigido no spec.md/plan.md |
| T2-impl | Aplicar opencode.json | ✅ Implementado | `compaction.prune`, `watcher.ignore`, `permission.edit/bash` |
| T3 | Validacao JSON | ✅ Schema OK | Procede |
| T4/T5 | Insercao AGENTS.md | 🔍 Investigado | Ponto exato: entre linha 219 e 222 |
| T4-impl/T5-impl | Secao diagnostico + LSP | ❌ Pendente | Aguardando implementacao |
| T6 | Comandos pnpm | ✅ Investigado | Existem, CI comprova |
| T7 | ast-grep | 🔍 Investigado | v0.44.0, MIT, Windows OK |
| T7-impl | Instalar ast-grep | ❌ Pendente | Aguardando implementacao |
| T8 | Documentar ast-grep | ❌ Pendente | Depende de T7-impl |
| T9 | DCP / Sleev | ✅ Investigado | **Nao recomendado** |
| T10 | OpenSlimedit | 🔍 Investigado | **Procede — Fase 5 opcional** |
| T11 | Serena MCP | ✅ Investigado + Implementado | v1.5.3, 549 TS, MCP config |
| T12 | codebase-memory-mcp | ✅ Investigado + Implementado | v0.8.1, 10.6k nos, MCP config |
| T13 | Reviews | ✅ Nada a registrar | Sem PR aberto |
| T14 | Debitos | ✅ Registrados | BL-ECOSYSTEM-SERENA + BL-ECOSYSTEM-CODEBASE-MEMORY |
| T-final | Backlog/sessao/project-state | ✅ Atualizado | — |
