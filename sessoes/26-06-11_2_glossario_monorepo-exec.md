# Sessão 26-06-11_2 — execução spec 012 (glossário → monorepo)

- **Data:** 2026-06-11 · **Módulo:** apps/glossario (novo) · **Gate:** D · **Spec:** `specs/012-glossario-monorepo/`
- **Objetivo:** T1–T4 locais (import, build, UI G1, deploy artifacts); T5+ (VM/deploy) com aprovação por ação.

## Plano
1. T1: robocopy legado → `apps/glossario` (excl. node_modules/dist/.venv/.git/*.key/.env) + renomear packages `@artificio/glossario-{frontend,backend}` + integrar pnpm/turbo.
2. T2: build + testes no monorepo.
3. T3: UI G1 (`@artificio/ui` Header/Footer/tokens + nav cross-módulo).
4. T4: composes padrão monorepo (rede `artificio_net`, containers glossario-* / glossario-beta-*) + `deploy-glossario.yml` via `_deploy-module.yml`.
5. T5–T10: tunnel, deploys, 301, nav compartilhado, decisão D0NN — cada write VM/push com aprovação.

## Estado (atualizado)
- [x] T1 import — backend (34 arq portados à mão) + frontend completo (robocopy) em `apps/glossario`. `@artificio/glossario-{frontend,backend}`, React 18→19, Dockerfiles multi-stage monorepo, composes `artificio_net`, `deploy-glossario.yml`.
- [x] T2 build — `turbo build @artificio/glossario*` **verde** (frontend 1580 módulos React19 + backend tsc). Legado sem testes automatizados.
- [x] T3 UI G1 (reuso, D058) — **`GlossarioHeader` compõe o `@artificio/ui` Header compartilhado** (não duplica chrome): nav domínio `defaultNavItems` + `userMenu` (admin/contribuição/perfil) + `actions` (changelog/+sugestão) + `sessionOverride` (auth legado) + `onLogout`/`onLoginClick`. Footer `@artificio/ui` dark. Header legado deletado. **Mudança aditiva no `packages/ui`** (`onLogout`/`onLoginClick`/`loginLabel`, default SSO) → **smoke mesas/accounts/site verde** (pétrea de shared satisfeita no build).
- [x] T4 deploy artifacts — composes + workflow criados.
- [ ] T5+ — VM/tunnel/301/deploy/prod = **aprovação por ação** (não iniciado).

## Falta (mecânico/aprovação)
- `apps/glossario/package.json` raiz (`@artificio/glossario`) p/ o filtro `@artificio/glossario*` do deploy casar (hoje só `-frontend`/`-backend`; build local usa wildcard, ok; conferir no workflow).
- lucide-react 0.363 peer warning (react<=18) — funciona no 19; bump opcional.
- Smoke visual do chrome no beta (Nielsen).
- T5+: rota tunnel `glossario.`, 301 `glossariorpg.`→`glossario.`, deploy beta→prod, nav compartilhado, desativar workflows do repo legado.
- **Nada commitado/pushado** (doc+código viajam juntos no 1º commit; push/deploy = aprovação).

## Achados de recon (p/ adaptação)
- Composes legados referenciam rede `gerenciador_telegram_default` (repo local stale; VM já roda `artificio_net` desde Fase 1) → composes novos.
- Frontend Dockerfile legado copia `dist` pré-buildado pelo Actions runner (rsync) → trocar p/ multi-stage build in-image (padrão monorepo git-pull D039).
- Backend: Express 5 + pg + bcrypt + jsonwebtoken (JWT custom legado — fica até spec 015), TS ^6.0.2, sem testes automatizados visíveis (confirmar).
- Frontend: React 18 + Vite 5 + Tailwind 3 + Fuse.js. Sem bump de major nesta spec (D054: bump = decisão à parte).
- nginx do app proxy `/api/` → `glossario-api:3000`.

## Commit/PR (2026-06-11)
- Branch `feat/glossario-monorepo`, commit `6a03111` (121 arq), **PR #14 → dev**.
- CI: **glossário verde**, deploy **skipped** (gated dispatch-only, bootstrap-safe), site/accounts verde.
- **mesas CI vermelho = PRÉ-EXISTENTE no dev** (provado em worktree limpo `origin/dev` + `--frozen-lockfile`): `apps/mesas/backend/src/routes/upload.ts:25` TS2769 — `@types/multer@2.1.0` traz tipos express-5 vs express-4 do mesas. **Não causado por este PR** (glossário/`packages/ui` inocentes). Task spawnada `task_a4c674e9` (SDD Lite, isolamento de módulo).
- Lockfile additive (só subtree do glossário; `packages/ui` change aditiva, default SSO).

## Deploy = BLOQUEADO em bootstrap da VM (mantenedor/segredo)
Glossário roda **vivo em prod** na VM (legado Fase 1). Deploy via dispatch precisa antes:
1. `.env.beta` (e `.env` prod) do glossário em `/opt/artificio[-beta]/apps/glossario/` com **`POSTGRES_PASSWORD` igual ao do volume existente** (`glossario[-beta]_pgdata*`, senão o postgres não sobe) + `JWT_SECRET`.
2. Rota Cloudflare `glossario.artificiorpg.com` → container `glossario[-beta]-app`.
3. Decisão de DB: novo compose reusa volume existente (nomes preservados) — confirmar senha do volume vivo (do `/opt/glossario*/.env` legado ou `secrets.7z`).
Depois: `gh workflow run deploy-glossario.yml -f mode=deploy` (beta primeiro). 301 + nav + prod = T7–T10.

## Review do PR #14 (Amazon Q + Codex) — corrigido
**Bloqueadores de deploy (Codex):**
- **E002** `nginx.conf.template` ausente (Dockerfile referenciava, não versionado) → criado.
- **E003** runner de migrations tentaria reaplicar 12 migrations no DB vivo → movidas p/ `database/legacy/` (runner no-op, D059).

**Segurança (Amazon Q):**
- JWT_SECRET fallback `'secret'` removido (authController + authMiddleware → throw se ausente).
- Admin email hardcoded → `process.env.ADMIN_EMAIL` (composes passam `ADMIN_EMAIL`).
- CORS `cors()` aberto → allowlist `*.artificiorpg.com` + localhost + `ALLOWED_ORIGINS` (same-origin via nginx; Bearer, sem credentials).
- Validação de input em `register`/`login`; fail-fast de `POSTGRES_PASSWORD` em `config/database.ts`.

Build glossário verde pós-fixes. **E004** (mesas express-4 vs `@types/multer@2`) documentado + **spec 016** (padronizar monorepo em express 5, D060) + task `task_a4c674e9`.

## Merge + push:dev (2026-06-11)
- **PR #14 rebase-merged → `dev`** (`a286f6b`/`f2d1308`). `promote-dev-to-main` verde (invariante `main ⊆ dev` ok). pr-checks verde.
- Push:dev redeployou betas (toque em `packages/ui`): **deploy-accounts ✓, deploy-site ✓** (mudança aditiva do Header validada no metal). **deploy-glossario = CI ✓ + deploy SKIPPED** (gated dispatch-only, bootstrap-safe).
- **deploy-mesas = FAILURE** (E004 pré-existente; aborta no CI build, não toca VM → mesasbeta intacto). Ficará vermelho a cada push:dev até a **spec 016** (express 5). Não-regressão deste trabalho.
- **Deploy real do glossário = pendente de bootstrap VM** (mantenedor): `.env.beta`/`.env` com `POSTGRES_PASSWORD` do volume vivo + `JWT_SECRET`(=accounts) + rota Cloudflare `glossario.` → depois `gh workflow run deploy-glossario.yml -f mode=deploy`.

## Critério de conclusão
Tasks T1–T10 da spec 012 fechadas com evidência; `project-state.md` atualizado.

## Retomada bootstrap BETA (2026-06-11)
- Mantenedor confirmou bootstrap read/write já executado na VM para o **primeiro deploy BETA** via `deploy-glossario.yml`: `/opt/artificio-beta` está em `dev`/`origin/dev` (`d38307d`) com `apps/glossario`; `/opt/artificio` segue em `main` e **não** tem `apps/glossario`, então PROD permanece bloqueado.
- Volumes legados a preservar: BETA `glossario-beta_pgdata_beta`; PROD `glossario_pgdata_prod`. Não apagar volumes, não dropar banco, não usar `docker compose down` global.
- `.env.beta` existe em `/opt/artificio-beta/apps/glossario/.env.beta` com permissão `600`; `POSTGRES_PASSWORD` igual ao segredo do volume legado beta e `JWT_SECRET` igual ao `apps/accounts/.env.beta` do mesmo clone. Segredos não devem ser impressos.
- Rota Cloudflare BETA criada: `glossariobeta.artificiorpg.com` -> `http://glossario-beta-app:80`; rota pública validada antes do deploy (`/` e `/api/terms` = 200). Não mexer em `glossariorpg.artificiorpg.com` neste bootstrap; 301 para `glossario.` fica para etapa posterior.
- Pendência antes de qualquer git/push/merge/deploy: atualizar documentação canônica do repositório com pré-requisitos, volumes, rotas Tunnel, ordem de deploy, caveat de login/JWT e observação de DNS Oracle.
- Documentação local atualizada nesta retomada: `README.md`, `apps/glossario/README.md`, `docs/agents/{deploy-runbook,deploy-flow,infra-map,github-actions-secrets,access-registry,context-capsule,roadmap}.md`, `specs/012-glossario-monorepo/{spec,plan,tasks}.md`, `project-state.md` e `sessoes/index.md`.

## Deploy BETA autorizado (2026-06-11)
- Mantenedor: "pode seguir" para `gh workflow run deploy-glossario.yml --ref dev -f mode=deploy` + smoke read-only.
- Escopo: BETA (`glossariobeta.`) apenas. PROD/301/`glossariorpg.` intocados.
- Run `27381628683` falhou antes de tocar containers: workflow dispatch em `dev` escolheu `env=prod` por bug no `deploy-glossario.yml` (`env` só tratava `push dev`). Erro: `apps/glossario/.env ausente na VM`; sem snapshot/down/build. Read-only pós-falha: containers glossário prod/beta seguem `Up 7 days`; `glossariobeta.` `/` e `/api/terms` seguem 200.
- Fix local preparado: `env` agora usa `github.ref == 'refs/heads/dev'` para beta também em `workflow_dispatch`.

## Investigação de workflows (2026-06-11)
- Mantenedor pediu pausar rerun e investigar todos os fluxos de workflow, consultando docs/histórico para qualquer coisa estranha. Sem commit/push/deploy.
- Inventário: `_deploy-module`, `_lint-shell`, `_enforce-migration-dir`, `pr-checks`, `guard-main-ancestor`, `promote-dev-to-main`, `promote-prod-fast-forward`, `break-glass-deploy-prod`, `deploy-{accounts,mesas,site,glossario}`, `docker-cleanup`.
- Contexto histórico: D039 = deploy GitHub-first; D041/spec 005 = `dev` beta + `main` prod, `push dev` auto beta por módulo quando habilitado, prod via promoção + dispatch; D044/D049 = `site` beta-only; D055/D056 = cleanup com lock RW VM-wide; CDX-310 = `deploy-accounts` ainda transicional.
- Achado A (bloqueador glossário): `deploy-glossario.yml` copiou seletor de env do `deploy-mesas` (`push dev` -> beta; dispatch -> prod). Isso contradiz spec 012/runbook para bootstrap, que exige `workflow_dispatch --ref dev` -> beta. Fix local certo: `github.ref == 'refs/heads/dev' ? beta : prod`.
- Achado B (intencional): `deploy-mesas.yml` dispatch -> prod é histórico CDX-309E; beta do mesas é auto em `push dev` (spec 005 T7). Não é bug para mesas.
- Achado C (intencional): `deploy-site.yml` hardcode `env: beta` por D044/D049; site não tem prod até Gate C.
- Achado D (dívida): deploy workflows path-filter não cobrem root `package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml`/`turbo.json`; já doeu no E004 e foi anotado no project-state. Risco: mudança de deps/root pode não disparar CI/deploy de módulo. Recomendação futura: adicionar root manifests aos path filters de `deploy-{mesas,glossario,site}`.
- Achado E (dívida aceita): `deploy-accounts.yml` é exceção/tarball, roda CI em push `feat/**`/`dev`/`main`, deploy só dispatch; documentado como transicional CDX-310.
- Achado F (atenção): `_deploy-module` valida `main ⊆ dev` em qualquer deploy, inclusive beta/break-glass; docs falam mais de gate prod. Hoje ok; se hotfix em `main` deixar dev atrás, beta também bloqueia.
- Achado G (atenção): `break-glass-deploy-prod` só cobre `mesas` e ainda passa pelo `_deploy-module`/invariante; serve como emergência rastreada, não ignora branch invariant.

## Deploy BETA — tentativa 2 e correção R1b (2026-06-11)
- Commit `b3e1fc3` pushado em `dev`; run `27382032090` passou lint/CI e entrou corretamente em `Deploy glossario beta`.
- Falha no compose: containers legados `glossario-beta-{app,api,db}` existem com `com.docker.compose.project=glossario-beta`, mas service labels antigas (`app-beta`/`api-beta`/`db-beta`) e workdir `/opt/artificio/glossario-beta`. O novo compose quer os mesmos `container_name`; Docker recusou criar `glossario-beta-db`.
- Isso é diferente da spec 009 R1 original: R1 remove leftover de **outro** project; aqui o project é igual e o service virou orphan.
- Fix local: `_deploy-module.yml` ganhou input opt-in `reconcile_same_project_orphans`; quando ligado, detecta nome esperado com mesmo project mas service ausente no compose novo e roda `docker compose ... down --remove-orphans` sem `-v` antes do primeiro `up` do DB. `deploy-glossario.yml` liga isso somente em `dev`/beta.
- Read-only pós-falha: legado beta/prod segue `Up`; nenhum volume removido.

## Deploy BETA — sucesso (2026-06-11)
- Commit `d410787` pushado em `dev`; run `27382386493` verde (`lint-shell` actionlint/ShellCheck, CI glossario, Deploy glossario beta).
- Resultado VM: `glossario-beta-app`, `glossario-beta-api`, `glossario-beta-db` recriados pelo monorepo, `project=glossario-beta`, services novos `glossario-beta-{app,api,db}`, rede `artificio_net`, todos `healthy`.
- Smoke público/read-only:
  - `https://glossariobeta.artificiorpg.com/` -> HTTP 200.
  - `https://glossariobeta.artificiorpg.com/api/terms` -> HTTP 200, 8785 termos.
  - Busca por termo real `Azure Sea` -> HTTP 200, 1 resultado.
  - `https://glossariobeta.artificiorpg.com/login` -> HTTP 200.
  - `docker exec glossario-beta-api ... /health` -> `{"status":"OK","message":"Backend v2 operacional!"}`.
- Não houve remoção de volume; `glossariorpg.` e PROD intocados. Login real com credencial ainda precisa validação manual do mantenedor/browser.
