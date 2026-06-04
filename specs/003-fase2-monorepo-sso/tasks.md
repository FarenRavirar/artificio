# Tasks — 003 Fase 2 (monorepo + SSO)

> Opus desenha/valida; Codex executa. Cada CDX: `✓ Validar` antes de retornar. Stack canônica. Sem segredo no git.

## CDX-301 — Scaffold monorepo + `packages/config`
Criar na raiz `C:\projetos\artificio`: `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json` (pipelines build/lint/test/dev), `tsconfig.base.json`, root `package.json` (scripts turbo). `packages/config`: tsconfig base, eslint flat config, `env.ts` (helper zod). Dirs `apps/` `packages/` criados.
**✓ Validar:** `pnpm install` ok na raiz; `pnpm -w turbo run build` roda (mesmo sem apps). **Reportar:** árvore + saída do install.

## CDX-302 — `packages/auth`
Lib TS: `verifyToken(jwt)` (HS256, `JWT_SECRET` env), `requireAuth` (Express mw, 401 se inválido), `useSession()` (React hook: fetch `accounts.artificiorpg.com/api/auth/me` com credentials), `redirectToLogin(returnUrl)`. Tipos `Session`/`User` exportados.
**✓ Validar:** `pnpm --filter @artificio/auth build` ok; teste unit de `verifyToken` (token válido/expirado/forjado). **Reportar:** build + teste.

## CDX-303 — `packages/ui`
Preset Tailwind + tokens (sóbrio Google-like, cores+logo Artifício). Componentes `Header` (nav dos módulos + login/avatar via `useSession`), `Nav`, `Footer`. Acessível (foco, contraste, teclado — ISO 9241-11 / Nielsen).
**✓ Validar:** `pnpm --filter @artificio/ui build` ok; Storybook/preview do Header em 2 estados (deslogado/logado). **Reportar:** build + screenshot/preview.

## [MANTENEDOR] — OAuth client Google
Google Cloud Console → criar OAuth client "Artifício G1" (Web): authorized redirect `https://accounts.artificiorpg.com/api/auth/google/callback`, origin `https://accounts.artificiorpg.com`. Entregar `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` ao Codex (env, **não versionar**).

## CDX-304 — `apps/accounts` backend
Express+Kysely+pg. Rotas: `/api/auth/google`, `/api/auth/google/callback`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/refresh`. Cookie `artificio_session` (`Domain=.artificiorpg.com;HttpOnly;Secure;SameSite=Lax`) + refresh. `accounts-db` (postgres:16) + migration `users` (ver plan). Upsert por `google_sub`. Usa `packages/auth`.
**✓ Validar:** local — `GET /api/auth/me` sem cookie = 401; com JWT válido = user. Migration aplica `users`. **Reportar:** rotas + migration.

## CDX-305 — `apps/accounts` frontend + Docker
Vite+React: página `/login?return=` (botão Google), pós-login redireciona `return`. Dockerfile (multi-stage) + `docker-compose` (`accounts-db` + `accounts-api`) na `artificio_net`. Env via `.env` (não versionar).
**✓ Validar:** `docker compose build` ok; sobe local; `/login` renderiza. **Reportar:** build + up.

## [MANTENEDOR] — rota Cloudflare
Tunnel → Public Hostname `accounts.artificiorpg.com` → `http://accounts-api:<porta>`.

## CDX-306 — Deploy VM + smoke (fecha Gate B)
Deploy `apps/accounts` na `faren` (`/opt/artificio/accounts`, `artificio_net`). Subir. Smoke do fluxo real: `accounts.artificiorpg.com/login` → Google → cookie setado → `/api/auth/me` retorna user. **Teste cross-subdomínio:** endpoint mínimo noutro host (ex.: container teste) que use `verifyToken` lê o mesmo cookie → confirma sessão compartilhada.
**✓ Validar:** login completo OK + `/me` 200 com user + cross-subdomínio lê a sessão. **Reportar:** códigos + evidência do fluxo. → Opus valida → **Gate B**.
