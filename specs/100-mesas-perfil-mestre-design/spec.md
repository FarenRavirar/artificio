# 100 — Redesign das telas de mestre do mesas sobre a régua do design system

- **Módulo/Pacote:** `apps/mesas`, `packages/ui`, `packages/content-editor`
- **Gate relacionado:** nenhum
- **Origem:** o mantenedor avaliou o resultado da spec 099 em `mesasbeta` (2026-09-03) e reprovou o acabamento visual: "design feio, desorganizado, com letras ruins". Referência de destino dada por ele: Airbnb (3 capturas em `midias/airbnb_*.png` e `midias/pagina_perfil*.png`).
- **Depende de:** spec 092 (criou `--radius-*` e `--space-*` em `packages/ui`; frentes F e G seguem bloqueadas lá e **não** são resolvidas aqui).

## Problema

As três telas de mestre entregues pela spec 099 estão em beta e o acabamento visual não é aceitável. A investigação mediu que a causa não é falta de capricho tela a tela — é que **a régua existe, está declarada, e ninguém a obedece, a começar pelo próprio pacote que a define**.

### 1. O design system se contradiz

A spec 092 criou `--radius-sm`, `--radius-md` e `--radius-pill` em `packages/ui/src/styles.css:58-60`. Contagem no mesmo arquivo: **28 raios literais e 0 usos de `var(--radius-*)`** (11× `999px`, 8× `8px`, 4× `0.5rem`, e um de cada: `10px`, `1rem`, `50%`, `8px 8px 0 0`, `6px 6px 0 0`). O `@artificio/comments` — pacote irmão — consome esses tokens **13 vezes** e é o único lugar do repo com forma consistente.

Enquanto o pacote que define a régua não a segue, cada app tem licença para inventar a própria, e a próxima tela nasce torta sem que ninguém erre de propósito.

### 2. Desvios medidos em produção (beta)

Medições por `getComputedStyle` em `mesasbeta.artificiorpg.com`, 2026-09-03:

| Superfície | Tamanhos de fonte | Pesos | Raios | Observação |
|---|---|---|---|---|
| `/mestre/:slug` | **13** (10→48px) | **6** | **9** | 12,7 telas de rolagem; 9 seções em coluna única |
| `/perfil?tab=mestre` | **8** (11→20px) | **4** | **6** | 2 famílias renderizadas; **3 pilhas de Inter** divergentes na origem |

Referência do Airbnb, conferida em fontes públicas de tokens do DLS: 6 tamanhos, 3 pesos, 3 raios, 1 família.

### 3. A monoespaçada da bio vem do pacote, não do app

O campo "Bio Detalhada" — o texto mais importante do perfil — renderiza em `ui-monospace, SFMono-Regular, Consolas`. O campo **já consome o `ContentEditor` compartilhado corretamente**; a fonte é declarada em `packages/content-editor/src/content-editor.css:101`. Afeta **19 arquivos não-teste** do mesas usam o **editor** (`ContentEditor` ou o adaptador local `MarkdownEditor`) e são os afetados pela troca de fonte; somando quem só **renderiza** markdown (`MarkdownContent`), são 28. O número que importa para a Fase 0 é o primeiro — a família do `content-editor.css:101` governa a área de digitação, não a leitura. Versões anteriores desta spec disseram "6" e depois "28" sem declarar o critério, e nenhum dos dois reproduzia: `OnboardingPage`, `MestreContactForm`, `SessionRepeater`, `ScenarioSuggestionModal`, `SystemSuggestionModal`, `FeedbackModal`, `DevFeedbackPanel`, `DraftEditorTab`, `ReportTableButton`, as 5 partes do `table-editor`, e o adaptador `MarkdownEditor` que a bio consome. A primeira versão desta spec dizia "6 pontos de uso" — subcontagem. `MestreClosedGroupSection` **não** entra: usa `MarkdownContent` (renderizador), não `ContentEditor`.

### 4. Toda a superfície de mestre só existe no tema escuro

Os componentes escrevem cor no markup em vez de usar tokens. No tema claro isso é texto branco sobre fundo claro — defeito funcional, não preferência estética.

Extensão medida em `apps/mesas/frontend/src/components/mestre/**` mais `pages/PainelMestrePage.tsx`, em **12 arquivos**:

| padrão | ocorrências |
|---|---|
| `text-white` | **89** |
| `bg-white/N` ou `border-white/N` | **82** |
| `rounded-xl` ou `rounded-2xl` | **25** |

`PainelMestrePage.tsx` sozinho responde por 13 / 19 / 11 (o "7" de uma medição anterior contava só `rounded-2xl`, sem os 4 `rounded-xl`). `GmInsightsDashboard.tsx` tem **39** `text-white` e **27** `bg/border-white/`, mais que o painel inteiro. Corrigir só a página deixaria o defeito em pé nos componentes que ela e o perfil público renderizam.

### 5. Cor literal dentro do design system, e o token certo já existia

`packages/ui/src/GmReviewPanel.tsx` tem cor literal em **três lugares, não só na estrela**: `text-amber-300` nas linhas 68, 97 e 154 (estrela em `GmReviewSummary`, `GmReviewList` e `GmReviewForm`), `rounded-xl` na 88, e — o pior — `border-orange-500 bg-orange-500/20 text-orange-100` na linha 168, o **estado selecionado da tag** no formulário.

Esse último mede **1,07 de contraste no tema claro** (texto `#ffedd5` sobre `bg-orange-500/20` composto em branco): a tag selecionada é praticamente invisível. Hoje ninguém vê porque `GmReviewForm` não tem consumidor — mas D12 o leva para a tela pública de mestre, então a migração **importaria o defeito** se a task olhasse só a estrela. O app repete o mesmo em `MestreReviewsSection.tsx:107`. **A página pública não renderiza esse componente**: ela usa `MestreReviewsSection.tsx` do próprio app, que repete `text-amber-300` nas linhas 101 e 134. `GmReviewList` e `GmReviewForm` do pacote têm **zero consumidores** no monorepo — só `GmReviewSummary` é usado, em `TableCard.tsx:200` e `MasterCard.tsx:65`. Ou seja: o pacote tem a versão compartilhada e o app reimplementou a própria, com o mesmo defeito nas duas.

O contraste medido do que está em uso, sobre os fundos reais (`#FFFFFF` no claro, `#1B2A4A` no escuro):

| cor | claro | escuro |
|---|---|---|
| `text-amber-300` `#fcd34d` (atual) | **1,44** ✗ | 9,86 ✓ |
| `warning` `#F59E0B` | **2,15** ✗ | 6,62 ✓ |
| `warningText` `#854D0E` | 6,85 ✓ | **2,08** ✗ |

Nenhum valor fixo serve nos dois temas — a estrela hoje reprova AA no claro por larga margem. O token que resolve **já existe e já vira com o tema**: `--state-warning-fg` é `warningText` no claro (`styles.css:109`) e `#fcd34d` no escuro (`styles.css:187`) — exatamente os dois valores que passam em cada tema. Ninguém o consumiu na estrela.

`GmInsightsDashboard.tsx` repete o padrão com `text-rose-300`/`amber`/`cyan`/`emerald` nos quartis.

### 6. Espaçamento fora da escala

A escala `--space-1..6` do pacote é 4/8/12/16/24 — **exatamente a escala do Airbnb**. Os CSS das telas a contornam: **57** paddings/margens em `rem` literal em `MestrePage.css`, **12** em `MestreHero.css`, **10** em `ProfileEditPage.css`.

### 7. A estrutura das telas não corresponde ao problema que resolvem

- O perfil público abre como landing de marketing: hero centralizado de tela cheia, **até 14 blocos** renderizados conforme o dado disponível (9 títulos `<h2>` medidos na página real), três com emoji no título (emoji renderiza na fonte do SO e muda entre plataformas), cinco blocos de texto longo centralizados.
- Duas das nove seções (Insights, Recomendações) só o dono vê e pertencem ao `/painel`.
- O editor **já tem** navegação lateral e 5 seções (`ProfileEditorSidebar` + 15 usos de `ProfilePart`, entregues pela spec 099) — a estrutura existe. O que falta é a apresentação: dentro de cada seção os **19 campos** seguem empilhados como formulário. A referência que o mantenedor forneceu (`midias/pagina_perfil.png`) mostra lista de linhas com o valor atual ao lado, e edição em modal de um campo por vez. A mudança é de apresentação dentro das seções, não de arquitetura de navegação.

### 8. O que o mestre preenche não chega ao visitante (medido em 2026-09-05, produção)

Os sete problemas acima são de **régua visual**. Este é de outra natureza — e por isso vira as Fases 6 e 7 em vez de entrar nos requisitos numéricos: o mestre preenche campos que a página pública descarta, esconde ou nunca consulta. Levantado pelo mantenedor conferindo o próprio perfil em beta, medido contra `GET /api/v1/gm/perfis/farenravirar` e o código.

**8a — O topo corta sem dizer que corta.** `MestreHero.tsx:88-110` monta três grupos e aplica `.slice(0, 2)` em cada: especialidades, pontos fortes e idiomas. Com 4 especialidades gravadas, o mestre vê 2. `MestreHighlights.tsx` exibe todas mais abaixo, mas nada no topo sinaliza que há continuação — e resumo silencioso é indistinguível de dado perdido para quem preencheu.

**8b — Três categorias distintas num grid sem rótulo.** No mesmo hero, especialidade, ponto forte e idioma viram uma fileira contínua de chips, separados só por `variant` de cor. Foi o que fez "O Nome do Vento" (um **ponto forte**) parecer uma especialidade fora de lugar. Cor sozinha não é rótulo, e falha em daltonismo.

**8c — O hero decapita o destaque (ponto forte).** *Nota de terminologia, para não repetir a confusão que custou uma rodada: no produto, **destaque** = `selling_points` (tem `title` + `description`, os dois obrigatórios) e **selo** = `badges` (`TEXT[]`, string solta, sem descrição). O texto "Título e descrição são obrigatórios para salvar o destaque" (`GmProfileFields.tsx:341`) é do destaque.* `MestreHero.tsx:101-103` faz `.map(point => point.title)`. `isValidSellingPoint` (`profileEditorDomain.ts:47-49`) **exige** `description` preenchida para gravar; o topo mostra só o título. A descrição existe e é exibida em `MestreSellingPoints.tsx:29-30`, sob "O que eu ofereço" — mas quem olha o topo vê um campo obrigatório pela metade.

**8d — Os sistemas que o mestre mestra não saem do banco.** O campo existe (`ProfileEditPage.tsx:811-824`, "Sistemas que Mestra", `UserSystemsSelector type="gm"`) e grava na tabela `user_systems`. A rota pública `GET /gm/perfis/:slug` devolve 37 chaves e **nenhuma vem dessa tabela**. Grava e some da vista — o que lê como "não salva".

**8e — O catálogo de sistemas tem irmãos duplicados, e isso cega toda resolução.** `Dungeons & Dragons` tem **duas edições "5e"** (`8b1402c4` e `405ff13e`), cada uma com sua linhagem paralela de variantes — 2024 aparece nas duas, com nomes diferentes (`2024` e `Dungeons & Dragons 2024`). Mesmo padrão em `Vampire`/`Vampiro`.

A causa é `createSystemNode` (`systemSuggestionsAdmin.ts:259-298`): valida **só o tipo do pai**, e a única defesa contra duplicata é o `PATH_SLUG_CONFLICT` do catálogo central, que compara **slug**. `2024` e `Dungeons & Dragons 2024` geram slugs diferentes e passam como nós distintos.

**⚠ Correção de 2026-09-05 (revisão adversarial R2): isto é condição EXCLUSIVA DE BETA.** A medição dos dois ambientes (39 nós cada) mostra **produção limpa** — uma só edição "5e" sob D&D, um só nó `2024` (`c3d31503`, exatamente o `new_id` da migration 148). **A migration funcionou.** As duplicatas de beta nasceram depois, no ambiente onde se aprovam sugestões de teste. A narrativa de "seis tentativas frustradas" vale para o sintoma em beta, não para produção, e a guarda em `createSystemNode` é conserto **preventivo**, não bloqueio.

**Consequência medida em BETA:** o parser do draft de importação — o caminho que "funciona" — **também não resolve**. Rodando `parseDiscordAnnouncement` real contra o catálogo real de beta, `D&D 5e 2024` para em `Dungeons & Dragons(system)`, na raiz, sem descer à variante. Os candidatos mostram as duas "5e" empatadas em `0.49`, e `findSystemMatch:587` (`if (children[1]?.score === children[0].score) break;`) para no empate **de propósito** — guarda anti-ambiguidade.

**⚠ Não afirmar qual trava dispara sem instrumentar (R3).** Existe uma **segunda** guarda logo abaixo, `parseDiscordAnnouncement.ts:589-593` (`duplicatedAtDeeperLevel`), que trata duplicação em nível mais profundo. A investigação leu só a primeira e atribuiu o sintoma a ela. Pode ser 587, pode ser 593, podem ser as duas em sequência — **medir antes de mexer no scoring**.

**E "nenhum algoritmo pode acertar" é falso como afirmação de engenharia.** Com `path_slug` distinto e nomes distintos (`2024` vs `Dungeons & Dragons 2024`), **há** informação suficiente para desempatar; o algoritmo escolhe não usar. Isso é decisão de produto (preferir ambiguidade a chute), não impossibilidade — e é revisável.

No draft o dano fica invisível porque um humano revisa no `SystemPicker` antes de publicar. No perfil não há essa etapa. Enquanto existirem duas "5e" irmãs, **nenhum algoritmo pode acertar, porque não há resposta certa** — e é por isso que atacar a resolução (migration 148 inclusive, que remapeia UUIDs que nem existem mais no catálogo atual) nunca resolveu.

**8f — O campo de imagem devolve a URL crua ao mestre.** O placeholder intuitivo chegou a produção (medido: o bundle que beta serve tem 2 ocorrências de "Cole aqui um link direto" e zero do texto antigo; `dev` == `main` == `0c8531b`). Mas placeholder só aparece em campo vazio: depois do upload, o mestre encara a URL do Cloudinary como texto editável. A correção anterior tratou metade do caso.

**8g — Conceito visual do editor.** Os blocos de atributos da bio não se leem como editáveis, e o campo de slogan não comunica o destaque que ele tem no perfil publicado. Levantado pelo mantenedor como problema de **forma**, não de texto: acrescentar legenda explicativa é a correção errada. O mantenedor foi explícito quanto ao alcance: *"os conceitos visuais de TUDO que to te reportando não estão legais"* — vale para todo item deste §8, não só para os blocos de atributo.

**8h — Uma seção do editor sem hierarquia nenhuma (medido).** `ProfileEditPage.tsx:789-809`, o `ProfilePart id="como"`, empilha **quatro coisas de natureza diferente sem um único subtítulo entre elas**:

| linha | bloco | natureza |
|---|---|---|
| 792 | `BioLongField` | campo de texto livre |
| dentro de 792 | `BioAttributeSuggestions` (`GmProfileFields.tsx:657`) | **ferramenta de IA** — botão "Sugerir atributos da bio", cartões de candidato com evidência e % de confiança |
| 799 | `ProfileTagsSection` | Especialidades, Idiomas, Selos |
| 808 | `SellingPointsEditor` | pontos fortes |

O contraste é interno à própria página: o `ProfilePart id="mesa"` usa `<h3 className="profile-part-subtitle">` em cada bloco (linhas 812, 860). O `id="como"` **não usa nenhum**. Daí a leitura de sopa contínua que o mantenedor descreveu, com "Recomendado — …" repetido três vezes sem nada que ancore a qual campo pertence.

Medição da tipografia, para separar o que é problema do que não é: o bloco de sugestões usa **só tokens** (`--text-label`, `--text-support`) e a escala do editor inteiro tem **2 tamanhos**, dentro da régua. **O defeito não é a fonte — é a ausência de hierarquia estrutural.** Registrado porque a queixa original citou "as fontes de Sugerir atributos da bio", e medir mostrou que a causa é outra.

**8h-bis — A medição das cinco partes (2026-09-05).** `id="como"` foi onde a queixa caiu, mas a varredura das outras quatro mostra que o defeito é da página, não daquela seção:

| parte | linha | blocos | subtítulos | veredito |
|---|---|---|---|---|
| `quem` | 726 | 4 — avatar, banner, **slogan**, anos de experiência | **0** | 4 sem âncora |
| `como` | 789 | 4 — bio, ferramenta de IA, tags, pontos fortes | **0** | 4 sem âncora |
| `mesa` | 811 | 3 — sistemas, grupo fechado, onde mestra | 2 (812, 860) | grupo fechado sem âncora |
| `prova` | 896 | 1 — faixa promocional | 0 | ok (bloco único) |
| `onde` | 904 | 1 — `LinksManager` | 0 | ok (bloco único) |

**9 dos 13 blocos não têm subtítulo.** `prova` e `onde` estão corretos por terem um bloco só — subtítulo ali seria redundante com o `<h2>` que `ProfilePart` já emite (`ProfileEditPage.tsx:945`).

**Isto explica o item do slogan (§8g) por medição, não por impressão.** `TaglineField` está em `ProfileEditPage.tsx:782`, entre o banner e "anos de experiência", sem nenhuma âncora — enquanto o comentário do próprio código (linha 780) registra que o slogan "encabeça as três cadeias (hero/OG/SEO)". É o campo de maior alcance da parte, com a menor hierarquia da página. A correção de §8g e a de §8h são a mesma correção.

**8i — A ferramenta de IA não se distingue do formulário.** `BioAttributeSuggestions` renderiza botão, uma frase de garantia ("A análise apenas sugere. Nada é alterado até você confirmar cada item.") e cartões com trecho da bio e % de confiança — tudo no mesmo fluxo visual dos campos que o mestre preenche à mão, dentro do campo de bio. Sugestão de máquina e conteúdo autoral do mestre ficam indistinguíveis.

## Decisões do mantenedor (2026-09-03)

Todas levantadas e respondidas antes desta spec ser escrita.

| # | Decisão | Escolha |
|---|---|---|
| D1 | Editor de perfil | **Híbrido**: campos curtos (slogan, especialidades, idiomas, anos de experiência) viram linha + modal; bio e imagens seguem inline |
| D2 | Salvamento no modal | **Botão "Salvar" explícito**, como o Airbnb — fechar no X descarta |
| D3 | Contato no perfil público | **Coluna única**, sem trilho fixo à direita |
| D4 | Insights e Recomendações | **Saem do perfil público.** Revisto em 2026-09-03 após medição: o painel já exibe `views`/`contacts`/`clicks`, então a "fusão" é renderizar `favorites` (já no payload) + migrar `needsAttention` + **reorganizar o bloco de insights do painel** aproveitando o que os componentes do perfil faziam melhor (cards por mesa, severidade) |
| D5 | Hero do perfil público | **Ficha alinhada à esquerda**, não landing centralizada |
| D5a | Agrupamento de seções | **3 grupos + hero + CTA.** Revisto em 2026-09-03: removidos Insights e Recomendações restam **11 blocos**, e o hero (~320px de 10.152) sozinho não leva 12,7 telas a 5 — o alvo não tinha lastro. Grupos: **Sobre** (Bio+Highlights+SellingPoints+VttPlatforms), **Mesas** (Tables+Reviews), **Contato** (ContactMethods+ContactForm+Links+ClosedGroup) |
| D6 | Laranja de marca | **Só em ação** — botão primário, link, foco. Fora de título, número, borda e sombra. Os 4 tokens de `index.css` (`--border-orange`, `--border-orange-soft`, `--shadow-glow-orange`, `--shadow-glow-orange-strong`) e a classe `.orange-glow` **são apagados**; **3 dos 4 têm zero consumidores**; `--border-orange-soft` é usado por 2 arquivos do admin, que migram para `color-mix` (detalhe em D17) |
| D7 | Alcance de D6 | **Telas de mestre + catálogo** (inclui `TableCard`, que o público vê). Revisto em 2026-09-03 após medição: o laranja está em **59 arquivos** do app; a decisão original de "todo o app" foi tomada sem esse número. Onboarding, login, discord-sync e admin ficam fora |
| D8 | Tom visual | **Sobriedade do design system** — sem gesto temático de RPG na moldura |
| D9 | Pacotes compartilhados | **Autorizado** mexer em `packages/ui` e `packages/content-editor` |
| D10 | Entrega | **Uma PR por fase** (às vezes duas, conforme o volume de arquivos — o mantenedor decide por fase). Revisto em 2026-09-03: a versão anterior dizia "uma PR só", o que tornava impossível o gate de medição em beta por fase (achado C7) |
| D11 | Relação com a spec 092 | Spec nova; 092 citada como dependência. Frentes F e G da 092 **não** entram aqui |
| D12 | `GmReviewList`/`GmReviewForm` sem consumidor | **O app passa a consumir o pacote.** O compartilhado existe para não haver divergência entre os sites; `MestreReviewsSection` deixa de reimplementar markup próprio |
| D13 | Cor da estrela de avaliação | **Consumir `--state-warning-fg`**, que já vira com o tema e é o único caminho que passa AA nos dois (medição em §5) |
| D20 | Grupo de seção vazio no perfil | **O grupo aparece só com o que está preenchido; some inteiro se nenhum filho renderizar.** Medido: os 4 componentes do grupo Sobre retornam `null` quando vazios, então um mestre novo produziria título órfão com corpo vazio |
| D21 | Linha de campo vazio no editor | **"Adicionar"** — convite à ação, como a referência. Substitui a função da barra "43% preenchido" que T4.5 remove: o que falta fica visível item a item |
| D18 | Alvo de rolagem do perfil | **"O mínimo sem perda de conteúdo", com ~5 telas como referência, não teto.** O requisito 11a proíbe perder conteúdo, então o alvo é direcional: T3.6 exige o número medido e a justificativa se ficar acima de 5 |
| D19 | Cor das barras de `click_breakdown` | **Corrigir os tokens semânticos existentes e usá-los.** Medido: hoje `warning`×`info` têm contraste **1,00** entre si (luminância idêntica) e `success`×`warning` 1,18 — como série de dados adjacente são indistinguíveis em P&B e para daltônicos. Corrigir significa dar a eles luminâncias separadas (≥3:1 entre si) sem quebrar o contraste de cada um contra o fundo |
| D17 | Conflito D6 × D7 nos tokens laranja | **Apagar os 3 órfãos; admin migra para `color-mix`.** Medido: `--border-orange` e as 2 sombras `glow` têm **zero** consumidores — apagá-los não regride nada. Só `--border-orange-soft` é usado (`AdminTable:232`, `StatusPill:8`), e D7 protege o admin; nesses 2 arquivos ele vira `color-mix(in srgb, var(--color-artificio-orange) 20%, transparent)` — que é o padrão que **as próprias linhas já usam** para o fundo. Aparência preservada, token zerado |
| D15 | Markdown nas avaliações | **Sobe para o pacote.** O app escreve e renderiza avaliações em markdown (`MarkdownEditor` + `MarkdownContent`); o pacote usa `Textarea` e texto puro (zero markdown). Consumir o pacote como está apagaria markdown já publicado — então `GmReviewForm`/`GmReviewList` ganham `ContentEditor`/`MarkdownContent` |
| D16 | Limite de 2000 caracteres na avaliação | **Avisar sem bloquear** (padrão Twitter). Nem o app (bloqueia o botão) nem o pacote (trunca em silêncio): o contador mostra quanto passou e o envio segue permitido. `contentCountLabel` do `content-editor` já produz a frase "N caracteres acima do limite" |
| D14 | Destino de `MestreInsightsSection` / `MestreRecommendationsSection` | **Reaproveitar sem duplicar, não apagar.** Custaram token e aprendizado; o que neles é único migra ao painel, o que duplica o `GmInsightsDashboard` é absorvido por ele |

## Decisões do mantenedor (2026-09-05, Fases 6/7)

- **D25 — Sistema é a PRIMEIRA pergunta do jogador.** A ordem em que o jogador decide é: **que sistema se joga → qual VTT → qual plataforma de comunicação**. O perfil ganha campo próprio de sistemas, posicionado **acima ou ao lado dos VTTs**, seguindo essa ordem. Não se deriva das mesas publicadas: um mestre mestra sistemas que não estão anunciados no momento, e a resposta não pode depender de haver mesa ativa.
- **D26 — Os resumos têm de aparecer.** Idioma, estilo/especialidade, ponto forte e selos são exibição obrigatória no perfil, não conteúdo opcional a esconder atrás de corte. Isto encerra a pergunta de F6.1e: **ponto forte fica**, e o que muda é a forma de apresentá-lo, não a presença.
- **D27 — A descrição do DESTAQUE (`selling_points`) aparece como texto visível e persistente; clicar leva à seção.** Resolvida em 2026-09-05 com o mantenedor: o campo é o **destaque/ponto forte**, não o selo — o texto "Título e descrição são obrigatórios para salvar o destaque" é do `SellingPointsEditor` (`GmProfileFields.tsx:341`), e `badges` segue sendo `TagInput` de string sem descrição. **Nenhuma migration é necessária.**
  **Tooltip está descartado, e popover também** (pesquisa em `plan.md` §D-H): tooltip esconde por padrão e não existe em toque, e o Primer é explícito — *"never be used to convey critical information"*. Como **D26** classificou os destaques como exibição obrigatória, a descrição é informação **essencial**, e essencial não fica atrás de gesto. Popover resolveria acessibilidade mas continuaria escondendo — contradiz D26 igual.
- **D28 — Indicador de continuação é clicável.** O corte no topo pode ficar, mas o indicador navega até a seção, não é rótulo morto.
- **D29 — O topo não esconde o que a seção exibe.** Vale para os **quatro** grupos de D26 (idioma, especialidade, destaque, selo), não só para selo: o resumo do topo resume — não substitui — e tudo que ele omite tem de estar alcançável a partir dele.
- **D30 — REVOGADA em 2026-09-05. A ordem passa a ser: produção primeiro.** A regra "guarda antes de limpeza" foi decidida sobre a premissa de que o catálogo de produção estava corrompido, e a medição mostrou que **não está** (a migration 148 funcionou; as duplicatas são só de beta). Ordem nova, decidida pelo mantenedor: **1)** F6.3c — a rota pública não lê `user_systems`, único defeito medido em produção que apaga dado do mestre; **2)** hero e destaques; **3)** guarda em `createSystemNode`, conserto de fonte preventivo; **4)** consolidação das duplicatas de beta. O `plan.md` fazia o trabalho de produção esperar pelo de beta.
- **D31 — O grupo fechado sai da sequência de decisão.** No editor, `ClosedGroupSection` (`ProfileEditPage.tsx:830`) está **entre** sistemas e VTT, quebrando a ordem de D25. Move-se para **depois** de VTT/comunicação: sistema → VTT → comunicação ficam juntos e na ordem em que o jogador decide; preço/grupo fechado vem em seguida, como detalhe comercial.
- **D32 — Rótulo de categoria no hero é obrigatório, não incremental.** Medido (`plan.md` §D-I): os três `variant` do `Badge` têm contraste **1,01:1** entre `info` e `brand` (idioma × ponto forte) e ~1,25:1 nos outros pares — cor **não** distingue os grupos hoje, nem para quem enxerga bem. O rótulo é o único separador que existiria. Consolidar duplicatas antes de impedir a criação de novas é a sétima tentativa. `createSystemNode` ganha a guarda primeiro.

## Requisitos

### Régua (pacotes)

1. `packages/ui/src/styles.css` não contém raio literal de valor único: as ocorrências usam `var(--radius-*)`. Falta um degrau de cartão (12px) — criar como `--radius-lg`. As formas que não são raio uniforme (`50%`, `8px 8px 0 0`, `6px 6px 0 0`) permanecem literais por não serem degrau de escala, e o motivo fica em comentário na linha.
2. `packages/content-editor/src/content-editor.css:101` usa a família de corpo do design system, não monoespaçada.
3. `packages/ui/src/GmReviewPanel.tsx` não contém **nenhuma** cor literal de acento (`amber-`, `orange-`) nem raio fora da escala: a estrela usa `--state-warning-fg` (D13), `rounded-xl` vira `--radius-lg`, e o estado selecionado da tag (linha 168) usa token semântico — hoje mede 1,07 de contraste no claro.
3a. O estado selecionado da tag de avaliação mede ≥ 4,5:1 nos dois temas, no pacote e no app.
3b. Os tokens semânticos (`success`, `warning`, `danger`, `info`) medem ≥ 3:1 **entre si**, para servirem como série de dados adjacente (D19). Hoje `warning`×`info` mede 1,00 e `success`×`warning` 1,18 — barras vizinhas do `click_breakdown` seriam indistinguíveis em P&B e para daltônicos. O contraste de cada um contra o fundo não regride.
4. Nenhum consumidor de `packages/ui` ou `packages/content-editor` regride: os apps que os importam continuam renderizando corretamente nos dois temas.

### Régua (telas do mesas)

5. As três telas de mestre usam no máximo **6 tamanhos de fonte, 3 pesos e 3 raios**, todos vindos de token.
6. Uma única família de fonte por tela; rótulos de campo com um único tamanho.
7. Zero padding/margem em `rem` literal nos três CSS: tudo em `--space-*` (ou 32/48/64 para respiro entre seções).
8. Uma única declaração de sombra, aplicada apenas a elemento que flutua (modal, dropdown, barra fixa). Cartão separa-se por filete de 1px.
9. Nenhum dos 12 arquivos de `components/mestre/**` e `pages/PainelMestrePage.tsx` contém `text-white`, `bg-white/N`, `border-white/N`, `rounded-xl` ou `rounded-2xl`; as três telas renderizam corretamente nos temas claro e escuro. **`GmInsightsDashboard.tsx` está entre eles e é o maior caso** (39 `text-white`, 27 `bg/border-white/`, 15 raios): o `/painel` o renderiza na linha 649, então sem ele o tema claro do painel continua quebrado mesmo com a busca do aceite zerada nos demais arquivos.
10. Nas telas de mestre e no catálogo (incluindo `TableCard`), o laranja de marca aparece apenas em botão primário, link e anel de foco (D6/D7).
10c. Os 4 tokens laranja de borda/sombra do `apps/mesas/frontend/src/index.css` (linhas 48-49, 74-75) e a classe `.orange-glow` (linha 128) não existem mais (D6). Medido: 3 deles **não têm consumidor algum**; `--border-orange-soft` é usado por `AdminTable.tsx:232` e `StatusPill.tsx:8`, que passam a `color-mix` sobre `--color-artificio-orange` — o admin **mantém** a aparência laranja, como D7 exige (D17).
10a. `MestreReviewsSection.tsx` consome `GmReviewList`/`GmReviewForm` do pacote em vez de markup próprio, e nenhum `text-amber-300` sobra no app (D12/D13). A migração **preserva**, sem exceção:
    - o gate de autenticação e o botão "Entre para avaliar este mestre" (`startSsoLogin`) — o pacote documenta que o guard é do consumidor (`GmReviewPanel.tsx:123`), então trocar só o markup exporia o formulário a deslogado;
    - o fluxo de envio: `authPost('/api/v1/gm/perfis/:slug/reviews')`, toast e refetch da lista;
    - `fetchReviews`/`normalizeReviews` e o estado de carregamento;
    - **markdown** na escrita e na leitura (D15).
10d. O contador de caracteres da avaliação avisa o excedente sem impedir o envio, e nada é truncado em silêncio (D16).
10b. A estrela de avaliação mede ≥ 4,5:1 de contraste nos dois temas, verificado por cálculo sobre os fundos reais (`#FFFFFF` e `#1B2A4A`).

### Estrutura

11. O hero do perfil público é uma faixa de identificação alinhada à esquerda com foto, nome, selos e números de confiança — sem tela cheia e sem centralização (D5).
11a. O corpo do perfil público tem **3 grupos** de seção — Sobre, Mesas, Contato — mais hero e CTA final, no lugar dos 11 blocos que restariam (D5a). Nenhum conteúdo é perdido no agrupamento; o que muda é como se agrega, não o que se mostra.
11b. Grupo renderiza **apenas os filhos preenchidos**, e não renderiza — título incluído — quando nenhum filho renderiza (D20). Medido: `MestreBio`, `MestreHighlights`, `MestreSellingPoints` e `MestreVttPlatforms` retornam `null` quando vazios, e os quatro formam o grupo Sobre.
12. As seções `Insights` e `Recomendações` não existem no perfil público (D4). O que elas têm de único migra ao `/painel` sem duplicar o que ele já mostra (D14) — medido:
    - `favorites`: o painel **recebe e não renderiza** (`gmPanel.ts:2112`, `useGmInsights.ts:9`) → passa a renderizar.
    - `needsAttention` (heurística "10+ views, 0 contatos", `MestreInsightsSection.tsx`): o painel **não tem** → migra.
    - `views`, `contacts`, `clicks`: o painel **já exibe** (`GmInsightsDashboard.tsx:72`, `:177`) → não se toca, sob pena de criar segundo card.
    - O bloco de insights do painel é **reorganizado** aproveitando o que os componentes do perfil faziam melhor — cards por mesa e tratamento de severidade (D4 revisto).
    - Recomendações: o painel **já tem as suas** (`GmInsightsDashboard.tsx:321-353`), de rota diferente (`/api/v1/gm/insights` contra `/api/v1/gm/perfis/:slug/insights`). O tratamento de severidade de `MestreRecommendationsSection` (`SEVERITY_META`, alto/médio/baixo) é o que ele tem de melhor → absorvido pelo bloco do painel, sem segundo bloco.
13. Nenhum título de seção do perfil público contém emoji — **incluindo o `MestreFinalCta`**, cujo `<h2>` monta `{ctaData.emoji} {título}` com quatro variantes (📋🔥⚡✨, linhas 27/36/45/54). Sem ele o critério não fecha, e a primeira versão da task listava só os outros três componentes.
14. Bloco de texto longo do perfil público é alinhado à esquerda, não centralizado.
15. No editor, os campos curtos (slogan, especialidades, idiomas, anos de experiência) são apresentados como lista de linhas exibindo o valor atual, e editados em modal (D1).
15a. Linha sem valor exibe **"Adicionar"** no lugar do valor (D21).
16. O modal de edição tem botão "Salvar" explícito; fechar sem salvar descarta a alteração (D2).
17. A navegação lateral por seções do editor é preservada, passando a agrupar linhas.
18. O contato do perfil público permanece no fluxo em coluna única (D3).

## Critérios de aceite

- `getComputedStyle` nas três telas em beta devolve no máximo 6 tamanhos, 3 pesos, 3 raios e 1 família de fonte por tela (requisitos 5 e 6).
- Busca por raio literal de **valor único** em `packages/ui/src/styles.css` devolve zero — `rtk rg -E "border-radius: *(0\.[0-9]+rem|[0-9]+px|[0-9]+rem) *;"`, que casa `8px;` e `1rem;` mas **não** as 3 formas autorizadas a permanecer (`50%`, `8px 8px 0 0`, `6px 6px 0 0`), preservadas pelo próprio requisito 1. O comando anterior casava as três e reprovaria uma implementação 100% conforme.
- Busca por `text-white|bg-white/|border-white/|rounded-xl|rounded-2xl` em `components/mestre/**` e `PainelMestrePage.tsx` devolve zero, contra 89/82/25 de origem (requisito 9).
- Busca por `rem` em declaração de padding/margin nos três CSS do mesas devolve zero (requisito 7).
- O `/painel` e as três telas renderizam corretamente nos temas claro e escuro, conferido nos dois (requisito 9).
- `rtk pnpm run test`, `rtk pnpm run lint` e `rtk pnpm run build` verdes no repo, rodados um de cada vez ao final.
- Conferência visual do mantenedor em beta nas três telas antes do merge.

## Fora de escopo

- Frentes **F** (tokens semânticos redefinidos por app) e **G** (Tailwind fora do `packages/comments`) da spec 092 — seguem bloqueadas lá, aguardando decisão do mantenedor (D11).
- Cards de mesa do perfil público: medidos como já corretos (foto sangrando, filete de 1px, metadados compactos). Servem de âncora, não são alterados.
- Backend, schema, rotas de API e qualquer contrato público.
- Demais apps do monorepo (`site`, `links`, `glossario`, `accounts`, `downloads`) — só são tocados indiretamente pela correção dos pacotes, e apenas para garantir não-regressão (requisito 4).
- Achados laterais registrados na spec 092 §I (retry do `downloads`, `/catalogo` exigindo login).

## Riscos e impacto em outros módulos

**Alto — `packages/ui` e `packages/content-editor` servem todos os apps.** A correção dos raios e da família de fonte muda pixels em `site` (produção na raiz), `links`, `accounts` (SSO), `glossario`, `downloads` e `site-admin`. Mitigação: a mudança é de literal para token cujo valor é equivalente, então o delta visual esperado é nulo ou sub-pixel; ainda assim exige verificação de impacto nos consumidores antes do merge.

**Médio — D7 muda telas que o mantenedor não reclamou.** Medido: o laranja está em **59 arquivos** do app. Com o número na mesa, D7 foi restringido a telas de mestre + catálogo (incluindo `TableCard`), o que reduz o risco mas não o elimina: o catálogo é a vitrine do projeto e muda de aparência ao perder o laranja decorativo, os 4 tokens de borda/sombra e a classe `.orange-glow`. Onboarding, login, discord-sync e admin ficam com o laranja atual — inconsistência assumida, não esquecimento. Mitigação: conferência visual do mantenedor no catálogo antes do merge da Fase 2.

**Médio — D2 conflita com o autosave da spec 099.** O editor tem autosave com debounce de 500ms e indicador fixo "Salvando…/Salvo" (099 B8). Um modal com "Salvar" explícito precisa suspender o autosave enquanto aberto, ou o campo salva antes de o usuário confirmar e o X deixa de descartar. Resolvido no `plan.md`.

**Baixo — remoção de seção do perfil público.** Métricas `clicks` e `favorites` só existem hoje no perfil; se forem apagadas sem migrar ao painel, há perda de informação. Coberto pelo requisito 12.
