# Tasks — Spec 086 (Downloads: metadata rica, taxonomia e reconstrução do catálogo)

**Modelo de entrega decidido pelo mantenedor:** uma spec só (086), **um PR por fase** — mesmo padrão das specs 057/085. Cada fase fecha sozinha: código + teste + verde local, PR contra `dev`, bots revisam, achados endereçados (ver abaixo), então a fase seguinte começa.

## Review de bot: comentário no código, não em documento

Toda fase abre PR, então toda fase recebe review de bot (CodeRabbit, Codex, Sonar, Amazon Q, Snyk, GitHub Advanced Security). Regra desta spec, decidida pelo mantenedor em 2026-07-25:

- **Correção que vira código é documentada em comentário NO PRÓPRIO CÓDIGO**, no ponto corrigido, referenciando a origem. **Não** em sessão, **não** em arquivo de review (`reviews.md`/`debitos.md` estão deprecados).
- **Motivo:** o comentário fica onde o próximo agente vai ler — junto do código que ele poderia desfazer sem saber por quê. Registro em documento separado se perde; comentário inline sobrevive ao refactor.
- **Formato já consolidado nesta base** (seguir, não inventar):

  ```ts
  // Achado real (review PR #201, Codex, P1): /ingest validava source_platform
  // contra IMPLEMENTED_SOURCE_PLATFORMS (só as 5 fontes com scraper automático)
  // — vestígio da Fase 5. Depois da Fase 6 (registry em banco), qualquer site
  // cadastrado só via /gestao/plataformas nunca teria adapter em ADAPTERS, então
  // /parse-html funcionava mas /ingest sempre devolvia 400.
  ```

  Variações válidas, em uso: `Achado real (review PR #NNN, <bot>, <P1|P2|nitpick>)`, `Achado de review PR #NNN (<bot>)`. Exemplos reais nesta base: `routes/scraper.ts:150`, `services/priceRecheckJob.ts:13`, `apps/downloads/Dockerfile:42`, `migration_023_*.sql` (no `@description` do header).

- **O comentário precisa conter três coisas:** origem (PR + bot + severidade quando houver); **o que estava errado de fato** (não "corrigido conforme review", que não ensina nada); **por que a correção é essa** — o raciocínio que o próximo agente teria de reconstruir sozinho.
- Vale igual em teste, migration (comentário SQL ou `@description`), `Dockerfile` e config — não só `.ts`.
- **Comentário existente nunca é apagado** ao corrigir um achado (regra pétrea `AGENTS.md`): se a razão do trecho mudou, **reescrever** pra refletir a decisão atual, citando a origem nova.
- **Correção é solução correta e completa, não a mínima que faz o sintoma sumir** (`AGENTS.md` §Regras Gerais de Código): entender a causa raiz e resolvê-la, schema/tipo/contrato incluídos se for o caso. "Escopo mínimo" vale pra **abrangência** (não sair mexendo em código não relacionado), nunca pra **profundidade**.
- **O que NÃO virou código** (achado descartado, ou que o mantenedor mandou registrar como débito) vai pra `tasks.md` + `specs/backlog.md`, com o porquê — aí não há código onde comentar.
- **NUNCA** responder, comentar, resolver thread, reagir ou disparar (`@q`/`@codex`/`@coderabbit`) no PR. O agente não escreve nada na conversa do PR; isso é do mantenedor (`AGENTS.md`).
- Achado de bot que o agente julgue improcedente **não é descartado em silêncio**: registrar o porquê e, se houver dúvida real, perguntar ao mantenedor.

## 🔁 Gate de fase (obrigatório, penúltima task de TODA fase)

Cada fase termina com uma task **🔁 GATE DE FASE** antes do PR. Ela existe porque `tasks.md` é um resumo: quem implementa tende a ficar preso na checklist e perder o que só está escrito na `spec.md`/`plan.md` — requisito, decisão do mantenedor, armadilha já investigada. O gate manda **reler os requisitos e as seções nomeados** e conferir a implementação contra eles, item por item.

Regra do gate, sem exceção:

- Achou divergência → **corrigir antes do PR**. Se a dúvida for se a spec é que está errada, **perguntar ao mantenedor**.
- **Nunca** seguir o `tasks.md` contra a `spec.md`/`plan.md` em silêncio.
- **Nunca** fechar a fase com item de requisito não atendido, nem "atendido em parte".
- Débito descoberto que toca frontend/backend **é resolvido nesta spec** (decisão do mantenedor, 2026-07-25) — o agente não decide adiar; na dúvida, pergunta.
- **Todo gate também confere os comentários de review** da fase, quando a fase já recebeu review de bot: cada fix com comentário no ponto corrigido (origem + erro + razão), nenhum comentário de decisão apagado. Ver §"Review de bot" acima.

**Fase 0 está fechada.** Todas as decisões de **escopo** foram respondidas pelo mantenedor em 2026-07-25 e estão registradas em `spec.md` §Decisões de escopo — nenhuma fase está bloqueada esperando definição de escopo.

**Pendências técnicas nomeadas, resolvidas dentro da própria fase (não bloqueiam começar, mas bloqueiam fechar a task):**

| Onde | O que falta perguntar/decidir |
|---|---|
| T2.1 | qual lib de sanitização de HTML rico (`sanitize-html` vs. `isomorphic-dompurify`) — dep nova, perguntar antes de instalar |
| T5B.9 | `packages/ui` não tem DOM em teste (`environment: "node"`, só SSR) — adicionar `jsdom`+`@testing-library/react` (dep nova, perguntar) ou cobrir interação no app consumidor |
| T5C.4 / T8.2 | `Drawer` de `packages/ui` **não tem foco preso**, e D108 exige — resolver no consumidor ou dar focus trap ao primitivo (perguntar, deixa de ser aditivo) |
| T5.5 | `material_type` é texto livre (permite "aventura"/"Aventura" duplicados na faceta) — **resolver nesta spec** (requisito 25); perguntar só a forma (enum + `<select>` vs. taxonomia consultável) |
| T4.4 | reusar `systemSuggestionCandidates.ts` do mesas: copiar pro Downloads ou extrair pra pacote compartilhado |
| T9.3 | onde o editor rich-text aparece: só gestão, ou também painel do criador |
| T10.1 | `Footer` **não** aceita link extra (verificado) — escolher entre prop nova no pacote, reusar `copyrightHref`, ou faixa própria no `AppShell` |

**Ordem das fases importa.** A Fase 8 (filtro visível) depende da rota de facetas criada na **Fase 5** (T5.3) e dos tokens do kit criados na **Fase 5B**. A Fase 3 depende de os 3 primeiros pontos da cadeia de propagação estarem na Fase 1 (T1.1/T1.1b/T1.1c). Não pular ordem sem checar essas dependências.

**Débito novo descoberto durante a implementação:** se tocar frontend ou backend, **resolve nesta spec** — não vira linha de backlog pra depois (decisão do mantenedor, 2026-07-25). O agente não decide adiar; na dúvida sobre escopo ou forma, pergunta ao mantenedor. Só sai desta spec o que o mantenedor mandar sair, explicitamente.

---

## Fase 0 — Decisões de escopo (✅ fechada, 2026-07-25)

- [x] T0.1 — Campos que persistem: `fileSize`, Page Count, `creationMethod`, Category. **Descartados totalmente:** `sku`, `isbn`, `languageFilters`, badge de tier de vendas. **Fora desta spec:** datas da fonte, link de preview PDF, `aggregateRating`.
- [x] T0.2 — Rota pública de metadata confirmada: `GET /api/v1/material-metadata/:materialId` (`routes/materialMetadata.ts:40`) já é pública e faz `selectAll()`. `GET /materials` (`routes/materials.ts:107`) **não** faz join — join é necessário só pro card.
- [x] T0.3 — Filtro do catálogo: controles na sidebar (desktop) / drawer (< 1024 px) conforme D108; chips `⊗` dos filtros ativos acima da lista, formato dos prints. D108 não precisa ser revisada.
- [x] T0.4 — "Sobre e uso": página lida na íntegra, é 100% institucional. Vai **inteira** pro footer, sai da nav, rota preservada. (Premissa anterior de "parte dela é catálogo" estava errada.)
- [x] T0.5 — Descrição HTML rico: entra completo nesta spec (extração + sanitização + editor). Editor aprovado: **TipTap** (headless/ProseMirror).
- [x] T0.6 — Imagens de referência **investigadas** nesta sessão (`C:\projetos\artificio\temp\*.png`, 5 arquivos) + HTML real fornecido pelo mantenedor (`exemplo_de_codigo.txt`, 153 KB). Achados incorporados a `spec.md`/`plan.md`. Diretório `temp/` é local, fora do git.
- [x] T0.7 — Taxonomia: material nunca fica sem taxonomia. `ruleSystem`/Category resolvem contra o catálogo central; não resolvendo, abre sugestão na fila (scraper e usuário sugerem, admin triage). Node de fallback é criado **pela tela**, nome escolhido pelo mantenedor na hora, nunca por migration.
- [x] T0.8 — Escrita no catálogo central: permitida (D097/D099), no modelo do mesas (sugestão + triagem admin). Comentário errado de `catalogClient.ts` **já corrigido** nesta branch.
- [x] T0.9 — `SystemBadge`: componente **próprio** do Downloads. Não mover pra `packages/ui`, não tocar `apps/mesas`.
- [x] T0.10 — Card do catálogo: capa + autores + sistema/edição/variante + cenário.
- [x] T0.11 — Ficha: reconstrução completa, fiel aos prints (header 2 colunas, tiles, DETALHES 2 colunas, descrição rica).
- [x] T0.12 — Backfill dispensado (beta em lançamento, 1 material de teste).
- [x] T0.13 — Fila de sugestão de sistema: fase própria dentro da 086, não spec separada.
- [x] T0.14 — **Shell administrativo compartilhado.** Kit visual/UX de gestão do mesas (`https://mesas.artificiorpg.com/gestao`) é extraído **inteiro** para `packages/ui/src/admin/`. **`apps/mesas` NÃO é alterado** nesta spec — o mantenedor migra depois, com o kit já validado no Downloads. Entra nesta spec (e não numa futura) porque a sidebar pública do catálogo é a mesma decisão visual.
- [x] T0.15 — Onde mora o kit: `packages/ui`, subpasta `admin/`, export por subpath (`@artificio/ui/admin`).
- [x] T0.16 — Tokens `--admin-*`: CSS próprio do subpacote (`admin/admin.css`), importado pelo app. **Não** editar `packages/ui/src/styles.css`, **não** duplicar no `index.css` do Downloads.
- [x] T0.17 — Kit **desacoplado**: `packages/ui` não ganha `react-router-dom` nem `lucide-react`. Router e ícones entram por prop (`LinkComponent`, `currentHref`, `icon: ReactNode`).
- [x] T0.18 — Kit **reusa** os primitivos que já existem (`Drawer` no drawer mobile; avaliar `Badge`/`Panel` para `StatusPill`/`SectionCard`). Peça nova só sem equivalente, com o porquê comentado no código.

---

## Fase 1 — Extração backend (override OneBookShelf) · PR próprio

**Armadilha desta fase (verificada no código):** a cadeia preview→banco tem **4 pontos** (`ScrapedItem` → `PlatformOverrideInput`/`genericParsePreviewSchema` → `ingestItemSchema` → `scraperIngest`). `/parse-html` e `/ingest` são chamadas **separadas** — o admin confere o preview e reenvia os itens. Campo ausente em `ingestItemSchema` é **removido pelo Zod sem erro**: aparece no preview e nunca chega ao banco. Ver `plan.md` §"A cadeia de propagação tem 4 pontos".

- [ ] T1.1 — **Ponto 1:** `services/scrapers/types.ts` — `ScrapedItem` ganha os campos novos como opcionais. É o shape que todo adapter e o payload de ingest manual usam.
- [ ] T1.1b — **Ponto 2:** `platformOverrides/index.ts` — `PlatformOverrideInput` ganha os campos aprovados como opcionais (`scenario`, `authorsCredits`, `artistsCredits`, `creationMethod`, `sourceFilters`, `fileSizeText`, `format`, `pageCount`, `sourceCategory`, `descriptionHtml`).
- [ ] T1.1c — **Ponto 3:** `routes/scraper.ts` — `ingestItemSchema` ganha os mesmos campos. **Sem isto a Fase 3 grava null e ninguém percebe.**
- [ ] T1.2 — **Extrator A** (`onebookshelf.ts`): tabela de detalhes. Isola `<table class="table-list">` **primeiro**, procura `data-codeid` só dentro do bloco isolado. Campos: `ruleSystem`, `authors`, `artists`, `creationMethod`, `filters`, `fileSize`, `format`. Tolerante a ausência e a "N / D".
- [ ] T1.3 — **Extrator B**: tiles `product-detail-tile-N`. Captura Page Count e Category, casando por **conjunto de labels conhecidos** (pt-BR "Número de páginas" e en "Page Count"), nunca por posição de tile (ordem varia entre fixtures).
- [ ] T1.4 — **Extrator C**: descrição rica de `<obs-product-description>`. Fallback pro comportamento atual (JSON-LD + `sanitizeText`) quando o bloco não existe. Devolve **dois** valores, não um: `descriptionHtml` (rico, sanitizado na Fase 2) e `description` (texto plano via `sanitizeText`, para busca/`summary`/SEO) — ver `plan.md` §"Descrição são 2 campos".
- [ ] T1.5 — `filters` → `sourceFilters` estruturado: `[{ facet, path: [pai, filho] }]`, lendo o facet do query param do `href` (`tipoDeProduto`/`edicao`/`cenario`/`conteudo`) e a hierarquia dos `<a>` irmãos separados por chevron. `tags` achatadas derivadas.
- [ ] T1.6 — `genericHtmlParser.ts`: `genericParsePreviewSchema` (`.strict()`) ganha os campos novos como opcionais.
- [ ] T1.7 — **Arquivo de teste novo:** `src/services/scrapers/onebookshelf.test.ts` (a extração cresce o suficiente pra não caber em `genericHtmlParser.test.ts`, que já existe e continua cobrindo o caminho genérico). Valor **exato** de pelo menos 1 campo por fixture, nos 3 fixtures.
- [ ] T1.8 — **Teste anti-regressão do gap 3** (no mesmo arquivo): usando `storytellersvault-product-1.html` (6 `commentText`/`customerName`/`badgeType`/`discussionDate`), provar que a extração **não** captura nenhum deles como metadata do produto.
- [ ] T1.9 — Teste provando que a descrição extraída é a completa (contém `<ul>`/`<img>`), não a truncada do JSON-LD.
- [ ] T1.10 — Conferir que `genericHtmlParser.test.ts` (existente) continua verde — o schema `.strict()` mudou, então quebra ali é regressão real, não ruído.
- [ ] T1.11 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md` antes de fechar.** Reler os requisitos 1-3 e 9 da `spec.md` e as seções §"Backend — extração", §"A cadeia de propagação tem 4 pontos" e §"Descrição são 2 campos" do `plan.md`, e confirmar item por item que a implementação bate. Verificar em especial: âncora na `<table class="table-list">` (não `data-codeid` solto), os 3 pontos da cadeia tocados (T1.1/T1.1b/T1.1c), `sku`/`isbn`/`languageFilters` **não** extraídos, `sourceFilters` com facet + hierarquia. Divergência achada aqui = corrigir antes do PR, ou perguntar ao mantenedor se a spec é que está errada — nunca seguir o `tasks.md` contra a `spec.md` calado.
- [ ] T1.12 — `rtk tsc`/lint/testes verdes; PR contra `dev` (ready for review). Autorização de commit/push é por ação — pedir ao mantenedor.

## Fase 2 — Sanitização de HTML rico (frente de segurança) · PR próprio

- [ ] T2.1 — **Perguntar ao mantenedor** qual lib de sanitização (`sanitize-html`, Node puro, vs. `isomorphic-dompurify`, exige jsdom) antes de instalar — regra `AGENTS.md`. Não instalar sem resposta.
- [ ] T2.2 — `services/sanitizeRichHtml.ts` (novo): allowlist de tags/atributos/protocolos conforme `plan.md`. **Não** alterar `sanitizeText.ts`, que continua correto pros campos de texto simples.
- [ ] T2.3 — Extrator C passa a descrição pelo sanitizador rico antes de devolver no preview.
- [ ] T2.4 — **Arquivo de teste novo:** `src/services/sanitizeRichHtml.test.ts` (ao lado do `sanitizeText.test.ts` existente, que **não** deve ser alterado). Payload hostil: `<script>`, `onerror=`, `javascript:` em `href`, `<iframe>`, `<style>`, atributo `style` — todos neutralizados; texto legítimo e formatação da allowlist preservados.
- [ ] T2.5 — Comentário inline no arquivo explicando por que a sanitização é no backend (regra pétrea) e por que `sanitizeText` não serve aqui — referência à spec 086 e à decisão superada da 075.
- [ ] T2.6 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md`.** Requisitos 4, 5 e 24 da `spec.md` + §"Backend — sanitização de HTML rico" e §"Descrição são 2 campos" do `plan.md`. Confirmar: allowlist exatamente como especificada (tags, atributos, protocolos `http`/`https` só, `rel`/`target` no `a`, tag fora da allowlist perde a tag mas **preserva o texto**); sanitização **no backend antes de persistir**, não só no serve; `sanitizeText.ts` **intocado**. Divergência = corrigir ou perguntar, nunca seguir calado.
- [ ] T2.7 — Verde local + PR.

## Fase 3 — Persistência de metadata (migration A + ingest) · PR próprio

- [ ] T3.1 — `migration_026_download_material_metadata_rich_fields.sql`: `file_size_text`, `page_count`, `creation_method`, `source_category`, `source_filters` (JSONB `DEFAULT '[]'`), `description_html`. Header de 5 campos, `online-safe`, `requires-backup: false`, idempotente (`ADD COLUMN IF NOT EXISTS`). Copiar header do vizinho verde mais recente.
- [ ] T3.2 — `db/types.ts`: `DownloadMaterialMetadataTable` com as colunas novas (`source_filters` como `Generated<JSONColumnType<…>>`, padrão dos JSONB existentes).
- [ ] T3.3 — **Ponto 4:** `scraperIngest.ts` grava os campos mapeados (`scenario`, `credits` combinando autores+artistas, `file_format`, `tags`, `file_size_text`, `page_count`, `creation_method`, `source_category`, `source_filters`, `description_html`).
- [ ] T3.3b — **Corrigir `summary` (bug real, `scraperIngest.ts:140`):** hoje é `item.description?.slice(0, 500)`. Passa a derivar do **texto plano**, nunca de `descriptionHtml` — senão o `summary` corta no meio de uma tag e o HTML quebrado vaza pro `ilike` da busca (`routes/materials.ts:98`) e pro card. `download_material.description` também continua texto plano. Comentário inline explicando o porquê, citando a spec 086.
- [ ] T3.4 — `materialMetadata.ts` (`PUT`): `upsertMetadataSchema` aceita os campos novos, preservando a semântica de PUT parcial já existente (não apagar campo salvo por outra tela — achado do PR #190).
- [ ] T3.5 — Testes de gravação: em `src/services/scraperIngest.test.ts` (existente — estender, não criar arquivo novo) os campos gravados pelo ingest **e** que `summary` não contém tag HTML (T3.3b); **arquivo novo** `src/routes/materialMetadata.test.ts` (não existe hoje) cobrindo o `PUT`: campos novos aceitos, PUT parcial não zera campo alheio (achado do PR #190), `source_filters` sempre array.
- [ ] T3.5b — **Teste de ponta a ponta da cadeia (obrigatório):** `/parse-html` → pegar o preview → mandar em `/ingest` → conferir no banco que **todos** os campos novos chegaram. É o único teste que pega o ponto 3 (Zod removendo campo em silêncio). Em `src/routes/scraper.test.ts` (existente — estender).
- [ ] T3.6 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md`.** Requisitos 24 e 15 da `spec.md` + §"Backend — schema (Migration A)" e §"A cadeia de propagação" do `plan.md`. Confirmar: as 6 colunas da migration A criadas com os tipos especificados (`page_count` INTEGER, `source_filters` JSONB `DEFAULT '[]'`); header de 5 campos válido (comparar com o vizinho verde mais recente); idempotente rodando 2x; `summary` derivado do **texto plano** (T3.3b); teste de ponta a ponta preview→ingest→banco passando (T3.5b — é o que pega o ponto 3 da cadeia). Divergência = corrigir ou perguntar.
- [ ] T3.7 — `pnpm verify:api` **antes** de montar o commit (regra `AGENTS.md`, evita descompasso com o hook). Verde local + PR.

## Fase 4 — Taxonomia: resolve + fila de sugestão (migration B + rotas) · PR próprio

**Referência obrigatória desta fase:** o fluxo de draft do `apps/mesas` é o padrão aprovado (decisão do mantenedor). **Ler antes de codar:** `discord/normalizeDiscordTableDraft.ts` (o `needs_review` + badge de hint não casado), `services/systemSuggestionCandidates.ts` (candidatos pontuados + `recommended_action`), `discord/learningFeedbackOutbox.ts:161` (`recordSystemEntityRule` — correção ensina o sistema), `routes/suggestionHelpers.ts` (handler de reject com transação + notificação). Copiar o padrão; **não** alterar nada em `apps/mesas`.

- [ ] T4.1 — `migration_027_download_system_suggestion.sql`: `ADD COLUMN raw_system_hint` em `download_material` **+** tabela `download_system_suggestion` conforme `plan.md` (com `resolution_action`, `resolved_node_id`, `rejection_reason`), `CHECK` de `status`/`source`/`resolution_action`, índice parcial em `status='pending'` e índice em `material_id`. Header de 5 campos, `online-safe`, idempotente. As duas mudanças na **mesma** migration (mesma frente lógica — `AGENTS.md` §Migrations 2.1).
- [ ] T4.2 — `db/types.ts`: `raw_system_hint` em `DownloadMaterialTable`, `DownloadSystemSuggestionTable` nova + registro no `Database`.
- [ ] T4.3 — `catalogClient.ts`: `resolveCatalogNode(rawValue)` via `GET /api/catalog/v1/resolve`; criação de node via `POST /api/catalog/v1/nodes` e registro de alias — ambas **usadas só pela triagem admin**, nunca pelo scraper.
- [ ] T4.4 — **Candidatos pontuados** — `systemSuggestionCandidates.ts` do mesas é **puro e sem dependência externa** (normaliza nome, detecta token de edição, pontua por `name_exact`/`alias_exact`/`base_match`/`base_plus_edition`/`fuzzy_similar`, devolve `recommended_action`). **Perguntar ao mantenedor** antes de codar: copiar a lógica pro Downloads, ou extrair pra pacote compartilhado (frente nova de pacote, mesma trava de `packages/ui`). Não reimplementar pontuação do zero nem entregar lista crua pro revisor.
- [ ] T4.5 — `scraperIngest.ts`: resolve `ruleSystem`/Category → grava `system_id`/`edition_id`. **Não resolvendo:** (a) grava `raw_system_hint` com o texto bruto; (b) insere sugestão `pending` (`source='scraper'`, `material_id`, `raw_value`); (c) sinaliza que o material precisa de revisão de taxonomia, **distinguindo** "não casei mas tenho hint" de "a fonte não trouxe sistema" — igual ao `system_name:unmatched_hint` vs. `system_name` do mesas.
- [ ] T4.6 — Re-tentativa de match ao reprocessar material: tenta `system_name` **e** `raw_system_hint`; casando, preenche `system_id` e **limpa o hint** (padrão de `normalizeDiscordTableDraft.ts:74-81`).
- [ ] T4.7 — `routes/systemSuggestions.ts`: `POST /api/v1/system-suggestions` (auth user) — usuário comum sugere.
- [ ] T4.8 — `routes/systemSuggestionsAdmin.ts`: `GET /api/v1/admin/system-suggestions` (fila), `GET …/:id/candidates` (**pontuados**, com `recommended_action`), `PATCH …/:id/approve`, `PATCH …/:id/reject` (auth admin, com `rejection_reason`). Aprovação/recusa em **transação**, com guarda `status='pending'` pra não processar duas vezes (padrão de `suggestionHelpers.ts` do mesas).
- [ ] T4.9 — **Aprovação ensina o sistema:** registrar o `raw_value` como **alias** do node escolhido no catálogo central e limpar o `raw_system_hint` do material — espírito de `recordSystemEntityRule`. Sem isso a mesma sugestão volta pra fila indefinidamente. Gravar `resolution_action` com o que o revisor fez.
- [ ] T4.10 — Notificar quem sugeriu (`source='user'`) usando `download_notification`, **não** o `notifications` do mesas. Sugestão de origem `scraper` não notifica ninguém.
- [ ] T4.11 — Testes: **arquivos novos** `src/routes/systemSuggestions.test.ts` e `src/routes/systemSuggestionsAdmin.test.ts`; `src/services/catalogClient.test.ts` (não existe hoje — `resolveCatalogNode` com resposta ok/404/timeout, sem rede real); `src/services/systemSuggestionCandidates.test.ts` se a lógica for copiada (T4.4) — o mesas já tem `__tests__/systemSuggestionCandidates.test.ts`, usar como base de casos. Estender `scraperIngest.test.ts`: resolvido preenche `system_id`; não resolvido grava `raw_system_hint` **e** abre sugestão `pending`; re-tentativa casa e limpa o hint; aprovação grava alias + `resolution_action`; usuário comum recebe 403 nas rotas admin.
- [ ] T4.12 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md`.** Requisitos 6 (a-f), 7 e 8 da `spec.md` + §"Backend — taxonomia: espelhar o fluxo de draft do mesas" do `plan.md`. Confirmar **os 6 sub-itens do requisito 6, um por um**: (a) `raw_system_hint` preservado; (b) revisão sinalizada distinguindo "hint não casado" de "sem hint"; (c) sugestão aberta; (d) candidatos **pontuados** com `recommended_action`; (e) aprovação grava alias (senão a fila nunca esvazia); (f) re-tentativa casa e limpa o hint. Confirmar também: escrita no catálogo **só** por ação admin, nunca pelo scraper; node de fallback criado **pela tela**, nunca por migration (requisito 7); zero arquivo de `apps/mesas` tocado. Divergência = corrigir ou perguntar.
- [ ] T4.13 — `pnpm verify:api` antes do commit. Verde local + PR.

## Fase 5 — Contrato público (join do card + snapshot em lote) · PR próprio

- [ ] T5.1 — `GET /materials`: `leftJoin` com `download_material_metadata` adicionando `cover_image_url`, `credits`, `scenario` ao payload de card.
- [ ] T5.2 — Resolução de sistema/edição/variante em **lote** por página, a partir de `GET /api/catalog/v1/snapshot` com cache em memória por TTL — **nunca** uma chamada por material (evita N+1). `path_slug` fornece a cadeia.
- [ ] T5.3 — **Rota nova `GET /api/v1/materials/facets`** (pública, sem auth, mesmo escopo da listagem) — achado bloqueante: `material_type` é `z.string().trim()` **livre** (`routes/materials.ts:21`), o formulário é `<input>` de texto digitado (`NovoMaterialPage.tsx:17`) e **não existe faceta/agregação nenhuma** no backend. Sem esta rota o filtro visível da Fase 8 não tem de onde tirar as opções. Devolve `material_type` em uso com contagem (`GROUP BY` só de `editorial_state='published'`) + `system_id`/`edition_id` em uso, pra sidebar não oferecer filtro que retorna zero (Nielsen: não oferecer ação sem efeito). Cache curto em memória. Declarar a rota em `routes/materials.ts` **antes** de `/:slug`, senão o Express casa "facets" como slug.
- [ ] T5.4 — Testes de rota em `src/routes/materials.list.test.ts` (existente — estender): campos novos no payload de card, material sem metadata (todos null, sem quebrar o `leftJoin`), ausência de N+1 (assertar contagem de chamadas ao catálogo por página, com mock do `catalogFetch`), e `/facets` devolvendo só valores de material publicado (rascunho/retirado não aparece).
- [ ] T5.5 — **`material_type` texto livre — RESOLVER nesta spec (requisito 25), não empurrar.** `z.string().trim()` no backend + `<input>` de texto no formulário permite "aventura"/"Aventura"/"aventuras" como valores distintos, e a faceta exibiria os três. Toca backend e frontend, então entra nesta spec (regra do mantenedor, 2026-07-25). **Perguntar ao mantenedor apenas a forma**, antes de codar: enum fechado em Zod + `<select>` no formulário (mais rígido, exige decidir a lista e migrar valores existentes) ou normalização + taxonomia consultável como sistemas/edições (mais flexível). Não escolher sozinho, e não fechar a fase deixando o campo livre. Se a forma escolhida exigir migration de dados já gravados, ela entra nesta fase com o checklist pétreo de migration.
- [ ] T5.6 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md`.** Requisitos 10, 23 e 25 da `spec.md` + §"Backend — contrato público" e §"Facetas" do `plan.md`. Confirmar: `leftJoin` (não `innerJoin` — material sem metadata não pode desaparecer da listagem); resolução de sistema em **lote**, com teste contando chamadas ao catálogo (sem N+1); `/facets` declarada **antes** de `/:slug` no router; `/facets` só com `editorial_state='published'`; `material_type` não mais livre (T5.5). Divergência = corrigir ou perguntar.
- [ ] T5.7 — `pnpm verify:api`: rota nova documentada, 0 breaking changes nos campos (aditivos/opcionais). Verde local + PR.

## Fase 5B — Kit administrativo compartilhado: extração para `packages/ui/src/admin/` · PR próprio

**Trava desta fase, verificada em cada PR:** `git diff --name-only` **não** contém nenhum arquivo de `apps/mesas/**`. Se contiver, o PR está errado.

- [ ] T5B.1 — Estrutura: `packages/ui/src/admin/` + `index.ts` (barrel) + `exports` do `package.json` ganha `./admin` e `./admin/admin.css`, no padrão que o pacote já usa para `./brand`/`./modules`/`./changelog`. **Nenhuma** dependência nova em `dependencies`.
- [ ] T5B.2 — `admin/admin.css`: tokens `--admin-rail`, `--admin-surface`, `--admin-canvas`, `--admin-hover`, `--fg-low`, `--fg-faint`, `--fg-ghost`, `--border`, `--border-strong`, `--shadow-card` (+ os demais que o kit usar), **dark e light**, copiados dos valores reais de `apps/mesas/frontend/src/index.css`. Não editar `packages/ui/src/styles.css`.
- [ ] T5B.3 — Peças sem dependência externa (cópia direta): `cn.ts`, `tabButtonClass.ts`, `Breadcrumb.tsx`, `PageHeader.tsx`, `AdminMain.tsx`, `AdminWorkspaceLayout.tsx`.
- [ ] T5B.4 — **Reuso de primitivos** (T0.18): antes de criar `SectionCard`/`StatusPill`, verificar `Panel`/`Badge` já exportados. Se servirem, reusar/derivar; se divergirem de fato, criar e **comentar a divergência no código**. Se o reuso exigir **alterar** o primitivo, **parar e perguntar** — deixaria de ser frente aditiva.
- [ ] T5B.5 — `AdminSidebar.tsx` desacoplado: props `groups` (`{label, href, icon?: ReactNode, badge?}`), `currentHref`, `LinkComponent`. Estado ativo por comparação de `href`, não por `isActive` do router. Preserva rail com border-left, badge de pendência e o rodapé de contagem.
- [ ] T5B.6 — `MetricCard.tsx` desacoplado: `LinkComponent` opcional; sem ela, renderiza `div` (comportamento atual do mesas quando não há `to`).
- [ ] T5B.7 — `AdminTable.tsx` desacoplado (peça mais pesada, 14,7 KB): facetas passam a ser **controladas** por props `facetValues` + `onFacetChange` em vez de `useSearchParams`; ícones por `ReactNode`. O kit não sabe que URL existe — o app liga ao router.
- [ ] T5B.8 — `bulkActions.tsx`: `bulkDelete`/`bulkArchive` viram factories que recebem o ícone por parâmetro (não importam `lucide-react`).
- [ ] T5B.9 — **Infra de teste (bloqueante, resolver ANTES de T5B.10).** `packages/ui/vitest.config.ts` usa `environment: "node"` e o único teste existente (`src/primitives.test.tsx`) roda por `renderToStaticMarkup` (SSR) — **não há DOM**, então clique/interação não é testável hoje. `AdminTable`/`AdminSidebar` exigem interação real. Decidir e registrar: (a) adicionar `jsdom`/`happy-dom` + `@testing-library/react` como devDependency de `packages/ui` — **é dependência nova, perguntar ao mantenedor antes de instalar** (`AGENTS.md`); ou (b) testar estrutura por SSR no pacote e cobrir interação nos testes do app consumidor (Downloads, que já tem jsdom). Não escrever teste de interação em `packages/ui` antes desta decisão.
- [ ] T5B.10 — Testes **dentro de `packages/ui`**, arquivo `.test.tsx` por peça, seguindo a convenção do pacote (`src/admin/<Peca>.test.tsx`), no formato viável definido em T5B.9:
  - `AdminSidebar.test.tsx` — grupos renderizados, `currentHref` marca o item ativo, badge de pendência aparece/some, `LinkComponent` é usado.
  - `AdminMain.test.tsx` — header só renderiza com conteúdo (`hasHeader`), eyebrow/breadcrumb/ações/subnav nos lugares.
  - `AdminWorkspaceLayout.test.tsx` — inspector some quando `inspector === null`, botão de fechar chama `onCloseInspector`.
  - `Breadcrumb.test.tsx`, `PageHeader.test.tsx` — trilha, último segmento destacado, ação à direita.
  - `SectionCard.test.tsx`, `StatusPill.test.tsx`, `MetricCard.test.tsx` — variantes/tons; `MetricCard` sem `LinkComponent` renderiza `div`, com ela renderiza link.
  - `AdminTable.test.tsx` — colunas, `facetValues`/`onFacetChange` controlados, seleção em massa, ação de linha, `confirm` de ação destrutiva. **Se T5B.9 escolher (b)**, a parte de interação migra para o teste no Downloads e este arquivo cobre só estrutura — registrar a escolha aqui, não deixar buraco silencioso.
  - `tabButtonClass.test.ts`, `cn.test.ts` — puros, sem DOM.
- [ ] T5B.11 — `pnpm build` de `packages/ui` verde **e** build dos consumidores (`site`, `mesas`, `glossario`, `downloads`, `links`) verde — prova de que a frente é aditiva e não quebrou ninguém.
- [ ] T5B.12 — Verificações objetivas: `git diff` sem `apps/mesas/**`; `package.json` sem `react-router-dom`/`lucide-react` em `dependencies` (devDependency de teste, se aprovada em T5B.9, é permitida e não conta como dep de runtime); nenhum primitivo existente alterado.
- [ ] T5B.13 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md`.** Requisitos 16-20 da `spec.md` + §"Shell administrativo compartilhado" do `plan.md`. Confirmar: as 13 peças extraídas (nenhuma esquecida); as 3 peças desacopladas de router (`AdminSidebar`/`MetricCard`/`AdminTable`) recebendo `LinkComponent`/`currentHref`/`facetValues`+`onFacetChange`; nenhum `import` de `react-router-dom` ou `lucide-react` dentro de `src/admin/`; tokens em `admin/admin.css` com dark **e** light; `styles.css` intocado; reuso de primitivos decidido e comentado (T5B.4); `git diff` sem `apps/mesas/**`. Divergência = corrigir ou perguntar.
- [ ] T5B.14 — Verde local + PR. **`packages/ui` é pacote compartilhado — pedir aprovação ao mantenedor antes do commit**, conforme `AGENTS.md`.

## Fase 5C — Gestão do Downloads sobre o kit · PR próprio

- [ ] T5C.1 — `index.css` do Downloads importa `@artificio/ui/admin/admin.css`.
- [ ] T5C.2 — `GestaoShell.tsx` reconstruído como composição `AdminSidebar` + `AdminMain`, passando `NavLink` como `LinkComponent` e `useLocation()` como `currentHref`; ícones lucide (o app já tem a dep).
- [ ] T5C.3 — **Preservar sem regressão** (cada item vira teste): grupos Conteúdo/Operação/Comunidade/Sistema; contagem por fila (`moderation_queue`/`reports_open`/`degraded_links`); fila P0 sinalizada por **ícone + texto, nunca só cor** (critério de aceite da spec 075); `adminOnly` espelhando o guard de `RequireGestaoAuth` (achado do PR #201, Codex); link externo "Sistemas e edições" pro Site; alvos de toque ≥ 44 px.
- [ ] T5C.4 — Drawer mobile passa a usar o `Drawer` de `packages/ui` em vez do `fixed inset-0` à mão de hoje. **Atenção (verificado no código):** esse `Drawer` tem `role="dialog"`, `aria-modal`, backdrop clicável e fechar por Escape (`useEscapeClose`), mas **NÃO tem foco preso/restaurado** — D108 exige foco preso. Ou o foco é resolvido no consumidor, ou o primitivo precisa ganhar focus trap; alterar o primitivo deixa de ser frente aditiva, então **perguntar ao mantenedor** antes (mesma trava de T5B.4).
- [ ] T5C.5 — Telas de gestão existentes adotam `PageHeader`/`SectionCard`/`StatusPill`/`AdminTable` onde já havia tabela/lista à mão (materiais, moderação, denúncias, plataformas).
- [ ] T5C.6 — Comentários inline atualizados: o `GestaoShell` tem comentários explicando decisões da 075/085 (sidebar de recursos, P0 por ícone, `adminOnly`) — **preservar/reescrever**, nunca apagar (regra `AGENTS.md` sobre comentário de decisão).
- [ ] T5C.7 — Testes: `src/components/GestaoShell.test.tsx` (existente — estender, não recriar) cobrindo T5C.3 **item por item**; as telas de gestão tocadas em T5C.5 já têm `.test.tsx` colocalizado (`GestaoMateriaisPage`, `GestaoModeracaoPage`, `GestaoDenunciasPage`, `GestaoPlataformasPage`) — atualizar cada um que mudar de estrutura, nunca deixar teste apontando pra markup antiga.
- [ ] T5C.8 — **Smoke visual comparativo** com `https://mesas.artificiorpg.com/gestao`: mesma linguagem de rail, header, cards e tabela. **Validação do mantenedor** antes de fechar a fase — é ele quem aprova o kit para depois migrar o mesas.
- [ ] T5C.9 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md`.** Requisito 21 da `spec.md` + §"Gestão do Downloads sobre o kit" do `plan.md`. Confirmar **os 6 itens de não-regressão do T5C.3, um por um**: grupos Conteúdo/Operação/Comunidade/Sistema; contagem por fila; fila P0 com **ícone + texto** (não só cor); `adminOnly` espelhando o guard; link externo "Sistemas e edições"; alvos ≥ 44 px. Confirmar também: comentários de decisão da 075/085 preservados/reescritos, nunca apagados; foco preso do drawer resolvido (T5C.4); zero arquivo de `apps/mesas`. Divergência = corrigir ou perguntar.
- [ ] T5C.10 — Verde local + PR.

## Fase 6 — Frontend: card do catálogo · PR próprio

- [ ] T6.1 — `types/material.ts`: `cover_image_url`, `credits`, `scenario`, dados de sistema/edição/variante (`.nullable().optional()`).
- [ ] T6.2 — `components/SystemChainBadge.tsx` (novo, próprio do Downloads): nome + cadeia sistema › edição › variante, padrão visual do `SystemBadge` do mesas (pílula, ícone de dado como fallback), **sem** dependência do `/sys-logos/` servido pelo frontend do mesas.
- [ ] T6.3 — `MaterialCard.tsx`: capa real quando existe (`onError` → placeholder atual; placeholder quando `null`); "Por \<autores\>"; "Para \<cenário\>"; badge de sistema/edição/variante.
- [ ] T6.4 — Testes: `src/components/MaterialCard.test.tsx` (existente — estender) com/sem capa, `onError` caindo pro placeholder, sem autores, sem cenário, sem sistema; **arquivo novo** `src/components/SystemChainBadge.test.tsx` (cadeia completa, só sistema, fallback de ícone quando não há logo).
- [ ] T6.5 — **Smoke visual real** (browser/screenshot): card com capa, autores, cenário e cadeia de sistema. Não fechar a task só com teste verde.
- [ ] T6.6 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md`.** Requisitos 11 e 15 da `spec.md` + §"Frontend" do `plan.md`, mais o print `mais prints com aprenddizados.png` (header com "Por \<autores\>"). Confirmar: capa condicional com `onError` caindo pro placeholder (nunca layout quebrado); autores, cenário e cadeia sistema › edição › variante presentes; `SystemChainBadge` é **próprio do Downloads**, sem depender de `/sys-logos/` do mesas; material sem nenhum desses campos renderiza sem "undefined". Divergência = corrigir ou perguntar.
- [ ] T6.7 — Verde local + PR.

## Fase 7 — Frontend: ficha do material (reconstrução) · PR próprio

- [ ] T7.1 — `hooks/useMaterialMetadata.ts`: schema Zod ampliado com os campos novos + `description_html`.
- [ ] T7.2 — `MaterialPage.tsx`: grid 2 colunas ≥ `lg` (capa \| título, "Para \<cenário\>", "Por \<autores\>", CTA), colapsando em 1 coluna abaixo do breakpoint.
- [ ] T7.3 — Faixa de tiles com ícone (cenário/formato/páginas/adicionado), no padrão do print `outra captura.png`.
- [ ] T7.4 — Bloco "DETALHES" em 2 colunas (print `apresentação dos dados do produto.png`): cenário, autores, artistas, método de criação, filtros à esquerda; tamanho, formato, páginas, categoria à direita.
- [ ] T7.5 — Descrição rica via `dangerouslySetInnerHTML` do HTML **já sanitizado no backend**; comentário inline explicando por que é seguro aqui (garantia no backend, Fase 2) e o que quebraria se alguém removesse a sanitização.
- [ ] T7.6 — Filtros/tags como chips clicáveis levando ao catálogo filtrado.
- [ ] T7.7 — Compatibilidade: material sem metadata rica (legado/`json_ld_generic`) renderiza sem seção vazia nem "undefined".
- [ ] T7.8 — **Arquivo de teste novo:** `src/pages/MaterialPage.test.tsx` — a ficha **não tem teste nenhum hoje** (confirmado: só `CatalogoPage`, `HomePage` e `SobreEUsoPage` têm `.test.tsx` em `pages/`), então esta fase cria o primeiro. Cobrir: com/sem metadata rica, com/sem descrição rica, com/sem capa, ficha legada (`json_ld_generic`) sem seção vazia nem "undefined", e que o HTML da descrição é renderizado (não escapado como texto).
- [ ] T7.9 — **Smoke visual real**: ficha completa e ficha pobre (legado), desktop e mobile.
- [ ] T7.10 — 🔁 **GATE DE FASE — cruzar com `spec.md`, `plan.md` e os prints.** Requisitos 12, 15 e 24 da `spec.md` + §"Frontend" do `plan.md`. Confirmar contra as capturas de referência (`C:\projetos\artificio\temp\`): header 2 colunas como em `mais prints com aprenddizados.png`; faixa de tiles como em `outra captura.png`; bloco DETALHES 2 colunas como em `apresentação dos dados do produto.png`. Confirmar também: colapsa em 1 coluna no mobile; descrição prefere `description_html` e cai em `description` quando null (requisito 24); comentário inline no `dangerouslySetInnerHTML` explicando a garantia do backend; ficha legada sem seção vazia. Divergência = corrigir ou perguntar.
- [ ] T7.11 — Verde local + PR.

## Fase 8 — Frontend: filtro do catálogo (sidebar + chips) · PR próprio

- [ ] T8.1 — Hooks de opções de filtro: `hooks/useCatalogSystems.ts` (novo) — sistema/edição de `GET /api/catalog/v1/systems`/`snapshot`, com cache; `hooks/useMaterialFacets.ts` (novo) — `material_type` em uso via `GET /api/v1/materials/facets` (T5.3). **`material_type` NÃO é enum** (é `z.string()` livre, verificado) — as opções vêm da faceta, jamais de lista hardcoded no frontend.
- [ ] T8.2 — `components/CatalogFilterSidebar.tsx`: sidebar ≥ 1024 px / drawer abaixo (D108), usando o `Drawer` de `packages/ui` (backdrop e Escape já resolvidos; **foco preso NÃO** — ver T5C.4, mesma pendência) e os **tokens do kit administrativo** (Fase 5B) — mesmo vocabulário visual de rail/agrupamento, sem inventar aparência própria (requisito 22). Não é o `AdminSidebar` (semântica diferente: filtro, não navegação), mas lê como o mesmo sistema. Controles pra `material_type`, `system_id`, `edition_id`.
- [ ] T8.3 — `components/ActiveFilterChips.tsx`: chips `⊗` dos filtros ativos acima da lista, formato do print `subnav importante.png` (pílula + remover), com linha de resumo textual.
- [ ] T8.4 — `CatalogoPage.tsx`: integra sidebar + chips mantendo os query params como contrato único (D073); remover filtro por chip atualiza URL e lista.
- [ ] T8.5 — Testes: `src/pages/CatalogoPage.test.tsx` (existente — estender) clicar controle → URL muda → lista atualiza; **arquivos novos** `src/components/CatalogFilterSidebar.test.tsx` e `src/components/ActiveFilterChips.test.tsx` (chip remove o filtro; drawer abre/fecha; comportamento de foco conforme o que T5C.4 decidir).
- [ ] T8.6 — Acessibilidade: checklist das 10 heurísticas de Nielsen registrado na sessão (regra `AGENTS.md` §Regras de Produto), alvos ≥ 44 px, `aria` do drawer.
- [ ] T8.7 — **Smoke visual real**: sidebar desktop, drawer mobile, chips removendo filtro.
- [ ] T8.8 — 🔁 **GATE DE FASE — cruzar com `spec.md`, `plan.md`, D108 e o print.** Requisitos 13, 22 e 23 da `spec.md` + §"Frontend" e §"Facetas" do `plan.md`, mais `subnav importante.png`. Confirmar: **controles na sidebar/drawer** (D108 é decisão firme — controle em barra horizontal no topo viola); chips `⊗` só representam o estado ativo, no formato do print; opções de `material_type` vindas da faceta, **nunca** hardcoded; nenhuma opção com contagem zero oferecida; tokens do kit reusados (requisito 22, não aparência própria); query params seguem contrato único (D073); foco do drawer conforme T5C.4. Divergência = corrigir ou perguntar.
- [ ] T8.9 — Verde local + PR.

## Fase 9 — Frontend: editor rich-text + triagem admin · PR próprio

- [ ] T9.1 — Instalar TipTap (aprovado em T0.5) com o conjunto **mínimo** de extensões: bold, italic, underline, strike, link, bullet/ordered list, image, heading (h2-h4), blockquote, horizontal rule. Sem extensão paga/colaborativa.
- [ ] T9.2 — `components/RichTextEditor.tsx`: editor headless estilizado com o design system (Tailwind/`packages/ui`), sem CSS de terceiros; toolbar acessível por teclado.
- [ ] T9.3 — Integrar na edição de descrição do material (gestão e/ou painel do criador — confirmar com o mantenedor **onde** aparece antes de espalhar em duas telas).
- [ ] T9.4 — Envio passa pelo sanitizador do backend (Fase 2) — o cliente **nunca** é a garantia; teste provando que HTML hostil colado no editor é limpo no servidor.
- [ ] T9.5 — Tela de triagem de sugestão de sistema `pages/gestao/GestaoSugestoesSistemaPage.tsx` (nova): fila pendente, `raw_value`, candidatos do catálogo, ações aprovar/recusar/casar/criar node. Aviso na tela de que node criado no catálogo central é compartilhado com mesas/glossário e não se apaga (D099 — item errado é mesclado com redirect). Construída sobre `PageHeader`/`SectionCard`/`AdminTable`/`StatusPill` do kit (Fase 5B), não com markup à mão.
- [ ] T9.5b — Registrar a tela na navegação e no roteador: `App.tsx` ganha `<Route path="/gestao/sugestoes-sistema" element={<RequireGestaoAuth>…}>` (padrão das 14 rotas de gestão existentes) e `GestaoShell` ganha o item no grupo **Sistema**. Conferir se precisa de `adminOnly`, espelhando o `requiredRole` do guard (achado do PR #201: item visível pra quem a rota rejeita é bug).
- [ ] T9.5c — **Contador de pendentes na sidebar é mudança de backend, não só UI** (verificado): `GET /api/v1/admin/summary` (`routes/admin.ts:25-33`) devolve exatamente 3 filas e `adminSummarySchema` (`hooks/useAdminSummary.ts:10-14`) é um objeto Zod **fechado** — chave nova quebra o parse se não for declarada. Para a fila de sugestão aparecer com contagem: adicionar `system_suggestions_pending` na rota **e** no schema do hook, no mesmo formato `{ count, oldest_since? }`. Estender `routes/admin.test.ts` (existente). Alternativa (se preferir não tocar o resumo): hook próprio só pra essa contagem — decidir na implementação e registrar qual foi.
- [ ] T9.6 — Testes: **arquivos novos** `src/components/RichTextEditor.test.tsx` (toolbar aplica marca, conteúdo inicial carrega, `onChange` emite HTML) e `src/pages/gestao/GestaoSugestoesSistemaPage.test.tsx` (fila vazia, fila com pendente, candidatos listados, aprovar/recusar chamam a mutação certa, aviso de node compartilhado visível). Os `.test.tsx` das telas de edição tocadas em T9.3 (`painel/EditarMaterialPage.test.tsx` e/ou a de gestão) atualizados pra refletir o campo de descrição virando editor.
- [ ] T9.7 — **Smoke visual real** do editor e da fila.
- [ ] T9.8 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md`.** Requisitos 4, 5, 6(d-e) e 7 da `spec.md` + §"Backend — taxonomia" e §"Frontend" do `plan.md`. Confirmar: HTML hostil colado no editor é limpo **no servidor** (o cliente nunca é a garantia — teste de T9.4); TipTap com o conjunto mínimo de extensões, estilizado pelo design system sem CSS de terceiros; a triagem entrega **candidatos pontuados** com `recommended_action`, não lista crua (requisito 6d); criar node pela tela funciona com nome definido pelo admin (requisito 7); aviso de node compartilhado/D099 visível; tela construída sobre o kit da Fase 5B, não markup à mão. Divergência = corrigir ou perguntar.
- [ ] T9.9 — Verde local + PR.

## Fase 10 — Nav e footer · PR próprio

- [ ] T10.1 — **Já verificado (2026-07-25): o `Footer` de `packages/ui` NÃO aceita link extra por app.** Estrutura fixa (`Footer.tsx`): marca + tagline, nav "Projetos" (`navItems`, projetos do hub), texto de presente, linha de copyright com **um** link (`copyrightHref`, default `{BRAND_ORIGIN}/termos-de-uso-e-direitos-autorais/`), e a base. As únicas props são `variant`, `navItems`, `brandHref`, `copyrightHref` — nenhuma para link institucional próprio do app. **Perguntar ao mantenedor qual caminho** antes de codar:
  - (a) prop nova opcional em `Footer` (ex.: `moduleLinks?: NavItem[]`) — mexe em pacote compartilhado, mas é aditivo e retrocompatível (todos os consumidores atuais continuam sem passar nada);
  - (b) reusar `copyrightHref` apontando pra `/sobre-e-uso` do Downloads — zero mudança no pacote, mas troca o link de termos global do hub pelo institucional do app, o que muda o significado do rótulo "Ver termos de uso e direitos autorais";
  - (c) faixa própria do Downloads acima do `Footer` compartilhado, dentro de `AppShell` — zero mudança no pacote, mas o link não fica visualmente no footer.
- [ ] T10.2 — `AppShell.tsx`: remover `{ label: 'Sobre e uso', href: '/sobre-e-uso' }` de `moduleNav`.
- [ ] T10.3 — Link "Sobre e uso" no footer; rota `/sobre-e-uso` **preservada** no router (SEO, sem 404).
- [ ] T10.4 — Testes: `src/pages/SobreEUsoPage.test.tsx` (existente — a rota continua viva, teste segue valendo); **arquivo novo** `src/components/AppShell.test.tsx` (não existe hoje) provando que "Sobre e uso" **não** está em `moduleNav` e que o link aparece no footer. Se o `Footer` de `packages/ui` mudar (T10.1), atualizar `packages/ui/src/primitives.test.tsx` ou criar `Footer.test.tsx` no pacote.
- [ ] T10.5 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md`.** Requisito 14 da `spec.md`. Confirmar: "Sobre e uso" fora de `moduleNav`; link presente no footer pelo caminho que o mantenedor escolheu em T10.1; rota `/sobre-e-uso` **respondendo 200** (SEO — remover a rota seria regressão, não simplificação); se o `Footer` de `packages/ui` mudou, a mudança é aditiva/retrocompatível e os outros consumidores buildam. Divergência = corrigir ou perguntar.
- [ ] T10.6 — Verde local + PR.

## Fase 11 — Validação final e fechamento

- [ ] T11.0 — 🔁 **GATE FINAL — varredura completa da `spec.md` e do `plan.md`.** Percorrer os **25 requisitos** da `spec.md` e **todos** os critérios de aceite, marcando um por um contra o que foi entregue. Percorrer a tabela §"Estado atual verificado" do `plan.md` e confirmar que cada consequência listada foi endereçada. Percorrer os 10 gaps do §Problema e confirmar que cada um foi fechado (ou tem decisão explícita do mantenedor pra ficar aberto). Requisito não atendido = spec **não** está pronta, independentemente de todas as fases estarem marcadas — as travas objetivas (`git diff` sem `apps/mesas`, `package.json` sem dep de router, `/facets` antes de `/:slug`, `summary` sem HTML) são reconferidas aqui, não assumidas dos gates de fase.
- [ ] T11.1 — `rtk tsc`/lint/build/test verdes em backend e frontend.
- [ ] T11.2 — `pnpm verify:api` final.
- [ ] T11.3 — Fechamento documental: `specs/backlog.md` — as 4 linhas já registradas em 2026-07-25 (`BL-086-DOWNLOADS-METADATA-RICA`, `D-086-01`, `D-086-02`, `D-086-03`) atualizadas com o resultado real; `.specify/memory/project-state.md`; sessão do dia. Conferir se as pendências abertas dentro das fases (T2.1 lib de sanitização, T5B.9 infra de teste, T5C.4/T8.2 foco preso do `Drawer`, T9.3 onde o editor aparece, T10.1 `Footer`) foram todas resolvidas ou viraram débito nomeado — nenhuma pode ficar só no chat.
- [ ] T11.3b — **Auditoria dos comentários de review de bot.** Percorrer os PRs das fases e conferir que **cada** achado que virou código tem comentário no ponto corrigido, com origem (PR + bot + severidade), o erro real e a razão da correção — padrão da §"Review de bot" no topo deste arquivo. Buscar por comentário genérico (`// fix review`, `// ajuste do CodeRabbit`) e por correção sem comentário nenhum: as duas coisas são achado desta auditoria. Conferir também que nenhum comentário de decisão preexistente foi **apagado** em fix posterior (`AGENTS.md`) — se a razão mudou, devia ter sido reescrito. Achado de bot descartado sem justificativa registrada = reabrir.
- [ ] T11.4 — Smoke real em beta pós-deploy: publicar material da fonte real, conferir card/ficha/filtro visualmente e a fila de sugestão funcionando ponta a ponta.
- [ ] T11.5 — Migrations: conferir que nenhuma das 2 acumulou com pendentes acima do guard `MAX_AUTO_PENDING=5` antes do deploy (`AGENTS.md` §Migrations 4 / `errors.md` E012).
- [ ] T11.6 — **Auditoria de cobertura de teste da spec.** Conferir que cada arquivo novo/alterado tem `.test` correspondente, contra a lista consolidada:

  | Fase | Arquivos de teste — **novos** | Arquivos de teste — **estendidos** |
  |---|---|---|
  | 1 | `services/scrapers/onebookshelf.test.ts` | `services/scrapers/genericHtmlParser.test.ts` |
  | 2 | `services/sanitizeRichHtml.test.ts` | — (`sanitizeText.test.ts` **não** muda) |
  | 3 | `routes/materialMetadata.test.ts` | `services/scraperIngest.test.ts`, `routes/scraper.test.ts` (ponta a ponta preview→ingest→banco, T3.5b) |
  | 4 | `routes/systemSuggestions.test.ts`, `routes/systemSuggestionsAdmin.test.ts`, `services/catalogClient.test.ts` | `services/scraperIngest.test.ts` |
  | 5 | — | `routes/materials.list.test.ts` (card + `/facets`) |
  | 5B | `packages/ui/src/admin/*.test.tsx` (uma por peça — formato conforme T5B.9) | — |
  | 5C | — | `components/GestaoShell.test.tsx` + `.test.tsx` das telas tocadas |
  | 6 | `components/SystemChainBadge.test.tsx` | `components/MaterialCard.test.tsx` |
  | 7 | `pages/MaterialPage.test.tsx` (**primeiro teste da ficha**) | — |
  | 8 | `components/CatalogFilterSidebar.test.tsx`, `components/ActiveFilterChips.test.tsx` | `pages/CatalogoPage.test.tsx` |
  | 9 | `components/RichTextEditor.test.tsx`, `pages/gestao/GestaoSugestoesSistemaPage.test.tsx` | `.test.tsx` da tela de edição escolhida em T9.3; `routes/admin.test.ts` se o contador entrar no resumo (T9.5c) |
  | 10 | `components/AppShell.test.tsx` | `pages/SobreEUsoPage.test.tsx` |

  Arquivo tocado sem teste correspondente = task reaberta, não fechada (`AGENTS.md` §Conclusão de Tarefas).

---

## Débitos registrados em `specs/backlog.md` (2026-07-25)

- **`BL-086-DOWNLOADS-METADATA-RICA`** — a própria spec, status "pronta pra desenvolvimento".
- **`D-086-01` (futuro, decisão do mantenedor)** — **migrar `apps/mesas` para o kit administrativo compartilhado**. Esta spec cria o kit em `packages/ui/src/admin/` e o valida no Downloads, mas **proíbe** tocar `apps/mesas` (requisito 17, trava por `git diff`). Depois de o mantenedor aprovar o kit rodando (T5C.8), o mesas troca os imports para `@artificio/ui/admin`, apaga as peças locais e os tokens `--admin-*` duplicados do `index.css`. Toca app em produção com gestão ativa — spec/PR própria e aprovação nominal. Duas cópias do kit coexistem até então, por decisão deliberada.
- **`D-086-02`** — `POST /api/v1/admin/scraper/parse-html` fora do bundle OpenAPI (não retorna em `artificio-api-governance`). Débito de documentação de contrato; verificar se outras rotas de `scraper.ts` têm o mesmo problema.
- **`D-086-03` (fechado)** — comentário de `catalogClient.ts` afirmava que escrita no catálogo central era proibida no Downloads, contra D097/D099. Corrigido nesta branch, `rtk tsc` verde. Commit pendente de autorização nominal.
- Herdados da 085, ainda abertos e independentes desta spec: `D-085-04` (workflows não expõem `ALLOW_MANUAL_MIGRATIONS` via `workflow_dispatch`) e `BL-085-DOWNLOADS-PARSER-HTML` T9.2 (smoke funcional real da 085).
