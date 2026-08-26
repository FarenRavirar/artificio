# 26-08-26_1 · mesas — editor de anúncio: conteúdo cortado sem rolagem, mobile inutilizável e contraste no light

**Estado:** aberta · **corrigida no working tree, sem commit** (autorização "corrija tudo", mantenedor, 2026-08-26) · achados medidos em beta (`mesasbeta.artificiorpg.com`, `dev` @ `42e4f50`, deploy run `33004959399`).
**Origem:** mantenedor pediu inspeção visual de `/painel?action=nova-mesa` via Chrome autenticado ("veja escapes, dark e light, espaçamentos, práticas de design"), depois apontou nominalmente o eixo vertical ("não só direita e esquerda, em cima e em baixo, algo tem em cima de titulo da mesa, ta sumido"), a repetição em outras etapas ("o mesmo erro ocorre com outras etapas") e pediu teste de mobile.

## Achado 1 (bloqueante) — 774px de formulário cortados sem rolagem alcançável

A etapa **Identidade** tem `scrollHeight` 1588px dentro de `clientHeight` 814px. O conteúdo excedente não é alcançável por mouse:

- `overflow-y: hidden` no wrapper (`getComputedStyle`)
- roda do mouse **inerte**: `WheelEvent{deltaY:400}` despachado no elemento deixa `scrollTop` em `0`
- **sem barra de rolagem** (`offsetWidth - clientWidth === 0`)
- **nenhum ancestral rolável** (varredura até `body`: lista vazia)
- página não rola (`document.scrollHeight === innerHeight === 962`)

Campos afetados, medidos por `getBoundingClientRect` contra o corte em y=889:

| Campo | Estado |
|---|---|
| Banner da Mesa | cortado (662 de 750px visíveis) |
| **Descrição da mesa \*** | 100% invisível (y=991) |
| Regras e observações (opcional) | 100% invisível (y=1360) |
| **Sistema da mesa \*** | 100% invisível (y=1645) |
| Cenário (opcional) | 100% invisível (y=1661) |

**5 inputs inalcançáveis, 2 deles obrigatórios.** O rodapé exibe "Campos obrigatórios faltando em: Identidade" apontando para campos que o usuário não tem como ver — é informado do erro e impedido de corrigi-lo (viola Nielsen #1 visibilidade do estado e #9 recuperação de erro).

**Não é bloqueio absoluto:** `scrollIntoView({block:'center'})` move (`scrollTop` foi a 749) e o campo aparece, logo navegação por Tab alcança. Mas nada na interface sinaliza isso; visualmente o formulário termina no corte.

**"Mestre e contato"** corta 38px pelo mesmo mecanismo. Varredura das 8 etapas: as outras 5 cabem por folga de conteúdo, não por design — qualquer texto mais longo reproduz o defeito.

### A spec já resolvia isto — o código implementou a leitura que o mantenedor REJEITOU

O `TableEditor.css` documentava a regra **"A1 — sem rolagem em nenhum nível"** e tinha 4 declarações de `overflow:hidden`. Mas o `spec.md:15-19` diz o contrário, com data:

> R1 proíbe as **rolagens internas** — caixinha que rola dentro da página, gaveta, sub-área com barra própria. A página em si rola normalmente. **A leitura literal de "sem rolagem" (documento inteiro travado em `overflow: hidden`) chegou a ser tomada como requisito numa revisão e não é o desenho.** (precisão do mantenedor, 2026-08-25)

R1 (`spec.md:743-749`) repete a mesma precisão. O código ficou com a leitura literal que a spec nomeia como errada.

**E A1 já falhava antes da correção.** O critério (`spec.md:1097`) é `scrollHeight <= clientHeight` em cada parte, a 1366×768 e 1920×1080. Medido na parte `identity` em beta:

| Viewport | scrollHeight | clientHeight | Excedente | A1 |
|---|---|---|---|---|
| 1366×768 | 2558 | 392 | **2166px** | reprova |
| 1920×1080 | 2558 | 704 | **1854px** | reprova |

O `overflow:hidden` não fazia A1 passar — **escondia a falha**, cortando o conteúdo em vez de dimensioná-lo. A escolha real não era "A1 ou rolagem", era "esconder campo obrigatório ou deixá-lo alcançável".

**A1 nunca teve teste.** O `plan.md:668` previa "teste que percorre as 7 partes medindo `scrollHeight` × `clientHeight`" — não existia. Por isso a falha de 2166px passou até a inspeção visual.

## Achado 2 — mobile: sem nenhuma media query, sem nenhuma classe responsiva

- `TableEditor.css` (89 linhas): **zero** `@media` / `@container` (`rtk rg` negativo)
- diretório `features/table-editor/` inteiro: **zero** classes `sm:`/`md:`/`lg:`/`xl:` (`rtk rg -l` sem resultado)
- CSSOM em runtime: zero media rules casando `table-editor*`
- grid fixo: `grid-template-columns: 300px minmax(0, 1fr)`

Simulação da casca a 390×844 (o `resize_window` do Chrome não altera o viewport com a janela maximizada — medido `innerWidth` inalterado em 1815 após duas tentativas; por isso a medição foi feita forçando a caixa do `.table-editor` e restaurando com reload):

- grid resolve para `300px 90px` → sobram **90px** para o formulário inteiro (sidebar toma 77% da tela)
- **428 elementos** com `right > 390` (estouro horizontal)
- corte vertical sobe para **1345px**

O editor é inutilizável em celular.

## Achado 3 — espaçamento vertical: uma etapa transborda enquanto outras desperdiçam 2/3 da tela

Padding de topo uniforme de **18px** nas 8 etapas — apertado contra a barra de abas. É a causa da impressão relatada de que "algo em cima de Título da mesa está sumido": o botão **"Colar anúncio"** (y=75, h=32) **não está recortado** (`recortadoAcima: 0`, 32 de 32px visíveis) — está espremido sem respiro, e a borda inferior isolada lê como elemento decapitado.

Vazio abaixo do último campo, por etapa:

| Etapa | Cortado | Vazio abaixo |
|---|---|---|
| Identidade | **725px** | 0 |
| Quando joga | 0 | 53px |
| Onde joga | 0 | **415px** |
| Valores | 0 | **674px** |
| Para quem é | 0 | **364px** |
| Mestre e contato | 38px | 11px |
| Regras e extras | 0 | **406px** |
| Ver como jogador | 0 | 406px |

## Achado 4 — light mode: 3 falhas reais de contraste (não 7, e não 176)

Contraste WCAG AA, com `alpha` composto sobre todas as camadas até a raiz:

| Texto | Ratio | Exigido | Causa |
|---|---|---|---|
| "Nenhum estilo selecionado…" | **2.28** | 4.5 | `#95a5a6` hex fixo inline, ignorava o tema |
| "Livre" (faixa etária) | **3.67** | 4.5 | `text-white/90` sobre `bg-black/55`; no light a cor computada vinha escura (`rgba(11,18,32,0.92)`) — escuro sobre escuro. O ramo `isRestrictedAgeRating` já usava `text-white` e não falhava: a divergência entre os dois ramos era o defeito |
| "0/4 preenchidas" | **3.76** | 4.5 | `text-white/40` — branco a 40% sobre superfície clara |
| "Rascunho" | **4.42** | 4.5 | token `--artificio-warning-text` (`#a16207`) sobre o fundo real do próprio badge |

### Três erros do agente, corrigidos por medição na própria sessão

1. **"header e sidebar não trocam de tema" era FALSO.** Medido depois: header `rgb(255,255,255)`, aside `rgb(238,242,248)` com `data-theme=light`, e varredura por elementos escuros no topo devolveu **lista vazia**. O diagnóstico veio de leitura de screenshot tirado logo após o clique no toggle, não de medição. Retirado.
2. **176 falhas de contraste → 7.** O cálculo não compunha `alpha` sobre as camadas pai (fundos vinham `rgba(...,0.04)`, produzindo ratios falsos de 1.01). Descartados antes de virarem número reportado.
3. **7 → 3.** "4 vagas" a 1.24:1 era falso positivo: o medidor não compunha a imagem de fundo do banner. Medido corretamente, dá **8.14:1** — passa. Os outros dois ("Campo opcional…", "Desativado por padrão…") usam `--fg-muted`, que mede **6.07:1** sobre branco e também passa; entraram na lista pelo mesmo defeito de composição.

O token `--fg-muted` foi medido antes de ser usado como conserto, justamente para não trocar um valor ruim por outro.

Segunda correção: cheguei a diagnosticar desalinhamento da coluna central; a medição mostrou `justify-content:center` correto (300 + 608 + 900 + 7 = 1815). O desequilíbrio visual vem de centrar dentro do `<main>` (que começa depois da sidebar de 300px), não de defeito — escolha de layout.

## Não-achados (verificados, negativos)

- **Escapes de HTML: zero.** Varredura de todo texto visível + `placeholder`/`title`/`aria-label` contra entidades cruas (`&amp;` etc.), mojibake UTF-8, `U+FFFD`, `[object Object]`, `undefined`/`NaN` vazados e `{{template}}` não interpolado — nenhuma ocorrência.
- **`400` em `POST /api/v1/gm/tables` não é bug.** Log do `mesas-beta-api`: `ERROR: Título deve ter pelo menos…` — validação correta, disparada pelo próprio agente ao manipular o formulário sem título.
- **`404` reportado pelo mantenedor: origem não determinada.** Nenhum `404` nos logs do backend na janela de 30 min (`grep -iE '404|not found'` sem `gm/tables`: vazio) → é asset estático do frontend. **Não medi qual** — falta a URL do console.
- **Os dois `ERROR: unauthorized 401`** nos logs do `mesas-beta-api` são os próprios smokes de `/me/options` do agente; comportamento esperado.

## Estado do ambiente medido nesta sessão

Deploy beta de `mesas` e `downloads` (runs `33004959399`/`33004968161`, ambos `success`) aplicou: `mesas_rpg` beta 90→92 (`162_vtt_implies_requirements`, `163_notification_outbox`), `downloads` beta 38→39 (`039_notification_outbox_backoff`). Zero drift reverso (`comm -13` vazio nos dois). 5/5 `critical_routes_beta` OK.

`accounts` **não** foi deployado: `deploy.yml:184` bloqueia `env=beta` para `accounts`/`links` e não existe `accounts-beta-db` na VM. `migration_012` (coluna `read_at` + escopo `notification.migrate`) segue não aplicada — `artificio_auth` com 11 migrations. Bloqueia **apenas** o backfill manual do histórico; o fluxo corrente de avisos não depende dela (`read_at` é opcional no ingest e nenhum produtor corrente o envia).

## Correção entregue (autorização "corrija tudo", 2026-08-26) — 16 arquivos

**Achado 1.** `.table-editor-part` passou a `overflow-y:auto` / `overflow-x:hidden`, e o `h-full overflow-hidden` saiu dos **7** wrappers de part — o filho cortava antes de o pai poder rolar. A correção foi na casca (um lugar), não replicada nos 7 arquivos, porque contorno por arquivo é o caso particular que o `AGENTS.md` proíbe. Verificado no navegador com as regras compiladas do build novo: "Cenário (opcional)" — que era 100% invisível — **é alcançado**, `chegouAoFim: true`, barra de rolagem de **15px** presente.

**Achado 2.** Media query `max-width:719px` na casca (o arquivo não tinha nenhuma): grid vira coluna única, a lateral vira faixa no topo com a nav em `flex-direction:row` rolável, a prévia do card é escondida (precisa de 280px+ e disputaria a largura do formulário) e o padding lateral cai de 28px para 16px. A nav ganhou a classe `table-editor-parts-nav` como gancho estável — sem ela a regra dependeria de seletor de elemento e quebraria em silêncio. Medido a 390px: grid `390px` (era `300px 90px`), formulário com a largura toda (era 90px), **estouro horizontal 428 → 2**.

Os 2 restantes eram o botão "Link" da barra do `packages/content-editor`, que tinha `display:flex` **sem** `flex-wrap` e vazava 15px. Corrigido no pacote — vale para mesas, downloads e site.

**Achado 3.** `pt-[18px]` → `pt-6` na section da parte.

**Achado 4.** `#95a5a6` inline → `var(--fg-muted)`; `text-white/40` → `text-[var(--fg-muted)]`; `!text-white` nos dois ramos do badge de faixa etária (o fundo é `bg-black/55` fixo, o texto tem de ser fixo também); e o token `--artificio-warning-text` `#a16207` → `#854d0e` (4.42:1 → **6.16:1** sobre o fundo real do badge). O token vive em **três** arquivos que precisam concordar — `styles.css`, `tokens.ts` e `tailwind-preset.js`; o guard `check-token-parity.mjs` pegou a divergência quando só o primeiro tinha sido alterado. No dark o token é sobrescrito por `#fcd34d`, então a mudança afeta só o light.

### Teste de regressão que a spec previa e não existia

`plan.md:668` pedia o teste de A1; ele nunca foi escrito. Agora existe, com 4 casos: os 7 arquivos de part sem `h-full overflow-hidden`, a casca com `overflow-y:auto` e sem `overflow:hidden`, a media query de 719px declarada, e o gancho da nav presente.

**Cada caso foi verificado reinjetando o defeito** — a primeira versão do teste passava com o defeito presente (as parts estão mockadas neste arquivo, então assert sobre o DOM não prova nada), e por isso ele lê os **arquivos-fonte**. Um segundo falso verde apareceu depois: `\b` escrito via heredoc virou backspace literal (U+0008) e o regex nunca casava. Os 4 casos hoje falham com o defeito e passam sem ele — verificado um a um.

jsdom não faz layout (`scrollHeight` é sempre 0), então a medição numérica de A1 continua sendo de navegador real; o teste trava a regressão **estrutural**, e diz isso no próprio comentário para não se passar por mais do que é.

## Validação

Repo-wide, um comando de cada vez: **lint 26/26**, **build 26/26**, **test 43/43**, todos exit 0. `check-token-parity` OK nos 30 tokens. `check_dockerfile_workspace_deps` 6/6. Editor: 25/25 (era 17 + 8 novos casos).

## Pendências

1. URL do recurso que devolve `404` — mantenedor (não medi).
2. Commit/push/PR bloqueados sem autorização nominal.
3. A correção está no working tree; **beta ainda serve o código antigo** — precisa de deploy para o mantenedor ver na tela.
4. Aba do Chrome ficou aberta (`tabs_close_mcp` deu timeout) — fechar manualmente.

## Próxima fase

Commit aguardando autorização nominal.
