# Plano — 015

## Arquitetura da solução
1. **Migration aditiva** (`glossario_v2`): `ALTER TABLE users ADD COLUMN sso_user_id <tipo do id do accounts> NULL UNIQUE` + índice em `lower(email)`. Nada destrutivo; snapshot antes.
2. **Middleware:** substituir verificação JWT custom por `@artificio/auth verifyToken(artificio_session)`. Resolver usuário local: (a) `users.sso_user_id = token.sub` → usa; (b) senão `lower(users.email) = lower(token.email)` → vincula (grava `sso_user_id`) e usa; (c) senão cria row novo (`role='user'`). Single source: helper `resolveLocalUser(token)`.
3. **Ownership/roles:** middlewares existentes passam a ler o user local resolvido; `role` local do glossário preservado; `token.role==='admin'` (SSO global) ⇒ admin no módulo.
4. **Frontend:** remover telas login/register; `AuthContext` → `useSession`/`authFetch` de `@artificio/auth/client` (com refresh-retry, fix `356b650`); Header D043 com `userMenu` do glossário.
5. **Fluxo de reivindicação (email legado não-Google):**
   - `POST /api/migration/verify` (email+senha → valida BCrypt → emite `migration_token` JWT curto ~10min, escopo só-migração; rate-limit por IP+email, lockout, resposta uniforme s/ enumeração). **Não** seta cookie de sessão.
   - Front guarda token → manda ao accounts logar Google (`return` de volta à tela de migração).
   - `POST /api/migration/claim` (exige sessão SSO válida + `migration_token`): transação — vincula `sso_user_id` ao user legado; se já existia user auto-provisionado pro mesmo `sso_user_id`, repoint de FKs (`terms.added_by`, `term_votes`, `term_comments`, `user_notifications`, `term_history.changed_by`, `audit_log`) do auto-provisionado → legado, resolve duplicata de voto (mantém o mais recente), apaga row auto-provisionado; atualiza `users.email` p/ email Google.
   - UI: aviso na entrada ("email não-Google? entre por aqui") → form senha antiga → tela "conecte sua conta Google" → confirmação de herança.
6. **Desativar endpoints legados:** login de sessão/register removidos (410); BCrypt vive só no `/api/migration/verify`.
7. **Allowlist `return`** já cobre `*.artificiorpg.com` (D037) — `glossario.` entra de graça.

## Arquivos afetados
- `apps/glossario/backend/**` (middleware auth, rotas, resolveLocalUser)
- `apps/glossario/frontend/**` (AuthContext→useSession, telas login/register removidas, Header)
- `apps/glossario/database/migration_XX_sso_link.sql` (nova)
- `packages/auth`: **zero mudança** (se faltar algo, vira spec própria)

## Contratos/interfaces tocados
- Consome contrato SSO existente (cookie + verifyToken + /api/auth/refresh).
- Schema glossário: coluna aditiva.

## Impacto em consumidores
Nenhum pacote alterado ⇒ impacto restrito ao glossário. Ainda assim smoke de mesas/site/accounts pós-deploy (sessão compartilhada).

## Rollback
- Migration aditiva: coluna fica, sem efeito.
- Código: revert do commit; legado de auth volta (repo histórico).
- Deploy: snapshot/rollback do `_deploy-module`.

## Validação
- Testes unit do `resolveLocalUser` (match por sso_user_id, por email, criação, case-insensitive).
- E2E beta: conta legada seedada com email do mantenedor → login Google → termos listados/editáveis.
- Smoke 401 sem cookie; redirect p/ accounts com `return` correto; cross-módulo no browser.
- Consulta read-only pré-migração: `select count(*) from users where email !~* '@(gmail|googlemail)'` p/ dimensionar órfãos (informar mantenedor).
