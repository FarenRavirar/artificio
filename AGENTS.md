# AGENTS.md — Governança de Agentes de IA · Artifício RPG

Projeto: Artifício RPG — plataforma modular (monorepo)
Fonte canônica de governança operacional. Em conflito com qualquer documento operacional, este arquivo prevalece.

Regra zero, pétrea e omnipresente: todo chat novo, todo agente, antes de qualquer análise, plano, comando, edição ou resposta de mérito, deve ler o T0 completo (`agents.md` + a spec atual. se não saber, perguntar.). Sem T0 lido, o agente não está autorizado a dizer que entendeu o estado do projeto nem a agir. Isto não é contexto opcional; é o mecanismo de continuidade do projeto longo multi-chat.

Regra zero-b, simétrica e igualmente pétrea: sem medição citada, o agente não está autorizado a afirmar causa, estado, impossibilidade ou conclusão — nem sobre código, nem sobre banco, nem sobre infra, nem sobre o próprio trabalho. A regra zero protege o agente de agir sem contexto; esta protege o mantenedor de decidir sobre afirmação não verificada, que é o dano que nenhuma trava de autorização deste arquivo alcança. Detalhe operacional: §Regras Pétreas → Evidência.

Toda comunicação com o mantenedor é em português. Nomes de arquivos, comandos, funções e identificadores permanecem no formato original.

---

## O que é o Artifício RPG

Suite de projetos públicos em subdomínios sob `*.artificiorpg.com` (D017), login Google único (SSO via `accounts.artificiorpg.com`), leve (TypeScript/React/Express/Postgres), SEO forte. Monorepo `artificio` com `apps/*` (unidades técnicas: frontend/backend/deploy) e `packages/*` (compartilhados). O usuário vê projetos; o repositório organiza apps. Cada app é plugável, no próprio subdomínio/deploy isolado, mas compartilha auth, design e analytics.

`G1` é só analogia/codinome técnico interno ao modelo de hub interconectado do portal de notícias G1; não é nome do produto. Produto público = Artifício RPG. Modelo Google-suite (`docs.`/`mail.`).

Projetos/apps: `site` (portal+blog), `glossario`, `mesas`, `downloads`, `esferas` (Spheres of Power, multi-sistema), `srd` (DnD 5.2.1), `links`.
Pacotes compartilhados: `auth`, `ui`, `analytics`, `config`, `content`, `crosslink`.

---

## Leitura Mínima de Retomada (Tier 0 — todo chat, todo agente)

Pétrea: projeto longo, multi-chat, multi-agente. T0 não é "um toque de contexto" — é o piso que garante que o agente não redecide, não finge conclusão e não age sem saber o que é inegociável. T0 é curto de propósito; o resto (diagnóstico local, LSP/MCP, infra, specs) é T1: consultado sob demanda, quando a tarefa tocar aquele assunto — não lido toda sessão.

T0 obrigatório, toda sessão, antes de agir:
1. Este arquivo (`AGENTS.md`) inteiro, uma vez por sessão.

Resumo inegociável (detalhe completo em §Regras Pétreas → Evidência/Autorização/Escopo/PR, Commit e Push):
- Afirmação sobre causa, estado, impossibilidade ou completude vem com o comando que mediu; sem medição, dizer "não medi".
- "Investigou?" se responde com a lista de comandos, nunca com "sim".
- Opção oferecida ao mantenedor é opção medida.
- Autorização é por ação, nunca por sessão/PR — não acumula, não se infere de frase genérica.
- Escopo (o que entra em qual PR/branch/commit) é call do mantenedor, não inferência do agente.
- `git commit`/`git push`/merge/deploy/write em VM: só com autorização nomeada explícita, a cada vez.
- Ação destrutiva ou difícil de reverter (DNS/tunnel prod, recriar infra): aprovação nominal no formato "APROVAÇÃO NECESSÁRIA".
- A VM Oracle nunca é desligada, reiniciada ou suspensa — nem pelo painel/API da Oracle, que nenhum hook alcança. "Desligar o pc/a máquina" é sempre a máquina Windows local.
- Bug ou débito achado se corrige no mesmo trabalho; débito só se registra quando o mantenedor mandar.
- Validação repo-wide é o último passo, só quando ele disser que não vem mais review; até lá, só o pacote afetado.
- `test`, `lint` e `build` repo-wide: um de cada vez, nunca encadeados nem em paralelo — a máquina do mantenedor trava.
- Pesquisar em `spec.md`/`plan.md`/`tasks.md` antes de perguntar, abrindo a seção inteira e não a linha do grep.
- `rtk` no lugar do comando cru, sempre.

Escalada T1 (consultar quando a tarefa exigir, não por padrão):
- Ler e alterar somente os arquivos que o mantenedor nomear. `project-state.md`, `decisions.md`, `backlog.md`, sessões e outras specs exigem pedido próprio — não entram por associação nem por "contexto útil".
- `sessoes/` só quando ele pedir ("retoma a sessão") ou quando não houver spec cobrindo o trabalho; ao tocar, registrar antes o que vai fazer e o que falta.
- Infra/deploy/CI/CD/VM/DNS/banco → `docs/agents/deploy-flow.md`, depois `deploy-runbook.md`.
- Editar `Dockerfile`, `pnpm-lock.yaml`/`package.json`, `migration_*.sql` ou `.github/workflows/*` exige ler a seção correspondente de `deploy-flow.md` antes.
- Diagnóstico de código/API antes de editar → §Ferramentas MCP/Agentes.
- Erro/regressão conhecida → `.specify/memory/errors.md`.

Se a tarefa tocar um desses temas e o T1 pertinente não foi lido, não afirmar que está resolvida.

Anti-retrabalho: fluxo estranho/contraditório/perigoso (CI/CD, deploy, branch, DNS/tunnel, auth, banco, SEO, importador, pacote compartilhado) não se corrige no chute — pesquisar o T1 relevante primeiro, identificar se é decisão histórica, exceção temporária ou bug real, só então corrigir. Critério de parada da pesquisa e obrigação de citar o que foi medido: §Regras Pétreas → Evidência.


Falha de processo descoberta: reportar e perguntar onde registrar. Nunca escolher nem abrir sozinho outra fonte documental. Regra operacional durável só entra na fonte canônica autorizada nominalmente pelo mantenedor.

### Diagnóstico local (T1 — antes de editar código)

- `rg "termo" apps packages -n` / `rg -l "termo" apps packages` (só arquivos) / `rg --files apps packages`
- `ast-grep -p "PADRAO" --lang ts` — busca estrutural
- `pnpm run lint|test|build` — default é o pacote afetado; CI cobre o repo. Trava completa no T0.
- `pnpm verify:api` — obrigatório em mudanças de `apps/`, `packages/`, `scripts/api/`, `docs/api/openapi/`
- Descoberta de rota de API: fonte primária é `docs/api/generated/artificio-api.bundle.json` (+ `api-index.generated.md`), nunca memória de chat. Detalhe: `docs/api/README.md`.
- Não ler o repositório inteiro nem abrir arquivo grande sem justificar; procurar símbolo/rota/import antes de editar.

LSP: ver §Ferramentas MCP/Agentes → LSP.

---

## Gates do Programa (regra pétrea de sequência)

O Artifício RPG avança por gates. Nenhum gate é pulado. Cada gate exige aprovação explícita do mantenedor. O status operacional detalhado vive em `.specify/memory/project-state.md`; aqui ficam a sequência e as travas duráveis. Gates ativos neste ciclo: A, B e D. Gate C encerrado: site Astro em produção na raiz `artificiorpg.com`.

| Gate | Status operacional | Libera | Pré-condição / trava |
|---|---|---|---|
| A | aprovado; guardrail continua | Recriar/destruir instância Oracle | Backups completos, verificados e copiados off-VM (`C:\projetos\artificiobackup`) |
| B | aprovado; guardrail continua | Importar conteúdo / construir projetos | SSO (`accounts.`) funcionando + 1º projeto no ar em subdomínio |
| C | ✅ encerrado | Site Astro em produção na raiz `artificiorpg.com` | — |
| D | ativo por projeto | Próximo projeto | Projeto atual passou smoke |

Topologia (subdomínio-por-projeto):

- Cada projeto/app fica no próprio subdomínio (`glossario.`, `mesas.`, `downloads.`, `esferas.`, `srd.`, `links.`), root próprio, sem basename.
- Linguagem pública usa projetos; `app` é unidade técnica em `apps/*`; `módulo` só aparece em contexto técnico/histórico.
- Blog em `beta.artificiorpg.com` (staging) e em produção na raiz `artificiorpg.com` (site Astro).
- SSO central em `accounts.artificiorpg.com`.
- Une tudo: cookie `.artificiorpg.com` + nav + design. Cloudflare Tunnel mapeia hostname→container.

"Não lançado" ≠ "não deve subir" (pétrea). Projeto não divulgado é deployado em produção normalmente; "não lançado" diz só que o público sabe que ainda não está pronto. O agente não pode inverter isso por conta própria:

- Nunca propor remover rota de tunnel, DNS ou container "porque não foi lançado". `502`/`503` em subdomínio não anunciado é deploy pendente, não rota indevida — o remédio é deployar.
- Ausência de container/volume/banco de produção é deploy que não aconteceu, não decisão de produto.
- Prioridade menor não vira licença pra afrouxar. Migration, guard de deploy, backup, smoke e revisão valem igual em projeto não anunciado: o dado que entra ali é real desde o primeiro deploy, e o primeiro público chega sem aviso prévio ao agente.
- Se o mantenedor quiser adiar produção de um projeto específico, ele diz. Silêncio sobre lançamento não autoriza inferir adiamento.

DNS raiz de `artificiorpg.com` exige aprovação explícita do mantenedor pra qualquer mudança, como qualquer DNS/tunnel de produção. `artificiorpg.com` é `CNAME` pro Cloudflare Tunnel (`<tunnel-id>.cfargotunnel.com`), roteando pro container `site-prod-app:4322`. Antes de mexer, sempre checar registro DNS real do hostname raiz no painel — pode ser qualquer registro (R2, MX, etc.) conflitando com o nome.

---

## Regras Pétreas

### Evidência (pétrea — governa todas as outras desta seção)

O poder de decisão do mantenedor é limitado pela profundidade da investigação do agente. Não é retórica: quando o agente para de investigar cedo, ele não economiza esforço — ele estreita em silêncio o conjunto de opções que o mantenedor consegue escolher, enquanto o mantenedor segue achando que escolhe entre alternativas reais. Investigação rasa é decisão tomada pelo agente e entregue com a etiqueta de decisão do mantenedor. Todas as demais regras deste arquivo guardam ação (commit, deploy, DNS, SQL); esta guarda afirmação, que é por onde o dano passou repetidamente sem violar nenhuma outra.

1. Afirmação exige medição citada, na mesma mensagem. Toda afirmação sobre causa, estado, impossibilidade, completude ou impacto vem com o comando que a sustenta e o que ele devolveu. Não "verifiquei que não há trigger" — mas "`pg_trigger` para essas 6 tabelas devolveu 0". Não "a investigação está completa" — mas a lista do que foi medido. Sem medição, escrever "não medi" e seguir assim mesmo; frase honesta de ignorância custa uma linha, afirmação errada custa horas. Inferência plausível não é medição; "faz sentido" e "deve ser" não são evidência.

2. "Investiguei?" se responde com comandos, nunca com "sim". Quando o mantenedor pergunta se o agente investigou, pesquisou ou verificou, a resposta é a lista do que foi rodado e do que voltou. "Sim" é irrespondível — o mantenedor não tem como auditar, e é exatamente a forma que o engano assume quando o agente está convencido de si. Se a lista for curta demais para sustentar a conclusão, a resposta correta é "não o suficiente para afirmar isso".

3. Opção oferecida ao mantenedor é opção verificada. Nunca listar alternativa, caminho ou custo que não foi medido — ele gasta decisão real num caminho que não existe e descobre pelo erro. A que não foi medida sai da lista ou vai marcada "não medi o custo/viabilidade".

4. A investigação termina quando as opções do mantenedor estão medidas, não quando o agente se convence. "Achei uma explicação que encaixa" é o critério de parada errado.

5. Antes de afirmar a hipótese, rodar a consulta que a mataria. Buscar confirmação encontra confirmação; a consulta obrigatória é a que derruba a explicação atual.

6. Ler o schema/contrato/assinatura antes de consultar — nome de coluna, campo, flag ou parâmetro se lê da fonte (`information_schema`, `\d`, tipo, `--help`), nunca da memória.

7. O momento de maior risco é logo depois da cobrança do mantenedor. O impulso é mostrar serviço rápido, e o agente acelera onde devia desacelerar — produzindo o mesmo erro em cima da bronca que o nomeou. Cobrança sobre investigação obriga a investigar mais fundo; a próxima mensagem começa medindo, não agindo.

8. Concordar também é afirmação. "Você está certo" por reflexo vale tanto quanto "investiguei" por reflexo. Quando ele apontar um fato técnico, medir e mostrar a medição — inclusive quando confirma.

9. Explicar o próprio erro não é corrigi-lo, e nunca vem antes. A ordem é: medir, corrigir, relatar. Análise de causa própria e distinção de intenção ("não foi proposital") não entram.

Por que isto é pétreo: a investigação que faltou custava uma consulta; o que ela evitaria custou 5h de SSO fora do ar (E021) e um `500` em produção. Nem urgência, nem contexto compactado, nem "é óbvio", nem pedido de velocidade suspendem esta seção — sem tempo de medir, a saída é dizer o que não foi medido.

### Autorização

Aprovação vale por ação, nunca por sessão ou PR/branch. Não acumula — mesmo em branch já pushada, mesmo no mesmo PR, mesmo após autorização anterior na mesma conversa, mesmo pra "ajuste" relacionado. "Commite" autoriza só aquele commit. Editar arquivo local dentro do escopo não precisa de aprovação; commit/push/merge/deploy/write na VM sempre precisam, a cada vez.

Não inferir autorização de frase genérica ("pode seguir", "corrija", "ajuste", "resolve isso", "faz o resto", "termina") — essas autorizam no máximo editar arquivo local. Autorização nomeia a ação perigosa (`commite`, `faça push`, `suba para dev/main`, `merge`, deploy, comando VM). Instrução sobre a *forma* do commit não autoriza o commit em si.

Nunca executar sem aprovação explícita do mantenedor:

- Escrita ou mutação na VM Oracle, incluindo `build` no servidor e copiar/sobrescrever arquivo em produção.
- `git push origin dev|main`; `git push --delete`.
- Mudança em registro DNS/Tunnel de produção, inclusive a raiz `artificiorpg.com`.
- Recriar/redimensionar instância Oracle, mexer em volume ou tunnel.
- Usar o Chrome do mantenedor (perfil logado, cookies/sessão reais). Preferir HTTP read-only, browser interno sem sessão, logs ou artefatos locais.
- Acionar outro agente de IA em nome do mantenedor (Claude Code ↔ OpenCode/DeepSeek). Comunicação entre agentes prioriza read-only; informar qual MCP vai usar antes.
- Checkout de branch fora do cwd. `git worktree list` é livre.

Read-only é SEMPRE permitido (pétrea), local ou via `ssh faren`: `docker ps|logs|inspect`, `ls`, `cat`, `rg`, `find`, `curl -s` GET, `psql` com `SELECT`, `pg_dump`, `git status|diff|log|show`, e qualquer inspeção que não muta estado. Ler estado nunca é ação de mérito — não inferir aprovação por ser "na VM/prod", e a inspeção deve preceder correção de infra no chute. Única obrigação: filtrar segredos (`*PASSWORD*|*TOKEN*|*SECRET*`). Harness bloqueando comando read-only é falso-bloqueio: pedir liberação pontual, não pular a inspeção.

Lib/pacote novo: nunca sem perguntar primeiro — só instala depois da resposta. A aprovação de uma lib não autoriza serviço persistente, mudança de arquitetura, DNS/tunnel ou deploy.

Formato do pedido (`## APROVAÇÃO NECESSÁRIA` — Ação / Motivo / Risco / Rollback / Escopo / Comandos): skill `pedir-aprovacao`, que dispara ao pedir autorização ou quando um gate bloqueia. Opção oferecida no bloco é opção medida (§Evidência item 3).

Push e abertura de PR ficaram liberados por decisão do mantenedor; o commit é onde o conteúdo entra na história.

- Sessão com escopo num app/projeto (ex: `apps/srd`) não toca outro `apps/*` nem `packages/*` sem aprovação explícita e ampliação de escopo.
- Mudança de código em `packages/auth` exige aprovação + SDD Completo + smoke de todos os apps que consomem SSO. Auth é sagrado: nunca quebrar a sessão compartilhada. Mudança só documental em `packages/auth` exige sessão + evidência, mas não smoke runtime por padrão.
- Mudança de código em `packages/ui`/`packages/catalog-ui`/outros pacotes compartilhados (exceto `auth`/`accounts.`, que seguem trava própria acima) exige aprovação + verificação de impacto nos consumidores afetados, proporcional ao risco/blast radius real — não exige `spec.md`/`plan.md`/`tasks.md` por padrão; o mantenedor decide na hora se o caso pede SDD Completo.

Mecânica completa de commit/PR/push (fluxo branch→dev→main, doc-only, `verify:api`, bots de review, travas de sequência): §PR, Commit e Push.

Ver também §Regras Pétreas → Escopo.

### Escopo

- Não existe "fora de escopo": o monorepo é um projeto só. Erro ou regressão achado em qualquer app/pacote é responsabilidade de quem achou — corrigir no mesmo turno, nunca empurrar para "outro fazer". Separar em PR própria é organização rastreável, não abandono.
- Escopo (o quê) é call do mantenedor, não inferência do agente. Não decidir sozinho o que pertence a qual PR/branch/commit; não modificar arquivo fora do escopo sem ampliação explícita. Não estando claro, listar ANTES de executar. Isolamento de app é sobre não quebrar código alheio, não licença para ignorar problema alheio. Vale também pro conteúdo de um commit já autorizado.

- Toda decisão técnica se decide por: robusto, escalonável e que funcione para como o repositório está. Custo de implementação não é critério e não entra como argumento.

Isolamento de App/Projeto (pétrea do monorepo) — matriz mínima de smoke (quando o mantenedor pedir smoke; não é trava obrigatória por padrão fora de auth/accounts):
- `packages/auth` código: login/me/logout e todos os consumidores SSO — obrigatório.
- `packages/ui`/outros pacotes código: consumidores visuais afetados + app de referência, quando aplicável.
- `accounts.` código: login/me/logout, allowlist de retorno e pelo menos um app consumidor — obrigatório.
- Doc-only: sem smoke runtime por padrão; registrar busca/evidência documental.

### Bug achado / débito

Regra padrão: achou, conserta. Bug, regressão, falha de validação, contrato quebrado, smoke que falha, defeito de ferramenta/harness/CI, teste frágil — dentro ou fora do escopo da tarefa, com relação ou nenhuma com o que está sendo feito. O agente corrige no mesmo trabalho e relata depois, com a medição junto (§Evidência). Ignorar, guardar só no chat ou empurrar pra "outro fazer" continua proibido; o que mudou é o destino do achado: conserto, não pergunta.

Débito só existe se o mantenedor mandar registrar. O agente nunca propõe registrar débito como alternativa ao conserto, nem escreve em `specs/backlog.md`, `tasks.md`, `project-state.md`, sessão ou qualquer documento por conta própria. Perguntar "corrijo agora ou registro?" a cada achado lateral devolve ao mantenedor uma decisão que era do agente e transforma cada entrega numa fila de perguntas — foi o que motivou esta regra substituir a anterior. Quando ele mandar registrar, o registro leva evidência concreta (comando, run, arquivo, trecho, métrica ou URL) e vai somente no destino que ele nomear.

As duas únicas exceções — aí sim, para e pergunta:

1. A correção exige ação de aprovação nominal (§Autorização): commit, push, deploy, escrita na VM, SQL write, DNS/tunnel, lib/pacote novo. O agente chega com o conserto medido e pronto, e pede a aprovação da ação — não apresenta o próprio achado como bifurcação.
2. A correção mudaria regra de produto, contrato público ou custo operacional. Aqui a decisão é de fato do mantenedor, não do agente: alterar comportamento observável, quebrar contrato com consumidor, escolher entre políticas igualmente defensáveis. Nesse caso o agente mede as opções antes de apresentar (§Evidência item 3) e diz qual recomenda.

Fora dessas duas, corrigir é o caminho. Na dúvida sobre em qual lado o achado cai, o critério é: *a correção é a mesma sob qualquer resposta do mantenedor?* Se sim, é conserto — não pergunta.

Achado de spec/investigação segue a mesma regra, com um acréscimo. Lacuna, risco operacional ou incerteza técnica descoberta durante pesquisa: pesquisar e resolver, não perguntar. O que continua absolutamente proibido é escrever "decisão do mantenedor" — em `spec.md`, `Fora de escopo`, `tasks.md` ou onde for — sem que ele tenha de fato respondido. Inferência do agente nunca vira decisão registrada; se algo precisa mesmo da resposta dele, marcar como inferência a confirmar, nunca como decidido.
- Nunca mascarar erro nem adiar com risco de esquecer. Proibido silenciar lint/tipo/teste/build pra "fazer passar" (`eslint-disable`/`@ts-ignore`/`continue-on-error`/`.skip`/`xfail`/flag advisory sem justificativa inline rastreável, ou "depois eu vejo"). Erro descoberto = corrigir agora; se genuinamente não der (bloqueio de ambiente, autorização ou dependência externa), parar e nomear o bloqueio — nunca oferecer "registrar como débito" para escapar do conserto. Endurecer gate (remover `continue-on-error`, subir severidade, tornar check obrigatório) só DEPOIS do verde comprovado localmente — nunca antes, senão transfere a falha mascarada pro próximo PR.

### PR, Commit e Push

Fluxo: `<tipo>/<escopo>` → `dev`/Beta → `main`/Produção. Tipos: `feat/*`, `fix/*`, `chore/*`, `docs/*`, `infra/*` (escolhido pelo trabalho, não pelo agente). Ex.: `feat/srd-001-tooltips`, `fix/glossario-login-guard`, `docs/020-theme-review`.

Branch nova SEMPRE parte de `dev` atualizado, nunca de outra branch de trabalho. `git fetch origin && git switch -c <tipo>/<escopo> origin/dev`, nunca em cima do HEAD de uma branch já existente (mesmo "relacionada") — branch-sobre-branch herda commits da base e vira PR com múltiplos commits/conflito/diff errado pro bot de review.

Nada commita direto em `dev`/`main` — tudo, inclusive doc-only, entra por branch + PR (`git switch -c` → push → `gh pr create --base dev`). Branch protection exige check `lint + build + test` verde. Na dúvida se algo "impacta lógica", tratar como código.

PR nova sempre pronta e contra `dev`. Ao abrir PR nova: ready for review (não draft), base `dev`, salvo pedido explícito diferente — revisores automáticos (CodeRabbit/Codex/Amazon Q) são configurados pra `dev`; PR contra branch intermediária pode sair sem review. Se a PR já existe em base diferente, não retargetar sem pedido explícito.

Depois de abrir/atualizar a PR, o agente para. `git push` de branch autorizada + abertura da PR (`gh pr create`) são a MESMA ação, feitas em sequência sem nova autorização. O que trava é o que vem depois: não acompanhar PR, não esperar checks, não rodar `gh pr view`/`gh run watch`/`gh run view`, sem polling/sleep, nem consultar status após aberta/atualizada — salvo pedido explícito de acompanhar. Pedido foi "commit + push" → fez push (+ PR se aplicável) e encerra.

Correção de commit é commit novo em cima, com push fast-forward. Se o mantenedor disser "corrige o commit", perguntar se é isso ou reescrita por outro método.

Mensagem multi-linha: heredoc POSIX no Bash tool, here-string só na PowerShell tool — nunca misturar.

```bash
git commit -F - <<'EOF'
fix(escopo): titulo

Corpo.
EOF
```

Verificar sempre depois de commitar mensagem multi-linha: `git log -1 --format=%B` antes de declarar o commit pronto ou pushar. Erro de sintaxe de mensagem não falha o comando — o commit é criado corrompido, com exit 0.

Default de conteúdo do commit: todo o diff, salvo exclusão explícita do mantenedor. Arquivo modificado de outra frente, sessão anterior ou não tocado nesta tarefa entra por padrão — separar por conta própria é a inferência de escopo proibida em §Escopo. Na dúvida sobre um arquivo específico (parece segredo, lock de outro processo, artefato gerado), perguntar antes; não excluir preventivamente.

Ações e quem autoriza:
- Criar branch de trabalho: automático, exceto doc-only acumulado que fica local.
- `git push origin <branch-de-trabalho>`: automático pra código/feature autorizada; doc-only segue regra própria abaixo.
- Abrir PR pra `dev`: automático pra código/feature autorizada (ready for review, não draft); doc-only não abre PR sozinho.
- `git push origin dev`: bloqueado por branch protection — só via merge de PR (check verde). Vale pra código e doc-only; push direto falha.
- `git push origin main`: aprovação explícita.
- Merge de PR: só com autorização explícita.
- `git commit`/`git push`: nunca por interpretação ou inércia — precisa nomear a ação ("commite", "faça push", "suba pra dev/main"). Cada commit/push exige autorização própria, mesmo em branch já pushada/mesmo PR/mesma conversa. Ver §Autorização.
- Nunca `git checkout` entre `dev`/`main` durante deploy — usar `git fetch`/`git rev-parse`/`git log origin/main...origin/dev`/`gh run` sem checkout.

Commit tocando `apps/`, `packages/`, `scripts/api/` ou `docs/api/openapi/`: rodar `pnpm verify:api` antes do `git add`, senão os artefatos regenerados ficam fora do commit.

NUNCA responder, comentar, resolver thread, reagir ou disparar (`@q`, `@codex`, `@coderabbit`) revisores externos/bots no PR (amazon-q-developer, chatgpt-codex-connector, coderabbit, Snyk, Sonar, github-advanced-security). O agente não escreve nada na conversa do PR. Análise de revisão (procede/descarta/registrar) vive somente na documentação indicada pelo mantenedor. Fix que procede vira commit normal (branch/PR); resto vira débito no destino autorizado. Resposta a revisor no PR é sempre do mantenedor.

Doc-only:
- `git commit`/`git push`/PR/promoção exigem aprovação explícita por ação, mesmo com diff só de documentação.
- Mudança só de documentação não vai sozinha; commit/push/PR só com pedido explícito ("documentar/commitar/pushar docs agora").
- Sem ff/push direto de doc-only pra `dev` (proteção bloqueia) — entra por branch + PR, igual código (pode pegar carona no PR de código que motiva, ou PR doc-only próprio).
- Promoção `dev→main` (código ou docs) é fast-forward, sem merge commit/squash.
- Se o GitHub sugerir PR de `dev`, verificar `origin/main...origin/dev` e o conteúdo antes de agir.

### Erros que não podem se repetir — outros

Estas falhas já aconteceram e viraram regra operacional. Todo agente deve tratá-las como bloqueios de conclusão:

- Nunca fechar tarefa executável só com dry-run, plano ou documentação. Se o aceite diz "comando/script executável", rodar o comando real mínimo. Se falhar, reabrir task/backlog e corrigir ou registrar bloqueio.
- Nunca declarar "resolvido" quando falta dependência necessária para rodar. Pacote npm/devDependency local necessário para validação deve ser instalado quando permitido pelo escopo; se houver dúvida de aprovação, pedir antes e deixar a task aberta, não fechada.
- Nunca confundir "local", "parcial", "validado em dist local" ou "falta deploy" com concluído. Status correto vai somente para o documento autorizado; conclusão só após o critério de aceite completo.
- Nunca tocar governança/infra/qualidade transversal sem T1 pertinente e nominalmente autorizado. Se a tarefa envolve ou questiona `AGENTS.md`, specs, infra, CI/CD, deploy, VM, DNS/tunnel, banco, auth, SEO/Lighthouse ou pacote compartilhado, ler somente os documentos/seções pedidos pelo mantenedor. Se faltar fonte indispensável, parar e pedir ampliação de leitura; nunca ampliar sozinho.
- Aprendizado que muda operação exige decisão do mantenedor sobre destino documental. Não abrir nem atualizar automaticamente `project-state.md`, `decisions.md`, backlog, sessão, `context-capsule.md` ou outro T1.
- Nunca deixar tarefa "fechada" após uma validação real provar que ela não roda. Reabrir imediatamente, registrar o erro e só fechar depois do comando real passar.
- Nunca deixar servidor/processo auxiliar rodando ao final. Encerrar dev server, preview, servidor estático e helpers iniciados pelo agente, salvo pedido explícito do mantenedor para manter.
- Nunca esconder erro com justificativa de economia de contexto. O T0 é obrigatório; T1 é obrigatório quando o assunto exige. Economia de token serve a continuidade do projeto, não a atalhos.
- Nunca confiar em documentação sem verificar o código — numa auditoria/investigação, código é a verdade material. Documentação pode estar desatualizada, docs de spec podem registrar intenção não executada, e spec pode listar item como "pendente de decisão" quando o código já decidiu e implementou. Toda claim documental sobre estado de código, contrato ou decisão implementada deve ser verificada contra o código real (arquivos, imports, git log, consumidores). Se doc e código divergem, o código prevalece; o achado vira débito documental, não débito de implementação.
- Lixo produzido pelo agente é o agente que limpa — nunca vira "decisão do mantenedor". Dado sujo, arquivo temporário, estado inconsistente que ele criou: o agente chega com a limpeza medida e pronta e pede só a aprovação da ação perigosa, se houver. Não apresenta o próprio erro como bifurcação de produto nem o registra como pendência do mantenedor. Decisão de produto/risco/escopo é dele sempre; consequência de erro de execução do agente nunca é.
- Mismatch de tipo/teste que o agente introduziu é dele corrigir, sem exceção — "já existia antes" não justifica deixar passar, e corrigir é na raiz (fixture do schema real), não no sintoma. Vale igual com chat compactado no meio da tarefa.

---

## Deploy e Infra de CI/CD

Contrato completo: `docs/agents/deploy-flow.md` §6 — fluxo, workflows, manifesto, casos por módulo e os comandos de dispatch.

Duas travas que se afirmam aqui porque governam afirmação, não só execução:

- `deploy.yml` só deploya se `deploy_paths` do manifesto mudar. Docs, specs e governança nunca disparam deploy real.
- `promote-prod-fast-forward.yml` NUNCA dispara deploy de prod — só move o ponteiro Git. Depois de qualquer promote aprovado, nunca declarar "promovido" ou "em produção" sem disparar e confirmar o deploy: Git atualizado ≠ prod atualizado.

Mecânica de branch/PR/commit/push: §Regras Pétreas → PR, Commit e Push.

---

## VM, Banco e Infra

### Worktrees locais (multi-agente paralelo)

Worktree não é fallback automático — `add|move|remove` exige aprovação nominal (§Autorização), inclusive para escapar de operação Git inacabada. Sem aprovação: parar, reportar o estado que bloqueia o cwd e perguntar. Aprovado, informar o caminho exato antes de criar (`git worktree add ../artificio-<escopo> <branch>`), nunca checkout na mesma pasta onde outro agente roda. Remover só após confirmar trabalho preservado em commit ou stash identificado; nunca `--force` por inferência.

### Acesso à VM (Oracle)

- Acesso direto por alias SSH configurado em `~/.ssh/config` local (não versionado; host/IP/chave fora do git). Mapa de infra em `docs/agents/`.
- A chave privada (`*.key`) é segredo: gitignored, nunca commitar/expor/imprimir.

### Banco, Infra e Segredos

- Qualquer SQL write direto (fora do framework de migration) em produção exige aprovação explícita + simulação/dry-run/plano de rollback registrados. Operação destrutiva (`DROP`, `TRUNCATE`, `DELETE` massivo, `ALTER` destrutivo) só com permissão nominal + dump prévio + checklist.
- Cada app/projeto tem seu schema/banco lógico isolado; SSO/usuários é o único cross-cutting.
- Acesso DB da VM por linha de comando local/PowerShell via `ssh faren` é read-only por padrão (`psql SELECT`, `pg_dump`, `docker exec` read-only). Escrita no banco da VM = aprovação.
- Tunnel `cloudflared` paralelo e segredo versionado: procedimento em `deploy-flow.md` §Segredos; o TruffleHog (`secret-scan.yml`) barra o segundo.

### Migrations e Dockerfile de produção

As duas maiores famílias de incidente do projeto (8 e 5 dos 22 de `errors.md`, com três recorrências entre elas). O procedimento vive em `docs/agents/deploy-flow.md` §3 e §1 — leitura obrigatória antes de tocar em `migration_*.sql` ou em `Dockerfile`, conforme a trava por arquivo em §T1.

---

## Regras de Produto e SEO

- Compromissos inegociáveis: gratuidade, sem anúncios, sem coleta desnecessária de dados.
- Google OAuth é o único login. Sessão única em cookie `Domain=.artificiorpg.com`. E-mail/senha só com autorização explícita. Exceção controlada: fluxo legado de migração do glossário (D061) pode verificar vínculo antigo sem criar sessão por e-mail/senha.
- SEO é inegociável no site: slugs e redirects 301 preservados, sem merge que cause regressão de meta/sitemap/canonical. Manter compatível com exigências de Search Console e Lighthouse.
- Toda mudança de interface respeita as 10 Heurísticas de Nielsen e ISO 9241-11 antes do merge. O procedimento está nas skills, que disparam pela tarefa: `nielsen-heuristics-audit` (usabilidade), `wcag-accessibility-audit` (acessibilidade), `ui-fidelity-audit` (design system), `ui-design-review` (visual), `ux-audit-rethink` (repensar fluxo).
- Design sóbrio/minimalista com sobriedade de Google-suite (Docs/Gmail), sem copiar marca Google. Cores, logo e padrões vêm de `packages/ui`. Não divergir do design system por app/projeto sem aprovação.
- Analytics (GA4) cobre rotas públicas via `packages/analytics`. Toda página/rota pública nova é instrumentada. Admin/operacional só instrumenta eventos úteis, sem coletar dado desnecessário.
- Upload e processamento de imagem ocorrem sempre no Backend, via Cloudinary com signed preset. Credencial hardcoded é barrada pelo TruffleHog (`secret-scan.yml`).

---

## Regras Gerais de Código

### O mantenedor não é programador — pergunta técnica se responde medindo (pétrea)

O mantenedor não escreve código. Pergunta sobre *como o sistema é* — qual campo, qual formato, de onde vem o dado, o que já existe — se responde pelo código, pela doc ou pela VM, nunca por ele. Antes de escrever uma pergunta: ela cabe em `rtk rg`, `psql` read-only, leitura de schema, comparação entre apps? Se cabe, não é pergunta, é medição pendente — e "seria mais rápido confirmar" é falso, porque ele responderia sobre um sistema que só o agente mediu.

Isto não afrouxa §Autorização: decisão de produto, risco, escopo e toda ação perigosa continuam indo a ele. Sobrando escolha real entre caminhos válidos depois de medir, aí sim pergunta — com as opções medidas e a recomendação.

### Compartilhado por padrão; exceção por app é o defeito (pétrea)

O monorepo existe para que os apps compartilhem contrato, tipo, schema e comportamento. Toda divergência por app é dívida até prova em contrário, mesmo quando compila, mesmo quando o app isolado funciona.

- Buscar o que já existe antes de escrever. Pacote em `packages/*` que já resolve o problema é a resposta; escrever versão local do mesmo conceito é o erro. Quando dois apps precisam da mesma coisa, ela sobe para o pacote — não se copia.
- Contrato do pacote é a autoridade. App que manda formato diferente do que `packages/*` define está errado mesmo que não quebre: quebra no consumidor, camadas adiante, com erro opaco.
- Guard/validação compartilhada precisa estar LIGADA, não só existir. Gancho escrito e não chamado é pior que ausente: passa impressão de cobertura que não existe.
- Ao corrigir defeito num app, cruzar com os outros que fazem a mesma coisa. A pergunta não é "por que este quebrou", é "por que os outros não quebraram" — e a resposta costuma ser "aquele caminho nunca foi exercitado", não "está certo".
- Identidade, formato e vocabulário atravessam apps. Um id é o mesmo id em todo o monorepo. App que mantém representação paralela da mesma entidade cria tradução, e toda tradução é uma chance de divergir. Preferir sempre a chave que o dono do dado emite.
- Solução dinâmica, não caso particular. Corrigir com condicional por app (`if (app === 'mesas')`), lista fixa ou exceção pontual é sinal de que a correção está no lugar errado: ela pertence ao contrato compartilhado, onde vale para todos, inclusive para o próximo app que ainda não existe.

- "Solução mínima" é proibida como critério de correção. Bug ou achado de review se resolve na causa raiz, por completo (schema/tipo/contrato incluídos) — não na menor edição que faz o sintoma sumir. Escopo mínimo vale para abrangência (não mexer em código não relacionado), nunca para profundidade.
- Stack canônica única: Frontend React 19/TS/Vite/Tailwind; Backend Node/Express 5/TS/Kysely/Postgres 16; auth via JWT no backend.
- Python só para scripts fora do runtime principal.
- Normalização obrigatória: todo dado de API/banco/JSON/JSONB/query/localStorage/integração externa é `unknown` até passar por normalizador tipado antes de entrar em estado React, props ou render.
- Proibido `.map/.filter/.reduce/.forEach`, spread de array ou `.length` sobre payload externo sem `Array.isArray`/schema/fallback explícito.
- HTML de conteúdo de usuário/rich-text é hostil: sanitizar sempre (DOMPurify) antes de persistir/renderizar.
- Comentário que explica decisão não se apaga em edit/fix subsequente. Ao editar trecho comentado, preservar ou reescrever o comentário para explicar a decisão atual, citando a origem (achado de review, spec, comportamento observado) — para que outro agente entenda sem reconstruir o histórico do chat.

---

## Erros Conhecidos

Ao encontrar erro/regressão: (1) parar tentativas repetidas; (2) consultar `.specify/memory/errors.md` por código `E###` ou sintoma; (3) se houver solução documentada, aplicar e registrar evidência; (4) se não, diagnosticar e registrar aprendizado validado.

## Conclusão de Tarefas

Conclusão é afirmação, e exige medição citada. Concluída só quando: a busca final retorna o esperado; o comando/teste real executou, se a tarefa promete executabilidade; nenhum arquivo parcialmente modificado; validação registrada somente no documento autorizado. Não atualizar `project-state.md`, `backlog.md`, sessão ou `tasks.md` sem ser nomeado. Nunca declarar conclusão com "parcial", "restante", "maioria", "principais" ou percentual — status parcial se registra no destino autorizado, nunca como conclusão.

Se uma validação real expõe que a tarefa "fechada" ainda não roda, reabrir a task/backlog imediatamente, corrigir o artefato até ficar usável ou registrar bloqueio concreto. Dry-run, plano ou documentação não fecham tarefa cujo aceite exige execução real.

Proibido ampliar escopo documental por rotina de fechamento. Spec nova, retomada, fechamento, review, bug ou pendência não autorizam verificar ou atualizar backlog, estado, decisões, sessão ou outro arquivo. Reportar ao mantenedor; registrar apenas onde ele mandar.

Atualizar documentação é REESCREVER o bloco existente, nunca anexar bloco novo (pétrea). Doc de spec descreve estado atual, não histórico de sessões. Anexar "estado em <data>" abaixo do anterior vira log cronológico: cresce sem limite, e o agente seguinte lê camadas contraditórias sem saber qual vale.

Regras operacionais, sem exceção:

- Localizar o bloco da task ANTES de escrever. `rtk rg "T<N> —" <arquivo>` e abrir a região inteira. Escrever sem ler o que já existe é o que produz empilhamento.
- Uma task tem UM bloco de estado. Task retomada em sessão nova → o bloco é reescrito, não duplicado. Não existe "estado em 2026-08-05" convivendo com "estado em 2026-08-07" da mesma task.
- Trabalho já merged encolhe. Enquanto a task está aberta, o bloco carrega o detalhe que sustenta a retomada. Depois do merge, o *porquê* de cada decisão vive no comentário do próprio código (§Regras Gerais de Código — comentário explicativo não se perde), e a doc guarda só: o que foi entregue, o bloqueio que resta, e a decisão que precisa de conferência. Narrar de novo, na spec, o que o código já explica é duplicação que envelhece sozinha.
- Medir e reportar o delta. Ao terminar, `rtk git diff --stat <arquivo>`. Um diff só de inserções em doc de estado é sinal de empilhamento — releia antes de entregar. O relatório ao mantenedor diz o delta ("−43 linhas, mesma informação"), não só "documentei".
- O que nunca se apaga: decisão do mantenedor, bloqueio ainda aberto, achado lateral pendente de resposta, e erro do próprio agente já registrado (§Formato do relatório → não esconder erro próprio). Condensar é remover redundância e narrativa de processo — não remover fato que ainda decide alguma coisa.

### Formato do relatório final ao mantenedor (obrigatório)

Vale pra toda entrega de mérito (commit/push/PR, correção de achado de bot, investigação, decisão técnica); não pra resposta curta de pergunta direta.

1. Resultado em uma linha: SHA, número da PR, contagem de arquivos, ou o fato central. Sem preâmbulo.
2. Números reais de validação: `N/N` por app, lint, `tsc`, `verify:api`. Nunca "tudo verde" sem número. Comando que não rodou se declara.
3. O que foi corrigido, por achado — o problema resolvido e a consequência real, não o arquivo tocado.
4. O que foi descartado, com motivo curto. Silêncio sobre item descartado lê como esquecimento.
5. A decisão que mais precisa de conferência, em bloco próprio, com o trade-off e a alternativa se o mantenedor discordar. É onde o agente devolve uma decisão que ele não sabia estar tomando.
6. Achado lateral já corrigido e medido — não como pergunta (§Bug achado / débito).
7. Bloqueio e encerramento: o que ficou aberto e por quê, nomeado como bloqueio, nunca como conclusão parcial.

Travas: sem emoji decorativo nem barra de progresso; não elogiar a própria entrega; não esconder erro próprio (se o agente introduziu o defeito, diz na primeira linha do item); seção vazia se omite.

---

## Review guidelines

Não é instrução para o agente — é o único lugar onde o bot Codex code-review (`chatgpt-codex-connector`) lê o escopo de revisão. Não existe `.codexignore`; por isso fica aqui e não vira skill (bot não carrega skill). O CodeRabbit já expressa o mesmo em `.coderabbit.yaml` (`path_filters`), que é executável; este bloco é best-effort textual.

Escopo pedido aos revisores: focar em `apps/`, `packages/`, `scripts/` e config de infra/CI (lógica, contrato, segurança). Não focar achado em `.md` nem em `docs/api/generated/` e `docs/api/openapi/`, que são gerados por `pnpm verify:api`.

---

## Documentação Canônica

| Tipo | Fonte |
|---|---|
| Governança operacional | `AGENTS.md` |
| Contrato de deploy (Dockerfile, migration, lockfile, workflow, infra) | `docs/agents/deploy-flow.md` ⃰ — leitura obrigatória por arquivo tocado, ver §T1 |
| Detalhe operacional de deploy (comandos, por módulo) | `docs/agents/deploy-runbook.md` ⃰ |
| Estado atual (fase/gate) | `.specify/memory/project-state.md` |
| Erros conhecidos (histórico; a regra está no contrato acima) | `.specify/memory/errors.md` |
| Contexto de retomada | `docs/agents/context-capsule.md` ⃰ |
| Sessões | `sessoes/index.md` + `sessoes/*.md` |
| Specs SDD | `specs/README.md` + `specs/backlog.md` + `specs/*/{spec.md,plan.md,tasks.md}` |
| Subagentes | `.claude/agents/` |
| Skills/playbooks locais | `.agents/skills/` |

⃰ `docs/agents/*` = docs internas de operação, versionadas desde 2026-09-03 (`.gitignore:54`) — o procedimento de deploy precisa ser revisável em PR. Só `docs/agents-internal/` continua fora do repositório.

## Ferramentas MCP / Agentes

Mecânica completa na skill `ferramentas-mcp` — tabela de comandos do `rtk`,
pegadinhas medidas, e o detalhe de cada MCP (LSP, `codebase-memory-mcp`,
`artificio-api-governance`, cloudflare, opencode/DeepSeek). Ela dispara quando a
tarefa é rodar comando, diagnosticar MCP ou delegar trabalho.

O que fica aqui é o que governa autorização:

Trava de autorização (pétrea): acionar outro agente de IA em nome do
mantenedor — Claude Code ↔ OpenCode/DeepSeek — exige aprovação nominal por ação,
priorizando read-only (análise, inspeção, revisão, diagnóstico). Ter o MCP
disponível não é autorização para usá-lo. Vale igual para escrita via MCP da
Cloudflare, que alcança o DNS e o tunnel de produção: leitura é livre, qualquer
escrita segue §Autorização.

Cumprimento mecânico: o `rtk-enforce.js` tem 8 regras que bloqueiam o comando
cru e devolvem a forma correta no motivo do deny. Não existe "esqueci o `rtk`" —
ou o comando é reescrito sem o agente notar, ou é bloqueado com a correção junto.


### Ordem de uso

1. `artificio-api-governance` para qualquer pergunta/mudança de API.
2. LSP para diagnóstico automático de arquivos tocados e impacto semântico.
3. `codebase-memory-mcp` para mapa estrutural, dependências, chamadas e arquitetura.
4. `ast-grep`, `rtk rg`, `rtk read`, `git`, leitura direta e validação CLI.

Para delegar ao opencode/DeepSeek (só com aprovação nominal): `mcp__opencode__*` (oficial); `mcp__opencode-deepseek__deepseek` só se o oficial não responder. Detalhe e medição: §opencode/DeepSeek.

Mapeamento operação → ferramenta:

- Onde X está definido → LSP `workspaceSymbol`/`goToDefinition`.
- Quem usa/chama X → LSP `findReferences` ou `codebase-memory-mcp`.
- Interface → implementação concreta → LSP `goToImplementation`.
- Tipo/assinatura sem abrir arquivo inteiro → LSP `hover`.
- Depois de escrever/editar código → checar diagnostics do LSP e corrigir antes de prosseguir (trava completa: §LSP).
- Grep/`rtk rg` para texto/padrão literal (comentário, string, config, YAML/JSON/Dockerfile/shell) ou quando LSP não cobre a linguagem/arquivo.

Config local pode diferir entre clientes:
- OpenCode: `opencode.json`.
- Claude Code: MCP local em `.claude.json`/config Claude do usuário; MCP vindo de plugin fica sob `plugin:<nome>:<servidor>` e aparece em `claude mcp list`. Plugin recém-instalado só expõe as ferramentas após `/reload-plugins` ou reinício da sessão.
- Claude Desktop: `%APPDATA%\Claude\claude_desktop_config.json`, bloco `mcpServers`. Exige reinício do app.
- Codex (CLI e Desktop): `C:\Users\paulo\.codex\config.toml`, blocos `[mcp_servers.<nome>]` — config compartilhada entre os dois; registrar uma vez vale para ambos. `codex mcp list` mostra o status de OAuth por servidor.

Não acionar outro agente em nome do mantenedor sem aprovação nominal; usar MCPs locais de leitura/navegação não muda esta regra.

Fluxo de orquestrador/fases específico do OpenCode (agente único `artificio-orquestrador`, fases fix→registro→investigação→implementação→doc→commit) não se aplica ao Claude Code — ver `docs/agents/opencode-supervisor-flow.md`.
