---
name: ferramentas-mcp
description: Mecânica das ferramentas do repo — tabela de comandos do rtk por categoria, pegadinhas já medidas, e o detalhe de cada MCP (LSP, codebase-memory-mcp, artificio-api-governance, cloudflare, opencode/DeepSeek). Use quando for rodar comando de build/lint/test/git e não souber a forma correta, quando um comando `rtk` falhar de modo estranho, ao configurar ou diagnosticar MCP, ou antes de delegar trabalho ao opencode/DeepSeek. A ordem de uso das ferramentas e a trava de acionar outro agente ficam no `AGENTS.md`, não aqui.
---

# Ferramentas MCP / Agentes — mecânica

O `AGENTS.md` guarda a **ordem de uso** (qual ferramenta vem antes de qual) e a
**trava de autorização** (acionar outro agente exige aprovação nominal). Este
documento guarda o **como**: sintaxe, tabela de comandos, pegadinhas medidas e
config por cliente.

**O que já é cobrado por hook, e por isso não depende de memória:** o
`rtk-enforce.js` tem 8 regras que bloqueiam o comando cru e devolvem a forma
correta no motivo do deny — entre elas `rtk grep` em diretório, `rtk diff`
solto, `pnpm <script>` sem `run`, `rtk lint`/`rtk tsc` na raiz e leitura
integral de arquivo grande. A tabela abaixo explica o *porquê*; o cumprimento
é mecânico.

## rtk — proxy CLI de compressão de saída (T1, ref. `rtk_readme.md`)

- Função: filtra/comprime saída de comando shell antes de chegar ao contexto do agente (até -90% bytes). Usar sempre que disponível no lugar do comando cru equivalente — trava resumida em §T0.
- Verificação de sessão: `rtk --version` / `rtk gain` (se falhar, tratar como indisponível e cair pro fallback cru — não travar a sessão).

**Comandos obrigatórios por categoria:**

| Categoria | Comando rtk | Substitui |
|---|---|---|
| Arquivos | `rtk ls .` | `ls`/`tree` |
| Arquivos | `rtk read <arquivo>` | `cat`/leitura crua de arquivo grande |
| Arquivos | `rtk find "<padrão>" <path>` | `find` |
| Arquivos | `rtk rg "<padrão>" <path>` (preferir a `rtk grep`, que sem `-r` cai no grep nativo) | `grep`/`rg` cru |
| Git | `rtk git status` | `git status` |
| Git | `rtk git log -n <N>` | `git log` |
| Git | `rtk git diff` | `git diff` |
| Git | `rtk git push` | `git push` (saída vira `ok <branch>`) |
| Testes | `rtk jest` / `rtk vitest` / `rtk pytest` / `rtk go test` / `rtk cargo test` | runner de teste cru |
| Testes | `rtk test <cmd>` | qualquer comando de teste não coberto acima (só falhas) |
| Build/Lint | `rtk lint` | ESLint cru |
| Build/Lint | `rtk tsc` | `tsc` cru |
| Build/Lint | `rtk cargo build` | `cargo build` |
| Build/Lint | `rtk ruff check` | `ruff check` cru |
| Análise | `rtk gain` / `rtk gain --graph` | — (estatística de economia, não substitui nada) |
| Análise | `rtk discover` | — (aponta economia perdida, rodar periodicamente) |
| Pacote | `rtk pnpm <args>` | `pnpm` cru |

- **Pegadinhas conhecidas:** `rtk grep <dir>` sem `-r` falha (proxy pro grep nativo, não ripgrep — usar `rtk rg`); `rtk diff <arquivo>` sozinho não é o uso certo — usar `rtk git diff <arquivo>`. Comando novo do rtk sem uso prévio confirmado: testar antes de assumir que roda igual aos outros.
- **Trava anti-hábito:** ferramenta instalada e no PATH não é ferramenta indisponível — se uma sessão inteira de diagnóstico rodou sem usar `rtk` onde cabia, é falha de execução do agente, não ausência de ferramenta.

Forçamento automático (instalado 2026-07-27, após ~50 esquecimentos na semana). A regra deixou de depender da memória do agente. Três camadas, em ordem de execução:

1. **`rtk hook claude`** (`PreToolUse` em `Bash`, config global do Claude Code) — reescreve o comando cru para o equivalente `rtk` de forma transparente. Cobre `cat`/`head`/`grep`/`rg`/`find`/`git`/`gh`/`tsc`/`eslint`/`vitest`/`jest`/`ls`/`npx …`/`pnpm run …`. **Não é opcional nem visível**: quando funciona, o agente nem percebe.
2. **`rtk-enforce.js`** (`PreToolUse` em `Bash`, roda logo depois) — **bloqueia** (`permissionDecision: deny`) o que a camada 1 deixa passar: `pnpm <script>` sem `run` (`pnpm verify:api`, `pnpm test`) e `pnpm --filter <pkg> <script>` não são reescritos. O deny devolve o comando corrigido pronto, então o custo é reemitir na mesma volta. Conferir se um comando específico é reescrito: `rtk hook check "<comando>"` — **dry-run, exige o comando como argumento** desde a 0.47.0 (antes era checagem geral de cobertura); sem argumento devolve `No rewrite for:` vazio, que é a nova sintaxe, não erro.
3. **`rtk-read-gate.js`** (`PreToolUse` em `Read`) — o hook do rtk **só intercepta o tool `Bash`**; `Read`/`Grep`/`Glob` são nativos e passam por fora dele, que é por onde "esqueci o `rtk read`" escapava. O gate bloqueia leitura **integral** de arquivo com mais de 600 linhas e de lockfile, sempre sugerindo `rtk read`, `offset`/`limit` ou LSP. Leitura com `offset`/`limit` passa direto — ler trecho de arquivo grande é o comportamento desejado, não a violação.

Consequência prática: **não existe mais "esqueci"**. Ou o comando é reescrito sem o agente notar, ou é bloqueado com a correção no motivo. O que o agente ainda precisa fazer por conta própria é escolher LSP/`codebase-memory-mcp` antes de busca textual — isso nenhum hook decide.

**Comando obrigatório para lint/build/test/verify, na raiz do monorepo:**

| Fazer | Nunca |
|---|---|
| `rtk pnpm run lint` | `pnpm run lint`, `pnpm lint`, `rtk lint` |
| `rtk pnpm run build` | `pnpm run build`, `rtk tsc` |
| `rtk pnpm run test` | `pnpm run test`, `pnpm test` |
| `rtk pnpm verify:api` | `pnpm verify:api` |

`rtk lint`/`rtk tsc` (subcomandos dedicados) falham **na raiz** com `JSON parse failed` — o turbo não entrega o formato que eles esperam (DEB-088-01). Dentro de um app (`cd apps/x && rtk tsc -p tsconfig.json`) funcionam normalmente, porque não passam pelo turbo. Cair no `pnpm` cru não é o contorno: perde a compressão inteira.

Esta tabela **não depende de o agente lembrar dela**: as regras `script-pesado-sem-rtk` e `rtk-subcomando-quebrado-no-turbo` do `rtk-enforce.js` bloqueiam cada linha da coluna "Nunca" e devolvem a da coluna "Fazer" já montada. A tabela existe para explicar o *porquê* — o cumprimento é mecânico.

Erros cometidos em smoke test (2026-07-25, build develop `bee2178`) — não repetir:
- `rtk gain --graph` truncado com `| head -20`: gráfico ASCII de 30 dias vem DEPOIS da tabela "By Command", que já ocupa ~15 linhas — `head` curto corta o gráfico fora e parece bug no rtk quando não é. Nunca concluir "comando não fez X" a partir de saída truncada por `head`/`tail`/pipe curto — rodar sem corte antes de reportar falha.
- `rtk cargo test --lib` no repo `rtk` (binário puro, sem lib target) falhou com `no library targets found in package`: erro é do argumento `--lib`, não do rtk. Antes de passar flag de escopo (`--lib`, `--bin`, `-p`), confirmar a estrutura do pacote (`Cargo.toml`/`cargo metadata`) — não assumir que todo crate Rust tem lib target.
- `rtk discover` sem flag deu "Scanned: 0 sessions" (parecia bug); com `--all` achou 138 sessões/20712 comandos. Comportamento é **default por design** (escopo = projeto atual, filtro por path), não falha. Ler `rtk <subcomando> --help` antes de declarar resultado vazio como bug — comportamento default restrito pode ser intencional, não regressão.
- Comando em background (`run_in_background`) não herdou `PATH` setado manualmente na sessão anterior (`cargo` sumiu do PATH) — cada shell/background job tem seu próprio ambiente. Ao rodar comando `rtk`/`cargo`/etc em background após ajustar PATH manualmente, re-exportar o PATH dentro do MESMO comando (`export PATH=...; rtk ...`), nunca assumir que persiste entre chamadas de shell.

## LSP / diagnósticos semânticos

- Origem/registro: Spec 044 consolidou LSP como parte do ecossistema de agentes; o mantenedor reforçou em 2026-07-08 que ele detecta erros automáticos que antes passavam despercebidos.
- Função: diagnóstico semântico contínuo: tipos quebrados, imports inválidos, símbolos inexistentes, assinaturas incompatíveis e erros que busca textual não revela.
- Usar para: checar arquivos tocados antes/depois de edição; confirmar impacto local de refactor; achar erro rápido enquanto ainda é barato corrigir.
- Clientes: OpenCode expõe LSP diretamente; Claude Code pode usar plugin LSP; Codex depende das ferramentas disponíveis no turno/config local.
- Trava: LSP é importante, mas auxiliar. Diagnóstico limpo não substitui `pnpm run lint`, `pnpm run build`, testes pontuais e `pnpm verify:api` quando exigidos.

## codebase-memory-mcp

- Origem: Spec 044 / DEB-044-02. Configurado em OpenCode e Claude Code; Codex usa config MCP local do usuário. Versão instalada se lê com `codebase-memory-mcp --version` — não fica registrada aqui, porque número em doc envelhece sozinho e vira afirmação falsa que ninguém mede.
- Função: grafo persistente do código para descoberta estrutural, chamadas, arquitetura e impacto. Complementa LSP e busca textual.
- Ferramentas esperadas: `search_graph`, `trace_path`, `get_code_snippet`, `query_graph`, `get_architecture`.
- Usar para: achar funções/classes/rotas/variáveis por padrão; rastrear quem chama quem; ler snippet específico; consultar fan-out/fan-in; obter visão de arquitetura.
- Não usar para: literais, mensagens, configs, docs, YAML/JSON, shell, Dockerfile ou quando o grafo estiver desatualizado/insuficiente. Fallback = `rtk rg`, `ast-grep`, leitura direta.
- Disciplina: código real continua fonte material. Se grafo e arquivo divergirem, o arquivo vence; registrar débito se a ferramenta induzir erro recorrente.

## artificio-api-governance

- Origem: Spec 055 / DEB-055-06. Sobe com `pnpm api:mcp`, servidor MCP stdio mínimo sobre `scripts/api/api-mcp-server.ts`.
- Função: descoberta de rotas de API a partir do bundle gerado, proibindo uso de memória de chat como fonte primária.
- Ferramentas esperadas: `search_api` e `get_api_bundle_summary`.
- Fonte lida: somente `docs/api/generated/artificio-api.bundle.json`. Se desatualizado, rodar `pnpm verify:api` e revisar artefatos gerados.
- Usar para: descobrir método/path/app/scope/auth/consumidores de rota; confirmar impacto de mudança API; orientar atualização OpenAPI.
- Não usar para: provar comportamento runtime sozinho. Depois da descoberta, verificar código real e rodar `pnpm verify:api` quando tocar `apps/**`, `packages/**`, `scripts/api/**`, `docs/api/openapi/**` ou allowlist.

## cloudflare (5 servidores) — **acesso à conta de produção**

- Origem/registro: instalado em 2026-08-03 por autorização nominal do mantenedor, durante a sessão `26-08-03_1_seguranca_snyk-headers-sast` (achado A, HSTS). Instruções oficiais: `https://developers.cloudflare.com/agent-setup/prompt.md`.
- Instalado em: Claude Code (plugin `cloudflare@cloudflare`, marketplace `cloudflare/skills`), Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`), Codex CLI + Desktop (`~/.codex/config.toml`, config compartilhada). Cursor, VS Code e OpenCode não foram configurados de propósito.
- Servidores: `cloudflare-docs` (público, sem auth) · `cloudflare` (API geral) · `cloudflare-bindings` · `cloudflare-builds` · `cloudflare-observability` — os 4 últimos autenticam por OAuth.

Trava pétrea — o que estes MCPs realmente alcançam. A conta Cloudflare autenticada é a mesma que controla DNS, Tunnel e TLS de `artificiorpg.com` e de todos os subdomínios. Ter a ferramenta disponível não é autorização para usá-la:

- **Leitura** (consultar zona, registro, config de SSL/TLS, build, log, métrica) segue a regra geral: read-only é sempre permitido, sem aprovação por ação. Vale a obrigação de filtrar segredo da saída — nunca imprimir token, chave de API ou `*SECRET*`.
- **Qualquer escrita** (criar/alterar/remover registro DNS, rota de tunnel, regra, header, certificado, binding, deploy) exige **aprovação nominal por ação**, no formato "APROVAÇÃO NECESSÁRIA", exatamente como um comando de escrita na VM. A existência do MCP não afrouxa §Regras Pétreas → Autorização; a barreira deixou de ser técnica e passou a ser só a regra — por isso ela vale mais aqui, não menos.
- **DNS raiz de `artificiorpg.com` continua exigindo aprovação explícita**, inclusive por MCP. Ver §Gates do Programa.
- **HSTS é decisão do mantenedor, não do agente.** `Strict-Transport-Security` tem um dono só: a borda Cloudflare (decisão D1, sessão `26-08-03_1`). Habilitar/alterar `max-age`, `includeSubDomains` ou `preload` cacheia no browser do usuário final e **não tem rollback rápido**. Agente não liga, não sobe escada, não sugere `preload` sem pedido nominal.

- Usar para: consultar documentação Cloudflare (`cloudflare-docs`, dispensa auth e é a primeira escolha); inspecionar estado real de zona/DNS/tunnel/SSL antes de diagnosticar infra (anti-retrabalho — inspeção read-only precede correção no chute); ler build e observabilidade de Workers/Pages quando aplicável.
- Não usar para: substituir `docs/agents/deploy-runbook.md` como fonte de topologia do projeto; provar comportamento de aplicação (o container e o código continuam sendo a verdade material); nem executar escrita por conveniência durante diagnóstico.

## opencode/DeepSeek a partir do Claude Code — **usar o oficial (`mcp__opencode__*`)**

Existem **dois servidores registrados que chegam no mesmo opencode/DeepSeek. Não são alternativas de gosto: o oficial é o padrão, o wrapper é fallback. Ambos instalados em 2026-08-19 por pedido nominal do mantenedor.

| Servidor | Ferramentas | Quando usar |
|---|---|---|
| `opencode` (oficial, ~80 ferramentas) | `opencode_setup`, `opencode_ask`, `opencode_reply`, `opencode_run`, `opencode_fire`, `opencode_check`, `opencode_review_changes`, … | sempre, por padrão |
| `opencode-deepseek` (wrapper local, 1 ferramenta) | `deepseek` | só se o oficial não responder** |

**Por que o oficial ganha — medido em 2026-08-19, mesma pergunta nos dois:**

- **Sessão persiste. A primeira pergunta custou 1697 tokens de entrada; o follow-up na mesma sessão custou 74, porque reusou o contexto em vez de reler o arquivo. O wrapper abre sessão nova a cada chamada — em trabalho de várias rodadas (spec com fases, revisão iterativa) isso relê tudo toda vez.
- Informa custo e tokens por chamada (`$0,0010 | 1697 in, 127 out`). O wrapper não informa nada.
- Dá acompanhamento e diff: `opencode_check` (progresso de tarefa longa), `opencode_review_changes` (diff da sessão), `opencode_session_todo`. O wrapper só devolve o texto final.
- Respondeu com mais precisão na mesma pergunta: distinguiu que `VTT_ALIASES` tem 12 chaves para 6 plataformas (6 por slug + 6 por nome), enquanto o wrapper disse "12 chaves de plataforma".

Uso do oficial, na ordem: `opencode_setup` (checa saúde e providers) → `opencode_provider_models` para confirmar o model ID em vez de chutar → `opencode_ask` (tarefa curta) ou `opencode_run`/`opencode_fire` + `opencode_check` (tarefa longa) → `opencode_reply` para continuar na mesma sessão. Passar sempre `providerID`/`modelID` descobertos (ex.: `deepseek` / `deepseek-v4-pro`) — sem isso a resposta pode voltar vazia. Passar `directory` com o caminho absoluto do projeto.

Passar SEMPRE `agent:` — sem isso a sessão trava no primeiro comando. Delegação de implementação vai com `agent: "artificio-implementador"`; investigação com `artificio-investigador`; revisão com `artificio-revisor` (lista completa em `.opencode/agents/`). Omitir `agent:` cai no agente default, que não tem allowlist e herda `permission: { bash: "ask" }` do `opencode.json` da raiz — cada comando vira um pedido de permissão que só o Claude Code responde (`opencode_permission_list` → `opencode_session_permission`), e o DeepSeek fica parado esperando. Isso anula o propósito da delegação: o opencode existe para o trabalho rodar sem consumir contexto do orquestrador; se o orquestrador precisa aprovar comando a comando, ele gasta mais token vigiando do que gastaria fazendo.

Incidente que originou a regra (2026-08-19, spec 093 Fase 1).** `opencode_fire` disparado sem `agent:` travou no **primeiro comando — um `rtk rg` na própria `tasks.md` que o prompt mandava ler. A causa não era só o `agent:` ausente: `rtk rg -n "rtk" .opencode/agents/` devolvia zero — nenhum dos nove agentes conhecia `rtk`, porque as allowlists foram escritas antes de o `rtk` virar obrigatório neste arquivo. Como toda instrução manda usar `rtk`, 100% dos comandos** caíam no `"*": ask`, com qualquer agente. Corrigido espelhando cada entrada do bloco `bash:` na forma `rtk <cmd>`, **preservando a política de cada linha** (199 entradas nos 9 agentes).

**Por que espelhar e não liberar `"rtk *": allow`:** `rtk *` cru casaria `rtk git push`, passando por cima do `deny` de `git push*` — o prefixo muda a string e o padrão não casa mais. Espelhado, `rtk git push*` herda o `deny` que `git push*` já tinha, e o que não está na lista continua perguntando. **Nunca** afrouxar `opencode.json` para `bash: allow` como atalho: resolveria o travamento e destruiria a trava, já que nada impediria um `git push`. Os `deny` do frontmatter valem sempre; a vigilância do orquestrador vale enquanto ele estiver olhando.

Ao acrescentar comando novo à allowlist de um agente, acrescentar a forma `rtk` junto — senão o furo volta a abrir sozinho na próxima vez que alguém editar.

A notificação do `opencode_fire` NÃO significa que a sessão terminou. Quando o `fire` estoura o timeout da chamada MCP e vira task de background, a `<task-notification>` que chega depois é do **`fire`**, não da sessão do opencode: ela dispara quando a chamada MCP retorna. **Medido (2026-08-19, spec 093):** a notificação "completed" chegou no exato instante em que o agente **abortou** a sessão, com zero linha escrita. Tomar esse sinal como conclusão é declarar pronto um trabalho que não aconteceu.

**Como saber que a sessão realmente parou.** Não existe endpoint de status — medido: `/api/session/{id}/status` devolve o HTML da UI e `/api/session/status` devolve `InvalidRequestError`. O sinal disponível é `time.updated` do objeto da sessão (`GET /api/session/{id}`, porta padrão `4096`) parando de avançar. As três opções, e por que só uma serve:

| Caminho | Problema |
|---|---|
| Esperar a notificação do `fire` | não indica fim da sessão (acima) |
| `opencode_wait` | bloqueia o orquestrador segurando o turno |
| Chamar `opencode_check` em ciclo | é o token do orquestrador gasto vigiando — anula o motivo de delegar |
| **`Monitor` com watcher de `time.updated`** | **o correto**: custo ~zero enquanto roda, uma notificação no fim |

O watcher dispara em **"parou"**, não em "terminou com sucesso" — fim normal, crash e travamento acionam igual. Watcher que só reconhece sucesso fica mudo exatamente no caso em que o mantenedor precisa saber.

**O orquestrador é submantenedor, não executor.** Se ele está investigando, medindo, aprovando permissão a permissão ou construindo ferramenta para vigiar a sessão, está gastando o token que a delegação existia para poupar — e fazendo o trabalho que era do outro agente. O trabalho é do subagente: ele investiga, decide, implementa e valida. Ao orquestrador cabem o prompt, a trava de ação perigosa (commit/push/deploy/SQL seguem exigindo aprovação nominal do mantenedor, §Autorização) e o relato final. Corolário prático: **nunca construir auto-aprovador de permissão** — permissão travando é sintoma de allowlist errada ou `agent:` ausente, e o conserto é a config, não uma babá.

**Wrapper local (`opencode-deepseek`) — fallback.** Código em `docs/agents/opencode-mcp/` (`server.mjs` + `README.md`), versionado. Spawna o binário nativo (`%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe`) com `shell: false` e **stdin fechado** (`stdio: ["ignore","pipe","pipe"]`): sem shell por causa do quoting/encoding do Windows, com stdin fechado porque `opencode run` trava esperando EOF se o stdin fica como pipe aberto. Duas armadilhas já pagas, documentadas no `README.md` — ir lá antes de mexer.

A armadilha que vale para os dois, e que quase passou: o `opencode.json` da raiz declara `permission: { edit: "ask", bash: "ask" }`. Em modo headless não há quem responda, e o opencode **auto-rejeita toda chamada de ferramenta**, abortando com **exit 0 e stdout vazio** — falha que se disfarça de sucesso. Prompt trivial ("responda PING") funciona, porque não usa ferramenta nenhuma; só uma tarefa que precise **ler arquivo** expõe o problema. O wrapper passa `--auto` sempre e trata exit 0 sem saída como erro. Consequência para quem valida qualquer um dos dois: **`tools/list` não prova nada** — o smoke que vale é uma chamada real que obrigue o DeepSeek a ler arquivo.

Trava: ter qualquer um dos dois disponível não é autorização para acionar o outro agente. §Regras Pétreas → Autorização continua valendo: Claude Code ↔ OpenCode só com aprovação nominal por ação, priorizando read-only (análise, revisão, diagnóstico). `--auto` aprova ferramenta dentro da sessão do opencode; não substitui a aprovação do mantenedor para acionar o agente.
