# Plano — 022 — Paleta e fontes globais via tokens semânticos

> Baseado em investigação real do código (2026-06-14). Onde houver incerteza, a task manda
> **investigar antes de migrar** (proibido chute). Nada aqui é implementação cega.

## Arquitetura da solução

**Convergir mesas e glossário ao modelo que o `site` já usa:** componentes referenciam
**vars semânticas de tema**; o tema vira as vars via `[data-theme]`. A fonte das vars é
`packages/ui` (única). Eliminar os remaps de utility por-app.

### Camadas
1. **Tokens base (já existem)** — `packages/ui/tokens.ts` → `styles.css`:
   `--artificio-{brand,ink,muted,line,surface,canvas,navy,bronze,focus}`, semânticos
   `--artificio-{success,warning,danger,info}(-text)`, estruturados
   `--artificio-{light,dark}-{canvas,subtle,surface,strong,ink/text,muted}`, fontes
   `--artificio-font-{display,sans}`. **Não recriar.**
2. **Vars semânticas de tema (NOVO em `packages/ui/styles.css`)** — camada fina que **deriva**
   dos tokens base e **vira por tema**. **Vocabulário canônico único definido em `mapping.md` §1
   (decisão T2, 2026-06-14): SEM alias** — um nome por papel; site/glossário/mesas convergem ao mesmo.
   ENXUTO (12 vars): variedade redundante (≈13 opacidades de branco, escalas gray/slate) COLAPSA
   nestes papéis (mapping §2), não vira var nova.
   - foreground: `--fg`, `--fg-muted`
   - superfícies: `--canvas`, `--surface`, `--surface-subtle`, `--surface-strong`
   - bordas: `--line`, `--line-strong`; fills: `--fill-subtle`, `--fill`, `--fill-strong`
   - estados: variantes `--artificio-{success,warning,danger,info}(-text)` (já AA-safe) + `--special`
   - `:root` = light; `:root[data-theme="dark"]` = dark. (Confirmar default por app no boot,
     R6: mesas força dark sem cookie; glossário light.)
   - **Migração de nomes existentes (sem alias):** mesas `index.css` colapsa seu set rico
     (`--fg-soft/low/faint/ghost`→`--fg-muted`; `--surface-deepest/deep/input/panel/chip/card`→
     `--canvas`/`--surface`/`--surface-subtle`; `--border*`→`--line*`; `--fill-{5,10,20}`→
     `--fill-{subtle,,strong}`); site renomeia `--bg`→`--canvas`, `--muted`→`--fg-muted`
     (mantém `--surface`/`--line`).
3. **Consumo nos componentes** — substituir utilities cruas pelas vars/classe semântica.
   Duas técnicas possíveis (decidir em T2 por app, conforme engine Tailwind):
   - (a) **classes utilitárias semânticas** no preset (`text-fg`, `bg-surface`, `border-line`…)
     mapeando para as vars — menos churn de markup se já houver alias;
   - (b) **CSS var direto** em arbitrary (`text-[var(--fg)]`) ou classes próprias `.surface`/`.muted`.
   O `site` usa (b)/classes próprias. Preferir o que minimize regressão e churn por app.

### Por que não manter os remaps
Os remaps `[data-theme]` por-app são **patches de utility crua** → frágeis, incompletos
(MestrePage prova), divergentes (mesas vs glossário) e duplicam a paleta com rgba hardcoded.
Migrar o componente à var semântica torna o tema correto **por construção**, não por patch.

## Arquivos afetados (por módulo/pacote)

| Módulo | Arquivos | Natureza |
|---|---|---|
| `packages/ui` | `src/styles.css` (nova camada de vars semânticas), `tailwind-preset.js` (se via classes), `scripts/check-token-parity.mjs` (travar novos nomes), `tokens.ts` (só se faltar token) | aditivo + trava |
| `apps/mesas/frontend` | ~134 `.tsx` + **9 `.css` próprios** (`pages/{MestrePage,ProfileEditPage,PlayerPage}.css`, `components/{LinksDisplay,LinksManager,UserSystemsSelector}.css`, `components/ui/{ConfirmDialog,ErrorState,LoadingState}.css`, `styles/SettingStylesField.css` — ~450 hex/rgba hardcoded), `src/index.css` (renomear vars p/ canônico + remover remap light de 77 linhas) | migração faseada |
| `apps/glossario/frontend` | ~24 `.tsx`, `src/index.css` (remover remap dark de 94 linhas) | migração faseada |
| `apps/accounts/frontend` | `src/main.tsx`, `src/styles.css` (importar fonte única / alinhar) | alinhamento (R7) |
| `apps/site` | renomear vars locais (`--bg`→`--canvas`, `--muted`→`--fg-muted`, `--line`→`--border`) p/ o vocabulário canônico (sem alias) | mínimo (1 arquivo) |
| componentes-gatilho | `features/table/components/{MasterCard,TableActionPanel,TableMaster}.tsx`, `components/LinksDisplay.tsx` + `LinksDisplay.css`, `pages/MestrePage.css`, `components/TableCardDashboard.tsx` | parte da fatia mesas |

## Contratos/interfaces tocados

- **`@artificio/ui` (compartilhado)**: novas vars semânticas = **aditivo** (subpath `./styles.css`).
  Não muda exports JS. Remoção de qualquer var existente = checar 3 apps.
- **Tema/cookie** `artificio_theme` (`theme.tsx`): **não alterado**; só consumimos `data-theme`.
- **Sem** impacto em auth/SSO/DNS/schema/migration. accounts só se R7 escolher migrar (testar login).

## Impacto em consumidores

- Consumidores de `packages/ui/styles.css`: **mesas, glossário, site** (confirmado nos imports).
  accounts importa só `@artificio/ui` (JS/logo), **não** o `styles.css` — daí R7.
- Mudança aditiva nas vars não quebra ninguém; a remoção dos remaps é **interna a cada app**.

## Rollback

- Por fatia/app: reverter o PR da fatia volta ao estado anterior (remap + utilities cruas) sem
  tocar banco/VM/cookie. Tokens base intactos.
- Se uma fatia regredir o **default-dark do mesas em prod**, reverter só aquela fatia; as vars
  novas em `packages/ui` são inertes se ninguém as consome.
- Promote/deploy sempre por app, FF `dev→main`, com autorização nominal → rollback = redeploy do
  commit anterior.

## Validação (como provo que funciona)

1. **Build**: `pnpm turbo run build` 13/13; `check-token-parity` verde (nomes novos travados).
2. **Testes**: vitest existentes verdes (glossário 22/22, mesas backend/of front conforme).
3. **Contraste AA** (Nielsen/ISO 9241-11, D038): medir nos elementos-gatilho da MestrePage light
   + telas-chave de cada app em **ambos** os temas (texto ≥4.5, não-texto ≥3). Registrar números.
4. **Anti-regressão default**: boot sem cookie → mesas dark pixel-igual ao atual; glossário light.
5. **Smoke por app em BETA** antes de prod (home/rotas-chave 200; visual dos 2 temas; WP raiz 200).
6. **Promote/prod** só após validação do mantenedor + autorização nominal por ação.

## Faseamento (resumo; detalhe em tasks.md)

- **Fase 0** — fundação em `packages/ui` (vars semânticas + parity) — não muda apps.
- **Fase 1** — glossário (menor superfície, 24 tsx) como **piloto** da migração de consumo.
- **Fase 2** — mesas por áreas (perfil/MestrePage primeiro = resolve o bug reportado; depois
  catálogo, painel, forms, modais), cada área uma fatia/PR.
- **Fase 3** — fontes sistemáticas (Oswald/Inter) + accounts (R7) + remoção dos remaps + fecho.
