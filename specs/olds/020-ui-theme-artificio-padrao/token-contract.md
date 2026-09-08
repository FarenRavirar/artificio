# Contrato de Tokens — Spec 020

> Fonte canonica para fechar T3. Este contrato descreve o que ja esta em `dev` e como novos consumidores devem usar os tokens sem criar drift.

## Fonte unica

`packages/ui/src/tokens.ts` e a fonte TS canonica.

Saidas obrigatorias em paridade:
- `packages/ui/src/styles.css` — CSS vars `--artificio-*`, usadas por SPAs e pelo site Astro/zero-JS.
- `packages/ui/tailwind-preset.js` — classes Tailwind `artificio.*`, usadas por apps Tailwind.

Trava:
- `node packages/ui/scripts/check-token-parity.mjs`
- Hoje valida (31 papeis, 2026-06-13): `ink`, `brand`, `brandDeep`, `focus`, `muted`, `line`, `surface`, `canvas`, `charcoal`, `navy`, `bronze`; semanticos `success`/`successText`/`warning`/`warningText`/`danger`/`dangerText`/`info`/`infoText` (3-way); superficies estruturadas `darkCanvas`/`darkSubtle`/`darkSurface`/`darkStrong`/`darkText`/`darkMuted` + `lightCanvas`/`lightSubtle`/`lightSurface`/`lightStrong`/`lightInk` (2-way tokens×styles, sem preset).
- `navy` entrou na trava (2026-06-13): virou cross-app de verdade com os pilotos lua/sol (D065/D066 usam `#1B2A4A` como superficie dark canonica). Compara `tokens.ts` x `styles.css`; nao tem alias no preset (`preset=null` nao compara).
- **Semanticos + superficies dark/light landed e consumidos (B11/B10b, 2026-06-13, SDD Completo):** semanticos ancorados no mesas com variante `*Text` escurecida p/ AA sobre claro (licao do bug B7); superficies dark ancoradas no glossario (D065), light no mesas (D066). `darkSurface` = `navy`. CSS dos pilotos agora consome esses tokens: `apps/glossario/frontend/src/index.css` (`--artificio-dark-*`) e `apps/mesas/frontend/src/{index.css,pages/MestrePage.css}` (`--artificio-light-*`).
- Qualquer token adicionado em mais de uma saida deve entrar na trava de paridade no mesmo patch.

## Papeis canonicos

| Papel | TS | CSS var | Tailwind | Uso |
|---|---|---|---|---|
| texto principal / navy marca | `color.ink` | `--artificio-ink` | `artificio.ink` | texto sobre claro, wordmark, botao navy |
| texto secundario | `color.muted` | `--artificio-muted` | `artificio.muted` | texto auxiliar AA sobre claro |
| borda leve | `color.line` | `--artificio-line` | `artificio.line` | bordas, divisorias |
| superficie clara | `color.surface` | `--artificio-surface` | `artificio.surface` | cards, menus, paineis claros |
| canvas claro | `color.canvas` | `--artificio-canvas` | `artificio.canvas` | fundo de pagina claro |
| superficie escura neutra | `color.charcoal` | `--artificio-charcoal` | `artificio.charcoal` | fundo escuro alternativo |
| superficie navy escura | `color.navy` | `--artificio-navy` | sem alias Tailwind (na trava de paridade: `tokens.ts` x `styles.css`) | header/footer dark, hero/app dark; nao e cor de marca |
| acento marca | `color.brand` | `--artificio-brand` | `artificio.brand` | acento, CTA, borda ativa, badge; nao usar como texto pequeno sobre branco |
| acento hover/pressed | `color.brandDeep` | `--artificio-brand-deep` | `artificio.brand-deep` | hover, pressed, foco forte |
| secundario decorativo | `color.bronze` | `--artificio-bronze` | `artificio.bronze` | detalhe visual pontual |
| foco | `color.focus` | `--artificio-focus` | `artificio.focus` | `focus-visible`, anel/outline |
| fonte display | `font.display` | `--artificio-font-display` | `font-display` via preset | titulos/wordmark |
| fonte corpo | `font.sans` | `--artificio-font-sans` | `font-sans` via preset | UI e texto comum |
| radius pequeno | `radius.sm` | ainda sem CSS var | ainda sem alias | ajuste local pequeno |
| radius UI | `radius.md` | ainda sem CSS var | `rounded-ui` | cards/botoes/inputs comuns |

## Aliases temporarios por app

Aliases existem para migracao gradual. Nao criar novos sem registrar aqui.

| App | Alias | Fonte | Motivo |
|---|---|---|---|
| `apps/site` | `--accent`, `--accent-deep` | `var(--artificio-brand)`, `var(--artificio-brand-deep)` | Astro usa CSS local/zero-JS; alias preserva estilo editorial. |
| `apps/mesas` | `--color-artificio-orange`, `--color-artificio-orange-hover` | `var(--artificio-brand)`, `var(--artificio-brand-deep)` | Tailwind v4 local usa `@theme`; evita hex duplicado nos componentes. |
| `apps/glossario` | `--color-brand-accent` | `var(--artificio-brand)` | Tailwind v3 + CSS legado; dark remap consome o mesmo acento. |
| `apps/accounts` | `--accounts-brand`, `--accounts-brand-deep` | hex local espelhado `#ff5722/#e64a19` | app nao importa `@artificio/ui/styles.css`; manter 1 definicao local ate consolidacao T5. |
| `apps/site-admin` | `--orange` | hex local espelhado `#ff5722` | admin isolado; migrar para vars compartilhadas em primitives/recipes. |
| `apps/glossario` Tailwind | `laranja` | `#FF5722` | Tailwind v3 precisa literal para gerar utilities/opacidades. |
| `apps/glossario` export Excel | ARGB `FFFF5722` | literal | formato de arquivo exige ARGB, nao CSS var. |

## Regras de uso

- Preferir papel semantico (`ink`, `surface`, `line`, `brand`) em vez de hex.
- Laranja `brand` e acento, nao cor de texto de corpo sobre branco.
- `color.navy`/`--artificio-navy` e superficie escura, nao substituir `ink`.
- App que importa `@artificio/ui/styles.css` deve aliasar para `--artificio-*`, nao copiar hex.
- App que ainda nao importa `styles.css` pode ter 1 alias local temporario; registrar acima.
- Novo token cross-app precisa aparecer em `tokens.ts`, CSS vars/preset quando aplicavel, e no parity script.

## Fora do fechamento T3

Estes itens continuam em tarefas futuras da Spec 020:
- ~~estados semanticos completos (`success`, `warning`, `danger`, `info`)~~ — **FEITO (B11, 2026-06-13)**: `success/warning/danger/info` (+`*Text`) em tokens.ts/styles.css/preset/trava.
- ~~tokens dark estruturados~~ — **FEITO (B10b, 2026-06-13)**: `darkCanvas/Subtle/Surface/Strong/Text/Muted` + `lightCanvas/Subtle/Surface/Strong/Ink` em tokens.ts/styles.css/trava; consumo migrado nos remaps dark/light de glossario/mesas.
- spacing e shadow completos (ainda futuro; nao no criterio do B11);
- primitives/recipes que consomem esses tokens (B4 — desbloqueado pelo B11).

### Planejamento — tokenizar superficies dark/light ad-hoc dos pilotos (D065/D066)

Os remaps dos pilotos lua/sol introduziram superficies dark/light **fora dos tokens**, repetidas por app:
- glossario dark (`apps/glossario/.../index.css`): canvas `#0F1830`, surface `#1B2A4A` (=`navy`), sutil `#16223E`, forte `#22325A`, texto `#EEF1F8`, muted `#AAB3C7`, faint `#8A94AB`.
- mesas light (`apps/mesas/.../index.css`): canvas `#F4F6FB`, surface `#FFFFFF`, sutil `#EEF2F8`, deep `#E6EBF4`, ink `#0B1220`.

Risco: viram nova fonte de drift (mesmo bug que originou a trava). Quando os `dark.*`/`light.*` estruturados existirem em `tokens.ts`,
estes valores devem ser **absorvidos** (cada app passa a consumir o token, nao o hex local) e entrar na trava de paridade.
`navy` (`#1B2A4A`) ja esta tokenizado e na trava — serve de ancora p/ a escala dark.

Status 2026-06-13: absorvido. `apps/glossario/frontend/src/index.css` usa `--artificio-dark-*`; `apps/mesas/frontend/src/index.css` e `apps/mesas/frontend/src/pages/MestrePage.css` usam `--artificio-light-*` nas superficies/ink. Hexes restantes nesses blocos sao seletores Tailwind originais, alphas derivados, semanticos AA ou comentarios historicos.

T3 fecha porque o contrato atual de `dev` esta definido: fonte TS, CSS vars, preset, papeis existentes, aliases temporarios e regra de paridade.
