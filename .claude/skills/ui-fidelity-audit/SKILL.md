---
name: ui-fidelity-audit
description: Audita uma tela/rota do monorepo Artifício RPG contra o design system compartilhado (@artificio/ui) — uso de primitivos, régua de espaçamento --space-1..6, escala de altura de controle, tokens de cor vs literais, e paridade tokens.ts/styles.css/tailwind-preset. Read-only, saída em números. Use antes de acrescentar campo/seção a uma tela existente, ao revisar PR de frontend, ou quando pedirem "auditoria de design", "fidelidade visual", "está seguindo o design system?".
---

# Auditoria de fidelidade visual

Mede se uma tela consome o design system ou reinventou um paralelo. **Read-only** — mede e
reporta, não corrige sem autorização.

## Regra que governa a auditoria

**Não se declara escala nova; adota-se a que o pacote já tem.** Decidido na spec 098 §6.3 e
reaplicado na 099 §9. Escala/token/cor próprios de um app são a *divergência por app* que o
AGENTS.md trata como dívida — mesmo quando a tela funciona.

Corolário: o achado desta auditoria quase nunca é "criar" algo. É **adotar o que existe**.

## Como rodar

**Alvo dirigido** — antes de mexer numa tela, ou ao revisar PR de frontend:

```bash
node .agents/skills/ui-fidelity-audit/audit.mjs <tsx> <css> [...]
```

**Varredura do repo** — panorama por app, para decidir por onde começar:

```bash
node .agents/skills/ui-fidelity-audit/audit.mjs --repo
```

Varre `apps/*` e `packages/*` (468 arquivos), **excluindo build e dependência**
(`node_modules`, `dist*`, `.venv`, `.turbo`, `coverage`, `.astro`, `public`) — sem esse
filtro a varredura audita o Playwright do camoufox e o ruído afoga o achado real. Imprime
só o resumo por app, ordenado por reimplementação (peso 10) e depois fora-régua.

**Gate de não-regressão** — roda no CI, falha só se a divergência **aumentar**:

```bash
pnpm ui:fidelity:gate       # compara contra baseline.json
pnpm ui:fidelity:baseline   # regrava o retrato (quando a divergência CAI)
```

## Por que gate de não-regressão, e não gate absoluto

O repo tem **555 achados** hoje. Um gate que exigisse zero seria desligado na primeira
semana — e gate desligado é exatamente o defeito que esta skill existe para combater
(`check-token-parity.mjs` viveu meses escrito e não chamado).

Travar o **crescimento** é o que impede a recorrência: a próxima spec não consegue
acrescentar divergência nova sem que o CI reprove. A dívida existente sai por spec, e cada
vez que sai, `pnpm ui:fidelity:baseline` trava o ganho.

## Medição em viewport (`runtime.mjs`) — o que só existe renderizado

```bash
node .agents/skills/ui-fidelity-audit/runtime.mjs --plan        # imprime rotas + script
# rodar cada combinacao via Playwright MCP (resize -> navigate -> evaluate)
node .agents/skills/ui-fidelity-audit/runtime.mjs --check coleta.json
```

**Por que não dá para resolver com leitor de DOM+CSS.** Medido nesta base: `jsdom` lê
`getComputedStyle` perfeitamente (devolve `font-size: 14px`, `width: 100px`) mas
`getBoundingClientRect` volta **0×0** e `scrollWidth` **0** — ele monta a árvore e resolve
as regras, **não faz layout**. Quem calcula posição, quebra de linha e overflow é o
Chromium. Por isso a medição usa Playwright MCP e não uma lib de parsing.

| medição | o que só o runtime vê |
|---|---|
| **[R1]** alvo < 24px | altura **real**, não a declarada (WCAG 2.2 SC 2.5.8 AA) |
| **[R2]** texto estourando/cortado | `scrollWidth > clientWidth` — depende da fonte carregada e do conteúdo real |
| **[R3]** overflow horizontal da página | barra lateral em mobile, invisível no CSS |
| **[R4]** contraste efetivo | a cor de fundo real é a do primeiro ancestral opaco — só se descobre subindo a árvore renderizada |

Alvo padrão: `mesasbeta.artificiorpg.com` (sobrescreva com `UI_FIDELITY_BASE`). Rotas
públicas apenas — **o editor exige sessão e está fora desta etapa**; medi-lo exigiria o
Chrome logado do mantenedor, que precisa de autorização nominal.

Larguras: **1366×768** e **1920×1080** (exigidas por A3 da spec 099) e **719px** (a media
query do editor, spec 099 §7).

## Alcance: o que ela cobre e o que NÃO cobre

**Cobre:** o que é mecanicamente verificável no CSS/TSX — consumo de primitivo, régua de
espaçamento, grade de 4px, token vs literal, paridade do pacote, e reimplementação.

**Não cobre, e não deve fingir que cobre:**

- **Renderização** — coberta pelo `runtime.mjs` (acima), **não** pelo `audit.mjs`. São
  scripts separados de propósito: um roda em qualquer lugar sem navegador, o outro precisa
  de Chromium e de uma URL no ar.
- ~~Tailwind por classe utilitária~~ — **resolvido pela medição [8]**. Ver abaixo.
- **Escolha de design.** Se a tela deve ter aquele componente, aquela hierarquia, aquele
  peso tipográfico — nada disso é mecânico.
- **`packages/ui`.** O pacote **define** a régua; medi-lo contra ela mesma acusa a fonte da
  verdade (medido: 19 "fora da régua" em `styles.css`, que são a própria escala do pacote).
  As medições de consumo são puladas ali; o que vale é a paridade `[6]`.

## As seis medições

| # | O que mede | Verde |
|---|---|---|
| 1 | imports de `@artificio/ui` no TSX | > 0 — tela sem nenhum reinventou primitivos |
| 2 | `var(--space-*)` no CSS | > 0 — a régua do pacote é base 4px (`styles.css:62-66`) |
| 3 | valores distintos de `gap`/`padding`/`margin` | ≤ 6 (tamanho da régua); acima disso é escala paralela |
| 4 | valores fora da grade de 4px | 0 — `0.875rem` (14px) é o reincidente do repo |
| 5 | cores literais vs `var(--artificio-*)` | literal só nas exceções (abaixo) |
| 6 | paridade de tokens do pacote | `node packages/ui/scripts/check-token-parity.mjs` verde |
| **7** | **classes locais sobre conceito que o pacote já define** | **0** |
| **7b** | **`@keyframes` redeclarado** | **0** |
| **8** | **espaçamento Tailwind (`gap-3.5`) fora da régua** | **0** |

## A medição 8 fecha o furo por onde o mesmo defeito passou duas vezes

`[2][3][4]` leem CSS. Tela escrita só com classe utilitária **não era auditada** — e foi
por aí que o mesmo `gap-3.5` (14px) escapou no editor de mesa (098 §6.3) e no de perfil
(099 §9).

Escala Tailwind: 1 unidade = `0.25rem` = 4px; o sufixo `.5` é **meio passo (2px)** e por
definição não fecha na grade de 4. Medido no repo: **376 usos fora da régua**, sendo 309
fracionários — `glossario` 98, `mesas` 207, e 20 no pacote `catalog-ui`.

## A medição 7 é a mais importante: reimplementação

O pacote existe para **evitar divagação de estilo e duplicação**. O defeito que mais quebra
padronização não é usar pouco o pacote — é **reescrever localmente, com outro nome, o que ele
já define**. O nome diferente esconde a duplicação, e as duas versões divergem com o tempo.

**Medido no editor de perfil da 099** (o caso que originou esta medição): `@keyframes spin`
redeclarado localmente com **1s e borda de 4px**, enquanto o pacote define
`@keyframes artificio-spin` com **760ms e borda de 2px** — dois spinners girando em ritmos
diferentes na mesma suíte. Mais 20 classes sobre conceito já coberto (`btn-*`, `avatar-*`,
`field-description`).

**Ao achar reimplementação, a pergunta não é "está feio?", é "por que não é o do pacote?"**.
Se houver motivo real (o primitivo não cobre o caso), o comentário inline diz qual — senão
o próximo agente reescreve de novo.

## Válvula de escape: justificativa inline

Primitivo que não cobre o caso **não** obriga a renomear classe para escapar do scanner.
Comentar a regra desarma o achado daquela classe:

```css
.btn-connect-discord { /* ui-fidelity: cor de plataforma fixa, o primitivo tematiza */ }
```

Sem o comentário, a classe é acusada. **O motivo é obrigatório** — é ele que impede o
próximo agente de reescrever tudo de novo.

## O que a medição 7 NÃO acusa

Composição local não é reimplementação. `.avatar-premium-container` é contêiner próprio;
o pacote só oferece `avatar`, `avatar-fallback` e `avatar-link`. Acusar por prefixo
obrigaria a renomear para enganar o scanner — o oposto do objetivo.

Acusa em dois casos, ambos com evidência: **colisão direta** (a classe canonizada existe
no pacote), e **família** (o conceito existe como sufixo de outro primitivo — `spinner`
só existe como `button-spinner`; reescrevê-lo solto duplica a regra).

**Falso positivo conhecido:** a lista de conceitos é **curada** (`button`, `badge`, `avatar`,
`banner`, `field`, `panel`, `modal`, `dialog`, `textarea`, `input`, `select`, `spinner`,
`card`, `tab`). Fatiar todo nome de classe por hífen acusaria `user-systems-selector` por
causa de `usermenu`. Ao ampliar a lista, testar contra `packages/ui/src/admin/admin.css`,
que deve continuar com 0.

## O que NÃO é dívida — não "corrigir"

Ler o contexto antes de acusar cor literal. São exceções **deliberadas** (spec 022 T8):

- **identidade de plataforma** — Discord `#5865f2`, Google `#4285f4`, cor de marca;
- **gradientes decorativos** (avatar, badges) e **scrims** `rgba(0,0,0,*)`;
- **texto claro sobre fundo opaco escuro** (gradiente ou `var(--artificio-brand)`) — correto
  nos dois temas.

O tema vira pelas **vars do pacote**; blocos `[data-theme=light]` locais foram removidos de
propósito. Quem os reintroduz traz de volta um bug fechado.

**A cor literal só é defeito quando o fundo vira com o tema e o texto não.** Medir isso é
ler o seletor, não contar ocorrências.

## Armadilhas do pacote (medidas — não descobrir na implementação)

1. `Field` **não** emite `aria-describedby` (computa o `id`, nenhum controle o recebe).
2. `Textarea` **ignora** a escala de altura (`min-height: 112px` vence por ordem).
3. **Não existem** checkbox nem tag input no pacote.
4. `admin/*` sai de `@artificio/ui/admin`, não do índice raiz.

Escala de controle: `artificio-control-sm/md/lg` = **34/40/48px** de `min-height`.
Alvo de clique: **24×24 CSS px** (WCAG 2.2 SC 2.5.8 AA) — 44/48px são diretrizes de toque,
não se aplicam a desktop.

## Saída esperada

Números por medição e o veredito por linha. Sem número, não é auditoria — é impressão.
Achado que exige tocar `packages/ui` **para e pede aprovação nominal** (§Autorização).
