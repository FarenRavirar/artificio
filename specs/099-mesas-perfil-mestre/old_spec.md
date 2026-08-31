# Spec 099 — Perfil do mestre: o que o mestre insere e o que o sistema expõe

**App:** `mesas` · **Criada:** 2026-08-27 · **Status:** grill concluído (2026-08-27), auditada contra o código (2026-08-30), **não implementada**
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

**O critério que governa a spec inteira:** o jogador está prestes a passar 3 ou 4 horas,
toda semana, com um desconhecido que vai conduzir a história dele. A pergunta que ele faz
não é "esta página é bonita?" — é **"quero jogar com esta pessoa?"**. Cada campo, cada
seção e cada decisão desta spec se justifica por responder a uma pergunta que ele faz
antes de entrar na mesa. Campo que não responde nenhuma não entra, por mais que a coluna
exista no banco. A lista pergunta → campo está em §2.13.

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
| `promo_badge_text` | **0 / 20** | **não** |
| `closed_group_enabled` | **0 / 20** | **não** |
| `reviews_count > 0` | **0 / 20** | — (depende de terceiros) |

Os **sete** campos com **0 de 20** são exatamente os sete que **não têm nenhum campo de
formulário em lugar nenhum do frontend**. A correlação é perfeita: todo campo com porta de
entrada tem ao menos um perfil preenchido; nenhum campo sem porta tem qualquer um. Medição
da ausência em §2.3 e no inventário completo de §2.5.

**Cuidado com a inferência:** o que está medido é a **ausência de porta**, não a
motivação de quem não preencheu. Não afirmo que todos os 20 queriam preencher — afirmo que
nenhum teve como.

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

**A tabela não fecha com o total, e isso está registrado como inconsistência, não
resolvido** (achado da auditoria documental, 2026-08-30): as 7 alturas somam **4712px**;
com os 6 vãos de §2.7 (+144px), **4856px** — contra os **5341px** declarados. Faltam
**485px**.

A causa provável é a tabela ser um recorte do que foi observado na tela, não o inventário
completo: `MestrePage` monta **11 blocos** (§2.5), e a tabela lista 7 — falta pelo menos
`MestreBio` ("Sobre {nome}"), além de seções que só renderizam sob condição
(`MestreSellingPoints`, `MestreClosedGroupSection`, `LinksDisplay`,
`MestreRecommendationsSection`), todas vazias no perfil medido. **Não re-medi** — é número
de runtime, exigiria abrir a página de novo.

**Consequência para a implementação:** usar os 5341px como ordem de grandeza da página
inteira, e as alturas por seção como valores individuais confiáveis; **não** derivar
proporções da soma da tabela, que não é o total.

**A dobra (primeira tela) contém:** o nome, dois botões, e três números
(`4 mesas ativas`, `10+ anos de experiência`, `4 mesas hospedadas`). A headline é
`"Viva aventuras com Mestre Hermes"` — texto gerado pelo sistema, igual para todos.

**Nenhum atributo do mestre aparece acima da dobra** — não há especialidade, sistema que
ele domina nem como ele conduz. Frase própria, escrita por ele para o topo, **também não
existe em nenhum dos 20**: `tagline` está em 0/20. O que aparece nos 10 perfis com
`bio_long` é a **primeira frase da bio**, reaproveitada pelo sistema para preencher o
espaço — texto escrito para outra seção, cortado por regra (§2.1, bloco abaixo). Nos
outros 10, o espaço fica vazio.

NN/g mede que o conteúdo acima da dobra recebe **57% do tempo de visualização** e que a
diferença de tratamento entre acima e abaixo é de **84%**
([Scrolling and Attention](https://www.nngroup.com/articles/scrolling-and-attention/)).
A parte mais cara da página está ocupada pela headline que o sistema escreveu sozinho e,
na melhor das hipóteses, por um empréstimo da bio.

**O slot da frase do mestre já existe e já está ligado.** `MestreHero` renderiza, logo
abaixo da headline gerada, um bloco com precedência `tagline` → primeira frase de
`bio_long` (truncada em 140 caracteres só se exceder) → nada. Com `tagline` em 0/20 e `bio_long` em
10/20, metade dos perfis cai no segundo caso e metade no vazio. O trabalho da dobra
(T4), portanto, **não é criar slot — é promover o que existe** a portador primário e
enchê-lo pela fase B. Nenhum componente novo é necessário para isso.

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
| migration (`migration_107`) ¹ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `db/types.ts` | ✔ | ✔ | ✔ | ✔ | ✔ |
| hidratação (`hydration/config.ts`) | ✔ | ✔ | ✔ | ✔ | ✔ |
| API serve (`gm.ts:146` p/ `tagline`, `161-164` p/ os demais) | ✔ | ✔ | ✔ | ✔ | ✔ |
| API aceita escrita ² | ✔ | ✔ | ✔ | ✔ | ✔ |
| tipo do front (`useMestre.ts`) | ✔ | ✔ | ✔ | ✔ | ✔ |
| componente que renderiza | ✔ | ✔ | ✔ | ✔ | ✔ |
| **campo de formulário** | **✘** | **✘** | **✘** | **✘** | **✘** |

¹ `specialties`, `languages` e `badges` **não** nasceram na `migration_107` — vieram de
`migration_01_base_schema.sql:95-97` (CREATE TABLE `gm_profiles`). A `migration_107`
criou `tagline`, `promo_badge_text` e `selling_points`.

² Escrita aceita em **quatro portas**: POST e PUT `/api/v1/gm/profile` (`gmPanel.ts`,
os 5 + `promo_badge_text`, validação `isSellingPoint`) e PATCH `/api/v1/profile/gm` +
`/api/v1/profile/me/gm` (`profile.ts:168-169`, só `languages`/`specialties`). Nenhuma
é exercitada pelo frontend para estes campos.

Busca que sustenta a última linha:
`rtk rg "selling_point|tagline|specialt|languages|promo_badge" apps/mesas/frontend/src/pages/ProfileEditPage.tsx`
→ **0 ocorrências** (exceto 1 menção a `badges` fora de contexto de campo).
Nenhuma chamada do frontend envia esses campos: as quatro escritas para
`/api/v1/gm/profile` (`PainelMestrePage.tsx:657,680`, `useTableEditor.ts:1048,1209` —
linhas conferidas na auditoria de 2026-08-30; a spec citava 642/665 e 934/1095,
deslocadas) mandam outros campos. O editor de perfil em si **não** escreve em
`/api/v1/gm/profile`: o autosave usa `PATCH /api/v1/profile/gm` (`useProfileQuery.ts:168`).
Exceção medida: `languages` tem picker no onboarding (`OnboardingPage.tsx:352`), mas
escreve em `/api/v1/me/preferences` — entidade preferences, não o perfil do mestre.

O backend aceita escrita dos cinco campos — **código de escrita que nenhum cliente
exercita**. É o padrão que o AGENTS.md nomeia: *"por que os outros não quebraram —
porque aquele caminho nunca foi exercitado"*.

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

### 2.5 Inventário completo: cada campo, onde entra e onde sai

Cruzamento campo a campo entre **as três telas de edição** (aba `Mestre` do editor,
`PainelMestrePage`, editor de mesa) e **as 11 seções** que `MestrePage` monta.

**Esta tabela é o mapa do capital já gasto.** Toda linha marcada "sem editor" ou "ninguém
exibe" é código escrito, testado e deployado que nunca entrega valor — migration, tipo,
rota, componente. Recuperar isso custa o campo que falta, não a feature inteira.

| campo | onde se edita hoje | onde aparece hoje | estado |
|---|---|---|---|
| `avatar_url` + `avatar_crop_data`/`width`/`height` | editor (`AvatarField`, com editor de recorte) | `MestreHero`, com `object-position` derivado do recorte | **completo** |
| `banner_url` + `banner_crop_data`/`width`/`height` | editor (**`ImageUploader`**, `kind="profile_banner"`, com recorte próprio) | fundo do `hero`, sob scrim fixo | **completo** (ver §2.5b) |
| `bio_long` | editor (`MarkdownEditor`, 300px) | `MestreBio` ("Sobre {nome}") | **completo** |
| `experience_years` | editor | `MestreHero`, só se `>= 3`, como `{valor}+` | completo, mas divergente (C1) |
| `links` | editor (`LinksManager`) | `LinksDisplay`, penúltima seção | **completo** |
| `systems.gm` | editor (`UserSystemsSelector`) | **ninguém** | entrada sem saída |
| `average_price` | editor | **ninguém** | entrada sem saída — sai por D4 |
| `contact_methods` | **editor de mesa** e `PainelMestrePage` | `MestreContactMethods` + `MestreContactForm` | funciona, editado longe |
| `preferred_vtt_platforms` | `PainelMestrePage` (`VttPlatformsEditor`) | `MestreVttPlatforms` | funciona, editado longe |
| `tagline` | **nenhum** | `MestreHero` **e descrição OG** (§2.11) | saída sem entrada |
| `selling_points` | **nenhum** | `MestreSellingPoints` ("O que eu ofereço") | saída sem entrada |
| `promo_badge_text` | **nenhum** | `MestreHero`, faixa no topo do hero | saída sem entrada |
| `closed_group_enabled` (bool), `closed_group_systems` (`UUID[]`), `closed_group_description`, `closed_group_min_price_cents` (**centavos**) | **nenhum** — só o tipo existe em `PainelMestrePage` | `MestreClosedGroupSection` ("Sistemas aceitos", "A partir de R$X") | saída sem entrada |
| `specialties` | **nenhum** | **ninguém** | órfão dos dois lados |
| `languages` | **nenhum** (o picker do onboarding grava em `preferences`, outra entidade) | **ninguém** | órfão dos dois lados |
| `badges` | **nenhum** | **ninguém** | órfão dos dois lados |
| `covil_verified`, `discord_connected`, `reviews_count` | **colunas** de `gm_profiles`, escritas por outros fluxos (não pelo editor) | `MestreHero` (selo / contagem) | correto |
| `tables_count`, `tables_hosted_count`, `years_on_platform` | **subconsultas na própria query** (`gm.ts`), não colunas | `MestreHero` | correto |

**O saldo:** de 18 grupos de campo servidos pela API, **7 não têm nenhuma porta de
entrada** e **5 não têm nenhuma exibição**. Três (`specialties`, `languages`, `badges`)
não têm nem uma nem outra: existem na migration, no tipo do banco, no tipo do front e no
contrato de escrita de duas rotas — e não tocam a tela em ponto nenhum.

**O caso mais caro é `closed_group`:** quatro colunas, tipo declarado no painel, seção
pública inteira escrita (`MestreClosedGroupSection`, com preço e lista de sistemas) — e
nenhum campo para ligar.

Medição, com a busca corrigida (a primeira versão usava um padrão `snake_case` que
subnotificava o alcance do símbolo — achado da auditoria de front, 2026-08-30):
`rtk rg -i "closed_group|closedGroup"` no frontend (sem testes) devolve **17 referências
em 4 arquivos**:

| arquivo | ocorrências | natureza |
|---|---|---|
| `MestreClosedGroupSection.tsx` | 9 | consumo (render da seção) |
| `PainelMestrePage.tsx` | 4 | **só declaração de tipo** |
| `MestrePage.tsx` | 2 | consumo (monta a seção) |
| `useMestre.ts` | 2 | consumo (tipo do hook) |

**0 campos de formulário:** `rtk rg -i "closed" ProfileEditPage.tsx` devolve **zero**, e no
`PainelMestrePage` existem apenas as quatro declarações.

A conclusão não muda — não há onde ligar —, e o alcance é maior do que a contagem original
sugeria: treze pontos de consumo esperando um dado que ninguém consegue produzir.

Nenhum dos 20 perfis tem o recurso ligado, e **não há como ligar pela interface** — isso
está medido. Se algum mestre *desejaria* ligar não está: exigiria perguntar a eles. O que
sustenta a prioridade de D9 não é interesse presumido, é o dado de mercado do concorrente
direto (70–80% das reservas são campanha).

`Sistemas que Mestra` é o caso mais visível do outro lado: o editor diz `2 sistema(s) que
você mestra` — **um contador, sem listar quais** (C9). O mestre não vê o que escolheu, e o
visitante nunca vê.

### 2.5b O banner existe, e o mestre não controla como o texto assenta sobre ele

O `hero` aceita foto de banner com recorte (`banner_crop_data` vira `object-position`) e,
**quando há foto**, aplica um scrim navy fixo por CSS para garantir contraste AA do texto
claro:

```css
.hero-section:has(.hero-banner) .hero-overlay {
  background:
    linear-gradient(to bottom, rgba(15,24,48,.72), rgba(15,24,48,.88)),
    linear-gradient(to right,  rgba(15,24,48,.64), rgba(15,24,48,.36));
}
```

Sem foto, o scrim é `transparent` e entra um gradiente de superfície
(`.hero-banner-gradient`). A regra é boa — o contraste não fica à mercê da foto que o
mestre subir. Mas **os valores são fixos no CSS**: uma foto escura recebe o mesmo
escurecimento de 72–88% que uma foto clara, e o mestre não tem nenhum controle sobre isso.

Com `banner_url` preenchido em **3 de 20**, não há amostra para afirmar que o resultado
fica ruim — **não medi** perfis com banner real. O que está medido é que o controle não
existe e que o recorte, esse sim, já é editável.

**Decisão que isto resolve (D8, §4):** manter o véu fixo e dar ao mestre a prévia do
escurecimento (preservando um piso de contraste), ou manter fixo e apenas avisar no editor
que o texto ficará sobre um véu escuro.

### 2.6 O editor repete os defeitos de forma da 098

Aba `Mestre`: **3607px, 3,75 telas**. São **3 seções** no código, não 4 (contagem
corrigida em 2026-08-30 — a original não listava quais): `Perfil de Mestre` (anos de
experiência, preço médio, bio, foto de mestre, banner), `Sistemas que Mestra`, e o bloco de
`LinksManager`, que é `form-section` sem `<h2>`.

**Sem botão salvar** — `rtk rg "Salvar" ProfileEditPage.tsx` → 0 (conferido em auditoria
com "salvo"/"save"/"guardar": só os textos do indicador). O JSDoc em
`ProfileEditPage.tsx:19` promete *"Autosave com debounce 500ms"*, mas **o código não
implementa debounce nenhum**: a mutation (`useUpdateGm` → `PATCH /api/v1/profile/gm`,
`useProfileQuery.ts:166-168`) dispara a cada `onChange`; o único timer (2000ms, `:64`)
só esconde o indicador. E o CSS do indicador **não tem `position: fixed` nem `sticky`**
(`ProfileEditPage.css:204-212`; `position` não aparece no arquivo inteiro): o indicador
fica no topo e rola para fora. Quem edita a bio — que começa em 597px e tem 300px de
altura — não vê nenhuma confirmação de que o trabalho foi salvo. Nielsen #1. O defeito
é pior do que o medido: sem debounce há uma escrita por tecla, e o indicador que some
esconde até o que foi escrito.

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
controle `Manter link direto` que a 098 já havia listado no editor de anúncio
(`specs/098-mesas-usabilidade-editor/spec.md`, na lista de alvos abaixo do piso, ao lado do
`×` das tags de estilo). **O mesmo defeito, no mesmo componente, em duas telas** —
verificado por busca na 098, não inferido.

### 2.7 Espaçamento entre seções da página pública, sem regra

Vãos medidos entre as 7 seções: **48, 48, 0, 48, 0, 0**.

Três junções com `0px`. É a proximidade invertida que a 098 §6.6 identificou como o
defeito real (não a falta de escala): sem espaço entre grupos, o olho não sabe onde uma
seção termina.

### 2.8 Alvos de clique abaixo do piso na página pública

Controles com altura < 24px na página pública:

| controle | altura | onde mora (verificado por CSS em 2026-08-30) |
|---|---|---|
| `Mestre Hermes` (nome nos 4 cartões) | 20px | `apps/mesas` (`TableCard.tsx:186-192`; line-box de `text-sm`: 14px de fonte) |
| navegação global (`Portal`, `Glossário`, `Mesas`…) | 22px medido em runtime | **não reproduz no CSS do pacote**: `.artificio-nav-link` tem `min-height: 40px` (`styles.css:364-375`) — re-medição pendente |
| `Ver termos de uso` (rodapé) | 18px medido; CSS diz fonte 13px / line-box ≈20px | **`packages/ui`** (`styles.css:675-690`) — classe de defeito confirmada, valor a re-medir |
| links de projetos do rodapé (`.artificio-footer-nav-link`) | ≈17px (line-box) | **`packages/ui`** (`styles.css:649-655`) — ausente da medição original |

O rodapé **atinge todos os apps do monorepo** (consumidores do `Footer`: mesas,
downloads, glossario), não só o `mesas`. Pela regra pétrea (§Compartilhado por padrão),
a correção pertence ao pacote — e a verificação precisa cruzar os outros apps antes. A
nav, ao contrário do medido, já garante alvo ≥40px no pacote: antes de tratá-la como
defeito do pacote (C5b/T11), re-medir em runtime no `mesas` — a medição de 22px pode ter
capturado o header de outro app ou um elemento interno.

### 2.9 Achado de contrato: `selling_points` volta como objeto

A migration declara `JSONB NOT NULL DEFAULT '[]'::jsonb`
(`migration_107_gm_public_profile_v2.sql:14`), o tipo do frontend declara
`SellingPoint[]`, e a API devolveu **`{}`** para o `mestre-hermes` — e para **7 dos 20**
perfis medidos.

`MestrePage.tsx:103` passa `profile.selling_points ?? []` ao componente. `{}` não é
`null`, então o `??` não dispara: o componente recebe um objeto onde espera array. Não
quebrou porque `MestreSellingPoints.tsx:48` sai cedo
(`if (!Array.isArray(sellingPoints) || sellingPoints.length === 0) return null` — o
guard cobre os dois casos: objeto e vazio) — mas é exatamente a classe de defeito que o
AGENTS.md cobre em *"Normalização obrigatória"*: dado de JSONB entrando em props sem
normalizador tipado.

**Não medi a causa** (se é escrita antiga, migração de dado, ou serialização). Fica como
achado a investigar, não como diagnóstico.

### 2.10 O jogador não encontra mestre — só mesa

Os filtros estruturados do catálogo são todos sobre a **mesa**. O backend aceita `system`,
`modality`, `type`, `audience`, `price_type`, `experience_level`, `state`, `city`,
`featured`, `seal`, `styles` — cada um comparado contra uma coluna de `tables`. **Nenhum
filtro estruturado toca o perfil do mestre.**

A única porta para o mestre é a busca textual, e ela tem **quatro** predicados
(`tables.ts`, cláusula `if (search)`):

```sql
(
  t.title       ILIKE %q%
  OR t.description ILIKE %q%
  OR t.system_id IN (…ids resolvidos do nome do sistema…)
  OR COALESCE(gm.nickname, p.display_name) ILIKE %q%
)
```

Do mestre, **só o nome** — `gm.nickname`, com queda para `p.display_name`. O terceiro
predicado resolve nome de sistema contra o catálogo central e filtra por `t.system_id`;
ainda é atributo da mesa, não do mestre.

**Precisão importante:** não é verdade que "nenhum campo do mestre entra na consulta" — o
nome entra. O que não entra é **qualquer atributo descritivo**: `specialties`, `languages`,
`tagline`, `badges`, `experience_years`. Quem procura *"mestre que narra investigação, em
português, para iniciantes"* precisa acertar o **nome** de alguém, ou não acha ninguém — e
não acharia **mesmo com os 20 perfis preenchidos**.

Isto delimita o teto honesto da spec: enquanto a busca não ler os atributos do mestre,
preencher `specialties` melhora a **decisão** de quem já chegou ao perfil, não a
**descoberta** de quem ainda não chegou.

**Por que fica fora do escopo — e não é por D1.** Fazer a busca ler colunas que já existem
é mudança de *query*, não de modelo de informação; D1 congelou migration e campo novo, e
não alcança este caso. A razão real é de **ordem**, medida em D6: filtro sobre acervo vazio
entrega resultado vazio em toda combinação, e hoje `specialties` e `languages` estão em
0/20. Primeiro a porta de entrada e o dado; o filtro depois, em spec própria. Registrado
assim para a spec não prometer descoberta que não entrega, **nem justificar a exclusão com
um motivo que não a sustenta**.

### 2.11 Metade dos perfis se apresenta ao mundo com a mesma frase

`tagline` alimenta **três** consumidores, e dois deles são externos ao produto:

1. **a dobra do perfil** — `MestreHero`, precedência `tagline` → **primeira frase** de
   `bio_long` (`split(/[.!?]\s+/)[0]`), truncada em 140 caracteres **só se exceder** → nada.
2. **a descrição servida ao crawler** — `buildGmDescription`
   (`apps/mesas/backend/src/utils/ogDescription.ts`, chamada em `routes/og.ts`), que é o que
   o WhatsApp, o Discord e o Google leem. Precedência: `tagline` → `bio_long` →
   *"Conheça o perfil do mestre {nome} e descubra suas mesas ativas no {site}"*.
3. **a meta description do SPA** — `applySeo`, chamada inline em `MestrePage`.
   Precedência: `tagline` → **`bio_long.slice(0, 150)`** (substring crua, não a primeira
   frase) → *"Landing pública de mestre com mesas ativas e especialidades."*

**São três cortes e dois fallbacks diferentes para o mesmo dado** (achado da auditoria de
front, 2026-08-30). Nenhum deles é bug funcional hoje, mas a fase B precisa saber que
**mexer em um não mexe nos outros**:

| consumidor | corte de `bio_long` | fallback final |
|---|---|---|
| `MestreHero` (dobra) | 1ª frase, truncada em 140 se exceder | nada renderizado |
| `buildGmDescription` (backend, crawler) | conforme a função | *"Conheça o perfil do mestre…"* |
| `applySeo` (front, SPA) | `slice(0, 150)` | *"Landing pública de mestre…"* |

Com `tagline` em 0/20 e `bio_long` em 10/20, **metade dos perfis compartilhados hoje
mostra uma frase genérica**, idêntica para todos os mestres. É o custo mais caro dos 0/20 e
acontece **fora do produto**, no momento em que o jogador decide se clica — antes de ver
qualquer coisa que o mestre escreveu. Encher `tagline` resolve os três de uma vez, porque
é o primeiro item das três cadeias.

**Nota para quem auditar isto de novo:** uma auditoria com escopo restrito ao frontend
concluiu que `buildGmDescription` e a frase *"Conheça o perfil do mestre…"* "não existem em
lugar nenhum do app". **Existem, no backend** — `utils/ogDescription.ts`, com teste em
`ogDescription.test.ts` que fixa a frase exata. A conclusão de inexistência era limite de
escopo, não achado. O que a auditoria de fato descobriu, e vale, é a **terceira** cadeia
(`applySeo`, no front), registrada acima.

**Não medi** qual das duas descrições prevalece para cada crawler (o `og.ts` serve HTML ao
robô; o `applySeo` roda depois no navegador) — a fase B não depende disso, mas uma spec de
SEO dependeria.

### 2.12 O contraste que enquadra a spec inteira

A tabela `tables` tem **88 colunas** (`TablesTable` em `db/types.ts`, contadas em
2026-08-30), das quais dezenas descrevem *conteúdo* de uma mesa:
`synopsis`, `synopsis_narrative`, `style_tags`, `setting_styles`, `benefits_text`,
`features`, `technical_requirements`, `content_warnings`, `safety_tools`,
`campaign_length`, `level_range`, `table_gm_bio`…

O perfil do mestre tem **um** campo de texto livre.

O anúncio da mesa é um modelo de informação rico. Quem mestra a mesa é um parágrafo.

**E o contraste é maior do que o de modelo de dados: o editor de mesa já resolveu o
problema de interface que esta spec descreve.** Ele tem `EditorField` sobre o `Field` do
pacote, com três níveis marcados (obrigatório / recomendado / opcional), frase de ganho
por campo recomendado na linguagem do jogador (*"ajuda o jogador a saber se a mesa é para
ele"*), prévia ao vivo (`CardPreview`) e partes semânticas em vez de uma coluna longa. O
editor de perfil não usa nada disso — nem os primitivos do pacote.

A fase B, em boa medida, **não é invenção: é aplicar ao perfil o que o editor de mesa já
faz a uma tela de distância.** Inventário do que reusar no `plan.md`, fase B.

### 2.13 Pergunta do jogador → campo → forma real do dado

A tabela que fecha o diagnóstico e abre a implementação. Cada linha é uma pergunta que o
jogador faz antes de sentar na mesa de um desconhecido; nenhum campo entra sem uma.

| pergunta do jogador | campo | forma real | preenchido | quem exibe |
|---|---|---|---|---|
| "quem é esse cara, em uma frase?" | `tagline` | `string \| null` | **0/20** | `MestreHero` + **descrição OG** (§2.11) |
| "ele domina o sistema que eu quero?" | `specialties` | `string[]` | **0/20** | **ninguém** (tipado, não renderizado) |
| "vai ser em português?" | `languages` | `string[]` | **0/20** | **ninguém** |
| "como é jogar com ele?" | `selling_points` | `jsonb`, forma abaixo | **0/20** | `MestreSellingPoints` |
| "é experiente ou está começando?" | `experience_years` | `number \| null` | 11/20 | `MestreHero`, só se `>= 3` |
| "outros jogadores aprovaram?" | `badges` | `string[]` | **0/20** | **ninguém** |
| "onde vejo mais dele?" | `links` | tabela própria | 1/20 | `LinksDisplay` |
| "quanto custa?" | — | — | — | cartões de mesa; grupo fechado (§5, D4) |

**Duas ausências de natureza oposta, e as duas contam:**

- `tagline` e `selling_points` têm **saída sem entrada** — a página renderiza, o mestre
  não tem onde escrever.
- `specialties`, `languages` e `badges` têm **entrada quase pronta e nenhuma saída** — o
  contrato de escrita já aceita dois deles (ver `plan.md`, fase B), e nenhum componente
  `mestre/*` os exibe.

Criar o formulário dos três sem criar a exibição repete o defeito com o sinal trocado.
Para eles, **fase B e fase C andam juntas**.

**Forma exata de `selling_points`** — errar aqui produz bug silencioso:

```ts
Array<{ icon: string; title: string; description: string; highlight?: string }>
```

`icon` é chave de um **dicionário fechado de 14 valores** (`SELLING_POINT_ICONS`, em
`MestreSellingPoints`):

```
clock · monitor · coins · sparkles · shield · heart · zap
users · trophy · headphones · mic · video · film · book
```

Chave fora da lista **não quebra**: cai em `Sparkles` sem avisar. Por isso o campo tem de
ser **seleção entre as 14**, nunca texto livre. O backend (`isSellingPoint`, em `gmPanel`)
exige `icon`/`title`/`description` como `string` e **descarta em silêncio** o item que não
bate — o formulário valida antes de enviar, não confia no descarte.

Os demais são triviais: `specialties`/`languages`/`badges` são `string[]` de texto livre,
sem vocabulário fechado; `tagline` é `string` sem limite no banco.

**A contradição de `experience_years` (C1/T8):** `14` no editor, `11` na bio escrita à
mão, `10+` na página. O front **não arredonda** — renderiza o valor cru seguido de um `+`
literal no JSX. Então `10+` significa que a API devolveu `10` enquanto o editor mostra
`14`: a divergência é **de dado entre fontes**, não de formatação.

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

### 3.1b Como a indústria transforma prosa em atributo — e por que NÃO é pedindo mais campo

A §3.1 estabelece *que* o dado precisa virar atributo. A pergunta seguinte — *como* — tem
resposta publicada por quem enfrentou o mesmo problema em escala, e **a resposta contraria
a solução óbvia**.

O Airbnb tinha exatamente o defeito da §2.3: atributos que importam ao hóspede, e que o
anfitrião não preenche. A saída deles **não** foi acrescentar campos
([Airbnb Tech Blog, *Wisdom of Unstructured Data*, 2023-11-15](https://medium.com/airbnb-engineering/wisdom-of-unstructured-data-building-airbnbs-listing-knowledge-from-big-text-data-7c533466a63c)):

> *"Instead of relying on Hosts to manually input all the potential listing attributes,
> **which would be tedious** given the vast number of attributes guests care and inquire
> about, we developed a machine learning system called Listing Attribute Extraction
> Platform (LAEP)."*

A arquitetura do LAEP tem três camadas, e a terceira é a que mais importa aqui:

1. **Extração** (NER) — acha a menção no texto que o anfitrião já escreveu;
2. **Mapeamento** — casa a menção com a taxonomia canônica. Eles mediram **12 variações
   de "lockbox"** (`lock box`, `lock-box`, `box for the key`, `keybox`, e erros de digitação
   como `ket box`) — o mesmo fenômeno que a §3.1 descreve com "AI/A.I./ai";
3. **Pontuação de confiança** — devolve `YES / NO / Unknown` com confiança, e o resultado
   **não vira dado**: alimenta sistemas (`Eve`, `APS`) que **recomendam ao anfitrião**.

**O detalhe decisivo para esta spec:** o modelo deles acerta **75,32% de F1** (por
categoria, de 60,18% a 82,52%). *Nem o Airbnb confia na própria extração* — por isso a
terceira camada existe, e por isso a máquina nunca grava sozinha. Extração sem confirmação
seria, na medida deles, errar um em cada quatro atributos exibidos ao jogador.

**A leitura correta para o `mesas` não é "fazer ML".** LAEP custou 30 mil textos rotulados,
NER próprio, `word2vec` ajustado e BERT afinado — desproporcional para 20 perfis. O que
transfere é o **padrão**: onde o usuário já escreveu o dado em prosa, extrair e **oferecer
para confirmação** custa menos ao usuário do que um formulário novo, e é o que a indústria
faz quando o preenchimento manual falha. A §2.4 mede que o mestre **já escreve os
atributos à mão** dentro da bio; a spec os trata como sintoma, e a fonte os trata como
**fonte de dados**.

### 3.1c O padrão já existe no `mesas` — a uma tela de distância

E não é hipótese: o editor de anúncio de mesa **já implementa as três camadas**, com o
vocabulário do produto.

`POST /api/v1/gm/parse-preview` (spec 079) recebe texto livre colado pelo mestre e devolve
sugestão de campos **mais os sinais de incerteza** — `missing_fields`, `_slots_ambiguity`,
`_price_ambiguity`, `raw_system_hint` —, e **nunca grava mesa**: só registra o caso em
`discord_parse_cases`, para o laço de aprendizado. É a camada 3 do LAEP com outro nome.

**A engine é motor de regras, não modelo** (medido): `segmentAnnouncements` →
`normalizeLooseText` → `parseDiscordAnnouncement` (centenas de `label`/alias/regex) →
`buildTableDraftFields`, com catálogos e `label_aliases` corrigidos por humanos. Nenhum
peso, nenhum embedding. Vale como precedente de **arquitetura** (sugerir + confirmar), não
de técnica de extração — a técnica para T16 é o `llmAssist.ts`, que é caminho separado.

O front marca cada campo preenchido assim com o badge **"Pelo
anúncio"** (`EditorField`, `parserMarked`) e a frase *"O texto colado preencheu este campo
— confira antes de publicar"*. O `ParserSignalsPanel` mostra o que ficou ambíguo em
linguagem de gente, nunca a chave crua: *"Preço ambíguo: o texto cita gratuidade e
cobrança"*, *"O sistema citado não está no catálogo — escolha na lista ou sugira um"*.

A trava dele é a mesma do `Eve`, e está escrita no código: **"publicar nunca é bloqueado
por isso — este painel é aviso, não validação"**. Máquina sugere; pessoa confirma; nada
trava.

**Consequência para o desenho da fase B:** a alternativa ao formulário puro não precisa ser
inventada nem importada — precisa ser **estendida do anúncio para o perfil**. O mesmo
`EditorField` com `parserMarked`, o mesmo padrão de confirmação, sobre a bio que 10 dos 20
mestres já escreveram.

### 3.1d O que faz o usuário preencher, medido

Formulário melhor não basta: o campo precisa dizer o que o usuário ganha.

O LinkedIn refez o medidor de completude de perfil porque o antigo deixava o usuário *"confuso
e sem saber como chegar a um perfil completo"*. A troca foi de barra de progresso vaga para
**cartões de tarefa acionáveis**, cada um explicando o benefício — *"mais informação melhora
seu ranqueamento na busca"*. Resultado medido: **completude de perfil subiu mais de 100%**
([estudo de caso, Samantha Freedman](http://www.samanthafreedman.com/profile-completion)).

O Upwork publica o mesmo incentivo em número de negócio: freelancer com perfil completo tem
**4,5× mais chance de ser contratado**
([Upwork Help](https://support.upwork.com/hc/en-us/articles/34924882793107-Build-a-100-complete-profile)).

**Isto valida, com número externo, o padrão que o editor de mesa já usa**
(`RECOMMENDED_GAIN`: *"mesas com banner aparecem em destaque"*) e que o editor de perfil não
tem: no perfil, **nenhum campo diz por que vale a pena preencher**. Com 0/20, é a hipótese
mais provável para a ausência — junto com a falta de campo.

**Ressalva:** o número do LinkedIn vem de estudo de caso de portfólio, e o do Upwork é
material do próprio produto. Nenhum dos dois é estudo controlado; valem como direção
convergente, não como medida transferível ao `mesas`.

### 3.1e O concorrente direto já estrutura o que a 099 quer estruturar

O StartPlaying — plataforma de mesas de RPG pagas, mesmo público — trata como campo
estruturado exatamente o que aqui vive em prosa
([Setting up your GM Profile](https://intercom.help/startplaying/en/articles/8718996-setting-up-your-gm-profile),
[Best Practices for GMs](https://intercom.help/startplaying/en/articles/8719010-best-practices-for-game-masters)):

- **Idiomas** — *"liste os idiomas em que você mestra confortavelmente"*, e o jogador
  **filtra por idioma** na busca de mestres;
- **Game Themes / Game Styles / Game Mechanics** — facetas separadas, com a orientação de
  *"reflita suas especialidades reais; não anuncie um estilo que você não é, porque
  jogadores procurando outro estilo provavelmente não são um bom par"*;
- **Ferramentas de segurança** — **obrigatório usar ao menos uma**; avisos de conteúdo são
  etiquetas no anúncio, não texto solto;
- **Localização** (fuso), foto e links sociais como campos próprios.

Dois pontos que valem para as decisões desta spec. Primeiro, **`languages` é filtro de
busca no concorrente** — o que reforça §2.10: aqui o campo existe, está em 0/20, e a busca
não o lê. Segundo, o argumento deles para o mestre não é completude, é **par certo**:
declarar o estilo real evita o jogador errado. É o mesmo enquadramento da frase de ganho
(§3.1d), na linguagem do domínio.

### 3.2 A dobra é cara e está sendo gasta com texto do sistema

[NN/g, Scrolling and Attention](https://www.nngroup.com/articles/scrolling-and-attention/):
**57%** do tempo de visualização fica acima da dobra, **17%** na segunda tela, e a regra
do estudo é *"reserve o topo da página para conteúdo de alta prioridade: metas-chave do
negócio e do usuário"*.

[NN/g, The Fold Manifesto](https://www.nngroup.com/articles/page-fold-manifesto/): a
diferença média de tratamento acima/abaixo da dobra é de **84%**, e os 100px logo acima
dela são vistos **102% mais** que os 100px logo abaixo. Usuários rolam — *"mas só se o
que está acima da dobra for promissor o bastante"*.

Hoje o que está acima da dobra é uma headline gerada (`Viva aventuras com…`), dois botões,
três números e — só nos 10 perfis com `bio_long` — a primeira frase da bio, emprestada pelo
sistema (§2.1). **Nenhum atributo do mestre, e nenhuma frase que ele tenha escrito para
aquele lugar.** Pela fonte, é o espaço mais caro da página aplicado ao conteúdo menos
diferenciador.

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
- ~~**Comparação com Airbnb/Upwork como fonte**~~ — **descarte revertido.** A busca inicial
  só devolveu material de marketing de terceiros. Buscando pela publicação de engenharia
  primária, o material existe e é aplicável: o Airbnb Tech Blog descreve o LAEP, com
  arquitetura e métricas (§3.1b); o StartPlaying documenta o modelo de campos do
  concorrente direto (§3.1e). O que continua descartado é material de agência sobre
  "confiança em marketplace", que repete boa prática sem medir nada.
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

**Grill concluído (2026-08-27).** As decisões D1-D11 abaixo estão resolvidas; o fundo
medido de cada uma permanece registrado junto com a decisão.

### D1 — Modelo de informação: não mexe (decidido, 2026-08-27)

**Decisão do mantenedor:** o modelo de informação não muda. Sem migration nova, sem
campo novo — usa-se o que já existe no banco (`tagline`, `specialties`, `languages`,
`selling_points`, `badges`, `links`, `experience_years`). *Correção factual (auditoria
2026-08-30):* nem tudo veio da `migration_107` — `specialties`, `languages` e `badges`
nasceram em `migration_01_base_schema.sql:95-97`; a `migration_107` acrescentou
`tagline`, `promo_badge_text` e `selling_points`. A decisão permanece intacta.

O fundo medido que motivava a pergunta fica registrado: `selling_points` (livre, criado
na `migration_107`) e `specialties` (estruturado, criado em `migration_01_base_schema`),
**nenhum dos dois** tem editor e ambos estão em 0/20 (§2.3); o mestre já estrutura à mão
dentro da bio, e a estrutura dele contradiz o campo que existe (§2.4). Com o modelo
intacto, a fase A se reduz a: inventário dos campos existentes, resolução de C1 (fonte
única para experiência) e normalização na fronteira (C2).

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
fatores de confiança (§3.3). Mitigação: o preço continua aparecendo nos cartões de mesa
(`MestreFeaturedTable.tsx:148-155`) e, quando `closed_group.enabled`, na seção de grupo
fechado (`MestreClosedGroupSection.tsx:68-73`).

### D5 — Onde o mestre edita: manter as 3 telas, funcionando (decidido, 2026-08-27)

**Decisão do mantenedor:** as 3 telas permanecem (`/perfil?tab=mestre`, `PainelMestrePage`,
editor de mesa) — elas já consomem e comunicam no mesmo dado. O que precisa existir é
que **funcionem**: C3 (autosave visível), C9 (sistemas listados, não só contados),
prévia do perfil público. Coleta progressiva (§3.4) **não entra** nesta passada.

### D6 — Busca por atributo do mestre: fora desta spec, e a ordem é essa mesmo (decidido)

**Decisão:** a 099 não torna o perfil buscável. Registrado como teto explícito (§2.10), não
como omissão.

E a ordem não é só consequência de D1 ter congelado o modelo — é o que a prática de
marketplace prescreve. A regra publicada é **supply-driven**: *"nenhuma categoria deve
estar vazia no lançamento"*, e filtro se expõe conforme o acervo cresce, porque
*"navegar uma estrutura complexa é tedioso, especialmente se a maioria está vazia"*
([Sharetribe Academy, *How to build your marketplace search*](https://www.sharetribe.com/academy/how-to-help-your-customers-find-the-right-product-or-service/)).

Com `specialties` e `languages` em **0/20**, um filtro por atributo de mestre entregaria
hoje resultado vazio em todas as combinações — o pior caso da fonte. A sequência correta é
a que a spec já segue: **primeiro a porta de entrada (fase B), depois o dado, e só então o
filtro**, em spec própria.

**O que fica registrado para essa spec futura:** a busca atual tem quatro predicados —
`t.title`, `t.description`, `t.system_id` (resolvido do nome do sistema) e
`COALESCE(gm.nickname, p.display_name)`. Do mestre entra **só o nome**; nenhum atributo
descritivo (§2.10). E o concorrente direto **já filtra por idioma** na busca de mestres
(§3.1e), o que dá o primeiro candidato quando o dado existir.

### D7 — O fallback da descrição OG: nada de frase composta pelo sistema (decidido)

`tagline` alimenta também as duas descrições (backend para o crawler, front para o SPA),
**cada uma com seu fallback genérico**, idêntico entre todos os perfis (§2.11). A saída
tentadora seria compor automaticamente algo como *"Mestra D&D 5e e Call of Cthulhu ·
14 anos de mesa"*. **A prática de SEO desaconselha exatamente isso.**

Descrição duplicada ou boilerplate é tratada como *"oportunidade perdida"* que reduz a
unicidade percebida das páginas, e é um dos gatilhos mais comuns para o Google **reescrever
a descrição por conta própria** — precisamente quando ela é genérica e não acrescenta valor
além do título. A orientação, quando não há descrição única possível, é **deixar em branco**
e permitir que o buscador extraia o trecho relevante da página, em vez de repetir a mesma
fórmula
([Search Engine Journal](https://www.searchenginejournal.com/on-page-seo/optimize-meta-description/);
[Search Engine Land](https://searchengineland.com/seo-meta-descriptions-everything-to-know-447910)).

Uma frase montada por template a partir de sistemas e anos seria boilerplate por
construção — os 20 perfis produziriam 20 variações da mesma estrutura. Trocaria uma frase
genérica por outra, com custo de implementação.

**Decisão:** manter a cadeia atual (`tagline` → `bio_long` → genérica) e resolver pela
origem — dar ao mestre onde escrever a `tagline`. É o que a fase B entrega, e o alcance é
maior: o mesmo campo serve dobra e compartilhamento.

### D8 — Banner: o véu fica fixo, e o mestre passa a vê-lo antes de publicar (decidido)

**Decisão:** manter o scrim fixo e acrescentar prévia no editor. **Não** dar controle de
intensidade ao mestre.

O critério não é preferência — é o que a prática profissional prescreve para imagem
enviada por usuário, onde o designer não conhece o conteúdo. As fontes convergem em três
pontos:

1. **O scrim é a técnica correta**, e a verificação de contraste se faz contra a cor do
   scrim, **não contra a imagem** — é justamente isso que torna o resultado previsível com
   foto imprevisível ([Smashing Magazine, *Designing Accessible Text Over Images*](https://www.smashingmagazine.com/2023/08/designing-accessible-text-over-images-part1/); [Material Design, Imagery](https://m1.material.io/style/imagery.html)).
2. **A faixa usada na prática é 40–60% de preto** para texto branco; o `mesas` usa 72–88%
   de navy, ou seja, **acima do necessário** — conservador, não frouxo. Não há defeito de
   contraste a corrigir.
3. **Controle pelo autor é desaconselhado exatamente aqui:** a opacidade é o parâmetro que
   garante o critério, e expô-la permite ao mestre baixar abaixo do piso de AA, quebrando
   acessibilidade em nome de estética. É o motivo de sistemas de design fixarem o valor.

O problema real medido em §2.5b não é a intensidade — é que **o mestre não vê o resultado
antes de publicar**. Isso é Nielsen #1 (visibilidade do estado), e a correção é prévia, não
controle.

**Descartado, com motivo:** derivar a intensidade da luminância da foto. O
[Material Color Utilities](https://github.com/material-foundation/material-color-utilities)
faz extração de cor dominante, e a própria documentação registra que o resultado é
aproximado — a cor dominante *"pode não terminar como uma das cores do esquema"*. Trocar
uma garantia determinística por uma heurística, para resolver um problema estético não
medido em 3 perfis, é piorar a garantia sem evidência de ganho.

**Consequência:** T19 é prévia + aviso. Nenhuma coluna nova; não toca D1.

### D9 — `closed_group` entra na fase B (decidido)

**Decisão:** as capacidades órfãs entram na fase B, e **`closed_group` entra junto** — não
fica para depois.

Eu havia devolvido isto como decisão de produto. **Foi erro meu:** a pergunta tem resposta
medida no domínio, e devolvê-la sem procurar essa medição é exatamente a investigação rasa
que o AGENTS.md proíbe.

O dado é do concorrente direto, que opera o mesmo mercado com volume real: no StartPlaying,
**70–80% das reservas diárias são campanha; 20–30% são mesa avulsa**
([StartPlaying, *One-Shots vs Campaigns*](https://startplaying.games/blog/posts/one-shots-vs-campaigns-homebrew-module-wotc)).
A mesma fonte registra que *"campanhas são o que a esmagadora maioria dos usuários
procura"*, e que a conversão de avulsa para campanha é fraca: **1 em 11 jogadores** de mesa
gratuita migra para campanha paga do mesmo mestre.

Traduzido para o `mesas`: `closed_group` é a estrutura de **grupo fixo / campanha** —
a modalidade que concentra a maior parte da demanda no mercado. Ela está construída de
ponta a ponta (4 colunas, seção pública com preço e sistemas aceitos) e **desligada em
20/20 perfis, por falta do formulário que a liga**. Deixá-la fora da fase B mantém
desligada a oferta que o mercado mais procura, para economizar o menor pedaço do trabalho.

**O que isto NÃO decide:** preço, comissão, regra de contrato do grupo fixo, ou qualquer
mudança de política comercial. A decisão é só **ligar o que já existe** — expor os quatro
campos que a seção pública já lê.

**Ordem da fase B, por custo medido contra alcance:**

| ordem | capacidade | por quê |
|---|---|---|
| 1 | `tagline` | um campo; alcança hero **e** descrição OG (§2.11) — metade dos perfis hoje se apresenta com frase genérica |
| 2 | `closed_group` (4 campos + liga/desliga) | seção inteira pronta; 70–80% da demanda do mercado |
| 3 | `specialties` / `languages` / `badges` | contrato já aceita 2 dos 3; **exigem exibição junto** (§2.13) |
| 4 | `selling_points` | render e validação prontos; campo mais complexo (ícone + 3 textos) |
| 5 | `promo_badge_text` | um campo, alcance menor (faixa promocional) |

---

### D10 — Todo campo recomendado leva a frase do ganho (decidido)

**Decisão:** cada campo recomendado do editor de perfil declara o que o mestre ganha, no
padrão `RECOMMENDED_GAIN` que o editor de mesa já usa.

Não é preferência de redação: é a diferença medida entre um formulário que é preenchido e
um que não é. O LinkedIn trocou barra de progresso vaga por tarefas com benefício explícito
(*"mais informação melhora seu ranqueamento na busca"*) e **dobrou a completude de perfil**;
o Upwork publica **4,5× mais chance de contratação** com perfil completo. O StartPlaying
usa o mesmo mecanismo no vocabulário do domínio — o argumento não é completude, é **par
certo**: *"não anuncie um estilo que você não é, porque jogadores procurando outro estilo
provavelmente não são um bom par"* (§3.1d, §3.1e).

Hoje **nenhum campo do editor de perfil diz por que existe**. Com 0/20, isso é hipótese tão
provável para a ausência quanto a falta de campo — e as duas se corrigem no mesmo trabalho.

**Ressalva mantida:** os números do LinkedIn e do Upwork não vêm de estudo controlado.
Valem como direção convergente de três fontes independentes, não como medida transferível.

### D11 — Extração da bio com confirmação: entra (decidido)

**Decisão:** a fase B entrega o formulário **e** a extração assistida (T16), nesta ordem.

Meu argumento contra era de custo, e ele **caiu na medição**. Duas razões:

1. **A técnica mudou de patamar desde o LAEP (2023).** Extração estruturada deixou de
   exigir NER próprio: saída conforme esquema JSON é recurso nativo dos provedores desde
   2024, e a literatura registra que *"prompting ou ajuste leve unificam subtarefas como NER
   e extração de relação num único framework generativo"*
   ([Structured data extraction using LLM schemas](https://simonwillison.net/2025/Feb/28/llm-schemas/);
   [PARSE, 2025](https://arxiv.org/pdf/2510.08623)). Os 30 mil textos rotulados do Airbnb
   não são o custo de entrada hoje.
2. **A infraestrutura já roda neste backend.** `discord/llmAssist.ts` chama a API DeepSeek
   com esquema de extração, **normaliza o retorno via Zod** (o próprio arquivo documenta:
   *"payload externo = `unknown` até validar"*), remove cercas de markdown e cacheia por
   `model`. O que falta para o perfil é um esquema novo sobre um caminho já exercitado em
   produção — não uma capacidade nova.

**A trava permanece inteira, e é ela que importa:** a máquina **sugere, o mestre confirma,
nada trava**. É a regra do `Eve`/`APS` no Airbnb (o F1 de 75% é o motivo) e a regra já
escrita no código do parser daqui (*"aviso, não validação"*). Extração que grava direto
está fora de escopo, em qualquer implementação.

**Ordem:** formulário primeiro — sem ele não há onde confirmar nem corrigir a sugestão.

## 5. O que é conserto, não pergunta

Pelo critério do AGENTS.md (*"a correção é a mesma sob qualquer resposta do
mantenedor?"*), estes **não** vão ao grill como opção — entram como trabalho, seja qual
for a decisão de D1-D11. Alguns exigem aprovação da **ação** (§Autorização), não do
achado.

| # | o quê | onde pertence | por que é conserto |
|---|---|---|---|
| C1 | contradição `experience_years` 14 × bio "11 anos" × exibido "10+" | `mesas` | dado com duas moradas; uma tem de mandar. O front não arredonda (`MestreHero` renderiza o valor cru + um `+` literal) — a divergência é de dado/fontes, não de formatação. **Não confundir com `years_on_platform`** (calculado de `created_at`): o código proíbe fundir os dois (spec 081, T9.1) |
| C2 | `selling_points` chegando como `{}` onde o tipo diz array | investigar antes | contrato violado; normalizar na fronteira é regra pétrea |
| C3 | indicador de autosave que rola para fora em página de 3,75 telas; e autosave sem o debounce de 500ms que o JSDoc promete (mutation dispara por `onChange`) | `mesas` (CSS local + hook) | Nielsen #1; sem alternativa defensável |
| C4 | `Manter link direto` com 16px | **`apps/mesas`** — 2 instâncias: `AvatarField.tsx:208-215` (16px via `ProfileEditPage.css:809-814`) e `ImageUploader.tsx:236-241` (`h-4 w-4`) | reprova WCAG 2.2 SC 2.5.8, nível AA |
| C5 | rodapé abaixo de 24px (`Ver termos` ≈20px + `.artificio-footer-nav-link` ≈17px) | **`packages/ui`** | idem — e atinge todos os apps |
| C5b | nav global com alvo <24px | **não confirmado no código** — `.artificio-nav-link` tem `min-height: 40px`; re-medição runtime pendente | não tratar como defeito do pacote antes de medir |
| C6 | `Anos de Experiência` (2 dígitos) com 802px de largura | campos são markup local do `mesas` (`ProfileEditPage.tsx`); o pacote tem controles de campo em 34/40/48px de `min-height` (`styles.css:989-1005`) que o editor não usa — **exceto `Textarea`**, cuja `.artificio-textarea` (`min-height: 112px`) é declarada depois e vence a escala | Baymard; mesmo defeito da 098 |
| C7 | alturas de campo `38/42/48/50` sem escala | idem | escala de espaço existe em `--space-1..4` + `--space-6` — **`--space-5` não existe** (`styles.css:62-66`) |
| C8 | vãos de seção `48/48/0/48/0/0` | `mesas` | proximidade invertida (098 §6.6) |
| C9 | `2 sistema(s) que você mestra` sem listar quais | `mesas` | Nielsen #6: reconhecer, não lembrar |
*(Não há C10. Ver §8 — a hipótese de código morto no `MestreFeaturedTable` foi medida e
é falsa.)*

**C4, C5, C6 e C7 são os mesmos defeitos que a 098 mediu no editor de anúncio.** Isso é
a evidência prática da regra pétrea. A auditoria de 2026-08-30 mediu a moradia real:
C4 e C6/C7 moram em código local do `mesas` (o checkbox não existe como primitivo no
pacote; os campos do editor são inputs locais) — a resposta pétrea continua sendo criar/
estender o primitivo no pacote **e** migrar o `mesas`, nunca "ajustar os N valores do
app" (A7). C5 (rodapé) mora no pacote; a nav (22px) não reproduz no CSS do pacote e
fica pendente de re-medição (C5b). **Decisão de escopo (2026-08-27):** a 099 leva estes
consertos (T11-T13), **independente da 098** — sem coordenação nem dependência entre as
duas specs. **Medido (2026-08-30), não mais inferência:** a 098 **cita** `Manter link
direto` na sua lista de alvos abaixo do piso
(`specs/098-mesas-usabilidade-editor/spec.md`). Logo, as duas specs tocam os mesmos
componentes (`AvatarField`, `ImageUploader`, `ProfileEditPage.css`).

**Consequência operacional:** T11 e a 098 **não devem ser executadas em paralelo** sem
combinar quem corrige o quê — se as duas criarem o primitivo de checkbox no pacote, o
trabalho colide. A ordem é decisão do mantenedor; o fato está medido.

---

## 6. Critérios de aceite (para quando houver implementação)

- **A1.** Nenhum campo que a página pública renderiza fica sem porta de entrada. Medida:
  para cada campo lido pelos componentes `mestre/*`, existe campo de formulário que o
  escreve — verificado por busca, não por suposição. **Cobertura fechada por D9:** todas as
  capacidades órfãs entram na fase B, inclusive `promo_badge_text` (T17) e `closed_group_*`
  (T18) — este critério é cumprível porque nada ficou de fora. Se alguma entrega for
  adiada, A1 passa a ser incumprível e a decisão de adiar precisa ser registrada aqui.
- **A2.** O que o mestre insere, o sistema expõe. Medida: a tabela de §2.5 sem linha
  "não aparece" e sem linha "editado em outra tela" não resolvida por D5.
- **A3.** A dobra contém pelo menos uma informação escrita pelo mestre. Medida por
  `getBoundingClientRect` contra a altura da viewport, em 1366×768 e 1920×1080.
- **A4.** Nenhum dado que o sistema apresenta como fato tem duas fontes divergentes
  (C1). Medida: os três números de experiência viram um.
- **A5.** Todo dado vindo de JSONB/API passa por normalizador tipado antes de entrar em
  props (C2), conforme AGENTS.md §Normalização obrigatória.
- **A6.** Nenhum alvo de clique abaixo de 24px na página pública nem no editor. **Inclui a
  associação de descrição:** todo campo com erro ou hint tem `aria-describedby` apontando
  para ele no controle — o `Field` de `packages/ui` gera o `id` mas **não emite o
  atributo**, então isso é trabalho do formulário, não herança do primitivo (medido na
  auditoria de `packages/ui`, 2026-08-30).
- **A7.** Cada correção **no nível em que impede a recorrência**, medido. Entrega do tipo
  "ajustei os N valores do `mesas`" reprova (AGENTS.md §Compartilhado por padrão).
  Concretamente, pelas moradias medidas na auditoria de 2026-08-30: C5 (rodapé) no
  pacote; C4/C6/C7 exigem primitivo no pacote (que hoje não existe para checkbox, e
  existe sem uso para campo) **e** migração do `mesas` — corrigir só o app reprova.
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
- **Citei `gmPanel.ts:211,377` como a tabela completa de escrita aceita, e estava
  errado** — a auditoria de 2026-08-30 mediu: POST e PUT de `/api/v1/gm/profile`
  aceitam os 5 campos + `promo_badge_text`; PATCH `/api/v1/profile/gm` e
  `/api/v1/profile/me/gm` aceitam `languages`/`specialties`. §2.3 corrigido.
- **Citei "debounce de 500ms" como comportamento medido sem ler o código** — o debounce
  só existe no JSDoc (`ProfileEditPage.tsx:19`); a mutation dispara por `onChange`.
  §2.6 corrigido.
- **Atribuí a nav global (22px) a `packages/ui` sem ler o CSS do pacote** — o pacote
  garante `min-height: 40px` em `.artificio-nav-link`. §2.8 corrigido; re-medição
  pendente.
- **Inferi "arredondado" para o `10+` de experiência** — o front renderiza o valor cru
  da API (`MestreHero.tsx:161`). §2.5 corrigido; a contradição de C1 é de dado, não de
  formatação.
- A auditoria de 2026-08-30 achou checkbox sem classe de dimensão no `AdminTable` de
  `packages/ui` (`admin/AdminTable.tsx:288,304` — as classes de tamanho estão no `th`/`td`,
  não no `input`, então vale o default do agente de usuário), usado em telas admin do
  `mesas` — fora do A6 (página pública + editor), registrado para não sumir; se entrar,
  exige aprovação de pacote. O valor "~13px" é **default de runtime, não medível na
  fonte** — precisaria de navegador para confirmar. Nota de import: `AdminTable` sai do
  subpath `@artificio/ui/admin`, **não** do índice raiz.
- Medi como **admin** (`viewer_context: {is_owner: false, is_admin: true}`), então vi a
  seção de Insights, que um visitante comum não vê. As outras 6 da tabela de §2.1 são
  públicas — e essa tabela é recorte do que apareceu naquela medição, não o inventário do
  componente, que monta 11 blocos (§2.1, nota sobre os 485px, e §2.5).
