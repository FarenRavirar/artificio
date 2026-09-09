# Tasks — 100

**Entrega: uma PR por fase** (D10, revisto em 2026-09-03 — às vezes duas, conforme o volume de arquivos; o mantenedor decide por fase). A versão anterior dizia "uma PR só", o que tornava impossível o gate de medição em beta por fase (achado C7).

Cada fase mede **no dev server local** (`getComputedStyle` roda igual e não depende de deploy); beta serve à conferência visual do mantenedor depois do merge daquela fase. Cada commit e cada PR exige autorização nominal própria (`AGENTS.md` §Autorização) — autorização de uma fase não vale para a seguinte.

**Antes de agir em qualquer fase, ler `plan.md` §Objetivo.** Ele carrega a tabela de alvo numérico e as quatro travas contra desvio (T1–T4), escritas para a rodada de investigação adversarial: achado que não move nenhum número da tabela não entra nesta spec, e nenhuma decisão registrada se revisa por achado técnico — pergunta-se ao mantenedor. Toda fase termina remedindo a tabela (trava T4); número que subiu é desvio e se corrige antes de avançar.

---

## Fase 0 — o pacote obedecer à própria régua

- [x] T0.0a — Ler `AGENTS.md` inteiro (T0 pétreo — obrigatório toda sessão/toda fase nova, mesmo se já lido antes nesta mesma sessão) antes de agir nesta fase. · feito quando: leitura confirmada, gate/regra pétrea relevante à fase identificada.
- [x] T0.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase (`rtk git status/diff/log`, `rtk rg`, `rtk read`, `rtk pnpm`, `rtk tsc`, `rtk lint`, `rtk vitest` — ver `AGENTS.md` §rtk). · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [x] T0.0c — Comunicação com o mantenedor nesta fase em português. · feito quando: mensagens da fase seguem o registro.
- [x] T0.1 — Criar `--radius-lg: 0.75rem` em `packages/ui/src/styles.css`, junto dos três degraus que já existem (linhas 58–60). · feito quando: token declarado; `rtk rg -- "--radius-lg" packages/ui/src/styles.css` devolve a definição.
- [x] T0.1a — Alinhar as **duas fontes de verdade** de raio: `tokens.ts:63-66` diz `sm: "4px"`, `styles.css:58` diz `6px` — divergem 2px. `styles.css` vence (é o que renderiza); corrigir `tokens.ts` para `sm: "6px"` e acrescentar `lg: "12px"`. · feito quando: os dois arquivos declaram os mesmos valores.
- [x] T0.1b — Estender `check-token-parity.mjs` para cobrir `radius`, que hoje só valida hexes e presença de vars semânticas — é o motivo de a divergência de T0.1a ter passado. · feito quando: o script falha se `tokens.ts` e `styles.css` divergirem em raio.
- [x] T0.1c — Completar a escala de espaço: `--space-5` **não existe** (`styles.css:62-66` tem 1/2/3/4/6) e não há degrau para o respiro de seção. Criar os degraus que faltam **respeitando a convenção do arquivo — nome = px/4**, medida antes de escrever: `--space-5: 1.25rem` (20px), `--space-8: 2rem` (32px), `--space-10: 2.5rem` (40px), `--space-12: 3rem` (48px), `--space-16: 4rem` (64px). A versão anterior desta task pedia `--space-5: 2rem`/`-7: 3rem`/`-8: 4rem`, que produziria `space-5` (32px) **maior que `space-6`** (24px) — os valores de respiro pedidos (32/48/64) estão preservados, com os nomes que a convenção exige. · feito quando: os degraus existem e a escala é monotônica; sem eles o requisito 7 ("zero rem literal") é impossível de cumprir.
- [x] T0.2 — Mapear ao degrau as **25** ocorrências de raio uniforme das 28 de `packages/ui/src/styles.css` (11× `999px`→pill, 12× `8px`/`0.5rem`→md, 1× `10px`→lg **+2px**, 1× `1rem`→lg **−4px**, em `.artificio-confirm-dialog`). As **3 formas não-uniformes** (`50%`, `8px 8px 0 0`, `6px 6px 0 0`) permanecem literais, com o motivo em comentário. · feito quando: nenhum raio uniforme literal resta; os dois deltas (+2px, −4px) estão registrados no commit, não escondidos.
- [x] T0.3 — Trocar a família monoespaçada de `packages/content-editor/src/content-editor.css:101` pela família de corpo do design system. · feito quando: `getComputedStyle` no textarea da bio em beta devolve a família `sans` de `tokens.ts`, não `ui-monospace`.
- [x] T0.4 — Remover **toda** cor literal de acento de `packages/ui/src/GmReviewPanel.tsx` — são **três** lugares, não só a estrela: `text-amber-300` nas linhas 68, 97 e 154 (os três subcomponentes) → `var(--state-warning-fg)` (D13, token que já vira com o tema, `styles.css:109` e `:187`); `rounded-xl` na 88 → `--radius-lg`; e o estado selecionado da tag na linha 168 (`border-orange-500 bg-orange-500/20 text-orange-100`) → token semântico, porque mede **1,07 de contraste no tema claro** e D12 o traria para a tela pública. **Não usar `warning` nem valor fixo** na estrela: `amber-300` dá 1,44 no claro, `warningText` dá 2,08 no escuro — só o token que vira passa nos dois. · feito quando: busca por `amber-|orange-|rounded-(xl|full)` no arquivo devolve zero — **`rounded-full` entra**: são 3 ocorrências que o padrão anterior deixava passar (avatar e pílulas), e o degrau da escala é `--radius-pill` E o contraste calculado da estrela e da tag selecionada é ≥ 4,5 sobre `#FFFFFF` e `#1B2A4A`.
- [ ] T0.4c — **BLOQUEADA: o alvo de ≥3:1 entre si é matematicamente impossível.** Aguarda decisão do mantenedor (§Achado que precisa de decisão, abaixo). Medido em 2026-09-03, antes de tentar implementar:
  - **Diagnóstico da spec confirmado.** `warning`×`info` = **1,00** (luminâncias 0,439 e 0,440), `success`×`warning` = 1,18, `success`×`info` = 1,18, `success`×`danger` = 1,48, `warning`×`danger` = 1,75, `danger`×`info` = 1,76. Os 6 pares abaixo de 3.
  - **Por que 3:1 entre quatro cores não existe.** A razão de contraste é `(L₁+0,05)/(L₂+0,05)`; exigir ≥3 entre todas obriga cada degrau a triplicar: 0 → 0,10 → 0,40 → **1,30**. O branco puro tem luminância **1,00**. A quarta cor precisaria ser mais clara que o branco.
  - **Busca exaustiva, para não depender só da álgebra:** 2401 arranjos (7 candidatos Tailwind por papel, preservando o matiz de cada um) — **zero** atingem 3:1 entre si, mesmo ignorando por completo o contraste contra os fundos. Baixando o alvo: 2,5 → impossível; 2,0 → impossível; 1,8 → impossível; 1,5 → impossível sem regressão.
  - **Teto real medido:** o melhor "pior par" alcançável é **1,91** (`success:#10B981 warning:#B45309 danger:#7F1D1D info:#BAE6FD`), e nessa combinação o pior contraste contra fundo cai para 1,33 — pior que hoje.
  - Mantendo ≥3 contra ambos os fundos, o melhor pior-par continua **1,00**: não há ganho nenhum.

  **As três saídas, medidas (a escolha é do mantenedor — muda regra de produto, `AGENTS.md` §Bug achado, exceção 2):**

  | opção | o que faz | ganho medido | custo medido |
  |---|---|---|---|
  | **A — padrão em vez de cor** (recomendada) | tokens intocados; a barra ganha hachura/textura por série, mais o rótulo | resolve o problema real de daltonismo e P&B **sem** depender de contraste entre matizes | uma regra de `background-image` no gráfico; nenhum token muda, nenhum consumidor regride. É o que a WCAG 1.4.1 exige de fato: não depender de cor sozinha |
  | **B — separar só o par gêmeo** | `info` `#38BDF8` → `#0284C7` | `warning`×`info` sobe de **1,00** para **1,91**; contra branco **melhora** (2,14 → 4,10) | contra o navy cai de 6,64 para **3,47** — ainda acima de 3, mas é regressão real no tema escuro; `info` muda em todo o monorepo |
  | **C — manter como está** | nada | — | as barras vizinhas seguem indistinguíveis em P&B e para daltônicos |

  Se o mantenedor escolher **B** com mais separação: `#0369A1` dá 2,76 entre si mas derruba o navy a 2,40; `#075985` dá 3,52 e derruba a 1,88. Nenhum atinge 3:1 **e** preserva os dois fundos.

  **Recomendação: A.** É a única que resolve o problema que D19 quer resolver (distinguir séries adjacentes) sem trocar um defeito de acessibilidade por outro, e não toca token que os 7 apps consomem.
- [x] T0.4a — Levar markdown ao `GmReviewPanel` do pacote (D15): `GmReviewForm` troca `Textarea` por `ContentEditor`, `GmReviewList` renderiza o comentário com `MarkdownContent`. Sem isto, migrar o app apagaria markdown de avaliações **já publicadas**. · feito quando: o pacote escreve e lê markdown; comentário existente com markdown renderiza formatado, não com asteriscos crus.
- [x] T0.4b — Trocar o truncamento silencioso de `GmReviewForm` (`slice(0, 2000)`, linha 179) pelo aviso de excedente sem bloqueio (D16). `contentCountLabel` do `content-editor` já devolve "N caracteres acima do limite" — usar, não reescrever. · feito quando: passar de 2000 mostra o excedente, o envio continua permitido, e nada é cortado sem o usuário ver.
- [x] T0.5 — Verificar não-regressão nos **8** consumidores: os 7 apps (`site`, `links`, `accounts`, `glossario`, `downloads`, `site-admin`, `mesas`) mais `packages/comments`, que consome `--radius-sm/md/pill` e `--space-3` do host (`comments/src/styles.css:46-48`) sem importar o `styles.css` do `ui`. **Conferir especificamente botão, campo, badge, banner, modal e avatar**: os 28 raios ficam nas classes de moldura comum (`.artificio-button`, `.artificio-control`, `.artificio-badge`, `.artificio-modal`, `.artificio-drawer`, `.artificio-avatar`…), então os 7 apps mudam ao mesmo tempo. 23 das 25 ocorrências têm delta zero; olhar com atenção os dois com delta real — `10px`→+2px e `.artificio-confirm-dialog` `1rem`→−4px. · feito quando: cada app conferido nos dois temas com o que foi olhado registrado, e confirmado que nenhum **valor** de token existente mudou.
- [x] T0.6 — `rtk tsc --noEmit` nos dois pacotes e testes do `packages/ui`. · feito quando: zero erro de tipo; suíte do pacote verde com contagem citada.
- [x] T0.7 — **Gate de fase (trava T4):** remedir a tabela do `plan.md` §Objetivo. · feito quando: raio literal de valor único em `packages/ui` = 0 (as 3 formas não-uniformes seguem literais por decisão do requisito 1) e nenhum outro número da tabela subiu; valores citados.

## Fase 1 — régua tipográfica

- [x] T1.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [x] T1.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru onde `rtk` cobria.
- [x] T1.0c — Comunicação em português. · feito quando: mensagens da fase seguem o registro.
- [x] T1.1 — Expor os seis papéis sobre cinco tamanhos e três pesos da régua (tabela em `plan.md` §Camada 2) como utilitários em `packages/ui`. · feito quando: utilitários declarados e cobertos por teste de contrato de estilo.
- [x] T1.2 — Unificar a família de **corpo**: há **quatro** declarações divergentes de Inter (`tokens.ts:61`, `styles.css:47`, `tailwind-preset.js:40`, `apps/mesas/frontend/src/index.css:93`). Escolher uma pilha e fazer as outras três derivarem dela. **Oswald não entra**: `--artificio-font-display` é a face de títulos do design system, o par canônico display+corpo. · feito quando: `getComputedStyle` em rótulos vizinhos devolve família idêntica e as 4 declarações apontam para a mesma pilha.
- [x] T1.3 — **Gate de fase (trava T4):** remedir a tabela do `plan.md` §Objetivo. · feito quando: famílias de corpo por tela = 1 e nenhum outro número subiu; valores citados.

## Fase 2 — telas do mesas na régua

- [x] T2.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [x] T2.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru onde `rtk` cobria.
- [x] T2.0c — Comunicação em português. · feito quando: mensagens da fase seguem o registro.
- [x] T2.0d — **(requisito 5, tipografia no CSS)** Mapear cada `font-size` dos três CSS a um dos 5 degraus da régua, e cada `font-weight` a um dos 3 pesos. Hoje: `MestrePage.css` **14** tamanhos (`0.7rem`…`2.5rem`), `MestreHero.css` **8** (até `4rem`), `ProfileEditPage.css` **9**. · feito quando: os três arquivos usam só os degraus da régua.
- [x] T2.0e — **(requisito 5, forma no CSS)** Mapear cada `border-radius` dos três CSS aos degraus (`--radius-sm/md/lg`, `pill`, mais `50%` que é geometria). Hoje **12 valores distintos** nos três (`12px`×8, `50%`×7, `9999px`×4, `16px`×3, `24px`, `20px`, `10px`×2, `3px`, `0 12px 12px 0`). · feito quando: nenhum raio literal de valor único resta nos três arquivos.
- [x] T2.0f — **(requisito 6)** Unificar o tamanho dos rótulos de campo do editor em um só (13px, degrau "rótulo"). Medido em beta: rótulos vizinhos com 14px e 12px sem regra — "Banner do Perfil" contra "URL manual". · feito quando: `getComputedStyle` em todos os rótulos da aba mestre devolve o mesmo tamanho.
- [x] T2.0g — **(requisito 5, classes Tailwind)** Mapear aos degraus da régua as classes utilitárias dos **TSX**, que T2.0d/T2.0e não alcançam por só cobrirem CSS. Medido nos 12 arquivos de `components/mestre/**` + `PainelMestrePage.tsx`: **95** classes de tamanho em **7 degraus distintos** (`text-sm` 42, `text-xs` 30, `text-lg` 6, `text-3xl` 6, `text-2xl` 6, `text-xl` 4, `text-4xl` 1), **41** raios em **4 degraus** (`rounded-lg` 26, `rounded-full` 15, mais `xl`/`2xl` cobertos por T2.3) e **4 pesos** (`font-medium`, `semibold`, `bold`, `extrabold`). · feito quando: os TSX usam só os 5 tamanhos, 3 pesos e 3 raios da régua — sem isto o gate T2.5 reprova mesmo com os três CSS perfeitos, porque `getComputedStyle` mede a tela, não o arquivo.
- [x] T2.1 — Substituir os 79 paddings/margens em `rem` literal por `--space-*` em `MestrePage.css` (57), `MestreHero.css` (12) e `ProfileEditPage.css` (10). · feito quando: `rtk rg -E "(padding|margin)[^:]*:[^;]*rem"` nos três arquivos devolve zero.
- [x] T2.2 — Reduzir as 15 declarações de `box-shadow` dos três CSS a uma só, aplicada apenas a elemento que flutua; cartão passa a separar-se por filete de 1px. · feito quando: contagem de `box-shadow` nos três arquivos é 1; cartões conferidos visualmente.
- [x] T2.3 — Trocar por tokens de tema os **89** `text-white`, **82** `bg-white/N`/`border-white/N` e os **25** `rounded-xl`/`rounded-2xl` **e os `rounded-lg`** (10 no dashboard → `--radius-md`; 4 `rounded-xl` no painel → `--radius-lg`, sem conflito) dos **12 arquivos** de `components/mestre/**` mais `pages/PainelMestrePage.tsx`. **`GmInsightsDashboard.tsx` é obrigatório aqui** (39 `text-white`, 27 `bg/border-white/`, 15 raios): o `/painel` o renderiza na linha 649, então sem ele o bloco de insights continua branco-sobre-branco no claro e o alvo "tema claro do painel funciona" **não** é atingido — mesmo com a busca do aceite zerada nos outros 11 arquivos. · feito quando: busca nos 12 arquivos devolve zero para os cinco padrões E o `/painel` renderiza legível no tema claro **com o bloco de insights aberto**, não só o cabeçalho.
- [x] T2.4 — Recolher o laranja a botão primário, link e anel de foco **nas telas de mestre e no catálogo, incluindo `TableCard`** (D7 revisto — medido: 59 arquivos no app inteiro; onboarding, login, discord-sync e admin ficam fora). · feito quando: `rtk rg -i "orange|#FF5722|#E64A19"` nas telas de mestre e no catálogo devolve ocorrências **apenas** em botão primário, link e anel de foco — cada sobrevivente nomeado com o motivo; e a conferência visual do mantenedor registrada em T5.4.
- [x] T2.4a — Apagar os 4 tokens laranja de borda/sombra de `apps/mesas/frontend/src/index.css` (linhas 48-49, 74-75) e a classe `.orange-glow` (linha 128), resolvendo o conflito D6×D7 como o mantenedor decidiu (D17): **3 deles têm zero consumidores** (`--border-orange` e as duas `--shadow-glow-orange*`) — saem sem regressão possível. `--border-orange-soft` é usado por **2** arquivos, ambos do admin (`AdminTable.tsx:232`, `StatusPill.tsx:8`), e D7 protege o admin: nesses 2 arquivos ele vira `color-mix(in srgb, var(--color-artificio-orange) 20%, transparent)`, que é **o padrão que as próprias linhas já usam** para o fundo. `.orange-glow` só é usado por `CatalogoPage`, que está no escopo de D7. · feito quando: busca pelos 5 nomes no app devolve zero **E** o admin mantém a borda laranja (conferido nos dois temas) — apagar o token sem migrar deixaria `border-color` cair em `currentColor` e produziria borda clara forte no admin escuro.
- [x] T2.5 — **Gate de fase (trava T4):** medir as três telas com `getComputedStyle` e remedir a tabela do `plan.md` §Objetivo. · feito quando: no máximo 6 tamanhos, 3 pesos, 3 raios e 1 família de corpo por tela — número citado, comparado com a medição de origem (13/6/9 e 8/4/6); nenhum outro número da tabela subiu.

## Fase 3 — estrutura do perfil público

- [x] T3.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [x] T3.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru onde `rtk` cobria.
- [x] T3.0c — Comunicação em português. · feito quando: mensagens da fase seguem o registro.
- [x] T3.1 — Converter o hero de tela cheia centralizada em faixa de identificação alinhada à esquerda: foto, nome, selos e números de confiança em linha (D5). · feito quando: hero renderiza alinhado à esquerda, sem `min-height` de tela cheia; altura da página medida antes/depois.
- [x] T3.1a — Agrupar os 11 blocos restantes em **3 grupos** (D5a): **Sobre** (`MestreBio`+`MestreHighlights`+`MestreSellingPoints`+`MestreVttPlatforms`), **Mesas** (`MestreTablesSection`+`MestreReviewsSection`), **Contato** (`MestreContactMethods`+`MestreContactForm`+`LinksDisplay`+`MestreClosedGroupSection`), mais hero e `MestreFinalCta`. · feito quando: a página tem 3 grupos + hero + CTA E **nenhum conteúdo se perdeu**, provado por checklist escrito: antes de agrupar, listar todo campo renderizado pelos 11 componentes; depois, marcar onde cada um aparece. A lista vai no relatório da fase — "conferido item a item" sem a lista não é evidência (`AGENTS.md` §Evidência). **Estado vazio (D20):** o grupo renderiza só os filhos preenchidos e some inteiro — título incluído — quando nenhum renderiza; os 4 componentes do grupo Sobre retornam `null` quando vazios, então sem esta regra um mestre novo veria título órfão.
- [x] T3.2 — Renderizar `favorites` no bloco de insights do `/painel` — **é o único campo que falta**, e **não tocar em `clicks`**: executar "levar clicks ao painel" literalmente cria um segundo card de Cliques, que o requisito 12 proíbe. Medido: `views`, `contacts` e `clicks` já são exibidos (`GmInsightsDashboard.tsx:72` e `:177`), e `total_favorites` já chega ao frontend (`apps/mesas/backend/src/routes/gmPanel.ts:2112` no backend, e `useGmInsights.ts:9` no front). · feito quando: as quatro métricas aparecem uma única vez cada no painel.
- [x] T3.2a — Migrar ao painel o que os dois componentes têm de único (D14 — reaproveitar, não apagar): a heurística `needsAttention` de `MestreInsightsSection` (10+ views, 0 contatos) e o `SEVERITY_META` de `MestreRecommendationsSection` (alto/médio/baixo com ícone). · feito quando: as duas capacidades funcionam no painel; **não** foi criado segundo bloco de recomendações (o painel já tem o seu, `GmInsightsDashboard.tsx:321-353`, de outra rota).
- [x] T3.2b — Reorganizar o bloco de insights do painel aproveitando o que os componentes do perfil faziam melhor (D4 revisto): cards por mesa e tratamento de severidade. · feito quando: o bloco do painel exibe, por mesa, os mesmos 4 números do perfil (`views`, `clicks`, `contacts`, `favorites`) mais o aviso de `needsAttention`, e as recomendações continuam com os 3 níveis de severidade — sem segundo bloco. Critério é a lista, não a impressão de clareza.
- [x] T3.3 — Remover `MestreInsightsSection` e `MestreRecommendationsSection` do perfil público, só depois de T3.2, T3.2a e T3.2b verdes. **Ajustar `MestrePage.layout.test.ts` na mesma edição**: ele faz `readFileSync` dos componentes na **linha 53**, iterando o array `FLOW_CHILDREN` (27-28), e quebra com **ENOENT**, não com falha de asserção. Decidir ali se os arquivos somem ou ficam sem consumidor — deixar arquivo órfão com teste verde vigiando componente morto é a armadilha oposta. · feito quando: as seções não renderizam no perfil, nada se perdeu, e a suíte de layout passa sem vigiar código morto.
- [x] T3.3a — **(requisito 18)** Confirmar que o contato permanece no fluxo em coluna única após o agrupamento de T3.1a — sem trilho fixo à direita (D3). É verificação, não construção. · feito quando: `getComputedStyle` no contêiner do grupo Contato não devolve `position: sticky|fixed` nem `grid-template-columns` com mais de uma trilha, nos dois temas.
- [x] T3.4 — Remover emoji dos títulos de seção e o alinhamento centralizado dos blocos de texto longo. Os emojis **não** estão em `MestrePage.tsx`: `MestreContactMethods.tsx:232` (📬), `MestreContactForm.tsx:67` (✉️), `MestreVttPlatforms.tsx:20` (🎮) e **`MestreFinalCta.tsx:66`**, cujo `<h2>` monta o emoji junto do título com quatro variantes (📋🔥⚡✨, linhas 27/36/45/54) — sem este o critério não fecha. · feito quando: busca por emoji em `<h2>` nos componentes de seção devolve zero; blocos de texto alinhados à esquerda.
- [x] T3.4a — Fazer `MestreReviewsSection.tsx` consumir `GmReviewList`/`GmReviewForm` do `@artificio/ui` em vez de markup próprio (D12), só depois de T0.4, T0.4a e T0.4b. Hoje os dois componentes do pacote têm **zero consumidores** enquanto o app reimplementa o mesmo conceito, repetindo `text-amber-300` nas linhas 101 e 134. **Preservar, item a item** (o pacote não traz nada disso): gate `useAuth` e botão "Entre para avaliar este mestre" com `startSsoLogin` — o pacote documenta na linha 123 que o guard é do consumidor, então trocar só o markup **expõe o formulário a deslogado**; `authPost` para a rota de reviews + toast + refetch; `fetchReviews`/`normalizeReviews` e o estado de carregamento. · feito quando: busca por `amber-` devolve zero, E **teste cobre os dois estados do gate** (deslogado vê o botão de login e não o formulário; logado envia e a lista recarrega), E markdown continua funcionando na escrita e na leitura.
- [x] T3.5 — Remover **toda** cor literal de `GmInsightsDashboard.tsx` usando os tokens semânticos: os quartis (`text-rose-300`, `amber`, `cyan`, `emerald`, linhas 44-47 e 103), o `severityConfig` (`text-red-400`, `yellow-400`, `blue-400`, linhas 38-40) e o bloco de erro (`bg-red-500/10`, `text-red-400`, linhas 20-22). A investigação classificou o `severityConfig` como fora de escopo; entra porque é cor literal na superfície que a Fase 3 reorganiza. · feito quando: busca por `-300|-400|-500/` no arquivo devolve zero.
- [x] T3.6 — **Gate de fase (trava T4):** medir a página e remedir a tabela do `plan.md` §Objetivo. O alvo de rolagem é **direcional, não teto** (D18): ~5 telas é referência, e o critério real é "o mínimo sem perder conteúdo" (requisito 11a). · feito quando: rolagem medida e citada contra as 12,7 de origem; **se ficar acima de ~5, a justificativa está escrita** — qual conteúdo impediu comprimir mais; nenhum outro número da tabela subiu.

**Estado — entregue em 2026-09-04 (PR #306, commits `6744cb3`…`780ebe5`).**

Checklist de conteúdo de T3.1a, provando que nada se perdeu no agrupamento:

| grupo | filhos, com a MESMA condição de renderização de antes |
|---|---|
| **Sobre** | `MestreBio`, `MestreHighlights`, `MestreSellingPoints`, `MestreVttPlatforms` |
| **Mesas** | `MestreTablesSection`, `MestreReviewsSection` |
| **Contato** | `MestreContactMethods`, `MestreContactForm`, `LinksDisplay`, `MestreClosedGroupSection` |

Fora dos grupos: hero e `MestreFinalCta`. As âncoras `#mesas` e `#contato` passaram ao grupo; o `id="mesas"` interno de `MestreTablesSection` saiu para não duplicar (`getElementById` devolveria o primeiro nó, rolando para dentro do grupo, abaixo do próprio título).

`MestreInsightsSection`, `MestreRecommendationsSection`, o hook `useMestreInsights` e o derivado `canSeeInsights` foram **removidos** — ficaram sem consumidor depois de T3.3, e arquivo órfão com teste verde vigiando código morto é a armadilha que a própria task nomeia.

**T3.6 — medição do gate.** Régua da página: 6 tamanhos (≤6), 2 pesos (≤3), 4 degraus de raio mais `50%` (geometria) e uma forma composta que o `plan.md` §Camada 1 declara não-degrau, 0 famílias de corpo declaradas (herdam a única do pacote). Respiro vertical declarado: **3256px → 2384px, −872px (−27%)**, medido somando `padding`/`margin`/`gap` de bloco nos dois CSS, contra o mesmo cálculo em `origin/dev`.

**O que a medição NÃO cobre.** T3.6 pede a rolagem da página com `getComputedStyle` no dev server, e T3.3a pede o mesmo no contêiner do grupo Contato nos dois temas. O que se mediu foi o **arquivo**: os CSS e os TSX. T3.3a foi verificada estruturalmente — `.mestre-group` e `.mestre-group-body` são `flex-direction: column`, sem `position: sticky|fixed` nem `grid-template-columns` —, o que satisfaz a regra mas não é a medição na tela que a task descreve. A rolagem em telas continua **não medida**.

## Fase 4 — editor híbrido

- [x] T4.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [x] T4.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru onde `rtk` cobria.
- [x] T4.0c — Comunicação em português. · feito quando: mensagens da fase seguem o registro.
- [x] T4.1 — Converter slogan, especialidades, idiomas e anos de experiência em linhas exibindo o valor atual (D1). Bio e imagens permanecem inline. · feito quando: os quatro campos aparecem como linha com valor, e linha sem valor exibe **"Adicionar"** (D21); bio e imagens seguem inline.
- [x] T4.2 — Implementar o modal de edição com botão "Salvar" explícito e descarte no fechar (D2), usando o `Modal` do `packages/ui` (`primitives.tsx:333-396`). O modal mantém valor em estado local e **não** chama `updateGm` enquanto aberto; "Salvar" chama uma vez e então `flushGm()` — nome exposto pelo contexto (`profileContextCore.ts:44`), não `flushGmBuffer`, que é interno ao provider. · feito quando: teste cobre **quatro** caminhos — salvar persiste, e as três vias de descarte do Modal (botão X, tecla ESC, clique no backdrop) descartam mantendo o valor anterior **no cache também**: `updateGm` faz optimistic update no enqueue (`ProfileContext.tsx:205-217`), então o teste verifica `queryClient.getQueryData(['profile','me'])`, não só o que a tela mostra. **Duplo clique em Salvar:** desabilitar o botão enquanto em voo. Hoje seria inócuo por acaso — `updateGm` é merge idempotente e `flushGm` com buffer vazio devolve `true` (`ProfileContext.tsx:240-252`) —, mas depender de acaso não é contrato.
- [x] T4.3 — Confirmar que o autosave da spec 099 segue intacto nos campos inline (bio, imagens) e que o indicador "Salvando…/Salvo" não dispara com o modal aberto. · feito quando: suíte do autosave verde e comportamento conferido em beta.
- [x] T4.4 — Adaptar `ProfileEditorSidebar` para agrupar linhas em vez de campos, preservando a navegação por seções (requisito 17). · feito quando: navegação lateral funciona e leva às seções corretas.
- [x] T4.5 — Remover a barra "43% preenchido", cuja função passa a ser cumprida pelo valor ao lado de cada linha. · feito quando: barra ausente e o estado de preenchimento continua legível na lista.
- [x] T4.4a — **(requisito 5 no editor)** Mapear aos degraus da régua as **18** classes de tamanho e os pesos dos TSX do editor (`GmProfileFields.tsx`, `ProfileEditorSidebar.tsx`, `ProfileEditPage.tsx`) — mesmo furo de T2.0g, herdado pela Fase 4. · feito quando: os TSX do editor usam só os degraus da régua; gate T4.6 mede a tela e passa.
- [x] T4.5a — Reescrever os testes que cobrem o comportamento trocado por linha+modal: **63** em `GmProfileFields.test.tsx` (`TaglineField` "chama onChange a cada digitação", `ProfileTagsSection`) e **10** em `ProfileEditPage.test.tsx`. Reescrever, não apagar — a cobertura de cada campo continua devida, muda o gesto que ela exercita. · feito quando: os testes cobrem lista+modal com a mesma abrangência de campo de antes; suíte verde com contagem citada.
- [x] T4.5b — Confirmar que os **9** testes de `ProfileContext.test.tsx` passam **sem alteração** — é o canário de que o autosave da 099 sobreviveu. Se algum quebrar, o modal encostou em `updateGm`: investigar a causa, **nunca ajustar o teste** para passar. · feito quando: 9/9 verdes sem edição no arquivo.
- [x] T4.6 — **Gate de fase (trava T4):** remedir a tabela do `plan.md` §Objetivo no editor. · feito quando: tamanhos ≤ 6, pesos ≤ 3, raios ≤ 3, família = 1; valores citados e comparados com 8/4/6/2 da origem.

**Estado — entregue em 2026-09-04 (PR #306, commits `6744cb3`…`780ebe5`).**

Os quatro campos curtos viraram linha + modal via `ProfileFieldRow`, componente novo. O modal **não** chama `updateGm` enquanto aberto: `updateGm` faz optimistic update no enqueue, então escrever a cada tecla pintaria o cache antes do Salvar e o descarte de D2 seria decorativo.

Três defeitos apareceram na revisão e foram corrigidos na raiz, não no caso particular:

- **`flushGm()` devolve `false` quando a gravação falha** e o modal fechava assim mesmo, descartando o rascunho numa falha de rede (`219839a`).
- **Entrada inválida virava patch vazio** — `1.5` ou `-3` fechavam o modal sem gravar e sem dizer por quê. `toPatch` passou a poder recusar com `{ erro }`, e a via vale para qualquer campo com validação, inclusive os que ainda não existem (`8ab8439`).
- **Fechar durante o `saving`** (X, ESC, backdrop, Cancelar) descartava o rascunho de uma gravação ainda em voo — o mesmo defeito do primeiro item sobrevivendo no caminho do fechar (`780ebe5`).

**T4.5b (canário):** `ProfileContext.test.tsx` passa 9/9 **sem uma linha alterada** — o autosave da spec 099 sobreviveu.

**T4.6 — medição do gate.** Editor: 6 tamanhos (≤6), 2 pesos (≤3), 4 degraus de raio (`sm`/`md`/`lg`/`pill`) mais `50%` e `8px 8px 0 0`, ambos declarados não-degrau no `plan.md`, 1 família. Zero classes cruas de tamanho ou peso nos três TSX do editor.

**O que falta, e depende do mantenedor.** T4.3 pede conferência do autosave **em beta** e T5.4 é a conferência visual — as duas só fecham com você olhando. A suíte do autosave está verde; o comportamento em beta **não foi conferido**.

## Fase 5 — fechamento

**Esta fase roda ao fim de CADA fase que vai virar PR**, não só uma vez no final — com PR por fase (D10 revisto), cada uma precisa entrar verde e conferida. A numeração `T5.*` é o roteiro de fechamento, repetido por fase.

- [x] T5.0a — Lido no início da sessão de 2026-09-08.
- [x] T5.0b — Cumprido; três bloqueios do `rtk-enforce` na sessão foram reemitidos na forma correta.
- [x] T5.0c — Cumprido.
- [x] T5.0d — **Gate remedido, parte estática. Parte de runtime fica em T5.4.** Medido: raio literal em `packages/ui/src/styles.css` → **0** (`rtk rg` sem match); literais Tailwind (`text-white|bg-white/|border-white/|rounded-xl|rounded-2xl`) nos 12 arquivos de mestre + `PainelMestrePage.tsx` → **0**, contra 89/82/25 de origem; `padding|margin` em `rem` nos CSS tocados → **1**, `ProfileEditPage.css:877 scroll-margin-top: 6.5rem`, que é offset de âncora e não espaçamento de layout, e é anterior a esta sessão. Nenhum número subiu. O que **não** foi remedido é o `getComputedStyle` das três telas (tamanhos/pesos/raios/famílias renderizados): exige o app no browser, e fecha em T5.4.
- [x] T5.1 — `rtk pnpm run test` → **43/43 tarefas**, 0 falhas. Rodado cinco vezes: entrega original (`a3738f3`) e as quatro rodadas de achados de review, sempre com o mesmo resultado. Duas falhas transitórias apareceram e foram diagnosticadas, não ignoradas: `ImageFieldsAria.test.tsx` (mock literal apagava um export que eu acabara de criar — **quebra minha**, corrigida com `importOriginal`) e `@artificio/image-editor` com "no tests", que era o `dist` de `@artificio/media` sendo reescrito enquanto o teste importava.
- [x] T5.2 — `rtk pnpm run lint` → **26/26**, **0 erros**, nas cinco rodadas. 1 warning `react-hooks/exhaustive-deps` em `useBannerScrim.ts:251`, arquivo não tocado nesta spec e warning anterior a ela.
- [x] T5.3 — `rtk pnpm run build` → **26/26**, 0 falhas, nas cinco rodadas.
- [ ] T5.4 — Conferência visual do mantenedor: local antes da PR da fase; em beta depois do merge dela. Na fase que toca os pacotes (Fase 0), inclui os apps consumidores. **Obrigatória — não opcional — em `PainelMestrePage`, `GmInsightsDashboard`, `MestreInsightsSection` e `MestreRecommendationsSection`: os quatro não têm teste algum**, então ali a conferência é a única rede que existe. · feito quando: mantenedor confirmou ou apontou ajuste, com os quatro arquivos sem teste explicitamente olhados nos dois temas.
- [x] T5.4a — `rtk pnpm verify:api` → exit 0, **breaking=0** nos 6 apps, e **nenhum artefato de `docs/api/generated` mudou**. Medido o porquê, para não ficar parecendo que a checagem não viu o campo novo: o schema de `GET /api/v1/gm/perfis/{slug}` no `mesas.openapi.yaml:4556` é `type: object` + `additionalProperties: true` — não descreve campo algum, então `gm_systems` não altera o contrato declarado.
- [x] T5.5 — Autorizado nominalmente pelo mantenedor ("commit all + push + abra pr"), 2026-09-08. Commit `a3738f3`, PR **#310** contra `dev`, ready for review. A rodada de review dos bots rendeu 6 achados; 5 aplicados e 1 recusado com medição, no commit `1262a87` — também sob autorização nominal própria ("commit all + push").
- [x] T5.6 — Cumprido nas duas voltas: nenhum `gh pr view`/`gh run watch`, nenhum polling. O trabalho parou na abertura da PR e, depois, no push do commit de review.

---

## Rastreabilidade requisito → task

Existe porque a primeira versão desta spec deixou **três requisitos sem nenhuma task** (5, 6 e 18): eram medidos pelo gate de fase, que falharia sem ter quem corrigisse. Antes de fechar qualquer fase, conferir que todo requisito tem executor.

| requisito | tasks |
|---|---|
| 1 — raio literal em `packages/ui` | T0.1, T0.1a, T0.1b, T0.2 |
| 2 — família da bio | T0.3 |
| 3 / 3a / 3b — cor e raio do `GmReviewPanel`; contraste da tag; tokens distinguíveis entre si | T0.4, **T0.4c** |
| 4 — não-regressão nos 8 consumidores | T0.5, T0.6, T5.4 |
| 5 — ≤6 tamanhos / 3 pesos / 3 raios | T1.1, **T2.0d** (CSS, tipografia), **T2.0e** (CSS, raio), **T2.0g** (classes Tailwind dos TSX), **T4.4a** (idem, editor) |
| 6 — rótulos com um tamanho | T1.2, **T2.0f** |
| 7 — zero `rem` literal | T0.1c, T2.1 |
| 8 — uma sombra | T2.2 |
| 9 — tokens de tema nos 12 arquivos | T2.3 |
| 10 / 10c — laranja só em ação; tokens apagados | T2.4, T2.4a |
| 10a / 10b / 10d — app consome o pacote; contraste da estrela; contador sem bloqueio | T0.4, **T0.4a**, **T0.4b**, T3.4a |
| 11 / 11a / 11b — hero em ficha; 3 grupos; grupo vazio | T3.1, T3.1a |
| 12 — insights fora do perfil, sem duplicar | T3.2, T3.2a, T3.2b, T3.3, T3.5 |
| 13 — sem emoji em título (inclui `MestreFinalCta`) | T3.4 |
| 14 — texto não centralizado | T3.4 |
| 15 / 15a / 16 — lista + modal com Salvar; linha vazia | T4.1, T4.2 |
| 17 — navegação lateral preservada | T4.4 |
| 18 — contato em coluna única | **T3.3a** |

Em negrito, as tasks criadas depois que a investigação adversarial apontou o gap.

---

## Achados fora de escopo (trava T1)

Achados verdadeiros da investigação adversarial (2026-09-03) que **não** entram nesta spec por não moverem nenhum número da tabela do `plan.md` §Objetivo. Registro explícito porque silêncio sobre achado lê como esquecimento. Nada aqui vira débito registrado sem o mantenedor mandar registrar (`AGENTS.md` §Bug achado / débito).

| achado | onde | por que fica de fora |
|---|---|---|
| `GmReviewList`/`GmReviewForm` órfãos | `packages/ui/src/GmReviewPanel.tsx` | **Deixou de estar fora**: D12 mandou o app consumi-los (T3.4a). O que permanece fora é *removê-los* — a alternativa que o mantenedor descartou |
| Emojis no painel (📊🎯💡✨🔴🟡🟢) | `GmInsightsDashboard.tsx` | O requisito 13 cobre o **perfil público**, onde o emoji quebra a tipografia entre plataformas. No painel é superfície privada do dono e não move a tabela |
| `rounded-full` (9999px) vs `--radius-pill` (999px) | 12 ocorrências em `components/mestre/**` | Delta de **1px** em raio já arredondado — sub-pixel na prática, invisível. Corrigir custaria toque em 12 arquivos por nada |
| `bronze` `#9C6B43` em cartão de dashboard | `TableCardDashboard.tsx:93,236` | Já usa `var(--artificio-bronze)`, **token do sistema, não literal** — não é desvio. É cor secundária decorativa, fora da conta de D7 (laranja) |
| Comentário desatualizado do CSS ("três consumidores") | `content-editor.css` | Corrigido de passagem junto com T0.3, por estar na mesma linha de trabalho — não precisa de task própria |

### Reclassificados — estes **entram**, ao contrário do que a investigação propôs

A investigação os listou como fora de escopo; a medição mostra que movem a tabela:

| achado | onde entra | por quê |
|---|---|---|
| Raios sem degrau nos CSS do mesas (`20px`, `24px`, `16px`, `10px`, `3px`, `0 12px 12px 0`) — **12 valores distintos** medidos nos três arquivos | **T2.0e** | O requisito 5 exige ≤3 raios por tela. Estes *são* a linha "raios de borda por tela" da tabela do §Objetivo |
| `severityConfig` com `text-red-400`, `yellow-400`, `blue-400` literais | **T3.5** (escopo ampliado) | Cor literal na superfície que a Fase 3 reorganiza (D4). T3.5 cobria só os quartis; passa a cobrir também `severityConfig` e o bloco de erro (linhas 20-22) |
| `tokens.ts` `radius.sm` 4px vs `styles.css` 6px | **T0.1a** | Verdade que ninguém lê `tokens.ts.radius` em runtime — mas a Fase 1 ancora a régua nele. Divergência entre as duas fontes faz as Fases 0 e 1 trabalharem contra referências diferentes |
| `--space-5` ausente | **T0.1c** | Sem ele o requisito 7 ("zero `rem` literal") é incumprível para respiro de seção |

---

## Fase 6 — dado do mestre que se perde (produção, 2026-09-05)

> **⚠ LEIA ANTES DE IMPLEMENTAR — terminologia e estado da doc.**
>
> **Os quatro campos, e o que cada um é no banco.** Confundi dois deles e custou uma rodada inteira; não repita:
>
> | termo no produto | coluna | forma | descrição? |
> |---|---|---|---|
> | **Destaque** / ponto forte | `selling_points` | JSONB `{icon, title, description}` | **sim, obrigatória** (`profileEditorDomain.ts:47-49`) |
> | **Selo** | `badges` | `TEXT[]` | **não existe** (`migration_01_base_schema.sql:97`) |
> | Especialidade | `specialties` | `TEXT[]` | não |
> | Idioma | `languages` | `TEXT[]` | não |
>
> "Destaque" e "ponto forte" são **o mesmo campo** (`selling_points`) — o editor rotula "Destaque", o texto antigo desta spec diz "ponto forte". **Selo nunca teve descrição**; se alguma linha sugerir o contrário, ela está errada e prevalece esta tabela.
>
> **Decisões que governam esta fase:** D25 (ordem sistema→VTT→comunicação), D26 (os quatro aparecem), D27 (descrição do destaque é texto visível — **nunca tooltip nem popover**), D28/D29 (indicador clicável; o topo não esconde), **D30 REVOGADA** (a ordem é produção primeiro), D31 (grupo fechado sai da sequência), D32 (rótulo de categoria obrigatório — cor não distingue, medido 1,01:1).
>
> **Verificação de 2026-09-05:** as **25 citações `arquivo:linha`** desta fase e da Fase 7 foram conferidas uma a uma contra o código; todas exatas. O que já foi refutado está marcado `[x]` com a refutação — **não reabrir**.



**Origem:** conferência do mantenedor em produção (`mesas.artificiorpg.com/perfil?tab=mestre` e página pública do mestre), depois de 099/100/101 subirem. Não são regressões de estilo: são campos que o mestre preenche e o produto **descarta ou nunca exibe**. Por isso vêm antes da Fase 7, que é de percepção.

**Medição citada pelo mantenedor (não verificada ainda — cada task começa medindo):** gravou em Especialidades "Intriga Política, Investigação, Exploração, Imersão" e em Idiomas "Português"; a página do mestre mostrou "Intriga Polícia / Investigação / O Nome do Vento / Português" — dois itens sumiram e entrou um item de outro campo.

### F6.1 — resumos do topo truncados sem indicador

**INVESTIGADO 2026-09-05. O diagnóstico da hipótese inicial estava errado em dois dos três pontos** — registrado aqui porque a correção muda de natureza.

**Onde o mantenedor viu a perda:** no **hero**, `MestreHero.tsx:88-110`, não numa lista de especialidades. O hero monta um grid de três grupos e corta cada um em dois:

| grupo | linha | fonte | o que apareceu |
|---|---|---|---|
| `specialties` | `MestreHero.tsx:96` | 4 gravadas | "Intriga Política", "Investigação" |
| `selling_points` | `MestreHero.tsx:101-103` | pontos fortes, `.map(p => p.title)` | **"O Nome do Vento"** |
| `languages` | `MestreHero.tsx:108` | 1 gravada | "Português" |

Isso reproduz exatamente a sequência relatada ("Intriga Polícia / Investigação / O Nome do Vento / Português").

**Os três achados, medidos:**

1. **O corte é deliberado, não um bug de truncamento.** `MestreHero.tsx:85-87` documenta a decisão: *"A dobra é um resumo… As seções abaixo continuam exibindo tudo."* O `.slice(0, 2)` é intencional. **O defeito real é a ausência de indicador de continuação** — nada na tela diz que existem mais 2 especialidades adiante, então o mestre lê como dado descartado. Um resumo silencioso é indistinguível de perda de dado, do ponto de vista de quem preencheu.
2. **"O Nome do Vento" NÃO é dado na coluna errada — a hipótese do antigo F6.1b está refutada.** É o `title` de um **ponto forte** (`selling_points`), renderizado no mesmo grid visual das especialidades **sem rótulo que separe as três categorias**. A mistura é de apresentação, não de gravação. Nenhuma consulta ao banco é necessária: `MestreHero.tsx:99-103` prova a origem.
3. **A lista completa existe na página, mais abaixo.** `MestreHighlights.tsx` renderiza `.map` completo, sem `slice` (linhas 33-80), e está montado em `MestrePage.tsx:138` dentro do grupo "Sobre", que abre porque `temSobre` (`MestrePage.tsx:92-102`) é verdadeiro com `specialties` preenchidas. Ou seja: os 4 itens **são** exibidos — só que num ponto da página que o mestre não associou ao que preencheu.

**Medição de que o código faz o que diz:** `rtk vitest run MestreHighlights.test.tsx MestreHero.test.tsx` → **13/13 PASS**. Não há implementação quebrada. É decisão de produto que produz percepção de perda.

**Consequência para a correção:** não se corrige com "deixar de truncar". As tasks abaixo substituem as originais.

- [x] F6.1a — ~~Medir onde a lista é cortada~~ → **feito**: `MestreHero.tsx:96,101-103,108`, `.slice(0, 2)` em três grupos.
- [x] F6.1b — ~~Medir se "O Nome do Vento" vem de outro campo~~ → **feito, hipótese refutada**: é `selling_points[].title`, gravado na coluna certa, exibido em grid sem rótulo de categoria.
- [x] F6.1c — **FEITO.** `MestreHero.tsx`: cada grupo cortado exibe `+N` como `button` que rola E move o foco (`scrollTo` ganhou `tabIndex=-1` + `focus({preventScroll})` — `scrollIntoView` sozinho deixava o foco no topo, e o próximo Tab voltava ao começo). Destinos ganharam âncora: `MestreHighlights` → `#em-resumo`, `MestreSellingPoints` → `#destaques`. Medido: `rtk vitest run src/components/mestre` → 172/172. 
- [x] F6.1c2 — **FEITO.** `badges` entrou no hero (era o único dos quatro grupos de D26 ausente da dobra) e os quatro têm indicador para a seção que exibe a lista inteira. O teste antigo travava `queryByText('Streamer') === null` — exatamente a regra que D26 revogou —, então foi trocado, não removido. 
- [x] F6.1d — **FEITO.** A fileira contínua virou colunas rotuladas (`hero-attribute-group`/`hero-attribute-label`), rótulo em `--text-support` maiúsculo. Grupo vazio não rende rótulo órfão (coberto por teste). 
- [x] F6.1d2 — **FEITO.** Cada grupo carrega `targetId`/`targetLabel` próprios: especialidade/idioma/selo → `#em-resumo`, destaque → `#destaques`. O `aria-label` nomeia o destino ("Ver todos os 3 itens de Destaques em O que eu ofereço"), porque "+2" sozinho não informa nada fora do contexto visual. 
- [x] F6.1d3 — **MEDIDO E MITIGADO, com uma ressalva.** Estado anterior confirmado: `.hero-attributes` era `flex-wrap:wrap` com `gap: var(--space-2)` e **nenhuma** regra no `@media (max-width:768px)`. O rótulo custa uma linha de `--text-support` por grupo visível. Mitigação: `column-gap` cai para `--space-4` no mobile (contra `--space-6` no desktop), o que mantém mais grupos por linha, e o rótulo usa o menor degrau da régua. **Ressalva:** a medição em pixels do hero renderizado a 360px **não foi feita** — exige o app rodando; fecha em T5.4. 
- [x] F6.1e — **DECIDIDO (D26, 2026-09-05): ponto forte FICA.** Idioma, estilo/especialidade, ponto forte e selos são exibição obrigatória — não são conteúdo opcional a esconder atrás de corte. O que muda é a **forma** de apresentar, não a presença. Consequência para F6.1c/F6.1d: o corte não pode fazer nenhum dos quatro sumir sem caminho de volta (D22/D23).
- [x] F6.1f — **FEITO.** Dois testes novos em `MestreHero.test.tsx`: rótulo + indicador com destino por grupo, e chip de destaque como controle de teclado. 

### F6.2 — descrição do destaque decapitada no topo

**INVESTIGADO 2026-09-05. A formulação original desta task estava errada: `badges` não tem descrição nenhuma.** Registrado porque a correção incide em outro campo.

**Medições:**

1. **`badges` é `TEXT[]`** — `migration_01_base_schema.sql:97` (`badges TEXT[] DEFAULT '{}'`). Uma string por selo, sem campo de descrição. O editor (`GmProfileFields.tsx:246-261`) é um `TagInput` simples, rótulo "Selos", e **não exige descrição de coisa alguma**. `MestreHighlights.tsx:65-78` exibe todos, sem corte.
2. **O campo que exige descrição é `selling_points`** — "pontos fortes", `isValidSellingPoint` em `profileEditorDomain.ts:47-49`: só grava com `title` **e** `description` preenchidos. Botão "Adicionar ponto forte" (`GmProfileFields.tsx:421`).
3. **A descrição É exibida na página** — `MestreSellingPoints.tsx:29-30` renderiza `<h3>{sp.title}</h3>` e `<p>{sp.description}</p>`, sob o título "O que eu ofereço". Montado em `MestrePage.tsx:140`.
4. **Onde a descrição some: no hero.** `MestreHero.tsx:101-103` faz `.slice(0, 2).map(point => point.title)` — descarta `description` e mostra só o título, num chip, ao lado de especialidades e idiomas. Foi isso que o mantenedor viu como "exige descrição e não mostra nada da descrição": no topo da página, o ponto forte aparece decapitado.

**Conclusão:** não existe campo obrigatório órfão de consumidor. O defeito é o **hero exibir `selling_points` como se fosse chip de categoria**, perdendo a metade que justifica o campo ser obrigatório — e é o mesmo defeito de F6.1 achado 2, visto pelo outro lado. **D26 fechou os dois de uma vez: ponto forte fica, e a correção é de forma.**

- [x] F6.2a — ~~Provar ausência de consumidor de `badges`~~ → **feito, premissa refutada**: `badges` não tem descrição; quem tem é `selling_points`, e ela É exibida em `MestreSellingPoints.tsx:29-30`. O que perde a descrição é o hero (`MestreHero.tsx:101-103`).
- [x] F6.2b — **RESOLVIDO (D27, 2026-09-05): o campo é o DESTAQUE (`selling_points`), não o selo.** O mantenedor colou o texto real do editor — "Título e descrição são obrigatórios para salvar o destaque" — que está no `SellingPointsEditor` (`GmProfileFields.tsx:341`, com os placeholders de 371 e 396). `badges` segue `TagInput` de string. **Nenhuma migration é necessária**, e o registro anterior ("DECIDIDO pelo mantenedor: tooltip" sobre `badges`) era transcrição errada minha.
- [x] F6.2b2 — **RESOLVIDO (D27): tooltip E popover descartados; a descrição vai como texto visível e persistente.** Pesquisa em `plan.md` §D-H: o Primer é explícito — tooltip *"should never be used to convey critical information"*, esconde por padrão e não existe em toque. Como D26 tornou os destaques exibição obrigatória, a descrição é **essencial**; popover resolveria acessibilidade mas continuaria escondendo, contradizendo D26 do mesmo jeito. Efeito colateral favorável: **nenhum primitivo novo em `packages/ui`**, logo nenhuma aprovação de pacote compartilhado.
- [x] F6.2c — **Sem trabalho de exibição na seção:** `MestreSellingPoints.tsx:29-30` já renderiza `<h3>{title}</h3><p>{description}</p>`. O defeito nunca foi a seção — é o **hero** decapitar com `.map(p => p.title)` (`MestreHero.tsx:101-103`). A correção está em F6.1, não aqui.
- [x] F6.2d — **FEITO.** `+N` e o chip de destaque são `button` com nome acessível. Os outros três grupos seguem `Badge` inerte de propósito: não têm segunda metade a alcançar, e chip clicável que não leva a nada seria pior (coberto por teste). 
- [x] F6.2e — **FEITO.** `MestreSellingPoints` ganhou `id="destaques"` e o `scrollTo` move o foco além de rolar. 

### F6.3 — sistema de jogo não seleciona nem exibe

**REINVESTIGADO 2026-09-05 após correção do mantenedor.** A primeira investigação desta task concluiu "não existe campo de sistema no perfil" — **estava errada**. O mantenedor apontou que o draft de importação de mesas funciona com o mesmo catálogo, e que o problema já teve ~6 tentativas de correção sem resolver. Seguir esse fio deu a causa raiz que a busca anterior não alcançou.

**O erro da primeira passagem:** procurei coluna em `gm_profiles`, não achei, e parei. O campo **existe** e grava em outro lugar.

**Medições:**

1. **O campo existe: "Sistemas que Mestra".** `ProfileEditPage.tsx:811-824`, componente `UserSystemsSelector type="gm"`, gravando por `addSystem(systemId, 'gm')`. Não é coluna de `gm_profiles` — é a tabela de ligação **`user_systems`** (`user_id`, `system_id`, `type`, com `UNIQUE(user_id, system_id, type)` citado na migration 148).
2. **A API pública não devolve esse dado.** `GET /api/v1/gm/perfis/farenravirar` traz 37 chaves e nenhuma vem de `user_systems`. A gravação tem casa; a **leitura pública não consulta a tabela**. É por isso que o visitante não vê — e por isso "não salva" é percepção: salva, mas some da vista.
3. **O catálogo está corrompido na raiz, e não é o duplicado de julho.** Árvore reconstruída a partir de `GET /api/v1/systems?q=5e` (39 nós): `Dungeons & Dragons` tem **duas edições "5e" distintas**, cada uma com sua linhagem paralela de variantes:

   | edição | id | variantes |
   |---|---|---|
   | "5e" | `8b1402c4` | 2014, **2024** (`fc682df5`), Next |
   | "5e" | `405ff13e` | Dungeons & Dragons 2014, **Dungeons & Dragons 2024** (`230bed63`) |

   O mesmo padrão em `Vampire` vs `Vampiro` (dois sistemas irmãos para a mesma coisa).
4. **A migration 148 não cobre estes nós.** `migration_148_remap_dnd_2024_variant.sql` remapeia `ac74d486…` → `c3d31503…`. **Nenhum dos dois UUIDs existe** no catálogo que beta serve hoje. Os duplicados atuais (`fc682df5`, `230bed63`) são **novos**, criados depois de 2026-07-14. Isso explica as tentativas repetidas: cada uma remapeou *instâncias*, e a fonte seguiu produzindo mais.
5. **A fonte: `createSystemNode` não checa irmão duplicado.** `systemSuggestionsAdmin.ts:259-298` valida **só o tipo do pai** (`assertValidChainParent`, linha 278) e delega a `createCatalogNode` → `packages/catalog-client/src/index.ts:193` → `POST /api/admin/v1/catalog/nodes` no site. A única defesa é `PATH_SLUG_CONFLICT` (linha 295), que compara **slug**, não identidade semântica: `2024` e `Dungeons & Dragons 2024` geram slugs diferentes e passam como nós distintos. Duas edições "5e" sob o mesmo pai passam pelo mesmo furo.

**Conclusão:** três defeitos independentes, um deles a causa das seis tentativas frustradas.

- [x] F6.3a — ~~D&D 5e 2024 não selecionável~~ → **existe, duplicado em duas linhagens paralelas**; a duplicação é sintoma, não causa.
- [x] F6.3b — ~~Medir por que edições/variantes não salvam~~ → **salvam**, em `user_systems` via `UserSystemsSelector type="gm"`. A primeira investigação desta task afirmou o contrário e estava errada.
- [x] F6.3c — **FEITO — primeiro da ordem de D30, único defeito medido em PRODUÇÃO.** `gm.ts` passou a consultar `user_systems type='gm'` e devolve `data.gm_systems`. O nome sai de `composeSystemDisplayName`, exportado de `systemCatalogProvider.ts`: é o MESMO compositor que as mesas usam, porque a folha ("2024") não identifica sistema nenhum. Falha do catálogo cai para lista vazia em vez de derrubar o perfil, como `hydrateTableSystemFields` já fazia. Componente novo `MestreSystems.tsx`; `normalizeGmSystems` na entrada do estado, porque o payload chega por cast sem validação. 
- [x] F6.3c2 — **FEITO.** `MestreSystems` montado antes de `MestreVttPlatforms` em `MestrePage.tsx`, e `temSobre` passou a contar `gm_systems` — sem isso o grupo "Sobre" ficaria fechado para o mestre que só tem sistemas. 
- [x] F6.3c4 — **FEITO — e o mantenedor JÁ havia decidido, em D31** ("o grupo fechado sai da sequência de decisão"); a task ficou aberta pedindo decisão que já existia. `ClosedGroupSection` foi para DEPOIS de VTT e comunicação: só a posição mudou, componente e gravação são os mesmos. 
- [x] F6.3c3 — **CUMPRIDO.** A implementação lê `user_systems` direto; nada deriva sistema de mesa publicada. 
- [x] F6.3d — **FEITO, e num lugar diferente do que esta task supunha.** A guarda **não** entrou em `createSystemNode`: `mesas` e `downloads` têm cada um o seu, e os dois delegam ao mesmo endpoint do site — pô-la num app deixaria o outro aberto. Entrou em `apps/site/db/repo/catalog.ts` (`assertNoEquivalentSibling`, chamada por `createNode`), que é a fábrica real. Compara nome, `name_pt` e aliases normalizados (sem acento, caixa, pontuação) e **remove o prefixo do pai**. **Só CRIAÇÃO:** `updateNode` fica de fora de propósito, senão F6.3e não poderia renomear para o canônico enquanto o duplicado existe.

  **Cinco ajustes vindos das rodadas de review, todos procedentes:**
  1. **Advisory lock por pai** (`pg_advisory_xact_lock(hashtext(...))`) antes da checagem. Sem serializar, duas aprovações simultâneas sob o mesmo pai leem a lista de irmãos **antes** de qualquer das duas inserir, ambas passam, e a UNIQUE de `path_slug` não socorre — slug distinto para o mesmo nome é o furo que esta guarda fecha.
  2. **`rejected`/`merged` não reservam identidade.** A projeção pública serve só `status = 'active'` (`catalog.ts:149,187`). **Alcance menor do que parece:** `idx_catalog_nodes_parent_slug` (migration 006:44) **não filtra status**, então nó `merged` continua ocupando o SLUG; a exclusão muda só o caso em que o slug difere e a identidade coincide.
  3. **`name_pt` do candidato e dos irmãos entrou na comparação.** O nó canônico é `name: 'Vampire'`, `name_pt: 'Vampiro'`, e essa fusão custou a `migration_013_merge_vampire_localized_duplicate.sql` (`manual-risk` + `requires-backup`). Comparando só `name`, criar `Vampiro` de novo **passava**.
  4. **O PREFIXO do pai também usa todas as identidades dele** (`name`, `name_pt`, aliases), do mais longo para o mais curto. Sem isso, com pai `Vampire`/`Vampiro` e irmão `5e`, criar `Vampiro 5e` comparava `vampiro 5e` contra `5e` e **passava** — a mesma linhagem paralela, reaberta pelo prefixo traduzido. Vale igual para alias: `DnD 5e` sob `Dungeons & Dragons`.
  5. **A recusa passou a ser traduzida em TODOS os criadores de nó**, não só nos dois que eu tinha tocado — ver o parágrafo próprio abaixo.

  Medido: **24/24** em `catalog.test.ts` (5 na entrega original + 2 + 2 + 2 das rodadas de review). **Revertida a chamada da guarda, 3 falham**; revertido só o `name_pt`, 2 falham; revertido só o prefixo, 2 falham.

  **A tradução do `409` era o furo mais silencioso, e estava fora dos arquivos que eu havia tocado.** Medido na terceira rodada de review: `mesas/routes/systems.ts:289` respondia 409 dizendo *"já existe um sistema com este slug"* — errado, porque os slugs podem ser **distintos** (é exatamente o caso que a guarda acrescenta ao índice); e `glossario/systemController.ts` engolia tudo num `catch` genérico e devolvia **503 "Catálogo central indisponível"** — duplicata determinística lida como falha de infra, que o admin retenta para sempre. Correção compartilhada, não por app: `isDuplicateSiblingError` + `DUPLICATE_SIBLING_MESSAGE` em `packages/catalog-client`, que é o pacote por onde **todos** os apps passam, e os quatro consumidores (`mesas/systems.ts`, `glossario/systemController.ts` nas duas criações, e os dois `systemSuggestionsAdmin`) passaram a usá-lo. Uma mensagem só, em todo app, e o próximo app não nasce com uma quinta tradução errada. Coberto por 3 testes em `catalog-client` (22/22).

  **A guarda estava no lado ERRADO, e essa foi a falha mais séria da série (achado P1, quarta rodada).** `resolveSystemCatalogSource` manda `APP_ENV=beta` para o provider **local** (`systemCatalogProvider.ts:50`), e `docker-compose.beta.yml:57` define exatamente isso — então `createLocalNode` insere direto em `systems` **sem passar pelo catálogo central**. A guarda que eu escrevi protegia produção, que a medição de F6.3e já mostrara **limpa**, e deixava aberta justamente a fábrica de beta, onde as duas edições "5e" irmãs nasceram. Guardei o lado que não tinha o problema.

  **Por que a correção é guarda de unicidade e não proibição de criação (D33).** Perguntei ao mantenedor se `createLocalNode` deveria recusar criação e mandar tudo ao Central; a resposta foi que a projeção de beta **precisa** poder criar, senão beta não testa o fluxo de criação. A fonte canônica segue sendo o Central no Site Prod (D114, firme) e **todo ambiente de produção consome o compartilhado** — medido: `mesas` prod resolve `central`, e `downloads`/`glossario` não têm bifurcação. O defeito nunca foi criar em beta: foi criar `5e` duas vezes.

  Correção: a mesma comparação passou a existir nos **dois** caminhos — `apps/site/db/repo/catalog.ts` (central) e `createLocalNode` (local), este último com `SELECT … FOR UPDATE` no pai para serializar dentro da transação que já existia.

  **A primeira tentativa de corrigir isto estava errada, e o mantenedor barrou — fica registrado porque o erro é de arquitetura, não de detalhe.** Eu movi a comparação para `packages/catalog-matching` e fiz `apps/site` importar de lá, alegando *compartilhado por padrão*. Isso **inverte a direção da dependência**: `catalog-matching` é matching por SIMILARIDADE (`levenshtein`, `similarity`, `scoreSystemCandidates`) — a ferramenta que os CONSUMIDORES usam para adivinhar qual sistema um texto solto quer dizer (parser de Discord, triagem de sugestão). O `site` é o **dono** do catálogo: ele não adivinha, ele é a fonte. O sinal estava medido na minha frente e eu li ao contrário — `apps/site` passou **meses sem essa dependência**, e eu tratei o zero como buraco a preencher em vez de desenho deliberado. Junto vieram `package.json`, `pnpm-lock` e o **Dockerfile do site** (imagem que serve produção), tudo só para sustentar uma dependência que não devia existir. Revertido: a comparação é um **espelho deliberado** em cada lado, documentado como tal nos dois arquivos.

  **Sobre o processo, que é o que esse erro ensina:** foram quatro rodadas de achados de bot, cada um procedente, cada correção medida e testada — e o acúmulo produziu uma inversão de arquitetura que nenhum bot pegaria, porque eles leem o diff e não a topologia. Quem viu foi o mantenedor. Três sinais que eu ignorei: escopo saindo do `mesas` (tratei como pergunta de escopo, não como sintoma), três pacotes compartilhados tocados (só fui à trava do §Autorização depois de cobrado), e a ausência de meses da dependência (li como falta).

  **Trava de pacote compartilhado (§Autorização).** Sobra um pacote tocado nesta série: `media` (+43/−9, e as 9 remoções estão **dentro de `isArtificioHostedImage`, função criada nesta própria PR** — nenhuma assinatura ou comportamento pré-existente mudou). Consumidores medidos e verificados: image-editor, mesas (front e back), links, site, accounts, downloads-backend — **`tsc -b` verde nos 10 consumidores dos pacotes tocados**, mais `test` 43/43 e `build` 26/26 repo-wide. Nenhum é `packages/auth`, que teria trava própria. `catalog-client` ganhou só o reconhecedor do erro 409 (adição pura, ver parágrafo acima); `catalog-matching` foi **revertido por inteiro**.

  **Três ajustes vindos das rodadas de review, todos procedentes:**
  1. **Advisory lock por pai** (`pg_advisory_xact_lock(hashtext(...))`) antes da checagem. Sem serializar, duas aprovações simultâneas sob o mesmo pai leem a lista de irmãos **antes** de qualquer das duas inserir, ambas passam, e a UNIQUE de `path_slug` não socorre — slug distinto para o mesmo nome é exatamente o furo que esta guarda existe para fechar. Lock de transação, não de sessão: solta no COMMIT/ROLLBACK.
  2. **`rejected`/`merged` não reservam identidade.** A projeção pública serve só `status = 'active'` (`catalog.ts:149,187`), e esses nós são o resultado de uma consolidação — contá-los faria a limpeza de F6.3e travar a recriação do nome que ela própria liberou. **Alcance menor do que parece, registrado no código:** `idx_catalog_nodes_parent_slug` (migration 006:44) **não filtra status**, então nó `merged` continua ocupando o SLUG; a exclusão muda só o caso em que o slug difere e a identidade coincide. Descoberto porque o primeiro teste que escrevi para o ajuste **falhou por esse motivo**.
  3. **`name_pt` entrou na comparação, e era o furo mais caro.** O nó canônico de hoje é `name: 'Vampire'`, `name_pt: 'Vampiro'`, e essa fusão custou a `migration_013_merge_vampire_localized_duplicate.sql`, classificada `manual-risk` + `requires-backup`. Comparando só `name`, criar `Vampiro` de novo **passava** — medido: os 2 testes novos falham sem o ajuste. Vale nos dois sentidos (candidato e irmão existente).

  Medido: **22/22** em `catalog.test.ts` (5 na entrega original + 2 + 2 das rodadas de review). **Revertida a chamada da guarda, 3 falham**; revertido só o `name_pt`, 2 falham.

  **Dois ajustes da rodada de review (commit `1262a87`), ambos procedentes:**
  1. **Advisory lock por pai** (`pg_advisory_xact_lock(hashtext(...))`) antes da checagem. Sem serializar, duas aprovações simultâneas sob o mesmo pai leem a lista de irmãos **antes** de qualquer das duas inserir, ambas passam, e a UNIQUE de `path_slug` não socorre — slug distinto para o mesmo nome é exatamente o furo que esta guarda existe para fechar. Lock de transação, não de sessão: solta no COMMIT/ROLLBACK e não vaza.
  2. **`rejected`/`merged` não reservam identidade.** A projeção pública serve só `status = 'active'` (`catalog.ts:149,187`), e esses nós são o resultado de uma consolidação — contá-los faria a limpeza de F6.3e travar a recriação do nome que ela própria liberou. **O alcance é menor do que parece, e está registrado no código:** `idx_catalog_nodes_parent_slug` (migration 006:44) **não filtra status**, então nó `merged` continua ocupando o SLUG. A exclusão muda só o caso em que o slug difere e a identidade coincide — que é precisamente o que esta guarda acrescenta ao índice. Descoberto porque o primeiro teste que escrevi para o ajuste **falhou por esse motivo**.

  Medido: **20/20** em `catalog.test.ts` (5 testes na entrega original + 2 da rodada de review, que fixam a diferença entre as duas defesas). **Revertida a chamada da guarda, 3 falham** (o "5e" exato já era pego pela UNIQUE; os outros dois são o furo).
- [x] F6.3e-medicao — **PRODUÇÃO ESTÁ LIMPA (medido 2026-09-05).** `GET /api/v1/systems?q=5e` nos dois ambientes, 39 nós cada, comparando irmãos de mesmo pai por nome normalizado:

  | ambiente | duplicatas de irmão | nós "2024" |
  |---|---|---|
  | **produção** | **nenhuma** | 1 — `c3d31503`, filho de `c324b0de` |
  | beta | `5e` x2 sob `Dungeons & Dragons` (`8b1402c4`, `405ff13e`) | 2 — `fc682df5` e `230bed63` |

  `c3d31503` é **exatamente o `new_id` da migration 148**: ela funcionou em produção e o estado lá é o correto. As duplicatas de beta nasceram **depois**, no ambiente onde se aprovam sugestões de sistema — o que confirma `createSystemNode` como a fábrica e não a migration como falha.

  **Consequência prática:** F6.3e é limpeza **de beta**, não SQL write em produção — o custo e o risco caem, e a aprovação nominal necessária é a de escrita em beta. Também vale como alerta: sem F6.3d, produção pode receber o mesmo defeito na próxima sugestão aprovada lá.
- [ ] F6.3e — **Limpar as duplicatas de beta.** Consolidar as duas edições "5e" de D&D e os dois "2024", usando produção como referência do estado correto. **Só depois de F6.3d** — limpar antes deixa a fonte aberta. · feito quando: beta bate com produção e a consolidação foi aprovada.
**MEDIÇÃO NO DRAFT (2026-09-05, a pedido do mantenedor — segunda correção nesta task).** Rodei `parseDiscordAnnouncement` **real** contra o catálogo **real** de beta (39 nós), via probe temporário com o `makeMessage` da suíte existente. Resultado:

| texto | system_id resolvido | cadeia |
|---|---|---|
| `D&D 5e 2024` | `5092ddb4…` | **Dungeons & Dragons(system)** — para na RAIZ |
| `Dungeons & Dragons 5e 2024` | `5092ddb4…` | **para na RAIZ** |
| `D&D 2024` | `5092ddb4…` | **para na RAIZ** |
| `D&D 5e 2014` | `5092ddb4…` | **para na RAIZ** |
| `DnD 5e` | `405ff13e…` | 5e(edition) ← D&D — desce um nível, **escolhendo uma das duas "5e" arbitrariamente** |
| `Vampiro 5e` | `c8fc6863…` | Vampire 5e(edition) ← Vampiro |

**O draft NÃO resolve o caso.** A premissa de "copiar como o draft faz" não se sustenta, e é melhor saber agora: os candidatos mostram **duas edições "5e" empatadas em `0.49`**, e `findSystemMatch` (`parseDiscordAnnouncement.ts:587`) tem `if (children[1]?.score === children[0].score) break;` — **para no empate, de propósito**. É a guarda anti-ambiguidade que impede descer até a variante `2024`. A árvore trava um nível acima do que o mestre quer.

Ou seja: a duplicata do catálogo **cega os dois caminhos**, o draft inclusive. No draft o dano é menos visível porque um humano revisa e corrige no `SystemPicker` antes de publicar; no perfil não há essa etapa.

**O que o draft tem e o perfil não** — e isto sim é aproveitável:
- `_system_candidates`: guarda a lista pontuada, não só o vencedor, e o `SystemPicker` do `DraftEditorTab.tsx:372-384` deixa o humano escolher com `onSuggest`/`onCreateNow`.
- `findUniqueExactEditionAlias` (`:551`): alias exato de edição salta níveis, mas **só quando é único** — mesma trava de ambiguidade.

**Conclusão que fecha a sequência de tentativas:** enquanto houver duas "5e" irmãs, nenhum algoritmo de resolução pode acertar, porque não há resposta certa. **F6.3d (guarda) e F6.3e (consolidação) são pré-requisito de tudo** — inclusive de melhorar o draft. Toda tentativa anterior atacou a resolução, que é o sintoma.

- [ ] F6.3g — **Corrigir o draft junto.** Consolidadas as duplicatas, remedir esta tabela: `D&D 5e 2024` deve resolver até a variante, não parar na raiz. Se continuar parando, o defeito é do scoring e não do catálogo. · feito quando: a tabela acima foi remedida após F6.3e, com os valores novos citados.
- [x] F6.3f — **FEITO.** `gm.publicSystems.test.ts`, **5 casos**: sistemas gravados saem com a cadeia inteira; mestre sem sistema devolve `[]`; id fantasma é descartado em vez de virar nome nulo; catálogo fora do ar não derruba o perfil; **e falha do NOSSO banco vira 500, não 200 com lista vazia** — este último veio da quarta rodada de review: o `try` que eu escrevera para tolerar o catálogo (dependência externa) englobava também a consulta a `user_systems`, então falha de DB ficaria indistinguível de "este mestre não cadastrou sistema", que é o defeito de F6.3c reaparecendo como silêncio. A leitura da nossa tabela saiu do `try`; só a resolução dos nomes tolera falha.

### F6.4 — "placeholder" do banner com URL crua do Cloudinary

**INVESTIGADO 2026-09-05. Não é placeholder, não é deploy pendente, não é bug de código.** A hipótese registrada estava errada nas três frentes.

**Medições:**

1. **O texto correto está no código, em `dev` e em `main`.** `ImageUploader.tsx:279` e `AvatarField.tsx:250`: `placeholder="Cole aqui um link direto de imagem (.jpg, .png ou .webp)"`. Introduzido em `83ec390`, que `git merge-base --is-ancestor 83ec390 origin/main` confirma estar em `main`.
2. **`dev` e `main` estão no MESMO commit** (`0c8531b`), com `git rev-list --count origin/main..origin/dev` = 0. Não há promoção pendente.
3. **O beta serve o bundle com o texto novo.** `curl` do `index-J4YoIp7N.js` que o HTML de beta referencia: **2 ocorrências** de "Cole aqui um link direto" e **0** do texto antigo. O deploy aconteceu.
4. **O que o mantenedor viu é o VALOR GRAVADO, não o placeholder.** A API devolve `banner_url: "https://res.cloudinary.com/dnln0btbo/image/upload/v1788537783/artificio_profile_banners/khmxivtocytsah6o0pap.jpg"` — o banner real que ele subiu. Placeholder só aparece em campo vazio; com valor, o input mostra o valor.

**O defeito real, e ele existe:** o campo devolve ao mestre a URL crua do Cloudinary como conteúdo editável. Depois de fazer upload por arquivo, ele encara uma string de 100 caracteres que parece código vazado — exatamente a queixa original ("o cara acha que aquilo é código vazado"), que o placeholder resolvia **só enquanto o campo estivesse vazio**. A correção anterior tratou metade do caso.

- [x] F6.4a — ~~Medir se a correção chegou~~ → **feito**: chegou; código em `main`, bundle de beta com o texto novo, `dev` == `main` == `0c8531b`.
- [x] F6.4b — ~~Distinguir bug de deploy pendente~~ → **feito: nenhum dos dois.** É o valor gravado sendo exibido cru.
- [x] F6.4c — **FEITO.** Com imagem já hospedada no Artifício, o campo de link some e ficam a prévia (que já existia) e "Trocar por um link de imagem". **`AvatarField` não precisou de mudança** (medido): o campo dele já vive num `<details>` fechado. O defeito era só do `ImageUploader` — o banner, que é o campo que o mantenedor viu.

  **Quatro correções das rodadas de review:**
  1. **O predicado estava errado, e a minha recusa anterior também.** Eu usava `isCloudinaryUrl` (que decide **importar**) para decidir **exibir**, e recusei o achado dizendo que restringi-lo mudaria o fluxo de upload. Certo quanto ao meio, errado quanto ao fim: o caso concreto é o Cloudinary **de terceiro** mantido como link direto, que não é reimportado (`useImageUrlImport:63`) **e sumia do campo**, contrariando a regra de manter link externo visível. Correção: `isArtificioHostedImage`, novo em `@artificio/media/image-kinds`.
  2. **O critério é a pasta NA POSIÇÃO em que gravamos** — logo após `image/upload/`, tolerando o segmento de versão. A primeira versão procurava a pasta em qualquer segmento, então um ARQUIVO chamado `artificio_profile_banners` passava por upload nosso; o teste que eu havia escrito usava `/foto.jpg` e não exercitava a colisão que eu mesmo introduzi (achado de review, segunda passagem).
  3. **O fecho do campo faltava nos dois caminhos de sucesso** (`onImported` e após `uploadFile`): depois de "Trocar por um link", subir arquivo ou colar link externo repunha a URL crua.
  4. **O foco se perdia ao revelar o campo.** O botão desmonta ao ser clicado e o foco caía no `<body>`. Callback ref no `TextInput`, armada só quando o mestre pede.

  **Limite conhecido, registrado no código e não fechado:** um terceiro que hospede em `<outra-conta>/image/upload/artificio_profile_banners/…` ainda passa. Medido por que não fechei: o cloud name da conta vive só no backend (`process.env.CLOUDINARY_CLOUD_NAME`, sem `VITE_`); `VITE_CLOUDINARY_CLOUD_NAME` existe como build-arg no Dockerfile e nos compose mas **nenhuma linha de `src/` a lê e nenhum workflow a valida** — um predicado de render dependendo dela se comportaria diferente conforme o build, e um build sem a env esconderia o campo de todo mundo. O dano do que resta é só de exibição (campo atrás de um clique, prévia correta); nada é gravado, importado ou apagado. **Fechar de vez é mudança de build — decisão do mantenedor.**

  **Três correções das rodadas de review, todas procedentes:**
  1. **O predicado estava errado, e a minha recusa anterior também.** Eu usava `isCloudinaryUrl` (que decide **importar**) para decidir **exibir**, e recusei o achado dizendo que restringi-lo mudaria o fluxo de upload. Estava certo quanto ao meio e errado quanto ao fim: a segunda passagem trouxe o caso concreto — Cloudinary **de terceiro** mantido como link direto não é reimportado (`useImageUrlImport:63`) **e sumia do campo**, contrariando a própria regra de manter link externo visível. Correção: `isArtificioHostedImage`, novo em `@artificio/media/image-kinds`, que olha a **pasta** (`IMAGE_KINDS[].folder`) — só o nosso backend a escreve, e nenhuma env precisa existir no frontend. `isCloudinaryUrl` volta a ser privado do hook.
  2. **O fecho do campo faltava nos dois caminhos de sucesso.** Depois de "Trocar por um link", subir arquivo **ou** colar link externo repunha a URL crua — o defeito reaberto pela porta ao lado. `setMostrarCampoDeLink(false)` em `onImported` e após `uploadFile`.
  3. **O foco se perdia ao revelar o campo.** O botão desmonta ao ser clicado e o foco caía no `<body>`: quem navega por teclado recomeçava do topo da página, na ação que acabou de pedir. Callback ref no `TextInput` (não `useEffect`, que dispararia o render em cascata que a lint reprova), armada só quando o mestre pede — dado que chega não rouba foco.

  **Furo fechado na rodada de review (commit `1262a87`):** depois de clicar em "Trocar por um link", subir arquivo **ou** colar link externo repunha a URL crua na tela — o defeito reaberto pela porta ao lado, porque `mostrarCampoDeLink` continuava `true`. `setMostrarCampoDeLink(false)` nos dois caminhos de sucesso (`onImported` e `uploadFile`).

  **Recusado, com medição:** restringir `isCloudinaryUrl` ao cloud name do Artifício. `VITE_CLOUDINARY_CLOUD_NAME` existe como build-arg (Dockerfile, compose de beta e prod) mas **não é lido por nenhuma linha de `src/`** — `rtk rg "VITE_CLOUDINARY" apps/mesas/frontend/src` devolve zero, então restringir exigiria ligar a env ao frontend e um build sem ela quebraria todo mundo. Além disso o predicado decide **importar**, não confiar (`useImageUrlImport:61`: URL do Cloudinary não é reimportada), então estreitá-lo mudaria o fluxo de upload, não a exibição. Se o mantenedor quiser fechar isso, é trabalho próprio: expor a env e restringir **na importação**.
- [x] F6.4d — **FEITO.** `ImageUploader.test.tsx`, **8 casos** — arquivo novo, o componente não tinha teste algum. Os 5 últimos vieram das rodadas de review: os dois caminhos de troca com o campo aberto, o Cloudinary de terceiro, a colisão nome-de-arquivo × nome-de-pasta, e a asserção de foco. Todos verificados por reversão.

---

## Fase 7 — conceito visual do editor de perfil

**O que o mantenedor apontou:** não é falta de texto explicativo. Os blocos não se leem como editáveis nem comunicam o peso que cada campo tem no perfil publicado. Acrescentar legenda é a correção errada — a Fase 7 mexe em forma, affordance e hierarquia.

**Trava:** vale a mesma régua da Fase 2 (≤6 tamanhos, ≤3 pesos, tokens em vez de literais) e o gate `T5.0d`. Fase de percepção não é licença para inventar escala nova.

### F7.1 — affordance de edição nos atributos da bio
- [x] F7.1a — **MEDIDO.** `ProfileFieldRow` (Especialidades, Idiomas) **já era `<button>`** — teclado nunca foi o problema. O furo é visual e de repouso: com valor preenchido, a linha desenha rótulo em `--fg` e valor em `--fg-muted`, sem borda, sem ícone, sem cor de ação — **indistinguível de texto morto**; a única pista era `.profile-field-row-trigger:hover { background: var(--fill-5) }`, e hover não existe em toque. Linha VAZIA já sinalizava ("Adicionar" em `--brand-solid` sublinhado, D21) — ou seja, o campo preenchido era o pior dos dois. Selos (`TagInput`) e Destaques (`SellingPointsEditor`) são campo real inline e não têm o defeito.
- [x] F7.1b — **PESQUISADO, e a resposta já estava no próprio repo.** O padrão para linha-que-abre-editor (Airbnb, Google Account, Notion) é ícone persistente de edição ou chevron à direita, com hover só ENFATIZANDO o que já está visível. Foi o adotado. Alternativas descartadas: borda permanente na linha (pesaria 4 molduras numa parte que já tem 4 blocos) e cor de ação no valor (violaria D6, que restringe o laranja a ação — e o valor é dado, não ação).
- [x] F7.1c — **FEITO.** Lápis (`lucide-react`) permanente à direita do valor em `ProfileFieldRow`, `opacity: 0.65` em repouso e cheio no hover/foco — presente nos dois estados, nos dois temas, sem depender de gesto nem de cor. Sem tamanho, peso ou raio novos.

  **Regressão de acessibilidade que EU introduzi, corrigida na rodada de review:** a primeira versão passou `aria-label={`Editar ${label}`}` ao botão. `aria-label` **substitui** o conteúdo, então o valor que o `<span>` interno anunciava sumiu do leitor de tela — troquei uma falta de affordance visual por uma perda de informação. Agora é `Editar ${label}: ${displayValue ?? 'vazio'}`, com o estado vazio nomeado em vez de virar silêncio.

  **Regressão de acessibilidade que EU introduzi, corrigida na rodada de review (commit `1262a87`):** a primeira versão passou `aria-label={`Editar ${label}`}` ao botão. `aria-label` **substitui** o conteúdo, então o valor que o `<span>` interno anunciava sumiu do leitor de tela — troquei uma falta de affordance visual por uma perda de informação. Agora é `Editar ${label}: ${displayValue ?? 'vazio'}`, com o estado vazio nomeado em vez de virar silêncio.

### F7.2 — o campo de slogan não se lê como destaque
- [x] F7.2a — **MEDIDO**: `TaglineField` em `ProfileEditPage.tsx:782`, entre o banner e "anos de experiência", **sem âncora nenhuma** — enquanto o comentário da linha 780 registra que o slogan encabeça hero, OG e SEO. Maior alcance da parte, menor hierarquia da página.
- [x] F7.2b — **FEITO, junto com F7.5d, como a task previa.** O slogan ganhou subtítulo próprio dizendo **onde ele aparece** ("É o título grande do seu perfil e o que aparece no Google e nos links compartilhados"), em vez de rótulo genérico. Era o campo de maior alcance da parte (encabeça hero/OG/SEO, registrado no comentário da própria linha) com a menor hierarquia da página.

### F7.3 — bloco "Sugerir atributos da bio"
- [x] F7.3a — **MEDIDO.** `BioAttributeSuggestions` renderizava um `<div className="flex flex-col gap-2">` **solto no fluxo do campo de bio** — sem moldura, sem título, sem nada que dissesse onde a ferramenta começa e o formulário termina. Os cartões de candidato usavam `rounded border` genérico, sem token: forma idêntica à de um campo já gravado. A única distinção era a frase "A análise apenas sugere" — texto, que é justamente a correção recusada pelo mantenedor.
- [x] F7.3b — **FEITO.** O bloco virou `<section className="bio-suggestions">` com moldura pontilhada, fundo `--fill-5` e título "SUGESTÕES AUTOMÁTICAS" com ícone. A separação é de forma, não de legenda.

### F7.5 — hierarquia da seção "como" (achado medido 2026-09-05, ver `spec.md` §8h)
- [x] F7.5a — **FEITO.** Os quatro blocos de `id="como"` ganharam `h3.profile-part-subtitle` + `p.section-description`, no mesmo padrão que `id="mesa"` já usava. Cada descrição diz **onde o campo aparece no perfil publicado**, não o que ele é.
- [x] F7.5b — **MEDIDO 2026-09-05** (tabela em `spec.md` §8h-bis): **9 dos 13 blocos sem subtítulo**. `quem` (4 blocos, 0 subtítulos), `como` (4 blocos, 0), `mesa` (3 blocos, 2 — grupo fechado sem âncora). `prova` e `onde` têm bloco único e estão corretos.
- [x] F7.5d — **FEITO.** Os 4 blocos de `quem` (foto, banner, slogan, anos de experiência) ganharam subtítulo. Com `como` (4) e `mesa` (1), são os **9 blocos órfãos** medidos em §8h-bis, todos fechados.
- [x] F7.5e — **FEITO, e o diagnóstico inicial estava errado.** Eu acrescentei `h3` + descrição por fora do `ClosedGroupSection`, mas o componente **já emitia os dois** (`GmProfileFields.tsx:532-535`) — o resultado foram dois títulos para o mesmo conteúdo, achado na rodada de review. O que faltava não era o subtítulo: era o **nível** dele. O componente emitia `<h2>`, competindo com o `<h2>` que o `ProfilePart` já põe (`ProfileEditPage.tsx:945`) e quebrando a escada que os blocos irmãos respeitam. Correção: meu par duplicado saiu, e o título interno virou `<h3 className="profile-part-subtitle">` — mesma classe de "Sistemas que Mestra" e "Onde você mestra". Medido: `rtk rg "<h2>" apps/mesas/frontend/src/components/mestre/editor/*.tsx` → **0**, era o único.
- [x] F7.5f — **CUMPRIDO.** `prova` e `onde` seguem sem subtítulo: bloco único já é titulado pelo `<h2>` do `ProfilePart`.
- [x] F7.5c — **CUMPRIDO.** Nenhum tamanho novo entrou na Fase 7: subtítulos usam `--text-section` e descrições `--text-support`, degraus que o editor já tinha.

### F7.6 — a ferramenta de IA parece formulário (ver `spec.md` §8i)
- [x] F7.6a — **FEITO** (mesma correção de F7.3b).
- [x] F7.6b — **FEITO.** O cartão virou `<article className="bio-suggestion-card">` com borda **pontilhada** — o mesmo vocabulário do indicador de continuação do hero (F6.1c), ou seja, "ainda não é definitivo" — mais um selo "PROPOSTA", que nomeia o estado sem depender de cor (mesma razão de D32).

### F7.7 — varredura do alcance declarado pelo mantenedor
- [x] F7.7 — **VARRIDO. Veredito de FORMA para cada item de §8**, inclusive 8a-8f, que a investigação tratara como defeito de dado: **8a** forma corrigida (rótulo + `+N` clicável); **8b** forma era o defeito inteiro — cor media 1,01:1, resolvido com rótulo; **8c** forma corrigida (chip vira controle que leva à descrição); **8d** era de fato só dado — a rota não consultava a tabela — mas a EXIBIÇÃO nova (`MestreSystems`) foi desenhada na moldura de `MestreVttPlatforms`, para as duas lerem como o mesmo tipo de resposta em vez de duas invenções de seção; **8e** é de dado e de fábrica, sem superfície visual; **8f** forma corrigida (prévia no lugar da string); **8g/8h/8h-bis/8i** são a Fase 7 e estão acima.

### F7.4 — fechamento da fase
- [ ] F7.4 — Rodar o roteiro da Fase 5 (T5.0a…T5.6). Conferência visual do mantenedor é obrigatória: nenhuma task desta fase fecha só com teste verde. · feito quando: o mantenedor confirmou nos dois temas.
