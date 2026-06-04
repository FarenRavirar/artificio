# 004 — Mesas no SSO central
- **Módulo/Pacote:** `apps/mesas` + `apps/accounts` + deploy `mesas.artificiorpg.com`
- **Gate relacionado:** D (mesas)

## Problema
`mesas.artificiorpg.com` ainda usa auth própria do projeto legado. O G1 precisa provar o primeiro módulo consumindo o SSO central (`accounts.artificiorpg.com`) para fechar o primeiro Gate D e validar o contrato real de cookie `.artificiorpg.com`.

## Requisitos
1. `accounts` bloqueia open redirect: `return` só aceita hosts HTTPS terminando em `.artificiorpg.com`; fora da allowlist cai em `PUBLIC_URL`.
2. `mesas` usa o design system `@artificio/ui` (`Header`, `Footer`, estilos e paleta D038).
3. Botão de login em `mesas` chama `redirectToLogin(returnUrl)` de `@artificio/auth`.
4. Backend de `mesas` valida `artificio_session` com `@artificio/auth.requireAuth` ou contrato equivalente usando o mesmo `JWT_SECRET` de `accounts`.
5. `JWT_SECRET` de `mesas` e `accounts` é o mesmo segredo de sessão SSO, vindo de fonte segura fora do git.
6. Browser E2E prova: deslogado bloqueia rota privada; login Google via `accounts`; retorno logado em `mesas`; rota privada acessível; logout limpa sessão.

## Critérios De Aceite
- `https://mesas.artificiorpg.com` carrega com header/footer do G1.
- Login em `mesas` redireciona para `accounts`, Google autentica, e retorna para `mesas` logado.
- `artificio_session` é enviado ao backend `mesas` com `Domain=.artificiorpg.com`.
- Rota privada de `mesas` retorna `401`/redirect sem sessão e sucesso com sessão.
- Logout remove sessão visível em `mesas` e `accounts`.
- `return=https://evil.com` é bloqueado; `return=https://mesas.artificiorpg.com/...` é aceito.

## Fora De Escopo
- Migrar dados de `mesas`.
- Refatorar UI inteira de `mesas`.
- Alterar contrato de cookie/JWT de `@artificio/auth`.
- Mexer em glossário.
- Criar DNS/tunnel novo.

## Riscos E Impacto
- Auth é sagrado: segredo divergente entre `accounts` e `mesas` quebra SSO.
- `mesas` legado ainda não existe em `apps/mesas`; integração no monorepo depende de import/definição do app.
- Deploy de `mesas` toca serviço vivo e exige aprovação formal do mantenedor.
