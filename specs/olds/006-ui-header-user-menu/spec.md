# 006 — Menu de conta no Header (regressão CDX-311) · CDX-312

- **Módulo/Pacote:** `packages/ui` (Header) + `packages/auth` (client logout) + `apps/mesas` (consumidor)
- **Gate relacionado:** D (mesas) — regressão em **prod E beta**

## Problema
CDX-311 unificou o header do `mesas` no `@artificio/ui` `Header`. O estado "logado" do Header genérico renderiza só um `<a href="https://accounts.artificiorpg.com">` — **sem dropdown**. Resultado: o menu de conta/admin do mesas (Meu Perfil, Painel, Gestão, Sair) **sumiu**. Clicar no avatar navega direto para `accounts` (em vez de abrir o menu); e como o link não leva `return`, completar login lá retorna para `accounts` em vez do módulo. Afeta `mesas.artificiorpg.com` e `mesasbeta.artificiorpg.com`. Auth é sagrado — não pode haver regressão de sessão/UX.

## Requisitos
1. Logado, clicar no avatar **abre um dropdown** (não navega para fora).
2. O dropdown mostra, no `mesas`: **Meu Perfil** (`/perfil`), **Painel** (`/painel`), **Gestão** (`/gestao`, **só `role==='admin'`**), **Conta** (link externo para `accounts.artificiorpg.com`), **Sair**.
3. **Sair** faz logout real (limpa a sessão SSO no `accounts`) e redireciona para a **home do próprio módulo** (mesasbeta→mesasbeta, mesas→mesas).
4. O Header é genérico: aceita os itens de menu por prop (`userMenu`); módulos sem itens mostram ao menos **Conta** + **Sair**.
5. `@artificio/auth/client` expõe `logout(redirectTo?)` que chama `POST {accountsOrigin}/api/auth/logout` com `credentials: 'include'` e então redireciona.
6. Deslogado: comportamento atual preservado (botão **Entrar** → `redirectToLogin()` com `return` correto).
7. Acessibilidade: dropdown fecha com `Esc` e clique fora; `aria-haspopup`/`aria-expanded` no botão do avatar.
8. Sem regressão de marca (D040) nem de contraste AA.

## Critérios de aceite
- No `mesasbeta.` e `mesas.`: avatar logado abre dropdown; itens corretos; **Gestão** aparece só para admin.
- **Conta** abre `accounts.artificiorpg.com`; **Meu Perfil/Painel/Gestão** abrem rotas do módulo.
- **Sair** limpa a sessão (cookie `.artificiorpg.com`) e cai na home do módulo; após Sair, rota privada volta a `401`/login.
- Deslogado: **Entrar** redireciona para `accounts/login?return=<url do módulo>`; completar login volta ao módulo.
- accounts (que usa o mesmo Header) não quebra: mostra ao menos Conta + Sair quando logado.

## Fora de escopo
- Migrar a página `/perfil` (perfil de módulo) para accounts.
- Redesenhar o dropdown além de paridade + marca.
- Distinção de role `gm` (G1 SSO só tem `user|admin`; status de mestre é interno do mesas, fora do menu SSO).
- Outros módulos (glossário/site) — consomem o mesmo Header depois.

## Riscos e impacto
- **Auth sagrado:** `logout` mexe na sessão SSO compartilhada — não pode deslogar de forma parcial/inconsistente; cookie é `Domain=.artificiorpg.com`.
- `packages/ui` e `packages/auth` são compartilhados (consumidos por `accounts` + `mesas`): mudança no Header afeta todos — Header deve degradar bem sem `userMenu`.
- Deploy toca `packages/**` → redeploya `accounts` **e** `mesas` (prod) — exige validar ambos.
