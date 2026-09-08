# Plano — 020

## Arquitetura da solucao
Criar um **Theme Artificio padrao** em camadas. A fonte unica mora em `packages/ui`; apps consomem por import, CSS vars ou preset, conforme stack.

Camadas propostas:

1. **Token source**
   - Um objeto canonico em `packages/ui/src/tokens.ts`.
   - Tokens por papel, nao por contexto solto: `brand.navy`, `brand.accent`, `canvas`, `surface`, `surfaceAlt`, `text.primary`, `text.secondary`, `line`, `focus`, `success`, `warning`, `danger`, `info`, `dark.canvas`, `dark.surface`, `dark.surfaceAlt`, `dark.text`, `dark.line`.
   - Radius/shadow/spacing/fonte no mesmo contrato.

2. **Outputs derivados**
   - `packages/ui/src/styles.css`: CSS vars `--artificio-*`.
   - `packages/ui/tailwind-preset.js`: gerado ou mantido em paridade testavel com `tokens.ts`.
   - Exports static-friendly para Astro/site quando necessario, incluindo logo/header/footer quando forem parte do shell comum.

3. **Theme runtime**
   - Manter `packages/ui/src/theme.tsx` como fonte de `artificio_theme`.
   - Apps nao reimplementam localStorage/matchMedia/dataset.
   - `ThemeToggle`/lua-sol aparece apenas quando o app declara `darkReady`.

4. **Shell/nav/actions**
   - Nav base: glossario (`GlossarioHeader`) como referencia de composicao do `Header` compartilhado.
   - Header actions: mesas como referencia visual para changelog, notificacao, badge, dropdown e modal shell.
   - Dados e queries de notificacao/changelog ficam por app.

5. **Primitives e recipes**
   - Primitives pequenas: botao, campo, select, badge, panel/card, toolbar, filter panel, states, modal/drawer, header action.
   - Recipes por tipo de pagina: `PublicSearchPage`, `CatalogPage`, `AdminWorkspacePage`, `AuthPage`, `EditorialPage`, `DetailPage`.
   - Recipes guiam composicao; nao escondem regra de negocio.

6. **Brand/static parity**
   - Resolver dentro da mesma spec visual quando o problema for drift de marca/shell: `brand.json`, logos Astro, Header/Footer Astro e classes static.
   - Nao mover assets de dominio, como logos de sistemas/VTT do mesas.

## Fronteiras
### O que entra no theme
- Cores comuns e papeis semanticos.
- Dark/light e lua/sol.
- Fonte, radius, spacing, shadow.
- Estados visuais comuns.
- Primitives UI comuns.
- Estrutura de header/nav/actions.
- Recipes de pagina como guia/composicao.

### O que nao entra no theme
- Regra de negocio.
- Fetch/auth/session.
- Payload de API.
- Copy contextual de cada produto.
- Layout editorial especifico do site alem de tokens/classes comuns.
- Assets de dominio (logos de sistemas, VTT, imagens de mesas).
- Decisoes de produto sobre quais acoes aparecem no header.

## Arquivos afetados (por modulo/pacote)
Implementacao futura deve tocar, em fases:

- `packages/ui/src/tokens.ts`
- `packages/ui/src/styles.css`
- `packages/ui/tailwind-preset.js`
- `packages/ui/src/theme.tsx`
- `packages/ui/src/Header.tsx`
- novos arquivos possiveis em `packages/ui/src/`: `primitives/*`, `recipes/*`, `theme-contract.ts`, `theme.css`
- consumidores piloto:
  - `apps/accounts/frontend/src/*`
  - `apps/glossario/frontend/src/*`
  - `apps/mesas/frontend/src/*`
  - `apps/site/src/styles/global.css` e componentes Astro de shell
  - `apps/site-admin/src/*`

Esta montagem da spec nao altera esses arquivos.

## Contratos/interfaces tocados
- `@artificio/ui/tokens`
- `@artificio/ui/styles.css`
- `@artificio/ui/tailwind-preset`
- `@artificio/ui/theme`
- `Header`/`Footer` e futuras primitives UI
- Contrato static-friendly para Astro/site

Nao toca:
- `@artificio/auth`
- banco/schema
- CI/CD/deploy
- DNS/Cloudflare/VM
- WordPress raiz

## Impacto em consumidores
- **accounts:** remover helpers locais de tema e consumir `@artificio/ui/theme`; preservar tela SSO compacta como `AuthPage`.
- **glossario:** virar base clara do theme; migrar classes/tokens locais por etapas; avaliar dark readiness antes do toggle.
- **mesas:** manter variante escura operacional; aproveitar estilo de actions/changelog/notificacao como origem visual; mapear tokens escuros para o contrato.
- **site:** continuar Astro/zero-JS; consumir CSS vars/classes e manter Header/Footer Astro ou camada static com teste de paridade.
- **site-admin:** candidatar forms/tabelas/botoes/admin shell a primitives comuns, sem acoplar ao dominio do site.
- **futuros apps:** usar theme desde o inicio, evitando novo drift.

## Decisoes necessarias antes de codigo
1. **Paleta canonica:** confirmar se a base glossario (`#1a2744`/`#e85d26`) substitui D040 ou se vira alias/aproximacao sobre os tokens D040.
2. **Nivel de static export para Astro:** espelho com teste de paridade ou export static oficial em `packages/ui`.
3. **Escopo da primeira entrega:** recomendacao = tokens + theme runtime + accounts/glossario/mesas pilots; primitives/page recipes em fase seguinte.
4. **Dark readiness:** definir checklist minimo antes de exibir lua/sol por app.

## Rollout recomendado
1. **Fase A — decisao e mapa**
   - Mapear tokens atuais por app.
   - Validar contraste AA.
   - Registrar decisao de marca.

2. **Fase B — fonte unica**
   - Ajustar `tokens.ts`, CSS vars e Tailwind preset em paridade.
   - Adicionar teste/paridade para evitar drift.
   - Incluir decisao sobre `brand.json`/logos/static shell do site: export static oficial ou teste de espelho.

3. **Fase C — theme runtime**
   - Consolidar consumo de `@artificio/ui/theme`.
   - Accounts piloto: remover duplicacao local sem alterar fluxo SSO.

4. **Fase D — header/nav/actions**
   - Nav base glossario.
   - Shell visual de header actions inspirado no mesas.
   - Dados ficam nos apps.

5. **Fase E — primitives minimas**
   - `Button`, `Field`, `Select`, `Badge`, `Panel`, states, modal/drawer shell.
   - Migrar apenas pontos com duplicacao clara.

6. **Fase F — recipes**
   - Documentar/montar recipes por tipo de pagina.
   - Nao forcar migracao total.

## Rollback
- Como a implementacao futura sera por fases, rollback deve ser por app/pacote:
  - Reverter commit de tokens se quebrar build/visual global.
  - Manter aliases temporarios para nomes antigos durante rollout.
  - `ThemeToggle` deve poder ser desligado por prop/flag por app.
  - Site Astro deve poder continuar com CSS local se export static falhar.

## Validacao
- `pnpm --filter @artificio/ui build`
- `pnpm --filter @artificio/ui test` se houver teste do pacote
- builds dos consumidores tocados em cada fase
- smoke visual local em desktop/mobile para accounts, glossario, mesas e site beta quando tocados
- contraste AA para texto/foco/disabled nos estados principais
- busca por hex antigo divergente apos cada fase
- busca por reimplementacoes de `artificio_theme`
- `git status --short` antes de fechar cada sessao

## Ordem recomendada para primeira implementacao
1. Decisao de paleta + mapa de tokens.
2. Paridade `tokens.ts` ↔ `styles.css` ↔ `tailwind-preset.js`.
3. Accounts consumindo `@artificio/ui/theme`.
4. Glossario como piloto light.
5. Mesas como piloto dark/header actions.
6. Site Astro com paridade static, sem React obrigatorio.
