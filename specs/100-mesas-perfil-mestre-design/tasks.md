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

- [ ] T3.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [ ] T3.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru onde `rtk` cobria.
- [ ] T3.0c — Comunicação em português. · feito quando: mensagens da fase seguem o registro.
- [ ] T3.1 — Converter o hero de tela cheia centralizada em faixa de identificação alinhada à esquerda: foto, nome, selos e números de confiança em linha (D5). · feito quando: hero renderiza alinhado à esquerda, sem `min-height` de tela cheia; altura da página medida antes/depois.
- [ ] T3.1a — Agrupar os 11 blocos restantes em **3 grupos** (D5a): **Sobre** (`MestreBio`+`MestreHighlights`+`MestreSellingPoints`+`MestreVttPlatforms`), **Mesas** (`MestreTablesSection`+`MestreReviewsSection`), **Contato** (`MestreContactMethods`+`MestreContactForm`+`LinksDisplay`+`MestreClosedGroupSection`), mais hero e `MestreFinalCta`. · feito quando: a página tem 3 grupos + hero + CTA E **nenhum conteúdo se perdeu**, provado por checklist escrito: antes de agrupar, listar todo campo renderizado pelos 11 componentes; depois, marcar onde cada um aparece. A lista vai no relatório da fase — "conferido item a item" sem a lista não é evidência (`AGENTS.md` §Evidência). **Estado vazio (D20):** o grupo renderiza só os filhos preenchidos e some inteiro — título incluído — quando nenhum renderiza; os 4 componentes do grupo Sobre retornam `null` quando vazios, então sem esta regra um mestre novo veria título órfão.
- [ ] T3.2 — Renderizar `favorites` no bloco de insights do `/painel` — **é o único campo que falta**, e **não tocar em `clicks`**: executar "levar clicks ao painel" literalmente cria um segundo card de Cliques, que o requisito 12 proíbe. Medido: `views`, `contacts` e `clicks` já são exibidos (`GmInsightsDashboard.tsx:72` e `:177`), e `total_favorites` já chega ao frontend (`apps/mesas/backend/src/routes/gmPanel.ts:2112` no backend, e `useGmInsights.ts:9` no front). · feito quando: as quatro métricas aparecem uma única vez cada no painel.
- [ ] T3.2a — Migrar ao painel o que os dois componentes têm de único (D14 — reaproveitar, não apagar): a heurística `needsAttention` de `MestreInsightsSection` (10+ views, 0 contatos) e o `SEVERITY_META` de `MestreRecommendationsSection` (alto/médio/baixo com ícone). · feito quando: as duas capacidades funcionam no painel; **não** foi criado segundo bloco de recomendações (o painel já tem o seu, `GmInsightsDashboard.tsx:321-353`, de outra rota).
- [ ] T3.2b — Reorganizar o bloco de insights do painel aproveitando o que os componentes do perfil faziam melhor (D4 revisto): cards por mesa e tratamento de severidade. · feito quando: o bloco do painel exibe, por mesa, os mesmos 4 números do perfil (`views`, `clicks`, `contacts`, `favorites`) mais o aviso de `needsAttention`, e as recomendações continuam com os 3 níveis de severidade — sem segundo bloco. Critério é a lista, não a impressão de clareza.
- [ ] T3.3 — Remover `MestreInsightsSection` e `MestreRecommendationsSection` do perfil público, só depois de T3.2, T3.2a e T3.2b verdes. **Ajustar `MestrePage.layout.test.ts` na mesma edição**: ele faz `readFileSync` dos componentes na **linha 53**, iterando o array `FLOW_CHILDREN` (27-28), e quebra com **ENOENT**, não com falha de asserção. Decidir ali se os arquivos somem ou ficam sem consumidor — deixar arquivo órfão com teste verde vigiando componente morto é a armadilha oposta. · feito quando: as seções não renderizam no perfil, nada se perdeu, e a suíte de layout passa sem vigiar código morto.
- [ ] T3.3a — **(requisito 18)** Confirmar que o contato permanece no fluxo em coluna única após o agrupamento de T3.1a — sem trilho fixo à direita (D3). É verificação, não construção. · feito quando: `getComputedStyle` no contêiner do grupo Contato não devolve `position: sticky|fixed` nem `grid-template-columns` com mais de uma trilha, nos dois temas.
- [ ] T3.4 — Remover emoji dos títulos de seção e o alinhamento centralizado dos blocos de texto longo. Os emojis **não** estão em `MestrePage.tsx`: `MestreContactMethods.tsx:232` (📬), `MestreContactForm.tsx:67` (✉️), `MestreVttPlatforms.tsx:20` (🎮) e **`MestreFinalCta.tsx:66`**, cujo `<h2>` monta o emoji junto do título com quatro variantes (📋🔥⚡✨, linhas 27/36/45/54) — sem este o critério não fecha. · feito quando: busca por emoji em `<h2>` nos componentes de seção devolve zero; blocos de texto alinhados à esquerda.
- [ ] T3.4a — Fazer `MestreReviewsSection.tsx` consumir `GmReviewList`/`GmReviewForm` do `@artificio/ui` em vez de markup próprio (D12), só depois de T0.4, T0.4a e T0.4b. Hoje os dois componentes do pacote têm **zero consumidores** enquanto o app reimplementa o mesmo conceito, repetindo `text-amber-300` nas linhas 101 e 134. **Preservar, item a item** (o pacote não traz nada disso): gate `useAuth` e botão "Entre para avaliar este mestre" com `startSsoLogin` — o pacote documenta na linha 123 que o guard é do consumidor, então trocar só o markup **expõe o formulário a deslogado**; `authPost` para a rota de reviews + toast + refetch; `fetchReviews`/`normalizeReviews` e o estado de carregamento. · feito quando: busca por `amber-` devolve zero, E **teste cobre os dois estados do gate** (deslogado vê o botão de login e não o formulário; logado envia e a lista recarrega), E markdown continua funcionando na escrita e na leitura.
- [ ] T3.5 — Remover **toda** cor literal de `GmInsightsDashboard.tsx` usando os tokens semânticos: os quartis (`text-rose-300`, `amber`, `cyan`, `emerald`, linhas 44-47 e 103), o `severityConfig` (`text-red-400`, `yellow-400`, `blue-400`, linhas 38-40) e o bloco de erro (`bg-red-500/10`, `text-red-400`, linhas 20-22). A investigação classificou o `severityConfig` como fora de escopo; entra porque é cor literal na superfície que a Fase 3 reorganiza. · feito quando: busca por `-300|-400|-500/` no arquivo devolve zero.
- [ ] T3.6 — **Gate de fase (trava T4):** medir a página e remedir a tabela do `plan.md` §Objetivo. O alvo de rolagem é **direcional, não teto** (D18): ~5 telas é referência, e o critério real é "o mínimo sem perder conteúdo" (requisito 11a). · feito quando: rolagem medida e citada contra as 12,7 de origem; **se ficar acima de ~5, a justificativa está escrita** — qual conteúdo impediu comprimir mais; nenhum outro número da tabela subiu.

## Fase 4 — editor híbrido

- [ ] T4.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [ ] T4.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru onde `rtk` cobria.
- [ ] T4.0c — Comunicação em português. · feito quando: mensagens da fase seguem o registro.
- [ ] T4.1 — Converter slogan, especialidades, idiomas e anos de experiência em linhas exibindo o valor atual (D1). Bio e imagens permanecem inline. · feito quando: os quatro campos aparecem como linha com valor, e linha sem valor exibe **"Adicionar"** (D21); bio e imagens seguem inline.
- [ ] T4.2 — Implementar o modal de edição com botão "Salvar" explícito e descarte no fechar (D2), usando o `Modal` do `packages/ui` (`primitives.tsx:333-396`). O modal mantém valor em estado local e **não** chama `updateGm` enquanto aberto; "Salvar" chama uma vez e então `flushGm()` — nome exposto pelo contexto (`profileContextCore.ts:44`), não `flushGmBuffer`, que é interno ao provider. · feito quando: teste cobre **quatro** caminhos — salvar persiste, e as três vias de descarte do Modal (botão X, tecla ESC, clique no backdrop) descartam mantendo o valor anterior **no cache também**: `updateGm` faz optimistic update no enqueue (`ProfileContext.tsx:205-217`), então o teste verifica `queryClient.getQueryData(['profile','me'])`, não só o que a tela mostra. **Duplo clique em Salvar:** desabilitar o botão enquanto em voo. Hoje seria inócuo por acaso — `updateGm` é merge idempotente e `flushGm` com buffer vazio devolve `true` (`ProfileContext.tsx:240-252`) —, mas depender de acaso não é contrato.
- [ ] T4.3 — Confirmar que o autosave da spec 099 segue intacto nos campos inline (bio, imagens) e que o indicador "Salvando…/Salvo" não dispara com o modal aberto. · feito quando: suíte do autosave verde e comportamento conferido em beta.
- [ ] T4.4 — Adaptar `ProfileEditorSidebar` para agrupar linhas em vez de campos, preservando a navegação por seções (requisito 17). · feito quando: navegação lateral funciona e leva às seções corretas.
- [ ] T4.5 — Remover a barra "43% preenchido", cuja função passa a ser cumprida pelo valor ao lado de cada linha. · feito quando: barra ausente e o estado de preenchimento continua legível na lista.
- [ ] T4.4a — **(requisito 5 no editor)** Mapear aos degraus da régua as **18** classes de tamanho e os pesos dos TSX do editor (`GmProfileFields.tsx`, `ProfileEditorSidebar.tsx`, `ProfileEditPage.tsx`) — mesmo furo de T2.0g, herdado pela Fase 4. · feito quando: os TSX do editor usam só os degraus da régua; gate T4.6 mede a tela e passa.
- [ ] T4.5a — Reescrever os testes que cobrem o comportamento trocado por linha+modal: **63** em `GmProfileFields.test.tsx` (`TaglineField` "chama onChange a cada digitação", `ProfileTagsSection`) e **10** em `ProfileEditPage.test.tsx`. Reescrever, não apagar — a cobertura de cada campo continua devida, muda o gesto que ela exercita. · feito quando: os testes cobrem lista+modal com a mesma abrangência de campo de antes; suíte verde com contagem citada.
- [ ] T4.5b — Confirmar que os **9** testes de `ProfileContext.test.tsx` passam **sem alteração** — é o canário de que o autosave da 099 sobreviveu. Se algum quebrar, o modal encostou em `updateGm`: investigar a causa, **nunca ajustar o teste** para passar. · feito quando: 9/9 verdes sem edição no arquivo.
- [ ] T4.6 — **Gate de fase (trava T4):** remedir a tabela do `plan.md` §Objetivo no editor. · feito quando: tamanhos ≤ 6, pesos ≤ 3, raios ≤ 3, família = 1; valores citados e comparados com 8/4/6/2 da origem.

## Fase 5 — fechamento

**Esta fase roda ao fim de CADA fase que vai virar PR**, não só uma vez no final — com PR por fase (D10 revisto), cada uma precisa entrar verde e conferida. A numeração `T5.*` é o roteiro de fechamento, repetido por fase.

- [ ] T5.0a — Ler `AGENTS.md` inteiro antes de agir nesta fase. · feito quando: leitura confirmada.
- [ ] T5.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase. · feito quando: nenhum comando cru onde `rtk` cobria.
- [ ] T5.0c — Comunicação em português. · feito quando: mensagens da fase seguem o registro.
- [ ] T5.0d — **Gate (trava T4):** remedir a tabela do `plan.md` §Objetivo e comparar com a medição da fase anterior. · feito quando: nenhum número subiu; na última fase, os alvos foram atingidos ou o desvio está nomeado com o motivo.
- [ ] T5.1 — Rodar `rtk pnpm run test` no repo. · feito quando: verde, contagem `N/N` por app citada.
- [ ] T5.2 — Rodar `rtk pnpm run lint` no repo, **depois** de T5.1 terminar (nunca encadeado nem em paralelo — trava do `AGENTS.md`). · feito quando: verde.
- [ ] T5.3 — Rodar `rtk pnpm run build` no repo, **depois** de T5.2 terminar. · feito quando: verde.
- [ ] T5.4 — Conferência visual do mantenedor: local antes da PR da fase; em beta depois do merge dela. Na fase que toca os pacotes (Fase 0), inclui os apps consumidores. **Obrigatória — não opcional — em `PainelMestrePage`, `GmInsightsDashboard`, `MestreInsightsSection` e `MestreRecommendationsSection`: os quatro não têm teste algum**, então ali a conferência é a única rede que existe. · feito quando: mantenedor confirmou ou apontou ajuste, com os quatro arquivos sem teste explicitamente olhados nos dois temas.
- [ ] T5.4a — Rodar `rtk pnpm verify:api` **antes de montar o commit**, não depois (`AGENTS.md`): a fase toca `apps/**` e `packages/**`, e o hook pre-commit regenera `docs/api/generated/*` — se só rodar no hook, os artefatos ficam fora do commit já feito. · feito quando: `verify:api` verde e os artefatos regenerados estão no diff a commitar.
- [ ] T5.5 — Pedir autorização nominal para o commit e para a PR **desta fase** (`AGENTS.md` §Autorização — autorização de fase anterior não vale para esta, e "commite" não autoriza a PR nem vice-versa). · feito quando: autorização recebida, nomeando a ação.
- [ ] T5.6 — Após abrir/atualizar a PR, **parar** — não acompanhar checks, não rodar `gh pr view`/`gh run watch`, salvo pedido explícito (`AGENTS.md` §PR, Commit e Push). · feito quando: PR aberta e o trabalho da fase encerrado.

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
