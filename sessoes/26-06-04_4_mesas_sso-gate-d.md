# Sessão 26-06-04_4 — CDX-308: mesas no SSO (Gate D)

- **Data:** 2026-06-04 · **Módulo:** `mesas` + `accounts` allowlist · **Gate:** D mesas
- **Objetivo:** integrar `mesas.artificiorpg.com` ao SSO central (`accounts.`), validar E2E browser e fechar 1º Gate D.
- **Spec:** `specs/004-mesas-sso-gate-d/{spec,plan,tasks}.md`
- **Dependências:** CDX-307 ✅ (design system real / D038) conforme pedido do mantenedor.

## Escopo
- `apps/accounts`: corrigir open-redirect (D037) em `/api/auth/google` e callback.
- `mesas`: integrar UI/auth quando houver app no monorepo.
- VM/deploy: somente com aprovação formal.

## Estado inicial
- `apps/mesas` **não existe** no monorepo em `C:\projetos\artificio`; existe repo legado `C:\projetos\mesas_rpg_artificio` e deploy vivo em `/opt/artificio/mesas`.
- CDX-307 deixou mudanças locais em `packages/ui`/`midias`; preservar sem sobrescrever.
- `accounts-api` está no ar; smoke atual `health=200`, `login=200`, `/me` sem cookie `401`.

## Plano
1. Corrigir D037 em `apps/accounts/src/app.ts`.
2. Validar build/test de `accounts`.
3. Investigar estrutura do `mesas` legado e decidir se CDX-308 exige importar `mesas` para `apps/mesas` antes de integrar.
4. Pedir aprovação antes de qualquer deploy/write na VM.

## Critério de fechamento
- Allowlist: `return=https://evil.com` cai em `PUBLIC_URL`; `return=https://*.artificiorpg.com/...` permitido.
- Mesas usa `@artificio/ui` e `@artificio/auth`.
- Backend mesas valida `artificio_session` com mesmo `JWT_SECRET`.
- Browser E2E real: login em mesas → accounts → Google → volta logado; rota privada OK logado; deslogado 401/redirect; logout limpa sessão; token/segredo não impresso.

## Log
- 2026-06-04 — Sessão aberta. Bloqueio potencial: `apps/mesas` ausente no monorepo; análise do legado necessária antes de implementar integração.
- 2026-06-04 — Spec 004 criada conforme `new-spec`/`add-module`. D037 implementado em `accounts`: `sanitizeReturnUrl` aceita só HTTPS com hostname terminando em `.artificiorpg.com`; `evil.com` e lookalike bloqueados. Validação: `pnpm --filter @artificio/accounts test` OK (6), `pnpm --filter @artificio/accounts build` OK.
- 2026-06-04 — CDX-308A aprovado pelo mantenedor: importar `C:\projetos\mesas_rpg_artificio` para `apps/mesas` como base do módulo G1. Escopo: local only; sem VM, sem deploy, sem `.env`, sem `.git`, sem `node_modules`, sem `dist/build/coverage`, sem dados/segredos. Após importar, validar árvore, ausência de segredos e build local possível.
- 2026-06-04 — CDX-308A executado. Criado `apps/mesas` com `frontend/`, `backend/`, `database/`, `scripts/`, docs operacionais, `package.json` orquestrador, `module.manifest.ts` e `CONTEXT.md`. `pnpm-workspace.yaml` inclui subpacotes `apps/*/{frontend,backend}`. Pacotes renomeados para `@artificio/mesas-frontend` e `@artificio/mesas-backend`. Ajuste mínimo para build: pin `express-rate-limit` 7.5.1 e cast local do rate limiter para `RequestHandler` Express 4.
- 2026-06-04 — Validação CDX-308A: `pnpm install` OK; `pnpm --filter @artificio/mesas build` OK; `pnpm -w turbo run build --filter=@artificio/mesas` OK; frontend tests OK (3 suites, 13 tests); backend tests OK com env dummy local não secreto (`DATABASE_URL` fake + `JWT_SECRET` fake; 13 suites, 104 tests). Scan: nenhum `.env` real importado; só `.env.example`; `node_modules/dist` são gerados/ignorados. VM/deploy não tocados.
- 2026-06-04 — CDX-308B iniciado. Escopo local only: `apps/mesas` frontend/backend + D037 accounts já local + turbo outputs. Sem VM/deploy/compose legado. Objetivo: mesas consumir `@artificio/ui` e `@artificio/auth`, aposentar login próprio no fluxo principal, backend validar cookie `artificio_session`, docs/env exemplo sem segredo.
- 2026-06-04 — CDX-308B frontend: `@artificio/mesas-frontend` consome `@artificio/ui` (`Header`, `Footer`, `styles.css`) e `@artificio/auth/client` (`useSession`, `redirectToLogin`). Fluxo `/login` e rotas protegidas redirecionam para accounts com `return=https://mesas.artificiorpg.com/...`. Contexto legado `useAuth` mantido como adapter para reduzir blast radius, alimentado pelo SSO central; não usa token local. `SiteHeader/SiteFooter` ficam legados sem uso no shell.
- 2026-06-04 — CDX-308B backend: `authMiddleware` agora delega para `requireAuth` de `@artificio/auth`, lendo cookie `artificio_session`/Bearer; mapeia sessão SSO para `req.user` legado (`userId`, `role`, email/name/avatar) e tenta resolver usuário local por `google_id`/email para preservar FKs/roles `gm/admin`. OAuth Google local em `/api/v1/auth/google` virou redirect compatível para accounts; callback/logout locais retornam 410. `csrfProtection` usa `artificio_session`.
- 2026-06-04 — CDX-308B suporte: `@artificio/auth` ganhou export ESM client-only (`@artificio/auth/client`) e build CJS server-only para backend CommonJS legado; contrato JWT/cookie não alterado. Turbo outputs ajustados para `frontend/dist/**` e `backend/dist/**`.
- 2026-06-04 — CDX-308B env/docs: `apps/mesas/backend/.env.example` documenta `ACCOUNTS_URL` e `JWT_SECRET=mesmo_jwt_secret_do_accounts` (placeholder, sem valor); remove OAuth Google/JWT local do exemplo. `apps/mesas/frontend/.env.example` inclui `VITE_ACCOUNTS_URL`.
- 2026-06-04 — CDX-308B validação local: `pnpm -w turbo run build --filter=@artificio/mesas` OK, sem warning de Turbo output. `pnpm --filter @artificio/accounts test` OK (6/6, allowlist `evil.com` bloqueado). `pnpm --filter @artificio/auth test` OK (3/3). `pnpm --filter @artificio/mesas-frontend test` OK (4 suites, 15 tests; inclui redirect SSO). `pnpm --filter @artificio/mesas-backend test -- --runInBand` OK com env dummy local (14 suites, 106 tests; inclui 401 sem cookie e 200 com `artificio_session`). `rg` sem resíduos `am_session`, `auth/google`, `getGoogleLoginUrl`, `JWT_EXPIRES`, `GOOGLE_CALLBACK` no escopo mesas.
- 2026-06-04 — Browser local: usuário ativou Chrome/Computer, mas ferramentas não ficaram callable nesta sessão (`tool_search` só expôs `node_repl`; Playwright ausente no repo). Tentativa com stubs localhost abortou por `Cannot find module 'playwright'`. Evidência de fluxo local coberta por testes unit/integration locais; E2E browser real fica para CDX-308C/deploy com ferramenta disponível/aprovação.
