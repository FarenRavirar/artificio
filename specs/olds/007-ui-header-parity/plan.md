# Plano — 007 (CDX-314)

## Arquitetura

### `packages/ui/Header.tsx`
- Nova prop `moduleNav?: NavItem[]`. Quando presente, render 2ª `<Nav>` com classe `artificio-subnav` abaixo do header principal (ou 2ª linha do grid).
- Nova prop `sticky?: boolean` (default `true`). Aplica classe/atributo p/ `position: sticky`.
- Estrutura responsiva: abaixo do breakpoint, navs colapsam em botão hambúrguer (`useState(menuOpen)`, Esc/clique-fora, aria-expanded). Reaproveita a lógica de fora-clique do dropdown.
- Layout: como o header vira 2 linhas (portal nav + subnav) só no mesas, considerar wrapper `artificio-header-shell` com sticky e duas faixas; manter `.artificio-header` como faixa principal.

### `packages/ui/styles.css`
- `.artificio-header-shell { position: sticky; top:0; z-index:50; backdrop-filter: blur(8px); box-shadow: ... }` (fundo opaco navy no dark).
- `.artificio-subnav` faixa secundária (borda sutil, mesmos tokens nav).
- Mobile (`@media max-width: 860px`): esconder navs inline, mostrar `.artificio-menu-toggle`; painel colapsável.
- Garantir contraste AA no dark.

### `packages/ui/Nav.tsx`
- Reutilizável p/ portal e module nav (já genérico). Opcional: variante visual via prop/className.

### `apps/mesas`
- `AppShell`: passar `moduleNav={[{label:'Início',href:'/'},{label:'Catálogo',href:'/catalogo'},{label:'Painel',href:'/painel'}]}` + `currentHref` da rota ativa (usar `useLocation`).
- Login copy "Entrar com Google": vem do Header genérico (botão). Ajustar label no Header (vale p/ todos módulos — texto neutro? "Entrar com Google" é específico Google; SSO é Google → OK manter).
- Remover `components/SiteHeader.tsx` e `components/SiteFooter.tsx` após confirmar zero imports.

## Arquivos afetados
- `packages/ui/src/Header.tsx` — moduleNav + sticky + mobile toggle + login copy.
- `packages/ui/src/styles.css` — shell sticky/blur/shadow, subnav, mobile menu.
- `packages/ui/src/index.ts` — exports se novos tipos.
- `apps/mesas/frontend/src/components/AppShell.tsx` — moduleNav + currentHref.
- `apps/mesas/frontend/src/components/SiteHeader.tsx`, `SiteFooter.tsx` — **remover**.
- Testes ui (render subnav, sticky class, mobile toggle).

## Contratos
- `@artificio/ui` Header: +`moduleNav?`, +`sticky?` (opcionais, retrocompat). accounts inalterado.
- Sem mudança de auth/cookie/JWT.

## Impacto consumidores
- accounts: sem `moduleNav`/sticky default true → ganha sticky (revalidar visual login).
- Deploy `packages/**` → accounts + mesas (prod) + beta mesas.

## Rollback
- Reverter via git/PR. Props opcionais; remover dead code é seguro (sem imports).

## Validação
1. Build turbo + unit ui.
2. Beta (`dev`): mesasbeta mostra 2 navs, sticky, mobile menu, "Entrar com Google", changelog/sino/menu intactos.
3. accounts beta/local: header ok sem moduleNav.
4. FF prod após beta OK; revalidar mesas+accounts.

## Follow-up (fora desta spec)
- Unificar sessão: fazer `useAuth` do mesas derivar de `@artificio/auth` (1 fonte) — spec própria; risco (16 usos).
