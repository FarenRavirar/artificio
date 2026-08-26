# AGENTS.md — Governança de Agentes de IA · Artifício RPG

**Projeto:** Artifício RPG — plataforma modular (monorepo)
**Fonte canônica de governança operacional.** Em conflito com qualquer documento operacional, este arquivo prevalece.

**Regra zero, pétrea e omnipresente:** todo chat novo, todo agente, antes de qualquer análise, plano, comando, edição ou resposta de mérito, deve ler o T0 completo (`agents.md` + a spec atual. se não saber, perguntar.). Sem T0 lido, o agente não está autorizado a dizer que entendeu o estado do projeto nem a agir. Isto não é contexto opcional; é o mecanismo de continuidade do projeto longo multi-chat.

**Regra zero-b, simétrica e igualmente pétrea:** sem **medição citada**, o agente não está autorizado a afirmar causa, estado, impossibilidade ou conclusão — nem sobre código, nem sobre banco, nem sobre infra, nem sobre o próprio trabalho. A regra zero protege o agente de agir sem contexto; esta protege o mantenedor de **decidir sobre afirmação não verificada**, que é o dano que nenhuma trava de autorização deste arquivo alcança. Detalhe operacional: §Regras Pétreas → Evidência.

Toda comunicação com o mantenedor é em português. Nomes de arquivos, comandos, funções e identificadores permanecem no formato original.

---

## O que é o Artifício RPG

Suite de projetos públicos em **subdomínios** sob `*.artificiorpg.com` (D017), login Google único (SSO via `accounts.artificiorpg.com`), leve (TypeScript/React/Express/Postgres), SEO forte. Monorepo `artificio` com `apps/*` (unidades técnicas: frontend/backend/deploy) e `packages/*` (compartilhados). O usuário vê **projetos**; o repositório organiza **apps**. Cada app é plugável, no próprio subdomínio/deploy isolado, mas compartilha auth, design e analytics.

`G1` é só analogia/codinome técnico interno ao modelo de hub interconectado do portal de notícias G1; **não é nome do produto**. Produto público = **Artifício RPG**. Modelo Google-suite (`docs.`/`mail.`).

Projetos/apps: `site` (portal+blog), `glossario`, `mesas`, `downloads`, `esferas` (Spheres of Power, multi-sistema), `srd` (DnD 5.2.1), `links`.
Pacotes compartilhados: `auth`, `ui`, `analytics`, `config`, `content`, `crosslink`.

---

## Leitura Mínima de Retomada (Tier 0 — todo chat, todo agente)

**Pétrea:** projeto longo, multi-chat, multi-agente. T0 não é "um toque de contexto" — é o piso que garante que o agente não redecide, não finge conclusão e não age sem saber o que é inegociável. T0 é curto de propósito; o resto (diagnóstico local, LSP/MCP, infra, specs) é **T1: consultado sob demanda**, quando a tarefa tocar aquele assunto — não lido toda sessão.

**T0 obrigatório, toda sessão, antes de agir:**
1. Este arquivo (`AGENTS.md`) inteiro, uma vez por sessão.

**Resumo inegociável (detalhe completo em §Regras Pétreas → Evidência/Autorização/Escopo/PR, Commit e Push):**
- **Evidência antes de afirmação (§Regras Pétreas → Evidência).** Causa, estado, impossibilidade ou completude só se afirma citando o comando que mediu e o que ele devolveu; sem medição, dizer "não medi". "Investigou?" se responde com a lista de comandos, nunca com "sim". Opção oferecida ao mantenedor é opção verificada. A investigação termina quando as opções **dele** estão medidas, não quando o agente se convence — parar cedo não economiza esforço, amplia o custo em uma ordem de grandeza (medido: 5h de SSO fora, `500` em produção, PR/merge/promote/deploy refeitos).
- Autorização é **por ação**, nunca por sessão/PR — não acumula, não se infere de frase genérica.
- Escopo (o que entra em qual PR/branch/commit) é call do mantenedor, não inferência do agente.
- `git commit`/`git push`/merge/deploy/write em VM: só com autorização nomeada explícita, a cada vez.
- Ação destrutiva ou difícil de reverter (DNS/tunnel prod, SQL write, recriar infra, `--amend`, `--force`): sempre aprovação nominal + formato "APROVAÇÃO NECESSÁRIA".
- **NUNCA, JAMAIS desligar, reiniciar ou suspender a VM Oracle** — nem `shutdown`, `reboot`, `poweroff`, `halt`, `init 0/6`, `systemctl poweroff/reboot`, nem parada/reinício da instância pelo painel da Oracle ou por API. Não existe pedido do mantenedor que autorize isso por interpretação: a VM hospeda **produção inteira** (todos os subdomínios, o SSO e os bancos), e derrubá-la tira o produto do ar sem caminho de volta pelo próprio agente — quem religa é o mantenedor, manualmente, no painel. Quando ele pedir para "desligar o pc", "desligar a máquina" ou "shutdown", o alvo é **sempre a máquina Windows local** (`shutdown /s` no prompt local), nunca a VM; comando de desligamento jamais atravessa `ssh faren`. Na menor dúvida sobre qual máquina, parar e perguntar — o custo de perguntar é uma linha, o de errar é produção fora do ar.
- **Bug/débito achado: corrigir, não perguntar.** Achado dentro ou fora do escopo se conserta no mesmo trabalho e se relata depois, junto com o que foi medido. Débito só se registra quando o mantenedor mandar registrar — perguntar "corrijo ou registro?" a cada achado devolve a ele decisão que era do agente. As duas exceções, e só elas: correção que exige ação de aprovação nominal (§Autorização) ou que muda regra de produto/contrato público — aí para e pergunta.
- **Validação completa é o ÚLTIMO passo, e só depois do mantenedor dizer que não vem mais review.** Enquanto houver rodada de review pendente, valida-se **só o pacote afetado** (`cd apps/<app>/backend && rtk pnpm vitest run <arquivo>`, `rtk tsc -p tsconfig.json --noEmit`). Rodar `test`/`lint`/`build` repo-wide a cada rodada é desperdício puro: o resultado será invalidado pela correção seguinte, e o custo é do mantenedor, não do agente. Repo-wide entra uma vez, no fim, quando ele disser que acabaram os reviews — ou antes de um commit que ele já autorizou.
- **Nunca rodar validação pesada de uma vez só — a máquina do mantenedor trava.** `test`, `lint` e `build` repo-wide **não** se encadeiam no mesmo comando nem se disparam em paralelo (inclusive via `run_in_background` simultâneo). Um de cada vez, esperando o anterior terminar. **`--force`/sem cache só com pedido explícito**: o cache do turbo existe exatamente para isso, e invalidá-lo por hábito multiplica o custo sem acrescentar informação. Vale também para `vitest run` sem filtro de arquivo dentro de um app grande.
- **Pesquisar antes de perguntar.** Trabalhando numa spec, antes de **qualquer** pergunta ao mantenedor sobre contrato, escopo, dependência entre tasks, schema ou decisão já tomada: pesquisar em `spec.md`, `plan.md`, `tasks.md` e nos arquivos auxiliares da spec (ex.: `contrato-http-v1.md`). Quase sempre uma busca básica resolve — pergunta evitável queima token do mantenedor e do agente e devolve a ele trabalho que era do agente. **Ler a seção inteira, não grep de linha solta:** `grep` de duas palavras devolve fragmento e faz item já decidido parecer lacuna; localizar com `rtk rg`, depois **abrir a seção**. `plan.md` organiza a execução — implementar task sem ler a seção dela no `plan.md` é erro de processo, não economia de contexto. **Não inferir dependência pela numeração:** T*n* citar T*m* não implica ordem. Pergunta legítima é a que **sobrevive à pesquisa** — lacuna real, com busca negativa feita, dizendo onde procurou. Achado que responde dúvida recorrente: registrar só no destino que o mantenedor nomear. Inferência do agente nunca vira decisão registrada — marcar como inferência a confirmar.
- `rtk` disponível no PATH: usar sempre no lugar de comando cru equivalente (ver lista completa em §Diagnóstico local → rtk). Comandos obrigatórios: `rtk git status`/`rtk git diff`/`rtk git log` (nunca `git` cru pra esses três), `rtk read <arquivo>` (nunca `cat`/Read direto pra arquivo grande sem justificar), `rtk rg <padrão> <path>` (busca textual, nunca `grep`/`rg` cru), `rtk find <path> -iname "..."`, `rtk tsc`, `rtk lint`, `rtk cargo test`/`rtk pytest`/`rtk jest`/`rtk vitest`/`rtk go test` (testes, sempre via rtk pra saída filtrada), `rtk pnpm <args>`.

**Escalada T1 (consultar quando a tarefa exigir, não por padrão):**
- **Escopo documental explícito prevalece.** Se o mantenedor nomear quais arquivos/trechos ler ou alterar, ler e alterar somente esses. Não abrir documentos correlatos por associação, retomada ou “contexto útil”.
- Retomar spec/trabalho em andamento → ler somente os arquivos/trechos da spec nomeados pelo mantenedor. `project-state.md`, `decisions.md`, `specs/backlog.md`, sessões e outras specs **não entram automaticamente**; exigem pedido nominal próprio.
- `sessoes/` — checar sessão ativa incompleta/retomar só quando o mantenedor pedir explicitamente ("retoma a sessão", "continua de onde parou") ou quando não houver spec cobrindo o trabalho. Codificação hoje passa por spec madura (`specs/*/spec.md,plan.md,tasks.md`), que já carrega o contexto de retomada — não abrir/escanear `sessoes/` por padrão todo chat novo. Quando `sessoes/` for tocado (por pedido ou por falta de spec), registrar antes de alterar: o que vai fazer, o que falta, o que já foi feito.
- Infra/deploy/CI/CD/VM/DNS/banco → `docs/agents/deploy-runbook.md`, §VM/Banco/Infra e §Deploy e Infra de CI/CD deste arquivo.
- Specs → limitar leitura e escrita aos arquivos/trechos nomeados pelo mantenedor. Trabalhar numa spec não autoriza abrir `specs/README.md`, `specs/backlog.md`, `project-state.md`, `decisions.md`, sessões ou specs relacionadas.
- Diagnóstico de código/API antes de editar → §Ferramentas MCP/Agentes (LSP, codebase-memory-mcp, artificio-api-governance) + comandos abaixo.
- Erro/regressão conhecida → `.specify/memory/errors.md`.

Se a tarefa tocar um desses temas e o T1 pertinente não foi lido, não afirmar que está resolvida.

**Anti-retrabalho:** fluxo estranho/contraditório/perigoso (CI/CD, deploy, branch, DNS/tunnel, auth, banco, SEO, importador, pacote compartilhado) não se corrige no chute — pesquisar o T1 relevante primeiro, identificar se é decisão histórica, exceção temporária ou bug real, só então corrigir. Critério de parada da pesquisa e obrigação de citar o que foi medido: §Regras Pétreas → Evidência.


**Falha de processo descoberta:** reportar e perguntar onde registrar. Nunca escolher nem abrir sozinho outra fonte documental. Regra operacional durável só entra na fonte canônica autorizada nominalmente pelo mantenedor.

### Diagnóstico local (T1 — antes de editar código)

- `rg "termo" apps packages -n` / `rg -l "termo" apps packages` (só arquivos) / `rg --files apps packages`
- `ast-grep -p "PADRAO" --lang ts` — busca estrutural
- `pnpm run lint` / `pnpm run test` / `pnpm run build` — **pesados o bastante para travar a máquina do mantenedor**. Default é validação pontual do pacote afetado; CI cobre o repo completo. Repo-wide só no fim, um comando de cada vez, nunca encadeado nem em paralelo, e sem `--force` salvo pedido explícito. Trava completa no T0.
- `pnpm verify:api` — obrigatório em mudanças de `apps/**`, `packages/**`, `scripts/api/**`, `docs/api/openapi/**`
- Descoberta de rota de API: fonte primária é `docs/api/generated/artificio-api.bundle.json` (+ `api-index.generated.md`), nunca memória de chat. Detalhe: `docs/api/README.md`.
- Não ler o repositório inteiro nem abrir arquivo grande sem justificar; procurar símbolo/rota/import antes de editar.

**LSP:** ver §Ferramentas MCP/Agentes → LSP.

---

## Gates do Programa (regra pétrea de sequência)

O Artifício RPG avança por gates. **Nenhum gate é pulado.** Cada gate exige aprovação explícita do mantenedor. O status operacional detalhado vive em `.specify/memory/project-state.md`; aqui ficam a sequência e as travas duráveis. Gates ativos neste ciclo: A, B e D. Gate C encerrado: site Astro em produção na raiz `artificiorpg.com`.

| Gate | Status operacional | Libera | Pré-condição / trava |
|---|---|---|---|
| **A** | aprovado; guardrail continua | Recriar/destruir instância Oracle | Backups completos, verificados e copiados off-VM (`C:\projetos\artificiobackup`) |
| **B** | aprovado; guardrail continua | Importar conteúdo / construir projetos | SSO (`accounts.`) funcionando + 1º projeto no ar em subdomínio |
| **C** | **✅ encerrado** | Site Astro em produção na raiz `artificiorpg.com` | — |
| **D** | ativo por projeto | Próximo projeto | Projeto atual passou smoke |

**Topologia (subdomínio-por-projeto):**

- Cada projeto/app fica no próprio subdomínio (`glossario.`, `mesas.`, `downloads.`, `esferas.`, `srd.`, `links.`), root próprio, sem basename.
- Linguagem pública usa **projetos**; `app` é unidade técnica em `apps/*`; `módulo` só aparece em contexto técnico/histórico.
- Blog em `beta.artificiorpg.com` (staging) e em produção na raiz `artificiorpg.com` (site Astro).
- SSO central em `accounts.artificiorpg.com`.
- Une tudo: cookie `.artificiorpg.com` + nav + design. Cloudflare Tunnel mapeia hostname→container.

**"Não lançado" ≠ "não deve subir" (pétrea).** Projeto ainda não divulgado ao público **é deployado em produção normalmente** — subdomínio, container, banco e rota de tunnel entram no ar antes do anúncio, de propósito. "Não lançado" significa apenas que **o público sabe que ainda não está pronto**, não que produção esteja proibida, adiada ou que o ambiente seja descartável. Consequências operacionais que o agente **não** pode inverter por conta própria:

- **Nunca propor remover/desligar rota de tunnel, DNS ou container "porque o projeto ainda não foi lançado".** Rota provisionada antes do anúncio é estado desejado; `502`/`503` num subdomínio ainda não anunciado indica **deploy pendente**, não rota indevida. O remédio é deployar, não apagar a rota.
- **Ausência de container/volume/banco de produção não é decisão de produto** — é deploy que ainda não aconteceu. Não tratar como "projeto não usa prod".
- **Prioridade menor não vira licença pra afrouxar.** Migration, guard de deploy, backup, smoke e revisão valem igual em projeto não anunciado: o dado que entra ali é real desde o primeiro deploy, e o primeiro público chega sem aviso prévio ao agente.
- Se o mantenedor quiser adiar produção de um projeto específico, ele diz. Silêncio sobre lançamento **não** autoriza inferir adiamento.

**DNS raiz de `artificiorpg.com` exige aprovação explícita do mantenedor pra qualquer mudança, como qualquer DNS/tunnel de produção.** `artificiorpg.com` é `CNAME` pro Cloudflare Tunnel (`<tunnel-id>.cfargotunnel.com`), roteando pro container `site-prod-app:4322`. Antes de mexer, sempre checar registro DNS real do hostname raiz no painel — pode ser qualquer registro (R2, MX, etc.) conflitando com o nome.

---

## Regras Pétreas

### Evidência (pétrea — governa todas as outras desta seção)

**O poder de decisão do mantenedor é limitado pela profundidade da investigação do agente.** Não é retórica: quando o agente para de investigar cedo, ele não economiza esforço — ele **estreita em silêncio o conjunto de opções que o mantenedor consegue escolher**, enquanto o mantenedor segue achando que escolhe entre alternativas reais. Investigação rasa é decisão tomada pelo agente e entregue com a etiqueta de decisão do mantenedor. Todas as demais regras deste arquivo guardam **ação** (commit, deploy, DNS, SQL); esta guarda **afirmação**, que é por onde o dano passou repetidamente sem violar nenhuma outra.

**1. Afirmação exige medição citada, na mesma mensagem.** Toda afirmação sobre causa, estado, impossibilidade, completude ou impacto vem com o comando que a sustenta e o que ele devolveu. Não "verifiquei que não há trigger" — mas "`pg_trigger` para essas 6 tabelas devolveu 0". Não "a investigação está completa" — mas a lista do que foi medido. **Sem medição, escrever "não medi"** e seguir assim mesmo; frase honesta de ignorância custa uma linha, afirmação errada custa horas. Inferência plausível não é medição; "faz sentido" e "deve ser" não são evidência.

**2. "Investiguei?" se responde com comandos, nunca com "sim".** Quando o mantenedor pergunta se o agente investigou, pesquisou ou verificou, a resposta é a **lista do que foi rodado e do que voltou**. "Sim" é irrespondível — o mantenedor não tem como auditar, e é exatamente a forma que o engano assume quando o agente está convencido de si. Se a lista for curta demais para sustentar a conclusão, a resposta correta é "não o suficiente para afirmar isso".

**3. Opção oferecida ao mantenedor é opção verificada.** Nunca listar alternativa, caminho ou custo que não foi medido. Oferecer opção impossível é pior que não oferecer: o mantenedor gasta decisão real num caminho que não existe, e descobre pelo erro. **Incidente real (2026-08-08, spec 090):** o agente ofereceu "apagar os três comentários e refazer o smoke" com custo inventado, sem consultar `pg_trigger`. `community_comment_version_reject_delete` e `notification_event_immutable` recusam `DELETE` — a opção nunca existiu. Antes de apresentar alternativas, medir cada uma; a que não foi medida sai da lista ou vai marcada "não medi o custo/viabilidade".

**4. A investigação termina quando as opções do mantenedor estão medidas, não quando o agente se convence.** O critério de parada errado — e o que produziu todos os incidentes abaixo — é "achei uma explicação que encaixa". O certo é "medi tudo que pode mudar a resposta dele". São coisas diferentes: a primeira termina no conforto do agente, a segunda na qualidade da decisão do mantenedor.

**5. Antes de afirmar a hipótese, rodar a consulta que a mataria.** Buscar confirmação encontra confirmação. A consulta obrigatória é a que **derruba** a explicação atual — `pg_trigger` derrubaria o plano de `DELETE`; comparar `--filter` com o store derrubaria o diagnóstico de `COPY dist`; compilar o SQL derrubaria `values({})`. Nos três casos o agente tinha a hipótese e não foi atrás do que a refutaria.

**6. Ler o schema/contrato/assinatura antes de consultar — não chutar identificador.** Nome de coluna, campo, flag ou parâmetro se lê da fonte (`information_schema`, `\d`, tipo, `--help`), nunca da memória. **Medido em uma única sessão (2026-08-08):** quatro chutes seguidos de nome de coluna (`filename`, `actor_id`, `state`, `key`), cada um depois de já ter errado o anterior. Cada chute custa uma volta inteira e, pior, ensina ao mantenedor que o agente não aprende dentro da própria sessão.

**7. O momento de maior risco é logo depois da cobrança do mantenedor.** Quando o mantenedor aponta que o agente não investigou, o impulso é **mostrar serviço rápido** — e o agente acelera exatamente onde deveria desacelerar, produzindo o mesmo erro em cima da bronca que o nomeou. **Incidente real (2026-08-08, spec 090):** o mantenedor mandou investigar; o agente foi direto montar o `UPDATE` sem consultar `pg_trigger`, bateu no `guard_community_comment_version_update` e só então descobriu que a tabela é append-only. Regra dura: **cobrança sobre investigação obriga a investigar mais fundo, nunca a responder mais rápido.** Depois de qualquer correção do mantenedor, a próxima mensagem começa medindo, não agindo.

**8. Concordar também é afirmação — e exige o mesmo lastro.** Aceitar a correção do mantenedor sem verificar é a mesma falha de sempre, com sinal trocado: "você está certo" dito por reflexo vale tanto quanto "investiguei" dito por reflexo. Quando ele apontar um fato técnico, **medir e mostrar a medição** — inclusive quando ela confirma o que ele disse, porque é a medição, não a concordância, que serve pra ele. Quando a medição não confirmar, dizer isso com o comando junto; discordância com evidência é útil, concordância sem evidência é ruído que ele não tem como auditar.

**9. Explicar o próprio erro não é corrigi-lo, e nunca vem antes da correção.** Depois de um erro, a ordem é: medir, corrigir, relatar o que foi medido. Análise de causa própria, distinção de intenção ("não foi proposital") e qualquer enquadramento que favoreça o agente **não entram** — não ajudam o mantenedor a decidir nada e consomem o turno em que ele esperava conserto. O mantenedor julga pelo registro do que foi afirmado contra o que era verdade; o agente não tem acesso privilegiado a isso e não deve argumentar sobre a própria intenção.

**Por que estas nove e não mais:** o custo do erro é assimétrico e já foi medido neste projeto. A investigação que faltava custava **uma consulta**, nos três casos; o que ela evitaria custou **5 horas de SSO fora do ar** (dependência transitiva podada do store, E021), **um `500` na primeira escrita real de comentário do projeto** (`values({})` chegando a produção), e uma rodada inteira de PR/merge/promote/deploy para corrigir. Parar cedo não economiza — amplia em uma ordem de grandeza.

**Aplicação sem exceção de humor ou pressa.** Nem urgência, nem contexto compactado, nem "é óbvio", nem o mantenedor pedindo velocidade suspendem esta seção. Se o tempo não permite medir, a saída é dizer o que não foi medido — nunca afirmar como se tivesse sido.

### Autorização

**Escopo da aprovação (pétrea) — regra única, sem exceção:** aprovação vale **por ação, não por sessão nem por PR/branch**. Nunca acumula entre commits/pushes/merges/deploys posteriores — mesmo em branch já pushada, mesmo no mesmo PR, mesmo após autorização anterior na mesma conversa, mesmo pra "ajuste"/"correçãozinha"/"melhoria" relacionada. "Commite" autoriza só aquele commit; "pode abrir PR" autoriza só aquela abertura. Editar arquivo local dentro do escopo pedido não precisa de aprovação; commit/push/merge/promoção/deploy/write na VM sempre precisam, a cada vez. Detalhe granular de commit/push/PR: §Regras Pétreas → PR, Commit e Push.

**Regra de obediência estrita:** o agente **não infere autorização** de frases genéricas como "pode seguir", "corrija", "documente", "ajuste", "resolve isso/logo", "faz o resto", "promova" ou "termina" — essas autorizam no máximo editar arquivos locais dentro do escopo. Autorização precisa nomear a ação perigosa ou o bloco de comandos (`commite`, `faça push`, `suba para dev/main`, `promova agora`, `merge`, `workflow_dispatch`, comando VM, deploy etc.). Instrução sobre a *forma* do commit (ex.: "não faça vários commits") não é autorização pra fazer o commit em si. Na dúvida, parar e pedir aprovação no formato abaixo.

Nunca executar sem aprovação explícita do mantenedor:

- Qualquer comando de escrita/mutação contra a VM Oracle: `docker restart|stop|start|rm`, `scp`, `rsync`, `docker cp`, `docker compose up|down`
- `npm`/`pnpm run build` no servidor
- `git commit`; `git push origin dev|main`; `git push --delete`
- `psql`/SQL write em DB real/VM/prod com `INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE`
- Qualquer mudança em registro DNS/Tunnel de produção (inclusive raiz `artificiorpg.com`)
- Recriar/redimensionar instância Oracle, mexer em volume ou tunnel
- Copiar/sobrescrever arquivos em produção
- Usar Chrome do mantenedor para verificação/autenticação (`Chrome` plugin, perfil logado, cookies/sessão reais) sem autorização explícita. Preferir validação read-only por HTTP, Browser interno sem sessão real, logs ou artefatos locais quando suficiente. Chrome só entra quando o mantenedor autorizar nominalmente e a tarefa precisar de sessão/perfil real.
- Acionar outro agente de IA em nome do mantenedor (ex.: Claude Code ↔ OpenCode via MCP `opencode`/DeepSeek). Nenhum agente ativa o outro, inicia subprocessos, roda comandos, altera arquivos/configurações ou faz chamadas de ferramenta em nome do outro sem aprovação nominal. Comunicação entre agentes prioriza read-only (análise, inspeção, revisão, diagnóstico); o agente informa qual ferramenta/MCP vai usar antes de acionar. Comandos documentados são referência, não autorização permanente.
- Criar, mover ou remover `git worktree`; fazer checkout de branch em diretório temporário/paralelo (`C:\tmp`, `../artificio-*` ou qualquer caminho fora do cwd); ou transferir diff/trabalho entre worktrees. **Sempre exige aprovação nominal prévia**, mesmo quando a branch em si poderia ser criada automaticamente, mesmo para contornar `cherry-pick`/rebase/merge/checkout bloqueado, preservar estado alheio ou permitir trabalho paralelo. O agente primeiro explica por que o cwd não pode ser usado, o caminho exato, o que será criado/removido e como o trabalho volta ao cwd. `git worktree list` e inspeção read-only continuam livres.

*(item "modificar arquivos fora do escopo solicitado" saiu desta lista — cobertura única em §Regras Pétreas → Escopo.)*

**Read-only é SEMPRE permitido (pétrea), nunca exige aprovação por ação** — local ou via PowerShell/`ssh faren`: `docker ps|logs|stats|inspect|images|system df`, `df`, `ls`, `cat`, `rg`/`grep`, `find`, `head`, `tail`, `curl -s` GET, `psql` com `SELECT`, `pg_dump` (read-only no DB), `git status|diff|log|show`, e qualquer subcomando de inspeção/diagnóstico que não muta estado (vale igual local e via VM/`ssh faren`). Inspeção read-only na VM é barata e **deve preceder** qualquer correção de infra "no chute" (anti-retrabalho). Não inferir necessidade de aprovação por ser "na VM/prod": ler estado nunca é ação de mérito. Única obrigação: filtrar segredos da saída (nunca imprimir `*PASSWORD*|*TOKEN*|*SECRET*`). Se uma ferramenta/harness bloquear um comando comprovadamente read-only, tratar como falso-bloqueio: explicar ao mantenedor e pedir liberação pontual — não é motivo para pular a inspeção nem para inferir que precisa de aprovação de mérito. Só a **escrita** na VM exige aprovação nominal: `docker stop|rm|up|restart`, escrever/copiar arquivo, migration, `scp/rsync`, subir/derrubar serviço, mexer no tunnel.

**Pacotes apt ausentes e libs/frameworks novos (dependência de app/pacote):** o agente pode usar lib nova ou pacote `apt` quando a tarefa precisar — a barreira não é "nunca sem aprovação prévia", é "nunca sem perguntar primeiro". Antes de instalar/adicionar, o agente **sempre para e pergunta** ao mantenedor (formato de pergunta simples, não precisa do bloco de APROVAÇÃO NECESSÁRIA completo salvo se for `apt`/infra de VM): qual pacote/lib, por que é necessário, alternativa já existente no repo (se houver) e tamanho/impacto aproximado. Só instala depois da resposta. Isso vale tanto para dependência de app/projeto quanto para `apt` (ex.: `git`, `jq`, `tree`, `p7zip-full`, `postgresql-client`, `curl`, `ca-certificates`). Pra `apt` especificamente, comando após aprovação: `sudo apt-get update && sudo apt-get install -y <pacote>`. Proibido usar aprovação de uma lib/pacote pra instalar serviço persistente novo, alterar arquitetura, mexer em DNS/tunnel, ou executar deploy — isso continua exigindo aprovação própria e nominal. Novo framework/lib pesada num app/projeto segue a mesma trava: agente pode introduzir, mas sempre pergunta antes, e se a lib diverge da stack canônica ou é redundante com algo já usado no repo, aponta isso na própria pergunta.

Formato obrigatório para pedir aprovação:

```text
## APROVAÇÃO NECESSÁRIA

Ação: [o que será feito]
Motivo: [por que]
Risco: [o que pode dar errado]
Rollback: [como desfazer]
Escopo: [qual app/projeto/pacote/gate]

Comandos:
1. ...

Posso prosseguir?
```

- Sessão com escopo num app/projeto (ex: `apps/srd`) **não toca** outro `apps/*` nem `packages/*` sem aprovação explícita e ampliação de escopo.
- Mudança de código em `packages/auth` exige aprovação + SDD Completo + smoke de **todos** os apps que consomem SSO. Auth é sagrado: nunca quebrar a sessão compartilhada. Mudança só documental em `packages/auth` exige sessão + evidência, mas não smoke runtime por padrão.
- Mudança de código em `packages/ui`/`packages/catalog-ui`/outros pacotes compartilhados (exceto `auth`/`accounts.`, que seguem trava própria acima) exige aprovação + verificação de impacto nos consumidores afetados, proporcional ao risco/blast radius real — não exige `spec.md`/`plan.md`/`tasks.md` por padrão; o mantenedor decide na hora se o caso pede SDD Completo.

Mecânica completa de commit/PR/push (fluxo branch→dev→main, doc-only, `verify:api`, bots de review, travas de sequência): §PR, Commit e Push.

Ver também §Regras Pétreas → Escopo.

### Escopo

- **Não existe "fora de escopo": o monorepo é um projeto só.** Erro, débito ou regressão encontrado em qualquer app/pacote durante a tarefa é responsabilidade de quem achou — corrigir ou registrar no mesmo turno, nunca empurrar para "outro fazer" ou usar "outra spec/outro app" como desculpa para ignorar. Separar em PR/spec própria é **organização rastreável** (o item segue até o verde), não abandono. "Deixar para depois" só com decisão explícita do mantenedor e débito registrado.
- **Escopo (o quê) é call do mantenedor, não inferência do agente.** Não decidir sozinho o que "pertence" a qual PR/branch/commit quando há mais de uma frente de trabalho no ar; não modificar arquivo fora do escopo pedido sem aprovação/ampliação explícita registrada na sessão (pequena edição pedida no meio da sessão conta como ampliação e deve ser registrada). Se não estiver 100% claro o que vai em cada ação, listar pro mantenedor ANTES de executar, não depois. Isolamento de app (abaixo) é sobre **não quebrar código alheio**, não licença pra **ignorar problema alheio**. Ver [[feedback_no_scope_inference]]. Vale também pro **conteúdo de um commit já autorizado** — regra de default em §Regras Pétreas → PR, Commit e Push.

**Isolamento de App/Projeto (pétrea do monorepo) — matriz mínima de smoke** (quando o mantenedor pedir smoke; não é trava obrigatória por padrão fora de auth/accounts):
- `packages/auth` código: login/me/logout e todos os consumidores SSO — obrigatório.
- `packages/ui`/outros pacotes código: consumidores visuais afetados + app de referência, quando aplicável.
- `accounts.` código: login/me/logout, allowlist de retorno e pelo menos um app consumidor — obrigatório.
- Doc-only: sem smoke runtime por padrão; registrar busca/evidência documental.

### Bug achado / débito

**Regra padrão: achou, conserta.** Bug, regressão, falha de validação, contrato quebrado, smoke que falha, defeito de ferramenta/harness/CI, teste frágil — dentro ou fora do escopo da tarefa, com relação ou nenhuma com o que está sendo feito. O agente corrige no mesmo trabalho e **relata depois**, com a medição junto (§Evidência). Ignorar, guardar só no chat ou empurrar pra "outro fazer" continua proibido; o que mudou é o destino do achado: **conserto, não pergunta**.

**Débito só existe se o mantenedor mandar registrar.** O agente **nunca** propõe registrar débito como alternativa ao conserto, nem escreve em `specs/backlog.md`, `tasks.md`, `project-state.md`, sessão ou qualquer documento por conta própria. Perguntar "corrijo agora ou registro?" a cada achado lateral devolve ao mantenedor uma decisão que era do agente e transforma cada entrega numa fila de perguntas — foi o que motivou esta regra substituir a anterior. Quando ele mandar registrar, o registro leva evidência concreta (comando, run, arquivo, trecho, métrica ou URL) e vai **somente no destino que ele nomear**.

**As duas únicas exceções — aí sim, para e pergunta:**

1. **A correção exige ação de aprovação nominal** (§Autorização): commit, push, deploy, escrita na VM, SQL write, DNS/tunnel, lib/pacote novo. O agente chega com o conserto **medido e pronto**, e pede a aprovação da ação — não apresenta o próprio achado como bifurcação.
2. **A correção mudaria regra de produto, contrato público ou custo operacional.** Aqui a decisão é de fato do mantenedor, não do agente: alterar comportamento observável, quebrar contrato com consumidor, escolher entre políticas igualmente defensáveis. Nesse caso o agente mede as opções antes de apresentar (§Evidência item 3) e diz qual recomenda.

Fora dessas duas, corrigir é o caminho. Na dúvida sobre em qual lado o achado cai, o critério é: *a correção é a mesma sob qualquer resposta do mantenedor?* Se sim, é conserto — não pergunta.

**Achado de spec/investigação segue a mesma regra, com um acréscimo.** Lacuna, risco operacional ou incerteza técnica descoberta durante pesquisa: pesquisar e resolver, não perguntar. O que continua **absolutamente proibido** é escrever "decisão do mantenedor" — em `spec.md`, `Fora de escopo`, `tasks.md` ou onde for — sem que ele tenha de fato respondido. Inferência do agente nunca vira decisão registrada; se algo precisa mesmo da resposta dele, marcar como **inferência a confirmar**, nunca como decidido.
- **Nunca mascarar erro nem adiar com risco de esquecer.** Proibido silenciar lint/tipo/teste/build pra "fazer passar" (`eslint-disable`/`@ts-ignore`/`continue-on-error`/`.skip`/`xfail`/flag advisory sem justificativa inline rastreável, ou "depois eu vejo"). Erro descoberto = corrigir agora; se genuinamente não der (bloqueio de ambiente, autorização ou dependência externa), parar e nomear o **bloqueio** — nunca oferecer "registrar como débito" para escapar do conserto. **Endurecer gate** (remover `continue-on-error`, subir severidade, tornar check obrigatório) só **DEPOIS** do verde comprovado localmente — nunca antes, senão transfere a falha mascarada pro próximo PR.

### PR, Commit e Push

Fluxo: `<tipo>/<escopo>` → `dev`/Beta → `main`/Produção. Tipos: `feat/*`, `fix/*`, `chore/*`, `docs/*`, `infra/*` (escolhido pelo trabalho, não pelo agente). Ex.: `feat/srd-001-tooltips`, `fix/glossario-login-guard`, `docs/020-theme-review`.

**Branch nova SEMPRE parte de `dev` atualizado, nunca de outra branch de trabalho.** `git fetch origin && git switch -c <tipo>/<escopo> origin/dev`, nunca em cima do HEAD de uma branch já existente (mesmo "relacionada") — branch-sobre-branch herda commits da base e vira PR com múltiplos commits/conflito/diff errado pro bot de review.

**Mudança que afeta lógica/comportamento NUNCA commita direto em `dev`/`main`.** Código de app/pacote, e infra/workflow/config/script que muda comportamento de deploy/CI/runtime: só via branch de trabalho + PR (`git switch -c` → push → `gh pr create --base dev`). Commitar reto em `dev` é proibido — destrói a trilha de revisão (revisores externos leem PRs). Branch protection em `dev`: TUDO que entra — inclusive doc-only — vai por branch + PR, sem ff/push direto (exige check `lint + build + test` verde). Na dúvida se algo "impacta lógica", tratar como código.

**PR nova sempre pronta e contra `dev`.** Ao abrir PR nova: **ready for review** (não draft), **base `dev`**, salvo pedido explícito diferente — revisores automáticos (CodeRabbit/Codex/Amazon Q) são configurados pra `dev`; PR contra branch intermediária pode sair sem review. Se a PR já existe em base diferente, não retargetar sem pedido explícito.

**Depois de abrir/atualizar a PR, o agente para.** `git push` de branch autorizada + abertura da PR (`gh pr create`) são a MESMA ação, feitas em sequência sem nova autorização. O que trava é o que vem depois: não acompanhar PR, não esperar checks, não rodar `gh pr view`/`gh run watch`/`gh run view`, sem polling/sleep, nem consultar status após aberta/atualizada — salvo pedido explícito de acompanhar. Pedido foi "commit + push" → fez push (+ PR se aplicável) e encerra.

**`git commit --amend` PROIBIDO, sem exceção.** Sempre commit novo. Amend reescreve commit sem nova autorização clara e força `push --force-with-lease` (reescreve histórico de branch já em review — bots e mantenedor perdem o rastro do que já foi visto). Branch/PR com commit anterior + novo push autorizado → `git commit -m "..."` (adicional) + `git push` normal (fast-forward, sem `--force`). Mesmo se o mantenedor disser "corrige o commit", perguntar se é commit novo (padrão) ou reescrita explícita por outro método.

**Mensagem multi-linha de commit: heredoc POSIX no Bash tool, here-string só na PowerShell tool — nunca misturar.** O Bash tool roda Git Bash (POSIX sh), que não conhece `@'...'@`. Usar a sintaxe de here-string do PowerShell ali faz o `@` entrar como **primeira linha da mensagem** e empurra o título real (`fix(escopo): ...`) pro corpo — commit ilegível em `git log` e no PR. Incidente real: commit `342f28e` (2026-07-29, branch `feat/089-fase-8`). O agravante é que o conserto exigiria `--amend`, proibido pela regra acima, então o único caminho é `reset --soft` + reautorização do mantenedor: retrabalho puro por erro de sintaxe. Forma correta no Bash tool:

```bash
git commit -F - <<'EOF'
fix(escopo): titulo

Corpo.
EOF
```

**Verificar sempre depois de commitar mensagem multi-linha:** `git log -1 --format=%B` antes de declarar o commit pronto ou pushar. Erro de sintaxe de mensagem não falha o comando — o commit é criado corrompido, com exit 0.

Cumprimento **não depende de o agente lembrar disso**: o hook `~/.claude/hooks/git-commit-msg-gate.js` (`PreToolUse` em `Bash`, suíte em `git-commit-msg-gate.test.js`) bloqueia `-m @'` e `--amend` devolvendo a forma correta no motivo do deny. Esta seção existe pra explicar o *porquê*.

**Default de conteúdo do commit: todo o diff, salvo exclusão explícita do mantenedor.** Ao montar um commit já autorizado, `git status`/`git diff` mostrando arquivo modificado — inclusive de outra frente de trabalho, sessão anterior, ou não tocado nesta tarefa — entra no commit por padrão. Não é call do agente separar/excluir arquivo do diff sob pretexto de "não é desta tarefa"/"fora de escopo desta sessão"; isso é a mesma inferência de escopo proibida em §Regras Pétreas → Escopo, aplicada ao commit. Só fica de fora quando o mantenedor apontar explicitamente ("deixa esse de fora", "não commita X"). Na dúvida sobre um arquivo específico (parece segredo, parece lock de outro processo, artefato gerado que outro processo está editando), perguntar antes — não excluir preventivamente por conta própria.

Ações e quem autoriza:
- Criar branch de trabalho: automático, exceto doc-only acumulado que fica local.
- `git push origin <branch-de-trabalho>`: automático pra código/feature autorizada; doc-only segue regra própria abaixo.
- Abrir PR pra `dev`: automático pra código/feature autorizada (ready for review, não draft); doc-only não abre PR sozinho.
- `git push origin dev`: **bloqueado por branch protection** — só via merge de PR (check verde). Vale pra código e doc-only; push direto falha.
- `git push origin main`: aprovação explícita.
- Merge de PR: só com autorização explícita.
- `git commit`/`git push`: nunca por interpretação ou inércia — precisa nomear a ação ("commite", "faça push", "suba pra dev/main"). Cada commit/push exige autorização própria, mesmo em branch já pushada/mesmo PR/mesma conversa. Ver §Autorização.
- Nunca `git checkout` entre `dev`/`main` durante deploy — usar `git fetch`/`git rev-parse`/`git log origin/main...origin/dev`/`gh run` sem checkout.

**Antes de `git commit` tocando `apps/**`, `packages/**`, `scripts/api/**` ou `docs/api/openapi/**`: rodar `pnpm verify:api` ANTES de montar o commit, não depois.** O hook pre-commit/pre-push já roda `verify:api` e regenera `docs/api/generated/*`/`docs/api/openapi/*` — se só acontecer no hook, os artefatos ficam fora do commit já feito. Rodar manualmente antes do `git add` evita o descompasso.

**NUNCA responder, comentar, resolver thread, reagir ou disparar (`@q`, `@codex`, `@coderabbit`) revisores externos/bots no PR** (amazon-q-developer, chatgpt-codex-connector, coderabbit, Snyk, Sonar, github-advanced-security). O agente não escreve nada na conversa do PR. Análise de revisão (procede/descarta/registrar) vive somente na documentação indicada pelo mantenedor. Fix que procede vira commit normal (branch/PR); resto vira débito no destino autorizado. Resposta a revisor no PR é sempre do mantenedor.

**Doc-only:**
- `git commit`/`git push`/PR/promoção exigem aprovação explícita por ação, mesmo com diff só de documentação.
- Mudança só de documentação não vai sozinha; commit/push/PR só com pedido explícito ("documentar/commitar/pushar docs agora").
- Sem ff/push direto de doc-only pra `dev` (proteção bloqueia) — entra por branch + PR, igual código (pode pegar carona no PR de código que motiva, ou PR doc-only próprio).
- Promoção `dev→main` (código ou docs) é fast-forward, sem merge commit/squash.
- Se o GitHub sugerir PR de `dev`, verificar `origin/main...origin/dev` e o conteúdo antes de agir.

### Erros que não podem se repetir — outros

Estas falhas já aconteceram e viraram regra operacional. Todo agente deve tratá-las como bloqueios de conclusão:

- **Nunca fechar tarefa executável só com dry-run, plano ou documentação.** Se o aceite diz "comando/script executável", rodar o comando real mínimo. Se falhar, reabrir task/backlog e corrigir ou registrar bloqueio.
- **Nunca declarar "resolvido" quando falta dependência necessária para rodar.** Pacote npm/devDependency local necessário para validação deve ser instalado quando permitido pelo escopo; se houver dúvida de aprovação, pedir antes e deixar a task aberta, não fechada.
- **Nunca confundir "local", "parcial", "validado em dist local" ou "falta deploy" com concluído.** Status correto vai somente para o documento autorizado; conclusão só após o critério de aceite completo.
- **Nunca tocar governança/infra/qualidade transversal sem T1 pertinente e nominalmente autorizado.** Se a tarefa envolve ou questiona `AGENTS.md`, specs, infra, CI/CD, deploy, VM, DNS/tunnel, banco, auth, SEO/Lighthouse ou pacote compartilhado, ler somente os documentos/seções pedidos pelo mantenedor. Se faltar fonte indispensável, parar e pedir ampliação de leitura; nunca ampliar sozinho.
- **Aprendizado que muda operação exige decisão do mantenedor sobre destino documental.** Não abrir nem atualizar automaticamente `project-state.md`, `decisions.md`, backlog, sessão, `context-capsule.md` ou outro T1.
- **Nunca deixar tarefa "fechada" após uma validação real provar que ela não roda.** Reabrir imediatamente, registrar o erro e só fechar depois do comando real passar.
- **Nunca deixar servidor/processo auxiliar rodando ao final.** Encerrar dev server, preview, servidor estático e helpers iniciados pelo agente, salvo pedido explícito do mantenedor para manter.
- **Nunca esconder erro com justificativa de economia de contexto.** O T0 é obrigatório; T1 é obrigatório quando o assunto exige. Economia de token serve a continuidade do projeto, não a atalhos.
- **Nunca confiar em documentação sem verificar o código — numa auditoria/investigação, código é a verdade material.** Documentação pode estar desatualizada, docs de spec podem registrar intenção não executada, e spec pode listar item como "pendente de decisão" quando o código já decidiu e implementou. Toda claim documental sobre estado de código, contrato ou decisão implementada deve ser verificada contra o código real (arquivos, imports, git log, consumidores). Se doc e código divergem, o código prevalece; o achado vira débito documental, não débito de implementação.
- **Lixo produzido pelo agente é o agente que limpa — nunca vira "decisão do mantenedor".** Erro de operação do próprio agente (dado sujo escrito por comando mal montado, arquivo temporário, credencial de teste, estado inconsistente que ele criou) é trabalho dele, não escolha a devolver. Perguntar "isso fica ou sai?" sobre a própria sujeira transfere ao mantenedor um custo que era do agente e ainda o faz parecer dono do problema. Pior ainda é **registrar isso em documento** como pendência dele. **Incidente real (2026-08-08, spec 090):** o agente gravou `U+FFFD` em produção por montar `curl` inline sob shell Windows, perguntou ao mantenedor se removia, e escreveu em `tasks.md` que "remover exige `DELETE` em produção, decisão do mantenedor". A escrita em produção continua exigindo aprovação nominal (§Autorização) — o que não se transfere é a **responsabilidade**: o agente chega com a limpeza medida e pronta, pede a aprovação da escrita, e não apresenta o próprio erro como bifurcação de produto. Distinguir do caso legítimo: decisão de **produto/risco/escopo** é do mantenedor sempre; consequência de **erro de execução do agente** nunca é.
- **Todo mismatch de tipo/teste que o próprio agente introduziu é do agente corrigir, sempre, sem exceção — nunca rotular como "pré-existente" pra justificar não mexer.** Ao editar um componente/hook que teste já cobre, qualquer erro de tipo/asserção que aparecer nesse arquivo de teste depois da edição é responsabilidade de quem editou, mesmo que o mock/fixture já estivesse frágil antes (schema real mudou de baixo, teste não acompanhou). "Já existia antes" não é motivo pra deixar passar — é motivo a mais pra corrigir a raiz (fixture completo do schema real), não só abafar o sintoma pontual. Vale igual quando o chat foi compactado/retomado no meio da tarefa: histórico resumido não reduz a responsabilidade sobre o que o próprio agente está tocando agora.

---

## Deploy e Infra de CI/CD

Mecânica de branch/PR/commit/push: §Regras Pétreas → PR, Commit e Push.

**Deploy/código canônico:** entrega normal passa por GitHub (branch/PR/checks/workflow_dispatch/Actions/secrets) e a VM faz `git fetch/reset` no clone. Acesso SSH direto à VM é exceção para bootstrap do clone, instalar utilitários operacionais, conexão, diagnóstico ou rollback aprovado — não é caminho normal de deploy/codificação. Se GitHub cobre a ação, use GitHub para rastreabilidade e branch safety.

**⚠️ Alerta: `deploy.yml` só deploya se `deploy_paths` do manifesto mudar.** Docs/specs/reviews/governança nunca disparam deploy real. CI roda, deploy=false. Para verificar: `gh run view <RUN_ID> --log | grep "deploy="`. Para forçar manual: `gh workflow run deploy.yml --ref dev -f module=mesas -f mode=deploy -f env=beta`.

**⚠️ TRAVA PÉTREA — `promote-prod-fast-forward.yml` NUNCA dispara deploy de prod.** Promote só move o ponteiro Git (`main` fast-forward pra `dev`); não chama `deploy.yml`, não builda, não sobe container. **Prod só atualiza com `workflow_dispatch` manual explícito**: `gh workflow run deploy.yml --ref main -f module=<modulo> -f mode=deploy -f env=prod`. Regra dura: depois de qualquer `promote` aprovado, **nunca declarar "promovido" ou "em produção" sem também disparar e confirmar esse deploy** — Git atualizado ≠ prod atualizado. Verificar sempre com `gh run list --workflow=deploy.yml --branch=main --limit=5` antes de afirmar que prod está no ar com a mudança.

---

## VM, Banco e Infra

### Worktrees locais (multi-agente paralelo)

Worktree **não é fallback automático**. Antes de qualquer `git worktree add|move|remove`, pedir aprovação nominal do mantenedor conforme §Autorização — incluindo worktree em `C:\tmp`, diretório irmão, uso para escapar de operação Git inacabada ou transferência posterior de alterações. Sem aprovação: parar, reportar o estado que bloqueia o cwd e perguntar como proceder. Depois de aprovado, trabalho paralelo em branch diferente usa `git worktree add ../artificio-<escopo> <branch>`, nunca checkout na mesma pasta enquanto outro agente roda ali. Informar o caminho exato antes de criar. Worktree ativo, propósito e branch só são registrados no destino documental nomeado pelo mantenedor; a aprovação do worktree não autoriza abrir outro documento. `node_modules` só reinstala no worktree se for rodar build/test/dev ali (pnpm store global evita duplicar peso). Remoção só após confirmar worktree limpo e trabalho preservado em commit ou stash identificado; nunca usar `--force` por inferência.

### Acesso à VM (Oracle)

- Acesso direto por alias SSH configurado em `~/.ssh/config` local (**não versionado**; host/IP/chave fora do git). Mapa de infra: doc interna fora do repositório público (`docs/agents/`, gitignored).
- A chave privada (`*.key`) é segredo: gitignored, nunca commitar/expor/imprimir.

### Banco, Infra e Segredos

- Qualquer SQL write direto (fora do framework de migration) em produção exige aprovação explícita + simulação/dry-run/plano de rollback registrados. Operação destrutiva (`DROP`, `TRUNCATE`, `DELETE` massivo, `ALTER` destrutivo) só com permissão nominal + dump prévio + checklist.
- Cada app/projeto tem seu schema/banco lógico isolado; SSO/usuários é o único cross-cutting.
- Nunca criar tunnel/container `cloudflared` paralelo.
- Nunca registrar, expor ou versionar token, PAT, segredo ou credencial. Segredos vivem em `.env` (gitignored) e nos secrets do Actions/Cloudflare.
- Acesso DB da VM por linha de comando local/PowerShell via `ssh faren` é **read-only por padrão** (`psql SELECT`, `pg_dump`, `docker exec` read-only). Escrita no banco da VM = aprovação.

### Migrations (TRAVA PÉTREA — checklist obrigatório antes de commitar QUALQUER `migration_*.sql`)

**Referência completa:** `apps/mesas/migrations_guide.md` (guia canônico do framework, aplica a todo módulo que o usa) + `docs/agents/deploy-runbook.md` §Migrations (mapa por módulo) + `.specify/memory/errors.md` `E009`/`E010`/`E011`/`E012`/`E014` (incidentes reais e comandos validados). Este resumo cobre o que é preciso saber pra não quebrar deploy; ir na referência antes de qualquer intervenção manual/emergência.

**1. Header obrigatório (5 campos, valida `scripts/deploy/lib_migrations.sh:parse_header`).** Sem isso o CI passa verde mas o deploy aborta na VM com `falhou na validacao de campos do cabecalho` (E011):
```sql
-- @class: online-safe        # online-safe | manual-risk (obrigatório)
-- @requires-backup: false    # true | false (obrigatório; true exige class=manual-risk)
-- @author: spec-NNN          # obrigatório, não-vazio
-- @created: AAAA-MM-DD        # obrigatório, não-vazio
-- @description: ...           # obrigatório, não-vazio
```
- `@migration: N` é decorativo — **não** conta como um dos 5.
- Campos lidos só nas **primeiras 20 linhas**; header no topo, antes do SQL.
- `@requires-backup: true` **exige** `@class: manual-risk`.
- `online-safe` **não pode** conter DDL destrutivo de objeto (`DROP TABLE/COLUMN/...`, `TRUNCATE`, `DELETE FROM`) — só `manual-risk` (guard E010; `DROP NOT NULL/CONSTRAINT/DEFAULT` são permitidos em `online-safe`).
- Migration só em diretório allowlisted (`apps/*/database/`) — `_enforce-migration-dir.yml` bloqueia fora disso.
- Antes de dizer "pronto": validar copiando o header do vizinho verde mais recente (maior `migration_NNN` já em prod) e conferir os 5 campos.

**2. Idempotência obrigatória.** Toda migration roda 2x sem erro: `IF NOT EXISTS`/`IF EXISTS` em `ALTER`/`CREATE`/`DROP`; `ADD CONSTRAINT` não aceita `IF NOT EXISTS` no Postgres 16 — envolver em `DO $$ ... END $$` checando `pg_constraint` antes. Se uma migration já aplicada falhar/rodar pela metade, **nunca reescrever o arquivo original** — criar migration nova de correção.

**2.1. Não fatiar em várias migrations o schema de uma mesma spec/feature no mesmo diff/PR.** Se as tabelas/colunas novas nascem juntas na mesma sessão de trabalho e uma depende logicamente da outra (ex.: tabela nova + FK que aponta pra ela + tabela de log relacionada), isso é **uma migration só**, não 2-3 arquivos separados por tabela. Fatiar sem necessidade não ajuda reversão (o guard `MAX_AUTO_PENDING=5` conta cada arquivo como uma migration pendente) e só multiplica header/arquivo pra revisar. Migrations diferentes se justificam quando entram em PRs/sessões diferentes, ou quando uma é reversível/independente da outra em produção — não pela conveniência de "uma tabela por arquivo".

**3. Fluxo padrão:** criar `migration_XXX_descricao.sql` em `./database/` → commit/PR pra `dev` → CI valida header/diretório/drift → merge em `dev`/`main` aplica via `apply_required_migrations.sh` antes de re-subir a aplicação. Nunca aplicar manualmente como primeira tentativa.

**4. Guard `MAX_AUTO_PENDING=5` (E012).** Deploy aborta com `Muitas migrations pendentes (N > 5)` se acumular >5 migrations sem promote (ou 1º deploy de módulo novo com todas as migrations de uma vez) — rollback automático preserva o estado, sem dano, mas não é bug, é proteção funcionando. Solução: aplicar manualmente com o MESMO script oficial, ajustando `MAX_AUTO_PENDING` pro total pendente (nunca fatiar em lotes — o script compara tudo de uma vez):
```bash
cd /opt/artificio-beta   # ou /opt/artificio em prod
cp apps/<modulo>/.env.<env> apps/<modulo>/.env   # docker compose só lê .env
COMPOSE_PROJECT=<projeto-compose> MAX_AUTO_PENDING=<N> \
  bash scripts/deploy/apply_required_migrations.sh \
  apps/<modulo>/docker-compose.<env>.yml <db-service> <db-name> <db-user> apps/<modulo>/database
rm -f apps/<modulo>/.env   # remover cópia temporária
```
`pg_dump` (snapshot) sempre antes, mesmo em banco "vazio" — é o rollback manual se algo falhar no meio.

**5. Drift/reconciliação.** Hotfix manual via SSH que altera schema sem passar pelo framework causa drift reverso (banco tem migration que o disco não tem) e bloqueia o próximo deploy automático. Depois de qualquer intervenção manual, reconciliar: `bash scripts/deploy/reconcile_migrations.sh --mark-applied migration_XXX_descricao.sql docker-compose.<env>.yml <db-service>`.

**6. Rotação de senha em volume Postgres já existente (E009).** `POSTGRES_PASSWORD` só grava em `pg_authid` na **primeira init** do volume — trocar no `.env` depois não reescreve nada. Sintoma: `28P01 password authentication failed` em loop mesmo com `.env` "correto"; `psql -h 127.0.0.1` engana (localhost é `trust`, aceita qualquer senha — testar sempre pela rede docker). Fix: DB vazio → recriar volume; DB com dado → `ALTER USER admin PASSWORD '<senha do .env>'` + `docker restart`.

**7. Por módulo (mapa completo em `docs/agents/deploy-runbook.md` §Migrations):** mesas e downloads usam o framework padrão em `apps/<mod>/database/`; site migra no entrypoint do container (`db/migrations/`), não pela esteira; glossário tem migrations legadas em `apps/glossario/database/legacy/` (fora do glob do runner, no-op até baseline explícita).

**8. Procedimento de emergência (migration `manual-risk` bloqueada ou drift `BLOCKED`):** acessar VM só após aprovação explícita, seguir gates de `PRE_DEPLOY_CHECKLIST.md`, disparar com `ALLOW_MANUAL_MIGRATIONS=true` (exige backup) quando for `manual-risk` legítima, reconciliar depois (item 5).

### Dockerfile de produção — incidente recorrente (E016/E017, `.specify/memory/errors.md`)

Já aconteceu 2 vezes: pacote `@artificio/*` novo vira dependency de um app, mas o `Dockerfile` do stage `production` não copia o `dist`/`dist-cjs` dele — build/CI passam verdes, container sobe e crasha só depois, com `MODULE_NOT_FOUND`, direto em beta/prod.

**Regra simples:** toda vez que adicionar/trocar import `from '@artificio/<pacote>'` num app com `Dockerfile` de produção (`apps/*/backend/Dockerfile`, `apps/*/frontend/Dockerfile`), antes de disparar deploy real:
1. Listar todos os `@artificio/*` importados pelo `src` do app (grep).
2. Conferir que cada um tem `COPY --from=builder .../dist` (e `dist-cjs` se o `package.json` do pacote tiver `main`/`require`) no Dockerfile.
3. Se Docker Desktop estiver rodando, `docker build --target production` local antes do deploy real.

---

## Regras de Produto e SEO

- Compromissos inegociáveis: gratuidade, sem anúncios, sem coleta desnecessária de dados.
- **Google OAuth é o único login.** Sessão única em cookie `Domain=.artificiorpg.com`. E-mail/senha só com autorização explícita. Exceção controlada: fluxo legado de migração do glossário (D061) pode verificar vínculo antigo sem criar sessão por e-mail/senha.
- **SEO é inegociável no site:** slugs e redirects 301 preservados, sem merge que cause regressão de meta/sitemap/canonical. Manter compatível com exigências de Search Console e Lighthouse.
- Toda mudança de interface respeita as **10 Heurísticas de Nielsen** e **ISO 9241-11** (eficácia, eficiência, satisfação) antes do merge. Checklist na sessão.
- Design sóbrio/minimalista com sobriedade de Google-suite (Docs/Gmail), sem copiar marca Google. Cores, logo e padrões vêm de `packages/ui`. Não divergir do design system por app/projeto sem aprovação.
- Analytics (GA4) cobre rotas públicas via `packages/analytics`. Toda página/rota pública nova é instrumentada. Admin/operacional só instrumenta eventos úteis, sem coletar dado desnecessário.
- Upload e processamento de imagem ocorrem sempre no Backend, via Cloudinary com signed preset. Nunca hardcodar credencial Cloudinary.

---

## Regras Gerais de Código

### O mantenedor não é programador — pergunta técnica se responde medindo (pétrea)

**O mantenedor não escreve código.** Toda pergunta sobre *como o sistema é* — qual campo, qual formato, de onde vem o dado, qual app faz diferente, o que já existe pronto — **é respondida pelo código, pela documentação ou pela VM**, nunca por ele. Devolver essa pergunta transfere a ele trabalho que é do agente e que ele não tem como fazer: ele não vai abrir o schema, não vai correr o `grep`, não vai comparar os três guards.

Isto não afrouxa §Autorização. Continua indo a ele, sempre: **decisão de produto, de risco, de escopo e toda ação perigosa** (commit, push, deploy, escrita na VM, SQL, DNS, lib nova). O que **não** vai é a pergunta cuja resposta está no repositório — inclusive quando o agente acha que "seria mais rápido confirmar". Não é mais rápido: é mais caro, e chega errado, porque ele responde sobre um sistema que só o agente acabou de medir.

Regra prática: antes de escrever uma pergunta, o agente verifica se ela cabe em `rtk rg`, `psql` read-only, leitura de schema/migration, `\d` de tabela, ou comparação entre apps. Se couber, **não é pergunta — é medição pendente**. Se depois de medir sobrar uma escolha real entre caminhos igualmente válidos, aí sim pergunta, já trazendo as opções **medidas** (§Evidência item 3) e a recomendação.

### Compartilhado por padrão; exceção por app é o defeito (pétrea)

O monorepo existe para que os apps compartilhem contrato, tipo, schema e comportamento. **Toda divergência por app é dívida até prova em contrário**, mesmo quando compila, mesmo quando o app isolado funciona.

- **Buscar o que já existe antes de escrever.** Pacote em `packages/*` que já resolve o problema é a resposta; escrever versão local do mesmo conceito é o erro. Quando dois apps precisam da mesma coisa, ela sobe para o pacote — não se copia.
- **Contrato do pacote é a autoridade.** Se `packages/*` define um schema/tipo/formato, o app obedece. App que manda outro formato está errado **mesmo que o app não quebre**: quebra no consumidor, camadas adiante, com erro opaco. Incidente real (2026-08-18, spec 090): `subjectAuthorization.ts:135` define `ownerUserId: z.uuid()`; o `mesas` mandava `google_id` de 21 dígitos, e o sintoma foi `400` genérico vindo do `accounts` sete camadas depois — o app de origem não acusou nada.
- **Guard/validação compartilhada precisa estar LIGADA, não só existir.** No mesmo incidente, `normalizeGuardResult` existia no pacote exatamente para revalidar o retorno de guard escrito noutro app, e **nenhum dos três apps o chamava** — só o `accounts`. Gancho de validação escrito e não ligado é pior que ausente: passa a impressão de cobertura que não existe.
- **Ao corrigir defeito num app, cruzar com os outros que fazem a mesma coisa.** A pergunta não é "por que este quebrou", é "por que os outros não quebraram" — e a resposta frequentemente é *"porque aquele caminho nunca foi exercitado"*, não *"porque está certo"*. No mesmo incidente: o `site` mandava `null` fixo e o `downloads` tinha a tabela de donos **vazia em beta e em produção**; os dois "funcionavam" sem nunca ter mandado um dono real.
- **Identidade, formato e vocabulário atravessam apps.** Um id é o mesmo id em todo o monorepo. App que mantém representação paralela da mesma entidade cria tradução, e toda tradução é uma chance de divergir. Preferir sempre a chave que o dono do dado emite.
- **Solução dinâmica, não caso particular.** Corrigir com condicional por app (`if (app === 'mesas')`), lista fixa ou exceção pontual é sinal de que a correção está no lugar errado: ela pertence ao contrato compartilhado, onde vale para todos, inclusive para o próximo app que ainda não existe.

- Mudança reversível, dentro do escopo, sem refactor massivo não pedido. **"Solução mínima" é proibido como critério de correção de bug/achado de review — foco é solução correta e completa, não a menor edição que faz o sintoma sumir.** Corrigir errado/parcial pra "economizar" gera retrabalho maior depois (o mantenedor tem que redescobrir o problema, pedir de novo, e corrigir o que devia ter sido corrigido direito da primeira vez). Ao corrigir achado de bot de review (Codex/CodeRabbit/Sonar) ou bug reportado: entender a causa raiz, resolver ela por completo (schema/tipo/contrato incluídos se for o caso), não só abafar o sintoma pontual citado no comentário. Escopo mínimo ainda vale pra **abrangência** (não sair mexendo em código não relacionado ao achado) — não vale pra **profundidade** da correção do que está de fato em escopo.
- Stack canônica única: Frontend React 19/TS/Vite/Tailwind; Backend Node/Express 5/TS/Kysely/Postgres 16; auth via JWT no backend.
- Python só para scripts fora do runtime principal.
- **Normalização obrigatória:** todo dado de API/banco/JSON/JSONB/query/localStorage/integração externa é `unknown` até passar por normalizador tipado antes de entrar em estado React, props ou render.
- Proibido `.map/.filter/.reduce/.forEach`, spread de array ou `.length` sobre payload externo sem `Array.isArray`/schema/fallback explícito.
- HTML de conteúdo de usuário/rich-text é hostil: sanitizar sempre (DOMPurify) antes de persistir/renderizar.
- **Comentário explicativo de decisão não se perde em edit/fix subsequente (nem de bot de review — CodeRabbit/Sonar/Codex/etc).** Quando um trecho comentado é editado (fix de bug, correção de review, refactor local), o agente preserva ou reescreve o comentário pra continuar explicando a decisão atual — nunca apaga silenciosamente um comentário que documentava por que o código era daquele jeito, mesmo que o código mude. Se a mudança troca a razão de ser do trecho, o comentário deve ser atualizado pra refletir a nova decisão e citar a origem (ex.: achado de review, número de spec/débito, comportamento real observado), no mesmo padrão que já se usa nesta base (`DEB-NNN`, `T-XX`, referência a spec/PR) — pra que outro agente, lendo só o código depois, entenda o porquê sem precisar reconstruir o histórico do chat.

---

## Erros Conhecidos

Ao encontrar erro/regressão: (1) parar tentativas repetidas; (2) consultar `.specify/memory/errors.md` por código `E###` ou sintoma; (3) se houver solução documentada, aplicar e registrar evidência; (4) se não, diagnosticar e registrar aprendizado validado.

## Conclusão de Tarefas

Conclusão é afirmação, e afirmação exige medição citada (§Regras Pétreas → Evidência): declarar tarefa concluída sem os comandos que provam a conclusão é o mesmo defeito que afirmar causa sem medir. Concluída só quando: busca final relevante retorna o esperado; comando/teste real executou quando a tarefa promete executabilidade; nenhum arquivo parcialmente modificado; validação técnica/manual registrada **somente no documento autorizado**, quando o mantenedor pediu registro. Não abrir nem atualizar automaticamente `project-state.md`, `specs/backlog.md`, sessão, `tasks.md` ou qualquer documento não nomeado. Não declarar conclusão usando "parcial", "restante", "maioria", "principais", "alguns" ou percentual incompleto. Status parcial pode ser registrado no destino autorizado, nunca como conclusão final.

Se uma validação real expõe que a tarefa "fechada" ainda não roda, reabrir a task/backlog imediatamente, corrigir o artefato até ficar usável ou registrar bloqueio concreto. Dry-run, plano ou documentação não fecham tarefa cujo aceite exige execução real.

**Proibido ampliar escopo documental por rotina de fechamento.** Spec nova, retomada, fechamento, review, bug ou pendência não autorizam verificar ou atualizar backlog, estado, decisões, sessão ou outro arquivo. Reportar ao mantenedor; registrar apenas onde ele mandar.

**Atualizar documentação é REESCREVER o bloco existente, nunca anexar bloco novo (pétrea).** Doc de spec (`tasks.md`, `spec.md`, `plan.md`, sessão) descreve **estado atual**, não histórico de sessões. Anexar "estado em <data>" abaixo do "estado em <data anterior>" transforma o arquivo em log cronológico: cresce sem limite, o agente seguinte lê camadas contraditórias e não sabe qual vale, e o mantenedor paga token por informação que já morreu. Incidente real: 2026-08-07, `specs/090/tasks.md` — bloco novo de T2.5 anexado sem tocar no existente, +85 linhas, 0 removidas; o mantenedor perguntou "o tasks vai ficar que tamanho?".

Regras operacionais, sem exceção:

- **Localizar o bloco da task ANTES de escrever.** `rtk rg "T<N> —" <arquivo>` e abrir a região inteira. Escrever sem ler o que já existe é o que produz empilhamento.
- **Uma task tem UM bloco de estado.** Task retomada em sessão nova → o bloco é reescrito, não duplicado. Não existe "estado em 2026-08-05" convivendo com "estado em 2026-08-07" da mesma task.
- **Trabalho já merged encolhe.** Enquanto a task está aberta, o bloco carrega o detalhe que sustenta a retomada. Depois do merge, o *porquê* de cada decisão vive no comentário do próprio código (§Regras Gerais de Código — comentário explicativo não se perde), e a doc guarda só: o que foi entregue, o bloqueio que resta, e a decisão que precisa de conferência. Narrar de novo, na spec, o que o código já explica é duplicação que envelhece sozinha.
- **Medir e reportar o delta.** Ao terminar, `rtk git diff --stat <arquivo>`. Um diff só de inserções em doc de estado é sinal de empilhamento — releia antes de entregar. O relatório ao mantenedor diz o delta ("−43 linhas, mesma informação"), não só "documentei".
- **O que nunca se apaga:** decisão do mantenedor, bloqueio ainda aberto, achado lateral pendente de resposta, e erro do próprio agente já registrado (§Formato do relatório → não esconder erro próprio). Condensar é remover redundância e narrativa de processo — não remover fato que ainda decide alguma coisa.

### Formato do relatório final ao mantenedor (obrigatório)

Vale pra **toda entrega de mérito** — commit/push/PR, correção de achado de bot, investigação, decisão técnica. Não vale pra resposta curta de pergunta direta. Formato pedido nominalmente pelo mantenedor em 2026-07-30, derivado dos relatórios da fase 9 da spec 089. Responder em português e preservar todas as seções obrigatórias e explicações de custo/risco.

Ordem e conteúdo:

1. **Resultado primeiro, em uma linha.** SHA do commit, número da PR, contagem de arquivos/linhas, ou o fato central. Sem preâmbulo, sem recapitular o que foi pedido.
2. **Números de validação, sempre reais.** Testes (`N/N` por app), lint, `tsc`, `verify:api`, guard executado. Nunca "tudo verde" sem número — número é o que distingue validação de impressão. Se um comando não rodou, dizer que não rodou. **Isto é o fim de uma obrigação que vale a mensagem inteira, não só o relatório:** §Regras Pétreas → Evidência exige a mesma citação de comando em toda afirmação feita **durante** o trabalho. Relatório com números no fim, depois de um diagnóstico afirmado sem medição no meio, chega tarde — o mantenedor já decidiu sobre a afirmação errada.
3. **O que foi corrigido, agrupado por achado, com o porquê.** Não listar arquivo tocado — listar *problema resolvido*. Cada item explica a consequência real pra quem usa o produto ou opera a VM, não só o sintoma técnico (ex.: "falha de rede virava acervo vazio, que lê como perda de dados").
4. **O que foi descartado, com motivo curto.** Achado de bot recusado, sugestão não seguida, alternativa avaliada. Silêncio sobre item descartado lê como esquecimento.
5. **A decisão que mais precisa de conferência, marcada como tal.** Quando a entrega muda regra de produto, custo operacional ou comportamento observável, destacar em bloco próprio e dizer explicitamente qual é o trade-off e qual seria o caminho alternativo se o mantenedor discordar. Isto é o item mais importante do relatório: é onde o agente devolve ao mantenedor uma decisão que ele não sabia estar tomando.
6. **Achado lateral não pedido, se houver — já corrigido.** Bug/vulnerabilidade visto de passagem entra no relatório como **conserto feito e medido**, não como pergunta (§Regras Pétreas → Bug achado / débito). Só aparece como pergunta se cair numa das duas exceções de lá: precisa de ação de aprovação nominal, ou mudaria regra de produto/contrato. Nunca oferecer "registrar como débito" — débito só se o mantenedor pedir.
7. **Bloqueio e encerramento.** O que ficou aberto e por quê (ambiente, autorização, dependência) — sempre nomeado como bloqueio, nunca como conclusão parcial. Fechar dizendo onde o trabalho parou (ex.: "encerro aqui, sem acompanhar checks", §PR, Commit e Push).

Travas do formato:

- **Nada de emoji decorativo, tabela enfeitada ou barra de progresso.** Prosa curta e cabeçalho.
- **Não elogiar a própria entrega** ("ficou robusto", "solução elegante"). Fato e número bastam.
- **Não esconder erro próprio.** Se o agente introduziu o defeito que está corrigindo, o relatório diz isso na primeira linha do item, sem rodeio e sem autoflagelo (§Corrections). Foi assim que o `DELETE FROM` barrado pelo guard (PR #230, 2026-07-30) apareceu antes de virar aborto de deploy na VM.
- **Seção vazia se omite**, não vira "nada a relatar".

---

## Review guidelines

Seção lida pelo Codex code-review (GitHub App, `chatgpt-codex-connector`) em PRs — convenção própria do produto, não um filtro de path garantido como `.coderabbit.yaml` (`path_filters`). É instrução textual best-effort: o bot pode ainda ler o diff completo, só é pedido pra não focar comentário/achado nesses casos. Não existe `.codexignore` (feature só em discussão, não implementada em 2026-07 — ver `openai/codex` discussion #3456).

- Não revisar/comentar mudanças só em `.md` (documentação, specs, sessões) — cobertura de conteúdo/redação é responsabilidade do mantenedor, não do bot.
- Não revisar/comentar `docs/api/generated/**` nem `docs/api/openapi/**` — artefatos auto-gerados por `pnpm verify:api`/`pnpm api:bundle`, nunca editados à mão.
- Focar em `apps/**`, `packages/**`, `scripts/**` e config de infra/CI (lógica, contrato, segurança) — mesmo escopo já usado pelo CodeRabbit (`.coderabbit.yaml`).

---

## Documentação Canônica

| Tipo | Fonte |
|---|---|
| Governança operacional | `AGENTS.md` |
| Estado atual (fase/gate) | `.specify/memory/project-state.md` |
| Erros conhecidos | `.specify/memory/errors.md` |
| Contexto de retomada | `docs/agents/context-capsule.md` ⃰ |
| Sessões | `sessoes/index.md` + `sessoes/*.md` |
| Specs SDD | `specs/README.md` + `specs/backlog.md` + `specs/*/{spec.md,plan.md,tasks.md}` |
| Subagentes | `.claude/agents/` |
| Skills/playbooks locais | `.agents/skills/` |

⃰ `docs/agents/*` = docs internas de operação, **fora do repositório público** (gitignored, só local + backup do mantenedor).

## Ferramentas MCP / Agentes

As ferramentas locais abaixo foram adotadas para reduzir retrabalho, detectar erros cedo e evitar descoberta de API por memória de chat. São opcionais por ambiente, não-versionadas quando dependem de config local, e devem funcionar em **Codex**, **Claude Code** e **OpenCode** quando disponíveis. Se uma delas não aparecer no cliente atual, registrar a limitação na sessão e usar fallback local (`rtk rg`, `ast-grep`, leitura direta e `pnpm verify:api` quando aplicável).

### rtk — proxy CLI de compressão de saída (T1, ref. `rtk_readme.md`)

- **Função:** filtra/comprime saída de comando shell antes de chegar ao contexto do agente (até -90% bytes). Usar sempre que disponível no lugar do comando cru equivalente — trava resumida em §T0.
- **Verificação de sessão:** `rtk --version` / `rtk gain` (se falhar, tratar como indisponível e cair pro fallback cru — não travar a sessão).

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

**Forçamento automático (instalado 2026-07-27, após ~50 esquecimentos na semana).** A regra deixou de depender da memória do agente. Três camadas, em ordem de execução:

1. **`rtk hook claude`** (`PreToolUse` em `Bash`, config global do Claude Code) — reescreve o comando cru para o equivalente `rtk` de forma transparente. Cobre `cat`/`head`/`grep`/`rg`/`find`/`git`/`gh`/`tsc`/`eslint`/`vitest`/`jest`/`ls`/`npx …`/`pnpm run …`. **Não é opcional nem visível**: quando funciona, o agente nem percebe.
2. **`rtk-enforce.js`** (`PreToolUse` em `Bash`, roda logo depois) — **bloqueia** (`permissionDecision: deny`) o que a camada 1 deixa passar: `pnpm <script>` sem `run` (`pnpm verify:api`, `pnpm test`) e `pnpm --filter <pkg> <script>` não são reescritos. O deny devolve o comando corrigido pronto, então o custo é reemitir na mesma volta. Conferir a cobertura real com `rtk hook check`.
3. **`rtk-read-gate.js`** (`PreToolUse` em `Read`) — o hook do rtk **só intercepta o tool `Bash`**; `Read`/`Grep`/`Glob` são nativos e passam por fora dele, que é por onde "esqueci o `rtk read`" escapava. O gate bloqueia leitura **integral** de arquivo com mais de 600 linhas e de lockfile, sempre sugerindo `rtk read`, `offset`/`limit` ou LSP. Leitura com `offset`/`limit` passa direto — ler trecho de arquivo grande é o comportamento desejado, não a violação.

Consequência prática: **não existe mais "esqueci"**. Ou o comando é reescrito sem o agente notar, ou é bloqueado com a correção no motivo. O que o agente ainda precisa fazer por conta própria é escolher LSP/`codebase-memory-mcp` antes de busca textual — isso nenhum hook decide.

**Comando obrigatório para lint/build/test/verify, na raiz do monorepo:**

| Fazer | Nunca |
|---|---|
| `rtk pnpm run lint` | `pnpm run lint`, `pnpm lint`, `rtk lint` |
| `rtk pnpm run build` | `pnpm run build`, `rtk tsc` |
| `rtk pnpm run test` | `pnpm run test`, `pnpm test` |
| `rtk pnpm verify:api` | `pnpm verify:api` |

`rtk lint`/`rtk tsc` (subcomandos dedicados) falham **na raiz** com `JSON parse failed` — o turbo não entrega o formato que eles esperam (DEB-088-01). Dentro de um app (`cd apps/x && rtk tsc -p tsconfig.json`) funcionam normalmente, porque não passam pelo turbo. Cair no `pnpm` cru **não** é o contorno: perde a compressão inteira.

Esta tabela **não depende de o agente lembrar dela**: as regras `script-pesado-sem-rtk` e `rtk-subcomando-quebrado-no-turbo` do `rtk-enforce.js` bloqueiam cada linha da coluna "Nunca" e devolvem a da coluna "Fazer" já montada. A tabela existe para explicar o *porquê* — o cumprimento é mecânico.

**Erros cometidos em smoke test (2026-07-25, build develop `bee2178`) — não repetir:**
- `rtk gain --graph` truncado com `| head -20`: gráfico ASCII de 30 dias vem DEPOIS da tabela "By Command", que já ocupa ~15 linhas — `head` curto corta o gráfico fora e parece bug no rtk quando não é. **Nunca concluir "comando não fez X" a partir de saída truncada por `head`/`tail`/pipe curto — rodar sem corte antes de reportar falha.**
- `rtk cargo test --lib` no repo `rtk` (binário puro, sem lib target) falhou com `no library targets found in package`: erro é do argumento `--lib`, não do rtk. **Antes de passar flag de escopo (`--lib`, `--bin`, `-p`), confirmar a estrutura do pacote (`Cargo.toml`/`cargo metadata`) — não assumir que todo crate Rust tem lib target.**
- `rtk discover` sem flag deu "Scanned: 0 sessions" (parecia bug); com `--all` achou 138 sessões/20712 comandos. Comportamento é **default por design** (escopo = projeto atual, filtro por path), não falha. **Ler `rtk <subcomando> --help` antes de declarar resultado vazio como bug — comportamento default restrito pode ser intencional, não regressão.**
- Comando em background (`run_in_background`) não herdou `PATH` setado manualmente na sessão anterior (`cargo` sumiu do PATH) — cada shell/background job tem seu próprio ambiente. **Ao rodar comando `rtk`/`cargo`/etc em background após ajustar PATH manualmente, re-exportar o PATH dentro do MESMO comando (`export PATH=...; rtk ...`), nunca assumir que persiste entre chamadas de shell.**

### LSP / diagnósticos semânticos

- **Origem/registro:** Spec 044 consolidou LSP como parte do ecossistema de agentes; o mantenedor reforçou em 2026-07-08 que ele detecta erros automáticos que antes passavam despercebidos.
- **Função:** diagnóstico semântico contínuo: tipos quebrados, imports inválidos, símbolos inexistentes, assinaturas incompatíveis e erros que busca textual não revela.
- **Usar para:** checar arquivos tocados antes/depois de edição; confirmar impacto local de refactor; achar erro rápido enquanto ainda é barato corrigir.
- **Clientes:** OpenCode expõe LSP diretamente; Claude Code pode usar plugin LSP; Codex depende das ferramentas disponíveis no turno/config local.
- **Trava:** LSP é importante, mas auxiliar. Diagnóstico limpo não substitui `pnpm run lint`, `pnpm run build`, testes pontuais e `pnpm verify:api` quando exigidos.

### codebase-memory-mcp

- **Origem:** Spec 044 / DEB-044-02. Configurado em OpenCode e Claude Code; Codex usa config MCP local do usuário. Versão instalada se lê com `codebase-memory-mcp --version` — não fica registrada aqui, porque número em doc envelhece sozinho e vira afirmação falsa que ninguém mede.
- **Função:** grafo persistente do código para descoberta estrutural, chamadas, arquitetura e impacto. Complementa LSP e busca textual.
- **Ferramentas esperadas:** `search_graph`, `trace_path`, `get_code_snippet`, `query_graph`, `get_architecture`.
- **Usar para:** achar funções/classes/rotas/variáveis por padrão; rastrear quem chama quem; ler snippet específico; consultar fan-out/fan-in; obter visão de arquitetura.
- **Não usar para:** literais, mensagens, configs, docs, YAML/JSON, shell, Dockerfile ou quando o grafo estiver desatualizado/insuficiente. Fallback = `rtk rg`, `ast-grep`, leitura direta.
- **Disciplina:** código real continua fonte material. Se grafo e arquivo divergirem, o arquivo vence; registrar débito se a ferramenta induzir erro recorrente.

### artificio-api-governance

- **Origem:** Spec 055 / DEB-055-06. Sobe com `pnpm api:mcp`, servidor MCP stdio mínimo sobre `scripts/api/api-mcp-server.ts`.
- **Função:** descoberta de rotas de API a partir do bundle gerado, proibindo uso de memória de chat como fonte primária.
- **Ferramentas esperadas:** `search_api` e `get_api_bundle_summary`.
- **Fonte lida:** somente `docs/api/generated/artificio-api.bundle.json`. Se desatualizado, rodar `pnpm verify:api` e revisar artefatos gerados.
- **Usar para:** descobrir método/path/app/scope/auth/consumidores de rota; confirmar impacto de mudança API; orientar atualização OpenAPI.
- **Não usar para:** provar comportamento runtime sozinho. Depois da descoberta, verificar código real e rodar `pnpm verify:api` quando tocar `apps/**`, `packages/**`, `scripts/api/**`, `docs/api/openapi/**` ou allowlist.

### cloudflare (5 servidores) — **acesso à conta de produção**

- **Origem/registro:** instalado em 2026-08-03 por autorização nominal do mantenedor, durante a sessão `26-08-03_1_seguranca_snyk-headers-sast` (achado A, HSTS). Instruções oficiais: `https://developers.cloudflare.com/agent-setup/prompt.md`.
- **Instalado em:** Claude Code (plugin `cloudflare@cloudflare`, marketplace `cloudflare/skills`), Claude Desktop (`%APPDATA%\Claude\claude_desktop_config.json`), Codex CLI + Desktop (`~/.codex/config.toml`, config compartilhada). Cursor, VS Code e OpenCode **não** foram configurados de propósito.
- **Servidores:** `cloudflare-docs` (público, sem auth) · `cloudflare` (API geral) · `cloudflare-bindings` · `cloudflare-builds` · `cloudflare-observability` — os 4 últimos autenticam por OAuth.

**Trava pétrea — o que estes MCPs realmente alcançam.** A conta Cloudflare autenticada é a **mesma que controla DNS, Tunnel e TLS de `artificiorpg.com` e de todos os subdomínios**. Ter a ferramenta disponível não é autorização para usá-la:

- **Leitura** (consultar zona, registro, config de SSL/TLS, build, log, métrica) segue a regra geral: read-only é sempre permitido, sem aprovação por ação. Vale a obrigação de filtrar segredo da saída — nunca imprimir token, chave de API ou `*SECRET*`.
- **Qualquer escrita** (criar/alterar/remover registro DNS, rota de tunnel, regra, header, certificado, binding, deploy) exige **aprovação nominal por ação**, no formato "APROVAÇÃO NECESSÁRIA", exatamente como um comando de escrita na VM. A existência do MCP **não** afrouxa §Regras Pétreas → Autorização; a barreira deixou de ser técnica e passou a ser só a regra — por isso ela vale mais aqui, não menos.
- **DNS raiz de `artificiorpg.com` continua exigindo aprovação explícita**, inclusive por MCP. Ver §Gates do Programa.
- **HSTS é decisão do mantenedor, não do agente.** `Strict-Transport-Security` tem um dono só: a borda Cloudflare (decisão D1, sessão `26-08-03_1`). Habilitar/alterar `max-age`, `includeSubDomains` ou `preload` cacheia no browser do usuário final e **não tem rollback rápido**. Agente não liga, não sobe escada, não sugere `preload` sem pedido nominal.

- **Usar para:** consultar documentação Cloudflare (`cloudflare-docs`, dispensa auth e é a primeira escolha); inspecionar estado real de zona/DNS/tunnel/SSL antes de diagnosticar infra (anti-retrabalho — inspeção read-only precede correção no chute); ler build e observabilidade de Workers/Pages quando aplicável.
- **Não usar para:** substituir `docs/agents/deploy-runbook.md` como fonte de topologia do projeto; provar comportamento de aplicação (o container e o código continuam sendo a verdade material); nem executar escrita por conveniência durante diagnóstico.

### opencode/DeepSeek a partir do Claude Code — **usar o oficial (`mcp__opencode__*`)**

Existem **dois** servidores registrados que chegam no mesmo opencode/DeepSeek. Não são alternativas de gosto: **o oficial é o padrão, o wrapper é fallback.** Ambos instalados em 2026-08-19 por pedido nominal do mantenedor.

| Servidor | Ferramentas | Quando usar |
|---|---|---|
| `opencode` (oficial, ~80 ferramentas) | `opencode_setup`, `opencode_ask`, `opencode_reply`, `opencode_run`, `opencode_fire`, `opencode_check`, `opencode_review_changes`, … | **sempre, por padrão** |
| `opencode-deepseek` (wrapper local, 1 ferramenta) | `deepseek` | **só se o oficial não responder** |

**Por que o oficial ganha — medido em 2026-08-19, mesma pergunta nos dois:**

- **Sessão persiste.** A primeira pergunta custou 1697 tokens de entrada; o follow-up na mesma sessão custou **74**, porque reusou o contexto em vez de reler o arquivo. O wrapper abre sessão nova a cada chamada — em trabalho de várias rodadas (spec com fases, revisão iterativa) isso relê tudo toda vez.
- **Informa custo e tokens** por chamada (`$0,0010 | 1697 in, 127 out`). O wrapper não informa nada.
- **Dá acompanhamento e diff:** `opencode_check` (progresso de tarefa longa), `opencode_review_changes` (diff da sessão), `opencode_session_todo`. O wrapper só devolve o texto final.
- **Respondeu com mais precisão** na mesma pergunta: distinguiu que `VTT_ALIASES` tem 12 chaves para **6 plataformas** (6 por slug + 6 por nome), enquanto o wrapper disse "12 chaves de plataforma".

**Uso do oficial, na ordem:** `opencode_setup` (checa saúde e providers) → `opencode_provider_models` para confirmar o model ID **em vez de chutar** → `opencode_ask` (tarefa curta) ou `opencode_run`/`opencode_fire` + `opencode_check` (tarefa longa) → `opencode_reply` para continuar na mesma sessão. Passar sempre `providerID`/`modelID` descobertos (ex.: `deepseek` / `deepseek-v4-pro`) — sem isso a resposta pode voltar vazia. Passar `directory` com o caminho absoluto do projeto.

**Passar SEMPRE `agent:` — sem isso a sessão trava no primeiro comando.** Delegação de implementação vai com `agent: "artificio-implementador"`; investigação com `artificio-investigador`; revisão com `artificio-revisor` (lista completa em `.opencode/agents/`). Omitir `agent:` cai no agente default, que **não tem allowlist** e herda `permission: { bash: "ask" }` do `opencode.json` da raiz — cada comando vira um pedido de permissão que só o Claude Code responde (`opencode_permission_list` → `opencode_session_permission`), e o DeepSeek fica parado esperando. **Isso anula o propósito da delegação:** o opencode existe para o trabalho rodar sem consumir contexto do orquestrador; se o orquestrador precisa aprovar comando a comando, ele gasta mais token vigiando do que gastaria fazendo.

**Incidente que originou a regra (2026-08-19, spec 093 Fase 1).** `opencode_fire` disparado sem `agent:` travou no **primeiro** comando — um `rtk rg` na própria `tasks.md` que o prompt mandava ler. A causa não era só o `agent:` ausente: `rtk rg -n "rtk" .opencode/agents/` devolvia **zero** — nenhum dos nove agentes conhecia `rtk`, porque as allowlists foram escritas antes de o `rtk` virar obrigatório neste arquivo. Como toda instrução manda usar `rtk`, **100% dos comandos** caíam no `"*": ask`, com qualquer agente. Corrigido espelhando cada entrada do bloco `bash:` na forma `rtk <cmd>`, **preservando a política de cada linha** (199 entradas nos 9 agentes).

**Por que espelhar e não liberar `"rtk *": allow`:** `rtk *` cru casaria `rtk git push`, passando por cima do `deny` de `git push*` — o prefixo muda a string e o padrão não casa mais. Espelhado, `rtk git push*` herda o `deny` que `git push*` já tinha, e o que não está na lista continua perguntando. **Nunca** afrouxar `opencode.json` para `bash: allow` como atalho: resolveria o travamento e destruiria a trava, já que nada impediria um `git push`. Os `deny` do frontmatter valem sempre; a vigilância do orquestrador vale enquanto ele estiver olhando.

**Ao acrescentar comando novo à allowlist de um agente, acrescentar a forma `rtk` junto** — senão o furo volta a abrir sozinho na próxima vez que alguém editar.

**A notificação do `opencode_fire` NÃO significa que a sessão terminou.** Quando o `fire` estoura o timeout da chamada MCP e vira task de background, a `<task-notification>` que chega depois é do **`fire`**, não da sessão do opencode: ela dispara quando a chamada MCP retorna. **Medido (2026-08-19, spec 093):** a notificação "completed" chegou no exato instante em que o agente **abortou** a sessão, com zero linha escrita. Tomar esse sinal como conclusão é declarar pronto um trabalho que não aconteceu.

**Como saber que a sessão realmente parou.** Não existe endpoint de status — medido: `/api/session/{id}/status` devolve o HTML da UI e `/api/session/status` devolve `InvalidRequestError`. O sinal disponível é `time.updated` do objeto da sessão (`GET /api/session/{id}`, porta padrão `4096`) parando de avançar. As três opções, e por que só uma serve:

| Caminho | Problema |
|---|---|
| Esperar a notificação do `fire` | não indica fim da sessão (acima) |
| `opencode_wait` | bloqueia o orquestrador segurando o turno |
| Chamar `opencode_check` em ciclo | é o token do orquestrador gasto vigiando — anula o motivo de delegar |
| **`Monitor` com watcher de `time.updated`** | **o correto**: custo ~zero enquanto roda, uma notificação no fim |

O watcher dispara em **"parou"**, não em "terminou com sucesso" — fim normal, crash e travamento acionam igual. Watcher que só reconhece sucesso fica mudo exatamente no caso em que o mantenedor precisa saber.

**O orquestrador é submantenedor, não executor.** Se ele está investigando, medindo, aprovando permissão a permissão ou construindo ferramenta para vigiar a sessão, está gastando o token que a delegação existia para poupar — e fazendo o trabalho que era do outro agente. O trabalho é do subagente: ele investiga, decide, implementa e valida. Ao orquestrador cabem o prompt, a trava de ação perigosa (commit/push/deploy/SQL seguem exigindo aprovação nominal do mantenedor, §Autorização) e o relato final. Corolário prático: **nunca construir auto-aprovador de permissão** — permissão travando é sintoma de allowlist errada ou `agent:` ausente, e o conserto é a config, não uma babá.

**Wrapper local (`opencode-deepseek`) — fallback.** Código em `docs/agents/opencode-mcp/` (`server.mjs` + `README.md`), **gitignored** (`/docs/agents/*`), fora do fluxo de PR. Spawna o binário nativo (`%APPDATA%\npm\node_modules\opencode-ai\bin\opencode.exe`) com `shell: false` e **stdin fechado** (`stdio: ["ignore","pipe","pipe"]`): sem shell por causa do quoting/encoding do Windows, com stdin fechado porque `opencode run` trava esperando EOF se o stdin fica como pipe aberto. Duas armadilhas já pagas, documentadas no `README.md` — ir lá antes de mexer.

**A armadilha que vale para os dois, e que quase passou:** o `opencode.json` da raiz declara `permission: { edit: "ask", bash: "ask" }`. Em modo headless não há quem responda, e o opencode **auto-rejeita toda chamada de ferramenta**, abortando com **exit 0 e stdout vazio** — falha que se disfarça de sucesso. Prompt trivial ("responda PING") funciona, porque não usa ferramenta nenhuma; só uma tarefa que precise **ler arquivo** expõe o problema. O wrapper passa `--auto` sempre e trata exit 0 sem saída como erro. Consequência para quem valida qualquer um dos dois: **`tools/list` não prova nada** — o smoke que vale é uma chamada real que obrigue o DeepSeek a ler arquivo.

**Trava:** ter qualquer um dos dois disponível **não** é autorização para acionar o outro agente. §Regras Pétreas → Autorização continua valendo: Claude Code ↔ OpenCode só com aprovação nominal por ação, priorizando read-only (análise, revisão, diagnóstico). `--auto` aprova ferramenta dentro da sessão do opencode; não substitui a aprovação do mantenedor para acionar o agente.

### Ordem de uso

1. `artificio-api-governance` para qualquer pergunta/mudança de API.
2. LSP para diagnóstico automático de arquivos tocados e impacto semântico.
3. `codebase-memory-mcp` para mapa estrutural, dependências, chamadas e arquitetura.
4. `ast-grep`, `rtk rg`, `rtk read`, `git`, leitura direta e validação CLI.

Para delegar ao opencode/DeepSeek (só com aprovação nominal): **`mcp__opencode__*` (oficial)**; `mcp__opencode-deepseek__deepseek` só se o oficial não responder. Detalhe e medição: §opencode/DeepSeek.

**Mapeamento operação → ferramenta:**

- Onde X está definido → LSP `workspaceSymbol`/`goToDefinition`.
- Quem usa/chama X → LSP `findReferences` ou `codebase-memory-mcp`.
- Interface → implementação concreta → LSP `goToImplementation`.
- Tipo/assinatura sem abrir arquivo inteiro → LSP `hover`.
- Depois de escrever/editar código → checar diagnostics do LSP e corrigir antes de prosseguir (trava completa: §LSP).
- Grep/`rtk rg` para texto/padrão literal (comentário, string, config, YAML/JSON/Dockerfile/shell) ou quando LSP não cobre a linguagem/arquivo.

Config local pode diferir entre clientes:
- **OpenCode:** `opencode.json`.
- **Claude Code:** MCP local em `.claude.json`/config Claude do usuário; MCP vindo de plugin fica sob `plugin:<nome>:<servidor>` e aparece em `claude mcp list`. Plugin recém-instalado só expõe as ferramentas após `/reload-plugins` ou reinício da sessão.
- **Claude Desktop:** `%APPDATA%\Claude\claude_desktop_config.json`, bloco `mcpServers`. Exige reinício do app.
- **Codex (CLI e Desktop):** `C:\Users\paulo\.codex\config.toml`, blocos `[mcp_servers.<nome>]` — **config compartilhada entre os dois**; registrar uma vez vale para ambos. `codex mcp list` mostra o status de OAuth por servidor.

Não acionar outro agente em nome do mantenedor sem aprovação nominal; usar MCPs locais de leitura/navegação não muda esta regra.

Fluxo de orquestrador/fases específico do OpenCode (agente único `artificio-orquestrador`, fases fix→registro→investigação→implementação→doc→commit) não se aplica ao Claude Code — ver `docs/agents/opencode-supervisor-flow.md`.
