# Spec 098 — Forma e usabilidade do editor de anúncio

**App:** `mesas` · **Criada:** 2026-08-27 · **Status:** aberta
**Origem:** achado do mantenedor (2026-08-27), no beta, depois do deploy da 097:
*"cara, você tem zero noção de usabilidade né? (…) caixa de texto muito baixa,
toda vez o cara tem que redimensionar (…) quando o cara clica em adicionar
contato, não dá para ver que ele desceu para baixo (…) o botão sincronizar com o
perfil principal do mestre, também todo bugado, mal dá para ver (…) não tem
recuo em cima e em baixo, tá colado no header ou na parte de baixo da tela."*

**Escopo, dito pelo mantenedor:** *"o contraste é o de menos. usabilidade, as
caixas, a forma que os elementos estão usáveis e decorados."* Padrões de
avaliação: heurísticas **e** padrões de mercado de design. Acessibilidade por
teclado **fora de escopo** por decisão dele.

---

## 0. O que esta spec é

A 097 consertou o que **impedia** o uso: o editor cortado, a busca de cenário, o
campo de estilos morto. Esta spec trata do que sobrou depois: o editor **abre e
funciona**, mas a forma dos elementos obriga o mestre a trabalhar contra a tela —
redimensionar caixa toda vez, adivinhar onde o conteúdo novo apareceu, procurar
botão que quase não se vê.

Diferença que importa para o recorte: **nada aqui é bug de lógica.** É layout,
densidade, largura, espaçamento e resposta a ação. Nenhum item exige mudança de
contrato, migration ou backend.

---

## 1. Referências de avaliação

Nesta ordem, e nomeadas para o agente não inventar critério próprio:

| Fonte | O que se cobra dela |
|---|---|
| **GOV.UK Design System** | escolha exclusiva com explicação = radio com *hint*, não botão (§6.5) |
| **10 Heurísticas de Nielsen** | #1 visibilidade do estado do sistema, #4 consistência, #6 reconhecer em vez de lembrar, #8 estética e design minimalista |
| **ISO 9241-11** | eficácia, eficiência e satisfação — já citado no AGENTS.md como gate de interface |
| **Material Design 3** | escala de espaçamento base 4dp (a que `packages/ui` já usa); alvo de **toque** ≥48dp — não é o critério de desktop, ver §6.4 |
| **Apple HIG** | alvo de **toque** ≥44pt, hierarquia visual, agrupamento |
| **Baymard Institute** | largura do campo sinaliza o tamanho esperado da resposta (faixa típica 18-33 caracteres); campo de texto longo deve caber a resposta típica sem rolagem |
| **WCAG 2.2** | **2.5.8 (alvo ≥24×24px) é o critério que de fato vale no desktop**; 1.4.3 (contraste) entra só como piso — **não** é o foco (decisão do mantenedor) |

---

## 2. O que já foi medido (2026-08-27, beta, mesa `A Praga de Valekar`)

Viewport 1815×962, tema escuro, editor em `/painel?edit=…`. Todas as medições
por `getBoundingClientRect`/`getComputedStyle` na tela real.

### 2.1 Caixa de texto baixa demais — o achado principal do mantenedor

| campo | altura visível | conteúdo real | % visível |
|---|---|---|---|
| `Descrição da mesa` | **180px** | **580px** | **31%** |

O mestre vê menos de um terço do que escreveu. `resize: vertical` existe, então
"dá para arrastar" — e é exatamente a reclamação: **toda vez**. Baymard: campo de
resposta longa deve caber a resposta típica; 1372 caracteres é o caso comum,
não o extremo.

A `Bio do mestre` tem o mesmo desenho (120px de caixa) e some com o texto do
mesmo jeito quando preenchida.

### 2.2 "Adicionar contato" não leva o olho até o que criou

Medido, clicando no botão:

```
antes:  altura da parte 946px · scrollTop 0
depois: altura da parte 1054px (+108) · scrollTop 0  ← não rolou
rolagem disponível: 149px, não usada
```

O bloco novo nasce **abaixo da dobra** e a tela não se move. Nielsen #1: o
sistema não mostra o resultado da própria ação. O mestre clica e parece que nada
aconteceu.

O mesmo vale para o menu de canais que o botão abre — ele aparece embaixo, fora
da vista.

### 2.3 "Sincronizar com o Perfil Principal de Mestre"

- posição `top: 971` com a área visível terminando em `962` → **fora da vista**
  ao abrir a aba (`visivel: false`, medido);
- altura **32px** com `line-height: 13px` e `font-size: 13px` — o texto fica
  espremido na caixa. Abaixo dos mínimos de Material (48dp) e HIG (44pt);
- largura 293px num rótulo de 43 caracteres.

### 2.3-bis Bloco "Quem está publicando esta mesa?" — texto grudado

Achado do mantenedor: *"na parte de anunciante, tá com texto bugado."*
Confirmado na tela — os dois botões renderizam assim:

```
"Sou o mestre desta mesaSem selo de anunciante."
"Sou apenas anuncianteA mesa exibirá o selo \"Apenas anunciante\"."
```

Rótulo e explicação **colados, sem espaço nem quebra**, numa linha só.

**Causa raiz medida (é do pacote, não do editor).** `MasterPart.tsx:44-50` faz o
certo: manda dois `<span>` separados e pede `flex-col` no botão —

```tsx
<span className="font-semibold">Sou o mestre desta mesa</span>
<span className="text-xs opacity-75">Sem selo de anunciante.</span>
```

Mas o `Button` de `packages/ui` embrulha **todos** os children num `<span>`
único (`primitives.tsx:57`, `.artificio-button-label`), que na tela computa
`display: block` e `white-space: nowrap`. O `flex-col` do consumidor se aplica
ao botão, não a esse span intermediário — então os dois textos viram linha
corrida, sem separação, e o `nowrap` impede qualquer quebra.

Consequência de escopo: **o conserto correto é no pacote compartilhado**
(`packages/ui`), não em `apps/mesas`. Pelo AGENTS.md isso exige aprovação e
verificação de impacto nos consumidores — o `Button` é usado por todos os apps.
Um remendo local no `mesas` resolveria a tela e deixaria o mesmo defeito de pé
para o próximo consumidor que empilhar dois textos num botão: é exatamente a
"exceção por app" que o AGENTS.md trata como dívida.

Medido também: os dois botões têm `line-height: 14px` com `font-size: 14px` numa
caixa de 42px — o mesmo aperto do botão de sincronizar (§2.3).

### 2.3-ter Aba "Mestre e contato" — varredura completa

Pedido do mantenedor: *"veja mestre e contato também."* Mapa da aba, medido bloco
a bloco (aba com 1006px em 905px de área visível):

| bloco | altura | topo (relativo) |
|---|---|---|
| Quem está publicando esta mesa? | 93px | 24 |
| Nome do mestre real | 92px | 131 |
| Nome de exibição do mestre | 92px | 237 |
| **Bio do mestre nesta mesa** | **295px** | 344 |
| **Canais de recrutamento** | **353px** | 653 |
| Valor (do contato) | 92px | 749 |
| Label personalizado | 68px | 849 |

Dois blocos (`Bio` e `Canais`) somam **648px dos 1006** — 64% da aba. Tudo o que
vem depois deles é empurrado para fora da vista, e é justamente onde estão
`Adicionar contato` (§2.2) e `Sincronizar` (§2.3).

**O campo `Bio do mestre` repete o defeito de §2.1:** caixa de 120px com barra
de rolagem própria, mostrando ~2 linhas de um texto de várias. Visível no
screenshot: o texto é cortado no meio da terceira linha.

**Achado que NÃO é defeito, registrado para o agente não perseguir:** ao clicar
em `Sou apenas anunciante`, aparece um campo obrigatório novo (`Nome do mestre
real`) vazio, e o preenchimento cai de 100% para 89%. Isso é o fluxo
funcionando — o papel de anunciante exige nomear o mestre real. Foi efeito de um
clique meu de teste, desfeito em seguida; nada foi salvo.

### 2.4 Sem respiro em cima e embaixo

`.table-editor-part` tem `padding: 24px` em cima e embaixo, e o documento
(`.table-editor-document`) tem **`padding: 0`**. Entre a barra de ações (57px) e
o primeiro campo há **24px**; no fim, o último elemento encosta igual.

### 2.5 Largura dos campos não diz nada sobre a resposta esperada

Baymard: a largura é a dica visual do tamanho da resposta. Medido por aba:

| aba | campo | largura |
|---|---|---|
| Quando joga | `Horário de início` | **844px** |
| Quando joga | `Frequência` | **844px** |
| Quando joga | `Vagas totais` | 120px ✔ |
| Identidade | `Título da mesa` | 560px |
| Identidade | `Sistema da mesa` | 399px |
| Onde joga | `Plataforma (VTT)` | 810px |
| Para quem é | (todos) | 206px ✔ |

Um horário (`19:00`) e uma frequência (`semanal`) recebem a coluna inteira,
enquanto a aba `Para quem é` usa 206px para tudo. Não há escala: **399, 560,
711, 715, 810, 844** convivem sem regra.

### 2.6 Espaçamento entre campos sem escala

Distância entre campos consecutivos, medida por aba:

| aba | gaps |
|---|---|
| Identidade | 14, 31, 32, 80, **609** |
| Quando joga | 14, 64 |
| Onde joga | 31 |
| Valores | 14, 14, 47 |
| Para quem é | 14, 14, 34 |

Material 3 e HIG pedem escala consistente (base 4/8px). Aqui há `14px` — que não
é múltiplo de 4 nem de 8 — convivendo com `31`, `32`, `47`, `64`, `80` e um vão
de **609px**. Nielsen #4 (consistência) e #8 (design minimalista): o
espaçamento é o que agrupa campos relacionados, e sem escala ele não agrupa nada.

### 2.7 Alvos de clique abaixo do mínimo

13 controles com menos de 44px de altura só na aba Identidade. Os piores, todos
com **16px**:

`Remover imagem` · `Limpar seleção` · `Remover` (cenário) · a caixa de seleção
`Manter link direto` · o `×` das tags de estilo (20px)

**Correção do próprio agente (ver §6.4):** eu havia escrito que "16px reprova
nos três" tratando 44/48px como se valessem aqui. Não valem — são diretrizes de
**toque** (HIG 44pt, Material 48dp). No desktop o critério é WCAG 2.2 SC 2.5.8:
**24×24px**, nível AA. Os cinco controles de 16-20px reprovam nesse piso
obrigatório; os de 32-42px passam no piso e ficam abaixo do recomendado para
toque — o que importa porque o editor tem versão mobile (media query em 719px).

### 2.8 Densidade da aba Identidade

2474px de conteúdo em 905px de área visível — **2,7 telas** de rolagem para uma
aba. É a única acima de 1,0; as outras seis cabem ou quase cabem.

### 2.9 Contraste — registrado, mas fora do foco

Duas falhas reais de WCAG 1.4.3 (`Selecionar imagem` e o nome do cenário
selecionado, ambos 3.16 contra o mínimo 4.5). Fica registrado; o mantenedor
disse explicitamente que **não é a prioridade**.

**Erro próprio, registrado:** minha primeira medição de contraste acusou **13**
falhas com razão `1.47` repetida. Estava errada — o parser não lia `oklab()`, o
formato que o design system usa. Refeita com conversão pelo próprio browser:
são **2**. Número errado sobre a tela é pior que número nenhum.

---

## 3. Objetivo

O mestre preenche o anúncio sem lutar contra a tela: campo de texto que cabe o
que ele escreve, ação que mostra o próprio resultado, controle que dá para
acertar com o mouse, e espaçamento que agrupa o que é do mesmo assunto.

---

## 4. Escopo

**Dentro:** altura e largura de campos, espaçamento e escala, alvos de clique,
resposta visual à ação (rolar até o item criado), respiro do documento, e o
botão de sincronizar.

**Fora:**
- **Acessibilidade por teclado** — decisão do mantenedor.
- Contraste como prioridade — só o piso registrado em §2.9.
- Mudança de contrato, migration, backend.
- Rever decisão de produto da 096 (quais campos existem e onde). Aqui se trata
  da **forma**, não do conjunto.

---

## 5. Critérios de aceite

- **A1.** `Descrição da mesa` e `Bio do mestre` cabem a resposta típica sem o
  mestre precisar redimensionar. Medida: o conteúdo real da mesa de teste
  (1372 caracteres) visível sem rolagem interna.
- **A2.** Clicar em `Adicionar contato` deixa o bloco novo visível sem o mestre
  procurar — medido por `scrollTop` e posição do bloco após o clique.
- **A3.** `Sincronizar com o Perfil Principal de Mestre` está visível ao abrir a
  aba, e o texto não fica espremido na caixa.
- **A4.** Documento com respiro em cima e embaixo; nada encosta na barra de
  ações nem na borda inferior.
- **A5.** Largura dos campos segue escala declarada e proporcional ao conteúdo
  esperado. Nenhum campo de 5 caracteres com largura de coluna inteira.
- **A6.** Espaçamento entre campos segue escala de 4/8px, sem `14px` nem vãos
  órfãos de centenas de pixels.
- **A7.** Nenhum alvo de clique abaixo de 44px de altura.
- **A8.** A altura das 7 abas está medida antes e depois. **Não** se exige
  redução — reorganizar está fora de escopo (§7); a altura cai só como
  consequência das outras fases, e a rolagem longa está aceita.
- **A9.** Todas as 7 abas verificadas na tela, nos dois temas, em 1366×768 e
  1920×1080 — não só a aba onde o defeito foi achado.
- **A10.** Cada correção com teste que falha sem ela (verificado
  reintroduzindo o defeito).
- **A11.** Cada correção está **no nível em que impede a recorrência**, medido
  (AGENTS.md §Compartilhado por padrão; §6.10 desta spec). Entrega do tipo
  "ajustei os N valores do `mesas`" reprova: é o caso particular que a regra
  pétrea proíbe. Concretamente: `field-sizing` no `ContentEditor` (não nos seis
  `minHeight` locais); espaçamento e largura no componente de campo (não nas 8
  ocorrências de `gap-3.5`); `Button` no pacote (não remendo no `MasterPart`).
- **A12.** Onde o defeito existe fora do `mesas`, o outro app foi verificado
  junto — medido: o `downloads` sofre o mesmo defeito de caixa de texto
  (`maxLength={50000}` no default de 192px) e nunca foi reclamado.

---

## 6. Pesquisa: o que os modelos de referência dizem (2026-08-27)

Pesquisado depois das medições, para que as decisões saiam de padrão
estabelecido e não de gosto do agente. Cada item traz a fonte.

### 6.1 Altura do campo de texto → resolve D1

**`field-sizing: content` é o padrão moderno**: uma linha de CSS faz o campo
crescer com o conteúdo, sem JavaScript. Suporte global medido em
[caniuse](https://caniuse.com/mdn-css_properties_field-sizing): **83,95%** —
Chrome/Edge 123+, Safari 26.2+, Firefox 152+.

Recomendação da fonte: **sempre parear com `min-height` e `max-height`**, senão
um texto muito longo empurra a página inteira. Isso responde a objeção que eu
tinha levantado contra o auto-resize (piorar a densidade da §2.8): o `max-height`
a resolve.

Os ~16% sem suporte caem no comportamento atual (altura fixa + `resize`), que
não é pior do que hoje — degradação limpa, sem JavaScript de reflow, que a fonte
desaconselha por forçar recálculo de layout a cada tecla.

**Consequência: D1 deixa de ser escolha.** A resposta é `field-sizing: content`
com `min-height` e `max-height` declarados, e o comportamento atual como
fallback.

### 6.2 Largura do campo → confirma §2.5

[Baymard, Form Field Usability](https://baymard.com/blog/form-field-usability-matching-user-expectations):
a largura do campo **é um sinal visual** do tamanho esperado da resposta; o
usuário sabe quanto se espera dele só de olhar. Campo com largura errada produz
hesitação medida — o usuário para, relê o rótulo, às vezes digita e apaga.

Números da fonte: para entrada de tamanho variável, a faixa típica é **18 a 33
caracteres**; campos de resposta curta (código de área, número) devem ser
visivelmente menores que os de resposta longa.

Confirma o achado: `Horário de início` (`19:00`, 5 caracteres) e `Frequência`
(`semanal`) com **844px** violam diretamente a diretriz.

### 6.3 Escala de espaçamento → resolve D3, e a resposta já está no repo

[Material 3](https://m3.material.io/styles/spacing) usa grade de **4dp**, com
`line-height` divisível por 4 para o texto assentar na grade.

**Medido no próprio repositório:** `packages/ui/src/styles.css:62-66` já declara
`--space-1: 0.25rem` … `--space-6: 1.5rem` — **exatamente a base 4px**. A escala
existe e é a do design system.

**Medido também:** o editor **não usa nenhum desses tokens** (`rtk rg
"var\(--space-" apps/mesas/frontend/src/features/table-editor/` → 0). Usa
classes utilitárias soltas, e a mais frequente é **`gap-3.5` = 14px, repetida 14
vezes** — a origem do `14px` de §2.6, e o único valor que não fecha na grade
de 4.

**Consequência: D3 deixa de ser escolha.** Não se declara escala nova; adota-se
a que o pacote já tem. Declarar outra seria a divergência por app que o
AGENTS.md trata como dívida.

### 6.4 Alvo de clique → CORRIGE o que eu havia escrito em §2.7

**Eu estava errado.** Escrevi que 16px "reprova nos três" padrões, tratando os
44/48px como se valessem aqui. Não valem: são diretrizes de **toque**
(Apple HIG 44pt, Material 48dp). Para web em desktop, o critério é
[WCAG 2.2 SC 2.5.8](https://wcag22aa.org/new-criteria/target-size/): **24×24 CSS
px**, nível AA.

Então o quadro real é:

| controle | tamanho | 24px (AA, obrigatório) | 44px (toque) |
|---|---|---|---|
| `Remover imagem`, `Limpar seleção`, `Remover` | **16px** | **reprova** | reprova |
| `×` da tag de estilo | **20px** | **reprova** | reprova |
| demais (32-42px) | 32-42px | passa | reprova |

As fontes são unânimes em que 24px é **piso, não meta** — e o editor tem uma
versão mobile (media query em 719px), onde o alvo vira toque de verdade. O alvo
prático: **24px como mínimo inegociável no desktop, 44px nos controles que
sobrevivem no mobile.**

### 6.5 Botões de papel → o componente está errado, não só o estilo

O bloco "Quem está publicando esta mesa?" (§2.3-bis) é **escolha exclusiva entre
duas opções, cada uma com explicação**. Isso não é botão: o
[GOV.UK Design System](https://design-system.service.gov.uk/components/radios/)
tem componente próprio — radio com *hint text*, `aria-describedby` ligando a
explicação à opção.

Diretriz da fonte que se aplica direto: *"mantenha cada hint em uma frase curta,
sem ponto final"*. As explicações atuais (`Sem selo de anunciante.`,
`A mesa exibirá o selo "Apenas anunciante".`) têm ponto final e são o que está
grudado no rótulo.

**Isso muda o recorte do conserto.** Consertar o `Button` de `packages/ui` para
aceitar dois filhos empilhados resolve o sintoma; adotar radio-com-hint resolve
a causa — e o `aria-pressed="false"` fixo já foi apontado como problema neste
mesmo arquivo (comentário em `IdentityPart.tsx:317-319`, sobre outro botão).
As duas opções entram em D4, medidas.

---

### 6.6 O erro de espaçamento não é o `14px` — é a proximidade invertida

[NN/g, Group Form Elements Effectively Using White Space](https://www.nngroup.com/articles/form-design-white-space/)
é explícito: a regra é **relativa, não absoluta**. Não existe número mágico. O
que existe é a Lei da Proximidade — *"o rótulo deve estar mais perto do próprio
campo do que dos outros campos"* — e o espaço entre grupos tem de ser **maior**
que o espaço dentro do grupo.

Isso reenquadra §2.6. Medi a proximidade campo a campo, e o defeito é mais grave
que a falta de escala:

| aba | campo | rótulo → seu campo | → grupo anterior | veredito |
|---|---|---|---|---|
| Quando joga | `Horário de início` | 6px | **0px** | invertido |
| Quando joga | `Frequência` | 6px | **0px** | invertido |
| Quando joga | `Horário de término` | 6px | **0px** | invertido |
| Identidade | `Sistema da mesa` | 31px | 31px | empatado |
| Identidade | `Estilos/Temáticas` | 72px | **−169px** | sobreposto |

**Em três campos o espaço entre grupos é ZERO enquanto o rótulo fica a 6px do
próprio campo** — a proximidade diz ao olho que o rótulo pertence ao campo *de
cima*. É exatamente o que a NN/g descreve como o erro que faz o usuário parar e
reler. Um caso pior: `−169px`, elementos sobrepostos.

Trocar `gap-3.5` por um token da escala **não conserta isso sozinho** — a fase D
precisa entregar dois valores distintos (dentro do grupo × entre grupos), não um
valor uniforme.

### 6.7 Densidade: o problema não é o tamanho, é a percepção — e há número

[Baymard](https://baymard.com/blog/avoid-multi-column-forms), via síntese de
pesquisa: **a contagem percebida de campos importa mais que a real**. Um
formulário de 15 campos dividido em 3 passos lógicos **supera** um de 10 campos
numa página só, em **11-14% de taxa de conclusão**. E **18% dos usuários
abandonam** por layout confuso.

Isso muda o enquadramento de D2. A aba Identidade com 2,7 telas não é problema
por ser *grande* — é problema porque a rolagem esconde a estrutura e faz o mestre
perder de vista onde está. A resposta da literatura não é "encolher", é
**agrupar visivelmente**.

Baymard também é categórico contra o layout multi-coluna extenso em formulário
(16% dos sites erram nisso, e produz erro de preenchimento) — então "resolver com
duas colunas" está descartado antes de ser proposto.

### 6.8 Largura da caixa de texto → medida, não estimada

[NN/g e a literatura de tipografia](https://www.uxpin.com/studio/blog/optimal-line-length-for-readability/)
convergem: **45-75 caracteres por linha, alvo 66**. Acima disso o olho perde a
linha ao voltar para a esquerda.

Medido no campo `Descrição da mesa`, com a fonte real (`ui-monospace`, 15px):

| | valor |
|---|---|
| largura do campo | 842px |
| largura útil | 799px |
| **caracteres por linha** | **97** |
| ideal (66 chars) | **544px** |

**97 é 30% acima do limite superior.** E os 544px que dariam a linha ideal são
praticamente os **560px** que o campo `Título da mesa` já usa — ou seja, a
largura certa já existe no editor, aplicada a outro campo.

Isso conecta §2.1 e §2.5: a caixa de descrição está **baixa e larga demais** ao
mesmo tempo. Estreitá-la para ~560px aumenta o número de linhas do mesmo texto,
o que combina com o `field-sizing: content` de §6.1 — o campo cresce, mas cresce
com linhas legíveis.

---

### 6.9-bis Os números prontos — não há o que inventar

O mantenedor não precisa arbitrar nada disto. Os valores existem publicados, e
os dois defeitos centrais desta spec têm resposta numérica direta.

**Espaçamento — a regra é 8px / 24px, proporção 3:1.**
[As cinco decisões de espaçamento](https://blakecrosley.com/blog/five-spacing-decisions)
dá o caso idêntico ao nosso: *"8px do rótulo ao campo, 24px entre campos cria
agrupamento claro sem bordas. Achatar para 16px uniforme elimina a hierarquia."*

Comparado ao medido em §6.6:

| | referência | editor hoje |
|---|---|---|
| rótulo → seu campo | 8px | 6px (perto o bastante) |
| **entre campos** | **24px** | **0px** ← o defeito |
| proporção | **3:1** | **0,75:1 (invertida)** |

O número que falta não é o de dentro do grupo — é o de fora. E é 24px.

**Escala: 4, 8, 16, 24, 32, 48, 64.** *"Todo valor de espaçamento vem da escala
ou carrega uma razão documentada"* — valores como 13px ou 7px são **deriva**, não
escolha. O nosso `14px` (`gap-3.5`) é exatamente isso. Carbon usa a mesma base
(`$spacing-05` = 16px, `-06` = 24px, `-07` = 32px), e `packages/ui` já declara
`--space-1..6` na mesma grade.

**Padding por papel do contêiner** (resolve §2.4, o "sem respiro"):

| contêiner | padding |
|---|---|
| componente (botão, campo) | 16px |
| cartão / conteúdo agrupado | 24px |
| **seção** | **32-48px** |
| página / região principal | 48-64px |

O documento do editor tem **0px** e a parte tem 24px. Pela tabela, uma seção de
formulário pede **32-48px** — é o número que faltava para "não fica colado".

**Altura de campo: 32 / 40 / 48px** ([Carbon](https://carbondesignsystem.com/components/text-input/usage/),
três tamanhos: small, medium, large). Isso resolve §2.7 sem discussão: 32px é o
**menor** tamanho de um design system maduro, e está acima dos 24px do piso
WCAG. Os cinco controles de 16-20px do editor não têm defesa.

**Linha de texto: ~65 caracteres, `line-height` 1.5-1.75.** Confirma §6.8 (medido
97 no campo de descrição) por outra fonte.

**Composição sobre configuração** — para o contrato do campo (§6.10): *"melhor
três componentes específicos que um com cinquenta props condicionais"*, e o
`size` deve ser **enum nomeado** (`small`/`medium`/`large`), não pixel solto.
É o padrão que a fase D adota para largura.

### 6.10 Onde cada correção PERTENCE — a regra que eu tinha ignorado

O AGENTS.md §Regras Gerais de Código → *Compartilhado por padrão; exceção por
app é o defeito (pétrea)* governa esta spec inteira, e eu havia escrito as fases
como conserto pontual no `mesas`. Os dois trechos que decidem:

> **"Solução dinâmica, não caso particular.** Corrigir com condicional por app,
> lista fixa ou exceção pontual é sinal de que a correção está no lugar errado:
> ela pertence ao contrato compartilhado, onde vale para todos, inclusive para o
> próximo app que ainda não existe."

> **"Ao corrigir defeito num app, cruzar com os outros que fazem a mesma coisa.**
> A pergunta não é 'por que este quebrou', é 'por que os outros não quebraram' —
> e a resposta frequentemente é *porque aquele caminho nunca foi exercitado*."

Cruzei. O resultado muda o destino de quase toda correção:

**Caixa de texto (§2.1) — o defeito é do pacote, e o `mesas` o mascara.**
Medido: `ContentEditor` tem `minHeight = 192` como default
(`packages/content-editor/src/ContentEditor.tsx:132`), e o `mesas` **chuta seis
valores por cima**, campo a campo: `180`, `120`, `112`, `100`, `96`, `120`
(`IdentityPart` ×2, `MasterPart`, `WhenPart` ×2, `ValuesPart`).

O `downloads` **não passa `minHeight` nenhum** — usa o default e aceita
`maxLength={50000}` numa caixa fixa de 192px
(`EditarMaterialPage.tsx:331-336`). É o "por que os outros não quebraram": ele
quebra igual, ninguém reclamou ainda.

**Consequência:** ajustar os seis números do `mesas` é o caso particular que a
regra proíbe. `field-sizing: content` pertence ao **`ContentEditor`**, uma vez,
com `min-height`/`max-height` por prop — e resolve `mesas` e `downloads` juntos,
mais o próximo app.

**Espaçamento (§2.6, §6.6) — o `gap-3.5` está em 8 arquivos.**
Medido: `TableEditor.tsx`, `WherePart`, `WhenPart`, `ValuesPart`, `MasterPart`,
`AudiencePart`, `IdentityPart`, `ExtrasPart`. Trocar oito ocorrências por um
token é substituição, não solução: o próximo campo escrito volta a chutar valor.

O que escala: o espaçamento sair do **componente de campo**
(`.artificio-field`, que já existe no pacote), com dois valores — dentro do
grupo e entre grupos (§6.6). Aí nenhuma parte precisa declarar espaçamento.

**Largura (§2.5, §6.8) — mesma coisa.** Hoje cada parte declara a sua
(`!w-[206px]`, `!max-w-[560px]`, ou nada). Escala é o campo declarar o
**tamanho esperado da resposta** (curto / médio / longo), e o pacote traduzir
para largura — não cada consumidor escolher pixel.

**Alvo de clique (§2.7) — os 5 controles abaixo de 24px são de onde?**
A fase C precisa medir se saem de `packages/ui` (aí conserta lá, uma vez) ou são
markup local do editor. Corrigir cinco alturas à mão não impede a sexta.

**Botões de papel (§2.3-bis) — já identificado como do pacote.**
`primitives.tsx:57` embrulha os children num `<span>`. Corrigir só no `mesas`
seria a "exceção por app" nomeada na regra.

**O critério que passa a valer em toda fase:** antes de corrigir, responder
*"onde este defeito pertence?"* — e a resposta só é "no app" quando o defeito de
fato não existe fora dele. Cada fase entrega essa resposta **medida**, não
suposta.

### 6.9 Custo medido de cada decisão (para o mantenedor escolher com número)

**D2 — corte não resolve.** Blocos da aba Identidade hoje (2419px em 905px):

| bloco | altura |
|---|---|
| Cenário | 604px |
| Banner | 581px |
| Sistema | 376px |
| Descrição | 355px |
| Regras e observações | 271px |
| Título | 92px |
| Colar anúncio | 32px |

Simulação: **cortando 30% dos três maiores**, a aba vai a **1951px — ainda 2,2
telas**. Para caber em uma tela (905px) seria preciso remover ~1500px, ou seja,
tirar campo. Isso confirma §6.7: o caminho não é encolher.

**D4 — o `mesas` é o único caso.** Medido: **16 arquivos** usam `<Button>` em
todo o repositório; só **3** passam elemento aninhado, e destes apenas o
`MasterPart.tsx` empilha **dois textos**. Os outros dois (`links/ReportButton`,
`links/AdminPanel`) passam texto simples e não são afetados.

Consequência: o conserto no pacote tem alcance de **1 consumidor real hoje** —
menor do que eu havia sugerido. O argumento a favor dele deixa de ser "conserta
todos" e passa a ser "impede o próximo".

**D5 — cinco reprovam, quarenta e sete estão na faixa cinza.** Medido nas 7 abas:

| faixa | quantos | exemplos |
|---|---|---|
| **abaixo de 24px** (reprova WCAG AA) | **5** | `Remover imagem` (16px), `Limpar seleção` (16px), `Remover` (16px), caixa de seleção (16×16), `×` da tag (20px) |
| entre 24 e 44px (passa AA, abaixo do de toque) | **47** | `Colar anúncio` (32px), `PT`/`EN` (36px), `+ Adicionar Sistema` (32px), opções de faixa etária (41px) |

Os 5 são conserto obrigatório e barato. Os 47 são a decisão real: subir todos a
44px muda a densidade de todas as abas — e a aba Identidade já é o problema de
D2.

---

## 7. Decisões que precisam do mantenedor

A pesquisa de §6 **resolveu duas** das quatro que eu havia listado. Restam duas,
e uma nova.

**~~D1 — altura do campo de texto.~~ RESOLVIDA (§6.1):** `field-sizing: content`
com `min-height`/`max-height`, fallback no comportamento atual. Padrão
estabelecido, 84% de suporte, sem JavaScript. Não é escolha de gosto.

**~~D3 — escala de espaçamento.~~ RESOLVIDA (§6.3):** usa-se `--space-1..6` de
`packages/ui`, que já é base 4px como Material pede. Declarar outra seria
divergência por app.

**~~D2 — reorganizar a aba Identidade.~~ FORA DE ESCOPO por decisão do
mantenedor (2026-08-27):** *"sobre quantos campos ou passos, não precisa (…)
pode manter do jeito que está."* Nenhuma task divide a Identidade nem move campo
para fora dela.

Medido para registro: cortando 30% dos três maiores blocos (Cenário 604px,
Banner 581px, Sistema 376px), a aba iria de 2419px para 1951px — ainda 2,2
telas. A rolagem longa **permanece, e está aceita**.

**D2b — juntar "Quando joga" e "Onde joga" numa aba só (decisão do mantenedor,
2026-08-27: _"quando e onde jogam podem ficar na mesma"_).**

Medido, conteúdo real (sem o `min-height` que estica a caixa até a tela):

| aba | conteúdo real | campos |
|---|---|---|
| Quando joga | 796px | 7 (`Horário das sessões`, `início`, `Frequência`, `término`, `Observações` 271px, `Vagas totais`, `Vagas abertas`) |
| Onde joga | 420px | 3 (`Modalidade`, `Plataforma de jogo`, `Plataforma de comunicação`) |
| **juntas** | **1216px** | **10** |

Contra 905px de área visível: **não cabe em uma tela — fica em 1,3 rolagem.**
Bem melhor que a Identidade (2,7), e as duas abas hoje já ocupam a tela inteira
sozinhas com conteúdo de 796px e 420px, ou seja, há espaço ocioso nas duas.

*A favor:* `Onde joga` tem só 3 campos e é a aba mais vazia do editor; "quando e
onde" é agrupamento natural (as duas respondem *onde/quando a mesa acontece*), o
que atende a Lei da Proximidade de §6.6 no nível da navegação. Sobra uma aba a
menos na lateral.

*Contra, e é o que a fase precisa medir:* a aba resultante passa a ter **10
campos**, e §6.6 mostra que os campos de horário são justamente os que hoje têm
proximidade invertida (0px entre grupos). Juntar sem antes corrigir o
espaçamento agrava — dez campos indistintos num bloco só.

**Dependência dura: D2b entra DEPOIS da fase D (espaçamento).** Fazer antes é
empilhar dez campos sem separação visível.

**~~D4 — consertar o `Button` ou trocar por radio?~~ REENQUADRADA.** Eu havia
apresentado as duas metades como uma bifurcação só. Pelo critério do AGENTS.md
(§Bug achado — *"a correção é a mesma sob qualquer resposta do mantenedor?"*),
elas caem em lados diferentes:

- **Consertar o `Button` de `packages/ui` é CONSERTO, não pergunta.** O
  componente embrulha os children num `<span>` com `nowrap`, então
  `flex-col` do consumidor não separa nada. É defeito do pacote sob qualquer
  resposta. Cai na **exceção 1** (§Autorização): pacote compartilhado exige
  aprovação da **ação**, e o agente chega com o conserto medido e pronto — não
  apresenta o achado como bifurcação.
- **Trocar os botões por radio com hint é DECISÃO** (exceção 2): muda
  comportamento observável — deixa de ser dois botões lado a lado e vira duas
  opções com marcador. É a única metade que precisa de você.

**~~D4' — o bloco de papel vira radio com hint?~~ DECIDIDO pelo mantenedor
(2026-08-27): CONTINUA BOTÃO.** *"pode ser botão? igual. está?"* — sim. O bloco
mantém os dois botões lado a lado, com a mesma aparência de hoje.

O que muda é só o texto parar de sair grudado: título em cima, explicação
embaixo, dentro do mesmo botão. Isso é o conserto do `Button` em `packages/ui`
(§2.3-bis), que já era conserto e não decisão.

**Fica registrado, sem virar trabalho:** o padrão de referência para escolha
exclusiva com explicação é radio com `hint`
([GOV.UK](https://design-system.service.gov.uk/components/radios/)), e ele
também resolveria o `aria-pressed` fixo. O mantenedor viu as duas versões lado a
lado na tela (demonstração injetada no beta em 2026-08-27, removida em seguida,
nada salvo) e escolheu manter botão. **Nenhuma task desta spec troca o
componente.**

O `aria-pressed` continua como está — não entra nesta spec, e não vira débito
sem o mantenedor mandar registrar.

**~~D5 — alvo de clique: 24px ou 44px?~~ NÃO É DECISÃO. Retirada.**
É norma, não política, e a correção é a mesma sob qualquer resposta:
**24px no desktop** (WCAG 2.2 SC 2.5.8, nível AA — obrigatório) e **44px onde o
controle vira alvo de toque**, na versão mobile do editor (media query em 719px).

Eu havia oferecido três caminhos como se fosse escolha de gosto. Não era: os 5
controles abaixo de 24px reprovam critério obrigatório, e os 47 entre 24 e 44px
têm resposta definida pelo contexto em que aparecem — desktop ou toque. A fase C
implementa; não pergunta.
