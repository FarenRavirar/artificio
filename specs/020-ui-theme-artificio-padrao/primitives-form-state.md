# Primitives de formulario e estado

> Spec 020 T7/B4. Estado em 2026-06-13: `@artificio/ui` ainda nao tem primitives; este arquivo fecha a especificacao minima e separa implementacao futura.

## Diagnostico

Hoje `packages/ui/src` contem shell, tokens, nav, tema e marca. Nao existem `Button`, `Field`, `Select`, `Badge`, `Panel`, `Toolbar`, `FilterPanel`, `State`, `Modal` ou `Drawer` compartilhados.

Exemplos vivos:

- `mesas`: tem `MetaField` (wrapper de campo), `CatalogToolbar`, `FilterDrawer`, `LoadingState`, `ErrorState`, `FeedbackModal`, `SystemSuggestionModal`; visual dark-first e rico em estados.
- `glossario`: repete inputs/selects/buttons/modais em `AddTermModal`, filtros e telas admin; visual light-first com remap dark da Spec 020.
- `site-admin`: tem CSS proprio (`.btn`, `.card`, `label`, `input`, `.badge`, `.modal`) para editor editorial.
- `accounts`: tela compacta de auth; nao precisa puxar primitives antes de `AuthPage`.

Conclusao: ha duplicacao suficiente para especificar primitives, mas ainda nao e seguro mover codigo agora. Implementar em `packages/ui` toca pacote compartilhado e exige fatia propria com builds/smokes dos consumidores.

## Principios

- Primitive e visual/comportamental leve, nao carrega dominio.
- Regra de negocio, fetch, normalizacao, permissao, rotas e copy ficam no app.
- Preferir composicao por `children` e props pequenas.
- Variantes devem mapear papeis de token, nao classes arbitrarias.
- Comecar por componentes de baixa opiniao; nao forcar migracao em telas complexas do mesas/glossario.

## Contratos propostos

### Button

Uso: CTA, submit, cancelar, link visual, botao de toolbar.

Props:

```ts
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg" | "icon";
```

Regras:

- `primary`: acento/brand quando a acao e principal; texto com contraste AA.
- `secondary`: superficie + borda.
- `ghost`: sem borda forte, para toolbar.
- `danger`: destructive/arquivar/excluir.
- `success`: salvar/aprovar quando o contexto exige cor positiva.
- Suporta `disabled`, `loading`, `leftIcon`, `rightIcon`.
- Pode renderizar `button` ou `a`, mas sem roteador interno.

### Field

Uso: wrapper de label/hint/error para `input`, `textarea`, `select` e componentes custom.

Props:

```ts
interface FieldProps {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}
```

Regras:

- `label` sempre associado ao controle por `htmlFor` quando houver `id`.
- `error` usa `aria-describedby`/`aria-invalid` no controle consumidor.
- `required` visual nao substitui validacao.

### TextInput, Textarea, Select

Uso: controles basicos, sem mascaras ou busca.

Regras:

- Variantes `light`/`dark` derivam de tokens, nao de app.
- Suportam `invalid`, `disabled`, `placeholder`, `size`.
- `Select` nativo primeiro; `SearchableSelect` e tree-select ficam por app ate duplicacao real.
- Nada de normalizacao de payload dentro da primitive.

### Badge

Uso: status, tipo, tag pequena, contador.

Variants:

- `neutral`
- `brand`
- `success`
- `warning`
- `danger`
- `info`

Regras:

- Nao codificar status de dominio (`draft`, `published`, `system`, `gm`) na primitive.
- App mapeia status -> variant.

### Panel

Uso: card/painel/bloco de formulario/lista.

Props:

```ts
type PanelTone = "default" | "subtle" | "elevated" | "danger" | "warning";
```

Regras:

- Evitar nested cards.
- `header`, `actions`, `footer` sao slots.
- `as="section" | "article" | "div"` para semantica.

### Toolbar

Uso: linha de busca, filtros, contagem, acoes.

Regras:

- Apenas layout e responsividade.
- Busca/filtros/contagem entram por slots.
- Nao conhece query string nem API.

### FilterPanel

Uso: agrupamento de filtros desktop.

Regras:

- `title`, `children`, `footer`, `onClear`.
- Chips/controles ficam por composicao.
- Drawer mobile separado.

### State

Uso: loading, empty, error, success.

Componentes:

- `LoadingState`
- `EmptyState`
- `ErrorState`
- `SuccessState`

Props comuns:

```ts
interface StateProps {
  title?: string;
  message?: string;
  action?: React.ReactNode;
  variant?: "page" | "panel" | "inline";
}
```

Regras:

- `ErrorState` recebe texto do app; nao traduz erro tecnico automaticamente.
- Loading pode ser `spinner`, `skeleton` ou `inline`.
- Empty state nao sugere acao de dominio sem `action`.

### Modal

Uso: dialog geral, formulario curto, confirmacao.

Regras:

- Acessivel: `role="dialog"`, `aria-modal`, titulo por `aria-labelledby`, fecha com `Escape`, backdrop opcional.
- Nao incluir form/fetch; recebe `children`, `footer`, `onClose`.
- Portal opcional; apps SPA podem usar `createPortal`, Astro nao.

### Drawer

Uso: filtro mobile, painel lateral, revisao.

Regras:

- `side="right" | "left" | "bottom"`.
- Safe-area mobile.
- Trava scroll/foco so quando implementado com teste.
- Conteudo por `children`; nada de filtro acoplado.

### HeaderAction

Definido em `header-nav-actions.md`. Entra junto com primitives, mas continua visual-only.

## Fora de escopo

- `SearchableSelect`, tree selector, editor BlockNote, upload de imagem, screenshot de feedback, notificacao com fetch, changelog com API, tabela admin, editor SEO completo.
- Componentes que dependem de backend ou schema do app.
- Migracao massiva de telas existentes numa so PR.

## Dependencias (pre-requisito de tokens)

Varias variantes deste contrato dependem de **tokens semanticos canonicos que ainda NAO existem em `packages/ui`**:

- `Button` variants `danger`, `success`;
- `Badge` variants `success`, `warning`, `danger`, `info`;
- `Panel` tones `danger`, `warning`;
- `State` `SuccessState`/`ErrorState`.

Hoje `success/warning/danger/info` so existem **locais no mesas** (`apps/mesas/.../index.css`: `--success/--warn/--danger/--info`); `tokens.ts`/`styles.css`/`tailwind-preset.js` nao tem esses papeis (so ha a classe one-off `.artificio-usermenu-item-danger`). O `token-contract.md` lista "estados semanticos completos (`success`, `warning`, `danger`, `info`)" como **fora do fechamento T3 (futuro)**.

**Regra de ordem:** landar os tokens semanticos canonicos (`tokens.ts` + CSS vars + preset + entrada na trava `check-token-parity.mjs`, ancorados nos valores do mesas) **antes** de implementar as variantes coloridas acima. As primitives neutras (`primary`/`secondary`/`ghost`, `neutral`/`brand`, `default`/`subtle`/`elevated`) nao dependem disso e podem vir primeiro.

## Ordem de implementacao futura

0. **Pre-requisito:** tokens semanticos canonicos (`success/warning/danger/info`) em `packages/ui` + trava de paridade (ver Dependencias). Bloqueia as variantes coloridas de `Button`/`Badge`/`Panel`/`State`.
1. `Button` (neutras), `Field`, `TextInput`, `Textarea`, `Select`, `Badge` (`neutral`/`brand`); variantes semanticas so apos o passo 0.
2. `Panel`, `Toolbar`, `State`.
3. `Modal`, `Drawer`, `HeaderAction`.
4. Piloto pequeno: `site-admin` ou uma tela admin do glossario.
5. Depois migrar pontos do mesas onde a duplicacao for clara.

## Validacao futura

- `pnpm --filter @artificio/ui build`.
- Build do app piloto.
- Smoke desktop/mobile do app piloto.
- Contraste AA em light/dark.
- Focus visible, disabled, loading e error states.
- `rg` confirmando que primitives nao importam API/fetch/auth/router de app.

## Resultado T7/B4

T7 fecha como especificacao minima. B4 fica parcial: contrato pronto, implementacao em `packages/ui` pendente para T14/fatia propria, porque shared code exige SDD Completo e smoke de consumidores.
