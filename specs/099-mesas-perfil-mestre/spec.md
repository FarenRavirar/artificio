# Spec 099 — Perfil do mestre: o que o mestre insere e o que o sistema expõe

**App:** `mesas` · **Criada:** 2026-08-27 · **Status:** grill concluído (2026-08-27), **não implementada**
**Origem:** pedido do mantenedor (2026-08-27): *"voce vai ver como é hoje o perfil dos
mestres, como https://mesas.artificiorpg.com/mestre/mestre-hermes. e tudo que dá para
melhorar."*

**Recorte, dito por ele, na segunda mensagem:** *"foco em pegar as melhores práticas do
mercado: design, heuristicas, modelos, elementos, design, vendas. as mais modernas, não
as classicas, padrões e exageradas landingpages. foco em funcionalidade e clarificação
da informação de forma que dá para o mestre inserir e, depois, nosso sistema expor."*

**Esta spec não implementa nada.** É material para o *grill* que o mantenedor fará com
outro agente. Nenhuma task foi executada; nenhum arquivo de `apps/` ou `packages/` foi
alterado.

---

## 0. A frase que resume o achado

**O perfil do mestre não tem onde inserir aquilo que ele expõe.**

Vinte perfis de mestre em produção, medidos na API em 2026-08-27:

| campo | mestres que preencheram | tem campo no editor? |
|---|---|---|
| `tagline` | **0 / 20** | **não** |
| `specialties` | **0 / 20** | **não** |
| `languages` | **0 / 20** | **não** |
| `selling_points` | **0 / 20** | **não** |
| `badges` | **0 / 20** | **não** |
| `bio_long` | 10 / 20 | sim (texto livre) |
| `experience_years` | 11 / 20 | sim |
| `contact_methods` | 10 / 20 | sim (no editor de mesa) |
| `avatar_url` | 10 / 20 | sim |
| `banner_url` | 3 / 20 | sim |
| `links` | **1 / 20** | sim |
| `reviews_count > 0` | **0 / 20** | — (depende de terceiros) |

Os cinco campos com **0 de 20** são exatamente os cinco que **não têm nenhum campo de
formulário em lugar nenhum do frontend**. Não é desinteresse do mestre: é ausência de
porta de entrada. Medição da ausência em §2.3.

Isto não é um problema de layout. A 098 tratava de forma (caixa baixa, espaçamento,
alvo de clique). Aqui o defeito é de **modelo de informação**: o sistema define,
armazena, serve e renderiza campos que ninguém consegue preencher.

---

## 1. O que foi medido, e com quê

Tudo em **produção** (`mesas.artificiorpg.com`), 2026-08-27, Chrome com sessão real do
mantenedor (autorizado nominalmente nesta sessão), viewport 1815×962, tema escuro.
Medições de tela por `getBoundingClientRect`/`getComputedStyle`; medições de dado por
`fetch` autenticado contra a API pública.

Perfil de referência: `mestre-hermes` (4 mesas ativas). Agregados: os 20 mestres com
mesa ativa, obtidos de `/api/v1/tables?limit=100` → `gm_slug` distintos →
`/api/v1/gm/perfis/{slug}`.

**O que não foi medido, e fica dito:** mobile (o editor tem media query em 719px, não
abri nessa largura); tema claro; o fluxo de quem chega pelo catálogo em vez de link
direto; e o comportamento com um perfil realmente preenchido — **não existe nenhum**
entre os 20 para servir de controle.

---

## 2. Diagnóstico

### 2.1 A página pública gasta a dobra sem informar nada

`main.mestre-page` tem **5341px — 5,55 telas**. Composição medida:

| # | seção | altura | telas | conteúdo real |
|---|---|---|---|---|
| 0 | `hero-section` | 693px | 0,72 | nome, 2 botões, 3 números |
| 1 | Entre em Contato | 242px | 0,25 | WhatsApp + Discord |
| 2 | Plataformas que uso | 238px | 0,25 | **1 ícone** |
| 3 | Mesas Disponíveis | 1530px | 1,59 | 4 cartões |
| 4 | Avaliações | 634px | 0,66 | **formulário vazio**, 0 avaliações |
| 5 | Insights (privado) | 794px | 0,83 | só o dono/admin vê |
| 6 | CTA final | 581px | 0,60 | repete "explorar mesas" |

**A dobra (primeira tela) contém:** o nome, dois botões, e três números
(`4 mesas ativas`, `10+ anos de experiência`, `4 mesas hospedadas`). A headline é
`"Viva aventuras com Mestre Hermes"` — texto gerado pelo sistema, igual para todos.

Não há **uma frase escrita pelo mestre** acima da dobra. Não há especialidade, não há
sistema que ele domina, não há como ele conduz. NN/g mede que o conteúdo acima da dobra
recebe **57% do tempo de visualização** e que a diferença de tratamento entre acima e
abaixo é de **84%** ([Scrolling and Attention](https://www.nngroup.com/articles/scrolling-and-attention/)).
A parte mais cara da página está ocupada por texto que o sistema escreveu sozinho.

**"Plataformas que uso" (238px) para exibir um ícone** é o caso extremo da mesma
doença: contêiner de seção inteiro para um dado de uma palavra.

### 2.2 A seção de prova social pede trabalho em vez de dar prova

`Avaliações` com **0 avaliações** renderiza 634px de **formulário para escrever uma**:
5 estrelas, 8 etiquetas (`Pontual`, `Bom narrador`, `Justo com as regras`…), editor
Markdown com barra de ferramentas, e botão `Enviar avaliação`.

O visitante que chegou para decidir se joga com este mestre recebe uma tarefa. E
**0 de 20** mestres têm qualquer avaliação — então esta é a aparência da seção em
**100% dos perfis de produção hoje**.

O mesmo padrão aparece no `hero`: `4 mesas hospedadas` é o total histórico
(`tables_hosted_count`), que hoje é igual às 4 ativas — o número não distingue um mestre
novo de um veterano, mas é apresentado como se distinguisse.

### 2.3 Os campos de venda existem no sistema inteiro, menos onde se preenche

Rastreado com `rtk rg`, camada por camada:

| camada | `selling_points` | `tagline` | `specialties` | `languages` | `badges` |
|---|---|---|---|---|---|
| migration (`migration_107`) | ✔ | ✔ | ✔ | ✔ | ✔ |
| `db/types.ts` | ✔ | ✔ | ✔ | ✔ | ✔ |
| hidratação (`hydration/config.ts`) | ✔ | ✔ | ✔ | ✔ | ✔ |
| API serve (`gm.ts:146-154`) | ✔ | ✔ | ✔ | ✔ | ✔ |
| API aceita escrita (`gmPanel.ts:211,377`) | ✔ | ✔ | — | — | — |
| tipo do front (`useMestre.ts`) | ✔ | ✔ | ✔ | ✔ | ✔ |
| componente que renderiza | ✔ | ✔ | ✔ | ✔ | ✔ |
| **campo de formulário** | **✘** | **✘** | **✘** | **✘** | **✘** |

Busca que sustenta a última linha:
`rtk rg "selling_point|tagline|specialt|languages|promo_badge" apps/mesas/frontend/src/pages/ProfileEditPage.tsx`
→ **0 ocorrências** (exceto 1 menção a `badges` fora de contexto de campo).
Nenhuma chamada do frontend envia esses campos: as quatro escritas para
`/api/v1/gm/profile` (`PainelMestrePage.tsx:642,665`, `useTableEditor.ts:934,1095`)
mandam outros campos.

O backend tem `PUT /api/v1/gm/profile` aceitando `selling_points` com validação
(`isSellingPoint`) — **código de escrita que nenhum cliente exercita**. É o padrão que o
AGENTS.md nomeia: *"por que os outros não quebraram — porque aquele caminho nunca foi
exercitado"*.

### 2.4 O mestre inventa estrutura dentro da caixa de texto

Bio de `Faren Ravirar`, transcrita da tela do editor:

```
Mestre há 11 anos
Editor do site Toca do Coruja RPG
Fanático por The Witcher
Mais de 30 feedbacks positivos sobre a forma de narrar.
```

Quatro linhas, quatro **fatos estruturados diferentes**, digitados em Markdown numa
caixa de fonte monoespaçada porque não há campo para nenhum deles:

| o que ele escreveu | que campo seria | existe? |
|---|---|---|
| `Mestre há 11 anos` | `experience_years` | **existe e está preenchido com 14** |
| `Editor do site Toca do Coruja RPG` | credencial / link | não |
| `Fanático por The Witcher` | especialidade / cenário | coluna existe, campo não |
| `Mais de 30 feedbacks positivos` | prova social | não |

**A primeira linha contradiz o campo ao lado dela.** `Anos de Experiência` = `14` no
formulário, `11` na bio, e a página pública exibe `10+`. Três números para o mesmo fato,
na mesma tela, porque o dado tem duas moradas e nenhuma manda na outra.

Isto é o comportamento que a spec precisa levar a sério: **o mestre já quer dar a
informação estruturada.** Ele a estrutura à mão, em texto, no único lugar onde cabe.

### 2.5 O que o mestre insere e o sistema não expõe (e vice-versa)

Cruzamento entre a aba `Mestre` do editor e as 7 seções da página pública:

| no editor | na página pública |
|---|---|
| Anos de Experiência | sim (como `10+`, arredondado) |
| Preço Médio | **não aparece** em nenhuma seção |
| Bio Detalhada | sim (`MestreBio`) |
| Foto de Mestre | sim (avatar) |
| Banner do Perfil | sim (fundo do hero) |
| **Sistemas que Mestra** | **não aparece** — nenhuma seção lista sistemas |
| Links e Conteúdo | sim (`LinksDisplay`, no fim) |
| Conexão Discord | vira badge |
| — | Plataformas VTT (editado no **painel**, não aqui) |
| — | Contatos (editados no **editor de mesa**, não aqui) |
| — | Grupo fechado (sem editor encontrado) |

**Dois campos que o mestre preenche não são exibidos** (`Preço Médio`, `Sistemas que
Mestra`), e **três coisas exibidas se editam em outras telas**. O mestre não tem um
lugar onde veja o que o seu perfil é.

`Sistemas que Mestra` é o caso mais claro: o editor diz `2 sistema(s) que você mestra` —
**um contador, sem listar quais**. O mestre não vê o que escolheu, e o visitante nunca vê.

### 2.6 O editor repete os defeitos de forma da 098

Aba `Mestre`: **3607px, 3,75 telas**, 4 seções.

**Sem botão salvar** — `rtk rg "Salvar" ProfileEditPage.tsx` → 0. Há autosave com
debounce de 500ms (`ProfileEditPage.tsx:20`) e indicador (`.autosave-indicator`), mas o
CSS **não tem `position: fixed` nem `sticky`** (`ProfileEditPage.css:204-212`): o
indicador fica no topo e rola para fora. Quem edita a bio — que começa em 597px e tem
300px de altura — não vê nenhuma confirmação de que o trabalho foi salvo. Nielsen #1.

Largura e altura dos controles, medidas:

| campo | largura | altura | resposta esperada |
|---|---|---|---|
| `Anos de Experiência` | **802px** | 50px | 2 dígitos |
| `Preço Médio` | **802px** | 50px | 2-3 dígitos |
| `Bio Detalhada` | 800px | 300px | parágrafos |
| `URL manual` (avatar) | 148px | 50px | uma URL longa |
| `URL manual` (banner) | 768px | 38px | uma URL longa |
| `Buscar sistema` | 802px | 42px | uma palavra |
| `Cole o link` | 649px | 48px | uma URL |
| `Manter link direto` | 16px | **16px** | caixa de seleção |

Alturas distintas: **16, 38, 42, 48, 50, 300** — sem escala, exatamente como a 098 mediu
no editor de anúncio (§2.6 de lá). Duas URLs longas recebem **148px e 768px**; um número
de dois dígitos recebe **802px**. É a violação de Baymard de §6.2 da 098, repetida.

A caixa de seleção de **16px** reprova WCAG 2.2 SC 2.5.8 (24×24, nível AA) — e é o mesmo
controle `Manter link direto` que a 098 já havia listado no editor de anúncio. **O
mesmo defeito, no mesmo componente, em duas telas.**

### 2.7 Espaçamento entre seções da página pública, sem regra

Vãos medidos entre as 7 seções: **48, 48, 0, 48, 0, 0**.

Três junções com `0px`. É a proximidade invertida que a 098 §6.6 identificou como o
defeito real (não a falta de escala): sem espaço entre grupos, o olho não sabe onde uma
seção termina.

### 2.8 Alvos de clique abaixo do piso, e um deles é do pacote

Controles com altura < 24px na página pública:

| controle | altura | onde mora |
|---|---|---|
| `Mestre Hermes` (nome nos 4 cartões) | 20px | `apps/mesas` (`TableCard`) |
| navegação global (`Portal`, `Glossário`, `Mesas`…) | 22px | **`packages/ui`** |
| `Ver termos de uso` (rodapé) | 18px | **`packages/ui`** |

Os dois últimos **atingem todos os apps do monorepo**, não só o `mesas`. Pela regra
pétrea (§Compartilhado por padrão), a correção pertence ao pacote — e a verificação
precisa cruzar os outros apps antes.

### 2.9 Achado de contrato: `selling_points` volta como objeto

A migration declara `JSONB NOT NULL DEFAULT '[]'::jsonb`
(`migration_107_gm_public_profile_v2.sql:14`), o tipo do frontend declara
`SellingPoint[]`, e a API devolveu **`{}`** para o `mestre-hermes` — e para **7 dos 20**
perfis medidos.

`MestrePage.tsx:99` passa `profile.selling_points ?? []` ao componente. `{}` não é
`null`, então o `??` não dispara: o componente recebe um objeto onde espera array. Não
quebrou porque `MestreSellingPoints` sai cedo quando não há itens — mas é exatamente a
classe de defeito que o AGENTS.md cobre em *"Normalização obrigatória"*: dado de JSONB
entrando em props sem normalizador tipado.

**Não medi a causa** (se é escrita antiga, migração de dado, ou serialização). Fica como
achado a investigar, não como diagnóstico.

### 2.10 O contraste que enquadra a spec inteira

A tabela `tables` tem **~40 colunas de conteúdo estruturado** para descrever *uma mesa*:
`synopsis`, `synopsis_narrative`, `style_tags`, `setting_styles`, `benefits_text`,
`features`, `technical_requirements`, `content_warnings`, `safety_tools`,
`campaign_length`, `level_range`, `table_gm_bio`…

O perfil do mestre tem **um** campo de texto livre.

O anúncio da mesa é um modelo de informação rico. Quem mestra a mesa é um parágrafo.

---

## 3. Pesquisa: o que as fontes modernas dizem (2026-08-27)

Pesquisada depois das medições. O recorte pedido — *práticas modernas, funcionalidade e
clareza da informação, não landing page persuasiva* — orientou a escolha das fontes.

### 3.1 Texto livre não é filtrável, comparável nem governável

O argumento decisivo do recorte não é estético, é funcional. Campo de texto livre
produz classificação inconsistente: *"AI", "A.I.", "ai" e "artificial-intelligence"*
convivem como quatro coisas para o sistema e uma para o leitor, e a consulta perde o
conteúdo ([Contentstack, Content Modeling — taxonomia e
classificação](https://www.contentstack.com/academy/courses/content-modeling-with-contentstack/taxonomy-tags-and-classification-systems)).

Consequência direta para o `mesas`: enquanto `Fanático por The Witcher` viver dentro da
bio, **nenhuma busca por cenário encontra este mestre**, nenhum filtro o agrupa, nenhum
crosslink o conecta à mesa de Witcher, e nenhum sistema pode exibir isso como atributo.
O dado existe e é inalcançável.

Isto redefine o objetivo: não é "deixar o perfil bonito", é **transformar em atributo
consultável aquilo que hoje é prosa**.

### 3.2 A dobra é cara e está sendo gasta com texto do sistema

[NN/g, Scrolling and Attention](https://www.nngroup.com/articles/scrolling-and-attention/):
**57%** do tempo de visualização fica acima da dobra, **17%** na segunda tela, e a regra
do estudo é *"reserve o topo da página para conteúdo de alta prioridade: metas-chave do
negócio e do usuário"*.

[NN/g, The Fold Manifesto](https://www.nngroup.com/articles/page-fold-manifesto/): a
diferença média de tratamento acima/abaixo da dobra é de **84%**, e os 100px logo acima
dela são vistos **102% mais** que os 100px logo abaixo. Usuários rolam — *"mas só se o
que está acima da dobra for promissor o bastante"*.

Hoje o que está acima da dobra é uma headline gerada (`Viva aventuras com…`), dois
botões e três números. **Zero informação específica deste mestre.** Pela fonte, é o
espaço mais caro da página aplicado ao conteúdo menos diferenciador.

### 3.3 Credibilidade vem de especificidade, não de adjetivo

[NN/g, Trustworthy Design — 4 fatores](https://www.nngroup.com/articles/trustworthy-design/)
e [Trust or Bust](https://www.nngroup.com/articles/communicating-trustworthiness/):
os quatro fatores são qualidade de design, **divulgação antecipada**, conteúdo
**abrangente e atual**, e conexão com o resto da web.

O achado mais aplicável: ao avaliar um serviço, as pessoas queriam ver **o processo e
quem executa**, não só o resultado — *"users want to get a better understanding of whom
they will do business with"* — e buscavam evidência específica (casos, fotos,
depoimentos), não afirmação genérica. O estudo registra uma usuária que descartou um
serviço de limpeza em **35 segundos** por não ver a tarifa exposta: *"I feel they are
not open enough"*.

Traduzido para o perfil de mestre: *"Viva aventuras"* é adjetivo. *"D&D 5e, 14 anos,
mesa quinzenal, foco em investigação, R$25/sessão"* é evidência. A segunda forma exige
campo estruturado; a primeira sai de graça do sistema.

A fonte também diz que **pedir antes de dar valor quebra a confiança** — o que descreve
a seção de Avaliações de §2.2, que abre com um formulário.

### 3.4 Coleta progressiva, não formulário de 3,75 telas

[Progressive profiling](https://userguiding.com/blog/progressive-profiling) —
coletar aos poucos, no contexto, em vez de tudo de uma vez. Fontes de 2026 relatam
conclusão subindo para **75%** com divulgação contextual disparada por comportamento,
contra formulário monolítico
([Poptin, playbook 2026](https://www.poptin.com/blog/progressive-profiling-popups/)).

**Ressalva honesta:** este número vem de material de fornecedor, não de estudo
controlado. Trago como sinal de direção, não como medida confiável — e o registro é
proposital: o handoff da 099 cobra registrar o que se descarta e o que não se sustenta.

O que se sustenta com mais firmeza é a estrutura do argumento, que a própria 098 já
mediu por Baymard: **a contagem percebida de campos importa mais que a real** —
15 campos em 3 passos superam 10 campos numa página só em **11-14%** de conclusão
(098 §6.7). O editor de perfil hoje é o caso ruim: uma coluna de 3,75 telas.

### 3.5 Cartão: a unidade que serve para comparar

[UI Card Design, 2026](https://www.alfdesigngroup.com/post/best-practices-to-design-ui-cards-for-your-website):
cartão é *bloco autocontido que agrupa conteúdo relacionado numa unidade escaneável*, e
funciona porque **as pessoas comparam em vez de ler**, o que reduz o esforço de escolher.
Regra da fonte: **um cartão, um propósito** — cartão que tenta fazer tudo não faz nada.

Aplicável direto: os cartões de mesa (§2.1, seção 3) são hoje a única parte densa e
comparável da página. O perfil do mestre em si não tem unidade comparável nenhuma.

### 3.6 O que foi descartado, e por quê

- **Landing page persuasiva com prova social empilhada** — descartada pelo recorte
  explícito do mantenedor. É também o que a página já tenta ser (hero + CTA duplicado +
  CTA final) e o que produziu 5,55 telas com pouca informação.
- **Baymard sobre "campos estruturados vs. texto livre em perfil"** — busquei, **não
  existe** estudo com esse recorte no material público. Não vou citar Baymard para
  sustentar o que Baymard não mediu. O que dele se aplica (largura de campo, contagem
  percebida) já está na 098 e é reusado aqui.
- **Comparação com Airbnb/Upwork como fonte** — a busca devolveu material de marketing
  de terceiros, não pesquisa. Descartado por não sustentar afirmação.
- **Acessibilidade por teclado** — fora de escopo na 098 por decisão do mantenedor;
  mantenho fora aqui por coerência, até ele dizer o contrário.

---

## 4. As decisões que o grill precisa resolver

Estas são de fato do mantenedor: mudam regra de produto, comportamento observável ou
custo. Cada uma vem com o que **já foi medido**, para o grill não gastar volta com o que
já tem resposta.

**Protocolo do grill (definido pelo mantenedor, 2026-08-27):** as perguntas seguem as
melhores práticas modernas de mercado — estudos publicados, exemplos, conteúdo de design,
heurísticas e padrões. O mantenedor só responde o que essas fontes **não** respondem:
decisão de produto, risco ou custo. O que a pesquisa já decide vira recomendação, nunca
pergunta; pergunta "para cumprir tabela" é proibida. Cada decisão abaixo separa o que já
está medido/pesquisado (fundo) do resíduo que só ele responde (pergunta).

**Grill concluído (2026-08-27).** As decisões D1-D5 abaixo estão resolvidas; o fundo
medido de cada uma permanece registrado junto com a decisão.

### D1 — Modelo de informação: não mexe (decidido, 2026-08-27)

**Decisão do mantenedor:** o modelo de informação não muda. Sem migration nova, sem
campo novo — usa-se o que já existe no banco desde a `migration_107` (`tagline`,
`specialties`, `languages`, `selling_points`, `badges`, `links`, `experience_years`).

O fundo medido que motivava a pergunta fica registrado: `selling_points` (livre) e
`specialties` (estruturado) existem ambos desde a `migration_107`, **nenhum dos dois**
tem editor e ambos estão em 0/20 (§2.3); o mestre já estrutura à mão dentro da bio, e a
estrutura dele contradiz o campo que existe (§2.4). Com o modelo intacto, a fase A se
reduz a: inventário dos campos existentes, resolução de C1 (fonte única para
experiência) e normalização na fronteira (C2).

### D2 — O que ocupa a dobra: respondida por pesquisa (delegado pelo mantenedor, 2026-08-27)

**O mantenedor delegou a decisão aos estudos.** O que a pesquisa prescreve (§3.2, §3.3):
a dobra — 57% da atenção, 84% de diferença de tratamento, 102% mais olhadas nos 100px
acima dela — carrega **quem é o mestre na voz dele**: `tagline` + etiquetas dos
atributos-chave (`specialties`/`selling_points`/`languages`). A headline gerada sai do
topo; enquanto `tagline` está vazia (0/20 hoje), fallback para a headline atual. A fase
B cria a porta de entrada **antes** de a fase C mudar a dobra.

`featured` permanece **do admin** (`adminTables.ts`; o editor de mesa fixa
`featured: false` em `cardPreviewMapping.ts:107`): mesa em destaque não entra na dobra,
e o mestre não ganha controle da vitrine nesta spec.

### D3 — Avaliações sem avaliações: manter a seção como está (decidido, 2026-08-27)

**Decisão do mantenedor:** a seção de avaliações é feature recente — fica como está.
Nada a esconder nem inverter.

**Trade-off registrado:** a pesquisa aponta o padrão atual (634px de formulário, 0
avaliações, em 100% dos perfis) como quebra de confiança — NN/g: *"asking for
information before providing any value is a breach of trust"* (§3.3). A decisão é de
produto (cold start de marketplace recente) e fica documentada com este lastro
contrário.

### D4 — Preço: `Preço Médio` sai do front (decidido, 2026-08-27)

**Decisão do mantenedor:** o campo `Preço Médio` é removido do front (editor de perfil).
Migration e dado no banco permanecem intactos.

**Trade-off registrado:** NN/g (Trustworthy Design) traz usuária que descartou um
serviço em 35 segundos por não ver a tarifa — divulgação antecipada de preço é um dos 4
fatores de confiança (§3.3). Mitigação: o preço por mesa continua aparecendo nos
cartões de mesa.

### D5 — Onde o mestre edita: manter as 3 telas, funcionando (decidido, 2026-08-27)

**Decisão do mantenedor:** as 3 telas permanecem (`/perfil?tab=mestre`, `PainelMestrePage`,
editor de mesa) — elas já consomem e comunicam no mesmo dado. O que precisa existir é
que **funcionem**: C3 (autosave visível), C9 (sistemas listados, não só contados),
prévia do perfil público. Coleta progressiva (§3.4) **não entra** nesta passada.

---

## 5. O que é conserto, não pergunta

Pelo critério do AGENTS.md (*"a correção é a mesma sob qualquer resposta do
mantenedor?"*), estes **não** vão ao grill como opção — entram como trabalho, seja qual
for a decisão de D1-D5. Alguns exigem aprovação da **ação** (§Autorização), não do
achado.

| # | o quê | onde pertence | por que é conserto |
|---|---|---|---|
| C1 | contradição `experience_years` 14 × bio "11 anos" × exibido "10+" | `mesas` | dado com duas moradas; uma tem de mandar |
| C2 | `selling_points` chegando como `{}` onde o tipo diz array | investigar antes | contrato violado; normalizar na fronteira é regra pétrea |
| C3 | indicador de autosave que rola para fora em página de 3,75 telas | `mesas` (CSS local) | Nielsen #1; sem alternativa defensável |
| C4 | `Manter link direto` com 16px | **`packages/ui`** (verificar) | reprova WCAG 2.2 SC 2.5.8, nível AA |
| C5 | nav global (22px) e rodapé (18px) abaixo de 24px | **`packages/ui`** | idem — e atinge todos os apps |
| C6 | `Anos de Experiência` (2 dígitos) com 802px de largura | componente de campo | Baymard; mesmo defeito da 098 |
| C7 | alturas de campo `38/42/48/50` sem escala | componente de campo | escala já existe em `--space-1..6` |
| C8 | vãos de seção `48/48/0/48/0/0` | `mesas` | proximidade invertida (098 §6.6) |
| C9 | `2 sistema(s) que você mestra` sem listar quais | `mesas` | Nielsen #6: reconhecer, não lembrar |
*(Não há C10. Ver §8 — a hipótese de código morto no `MestreFeaturedTable` foi medida e
é falsa.)*

**C4, C5, C6 e C7 são os mesmos defeitos que a 098 mediu no editor de anúncio.** Isso é
a evidência prática da regra pétrea: corrigidos lá "no `mesas`", reapareceriam aqui. A
correção pertence ao pacote. **Decisão de escopo (2026-08-27):** a 099 leva estes
consertos (T11-T13), **independente da 098** — sem coordenação nem dependência entre as
duas specs.

---

## 6. Critérios de aceite (para quando houver implementação)

- **A1.** Nenhum campo que a página pública renderiza fica sem porta de entrada. Medida:
  para cada campo lido pelos componentes `mestre/*`, existe campo de formulário que o
  escreve — verificado por busca, não por suposição.
- **A2.** O que o mestre insere, o sistema expõe. Medida: a tabela de §2.5 sem linha
  "não aparece" e sem linha "editado em outra tela" não resolvida por D5.
- **A3.** A dobra contém pelo menos uma informação escrita pelo mestre. Medida por
  `getBoundingClientRect` contra a altura da viewport, em 1366×768 e 1920×1080.
- **A4.** Nenhum dado que o sistema apresenta como fato tem duas fontes divergentes
  (C1). Medida: os três números de experiência viram um.
- **A5.** Todo dado vindo de JSONB/API passa por normalizador tipado antes de entrar em
  props (C2), conforme AGENTS.md §Normalização obrigatória.
- **A6.** Nenhum alvo de clique abaixo de 24px na página pública nem no editor.
- **A7.** Cada correção **no nível em que impede a recorrência**, medido. Entrega do tipo
  "ajustei os N valores do `mesas`" reprova (AGENTS.md §Compartilhado por padrão).
  Concretamente: C4/C5/C6/C7 no pacote, não no app.
- **A8.** Onde o defeito existe fora do `mesas`, o outro app foi verificado junto —
  medido, não suposto.
- **A9.** Cada correção com teste que falha sem ela, **verificado reintroduzindo o
  defeito**. (Erro registrado na 098: três testes passavam com o bug de volta.)
- **A10.** Medição antes/depois nos 20 perfis reais de produção, não só no `mestre-hermes`.

---

## 7. Fora de escopo

- Acessibilidade por teclado (coerência com a decisão da 098).
- Contraste como prioridade.
- Reescrever o editor de anúncio de mesa — é a 098, ainda não implementada.
- Sistema de avaliações em si (moderação, antifraude, cálculo de nota). D3 decidida
  (2026-08-27): a seção permanece como está; trade-off registrado em §4.
- Mobile: **não medi**. Precisa entrar antes de qualquer implementação, não como escopo
  cortado — só não foi medido nesta passada.

---

## 8. Erros e limites desta investigação

Registrados porque o mantenedor cobra ver, não cobra ausência.

- **Chutei rota de API** (`/api/v1/mesas`) e recebi lista vazia; quase tomei o vazio por
  achado. A rota é `/api/v1/tables`, encontrada em `docs/api/generated/`. É exatamente o
  erro 4.3 do handoff, cometido de novo — desta vez pego antes de virar afirmação.
- **Escrevi que `MestreFeaturedTable` era código morto, e estava errado.** A busca por
  `MestreFeaturedTable` mostrou que `MestreTablesSection.tsx:26` o renderiza; o motivo de
  não aparecer é `featured: false` em todas as mesas, e `featured` é campo de admin.
  Corrigido em D2 antes de a spec sair. Registro porque a afirmação chegou a ser escrita:
  vi um componente ausente da tela e concluí "não ligado" sem rodar a busca que a
  derrubaria — o item 5 da regra de Evidência do AGENTS.md, cometido e pego.
- **Não medi a causa do `selling_points: {}`** (§2.9). Está registrado como achado a
  investigar, não como diagnóstico.
- **Não medi mobile nem tema claro.**
- **Não existe perfil de controle:** nenhum dos 20 está preenchido, então não sei como a
  página se comporta cheia. Toda avaliação de exibição aqui vale para o estado vazio —
  que é, hoje, o estado real de 100% dos perfis.
- **Um número de §3.4 vem de material de fornecedor**, não de estudo controlado, e está
  marcado como tal no próprio texto.
- Medi como **admin** (`viewer_context: {is_owner: false, is_admin: true}`), então vi a
  seção de Insights, que um visitante comum não vê. As outras 6 seções são públicas.
