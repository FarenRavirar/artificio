# 094 — Mesas: arquitetura de busca e filtros do catálogo

- **Módulo/Pacote:** `apps/mesas` + extensão aditiva autorizada de `packages/catalog-ui`
- **Gate relacionado:** D (Mesas já lançado; evolução pós-Gate D)
- **Status:** Fase 2 tecnicamente concluída — aprovação visual explícita de T2.11 pendente
- **Sessão:** `sessoes/26-08-21_1_mesas_094-filtros-catalogo.md`
- **Protótipo de referência:** `C:\Users\paulo\.codex\visualizations\2026\08\21\01a02490-3bd7-7353-828a-201f28bf2fb5\mesas-filtro-prototipo.html`
- **Specs relacionadas:** 081 (paridade StartPlaying) e 093, Fase 6 (geometria/ruído/normalização)
- **Regra de débito desta spec:** achado que toque frontend/backend do catálogo ou o uso de
  `packages/catalog-ui` é resolvido aqui. Só sai desta spec por decisão explícita do mantenedor.
- **Gate de fase:** cada fase de `tasks.md` termina com gate 🔁 que relê requisitos e seções
  nomeadas do `plan.md`. Divergência é corrigida antes do PR ou levada ao mantenedor; nunca se
  fecha fase seguindo apenas a checklist.

## Problema

### Gap 1 — a solução anterior fixou a estrutura errada

A spec 081 definiu a solução como “busca+sistema+modalidade+preço+nível+selos numa linha só”
(`specs/081-mesas-startplaying-feature-parity/tasks.md`, T2.2). A spec 093, Gap 10/Fase 6,
tratou altura uniforme, ruído de borda e normalização dos estilos (`spec.md:295`,
`spec.md:414-417`), sem reavaliar a arquitetura de informação.

Na página pública medida em `https://mesas.artificiorpg.com/`, viewport efetivo
`1265×720`, `getBoundingClientRect()` devolveu:

| Controle | x | y | largura | altura |
|---|---:|---:|---:|---:|
| Busca de mesas | 24 | 571 | 220 | 40 |
| Busca de sistema | 256 | 556 | 702 | 42 |
| Modalidade | 970 | 571 | 120 | 40 |
| Preço | 1102 | 571 | 96 | 40 |
| Nível | 24 | 638 | 130 | 40 |

O código confirma a causa material: a barra declarada “horizontal única” usa
`flex flex-wrap` em `CatalogoPage.tsx:449-453`. Portanto, a linha só cabe enquanto a soma dos
controles couber; quando não cabe, o último controle cai para outra linha sem hierarquia.

### Gap 2 — três buscas disputam o mesmo espaço e dois elementos repetem o mesmo ID

O DOM público contém:

1. busca do hero (`#input-busca-mesas`, submissão por botão/Enter);
2. busca textual do catálogo (`#catalog-desktop-search`, aplicação a cada `onChange`);
3. busca interna do seletor de sistemas, também gerada como `#catalog-desktop-search`.

A colisão vem de `CatalogoPage.tsx:457` e de `CatalogTree.tsx:396`, porque o catálogo passa
`idPrefix="catalog-desktop"`. Além de invalidar unicidade do DOM, as duas buscas gerais usam
modelos de interação diferentes para a mesma intenção.

### Gap 3 — o seletor de sistema virou uma subinterface inteira dentro da barra

`CatalogTree` renderiza campo de busca, níveis da árvore, seleção e uma explicação técnica. Na
barra pública isso ocupou 702 px e expôs o texto “Cada nível é um nó...”
(`packages/catalog-ui/src/CatalogTree.tsx:528-530`). A explicação documenta a implementação da
árvore, não ajuda o jogador a escolher um sistema.

### Gap 4 — filtros secundários têm o mesmo peso dos primários

Busca, sistema, modalidade, preço, experiência, selos e estilos permanecem simultaneamente
visíveis (`CatalogoPage.tsx:449-560`). A interface não separa:

- intenção primária: “o que quero jogar e em qual formato?”;
- refinamento: experiência, tipo, público, localização, certificação e estilo;
- estado aplicado: chips removíveis;
- controle dos resultados: contagem e ordenação.

O resultado é uma parede de controles, mesmo depois da redução de bordas da spec 093.

### Gap 5 — o backend já aceita filtros que o catálogo não expõe

`GET /api/v1/tables` lê `type`, `audience`, `state`, `city` e `featured`, além dos filtros já
expostos (`tables.ts:49-66`). A consulta aplica esses parâmetros em `tables.ts:170-182`.
Entretanto, `CatalogFilters` e `mapFiltersToQueryParams` só representam busca, sistema,
modalidade, preço, experiência, selo e estilos (`catalogService.ts:17-60`).

O bundle de governança medido por `artificio-api-governance search_api` registra como ativos,
públicos e sem autenticação:

- `GET /api/v1/tables`;
- `GET /api/v1/tables/style-facets`;
- `GET /api/v1/systems`.

O redesenho pode ampliar descoberta usando contratos existentes, sem endpoint novo.

### Gap 6 — a UI oferece ordenações que o backend não executa

O frontend aceita `slots` e `ending_soon` (`CatalogoPage.tsx:35`,
`ResultsHeader.tsx:36`, `CatalogoPage.tsx:655`). O backend implementa somente `popular`,
`recent`, `price_asc` e `price_desc`; `tables.ts:261` registra que `ending_soon` e `slots`
ficaram pendentes. Hoje selecionar essas opções envia um valor aceito pela UI, mas não entra em
nenhum ramo de ordenação do backend.

### Gap 7 — desktop e mobile duplicam apresentação e podem divergir

O desktop declara os controles diretamente em `CatalogoPage.tsx:449-560`; o mobile repete
busca, sistema e filtros dentro de `FilterDrawer` a partir de `CatalogoPage.tsx:579`. O estado é
compartilhado, mas a composição visual e a lista de controles são mantidas em blocos distintos.
Adicionar `type`, `audience`, `state` e `city` dessa forma aumenta o risco de paridade parcial.

## Decisões de escopo tomadas pelo mantenedor (2026-08-21)

### Entra

| Item | Decisão explícita |
|---|---|
| Redesenho | Criar auditoria e protótipo completos do filtro do Mesas porque as specs anteriores não resolveram o resultado visual. |
| Referências | Usar as duas amostras de mercado enviadas como referência de organização, sem copiar identidade visual. |
| Contratos | Aproveitar ao máximo as APIs existentes. |
| Processo | Criar uma spec SDD Completa específica para o trabalho. |

### Fica fora (decidido, não esquecido)

| Item | Motivo |
|---|---|
| Copiar marca, textos ou composição pixel a pixel das referências | As amostras são referência de arquitetura de informação. |
| Implementar código durante a reconciliação documental | A implementação segue as fases e gates de `tasks.md`; esta reconciliação fixa o guia. |

## Pesquisa de mercado aplicada (2026-08-21)

| Evidência | Achado aplicável | Consequência nesta spec |
|---|---|
| [Baymard — Horizontal Filtering Toolbars](https://baymard.com/blog/horizontal-filtering-sorting-design) | Barras horizontais funcionam quando há poucos tipos; acima de aproximadamente 6–8, opções ficam difíceis de descobrir. | Limitar a linha desktop à busca, sistema, modalidade, preço, “Mais filtros” e ação; refinamentos ficam no painel. |
| [Baymard — Applied Filters Overview](https://baymard.com/blog/how-to-design-applied-filters) | Filtros aplicados precisam ficar visíveis e removíveis próximos aos resultados. | Chips removíveis e “Limpar tudo” ficam abaixo da barra, não escondidos no painel. |
| [StartPlaying — Find Games](https://startplaying.games/search) + inspeção pública em 2026-08-21 | Busca e poucos filtros primários ocupam uma linha; atalhos ficam em faixa própria. A busca medida só aplicou ao pressionar Enter e gerou `?q=Vampire`. | Busca geral por submissão; atalhos separados; nenhuma request por caractere. |
| [StartPlaying Help Center](https://intercom.help/startplaying/en/articles/8719250-how-does-the-find-games-page-work) | O filtro de sistemas mostra somente sistemas com jogos ativos. | Facetas e opções sem resultado público não são exibidas. |
| [Algolia — URL synchronization](https://www.algolia.com/doc/guides/building-search-ui/going-further/routing-urls/react) | Sincronizar estado da busca com URL permite compartilhar e usar back/forward. | Busca, filtros e sort têm round-trip canônico na URL. |
| [W3C — Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Dialog fecha com Escape, contém o foco e o devolve ao gatilho. | Drawer/dialog mobile e seletor de sistema obedecem esse contrato. |

## Decisões aprovadas pelo mantenedor (2026-08-21) — registro autoritativo

| ID | Decisão aprovada |
|---|---|
| D0.1 | Arquitetura aprovada. Desktop: uma busca geral; sistema, modalidade e preço primários; “Mais filtros”; ação “Buscar”; atalhos em faixa separada; chips abaixo; ordenação no cabeçalho. Mobile: busca e sistema em largura total; filtros secundários em drawer/dialog com aplicar e limpar visíveis; atalhos/chips podem ter rolagem horizontal deliberada. Desktop e mobile usam a mesma definição canônica. |
| D0.2 | Política aprovada. `type`, `audience`, `state` e `city` são candidatos ao painel avançado após T0.2a; `featured` não será exposto. Uma faceta só aparece com pelo menos dois valores úteis que possuam mesas públicas; opções com zero resultados não aparecem. `state`/`city` só aparecem para presencial ou híbrida, e `city` depende da UF. Se a medição reprovar uma faceta, ela é omitida e o resultado é registrado sem nova pergunta. |
| D0.3 | Busca geral somente por botão/Enter, promovendo o draft para o estado confirmado e a URL. Não consultar mesas por caractere. A busca interna de sistemas pode filtrar localmente enquanto o usuário digita. |
| D0.4 | Implementar `slots` como `slots_open DESC, created_at DESC`; remover `ending_soon` da UI, tipos e parser enquanto não existir data final real. |
| D0.5 | Autorizada a extensão aditiva de `packages/catalog-ui` com `presentation?: 'full' | 'selection'`, default `full`. `selection` oculta parágrafo técnico, linha “nome PT” e badges de aliases, mantendo busca por nome PT/alias e preservando `site-admin`. |

Não há decisão de produto pendente para iniciar. A implementação começa após T0.2a e o baseline
T0.6 produzirem as evidências exigidas; ambos são trabalho do agente, não nova aprovação.

## Requisitos

- **R1 — Uma única busca:** a página pública terá um único campo de busca geral. Hero e barra
  não manterão estados ou campos concorrentes.
- **R2 — Hierarquia primária:** busca, sistema, modalidade, preço, botão “Mais filtros” e ação
  de buscar constituirão a linha primária no desktop.
- **R3 — Sem quebra acidental:** em viewport CSS de 1280 px, zoom 100%, a linha primária não
  quebrará; em larguras menores ela mudará por breakpoint deliberado, não por sobra de flex-wrap.
- **R4 — Filtros avançados:** experiência, tipo, público, UF/cidade, certificação e estilos
  ficam no painel ou em atalhos explícitos. `type`, `audience`, `state` e `city` obedecem R22;
  `featured` nunca aparece. `state`/`city` só aparecem para presencial ou híbrida, e `city`
  depende da UF selecionada.
- **R5 — Reuso de API:** o redesign consumirá as rotas públicas existentes de mesas, sistemas
  e facetas. Endpoint novo só entra após nova decisão do mantenedor.
- **R6 — Paridade de contrato:** todo filtro exposto deve existir em `CatalogFilters`, mapper de
  query, parser de URL, builder de URL, chips ativos, limpeza e contagem de filtros. Valores
  válidos de modalidade, preço, experiência, selo, tipo, público e sort residem em um único
  módulo canônico importado pela UI e pelo parser; listas paralelas são proibidas.
- **R7 — URL compartilhável:** filtros confirmados e ordenação sobrevivem a reload,
  back/forward e compartilhamento do URL; valores inválidos caem em defaults explícitos.
- **R8 — Sistema compacto:** o seletor mostra gatilho compacto na linha primária e abre sua
  árvore em popover/dialog adequado; não expõe explicação de implementação na página pública.
- **R9 — IDs e nomes acessíveis:** IDs do DOM são únicos; busca geral e busca de sistema têm
  nomes acessíveis distintos; labels e `aria-expanded`/`aria-controls` refletem estado real.
- **R10 — Estado aplicado próximo:** filtros ativos aparecem imediatamente abaixo da barra,
  removíveis individualmente, com “Limpar tudo” e contagem consistente.
- **R11 — Estilos progressivos:** `style-facets` continua sendo a fonte das opções/contagens;
  a página não despeja todas as facetas permanentemente. Seleção múltipla mantém a semântica
  atual de QUALQUER estilo (`&&`/overlap no backend).
- **R12 — Selos fiéis ao contrato:** DDAL e Covil do Lich continuam mutuamente exclusivos
  enquanto o backend aceitar apenas um `seal` por consulta.
- **R13 — Ordenação verdadeira:** `popular`, `recent`, `price_asc`, `price_desc` e `slots`
  constituem a lista final. `slots` ordena `slots_open DESC, created_at DESC`; `ending_soon` não
  existe na UI, tipo ou parser. Cada opção tem teste de ordem no backend.
- **R14 — Resultados preservados:** scroll infinito, deduplicação, reset para página 1,
  loading, erro, vazio e fallback “Carregar mais” continuam funcionando para todos os filtros.
- **R15 — Paridade responsiva:** desktop e mobile usam a mesma definição de filtros e produzem
  os mesmos query params; o mobile não perde filtro disponível no desktop.
- **R16 — Teclado e foco:** toda operação de abrir, fechar, selecionar, remover e limpar funciona
  por teclado; foco visível não regride em dark nem light.
- **R17 — Contraste e alvo:** controles atendem contraste WCAG AA e alvo mínimo de 44×44 CSS px
  nas ações principais e no mobile.
- **R18 — Linguagem pública:** nenhum texto sobre nós, aliases, schema, árvore persistida ou
  implementação aparece na superfície pública do catálogo. Isso inclui o parágrafo explicativo,
  a linha “nome PT” e badges com aliases. Nome PT e aliases continuam pesquisáveis internamente.
- **R19 — Eficiência:** uma busca confirmada ou alteração de filtro gera no máximo uma consulta
  nova de catálogo; sistemas/facetas continuam cacheados pelos hooks existentes; não se cria N+1.
- **R20 — Identidade Artifício:** a solução preserva tokens, tema, header e linguagem do
  Artifício; as referências de mercado influenciam organização, não branding.
- **R21 — Cobertura:** toda lógica nova/alterada de filtro, URL, sort e interação acessível terá
  teste automatizado; smoke visual real continua obrigatório porque teste unitário não aprova UI.
- **R22 — Aptidão dos dados:** T0.2a inventaria, em modo read-only, total, preenchimento,
  distribuição, cardinalidade e variantes de grafia/case das mesas publicamente elegíveis.
  `type`, `audience`, `state` ou `city` só é renderizado se houver pelo menos dois valores úteis
  com resultado público; opção com zero resultado é omitida. `state`/`city` são condicionais à
  modalidade presencial/híbrida e `city` à UF. Reprovação omite a faceta e registra a evidência,
  sem nova decisão do mantenedor.
- **R23 — Analytics preservado:** a seleção de sistema continua emitindo exatamente um
  `trackFilterSistema` com o nome público selecionado. Eventos novos não entram implicitamente;
  exigem decisão própria e uso do catálogo de `packages/analytics`.

## Critérios de aceite

1. Em `1280×720`, todos os controles primários possuem `top` na mesma linha e nenhum elemento
   aparece em segunda linha; em 320, 390, 768 e 1440 px não há overflow horizontal da página.
2. `document.querySelectorAll('[id]')` não contém ID duplicado na página montada.
3. Existe exatamente um input com nome acessível “Buscar mesas”; a busca interna do sistema usa
   nome distinto e só existe quando o seletor está aberto.
4. A frase “Cada nível é um nó”, a linha “nome PT” e badges/valores de aliases não aparecem no
   catálogo público, em dark nem light; busca por nome PT e alias ainda encontra o sistema.
5. Cada filtro habilitado pela política de R22 passa por teste de ida e volta: estado → URL → reload → mesmo
   estado → mesma query enviada ao backend.
6. O conjunto de valores aceito por cada controle é o mesmo objeto/conjunto importado pelo parser;
   teste de igualdade falha se a UI oferecer sort ou enum que o parser rejeita.
7. Tipo aceita somente `campanha|one-shot|oneshot-serie|aberta`; público somente
   `livre|adultos`; modalidade, preço e experiência preservam os enums existentes.
8. UF e cidade geram respectivamente `state` e `city`; limpar qualquer um remove somente seu
   parâmetro e reinicia `page=1`.
9. `featured` não existe em controle, `CatalogFilters`, parser, builder, chips ou URL canônica do
   catálogo; o parâmetro preexistente do backend permanece sem nova exposição pública.
10. Múltiplos estilos geram `styles` canônico, ordenado e sem duplicata; backend mantém semântica
   QUALQUER, coberta por fixture com mesa que possua apenas um dos estilos escolhidos.
11. Fixture compatível com o schema (`slots_open` 5, 2 e 0) retorna 5, 2, 0 no sort `slots`;
   empates são resolvidos por `created_at DESC`. O comentário obsoleto sobre `slots_available`
   é corrigido junto.
12. `ending_soon` não aparece na UI nem no registro canônico de sorts enquanto não houver contrato de data
   final aprovado e implementado.
13. Uma alteração de filtro reinicia página 1 e limpa acumulado anterior; teste do hook prova que
   nenhum resultado da consulta anterior permanece.
14. Desktop e mobile produzem o mesmo `URLSearchParams` para uma matriz de pelo menos seis
    combinações, incluindo filtros avançados, estilos múltiplos **e todos os sorts aprovados**.
15. Antes da Fase 1, relatório T0.2a read-only registra, sobre o mesmo predicado de visibilidade pública
    da rota, total elegível e contagens/distribuições de `type`, `audience`, `state`, `city` e
    `featured`; valores vazios, variantes de case/grafia e opções com zero resultado ficam visíveis
    ao mantenedor. O relatório aplica a regra de dois valores úteis, zero resultados e dependência
    modalidade→UF→cidade, registrando facetas incluídas/omitidas. Credenciais e dados pessoais
    não entram no artefato.
16. Selecionar sistema emite exatamente uma chamada `trackFilterSistema`; abrir “Mais filtros”,
    submeter busca ou aplicar filtro avançado não cria evento novo sem decisão explícita.
17. Smoke manual registra dark/light e teclado em 320, 390, 768, 1280 e 1440 px, incluindo painel
    aberto, filtros ativos, nenhum resultado, carregamento e erro.
18. `rtk tsc`, lint e testes focados de frontend/backend ficam verdes; `rtk pnpm verify:api` retorna
    `breaking=0` para qualquer mudança em `apps/**`/`packages/**`.
19. O mantenedor aprova visualmente a página rodando antes do fechamento. Protótipo, screenshot ou
    compilação sem runtime não satisfazem esse critério.

## Fora de escopo

- Filtro por agenda/dia/horário: a API pública de catálogo não aceita esse parâmetro hoje.
- Filtro “encerrando em breve”: não há campo de data final no contrato atual.
- Status público: a rota já restringe catálogo a mesas `active`; não haverá seletor enganoso.
- Reescrever ranking de relevância/popularidade além da decisão específica sobre `slots`.
- Alterar schema ou executar migration.
- Redesenhar cards, página da mesa, perfil do mestre, header ou footer.
- Alterar autenticação, SSO, `packages/auth` ou `accounts.`.
- Copiar componentes ou identidade das referências de mercado.
- Deploy, promoção, DNS, tunnel ou escrita em banco nesta spec sem aprovação nominal própria.

## Riscos e impacto em outros módulos

- **`packages/catalog-ui`:** D0.5 autoriza tocar o pacote compartilhado consumido por Mesas e
  `site-admin`. A mudança é aditiva, default-preserving, com testes do pacote e smoke dos dois
  consumidores.
- **URL público:** adicionar facetas habilitadas é aditivo; `slots` passa a ser válido e
  `ending_soon` legado deve normalizar para `popular` sem quebrar a página.
- **Carga:** busca por caractere hoje pode disparar várias queries. D0.3 fixa submissão por
  botão/Enter; somente a busca interna de sistemas filtra localmente por caractere.
- **Localização:** `city ILIKE %valor%` já existe, mas texto livre pode produzir zero resultado por
  grafia. Esta spec não normaliza cidades nem cria catálogo geográfico.
- **`featured`:** o backend mantém o parâmetro preexistente, mas D0.2 proíbe sua exposição no
  catálogo. Não entra em tipo, UI, parser, builder, chips ou URL canônica do frontend.
- **Ordenação:** implementar `slots` muda comportamento observável. Testes de zero vagas e
  desempate por recência são obrigatórios; a coluna é `NOT NULL` desde migration
  100, portanto fixtures `null` do domínio de parser não representam uma linha válida de
  `tables`.
