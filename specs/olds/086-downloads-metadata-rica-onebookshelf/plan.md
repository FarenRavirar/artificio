# Plano — 086 (Downloads: metadata rica, taxonomia e reconstrução do catálogo)

Base de fato: toda afirmação sobre estado atual abaixo foi verificada no código em 2026-07-25 (arquivo e linha citados), não em memória de chat. Rotas descobertas via `artificio-api-governance`, conforme `AGENTS.md`.

## Estado atual verificado (ponto de partida)

| Fato | Onde | Consequência pro plano |
|---|---|---|
| `GET /api/v1/material-metadata/:materialId` faz `selectAll()` e é público (`auth: none`) | `routes/materialMetadata.ts:40-66` | metadata rica **já é servida**; a ficha custa menos que a spec anterior supunha — o gap é o Zod do frontend |
| Zod do frontend declara só 6 campos | `hooks/useMaterialMetadata.ts:5-13` | ampliar schema, não criar rota |
| `GET /materials` usa `PUBLIC_MATERIAL_FIELDS` sem join | `routes/materials.ts:107` | join novo é obrigatório pro card |
| `MaterialCard` tem `"Sem capa"` hardcoded incondicional | `components/MaterialCard.tsx:19-21` | trocar por render condicional |
| `scraperIngest` grava só `language`/`publisher_name`/`cover_image_url` | `services/scraperIngest.ts:155-162` | ponto único onde a persistência nova entra |
| `PlatformOverrideInput` tem 9 campos, nenhum de metadata rica | `platformOverrides/index.ts:11-21` | tipo cresce; `genericParsePreviewSchema` é `.strict()`, precisa acompanhar |
| `sanitizeText()` faz strip total de tags | `services/sanitizeText.ts:6-20` | não serve pra HTML rico; caminho novo, sem quebrar o uso atual |
| `GET /api/catalog/v1/resolve`, `/systems`, `/snapshot` são públicos (`auth: none`, owner `site`) | bundle OpenAPI via `artificio-api-governance` | resolve de taxonomia e lista de filtro têm fonte real |
| `catalogClient.ts` do Downloads só lê (`getCatalogNodeById`) | `services/catalogClient.ts` | escrita é frente nova; comentário errado já corrigido nesta branch |
| Fila de sugestão do mesas: `POST /api/v1/system-suggestions` + 5 rotas admin | bundle OpenAPI via `artificio-api-governance` | contrato de referência a copiar |
| `SystemBadge` vive em `apps/mesas/frontend/src/components/`, não em `packages/ui` | verificado | componente próprio no Downloads (decidido) |
| Kit admin do mesas: `features/admin/components/` + `components/ui/` (12 peças) | `AdminSidebar.tsx`, `AdminMain.tsx`, `AdminWorkspaceLayout.tsx`, `Breadcrumb.tsx`, `ui/{PageHeader,SectionCard,MetricCard,StatusPill,AdminTable,bulkActions,tabButtonClass,cn}` | base da extração; reproduzir comportamento, não redesenhar |
| Tokens `--admin-*`/`--fg-low`/`--shadow-card` só em `apps/mesas/frontend/src/index.css` (dark 32-34/72, light 204-206/227) | verificado | tokens viajam com o kit em CSS próprio |
| `packages/ui` não tem `react-router-dom` nem `lucide-react`; deps = `react`, `react-dom`, `@artificio/{auth,config,changelog}` | `packages/ui/package.json` | kit desacoplado por prop (decidido) |
| `packages/ui` já exporta `Drawer`, `Badge`, `Panel`, `Modal`, `Button`, `Toolbar`, `EmptyState` | `packages/ui/src/index.ts` | reusar antes de criar peça nova |
| `GestaoShell` do Downloads usa `--surface-subtle`/`--line`/`--fg-muted` + `bg-artificio-orange/20`, drawer à mão | `components/GestaoShell.tsx` | reconstruir sobre o kit, preservando filas/P0/adminOnly/44 px |
| `Drawer` de `packages/ui` tem `role="dialog"`/`aria-modal`/backdrop/Escape mas **não tem foco preso** | `packages/ui/src/primitives.tsx:394-437` | D108 exige foco preso — resolver no consumidor ou dar focus trap ao primitivo (perguntar antes) |
| `packages/ui/vitest.config.ts` usa `environment: "node"`; único teste roda por `renderToStaticMarkup` (SSR) | `packages/ui/vitest.config.ts`, `src/primitives.test.tsx` | **sem DOM** — teste de interação no pacote exige `jsdom`/`@testing-library` (dep nova, perguntar) ou migra pro app consumidor |
| Cadeia de propagação do preview até o banco tem **4 pontos**, não 2 | `scrapers/types.ts:ScrapedItem` → `platformOverrides/index.ts:PlatformOverrideInput` → `routes/scraper.ts:ingestItemSchema` → `services/scraperIngest.ts` | campo que falte em **qualquer** um é descartado silenciosamente entre preview e persistência |
| `summary` é derivado de `description.slice(0, 500)` | `services/scraperIngest.ts:140` | se `description` virar HTML, o `summary` corta no meio de tag — bug real, ver "Descrição: 2 campos" abaixo |
| `material_type` é `z.string().trim()` **livre**, não enum; formulário é `<input>` de texto digitado | `routes/materials.ts:21`, `pages/painel/NovoMaterialPage.tsx:17` | filtro visível não tem lista de opções de onde partir |
| **Nenhuma faceta/agregação existe** no backend (`rg "facet\|distinct\|groupBy"` só acha `groupBy('material_id')` de contagem de download) | `routes/materials.ts` | filtro por `material_type` precisa de fonte de valores — ver "Facetas" abaixo |

## Arquitetura da solução

### Backend — extração (2 âncoras independentes)

O override `onebookshelf` passa a ter **dois** extratores separados, porque a fonte tem dois blocos distintos:

**Extrator A — tabela de detalhes.** Âncora: `<table class="table-list">`. Primeiro isola o(s) bloco(s) de tabela, depois procura `data-codeid` **dentro** do bloco isolado. Nunca busca `data-codeid` no documento inteiro — o fixture `storytellersvault` tem 6 `commentText`/`customerName`/`badgeType`/`discussionDate` fora da tabela (gap 3 da spec). Campos: `ruleSystem`, `authors`, `artists`, `creationMethod`, `filters`, `fileSize`, `format`. `sku`/`isbn`/`languageFilters` **não são extraídos** (decisão: descartar).

**Extrator B — tiles superiores.** Âncora: `class="… product-detail-tile-N"`. Cada tile é um par label/valor (`Page Count` → `98`; `Category` → `Warhammer Fantasy Roleplay Fourth Edition`). Captura Page Count e Category. Label vem em pt-BR ou en dependendo da loja ("Número de páginas" / "Page Count") — casar por conjunto de labels conhecidos, nunca por posição de tile (a ordem varia entre os fixtures).

**Extrator C — descrição rica.** Âncora: `<obs-product-description>`. Extrai o HTML interno completo, **não** passa por `sanitizeText()` (que destruiria a formatação); passa pelo sanitizador rico novo (abaixo). Fallback: se o bloco não existir, mantém o comportamento atual (JSON-LD + `sanitizeText`).

Parsing determinístico por regex, mesmo padrão já em uso no arquivo (`LINK_TAG_RE`/`META_TAG_RE` de `genericHtmlParser.ts`). Nenhuma lib de DOM nova.

### Backend — a cadeia de propagação tem 4 pontos (armadilha)

Campo novo que não seja adicionado em **todos os quatro** aparece no preview e é descartado sem erro na persistência. Ordem real, verificada no código:

| # | Onde | Papel | Consequência de esquecer |
|---|---|---|---|
| 1 | `services/scrapers/types.ts` → `ScrapedItem` | shape de saída de todo adapter e do payload de ingest manual | adapter não consegue nem carregar o campo |
| 2 | `platformOverrides/index.ts` → `PlatformOverrideInput` + `genericHtmlParser.ts` → `genericParsePreviewSchema` (`.strict()`) | preview de `/parse-html` | schema `.strict()` **rejeita** campo não declarado — falha explícita, o caso "bom" |
| 3 | `routes/scraper.ts` → `ingestItemSchema` (Zod da rota `POST /scraper/ingest`) | valida o que o admin reenvia depois de conferir o preview | Zod **remove** campo não declarado silenciosamente: preview mostra, banco não recebe, nenhum erro |
| 4 | `services/scraperIngest.ts` → `insertInto('download_material_metadata')` | grava | campo chega e é ignorado |

O ponto 3 é o perigoso: `/parse-html` e `/ingest` são chamadas **separadas** (o admin confere o preview e reenvia os itens), então não existe fluxo direto preview→banco que "carregue tudo junto". Teste de ponta a ponta preview→ingest→banco é obrigatório (T3.5).

### Backend — descrição são 2 campos, não 1 (achado)

`scraperIngest.ts:140` faz `summary: item.description?.slice(0, 500) ?? null`. Se a descrição passar a ser HTML, esse slice corta no meio de uma tag e produz `summary` com HTML quebrado — que vai pro `ilike` da busca (`routes/materials.ts:98`) e pro card.

Solução: separar os dois papéis explicitamente.

- `download_material.description` — **texto plano**, continua como é hoje. Fonte: `sanitizeText()` sobre a descrição extraída (strip total). Serve busca (`ilike`), `summary`, SEO/meta e o histórico versionado já existente.
- `download_material.summary` — derivado do **texto plano**, nunca do HTML. Mantém o `slice(0, 500)` atual, agora seguro.
- `download_material_metadata.description_html` — **HTML sanitizado**, só para exibição na ficha.

Assim a Fase 2 não quebra busca, `summary`, nem o histórico de campo. A ficha prefere `description_html` quando existe e cai em `description` quando não (material legado / plataforma genérica).

### Backend — facetas de filtro (achado bloqueante do filtro visível)

`material_type` é `z.string().trim()` **livre** (`routes/materials.ts:21`) e o formulário de criação é um `<input>` de texto digitado pelo usuário (`pages/painel/NovoMaterialPage.tsx:17`) — **não existe enum**. E não existe nenhuma agregação/faceta no backend (busca por `facet`/`distinct`/`groupBy` só acha o `groupBy('material_id')` da contagem de downloads).

Consequência: o requisito 13 (filtro visível) não tem de onde tirar as opções de `material_type`. Sistema/edição têm fonte (`GET /api/catalog/v1/systems`/`snapshot`), `material_type` não tem nenhuma.

Solução mínima e honesta: **endpoint de facetas** `GET /api/v1/materials/facets` (público, sem auth, mesmo escopo da listagem) devolvendo os valores realmente em uso, com contagem, só de material publicado:

```sql
SELECT material_type, COUNT(*) FROM download_material
WHERE editorial_state = 'published' GROUP BY material_type ORDER BY COUNT(*) DESC
```

Devolve também os `system_id`/`edition_id` em uso, para a sidebar não oferecer filtro que retorna zero resultado (regra de Nielsen: não oferecer ação sem efeito). Cache curto em memória (o valor muda pouco). Isso é rota nova → `pnpm verify:api` obrigatório.

**Decisão nominal posterior (2026-07-25):** `material_type` não fica local nem vira enum. Vira vocabulário Central próprio, separado da árvore `system > edition > variant`: tipos de material são faceta ortogonal, e ampliar `CatalogNodeType` quebraria contratos de árvore, matching e projeção já usados por Mesas/Glossário. O Central mantém ID, slug, nome, aliases e status; cada app lê e pode registrar por API autenticada. Downloads guarda `material_type_id` canônico, conserva o texto legado só durante migração e oferece facetas pelo vocabulário Central em uso.

### Backend — sanitização de HTML rico (frente de segurança)

Caminho novo, arquivo próprio (`services/sanitizeRichHtml.ts`), **sem** alterar `sanitizeText.ts` (que continua correto pros campos de texto simples).

Allowlist proposta (confirmar em code review antes do merge):

- **Tags:** `p`, `br`, `strong`, `b`, `em`, `i`, `u`, `s`, `ul`, `ol`, `li`, `a`, `img`, `h2`, `h3`, `h4`, `blockquote`, `hr`.
- **Atributos:** `a[href|title]`, `img[src|alt|width|height]`. Nada mais — `style`, `class`, `id`, `on*` removidos.
- **Protocolos:** `href`/`src` só `http:`/`https:`. `javascript:`, `data:`, `vbscript:` rejeitados.
- **`a`** ganha `rel="nofollow noopener noreferrer"` e `target="_blank"` na renderização (link é pra fonte externa).
- Tags fora da allowlist: conteúdo textual preservado, tag descartada (não apaga o texto).

Sanitização roda **no backend, antes de persistir**, e a coluna guarda o HTML já limpo. O frontend renderiza via `dangerouslySetInnerHTML` com o conteúdo vindo do banco — aceitável **porque** a garantia está no backend; sanitizar só no cliente seria violação da regra pétrea.

Biblioteca: avaliar `sanitize-html` (Node puro, sem jsdom) vs. `isomorphic-dompurify` (exige jsdom no backend). **Perguntar ao mantenedor antes de instalar**, conforme `AGENTS.md`. Se nenhuma for aprovada, implementação própria por allowlist é viável mas exige cobertura de teste muito maior — preferir lib madura.

### Backend — schema (uma migration por frente lógica)

**Migration A — campos de metadata rica** (`migration_026_download_material_metadata_rich_fields.sql`, `online-safe`, `requires-backup: false`, header de 5 campos):

```sql
ALTER TABLE download_material_metadata
  ADD COLUMN IF NOT EXISTS file_size_text   TEXT NULL,
  ADD COLUMN IF NOT EXISTS page_count       INTEGER NULL,
  ADD COLUMN IF NOT EXISTS creation_method  TEXT NULL,
  ADD COLUMN IF NOT EXISTS source_category  TEXT NULL,
  ADD COLUMN IF NOT EXISTS source_filters   JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS description_html TEXT NULL;
```

- `description_html` fica em `download_material_metadata` e não substitui `download_material.description` — a coluna de texto plano continua servindo resumo/busca/SEO; o HTML é a versão de exibição. Evita quebrar `ilike` da busca e o histórico versionado de `description`.
- `source_filters` com `DEFAULT '[]'` mantém `Array.isArray` sempre verdadeiro no consumo (regra de normalização).
- `page_count` é `INTEGER` — parse tolerante ("98" → 98; "N / D" → `null`).

**Migration B — taxonomia: hint preservado + fila de sugestão** (`migration_027_download_system_suggestion.sql`, `online-safe`). Espelha o padrão do draft do mesas (`raw_system_hint` + fila com triagem):

```sql
-- Espelha discord_table_draft.raw_system_hint do mesas: preserva o texto bruto
-- da fonte quando o match contra o catálogo central falha, para o revisor ver
-- o que veio e para o alias ser gravado na aprovação.
ALTER TABLE download_material
  ADD COLUMN IF NOT EXISTS raw_system_hint TEXT NULL;

CREATE TABLE IF NOT EXISTS download_system_suggestion (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_value      TEXT NOT NULL,              -- "Fourth Edition", "Inespecífico/Qualquer mundo"
  source         TEXT NOT NULL,              -- 'scraper' | 'user'
  material_id    UUID NULL REFERENCES download_material(id) ON DELETE SET NULL,
  suggested_by   TEXT NULL,                  -- user id quando source='user'
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  -- Resultado da triagem, no vocabulário de recommended_action do mesas
  -- (systemSuggestionCandidates.ts): merge_existing | create_alias |
  -- create_child | create_system. Guarda o que o revisor de fato fez.
  resolution_action TEXT NULL,
  resolved_node_id  TEXT NULL,               -- id no catálogo central após triagem
  rejection_reason  TEXT NULL,               -- espelha system_suggestions.rejection_reason do mesas
  resolved_by    TEXT NULL,
  resolved_at    TIMESTAMPTZ NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Constraints de `status`/`source`/`resolution_action` por `CHECK`. Índice parcial em `status='pending'` pra fila. Índice em `material_id` (a ficha/gestão consulta por material).

**Nota de agrupamento (AGENTS.md §Migrations 2.1):** `ADD COLUMN raw_system_hint` e a tabela nova entram na **mesma** migration porque são a mesma frente lógica (taxonomia) e nascem juntas — fatiar em duas só multiplicaria header e contaria 2 no guard `MAX_AUTO_PENDING`. Separadas da migration A (metadata) porque são frentes/fases/PRs diferentes.

### Backend — taxonomia: espelhar o fluxo de draft do mesas (decisão do mantenedor)

**O mesas já resolve isto direito e é a referência a copiar** (decisão do mantenedor, 2026-07-25: "o draft de mesa tem muito o que ensinar, pois ele já funciona como deveria"). Fluxo real dele, verificado no código:

| Peça do mesas | Onde | O que faz |
|---|---|---|
| `matchSystemName(hint, systems)` | `discord/parseDiscordAnnouncement.ts` | tenta casar o texto bruto contra nome/`name_pt`/aliases do catálogo |
| `raw_system_hint` | `discord/types.ts`, gravado no draft | **preserva o texto bruto** quando não casa: "usado para criar `system_suggestion` automática e para o revisor ver o que veio do Discord" |
| `missing_fields` + `system_name:unmatched_hint` | `discord/normalizeDiscordTableDraft.ts:56` | draft entra em **`needs_review`** com badge específica: "não achei sistema, mas tenho o texto" ≠ "não tem sistema nenhum" |
| `_homebrew_suspect` → `system_name:homebrew_suspect` | mesmo arquivo, linha 64 | suspeita de sistema autoral também força revisão, com badge própria |
| `scoreSystemCandidates` / `systemSuggestionCandidates.ts` | `services/` | **helper puro, sem dependência externa**: normaliza nome, detecta token de edição, pontua candidatos e devolve `recommended_action`: `merge_existing` \| `create_alias` \| `create_child` \| `create_system` |
| `GET /admin/system-suggestions/:id/candidates` | `routes/systemSuggestionsAdmin.ts` | entrega os candidatos pontuados pro revisor decidir |
| `recordSystemEntityRule` | `discord/learningFeedbackOutbox.ts:161` | a correção do revisor **ensina**: grava regra/alias a partir de `raw_system_hint` → sistema corrigido, então o próximo item igual casa automático |
| `normalizeDiscordTableDraft` re-tenta o match | `normalizeDiscordTableDraft.ts:74-81` | ao normalizar de novo, tenta `system_name` **e** `raw_system_hint`; casando, limpa o hint |

**Fluxo do Downloads, espelhando peça por peça:**

1. Parse extrai `ruleSystem` (tabela) e Category (tile) como **texto bruto**.
2. Tenta casar contra o catálogo central: `GET /api/catalog/v1/resolve`. Casou → `system_id`/`edition_id` no ingest.
3. **Não casou → preserva o bruto**, exatamente como `raw_system_hint`: coluna `raw_system_hint` em `download_material` (ou no metadata — decidir na implementação, preferir `download_material` por simetria com `system_id`). O material **não** perde a informação nem finge que não tem sistema.
4. Abre `download_system_suggestion` (`source='scraper'`, `material_id`, `raw_value`, `status='pending'`) **e** marca o material como precisando de revisão de taxonomia — equivalente ao `missing_fields: ['system_name:unmatched_hint']` do mesas. Distinguir os dois casos, como o mesas faz: "não casei mas tenho hint" vs. "nenhum hint na fonte".
5. Triagem admin usa **candidatos pontuados**, não lista crua: `systemSuggestionCandidates.ts` do mesas é **puro e sem deps externas** — avaliar reusar a lógica (copiar pro Downloads, ou extrair pra pacote compartilhado; **perguntar ao mantenedor** antes de extrair, é frente nova de pacote). O revisor vê `recommended_action` sugerido (`merge_existing`/`create_alias`/`create_child`/`create_system`), não decide no vácuo.
6. Ao aprovar/corrigir, **registrar alias** no catálogo central a partir do `raw_value` → node escolhido, no espírito do `recordSystemEntityRule`: o próximo material com o mesmo texto resolve sozinho. Sem isso a fila recebe o mesmo item pra sempre.
7. Escrita no catálogo central (`POST /api/catalog/v1/nodes` + alias) **sempre por ação de admin na triagem**, nunca pelo scraper direto (requisito 8).

Rotas novas no Downloads, espelhando o contrato do mesas:

- `POST /api/v1/system-suggestions` (auth user) — usuário comum sugere.
- `GET /api/v1/admin/system-suggestions` (auth admin) — fila.
- `GET /api/v1/admin/system-suggestions/:id/candidates` (auth admin) — **candidatos pontuados**, não lista crua.
- `PATCH /api/v1/admin/system-suggestions/:id/approve` / `/reject` (auth admin).

**O que NÃO copiar do mesas:** a fila dele vive em tabela própria do mesas (`system_suggestions`) com notificação ao usuário sugerinte e `activity_log`. O Downloads tem seus próprios `download_notification` e auditoria — usar os do Downloads, não importar os do mesas. E nada em `apps/mesas` é alterado (requisito 17).

### Backend — contrato público

- `GET /materials`: join `left` com `download_material_metadata` adicionando `cover_image_url`, `credits`, `scenario` ao payload de card. Payload mínimo — metadata completa continua na rota de detalhe.
- Sistema/edição/variante no card: os IDs já vêm de `download_material`. Para nome + cadeia hierárquica sem N+1, resolver em lote a partir de `GET /api/catalog/v1/snapshot` (público) com cache em memória por TTL no backend do Downloads — **uma** chamada ao catálogo por janela de cache, não uma por material. `path_slug` do node dá a cadeia sistema › edição › variante (padrão que o mesas já usa).
- `GET /material-metadata/:id` já faz `selectAll()` — passa a devolver os campos novos automaticamente. Ajustar o Zod de leitura do frontend, não a rota.
- `pnpm verify:api` obrigatório (toca `apps/downloads/backend/src/routes/**`).

### Frontend

- `types/material.ts`: `cover_image_url`, `credits`, `scenario`, dados de sistema/edição/variante no schema de listagem (`.nullable().optional()`).
- `hooks/useMaterialMetadata.ts`: schema ampliado com os campos novos + `description_html`.
- `components/MaterialCard.tsx`: capa condicional com `onError` → placeholder; linha "Por \<autores\>"; "Para \<cenário\>"; badge de sistema/edição/variante.
- `components/SystemChainBadge.tsx` (novo, próprio do Downloads): nome + cadeia, padrão visual do `SystemBadge` do mesas (pílula, ícone de dado como fallback), **sem** dependência de `/sys-logos/` do mesas — logo só se houver fonte válida no catálogo central.
- `pages/MaterialPage.tsx`: reconstrução — grid 2 colunas ≥ `lg` (capa \| título/cenário/autores/CTA), colapsa em 1 coluna abaixo; faixa de tiles; bloco DETALHES 2 colunas; descrição rica via `dangerouslySetInnerHTML` do HTML já sanitizado no backend. Ordem de seções da 061 preservada no essencial (título → resumo → CTA → descrição → metadados → criador → atualização), agora com os blocos visuais novos.
- `pages/CatalogoPage.tsx`: sidebar de filtros ≥ 1024 px / drawer abaixo (D108); chips `⊗` dos filtros ativos acima da lista; opções de sistema/edição vindas de `GET /api/catalog/v1/systems`/`snapshot` via hook novo; opções de `material_type` vindas da rota nova de facetas (**não é enum** — é `z.string()` livre, ver §Facetas). Query params seguem sendo o contrato único (D073).
  **Foco preso não existe em lugar nenhum hoje:** nem no `Drawer` de `packages/ui` nem no drawer à mão do `GestaoShell` (que é um `fixed inset-0` com `<button>` de backdrop, sem trap nem restauração). D108 exige — então isto é implementação **nova**, não reaproveitamento. Vale para as duas sidebars (gestão e catálogo); resolver uma vez, no mesmo lugar.
- `components/AppShell.tsx`: remover `{ label: 'Sobre e uso', href: '/sobre-e-uso' }` de `moduleNav`; link vai pro `Footer` (`packages/ui`). Rota preservada no router.
- `pages/gestao/`: tela de triagem de sugestão de sistema (fila, candidatos, aprovar/recusar/criar) + editor TipTap na edição de descrição do material.
- **`packages/ui`**: se o `Footer` compartilhado não aceitar link extra por app hoje, verificar antes de editar — mudança em pacote compartilhado exige aprovação e checagem de impacto nos consumidores (`AGENTS.md`). Se não aceitar, avaliar link no rodapé próprio do Downloads como alternativa e perguntar ao mantenedor.

### Shell administrativo compartilhado (`packages/ui/src/admin/`)

Frente **aditiva**: subpasta nova, exports novos, CSS novo. Nenhum primitivo existente alterado, nenhuma dependência nova no `package.json`. `apps/mesas/**` **intocado** (requisito 17, verificado por `git diff`).

**Estrutura:**

```
packages/ui/src/admin/
  index.ts              # barrel do subpacote
  admin.css             # tokens --admin-* / --fg-low / --shadow-card (dark + light)
  cn.ts                 # clsx-lite (cópia, zero dep)
  tabButtonClass.ts
  AdminSidebar.tsx      # rail, grupos, badge de pendência
  AdminMain.tsx         # header sticky: eyebrow + breadcrumb + ações + subnav
  AdminWorkspaceLayout.tsx  # workspace + inspector 400px
  Breadcrumb.tsx
  PageHeader.tsx
  SectionCard.tsx
  MetricCard.tsx
  StatusPill.tsx
  AdminTable.tsx        # + AdminColumn/AdminFacet/AdminBulkAction/AdminRowAction
  bulkActions.tsx       # helpers bulkDelete/bulkArchive
```

Export por subpath (`@artificio/ui/admin`) somado ao `exports` do `package.json`, no padrão que o pacote já usa para `./brand`, `./modules`, `./changelog`. Evita que app sem gestão pague o custo do kit no bundle.

**Desacoplamento de router (requisito 18).** As três peças que hoje importam `react-router-dom` no mesas mudam de contrato:

| Peça | Hoje (mesas) | No kit |
|---|---|---|
| `AdminSidebar` | `NavLink` + `isActive` do router | props `LinkComponent`, `currentHref`; estado ativo calculado por comparação de `href` (o app pode passar `NavLink` e ignorar, ou um `<a>` puro) |
| `MetricCard` | `Link to=` | prop `LinkComponent` opcional; sem ela, renderiza `div` (comportamento atual quando não há `to`) |
| `AdminTable` | `useSearchParams` para faceta | props `facetValues` + `onFacetChange`; o **app** liga isso ao router. O kit fica controlado, sem saber que URL existe |

Ícones: todos entram como `ReactNode` via prop (`icon`), inclusive os de `bulkActions`/`AdminTable`. O kit não importa `lucide-react`; o app passa `<Trash2 size={15} />`. `bulkDelete`/`bulkArchive` viram factories que recebem o ícone.

**Reuso de primitivos (requisito 19).** Verificar e decidir na implementação, documentando no código:

- **`Drawer`** (já existe em `packages/ui`) — usar no drawer mobile da sidebar em vez de reimplementar o `fixed inset-0` à mão que o Downloads tem hoje. Reuso praticamente certo. **Ressalva verificada no código (`primitives.tsx:394-437`):** tem `role="dialog"`, `aria-modal`, backdrop clicável e Escape (`useEscapeClose`), mas **não tem foco preso nem restauração de foco** — e D108 exige. Resolver no consumidor ou dar focus trap ao primitivo; a segunda opção deixa de ser frente aditiva, então perguntar antes.
- **`Badge`** vs. `StatusPill` — `StatusPill` tem 6 tons semânticos com `color-mix`; conferir se `Badge` cobre. Se cobrir, `StatusPill` vira alias/variante; se não, criar e comentar a divergência.
- **`Panel`** vs. `SectionCard` — mesma verificação (`SectionCard` tem header com título/descrição/ação + corpo).
- Se o reuso exigir **alterar** o primitivo (não só consumi-lo), **parar e perguntar** — deixaria de ser frente aditiva.

**Tokens (requisito 20).** `admin.css` copia os valores reais do mesas, dark e light, e é importado pelo `index.css` do Downloads. Não editar `packages/ui/src/styles.css` (evita mexer no CSS que todo app já carrega). Quando o mantenedor migrar o mesas, ele importa o mesmo arquivo e apaga as definições locais.

**Gestão do Downloads sobre o kit (requisito 21).** `GestaoShell.tsx` reconstruído como composição `AdminSidebar` + `AdminMain`, mantendo o que é do domínio do Downloads e não pode regredir: grupos Conteúdo/Operação/Comunidade/Sistema, `countKey` por fila, fila P0 com ícone + texto (não só cor — critério da 075), `adminOnly` espelhando `RequireGestaoAuth` (achado do PR #201), link externo "Sistemas e edições", alvos ≥ 44 px. Cada um desses vira teste.

**Sidebar pública do catálogo (requisito 22).** `CatalogFilterSidebar` usa os tokens e o padrão de rail/agrupamento do kit — não é o `AdminSidebar` (semântica diferente: filtro, não navegação), mas compartilha vocabulário visual. É por isso que as duas frentes vivem na mesma spec.

## Arquivos afetados

**Pacote compartilhado (`packages/ui`) — aditivo:**
- `src/admin/*` (13 arquivos novos, listados acima)
- `src/admin/*.test.tsx` (teste por peça, incluindo `AdminTable`)
- `package.json` (`exports` ganha `./admin` e `./admin/admin.css`; **sem** dependência nova)
- **Nada** em `src/styles.css`, `src/index.ts` (primitivos) ou nos componentes existentes — salvo se o reuso exigir, aí para e pergunta

**`apps/mesas` — ZERO arquivos.** Trava do requisito 17.

**Backend:**
Cadeia de propagação (todos os 4 pontos, na ordem — esquecer um descarta o campo em silêncio):
- `services/scrapers/types.ts` (`ScrapedItem` — **ponto 1**)
- `services/scrapers/platformOverrides/index.ts` (`PlatformOverrideInput` — **ponto 2**)
- `services/scrapers/genericHtmlParser.ts` (`genericParsePreviewSchema` `.strict()` — **ponto 2**)
- `routes/scraper.ts` (`ingestItemSchema` — **ponto 3, o que remove sem erro**)
- `services/scraperIngest.ts` (`insertInto` — **ponto 4**; + `summary` do texto plano, + abertura de sugestão de taxonomia)

Demais:
- `services/scrapers/platformOverrides/onebookshelf.ts` (3 extratores)
- `services/sanitizeRichHtml.ts` (novo)
- `services/catalogClient.ts` (resolve + escrita via triagem; comentário já corrigido)
- `routes/materials.ts` (join do card + rota nova `GET /materials/facets`)
- `routes/materialMetadata.ts` (`upsertMetadataSchema` com os campos novos)
- `routes/systemSuggestions.ts` + `routes/systemSuggestionsAdmin.ts` (novos)
- `db/types.ts` (colunas novas + tabela nova)
- `database/migration_026_*.sql`, `database/migration_027_*.sql`
- Testes: ver a tabela consolidada em `tasks.md` T11.6

**Frontend:**
- `types/material.ts`, `hooks/useMaterialMetadata.ts`, `hooks/useMaterialsCatalog.ts`
- `hooks/useCatalogSystems.ts` (novo), `hooks/useSystemSuggestions.ts` (novo)
- `components/MaterialCard.tsx`, `components/SystemChainBadge.tsx` (novo), `components/AppShell.tsx`
- `components/CatalogFilterSidebar.tsx`, `components/ActiveFilterChips.tsx` (novos)
- `components/RichTextEditor.tsx` (novo, TipTap)
- `components/GestaoShell.tsx` (reconstruído sobre o kit compartilhado)
- `index.css` (importa `@artificio/ui/admin/admin.css`)
- `pages/MaterialPage.tsx`, `pages/CatalogoPage.tsx`, telas de gestão
- Testes de cada componente tocado

## Contratos/interfaces tocados

- `GET /api/v1/materials` — campos novos aditivos (não-breaking).
- `GET /api/v1/material-metadata/{materialId}` — campos novos aditivos (rota já faz `selectAll()`).
- `POST /api/v1/system-suggestions`, `GET/PATCH /api/v1/admin/system-suggestions*` — rotas novas.
- Consome `GET /api/catalog/v1/resolve|systems|snapshot` (site, público) e `POST /api/catalog/v1/nodes` (site, auth user).
- `pnpm verify:api` obrigatório. Não toca `packages/auth`, SSO, DNS/subdomínio.

## Impacto em consumidores

- Só o frontend próprio consome as rotas do Downloads (confirmado via `artificio-api-governance`: `consumers: []` em todas).
- Escrita no catálogo central afeta mesas/glossário **indiretamente** (compartilham a fonte). Por isso a trava: só via triagem admin, com alias registrado — nunca node novo automático a partir de texto de marketplace.
- `packages/ui` ganha a subpasta `admin/` de forma **aditiva**: consumidores atuais (`site`, `mesas`, `glossario`, `downloads`, `links`) não mudam de comportamento, porque nada existente é alterado e o kit entra por subpath próprio. Verificação: build de cada consumidor + `git diff` sem alteração em primitivo.
- `packages/ui` também é tocado se o `Footer` exigir mudança para o link de "Sobre e uso" (Fase 10) — verificar antes de editar.

## Rollback

- Migrations aditivas (`ADD COLUMN … NULL`, `CREATE TABLE IF NOT EXISTS`) — reversíveis por migration nova de correção, não por edição do arquivo aplicado.
- Contrato de API aditivo — revert de código não deixa dado inconsistente.
- **Não reversível automaticamente:** node criado no catálogo central durante triagem. Mitigação: D099 proíbe apagar/arquivar registro — item errado é mesclado em outro UUID com redirect. Documentar isso na tela de triagem para o admin.
- **Kit compartilhado:** rollback é revert de código puro. Como a frente é aditiva e o mesas não migra nesta spec, reverter `packages/ui/src/admin/` só afeta o Downloads — o mesas continua rodando na cópia local dele, sem depender do kit. É exatamente por isso que a decisão de validar antes de migrar reduz risco.

## Validação (como provo que funciona)

- Testes de extração contra os 3 fixtures reais, com valor exato; teste anti-regressão de `commentText`/`customerName` (gap 3); teste de descrição completa vs. truncada.
- Teste de sanitização com payload hostil (`<script>`, `onerror`, `javascript:`, `<iframe>`).
- Teste de fila: `ruleSystem` não resolvido gera sugestão pendente.
- `tsc --noEmit`, lint, testes backend+frontend, `pnpm verify:api` verdes.
- **Smoke visual real** (browser/screenshot) do card, da ficha e do filtro antes de fechar cada task de frontend — `AGENTS.md` §Conclusão de Tarefas proíbe declarar UI pronta sem ver rodando.
- Smoke real em beta pós-deploy: publicar material da fonte real, conferir ficha/card/filtro visualmente.

**Do kit compartilhado, verificações objetivas (não subjetivas):**

- `git diff --name-only | grep '^apps/mesas/'` **vazio** em cada PR das fases de kit — prova da trava do requisito 17.
- `packages/ui/package.json` sem `react-router-dom`/`lucide-react` em `dependencies` — prova do requisito 18.
- `pnpm build` de `packages/ui` **e** dos consumidores (`site`, `mesas`, `glossario`, `downloads`, `links`) verde — prova de que a frente é aditiva.
- Teste por peça dentro de `packages/ui`, incluindo comportamento real de `AdminTable` (faceta filtra, seleção em massa dispara, ação de linha chama handler) — não vale "renderiza sem erro".
- Testes no Downloads provando que a gestão reconstruída **preserva** contagem por fila, ícone + texto na fila P0, `adminOnly` e alvos ≥ 44 px.
- **Smoke visual comparativo** entre a gestão do Downloads e `https://mesas.artificiorpg.com/gestao`, validado pelo mantenedor — é ele quem aprova o kit antes de decidir migrar o mesas.
