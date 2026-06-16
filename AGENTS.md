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

**Não** ler `AGENTS.md` inteiro por hábito — é T1 (consulta de regra sob demanda), salvo quando a tarefa for revisar/editar governança ou o próprio `AGENTS.md`. `arquiteture.md` só por seção. Disciplina completa em `docs/agents/token-economy.md`. Caveman ultra default na saída.

**Escalada T1 obrigatória:** se a tarefa tocar ou questionar governança, infra, deploy, CI/CD, VM, DNS/tunnel, banco, auth, SEO/Lighthouse/qualidade transversal, pacotes compartilhados, specs/backlog/sessões ou conclusão de tarefa, o agente deve ler as seções/documentos T1 pertinentes antes de agir ou encerrar. Ex.: infra/deploy → `docs/agents/infra-map.md`, `docs/agents/deploy-runbook.md` quando existir, seções "Acesso à VM", "Banco, Infra e Segredos", "Git, Branch e Deploy"; specs/backlog → `specs/README.md` + spec/tasks/backlog; governança → `AGENTS.md` seções relevantes. Se não leu o T1 pertinente, não pode afirmar que a tarefa está resolvida.

Depois verificar `sessoes/` por sessão ativa incompleta. Se houver, continuar nela salvo pedido explícito de abrir sessão dedicada. Antes de qualquer alteração, registrar na sessão: o que vai fazer, o que falta, o que já foi feito.

**Anti-retrabalho:** se um fluxo parecer estranho, contraditório ou perigoso (CI/CD, deploy, branch, DNS/tunnel, auth, banco, SEO, Lighthouse/qualidade, importador, pacote compartilhado), **não corrigir no chute**. Primeiro pesquisar decisões, specs, sessões e docs operacionais relevantes (`decisions.md`, `project-state.md`, `errors.md`, `specs/`, `sessoes/`, `docs/agents/`). Identificar se o comportamento é decisão histórica, exceção temporária ou bug real; só então corrigir e registrar evidência.

**Quando descobrir falha de processo:** se a tarefa revela que a governança, T0/T1, spec, backlog ou definição de "feito" deixou margem para erro, corrigir a fonte canônica adequada no mesmo escopo (ou registrar débito explícito se não puder). Não basta atualizar só `project-state.md`; regras operacionais duráveis entram em `AGENTS.md`/`context-capsule.md`/docs T1, e tarefas entram em `specs/backlog.md`/`tasks.md`.

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

**Regra de obediência estrita:** se uma ação está nesta lista, o agente **não infere autorização** de frases genéricas como "pode seguir", "corrija", "resolve isso", "faz o resto", "promova" ou "termina". A autorização precisa nomear a ação perigosa ou o bloco de comandos (`commit`, `push`, `merge`, `workflow_dispatch`, comando VM, deploy etc.). Na dúvida, parar e pedir aprovação no formato abaixo.

**Read-only é SEMPRE permitido (pétrea), nunca exige aprovação por ação** — local ou via PowerShell/`ssh faren`: `docker ps|logs|stats|inspect|images|system df`, `df`, `ls`, `cat`, `rg`/`grep`, `find`, `head`, `tail`, `curl -s` GET, `psql` com `SELECT`, `pg_dump` (read-only no DB), `git status|diff|log|show`, e qualquer subcomando de inspeção/diagnóstico que não muta estado. Inspeção read-only na VM é barata e **deve preceder** qualquer correção de infra "no chute" (anti-retrabalho). Única obrigação: filtrar segredos da saída (nunca imprimir `*PASSWORD*|*TOKEN*|*SECRET*`). Se uma ferramenta/harness bloquear um comando comprovadamente read-only, tratar como falso-bloqueio: explicar ao mantenedor e pedir liberação pontual — não é motivo para pular a inspeção nem para inferir que precisa de aprovação de mérito.

**Pacotes apt ausentes:** se faltar pacote `apt` necessário para executar/validar a operação (ex.: `git`, `jq`, `tree`, `p7zip-full`, `postgresql-client`, `curl`, `ca-certificates`, ferramenta moderna de leitura/inspeção), o agente deve sugerir a instalação, explicar por que o pacote é necessário e informar tamanho aproximado do download/instalação quando disponível. Só depois de aprovação explícita pode rodar `sudo apt-get update` e `sudo apt-get install -y <pacote>`. Proibido usar aprovação de utilitário para instalar serviço persistente novo, alterar arquitetura, mexer em WP/DNS/tunnel, instalar runtime/framework pesado não aprovado, ou executar deploy.

**Escopo da aprovação (pétrea):** aprovação vale **por ação, não por sessão**. Um "pode prosseguir" autoriza APENAS o bloco de comandos apresentado naquele momento. Não se estende a commits/pushes/deploys/correções posteriores. Editar arquivo local dentro do escopo pedido não precisa de aprovação; `git commit`, `git push`, merge, promoção, deploy e comando write na VM sempre precisam de aprovação explícita própria, a cada vez.

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

**Deploy/código canônico:** entrega normal passa por GitHub (branch/PR/checks/workflow_dispatch/Actions/secrets) e a VM faz `git fetch/reset` no clone. Acesso SSH direto à VM é exceção para bootstrap do clone, instalar utilitários operacionais, conexão, diagnóstico ou rollback aprovado — não é caminho normal de deploy/codificação. Se GitHub cobre a ação, use GitHub para rastreabilidade e branch safety.

- Criar branch de trabalho (`feat/*`, `fix/*`, `chore/*`, `docs/*`, `infra/*`): automático, exceto se for doc-only acumulado que deve ficar local.
- `git push origin <branch-de-trabalho>`: automático para código/feature autorizada; **doc-only segue a regra própria abaixo**.
- Abrir PR para `dev`: automático para código/feature autorizada; **doc-only não abre PR sozinho**.
- `git push origin dev`: aprovação explícita.
- `git push origin main`: aprovação explícita.
- Merge de PR: só com autorização explícita.
- **Nunca fazer `git commit`/`git push` por interpretação.** "Corrija", "documente", "ajuste", "pode seguir" ou "resolve logo" autorizam no máximo editar arquivos locais dentro do escopo. Para commitar/pushar, a mensagem precisa pedir explicitamente algo como "commite", "faça push", "suba para dev/main", "promova agora" ou aprovar um bloco de comandos que inclua essas ações.
- Nunca `git checkout` entre `dev` e `main` durante deploy. Usar `git fetch`, `git rev-parse`, `git log origin/main...origin/dev`, `gh run` e comparações sem checkout.
- **Doc-only (regra reforçada):**
  - `git commit`, `git push`, PR e promoção continuam exigindo aprovação explícita por ação, mesmo quando o diff é só documentação.
  - Mudança só de documentação não vai sozinha para `dev`/`main`, não abre PR e não é pushada, salvo se o mantenedor pedir explicitamente **documentar/commitar/pushar docs agora**.
  - Docs viajam junto com o próximo commit de código que as motiva, ou ficam locais acumuladas.
  - Exceção: correção documental urgente aprovada explicitamente pelo mantenedor; registrar na sessão "doc-only autorizado".
  - Se o mantenedor pedir explicitamente para subir/promover um diff **somente documentação**, a promoção `dev→main` deve ser por fast-forward (`promote-prod-fast-forward.yml` ou comando equivalente autorizado), sem merge commit/squash.
  - Para **código**, seguir fluxo normal: branch/PR/checks/revisão/merge autorizado; não promover código por fast-forward direto só para "resolver logo".
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
