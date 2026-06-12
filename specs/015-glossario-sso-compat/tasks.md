# Tasks — 015

- [x] T1 — Levantar volume de usuários legados + emails não-Google (read-only no DB) · prod: total=38, non_google=5, with_hash=38, admins=2; beta: total=17, non_google=3, with_hash=17, admins=2. Sem PII/hashes.
- [x] T2 — Migration aditiva `sso_user_id` + índice `lower(email)` · `migration_13_sso_link.sql` (online-safe, aditiva, idempotente). Sem PG local → aplica no deploy (T7).
- [x] T3 — Backend: `verifyToken` + `resolveLocalUser` (link por sso_id → email → cria) + ownership/roles locais · **testes unit 4/4 verdes**; tsc limpo.
- [x] T4 — Backend: fluxo de reivindicação (`/api/migration/verify` + `/api/migration/claim`, rate-limit, merge transacional de FKs) · **testes unit 9/9 verdes** (verify ok/falha/sentinela; claim vincula/merge/idempotente/conflito; dedup de voto).
- [x] T5 — Backend: remover login de sessão/register legados (410; BCrypt só no verify) · implementado (410 routes; bcrypt só no /migration/verify). Smoke runtime no deploy (T7).
- [x] T6 — Frontend: `useSession`/`authFetch`, Header D043 com userMenu, telas legadas removidas + UI de migração · **build verde** (tsc + vite). api cookie+refresh-retry; AuthContext SSO; Login landing + aviso; `/migrar` (verify→Google→claim→confirmação); register→redirect; Bearer legado removido em 4 telas. E2E autenticado = T7 (precisa stack/SSO real).
- [ ] T7 — [APROVAÇÃO] snapshot DB + migration + deploy beta · feito quando: beta verde; E2E (a) conta legada email-Google→login direto herda; (b) conta legada não-Google→reivindicação→Google herda e edita termo próprio.
- [ ] T8 — Smoke cross-módulo (glossário/mesas/site/accounts no browser, sessão única) · feito quando: evidência na sessão.
- [ ] T9 — [APROVAÇÃO] promote prod + smoke + fechar Gate D glossário c/ mantenedor · feito quando: aprovação registrada; `project-state.md`/roadmap/decisions atualizados (registrar exceção autorizada do fluxo de migração por senha).

---

## Handoff de execução bloqueada (VM/deploy/aprovação) — p/ Codex

Tudo abaixo precisa de acesso à VM e/ou aprovação por ação (pétreas de AGENTS.md: commit/push/merge/deploy/comando-write-VM = aprovação explícita a cada vez). Código de T2–T6 está pronto e verde no working tree (branch a criar). Nada commitado/pushado ainda.

### H0 — Pré-condições (verificar antes de tudo)
- Código local verde: `pnpm --filter @artificio/glossario-backend test` (13/13), `pnpm --filter @artificio/glossario-backend build`, `pnpm --filter @artificio/glossario-frontend build`. Reproduzir antes de subir.
- Branch ainda não existe. Criar `feat/glossario-015-sso-compat` a partir de `dev`.
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
