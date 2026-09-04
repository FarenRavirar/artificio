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
