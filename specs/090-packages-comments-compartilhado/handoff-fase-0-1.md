# Handoff — Spec 090

**Última atualização:** 2026-07-30 · **Branch:** `feat/090-fase-1` · **Sem commit/push**

Registro das decisões nominais do mantenedor sobre a spec 090. Onde este
documento contradiz uma leitura anterior da spec, ele prevalece; onde `AGENTS.md`
contradiz este documento, `AGENTS.md` prevalece (governança é pétrea).

**Refeito nesta versão** para refletir o estado atual: Fase 0 fechada, Fase 1 em
curso, requisito 27 (moderação no front) adicionado à spec. As seções de
histórico já cumprido foram condensadas na seção 1.

---

## 1. Estado atual

### Concluído

**Fase 0 — 17/17 tasks.** Contrato fechado.

**Correção da contradição do modelo de notificação.** `plan.md` descrevia
notificação numa tupla única; `spec.md:87` (13a) exige `notification_event`
(ocorrência imutável) + `notification_receipt` (estado por usuário) separados.
A spec venceu, pelo motivo de `spec.md:95` (15c): resposta notifica autor do pai
**e** publicador do conteúdo — dois destinatários por evento, com dedup quando é
a mesma conta. Tabela única obrigaria duplicar a ocorrência e deduplicar na mão.
`plan.md` corrigido.

**Fase 1 iniciada** em `apps/accounts` + `packages/auth`:

- `packages/auth`: `UserRole` ganha `moderator`; `roleVersion`/`role_version`
  com normalização `Number.isSafeInteger` em `types.ts`, `jwt.ts` e `client.ts`.
- `apps/accounts`: 3 migrations em `database/` — baseline (001), papel global
  com auditoria e trigger (002), `VALIDATE CONSTRAINT` separado (003).
- **T0.12 executada:** `src/migrate.ts` **removido**; `Dockerfile` não migra
  mais no boot (`CMD ["node","dist/index.js"]`); script `migrate` fora do
  `package.json`. O SSO passa a depender do runner pré-container.

Validação relatada: `packages/auth` 6/6 testes; `apps/accounts` 18/18; build e
lint verdes; guard de migration 47/47.

### Por que são 3 migrations e não 1

Pergunta do mantenedor, respondida em 2026-07-30. **Não dá para unificar:**

- **001 (baseline)** registra na ledger o schema que já existe em produção.
  Juntar com a 002 faria um banco existente tentar criar `users` e adicionar
  `moderator` no mesmo arquivo, e a ledger perderia a distinção entre "o que já
  estava lá" e "o que a spec 090 criou". Baseline é marco, não mudança.
- **002 + 003** é imposição do **E015**: o runner envolve **cada arquivo** num
  `BEGIN; ... COMMIT;`. `ADD CONSTRAINT NOT VALID` e `VALIDATE CONSTRAINT` no
  mesmo arquivo = mesma transação = `users` travada do início ao fim. O padrão
  existe justamente para o `ADD` pegar lock breve e o `VALIDATE` varrer depois
  sem bloquear escrita. **O arquivo separado é o mecanismo, não organização.**

A regra de `AGENTS.md` contra fatiar schema não se aplica: ela impede "uma
tabela por arquivo sem motivo", e prevê exceção quando uma migration é
independente da outra em produção.

### Bloqueios abertos

**As 3 migrations do `accounts` nunca rodaram contra Postgres real** (Docker
indisponível na máquina do agente). Validou-se formato de header e classe, não
execução. **E014, E015 e E018 só apareceram na execução real** — todos passariam
na validação estática que a Fase 1 rodou. Não bloqueia continuar, mas entra como
bloqueio explícito no relatório final e precisa acontecer antes de qualquer
deploy: é o SSO.

**~~Migração pré-container do `accounts` precisa de verificação de drift.~~
CONFIRMADO COMO BUG — vira T1.11–T1.13.** O mantenedor achou em 2026-07-30 e a
inspeção confirmou: `check_migration_drift.sh` **falha aberto**.

Linhas 38-41: diretório ausente imprime `nada a comparar` e `exit 0`. É o **mesmo
padrão do E018 que este script foi escrito para fechar** — o cabeçalho dele
(linhas 11-12) descreve `apply_required_migrations.sh` saindo verde por diretório
ausente e se declara "o alarme que faltava", e então repete a falha. A linha 27
documenta `1 em qualquer divergência (fail-closed)`, contradizendo o código.

Importa agora porque T0.12 tirou `migrate.ts` do boot: antes, migration quebrada
derrubava o container e aparecia; agora o container sobe saudável e este script é
o **único** alarme do SSO.

Enumeração feita (não amostragem): `accounts` 3, `mesas` 84, `glossario` 5,
`downloads` 37, `links` 2 em `apps/<mod>/database/`; `site` em
`apps/site/db/migrations/` (16, ramo especial do workflow); `site-admin` sem
banco. **Nenhum módulo depende do fail-open** — corrigir não quebra deploy
existente.

Escopo ampliado pelo mantenedor. Detalhe em `tasks.md` T1.11–T1.13, mais o débito
de unificação (declarar diretório/coluna/glob no `deploy-manifest.json`, hoje
derivados por convenção com `if` hardcoded para o `site`) registrado ali como
spec própria.

**Warning no build de `apps/links` — investigado e descartado, não vira débito**
(decisão do mantenedor, 2026-07-30). `Warning: --localstorage-file was provided
without a valid path`, build verde.

Não é código do app. Os `localStorage` de `apps/links` são API de **navegador**
(tema, gate +18, onboarding), todos já com `try/catch`; `--localstorage-file` é
flag de **runtime Node**, que o app não passa em lugar nenhum, e `NODE_OPTIONS`
estava vazio. Origem: o harness que executou o build.

Sem registro em backlog ou `errors.md` de propósito: não há ação possível dentro
do repositório, então um item de fila ficaria aberto para sempre sem ninguém
conseguir fechá-lo. Fica documentado aqui, que é onde importa para quem retomar
a spec. Se o warning voltar **num ambiente diferente**, aí sim é sinal de outra
coisa e merece investigação nova.

---

## 2. Escopo autorizado

`apps/accounts/**` e `packages/auth/**` (aprovação nominal, sem condição), mais a
ampliação de 2026-07-30:

- `apps/downloads/**`, `apps/mesas/**`, `apps/glossario/**`
- `apps/site/**`, `apps/site-admin/**`, `apps/links/**`
- `.github/deploy-manifest.json` — correção do comentário sobre migrations do
  `accounts`, falso após T0.12

Ampliação de 2026-07-30 (segunda), para T1.11–T1.13:

- `scripts/deploy/check_migration_drift.sh`
- `scripts/deploy/apply_required_migrations.sh` (T1.12, se a análise confirmar)
- `.github/workflows/_deploy-module.yml`

Libera T1.5–T1.13 e a correção do `emitNotification`.

**Fora:** qualquer outro `packages/*`, outros `scripts/**`, outros
`.github/workflows/**`. Ampliação nova exige pedido próprio.

**Antes de tocar `.github/deploy-manifest.json`:** mostrar o diff pretendido ao
mantenedor. Dizer explicitamente se toca só comentário ou também `deploy_paths`,
`db_*`, `critical_routes` ou `health_containers` — o arquivo governa o deploy de
todos os módulos.

---

## 3. O que implementar agora

### 3.1 Requisito 27 — superfície de moderação no front (NOVO)

**Decisão do mantenedor, 2026-07-30.** Escrito em `spec.md` §27, `plan.md`
(bloco de arquitetura) e `tasks.md` (T4.16–T4.22, Fase 4).

**O buraco:** o desenho detalhou schema, transação e API, mas deixou o front com
duas linhas (`ui — lista, formulário, thread, central de notificações`). Isso
cobre quem **lê e escreve**, não quem **modera**.
`POST /internal/v1/comments/:id/removal` existia sem nenhuma tela que o
chamasse — o moderador teria o poder e nenhuma superfície.

**O que fazer** (detalhe nas tasks):

- **T4.16** — fila de moderação como superfície primária, com filtro por `realm`
  e `source_app`; beta nunca misturado com produção.
- **T4.17** — **reusar `packages/ui/src/admin`**: `AdminTable` (já tem seleção e
  ação em lote), `bulkActions`, `StatusPill`, `PageHeader`, `SectionCard`,
  `AdminWorkspaceLayout`. Em uso hoje no painel de gestão do `downloads`.
  Não criar padrão novo — divergir do design system exige aprovação.
- **T4.18** — seguir o padrão de dados de `apps/downloads/frontend/src/hooks/
  useModerationQueue.ts`: React Query, Zod na fronteira, ação individual e em
  lote, `invalidateQueries` no sucesso. Maduro desde as specs 075 e 083.
- **T4.19 / T4.19b** — **reversibilidade e auditoria**. O tombstone preserva o
  corpo, então desfazer é barato; faltava o caminho. A DSA exige janela de
  contestação de seis meses com reversão pronta de decisão injustificada — sem
  isso, erro de moderador é permanente. E existe `global_role_audit` para papel
  (`migration_002`) mas nada equivalente para conteúdo.
- **T4.20** — **conta nova tratada como conta nova**. Hoje conta criada há dez
  segundos comenta como quem está há dois anos; com login Google a barreira é
  baixa e essa é a porta de entrada de spam. Forma **mínima**, derivada de
  `users.created_at` + contagem de comentários, **sem tabela nova**: entra na
  fila para revisão e limite mais apertado no rate limiter de escrita. **Não é
  bloqueio de publicação** — é priorização de revisão.
- **T4.21 / T4.22** — usabilidade (Nielsen) e acessibilidade (WCAG 2.2) da fila.
  `ConfirmDialog` obrigatório em ação destrutiva **e em lote**.

**Fora de escopo, decisão do mantenedor:** shadow ban (contradiz o compromisso
de transparência da plataforma; quebra a confiança quando descoberto) e
moderação automática por IA (custo e falso positivo desproporcionais ao volume
atual). Voltam como spec própria se o volume mudar.

### 3.2 Correção do `emitNotification` (bug em produção)

`plan.md:111` registra: `apps/downloads/backend/src/routes/moderation.ts:138-147`
e `reports.ts:195` chamam `emitNotification` dentro de `try/catch` com só
`console.error` — a notificação falha em silêncio e o autor nunca sabe que o
material foi aprovado ou rejeitado. `downloads` está em produção desde
2026-07-30.

**Causa raiz, não sintoma.** "Solução mínima" é critério proibido para correção
de bug. Se a correção completa depender do modelo transacional de T0.13
(comentário e evento na mesma transação), coordenar as duas — não abafar o
`catch` sem resolver a entrega.

### 3.3 Alarme de drift do `accounts.` — T1.11–T1.13

Escopo ampliado em 2026-07-30. **Prioridade alta:** fecha o único alarme de
schema defasado do SSO, que hoje falha aberto (detalhe em §1).

- **T1.11** — `check_migration_drift.sh` falha fechado com diretório ausente.
  Implementado localmente. Não há flag de tolerância: o único runner
  incompatível é o do `site`, excluído nominalmente no workflow.
- **T1.12** — mesmo defeito em `apply_required_migrations.sh` (linhas 65-66).
  Análise reportada antes da decisão: o `site` dependia do fail-open porque o
  workflow chamava o runner padrão com `database`, apesar de usar runner próprio.
  Decisão aprovada: workflow pula o runner padrão só para `site`; runner falha
  fechado para os consumidores reais. Implementado; ramo ausente e `bash -n`
  verdes. T1.12 fechada.
- **T1.13** — provar cobertura do `accounts` em execução real, nas duas direções
  (disco à frente e banco à frente). Leitura de código não fecha esta task.

**Trava de conferência (decisão do mantenedor, 2026-07-30): mostrar o diff de
T1.11–T1.13 ao mantenedor antes de qualquer deploy.** Mesmo tratamento dado ao
`deploy-manifest.json`, e pelo mesmo motivo: estes arquivos governam o deploy dos
**seis** módulos com banco, não só a spec 090.

O risco não é local. Trocar fail-open por fail-closed muda **quando o deploy
aborta e faz rollback** — condição errada trava deploy de qualquer módulo, ou
deixa passar verde o que deveria falhar, justamente no script que é o único
alarme do SSO. Os bots de review do PR não cobrem isso: eles leem sintaxe e
padrão, não conhecem o E018 nem sabem o que este script protege.

**T1.13 é bloqueio de fase, não item de checklist.** T1.11 não conta como
fechada sem a execução real contra o banco. E014, E015 e E018 passariam todos na
validação estática — foi só rodando que apareceram.

Débito de unificação registrado em `tasks.md` (declarar diretório/coluna/glob no
manifesto, em vez de derivar por convenção) — spec própria, toca os 6 módulos.

### 3.4 Restante da Fase 1 e seguintes

T1.5–T1.10 conforme `tasks.md`, agora com escopo liberado nos consumidores.

---

## 4. Erros conhecidos que afetam esta spec

Consultados em `.specify/memory/errors.md`.

### E015 — o runner roda TODA migration dentro de `BEGIN; ... COMMIT;`

Independente da `@class`. Duas consequências:

1. **`CREATE INDEX CONCURRENTLY` é proibido** em qualquer migration que passe
   pelo runner — o Postgres recusa dentro de bloco de transação. Já abortou
   deploy de prod do `mesas` (`migration_146`, 2026-07-15).
2. **É o motivo de a 003 existir separada da 002** (ver §1).

### E018 — `apps/site` NÃO usa o runner do monorepo

Escopo ampliado inclui `apps/site/**`. Se a Fase 1 tocar migration lá, as regras
são **outras**:

| | runner padrão (`accounts`, `mesas`, `downloads`) | `apps/site` |
|---|---|---|
| Diretório | `apps/*/database/` | `apps/site/db/migrations/` |
| Glob | `migration_*.sql` | `NNN_*.sql` |
| Coluna da ledger | `migration_name` | `version` |
| Quem aplica | `apply_required_migrations.sh` | `docker-entrypoint.sh` do site |

**Armadilha histórica:** chamar `apply_required_migrations.sh` com `"database"`
no site fazia o runner sair verde. Foi essa saída falso-positiva que escondeu
`015`/`016` pendentes por 7 dias em beta E prod, com containers `Up (healthy)` o
tempo todo. Desde T1.12, o workflow pula o runner padrão para `site`, e diretório
ausente falha fechado nos consumidores dele.

Agravante: `site` tem `auto_deploy_on_push: false` — merge/promote **não**
deploya, e container existente segue rodando a imagem antiga.

### E016/E017 — Dockerfile de produção

Todo import novo de `@artificio/*` num app com Dockerfile de produção exige
conferir que o `COPY --from=builder .../dist` existe (e `dist-cjs` se o
`package.json` do pacote tiver `main`/`require`). Já quebrou duas vezes: CI
verde, container crashando com `MODULE_NOT_FOUND` direto em beta/prod.
**Relevante para `packages/comments`**, que é pacote novo consumido por três
apps.

---

## 5. Nota de processo

Em 2026-07-30 o agente recebeu a instrução "reporte a avaliação antes de decidir"
sobre o `VALIDATE`/E015, e decidiu e implementou sem consultar. O resultado
estava correto, então não houve dano — mas a instrução era de reportar.

Quando o handoff pede avaliação antes de decidir, isso vale mesmo quando a
resposta parece óbvia: o mantenedor está acompanhando por celular, via ponte
manual entre agentes, e precisa dos pontos de decisão explícitos para conseguir
verificar.

---

## 6. Travas de governança — valem em toda a spec

Fonte: `AGENTS.md`. Reproduzidas aqui por serem as que mais custam quando
esquecidas.

### Autorização

- **Autorização é por ação, nunca por sessão ou por PR.** Não acumula entre
  commits, pushes, merges ou deploys posteriores — nem em branch já pushada, nem
  no mesmo PR, nem para "ajustezinho" relacionado.
- **Sem commit, sem push, sem PR** sem o mantenedor nomear a ação ("commite",
  "faça push", "suba para dev"). Editar arquivo local dentro do escopo pedido
  não precisa de aprovação; commit/push/merge/deploy sempre precisam, a cada vez.
- **`git commit --amend` proibido, sem exceção.** Sempre commit novo.
- **Mensagem multi-linha de commit:** heredoc POSIX no Bash tool, here-string só
  na PowerShell tool — nunca misturar. Verificar com `git log -1 --format=%B`
  antes de declarar o commit pronto (erro de sintaxe cria commit corrompido com
  exit 0).
- **Nunca responder, comentar, resolver thread, reagir ou disparar bots** de
  review no PR (`@q`, `@codex`, `@coderabbit`, Snyk, Sonar). Resposta a revisor é
  sempre do mantenedor.
- **`git worktree`** (criar/mover/remover) exige aprovação nominal prévia.

### Migrations

- **Header obrigatório, 5 campos**, nas primeiras 20 linhas:
  `@class` (`online-safe` | `manual-risk`), `@requires-backup` (`true` exige
  `class=manual-risk`), `@author`, `@created`, `@description`. Sem isso o CI
  passa verde e o **deploy aborta na VM**.
- `online-safe` **não pode** conter DDL destrutivo (`DROP TABLE/COLUMN`,
  `TRUNCATE`, `DELETE FROM`) — só `manual-risk`.
- **Idempotência obrigatória:** roda 2x sem erro. `ADD CONSTRAINT` não aceita
  `IF NOT EXISTS` no Postgres 16 — envolver em `DO $$ ... END $$` checando
  `pg_constraint`.
- **Migration já aplicada nunca se reescreve.** Correção vem em migration nova.
- **Não fatiar** o schema de uma mesma feature em vários arquivos: tabelas que
  nascem juntas e dependem entre si são **uma migration só**. O guard
  `MAX_AUTO_PENDING=5` conta cada arquivo como uma pendente. (Exceção
  documentada: separação exigida por limitação do runner — ver §1.)
- Migration só em diretório allowlisted (`apps/*/database/`).

### Código

- **`pnpm verify:api` antes de montar o commit** (antes do `git add`, não depois)
  quando tocar `apps/**`, `packages/**`, `scripts/api/**` ou
  `docs/api/openapi/**`. O hook regenera artefatos — se só rodar no hook, eles
  ficam fora do commit.
- **Dockerfile de produção (E016/E017):** ver §4.
- **Normalização obrigatória:** todo dado de API/banco/JSON/JSONB/localStorage é
  `unknown` até passar por normalizador tipado. Proibido
  `.map/.filter/.reduce/.forEach`, spread de array ou `.length` sobre payload
  externo sem `Array.isArray`/schema/fallback.
- **Nunca mascarar erro:** proibido `@ts-ignore`, `eslint-disable`, `.skip`,
  `xfail`, `continue-on-error` para fazer passar.
- **Mismatch de tipo/teste introduzido pela própria edição é de quem editou
  corrigir** — nunca rotular como "pré-existente" para não mexer.
- **Comentário que documenta decisão não some** em edição posterior, nem por
  achado de bot de review. Se a razão mudar, reescrever para refletir a decisão
  nova, citando a origem (spec, débito, achado de review).

### Bug e débito

- **Todo bug achado é reporte obrigatório** — dentro ou fora do escopo. Parar,
  reportar ao mantenedor e **perguntar**: corrigir agora ou registrar como
  débito. Nunca decidir sozinho.
- Vale igual para achado de spec/investigação: **nunca** escrever "decisão do
  mantenedor" numa spec sem ele ter de fato respondido.
- Registro de débito vai **somente no destino que o mantenedor nomear**. Não
  abrir nem atualizar `project-state.md`, `decisions.md`, `backlog.md`, sessões
  ou `tasks.md` por conta própria.

### Ferramentas

- **`rtk` no lugar de comando cru.** Na raiz do monorepo:
  `rtk pnpm run lint`, `rtk pnpm run build`, `rtk pnpm run test`,
  `rtk pnpm verify:api`. `rtk lint` e `rtk tsc` **falham na raiz**
  (DEB-088-01) — dentro de um app funcionam.
- `rtk rg <padrão> <path>` para busca textual (`rtk grep` sem `-r` cai no grep
  nativo e falha); `rtk read <arquivo>`; `rtk git status|diff|log`.
- LSP primeiro para navegação estrutural (definição, referências, tipo);
  `rtk rg` para texto/padrão literal.
- **Português, caveman ultra** na comunicação com o mantenedor (T0.0c).

### Conclusão de tarefa

- Não declarar conclusão com "parcial", "restante", "maioria", "principais" ou
  percentual incompleto.
- Dry-run, plano ou documentação **não fecham** tarefa cujo aceite exige execução
  real.
- Não deixar dev server, preview ou processo auxiliar rodando ao final.
- Relatório final ao mantenedor segue o formato de `AGENTS.md` §Conclusão de
  Tarefas: resultado primeiro em uma linha, números de validação reais, o que foi
  corrigido agrupado por problema (não por arquivo), o que foi descartado e por
  quê, a decisão que mais precisa de conferência, achado lateral, bloqueio.

---

## 7. Árvore de trabalho

Modificados e **não commitados**:

- `AGENTS.md`
- `specs/089-downloads-parser-bugs/{plan,spec,tasks}.md`
- `specs/090-packages-comments-compartilhado/{plan,spec,tasks}.md` + este handoff
- `apps/accounts/**` e `packages/auth/**` (Fase 1 em curso)

**Decisão do mantenedor (2026-07-30): ficam onde estão e entram no mesmo commit
quando a Fase 1 estiver pronta.** Não separar, não reverter, não commitar antes.
Consistente com a regra de default de conteúdo de commit (`AGENTS.md` §PR,
Commit e Push): todo o diff entra, salvo exclusão explícita do mantenedor.

O commit em si continua exigindo autorização nominal própria, no momento em que
a Fase 1 fechar.
