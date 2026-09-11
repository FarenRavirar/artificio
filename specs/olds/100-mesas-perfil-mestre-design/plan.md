# Plano — 100

## Objetivo — leia isto antes de qualquer correção

**Esta spec existe por um motivo só: o mantenedor olhou as telas de mestre em beta e reprovou o acabamento visual.** Tudo abaixo serve a isso. Achado técnico que não melhora o que se vê nessas telas não é escopo desta spec, por mais correto que seja.

O objetivo se verifica em duas frases, e nenhuma delas é sobre código:

> As três telas de mestre passam a parecer **uma coisa só, projetada de propósito**, com a densidade e a sobriedade da referência do Airbnb.
> O mantenedor abre `mesasbeta`, olha, e não reprova.

### Alvo numérico (é o que fecha a spec)

| medida | hoje | alvo |
|---|---|---|
| tamanhos de fonte por tela | 13 e 8 | **≤ 6** |
| pesos de fonte por tela | 6 e 4 | **≤ 3** |
| raios de borda por tela | 9 e 6 | **≤ 3** |
| famílias de fonte por tela | 2 | **1** |
| raios literais de valor único em `packages/ui` | 25 de 28 | **0** |
| famílias de corpo declaradas | 4 divergentes | **1** |
| contraste da estrela (pior tema) | **1,44** ✗ | **≥ 4,5** ✓ |
| contraste da tag selecionada (claro) | **1,07** ✗ | **≥ 4,5** ✓ |
| contraste entre tokens semânticos (pior par) | **1,00** ✗ | **≥ 3** ✓ |
| tokens laranja de borda/sombra no app | 4 + `.orange-glow` | **0** |
| rolagem do perfil público | 12,7 telas | **o mínimo sem perder conteúdo**, ~5 de referência (D18) — via hero compacto + densidade + agrupamento de 11 blocos em 3 (D5a). Não é teto: o requisito 11a proíbe perder conteúdo, e três grupos com o mesmo conteúdo comprimem até certo ponto. Acima de ~5, o gate exige a justificativa escrita, não reprova |
| tema claro do `/painel` | quebrado | **funciona** |

Se ao final o diff for grande e esses números não tiverem mudado, a spec falhou — mesmo que cada correção individual esteja certa.

### Quatro travas contra desvio

Escritas para a rodada adversarial que virá. Investigação adversarial acha muita coisa verdadeira; o risco não é errar a correção, é **acertar tantas correções laterais que o objetivo se perde no caminho**.

**T1 — Achado que não muda o que se vê nas três telas não entra nesta spec.** Ele é real, é corrigível, e o `AGENTS.md` manda consertar achado — mas consertar não significa consertar *aqui*. Bug funcional achado de passagem se corrige e se relata; refactor, débito estrutural e melhoria de arquitetura que não movem nenhuma linha da tabela acima ficam de fora, e o motivo se registra no relatório.

**T2 — Nenhuma decisão registrada se revisa por achado técnico.** As decisões D1–D21 foram fechadas pelo mantenedor em 2026-09-03. Se um achado sugerir que uma delas está errada, a saída é **parar e perguntar a ele**, nunca reinterpretar. Investigação adversarial produz argumentos convincentes; convencimento do agente não substitui decisão do mantenedor.

**T3 — Correção de achado não pode aumentar nenhum número da tabela.** Trocar cor literal por outra cor literal, acrescentar um raio "só desta vez", introduzir um sétimo tamanho de fonte para resolver um caso específico: cada um resolve um sintoma e reprova o objetivo. Se a correção certa exige quebrar a régua, é sinal de que a régua está incompleta — o conserto é o degrau novo no token, não a exceção local.

**T5 — A régua vale para o que renderiza, não para o arquivo.** Os alvos são medidos por `getComputedStyle` na tela; então classe utilitária no TSX conta igual a declaração no CSS. Foi assim que a primeira versão desta spec deixou passar **95** classes de tamanho e **41** raios nos componentes: as tasks olhavam só os três arquivos `.css`, e o gate teria reprovado com os CSS perfeitos. Ao mapear qualquer superfície, cobrir **CSS e classes Tailwind juntos**.

**T4 — Ao fim de cada fase, remedir a tabela antes de avançar.** Não "parece melhor": o número. É o que impede o desvio de acumular por três fases sem ninguém perceber, e é barato — as medições estão em `plan.md` §Validação, prontas para reexecutar.

### O que esta spec deliberadamente não faz

Registrado aqui porque é exatamente o que uma investigação adversarial vai propor, com razão, e que ainda assim não entra:

- **Frentes F e G da spec 092** — bloqueadas lá, aguardando o mantenedor (D11). São da mesma família de problema e continuam sendo dela.
- **Backend, schema, rotas** — `clicks` e `favorites` já existem em `InsightMetric`; muda onde aparecem, não de onde vêm.
- **Cards de mesa do perfil público** — medidos como já corretos. São a âncora visual, não o problema.
- **Refactor dos componentes de mestre** — `GmProfileFields` tem 682 linhas e a Fase 4 mexe nele, mas para mudar a apresentação dos campos curtos, não para reorganizá-lo.
- **Acessibilidade além do que a régua já entrega** — contraste e foco entram porque tokens os carregam; auditoria WCAG completa é outra spec.

---

## Arquitetura da solução

O trabalho vai da raiz para a superfície, em quatro camadas. A ordem não é preferência: enquanto o pacote se contradiz (28 raios literais contra 0 usos do token que ele mesmo declara), corrigir só as telas é enxugar gelo — a próxima tela nasce torta sem ninguém errar de propósito.

### Camada 1 — o pacote obedecer à própria régua

`packages/ui/src/styles.css` passa a consumir os tokens que declara nas linhas 58–60. A escala ganha o degrau que falta:

| token | valor | papel |
|---|---|---|
| `--radius-sm` | `0.375rem` (6px) | chip, badge, marcador |
| `--radius-md` | `0.5rem` (8px) | campo, botão |
| `--radius-lg` | `0.75rem` (12px) | **novo** — cartão, painel, foto |
| `--radius-pill` | `999px` | pílula, avatar |

**Antes de mapear, resolver a divergência interna do pacote.** Há duas fontes de verdade para raio: `tokens.ts:63-66` declara `sm: "4px"`, `md: "8px"`; `styles.css:58-60` declara `--radius-sm: 0.375rem` (6px), `--radius-md: 0.5rem` (8px). **Divergem 2px no `sm`**, e `check-token-parity.mjs` não cobre `radius` (só hexes e presença de vars semânticas) — por isso passou despercebido. A Fase 1 ancora a régua tipográfica em `tokens.ts` e a Fase 0 ancora raio em `styles.css`: sem alinhar, as duas fases trabalham contra fontes diferentes. **`styles.css` vence** (é o que renderiza hoje); `tokens.ts` é corrigido para `sm: "6px"` e ganha `lg: "12px"`, e a paridade passa a ser coberta.

Das 28 ocorrências, **25 são raio uniforme** e viram token. As **3 restantes não são degrau de escala** e permanecem literais, com o motivo em comentário: `50%` (círculo — é geometria, não raio), `8px 8px 0 0` e `6px 6px 0 0` (cantos superiores de aba/painel).

Delta por ocorrência, medido — não é "sub-pixel" como a primeira versão deste plano afirmou:

| literal | ocorrências | vira | delta |
|---|---|---|---|
| `999px` | 11 | `--radius-pill` | 0 |
| `8px` / `0.5rem` | 12 | `--radius-md` | 0 |
| `10px` | 1 | `--radius-lg` (12px) | +2px |
| `1rem` (16px, `.artificio-confirm-dialog`) | 1 | `--radius-lg` (12px) | **−4px** |

O caso de `1rem` é o único com delta visível a olho nu, e está num diálogo de confirmação. Registrado no commit, não escondido.

`packages/content-editor/src/content-editor.css:101` troca `ui-monospace, SFMono-Regular, Consolas, monospace` pela família de corpo do design system. É uma linha e atinge **19 arquivos não-teste** do mesas usam o **editor** (`ContentEditor` ou o adaptador local `MarkdownEditor`) e são os afetados pela troca de fonte; somando quem só **renderiza** markdown (`MarkdownContent`), são 28. O número que importa para a Fase 0 é o primeiro — a família do `content-editor.css:101` governa a área de digitação, não a leitura. Versões anteriores desta spec disseram "6" e depois "28" sem declarar o critério, e nenhum dos dois reproduzia, mais os demais apps consumidores.

`packages/ui/src/GmReviewPanel.tsx` perde `text-amber-300` e `rounded-xl`. A estrela passa a `var(--state-warning-fg)` (D13) — token que **já vira com o tema**: `warningText` `#854D0E` no claro (`styles.css:109`), `#fcd34d` no escuro (`styles.css:187`). Medido, é o único caminho que passa AA nos dois: valor fixo reprova sempre num deles (`amber-300` mede 1,44 no claro; `warningText` mede 2,08 no escuro).

**E o app passa a consumir o pacote (D12).** `MestreReviewsSection.tsx` reimplementa lista e formulário de avaliação em markup próprio, repetindo `text-amber-300` nas linhas 101 e 134, enquanto `GmReviewList` e `GmReviewForm` existem no pacote com **zero consumidores**. Isso é exatamente a divergência que o compartilhado existe para impedir: duas implementações do mesmo conceito, com o mesmo defeito, corrigidas em lugares diferentes. O app passa a renderizar os componentes do pacote.

**Por que isto é seguro apesar do blast radius:** a mudança é de literal para token cujo valor já é equivalente. O que muda de fato é *quem manda* — não o pixel. A exceção é a família de fonte da bio, que muda de verdade e é o efeito desejado.

### Camada 2 — régua tipográfica no pacote

Seis papéis sobre **cinco tamanhos distintos** (16px serve seção e corpo, distinguidos pelo peso), três pesos, expostos como utilitários no `packages/ui`, ancorados em `tokens.ts` e cruzados com a escala pública do Airbnb:

| papel | tamanho | peso | entrelinha |
|---|---|---|---|
| display | 28px | 600 | 1.2 |
| título | 20px | 600 | 1.25 |
| seção | 16px | 600 | 1.25 |
| corpo | 16px | 400 | 1.5 |
| apoio | 14px | 400 | 1.43 |
| rótulo | 13px | 500 | 1.3 |

Uma família de corpo só: a `sans`. Hoje há **quatro declarações divergentes** dela no repo — `tokens.ts:61` (`"Inter", ui-sans-serif, system-ui`), `styles.css:47` (`"Inter", "Segoe UI", Roboto…`), `tailwind-preset.js:40` (`Inter, ui-sans-serif, system-ui`) e `apps/mesas/frontend/src/index.css:93` (`'Inter', system-ui`). Unificar é escolher uma pilha e fazer as outras três derivarem dela.

**Oswald não é desvio.** `--artificio-font-display` / `fontFamily.display` é a face de títulos do design system, declarada em `tokens.ts:60` e `styles.css:46`, e usada nas classes `.artificio-*` de header e footer. A régua "1 família por tela" significa **uma família de corpo**, não uma família total: display + corpo é o par canônico do pacote (§Fundamentos de tipografia), e a medição de aceite conta famílias de corpo.

### Camada 3 — as telas do mesas na régua

Os três CSS (`MestrePage.css`, `MestreHero.css`, `ProfileEditPage.css`) trocam literal por token: 79 paddings/margens em `rem` viram `--space-*`; 15 declarações de `box-shadow` viram uma, aplicada só ao que flutua; cartão passa a separar-se por filete de 1px.

**A escala de espaço tem 5 degraus, não 6.** `styles.css:62-66` declara `--space-1/2/3/4/6` = 4/8/12/16/24px; **`--space-5` não existe** (`rtk rg "space-5" packages/ui/src` → zero), e a numeração salta. Os valores conferem com a escala do Airbnb, mas o respiro de seção que o plano previa (32/48/64) **não tem degrau nenhum**. Duas saídas, e a escolha é a segunda: completar a escala em vez de escrever literal nas telas — senão o requisito 7 ("zero rem literal") é impossível de cumprir para respiro entre seções.

**Correção aplicada na Fase 0 (2026-09-03):** a primeira versão deste plano pedia `--space-5: 2rem`, `--space-7: 3rem`, `--space-8: 4rem`. Isso quebra a convenção do próprio arquivo, medida antes de escrever: **o número do token é px/4** (1=4px, 2=8px, 3=12px, 4=16px, 6=24px, sem exceção — é a régua do Tailwind, que os apps já usam em `px-4`/`mt-6`). Com aqueles valores, `--space-5` valeria 32px e ficaria **maior que `--space-6`** (24px), e uma escala fora de ordem é pior que uma escala incompleta. Os degraus criados preservam os valores pedidos (32/48/64) com os nomes que a convenção exige:

| pedido no plano | criado | px |
|---|---|---|
| `--space-5: 2rem` | `--space-8: 2rem` | 32 |
| `--space-7: 3rem` | `--space-12: 3rem` | 48 |
| `--space-8: 4rem` | `--space-16: 4rem` | 64 |

Mais `--space-5: 1.25rem` (20px) e `--space-10: 2.5rem` (40px), que a convenção já implicava. Preencher a lacuna do `5` também remove a armadilha de numeração que fez a spec original escrever "`--space-1..6`" achando que eram seis.

Os **12 arquivos** de `components/mestre/**` mais `PainelMestrePage.tsx` trocam por tokens de tema os **89** `text-white`, **82** `bg-white/N`/`border-white/N` e **25** `rounded-xl`/`rounded-2xl`. Isso conserta o tema claro, que hoje está quebrado — é correção de defeito, não estética.

O painel é só a ponta (13/19/11); `GmInsightsDashboard.tsx` sozinho tem 39 `text-white`. Corrigir apenas a página deixaria o defeito nos componentes que ela e o perfil público renderizam, e o requisito 9 não fecharia.

O laranja recolhe-se a botão primário, link e anel de foco — **nas telas de mestre e no catálogo, incluindo `TableCard`** (D7 revisto). Título, número, borda e sombra passam a navy/cinza.

**Medido antes de decidir o alcance:** o laranja aparece em **59 arquivos** do app (`index.css` 16 ocorrências, `discord-sync` 26 em dois arquivos, `CatalogoPage` 7, `ScenarioSelector` 7, `OnboardingPage` 6, `TableCard` 6, `PlayerPage.css` 5…). A decisão original de "todo o app" foi tomada sem esse número; com ele, o mantenedor restringiu a mestre + catálogo. Onboarding, login, discord-sync e admin ficam fora e seguem com o laranja atual — inconsistência temporária assumida de propósito.

**Os 4 tokens de borda/sombra são apagados (D6):** `--border-orange`, `--border-orange-soft` (`index.css:48-49`), `--shadow-glow-orange`, `--shadow-glow-orange-strong` (`:74-75`) e a classe `.orange-glow` (`:128`). Oito arquivos os consomem e passam a borda neutra. Sem isso, "laranja fora de borda e sombra" não seria cumprível: as ocorrências sumiriam das telas mas os tokens continuariam disponíveis para a próxima.

### Camada 4 — estrutura das telas

**Perfil público** (`MestrePage.tsx`, `MestreHero.tsx` e os componentes de seção): o hero deixa de ser tela cheia centralizada e vira faixa de identificação alinhada à esquerda — foto, nome, selos e números de confiança em linha, no espírito do bloco "Conheça seu anfitrião" da referência. Emoji sai dos títulos de seção (renderiza na fonte do SO e muda entre plataformas). Os três não estão no `MestrePage.tsx`: vivem em `MestreContactMethods.tsx:232` (📬), `MestreContactForm.tsx:67` (✉️) e `MestreVttPlatforms.tsx:20` (🎮) — a edição é nos componentes. Texto longo deixa de ser centralizado. Contato permanece no fluxo, em coluna única (D3).

**O corpo passa de 11 blocos para 3 grupos (D5a).** Removidos Insights e Recomendações, restariam onze seções empilhadas — e o hero, com ~320px de 10.152, não levaria 12,7 telas a 5 sozinho. O alvo de rolagem só se sustenta com agrupamento:

| grupo | absorve | linhas de origem |
|---|---|---|
| **Sobre** | `MestreBio`, `MestreHighlights`, `MestreSellingPoints`, `MestreVttPlatforms` | 54 + 83 + 41 + 57 |
| **Mesas** | `MestreTablesSection`, `MestreReviewsSection` | 38 + 144 |
| **Contato** | `MestreContactMethods`, `MestreContactForm`, `LinksDisplay`, `MestreClosedGroupSection` | 241 + 155 + … + 87 |

Mais o hero e o `MestreFinalCta`. **Nenhum conteúdo é perdido** — muda como se agrega, não o que se mostra; é a diferença entre nove títulos de seção competindo por atenção e três âncoras que o leitor consegue mapear.

`MestreInsightsSection` e `MestreRecommendationsSection` saem da página. Medição da sobreposição com o painel:

| métrica | perfil (`InsightMetric`) | painel (`GmInsightsDashboard`) |
|---|---|---|
| `views` | sim | sim, + quartil + tendência 7d |
| `contacts` | sim | sim, + quartil |
| `clicks` | sim | **sim** — card "Cliques" (linha 72) e coluna por mesa (linha 177) |
| `favorites` | sim | **recebe e não renderiza** — `apps/mesas/backend/src/routes/gmPanel.ts:2110-2112` (backend) devolve `total_favorites`, `useGmInsights.ts:9` o declara, nenhum componente o exibe |

**Destino dos dois componentes (D14): reaproveitar, não apagar.** Medido o que cada um tem de único contra o `GmInsightsDashboard`:

| componente | tem de único | duplica |
|---|---|---|
| `MestreInsightsSection` | `favorites` renderizado; heurística `needsAttention` (10+ views, 0 contatos) — o painel não tem nenhuma das duas | `views`, `contacts`, `clicks` |
| `MestreRecommendationsSection` | `SEVERITY_META` (alto/médio/baixo com ícone e rótulo) | o painel já tem recomendações (`GmInsightsDashboard.tsx:321-353`), de **outra rota** |

As duas rotas são distintas: o painel lê `/api/v1/gm/insights`, o perfil lê `/api/v1/gm/perfis/:slug/insights`. Então não é mover componente de lugar — é **absorver o que é único** no bloco do painel e deixar cair o que já existe lá. O tratamento de severidade é o ativo real de `MestreRecommendationsSection` e migra; a lista em si não, porque criaria segundo bloco de recomendações.

**A primeira versão desta tabela estava errada em `clicks` e imprecisa em `favorites`.** Medido: o painel já é superset completo em `views`, `contacts` e `clicks`. O único campo que falta exibir é `favorites`, e ele **já chega ao frontend** — falta só renderizar.

Consequência para D4: a "fusão" de métrica é bem menor do que o plano supunha — há **um campo já disponível a renderizar** (`favorites`), não métricas a migrar, e o risco de perda de informação é **nulo**, não baixo.

Com a medição na mão, o mantenedor ampliou D4: além disso, **o bloco de insights do painel é reorganizado** aproveitando o que os componentes do perfil faziam melhor — cards por mesa (`MestreInsightsSection`) e tratamento de severidade (`SEVERITY_META`). Não é só remover do perfil e renderizar um campo: o painel fica melhor do que era antes de receber.

**Editor** (`GmProfileFields.tsx`): campos curtos — slogan, especialidades, idiomas, anos de experiência — viram linhas exibindo o valor atual, editadas em modal (D1). Bio e imagens seguem inline: markdown com prévia não cabe em modal pequeno, e o upload de imagem já tem fluxo próprio. A navegação lateral por seções é preservada, passando a agrupar linhas (requisito 17). A barra "43% preenchido" perde a razão de existir — o valor ao lado de cada linha já diz o que falta.

### O conflito D2 × autosave da spec 099

O editor tem autosave com debounce de 500ms cujo buffer vive em `ProfileContext` (`updateGm` acumula patch por campo em refs; `flushGmBuffer` descarrega). Um modal com "Salvar" explícito (D2) precisa que fechar no X **descarte** — e o autosave salvaria antes disso.

Solução: o modal **não chama `updateGm` enquanto aberto**. Mantém o valor em estado local; "Salvar" chama `updateGm` uma vez e então `flushGm()` — que é o nome **exposto** pelo contexto (`profileContextCore.ts:44`, assinatura `() => Promise<boolean>`); `flushGmBuffer` é interno ao provider (`ProfileContext.tsx:151`) e não está no contrato. Fechar sem salvar descarta o estado local sem tocar no buffer.

**O descarte precisa valer também para o cache.** `updateGm` faz optimistic update **no enqueue**, não no flush: `ProfileContext.tsx:205-217` chama `setQueryData(['profile','me'], …)` na hora, antes dos 500ms (foi assim de propósito — sem isso, duas tags digitadas rápido se sobrescreviam, achado de review da PR #297). Logo, qualquer chamada a `updateGm` com o modal aberto já pinta o cache, e fechar sem salvar deixaria o valor "descartado" visível na tela. É a razão técnica de o modal manter estado local e **só** chamar `updateGm` no Salvar — não é preferência de estilo.

**Descarte tem três vias, não uma.** O `Modal` do pacote (`primitives.tsx:333-396`) fecha por botão X, tecla ESC (`useEscapeClose`) e clique no backdrop (`onClick={onClose}`, linha 361). Todas caem no mesmo `onClose`, então o descarte é uniforme — mas o teste de T4.2 precisa cobrir as três, não só o X, senão ESC e backdrop viram caminho de perda de dado silenciosa.

O autosave segue intacto para os campos que permanecem inline (bio, imagens), que é onde ele foi desenhado para servir.

Isso preserva o trabalho da 099 em vez de desfazê-lo, e dá ao modal a semântica que a referência tem.

### Camada 5 — o dado do mestre chega ao visitante (Fases 6/7)

As camadas 1-4 tratam régua e estrutura. Esta trata **perda de informação**, e tem ordem própria porque uma parte dela é pré-requisito das outras.

**⚠ A ordem abaixo foi REVISADA em 2026-09-05 (D30 revogada).** A versão anterior punha a guarda de catálogo em primeiro lugar, sob a premissa de que o catálogo de **produção** estava corrompido. **A medição mostrou que não está:** produção tem uma só edição "5e" e um só nó `2024` (`c3d31503`, o `new_id` da migration 148 — ela funcionou). As duplicatas são **exclusivas de beta**. A ordem correta ataca primeiro o que apaga dado em produção:

1. **Leitura pública dos sistemas** — `GET /gm/perfis/:slug` passa a devolver o que está em `user_systems`, e a ficha do visitante exibe. **É o único defeito medido em produção que apaga dado do mestre**, é conserto local em `gm.ts`, não depende de nada e responde à queixa literal ("grava e some").
2. **Hero honesto e destaque não decapitado** — também produção, também visível ao jogador.
3. **Guarda contra irmão duplicado** — `createSystemNode` (`systemSuggestionsAdmin.ts:259-298`) passa a recusar nó cujo nome normalizado (sem acento/caixa, considerando aliases) já exista sob o mesmo pai. Hoje só o `path_slug` protege, e ele não vê `2024` e `Dungeons & Dragons 2024` como o mesmo. Conserto de fonte legítimo, mas **preventivo**: não bloqueia nada em produção hoje.
4. **Consolidação das duplicatas de BETA** — só depois do passo 3, usando produção como referência do estado correto. **Não exige SQL write em produção**, ao contrário do que a versão anterior deste plano assumia.
5. **Remedir o draft** — com o catálogo de beta consolidado, `D&D 5e 2024` deve descer até a variante. **Antes de concluir que o defeito é do scoring, instrumentar QUAL trava dispara:** há duas guardas anti-ambiguidade, `parseDiscordAnnouncement.ts:587` (empate de score) e `:589-593` (`duplicatedAtDeeperLevel`) — a investigação original leu só a primeira.
6. **Hero honesto** — indicador de continuação clicável (D28), rótulo de categoria obrigatório (D32, §8b) e o destaque deixando de ser decapitado no topo (§8c).
7. **Descrição do destaque como texto visível** (D27 — nunca tooltip nem popover, ver §D-H) e campo de imagem que não devolve URL crua (§8f).
8. **Conceito visual do editor** (§8g) — Fase 7, por último: é percepção, e não adianta refinar a forma de um campo cujo dado ainda se perde.

**O que esta camada aproveita do draft, e o que não.** Aproveita `_system_candidates`: guardar a lista pontuada inteira e deixar o humano escolher, em vez de gravar um vencedor arbitrário. **Não** aproveita a resolução automática — foi medida falhando no mesmo catálogo.

**Trava:** a Fase 7 obedece à mesma régua das camadas 1-4 (≤6 tamanhos, ≤3 pesos, tokens em vez de literais). Fase de percepção não autoriza escala nova.

### Pesquisa por demanda (2026-09-05) — o que a prática do mercado diz

Levantada a pedido do mantenedor, que pediu referência de produto com reputação em facilidade de uso, **não** genérico. Cada demanda tem a fonte e o que ela decide. Onde a fonte não confirmou um número que apareceu em busca, está dito.

---

**D-A · Corte silencioso no hero** (§8a) — *progressive disclosure*

O padrão tem nome e é do próprio Nielsen (1995): pôr no primeiro nível o que serve à maioria das tarefas e diferir o resto **para um segundo nível claramente rotulado**. A literatura registra ganho de 30-50% no tempo de primeira tarefa quando o diferimento é bem feito — e nomeia o modo de falha: **esconder o que o usuário precisa com frequência**.

O nosso caso está no modo de falha, com um agravante: não há *segundo nível rotulado*. O `.slice(0, 2)` corta sem link, sem "+2", sem nada. Não é progressive disclosure — é truncamento. **Decide F6.1c/F6.1f:** o indicador não é enfeite, é o que separa o padrão do defeito.

Fonte: [NN/g — Progressive Disclosure](https://www.nngroup.com/videos/progressive-disclosure/) · [UXPin (2026)](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/)

---

**D-B · Três categorias num grid sem rótulo** (§8b) — *trust signals com peso visual*

O Airbnb é a referência pedida, e o que ele faz é o oposto do nosso hero: sinal de confiança aparece **em cada momento de decisão**, com peso visual calibrado — a contagem de avaliações carrega peso equivalente ao do preço, deliberadamente, para dizer que a opinião da comunidade pesa tanto quanto o custo. Categorias distintas não se misturam num fluxo indiferenciado; cada uma tem seu lugar e seu peso.

**Decide F6.1d:** rótulo por categoria não é redundância, é o que permite o visitante atribuir peso ao que lê. Hoje especialidade, ponto forte e idioma chegam com o mesmo peso visual e sem fonte declarada.

Fonte: [Airbnb UX case study — trust in peer-to-peer](https://rockpaperscissors.studio/airbnb-ux-design-case-study-building-trust-in-peer-to-peer-travel/) · [Cornell Tech — hospitable language inspires trust](https://tech.cornell.edu/news/hospitable-language-inspires-trust-in-airbnb-customers/)

---

**D-C · Blocos que não se leem como editáveis** (§8g, §8h) — *inline edit affordance*

A descoberta de que um campo é editável é **problema documentado, não impressão**: sem indicação, o usuário não descobre que o campo abre ao clique — descobre por acidente ou porque alguém contou. Os dois padrões em uso na indústria:

| abordagem | quem usa | custo |
|---|---|---|
| ícone no hover | LinkedIn | invisível até passar o mouse — inútil em toque |
| ícone sempre visível | Tumblr | descobre sem hover, ao custo de ruído |

**O achado que decide o nosso caso** vem do teste do Fluid Project: **4 de 4 usuários não leram ou não entenderam a mensagem de instrução no topo da tela**. É evidência direta contra "resolver com legenda explicativa" — que é exatamente o que o mantenedor disse ("não estou falando de explicação"). A afordância tem de estar **na forma do campo**, não num texto ao lado.

Ressalva de honestidade: um número de "80% dos usuários percebem a editabilidade" apareceu na busca como critério de sucesso do Fluid, mas **não consegui confirmá-lo na fonte** (a página de resultados não abriu com o conteúdo). Não usar esse número como meta até verificar.

Fonte: [Fluid Project — Inline Edit User Testing Round 2](https://wiki.fluidproject.org/display/Infusion13/Simple+Text+Inline+Edit+User+Testing+-+Round+2) · [The Inline Edit Design Pattern — Andrew Coyle](https://medium.com/nextux/the-inline-edit-design-pattern-e6d46c933804) · [WebAppHuddle — inline edit design](https://webapphuddle.com/inline-edit-design/)

---

**D-D · Sugestão de IA indistinguível do formulário** (§8i) — *AI transparency*

O consenso 2025-2026 tem três regras, e nós violamos a primeira: **marcar visualmente o que é gerado por máquina**, com atribuição de origem, explicação em linguagem simples e medida de confiança. A Apple formalizou isso numa gramática visual própria (contorno shimmer + princípio de deferência + atribuição de fonte).

Duas travas que a literatura destaca, e que valem para nós:
- **Não é para ser teatral.** Sparkle e brilho em tudo é o erro comum; o padrão pede deferência, não decoração.
- **O risco real é o output confiante.** Quando a sugestão chega com a autoridade da interface, o usuário assume que está certa. Daí a exigência de dar visibilidade do *porquê* e caminho fácil de corrigir/descartar.

**A favor da nossa implementação:** `BioAttributeSuggestions` já mostra o trecho de evidência e o % de confiança — os dois itens que a literatura pede. **Contra:** não há marcação visual que o separe do formulário, e ele mora *dentro* do campo de bio. **Decide F7.6:** o conserto é a marcação e o isolamento, não acrescentar informação.

Fonte: [Designing for Apple Intelligence — AI UI patterns 2026](https://artofstyleframe.com/blog/designing-for-apple-intelligence-ui-2026/) · [Designing interfaces for AI products (2025)](https://www.parallelhq.com/blog/designing-interfaces-ai-products)

---

**D-E · URL crua no campo de imagem** (§8f) — *upload feedback*

Consenso direto: o retorno de um upload é **a miniatura**, não a string. A prévia serve para o usuário confirmar que subiu o arquivo certo, e a confirmação visual evita que ele reenvie por não saber se funcionou. Nenhuma fonte trata devolver a URL como aceitável — ela é detalhe de implementação vazando para a tela.

**Decide F6.4c:** prévia + trocar/remover, com a entrada por URL manual preservada para quem cola link.

Fonte: [Uploadcare — file uploader UX best practices](https://uploadcare.com/blog/file-uploader-ux-best-practices/) · [UX Patterns for Developers — image upload](https://uxpatterns.dev/patterns/media/image-upload)

---

**D-F · Catálogo com irmãos duplicados** (§8e) — *entity resolution*

O vocabulário certo para o nosso problema é **canonicalização**: converter representações múltiplas da mesma entidade numa forma única, com um *golden record* por entidade. `2024` e `Dungeons & Dragons 2024` são duas representações de uma entidade só, e o `path_slug` — que compara string, não identidade — nunca as reconheceria.

**O princípio, que continua valendo mesmo com D30 revogada:** resolver **no momento da escrita** impede o usuário de criar dado ruim; a alternativa é limpar depois, para sempre. É a diferença entre a guarda (F6.3d) e a sétima tentativa de limpeza.

Ressalva: a literatura de entity resolution trata de MDM em escala, com *blocking*, *matching* e *clustering*. **Nós não precisamos disso** — a nossa checagem é entre irmãos do mesmo pai, um conjunto de poucas dezenas. O que importa é o princípio (canonicalizar na escrita), não o maquinário.

Fonte: [Things Solver — deduplication & entity resolution](https://thingsolver.com/blog/data-deduplication-and-entity-resolution/) · [Modern Data — entity resolution at scale](https://www.moderndata101.com/blogs/entity-resolution-at-scale-deduplication-strategies-for-knowledge-graph-construction)

---

**D-G · Slogan sem peso** (§8g) — sem fonte externa nova

Não precisa: a medição interna já decide (`spec.md` §8h-bis). O campo de maior alcance da parte — hero, OG e SEO, pelo comentário do próprio código — é o de menor hierarquia da página. O princípio aplicável é o mesmo de D-B (peso visual proporcional à importância), e a correção é a mesma de F7.5d.

---

**D-H · Como exibir a descrição do destaque (2026-09-05)** — *pesquisa cobrada pelo mantenedor, que desconfiou de popover como resposta*

A desconfiança estava certa: **a pesquisa derruba tanto o tooltip quanto o popover como escolha primária.**

**O que a fonte de referência diz.** O Primer (design system do GitHub) dá três razões para evitar tooltip, e a primeira decide o nosso caso: *"Tooltips are hidden by default making it easy to miss, so they should never be used to convey critical information."* Some-se: são **inteiramente indisponíveis em toque** (touchscreen não tem hover), e em elemento não-interativo não alcançam teclado nem leitor de tela. A regra que eles fecham é dura: *"Only include tooltips on other components as a last resort"*, e nunca em `div`/`span`/`p`.

A literatura WCAG 2.1 converge: tooltip serve para **informação suplementar curta**; instrução, requisito, erro e qualquer coisa essencial vão em **texto visível e persistente**.

**Por que isto decide, e não é preferência.** **D26 já classificou** idioma, estilo, ponto forte e selos como **exibição obrigatória**. Logo a descrição do destaque é informação **essencial** — e essencial atrás de qualquer coisa que esconda por padrão é contradição interna da spec. Isso elimina:
- **tooltip** — esconde por padrão, morre em toque;
- **popover/disclosure** — continua escondendo por padrão. Resolve acessibilidade (um controle serve mouse, teclado e toque), **não resolve D26**;
- **tooltip no desktop + inline no mobile** — duas verdades sobre o mesmo dado, e o dobro de código.

**Decisão: texto visível e persistente.** A descrição do destaque aparece, sem gesto para revelá-la. Efeitos colaterais medidos, ambos favoráveis:
- **Zero primitivo novo.** `packages/ui` não tem `Tooltip` (verificado: zero ocorrências), e construir um acessível + touch-friendly exigiria aprovação de pacote compartilhado (`AGENTS.md` §Autorização) — trabalho que deixa de existir.
- **`MestreSellingPoints.tsx:29-30` já faz isso** (`<h3>{title}</h3><p>{description}</p>`). O defeito nunca foi a seção; foi o **hero** decapitar com `.map(p => p.title)` (`MestreHero.tsx:101-103`).

**O que continua valendo de D27/D28:** clicar no destaque leva à seção onde a descrição está. Isso não é o mecanismo de exibição — é navegação entre o resumo do topo e o conteúdo completo, e permanece.

Fonte: [Primer — Tooltip alternatives](https://primer.style/guides/accessibility/tooltip-alternatives) · [Primer — Accessibility: tooltip alternatives](https://primer.style/design/accessibility/tooltip-alternatives/) · [Sarah Higley — Tooltips in the time of WCAG 2.1](https://sarahmhigley.com/writing/tooltips-in-wcag-21/) · [Are Tooltips Accessible? WCAG tips](https://flook.co/blog/posts/are-tooltips-accessible)

---

**D-I · Cor não distingue os três grupos do hero — medido (2026-09-05)**

F6.1d supunha que o `variant` já separava as categorias e que faltava só rótulo. **A conta desmente.** Cores de texto dos três variants no tema escuro (`packages/ui/src/styles.css:314-319`), contraste WCAG 2.x entre si:

| par | contraste | leitura |
|---|---|---|
| `info` × `brand` (idioma × ponto forte) | **1,01:1** | praticamente a **mesma cor** |
| `warning` × `info` | 1,25:1 | indistinguíveis |
| `warning` × `brand` | 1,27:1 | indistinguíveis |

Luminâncias: `warning` 0,6782 · `info` 0,5323 · `brand` 0,5243. É o mesmo defeito que **D19** já registrou nesta spec para `warning`×`info` (`spec.md:151`, contraste 1,00) — agora medido também para o par `info`×`brand`, que é justamente **idioma contra ponto forte**.

**Consequência:** o rótulo de categoria (F6.1d) não é melhoria incremental sobre a cor — é o **único** separador que existiria. Hoje, em escala de cinza ou para quem tem daltonismo, os três grupos do hero são uma fileira homogênea de chips. Corrigir só a cor não resolve; o rótulo é obrigatório.

---

**As duas pendências desta pesquisa foram DECIDIDAS pelo mantenedor (2026-09-05), e uma delas corrige um erro meu:**

- **D26 — ponto forte fica** (fechou F6.1e). Idioma, estilo, ponto forte e selos são exibição obrigatória. A pergunta "ponto forte deve aparecer?" estava mal colocada: o que se decide é a **forma**, nunca a presença.
- **D25 — campo próprio de sistemas, acima ou ao lado dos VTTs** (fechou F6.3c). **A alternativa que ofereci — derivar dos sistemas das mesas publicadas — é ruim e está descartada.** Sistema é a **primeira** pergunta que o jogador faz (sistema → VTT → comunicação, nessa ordem); um mestre mestra sistemas que não estão anunciados no momento, e amarrar a resposta à existência de mesa ativa deixaria o perfil mudo exatamente quando não há mesa aberta.

Isto tem consequência sobre D-A: **o corte no hero não pode fazer nenhum dos quatro resumos desaparecer sem caminho de volta.** Progressive disclosure aqui significa segundo nível rotulado e alcançável (D22/D23), nunca omissão.

### Revisão adversarial do diff (2026-09-05) — o que ela derrubou

Rodada por agente independente, com verificação contra código, catálogo real dos dois ambientes, git e testes. **As citações `arquivo:linha` do diff foram checadas uma a uma e nenhuma é inventada** — o problema estava nas conclusões, não nas medições. Os itens abaixo já foram reconferidos e corrigidos aqui; os dois primeiros continuam abertos porque dependem do mantenedor.

**⚠ R1 — D27 (ex-D21) manda exibir tooltip de um campo que não existe.** O diff mede que `badges` é `TEXT[]` sem descrição (`migration_01_base_schema.sql:97`, editor `TagInput` puro em `GmProfileFields.tsx:246-261`) e registra a refutação em F6.2a — e na linha seguinte escreve "a descrição do selo passa a ser exibida em tooltip", com F6.2c mandando "preservar a descrição gravada". **Não há descrição gravada em `badges`. F6.2c é inexecutável contra o schema atual.**

Duas leituras possíveis, com custos muito diferentes:
- **"selo" = `selling_points`** (ponto forte): já tem `description` obrigatória (`profileEditorDomain.ts:47-49`) e já é exibida em `MestreSellingPoints.tsx:29-30`. Trabalho: apresentação.
- **"selo" = `badges`** de fato: exige **migration nova** (coluna de descrição) + editor + API + página. Nenhuma task cobre isso.

**Violação de `AGENTS.md` §Bug achado/débito**, que proíbe registrar "decisão do mantenedor" não dada: F6.2b foi escrita como "DECIDIDO pelo mantenedor: tooltip" sobre um campo que não existe — ou a fala dele foi mal transcrita, ou a decisão foi inferida. **Nenhuma task de F6.2 executa até ele dizer qual dos dois campos.**

**⚠ R2 — A causa raiz de F6.3 é condição SÓ DE BETA, e o diagnóstico foi escrito como se produção estivesse quebrada.** Medido nos dois ambientes (39 nós cada):

| ambiente | árvore D&D | duplicatas |
|---|---|---|
| **produção** | `D&D(36698ed7)` → **um** `5e(c324b0de)` → `2024(c3d31503)`, `2014`, `Next` | **nenhuma** |
| beta | `D&D(5092ddb4)` → `5e(405ff13e)` **e** `5e(8b1402c4)`, cada uma com seu `2024`; mais `Vampire` **e** `Vampiro` | 2 famílias |

`c3d31503` é o `new_id` da migration 148 — **ela funcionou em produção**. Consequências que derrubam texto já escrito:

- §8e afirma sem qualificação "o catálogo está corrompido na raiz". Verdade em beta, **falso em produção**.
- A medição 4 de F6.3 diz "nenhum dos dois UUIDs da migration 148 existe" — verdade em beta, falso em produção, onde `c3d31503` está servindo.
- **A narrativa de "~6 tentativas frustradas" e "sétima tentativa" desmonta:** a última tentativa funcionou onde importa. As duplicatas de beta nasceram depois, em ambiente onde se aprovam sugestões de teste.
- **D30 (ex-D24, "guarda antes de limpeza") perdeu a premissa.** A guarda continua sendo conserto legítimo de fonte, mas **não bloqueia nada em produção** — e a Camada 5 do `plan.md` hoje faz o trabalho de produção esperar pelo de beta. Pendente de decisão do mantenedor.

**R3 — "Nenhum algoritmo pode acertar" é falso; há uma segunda trava não lida.** O diff cita `parseDiscordAnnouncement.ts:587` (`if (children[1]?.score === children[0].score) break;`) e generaliza. Mas **as linhas 589-593 do mesmo arquivo têm uma SEGUNDA guarda** (`duplicatedAtDeeperLevel`), que trata duplicação em nível mais profundo. O diff mediu o sintoma e atribuiu a 587 **sem instrumentar qual das duas dispara** — pode ser uma, outra, ou as duas em sequência. F6.3g partiria de diagnóstico não medido.

E a generalização é falsa como engenharia: com `path_slug` distinto e nomes distintos (`2024` vs `Dungeons & Dragons 2024`), **há** informação para desempatar. O algoritmo escolhe não usar — é decisão de produto (preferir ambiguidade a chute), não impossibilidade.

**R4 — O editor JÁ obedece D25; só o perfil público não.** Medido:
- **Perfil público** (`MestrePage.tsx`): `MestreBio`(134) → `MestreHighlights`(138) → `MestreSellingPoints`(140) → `MestreVttPlatforms`(142-147) → comunicação(153-161). **Sistemas não existe.** Para D25, o campo entra **antes da linha 142**.
- **Editor** (`ProfileEditPage.tsx`): "Sistemas que Mestra"(811-816) → grupo fechado(830) → VTT+comunicação(860-893). **Já está na ordem de D25**, com 45 linhas de folga.

F6.3c2 mandava mudar os dois lugares sem ter aberto o arquivo — que estava citado três linhas acima. **Achado lateral:** pela lógica de D25, o `ClosedGroupSection`(830) está **entre** sistemas e VTT no editor; se a ordem é a da decisão do jogador, preço/grupo fechado não pertence ali.

**R5 — O tooltip de D27 não funciona em toque, e não há primitivo.** Verificado: **`packages/ui` não tem componente `Tooltip`** (busca devolve zero). Os únicos tooltips do `mesas` são `title=` nativo, que não abre em toque nem por teclado. Num produto onde o jogador procura mesa pelo celular, "a descrição aparece no hover" significa "a descrição não aparece".

Construir tooltip acessível + touch-friendly é trabalho em `packages/ui`, que por `AGENTS.md` §Autorização **exige aprovação + verificação de impacto nos consumidores** — nenhuma task registra isso. **E D27 colide com D26:** D26 diz "selos são exibição obrigatória", D27 diz "aparece escondido atrás de hover". Alternativa melhor sustentada pela literatura e não avaliada: **popover/disclosure clicável** (mesmo controle serve mouse, teclado e toque), ou exibir direto na seção.

**R6 — O perfil público foi medido com muito menos rigor que o editor.**
- **Mobile não medido.** `MestreHero.css`: `.hero-attributes`(207) é `flex-wrap:wrap` sem nenhuma regra no `@media (max-width:768px)`(271). Os chips já quebram em várias linhas no celular — o argumento de D2 ("dois por categoria para não empurrar o CTA para fora da primeira tela") **é mais forte no mobile**, e o rótulo que F6.1d pede custa altura exatamente onde ela é mais cara. Trade-off não reconhecido em task nenhuma.
- **Tema claro não medido.** F6.1d diz que os `variant` diferem (`warning`/`brand`/`info`), mas **D19 desta mesma spec** (`spec.md:151`) já mediu `warning`×`info` com **contraste 1,00 entre si, luminância idêntica**. Se os tokens do `Badge` partilham essa raiz, os três chips podem ser indistinguíveis **mesmo com cor** — o que agrava F6.1d em vez de resolvê-la com rótulo.
- **`MestreHighlights` NÃO renderiza `selling_points`** (verificado: linhas 20-22 leem só `specialties`, `languages`, `badges`). F6.1 achado 3 afirma "a lista completa existe mais abaixo" — verdade para especialidade e idioma, **falso para ponto forte**, que vai para outra seção com outro título. Importa para F6.1c: o indicador de continuação aponta para **duas** seções distintas conforme o grupo cortado, não uma.

**R7 — "37 chaves" está errado; são 36.** Medido em produção. A **conclusão continua sólida** e foi confirmada por dois caminhos: nenhuma das 36 vem de `user_systems`, e `rtk rg "user_systems" apps/mesas/backend/src/routes/gm.ts` devolve **zero**. §8d/F6.3c segue sendo o achado mais firme do diff. O número errado fica registrado porque é exatamente o tipo de dado que o mantenedor não tem como auditar.

**R8 — Colisão de numeração (CORRIGIDA).** O bloco novo criou um segundo **D21**, com `spec.md:149` já usando esse código para "Linha de campo vazio no editor → Adicionar". Renumerados: D21→**D27**, D22→**D28**, D23→**D29**, D24→**D30**. D25 e D26 mantidos.

**R9 — `F7.2a` duplicada (CORRIGIDA).** Aparecia duas vezes, aberta e fechada, no mesmo arquivo — empilhamento proibido por `AGENTS.md`, em escala pequena. A versão aberta foi removida.

**R10 — Caminho de migration citado sem diretório.** É `apps/mesas/database/`, não `backend/migrations/`. As linhas citadas estão certas.

**R11 — F7.7 é escopo aberto disfarçado de task.** Nove itens sem critério objetivo, fechando por julgamento. O alcance que o mantenedor declarou é real; falta quebrar em vereditos com dono.

---

**O que a revisão confirmou como CERTO** (verificado, não precisa reolhar): todas as citações de `MestreHero.tsx` (85-87, 88-110, 96, 101-103, 108) e o render em 259-268, que confirma a fileira única sem rótulo; `MestreHighlights` sem `slice`; `MestreSellingPoints.tsx:29-30`; `MestrePage.tsx:138,140,92-102`; `profileEditorDomain.ts:47-49`; **toda a tabela §8h-bis** (5 partes, 13 blocos, 9 sem subtítulo) linha a linha; `systemSuggestionsAdmin.ts:259-298`; `parseDiscordAnnouncement.ts:551,587`; **F6.4 inteira** (`83ec390` ancestral de `main`, `dev`==`main`==`0c8531b`, contagem 0); 13/13 testes.

Duas nuances menores: `systemSuggestionsAdmin.ts:295` casa `message.includes('duplicate')` genérico, não slug explicitamente — o diagnóstico procede, a mecânica é mais frouxa que o descrito. E **F7.5f é a task mais bem-feita do conjunto**: decide o *não-fazer* com razão medida e exige a decisão registrada em vez de omissão.

## Arquivos afetados

### `packages/ui`
- `src/styles.css` — 25 dos 28 raios literais → tokens (3 formas não-uniformes seguem literais); `--radius-lg` novo; `--space-5/7/8`; utilitários da régua tipográfica
- `src/GmReviewPanel.tsx` — `text-amber-300` → `warning`; `rounded-xl` → `--radius-lg`
- `src/tokens.ts` — apenas se a régua tipográfica exigir degrau ausente

### `packages/content-editor`
- `src/content-editor.css:101` — família de fonte

### `apps/mesas/frontend/src`
- `pages/MestrePage.tsx` + `.css` — estrutura, remoção de 2 seções, emoji, alinhamento
- `pages/ProfileEditPage.tsx` + `.css` — régua, lista + modal
- `pages/PainelMestrePage.tsx` — tokens de tema, fusão dos insights
- `components/mestre/MestreHero.tsx` + `.css` — hero em ficha
- `components/mestre/editor/GmProfileFields.tsx` — campos curtos → linhas + modal
- `components/mestre/editor/ProfileEditorSidebar.tsx` — agrupar linhas
- `components/mestre/GmInsightsDashboard.tsx` — receber `clicks`/`favorites`; quartis sem cor literal
- `components/mestre/MestreInsightsSection.tsx`, `MestreRecommendationsSection.tsx` — removidos do perfil
- `contexts/ProfileContext.tsx` — apenas se o modal exigir expor `flushGmBuffer`
- demais telas do app — recolhimento do laranja (D7)
- `index.css` — apaga os 4 tokens laranja e a classe `.orange-glow` (T2.4a)
- `components/mestre/MestreReviewsSection.tsx` — passa a consumir o pacote (D12, T3.4a)
- `pages/CatalogoPage.tsx` — único consumidor de `.orange-glow`, e está no escopo de D7
- `features/admin/components/ui/AdminTable.tsx` e `StatusPill.tsx` — migram `--border-orange-soft` para `color-mix` (D17)
- os demais componentes de `components/mestre/**` entre os 12 com hardcode de tema (T2.3) e os que carregam emoji ou classe utilitária fora da régua (T2.0g, T3.4)

### Fora de `apps/mesas` e `packages/{ui,content-editor}`

- `packages/ui/tailwind-preset.js` — quarta declaração divergente da família de corpo (T1.2)
- `packages/ui/scripts/check-token-parity.mjs` — passa a cobrir `radius` (T0.1b)

### Testes

- `pages/MestrePage.layout.test.ts` — `readFileSync` dos componentes que a Fase 3 remove (T3.3)
- `components/mestre/editor/GmProfileFields.test.tsx` e `pages/ProfileEditPage.test.tsx` — reescritos para lista+modal (T4.5a)
- `contexts/ProfileContext.test.tsx` — **não** se altera: é o canário do autosave (T4.5b)

## Contratos/interfaces tocados

- **Auth/accounts:** não tocado.
- **Subdomínio/DNS:** não tocado.
- **Schema/API:** não tocado. `clicks` e `favorites` já vêm do backend em `InsightMetric`; a mudança é de onde são exibidos.
- **Design system:** `--radius-lg` é adição, não alteração — nenhum consumidor existente muda de comportamento por ela.

## Impacto em consumidores

`packages/ui` e `packages/content-editor` servem `site` (produção na raiz `artificiorpg.com`), `links`, `accounts` (SSO), `glossario`, `downloads`, `site-admin` e `mesas` — **mais `packages/comments`**, consumidor que a primeira versão deste plano não listava.

**Onde exatamente os 28 raios ficam, e por que isso importa.** Não estão em cantos do design system: estão nas classes de **moldura comum** — `.artificio-button`, `.artificio-control`, `.artificio-badge`, `.artificio-banner`, `.artificio-avatar`, `.artificio-modal`, `.artificio-drawer`, `.artificio-confirm-dialog`, `.artificio-dropzone`, `.artificio-header-search-input`, `nav-link`, `usermenu`, `notification-*`. Ou seja: **botão, campo e cartão dos 7 apps mudam ao mesmo tempo**. O delta por valor já está na tabela da Camada 1 — 23 das 25 ocorrências têm delta **zero** (`8px`/`0.5rem`/`999px`), o que torna a mudança majoritariamente invisível; o risco concentra-se nos dois casos de delta real (`10px` +2px, `1rem` −4px no diálogo de confirmação).

**A troca mono→sans não regride nenhum consumidor, e isso foi medido, não presumido.** Os pontos de uso do `content-editor` são todos markdown de conteúdo — bio, onboarding, contato, `SessionRepeater`, as 5 partes do `table-editor`, e no `downloads` perfil/material/gestão/avaliações. **Nenhum é editor de código ou texto técnico**, onde a monoespaçada teria função. O comentário interno do CSS ainda diz "três consumidores: mesas, downloads, site" — está desatualizado e é corrigido junto.

O `comments` merece nota porque é o caso que **não** regride: ele consome `--radius-sm/md/pill` e `--space-3` do host (declarado em `packages/comments/src/styles.css:46-48`) e não importa o `styles.css` do `ui`. A Fase 0 só **adiciona** `--radius-lg` e troca literais por tokens de valor equivalente, sem alterar o valor de nenhum token existente — então o contrato que o `comments` consome fica intacto.

Verificação obrigatória antes do merge, por app que importa os pacotes: renderização correta nos dois temas, sem regressão de forma ou de tipografia. O `accounts` recebe atenção extra por ser SSO — mudança de código em `packages/auth` exigiria smoke completo, mas esta spec **não toca** `packages/auth`; o risco no `accounts` é apenas visual.

**Dois pontos que a lista de consumidores não tornava óbvios:**

- `apps/mesas/backend` e `apps/downloads/backend` importam do `content-editor` (sanitização), mas **nenhuma mudança desta spec os alcança**: o que muda é CSS, e backend não renderiza.
- A estrela do `GmReviewSummary` **muda de cor no catálogo público**, não só no perfil de mestre: `TableCard.tsx:200` e `MasterCard.tsx:65` são os consumidores reais do componente. É mudança visível numa tela que o mantenedor não reclamou — conferir junto do catálogo em T2.4.

Nada aqui altera comportamento, só forma. A não-regressão é o requisito 4.

## Testes na zona de impacto

Medido, e **nenhuma task da primeira versão os mencionava** — é o tipo de omissão que só aparece quando a suíte quebra:

| arquivo | testes | o que acontece |
|---|---|---|
| `GmProfileFields.test.tsx` | **63** | cobrem digitação por campo (`TaglineField` "chama onChange a cada digitação", `ProfileTagsSection`) — exatamente o que a Fase 4 troca por linha+modal. Precisam ser reescritos, não apagados |
| `ProfileEditPage.test.tsx` | **10** | partes e autosave; afetados pela mesma mudança |
| `ProfileContext.test.tsx` | **9** | autosave puro — **devem sobreviver intactos** se o plano for seguido. Se algum quebrar, é sinal de que o modal encostou no `updateGm`, e o sinal é para investigar, não para ajustar o teste |
| `MestrePage.layout.test.ts` | **15** executados (3 `it` + 1 `it.each` com 12 casos) | o `readFileSync` dos componentes está na **linha 53**, iterando o array `FLOW_CHILDREN` (definido em 17-30) — **quebra com ENOENT** se algum for apagado, e asserta `gap: calc(var(--space-6) * 2)` (linha 72), regra que a Fase 2 toca |

`ProfileContext.test.tsx` é o canário: 9 testes que provam que o autosave da spec 099 sobreviveu.

**E onde não há rede nenhuma.** Quatro arquivos que esta spec altera **não têm teste algum**: `PainelMestrePage.tsx`, `GmInsightsDashboard.tsx` (o maior caso da Fase 2, 39 `text-white`), `MestreInsightsSection.tsx` e `MestreRecommendationsSection.tsx` (os dois que a Fase 3 desmonta). No pacote, `GmReviewPanel.test.tsx` **não asserta cor nem classe** (zero matches para `amber`/`rounded`), então T0.4 não o quebra — mas também não é protegido por ele; e `styles.contract.test.ts` **não cobre raio** (zero matches), que é a mesma lacuna de `check-token-parity.mjs` vista na Camada 1.

Consequência prática: nessas superfícies a verificação é **conferência visual nos dois temas**, não suíte verde. Um teste verde ali não significa nada porque não existe. Onde a spec fecha essa lacuna: T0.1b estende a paridade de token para raio.

## Rollback

Uma PR por fase (D10, revisto), então o rollback é reverter o merge da fase — mais granular que a versão anterior deste plano supunha. Não há migration, não há mudança de schema, não há estado persistido novo — o revert é completo e imediato.

Se o problema aparecer só depois e for localizado nos pacotes, o revert seletivo dos dois arquivos de CSS restaura o comportamento anterior sem tocar nas telas.

## Validação

**Durante o trabalho** (só o pacote afetado, conforme `AGENTS.md`):
- `cd apps/mesas/frontend && rtk pnpm vitest run <arquivo>` nos testes das telas tocadas
- `rtk tsc -p tsconfig.json --noEmit` no app e nos pacotes
- diagnostics do LSP após cada edição

**Onde a medição de fase acontece.** D10 passou a ser uma PR por fase (revisto após o achado C7), então cada fase tem beta próprio depois do seu merge. Ainda assim o gate de fase mede **no dev server local** — `getComputedStyle` roda igual e não depende de deploy —, e beta serve à conferência visual do mantenedor. Isso evita que o gate fique refém do ciclo de deploy.

**Como medir "1 família por tela"** (sem isto o gate é ambíguo): coletar `getComputedStyle(el).fontFamily` de todo elemento com texto, normalizar pela **primeira** face da pilha, e comparar o conjunto contra as duas faces canônicas do sistema — `Inter` (corpo) e `Oswald` (display). O aceite é **uma família de corpo**: `Oswald` em título é o par canônico e **não** conta como desvio; qualquer terceira face conta. Hoje `Oswald` não aparece no mesas (`rtk rg` → zero), mas T3.1 pode introduzi-lo legitimamente no hero — sem esta regra escrita, o gate T3.6 reprovaria o próprio plano.

**Ao fim de cada fase (trava T4), remedir a tabela do §Objetivo** — os mesmos comandos abaixo, com o número comparado ao da fase anterior. Número que subiu é desvio, e o desvio se corrige antes de avançar, não no fim.

**Medição dos requisitos** (é o que prova a spec, não impressão):
- `getComputedStyle` nas três telas em beta → no máximo 6 tamanhos, 3 pesos, 3 raios, 1 família
- `rtk rg -E "border-radius: *(0\.[0-9]+rem|[0-9]+px|[0-9]+rem) *;" packages/ui/src/styles.css` → zero. **A âncora `;` é o que importa**: sem ela o padrão casa também `50%`, `8px 8px 0 0` e `6px 6px 0 0`, que o requisito 1 manda **manter** literais — e o gate reprovaria uma implementação perfeitamente conforme.
- `rtk rg "text-white|bg-white/|border-white/|rounded-xl|rounded-2xl" apps/mesas/frontend/src/components/mestre/ apps/mesas/frontend/src/pages/PainelMestrePage.tsx` → zero, contra 89/82/25 de origem. **Os 12 arquivos e os cinco padrões** — a primeira versão deste comando media só uma página e quatro padrões, e o gate de fase teria passado com `rounded-xl` vivo e 11 dos 12 arquivos sujos, incluindo o `GmInsightsDashboard`
- `rtk rg -E "(padding|margin)[^:]*:[^;]*rem"` nos três CSS → zero
- conferência dos dois temas em cada tela

**No fim, um comando de cada vez** (nunca encadeado, nunca em paralelo — trava do `AGENTS.md`):
- `rtk pnpm run test`
- `rtk pnpm run lint`
- `rtk pnpm run build`

**Antes do merge:** conferência visual do mantenedor em beta nas três telas, mais os apps consumidores dos pacotes.

### Procedência das medições, e o que ainda não foi medido

**Já medido em beta ao vivo** (Chrome do mantenedor, autorizado nominalmente em 2026-09-03; coleta por script injetado na página, percorrendo `querySelectorAll('*')` sob o contêiner da tela, lendo `getComputedStyle` de todo elemento com texto e agregando `fontSize`/`fontWeight`/`fontFamily`/`borderRadius` em conjuntos — as rotas foram `mesasbeta.artificiorpg.com/perfil?tab=mestre` e `/mestre/farenravirar`): os 13/6/9 e 8/4/6 de fonte/peso/raio, as 12,7 telas de rolagem, as 2 famílias renderizadas por tela, e o estado do tema claro. **Não são estimativa estática** — a investigação adversarial os listou como "não verificável" por não ter tido acesso ao browser, o que é verdade para ela, não para a spec.

**Ainda não medido, e por isso são tasks, não premissas:**

- Conferência dos dois temas nos 8 consumidores dos pacotes → T0.5.
- Altura/rolagem do perfil público **depois** da mudança → T3.1a, T3.6.
- Contraste da estrela renderizada (o cálculo está feito; falta a verificação na tela) → T0.4.

Nada nesta spec afirma resultado pós-mudança como se já tivesse sido medido.
