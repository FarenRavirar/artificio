# 092 — Tarefas

Estado geral e medições em `spec.md`. Aqui só o que executar.

Convenção: ✅ feito · ⛔ bloqueado por decisão do mantenedor · ⬜ aberto, não bloqueado.

---

## Fase 1 — vocabulário e tokens ✅

### T1.1 — Reescrever `packages/comments/src/styles.css` sobre o design system ✅

Oito tokens inventados trocados pelos reais. Zero cores literais no arquivo.
Classes órfãs `__empty` e `__edited` ganharam regra. `justify-items: start` no grid do
compositor. Hierarquia primário/secundário nos botões. Hover nos 14 botões. Um breakpoint.
CSS do `CommunityModerationWorkspace`, incluindo `sr-only` local.

**Aceite:** `rtk rg "#[0-9a-fA-F]{3,6}" packages/comments/src/styles.css` retorna só comentário.
**Validado:** 216/216 testes, `tsc --noEmit` limpo.

### T1.2 — Criar os tokens ausentes em `packages/ui` ✅

`--radius-sm/md/pill`, `--space-1/2/3/4/6`, `--btn-danger-bg/fg/bg-hover`, `--brand-solid` +
`--brand-solid-fg`. Os dois últimos grupos com variante em `[data-theme="dark"]`.

**Aceite:** `rtk rg "^\s*--radius-md:|^\s*--space-3:" apps packages` devolve **uma** definição,
em `packages/ui/src/styles.css`.

### T1.3 — Alinhar `.artificio-button-danger` aos tokens novos ✅

O próprio design system tinha `color: #ffffff` literal e usava `--artificio-danger-text` como
hover. Passou a consumir `--btn-danger-*`.

---

## Fase 2 — literais duplicados ✅ / ⬜

### T2.1 — `accounts`: botão destrutivo e estados de feedback ✅

`#b42318`/`#8f1d16` → `--btn-danger-*`. `.accounts-status-{success,error}` → `--state-*-{bg,line,fg}`
(os pares anteriores eram fixos de tema claro; no escuro viravam tarja clara sobre painel escuro).

### T2.2 — `accounts`: remover fallbacks redundantes ✅

32 ocorrências de `var(--token, #hex)` → `var(--token)`. O fallback nunca agia: o design system
é importado em `main.tsx:7`.

**Aceite:** `rtk rg -c "var\(--[a-z-]+,\s*#" apps/accounts/frontend/src/styles.css` → `0`.

### T2.3 — `accounts`: documentar a exceção do logo Google ✅

`background: #fff` no `.accounts-login svg` **permanece literal** — diretriz de marca do Google
exige branco em qualquer tema. Comentário explicando, para não ser "corrigido" depois.

### T2.4 — `links`: `.chip-adult` ✅

Reescrevia à mão os três valores de `--state-danger-*` e a troca por tema, com override
`[data-theme="dark"]` duplicando o que o token já faz. Virou uma regra, sem override.

### T2.5 — Literais restantes fora do `accounts` ⬜

~10 usos: `MestrePage.css` (1), `PlayerPage.css` (1), `mesas/index.css` (1), e os `color: #fff`
sobre `--brand` no `links`.

Mecânico, baixo risco. **Não bloqueado** — apenas não executado na sessão de 2026-08-17.

**Não tocar:** marca de terceiro (Discord `#5865f2`, Google `#4285f4`), gradiente decorativo,
scrim `rgba(0,0,0,*)`. Ver `spec.md` §4.

---

## Fase 3 — geometria das fachadas ✅

### T3.1 — `mesas`: contêiner na montagem do caso normal ✅

`MesaPage:343` estava solta (1841px de 1856px de viewport), irmã de uma
`<section class="container mx-auto px-6">` de 900px. A montagem de mesa encerrada (`:216`) já
tinha contêiner — o defeito era inconsistência dentro do mesmo arquivo.

### T3.2 — Hierarquia do `h2` nas três fachadas ✅

Renderizava a 16px, igual ao corpo, nos três. Cada um alinhado ao padrão da seção irmã da
própria página: `mesas` → `MesaPage:287`; `downloads` → `RatingSection`; `site` → `.prose h2`,
**por extensão do seletor existente**, sem copiar valores.

### T3.3 — `downloads`: `<section>` sem classe ✅

Mesmo defeito do `mesas`, mascarado pela `MaterialPage`, que envolve tudo num
`div mx-auto max-w-5xl px-4`.

---

## Fase 4 — grade do catálogo ✅

### T4.1 — `auto-fit` → `auto-fill` com teto de trilha ✅

`CatalogoPage.tsx:761`. Medido em `?system=call-of-cthulhu` (1 resultado): card de
**1793×1416px → 420×558px**, proporção 1.27 → 0.75, capa 79% → 47% do card.

**Nota:** com 19 mesas a grade já estava correta (6 colunas de 282px). O defeito só aparece
com filtro que devolve poucos resultados.

### T4.2 — Uniformizar `auto-fit`/`auto-fill` no resto do repo ⬜

O `mesas` mistura os dois: `auto-fit` em `PlayerPage.css:162`, `MestrePage.css:223` e `:359`;
`auto-fill` em `MestrePage.css:273` e `:890`. `links` e `site-admin` usam `auto-fill`.

Decidir a regra (`auto-fill` para catálogo/listagem) e aplicar. Cada caso precisa de conferência
visual, porque alguns podem depender do esticamento de propósito.

---

## Fase 5 — tokens semânticos redefinidos ⛔

**Bloqueado: decisão do mantenedor.** Muda a aparência de quatro apps em produção.

### T5.1 — Escolher a estratégia ⛔

Duas opções, ambas medidas:

**(a) Remover as definições locais.** ~40 definições em `site`, `links`, `site-admin`, `mesas`.
Os apps herdam de `packages/ui`. Uniformização real, mas **muda pixels hoje** — `--line` do
`site` fica levemente mais azulado, idem `site-admin`.

**(b) Fazer as definições locais derivarem do token** (`--line: var(--artificio-line)`).
Uniformiza a fonte da verdade **sem mudar pixel algum hoje**, e faz os apps acompanharem
mudanças futuras. Reversível, verificável por busca.

Recomendação: **(b)** como primeiro passo, **(a)** depois, app por app, com conferência visual.

### T5.2 — Aplicar, na ordem de exposição ⛔

`links` (menor exposição) → `site-admin` → `site` (blog em produção na raiz) → `accounts`
(**SSO por último**, exige smoke de todos os consumidores conforme AGENTS.md).

### T5.3 — Corrigir o comentário desatualizado do `site` ⛔

`site/global.css:16` diz *"tokens próprios da página (não conflitam com `--artificio-*`)"*. Era
verdade quando escrito; deixou de ser quando a spec 022 T8 criou a camada semântica com estes
mesmos nomes. Reescrever junto com T5.2, não antes — o comentário deve descrever o estado final.

---

## Fase 6 — Tailwind e `packages/comments` ⛔

### T6.1 — Decidir entre `@source` nos hosts ou CSS próprio no pacote ⛔

Hoje: seis apps declaram `@source ".../packages/ui/src/**"`; **nenhum declara
`packages/comments`**; `site-admin` não declara nenhum.

Contornado em T1.1 (CSS próprio no pacote, incluindo `sr-only`), então **a tela de moderação não
está mais sem estilo**. A causa segue: classe utilitária nova no pacote continuará não sendo
gerada, silenciosamente.

Recomendação: manter CSS próprio, por não depender de três hosts permanecerem sincronizados.

---

## Fase 7 — achados laterais ⬜

Medidos durante a auditoria, **fora do escopo** desta spec. Registrados para não se perderem.

### T7.1 — `downloads`: retry inútil contra `401` ⬜

Seis `POST /api/auth/refresh` em sequência e `GET /api/v1/favorites` em backoff (1.2s, 3.3s,
7.3s), todos `401`, em sessão anônima que nunca vai autenticar.

### T7.2 — `/catalogo` do `mesas` exige login em beta ⬜

Duas navegações anônimas redirecionadas ao OAuth do Google. Deveria ser público — é a vitrine
do projeto. **Não investigado**, apenas medido.

---

## Bloqueio geral

Nada desta spec foi commitado. Todo o trabalho das fases 1 a 4 está no disco, validado:

- `packages/comments`: 216/216 testes, `tsc --noEmit` limpo
- `mesas/frontend`, `downloads/frontend`, `accounts/frontend`: `tsc --noEmit` limpo

Falta rodar `lint` e `build` repo-wide — por AGENTS.md, isso entra **uma vez, no fim**, quando o
mantenedor disser que não vem mais rodada de review, ou antes de um commit que ele autorize.
