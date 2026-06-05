# 007 — Paridade do Header genérico (CDX-314)

- **Módulo/Pacote:** `packages/ui` (Header/Nav/styles) + `apps/mesas` (consumidor + limpeza)
- **Gate relacionado:** D (mesas) — fecha paridade do header pós-CDX-311; padrão reusável (glossário/site)

## Problema
CDX-311 trocou o header rico do mesas pelo `@artificio/ui` Header genérico (modelo suite). CDX-312 restaurou o menu de conta; CDX-313 restaurou changelog+sino. Restam lacunas de paridade/UX e o genérico ainda não dá aos módulos tudo que precisam:
- Header só tem **um** nav (cross-módulo do portal). Rotas internas do mesas (**Início/Catálogo/Painel**) sumiram do topo — Catálogo só por CTA/footer.
- Header **não é sticky** (some no scroll); legado era sticky + blur + shadow.
- Sem **menu mobile** para nav longo.
- Login diz "Entrar" (legado "Entrar com Google").
- **Dead code:** `apps/mesas/.../SiteHeader.tsx` e `SiteFooter.tsx` legados continuam no repo, substituídos pelo `@artificio/ui`.

## Requisitos
1. Header genérico aceita **nav secundário de módulo** (`moduleNav?: NavItem[]`): quando presente, renderiza 2ª linha abaixo do nav do portal (topo = cross-módulo; baixo = rotas do módulo). Sem `moduleNav` = comportamento atual (1 nav).
2. `mesas` passa `moduleNav` = Início (`/`), Catálogo (`/catalogo`), Painel (`/painel`), com `aria-current` na rota ativa.
3. Header é **sticky** (`position: sticky; top:0`) com z-index acima do conteúdo, fundo opaco/blur e shadow sutil; não cobre conteúdo (offset correto).
4. **Menu mobile:** abaixo de um breakpoint, os navs colapsam num botão (hambúrguer) acessível (aria-expanded, Esc/clique-fora, foco).
5. Login deslogado = **"Entrar com Google"** (copy).
6. Remover dead code `SiteHeader.tsx` + `SiteFooter.tsx` de `apps/mesas` (confirmado sem uso).
7. Sem regressão de marca (D040), contraste AA, nem das features CDX-312/313 (menu, changelog, sino).

## Critérios de aceite
- No `mesas`: header mostra 2 navs (portal + módulo); Catálogo/Painel/Início clicáveis; ativo destacado.
- Header fixo ao rolar (sticky), sem sobrepor conteúdo; legível sobre o app (dark).
- Em viewport mobile: navs viram menu colapsável funcional e acessível.
- Botão login = "Entrar com Google".
- `SiteHeader.tsx`/`SiteFooter.tsx` removidos; build/lint sem refs quebradas.
- accounts (usa Header sem `moduleNav`) inalterado.
- CDX-312 (menu) + CDX-313 (changelog/sino) seguem funcionando.

## Fora de escopo
- Unificar fonte de sessão (`useSession` do Header vs `useAuth` do mesas) — **follow-up separado** (R: risco/consistência de role); aqui só garantir que não regride.
- Redesign de marca/logo (D040 mantém).
- Nav de glossário/site (consomem `moduleNav` quando entrarem).
- Backend de changelog/notificações.

## Riscos e impacto
- `packages/ui` compartilhado (accounts+mesas): `moduleNav`/sticky/mobile opcionais e retrocompatíveis; accounts sem `moduleNav` não muda.
- Sticky/z-index pode conflitar com modais/overlays do app — validar (ChangelogModal usa portal; OK).
- Remoção de dead code: confirmar zero imports antes (grep).
- Deploy toca `packages/**` → redeploy accounts+mesas (prod) e beta mesas.
- **Dívida anotada:** dupla fonte de sessão (Header `@artificio/auth useSession` × mesas `useAuth`); role precisa concordar (gating Gestão). Tratar em follow-up.
