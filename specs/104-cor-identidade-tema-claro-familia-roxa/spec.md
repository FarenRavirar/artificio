# Spec 104 — Cor de identidade: `#222222` no tema claro e a família roxa

> Aberta em 2026-09-20 por decisão do mantenedor. PR e spec próprias, separadas
> da spec 103 (PR #328), que é imagens e contraste dos botões.

## 1. Por que existe

A investigação de contraste da spec 103 (T3.2) desenterrou dois defeitos de
paleta que não cabem naquela PR: os dois tocam `packages/ui`, que serve 7 apps, e
um deles é decisão de aparência do mantenedor, não conserto de bug.

A 103 corrigiu 22 botões que usavam laranja cru com texto fixo, e criou a guarda
`apps/mesas/frontend/src/utils/contrasteMarca.test.ts`. Essa guarda mede **só o
par de marca**. É por isso que os defeitos desta spec existiram sem ninguém ver:
não havia trava para cor nenhuma além do laranja.

## 2. A identidade da marca

Declarada pelo mantenedor em 2026-09-20, nas palavras dele: `#020740` (navy),
`#222222` (carvão), `#FF5722` (laranja) e branco. "Elas eram cruzadas quando
importantes" — laranja sobre navy, navy sobre laranja. `#222222` era "de forma
geral, a parte escura, no branco": fonte, links de menu, ícones.

Confirmada em `C:\projetos\artificio-wt-dateexport\midias\telaprincipal.png`
(site antigo) e `Logo-PNG-Negativo-2.png`: laranja, navy, branco e cinza neutro.
Zero bronze, zero roxo. O único botão sólido da página antiga é o de busca, em
laranja — o que bate com "botões normalmente são laranjas", dito por ele na mesma
conversa.

Todas as combinações úteis das quatro passam AA, medido com a fórmula normativa
do WCAG 2.x:

| fundo | texto | razão |
|---|---|---|
| `#ff5722` | `#020740` navy | 6,00:1 |
| `#ff5722` | `#222222` carvão | 5,03:1 |
| `#ff5722` | branco | 3,16:1 — **reprova** |
| `#020740` | branco | 18,97:1 |
| `#020740` | `#ff5722` | 6,00:1 |
| `#222222` | branco | 15,91:1 |
| `#222222` | `#ff5722` | 5,03:1 |

O único par que reprova é laranja puro + branco, e é exatamente o que
`--brand-solid` já resolve por tema (claro: `#cf4317` + branco, 4,70:1; escuro:
`#ff5722` + navy, 6,00:1). **A identidade declarada não precisa de cor nova.**

## 3. Escopo

Duas frentes, mais a generalização da guarda.

**A — `#222222` como texto do tema claro.** Hoje o papel é `--fg`, que no claro
resolve para `--artificio-light-ink: #0b1220`. O mantenedor disse: "o tema light
está muito estranho sem o 222222".

**B — a família roxa e o bronze.** `--special` reprova como texto no tema escuro,
e o roxo do app é muito maior que o token. `--artificio-bronze` tem 2
consumidores, um deles corrigido na 103 e o outro não.

**C — guarda para todo par sólido**, não só o de marca.

## 4. Fora de escopo

- Qualquer mudança na PR #328 da spec 103.
- Os **3 botões com fundo sólido** de bronze e roxo
  (`TableCardDashboard.tsx:246`, `VttPlatformsEditor.tsx:158`,
  `MestreContactForm.tsx:138`): corrigidos na 103, porque são a mesma correção
  dos outros 22 botões daquela spec e deixar parte deles na árvore seria estado
  inconsistente. Ver `tasks.md` T2.2, fechada.
- Trocar a família tipográfica, o espaçamento ou qualquer token que não seja cor.

## 5. Decisões pendentes do mantenedor

**D1 — o que o roxo significa.** Medido, ele marca papéis diferentes com a mesma
cor: "Covil do Lich" e "Mestre" (`MasterCard.tsx`, `TableMaster.tsx:51`),
plataformas de VTT (`TableActionPanel.tsx:298`, `VttPlatformsEditor`), e tipo de
nó no admin (`NodeTypeBadge`). São um papel só ou vários? Trocar por laranja sem
saber apaga distinção que o usuário pode estar usando. Não é medível — é produto.

**D2 — se o roxo sai ou fica.** Saindo, cada papel vai para laranja
(`--brand-solid`), navy ou neutro; a identidade declarada não tem quinta cor para
"especial". Ficando, ele precisa de par por tema igual ao `--brand-solid`, e os
8 RGB crus mais as 38 classes `purple-NNN` têm que migrar para ele — senão o par
nasce e ninguém usa.

**D3 — o badge "🗄️ Arquivada"** (`TableCardDashboard.tsx:103`) segue bronze,
pareando visualmente com o botão "Arquivar" que a 103 passou para laranja. Mexer
num sem o outro separa o par. "Botões normalmente são laranjas" decide botão, não
badge.

## 6. Blast radius

`packages/ui` serve **7 apps** (`accounts`, `downloads`, `glossario`, `links`,
`mesas`, `site`, `site-admin`) — `esferas` e `srd` estão no AGENTS.md mas não
existem em `apps/` ainda.

`var(--fg)` medido fora do `mesas`: **61 arquivos** (`downloads` 42, `glossario`
18, `site` 1). Roxo escapa do `mesas` em **1** arquivo:
`apps/glossario/frontend/src/components/ImportPreview.tsx:133`.

Alterar contrato de `packages/ui` exige aprovação nominal (AGENTS.md
§Autorização, "Pacotes compartilhados") e verificação de impacto proporcional ao
blast radius.

## 7. Invariantes

- Nenhuma cor nova além das quatro declaradas em §2, salvo variação de
  luminosidade das próprias (como `#cf4317` é do `#ff5722`).
- Todo par fundo/texto medido nos DOIS temas, com o limite do papel declarado:
  4,5:1 texto normal, 3:1 texto grande (≥18,66px bold ou ≥24px) e componente de
  interface.
- Nenhum valor de cor em RGB cru onde existe token.
- Guarda que **calcula** a razão a partir do valor do token, nunca que confere se
  a classe cita o nome certo — o defeito da 103 nasceu de um nome correto
  apontando para cor insuficiente.
