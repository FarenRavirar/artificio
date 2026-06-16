# 026 — Auditoria e Consolidação da Esteira de Workflows (CI/CD)
- **Modulo/Pacote:** infra (`.github/workflows/*`, `scripts/deploy/*`, `scripts/ci/*`)
- **Gate relacionado:** D (esteira por modulo) — sem cutover de Gate C/WP

## Problema

A esteira de CI/CD cresceu por correcoes pontuais ("sempre aplicar fix") e ficou
**bagunçada, lenta e sujeita a erro**. Sintomas concretos, todos com evidencia:

1. **Redundancia estrutural** — `deploy-mesas.yml`, `deploy-glossario.yml` e
   `deploy-site.yml` sao quase-clones: mesmo `on:` (PR/push/dispatch), mesmo bloco
   de `paths:`, mesma chamada `lint-shell` + `_deploy-module`. Mudar o padrao exige
   editar N arquivos; cada modulo futuro (`downloads`/`esferas`/`srd`/`links`) =
   copiar mais um snowflake. Multiplica superficie de erro.
2. **Logica de ambiente replicada** — `env: ${{ github.ref == 'refs/heads/dev' && 'beta' || 'prod' }}`
   esta copiado em cada workflow. Cada copia pode driftar. Ja mordeu:
   `BL-DEP-MESAS-DISPATCH-ENV` — `workflow_dispatch` em `dev` calculou `prod` e
   recriou `mesas` prod a partir de `origin/main` (run `27629745457`, sessao
   `26-06-16_9`). Fix local existe so no `deploy-mesas.yml`, nao centralizado.
3. **Snowflake `accounts`** — `deploy-accounts.yml` NAO usa `_deploy-module.yml`:
   empacota tarball + `scp` + `docker compose` manual, sem snapshot/rollback, sem
   framework de migration, com smoke proprio. E o `apps/accounts/docker-compose.prod.yml`
   e shim operacional, nao arquivo versionado correto (`BL-CDX-310`). E o servico SSO,
   o mais sensivel, rodando na esteira menos blindada.
4. **Lint duplicado** — `_lint-shell.yml` roda em `pr-checks.yml` E em cada
   `deploy-*.yml` (doc `deploy-flow.md` admite "redundancia aceita"). Gasta minutos
   de CI por push.
5. **Cobertura de path incompleta** — os `paths:` de deploy nao cobrem manifests raiz
   (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`). Mudanca de
   dependencia pode escapar do CI/deploy de modulo (`BL-DEP-PATHFILTERS`, classe E004).
6. **Superficie de seguranca** — `apps/accounts` publica `ports: "3000:3000"`
   (`BL-ACCOUNTS-PORT`); actions sem pin de SHA (`ludeeus/action-shellcheck@master`,
   `reviewdog/action-actionlint@v1`); `secrets: inherit` propaga tudo aos reusaveis;
   cron `mesas-auto-archive` bate endpoint publico e leva Cloudflare 403/challenge
   (`BL-MESAS-AUTO-ARCHIVE-CF`, run `27607245699`).
7. **Legado residual** — scripts `apps/mesas/scripts/deploy/*` ainda presentes apos
   `_deploy-module` virar fonte unica (`BL-DEP-MESAS-LEGACY-SCRIPTS`).
8. **"Atualizar aplicativos" sem trilho** — update de apt/Node/pnpm/imagens Docker/deps
   npm (`D-DEP2`) e migracao Express 5 (`D-DEP1`/`BL-MESAS-EXPRESS5-016`) nao tem fluxo
   sistematico; cada atualizacao vira fix manual ad hoc.

**Esta spec, nesta fatia, e SO LEVANTAMENTO/AUDITORIA — sem chute, sem mexer em
workflow.** Decisao do mantenedor (2026-06-16): primeiro investigar e documentar a
direcao-alvo; implementacao vai em fatias proprias, cada uma aprovada nominalmente.

## Requisitos (numerados, testaveis)

1. **Inventario verificado** da esteira: cada workflow ativo em `.github/workflows/`
   listado com papel, triggers, se faz deploy real, reuso (`workflow_call`) e snowflakes.
2. **Mapa de redundancia** que aponte, por arquivo, o que e copia/replica e o que e
   unico, com o custo de manutencao (quantos arquivos mudam por tipo de alteracao).
3. **Mapa de seguranca** com cada debito (porta exposta, action sem pin, `secrets:
   inherit`, cron via WAF, escopo de `permissions:`) e severidade.
4. **Direcao-alvo registrada** (decisao do mantenedor, ainda nao implementada):
   - `accounts` migra para `_deploy-module.yml` + compose versionado (`BL-CDX-310`);
   - `deploy-*.yml` consolidam em **manifesto declarativo + 1 workflow matrix**
     (adicionar modulo = 1 entrada no manifesto, sem novo arquivo).
5. **Roadmap priorizado** de fatias de implementacao, cada uma com: pre-condicao de
   aprovacao, blast radius, smoke minimo e rollback. Nenhuma fatia executa nesta spec.
6a. **Limpeza do cache que acumula no deploy (F10).** Pedido do mantenedor: "max, limpar
   no proprio workflow". Inspecao read-only na VM (2026-06-16, Docker 29.5.3) corrigiu o
   alvo: imagens NAO acumulam (1 tagueada por repo, tag movel `:latest`, `dangling=0` ja
   que `image prune -f` roda). O que enche disco e o **build cache** (~20GB reclaimable,
   <7d, sobrevivia ao filtro `until=168h`). Como o deploy builda com `--no-cache --pull`, o
   cache de build **nunca e reusado** => 100% descartavel. Requisito: `_deploy-module.yml`
   faz **`docker builder prune -f` total pos-deploy** (sem filtro de idade) e o semanal
   `docker-cleanup.yml` idem (rede de seguranca). O cap "max 2 imagens/repo" foi
   investigado e DESCARTADO por ser no-op no naming atual — sem codigo morto.
6. **Reconciliacao de backlog** — cada debito de infra ja existente
   (`BL-CDX-310`, `BL-ACCOUNTS-PORT`, `BL-DEP-PATHFILTERS`, `BL-DEP-MESAS-DISPATCH-ENV`,
   `BL-DEP-MESAS-LEGACY-SCRIPTS`, `BL-MESAS-AUTO-ARCHIVE-CF`, `BL-DEP-CONTAINER-NAMES`,
   `D-DEP1`, `D-DEP2`) mapeado a uma fatia do roadmap ou marcado fora de escopo.

## Criterios de aceite

1. `spec.md`/`plan.md`/`tasks.md` da 026 existem e descrevem inventario, redundancia,
   seguranca, direcao-alvo e roadmap, **sem nenhuma alteracao em `.github/workflows/*`**.
2. Todo achado tem evidencia rastreavel (arquivo:linha, run ID, decisao `D###` ou item
   `BL-*`/`D-*`). Sem afirmacao "no chute".
3. O roadmap de fatias mapeia 1:1 os debitos de infra do `specs/backlog.md`; nenhum fica
   orfao nem duplicado.
3a. F10 (limpeza de build cache) implementado: `_deploy-module.yml` e `docker-cleanup.yml`
   fazem `docker builder prune -f` total; o cap de imagem por repo foi descartado por
   no-op, sem deixar codigo morto.
4. `specs/backlog.md`, `sessoes/index.md` e `project-state.md` refletem a spec 026 aberta
   como auditoria.
5. Nenhuma fatia de implementacao foi executada; nenhum commit/push/deploy feito.

## Fora de escopo (desta fatia)

- Editar qualquer arquivo em `.github/workflows/`, `scripts/deploy/`, `scripts/ci/`.
- Qualquer commit, push, PR, merge, `workflow_dispatch`, deploy beta/prod.
- Tocar WordPress raiz, DNS, tunnel, Gate C.
- Implementar manifesto/matrix, migrar `accounts`, mexer em `ports`/`expose`, pinar
  actions — tudo isso e fatia futura aprovada, nao esta fatia.
- Executar os updates de app/dependencia (`D-DEP1`/`D-DEP2`/Express 5) — viram specs
  proprias referenciadas, nao implementadas aqui.

## Riscos e impacto em outros modulos

- **Auth e sagrado:** qualquer fatia futura que toque `accounts`/`_deploy-module` exige
  SDD Completo + smoke `login/me/logout` + allowlist de retorno. A auditoria nao mexe em
  auth, mas o roadmap deve carimbar esse risco em toda fatia que tocar SSO.
- **Disparo indevido de deploy:** mexer em `deploy-*.yml`/`paths:` pode disparar betas
  existentes. Por isso a consolidacao matrix e fatia isolada, validada por dispatch
  controlado, nunca junto de outra mudanca.
- **Regressao silenciosa por path-filter:** ao fechar `BL-DEP-PATHFILTERS`, ampliar
  `paths:` demais pode disparar deploy de todo modulo a cada bump de lock; a fatia precisa
  equilibrar cobertura x ruido.
- **Cron/WAF:** mover o `mesas-auto-archive` para caminho interno seguro toca contrato de
  ingress (spec 023) e Cloudflare; nao alterar WAF/DNS sem aprovacao nominal.
