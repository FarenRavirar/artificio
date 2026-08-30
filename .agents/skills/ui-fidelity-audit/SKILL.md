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

```bash
node .agents/skills/ui-fidelity-audit/audit.mjs <caminho-do-tsx-ou-css> [...]
```

Aceita `.tsx` e `.css` juntos (a tela costuma ser os dois). Sem argumento, explica o uso.

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
