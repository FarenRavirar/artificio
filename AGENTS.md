# AGENTS.md — Governança de Agentes de IA · Artifício RPG

**Projeto:** Artifício RPG — plataforma modular (monorepo)
**Fonte canônica de governança operacional.** Em conflito com qualquer documento operacional, este arquivo prevalece. Em conflito sobre arquitetura ou contratos técnicos, prevalece `.specify/arquiteture.md`.

**Regra zero, pétrea e omnipresente:** todo chat novo, todo agente, antes de qualquer análise, plano, comando, edição ou resposta de mérito, deve ler o T0 completo (`project-state.md` + `context-capsule.md` + `decisions.md`). Sem T0 lido, o agente não está autorizado a dizer que entendeu o estado do projeto nem a agir. Isto não é contexto opcional; é o mecanismo de continuidade do projeto longo multi-chat.

Toda comunicação com o mantenedor é em português e, por padrão, em **caveman ultra**. Nomes de arquivos, comandos, funções e identificadores permanecem no formato original.

---

## O que é o Artifício RPG

Suite de projetos públicos em **subdomínios** sob `*.artificiorpg.com` (D017), login Google único (SSO via `accounts.artificiorpg.com`), leve (TypeScript/React/Express/Postgres), SEO forte. Monorepo `artificio` com `apps/*` (unidades técnicas: frontend/backend/deploy) e `packages/*` (compartilhados). O usuário vê **projetos**; o repositório organiza **apps**. Cada app é plugável, no próprio subdomínio/deploy isolado, mas compartilha auth, design e analytics.

`G1` é só analogia/codinome técnico interno ao modelo de hub interconectado do portal de notícias G1; **não é nome do produto**. Produto público = **Artifício RPG**. Modelo Google-suite (`docs.`/`mail.`).

Projetos/apps: `site` (portal+blog), `glossario`, `mesas`, `downloads`, `esferas` (Spheres of Power, multi-sistema), `srd` (DnD 5.2.1), `links`.
Pacotes compartilhados: `auth`, `ui`, `analytics`, `config`, `content`, `crosslink`.

---

## Leitura Mínima de Retomada (Tier 0 — todo chat, todo agente)

**Pétrea:** isto é um projeto longo, multi-chat e multi-agente; não é "um toque de contexto". Cada agente entra no meio de uma obra contínua, com histórico, gates, sessões, specs e decisões já tomadas. O objetivo do reload não é economizar por si só: é carregar a alma operacional suficiente para não redecidir, não fingir conclusão e não perder continuidade entre chats.

Projeto longo (~3 meses, muitos chats/agentes). Cada reload custa tokens, mas o T0 é obrigatório e deve ser lido como contrato vivo, não como dica. **Todo chat novo começa aqui. Antes do T0 não existe contexto confiável.**

1. `.specify/memory/project-state.md` — onde estamos (fase/gate).
2. `docs/agents/context-capsule.md` — regras críticas + stack.
3. `.specify/memory/decisions.md` — decisões fechadas (não re-decidir = não retrabalhar).

Companheiro (não-T0, consultar ao tocar backlog/priorização): `specs/backlog-audit-map.md` — view consolidada de débitos derivada de `specs/backlog.md` (canônico). É arquivo **trackeado/público** (sem recon de infra); não confundir com os docs locais de `docs/agents/` (gitignored por segurança).

**Não** ler `AGENTS.md` inteiro por hábito — é T1 (consulta de regra sob demanda), salvo quando a tarefa for revisar/editar governança ou o próprio `AGENTS.md`. `arquiteture.md` só por seção. Disciplina completa em `docs/agents/token-economy.md`. Caveman ultra default na saída.

**Escalada T1 obrigatória:** se a tarefa tocar ou questionar governança, infra, deploy, CI/CD, VM, DNS/tunnel, banco, auth, SEO/Lighthouse/qualidade transversal, pacotes compartilhados, specs/backlog/sessões ou conclusão de tarefa, o agente deve ler as seções/documentos T1 pertinentes antes de agir ou encerrar. Ex.: infra/deploy → `docs/agents/infra-map.md`, `docs/agents/deploy-runbook.md` quando existir, seções "Acesso à VM", "Banco, Infra e Segredos", "Git, Branch e Deploy"; specs/backlog → `specs/README.md` + spec/tasks/backlog; governança → `AGENTS.md` seções relevantes. Se não leu o T1 pertinente, não pode afirmar que a tarefa está resolvida.

Depois verificar `sessoes/` por sessão ativa incompleta. Se houver, continuar nela salvo pedido explícito de abrir sessão dedicada. Antes de qualquer alteração, registrar na sessão: o que vai fazer, o que falta, o que já foi feito.

**Anti-retrabalho:** se um fluxo parecer estranho, contraditório ou perigoso (CI/CD, deploy, branch, DNS/tunnel, auth, banco, SEO, Lighthouse/qualidade, importador, pacote compartilhado), **não corrigir no chute**. Primeiro pesquisar decisões, specs, sessões e docs operacionais relevantes (`decisions.md`, `project-state.md`, `errors.md`, `specs/`, `sessoes/`, `docs/agents/`). Identificar se o comportamento é decisão histórica, exceção temporária ou bug real; só então corrigir e registrar evidência.

**Quando descobrir falha de processo:** se a tarefa revela que a governança, T0/T1, spec, backlog ou definição de "feito" deixou margem para erro, corrigir a fonte canônica adequada no mesmo escopo (ou registrar débito explícito se não puder). Não basta atualizar só `project-state.md`; regras operacionais duráveis entram em `AGENTS.md`/`context-capsule.md`/docs T1, e tarefas entram em `specs/backlog.md`/`tasks.md`.

### Diagnostico local antes de pedir mais contexto

Antes de ler muitos arquivos, usar busca localizada.

Comandos uteis:
- `pnpm run lint` — ESLint repo-wide
- `pnpm run test` — vitest repo-wide (via turbo)
- `pnpm run build` — turbo build repo-wide (cobre tsc)
- `pnpm verify:api` — governança de API para mudanças em `apps/**`, `packages/**`, `scripts/api/**`, `docs/api/openapi/**` ou allowlist
- **Descoberta de API (agentes):** fonte primária = `docs/api/generated/artificio-api.bundle.json` (índice único machine-readable: app/método/path/scope/auth/consumidores) + `docs/api/generated/api-index.generated.md` (navegável). Gerados por `pnpm api:bundle`. Proibido usar memória de chat ou mapa manual como fonte primária de rota. Detalhe: `docs/api/README.md`.
- `rg "termo" apps packages -n` — busca textual com numero de linha
- `rg -l "termo" apps packages` — so lista arquivos (economiza contexto)
- `rg --files apps packages` — lista todos arquivos monitorados
- `ast-grep -p "PADRAO" --lang ts` — busca estrutural por AST

Regras:
- Nao ler o repositorio inteiro.
- Nao abrir arquivos grandes sem justificar.
- Procurar simbolos, rotas, imports e chamadas antes de editar.
- Preferir `rg -l` quando so precisa saber quais arquivos tem o termo.
- Jamais commitar sem autorizacao explicita.
- `pnpm run test` e `pnpm run build` sao pesados localmente — preferir validacao CLI pontual do pacote afetado; CI cobre o repo completo.

### Sobre o LSP

O LSP no OpenCode fornece diagnosticos ao agente, mas:
- Language servers podem ficar fora de sincronia com o codigo real.
- Podem consumir memoria significativa em monorepo grande.
- Diagnosticos de LSP nao substituem validacao CLI (`pnpm run lint`, `pnpm run build`, `pnpm run test`).

**Regra:** sempre rodar `pnpm run lint` e `pnpm run build` antes de declarar uma tarefa concluida. Diagnosticos de LSP sao auxiliares, nao fonte unica de verdade.

---

## Gates do Programa (regra pétrea de sequência)

O Artifício RPG avança por gates. **Nenhum gate é pulado.** Cada gate exige aprovação explícita do mantenedor. O status operacional detalhado vive em `.specify/memory/project-state.md`; aqui ficam a sequência e as travas duráveis. Gates ativos neste ciclo: A, B e D. Gate C = futuro, adiado (D016).

| Gate | Status operacional | Libera | Pré-condição / trava |
|---|---|---|---|
| **A** | aprovado; guardrail continua | Recriar/destruir instância Oracle | Backups completos, verificados e copiados off-VM (`C:\projetos\artificiobackup`) |
| **B** | aprovado; guardrail continua | Importar conteúdo / construir projetos | SSO (`accounts.`) funcionando + 1º projeto no ar em subdomínio |
| **C** | **adiado (fora de escopo)** | Apontar DNS de `artificiorpg.com` ao novo site e desligar WordPress | Site validado em beta (conteúdo + SEO + 301 + Nielsen/ISO) **e decisão explícita de cutover** |
| **D** | ativo por projeto | Próximo projeto | Projeto atual passou smoke |

**Topologia (subdomínio-por-projeto, D017/D028/D057/D063):**

- Cada projeto/app fica no próprio subdomínio (`glossario.`, `mesas.`, `downloads.`, `esferas.`, `srd.`, `links.`), root próprio, sem basename.
- Linguagem pública usa **projetos**; `app` é unidade técnica em `apps/*`; `módulo` só aparece em contexto técnico/histórico.
- `glossariorpg.` foi alias histórico pré-monorepo e não é hostname ativo a preservar.
- Blog novo em `beta.artificiorpg.com` (BETA; → raiz `artificiorpg.com` no futuro, Gate C).
- WP fica na raiz agora. SSO central em `accounts.artificiorpg.com` (D018).
- Une tudo: cookie `.artificiorpg.com` + nav + design. Cloudflare Tunnel mapeia hostname→container.

**Sempre (Gate C adiado):** o WordPress de produção e o DNS raiz de `artificiorpg.com` são **intocáveis** todo o projeto. WP roda em paralelo. Importador só **lê** do WP (REST API / export/dump read-only), nunca escreve. Nenhum cutover de raiz sem reabrir o Gate C com aprovação explícita.

---

## Modos de Trabalho

Escolha o menor processo que controle o risco. Detalhe e exemplos em `docs/agents/operating-model.md`.

- **Sem SDD:** pergunta, delta documental ou correção pontual sem risco.
  Artefatos mínimos: sessão + evidência; **sem commit/push automático**.
- **SDD Lite:** bug moderado, feature pequena ou ajuste localizado em **um** app/projeto.
  Artefatos mínimos: mini-spec + checklist + evidência.
- **SDD Completo:** obrigatório para mudança em `packages/*` (auth, ui, analytics, config, content, crosslink), infra (Cloudflare Tunnel/DNS), serviço `accounts.` (SSO), migration/banco, permissões, dados pessoais, upload/Cloudinary, importador WP, contrato público/API, deploy, CI/CD, SEO estrutural, ou feature/refator grande.
  Artefatos mínimos: `spec.md` + `plan.md` + `tasks.md` + validação + sessão.

Regra Artifício: **tudo que é compartilhado é SDD Completo.** Um app/projeto isolado pode ser SDD Lite; um pacote compartilhado nunca.

---

## Regras Pétreas

### Erros que não podem se repetir

Estas falhas já aconteceram e viraram regra operacional. Todo agente deve tratá-las como bloqueios de conclusão:

- **Nunca fechar tarefa executável só com dry-run, plano ou documentação.** Se o aceite diz "comando/script executável", rodar o comando real mínimo. Se falhar, reabrir task/backlog e corrigir ou registrar bloqueio.
- **Nunca declarar "resolvido" quando falta dependência necessária para rodar.** Pacote npm/devDependency local necessário para validação deve ser instalado quando permitido pelo escopo; se houver dúvida de aprovação, pedir antes e deixar a task aberta, não fechada.
- **Nunca confundir "local", "parcial", "validado em dist local" ou "falta deploy" com concluído.** Status correto vai para sessão/backlog/tasks; conclusão só após o critério de aceite completo.
- **Nunca tocar governança/infra/qualidade transversal sem T1 pertinente.** Se a tarefa envolve ou questiona `AGENTS.md`, specs, backlog, infra, CI/CD, deploy, VM, DNS/tunnel, banco, auth, SEO/Lighthouse ou pacote compartilhado, ler docs/seções T1 relevantes antes de agir/encerrar.
- **Nunca atualizar só `project-state.md` quando o aprendizado muda o modo de operação dos agentes.** Regra durável entra na fonte canônica correta (`AGENTS.md`, `context-capsule.md`, `decisions.md`, docs T1, specs/backlog). `project-state.md` registra estado, não substitui governança.
- **Nunca deixar tarefa "fechada" após uma validação real provar que ela não roda.** Reabrir imediatamente, registrar o erro e só fechar depois do comando real passar.
- **Nunca deixar servidor/processo auxiliar rodando ao final.** Encerrar dev server, preview, servidor estático e helpers iniciados pelo agente, salvo pedido explícito do mantenedor para manter.
- **Nunca esconder erro com justificativa de economia de contexto.** O T0 é obrigatório; T1 é obrigatório quando o assunto exige. Economia de token serve a continuidade do projeto, não a atalhos.
- **Nunca deixar bug descoberto só no chat, na cabeça do agente ou em nota solta.** Todo bug, regressão, falha de validação, comportamento estranho recorrente ou defeito de ferramenta descoberto durante a tarefa deve ser registrado no mesmo turno em sessão + `specs/backlog.md` (ou na `tasks.md` da spec se já houver item rastreável claro). Se não for corrigido agora, vira débito acionável com origem, evidência, escopo e próximo passo. Ex.: bug no harness, workflow falhando, backlog/index desatualizado, validação que contradiz status anterior.
- **Nunca mascarar erro nem adiar problema com risco de esquecer.** Proibido silenciar lint/tipo/teste/build para "fazer passar": `eslint-disable`/`@ts-ignore`/`continue-on-error`/`.skip`/`xfail`/flag advisory sem justificativa inline rastreável, ou "depois eu vejo". Erro descoberto = **corrigir agora**; se não der, **PARAR e perguntar** ao mantenedor, sempre oferecendo explicitamente a opção de **registrar como débito acionável** (origem, evidência, escopo, próximo passo) — a decisão de adiar é do mantenedor, não do agente. **Endurecer gate** (remover `continue-on-error`, subir severidade, tornar check obrigatório) só **DEPOIS** do verde comprovado localmente — nunca antes, pois transfere a falha mascarada para o próximo PR. Caso real: remover o `continue-on-error` do lint (spec 035) sem o lint estar verde mascarou ~79 erros pré-existentes em glossario/mesas e quebrou a PR #74; a correção virou a spec 037.
- **Não existe "fora de escopo": o monorepo é um projeto só.** Erro, débito ou regressão encontrado em qualquer app/pacote durante a tarefa é responsabilidade de quem achou — corrigir ou registrar no mesmo turno, nunca empurrar para "outro fazer" ou usar "outra spec/outro app" como desculpa para ignorar. Separar em PR/spec própria é **organização rastreável** (o item segue até o verde), não abandono. O foco é a qualidade do produto inteiro; "deixar para depois" só com decisão explícita do mantenedor e débito registrado. (Isolamento de app — §Isolamento de App/Projeto — é sobre **não quebrar o código alheio**, não licença para **ignorar problema alheio**.)
- **Nunca reaproveitar autorização de commit/push/PR para ação subsequente.** "Commite" autoriza só o commit daquele momento. "Pode abrir PR" autoriza só abrir o PR. Qualquer novo commit, push adicional, ou edição que você pretenda commitar no mesmo PR precisa de NOVA autorização explícita. A autorização não carrega para "ajustes", "correções" ou "melhorias" descobertas em seguida — mesmo que relacionadas ao mesmo PR.
- **Nunca confiar em documentação sem verificar o código — numa auditoria/investigação, código é a verdade material.** Documentação pode estar desatualizada, docs de spec podem registrar intenção não executada, e spec pode listar item como "pendente de decisão" quando o código já decidiu e implementou. Toda claim documental sobre estado de código, contrato ou decisão implementada deve ser verificada contra o código real (arquivos, imports, git log, consumidores). Se doc e código divergem, o código prevalece; o achado vira débito documental, não débito de implementação. Caso real: spec 019 listava centralização de metadata como "pendente de decisão do mantenedor", mas o código (`modules.ts`, `static.ts`, `content.ts`) já tinha centralizado em `packages/ui` — a doc estava dessincronizada do código, não o contrário (DEB-002, spec 046, 2026-06-22).

### Aprovação Obrigatória

Nunca executar sem aprovação explícita do mantenedor:

- Qualquer comando de escrita/mutação contra a VM Oracle: `docker restart|stop|start|rm`, `scp`, `rsync`, `docker cp`, `docker compose up|down`
- `npm`/`pnpm run build` no servidor
- `git commit`; `git push origin dev|main`; `git push --delete`
- `psql`/SQL write em DB real/VM/prod com `INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE`
- Qualquer ação contra WordPress de produção ou DNS raiz antes do Gate C
- Recriar/redimensionar instância Oracle, mexer em volume ou tunnel
- Copiar/sobrescrever arquivos em produção
- Modificar arquivos fora do escopo solicitado sem aprovação/ampliação explícita de escopo registrada na sessão. Pequenas edições pedidas explicitamente pelo mantenedor no meio da sessão contam como ampliação de escopo e devem ser registradas.
- Usar Chrome do mantenedor para verificação/autenticação (`Chrome` plugin, perfil logado, cookies/sessão reais) sem autorização explícita. Preferir validação read-only por HTTP, Browser interno sem sessão real, logs ou artefatos locais quando suficiente. Chrome só entra quando o mantenedor autorizar nominalmente e a tarefa precisar de sessão/perfil real.
- Acionar outro agente de IA em nome do mantenedor (ex.: Claude Code ↔ OpenCode via MCP `opencode`/DeepSeek). Nenhum agente ativa o outro, inicia subprocessos, roda comandos, altera arquivos/configurações ou faz chamadas de ferramenta em nome do outro sem aprovação nominal. Comunicação entre agentes prioriza read-only (análise, inspeção, revisão, diagnóstico); o agente informa qual ferramenta/MCP vai usar antes de acionar. Comandos documentados são referência, não autorização permanente. Detalhe operacional (interno): `docs/agents/operating-model.md`.

**Regra de obediência estrita:** se uma ação está nesta lista, o agente **não infere autorização** de frases genéricas como "pode seguir", "corrija", "resolve isso", "faz o resto", "promova" ou "termina". A autorização precisa nomear a ação perigosa ou o bloco de comandos (`commit`, `push`, `merge`, `workflow_dispatch`, comando VM, deploy etc.). Na dúvida, parar e pedir aprovação no formato abaixo.

**Read-only é SEMPRE permitido (pétrea), nunca exige aprovação por ação** — local ou via PowerShell/`ssh faren`: `docker ps|logs|stats|inspect|images|system df`, `df`, `ls`, `cat`, `rg`/`grep`, `find`, `head`, `tail`, `curl -s` GET, `psql` com `SELECT`, `pg_dump` (read-only no DB), `git status|diff|log|show`, e qualquer subcomando de inspeção/diagnóstico que não muta estado. Inspeção read-only na VM é barata e **deve preceder** qualquer correção de infra "no chute" (anti-retrabalho). Única obrigação: filtrar segredos da saída (nunca imprimir `*PASSWORD*|*TOKEN*|*SECRET*`). Se uma ferramenta/harness bloquear um comando comprovadamente read-only, tratar como falso-bloqueio: explicar ao mantenedor e pedir liberação pontual — não é motivo para pular a inspeção nem para inferir que precisa de aprovação de mérito.

**Pacotes apt ausentes:** se faltar pacote `apt` necessário para executar/validar a operação (ex.: `git`, `jq`, `tree`, `p7zip-full`, `postgresql-client`, `curl`, `ca-certificates`, ferramenta moderna de leitura/inspeção), o agente deve sugerir a instalação, explicar por que o pacote é necessário e informar tamanho aproximado do download/instalação quando disponível. Só depois de aprovação explícita pode rodar `sudo apt-get update` e `sudo apt-get install -y <pacote>`. Proibido usar aprovação de utilitário para instalar serviço persistente novo, alterar arquitetura, mexer em WP/DNS/tunnel, instalar runtime/framework pesado não aprovado, ou executar deploy.

**Escopo da aprovação (pétrea):** aprovação vale **por ação, não por sessão**. Um "pode prosseguir" autoriza APENAS o bloco de comandos apresentado naquele momento. Não se estende a commits/pushes/deploys/correções posteriores. Editar arquivo local dentro do escopo pedido não precisa de aprovação; `git commit`, `git push`, merge, promoção, deploy e comando write na VM sempre precisam de aprovação explícita própria, a cada vez. **Mesmo PR:** commit autorizado + push autorizado não cobre novo commit — cada `git commit` exige autorização nova, cada `git push` exige autorização nova. Não inferir que "estou no mesmo PR" nem que "é só uma correçãozinha".

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

### Isolamento de App/Projeto (pétrea do monorepo)

- Sessão com escopo num app/projeto (ex: `apps/srd`) **não toca** outro `apps/*` nem `packages/*` sem aprovação explícita e ampliação de escopo.
- Mudança de código em `packages/auth` exige aprovação + SDD Completo + smoke de **todos** os apps que consomem SSO. Auth é sagrado: nunca quebrar a sessão compartilhada. Mudança só documental em `packages/auth` exige sessão + evidência, mas não smoke runtime por padrão.
- Mudança de código em `packages/ui` ou no serviço `accounts.` (SSO) exige aprovação + SDD Completo, verificação de impacto nos consumidores afetados e smoke proporcional ao risco/blast radius. Mudança só documental não exige smoke runtime por padrão.
- Matriz mínima de smoke:
  - `packages/auth` código: login/me/logout e todos os consumidores SSO.
  - `packages/ui` código: consumidores visuais afetados + app de referência.
  - `accounts.` código: login/me/logout, allowlist de retorno e pelo menos um app consumidor.
  - Doc-only: sem smoke runtime por padrão; registrar busca/evidência documental.
- Não introduzir novo framework/lib pesada num app/projeto sem aprovação. Stack canônica é única (ver `.specify/arquiteture.md`).

### Git, Branch e Deploy

Fluxo: `<tipo>/<escopo>` → `dev`/Beta → `main`/Produção. Tipos comuns: `feat/*`, `fix/*`, `chore/*`, `docs/*`, `infra/*`. Escolha o tipo pelo trabalho, não pelo agente. Ex.: `feat/srd-001-tooltips`, `fix/glossario-login-guard`, `docs/020-theme-review`.

**TRAVA PÉTREA — mudança que afeta LÓGICA/COMPORTAMENTO NUNCA commita direto em `dev`/`main`.** Toda mudança que altera lógica ou comportamento (código de app/pacote, e infra/workflow/config/script que muda comportamento de deploy/CI/runtime) entra em `dev` **só via branch de trabalho + Pull Request** (`git switch -c <tipo>/<escopo>` → push da branch → `gh pr create --base dev`). Commitar reto na branch `dev` (mesmo com aprovação de push) é **proibido** — destrói a trilha de revisão. **Motivo operacional duro:** as revisões da Amazon (code review externo) leem PRs; sem PR, a mudança fica invisível para revisão. **Desde a branch protection em `dev` (`BL-INFRA-DEFAULT-BRANCH`, 2026-06-17, D073): TUDO que entra em `dev` — inclusive doc-only — vai por branch + PR; não há mais ff/push direto para `dev` (a proteção bloqueia, e exige o check `lint + build + test` verde, sem approvals). Doc-only vira um PR pequeno.** A promoção `dev→main` continua por fast-forward (workflow `promote-prod-fast-forward.yml`), igual para código e docs. Na dúvida se algo "impacta lógica", tratar como código. Se você se pegar com commits na branch `dev` local sem PR aberto, **pare e abra o PR antes de tentar pushar** (o push direto falhará). Falha de processo histórica (commits `485b363`..`d077185` direto em `dev`, 2026-06-15/16) — não repetir.

**TRAVA PÉTREA — PR nova sempre pronta e contra `dev`.** Quando o mantenedor pedir para **abrir uma PR nova**, o agente deve criar/abrir a PR como **ready for review** (não draft) e com **base `dev`**, salvo se o mantenedor pedir explicitamente outra base ou PR draft. Motivo operacional: CodeRabbit/Codex/Amazon Q e revisores automáticos são configurados para revisar PRs contra a branch default/`dev`; PR contra branch intermediária pode mostrar `Review skipped: reviews are disabled for this base branch`. Antes de abrir a PR, confirmar o comando/metadata (`gh pr create --base dev`, sem `--draft`) ou o equivalente da ferramenta. Se a PR já existir e estiver em base diferente, não retargetar sem pedido explícito; informar o mantenedor.

**Deploy/código canônico:** entrega normal passa por GitHub (branch/PR/checks/workflow_dispatch/Actions/secrets) e a VM faz `git fetch/reset` no clone. Acesso SSH direto à VM é exceção para bootstrap do clone, instalar utilitários operacionais, conexão, diagnóstico ou rollback aprovado — não é caminho normal de deploy/codificação. Se GitHub cobre a ação, use GitHub para rastreabilidade e branch safety.

**⚠️ Alerta: `deploy.yml` só deploya se `deploy_paths` do manifesto mudar.** Docs/specs/reviews/governança nunca disparam deploy real. CI roda, deploy=false. Para verificar: `gh run view <RUN_ID> --log | grep "deploy="`. Para forçar manual: `gh workflow run deploy.yml --ref dev -f module=mesas -f mode=deploy -f env=beta`. Detalhe em `docs/agents/infra-map.md` §Regra operacional de deploy.

**⚠️ TRAVA PÉTREA — `promote-prod-fast-forward.yml` NUNCA dispara deploy de prod.** Promote só move o ponteiro Git (`main` fast-forward pra `dev`); não chama `deploy.yml`, não builda, não sobe container. **Prod só atualiza com `workflow_dispatch` manual explícito**: `gh workflow run deploy.yml --ref main -f module=<modulo> -f mode=deploy -f env=prod`. Regra dura: depois de qualquer `promote` aprovado, **nunca declarar "promovido" ou "em produção" sem também disparar e confirmar esse deploy** — Git atualizado ≠ prod atualizado. Verificar sempre com `gh run list --workflow=deploy.yml --branch=main --limit=5` antes de afirmar que prod está no ar com a mudança. Causa raiz real (2026-07-08, spec discord-sync mesas): promote de PR #136 rodou com sucesso, `main` ficou correto, mas prod continuou rodando código antigo (sem os fixes de validação/enum) por 2 promotes seguidos sem deploy — usuário continuou vendo o mesmo 422 em produção enquanto o agente reportava a tarefa como concluída.

**TRAVA PÉTREA — branch nova SEMPRE parte de `dev` atualizado, nunca de outra branch de trabalho.** `git switch -c <tipo>/<escopo>` sempre a partir de `origin/dev` sincronizado (`git fetch origin && git switch -c <tipo>/<escopo> origin/dev`), nunca em cima do HEAD de uma branch de trabalho já existente (mesmo que pareça "relacionada"). Branch-sobre-branch herda o histórico de commits da branch-base, mesmo se ela já foi mergeada — vira PR com 3 commits em vez de 1, gera conflito e faz o bot de review analisar diff errado/incompleto. Causa raiz real (2026-07-08, spec 059): `git switch -c feat/059-...` rodou sem `git switch -c` a partir de `dev`, criou a partir do HEAD de `fix/mesas-draft-publish-flow` (branch antiga com 2 commits locais não sincronizados) → PR #138 saiu com 3 commits em vez de 1 e conflito de merge.

- Criar branch de trabalho (`feat/*`, `fix/*`, `chore/*`, `docs/*`, `infra/*`): automático, exceto se for doc-only acumulado que deve ficar local.
- `git push origin <branch-de-trabalho>`: automático para código/feature autorizada; **doc-only segue a regra própria abaixo**.
- Abrir PR para `dev`: automático para código/feature autorizada, sempre **ready for review** e **não draft**, salvo pedido explícito diferente; **doc-only não abre PR sozinho**.
- `git push origin dev`: **bloqueado por branch protection** — `dev` só recebe via **merge de PR** (com check `lint + build + test` verde). Vale para código E doc-only. Push direto falha.
- `git push origin main`: aprovação explícita.
- Merge de PR: só com autorização explícita.
- **Nunca fazer `git commit`/`git push` por interpretação ou inércia.** "Corrija", "documente", "ajuste", "pode seguir" ou "resolve logo" autorizam no máximo editar arquivos locais dentro do escopo. Para commitar/pushar, a mensagem precisa pedir explicitamente algo como "commite", "faça push", "suba para dev/main", "promova agora" ou aprovar um bloco de comandos que inclua essas ações. **Cada commit/push requer autorização própria — mesmo em branch já pushada, mesmo no mesmo PR, mesmo após autorização anterior na mesma conversa. Autorização não acumula.**
- **TRAVA PÉTREA — depois de abrir/atualizar a PR, o agente para.** `git push` de uma branch de trabalho autorizada e a abertura da PR correspondente (`gh pr create`, regra acima) são a MESMA ação e podem ser feitas em sequência sem nova autorização. O que trava é o que vem depois: não acompanhar PR, não esperar checks, não rodar `gh pr view`, `gh run watch`, `gh run view`, polling, sleep, nem consultar status do PR após ela estar aberta/atualizada, salvo pedido explícito do mantenedor para acompanhar/verificar checks. Se o pedido foi "commit + push", fez push (+ PR quando aplicável) e encerra a resposta.
- Nunca `git checkout` entre `dev` e `main` durante deploy. Usar `git fetch`, `git rev-parse`, `git log origin/main...origin/dev`, `gh run` e comparações sem checkout.
- **TRAVA PÉTREA — PROIBIDO 2+ commits separados por push num PR aberto.** Cada `git push` autorizado leva **um único commit** com todo o diff pendente (código + artefatos auto-gerados, ex. `docs/api/generated/*`/`docs/api/openapi/*` do `verify:api`). Bot de review (CodeRabbit/Codex/Amazon Q) analisa só o último commit, não o diff completo do PR — 2+ commits fazem o bot revisar código incompleto, gastando o check limitado do plano em algo que não é a mudança inteira.
- **TRAVA PÉTREA — NUNCA responder, comentar, resolver thread, reagir ou disparar (`@q`, `@codex`, `@coderabbit`, etc.) revisores externos/bots no PR** (amazon-q-developer, chatgpt-codex-connector, coderabbit, Snyk, Sonar, github-advanced-security e afins). O agente **não** escreve nada na conversa do PR. Toda análise de revisão (procede/descarta/backlog) vive **na documentação** — sessão + `specs/.../tasks.md` + `specs/backlog.md` + `project-state.md` conforme impacto — com o veredicto e o porquê. Aplicar fixes que procedem via commit normal (branch/PR); o resto vira débito documentado. Resposta a revisor no PR é sempre do mantenedor, nunca do agente.
- **Doc-only (regra atualizada D073 — pós branch protection):**
  - `git commit`, `git push`, PR e promoção continuam exigindo aprovação explícita por ação, mesmo quando o diff é só documentação.
  - Mudança só de documentação não vai sozinha; commit/push/PR só com pedido explícito (**documentar/commitar/pushar docs agora**).
  - **Não há mais ff/push direto de doc-only para `dev`** (proteção bloqueia). Doc-only entra em `dev` por **branch + PR**, igual a código (pode pegar carona no PR de código que a motiva, ou PR doc-only próprio).
  - A promoção `dev→main` (código ou docs) é por fast-forward (`promote-prod-fast-forward.yml`), sem merge commit/squash.
  - Para **código**, fluxo normal: branch/PR/checks/revisão/merge autorizado.
  - Se o GitHub sugerir PR de `dev`, verificar `origin/main...origin/dev` e o conteúdo antes de agir.

### Acesso à VM (Oracle)

- Acesso direto por alias SSH configurado em `~/.ssh/config` local (**não versionado**; host/IP/chave fora do git). Mapa de infra: doc interna fora do repositório público (`docs/agents/`, gitignored).
- **Read-only via VM é SEMPRE permitido (pétrea), sem aprovação:** `ssh faren '<cmd read-only>'` com `docker ps|logs|inspect|stats|images|system df`, `df`, `ls/cat/rg/grep`, `git status|diff|log|show`, `psql ... SELECT`, `pg_dump` (read-only no DB) e qualquer inspeção que não mute estado. Não inferir necessidade de aprovação por ser "na VM/prod": ler estado nunca é ação de mérito. Filtrar segredos da saída (nunca imprimir `*PASSWORD*|*TOKEN*|*SECRET*`). Só a **escrita** na VM (próximo item) exige aprovação nominal.
- **Aprovação obrigatória (pétrea):** qualquer write na VM — `docker stop|rm|up|restart`, escrever/copiar arquivo, migration, `scp/rsync`, subir/derrubar serviço, mexer no tunnel.
- A chave privada (`*.key`) é segredo: gitignored, nunca commitar/expor/imprimir.

### Banco, Infra e Segredos

- Qualquer SQL write/migration em produção exige aprovação explícita + simulação/dry-run/plano de rollback registrados. Operação destrutiva (`DROP`, `TRUNCATE`, `DELETE` massivo, `ALTER` destrutivo) só com permissão nominal + dump prévio + checklist.
- Cada app/projeto tem seu schema/banco lógico isolado; SSO/usuários é o único cross-cutting. Documentar em `.specify/arquiteture.md`.
- Nunca criar tunnel/container `cloudflared` paralelo.
- Nunca registrar, expor ou versionar token, PAT, segredo ou credencial. Segredos vivem em `.env` (gitignored) e nos secrets do Actions/Cloudflare.
- Acesso DB da VM por linha de comando local/PowerShell via `ssh faren` é **read-only por padrão** (`psql SELECT`, `pg_dump`, `docker exec` read-only). Escrita no banco da VM = aprovação.

#### TRAVA PÉTREA — Migrations (checklist obrigatório antes de commitar QUALQUER `migration_*.sql`)

**Causa recorrente de deploy quebrado (E011): header de migration incompleto só estoura no deploy da VM, nunca no CI.** Toda migration nova/alterada DEVE ter os **5 campos de header** validados por `scripts/deploy/lib_migrations.sh:parse_header`, senão `apply_required_migrations.sh` aborta o deploy com `falhou na validacao de campos do cabecalho.`:

```sql
-- @class: online-safe        # online-safe | manual-risk (obrigatório)
-- @requires-backup: false    # true | false (obrigatório; true exige class=manual-risk)
-- @author: spec-NNN          # obrigatório, não-vazio
-- @created: AAAA-MM-DD        # obrigatório, não-vazio
-- @description: ...           # obrigatório, não-vazio
```

Regras duras:
- `@migration: N` é opcional/decorativo — **não** conta como um dos 5. Não confundir.
- Os 5 campos são lidos só nas **primeiras 20 linhas** do arquivo (`head -n 20`). Header vai no topo, antes do SQL.
- `@requires-backup: true` **exige** `@class: manual-risk` (regra em `lib_migrations.sh`), senão aborta.
- `online-safe` **não pode** conter DDL destrutivo de objeto (`DROP TABLE/COLUMN/...`, `TRUNCATE`, `DELETE FROM`) — só `manual-risk` (guard E010). `DROP NOT NULL/CONSTRAINT/DEFAULT` são permitidos em `online-safe`.
- Migration só em diretório allowlisted (`apps/*/database/` ou `apps/*/db/migrations/`) — `_enforce-migration-dir.yml` bloqueia fora disso.
- **Antes de dizer "pronto":** rodar `bash scripts/deploy/lib_migrations.sh` não existe standalone — validar copiando o header do vizinho verde mais recente (ex.: maior `migration_NNN` já em prod) e conferir os 5 campos. Se o deploy beta falhar com `campos do cabecalho`, é ISTO — não re-tentar deploy, corrigir o header.

---

## Regras de Produto e SEO

- Compromissos inegociáveis: gratuidade, sem anúncios, sem coleta desnecessária de dados.
- **Google OAuth é o único login.** Sessão única em cookie `Domain=.artificiorpg.com`. E-mail/senha só com autorização explícita. Exceção controlada: fluxo legado de migração do glossário (D061) pode verificar vínculo antigo sem criar sessão por e-mail/senha.
- **SEO é inegociável no site:** slugs do WordPress preservados, redirects 301 preservados, sem merge que cause regressão de meta/sitemap/canonical. Manter compatível com exigências de Search Console e Lighthouse. Testes completos de Search Console/Lighthouse só entram depois do portal completo e DNS do portal apontado para `artificiorpg.com` (Gate C); antes disso validar local/beta o que for possível.
- Toda mudança de interface respeita as **10 Heurísticas de Nielsen** e **ISO 9241-11** (eficácia, eficiência, satisfação) antes do merge. Checklist na sessão.
- Design sóbrio/minimalista com sobriedade de Google-suite (Docs/Gmail), sem copiar marca Google. Cores, logo e padrões vêm de `packages/ui`. Não divergir do design system por app/projeto sem aprovação.
- Analytics (GA4) cobre rotas públicas via `packages/analytics`. Toda página/rota pública nova é instrumentada. Admin/operacional só instrumenta eventos úteis, sem coletar dado desnecessário.
- Upload e processamento de imagem ocorrem sempre no Backend, via Cloudinary com signed preset. Nunca hardcodar credencial Cloudinary.

---

## Regras Gerais de Código

- Mudança mínima, reversível, dentro do escopo. Sem refactor massivo sem autorização.
- Stack canônica única: Frontend React 19/TS/Vite/Tailwind; Backend Node/Express 5/TS/Kysely/Postgres 16; auth via JWT no backend.
- Python só para scripts fora do runtime principal.
- **Normalização obrigatória:** todo dado de API/banco/JSON/JSONB/query/localStorage/integração externa é `unknown` até passar por normalizador tipado antes de entrar em estado React, props ou render.
- Proibido `.map/.filter/.reduce/.forEach`, spread de array ou `.length` sobre payload externo sem `Array.isArray`/schema/fallback explícito.
- HTML importado do WordPress é hostil: sanitizar sempre (DOMPurify) antes de persistir/renderizar.
- **Comentário explicativo de decisão não se perde em edit/fix subsequente (nem de bot de review — CodeRabbit/Sonar/Codex/etc).** Quando um trecho comentado é editado (fix de bug, correção de review, refactor local), o agente preserva ou reescreve o comentário pra continuar explicando a decisão atual — nunca apaga silenciosamente um comentário que documentava por que o código era daquele jeito, mesmo que o código mude. Se a mudança troca a razão de ser do trecho, o comentário deve ser atualizado pra refletir a nova decisão e citar a origem (ex.: achado de review, número de spec/débito, comportamento real observado), no mesmo padrão que já se usa nesta base (`DEB-NNN`, `T-XX`, referência a spec/PR) — pra que outro agente, lendo só o código depois, entenda o porquê sem precisar reconstruir o histórico do chat.

---

## Erros Conhecidos

Ao encontrar erro/regressão: (1) parar tentativas repetidas; (2) consultar `.specify/memory/errors.md` por código `E###` ou sintoma; (3) se houver solução documentada, aplicar e registrar evidência; (4) se não, diagnosticar e registrar aprendizado validado.

---

## Protocolo de Sessão

Sessões em `sessoes/` no formato `AA-MM-DD_N_<app-ou-escopo>_<escopo>.md`. Consultar `sessoes/index.md`.

Conteúdo mínimo: cabeçalho (data/objetivo/app ou projeto/gate), vínculos, plano, checklist de fechamento, arquivos a modificar, critério de conclusão, item para atualizar `project-state.md`. Atualizar a sessão antes de alterações técnicas e após cada etapa relevante.

---

## Conclusão de Tarefas

Concluída só quando: busca final relevante retorna o esperado; comando/teste real executou quando a tarefa promete executabilidade; checklist da sessão fechada; nenhum arquivo parcialmente modificado; `project-state.md` atualizado; `specs/backlog.md` atualizado quando a tarefa cria débito, fecha débito, muda status de spec/tarefa ou descobre pendência acionável; validação técnica/manual registrada. Não declarar conclusão usando "parcial", "restante", "maioria", "principais", "alguns" ou percentual incompleto. Status parcial pode ser registrado em backlog/revisão, nunca como conclusão final.

Se uma validação real expõe que a tarefa "fechada" ainda não roda, reabrir a task/backlog imediatamente, corrigir o artefato até ficar usável ou registrar bloqueio concreto. Dry-run, plano ou documentação não fecham tarefa cujo aceite exige execução real.

**Obrigatório:** toda spec nova, retomada de spec, fechamento de tarefa, review que gere débito, ou descoberta de pendência deve verificar `specs/backlog.md` e registrar uma das duas coisas na sessão: (1) backlog atualizado; ou (2) nada a atualizar, com motivo curto. Isso evita pendência presa só no chat, em `tasks.md` isolado ou na memória do agente.

**Bug achado = registro obrigatório:** se durante qualquer investigação o agente encontra bug real ou provável (incluindo bug de script/harness, workflow CI/CD recorrente, status inconsistente, index/backlog desatualizado, contrato quebrado, smoke que falha, ou comportamento que exige futura correção), deve registrar antes de encerrar:

- na sessão atual, com evidência concreta (comando, run, arquivo, trecho, métrica ou URL);
- em `specs/backlog.md`, salvo se já existir item ativo cobrindo exatamente o mesmo problema;
- em `tasks.md` da spec quando a bug muda status, critério de aceite ou próxima ação da spec;
- em `project-state.md` quando afeta retomada/gate/próximo passo operacional.

Se o agente decidir que não há backlog novo, deve escrever na sessão o motivo objetivo. “Não deu tempo”, “era lateral” ou “parece pequeno” não dispensam registro; só dispensam correção imediata.

---

## Documentação Canônica

| Tipo | Fonte |
|---|---|
| Governança operacional | `AGENTS.md` |
| Princípios inegociáveis | `.specify/memory/constitution.md` |
| Arquitetura/contratos técnicos | `.specify/arquiteture.md` (canônica; revisar/atualizar quando mudar contrato técnico/arquitetura) |
| Estado atual (fase/gate) | `.specify/memory/project-state.md` |
| Erros conhecidos | `.specify/memory/errors.md` |
| Contexto de retomada | `docs/agents/context-capsule.md` ⃰ |
| Economia de contexto/reload | `docs/agents/token-economy.md` ⃰ |
| Mapa da VM/infra (verificado) | `docs/agents/infra-map.md` ⃰ |
| Registro de acesso & segredos | `docs/agents/access-registry.md` ⃰ |
| Modelo de operação (SDD) | `docs/agents/operating-model.md` ⃰ |
| Roadmap macro | `docs/agents/roadmap.md` ⃰ |

⃰ `docs/agents/*` = docs internas de operação, **fora do repositório público** (gitignored, só local + backup do mantenedor).
| Sessões | `sessoes/index.md` + `sessoes/*.md` |
| Specs SDD | `specs/README.md` + `specs/backlog.md` + `specs/*/{spec.md,plan.md,tasks.md}` |
| Subagentes | `.claude/agents/` |
| Skills/playbooks locais | `.agents/skills/` |

## Ferramentas MCP / Agentes

As ferramentas locais abaixo foram adotadas para reduzir retrabalho, detectar erros cedo e evitar descoberta de API por memória de chat. São opcionais por ambiente, não-versionadas quando dependem de config local, e devem funcionar em **Codex**, **Claude Code** e **OpenCode** quando disponíveis. Se uma delas não aparecer no cliente atual, registrar a limitação na sessão e usar fallback local (`rtk rg`, `ast-grep`, leitura direta e `pnpm verify:api` quando aplicável).

### LSP / diagnósticos semânticos

- **Origem/registro:** Spec 044 consolidou LSP como parte do ecossistema de agentes; o mantenedor reforçou em 2026-07-08 que ele detecta erros automáticos que antes passavam despercebidos.
- **Função:** diagnóstico semântico contínuo: tipos quebrados, imports inválidos, símbolos inexistentes, assinaturas incompatíveis e erros que busca textual não revela.
- **Usar para:** checar arquivos tocados antes/depois de edição; confirmar impacto local de refactor; achar erro rápido enquanto ainda é barato corrigir.
- **Clientes:** OpenCode expõe LSP diretamente; Serena usa LSP por baixo; Claude Code pode usar plugin LSP; Codex depende das ferramentas disponíveis no turno/config local.
- **Trava:** LSP é importante, mas auxiliar. Diagnóstico limpo não substitui `pnpm run lint`, `pnpm run build`, testes pontuais e `pnpm verify:api` quando exigidos.

### Serena MCP

- **Origem/registro:** Spec 044 / DEB-044-01. Implementado localmente em 2026-06-22 com `serena-agent` v1.5.3; OpenCode configurado em `opencode.json`; Claude Code configurado via MCP local; Codex usa config MCP local do usuário.
- **Função:** navegação e edição semântica por símbolo via LSP. Útil quando o alvo é função, classe, método, referência ou impacto de mudança.
- **Ferramentas esperadas:** `get_symbols_overview`, `find_symbol`, `find_referencing_symbols`, `replace_symbol_body`, `insert_before_symbol`, `insert_after_symbol`, `rename_symbol`, `get_diagnostics_for_file`.
- **Usar para:** entender símbolos top-level de arquivo novo; ler corpo exato com `include_body=true`; localizar referências antes de editar; fazer edição cirúrgica por símbolo.
- **Não usar para:** string literal, mensagem de erro, config, JSON/YAML, shell, Dockerfile ou símbolo que o LSP não resolveu. Use `rtk rg`/leitura direta nesses casos.
- **Trava:** diagnóstico LSP é auxiliar. Nunca substitui `pnpm run lint`, `pnpm run build` e testes/validação CLI exigidos pela tarefa.

### codebase-memory-mcp

- **Origem/registro:** Spec 044 / DEB-044-02. Implementado localmente em 2026-06-22 com `codebase-memory-mcp` v0.8.1; smoke registrou grafo com ~10.6k nós / 18.1k arestas e `search_graph` OK. OpenCode e Claude Code configurados; Codex usa config MCP local do usuário.
- **Função:** grafo persistente do código para descoberta estrutural, chamadas, arquitetura e impacto. Complementa Serena; não substitui busca textual.
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
3. Serena MCP para navegação/edição por símbolo quando o símbolo é conhecido ou localizável.
4. `codebase-memory-mcp` para mapa estrutural, dependências, chamadas e arquitetura.
5. `ast-grep`, `rtk rg`, `rtk read`, `git`, leitura direta e validação CLI.

Config local pode diferir entre clientes:
- **OpenCode:** `opencode.json`.
- **Claude Code:** MCP local em `.claude.json`/config Claude do usuário.
- **Codex:** `C:\Users\paulo\.codex\config.toml`.

Não acionar outro agente em nome do mantenedor sem aprovação nominal; usar MCPs locais de leitura/navegação não muda esta regra.

---

# Artifício Supervisor Flow

Este projeto usa um fluxo de agentes para OpenCode com um único agente primário: `artificio-orquestrador`.

## Regra central

O usuário conversa apenas com o orquestrador.
Subagentes trabalham em tarefas fechadas e devolvem relatório ao orquestrador.

## Fases

1. fix ou feature
2. registro
3. investigação
4. implementação
5. revisão de documentação atualizada
6. commit

O orquestrador deve pedir autorização antes de cada fase.
A autorização vale apenas para a fase e o escopo descritos.

## Bloqueios

- Jamais commitar sem autorização explícita.
- Jamais push sem autorização explícita.
- Jamais merge sem autorização explícita.
- Jamais abrir PR sem autorização explícita.
- Jamais avançar fase sem autorização explícita.
- Se houver dúvida, parar e perguntar em tom leigo com opções claras.

## Specs

Estrutura padrão:

```text
specs/NNN-<modulo>-<slug>/
  spec.md
  plan.md
  tasks.md
  reviews.md
  debitos.md
```

`reviews.md` deve receber apenas reviews externos: usuário, bots, PRs ou checks.
Achados internos de investigação, lint, build ou auditoria entram em `debitos.md`, salvo instrução explícita.

## Ferramentas preferidas

Quando disponíveis, agentes devem seguir a seção **Ferramentas MCP / Agentes** acima. Resumo operacional:

1. `artificio-api-governance` para API.
2. LSP para diagnóstico automático.
3. Serena MCP para símbolo/edição semântica.
4. `codebase-memory-mcp` para grafo/impacto.
5. `ast-grep`, `rtk rg`, `rtk read`, `git` e leitura direta.

Se essas ferramentas não estiverem disponíveis, usar fallback local e registrar a limitação.

## Comandos principais

```text
/fluxo-spec
/fix-spec
/feature-spec
/registrar-spec
/investigar-spec
/implementar-spec
/auditar-spec
/documentar-spec
/preparar-git-spec
/continuar-spec
```

## Formato final do orquestrador

Ao final de cada fase, responder com:

```md
## Estado
- Fase concluída:
- Próxima fase:
- Bloqueios ativos:

## Resultado
...

## Próximo command pronto
/<comando sugerido>
```
