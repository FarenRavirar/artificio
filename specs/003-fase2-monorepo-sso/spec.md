# 003 — Fase 2: monorepo + SSO (accounts) + ui

- **Módulo:** monorepo · `packages/{config,auth,ui}` · `apps/accounts` · **Gate:** B
- **Nível SDD:** Completo (toca compartilhado + SSO = sagrado)

## Problema
Erguer o **coração técnico** do G1: o monorepo real + o **login único** (`accounts.artificiorpg.com`, D018) + o design system compartilhado. Sem isto, nenhum módulo novo (downloads/esferas/srd/site) tem onde se plugar nem como autenticar. Fecha **Gate B**. glossário/mesas seguem rodando como estão (integração ao monorepo = fases posteriores, D017); aqui **não** se mexe neles.

## Requisitos
1. **Scaffold monorepo** em `C:\projetos\artificio`: `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, root `package.json`, dirs `apps/` + `packages/`.
2. **`packages/config`**: tsconfig base, eslint flat config, schema de env (zod) compartilhados.
3. **`packages/auth`**: lib compartilhada — `verifyToken(jwt)`, middleware `requireAuth` (Express), hook `useSession()` + `redirectToLogin(return)` (React). Contrato único de sessão pro G1 inteiro.
4. **`apps/accounts`** (serviço SSO em `accounts.artificiorpg.com`):
   - OAuth Google (1 client canônico). Rotas: `GET /api/auth/google` (inicia), `GET /api/auth/google/callback` (troca code → upsert user → JWT → cookie → redirect `return`), `GET /api/auth/me` (valida cookie → user), `POST /api/auth/logout`, `GET /api/auth/refresh`. Página `GET /login?return=<url>` (botão Google).
   - **Cookie:** `Domain=.artificiorpg.com; HttpOnly; Secure; SameSite=Lax`. Vale em todo `*.artificiorpg.com`.
   - **JWT:** HS256, segredo em env compartilhado (JWKS/RS256 = futuro). Access curto + refresh.
   - **DB:** container `accounts-db` (postgres:16, `artificio_auth`, user `admin`) na `artificio_net`. Tabela `users` (id, google_sub único, email, name, avatar, role, created_at). Identidade **central nova** (glossário/mesas migram pra ela depois).
5. **`packages/ui`**: preset Tailwind + tokens (sóbrio estilo Google, cores+logo Artifício), `Header`/`Nav`/`Footer` (mostra módulos + estado de login via `useSession`). Respeita **Nielsen 10 + ISO 9241-11**.
6. **Deploy:** `apps/accounts` + `accounts-db` na VM (`faren`, `artificio_net`); rota Cloudflare `accounts.artificiorpg.com` → container. Imagem GHCR.

## Checkpoint externo validado (2026-06-04)
- Domínio público: `https://accounts.artificiorpg.com`.
- Callback OAuth oficial: `https://accounts.artificiorpg.com/api/auth/google/callback`.
- OAuth client Google criado como Aplicativo da Web: `Artificio Accounts`.
- Client ID público: `764267281239-hp1vl6cqq6q72k33j9q4kmpn7vlk9ibh.apps.googleusercontent.com`.
- Env local fora do git: `C:\projetos\artificiobackup\accounts-oauth.env`.
- Variáveis esperadas: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `PUBLIC_URL`, `COOKIE_DOMAIN`.
- Cloudflare tunnel: `6417d3a0-b98b-42ed-97da-3fb9f6ecfac2`.
- Rota criada: `accounts.artificiorpg.com` → `http://accounts-api:3000`.
- Estado pré-backend esperado: `curl -I https://accounts.artificiorpg.com` retorna `502 Bad Gateway` via Cloudflare.
- Segurança: nunca expor `GOOGLE_CLIENT_SECRET`, JSON OAuth, `.env` ou secrets em commit, issue, chat, log ou doc público.

## Critérios de aceite (Gate B)
- [ ] `pnpm install` + `turbo build` verdes na raiz.
- [ ] `https://accounts.artificiorpg.com/login` carrega; fluxo Google → callback → cookie setado.
- [ ] `GET /api/auth/me` retorna o user logado lendo o cookie.
- [ ] Cookie `.artificiorpg.com` legível por outro subdomínio (provar com um endpoint de teste em outro host que use `packages/auth.verifyToken`).
- [ ] `users` persistido (upsert por `google_sub`).
- [ ] `packages/ui` Header renderiza login/avatar a partir da sessão.
- [ ] Nenhum segredo no git; OAuth secret/JWT secret em env.

## Fora de escopo
Integrar glossário/mesas ao SSO (fase posterior). Site/downloads/esferas/srd. CI/CD completo (deploy manual/Codex agora; Actions depois). Analytics/SEO (depois).

## Riscos
- **Auth é sagrado:** cookie domain/flags errados = sessão não compartilha ou vaza. Testar cross-subdomínio antes de fechar Gate B.
- **OAuth client/redirect URI** = passo manual do mantenedor (Google Cloud Console). Sem isso, callback falha.
- **HS256 shared secret**: simples mas exige o mesmo segredo em cada consumidor; migrar a JWKS quando houver muitos módulos.
