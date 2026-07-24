# AGENTS.md — Governança de Agentes de IA · Artifício RPG

**Projeto:** Artifício RPG — plataforma modular (monorepo)
**Fonte canônica de governança operacional.** Em conflito com qualquer documento operacional, este arquivo prevalece.

**Regra zero, pétrea e omnipresente:** todo chat novo, todo agente, antes de qualquer análise, plano, comando, edição ou resposta de mérito, deve ler o T0 completo (`agents.md` + a spec atual. se não saber, perguntar.). Sem T0 lido, o agente não está autorizado a dizer que entendeu o estado do projeto nem a agir. Isto não é contexto opcional; é o mecanismo de continuidade do projeto longo multi-chat.

Toda comunicação com o mantenedor é em português e, por obrigatoriamente em, em **caveman ultra**. Nomes de arquivos, comandos, funções e identificadores permanecem no formato original.

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
2. `sessoes/` — checar sessão ativa incompleta; se houver, continuar nela salvo pedido explícito de sessão dedicada. Registrar na sessão antes de alterar: o que vai fazer, o que falta, o que já foi feito.

**Resumo inegociável (detalhe completo em §Regras Pétreas → Autorização/Escopo/PR, Commit e Push):**
- Autorização é **por ação**, nunca por sessão/PR — não acumula, não se infere de frase genérica.
- Escopo (o que entra em qual PR/branch/commit) é call do mantenedor, não inferência do agente.
- `git commit`/`git push`/merge/deploy/write em VM: só com autorização nomeada explícita, a cada vez.
- Ação destrutiva ou difícil de reverter (DNS/tunnel prod, SQL write, recriar infra, `--amend`, `--force`): sempre aprovação nominal + formato "APROVAÇÃO NECESSÁRIA".
- Bug/débito achado: parar e perguntar (corrigir agora ou registrar) — nunca decidir sozinho.

**Escalada T1 (consultar quando a tarefa exigir, não por padrão):**
- Retomar spec/trabalho em andamento → `.specify/memory/project-state.md` + `.specify/memory/decisions.md` (evita redecidir).
- Infra/deploy/CI/CD/VM/DNS/banco → `docs/agents/deploy-runbook.md`, §VM/Banco/Infra e §Deploy e Infra de CI/CD deste arquivo.
- Specs/backlog → `specs/README.md` + spec/tasks/backlog.
- Diagnóstico de código/API antes de editar → §Ferramentas MCP/Agentes (LSP, codebase-memory-mcp, artificio-api-governance) + comandos abaixo.
- Erro/regressão conhecida → `.specify/memory/errors.md`.

Se a tarefa tocar um desses temas e o T1 pertinente não foi lido, não afirmar que está resolvida.

**Anti-retrabalho:** fluxo estranho/contraditório/perigoso (CI/CD, deploy, branch, DNS/tunnel, auth, banco, SEO, importador, pacote compartilhado) não se corrige no chute — pesquisar T1 relevante primeiro, identificar se é decisão histórica, exceção temporária ou bug real, só então corrigir.

**Falha de processo descoberta:** regra operacional durável entra na fonte canônica (`AGENTS.md`/`context-capsule.md`/docs T1); `project-state.md` registra estado, não substitui governança; débito acionável entra em `specs/backlog.md`/`tasks.md`.

### Diagnóstico local (T1 — antes de editar código)

- `rg "termo" apps packages -n` / `rg -l "termo" apps packages` (só arquivos) / `rg --files apps packages`
- `ast-grep -p "PADRAO" --lang ts` — busca estrutural
- `pnpm run lint` / `pnpm run test` / `pnpm run build` — pesados localmente, preferir validação pontual do pacote afetado; CI cobre o repo completo
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

**DNS raiz de `artificiorpg.com` exige aprovação explícita do mantenedor pra qualquer mudança, como qualquer DNS/tunnel de produção.** `artificiorpg.com` é `CNAME` pro Cloudflare Tunnel (`<tunnel-id>.cfargotunnel.com`), roteando pro container `site-prod-app:4322`. Antes de mexer, sempre checar registro DNS real do hostname raiz no painel — pode ser qualquer registro (R2, MX, etc.) conflitando com o nome.

---

## Regras Pétreas

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
- **Escopo (o quê) é call do mantenedor, não inferência do agente.** Não decidir sozinho o que "pertence" a qual PR/branch/commit quando há mais de uma frente de trabalho no ar; não modificar arquivo fora do escopo pedido sem aprovação/ampliação explícita registrada na sessão (pequena edição pedida no meio da sessão conta como ampliação e deve ser registrada). Se não estiver 100% claro o que vai em cada ação, listar pro mantenedor ANTES de executar, não depois. Isolamento de app (abaixo) é sobre **não quebrar código alheio**, não licença pra **ignorar problema alheio**. Ver [[feedback_no_scope_inference]].

**Isolamento de App/Projeto (pétrea do monorepo) — matriz mínima de smoke** (quando o mantenedor pedir smoke; não é trava obrigatória por padrão fora de auth/accounts):
- `packages/auth` código: login/me/logout e todos os consumidores SSO — obrigatório.
- `packages/ui`/outros pacotes código: consumidores visuais afetados + app de referência, quando aplicável.
- `accounts.` código: login/me/logout, allowlist de retorno e pelo menos um app consumidor — obrigatório.
- Doc-only: sem smoke runtime por padrão; registrar busca/evidência documental.

### Bug achado / débito

- **Todo bug achado é reporte obrigatório — dentro ou fora do escopo da tarefa/chat atual, sem exceção.** Bug, regressão, falha de validação, comportamento estranho recorrente, contrato quebrado, smoke que falha, ou defeito de ferramenta/harness/CI: mesmo que não tenha relação nenhuma com o que está sendo feito no momento, o agente **nunca** ignora, guarda só na cabeça/chat, nem decide sozinho. Sempre reporta ao mantenedor e **pergunta**: corrigir agora (nesta tarefa/PR) ou registrar como débito no backlog. "Não deu tempo", "era lateral", "fora de escopo" ou "parece pequeno" não dispensam o reporte nem a pergunta.
- **Regra vale igual pra achado de spec/investigação, não só bug de código já escrito.** Lacuna jurídica, risco operacional, incerteza técnica, limitação de escopo descoberta durante pesquisa/investigação de uma spec nova: mesma trava — o agente **nunca** decide sozinho que "isso fica fora de escopo" ou "isso vira débito" e já escreve `spec.md`/`Fora de escopo`/`debitos.md` como se fosse decisão fechada. Escrever "decisão do mantenedor" numa spec sem o mantenedor ter de fato respondido é o mesmo erro que mascarar bug — sempre pergunta primeiro (AskUserQuestion ou texto direto), só documenta como decidido depois da resposta.
- Só depois da resposta do mantenedor:
  - corrigir agora: corrige dentro do escopo autorizado.
  - registrar débito: evidência concreta (comando, run, arquivo, trecho, métrica ou URL) em sessão + `specs/backlog.md` (salvo item ativo já cobrindo o mesmo problema) + `tasks.md` da spec quando muda status/critério/próxima ação + `project-state.md` quando afeta retomada/gate.
- **Nunca mascarar erro nem adiar com risco de esquecer.** Proibido silenciar lint/tipo/teste/build pra "fazer passar" (`eslint-disable`/`@ts-ignore`/`continue-on-error`/`.skip`/`xfail`/flag advisory sem justificativa inline rastreável, ou "depois eu vejo"). Erro descoberto = corrigir agora; se não der, parar e perguntar, sempre oferecendo a opção de registrar débito. **Endurecer gate** (remover `continue-on-error`, subir severidade, tornar check obrigatório) só **DEPOIS** do verde comprovado localmente — nunca antes, senão transfere a falha mascarada pro próximo PR.

### PR, Commit e Push

Fluxo: `<tipo>/<escopo>` → `dev`/Beta → `main`/Produção. Tipos: `feat/*`, `fix/*`, `chore/*`, `docs/*`, `infra/*` (escolhido pelo trabalho, não pelo agente). Ex.: `feat/srd-001-tooltips`, `fix/glossario-login-guard`, `docs/020-theme-review`.

**Branch nova SEMPRE parte de `dev` atualizado, nunca de outra branch de trabalho.** `git fetch origin && git switch -c <tipo>/<escopo> origin/dev`, nunca em cima do HEAD de uma branch já existente (mesmo "relacionada") — branch-sobre-branch herda commits da base e vira PR com múltiplos commits/conflito/diff errado pro bot de review.

**Mudança que afeta lógica/comportamento NUNCA commita direto em `dev`/`main`.** Código de app/pacote, e infra/workflow/config/script que muda comportamento de deploy/CI/runtime: só via branch de trabalho + PR (`git switch -c` → push → `gh pr create --base dev`). Commitar reto em `dev` é proibido — destrói a trilha de revisão (revisores externos leem PRs). Branch protection em `dev`: TUDO que entra — inclusive doc-only — vai por branch + PR, sem ff/push direto (exige check `lint + build + test` verde). Na dúvida se algo "impacta lógica", tratar como código.

**PR nova sempre pronta e contra `dev`.** Ao abrir PR nova: **ready for review** (não draft), **base `dev`**, salvo pedido explícito diferente — revisores automáticos (CodeRabbit/Codex/Amazon Q) são configurados pra `dev`; PR contra branch intermediária pode sair sem review. Se a PR já existe em base diferente, não retargetar sem pedido explícito.

**Depois de abrir/atualizar a PR, o agente para.** `git push` de branch autorizada + abertura da PR (`gh pr create`) são a MESMA ação, feitas em sequência sem nova autorização. O que trava é o que vem depois: não acompanhar PR, não esperar checks, não rodar `gh pr view`/`gh run watch`/`gh run view`, sem polling/sleep, nem consultar status após aberta/atualizada — salvo pedido explícito de acompanhar. Pedido foi "commit + push" → fez push (+ PR se aplicável) e encerra.

**`git commit --amend` PROIBIDO, sem exceção.** Sempre commit novo. Amend reescreve commit sem nova autorização clara e força `push --force-with-lease` (reescreve histórico de branch já em review — bots e mantenedor perdem o rastro do que já foi visto). Branch/PR com commit anterior + novo push autorizado → `git commit -m "..."` (adicional) + `git push` normal (fast-forward, sem `--force`). Mesmo se o mantenedor disser "corrige o commit", perguntar se é commit novo (padrão) ou reescrita explícita por outro método.

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

**NUNCA responder, comentar, resolver thread, reagir ou disparar (`@q`, `@codex`, `@coderabbit`) revisores externos/bots no PR** (amazon-q-developer, chatgpt-codex-connector, coderabbit, Snyk, Sonar, github-advanced-security). O agente não escreve nada na conversa do PR. Análise de revisão (procede/descarta/backlog) vive na documentação (sessão + `tasks.md` + `backlog.md` + `project-state.md`). Fix que procede vira commit normal (branch/PR); resto vira débito documentado. Resposta a revisor no PR é sempre do mantenedor.

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
- **Nunca confundir "local", "parcial", "validado em dist local" ou "falta deploy" com concluído.** Status correto vai para sessão/backlog/tasks; conclusão só após o critério de aceite completo.
- **Nunca tocar governança/infra/qualidade transversal sem T1 pertinente.** Se a tarefa envolve ou questiona `AGENTS.md`, specs, backlog, infra, CI/CD, deploy, VM, DNS/tunnel, banco, auth, SEO/Lighthouse ou pacote compartilhado, ler docs/seções T1 relevantes antes de agir/encerrar.
- **Nunca atualizar só `project-state.md` quando o aprendizado muda o modo de operação dos agentes.** Regra durável entra na fonte canônica correta (`AGENTS.md`, `context-capsule.md`, `decisions.md`, docs T1, specs/backlog). `project-state.md` registra estado, não substitui governança.
- **Nunca deixar tarefa "fechada" após uma validação real provar que ela não roda.** Reabrir imediatamente, registrar o erro e só fechar depois do comando real passar.
- **Nunca deixar servidor/processo auxiliar rodando ao final.** Encerrar dev server, preview, servidor estático e helpers iniciados pelo agente, salvo pedido explícito do mantenedor para manter.
- **Nunca esconder erro com justificativa de economia de contexto.** O T0 é obrigatório; T1 é obrigatório quando o assunto exige. Economia de token serve a continuidade do projeto, não a atalhos.
- **Nunca confiar em documentação sem verificar o código — numa auditoria/investigação, código é a verdade material.** Documentação pode estar desatualizada, docs de spec podem registrar intenção não executada, e spec pode listar item como "pendente de decisão" quando o código já decidiu e implementou. Toda claim documental sobre estado de código, contrato ou decisão implementada deve ser verificada contra o código real (arquivos, imports, git log, consumidores). Se doc e código divergem, o código prevalece; o achado vira débito documental, não débito de implementação.

---

## Deploy e Infra de CI/CD

Mecânica de branch/PR/commit/push: §Regras Pétreas → PR, Commit e Push.

**Deploy/código canônico:** entrega normal passa por GitHub (branch/PR/checks/workflow_dispatch/Actions/secrets) e a VM faz `git fetch/reset` no clone. Acesso SSH direto à VM é exceção para bootstrap do clone, instalar utilitários operacionais, conexão, diagnóstico ou rollback aprovado — não é caminho normal de deploy/codificação. Se GitHub cobre a ação, use GitHub para rastreabilidade e branch safety.

**⚠️ Alerta: `deploy.yml` só deploya se `deploy_paths` do manifesto mudar.** Docs/specs/reviews/governança nunca disparam deploy real. CI roda, deploy=false. Para verificar: `gh run view <RUN_ID> --log | grep "deploy="`. Para forçar manual: `gh workflow run deploy.yml --ref dev -f module=mesas -f mode=deploy -f env=beta`.

**⚠️ TRAVA PÉTREA — `promote-prod-fast-forward.yml` NUNCA dispara deploy de prod.** Promote só move o ponteiro Git (`main` fast-forward pra `dev`); não chama `deploy.yml`, não builda, não sobe container. **Prod só atualiza com `workflow_dispatch` manual explícito**: `gh workflow run deploy.yml --ref main -f module=<modulo> -f mode=deploy -f env=prod`. Regra dura: depois de qualquer `promote` aprovado, **nunca declarar "promovido" ou "em produção" sem também disparar e confirmar esse deploy** — Git atualizado ≠ prod atualizado. Verificar sempre com `gh run list --workflow=deploy.yml --branch=main --limit=5` antes de afirmar que prod está no ar com a mudança.

---

## VM, Banco e Infra

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

Concluída só quando: busca final relevante retorna o esperado; comando/teste real executou quando a tarefa promete executabilidade; checklist da sessão fechada; nenhum arquivo parcialmente modificado; `project-state.md` atualizado; `specs/backlog.md` atualizado quando a tarefa cria débito, fecha débito, muda status de spec/tarefa ou descobre pendência acionável; validação técnica/manual registrada. Não declarar conclusão usando "parcial", "restante", "maioria", "principais", "alguns" ou percentual incompleto. Status parcial pode ser registrado em backlog/revisão, nunca como conclusão final.

Se uma validação real expõe que a tarefa "fechada" ainda não roda, reabrir a task/backlog imediatamente, corrigir o artefato até ficar usável ou registrar bloqueio concreto. Dry-run, plano ou documentação não fecham tarefa cujo aceite exige execução real.

**Obrigatório:** toda spec nova, retomada de spec, fechamento de tarefa, review que gere débito, ou descoberta de pendência deve verificar `specs/backlog.md` e registrar uma das duas coisas na sessão: (1) backlog atualizado; ou (2) nada a atualizar, com motivo curto. Isso evita pendência presa só no chat, em `tasks.md` isolado ou na memória do agente.

*(nota: bloco "Bug achado = perguntar antes de registrar" que existia aqui foi movido pra §Regras Pétreas / Bug achado / débito — reposicionamento, sem perda.)*

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

### LSP / diagnósticos semânticos

- **Origem/registro:** Spec 044 consolidou LSP como parte do ecossistema de agentes; o mantenedor reforçou em 2026-07-08 que ele detecta erros automáticos que antes passavam despercebidos.
- **Função:** diagnóstico semântico contínuo: tipos quebrados, imports inválidos, símbolos inexistentes, assinaturas incompatíveis e erros que busca textual não revela.
- **Usar para:** checar arquivos tocados antes/depois de edição; confirmar impacto local de refactor; achar erro rápido enquanto ainda é barato corrigir.
- **Clientes:** OpenCode expõe LSP diretamente; Claude Code pode usar plugin LSP; Codex depende das ferramentas disponíveis no turno/config local.
- **Trava:** LSP é importante, mas auxiliar. Diagnóstico limpo não substitui `pnpm run lint`, `pnpm run build`, testes pontuais e `pnpm verify:api` quando exigidos.

### codebase-memory-mcp

- **Origem/registro:** Spec 044 / DEB-044-02. Implementado localmente em 2026-06-22 com `codebase-memory-mcp` v0.8.1; smoke registrou grafo com ~10.6k nós / 18.1k arestas e `search_graph` OK. OpenCode e Claude Code configurados; Codex usa config MCP local do usuário.
- **Função:** grafo persistente do código para descoberta estrutural, chamadas, arquitetura e impacto. Complementa LSP e busca textual.
- **Ferramentas esperadas:** `search_graph`, `trace_path`, `get_code_snippet`, `query_graph`, `get_architecture`.
- **Usar para:** achar funções/classes/rotas/variáveis por padrão; rastrear quem chama quem; ler snippet específico; consultar fan-out/fan-in; obter visão de arquitetura.
- **Não usar para:** literais, mensagens, configs, docs, YAML/JSON, shell, Dockerfile ou quando o grafo estiver desatualizado/insuficiente. Fallback = `rtk rg`, `ast-grep`, leitura direta.
- **Disciplina:** código real continua fonte material. Se grafo e arquivo divergirem, o arquivo vence; registrar débito se a ferramenta induzir erro recorrente.

### artificio-api-governance

- **Origem/registro:** Spec 055 / DEB-055-06. Implementado em 2026-06-28 via `pnpm api:mcp`, servidor MCP stdio mínimo sobre `scripts/api/api-mcp-server.ts`.
- **Função:** descoberta de rotas de API a partir do bundle gerado, proibindo uso de memória de chat como fonte primária.
- **Ferramentas esperadas:** `search_api` e `get_api_bundle_summary`.
- **Fonte lida:** somente `docs/api/generated/artificio-api.bundle.json`. Se desatualizado, rodar `pnpm verify:api` e revisar artefatos gerados.
- **Usar para:** descobrir método/path/app/scope/auth/consumidores de rota; confirmar impacto de mudança API; orientar atualização OpenAPI.
- **Não usar para:** provar comportamento runtime sozinho. Depois da descoberta, verificar código real e rodar `pnpm verify:api` quando tocar `apps/**`, `packages/**`, `scripts/api/**`, `docs/api/openapi/**` ou allowlist.

### Ordem de uso

1. `artificio-api-governance` para qualquer pergunta/mudança de API.
2. LSP para diagnóstico automático de arquivos tocados e impacto semântico.
3. `codebase-memory-mcp` para mapa estrutural, dependências, chamadas e arquitetura.
4. `ast-grep`, `rtk rg`, `rtk read`, `git`, leitura direta e validação CLI.

**Mapeamento operação → ferramenta:**

- Onde X está definido → LSP `workspaceSymbol`/`goToDefinition`.
- Quem usa/chama X → LSP `findReferences` ou `codebase-memory-mcp`.
- Interface → implementação concreta → LSP `goToImplementation`.
- Tipo/assinatura sem abrir arquivo inteiro → LSP `hover`.
- Depois de escrever/editar código → checar diagnostics do LSP e corrigir antes de prosseguir (trava completa: §LSP).
- Grep/`rtk rg` para texto/padrão literal (comentário, string, config, YAML/JSON/Dockerfile/shell) ou quando LSP não cobre a linguagem/arquivo.

Config local pode diferir entre clientes:
- **OpenCode:** `opencode.json`.
- **Claude Code:** MCP local em `.claude.json`/config Claude do usuário.
- **Codex:** `C:\Users\paulo\.codex\config.toml`.

Não acionar outro agente em nome do mantenedor sem aprovação nominal; usar MCPs locais de leitura/navegação não muda esta regra.

Fluxo de orquestrador/fases específico do OpenCode (agente único `artificio-orquestrador`, fases fix→registro→investigação→implementação→doc→commit) não se aplica ao Claude Code — ver `docs/agents/opencode-supervisor-flow.md`.
