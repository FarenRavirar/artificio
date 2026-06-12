# Tasks — 015

- [x] T1 — Levantar volume de usuários legados + emails não-Google (read-only no DB) · prod: total=38, non_google=5, with_hash=38, admins=2; beta: total=17, non_google=3, with_hash=17, admins=2. Sem PII/hashes.
- [x] T2 — Migration aditiva `sso_user_id` + índice `lower(email)` · `migration_13_sso_link.sql` (online-safe, aditiva, idempotente). Sem PG local → aplica no deploy (T7).
- [x] T3 — Backend: `verifyToken` + `resolveLocalUser` (link por sso_id → email → cria) + ownership/roles locais · **testes unit 4/4 verdes**; tsc limpo.
- [x] T4 — Backend: fluxo de reivindicação (`/api/migration/verify` + `/api/migration/claim`, rate-limit, merge transacional de FKs) · **testes unit 10/10 verdes** (verify ok/falha/sentinela/dummy cost; claim vincula/merge sentinel/idempotente/conflito; dedup de voto; bloqueia merge de duas contas legadas reais).
- [x] T5 — Backend: remover login de sessão/register legados (410; BCrypt só no verify) · implementado (410 routes; bcrypt só no /migration/verify). Smoke runtime no deploy (T7).
- [x] T6 — Frontend: `useSession`/`authFetch`, Header D043 com userMenu, telas legadas removidas + UI de migração · **build verde** (tsc + vite). api cookie+refresh-retry; AuthContext SSO; Login landing + aviso; `/migrar` (verify→Google→claim→confirmação); register→redirect; Bearer legado removido em 4 telas. E2E autenticado = T7 (precisa stack/SSO real).
- [x] T7 — [APROVAÇÃO] snapshot DB + migration + deploy beta · PRs #16/#17/#18 (+ #19 docs, #20 accounts login, #21 retorno SSO) em `dev`; deploy beta verde após fixes runtime Docker (`NODE_PATH`) + review. migration_13 aplicada (online-safe, snapshot auto). Smoke técnico beta verde (me=401, login/register=410, verify uniforme/429, DDL `sso_user_id`+índices). E2E mantenedor: login SSO + ownership OK no browser.
- [x] T8 — Smoke cross-módulo · sessão única provada: glossário logado → `mesas`/`accounts` sem re-login; prod `auth/google` 302→`accounts/login?return=mesas` (cookie `.artificiorpg.com`). Deploy do glossário não quebrou sessão dos outros módulos.
- [x] T9 — [APROVAÇÃO] promote prod + Gate D · promote `dev→main` (FF) + deploy prod glossario/accounts/mesas (2026-06-12); smoke prod verde (glossário 200/terms 200/me 401; accounts 200; mesas 200/options 401; **WP raiz 200 intocado**). **Gate D glossário FECHADO** pelo mantenedor. Decisão **D061** registrada (exceção do fluxo de migração por senha). Hotfix #22 (guards esperam sessão SSO) também em prod.

---

## ✅ CONCLUÍDA — 2026-06-12 (Gate D glossário fechado)

Spec 015 no ar em prod. SSO Google via `accounts.` é o único login do glossário; compat legado por email-linking + fluxo de reivindicação para contas não-Google.

- **Backend:** `resolveLocalUser` (sso_id→email→provisiona, preserva id legado/ownership), `authMiddleware` via `@artificio/auth verifyToken` (cookie/Bearer resiliente), `/api/migration/{verify,claim}` (BCrypt só no verify, anti-enum, rate-limit, merge transacional + dedup voto), login/register legados → 410. `packages/auth` intocado. Testes **14/14**.
- **Frontend:** api cookie+refresh-retry, AuthContext SSO, Login landing + aviso, `/migrar` (verify→Google→claim→herança), Bearer legado removido. Hotfix #22: guards de rota esperam a sessão resolver (não jogam logado p/ `/login`).
- **DB:** `migration_13_sso_link.sql` (aditiva, online-safe) aplicada em beta e prod (snapshot auto).
- **Decisão:** **D061** (exceção autorizada do fluxo de migração por senha; BCrypt residual só no `/verify`; limpeza futura da coluna).
- **Entrega:** PRs #16–#22; promote `dev→main` + deploy prod glossario/accounts/mesas; smoke prod verde; WP raiz intocado.
- **Follow-up (fora desta spec):** limpeza da coluna `password_hash` legada; E2E browser do cenário (b) com conta não-Google seedada (opcional — coberto por unit; baixo risco).

---

## Handoff de execução (VM/deploy/aprovação) — HISTÓRICO (mantido como referência/critério)

Seção histórica do plano de execução. Tudo abaixo foi executado; manter como referência de critérios de validação e rollback.

### H0 — Pré-condições (verificar antes de tudo)
- Código local verde: `pnpm --filter @artificio/glossario-backend test` (14/14), `pnpm --filter @artificio/glossario-backend build`, `pnpm --filter @artificio/glossario-frontend build`. Reproduzir antes de subir.
- Branch inicial já existiu/foi mergeada; próximos fixes devem sair de `dev` atualizado.
- `packages/*` intocados → smoke pós-deploy ainda exige mesas/accounts/site (sessão compartilhada).

### T1 — Contagem read-only (dimensiona o fluxo de reivindicação) [read-only, sem aprovação de write]
Rodar na VM (host `faren`/Oracle, somente SELECT):
```bash
ssh faren "docker exec glossario-db psql -U admin -d glossario_v2 -tAc \
  \"SELECT count(*) total, \
     count(*) FILTER (WHERE email !~* '@(gmail|googlemail)[.]com$') non_google, \
     count(*) FILTER (WHERE password_hash IS NOT NULL AND length(password_hash)>0) with_hash, \
     count(*) FILTER (WHERE role='admin') admins \
   FROM public.users;\""
```
Repetir trocando `glossario-db`→`glossario-beta-db` (project `glossario-beta`) p/ o beta. Registrar números na sessão `26-06-11_3`. Não imprimir nada além das contagens (sem PII/hashes).

### T7 — Snapshot + migration + deploy BETA [APROVAÇÃO: commit/push/PR/merge dev + deploy]
1. Commit + push da branch `feat/glossario-015-sso-compat`; abrir PR p/ `dev`. CI (`pr-checks`, actionlint/ShellCheck, builds, testes) verde. Merge p/ `dev` (aprovação explícita).
2. Deploy beta: `gh workflow run deploy-glossario.yml --ref dev -f mode=deploy`.
   - **Migration:** `migration_13_sso_link.sql` é `@class: online-safe` → o runner (`apply_required_migrations.sh`, dir `database/` maxdepth 1) aplica automático (é a única pendente; `MAX_AUTO_PENDING=5`). NÃO precisa `ALLOW_MANUAL_MIGRATIONS`. Snapshot do DB é criado pelo próprio `_deploy-module` antes da migration (confirmar no log `snapshot criado`). Conferir no log: `aplicando online-safe: migration_13_sso_link.sql` + `schema em conformidade`.
   - **Env beta (conferir, não recriar):** `JWT_SECRET` = accounts beta (`jwt_secret_shared=true`), `POSTGRES_PASSWORD` = volume legado, `ALLOWED_ORIGINS` cobre `*.artificiorpg.com`. Nenhum env novo nesta spec.
3. Smoke técnico beta (HTTP, read-only):
   - `GET https://glossariobeta.artificiorpg.com/api/auth/me` sem cookie → **401**.
   - `POST .../api/auth/login` e `.../api/auth/register` → **410**.
   - `POST .../api/migration/verify` com corpo inválido → **401** uniforme; repetir 6× mesmo IP+email → **429** (rate-limit).
   - DDL aplicada: `ssh faren "docker exec glossario-beta-db psql -U admin -d glossario_v2 -tAc \"\\d+ public.users\""` mostra coluna `sso_user_id` + índices `uq_users_sso_user_id`/`idx_users_lower_email`.
4. **E2E autenticado (mantenedor no browser; pré-requisito = conta de teste):**
   - (a) Conta legada com email-Google: logar via Google com o MESMO email de um `users.email` legado → herda (vê perfil, lista os próprios termos, edita um).
   - (b) Conta legada NÃO-Google: precisa de **credencial legada de teste conhecida** (email+senha BCrypt) presente no beta DB — mantenedor seedar/informar. Fluxo `/migrar`: senha antiga → `verify` → conectar Google → `claim` → herda termos/votos/comentários e edita termo próprio. Conferir no DB que `sso_user_id` foi gravado e o auto-provisionado (se houve) sumiu (merge).
   - Critério: ambos cenários OK + nenhum 500 nos logs `glossario-beta-api`.

### T8 — Smoke cross-módulo (sessão única) [browser, mantenedor]
Logado no glossário (Google), abrir `mesas.`/`site`(beta)/`accounts.` na mesma sessão sem re-login. Cookie `artificio_session` (`Domain=.artificiorpg.com`) vale em todos. Registrar evidência (prints/observações) na sessão. Auth é sagrado: confirmar que o deploy do glossário NÃO quebrou sessão dos outros módulos.

### T9 — Promote PROD + Gate D [APROVAÇÃO: promote/merge main + deploy prod]
1. **Código (não doc-only)** → NÃO usar fast-forward "só pra resolver": promover `dev→main` pelo fluxo normal (merge autorizado / `promote-prod-fast-forward.yml` só se o mantenedor autorizar explicitamente p/ este diff). Conferir `origin/main...origin/dev` antes.
2. Deploy prod: `gh workflow run deploy-glossario.yml --ref main -f mode=deploy`. Migration auto-aplica no `glossario-db` prod (online-safe; snapshot antes). Conferir health `glossario-{db,api,app}` + `/health`.
3. Smoke prod: `https://glossario.artificiorpg.com/api/auth/me` 401; `/login`,`/register` 410; `/api/terms` 200; coluna `sso_user_id` no `glossario-db`. WP raiz `artificiorpg.com` 200 intocado.
4. Re-smoke cross-módulo prod (mesas/accounts).
5. Fechar **Gate D glossário** com o mantenedor (aprovação registrada). Atualizar `project-state.md` + roadmap.
6. **Decisão a registrar em `decisions.md`:** exceção autorizada à pétrea Google-only — fluxo de migração por senha legada (endpoint `/api/migration/verify`, BCrypt residual só p/ migração; data da autorização 2026-06-11). Anotar limpeza futura da coluna de senha como follow-up.

### Rollback
- Migration aditiva: coluna fica (sem efeito) — não reverter schema.
- Código: revert do commit/merge; auth legado volta pelo histórico. Redeploy do ref anterior via `deploy-glossario.yml`.
- Deploy: snapshot/rollback do `_deploy-module` (restaurar dump pré-migration se necessário).

### Notas de segurança/edge (não esquecer)
- `audit_log` é append-only (trigger de imutabilidade) → NÃO é repontado no merge; FK `actor_id ON DELETE SET NULL` cobre. Vale só p/ auto-provisionado member (sem trilha admin). Se um auto-provisionado tiver `audit_log` (não deveria), o `claim` faz rollback limpo → merge manual (ferramenta futura, fora de escopo).
- `/api/migration/verify` nunca cria sessão; só emite `migration_token` (10min, escopo `glossario-migration`). `@artificio/auth verifyToken` rejeita esse token (sem email/name/role) → não vira login.
- Sessões legadas localStorage morrem no deploy (esperado): usuário re-loga via Google.
