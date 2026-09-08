# 008 — Módulo `site` (portal + blog): fundação

- **Módulo/Pacote:** `apps/site` + `packages/content` (novo) + `packages/analytics` (novo)
- **Gate relacionado:** D (por módulo) — Gate C (cutover raiz) **adiado/fora de escopo** (D016)
- **Decisões base:** D005 (store nativo + importador one-shot), D006 (SSG + rebuild), D007 (stack), D011/D016/D044 (só beta. por ora), D019/D020 (SEO raiz/analytics cross), D025 (mídia on-demand), D045/D046/D047 (REST/escopo/rotas-301)
- **Levantamento:** `docs/agents/wp-content-inventory.md` (recon 2026-06-05)

## Problema

O site `artificiorpg.com` roda em WordPress (Elementor/WooCommerce/Yoast/MailPoet, pesado). O blog (125 posts) é o ativo de **maior valor de SEO** do projeto e o **maior risco** da migração. Precisamos de um módulo nativo, leve e SEO-safe que:

1. Substitua o WP como CMS do blog/portal por um **store nativo Postgres** + **importador one-shot** (D005), sem dependência de CMS pesado.
2. Sirva o blog como **pré-render estático (SSG)** com rebuild incremental disparado pelo admin (D006), não SSR.
3. **Preserve 100% dos slugs** e prepare o mapa **301** (regra pétrea: zero regressão de SEO).
4. Suba **primeiro como `beta.artificiorpg.com`** (D011/D044), com o WP da raiz **intocável** até o cutover (Gate C, adiado).
5. Reúse o contrato de módulo G1: SSO via `accounts.`, design system `@artificio/ui`, deploy canônico, analytics cross-subdomínio.

**Esta spec é a FUNDAÇÃO:** define arquitetura, escopo e fases. A prioridade desta fase (decisão do mantenedor, D044) é **levantamento + decisão + documentação estratégica** — não pressa de código. Fases de execução (importador, SSG, SEO) podem virar specs-filhas se crescerem.

## Requisitos (numerados, testáveis)

### Store nativo (CMS Postgres)
- **R1** — Schema Postgres modela: `posts` (slug único, título, html sanitizado, excerpt, status, datas, autor, meta SEO), `taxonomies` (categorias aninhadas + tags) com relação N:N a posts, `media` (mapeamento WP→Cloudinary), `pages` (institucionais), `comments`, `redirects` (mapa 301). Migrations frameworkadas (schema_migrations/lock/transacional, padrão D039).
- **R2** — Slug é **chave natural** e **imutável** pós-import; colisão de slug falha o import (não sobrescreve silenciosamente).
- **R3** — Categorias preservam a **hierarquia pai/filho** (árvore do inventário).

### Importador WP→store (one-shot, REST — D045)
- **R4** — Importador lê via **WP REST API** (sem credencial DB; WP intocável). Idempotente por slug: re-rodar não duplica nem corrompe.
- **R5** — Importa **só o escopo `site`** (D046): `post`(125), `category`(13), `tag`(69), `page`s institucionais filtradas (~12), `comment`(25), e a **mídia referenciada** por esses itens. Ignora CPTs de outros módulos (`definicao`/`magia`/`docs`/`product`) e pages de mesas/WooCommerce.
- **R6** — HTML é **sanitizado** por allowlist (regra pétrea: HTML do WP é hostil). Gutenberg limpo nos posts → allowlist de tags semânticas; pages Elementor tratadas caso a caso.
- **R7** — Meta SEO migra do **Yoast** (`yoast_head_json`: title/description/canonical/og_image) 1:1 por item.
- **R8** — Mídia: importador puxa o **original** via URL REST, sobe ao **Cloudinary** (Cloudinary regenera variantes; D025); reescreve `src` no HTML p/ a URL Cloudinary. Não backupeia os 6.34GB de variantes.
- **R9** — Gera **relatório de paridade**: contagem importada vs origem, lista de slugs, itens pulados/falhos, mapa 301. Critério de paridade = 100% dos posts publicados + slugs idênticos.

### SSG + rebuild (D006)
- **R10** — Blog é **pré-renderizado estático** (build gera HTML por rota). Rotas: `/blog/<slug>/` (posts), arquivos de categoria/tag aninhados, pages institucionais em `/<slug>/`.
- **R11** — **Rebuild incremental** disparado pelo admin (endpoint protegido) ao publicar/editar; não SSR em runtime.
- **R12** — Build é determinístico e idempotente; um post novo aparece no índice + sitemap após rebuild.

### SEO (`packages/content`)
- **R13** — `packages/content` gera **meta tags**, **JSON-LD** (Article/BreadcrumbList/Organization), **sitemap.xml**, **robots.txt**. Reusável por outros módulos.
- **R14** — Cada post mantém `canonical` = sua URL no domínio final; redirects 301 (slug WP → rota) preparados no store, **ativados só no cutover** (Gate C).
- **R15** — Zero regressão: todo slug do WP tem destino (post, page ou 301).

### Analytics (`packages/analytics`)
- **R16** — `packages/analytics` integra **GA4 com `cookie_domain` raiz** + exclusão de referral interno (D020); 1 property cobrindo subdomínios. Reusável por todos os módulos.

### Contrato de módulo + deploy
- **R17** — `apps/site` segue o contrato `add-module`: SSO via `accounts.` (cookie `.artificiorpg.com`), `@artificio/ui` (Header/Footer/marca real D040), `@artificio/auth`.
- **R18** — Deploy canônico (D039) em **`beta.artificiorpg.com`** (D044). Cloudflare Tunnel hostname→container. DB próprio do site na `artificio_net`.

## Critérios de aceite

- **CA1** — `pnpm --filter @artificio/site build` + `turbo build` verdes; store schema migra limpo num Postgres vazio.
- **CA2** — Importador (dry-run sandbox, não-prod) importa os 125 posts + taxonomias + pages filtradas + 25 comentários do WP, com **relatório de paridade 100%** (slugs idênticos, 0 perdas).
- **CA3** — Blog SSG renderiza `/blog/<slug>/` para todos os posts; HTML sanitizado (sem `<script>`/on*/iframe não-allowlist); imagens via Cloudinary.
- **CA4** — `sitemap.xml` lista todos os posts+pages; `robots.txt` válido; JSON-LD passa no Rich Results Test; mapa 301 cobre 100% dos slugs WP.
- **CA5** — `beta.artificiorpg.com` no ar: SSO compartilhado funciona (login redireciona p/ `accounts.`), Header/Footer da marca, GA4 dispara com cookie raiz. Smoke: home 200, post 200, sitemap 200, rota inexistente 404.
- **CA6** — WP da raiz **inalterado** durante todo o processo (verificável: `artificiorpg.com` responde igual antes/depois).

## Fora de escopo

- **Cutover** (apontar raiz → site novo, desligar WP) = Gate C, adiado (D016).
- **Staging dedicado** do site (`sitebeta.`) = D044, futuro.
- **CPTs de outros módulos** (`definicao`/`magia`/`docs`) = glossário/esferas/downloads (specs próprias).
- **WooCommerce/loja** = fora do G1 por ora.
- **Newsletter/forms** (MailPoet/CF7) = decisão futura (provável serviço externo); o site só preserva a page institucional.
- **Reativar comentários** como sistema vivo (moderação/anti-spam) = futuro; agora só **importa** os 25 existentes como dado.
- **Importar os 6.34GB** de variantes de mídia (D025: só originais referenciados, on-demand).

## Riscos e impacto em outros módulos

| Risco | Mitigação |
|---|---|
| **Regressão de SEO** (slug perdido, 301 errado) | Slug imutável (R2); mapa 301 100% (R15); 301 só ativa no cutover (isolado em beta. até lá) |
| **HTML hostil** (XSS via conteúdo WP) | Sanitização allowlist obrigatória (R6); posts são Gutenberg limpo (baixo risco real) |
| **`packages/content`/`analytics` são compartilhados** | SDD Completo; mudança em pacote = impacto cross-módulo → contrato estável, versionado, testado antes de outros consumirem |
| **Tocar o WP por engano** | Importador é **read-only** sobre o WP (só REST GET); CA6 verifica WP inalterado |
| **Mídia: links quebrados** pós-Cloudinary | Importador reescreve `src` e valida (R8); relatório lista mídia faltante |
| **Colisão `beta.` (já é URL viva planejada)** | D044: `beta.` é o destino único do site agora; sem par staging que colida |
| **Custo de contexto** (módulo grande) | Fundação + fases; specs-filhas se importador/SSG crescerem; Codex executa, Opus valida por Gate D |

## Decomposição em fases (vira tasks / possíveis specs-filhas)

1. **F1 — Fundação:** esta spec + inventário + decisões (✅ levantamento feito).
2. **F2 — Store:** schema Postgres + migrations + `apps/site` skeleton (contrato add-module).
3. **F3 — Importador:** REST one-shot + sanitização + Cloudinary + relatório de paridade (agente `wp-importer`).
4. **F4 — SSG + rebuild:** pré-render + rotas + trigger admin.
5. **F5 — `packages/content`:** meta/sitemap/robots/JSON-LD/301.
6. **F6 — `packages/analytics`:** GA4 cross-subdomínio.
7. **F7 — Deploy beta:** `beta.artificiorpg.com` + SSO/UI + smoke → **Gate D**.
