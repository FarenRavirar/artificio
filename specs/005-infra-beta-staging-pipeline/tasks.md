# Tasks — 005

- [x] T1 — Abrir sessão/spec + registrar D041 · feito quando: `spec.md`/`plan.md`/`tasks.md` existem, D041 em `decisions.md`, sessão aponta o plano. *(D041 ✅; spec ✅)*
- [ ] T2 — Branch `dev` + branch protection · feito quando: `dev` existe a partir de `main`; `main` proíbe push direto e exige PR; `dev` exige CI verde. *(branch `dev` ✅; branch protection/rulesets bloqueados pelo GitHub em repo privado sem Pro — API 403; compensado por T3/T4 até plano/config permitir)*
- [x] T3 — Gate invariante `main ⊆ dev` · feito quando: step/workflow recusa deploy prod se `git merge-base --is-ancestor origin/main origin/dev` falhar; self-test cobre caso bloqueado e caso OK.
- [x] T4 — PR standing `dev→main` · feito quando: workflow cria/atualiza PR de promoção automaticamente a cada push em `dev`.
- [x] T5 — Parametrizar `_deploy-module.yml` com input `env` · feito quando: ref/dir/env_file/compose/containers/rotas derivam de `env`; `env=prod` renderiza script idêntico ao atual (não-regressão provada no CI).
- [x] T6 — `docker-compose.beta.yml` do mesas · feito quando: containers `mesas-beta-{api,app,db}`, rede `artificio_net`, DB+volume próprios, sem OAuth próprio, marca D040; build local OK. *(compose local não renderizado: Docker ausente no Windows; validar no Actions/VM)*
- [x] T7 — `deploy-mesas.yml` trigger beta · feito quando: push em `dev` path-filtered chama reusável `env=beta`; push só de outro módulo não dispara; prod segue em `main`/dispatch.
- [ ] T8 — Clone beta na VM · feito quando: `/opt/artificio-beta` é clone `dev` com deploy key read-only; `apps/mesas/.env.beta` presente; `apps/accounts/.env.beta` presente como anchor SSO explícito (mínimo `JWT_SECRET`, mesmo SSO, sem OAuth prod copiado); segredos fora do git. *(write VM — aprovação)*
- [ ] T9 — Cloudflare hostname beta · feito quando: `mesasbeta.artificiorpg.com` → `mesas-beta-app` no tunnel, resolve 200. *(aprovação)*
- [ ] T10 — Religar hydrate prod→beta · feito quando: `/sync/hydrate` portado com auth admin `@artificio/auth`, gate `NODE_ENV!=production`, `PROD_DB_URL` read; teste cobre 403 em prod e cópia OK em beta.
- [ ] T11 — 1º deploy beta real · feito quando: push em `dev` sobe `mesasbeta.` 200; prod 200 durante o deploy (E144 não viola); snapshot/health/smoke OK.
- [ ] T12 — E2E beta · feito quando: login accounts (sem `deleted_client`), rota privada 401→OK, logout limpam sessão.
- [ ] T13 — Validar não-regressão prod + docs · feito quando: deploy prod via `env=prod` inalterado; `deploy-accounts` segue verde; `project-state.md`/`roadmap.md`/AGENTS (alvo PR=dev) atualizados.
