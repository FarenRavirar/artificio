# Sessão 26-06-11_3 — Glossário: SSO (accounts) + compat do login legado

- **Data:** 2026-06-11
- **Módulo:** apps/glossario (+ migration DB glossario_v2; consome `@artificio/auth` sem alterar pacote)
- **Gate:** D (fecha Gate D do glossário)
- **Spec:** `specs/015-glossario-sso-compat/` (spec.md / plan.md / tasks.md)
- **Nível SDD:** Completo (auth/SSO + migration + dados pessoais)

## Vínculos
- Depende: spec 012 (glossário no monorepo, no ar PROD+BETA).
- Pétrea: Google OAuth via `accounts.` é o único login (D018). `packages/auth` intocado (auth sagrado).
- Exceção autorizada (mantenedor, 2026-06-11): fluxo de reivindicação por senha legada — registrar em decisions no T9.

## Estado inicial (levantado)
- Backend express 5, auth legado via `Authorization: Bearer` + JWT custom `{id,role}` (`authMiddleware.ts`/`authController.ts`). Sem `@artificio/auth`/`cookie-parser`/test runner.
- `@artificio/auth verifyToken(token)` → `Session{user:{id=sub,email,name,role:'user'|'admin'},exp}`; lê cookie `artificio_session` ou Bearer. Padrão mesas em `apps/mesas/backend/src/middleware/auth.ts`.
- `users.id` uuid. FKs→users(id): terms.added_by/reviewed_by, term_votes.user_id, term_comments.user_id, systems.created_by, scenarios.created_by, update_log.created_by, term_history.changed_by, audit_log.actor_id, user_notifications.user_id/actor_id.
- Migration runner: `apps/glossario/database/migration_*.sql` (maxdepth 1), header `@class/@requires-backup/@author/@created/@description`; legacy em `database/legacy/` (ignorado).

## Plano de execução (tasks.md)
- T1 — contar usuários legados + emails não-Google (read-only DB). Precisa VM (`ssh faren` SELECT) — read-only permitido.
- T2 — migration aditiva `sso_user_id` + índice `lower(email)`. Local/scratch, idempotente.
- T3 — `resolveLocalUser` + middleware `@artificio/auth verifyToken` + ownership/roles. Testes unit (4 cenários).
- T4 — fluxo reivindicação (`/api/migration/verify` + `/claim`, rate-limit, merge FKs transacional). Testes unit.
- T5 — desativar login sessão/register legados (410; BCrypt só no verify). Smoke 410/401.
- T6 — frontend `useSession`/`authFetch`, Header D043, telas legadas fora + UI migração. Build verde.
- T7 — [APROVAÇÃO] snapshot + migration + deploy beta.
- T8 — smoke cross-módulo.
- T9 — [APROVAÇÃO] promote prod + fechar Gate D + decisions.

## Checklist de fechamento
- [x] T1 números na sessão — SELECT read-only em `faren`, sem PII/hashes: prod `total=38 non_google=5 with_hash=38 admins=2`; beta `total=17 non_google=3 with_hash=17 admins=2`.
- [~] T2 migration escrita (`migration_13_sso_link.sql`, online-safe, aditiva, idempotente). Falta rodar em PG (sem PG local) — aplica no deploy/T7.
- [x] T3 testes verdes (4 cenários) + tsc limpo
- [x] T4 testes verdes (verify ok/falha/sentinela; claim vincula/merge/idempotente/conflito) — 9 testes
- [~] T5 410 implementado (login/register → 410; BCrypt só no verify). Smoke runtime no deploy/T7.
- [x] T6 build verde (tsc + vite). Fluxo local autenticado = T7 (precisa stack/SSO)
- [ ] T7/T9 aprovação registrada
- [ ] T8 evidência cross-módulo
- [ ] project-state.md atualizado

## Log
- 2026-06-11 — Sessão aberta. T0 lido (project-state/AGENTS pétreas/spec+plan+tasks). Levantamento de auth/schema/runner concluído.
- 2026-06-11 — **T2 escrita:** `apps/glossario/database/migration_13_sso_link.sql` — `ADD COLUMN IF NOT EXISTS sso_user_id TEXT` + índice único parcial `uq_users_sso_user_id` + `idx_users_lower_email` + check de pós-condição. online-safe/requires-backup=false; aditiva e idempotente. Runner aplica de `database/` (maxdepth 1; legacy ignorado). Sem PG local → roda no deploy (T7).
- 2026-06-11 — **T3 entregue + verde:** `src/auth/resolveLocalUser.ts` (executor injetável; ordem sso_user_id→email-lower→provisiona; preserva id legado; senha sentinela `!sso-no-password`; corrida protegida pelo índice único). `authMiddleware` trocado p/ `@artificio/auth verifyToken` (cookie `artificio_session` ou Bearer) + resolve user local; `is_global_admin` (token.role==='admin') não rebaixado por `refreshUserRole`; `adminMiddleware` passa global admin direto. `cookie-parser` montado no `index.ts`. Deps add: `@artificio/auth`, `cookie-parser`, `express-rate-limit`(p/ T4), `vitest`, `@types/cookie-parser`. `req.user.id` segue = users.id legado → controllers/ownership/refreshUserRole intactos. Testes `resolveLocalUser.test.ts` **4/4 verdes** (sso/email/provisiona/case-insensitive); `tsc` limpo; tsconfig exclui `*.test.ts`. `packages/auth` intocado.
- 2026-06-11 — **T4 entregue + verde:** `/api/migration/verify` + `/api/migration/claim`. `migrationToken.ts` (JWT escopo `glossario-migration`, sub=legacy id, 10min; verifyToken do auth o rejeita). `migrationController.runVerify` (lookup lower(email)+sso_user_id NULL, BCrypt, dummy-hash anti-timing, resposta uniforme, sentinela nunca migra) + `runClaim` (transacional FOR UPDATE; vincula sso+email Google; idempotente; 409 conflito; funde auto-provisionado). `mergeUsers.ts` (dedup voto mais-recente + repoint 11 FKs antes de apagar auto; audit_log pulado por imutabilidade → FK SET NULL). `express-rate-limit` no /verify (IP+email, 5/15min). `trust proxy 1` no index. Testes `migrationController.test.ts` **9/9 verdes**.
- 2026-06-11 — **T5 entregue:** `authController` → só `gone` (410) + `getMe`; bcrypt/jwt/register/login removidos (BCrypt só no `/migration/verify`). `authRoutes` login/register → 410; `/me` via authMiddleware SSO. tsc limpo. Total testes backend **13/13**.
- 2026-06-11 — **T6 entregue + build verde (tsc + vite, 1581 módulos):** `services/api.ts` (withCredentials + interceptor 401→refreshSession→retry, sem Bearer/localStorage); `AuthContext` SSO (carrega `/auth/me` por cookie; `login`=redirectToLogin accounts; `logout`=ssoLogout; +`refresh()`); `Login` = landing "Entrar com Google" + aviso "email não-Google? entre por aqui" → `/migrar`; `MigrationPage` (`/migrar`): verify(senha antiga)→sessionStorage migration_token→conectar Google(redirectToLogin return=/migrar)→claim→confirmação de herança, com auto-claim ao voltar do Google; `Register`→redirect `/login`; rota `/migrar` no App. **Bearer legado removido** em AddTermModal/AdminUsers/AdminReview/AdminStructure (sessão agora por cookie). Middleware backend ficou resiliente: tenta Bearer→cai pro cookie (um `Bearer null` legado não bloqueia cookie válido); rebuild+13/13 testes verdes.
- **Backend T2–T5 + Frontend T6 = código completo, builds/testes verdes. Só `apps/glossario` tocado; `packages/*` intocados (isolamento OK).**
- **PENDENTE:** T1 (aprovação read-only prod — mantenedor); T7 [APROVAÇÃO] (snapshot + migration + deploy beta + E2E); T8 (smoke cross-módulo); T9 [APROVAÇÃO] (promote prod + Gate D + decisions).
- 2026-06-12 — Codex retomou pelo handoff de `specs/015.../tasks.md`. Próximo: H0 (estado git + testes/builds locais), T1 SELECT read-only em `faren` prod+beta sem PII; T7/T9 só após aprovação explícita por ação (commit/push/merge/deploy/write VM).
- 2026-06-12 — **H0 verde + branch criada:** `git switch -c feat/glossario-015-sso-compat`; `pnpm --filter @artificio/glossario-backend test` = 13/13; `pnpm --filter @artificio/glossario-backend build` = tsc OK; `pnpm --filter @artificio/glossario-frontend build` = tsc+vite OK (1581 módulos; aviso padrão chunk >500KB).
- 2026-06-12 — **T1 concluída:** SELECT read-only na VM (`docker exec ... psql -tAc`), sem PII/hashes. Prod `glossario-db`: `38|5|38|2` (`total|non_google|with_hash|admins`). Beta `glossario-beta-db`: `17|3|17|2`. Próximo: T7 precisa aprovação explícita para commit/push/PR/merge dev + workflow deploy beta.
