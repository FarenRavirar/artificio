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

## Faseamento sugerido (entregar valor cedo, sem big-bang)

> Cada fase = PR(s) deployável e validável. P0 primeiro.

- **Fase 0 — Spikes & fundação:** Spike 0 (pipeline preview/rebuild SSG), Spike 1 (capabilities/roles + `site_users`), escolha do editor (Decisão 1). Migrations base (`author_id`, `revisions`, OG completo). Camada Kysely `repo/`. **Sem UI ainda.**
- **Fase 1 — MVP de autoria + Dashboard [P0]:** API CRUD posts + sanitização + slug/sugestão/301; SPA admin com **shell + Dashboard (R44)** (overview/build/ações rápidas); lista + editor de blocos da escolha T4 + categorias/tags + excerpt + featured + SEO/OG; status draft/publish/trash/archive; rebuild on publish; capabilities no backend; preview. → **CA1, CA2, CA5, CA6, CA7 parciais, CA9 (dashboard).** Substitui o essencial do WP.
- **Fase 2 — Mídia & taxonomias completas [P0/P1]:** biblioteca de mídia (upload, alt, srcset, Cloudinary), inserção no editor; áudio/vídeo/embeds; CRUD completo de taxonomias com aninhamento. → **CA3, CA4.**
- **Fase 3 — Portal/Hub: curadoria + navegação + redirects [P1]:** curadoria da home (hero/sticky/ordem/blocos — R45) refletindo no SSG; gestão do nav secundário/footer hub (R46, sem tocar nav cross-módulo); gestão de redirects 301 pela UI (R47). → **CA9 (curadoria+redirect).**
- **Fase 4 — Workflow & usuários [P1]:** agendamento + cron; autosave + revisões + restaurar; gestão de usuários editores/roles (R33); lista com busca/filtro/paginação; bulk/quick edit; **log de auditoria (R48)**.
- **Fase 5 — Páginas, snippets, refinos [P1/P2]:** CRUD de pages; snippets/reutilizáveis; HTML cru/download; moderação de comentários; settings do site (R42); métricas GA4 no dashboard (R49); legibilidade/SEO assist.

## Notas de contexto (estado ao abrir esta spec)

- Spec 010 concluída e no ar (nav unificado + logo). `dev` = `origin/dev` = `7f2fbd1`; sem commits locais pendentes.
- Backend admin atual: `server/server.ts` (`/healthz`, `/admin/status|rebuild|import`, `requireAdmin`), `jobs.ts` (single-flight). Store: `db/migrations/001_init.sql` + `002_media_map.sql`. Export: `db/export.ts`.
- Regras pétreas: SSO sagrado, WP raiz intocável, segredos fora do git, push/deploy/VM com autorização explícita por ação, `packages/*` = SDD Completo + testar consumidores.
- **Regra de versões (mantenedor, 2026-06-06):** usar **sempre as versões mais recentes e boas práticas**, sem pinar p/ baixo / gambiarra. Node já no latest (Docker `node:25.9-slim`). Bump major do monorepo (Astro 5→6, TS 5→6) toca todos os módulos → é **decisão/spec própria**, não inline numa feature (por isso o admin virou pacote isolado no latest, D054).
- **Estado de implementação (Fase 0 + parte da Fase 1 feitas, local, sem deploy):** spikes D051/D052/D053 ✅; migration 003 ✅; repos+lib+API+preview+rebuild atômico ✅; SPA admin (`apps/site-admin`) com editor BlockNote + CRUD de posts/pages ✅. Falta: emitir OG no público (T12), mídia/upload (Fase 2), E2E autenticado (no deploy).
