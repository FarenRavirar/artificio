# Plano — 006 (CDX-312)

## Arquitetura da solução

### `packages/auth/src/client.ts` — `logout()`
```ts
export function logout(redirectTo = window.location.origin): void {
  void fetch(`${getAccountsOrigin()}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).finally(() => window.location.assign(redirectTo));
}
```
- accounts `POST /api/auth/logout` (já existe, `app.ts:122`) limpa o cookie `Domain=.artificiorpg.com`.
- `redirectTo` default = origin atual = home do módulo (atende R3).

### `packages/ui/src/Header.tsx` — dropdown
- Nova prop:
  ```ts
  export interface UserMenuItem { label: string; href: string; external?: boolean; variant?: "default" | "danger"; }
  // HeaderProps: userMenu?: UserMenuItem[]
  ```
- Logado: avatar vira `<button aria-haspopup="menu" aria-expanded>` com `useState(open)`.
- Dropdown: lista `userMenu` (links; `external` abre accounts) + sempre **Sair** (chama `logout()` do client com home do módulo).
- Se `userMenu` vazio: mostra só **Conta** (accounts) + **Sair**.
- Fechar: `Esc` (keydown) + clique fora (listener no document, cleanup no unmount).
- Marca/estilos no `index.css`/tokens (D040), contraste AA.

### `apps/mesas` frontend — montar `userMenu`
- A partir de `useSession()`:
  - `{ label: "Meu Perfil", href: "/perfil" }`
  - `{ label: "Painel", href: "/painel" }`
  - se `user.role === "admin"`: `{ label: "Gestão", href: "/gestao", variant: "danger?" }`
  - `{ label: "Conta", href: getAccountsOrigin(), external: true }`
- Passar `userMenu` ao `<Header>`. Sair: Header usa `logout(window.location.origin)`.
- Rotas `/perfil`, `/painel`, `/gestao` já existem no mesas (React Router) — só linkar.

## Arquivos afetados
- `packages/auth/src/client.ts` — `logout()` (+ export em `index.ts` se aplicável).
- `packages/ui/src/Header.tsx` — dropdown + prop `userMenu`.
- `packages/ui/src/index.css` (ou equivalente) — estilos do dropdown.
- `packages/ui/src/index.ts` — export do tipo `UserMenuItem` se público.
- `apps/mesas/frontend/src/**` — onde o `<Header>` é montado (montar `userMenu`).
- Testes: `packages/ui` (render dropdown, gating admin), `packages/auth` (logout chama endpoint+redirect).

## Contratos/interfaces tocados
- **auth:** novo `logout()` no client; usa endpoint accounts existente. Sem mudar cookie/JWT.
- **`@artificio/ui` Header:** nova prop opcional `userMenu` (retrocompatível — accounts sem prop ainda funciona).

## Impacto em consumidores
- `accounts` usa o Header → deve continuar OK sem `userMenu` (mostra Conta+Sair). Validar.
- Deploy `packages/**` → redeploy `accounts` + `mesas` (prod) e beta do mesas.

## Rollback
- Reverter os 3 arquivos via git/PR. Header volta ao link puro (estado atual). Sessão não afetada (logout é aditivo).

## Validação
1. Unit: dropdown abre/fecha (Esc/fora); Gestão só admin; logout chama POST + redirect.
2. Build turbo 7/7.
3. Beta (`dev`) primeiro: E2E no `mesasbeta.` — avatar→dropdown, itens, Conta→accounts, Sair→home+401.
4. Promoção a prod (FF) só após beta OK; revalidar `mesas.` + `accounts.`.
