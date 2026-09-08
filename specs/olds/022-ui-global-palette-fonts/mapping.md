# Anexo — Mapeamento canônico "utility/cor crua → var semântica" (T1 + decisão T2)

> Fonte: grep real em 2026-06-14 (`apps/mesas/frontend/src`, `apps/glossario/frontend/src`).
> Decisão de nomes (T2): **vocabulário único, SEM alias** — um nome por papel; site e glossário
> convergem para o mesmo conjunto. Decisão registrada por autorização do mantenedor (2026-06-14).

## 0. Estado atual (por que existe o GAP)

- Paleta/fontes globais já existem em `packages/ui` (`tokens.ts`→`styles.css`, vars `--artificio-*`),
  importadas por mesas/glossário/site.
- **mesas** já tem uma camada de vars semânticas em `index.css` (`--fg`, `--fg-muted/soft/low/faint/ghost`,
  `--surface-*`, `--border*`, `--fill-*`) virada por `[data-theme="light"]` — mas **os componentes não
  a consomem**: usam utilities cruas (`text-white`, `bg-white/NN`, `bg-[#hex]`) e o `index.css` remenda
  essas utilities (77 linhas, incompleto → bug MestrePage light).
- **glossário** tem remap inverso (94 linhas `[data-theme="dark"]`) sobre utilities `gray/slate/white`.
- **site** já segue o modelo-alvo (componentes referenciam `--bg/--surface/--fg/--muted/--line`).
- Os 3 vocabulários divergem → esta spec unifica.

## 1. Vocabulário canônico (T2 — destino único, sem alias, ENXUTO)

Definido em `packages/ui/styles.css`, derivado dos tokens base, virando por `:root` (light) e
`:root[data-theme="dark"]`. **12 vars** — espelha o site + R1. As ~13 opacidades de branco e as
escalas gray/slate dos apps **colapsam** nestes papéis (§2); variedade redundante eliminada.

### Foreground (2 níveis)
| var | papel | light | dark |
|---|---|---|---|
| `--fg` | texto primário | `--artificio-light-ink` | `--artificio-dark-text` |
| `--fg-muted` | secundário/dim | `rgba(ink,.66)` | `--artificio-dark-muted` |

### Superfícies (canvas + 3 elevações)
| var | papel | light | dark |
|---|---|---|---|
| `--canvas` | fundo da página/poço | `--artificio-light-canvas` | `--artificio-dark-canvas` |
| `--surface` | card padrão | `--artificio-light-surface` | `--artificio-dark-surface` (#1b2a4a) |
| `--surface-subtle` | chip/input/sub-card | `--artificio-light-subtle` | `--artificio-dark-subtle` (#16223e) |
| `--surface-strong` | realce/hover | `--artificio-light-strong` | `--artificio-dark-strong` (#22325a) |

### Bordas
| var | light | dark |
|---|---|---|
| `--line` | `rgba(navy,.14)` | `rgba(255,255,255,.10)` |
| `--line-strong` | `rgba(navy,.24)` | `rgba(255,255,255,.20)` |

### Fills translúcidos (overlay sobre superfície)
| var | light | dark |
|---|---|---|
| `--fill-subtle` | `rgba(navy,.04)` | `rgba(255,255,255,.05)` |
| `--fill` | `rgba(navy,.08)` | `rgba(255,255,255,.10)` |
| `--fill-strong` | `rgba(navy,.14)` | `rgba(255,255,255,.20)` |

### Estados (texto AA-safe = variante `*-text` dos tokens; tint/sólido = base)
| var | base | texto AA |
|---|---|---|
| sucesso | `--artificio-success` | `--artificio-success-text` |
| aviso | `--artificio-warning` | `--artificio-warning-text` |
| perigo | `--artificio-danger` | `--artificio-danger-text` |
| info | `--artificio-info` | `--artificio-info-text` |
| especial (roxo) | `--special` → `#a855f7` (dark) / `#7e22ce` (light) | — |

### Marca (intocável, D064/D040 — NÃO migrar)
`--artificio-brand` (#FF5722), `--artificio-brand-deep`, `--artificio-bronze`, `--artificio-focus`.

## 2. Mapa utility crua (`.tsx`) → var

> Colapso proposital (não-existe-variedade-tão-absurda): toda opacidade de branco vira `--fg`
> (texto cheio) ou `--fg-muted` (qualquer dim); fills/bordas em 3 níveis; superfícies em canvas+3.

| utility | ocorr. (mesas/gloss) | destino |
|---|---|---|
| `text-white`, `text-white/80..90` | 529 / 56 | `color: var(--fg)` |
| `text-white/20..75` (qualquer dim) | 672 / 12 | `var(--fg-muted)` |
| `bg-white` sólido | 14 / 79 | `var(--surface)` |
| `bg-white/5` | 244 / 6 | `var(--fill-subtle)` |
| `bg-white/10..15` | 115 / 5 | `var(--fill)` |
| `bg-white/20` | 33 / 0 | `var(--fill-strong)` |
| `border-white/5..10` | 295 / 5 | `var(--line)` |
| `border-white/15..40` | 83 / 1 | `var(--line-strong)` |
| `text-gray/slate-{900,800,700}` | — / muitos | `var(--fg)` |
| `text-gray/slate-{600,500,400,300}` | parte / muitos | `var(--fg-muted)` |
| `bg-gray/slate-{50,100}` | parte / parte | `var(--surface-subtle)` |
| `bg-gray/slate-200` | parte | `var(--surface-strong)` |
| `text-purple-{300,400,600}` | 24 / 1 | `var(--special)` |
| `text-[#020740]` (navy marca) | 5 / 4 | light: preservar; dark: `var(--fg)` |
| `text-[#a8b8d8]` | 1 / 0 | `var(--fg-muted)` |
| glossário `azul-escuro` | — / sim | `var(--fg)` (texto) / `var(--surface-strong)` (bg) |
| `azul-medio` | — / sim | `var(--fg-muted)` / `var(--surface-strong)` |
| `cinza-fundo` | — / sim | `var(--surface-subtle)` |

### Hexes de superfície em arbitrary `bg-[#hex]` (mesas, 87 ocorr.)
| hex | ocorr. | destino |
|---|---|---|
| `#13213f`, `#0F1A2E` | 65 | `var(--surface-subtle)` |
| `#1B2A4A`, `#10203a`, `#1a2a4a`, `#1A233A` | 15 | `var(--surface)` |
| `#0a1628`/`#0B1628`/`#0B1220`/`#1a1a2e` (poços) | 7 | `var(--canvas)` |

## 3. Mapa CSS próprio (raw hex/rgba → var) — **TODO o CSS próprio entra no escopo**

> Decisão (2026-06-14): corrigir os `.css` próprios junto, não só os componentes — senão refaz depois.
> Cada arquivo: substituir hex/rgba hardcoded pelo papel correspondente da §1; preservar marca e
> cores de plataforma (exceções §4).

Superfície real (hex distintos nos `.css` mesas):
| hex | papel | destino |
|---|---|---|
| `#0a1628`/`#0b1220`/`#0d1a30`/`#0e1a30` | poço | `var(--canvas)` |
| `#0f1a2e`/`#13213f` | input/chip | `var(--surface-subtle)` |
| `#10203a` | panel | `var(--surface)` |
| `#1b2a4a`/`#2a3f6d` | card/realce | `var(--surface)`/`var(--surface-strong)` |
| `#ffffff` (texto sobre dark) | fg | `var(--fg)` |
| `#0f172a` | texto | `var(--fg)` |
| `#475569`/`#6b7280`/`#7f8c8d` | muted | `var(--fg-muted)` |
| `#020740` | navy marca (texto) | preservar light / `var(--fg)` dark |
| `#ef4444`/`#dc2626`/`#f87171` | perigo | `var(--artificio-danger[-text])` |
| `#fbbf24`/`#f59e0b`/`#a16207`/`#fb923c`/`#fde68a` | aviso | `var(--artificio-warning[-text])` |
| `#4ade80`/`#10b981`/`#15803d` | sucesso | `var(--artificio-success[-text])` |
| `#3498db` | info | `var(--artificio-info[-text])` |
| `#8b5cf6` | especial | `var(--special)` |

Arquivos a tratar (todos):
`pages/MestrePage.css` (168 raw), `pages/ProfileEditPage.css` (101), `pages/PlayerPage.css` (22),
`components/LinksDisplay.css` (17), `components/LinksManager.css` (26), `components/UserSystemsSelector.css`,
`components/ui/{ConfirmDialog,ErrorState,LoadingState}.css`, `styles/SettingStylesField.css`.

## 4. Exceções (NÃO migrar — manter literal, documentado)

- **Laranja de marca** `#ff5722`/`#e64a19`/`#ea580c`/`#e65c00`/`#f97316` → `--artificio-brand*` (D064).
- **Bronze** `#9c6b43` → `--artificio-bronze`.
- **Gradientes decorativos** `#667eea`/`#764ba2` (hero/landing) → manter (ou token decorativo próprio).
- **Cores de plataforma/identidade** ex.: Discord `#5865f2` → literal (identidade de terceiro).
- **`select option`/`optgroup`** (fundo branco nativo do dropdown) → mantido por acessibilidade.
- **Backdrops** `rgba(0,0,0,.NN)` / `bg-black/NN` → fora (sombras/overlay, não é tema de superfície).

## 5. Técnica de consumo por engine (T2)

- **mesas (Tailwind v4)**: substituir utility crua por arbitrary `text-[var(--fg)]` /
  `bg-[var(--surface)]` / `border-[var(--border)]`, OU classe própria; regras unlayered já vencem
  os `@layer` v4 (provado no remap atual). Validar caso a caso (não assumir 1:1 sem ver o contexto).
- **glossário (Tailwind v3)**: idem arbitrary `*-[var(--…)]`; especificidade `[data-theme] .util`
  já provada no remap dark. Cores nomeadas (`azul-*`,`cinza-fundo`) → trocar pela var direto no markup.
- **Remoção dos remaps** (`mesas` 77ln / `glossário` 94ln) só DEPOIS que o consumo migrar (Fase 1/2).

## 6. Faseamento dos CSS próprios (alinhado às tasks)
- **T8 (perfil/MestrePage)**: MestrePage.css, LinksDisplay.css, ProfileEditPage.css, LinksManager.css,
  UserSystemsSelector.css, SettingStylesField.css.
- **T9 (catálogo/player)**: PlayerPage.css.
- **T11 (modais/estados)**: ui/ConfirmDialog.css, ui/ErrorState.css, ui/LoadingState.css.
</content>
</invoke>
