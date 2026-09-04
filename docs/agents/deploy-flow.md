# Deploy Flow — Artifício RPG

> **Contrato único de deploy.** Se você vai tocar em `Dockerfile`, `migration_*.sql`,
> `pnpm-lock.yaml`, `package.json`, `.github/workflows/*` ou `.github/deploy-manifest.json`,
> a seção correspondente aqui é leitura obrigatória **antes** de editar.
>
> **Isso não depende de memória:** o hook `deploy-contract-gate`
> (`~/.claude/hooks/`, `PreToolUse` em `Edit`/`Write`) bloqueia a primeira edição
> de cada família na sessão e devolve no motivo qual seção ler. Existe porque as
> três recorrências desta base aconteceram **com o procedimento já documentado** —
> o que faltava era ler no momento certo, não escrever mais uma vez.
>
> Segredo nunca aqui. Deploy/código via GitHub Actions; VM manual só bootstrap,
> diagnóstico ou rollback aprovado.

Este arquivo consolida o que estava espalhado entre `AGENTS.md`, `errors.md`,
`deploy-runbook.md` e este próprio documento. **Os 22 erros registrados em
`errors.md` são 5 famílias de causa raiz**, e três delas já tiveram recorrência
justamente porque o procedimento vivia num arquivo e o incidente noutro — quem
lia um agia sem saber que faltava metade.

`errors.md` continua sendo o **histórico** (o que aconteceu, quando, com que
medição). Aqui fica a **regra** (o que fazer antes de agir). Cada seção cita os
incidentes que a originaram.

---

## Índice por ação

| Vou tocar em… | Leia | Família |
|---|---|---|
| `Dockerfile` de app | [§1 Imagem de produção](#1-imagem-de-produção) | A — [[E001]] [[E002]] [[E016]] [[E017]] [[E021]] |
| `pnpm-lock.yaml`, `package.json`, rodar `pnpm install` | [§2 Resolução de dependência](#2-resolução-de-dependência) | B — [[E004]] [[E008]] |
| `migration_*.sql`, schema, `database/` | [§3 Migration](#3-migration) | C — [[E003]] [[E010]] [[E011]] [[E012]] [[E014]] [[E015]] [[E018]] [[E020]] |
| DNS, tunnel, `.env`, credencial | [§4 Infra e borda](#4-infra-e-borda) | D — [[E005]] [[E006]] [[E007]] [[E009]] [[E013]] |
| Qualquer diagnóstico ou validação | [§5 Método](#5-método) | E — [[E019]] [[E022]] |
| Workflow, manifesto, promote | [§6 Fluxo e workflows](#6-fluxo-e-workflows) | — |

---

## Regra mãe

Se GitHub Actions cobre a ação, usar GitHub Actions.

VM direta (`ssh <VM_ALIAS>`) fica para: bootstrap inicial do clone `<CLONE_PROD>`;
instalar prereqs operacionais (`git`, `docker`, `docker compose`, `flock`,
`curl`, `jq`); diagnóstico read-only; rollback aprovado; ação excepcional que o
workflow ainda não cobre.

Não usar `scp`, tarball, bundle local ou `docker compose up/down` manual como
caminho normal de deploy.

---

## 1. Imagem de produção

**O padrão que se repete:** algo que o código precisa em runtime não chega na
imagem, e nada acusa até o container subir e crashar — em beta ou em produção.
Build e CI passam verdes: eles compilam o código, não montam a imagem final.

**Três recorrências, cada uma por um mecanismo diferente** — é por isso que
"conferir o `COPY`" não basta:

| incidente | o que faltava | por que o gate anterior não pegou |
|---|---|---|
| [[E002]] | arquivo não versionado (`nginx.conf.template`) | `COPY` de arquivo que o `.gitignore` excluía |
| [[E016]] | 5 erros encadeados no 1º deploy do `downloads` | Dockerfile escrito incrementalmente, nunca validado ponta a ponta |
| [[E017]] | `dist` de pacote workspace (`catalog-matching`) | gate lia `COPY`, e o pacote não estava lá |
| [[E021]] | **o `dist` estava lá; o store `.pnpm` é que foi podado** | gate cruzava só `COPY`, nunca `RUN pnpm install --prod --filter` |

[[E021]] derrubou o SSO por ~5 horas. O limite que ele explorou **já estava
escrito** em [[E017]] ("o gate lê `COPY` textualmente, então não cobre `RUN pnpm
install --prod --filter`") e ficou aberto.

**Gatilho mais comum:** acrescentar ou trocar um import `from '@artificio/<pacote>'`
num app que tem `Dockerfile` de produção (`apps/*/backend/Dockerfile`,
`apps/*/frontend/Dockerfile`). O sintoma em runtime é `MODULE_NOT_FOUND`, direto
em beta ou produção.

### Antes de editar qualquer `Dockerfile` de stage `production`

1. **Listar todo `@artificio/*` importado pelo `src` do app.** Import transitivo
   conta: em [[E021]] o pacote faltante não aparecia em nenhum import direto.
2. **Para cada um, confirmar `COPY --from=builder .../dist`** — e também
   `dist-cjs` se o `package.json` do pacote declarar `main`/`require`.
3. **Para cada `RUN pnpm install --prod --filter <pkg>`**, cruzar as
   `dependencies` reais de todo pacote cujo `dist` é copiado. Pacote com
   dependency própria precisa do **seu** `--filter`: sem ele, o `.pnpm` é podado
   e sobra symlink apontando para o vazio.
4. **Para cada `COPY <path>` sem `--from=builder`**, confirmar `git ls-files <path>`.
5. **Para cada `apt-get`/`apk`**, conferir contra a distro base que o gerenciador
   e os binários do `CMD`/healthcheck (`wget`, `curl`) existem nela.
6. **Se Docker Desktop estiver rodando:** `docker build --target production` local.

O gate `scripts/ci/check_dockerfile_workspace_deps.mjs` automatiza 1–3 e casa o
último `FROM` por posição (antes procurava `AS production` pelo nome, e por isso
**nunca havia conferido o `apps/accounts`**, cujos stages são `deps`/`build`/`runtime`).
`apt-get`/`apk` seguem fora do escopo dele — item 5 é manual.

---

## 2. Resolução de dependência

**O padrão:** mudar a resolução de dependências quebra um app que ninguém tocou.
Não há diff no código daquele app; o que mudou foi *qual versão* ele resolve.

| incidente | o que disparou | o que quebrou |
|---|---|---|
| [[E004]] | `@types/multer@2` | build do `mesas-backend` (express 4 vs tipos express 5) |
| [[E008]] | **regeneração de lockfile** (dependabot), não bump direto | `apps/site`: hoisting mudou, dois Vite majors no mesmo build |
| 2026-09-03 (spec 100) | **`pnpm install` sem flag** ao acrescentar dependência de workspace | `apps/site`: `@babel/core@7.29.7` removido do lock, teste quebrado no CI |

O caso de 2026-09-03 é o mais instrutivo porque o agente **negou a autoria com
convicção**: o diff de `apps/site/` era vazio, e ele concluiu daí que a PR não
tocava o site. Tocava — pelo `pnpm-lock.yaml`, que reescreveu 66 linhas de
resolução transitiva. Ver §5.

### Regras

- **`pnpm install` sem flag altera o lockfile do monorepo inteiro.** Não é
  comando de rotina: é mudança de escopo amplo que atinge os 7 apps sem tocar em
  arquivo de nenhum deles.
- **Ao acrescentar dependência de workspace, usar `pnpm install --lockfile-only`**
  e conferir o diff antes de sincronizar. Medido em 2026-09-03: `install` normal
  produziu **+15/−51 linhas** (com `@babel/core` removido); `--lockfile-only`
  produziu **+4/−0** — só o link novo.
- **Antes de commitar com o lock alterado: `git diff pnpm-lock.yaml`.** Remoção
  de entrada que não pertence ao seu escopo é sinal de **poda**, não de limpeza.
  Restaurar com `git checkout origin/dev -- pnpm-lock.yaml` e refazer.
- **Regeneração de lockfile pode reexpor combo latente de versões.** Quando o
  lock mudar de verdade (bump, dependabot, refresh), rodar o build completo —
  `turbo build --force` — e não só o do app que você estava mexendo.
- **Declarar a peer dependency que o app usa.** [[E008]] aconteceu porque
  `apps/site` não declarava `vite`, e a resolução dependia da topologia de
  hoisting. Vite 8 é **apenas** das SPAs React; o site Astro é Vite 7 por design
  (D084).

---

## 3. Migration

A maior família: 8 dos 22 incidentes. **Esta seção é autossuficiente** — tudo o
que é preciso para escrever, validar e aplicar uma migration está aqui, incluindo
o que antes vivia em `apps/mesas/migrations_guide.md`.

### Header — 5 campos obrigatórios

Valida `scripts/deploy/lib_migrations.sh:parse_header`. Sem isso o CI passa verde
e o deploy aborta na VM ([[E011]]):

```sql
-- @class: online-safe        # online-safe | manual-risk
-- @requires-backup: false    # true exige class=manual-risk
-- @author: spec-NNN
-- @created: AAAA-MM-DD
-- @description: ...
```

- `@migration: N` é decorativo — **não** conta como um dos 5.
- Lidos só nas **primeiras 20 linhas** — header no topo, antes do SQL.
- `@requires-backup: true` **exige** `@class: manual-risk`.
- Sintoma de header inválido na VM: `migration_*.sql falhou na validacao de campos do cabecalho` ([[E011]]).
- `online-safe` não pode conter DDL destrutivo de objeto (`DROP TABLE/COLUMN/...`,
  `TRUNCATE`, `DELETE FROM`) — só `manual-risk`. `DROP NOT NULL/CONSTRAINT/DEFAULT`
  são permitidos em `online-safe` ([[E010]], falso-positivo já corrigido).
- Migration só em `apps/*/database/` — `_enforce-migration-dir.yml` bloqueia fora.
- **Validar copiando o header do vizinho verde mais recente.**

### Template

```sql
-- @class: online-safe
-- @requires-backup: false
-- @author: spec-NNN
-- @created: 2026-04-21
-- @description: adiciona coluna foo

-- 1. Mudanças
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS foo TYPE DEFAULT 'value';
CREATE INDEX IF NOT EXISTS idx_name ON table_name(foo);

-- 2. Validação (opcional, recomendado): falha alto se a mudança não aconteceu
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_name' AND column_name = 'foo'
  ) THEN
    RAISE EXCEPTION 'Migration failed: column not created';
  END IF;
END $$;
```

### Idempotência

Toda migration roda 2× sem erro: `IF NOT EXISTS`/`IF EXISTS`. `ADD CONSTRAINT`
não aceita `IF NOT EXISTS` no Postgres 16 — envolver em `DO $$ ... END $$`
checando `pg_constraint`. Migration já aplicada que falhou pela metade: **nunca
reescrever o arquivo original**, criar migration nova de correção.

`CREATE INDEX CONCURRENTLY` não roda dentro de transaction ([[E015]]).

`ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)` não aceita `IF NOT EXISTS` e
estoura `42710 duplicate_object` na segunda execução. Forma idempotente:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nome_da_constraint'
      AND conrelid = 'nome_da_tabela'::regclass
  ) THEN
    ALTER TABLE nome_da_tabela ADD CONSTRAINT nome_da_constraint CHECK (regra) NOT VALID;
  END IF;
END $$;
```

`NOT VALID` evita varrer a tabela inteira no `ALTER`; validar depois, fora do
horário de pico, com `VALIDATE CONSTRAINT`. Antes de criar a constraint, medir
quantas linhas já a violam: `SELECT count(*) FROM tabela WHERE NOT (regra)` — se
houver, a migration precisa corrigi-las antes, ou o `VALIDATE` falha.

### Não fatiar o schema de uma mesma feature

Tabelas que nascem juntas na mesma sessão e dependem entre si são **uma
migration**. Fatiar não ajuda reversão (o guard conta cada arquivo) e multiplica
header para revisar.

### Guard `MAX_AUTO_PENDING=5` ([[E012]])

Deploy aborta com `Muitas migrations pendentes (N > 5)`. **Não é bug — é a
proteção funcionando**, e o rollback automático preserva o estado. Solução:
aplicar com o mesmo script oficial, ajustando o env para o total pendente (nunca
fatiar em lotes — o script compara tudo de uma vez):

```bash
cd <CLONE_BETA>   # ou <CLONE_PROD> em prod
cp apps/<modulo>/.env.<env> apps/<modulo>/.env
COMPOSE_PROJECT=<projeto> MAX_AUTO_PENDING=<N> \
  bash scripts/deploy/apply_required_migrations.sh \
  apps/<modulo>/docker-compose.<env>.yml <db-service> <db-name> <db-user> apps/<modulo>/database
rm -f apps/<modulo>/.env
```

`pg_dump` sempre antes, mesmo em banco "vazio".

### Checklist antes de commitar

**SQL:**
- [ ] Nome `migration_XXX_descricao.sql`, em `apps/<modulo>/database/` e só ali
- [ ] Header completo com os 5 campos, copiado do vizinho verde mais recente
- [ ] Todo comando com `IF NOT EXISTS`/`IF EXISTS` (ou `DO $$` para `ADD CONSTRAINT`)
- [ ] Default sensato para não quebrar insert antigo (`DEFAULT '{}'::jsonb`)
- [ ] Bloco de validação no fim (opcional, mas é o que faz a migration falhar alto)

**TypeScript, quando o schema muda:**
- [ ] Atualizar os arquivos de tipo do backend e do frontend
- [ ] Se alterou ENUM, `grep` por todas as instâncias nos dois lados — o tipo não
      acompanha sozinho, e o erro aparece só em runtime
- [ ] `npx tsc --noEmit` em `backend/` e `frontend/` (ou `rtk tsc -b` no app)

### Fluxo padrão

Criar `migration_XXX_descricao.sql` em `apps/<modulo>/database/` → commit/PR para
`dev` → CI valida header, diretório e drift → merge em `dev`/`main` aplica via
`apply_required_migrations.sh` antes de re-subir a aplicação. **Nunca aplicar
manualmente como primeira tentativa.**

### Emergência: `manual-risk` bloqueada ou drift `BLOCKED`

Acessar a VM só após aprovação nominal, seguir os gates de §1 e §3, e disparar com
`ALLOW_MANUAL_MIGRATIONS=true` (exige backup) quando for `manual-risk` legítima.
Reconciliar depois, como abaixo.

### Drift e reconciliação

Hotfix manual que altera schema fora do framework causa drift reverso e bloqueia
o próximo deploy. Depois de qualquer intervenção manual:

```bash
bash scripts/deploy/reconcile_migrations.sh --mark-applied migration_XXX_descricao.sql docker-compose.<env>.yml <db-service>
```

**`restore` reverte o repositório, não o schema** ([[E020]]): coluna aplicada em
produção continua lá depois de um restore do código. Ao investigar "coluna existe
em produção e em lugar nenhum do código", olhar o histórico de deploy, não só o git.

### Por módulo

`mesas` e `downloads` usam o framework padrão em `apps/<mod>/database/`. `site`
migra no entrypoint do container (`db/migrations/`) — e o guard de restart já
pulou o `pnpm run migrate` uma vez, deixando migration pendente indefinidamente
([[E018]]). `glossario` tem migrations legadas em `apps/glossario/database/legacy/`, fora
do glob do runner (no-op até baseline explícita). `accounts` migra in-container no boot, sem diretório próprio.

---

## 4. Infra e borda

- **DNS/tunnel de produção exige aprovação nominal**, inclusive a raiz
  `artificiorpg.com` (`CNAME` para `<TUNNEL_ID>.cfargotunnel.com` → container
  `<APP_CONTAINER>`). Antes de mexer, checar o registro real no painel: pode
  haver R2, MX ou outro registro conflitando com o nome ([[E005]]).
- **IP real atrás do tunnel** vem de header do Cloudflare, não do socket
  ([[E006]]). Confiar no header errado dá IP inconsistente ou forjável.
- **Segredo nunca em arquivo de diagnóstico, backup ou log** ([[E007]]). O push é
  bloqueado, e o segredo já vazou para o histórico local.
- **`POSTGRES_PASSWORD` só grava em `pg_authid` na primeira init do volume**
  ([[E009]]). Trocar no `.env` depois não reescreve nada; o sintoma é `28P01` em
  loop com `.env` "correto". `psql -h 127.0.0.1` engana (localhost é `trust`) —
  testar sempre pela rede docker. Sintoma: `28P01 password authentication failed`. Fix: DB vazio → recriar volume;
  DB com dado → `ALTER USER <DB_USER> PASSWORD '<senha do .env>'` + `docker restart`.
- **Nunca criar tunnel/container `cloudflared` paralelo.**
- **Contato público precisa ser contactável de fora** ([[E013]]): nome de exibição
  de servidor Discord não é endereço.

---

## 5. Método

Três incidentes de **processo do agente**, não de código. Entram aqui porque
custaram mais que os bugs.

- **[[E019]] — diagnóstico fechado no primeiro achado plausível**, sem consultar
  `errors.md` nem verificar a hipótese. A causa raiz do retrabalho não foi falta
  de processo documentado: foi não consultar o que já estava escrito.
- **[[E022]] — validação medida com o comando errado.** `tsc -p` num `tsconfig`
  só-referências compila **zero arquivo** e reporta verde. Comando que não mede
  nada é pior que comando não rodado: produz confiança falsa.
- **2026-09-03 — autoria negada sem medição.** O agente afirmou "a PR não toca
  `apps/site`" olhando o diff daquela pasta. Tocava, pelo lockfile. Bastaram
  três comandos para descobrir, depois da cobrança do mantenedor.

**A regra que os três compartilham:** antes de afirmar que algo *não* é seu,
medir o que **de fato** entra no diff — inclusive lockfile, artefato gerado e
configuração compartilhada. `git diff --name-only origin/dev...HEAD` lista o que
mudou; a pergunta seguinte é **quem consome cada um desses arquivos**.

E a assimetria que justifica o custo: o gate `--force` que não roda esconde a
falha para o próximo PR; a medição que falta transfere ao mantenedor uma decisão
tomada sobre informação errada.

---

## 6. Fluxo e workflows

### Fluxo normal

1. Desenvolver em `feat/*`, sempre a partir de `dev` atualizado.
2. Abrir PR para `dev` (ready for review, não draft).
3. `pr-checks.yml` roda: `_lint-shell.yml` (ShellCheck + actionlint) e
   `_enforce-migration-dir.yml` (SQL só em `apps/<modulo>/database/`).
4. `deploy.yml` roda CI em PR (matrix por módulo do `.github/deploy-manifest.json`),
   chamando `_deploy-module.yml` com `deploy=false`.
5. Merge para `dev` só após revisão; beta roda em `<CLONE_BETA>`.
6. Deploy real só por `workflow_dispatch` em `deploy.yml` (`module=<m>` +
   `mode=deploy`), ou por push em `dev` quando o manifesto permitir
   (`auto_deploy_on_push` + `deploy_paths`).
7. A VM faz `git fetch origin <branch> --tags` + `git reset --hard origin/<branch>`.
8. Workflow valida `.env`, `JWT_SECRET` compartilhado, DB, snapshot, migrations,
   build, health e smoke.
9. Falha aciona rollback por snapshot + `docker compose up -d`.

### Trava pétrea — promote não deploya

`promote-prod-fast-forward.yml` **só move o ponteiro Git** (`main` fast-forward
para `dev`). Não chama `deploy.yml`, não builda, não sobe container.

**Produção só atualiza com dispatch manual explícito:**

```bash
gh workflow run deploy.yml --ref main -f module=<modulo> -f mode=deploy -f env=prod
```

Depois de qualquer promote aprovado, **nunca declarar "em produção" sem também
disparar e confirmar esse deploy**. Git atualizado ≠ prod atualizado. Verificar
com `gh run list --workflow=deploy.yml --branch=main --limit=5`.

### `deploy.yml` só deploya se `deploy_paths` mudar

Docs, specs e governança nunca disparam deploy real — CI roda, `deploy=false`.
Conferir com `gh run view <RUN_ID> --log | grep "deploy="`.

### Workflows

| Workflow | Papel | Deploy real |
|---|---|---|
| `pr-checks.yml` | Gate de PR: shell/workflow lint + contrato migration | Nunca |
| `_lint-shell.yml` | Reutilizável: ShellCheck + actionlint | Nunca |
| `_enforce-migration-dir.yml` | Reutilizável: bloqueia `.sql` fora de `apps/*/database/` | Nunca |
| `_deploy-module.yml` | Reutilizável: CI + deploy parametrizado | Só com `deploy=true` |
| `deploy.yml` | Workflow único declarativo (spec 026 F4/F5); lê o manifesto e roda matrix | `workflow_dispatch`, ou push gated pelo manifesto |
| `.github/deploy-manifest.json` | Manifesto declarativo. Adicionar módulo = 1 entrada, sem novo workflow | n/a (dado) |
| `break-glass-deploy-prod.yml` | Emergência rastreada; chama `_deploy-module.yml` direto | Só `workflow_dispatch` com `BREAK_GLASS` |

Path-filters raiz (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
`turbo.json`) já cobertos no `deploy.yml` consolidado. O gating fino por módulo
vem do manifesto (`deploy_paths`).

### Casos por módulo

**`glossario`** — preserva volumes legados: beta em `<CLONE_BETA>` (branch
`dev`, project `glossario-beta`, volume `glossario-beta_pgdata_beta`); prod em
`<CLONE_PROD>` (branch `main`, project `glossario`, volume
`glossario_pgdata_prod`). O manifesto tem `reconcile_same_project_orphans: true`
porque o legado reusa o mesmo compose project com service labels antigas. Não
deployar prod enquanto `origin/main` não contiver `apps/glossario`.

**`accounts`** — **PROD-only** (D042). Não existe `accountsbeta`; o beta dos
outros módulos reusa o `accounts` de produção. No manifesto: `env_override: "prod"`
+ `auto_deploy_on_push: false`. O `build-matrix` **bloqueia** dispatch `env=beta`
com erro explícito, em vez de subir um `accountsbeta` sem OAuth. Consequência:
num deploy beta da leva, accounts fica de fora.

---

## Bootstrap VM

Clone inicial em `<CLONE_PROD>` (prod) e `<CLONE_BETA>` (beta). Prereqs:
`git`, `docker`, `docker compose`, `flock`, `curl`, `jq`. Detalhe operacional em
`deploy-runbook.md`.

**Nunca desligar, reiniciar ou suspender a VM Oracle** — nem por comando, nem
pelo painel. Ela hospeda produção inteira; quem religa é o mantenedor,
manualmente. "Desligar a máquina" sempre se refere ao Windows local.

---

## Redundâncias conhecidas

- `deploy-runbook.md` (40K) mantém o detalhe operacional por módulo e os
  comandos de diagnóstico. Este arquivo é o contrato; lá é o manual.
- `apps/mesas/migrations_guide.md` é a referência canônica do framework de
  migration. §3 aqui é o resumo que impede o deploy de abortar.
- `apps/mesas/PRE_DEPLOY_CHECKLIST.md` **foi deletado** do repositório em algum
  ponto do histórico, mas o `AGENTS.md` seguia mandando "seguir os gates de
  `PRE_DEPLOY_CHECKLIST.md`" no procedimento de emergência de migration —
  referência morta, apontando para arquivo inexistente. Descoberto na
  consolidação de 2026-09-03; a citação saiu do `AGENTS.md` e os gates que ele
  descrevia estão em §1 e §3 deste arquivo.
