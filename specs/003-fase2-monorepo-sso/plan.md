# Plano — 003 Fase 2 monorepo + SSO

## Arquitetura
```
artificio/                      (repo = monorepo root)
  pnpm-workspace.yaml  turbo.json  tsconfig.base.json  package.json
  packages/
    config/   tsconfig base, eslint flat, env schema (zod)
    auth/     verifyToken, requireAuth (express), useSession/redirectToLogin (react)
    ui/       tailwind preset, tokens, Header/Nav/Footer
  apps/
    accounts/ backend (express+kysely+pg) + frontend (vite+react login) + Dockerfile
```
SSO flow: módulo → `accounts.artificiorpg.com/login?return=<url>` → Google → callback → set cookie `.artificiorpg.com` → redirect `return`. Qualquer backend valida via `packages/auth.verifyToken` (mesmo segredo HS256 em env).

## Sequência (Opus desenha contrato; Codex executa CDX-*)
1. **CDX-301** scaffold monorepo + `packages/config`.
2. **CDX-302** `packages/auth` (contrato de sessão).
3. **CDX-303** `packages/ui` (tokens + Header/Nav/Footer).
4. **[Mantenedor]** Google Cloud Console: OAuth client canônico "Artifício" — redirect `https://accounts.artificiorpg.com/api/auth/google/callback`, origin `https://accounts.artificiorpg.com`. Entrega `GOOGLE_CLIENT_ID/SECRET`.
5. **CDX-304** `apps/accounts` backend: rotas OAuth/JWT/me/logout/refresh + `accounts-db` + migration `users`.
6. **CDX-305** `apps/accounts` frontend (login) + Dockerfile + compose (`accounts-db` + `accounts-api`) na `artificio_net`.
7. **[Mantenedor·Cloudflare]** rota `accounts.artificiorpg.com` → container accounts.
8. **CDX-306** deploy na VM + smoke do fluxo (login → cookie → /me) + teste cross-subdomínio.

## Contratos (pra Codex implementar certo)
- **Cookie:** nome `artificio_session`; `Domain=.artificiorpg.com; Path=/; HttpOnly; Secure; SameSite=Lax`. Refresh em cookie separado `artificio_refresh`.
- **JWT (access):** HS256, claims `sub`(user id), `email`, `name`, `role`, `exp` (~15min). Refresh ~7d.
- **`users`:** `id uuid pk`, `google_sub text unique not null`, `email text`, `name text`, `avatar text`, `role text default 'user'`, `created_at timestamptz default now()`.
- **`packages/auth` API:** `verifyToken(jwt): Session|null`, `requireAuth` (401 se inválido), `useSession(): {user,loading}`, `redirectToLogin(returnUrl)`.
- **Env (accounts):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `COOKIE_DOMAIN=.artificiorpg.com`, `PUBLIC_URL=https://accounts.artificiorpg.com`.

## Stack
React19/Vite/TS/Tailwind (front) · Express/TS/Kysely/PG16 (back) · `google-auth-library` + `jsonwebtoken` (= padrão do mesas). pnpm + Turbo.

## Validação
Critérios do `spec.md`. **Teste cross-subdomínio é obrigatório** antes de fechar Gate B (provar que o cookie/JWT vale fora do `accounts.`).

## Rollback
accounts é serviço novo isolado — não afeta glossário/mesas. Se falhar, derrubar o container accounts; nada mais impactado.
