# 086 — Downloads: metadata rica, taxonomia e reconstrução do catálogo público

- **Módulo/Pacote:** apps/downloads/backend + apps/downloads/frontend
- **Gate relacionado:** D (Downloads é o projeto/app ativo neste ciclo)
- **Decisões de escopo:** todas as perguntas bloqueantes desta spec foram respondidas pelo mantenedor em 2026-07-25 (registro em `sessoes/2026-07-25-downloads-086-metadata-rica.md`). O que está marcado abaixo como decidido **foi de fato decidido**; nada aqui é inferência do agente.
- **Regra de débito desta spec (decisão do mantenedor, 2026-07-25):** débito ou achado descoberto durante a implementação que toque **frontend ou backend é resolvido aqui**, nesta spec. Não vira linha de backlog "pra depois". O agente **não decide** adiar; na dúvida sobre escopo ou forma, pergunta ao mantenedor. Só sai desta spec o que o mantenedor mandar sair, explicitamente. (Isto corrige uma tentativa do agente de registrar o `material_type` texto livre como débito futuro — virou o requisito 25, task T5.5.)
- **Gate de fase:** cada fase de `tasks.md` termina com uma task 🔁 que obriga a **reler `spec.md` e `plan.md`** e conferir a implementação contra os requisitos nomeados antes do PR — porque `tasks.md` é resumo e quem implementa tende a ficar preso na checklist. Divergência: corrigir, ou perguntar se a spec é que está errada. Nunca seguir o `tasks.md` contra a spec em silêncio.
- **Review de bot (decisão do mantenedor, 2026-07-25):** cada fase abre PR, então cada fase recebe review automático. **Correção que vira código é documentada em comentário no próprio código**, no ponto corrigido, citando origem (PR + bot + severidade), o que estava errado de fato e por que a correção é essa — padrão `Achado real (review PR #NNN, <bot>, <P1|P2|nitpick>): …`, já consolidado nesta base (`routes/scraper.ts:150`, `services/priceRecheckJob.ts:13`, `apps/downloads/Dockerfile:42`, `migration_023_*.sql` no `@description`). **Não** em sessão nem em arquivo de review (`reviews.md`/`debitos.md` estão deprecados): o comentário fica onde o próximo agente vai ler, junto do código que ele poderia desfazer sem saber por quê. Achado que **não** vira código vai pra `tasks.md` + `specs/backlog.md`, com o porquê. Correção é a **completa**, não a mínima que faz o sintoma sumir (`AGENTS.md`). O agente **nunca** escreve na conversa do PR. Detalhe em `tasks.md` §"Review de bot".

## Problema

Achado do mantenedor (2026-07-25, revisão do primeiro material real publicado em beta — `https://downloadsbeta.artificiorpg.com/materiais/a-masmorra-de-akriona`): o catálogo público do Downloads está muito distante de um catálogo real de materiais de RPG. O mantenedor forneceu 5 capturas de referência de páginas reais da família OneBookShelf (`C:\projetos\artificio\temp\*.png`) e um HTML real completo (`C:\projetos\artificio\temp\exemplo_de_codigo.txt`, 153 KB, produto DriveThruRPG "Warhammer Fantasy Roleplay: Sylvania The Cursed County").

A investigação desta spec cruzou essas referências com os 3 fixtures reais do repositório (`apps/downloads/backend/test/fixtures/dms-guild-product-1.html`, `drivethrurpg-product-1.html`, `storytellersvault-product-1.html`) e com o código atual. Oito gaps confirmados por evidência material:

### 1. Metadata rica nunca é extraída (tabela `data-codeid`)

Página de produto OneBookShelf tem uma tabela de detalhes estruturada, fora do JSON-LD, com atributo `data-codeid` estável por linha. Confirmado nos 3 fixtures **e** no HTML fornecido pelo mantenedor:

| `data-codeid` | Label visual | Valor real (fixture DMs Guild / exemplo do mantenedor) |
|---|---|---|
| `ruleSystem` | Cenário / Rule System | "Inespecífico/Qualquer mundo" / "Fourth Edition" |
| `authors` | Autor(es) | "Felix Klaus" / "Dominic McDowall, Calum Collins, …" |
| `artists` | Artista(s) | "Angevine , Dall.e" / "Samuel Allan, Helge C. Balzer, …" |
| `creationMethod` | Método de criação | "Contains AI-Generated Content" / "Human-Created Without AI" |
| `filters` | Filtros | árvore hierárquica com facet tipado (ver gap 2) |
| `fileSize` | Tamanho do arquivo | "44,49 MB" / "47.22 MB" |
| `format` | Formato | "PDF" |
| `dateModified` | Última atualização (na fonte) | "20 de jan. de 2025" / "Jul 21, 2026" |
| `dateCreated` | Adicionado ao catálogo (na fonte) | "1 de mar. de 2024" / "Jul 21, 2026" |
| `sku` | Referência do(a) editor(a) | "N / D" / "CB72825PDF" |
| `isbn` | ISBN | "N / D" |
| `languageFilters` | Languages | "Português" |

Nenhum é extraído hoje — nem pelo caminho genérico (`genericHtmlParser.ts`, corretamente: não é JSON-LD) nem pelo override `onebookshelf` (`platformOverrides/onebookshelf.ts`, que só resolve `isFreeOrPwyw`/`priceSignal` via tag PWYW).

**Correção da versão anterior desta spec:** ela listava 11 campos e **esquecia `isbn`**, presente nos 3 fixtures. São 12.

### 2. `filters` é árvore com facet tipado, não lista plana

HTML real (fixture DMs Guild):

```html
<ul>
  <li><a href="/pt/browse?tipoDeProduto=45397-opcoes-para-personagens">Opções para personagens</a>
      <i class="fas fa-chevron-right"></i>
      <a href="/pt/browse?tipoDeProduto=45426-classe-arquetipo">Classe/Arquétipo</a></li>
  <li><a href="/pt/browse?conteudo=45469-dmsguild">DMsGuild</a></li>
  <li><a href="/pt/browse?edicao=1000261-5th-edition">5th Edition</a>
      <i class="fas fa-chevron-right"></i>
      <a href="/pt/browse?edicao=45462-5e">5e</a></li>
</ul>
```

Cada `href` carrega um **facet tipado** (`tipoDeProduto`, `conteudo`, `edicao`, `cenario`) e a relação pai › filho. Achatar em `tags: string[]` descartaria a hierarquia **e** o tipo de facet — exatamente a informação que permitiria mapear pra taxonomia interna.

### 3. `data-codeid` não é exclusivo da tabela de detalhes

O fixture `storytellersvault-product-1.html` e o HTML do mantenedor têm `data-codeid="badgeType"`, `"commentText"`, `"customerName"`, `"discussionDate"` (6 e 4 ocorrências, respectivamente) no bloco de avaliações de clientes. Regex ancorada só no atributo captura comentário de cliente como metadata do produto. A extração precisa ancorar na `<table class="table-list">`.

### 4. Descrição da fonte é HTML rico; JSON-LD só entrega versão truncada

O JSON-LD do exemplo do mantenedor traz `description` cortada em ~500 caracteres (termina em "the darkest…"). O HTML real, em `obs-product-description`, tem o conteúdo completo com `<img>` (banner promocional), `<strong>`, `<em>`, `<ul><li>`, `<a href>`, `style="text-align:center"`. Presente nos 3 fixtures.

Hoje: `genericHtmlParser.ts:310` passa a descrição por `sanitizeText()`, que faz **strip total de tags** (`sanitizeText.ts`, decisão da spec 075: "nenhum campo do painel admin permite HTML rico"); `MaterialPage.tsx` renderiza com `whitespace-pre-wrap`. Resultado: descrição pobre e truncada.

### 5. Dado já persistido e já servido pela API nunca é exibido

- `GET /api/v1/material-metadata/:materialId` (público, `auth: none`) faz `selectAll()` — **já devolve** `cover_image_url`, `scenario`, `file_format`, `tags`, `credits` hoje, em produção.
- O Zod do frontend (`useMaterialMetadata.ts`) declara **apenas** `material_id`, `publisher_name`, `credits`, `license_kind`, `license_url`, `language` — o resto é descartado no parse.
- `MaterialCard.tsx` tem placeholder `"Sem capa"` **hardcoded incondicional**, mesmo com URL no banco.
- `MaterialPage.tsx` não renderiza imagem nem seção de metadata.
- `GET /materials` (listagem) usa `PUBLIC_MATERIAL_FIELDS` só de `download_material` — **sem join** com `download_material_metadata`. O card precisa de join novo.

### 6. Scraper nunca preenche taxonomia

`scraperIngest.ts:155-162` grava em `download_material_metadata` apenas `language`, `publisher_name`, `cover_image_url`. `system_id`/`edition_id` de `download_material` ficam `null` em **todo** material de origem scraper. Consequência: o filtro por sistema/edição (suportado no backend desde D073) filtra praticamente nada.

Decisão do mantenedor: **material não pode ficar sem taxonomia.**

### 7. `catalogClient.ts` do Downloads documentava regra inexistente

O comentário do arquivo afirmava "Downloads consome (nunca escreve) […] escrita de sistema/edição continua proibida aqui […] (D097)". Leitura errada: D097 ("catálogo central, administração distribuída") e D099 dizem o oposto — sistemas/edições **podem** ser administrados a partir de mesas, glossário ou downloads, e "todos leem e escrevem integralmente nele". O que D097 reserva ao admin do site é a gestão *principal/completa*, não a exclusividade de escrita.

**Já corrigido nesta branch** (débito documental de código): comentário reescrito citando D097/D099 e o fluxo-alvo de sugestão. Registrar em `specs/backlog.md`.

### 8. Frontend: distância concreta do que o mantenedor quer

| Print de referência | Estado hoje |
|---|---|
| Bloco "DETALHES" em 2 colunas (`apresentação dos dados do produto.png`) | inexistente |
| Faixa de tiles com ícone: Cenário / Formato / Adicionado ao catálogo (`outra captura.png`) | inexistente |
| Chips de filtro com `+` e `⊗` (`subnav importante.png`) | zero UI de filtro — só query param invisível |
| Header 2 colunas: capa \| título, "Para \<cenário\>", "Por \<autores\>", CTA (`mais prints com aprenddizados.png`) | 1 coluna `max-w-3xl`, `<h1>` + 2 badges |
| Descrição com imagem/negrito/listas | `whitespace-pre-wrap` texto plano |

Além disso, a nav pública tem "Sobre e uso" ocupando slot. A página (`SobreEUsoPage.tsx`, lida na íntegra) é **100% institucional** — idioma, PWYW, como funciona o download, transparência de indexação, moderação, direitos autorais. **Corrige a premissa registrada em T0.4 da versão anterior desta spec:** nada do conteúdo dela "é catálogo", então não há o que redistribuir — a página vai inteira pro footer.

### 9. Dois design systems administrativos paralelos, nenhum compartilhado

O mantenedor apontou (2026-07-25) que a área lateral/estilística deve ser padronizada a partir do que o mesas já tem em `https://mesas.artificiorpg.com/gestao`, para ser reusada em outras áreas do projeto. A investigação confirmou o gap:

**O que o mesas tem** (`apps/mesas/frontend/src/features/admin/`, não compartilhado): `AdminSidebar` (rail com border-left ativa e badge de pendência), `AdminMain` (header sticky com eyebrow + breadcrumb + ações), `AdminWorkspaceLayout` (workspace + inspector de 400 px), `Breadcrumb`, e um UI kit em `components/ui/`: `PageHeader`, `SectionCard`, `MetricCard`, `StatusPill` (6 tons semânticos), `AdminTable` (14,7 KB — facetas, seleção em massa, ações de linha), `bulkActions`, `tabButtonClass`, `cn`.

**O que o Downloads tem** (`components/GestaoShell.tsx`): sidebar própria, sem rail, sem breadcrumb, sem header contextual, sem cards de seção/métrica, sem tabela padronizada. Drawer mobile reimplementado à mão.

**Divergência de tokens, mensurável:** mesas usa `--admin-rail`/`--admin-surface`/`--admin-canvas`/`--admin-hover`/`--fg-low`/`--fg-faint`/`--shadow-card`, definidos **apenas** em `apps/mesas/frontend/src/index.css` (dark nas linhas 32-34/72, light nas 204-206/227). Downloads usa `--surface-subtle`/`--line`/`--fg-muted` + `bg-artificio-orange/20` e **não define nenhum token `--admin-*`**.

**`packages/ui` não cobre nada disso:** tem primitivos públicos (`Header`, `Footer`, `Button`, `Badge`, `Panel`, `Drawer`, `Modal`, `TextInput`, `Select`, `Toolbar`, `EmptyState`…) e zero shell administrativo. Também **não tem** `react-router-dom` nem `lucide-react` nas dependências — só `react`/`react-dom` + `@artificio/{auth,config,changelog}`.

### 10. Armadilhas de implementação achadas na conferência final (2026-07-25)

Verificadas no código depois das decisões de escopo, todas com consequência prática pra quem implementa:

- **A cadeia preview→banco tem 4 pontos, não 2.** `ScrapedItem` (`scrapers/types.ts`) → `PlatformOverrideInput` + `genericParsePreviewSchema` → `ingestItemSchema` (`routes/scraper.ts:134`) → `scraperIngest`. `/parse-html` e `/ingest` são chamadas **separadas** (o admin confere o preview e reenvia). Campo ausente em `ingestItemSchema` é **removido pelo Zod sem erro**: aparece no preview e nunca chega ao banco. Só um teste de ponta a ponta pega isso.
- **`summary` é derivado de `description.slice(0, 500)`** (`scraperIngest.ts:140`). Se a descrição virar HTML, o slice corta no meio de uma tag e o HTML quebrado vaza pro `ilike` da busca (`routes/materials.ts:98`) e pro card. Por isso a descrição passa a ser **dois campos**: `download_material.description` texto plano (busca/`summary`/SEO/histórico) e `download_material_metadata.description_html` (exibição).
- **`material_type` é `z.string().trim()` livre, não enum** (`routes/materials.ts:21`), preenchido por `<input>` de texto digitado (`NovoMaterialPage.tsx:17`) — permite "aventura"/"Aventura"/"aventuras" como valores distintos. E **não existe faceta/agregação nenhuma** no backend. O filtro visível (requisito 13) não tinha de onde tirar as opções — daí o requisito 23 (facetas) **e** o 25 (normalizar o campo, que toca front e back, então é resolvido nesta spec por decisão do mantenedor).
- **`Drawer` de `packages/ui` não tem foco preso** (`primitives.tsx:394-437`) e o drawer à mão do `GestaoShell` também não. D108 exige — é implementação nova, não reaproveitamento.
- **`packages/ui` não tem DOM em teste** (`vitest.config.ts`: `environment: "node"`; único teste roda por `renderToStaticMarkup`). Teste de interação do kit exige decisão explícita (dep nova de jsdom, ou cobrir no app consumidor).
- **`Footer` de `packages/ui` não aceita link extra por app** — props são só `variant`, `navItems`, `brandHref`, `copyrightHref`. Colocar "Sobre e uso" ali exige prop nova (aditiva) ou alternativa.
- **`adminSummarySchema` é objeto Zod fechado com 3 filas** (`useAdminSummary.ts:10-14`). Contador novo na sidebar exige mudar rota **e** schema, não é só UI.

## Decisões de escopo tomadas pelo mantenedor (2026-07-25)

### Entra

| Item | Decisão |
|---|---|
| `fileSize` | persiste (coluna nova) |
| Page Count | persiste (coluna nova) — **não vem da tabela `data-codeid`**, vem dos tiles (requisito 2) |
| `creationMethod` | persiste (coluna nova) |
| `filters` | JSONB estruturado (facet + caminho) **e** `tags` derivadas achatadas |
| Categoria/linha de produto (tile) | persiste |
| Descrição HTML rico | entra completo: extração + sanitização + **editor visual TipTap** |
| Taxonomia | mapear `ruleSystem`/Category contra o catálogo central; fila de sugestão com triagem admin |
| Ficha do material | reconstrução completa, fiel aos prints |
| Filtro do catálogo | controles na sidebar/drawer (D108) + chips `⊗` do que está ativo no topo |
| Card do catálogo | capa + autores + sistema/edição/variante (padrão visual do mesas) + cenário |
| "Sobre e uso" | sai da nav, vai inteira pro footer; rota `/sobre-e-uso` preservada |
| Fila de sugestão de sistema | fase própria **dentro** da 086 (não vira spec separada) |
| **Shell administrativo compartilhado** | extrair o kit **inteiro** do mesas para `packages/ui/src/admin/`, **sem alterar o mesas**; Downloads já nasce consumindo |

### Fica fora (decidido, não esquecido)

| Item | Motivo |
|---|---|
| `sku`, `isbn`, `languageFilters`, badge "electrum" (tier de vendas) | descartar totalmente — nem extrair. `languageFilters` é redundante (D119 fixa `language='pt'`); badge é métrica comercial do marketplace |
| `dateModified`/`dateCreated` da fonte | não entram nesta spec |
| Link de preview PDF (`watermark.drivethrurpg.com/pdf_previews/…-sample.pdf`, em 2 de 3 fixtures) | não entra nesta spec |
| Nota + nº de avaliações da fonte (JSON-LD `aggregateRating`) | não entra — conflitaria com o `RatingSection` próprio |
| Backfill/reextração de material legado | dispensado: beta em lançamento, apenas 1 material de teste publicado |
| Reconstrução do design system/tema geral do Downloads | fora — só as páginas/componentes citados |
| Metadata rica no parser genérico (`json_ld_generic`) | fora — extração é específica de override; plataforma cadastrada sem código continua no MVP atual |
| Mover `SystemBadge` para `packages/ui` | decidido: Downloads faz componente próprio, sem tocar pacote compartilhado |
| Compartilhar a fila de sugestão com `apps/mesas` | fora — Downloads implementa a sua, copiando o modelo; não toca mesas |
| **Migrar `apps/mesas` para o kit compartilhado** | fora **por decisão explícita**: nesta spec o kit só é criado e validado no Downloads. O mantenedor migra o mesas depois, quando o kit estiver aprovado rodando. Nenhum arquivo de `apps/mesas` é alterado nesta spec |

## Requisitos

1. **Extração da tabela `data-codeid`** — override `onebookshelf` extrai os campos aprovados (`ruleSystem`, `authors`, `artists`, `creationMethod`, `filters`, `fileSize`, `format`), ancorando o parsing na `<table class="table-list">` para não capturar `commentText`/`customerName`/`badgeType`/`discussionDate` do bloco de avaliações (gap 3). Tolerante a campo ausente ("N / D" é valor real comum). Parsing determinístico (regex/DOM leve), sem lib nova de parsing sem perguntar antes.
2. **Extração dos tiles superiores** — segundo extrator, independente da tabela, ancorado em `product-detail-tile-N`: captura **Page Count** ("Número de páginas: 15" / "98") e **Category/linha de produto** ("Warhammer Fantasy Roleplay Fourth Edition"). Confirmado nos 3 fixtures e no HTML do mantenedor.
3. **`filters` preserva estrutura** — `source_filters` JSONB guarda facet + caminho: `[{ "facet": "tipoDeProduto", "path": ["Opções para personagens", "Classe/Arquétipo"] }, …]`; `tags` (coluna existente) recebe a versão achatada, mantendo compatível a busca/filtro simples que já existe.
4. **Descrição HTML rico** — parser extrai o conteúdo de `obs-product-description` (não a versão truncada do JSON-LD); backend sanitiza com allowlist explícita antes de persistir **e** antes de servir; frontend renderiza o HTML sanitizado. Editor visual TipTap no admin/gestão para editar descrição com formatação. Isto **supera** a premissa da spec 075 ("nenhum campo admin permite HTML rico") — `sanitizeText()` continua válido para os demais campos de texto simples; a descrição passa a ter caminho próprio de sanitização rica.
5. **Sanitização de HTML rico é obrigatória e não-negociável** (regra pétrea `AGENTS.md`: HTML de conteúdo de usuário é hostil). Allowlist de tags/atributos definida em `plan.md`; sanitização no backend antes de persistir, nunca confiando no cliente.
6. **Taxonomia sempre resolvida ou encaminhada — espelhando o fluxo de draft do `apps/mesas`, que é a referência aprovada** (decisão do mantenedor: o draft de mesa "já funciona como deveria"). No parse, `ruleSystem`/Category são resolvidos contra o catálogo central (`GET /api/catalog/v1/resolve`, público). Quando **não** resolve, o comportamento copia peça por peça o que o mesas faz:

    a. **Preserva o texto bruto** numa coluna própria (`raw_system_hint`), como `discord_table_draft.raw_system_hint` — a informação da fonte nunca é descartada;
    b. **Marca o material como precisando de revisão de taxonomia**, distinguindo "não casei mas tenho hint" de "a fonte não trouxe sistema nenhum" — equivalente ao `missing_fields: ['system_name:unmatched_hint']` vs. `['system_name']` de `normalizeDiscordTableDraft.ts:56`;
    c. **Abre sugestão** na fila (`source='scraper'`; usuário comum também sugere, `source='user'`);
    d. **A triagem admin recebe candidatos pontuados**, não lista crua — no padrão de `systemSuggestionCandidates.ts` (helper puro do mesas, sem deps externas), com `recommended_action` sugerido (`merge_existing`/`create_alias`/`create_child`/`create_system`);
    e. **A aprovação ensina o sistema**: o `raw_value` vira alias do node escolhido no catálogo central, no espírito de `recordSystemEntityRule` (`learningFeedbackOutbox.ts:161`) — sem isso a mesma sugestão volta pra fila indefinidamente;
    f. **Re-tentativa de match** quando o material é reprocessado, tentando `system_name` e `raw_system_hint`, limpando o hint ao casar (`normalizeDiscordTableDraft.ts:74-81`).

    Material nunca fica silenciosamente sem taxonomia — ou tem node resolvido, ou tem hint preservado + sugestão pendente rastreável. **Nada em `apps/mesas` é alterado** (requisito 17): o padrão é copiado, não importado.
7. **Node de fallback nomeado pelo mantenedor, em runtime** — para material genuinamente sem sistema ("Inespecífico/Qualquer mundo", "Any System", "Universal"), o node correspondente é criado **pela tela**, nunca por migration, com nome escolhido pelo mantenedor na hora. A spec define o **mecanismo** (não resolveu → admin escolhe/cria node no preview → o valor bruto vira alias desse node para os próximos casos); o nome concreto não é pré-definido aqui.
8. **Escrita no catálogo central segue o padrão do mesas** — sugestão + triagem admin, nunca escrita direta/cega a partir de dado raspado de marketplace. Contrato de referência já em produção no mesas: `POST /api/v1/system-suggestions` (user); `GET /api/v1/admin/system-suggestions`, `GET …/{id}/candidates`, `PATCH …/{id}/approve`, `PATCH …/{id}/reject`, `POST …/{id}/resolve` (admin).
9. **`/parse-html` mostra tudo no preview** — todos os campos novos extraídos aparecem pro admin antes de confirmar publicação, mesmo padrão de transparência dos campos atuais.
10. **Contrato público expõe o que a UI precisa** — `GET /materials` (listagem) passa a fazer join com `download_material_metadata` trazendo o necessário pro card: `cover_image_url`, `credits` (autores), `scenario`, mais os dados de sistema/edição/variante. `GET /materials/:slug` e/ou `GET /material-metadata/:id` expõem a metadata rica completa. Campos novos são aditivos/opcionais (não-breaking).
11. **Frontend — card do catálogo** (`MaterialCard.tsx`): capa real quando `cover_image_url` existe (`onError` cai pro placeholder atual; placeholder mantido quando `null`), autores, cenário e sistema/edição/variante no padrão visual que o mesas já usa em mesa ativa. Componente de badge de sistema é **próprio do Downloads** (decisão: `SystemBadge` vive em `apps/mesas/frontend`, não em `packages/ui`; copiar o padrão visual, não mover o código — evita tocar pacote compartilhado e o `/sys-logos/` servido pelo frontend do mesas).
12. **Frontend — ficha do material** (`MaterialPage.tsx`): reconstrução completa fiel aos prints — header 2 colunas (capa à esquerda; título, "Para \<cenário\>", "Por \<autores\>", CTA à direita), faixa de tiles com ícone, bloco "DETALHES" em 2 colunas, descrição rica renderizada. Mobile-first, colapsando pra 1 coluna abaixo do breakpoint.
13. **Frontend — filtro do catálogo** (`CatalogoPage.tsx`): controles de filtro na **sidebar** desktop / **drawer** abaixo de 1024 px, conforme D108 (firme); filtros ativos aparecem como **chips `⊗`** removíveis acima da lista, no formato dos prints. Sincronizado com os query params já suportados (D073) — a URL continua o contrato único e compartilhável.
14. **Nav e footer** — "Sobre e uso" sai de `moduleNav` (`AppShell.tsx`); link vai pro `Footer` (`packages/ui`); rota `/sobre-e-uso` continua existindo (SEO preservado, sem 404).
15. **Compatibilidade retroativa** — material sem os campos novos (nulos) renderiza normalmente: UI omite seção/chip vazio, nunca exibe "undefined" ou placeholder de erro.

16. **Shell administrativo compartilhado em `packages/ui/src/admin/`** — o kit visual/UX de gestão do mesas (`https://mesas.artificiorpg.com/gestao`) é extraído **por inteiro** para o pacote compartilhado, sob subpasta `admin/`: `AdminSidebar`, `AdminMain`, `AdminWorkspaceLayout`, `Breadcrumb`, `PageHeader`, `SectionCard`, `MetricCard`, `StatusPill`, `AdminTable` (com `AdminColumn`/`AdminFacet`/`AdminBulkAction`/`AdminRowAction`), `bulkActions`, `tabButtonClass`, `cn`. Base de referência: o código do mesas, que é o padrão aprovado — o kit reproduz o comportamento e a aparência atuais, não redesenha.

17. **`apps/mesas` NÃO é alterado nesta spec.** Nenhum arquivo de `apps/mesas/**` é tocado. O mesas continua com sua cópia local funcionando; a migração dele para o kit compartilhado é decisão e ação futura do mantenedor, depois de o kit estar validado rodando no Downloads. Isto é trava de escopo, não sugestão.

18. **Kit desacoplado de router e de biblioteca de ícones** — `packages/ui` **não** ganha dependência de `react-router-dom` nem de `lucide-react` (hoje não tem nenhuma das duas; o pacote é consumido também pelo site em Astro). O kit recebe por prop: o componente de link (`LinkComponent`), a rota atual (`currentHref`) e os ícones como `ReactNode`. O app faz a fiação (`NavLink`, `useLocation`, ícones lucide). Consequência aceita: mais código de fiação no app, kit genuinamente portátil.

19. **Kit reusa os primitivos que já existem em `packages/ui`** — antes de criar peça nova, verificar equivalente entre os primitivos atuais e reusar quando servir: o `Drawer` atende o drawer mobile da sidebar; `Badge` e `Panel` devem ser avaliados para `StatusPill` e `SectionCard`. Só entra componente novo quando não há equivalente, ou quando o equivalente divergiria de fato — e nesse caso o porquê fica documentado em comentário no código. Nenhum par de componentes dentro do mesmo pacote deve fazer a mesma coisa.

    **Lacuna verificada no `Drawer` (`packages/ui/src/primitives.tsx:394-437`):** tem `role="dialog"`, `aria-modal="true"`, backdrop clicável e fechar por Escape (`useEscapeClose`), mas **não tem foco preso nem restauração de foco** — e D108 exige foco preso/restaurado no drawer. Resolver no consumidor (envolvendo o `Drawer`) ou dar focus trap ao primitivo; a segunda opção deixa de ser frente aditiva e exige perguntar antes.

20. **Tokens de tema do admin viajam com o kit** — `packages/ui/src/admin/admin.css` (novo) traz `--admin-rail`, `--admin-surface`, `--admin-canvas`, `--admin-hover`, `--fg-low`, `--fg-faint`, `--fg-ghost`, `--border`, `--border-strong`, `--shadow-card` e os demais que o kit usa, em **dark e light**, copiados dos valores reais do mesas (`apps/mesas/frontend/src/index.css`). O Downloads importa esse CSS. Quando o mantenedor migrar o mesas, o mesas passa a importar o mesmo arquivo e apaga a definição local — sem terceira cópia.

21. **Gestão do Downloads passa a usar o kit** — `GestaoShell.tsx` é reconstruído sobre `AdminSidebar` + `AdminMain`, preservando o que já é próprio do Downloads e não deve ser perdido: agrupamento Conteúdo/Operação/Comunidade/Sistema, contagem por fila (`moderation_queue`/`reports_open`/`degraded_links`), sinalização de fila P0 por **ícone + texto, nunca só cor** (critério de aceite da spec 075), filtro `adminOnly` espelhando o guard de rota (achado do PR #201), link externo para "Sistemas e edições" no Site, e alvos de toque ≥ 44 px.

22. **A sidebar pública do catálogo (requisito 13) usa o mesmo vocabulário visual do kit** — a sidebar de filtros do `/catalogo` não inventa aparência própria: reaproveita os tokens e o padrão de rail/agrupamento do kit administrativo, para que o app inteiro leia como um sistema só. É a razão de esta frente entrar nesta spec e não numa futura: as duas sidebars são a mesma decisão visual.

23. **Endpoint de facetas para o filtro visível** — `GET /api/v1/materials/facets` (novo, público, sem auth, mesmo escopo da listagem) devolve os valores de `material_type` realmente em uso com contagem, mais os `system_id`/`edition_id` em uso, considerando só `editorial_state='published'`. Necessário porque `material_type` é texto livre sem enum e não existe agregação nenhuma no backend (gap 10). A sidebar não oferece filtro que retornaria zero resultado (heurística de Nielsen: não oferecer ação sem efeito). As opções de `material_type` no frontend vêm **sempre** desta rota, nunca de lista hardcoded.

24. **Descrição é persistida em dois campos com papéis distintos** — `download_material.description` continua **texto plano** (fonte: `sanitizeText()`), servindo busca `ilike`, `summary`, SEO/meta e o histórico versionado existente; `download_material_metadata.description_html` guarda o **HTML sanitizado**, só para exibição. `summary` é derivado do texto plano, nunca do HTML. Isto evita o bug do `slice(0, 500)` cortando no meio de tag (gap 10) e mantém a busca funcionando. A ficha prefere `description_html` quando existe e cai em `description` quando não.

25. **`material_type` deixa de ser texto livre** — hoje é `z.string().trim()` sem enum, preenchido por `<input>` texto (gap 10), produzindo grafias duplicadas e faceta poluída. Decisão nominal do mantenedor (2026-07-25): vira taxonomia Central separada de `system > edition > variant`, com ID/slug estáveis, aliases e status. Projetos leem e registram no Central sob governança distribuída; o Downloads persiste a referência canônica. Não adicionar `material_type` à árvore de sistemas: é dimensão ortogonal e consumidores atuais daquele contrato aceitam somente `system`/`edition`/`variant`. Migrar valores já gravados e não fechar a fase mantendo texto livre.

## Critérios de aceite

- Cada um dos 3 fixtures OneBookShelf produz os campos aprovados no preview de `/parse-html`, com asserção de **valor exato** de pelo menos 1 campo por fixture (não apenas "não é null").
- Teste específico provando que a extração **não** captura `commentText`/`customerName`/`badgeType`/`discussionDate` — usando `storytellersvault-product-1.html`, que tem 6 de cada (gap 3 é regressão real esperada se a âncora estiver errada).
- Teste provando que a descrição extraída é a versão **completa** de `obs-product-description` (contém `<ul>`/`<img>`), não a truncada do JSON-LD.
- Teste de sanitização: payload hostil (`<script>`, `onerror=`, `javascript:` em `href`, `<iframe>`) é neutralizado antes de persistir e antes de servir.
- `source_filters` de um fixture bate a árvore esperada, com facet e caminho pai › filho corretos; `tags` derivadas conferem.
- **Teste de ponta a ponta da cadeia:** preview de `/parse-html` → payload em `/ingest` → conferir no banco que **todos** os campos novos chegaram. É o único teste que pega `ingestItemSchema` removendo campo em silêncio (gap 10).
- `summary` de material com descrição rica **não contém tag HTML** — prova de que foi derivado do texto plano (requisito 24).
- `GET /materials/facets` devolve só valores de material publicado (rascunho/retirado não aparece) e a sidebar não oferece opção com contagem zero.
- Material cujo `ruleSystem` não resolve gera sugestão pendente na fila, visível na tela de triagem admin — verificado por teste.
- Card do catálogo mostra capa real, autores, cenário e sistema/edição/variante — **smoke visual real** (browser/screenshot), não só DOM correto.
- Ficha do material renderiza header 2 colunas, tiles, bloco DETALHES e descrição rica — **smoke visual real**.
- Filtro: sidebar desktop e drawer mobile operam; chip `⊗` remove o filtro e a lista atualiza; URL reflete o estado — smoke visual real.
- "Sobre e uso" não aparece na nav; aparece no footer; `/sobre-e-uso` responde 200.
- Material sem metadata rica (legado/`json_ld_generic`) renderiza sem erro nem campo quebrado.
- `tsc --noEmit`, lint, testes (backend + frontend) e `pnpm verify:api` verdes.
- **Cada correção de review de bot tem comentário no ponto corrigido** com origem (PR + bot + severidade), o erro real e a razão — verificável por busca: `rtk rg "review PR #" <arquivos do PR>` retorna comentário para cada fix, e busca por `// fix review`/`// ajuste do` não retorna nada. Correção sem comentário, ou com comentário genérico, reprova o critério.
- Nenhum comentário de decisão preexistente foi **apagado** por fix de review — se a razão do trecho mudou, foi reescrito citando a origem nova (`AGENTS.md`).

**Do shell administrativo compartilhado:**

- `packages/ui/src/admin/` exporta o kit inteiro; `pnpm build` do pacote passa.
- **`git diff` da spec não contém nenhum arquivo de `apps/mesas/**`** — verificação objetiva da trava do requisito 17, conferida antes de cada PR das fases de kit.
- `packages/ui/package.json` **não** ganha `react-router-dom` nem `lucide-react` em `dependencies` — verificação objetiva do requisito 18.
- Cada componente do kit tem teste no pacote (`packages/ui`), incluindo `AdminTable` (faceta filtra, seleção em massa dispara ação, ação de linha chama handler) — não vale só "renderiza sem erro".
- Gestão do Downloads rodando sobre o kit **preserva** as contagens por fila, o ícone + texto da fila P0, o filtro `adminOnly` e os alvos ≥ 44 px — teste cobrindo cada um.
- **Smoke visual real** comparando a gestão do Downloads com `https://mesas.artificiorpg.com/gestao`: mesma linguagem de rail, header, cards e tabela. O mantenedor valida antes de a fase fechar (é ele quem aprova o kit para depois migrar o mesas).
- Sidebar de filtros do `/catalogo` usa os mesmos tokens do kit — conferido no smoke visual.

## Fora de escopo

Ver a tabela "Fica fora (decidido, não esquecido)" acima — cada item tem decisão registrada do mantenedor, não é omissão.

Adicionalmente:

- Upload/gestão de imagem em si (`GestaoMidiasPage`, já existe) — esta spec conecta o dado existente ao público, não muda o fluxo admin de edição de mídia.
- Criar o node de fallback por migration — proibido pelo requisito 7; criação é pela tela.

## Riscos e impacto em outros módulos

- **HTML rico + sanitização** é a maior superfície de risco desta spec (XSS armazenado). Mitigação: allowlist explícita, sanitização no backend antes de persistir e antes de servir, teste de payload hostil como critério de aceite. Não confiar em sanitização só no cliente.
- **TipTap é lib nova** (~90 KB gz, headless/ProseMirror). Aprovada nominalmente pelo mantenedor em 2026-07-25 conforme regra `AGENTS.md` (perguntar antes de instalar). Extensões limitadas ao conjunto necessário.
- **Fila de sugestão de sistema** é frente nova no Downloads (tabela + fila + tela de gestão + contrato). Modelo copiado do mesas, que já opera em produção. **Não** toca `apps/mesas`.
- **Mudança de contrato público** (`GET /materials` com join) — aditiva, não-breaking; exige `pnpm verify:api`. Consumidor conhecido: só o frontend próprio (confirmado via `artificio-api-governance`).
- **Migrations** — colunas aditivas (`ADD COLUMN … NULL`) + tabela nova de sugestão; seguir checklist pétreo (`AGENTS.md` §Migrations), header de 5 campos, `online-safe`, idempotência, **uma migration por frente lógica** (não fatiar por tabela).
- **Parsing por layout do OneBookShelf** — herda o risco já documentado em D-085-03: mudança de layout da fonte quebra a extração, sem monitoramento proativo. Esta spec não resolve, herda. Agora com **duas** âncoras de layout (`table-list` e `product-detail-tile-N`), a superfície é maior.
- **D108 respeitada** — os controles de filtro ficam na sidebar/drawer; os chips são apenas a representação do estado ativo. Nenhuma decisão firme precisa ser revisada.
- **`packages/ui` é pacote compartilhado** — mudança nele exige aprovação do mantenedor + verificação de impacto nos consumidores, proporcional ao blast radius (`AGENTS.md`). Mitigação real: a frente é **puramente aditiva** (subpasta `admin/` nova, exports novos, CSS novo em arquivo separado); nenhum primitivo existente é alterado, nenhuma dependência nova entra no `package.json`. Consumidores atuais (`site`, `mesas`, `glossario`, `downloads`, `links`) não mudam de comportamento. Se a implementação descobrir que reusar `Badge`/`Panel`/`Drawer` exige **alterar** o primitivo (não só consumi-lo), parar e perguntar antes — isso deixaria de ser aditivo.
- **Trava de escopo do mesas** — o risco real desta frente é escorregar para "já que estou aqui, migro o mesas também". Proibido pelo requisito 17. O critério de aceite usa `git diff` como verificação objetiva, não confiança.
- **`AdminTable` é a peça mais pesada** (14,7 KB: facetas via `useSearchParams`, seleção em massa, ações de linha). Desacoplar o router dela por prop é o ponto de maior chance de regressão silenciosa — exige teste próprio no pacote, não só no app consumidor.
- **Divergência temporária aceita** — enquanto o mesas não migrar, existem duas cópias do kit (a local dele e a compartilhada). É consequência deliberada da decisão do mantenedor de validar antes de migrar; registrar como débito com prazo indefinido, não como bug.
- **Achado de contrato fora do escopo desta spec:** `POST /api/v1/admin/scraper/parse-html` não aparece no bundle OpenAPI (`artificio-api-governance` não retorna a rota). Débito de documentação de API, registrar em `specs/backlog.md`.
