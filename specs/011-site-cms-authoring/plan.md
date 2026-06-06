# Plano — 011 CMS / autoria nativa do site

## Arquitetura da solução

### Visão geral (3 camadas, reusa o que já existe)
```
[Admin SPA React /admin]  ──HTTP(JSON)──>  [Backend Express /api/admin/*]  ──Kysely──>  [Postgres store]
   (@artificio/ui, editor rico)              (auth + capabilities + sanitize)              (posts/pages/tax/media/users/revisions)
        ▲                                              │
        │ preview                                      ├── dispara job rebuild (single-flight, jobs.ts)
        │                                              ▼
   [SSR preview route]                         [export → astro build → pagefind]  ──>  [dist/ servido pelo Express]
   (rascunho, autenticado)                            (SSG público, zero-JS)
```

- **Público continua SSG zero-JS.** O admin é uma **SPA isolada** em `/admin` (JS só ali). Editor rico não vaza pro público.
- **Backend Express** (já existe, `server/`) ganha a **API de autoria** versionada (`/api/admin/v1/*`), toda gated por sessão SSO + **capability**.
- **Store Postgres** é a fonte da verdade. Mutação grava no store → dispara **rebuild incremental** (reusa `/admin/rebuild` + `jobs.ts`). Export passa a ler do store (hoje export já gera `posts.json`).
- **Preview** de rascunho: rota SSR autenticada que renderiza o post do store sem depender do `dist/` público (Astro `output: 'server'`/endpoint, ou render isolado). Decisão de mecanismo no Spike 0.

### Decisão técnica 1 — Editor de blocos estilo Gutenberg (Spike obrigatório antes de R10)
**Requisito firme (mantenedor):** UX **de blocos** estilo Gutenberg (inserir "/"+"+", reordenar, barra por bloco) — mas **não** o `wp-editor`. Isso re-ranqueia: candidatos **block-native** (UX de blocos pronta) ganham peso sobre rich-text puro.

Candidatos (conhecimento de referência; **validar versão atual no spike**, web search estava fora):
| Opção | Modelo | UX de blocos pronta? | Prós | Contras |
|---|---|---|---|---|
| **BlockNote** (sobre ProseMirror) | blocos estilo Notion/Gutenberg | **Sim, out-of-the-box** | "/" + arrastar + barra por bloco prontos; exporta HTML; custom blocks (embed/áudio/vídeo/snippet) | mais opinativo; controlar HTML final exige cuidado na (de)serialização |
| **TipTap** (ProseMirror) + camada de blocos | árvore rica → HTML | Parcial (precisa construir a UX de blocos) | HTML semântico 1:1, maduro, casa c/ sanitização (R17); base do BlockNote | UX de blocos é trabalho nosso; algumas extensões pagas |
| **Editor.js** | blocos → JSON | **Sim** | block-native, JSON limpo por bloco | saída JSON (não HTML) → camada de render/sanitize própria; ecossistema de plugins variável |
| **Lexical** (Meta) | estado próprio | Não (construir) | performático | serialização HTML + UX de blocos = mais esforço |
| **Plate** (Slate) | plugins | Parcial | flexível | Slate tem arestas de estabilidade |

**Recomendação a confirmar no spike:** **BlockNote** — entrega a UX de blocos estilo Gutenberg pedida sem reconstruí-la, é baseado em ProseMirror (mesma base sólida do TipTap) e exporta HTML que cai no `content_html`/sanitizador. **Plano B: TipTap + camada de blocos própria** se precisarmos de controle total do HTML de saída ou de blocos muito customizados. **O spike (T4) decide por:** fidelidade/limpeza do HTML de saída, sanitização (R17), tamanho do bundle (rota admin), facilidade de **custom blocks** (imagem/áudio/vídeo/embed/snippet — R11/R13/R14/R15), e custo de licença.

### Decisão técnica 2 — Capabilities / roles (toca SSO → SDD)
- `@artificio/auth` já expõe `session.user.role`. Definir um mapa **role → capabilities** (tabela pura, sem alterar o contrato de sessão). Onde mora: provavelmente `packages/auth` (helper `can(user, capability)`), aditivo, testado em mesas/accounts (não devem quebrar).
- **Papel editorial do site** pode ser distinto do papel global do SSO: tabela `site_users` (`user_id` do SSO → `editorial_role`) no store do site, p/ o site gerir quem é Editor/Autor sem mexer no SSO. Decisão no Spike 1.
- Backend: middleware `requireCapability('publish_posts')` estende o `requireAdmin` atual.

### Decisão técnica 3 — Acesso a dados
- Admin/backend novo usa **Kysely** (stack canônica), não SQL cru. O importador descartável segue com SQL cru (dívida já anotada). Criar camada `db/repo/*` tipada.

### Decisão técnica 4 — Preview SSG
Opções (Spike 0):
- **A.** Astro híbrido: público SSG + endpoint server `/admin/preview/[id]` (`export const prerender = false`) que renderiza o post do store com o mesmo layout. Requer adapter Node no Astro.
- **B.** Render isolado: o backend chama um "render de 1 post" (reusa componentes Astro via build parcial) → diretório `preview/` servido só ao admin.
- **C.** Preview client-side no editor (render do HTML sanitizado no tema) — mais simples, menos fiel.
Recomendação: **A** (mais fiel, um adapter; o público segue SSG).

### Decisão técnica 5 — Storage de curadoria/config do hub (área K)
- **Curadoria da home** (hero/sticky/ordem/blocos), **nav editável** (secundário/footer) e **settings** são **dados estruturados**, não conteúdo livre. Modelar como tabelas pequenas: `site_settings` (chave/valor JSONB), `curation` (slots da home), `nav_items` (lista ordenável escopo `blog_secondary`/`footer_hub`). `redirects` já existe.
- Export passa a emitir esses dados como JSON (ex.: `home.json`, `nav.json`) que o Astro lê no build — mesmo padrão de `posts.json`. Sem novo runtime no público.
- **Invariante:** `nav_items` editável **nunca** inclui o nav cross-módulo do portal (`defaultNavItems` do `@artificio/ui`, fixo por D017). O admin edita só o secundário e o footer hub.
- **Auditoria** (`audit_log`): middleware no backend grava ação/usuário/alvo em toda mutação; só leitura no dashboard.

## Arquivos afetados (por módulo/pacote)

| Caminho | Mudança |
|---|---|
| `apps/site/server/` | API de autoria `/api/admin/v1/*` (posts/pages/tax/media/users); middleware `requireCapability`; validação/sanitização na escrita; endpoints de revisão/preview/status |
| `apps/site/server/jobs.ts` | estados de build/preview; agendamento (scheduled posts) |
| `apps/site/db/migrations/00X_*.sql` | `author_id`, `revisions`, `site_users`/`editorial_role`, índices; colunas de OG/twitter já existem (`og_image`, `seo_*`) — completar (`og_title`, `og_description`, `twitter_*`, `noindex`); `posts.status` já existe |
| `apps/site/db/repo/*.ts` | camada Kysely tipada (posts, taxonomies, media, users, revisions) |
| `apps/site/db/export.ts` | exporta só `publish`/agendados-no-prazo; ignora draft/trash/archived; inclui campos OG novos |
| **`apps/site-admin/` (PACOTE PRÓPRIO, D054)** | SPA React (vite 8 + plugin-react 6 + react 19.2 + router 7 + BlockNote 0.51). Painel: lista/edição de posts e pages, editor de blocos; *(dashboard/mídia/portal-home/nav/redirects/usuários = fases seguintes)*. Build vite → `dist`, na imagem Docker. **Separado do Astro público** (conflito de major do vite; isola JS do público zero-JS) |
| `apps/site/server/server.ts` | serve `apps/site-admin/dist` em `/admin` (static + fallback SPA); rotas `/admin/status\|rebuild\|import\|preview` têm precedência |
| `apps/site/db/migrations/00Y_*.sql` (curadoria/hub) | `site_settings` (chave/valor: título/tagline/defaults SEO/home), `curation` (hero/sticky/ordem/blocos da home), `nav_items` (nav secundário blog + footer hub editável), `audit_log`; `redirects` já existe | 
| `apps/site/src/pages/index.astro` + listas da home | passam a ler **curadoria** (hero/sticky/ordem/blocos) do export, não só "últimos N" |
| `apps/site/server` (rotas hub) | `/api/admin/v1/{dashboard,curation,nav,redirects,audit}` + middleware de auditoria |
| `apps/site/server/preview.ts` | preview render no Express (Decisão 4, sem adapter Astro) |
| `apps/site/server/admin-api.ts` + `db/repo/*` + `server/lib/content.ts` | API de autoria + repos + slug/sanitize/excerpt |
| `apps/site/Dockerfile` | COPY `apps/site-admin` + turbo build do `@artificio/site-admin` (na imagem); entrypoint inalterado |
| `apps/site/scripts/rebuild.mjs` | rebuild atômico (build→`dist.next`→swap, D053) |
| `.github/workflows/deploy-site.yml` | paths incluem `apps/site-admin/**` |
| `packages/auth/*` | (se confirmado) helper `can()`/capabilities — **aditivo, SDD, testar consumidores** |
| `packages/ui/*` | (se preciso) componentes de admin reaproveitáveis (form, toolbar) — só se houver reuso real |
| `@artificio/content` | reuso p/ OG/meta/JSON-LD na escrita (preview social) |

## Contratos/interfaces tocados

- **Auth/accounts:** introduz capabilities sobre `session.user.role` — **não altera** o cookie/contrato SSO. Atribuição de papel editorial fica no store do site (`site_users`). Login/registro permanecem 100% em `accounts.`.
- **Subdomínio/DNS:** nenhum. Tudo em `beta.artificiorpg.com` (admin em `/admin`). Cutover é Gate C, fora.
- **Schema:** migrations aditivas online-safe (D039); backfill `author_id` dos posts importados (autor padrão = conta admin). Defaults p/ não quebrar export atual.
- **API pública:** inalterada (SSG). Nova superfície é só `/api/admin/*` (privada).

## Impacto em consumidores

- `mesas`/`accounts` consomem `packages/auth` e `packages/ui`. Qualquer adição lá é **aditiva e testada** (turbo build dos 3 + testes de auth). Sem mudança de assinatura existente.
- Pipeline de deploy (`_deploy-module`, `deploy-site.yml`): novo passo de build da SPA admin + possível adapter Node; migrations entram pelo entrypoint (como hoje). Validar guard de migration (D039) e exec-bit (spec 009 R2).

## Rollback

- Tudo versionado + faseado. Cada fase é um PR isolado revertível.
- Migrations: cada uma com par de rollback documentado; store tem snapshot no deploy (`_deploy-module`).
- Feature flag: a rota `/admin` de autoria pode nascer atrás de env (`SITE_AUTHORING=on`) p/ subir sem expor antes de validar.
- Pior caso: importador WP continua funcionando; voltar ao fluxo somente-leitura é reverter o PR da fase.

## Validação (como provo que funciona)

- **Spike 0/1** (pipeline SSG↔autoria + roles) validados em dev antes de codar fases.
- Testes backend: capabilities (CA5), sanitização (CA6), slug+301 (CA2/R3), CRUD (R1–R2, R22).
- E2E no preview local: criar post completo → preview → publish → aparece no SSG (CA1); upload de mídia (CA3); taxonomia (CA4).
- Build: `pnpm --filter @artificio/site build` verde com posts nativos+importados; turbo 3 módulos verde; `pr-checks` verde.
- No ar (com autorização): deploy beta; smoke; rebuild sem downtime (CA7); SSO intacto (CA8); WP raiz 200.

## Checkpoint pós-deploy da Fase 1 (2026-06-06)

**Veredito técnico:** a arquitetura está provada e minimamente funcional para um administrador técnico: CRUD de posts/pages, editor BlockNote, campos editoriais básicos, preview stateless, publish→rebuild e SEO/OG público. O admin ainda não é confortável o bastante para substituir o WordPress no fluxo diário de editoria.

**Gargalo principal imediato:** operações editoriais básicas e honestidade de publicação. A Fase 1 permite abrir editor, salvar/publicar e trocar status, mas ainda não entrega uma superfície administrativa tipo WordPress para arquivar, mover para lixeira, restaurar e apagar permanentemente com confirmação. Também expõe campos/status que parecem completos sem fechar toda a semântica: slug sem aviso claro de colisão/301, `scheduled` sem job real, `private` sem regra de acesso, `noindex` sem controle de sitemap, e OG parcial na UI.

**Gargalo principal seguinte:** mídia. Sem biblioteca/upload/seleção de imagem, o editor precisa colar URL manualmente e não consegue gerenciar alt/legenda/dimensões/Cloudinary pelo admin. Isto torna o fluxo menos prático que WordPress mesmo que o editor de texto funcione.

**Gargalos secundários, em ordem de impacto:**
1. Lista editorial incompleta: sem filtros/paginação/bulk/quick edit.
2. Workflow incompleto: `scheduled` é só status; falta job de publicação; falta autosave/revisões.
3. Permissões incompletas: só `admin` global; falta papel editorial por site.
4. Operação editorial incompleta: dashboard/build status/logs/atividade.
5. Portal incompleto: home ainda é automática por posts recentes; falta curadoria.

**Regra de implementação daqui para frente:** priorizar o que remove bloqueio real de uso editorial antes de refinos visuais. A ordem recomendada é: operações editoriais básicas + publicação honesta → mídia → lista editorial → agendamento/autosave/revisões → roles → dashboard → curadoria.

## Plano de implementação do delta até "WordPress-like"

### 1. Operações editoriais básicas + publicação honesta primeiro (Fase 2A)

Antes de mídia, fechar o mínimo administrativo que o WordPress dá por padrão.

- **API:** confirmar/implementar endpoints para `archive`, `trash`, `restore`, `unpublish/draft` e `DELETE` permanente em posts e pages, com validação de id, capacidade, confirmação no front e rebuild quando o item afetava o público.
- **Semântica:** `trash` e `archived` ficam fora de export/listagens/sitemap; `restore` volta para `draft` por padrão, salvo regra documentada; delete permanente só permitido em `trash` ou com confirmação forte.
- **Frontend:** ações por item nas listas e no editor: Editar, Ver/Preview, Publicar, Despublicar, Arquivar, Mover para lixeira, Restaurar, Apagar permanentemente. Ações destrutivas usam confirmação e feedback de erro/sucesso.
- **Slug:** UI chama `slug-check` também ao editar slug manualmente; mostra disponibilidade, sugestão alternativa, URL final e aviso de 301 quando slug publicado muda.
- **Status:** esconder/desabilitar `scheduled` e `private` enquanto não houver semântica real, ou mostrar estado indisponível. `scheduled` só volta como ação quando tiver data obrigatória + job; `private` só volta quando houver regra de acesso.
- **SEO/OG básico:** expor `og_title`, `og_description` e `twitter_card` ou mostrar fallback explícito; `noindex` deve controlar sitemap ou a UI deve deixar claro que ainda é só meta tag.
- **Integridade:** manter redirects automáticos de slug; não apagar redirect histórico sem ação explícita; não deixar relações órfãs (`post_taxonomies`, media refs se houver); rebuild coalesced após remover conteúdo publicado.
- **Aceite:** CA2b/CA2c passam em post importado e nativo; item arquivado/lixeira/delete some do público após rebuild; restauração funciona sem publicação acidental.

### 2. Mídia (Fase 2B)

Criar uma superfície nativa de mídia antes de mexer em curadoria ou dashboard sofisticado.

- **Schema:** estender/normalizar `media` para itens nativos além do import WP: `id`, `source` (`wp|cloudinary|local`), `url`, `cloudinary_public_id`, `mime`, `size_bytes`, `width`, `height`, `alt`, `caption`, `title`, `created_by`, `created_at`, `updated_at`.
- **API:** `/api/admin/v1/media` com upload, listagem, busca, update de metadados e seleção. Upload deve validar tipo/tamanho no backend.
- **Frontend:** nova rota `Mídia`, modal/seletor de mídia no `PostEditor`/`PageEditor`, botão de inserir imagem no BlockNote, e campo de imagem destacada usando seletor em vez de URL manual.
- **Cloudinary:** usar Cloudinary quando `CLOUDINARY_URL` estiver setado; sem credencial, permitir dry-run/local somente para dev. Nunca hardcodar segredo.
- **Dependências prováveis:** SDK Cloudinary já existe no importador; para upload multipart considerar `multer` ou `busboy`, validação com `file-type`, e limites Express. Evitar `sharp`/`ffmpeg` inicialmente: Cloudinary cobre transformações; instalar binários na VM só se uma necessidade concreta aparecer.
- **Aceite:** editor sobe imagem, define alt, escolhe no corpo e no `og:image`, publica, rebuilda, e a imagem aparece no público.

### 3. Lista editorial de verdade (Fase 2C / Fase 4 parcial)

- **API:** `GET /posts` e `/pages` com `q`, `status`, `category`, `tag`, `author`, `limit`, `offset`, `sort`, `direction` e total count.
- **UI:** filtros persistentes na URL, paginação, ordenação por título/status/data, seleção múltipla, bulk publish/trash/archive, quick edit de título/slug/status.
- **Aceite:** localizar rapidamente posts importados e nativos; mover múltiplos itens para lixeira/arquivar; alterar status sem abrir editor.

### 4. Workflow editorial (Fase 4A)

- **Agendamento:** job periódico no processo do site ou script chamado por scheduler de deploy/VM; publica `scheduled` com `published_at <= now()` e dispara rebuild. Começar simples com timer no backend; evoluir para cron/systemd apenas se necessário e aprovado.
- **Autosave:** endpoint `/autosave` ou update parcial com debounce; estado visual "salvo/salvando/erro".
- **Revisões:** tabelas `post_revisions` e `page_revisions` com snapshot de título, bloco, HTML, status e usuário; UI para comparar/restaurar.
- **Aceite:** post agendado entra no ar sozinho; edição longa não se perde; revisão anterior pode ser restaurada.

### 5. Roles editoriais sem mexer no SSO (Fase 4B)

- **Schema:** `site_users(user_id, email, name, editorial_role, created_at, updated_at)` e talvez `site_user_invites` se necessário.
- **Middleware:** `requireCapability(cap)` no `apps/site`, com mapa Admin/Editor/Autor/Contribuidor. `@artificio/auth` permanece intocado.
- **UI:** gestão de usuários editores no admin; atribuir/revogar papel.
- **Aceite:** Contribuidor cria mas não publica; Autor edita só próprio; Editor edita todos; Admin gerencia roles.

### 6. Dashboard e observabilidade editorial (Fase 3/4)

- **API:** `/dashboard` retorna contagens por status, últimas edições, estado de rebuild, erros recentes e links rápidos.
- **Jobs:** persistir histórico de jobs em tabela ou arquivo controlado, não só memória, para sobreviver restart.
- **UI:** dashboard inicial com "Novo post", "Upload mídia", "Rebuild", último build e erro se houver.

### 7. Portal/hub e redirects (Fase 3)

- **Curadoria:** `site_settings`, `curation`, `nav_items`; `export.ts` gera `home.json`/`nav.json`; `index.astro` deixa de escolher hero só pelo post mais recente.
- **Redirects UI:** CRUD da tabela `redirects` com validação, busca, teste de destino e reload imediato.
- **Invariante:** nav cross-módulo do `@artificio/ui` continua fixo; admin edita só blog secundário/footer/curadoria do hub.

### 8. Pacotes e VM

- **`packages/auth`:** não mexer para roles editoriais; manter a decisão D052. Só criar helper compartilhado se mais de um módulo precisar do mesmo mapa de capabilities, com SDD próprio e testes de consumidores.
- **`packages/ui`:** pode receber componentes de admin reutilizáveis (tabela, modal, toolbar, seletor de mídia) se surgirem em mais de um módulo; caso contrário manter local em `apps/site-admin`.
- **VM/programas:** não instalar serviços novos para Fase 2. Cloudinary evita processamento local. Instalar utilitários como `ffmpeg`, `imagemagick` ou `sharp`/binários só se uma tarefa concreta exigir processamento local e com aprovação quando envolver VM/deploy.

## Faseamento sugerido (entregar valor cedo, sem big-bang)

> Cada fase = PR(s) deployável e validável. P0 primeiro.

- **Fase 0 — Spikes & fundação:** Spike 0 (pipeline preview/rebuild SSG), Spike 1 (capabilities/roles + `site_users`), escolha do editor (Decisão 1). Migrations base (`author_id`, `revisions`, OG completo). Camada Kysely `repo/`. **Sem UI ainda.**
- **Fase 1 — MVP de autoria [P0] ✅:** API CRUD posts/pages + sanitização robusta + slug/sugestão/301; SPA admin com shell, lista simples e editor BlockNote; categorias/tags inline; excerpt; featured por URL; SEO/OG/canonical/noindex; campo/status endpoint; preview stateless; rebuild server-side on publish. → **CA1/CA2/CA5/CA6/CA7 parciais.** Prova a arquitetura, mas **não substitui o WordPress no uso diário** sem as fases seguintes.
- **Fase 2 — Operações editoriais básicas + mídia/taxonomias [P0/P1]:** primeiro fechar ações por item (editar existente, despublicar, arquivar, lixeira, restaurar, apagar permanente com confirmação, rebuild quando sair do público) e honestidade de publicação (slug, 301, status, noindex/sitemap, OG); depois biblioteca de mídia (upload, alt, srcset, Cloudinary), inserção no editor; áudio/vídeo/embeds; CRUD completo de taxonomias com aninhamento. → **CA2b, CA2c, CA3, CA4.** Esta é a próxima fase recomendada.
- **Fase 3 — Portal/Hub: dashboard + curadoria + navegação + redirects [P1]:** dashboard R44 (contagens, build, ações rápidas), curadoria da home (hero/sticky/ordem/blocos — R45) refletindo no SSG; gestão do nav secundário/footer hub (R46, sem tocar nav cross-módulo); gestão de redirects 301 pela UI (R47). → **CA9.**
- **Fase 4 — Workflow & usuários [P1]:** lista editorial completa com busca/filtro/paginação/bulk/quick edit; agendamento + cron/timer; autosave + revisões + restaurar; gestão de usuários editores/roles (R33) sem mexer no SSO; **log de auditoria (R48)**.
- **Fase 5 — Páginas, snippets, refinos [P1/P2]:** CRUD de pages; snippets/reutilizáveis; HTML cru/download; moderação de comentários; settings do site (R42); métricas GA4 no dashboard (R49); legibilidade/SEO assist.

## Notas de contexto (estado ao abrir esta spec)

- Spec 010 concluída e no ar (nav unificado + logo). `dev` = `origin/dev` = `7f2fbd1`; sem commits locais pendentes.
- Backend admin atual: `server/server.ts` (`/healthz`, `/admin/status|rebuild|import`, `requireAdmin`), `jobs.ts` (single-flight). Store: `db/migrations/001_init.sql` + `002_media_map.sql`. Export: `db/export.ts`.
- Regras pétreas: SSO sagrado, WP raiz intocável, segredos fora do git, push/deploy/VM com autorização explícita por ação, `packages/*` = SDD Completo + testar consumidores.
- **Regra de versões (mantenedor, 2026-06-06):** usar **sempre as versões mais recentes e boas práticas**, sem pinar p/ baixo / gambiarra. Node já no latest (Docker `node:25.9-slim`). Bump major do monorepo (Astro 5→6, TS 5→6) toca todos os módulos → é **decisão/spec própria**, não inline numa feature (por isso o admin virou pacote isolado no latest, D054).
- **Estado de implementação (pós-deploy beta, 2026-06-06):** Fase 0 + Fase 1 no ar em `beta.artificiorpg.com/admin` via commit `a24f187`; duas rodadas de revisão corrigiram 13 achados; T12 público concluído (OG/canonical/noindex emitidos). Falta validação E2E autenticada do mantenedor e, para paridade operacional com WordPress, principalmente operações editoriais básicas (arquivar/lixeira/restaurar/apagar), honestidade de publicação (slug/status/noindex/sitemap/OG), mídia/upload (Fase 2), lista editorial completa, agendamento/autosave/revisões, roles, dashboard, curadoria e redirects UI.
