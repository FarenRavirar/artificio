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
| 306 | deploy VM + smoke + cross-subdomínio → Gate B | ⬜ |

## Ordem
301→302→303 podem ir em sequência. 304 espera o OAuth client (mantenedor). 306 espera a rota Cloudflare.

## Estado atual
Spec 003 criada (Opus, contexto pleno da Fase 0+1). Aguardando início da execução pelo chat novo (orquestra Codex). glossário/mesas **não** se tocam aqui.

## Log Codex
- 2026-06-04 — Início CDX-301/CDX-302. Escopo: scaffold monorepo + `packages/config` + `packages/auth`. Não tocar glossário/mesas nem VM. `pnpm` ausente local; instalar/ativar antes da validação.
- 2026-06-04 — CDX-301 concluído: scaffold monorepo criado (`pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `package.json`, `apps/`, `packages/`) + `packages/config` com `parseEnv(schema)` usando `zod`. Validação: `npm install -g pnpm@10.12.1`; `pnpm install` OK; `pnpm -w turbo run build` OK (2 tasks).
- 2026-06-04 — CDX-302 concluído: `packages/auth` criado com `verifyToken`, `requireAuth`, `useSession`, `redirectToLogin`, tipos `Session`/`User`, testes unit de token válido/expirado/forjado. Validação: `pnpm --filter @artificio/auth build` OK; `pnpm --filter @artificio/auth test` OK (3 passed).
- 2026-06-04 — Checkpoint externo registrado: OAuth Google pronto (`accounts-oauth.env` fora do git), callback oficial `https://accounts.artificiorpg.com/api/auth/google/callback`, Cloudflare tunnel correto `6417d3a0-b98b-42ed-97da-3fb9f6ecfac2`, rota `accounts.artificiorpg.com` → `http://accounts-api:3000`; `502` atual esperado até backend subir. Docs atualizados: spec/plan/tasks/access-registry/sessão.
- 2026-06-04 — CDX-303 concluído: `packages/ui` criado com Tailwind preset/tokens, `Header`, `Nav`, `Footer`, estados de sessão via `useSession`/override de preview, foco visível e contraste AA. Validação: `pnpm --filter @artificio/ui build` OK; `pnpm -w turbo run build` OK (3 tasks); preview com estados deslogado/logado salvo em `packages/ui/header-preview.png`.
- 2026-06-04 — CDX-304 concluído: `apps/accounts` backend criado com Express, OAuth Google, JWT/cookies, `/api/auth/google`, `/api/auth/google/callback`, `/api/auth/me`, `/api/auth/logout`, `/api/auth/refresh`, Kysely/PG e migration `users`. Validação: `pnpm --filter @artificio/accounts build` OK; testes `/api/auth/me` sem cookie=401 e com JWT válido=200; migration real rodou contra Postgres temporário via túnel SSH na VM, tabela `users` validada e container teste removido.
- 2026-06-04 — Retomada pós-compactação/desligamento durante CDX-305. Falha pendente identificada: `tar` feito no Windows preservou flags/perm de diretórios e quebrou extração na VM. Próximo: empacotar CDX-305 por `.zip`, validar build/compose em diretório temporário na VM, sem imprimir segredos.
- 2026-06-04 — CDX-305 concluído: frontend `/login` criado em `apps/accounts/frontend`, Dockerfile multi-stage e `docker-compose.yml` com `accounts-db` + `accounts-api` na `artificio_net`. Fixes validados em Docker real: build via Turbo compila workspaces, runtime roda `node dist/migrate.js`, imports ESM em `accounts/config/auth/ui` usam NodeNext + `.js`, Express serve SPA em `dist/client`. Validação local: `pnpm -w turbo run build` OK (4 tasks), `pnpm --filter @artificio/auth test` OK (3), `pnpm --filter @artificio/accounts test` OK (2). Validação VM temporária: `docker compose build --no-cache accounts-api` OK; `docker compose up -d` OK; logs: `accounts migration OK`, `accounts listening on 3000`; smoke `GET /health=200`, `GET /login=200`, `GET /api/auth/me=401`; tabela `users` criada. Temp limpo (`docker compose down -v`, `/tmp/artificio-cdx-305*` removido).
