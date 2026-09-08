# Guia de Estilo Artifício — PÉTREO (Spec 022)

> **Status: PÉTREO.** Aprovado pelo mantenedor em 2026-06-15 a partir do glossário light como
> referência visual canônica ("esse padrão é perfeito e tem que ser o canônico"). Todo módulo
> (mesas/glossário/site/accounts) DEVE convergir a estes padrões nos 2 temas. Mudar isto exige
> nova decisão pétrea. Tokens definidos em `packages/ui/src/styles.css` (ver `mapping.md` §1).

## Princípio

Um único design system. mesas e glossário foram feitos em momentos diferentes; agora adotam o
mapa do Artifício (modelo "aquisição"). Componente referencia **var semântica**; o tema vira a var
via `[data-theme]`. **Sem** utility crua theme-específica, **sem** remap por-app, **sem** paleta
duplicada.

## Tokens canônicos (resumo; valores em mapping.md §1)

| papel | var | light | dark |
|---|---|---|---|
| fundo da página | `--canvas` | `#f4f6fb` (lavanda claro) | `#0f1830` (navy profundo) |
| texto primário | `--fg` | `#0b1220` | `#eef1f8` |
| texto secundário | `--fg-muted` | navy 66% | `#aab3c7` |
| card/superfície | `--surface` | `#ffffff` sólido | `#1b2a4a` navy sólido |
| sub-superfície | `--surface-subtle` | `#eef2f8` | `#16223e` |
| realce | `--surface-strong` | `#e6ebf4` | `#22325a` |
| borda | `--line` / `--line-strong` | navy α.14 / .24 | branco α.10 / .20 |
| overlay | `--fill-subtle/-/-strong` | navy α.04/.08/.14 | branco α.05/.10/.20 |

## Componentes canônicos (referência = glossário light + paralelo dark)

### Card (SISTEMAS & CENÁRIOS, etc)
- `background: var(--surface)` **sólido** (NÃO glassy/translúcido — sólido é o canônico).
- `border: 1px solid var(--line)`.
- título `var(--fg)`, corpo `var(--fg-muted)`.
- raio ~14px. Dark = mesma estrutura, surface navy sólido.

### Botão PRIMÁRIO (ex.: "Cadastre-se e contribua →")
- `background: var(--artificio-brand)` (laranja de marca #FF5722), `color:#fff`.
- É o laranja de marca, **constante nos 2 temas** (CTA de marca).
- Hover: `var(--artificio-brand-deep)`.
- ⚠️ Distinto do **botão primário de formulário/ação** (token `--btn-primary-*`): navy no light,
  laranja no dark (espelha `.artificio-login-button`). O CTA de marca usa o laranja direto; o
  botão de ação neutro usa `--btn-primary-*`.

### Botão SECUNDÁRIO / informativo (ex.: "Carregando base de dados…")
- `background: var(--state-info-bg)`, `color: var(--state-info-fg)`, `border: var(--state-info-line)`.
- Azul claro + texto navy no light; azul translúcido + texto azul-claro no dark.

### Banner / faixa NAVY (ex.: "Gratuito para sempre…")
- `background: var(--navy-block-bg)` (navy; dark = navy mais claro p/ separar do surface).
- `color: var(--navy-block-fg)` (branco nos 2 temas).
- Ícone/acento = laranja de marca (`var(--artificio-brand)`).

### Estados (badges/alertas/preços)
- sucesso/aviso/perigo/info: `var(--state-{success,warning,danger,info}-{bg,line,fg})`.
- bg/line theme-agnósticos (rgba leve); texto (`-fg`) vira por tema p/ AA (≥4.5).
- Roxo decorativo (núcleos/plataformas) = `var(--special)` (texto) + tint `rgba(168,85,247,α)`.

### Glassy / translúcido
- **Descontinuado como padrão.** Cards e painéis usam superfície **sólida** (`--surface`/`-subtle`).
  Onde havia `rgba(255,255,255,.05)+blur`, migrar para `--surface`/`--surface-subtle`.

## Regras de aplicação
- Texto branco sólido → `--fg`; qualquer branco-opaco dim → `--fg-muted` (sem gradação fina).
- Superfície/poço → `--canvas`/`--surface`/`-subtle`/`-strong`; overlay → `--fill-*`.
- Laranja de MARCA (CTA/ícone/acento quente) → `--artificio-brand` (intocável, D064).
- Backdrops `rgba(0,0,0,α)` / `bg-black/NN` → fora (sombra/scrim, não é tema).
- Nenhum bloco `[data-theme]` de override por componente/app: o tema vira só nas vars.

## Conformidade
- glossário (Spec 022 Fase 1): **conforme** (referência).
- mesas (Fase 2, em migração): convergindo área a área (T8 perfil primeiro).
- site: já é o modelo de origem; alinhar nomes de var.
- accounts (T14): alinhar ou exceção documentada.
