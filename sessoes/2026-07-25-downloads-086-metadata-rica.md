# 2026-07-25 — Downloads: spec 086 (metadata rica + catálogo real)

## Contexto

Sequência da spec 085 (parser genérico + registry de plataformas, PR #201 mergeado, deploy beta `success` em 2026-07-25 — ver `.specify/memory/errors.md` E012 e `sessoes/2026-07-24-downloads-deploy-beta-handoff.md`).

Mantenedor revisou o primeiro material real publicado em beta (`https://downloadsbeta.artificiorpg.com/materiais/a-masmorra-de-akriona`), disse que o frontend está distante do que quer, e forneceu material de referência: 5 capturas de páginas reais OneBookShelf (`C:\projetos\artificio\temp\*.png`) e um HTML real completo (`temp/exemplo_de_codigo.txt`, 153 KB, produto DriveThruRPG "Warhammer Fantasy Roleplay: Sylvania The Cursed County").

Papel desta sessão (pedido explícito do mantenedor): **gestão de projeto** — revisar, investigar, ampliar e organizar a spec 086 até estar pronta para desenvolvedores programarem. Não implementar.

## O que foi feito nesta sessão

### Investigação (evidência material, não memória de chat)

- **5 imagens de referência lidas** e cruzadas com o HTML real e com os 3 fixtures do repositório.
- **Chaves `data-codeid` extraídas dos 3 fixtures** (`grep -o | sort | uniq -c`): 12 campos de produto, não 11 — a versão anterior da spec **esquecia `isbn`**, presente nos 3.
- **Gap novo (crítico):** `data-codeid` **não é exclusivo** da tabela de detalhes. `storytellersvault-product-1.html` tem 6× `badgeType`/`commentText`/`customerName`/`discussionDate` (bloco de avaliações); o HTML do mantenedor tem 4× cada. Regex ancorada só no atributo capturaria comentário de cliente como metadata. Extração precisa isolar `<table class="table-list">` primeiro.
- **Gap novo:** `filters` é **árvore com facet tipado**, não lista plana — `href` traz `tipoDeProduto`/`edicao`/`cenario`/`conteudo` e a relação pai › filho. Achatar em `tags` perderia hierarquia e tipo de facet.
- **Gap novo:** JSON-LD `description` vem **truncada em ~500 chars**; o HTML real em `obs-product-description` tem `<img>`/`<strong>`/`<em>`/`<ul><li>`/`<a>`. Presente nos 3 fixtures. Confirma T0.5 com prova material.
- **Gap novo:** existe um **segundo bloco** de dados (`product-detail-tile-1..6`) com Publisher / Category / Rule System / **Page Count** / Added to Catalog / More Info — fora da tabela `data-codeid`, exigindo extrator próprio.
- **Achado que reduz escopo:** `GET /api/v1/material-metadata/:materialId` é público e faz `selectAll()` — capa/cenário/formato/tags **já são servidas hoje**. O gap real é o Zod do frontend (`useMaterialMetadata.ts`) declarar só 6 campos. A ficha custa menos que a spec anterior supunha.
- **Confirmado:** `GET /materials` (listagem) não faz join com metadata (`routes/materials.ts:107`) — join novo é obrigatório pro card.
- **Confirmado:** `scraperIngest.ts:155-162` grava só `language`/`publisher_name`/`cover_image_url` — todo material de scraper nasce **sem** `system_id`/`edition_id`.
- **Via `artificio-api-governance`:** `GET /api/catalog/v1/resolve|systems|snapshot` são **públicos** (`auth: none`, owner `site`) — filtro visível e resolve de taxonomia têm fonte real. Fila de sugestão do mesas mapeada (`POST /api/v1/system-suggestions` + 5 rotas admin).
- **Confirmado:** `SystemBadge` vive em `apps/mesas/frontend`, **não** em `packages/ui` — não é compartilhado.
- **`SobreEUsoPage.tsx` lida na íntegra:** 100% institucional (idioma, PWYW, como funciona, indexação, moderação, direitos autorais). **Corrige a premissa de T0.4 da versão anterior** — nada dela "é catálogo", não há o que redistribuir.

### Investigação do shell administrativo (pedido posterior do mantenedor na mesma sessão)

Mantenedor pediu extrair a parte visual/UX de gestão do mesas (`https://mesas.artificiorpg.com/gestao`) pra pacote compartilhado, **sem alterar o mesas**, com o Downloads já nascendo em cima disso.

- **Kit do mesas mapeado** (`apps/mesas/frontend/src/features/admin/`, não compartilhado): `AdminSidebar` (rail com border-left ativa + badge de pendência), `AdminMain` (header sticky com eyebrow/breadcrumb/ações/subnav), `AdminWorkspaceLayout` (workspace + inspector 400 px), `Breadcrumb`, e o UI kit em `components/ui/`: `PageHeader`, `SectionCard`, `MetricCard`, `StatusPill` (6 tons semânticos via `color-mix`), `AdminTable` (14,7 KB — facetas, seleção em massa, ações de linha), `bulkActions`, `tabButtonClass`, `cn`.
- **Divergência de tokens medida:** `--admin-rail`/`--admin-surface`/`--admin-canvas`/`--admin-hover`/`--fg-low`/`--fg-faint`/`--shadow-card` existem **só** em `apps/mesas/frontend/src/index.css` (dark 32-34/72, light 204-206/227). Downloads usa `--surface-subtle`/`--line`/`--fg-muted` + `bg-artificio-orange/20` e não define nenhum `--admin-*`. Dois design systems administrativos paralelos.
- **`packages/ui` não cobre shell admin:** tem primitivos públicos (`Header`/`Footer`/`Button`/`Badge`/`Panel`/`Drawer`/`Modal`/`TextInput`/`Select`/`Toolbar`/`EmptyState`) e zero peça administrativa.
- **Achado que mudou a arquitetura do kit:** `packages/ui` **não tem** `react-router-dom` nem `lucide-react` nas deps (só `react`/`react-dom` + `@artificio/{auth,config,changelog}`), mas `AdminSidebar`/`MetricCard`/`AdminTable` usam `NavLink`/`Link`/`useSearchParams` e ícones lucide. Como `packages/ui` também é consumido pelo site em Astro, o mantenedor decidiu **desacoplar por prop** (`LinkComponent`, `currentHref`, `icon: ReactNode`) em vez de acoplar o pacote ao router.
- **`packages/ui` já tem `Drawer` com foco preso** — reusar no drawer mobile em vez de reimplementar o `fixed inset-0` que o Downloads tem hoje.

### Débito documental corrigido (autorizado pelo mantenedor na sessão)

- `apps/downloads/backend/src/services/catalogClient.ts`: comentário afirmava "Downloads consome (nunca escreve) […] escrita de sistema/edição continua proibida aqui […] (D097)". **Leitura errada de D097.** D097 ("catálogo central, administração distribuída") e D099 dizem o oposto: sistemas/edições podem ser administrados a partir de mesas, glossário **ou downloads**, e "todos leem e escrevem integralmente nele". Comentário reescrito citando D097/D099, o modelo de sugestão + triagem do mesas e o contrato de referência. `rtk tsc` do backend verde após a edição.

### Decisões do mantenedor (perguntadas explicitamente, todas respondidas)

**Entra:** `fileSize`, Page Count, `creationMethod`, Category/linha de produto; `filters` como JSONB estruturado **+** `tags` derivadas; descrição HTML rico **completa** (extração + sanitização + editor **TipTap**, aprovado nominalmente); taxonomia mapeada contra o catálogo central com **fila de sugestão + triagem admin** (modelo do mesas: usuário e scraper sugerem, admin aprova/recusa/ajusta); ficha do material em **reconstrução completa** fiel aos prints; filtro com **controles na sidebar/drawer (D108) + chips `⊗`** dos ativos no topo; card com capa + autores + sistema/edição/variante + cenário; "Sobre e uso" **inteira** pro footer, fora da nav, rota preservada.

**Fica fora (decidido, não esquecido):** `sku`, `isbn`, `languageFilters`, badge "electrum" — descartar totalmente; datas da fonte; link de preview PDF; `aggregateRating` da fonte; backfill (beta, 1 material de teste); mover `SystemBadge` pra `packages/ui` (Downloads faz componente próprio); compartilhar a fila de sugestão com o mesas.

**Node de fallback** ("sem sistema"/agnóstico): mecanismo definido na spec (não resolveu → admin escolhe/cria pela tela → valor bruto vira alias), **nome escolhido pelo mantenedor na hora**, nunca por migration.

**Shell administrativo compartilhado:** kit **inteiro** do mesas extraído pra `packages/ui/src/admin/` (subpasta, export por subpath `@artificio/ui/admin`); tokens em `admin/admin.css` próprio, importado pelo app (não editar `styles.css`, não duplicar no Downloads); kit **desacoplado** de router/ícones por prop; kit **reusa** os primitivos que já existem (`Drawer` certo; avaliar `Badge`/`Panel`). **`apps/mesas` NÃO é alterado** — trava do requisito 17, verificada por `git diff` em cada PR. O mantenedor migra o mesas depois, com o kit aprovado rodando no Downloads. Entra nesta spec (não numa futura) porque a sidebar pública do catálogo é a mesma decisão visual.

**Modelo de entrega:** uma spec 086, **um PR por fase**.

**D108 respeitada** — controles na sidebar, chips só representam estado ativo. Nenhuma decisão firme precisa ser revisada.

### Documentos reescritos

- `specs/086-.../spec.md` — 8 gaps com evidência (arquivo/linha), tabelas de "entra"/"fica fora" com decisão registrada, 15 requisitos, critérios de aceite incluindo os testes anti-regressão dos gaps novos.
- `specs/086-.../plan.md` — tabela de estado atual verificado (fato → arquivo:linha → consequência), 3 extratores independentes, allowlist de sanitização, 2 migrations (metadata + fila de sugestão), resolve em lote via snapshot (evita N+1), rollback com a ressalva de D099 (node do catálogo não se apaga).
- `specs/086-.../tasks.md` — Fase 0 **fechada** (18 decisões marcadas), Fases 1-11 + **5B/5C (kit administrativo)** com PR por fase.
- `specs/backlog.md` — 4 linhas novas: `BL-086-DOWNLOADS-METADATA-RICA` (spec pronta), `D-086-01` (débito futuro: migrar o mesas pro kit compartilhado), `D-086-02` (`/parse-html` fora do bundle OpenAPI), `D-086-03` (comentário de `catalogClient.ts`, **fechado**).

## O que falta

### Retomada — Fases 5, 5B e 5C (2026-07-25)

- Pedido atual do mantenedor: implementar as Fases 5, 5B e 5C.
- Decisão nominal posterior para T5.5: `material_type` não será enum local. Será uma taxonomia Central separada de `system > edition > variant`, com identificador estável no material; projetos leem e podem registrar no Central sob o mesmo modelo de governança distribuída. Não adicionar um novo `node_type` à árvore de sistemas, pois ela é uma dimensão ortogonal e consumidores atuais validam somente `system`/`edition`/`variant`.
- Próximo trabalho: criar contrato Central de tipos de material, migrar o Downloads para a referência canônica e implementar o join/facetas; extrair kit administrativo aditivo em `packages/ui/src/admin/`; reconstruir a gestão do Downloads sobre o kit. `apps/mesas/**` permanece intocado.
- Execução iniciada: Central recebeu schema/API local de `material_types`; Downloads recebeu migration de referência e `GET /materials` ganhou `leftJoin` de metadata + `/facets`. Estado ainda **em andamento**: sem testes, gate, `verify:api`, commit ou PR.
- Ainda falta: validação local completa e aprovação visual do mantenedor para T5C.8. Nenhum commit, push, PR, deploy ou write em VM foi autorizado.

- **Nada bloqueado por decisão** — Fase 0 fechada. Uma pergunta pontual permanece **dentro** da Fase 2 (T2.1): qual lib de sanitização de HTML rico (`sanitize-html` Node puro vs. `isomorphic-dompurify` com jsdom) — perguntar antes de instalar, conforme `AGENTS.md`.
- Uma confirmação pontual na Fase 9 (T9.3): onde o editor rich-text aparece — só gestão, ou também painel do criador.
- Uma verificação antes de editar na Fase 10 (T10.1): se o `Footer` de `packages/ui` aceita link extra por app (se exigir mudança no pacote compartilhado, pedir aprovação).
- **`packages/ui` é pacote compartilhado** — as fases 5B/5C exigem aprovação nominal do mantenedor antes do commit (`AGENTS.md`). A frente foi desenhada pra ser **puramente aditiva** (subpasta nova, exports novos, CSS novo, zero dependência nova, nenhum primitivo alterado) justamente pra reduzir o blast radius. Se a implementação descobrir que reusar `Badge`/`Panel` exige **alterar** o primitivo, parar e perguntar.
- Fases 1-11 + 5B/5C: nada implementado. Só a spec está pronta.
- Autorização de commit/push desta reescrita de spec + da correção do comentário: **não pedida nem concedida** nesta sessão.

## Backlog (✅ atualizado nesta sessão)

Registrado em `specs/backlog.md`:

- **`BL-086-DOWNLOADS-METADATA-RICA`** — spec pronta pra desenvolvimento, nada implementado. Próximo passo: Fase 1.
- **`D-086-01`** — **débito futuro pedido explicitamente pelo mantenedor:** migrar `apps/mesas` para o kit administrativo compartilhado, depois de o kit estar aprovado rodando no Downloads. Inclui trocar imports pra `@artificio/ui/admin`, apagar as 12 peças locais, remover os tokens `--admin-*` duplicados do `index.css` do mesas, e adaptar a fiação ao contrato desacoplado (`LinkComponent`/`currentHref`/`AdminTable` com facetas controladas). Toca app em produção com gestão ativa — spec/PR própria + aprovação nominal.
- **`D-086-02`** — `POST /api/v1/admin/scraper/parse-html` fora do bundle OpenAPI. Verificar se outras rotas de `scraper.ts` têm o mesmo problema.
- **`D-086-03` (🟢 fechado)** — comentário de `catalogClient.ts` contra D097/D099, corrigido nesta sessão com `rtk tsc` verde.

## Débitos relacionados (não desta sessão, contexto)

- D-085-04 (`specs/backlog.md`): workflows não expõem `ALLOW_MANUAL_MIGRATIONS` via `workflow_dispatch`.
- BL-085-DOWNLOADS-PARSER-HTML: T9.2 (smoke funcional real da spec 085) ainda pendente, independente desta spec.

## Nota de ferramenta

`typescript-lsp` reportou dezenas de erros fantasma (`Cannot find name 'vi'/'describe'/'expect'`) em arquivos de teste do frontend **não tocados** nesta sessão. `rtk tsc --noEmit` real: **verde em backend e frontend**. Falso-positivo de buffer/tipos do servidor de linguagem, padrão já conhecido — não é regressão.
