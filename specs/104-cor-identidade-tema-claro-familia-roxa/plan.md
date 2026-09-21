# Plan 104 — Cor de identidade: `#222222` no tema claro e a família roxa

## 1. Ordem de execução

A ordem importa porque a guarda precisa existir antes da mudança de cor, senão a
mudança é validada à mão e a próxima regressão passa igual.

1. **T3 primeiro** (guarda generalizada). Ela é a única frente que não depende de
   decisão do mantenedor e é o que torna T1 e T2 verificáveis.
2. **T1** (`#222222`), que é decisão já tomada por ele — falta só executar certo.
3. **T2** (roxo/bronze), que depende de D1/D2/D3 da `spec.md` §5.

## 2. T1 — por que não é troca de uma linha

`--artificio-light-ink: #0b1220` está em **duas** fontes de token que um script
obriga a serem iguais, e o valor aparece em **27 literais RGB crus** que não
derivam do token.

### 2.1 As três fontes de token

| fonte | linha | valor |
|---|---|---|
| `packages/ui/src/tokens.ts` | 57 | `lightInk: "#0B1220"` |
| `packages/ui/src/styles.css` | 44 | `--artificio-light-ink: #0b1220` |
| `preset.js` | — | slot existe no script, hoje `null` |

`packages/ui/scripts/check-token-parity.mjs:178-182` compara as fontes e falha se
divergirem. Mudar uma só quebra o script. **Investigar** se o slot `null` do
`preset.js` para `lightInk` é intencional ou lacuna — outros papéis têm três
fontes.

### 2.2 Os 27 literais

`11, 18, 32` escrito em RGB cru, nenhum derivado do token:

- `packages/ui/src/styles.css:143` (`--fg-muted`), `:369` (`--series-pattern`);
- `packages/ui/src/admin/admin.css:41-44` (`--admin-fg-muted`/`low`/`faint`/
  `ghost`), mais `:40`, onde o literal aparece como **fallback** de
  `var(--artificio-light-ink, #0b1220)`;
- `apps/mesas/frontend/src/index.css`: `:191-195` (escada `--fg-muted`/`soft`/
  `low`/`faint`/`ghost`), `:225`, e `:242-253` — as 12 regras
  `[data-theme="light"] .text-white\/NN`.

Trocar só o token deixa o texto principal em `#222222` e os 27 pontos em
`#0b1220`: duas cores de texto quase iguais no mesmo tema, pior que hoje.

### 2.3 A escada reprova se a opacidade for copiada

`#222222` a 66% sobre branco compõe `#7a7a7a` e mede **4,29:1** — abaixo do
4,5:1 de texto normal. O `rgba(11,18,32,.66)` atual dá **6,21:1**. Cada nível
precisa de opacidade **recalculada**, não copiada.

Decisão técnica a tomar (não é do mantenedor): manter a escada como literais
recalculados, ou derivá-la do token com `color-mix(in srgb, var(--fg) N%,
transparent)`. Derivar elimina a classe inteira de defeito — literal que não
acompanha o token — mas muda o contrato de `packages/ui` e pede aprovação nominal
própria. Medir suporte de `color-mix` nos alvos antes (o repo já usa
`color-mix(in_srgb,…)` em `VttPlatformsEditor.tsx:116`, o que é indício de
suporte aceito, não prova de política).

### 2.4 O que NÃO é o problema

`#0b1220` mede **18,72:1** sobre branco; `#222222` mede **15,91:1**. Os dois
passam AAA. A diferença é de tom, não de legibilidade: `#0b1220` é navy escuro,
`#222222` é cinza neutro. O navy É cor de marca declarada, então o texto puxar
para navy não é erro — o que o mantenedor reconhece do site antigo é o cinza.
Registrar isso evita que alguém "corrija o contraste" que já está correto.

## 3. T2 — o roxo é maior que o token

### 3.1 O token reprova como texto no escuro

O comentário do pacote declara "acento especial (roxo) — **AA sobre claro**"
(`styles.css:160`). O claro cumpre: `#7e22ce` mede **6,98:1** sobre branco. O
escuro (`#a855f7`, `:310`) não:

| fundo | razão |
|---|---|
| `--artificio-dark-surface` `#1b2a4a` | **3,59:1** |
| `--artificio-dark-canvas` `#0f1830` | **4,45:1** |

O comentário diz o que o token foi projetado para fazer, não o que faz — a metade
escura nunca foi medida. Falha em silêncio: passa build, passa teste, e o único
sinal é o Lighthouse do tema escuro.

### 3.2 Onde o roxo está

- **14 usos de texto e ícone via token:** `MasterCard.tsx` (7 — `:50`, `:58`,
  `:61`, `:75`, `:88`, `:89`, `:114`), `TableMaster.tsx:51`,
  `TableActionPanel.tsx:298`, `ProfileEditPage.css:579`,
  `VttPlatformsEditor.tsx:116` e `:123`, `ImportPreview.tsx:133` (**glossário**).
- **2 usos de `focus:border`:** `MestreContactForm.tsx:86` e `:102` — critério é
  3:1 de componente, não 4,5:1 de texto.
- **2 fundos sólidos de botão** — `VttPlatformsEditor.tsx:158` e
  `MestreContactForm.tsx:138` — **já corrigidos na spec 103**, com o par
  `--brand-solid`. Fora do escopo daqui (`spec.md` §4).
- **8 usos em RGB cru** (`rgba(168,85,247,…)`): `MasterCard.tsx` (6),
  `TableMaster.tsx:41`, `TableActionPanel.tsx:297`. Como não passam por token,
  ficam roxo escuro **no tema claro também**.
- **38 ocorrências de `purple-NNN` do Tailwind em 15 arquivos**, fora do token —
  `MestreContactMethods.tsx`, `MasterTables.tsx`, `MasterHero.tsx`,
  `tableBadges.ts`, `NodeTypeBadge.tsx`, `DiscordDraftReviewTable.tsx`,
  `DevFeedbackPanel.tsx`, `ComunidadeSection.tsx`, `ActivityItem.tsx`, e
  `index.css` com overrides próprios (`:333`
  `[data-theme="light"] .text-purple-300\/90 { color: rgba(126, 34, 206, 0.92); }`).

O token é a minoria do roxo no app. Qualquer plano que só troque `--special`
deixa 46 pontos para trás.

### 3.3 Os badges translúcidos não passam em nenhum tema escuro

`rgba(168,85,247,0.20)` e `0.10)` compostos, medidos:

| fundo composto | texto `#7e22ce` | texto `#a855f7` |
|---|---|---|
| 20% sobre branco (`#eeddfd`) | 5,45:1 | 3,09:1 |
| 10% sobre branco (`#f6eefe`) | 6,18:1 | 3,50:1 |
| 20% sobre navy (`#37336d`) | **1,62:1** | 2,86:1 |
| 10% sobre navy (`#292e5b`) | **1,84:1** | 3,24:1 |

1,62:1 é ilegível. Nenhuma combinação de badge roxo passa AA no tema escuro.

### 3.4 Bronze

`--artificio-bronze: #9c6b43` com `--fg`: **4,10:1** claro, **4,04:1** escuro.
Reprova nos dois. Dois consumidores:

- `TableCardDashboard.tsx:246` — botão "Arquivar", **já corrigido na spec 103**;
- `TableCardDashboard.tsx:103` — badge "🗄️ Arquivada", **não tocado**.

`check-token-parity.mjs:80` trava o token nas duas fontes: remover exige tirar do
script.

## 4. T3 — onde a guarda deve morar

Hoje `contrasteMarca.test.ts` vive em `apps/mesas/frontend/src/utils/` e lê
`packages/ui/src/styles.css` por caminho relativo
(`../../../packages/ui/src/styles.css`) — um app testando o pacote. Funciona, mas
só roda na suíte do `mesas`.

`packages/ui/src/styles.contract.test.ts` já roda no `ci.yml` e já assere
`styles.css` como texto (spec 103 T6.1 estende esse mesmo arquivo). É o lugar mais
provável para a parte que mede **tokens**. A varredura de **consumidores**
(procurar `bg-[var(--token-cru)]` no código do app) precisa continuar por app,
porque o pacote não vê o código deles.

Padrão obrigatório, herdado da 103: **calcular** a razão a partir do valor lido do
CSS, nunca conferir se a classe cita o nome do token. Conferir nome passaria
mesmo se o pacote trocasse o valor por um que reprova — que é literalmente como o
defeito da 103 nasceu.

Duas pegadinhas já pagas, documentadas em `contrasteMarca.test.ts:33-41` e
`TableEditor.test.tsx:444`:

1. **Tirar comentários antes de qualquer casamento.** `styles.css` documenta a
   própria estrutura de tema em prosa (linhas 134-136), e a primeira versão da
   guarda recortou o bloco escuro nessa MENÇÃO em vez de no seletor real.
2. **Extrair só o VALOR do `className`**, não a tag inteira: o comentário que
   documenta a correção cita a classe errada em prosa, e a asserção negativa casa
   no comentário.

## 5. Validação

Um comando por vez — `test`/`lint`/`build` em paralelo trava a máquina do
mantenedor (AGENTS.md T0).

- `pnpm --filter @artificio/ui test` e `check-token-parity.mjs`;
- `pnpm --filter @artificio/mesas test`, `lint`, `build`;
- os outros consumidores de `--fg` conferidos: `downloads` (42 arquivos),
  `glossario` (18), `site` (1);
- `pnpm verify:api` se algum arquivo sob `apps/` ou `packages/` mudar;
- tema claro E escuro conferidos visualmente nos apps tocados. Lighthouse do tema
  escuro é o único sinal automático do defeito de §3.1, então ele fecha o aceite
  de T2 — e exige deploy.
