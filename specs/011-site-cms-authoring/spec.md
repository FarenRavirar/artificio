# 011 — CMS / autoria nativa do site (paridade WordPress)

- **Módulo/Pacote:** `apps/site` (admin + backend + store) · possível toque em `packages/auth` (capabilities/roles) e `packages/ui` (componentes de admin) → **SDD Completo**
- **Gate relacionado:** Gate D do `site` (depende disto p/ fechar) · habilita Gate C futuro (cutover só faz sentido se o site autora conteúdo sozinho, sem WP)
- **Origem:** mantenedor (2026-06-06): "Hoje o site é estático. A vantagem do WordPress é manusear tudo — inserir posts, slug + sugestão dinâmica, Open Graph, imagens, snippets, áudio, vídeo, links; adicionar/editar posts e categorias; resumos; arquivar; usuários editores; e tudo mais que o WP faz."

## Problema

O `apps/site` hoje é **somente leitura**: o conteúdo entra exclusivamente pelo **importador WP one-shot** (`importer/`), é gravado no store Postgres e **exportado para JSON** que o Astro renderiza como **SSG estático**. Não existe nenhuma forma de **criar, editar, agendar, arquivar ou apagar** conteúdo a partir do próprio Artifício. Para publicar qualquer coisa, hoje, ainda dependemos do WordPress.

Isso trava dois objetivos do projeto:
1. **Autonomia editorial** — a equipe precisa de uma experiência de autoria pelo menos tão boa quanto o WordPress (editor rico, mídia, SEO/OG, taxonomias, agendamento, papéis de usuário).
2. **Cutover (Gate C)** — só podemos desligar o WP quando o site novo souber **produzir** conteúdo, não só exibir o que foi importado.

Tensão arquitetural central: o site é **SSG** (pré-renderizado, zero-JS no público), enquanto a autoria é inerentemente **dinâmica**. A solução precisa casar um **painel de administração dinâmico** (escrita no Postgres) com um **gatilho de rebuild incremental** do SSG, mais um **preview de rascunho** que não exija publicar.

> **Objetivo em uma frase:** construir a **área completa de administração do portal/hub** — para **produzir, alimentar e administrar** o site: criar/editar conteúdo, **curar a home do portal** (destaques, ordem, banners), manter o hub abastecido no dia a dia e gerenciar tudo (mídia, taxonomias, navegação, redirects, usuários, SEO), com conveniência **pelo menos igual à do WordPress**.

> **Escopo é o PORTAL/HUB, não só o blog.** O `site` é o hub estilo G1 que direciona aos módulos (mesas/glossário/esferas/SRD/downloads). A administração precisa cobrir tanto o **fluxo editorial** (posts/páginas/mídia) quanto a **curadoria do portal** (home, destaques, navegação secundária, redirects) e a **operação** (dashboard, usuários, build, auditoria). O nav cross-módulo do portal vem do `@artificio/ui` (D017/spec 010) e **não** é quebrado por isto.

> **Norte:** "tudo o que o WordPress faz" para o fluxo editorial de um blog/portal — não apenas a lista do mantenedor. O **Apêndice A** abaixo é o levantamento de paridade (inventário do WP) que delimita o universo; os requisitos R\* selecionam e priorizam o que entra em cada fase.

> **Editor — estilo Gutenberg, NÃO o Gutenberg do WP.** A experiência de escrita deve ser **de blocos** (inserir/mover/reordenar blocos, comando "/", barra por bloco) — UX equivalente ao Gutenberg, mas implementada com um editor de blocos moderno próprio (não portar o `wp-editor`). Saída = HTML semântico sanitizado, compatível com o pipeline SSG.

## Requisitos (numerados, testáveis)

> Agrupados por área. Cada um é verificável. Prioridade: **[P0]** MVP de autoria (substitui o essencial do WP), **[P1]** paridade prática, **[P2]** conveniência/avançado.

### A. Autoria de posts (núcleo)
- **R1 [P0]** — Admin autenticado (SSO, papel com capacidade `edit_posts`) cria um **post novo**: título, corpo (editor rico), resumo/excerpt, categorias, tags, imagem destacada. Gravado no store (`posts` + `post_taxonomies`).
- **R2 [P0]** — **Editar** post existente (importado do WP ou nativo) e salvar. Conteúdo persiste no store; o público reflete após publish/rebuild.
- **R3 [P0]** — **Slug**: editável manualmente, com **sugestão dinâmica** gerada do título (slugify PT-aware: acentos→ASCII, espaços→`-`, minúsculas), checagem de **unicidade** em tempo real e aviso de colisão. Para post já publicado, alterar slug **gera redirect 301** automático do slug antigo (preserva SEO — D047/`redirects`).
- **R4 [P0]** — **Status / workflow**: `draft` (rascunho), `pending` (revisão), `publish` (publicado), `scheduled` (agendado p/ data futura), `private`, `trash` (lixeira) e `archived` (arquivado). Transições respeitam capacidade do usuário (ex.: só `publish_posts` publica).
- **R5 [P0]** — **Excerpt/resumo**: manual ou auto-gerado (primeiros N caracteres do corpo, sem HTML). Usado em listagens e meta description fallback.
- **R6 [P1]** — **Agendamento**: definir `published_at` futuro; o post entra no ar automaticamente na data (rebuild agendado/cron).
- **R7 [P1]** — **Autosave + histórico de revisões**: salva rascunho periodicamente; mantém versões anteriores do corpo/título; permite **restaurar** uma revisão.
- **R8 [P1]** — **Preview de rascunho**: ver o post renderizado (com o tema real) **sem publicar** — rota de preview autenticada (SSR/dev-render) ou build de preview isolado.
- **R9 [P2]** — **Bulk actions** na lista (publicar, mover p/ lixeira, arquivar, recategorizar) + **quick edit** (título/slug/status sem abrir o editor).

### B. Editor de blocos (estilo Gutenberg, não o Gutenberg do WP)
- **R10 [P0]** — Editor **de blocos** com UX estilo Gutenberg: **inserir bloco** (botão "+" e comando "/"), **reordenar** (arrastar/mover ↑↓), **barra de formatação por bloco/seleção**, converter tipo de bloco. Tipos: parágrafo, títulos (H2–H4), **negrito/itálico/sublinhado**, listas (ordenada/não), citação, **link** (edição de href/target/rel), código inline e **bloco de código** (realce de linguagem), separador, tabela. **Não é o `wp-editor`**: editor de blocos moderno próprio; saída = HTML semântico sanitizado (R17).
- **R11 [P0]** — Inserir **imagem** no corpo (da biblioteca de mídia ou upload na hora) com **alt** e legenda; alinhamento e largura.
- **R12 [P0]** — Inserir **links** (internos do portal e externos) com validação de URL.
- **R13 [P1]** — Inserir **áudio** (player) e **vídeo** (upload ou **embed** oEmbed: YouTube/Vimeo/Spotify/X) via URL.
- **R14 [P1]** — **Snippets / blocos reutilizáveis**: trechos salvos (ex.: caixa de aviso, CTA, ficha) que o autor insere e reaproveita; editáveis num lugar só.
- **R15 [P1]** — **Embeds** genéricos por URL (oEmbed) com sanitização (allowlist de provedores; nada de `<script>` arbitrário).
- **R16 [P2]** — Bloco **HTML cru** (somente capacidade elevada) e bloco **download/arquivo** (anexo com ícone + tamanho).
- **R17 [P0]** — O conteúdo salvo é **HTML sanitizado** (allowlist; o store já assume HTML hostil — `importer/sanitize.ts`), compatível com o pipeline SSG e o `content_html` atual. Sem `<script>`/inline-handlers no corpo público.

### C. Mídia
- **R18 [P0]** — **Biblioteca de mídia**: upload de imagem (PNG/JPG/WebP/SVG sanitizado), listagem, busca, seleção. Integra **Cloudinary** (já gated por `CLOUDINARY_URL`); sem credencial = armazenamento local/dry-run.
- **R19 [P0]** — Por item: **alt**, legenda, título; dimensões; `srcset`/tamanhos responsivos (Cloudinary transformations). Persistido em `media`.
- **R20 [P1]** — Upload de **áudio** (MP3/OGG) e **vídeo** (MP4) ou referência a embed externo. Limites de tamanho/tipo aplicados no backend.
- **R21 [P2]** — Edição leve de imagem (crop/rotate/focal point) via Cloudinary.

### D. Taxonomias
- **R22 [P0]** — CRUD de **categorias** (hierárquicas, `parent_id`) e **tags** (planas): criar, editar (nome/slug/descrição), apagar (com tratamento de posts órfãos), reordenar/aninhar.
- **R23 [P0]** — Atribuir/remover categorias e tags a um post na tela de edição (com criação inline de termo).
- **R24 [P1]** — Páginas de arquivo de categoria/tag (já existem no SSG) refletem mudanças após rebuild; contagem (`count`) atualizada.

### E. Páginas institucionais
- **R25 [P1]** — CRUD de **pages** (sobre, contato, políticas…) com o mesmo editor; slug imutável-por-padrão com 301 ao mudar; status draft/publish.

### F. SEO / Open Graph / Social
- **R26 [P0]** — Por post/página: **SEO title**, **meta description**, **canonical** editáveis (campos já existem em `posts`). Fallbacks sensatos (title→seo_title, excerpt→description).
- **R27 [P0]** — **Open Graph**: `og:title`, `og:description`, `og:image`, `og:type`; **Twitter card**. Preview social (como aparece no compartilhamento). Reusa `@artificio/content`.
- **R28 [P1]** — `noindex`/`nofollow` por post; controle de inclusão no sitemap.
- **R29 [P2]** — Análise de foco/legibilidade (estilo Yoast) — sugestões, não bloqueio.

### G. Usuários, papéis e permissões
- **R30 [P0]** — **Papéis** mapeados às capacidades (modelo WP): **Administrador**, **Editor**, **Autor**, **Contribuidor** (e leitor). Definir o conjunto de **capabilities** (`edit_posts`, `publish_posts`, `edit_others_posts`, `delete_posts`, `manage_categories`, `upload_files`, `manage_users`, `manage_options`).
- **R31 [P0]** — **Autoria/ownership**: post tem **autor** (`author_id`); Autor edita só os próprios; Editor edita de todos; Contribuidor cria mas não publica.
- **R32 [P0]** — Papéis vêm do **SSO** (`@artificio/auth`, `session.user.role`). O site **não** cria login próprio — adiciona/gerencia a **atribuição de papel editorial** no contexto do site (sem quebrar o SSO compartilhado — regra pétrea).
- **R33 [P1]** — Tela de **gestão de usuários editores**: listar usuários, atribuir/alterar papel editorial do site, revogar. (Conta/login = `accounts.`; aqui só o papel no módulo site.)
- **R34 [P0]** — Toda rota de escrita do admin é **gated por capacidade** no backend (não confiar no front); 401 sem sessão, 403 sem capacidade.

### H. Comentários (já importados)
- **R35 [P2]** — Moderação de comentários: aprovar/spam/lixeira; ligar/desligar comentários por post. (Reativação pública de comentários é decisão à parte.)

### I. Pipeline de publicação (SSG ↔ autoria)
- **R36 [P0]** — Publicar/editar dispara **rebuild incremental** do SSG (export→astro build→pagefind), reusando `/admin/rebuild` e o job single-flight existente. O público vê a mudança após o rebuild.
- **R37 [P0]** — O rebuild **não derruba o site** (sem downtime perceptível) — casa com R6 da spec 009 (entrypoint serve `dist/` atual durante o rebuild).
- **R38 [P1]** — **Preview** de rascunho sem rebuild público (rota SSR autenticada ou build em diretório separado servido só ao admin).
- **R39 [P1]** — Indicador de **estado do build** no admin (rodando/última hora/erro) — estende `/admin/status` + `jobs.ts`.

### J. Administração geral
- **R40 [P0]** — **Painel admin** (SPA React, D048) em rota protegida do site (ex.: `/admin`), com layout do design system (`@artificio/ui`), navegação: **Dashboard**, Posts, Páginas, Mídia, Categorias/Tags, **Portal/Home (destaques)**, **Navegação**, **Redirects**, Usuários, Configurações.
- **R41 [P1]** — Lista de posts com **busca, filtro (status/categoria/autor), ordenação e paginação**.
- **R42 [P2]** — **Configurações** do site editáveis: título, tagline, fuso, itens por página, defaults de SEO.
- **R43 [P0]** — **API de autoria** (backend Express) RESTful e versionada para o SPA: CRUD de posts/pages/taxonomias/mídia/usuários/curadoria/navegação/redirects, todas autenticadas e auditáveis.

### K. Portal / Hub — dashboard, curadoria, navegação, redirects, auditoria
- **R44 [P0]** — **Dashboard** (home do admin): visão geral — contagens (posts por status, mídia, usuários), **estado do build** (rodando/última/erro), **ações rápidas** (novo post, rebuild) e **atividade recente**. Estende `/admin/status`+`jobs.ts`.
- **R45 [P1]** — **Curadoria da home do portal**: definir **post em destaque/hero**, **posts fixados (sticky)**, **ordem** das seções/listas da home, e **blocos editoriais** da home (banner/anúncio/CTA/destaque de módulo). Persistido em config/curadoria do store; reflete no SSG após rebuild. **Sem page builder visual** — campos/listas estruturados.
- **R46 [P1]** — **Gestão de navegação editável**: nav **secundário do blog** (quais categorias/links aparecem e ordem) e **links do footer hub**. **Não** altera o nav cross-módulo do portal (`defaultNavItems` do `@artificio/ui`, D017) — esse é fixo por design.
- **R47 [P1]** — **Gestão de redirects 301** pela UI (tabela `redirects`): criar/editar/remover `from_path→to_path` (code 301/302). Crucial p/ SEO e p/ o cutover futuro (D047). Os 301 gerados por mudança de slug (R3) aparecem aqui.
- **R48 [P2]** — **Log de auditoria**: registra quem criou/editou/publicou/apagou/arquivou (usuário SSO + ação + alvo + timestamp). Base p/ accountability editorial.
- **R49 [P2]** — **Métricas no dashboard** (opcional): surface básico do GA4 (`@artificio/analytics`) — visitas/posts mais vistos. Sem PII; somente leitura.

## Critérios de aceite

- **CA1** — Um Editor logado cria um post do zero (título, corpo rico com imagem + link + um embed, categoria, tags, excerpt, slug sugerido+único, SEO/OG), salva como rascunho, **pré-visualiza**, agenda ou publica; após rebuild, o post aparece no `beta.artificiorpg.com` com SEO/OG corretos e slug preservado. **Sem tocar no WordPress.**
- **CA2** — Editar um post **importado do WP**, mudar o slug → o slug antigo responde **301** para o novo; conteúdo e mídia íntegros.
- **CA3** — Biblioteca de mídia: upload de imagem com alt → some no corpo e no `og:image`; com `CLOUDINARY_URL` setado, serve da Cloudinary com `srcset`.
- **CA4** — CRUD de categorias (incl. aninhada) e tags reflete nas páginas de arquivo após rebuild.
- **CA5** — Permissões: Contribuidor cria mas **não publica** (403 ao publicar); Autor não edita post de outro (403); Editor edita todos; rotas de escrita exigem capacidade no backend (testes).
- **CA6** — Conteúdo salvo é **HTML sanitizado** (sem `<script>`/handlers); o pipeline SSG (`export`→build→pagefind) roda verde com posts nativos misturados aos importados.
- **CA7** — Rebuild disparado pela publicação **não causa downtime** no público (R37).
- **CA8** — Builds turbo verdes; `pr-checks` verde; **SSO compartilhado intacto** (não quebrar `@artificio/auth`); WP raiz **intocável**.
- **CA9** — Admin abre o **Dashboard** e vê contagens + estado do build + ações rápidas. Define um **post em destaque** e fixa outro; após rebuild, a **home do portal** reflete o hero + sticky na ordem escolhida. Cria um **redirect 301** pela UI e ele responde no público. O **nav cross-módulo** do portal segue intacto.

## Fora de escopo

- **Cutover/raiz (Gate C)** — desligar WP e apontar a raiz é spec/decisão futura; aqui só habilitamos a autonomia editorial em `beta.`.
- **Reativar comentários públicos** (escrita pública) — só moderação dos importados (R35) entra; abrir comentário novo ao público é decisão à parte.
- **Custom post types arbitrários / page builder visual completo** (drag-drop de layout estilo Elementor) — fora. A curadoria da home (R45) é por **campos/listas estruturados**, não layout livre arrastável.
- **Multi-idioma / i18n de conteúdo**, **e-commerce**, **formulários dinâmicos**, **plugins de terceiros** do WP.
- **Editor de tema visual** (cores/layout pelo admin) — o design vem do `@artificio/ui`.
- Migração do importador para Kysely (dívida anotada) — o admin novo usa Kysely (canon); o importador descartável segue como está.

## Riscos e impacto em outros módulos

- **SSG × dinâmico** (risco central): escrita dinâmica + rebuild incremental + preview. Mal resolvido → downtime, conteúdo stale, ou preview que mente. Mitigar com R36–R39 e validar cedo (spike de pipeline).
- **`packages/auth` (SSO sagrado):** introduzir capabilities/roles editoriais não pode alterar o contrato de sessão nem quebrar mesas/accounts. Se precisar de helper de capability, é aditivo e testado nos consumidores (SDD Completo).
- **Sanitização:** corpo autorado é entrada hostil tanto quanto HTML do WP. Reusar/estender `sanitize.ts`; XSS no corpo público é inaceitável (auth é sagrado, público é alvo).
- **Mídia/Cloudinary:** uploads reais consomem cota e exigem credencial (segredo do mantenedor). Backend deve validar tipo/tamanho e nunca confiar no cliente.
- **Migrations no store de produção:** novas colunas (`author_id`, revisões, etc.) precisam de migration online-safe (D039) — o site migra no entrypoint; cuidar de defaults e backfill dos posts importados.
- **Escopo gigante:** é uma "super spec". O `plan.md` **fasea** (MVP P0 → P1 → P2) p/ entregar valor cedo sem big-bang. Cada fase é deployável e validável isolada.
- **Tamanho do bundle do admin:** editor rico traz JS; mitigado por ser **rota admin isolada** (não afeta o zero-JS do público).

## Apêndice A — Levantamento de paridade WordPress (inventário do universo)

> Mapa do que o WP oferece ao fluxo editorial. Marca o que entra (R\*), o que fica fora, o que é nice-to-have. Serve de checklist de cobertura.

**Tipos de conteúdo:** Posts ✔(R1–R9) · Páginas ✔(R25) · Categorias ✔(R22) · Tags ✔(R22) · Taxonomias custom ✘ · Custom Post Types ✘ · Post formats (galeria/áudio/vídeo/citação) ~parcial via blocos(R13).

**Editor (estilo Gutenberg, editor de blocos próprio — não o `wp-editor`):** blocos texto/título/lista/citação/código/tabela ✔(R10) · inserir "/"+ "+", reordenar, barra por bloco ✔(R10) · imagem/galeria ✔(R11) · áudio/vídeo ✔(R13) · embeds oEmbed ✔(R15) · botões/colunas/capa/mídia-texto ~P2 · HTML cru ✔(R16) · shortcode ✘(legado WP; não replicar) · blocos reutilizáveis/patterns ✔(R14 snippets) · classic/TinyMCE ✘(usamos 1 editor de blocos moderno).

**Publicação:** rascunho/pendente/publicado/agendado/privado/lixeira ✔(R4) · arquivar ✔(R4) · autosave ✔(R7) · revisões/restaurar ✔(R7) · preview ✔(R8) · agendamento ✔(R6) · visibilidade/senha ~P2 · sticky/destaque ~P2.

**Mídia:** biblioteca ✔(R18) · alt/legenda/título ✔(R19) · tamanhos/srcset ✔(R19) · crop/focal ✔(R21) · áudio/vídeo/arquivos ✔(R20/R16) · oEmbed ✔(R15).

**SEO/Social (Yoast/RankMath):** SEO title/description/canonical ✔(R26) · OG/Twitter ✔(R27) · noindex/sitemap ✔(R28) · schema/JSON-LD ✔(já em `@artificio/content`) · foco/legibilidade ✔(R29 P2) · breadcrumbs ✔(já).

**Taxonomia/navegação:** CRUD termos ✔(R22) · atribuição ✔(R23) · descrição de termo ✔(R22) · nav cross-módulo do portal = fixo no `@artificio/ui` (D017/spec 010, **não** editável) · nav secundário do blog + footer hub **editável** ✔(R46) · widgets/sidebars ✘(não no design).

**Portal/Hub (curadoria & operação — além do WP padrão):** dashboard/overview ✔(R44) · home: hero/destaque + sticky + ordem + blocos editoriais ✔(R45) · gestão de redirects 301 ✔(R47) · log de auditoria ✔(R48) · métricas GA4 no painel ~P2(R49). *(No WP isto vem de plugins/temas; aqui é nativo do hub.)*

**Usuários:** papéis Admin/Editor/Autor/Contribuidor ✔(R30) · capabilities ✔(R30) · ownership por autor ✔(R31) · perfil/bio/avatar ~P2 · gestão de usuários ✔(R33) · login/registro = **SSO `accounts.`** (não duplicar).

**Workflow/listas:** lista com busca/filtro/ordenação/paginação ✔(R41) · bulk actions ✔(R9) · quick edit ✔(R9) · lixeira/restaurar ✔(R4).

**Comentários:** moderação ✔(R35 P2) · escrita pública ✘(decisão à parte).

**Configurações:** título/tagline/fuso/permalinks/itens-por-página ✔(R42 P2) · leitura/escrita ~P2 · temas/plugins ✘.

**Não-objetivos do WP que NÃO replicamos:** page builders visuais (Elementor/Divi), marketplace de plugins/temas, multisite, e-commerce, shortcodes legados, editor clássico, customizer de tema.
