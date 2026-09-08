# Header, nav e actions

> Spec 020 T6/B3. Estado em 2026-06-15: contrato base existe em `@artificio/ui`; `HeaderAction` visual-only foi implementado/exportado por B3.

## Decisoes vigentes

- D043: menu de conta no `Header` e contrato `userMenu`.
- D058: `@artificio/ui` `Header`/`Footer` sao shell unico; apps entram por props (`navItems`, `moduleNav`, `userMenu`, `actions`, `sessionOverride`).
- D063: UI publica fala "projetos"; termo "modulo" fica tecnico.
- D067: tema lua/sol usa cookie compartilhado. Toggle habilitado como **opt-in** (defaults inalterados: glossario light, mesas dark). glossario/mesas ja estao em prod com o toggle; a variante das telas auth-gated (com dados) ainda esta pendente de E2E — por isso a variante e opt-in por clique, nao default.

## Contrato atual

Fonte: `packages/ui/src/Header.tsx`, `Nav.tsx`, `modules.ts`, `styles.css`.

`HeaderProps` estavel:

- `navItems`: nav cross-projetos. Default = `defaultNavItems`.
- `currentHref`: item ativo do nav cross-projetos.
- `moduleNav`: nav interno do projeto, renderizado na segunda linha.
- `moduleCurrentHref`: item ativo do nav interno.
- `variant`: `light | dark`, troca logo/cores.
- `sticky`: header fixo no topo ao rolar (default `true`).
- `brandHref`: destino do logo.
- `userMenu`: menu de conta; `adminOnly` filtrado pelo `Header`; `Sair` sempre adicionado.
- `actions`: slot de acoes do projeto antes da sessao.
- `sessionOverride`: adaptador para app que ja resolveu sessao fora do hook padrao.
- `onLogout`, `onLoginClick`, `loginLabel`: handlers de auth por app.
- `showThemeToggle`: conveniencia que renderiza o `ThemeToggle` embutido. **Atualmente NAO usado por nenhum app** (`grep showThemeToggle apps` = vazio). So serve a app que NAO troca o logo por `variant`, porque o `ThemeToggle` embutido nao coordena o `variant` (logo navy<->negativo).

`NavItem` continua minimo: `{ label, href }`. Nao levar icone, badge ou regra de permissao para o nav base sem necessidade real.

### Padrao vivo do toggle lua/sol (glossario/mesas, em prod)

Os dois pilotos NAO usam `showThemeToggle`. O padrao canonico em produçao = **toggle injetado via `actions` + `variant` reativo**, porque o app precisa trocar o logo (navy<->negativo) junto do tema:

```tsx
const [theme, setThemeState] = useState<Theme>(() => /* boot: resolveTheme() ou dataset.theme */);
const themeBtn = (
  <button className="artificio-header-action" aria-label="Alternar tema"
    onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); setThemeState(next); }}>
    <ThemeIcon theme={theme} />
  </button>
);
<Header variant={theme} actions={<>{themeBtn}<HeaderActions/></>} />
```

`setTheme` (de `@artificio/ui/theme`) escreve o cookie compartilhado; o estado local re-renderiza p/ atualizar `variant`/icone. Implementar via `showThemeToggle` aqui quebraria a logo no dark.

## Fronteira das actions

O `Header` fornece o slot e CSS:

- `.artificio-header-actions`
- `.artificio-header-action`
- `.artificio-header-action-badge`

Cada app mantem dados e comportamento:

- fetch de notificacoes;
- chamada de changelog;
- fila/contador/badge;
- permissao de admin;
- rotas internas;
- modal de dominio;
- telemetria/contexto.

Nao mover essas queries para `packages/ui`: isso acoplaria regra de negocio ao shell visual.

## Inventario atual

| App | Nav | Actions | Estado |
|---|---|---|---|
| `mesas` | `defaultNavItems` + `moduleNav` (`Inicio`, `Catalogo`, `Painel`) | tema, changelog com badge, notificacoes logado; feedback flutuante fora do header | Melhor referencia visual de actions. Manter dados no app. |
| `glossario` | `defaultNavItems`, sem `moduleNav` por enquanto | tema, adicionar sugestao logado, changelog com badge simples | Usa shell correto. Pode ganhar `moduleNav` se houver rotas publicas internas suficientes. |
| `site` Astro | Espelho static de `defaultNavItems` + `SECTIONS` do blog | busca, tema, login/session link | Excecao zero-JS. Paridade static fica em T9/T11. |
| `accounts` | Nao usa `Header`; tela de login e shell compacto | tema na propria tela | OK por ser servico de auth, nao app de conteudo. |

## API `HeaderAction`

`HeaderProps` segue estavel. B3 adicionou um helper pequeno para actions:

```ts
export interface HeaderActionProps {
  label: string;
  title?: string;
  badge?: boolean | number;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
}
```

Regra:

- `HeaderAction` renderiza somente botao/link visual com aria, badge e classes padrao.
- `HeaderActionsGroup` e opcional; apenas organiza gap/ordem se o slot cru virar repetitivo.
- `ChangelogAction`, `NotificationBell`, `FeedbackButton` e modais seguem por app ate existir duplicacao real em 2+ apps. ~~(Executado: wrappers de changelog consolidados na spec 051 — `StaticChangelogModal` aceita `rawChangelogs`; site+links consomem direto; mesas/glossario permanecem mínimos.)~~
- O feedback de desenvolvimento do mesas vira feature compartilhavel futura (D-FEEDBACK1), mas nao entra em T6 porque envolve backend, storage e privacidade por app.

## Ordem visual recomendada

1. Tema lua/sol, quando o app precisa coordenar `variant` manualmente.
2. Busca ou acao primaria contextual.
3. Changelog/notas de atualizacao.
4. Notificacoes.
5. Sessao/avatar/login.

No mobile, manter icon-only com `aria-label` e `title`. Texto fica reservado para login/avatar/menu.

## Rollback

- Como `actions` e slot externo, rollback e remover a action do consumidor.
- Se `HeaderAction` quebrar visual, app volta para `<button className="artificio-header-action">`.
- Se `moduleNav` poluir mobile, app remove `moduleNav` sem afetar nav cross-projetos.
- Se paridade Astro quebrar, `site` continua com `SiteHeader.astro` local e CSS comum.

## Validacao

- `rg "<Header|moduleNav|actions=|userMenu|artificio-header-action"` confirma consumidores.
- Build do app tocado quando houver codigo.
- Smoke desktop/mobile: nav cross-projetos, subnav, actions, avatar/login e menu hamburger.
- Acessibilidade: `aria-label` em icon-only; `aria-current` no nav ativo; `Escape` fecha menus/modais relevantes.

## Resultado T6

T6 esta fechado como especificacao: nav base, subnav, user menu e action slot existem; fronteiras foram documentadas. B3 fechou `HeaderAction` visual-only sem mover regra de negocio para `packages/ui`.
