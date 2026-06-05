# Inventário de Conteúdo WordPress — `artificiorpg.com`

> Snapshot de levantamento READ-ONLY via WP REST API pública (`/wp-json/wp/v2/`).
> Data: **2026-06-05**. Fonte da verdade do "o que existe no WP" para dimensionar o importador do módulo `site`.
> WP intocável (D004); este doc é só leitura. Re-rodar a recon antes do import real (números podem mudar).

## Contagens (X-WP-Total)

| Tipo | Total | Dono / destino | No escopo `site`? |
|---|---|---|---|
| `post` (blog) | **125** | módulo **site** (blog) | ✅ sim |
| `page` | 30 | site (institucionais) + outros módulos | ⚠️ filtrado (~12) |
| `category` | 13 | site (taxonomia do blog) | ✅ sim |
| `tag` (post_tag) | 69 | site (taxonomia do blog) | ✅ sim |
| `media` (attachment) | 485 | on-demand na migração (D025) | ⚠️ só as referenciadas |
| `comment` | 25 | site (comentários dos posts) | ✅ sim (D046) |
| `user` | 1 | autor único | ✅ trivial |
| `definicao` (CPT) | 163 | módulo **glossário** | ❌ não |
| `magia` (CPT) | 328 | módulo **esferas** | ❌ não |
| `docs` (CPT, BetterDocs) | 17 | módulo **downloads/docs** | ❌ não |
| `product` (WooCommerce) | 3 | loja (fora do G1 por ora) | ❌ não |
| `conteudo` / `betterdocs_faq` | 0 | — | ❌ vazios |
| `elementor_library` | 401 (privado) | page builder | ❌ não |

## Permalinks (crítico p/ 301 — D047)

- **Posts:** `https://artificiorpg.com/blog/<slug>/` (confirmado por `link` e canonical Yoast).
- **Pages:** `https://artificiorpg.com/<slug>/` (raiz).
- **Categorias/tags:** arquivos do WP (base provável `/categoria/` ou `/blog/`); confirmar no import.
- Slugs **devem ser preservados** 1:1; mapa 301 gerado mas só ativa no cutover (Gate C).

## Natureza do HTML (risco de sanitização)

- **Posts = Gutenberg LIMPO.** Amostra: `wp-block`=13, `elementor`=0, shortcodes `[..]`=0, inline `style=`=0. Parágrafos `<p>` semânticos. **Sanitização trivial** (allowlist de tags Gutenberg).
- **Pages = provável Elementor** (page builder presente nos namespaces) → HTML hostil. Tratar caso a caso; poucas pages institucionais.
- HTML do WP continua HOSTIL por princípio (regra pétrea): sanitizar SEMPRE (allowlist), nunca confiar.

## SEO disponível (Yoast presente)

`yoast_head_json` por post/page entrega: `title`, `description`, `canonical`, `og_image`, OG/Twitter tags. → migração de meta direta, sem scraping. Plugins SEO/redirect nos namespaces: `yoast/v1`, `google-site-kit/v1`.

## Classificação das 30 pages

**No escopo `site` (institucionais, ~12):**
`home`(927), `sobre-nos`(320), `contato`(339) [+dup `contact`(294) → 301], `politica-de-privacidade`(11036) [+dup `politica-de-privacidade-2`(17647) → 301], `termos-de-servico`(17643), `media-kit`(17186), `newsletter`(17639), `blog`(44, index), `grupos-de-whatsapp-de-rpg-de-mesa`(14544), `material-online`(12541), `curso-de-traducao-de-rpg`(13833), `coyote-e-crow-portugues`(17851).

**Fora (outros módulos):**
- mesas: `encontrar-mesas`(18499), `cadastro-mestre`(18500), `cadastrar-mesa`(18501), `sobre-anuncios-de-mesa`(18520).
- WooCommerce: `loja`(17227), `carrinho`(17228), `finalizar-compra`(17229), `minha-conta`(17230), `confirmacao-de-pagamento`(14067), `falha-no-pagamento`(14069).
- glossário/esferas/srd/docs: `glossario`(12846), `magias`(12589), `dd`(40), `dnd-srd-52-portugues-download`(16977), `sage-advice`(17001), `documentation-login`(12539).

> Decisão de borda a confirmar no import: `curso-de-traducao-de-rpg` e `coyote-e-crow-portugues` podem ser conteúdo pago/projeto (rever se viram post, page ou ficam fora).

## Árvore de categorias (taxonomia aninhada)

```
noticias (60)
├── internacional (47)
├── lancamentos (39)
└── nacional (33)
blog [id=1, raiz] (29)
├── analises (45)
├── guias (15)
│   └── rpg-em-geral (9)
│       └── o-que-e-rpg (7)
└── cronicas (1)
dnd (54)
downloads (13)
entrevistas (5)
```

## Top tags (69 total)

`jogadores`(102), `mestres`(58), `analises`(57), `dnd`(54), `aventuras`(51), `internacional`(49), `wizards-of-the-coast`(47), `nacional`(41), `magia`(41), `opiniao`(41), `noticias`(39), `lancamentos`(37), `dnd-2024`(35), `traducao`(34), `financiamento-coletivo`(31), `gratuito`(29), `subclasses`(23), `entrevista`(21), `ogl`(20), `guias`(20)…

## Plugins/namespaces de nota

`yoast/v1` (SEO), `google-site-kit/v1` (GA/Search Console), `wc/v3`+`wc/store` (WooCommerce), `betterdocs/v1` (docs), `elementor*` (page builder), `litespeed/v1` (cache), `contact-form-7/v1` + `mailpoet/v1` (forms/newsletter), `filebird/v1` (media folders), `jet-engine/v2` (CPTs definicao/magia provável).

## Implicações p/ a estratégia

1. **Risco menor que o temido:** 125 posts (não 300+), HTML limpo, autor único, SEO já estruturado. Importador REST é viável e baixo-risco.
2. **WP é multi-módulo:** guarda conteúdo de glossário(163)/esferas(328)/downloads(17). O importador `site` deve filtrar por tipo; arquitetura reusável p/ os outros módulos depois.
3. **Newsletter/forms** (MailPoet/CF7) e **WooCommerce** são funcionalidades vivas no WP — decidir destino futuro (provável: newsletter → serviço externo; loja → fora do G1 ou módulo próprio). Fora do escopo `site` agora.
4. **Mídia 485** inclui imagens dos CPTs de outros módulos → importar só as referenciadas pelos posts/pages do site (on-demand, D025).
