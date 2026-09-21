# Tasks 104 — Cor de identidade: `#222222` no tema claro e a família roxa

> Ordem recomendada: T3 → T1 → T2 (`plan.md` §1). T3 não depende de decisão do
> mantenedor e é o que torna as outras duas verificáveis.
>
> **Nada desta spec entra na PR #328** (spec 103). Branch e PR próprias,
> autorização nominal própria — `packages/ui` serve 7 apps.

## T0 — Manutenção do mapa

### [ ] T0.1 — Registrar no mapa geral
Atualizar `specs/backlog.md` e `.specify/memory/project-state.md` ao abrir débito
e ao fechar. A linha em `specs/README.md` §Status rapido foi criada na abertura.

**Aceite:** as três fontes citando a 104 com o mesmo estado.

---

## T1 — `--artificio-light-ink`: `#0b1220` → `#222222`

Decisão de aparência **já tomada** pelo mantenedor: "o tema light está muito
estranho sem o 222222". Não é bug de contraste — `plan.md` §2.4 mede que os dois
valores passam AAA. Falta executar sem quebrar o resto.

### [ ] T1.1 — Mapear as fontes de verdade antes de tocar

Confirmar as três fontes (`plan.md` §2.1) e resolver o slot `null` de `lightInk`
em `preset.js` no `check-token-parity.mjs:178-182`: é intencional ou lacuna? Outros
papéis têm três fontes.

**Aceite:** as fontes reais escritas aqui, com linha e valor, medidas — não
copiadas deste plano.

### [ ] T1.2 — Decidir literal recalculado × `color-mix`

Os 27 literais de `11, 18, 32` (`plan.md` §2.2) precisam ou de valores novos, ou
de virar derivação do token. Derivar elimina a classe de defeito "literal que não
acompanha o token", mas muda o contrato de `packages/ui` e pede aprovação nominal
própria.

Decisão técnica, do agente (AGENTS.md §Produto vs. técnico) — salvo a parte de
aprovação, que é dele. Medir suporte antes: o repo já usa `color-mix(in_srgb,…)`
em `VttPlatformsEditor.tsx:116`, o que é indício, não política.

**Aceite:** escolha escrita aqui com o motivo medido.

### [ ] T1.3 — Recalcular a escada

`#222222` a 66% sobre branco dá **4,29:1**, abaixo de 4,5:1 (`plan.md` §2.3).
Cada nível (`--fg-muted`/`soft`/`low`/`faint`/`ghost`, mais os `--admin-fg-*` e as
12 regras `.text-white\/NN`) recebe opacidade recalculada e medida.

**Aceite:** tabela nível × razão sobre `--artificio-light-surface`, cada um ≥ 4,5:1
ou ≥ 3:1 com o papel declarado como componente. Nível que não fecha em nenhum dos
dois volta para o mantenedor, não recebe exceção silenciosa.

### [ ] T1.4 — Aplicar e verificar os consumidores

`var(--fg)` medido fora do `mesas`: 61 arquivos (`downloads` 42, `glossario` 18,
`site` 1).

**Aceite:** `#0b1220` não aparece em nenhuma fonte de token nem nos 27 literais;
`check-token-parity.mjs` verde; `pnpm --filter @artificio/ui test` verde; tema
claro conferido nos 4 apps que consomem `--fg`.

---

## T2 — Família roxa e bronze

**BLOQUEADA por D1/D2/D3** (`spec.md` §5): o que o roxo significa, se ele sai ou
fica, e o badge "🗄️ Arquivada". As medições estão feitas; falta a decisão de
produto.

### [ ] T2.1 — Levantar o significado de cada uso

Medido, o roxo marca papéis diferentes com a mesma cor: "Covil do Lich", "Mestre",
plataformas de VTT, tipo de nó no admin (`plan.md` §3.2). Listar cada um dos 46
pontos com o papel que ele comunica, para o mantenedor responder D1 sobre fatos e
não sobre memória.

**Aceite:** a lista escrita aqui, agrupada por papel, com arquivo e linha.

### [x] T2.2 — Os 2 botões sólidos ficaram na spec 103

`VttPlatformsEditor.tsx:158` (era `--special` + `--fg`: 2,68:1 claro, **3,50:1**
escuro) e `MestreContactForm.tsx:138` (era `--special` + `--on-solid-fg`: 6,98:1
claro, **3,96:1** escuro). Os dois também usavam `hover:brightness-90`, que
escurece o fundo sem medir a razão resultante.

Entraram na PR #328 e não aqui: o mantenedor decidiu "botões normalmente são
laranjas", os três botões sólidos são a mesma correção, e deixar 2 de 3 na árvore
seria estado inconsistente — a 103 já tinha trocado o irmão
(`TableCardDashboard.tsx:246`). Os três usam o par `--brand-solid`/`-fg`/`-hover`
e nenhum tem `brightness`.

**Fica para esta spec** todo o resto do roxo: os 14 usos de texto e ícone, os 8
RGB crus, as 38 classes `purple-NNN` (T2.1/T2.3) e o badge de bronze (T2.4).

### [ ] T2.3 — Decidir e aplicar o destino do roxo

Saindo: cada papel vai para laranja, navy ou neutro, e os 8 RGB crus mais as 38
classes `purple-NNN` saem com ele. Ficando: par completo por tema
(`--special-solid`/`-fg`/`-hover` + um token de TEXTO que passe sobre
`--artificio-dark-surface` e `--artificio-dark-canvas`), e os 46 pontos migram
para ele.

Nenhum badge translúcido roxo passa AA no escuro hoje — o pior mede **1,62:1**
(`plan.md` §3.3). Isso vale para as duas saídas: o fundo translúcido precisa de
revisão, não só a cor do texto.

**Aceite:** cada um dos 46 pontos com papel declarado e razão medida ≥ o limite do
papel nos DOIS temas; zero RGB cru de roxo; `ImportPreview.tsx:133` do
**glossário** verificado, porque é outro app.

### [ ] T2.4a — Checkmark de seleção reprova até o 3:1 de componente

`VttPlatformsEditor.tsx:123` — fundo `bg-[var(--special)]` num círculo de 20px,
com `<Check className="text-[var(--fg)]">` dentro. Ícone é gráfico, então o
critério é o **3:1** de componente de interface (WCAG 1.4.11), não o 4,5:1 de
texto. Reprova mesmo nesse limite mais baixo: medido **2,68:1** no claro e
**3,50:1** no escuro.

**Achado pela guarda**, não por lista: foi a varredura de fundo sólido escrita na
spec 103 que o encontrou. Não estava em nenhum levantamento anterior — nem no dos
22 botões, nem no dos 3, nem nos 46 pontos de roxo.

Está nomeado na exceção de `contrasteMarca.test.ts` para não sumir em silêncio.
Corrigir aqui junto com T2.3, porque o destino depende de D2.

**Aceite:** razão ≥ 3:1 nos dois temas, com o papel declarado como componente; a
exceção correspondente sai da guarda.

### [ ] T2.4 — Bronze: o badge e o token

`TableCardDashboard.tsx:103` (badge "🗄️ Arquivada") segue com `--artificio-bronze`
+ `--fg`: **4,10:1** claro, **4,04:1** escuro. Pareia visualmente com o botão
"Arquivar" que a 103 passou para laranja — mexer num sem o outro separa o par (D3).

Removendo o token: `check-token-parity.mjs:80` trava `--artificio-bronze` nas duas
fontes e precisa ser ajustado junto.

**Aceite:** o badge com razão medida ≥ 4,5:1 nos dois temas; se o token sair, as
duas fontes e o script limpos, e `rtk rg "artificio-bronze" apps packages`
devolvendo zero.

---

## T3 — Guarda de contraste para todo par sólido

Independente das decisões de produto. **Fazer primeiro.**

### [ ] T3.1 — Generalizar de "par de marca" para "todo par sólido"

`contrasteMarca.test.ts` mede só `--brand-solid*`, e é por isso que bronze e roxo
existiram sem trava. Varrer os pares `*-solid`/`*-solid-fg`/`*-solid-hover` do
pacote e falhar quando qualquer um reprovar o limite do seu papel, em qualquer
tema. Par novo entra sob a trava automaticamente.

Padrão obrigatório: **calcular** a razão do valor lido do CSS, nunca conferir se a
classe cita o nome do token (`plan.md` §4). Duas pegadinhas já pagas estão em
`plan.md` §4 — ler antes de escrever o regex.

**Aceite:** a guarda falha ao introduzir um par que reprova — **provado vermelho
antes de corrigir**, como a spec 103 T6.1 exige. Guard que nunca foi visto
vermelho não é guard.

### [ ] T3.2 — Decidir onde a guarda mora

`packages/ui/src/styles.contract.test.ts` já roda no `ci.yml` e já assere
`styles.css` como texto — lugar provável para a parte que mede tokens. A varredura
de consumidores continua por app, porque o pacote não vê o código deles.

**Aceite:** a parte de token rodando no CI para os 7 apps; a varredura de
consumidores rodando na suíte de cada app que usa o token.

---

## Registro de medição — 2026-09-20 (abertura)

Tudo abaixo foi medido nesta data, durante a spec 103. Está aqui para não ser
remedido.

- **A identidade tem 4 cores e nenhuma combinação útil reprova**, salvo laranja
  puro + branco (3,16:1), que `--brand-solid` já resolve. Tabela em `spec.md` §2.
- **`#222222` não existe no pacote.** `rtk rg "222222|#222\b" packages/ui/src/styles.css`
  devolve **zero**. O mais próximo é `--artificio-charcoal: #0f1014` (`:9`), que é
  outro valor — **investigar** se foi tentativa anterior de trazer o cinza da
  identidade, e quem o consome.
- **`[data-theme="light"] .text-white`** (`index.css:241`) é o único dos 13
  overrides que usa o TOKEN; os 12 irmãos usam RGB cru. **Investigar** se é
  intencional ou migração parada.
- **`--admin-fg`** (`admin.css:40`) tem o literal duplicado como fallback:
  `var(--artificio-light-ink, #0b1220)`. O fallback também muda.
- **7 apps em `apps/`** (`accounts`, `downloads`, `glossario`, `links`, `mesas`,
  `site`, `site-admin`). `esferas` e `srd` estão no AGENTS.md mas **não existem**
  no diretório — corrigir a contagem de "6 apps" que a spec 103 usa.
- **O comentário do token mente por omissão.** "acento especial (roxo) — AA sobre
  claro" (`styles.css:160`) descreve a intenção; a metade escura nunca foi medida
  e reprova. Mesma família do defeito que `--brand-solid` corrigiu: nome correto,
  valor insuficiente.
