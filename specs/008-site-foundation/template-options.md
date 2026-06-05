# 008 — Opções de framework, template e funcionalidade (módulo `site`)

> Levantamento p/ decisão (Codex pausado; Opus executa). Objetivo: escolher **framework SSG + direção visual + funcionalidades** antes de construir.
> Critério-rubric (da doc): **minimalismo + leitura sem distração** + **SEO técnico** + **10 Heurísticas de Nielsen** + **ISO 9241-11** (eficácia/eficiência/satisfação) + **marca D040** + **reuso `@artificio/ui`**.
> ⚠️ Web search/fetch indisponível na sessão (backend caído); nomes de tema a re-verificar antes de scaffoldar.

---

## 1. Framework SSG — comparação

Constraints: D005 (store Postgres = fonte), D006 (SSG + rebuild incremental disparado pelo admin, **não SSR**), D007 (React/Vite/Tailwind + Express/Kysely/PG), `@artificio/ui` é React, SEO inegociável, leitura-first.

| Critério | **A. Astro** | **B. Vite+React SSG** (Vike/react-router prerender) | **C. Next.js static export** | **D. Eleventy (11ty)** |
|---|---|---|---|---|
| JS enviado ao leitor | **~0 (islands)** | Alto (hidrata React full) | Alto | ~0 |
| Core Web Vitals / leitura | **★★★★★** | ★★★☆ | ★★★ | ★★★★★ |
| SEO out-of-box (sitemap/RSS/meta) | **nativo + plugins** | manual | bom | manual |
| Reusa `@artificio/ui` (React) | **sim, como island** | **sim, direto** | sim | **não** (templates Nunjucks) |
| Tailwind preset reuso | sim | sim | sim | sim |
| Usa Vite (canon D007) | **sim (Astro=Vite)** | sim | não (Turbopack) | não |
| Conteúdo do Postgres no build | Content Layer / loader | fetch no build | fetch no build | data files |
| Busca estática (Pagefind) | **integração nativa** | funciona | funciona | funciona |
| Ecossistema de tema minimalista blog | **enorme** | pequeno | médio | médio |
| Curva nova p/ time | baixa (.astro fino) | nenhuma | média | alta (paradigma novo) |
| Aderência ao brief | **máxima** | média | baixa-média | média |

### Recomendação: **A — Astro**
- Feito p/ blog/conteúdo: **zero JS por padrão** → melhor leitura, CWV e SEO (exatamente o brief).
- **Island architecture:** React só onde há interação (Header com sessão, caixa de busca). Corpo do artigo = HTML puro.
- Fica **dentro do ecossistema canon**: usa **Vite**, **Tailwind** (reusa preset), e renderiza **React** (`@astrojs/react`) → `@artificio/ui` Header/Footer entram como island hidratado (lê sessão client-side via `@artificio/auth`).
- D005/D006 mapeiam limpo: **Content Layer loader** puxa posts do Postgres no build; **rebuild** disparado por webhook do admin.
- Custo honesto: nuancia D007 (frontend do *blog* ganha `.astro` p/ layout). Superfície de aprendizado fina p/ time React/Vite. **Backend permanece canon** (Express/Kysely/PG).

### Arquitetura recomendada (split limpo)
```
PUBLIC BLOG  = Astro SSG (zero-JS, lê Postgres no build) → estático em beta.
ADMIN/CMS    = React/Vite SPA (canon puro, interativo) → escreve no Postgres + dispara rebuild
BACKEND      = Express/Kysely/PG (canon) → API de conteúdo + admin + webhook rebuild
BUSCA        = Pagefind (índice estático gerado no build; zero backend)
```
Admin é app interativo (não SSG) → React SPA canônica, sem Astro. Blog público é SSG → Astro. Coerente.

> Se a decisão for **não introduzir Astro**, fallback = **B (Vite+React SSG via Vike)**: 100% canon, reusa `@artificio/ui` direto, mas exige hand-roll de SEO/sitemap/RSS e envia mais JS (pior leitura/CWV). Aceitável, inferior ao brief.

---

## 2. Direção visual (template) — 3 estilos

Todos restilizados à **marca D040** (navy `#020740` ink, laranja `#FF9457` só acento, dark surface `#1B2A4A`) + `@artificio/ui` Header/Footer. Template = esqueleto inicial, não cópia.

### Estilo A — "Editorial minimalista" (recomendado p/ página de artigo)
- **Coluna única**, prosa larga (~68ch), tipo grande legível (18–20px), ritmo vertical forte, muito espaço branco.
- Navy sobre quase-branco; dark mode = `#1B2A4A`. Laranja só em links/realces/chips de categoria.
- **Sem sidebar no artigo** (leitura sem distração). Sem ads, sem popup, sem autoplay.
- Vibe: Ghost/Stripe blog / iA Writer. Heurística 8 (minimalista) + ISO satisfação (conforto de leitura).

### Estilo B — "Portal/magazine" (referência G1, p/ home/arquivos)
- Home = **grid de cards** (destaque + por categoria), densidade maior, descoberta rápida.
- Artigo continua coluna única limpa (estilo A). Mais navegação (heurística 6 reconhecer) ao custo de mais ruído visual.
- Bom p/ **consulta/descoberta** (o "G1" conceitual do mantenedor).

### Estilo C — "Docs/wiki minimal"
- Nav esquerda fixa + TOC direita, tipo documentação. Ótimo p/ **consulta/referência**, fraco p/ leitura narrativa.
- Melhor encaixe em glossário/srd que em blog.

### Recomendação: **Híbrido A+B**
- **Artigo = A** (distração-zero, leitura máxima).
- **Home + arquivos de categoria/tag = B-light** (cards limpos p/ consulta/navegação, sem o ruído de portal de notícias real).
- Atende "minimalista + leitura sem distração" (artigo) **e** "consultas e navegações" (home/arquivo).

---

## 3. Funcionalidades × heurísticas/ISO

### Core (must-have — fase de construção)
| Funcionalidade | Heurística/ISO/SEO |
|---|---|
| Artigo coluna única, reading-time, **TOC** auto (h2/h3) em posts longos | leitura; H6 reconhecer; ISO eficiência |
| **Breadcrumbs** + prev/next + voltar | H3 controle/liberdade; H6 |
| **Posts relacionados** (por categoria/tag) | ISO eficácia (descoberta) |
| **Arquivos de categoria (árvore) + tag** + paginação | H4 consistência; H6; navegação |
| **Busca estática (Pagefind)** instantânea sobre todos os posts | H7 eficiência; ISO eficácia/eficiência |
| **Dark/light toggle** (respeita prefers-color-scheme, persistente) | H7 flexibilidade; ISO satisfação |
| Header/Footer `@artificio/ui` (marca, sticky, mobile) | H4 consistência cross-módulo |
| **SEO** (`packages/content`): meta, canonical, OG/Twitter, **JSON-LD** Article/Breadcrumb/Organization, **sitemap.xml**, **robots.txt**, **RSS** | checklist SEO |
| Estados: loading, **404 com busca**, busca-vazia | H1 status; H9 recuperar de erro |
| A11y: 1×h1 sem pular nível, alt, foco visível, teclado, **AA** (marca já AA) | ISO satisfação; SEO |
| Performance: zero/min JS, lazy + imagens dimensionadas (Cloudinary), sem layout shift | CWV → SEO |

### Fase-2 (nice-to-have)
Barra de progresso de leitura · copiar-link no heading · "voltar ao topo" · assinatura newsletter (page institucional já existe) · exibir os 25 comentários importados (read-only primeiro) · compartilhar.

### Anti-distração (postura explícita — remове o que o WP tinha)
**Fora:** ads (WP tinha `adsagent`/afiliado Hostinger), popups/interstitials, autoplay, embeds sociais pesados, sidebar no artigo. Leitura é o produto.

---

## 4. Busca — opções
- **Pagefind (recomendado):** índice estático gerado no build, busca client-side instantânea, **zero backend**, escala p/ centenas de posts. Encaixa SSG/Astro nativamente.
- Fuse.js client: simples, mas carrega todo o índice em JS (pior em escala).
- Busca via backend (Postgres FTS): mais poder, mas adiciona runtime/SSR — contra D006.

---

## 5. Decisões a tomar (→ perguntar ao mantenedor)
1. **Framework:** Astro (recomendado) vs Vite+React SSG (canon puro) vs outro.
2. **Direção visual:** Híbrido A+B (recomendado) vs A puro (só editorial) vs B (portal).
3. **Escopo de funcionalidade inicial:** core completo vs core enxuto (cortar relacionados/TOC p/ MVP mais rápido).
4. Depois da escolha: Opus scaffolda **1 protótipo real** (local, não-VM) p/ olhar e iterar — opções viram tangível, não só texto.
