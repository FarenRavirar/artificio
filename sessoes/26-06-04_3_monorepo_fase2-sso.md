# Sessão 26-06-04_3 — Fase 2: monorepo + SSO

- **Data:** 2026-06-04 · **Módulo:** monorepo/`apps/accounts`/`packages/*` · **Gate:** B
- **Objetivo:** erguer o monorepo + SSO (`accounts.artificiorpg.com`) + `packages/{config,auth,ui}`. Fechar Gate B.
- **Spec:** `specs/003-fase2-monorepo-sso/{spec,plan,tasks}.md` · **Decisões:** D001, D003, D007, D017, D018

## Tarefas para Codex
> Fonte: `specs/003-fase2-monorepo-sso/tasks.md` (CDX-301..306 + 2 passos do mantenedor). Cada CDX com `✓ Validar`. Modo: **Opus orquestra, Codex executa.**

| CDX | O quê | Estado |
|---|---|---|
| 301 | scaffold monorepo + `packages/config` | ✅ |
| 302 | `packages/auth` (sessão) | ✅ |
| 303 | `packages/ui` (tokens + Header/Nav/Footer) | ✅ |
| — | [mantenedor] OAuth client Google | ✅ |
| 304 | `apps/accounts` backend (OAuth/JWT/users) | ✅ |
| 305 | `apps/accounts` frontend + Docker | ✅ |
| — | [mantenedor] rota Cloudflare `accounts.` | ✅ |
| 306 | deploy VM + smoke + cross-subdomínio → Gate B | ✅ técnico / aguardando Opus |

## Ordem
301→302→303 podem ir em sequência. 304 espera o OAuth client (mantenedor). 306 espera a rota Cloudflare.

## Estado atual
Spec 003 criada (Opus, contexto pleno da Fase 0+1). Aguardando início da execução pelo chat novo (orquestra Codex). glossário/mesas **não** se tocam aqui.

## Log Codex
- 2026-06-04 — Início CDX-301/CDX-302. Escopo: scaffold monorepo + `packages/config` + `packages/auth`. Não tocar glossário/mesas nem VM. `pnpm` ausente local; instalar/ativar antes da validação.
- 2026-06-04 — CDX-301 concluído: scaffold monorepo criado (`pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `package.json`, `apps/`, `packages/`) + `packages/config` com `parseEnv(schema)` usando `zod`. Validação: `npm install -g pnpm@10.12.1`; `pnpm install` OK; `pnpm -w turbo run build` OK (2 tasks).
- 2026-06-04 — CDX-302 concluído: `packages/auth` criado com `verifyToken`, `requireAuth`, `useSession`, `redirectToLogin`, tipos `Session`/`User`, testes unit de token válido/expirado/forjado. Validação: `pnpm --filter @artificio/auth build` OK; `pnpm --filter @artificio/auth test` OK (3 passed).
- 2026-06-04 — Checkpoint externo registrado: OAuth Google pronto (`accounts-oauth.env` fora do git), callback oficial `https://accounts.artificiorpg.com/api/auth/google/callback`, Cloudflare tunnel correto `<TUNNEL_UUID>`, rota `accounts.artificiorpg.com` → `http://accounts-api:3000`; `502` atual esperado até backend subir. Docs atualizados: spec/plan/tasks/access-registry/sessão.
- 2026-06-04 — CDX-303 concluído: `packages/ui` criado com Tailwind preset/tokens, `Header`, `Nav`, `Footer`, estados de sessão via `useSession`/override de preview, foco visível e contraste AA. Validação: `pnpm --filter @artificio/ui build` OK; `pnpm -w turbo run build` OK (3 tasks); preview com estados deslogado/logado salvo em `packages/ui/header-preview.png`.
- 2026-06-04 — CDX-304 concluído: `apps/accounts` backend criado com Express, OAuth Google, JWT/cookies, `/api/auth/google`, `/api/auth/google/callback`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/refresh`, Kysely/PG e migration `users`. Validação: `pnpm --filter @artificio/accounts build` OK; testes `/api/auth/me` sem cookie=401 e com JWT válido=200; migration real rodou contra Postgres temporário via túnel SSH na VM, tabela `users` validada e container teste removido.
- 2026-06-04 — Retomada pós-compactação/desligamento durante CDX-305. Falha pendente identificada: `tar` feito no Windows preservou flags/perm de diretórios e quebrou extração na VM. Próximo: empacotar CDX-305 por `.zip`, validar build/compose em diretório temporário na VM, sem imprimir segredos.
- 2026-06-04 — CDX-305 concluído: frontend `/login` criado em `apps/accounts/frontend`, Dockerfile multi-stage e `docker-compose.yml` com `accounts-db` + `accounts-api` na `artificio_net`. Fixes validados em Docker real: build via Turbo compila workspaces, runtime roda `node dist/migrate.js`, imports ESM em `accounts/config/auth/ui` usam NodeNext + `.js`, Express serve SPA em `dist/client`. Validação local: `pnpm -w turbo run build` OK (4 tasks), `pnpm --filter @artificio/auth test` OK (3), `pnpm --filter @artificio/accounts test` OK (2). Validação VM temporária: `docker compose build --no-cache accounts-api` OK; `docker compose up -d` OK; logs: `accounts migration OK`, `accounts listening on 3000`; smoke `GET /health=200`, `GET /login=200`, `GET /api/auth/me=401`; tabela `users` criada. Temp limpo (`docker compose down -v`, `/tmp/artificio-cdx-305*` removido).
- 2026-06-04 — Início CDX-306 aprovado pelo mantenedor: deploy permanente de `apps/accounts` em `/opt/artificio/accounts`, criar `.env` real sem imprimir segredo, subir `accounts-db` + `accounts-api`, smoke Cloudflare e teste cross-subdomínio.
- 2026-06-04 — CDX-306 deploy real concluído tecnicamente: `/opt/artificio/accounts` criado, `.env` real com permissão `600` e segredos mascarados, `JWT_SECRET`/`JWT_REFRESH_SECRET`/`POSTGRES_PASSWORD` guardados em `C:\projetos\artificiobackup\accounts-oauth.env` para reuso. `docker compose build --no-cache accounts-api` OK; `docker compose up -d` OK; logs `accounts migration OK` + `accounts listening on 3000`; `accounts-db` healthy; tabela `users` preservada/criada. Smoke Cloudflare: `/health=200`, `/login=200`, `/api/auth/me=401` sem cookie.
- 2026-06-04 — CDX-306 fluxo login: mantenedor completou Google OAuth; Google enviou alerta de novo login; callback criou `users=1` em `accounts-db`. Bug encontrado: frontend defaultava `return` para `https://beta.artificiorpg.com`, que ainda não tem DNS; corrigido para `window.location.origin`, rebuild/redeploy feito, smoke Cloudflare ainda OK. `/api/auth/me` com sessão válida retornou `200` com user mascarado (`pau***@gmail.com`, role `user`). Cookie flags confirmadas no código de produção: `Domain=.artificiorpg.com`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, access 15min, refresh 7d.
- 2026-06-04 — CDX-306 cross-subdomínio: container efêmero `cdx306-sso-probe` com hostname `probe.artificiorpg.com` na `artificio_net` usou `@artificio/auth verifyToken` com o mesmo `JWT_SECRET` e cookie `artificio_session` em memória; resultado `cross_subdomain=OK` para o mesmo user mascarado. Container removido (`--rm`), temporários `/tmp/cdx306-*` limpos. Observação: por segurança/HttpOnly, o valor real do token/cookie não foi impresso nem extraído do browser; validação usou token de sessão gerado no servidor para o user criado pelo OAuth real.
- 2026-06-04 — Checkpoint GitHub Actions secrets: mantenedor cadastrou no repo `FarenRavirar/artificio` os 6 secrets esperados (`ACCOUNTS_ENV`, `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_PORT`, `DEPLOY_SSH_PRIVATE_KEY`, `DEPLOY_USER`). Cofre local sem git: `C:\projetos\Secrets\artificio\accounts.env` e `deploy-known-hosts`. Validação sem valores: `gh secret list` mostrou os 6 nomes; `accounts.env` local tem 9/9 chaves esperadas; `deploy-known-hosts` tem 3 linhas para `<IP_DA_VM>`; `accounts-api` e `cloudflared` estão na `artificio_net`; probe Docker na rede retornou `http://accounts-api:3000/health=200`. Docs atualizados: `docs/agents/github-actions-secrets.md`, `access-registry.md`, `infra-map.md`, `.specify/arquiteture.md`, `context-capsule.md`.
- 2026-06-04 — Workflow criado: `.github/workflows/deploy-accounts.yml`. CI roda em PR/push (`pnpm install`, build accounts, testes accounts). Deploy job só em `workflow_dispatch`, modo `validate` por padrão; valida presença/comprimento dos 6 secrets, monta SSH, escreve `ACCOUNTS_ENV` em temp remoto, checa 9 chaves sem valores, verifica `artificio_net`, `cloudflared` e `accounts-api`. Modo `deploy` empacota workspace mínimo, escreve `/opt/artificio/accounts/.env` a partir de `ACCOUNTS_ENV`, rebuilda/sobe compose e valida interno + Cloudflare. Validação local pós-criação: build accounts OK, teste accounts OK, `gh secret list` OK.
