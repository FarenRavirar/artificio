# Spike findings — Fase 0 (spec 011)

> Resultado dos spikes T2/T3/T4. Investigação sobre o código atual + decisão. Sem implementação de feature ainda.

## T2 — Pipeline SSG ↔ autoria (preview + rebuild sem downtime)

### Estado atual (fatos do código)
- `apps/site/astro.config.mjs`: **SSG puro**, sem adapter (`output` default static). `site`, `trailingSlash: always`, integração sitemap, Tailwind via Vite.
- `package.json` script `rebuild` = `tsx db/export.ts && astro build && pagefind --site dist`.
- `server/server.ts` serve o **`dist/` estático** via `express.static(DIST)`.
- `server/jobs.ts` = runner **single-flight** (`spawn pnpm run <script>`, lock em memória, logTail). `/admin/rebuild` chama `runJob("rebuild","rebuild")`.
- `docker-entrypoint.sh` (spec 009 R6): se `dist/index.html` existe e não forçado, **serve direto** (restart sem rebuild = zero downtime no restart).

### Problema descoberto (R37 — sem downtime no REBUILD)
`astro build` **limpa o `outDir` (`dist/`) no início do build**. Como o Express serve `dist/` ao vivo, durante a janela de rebuild o público veria `dist/` vazio/meio-escrito → **404/quebra**. O R6 do entrypoint resolve só o caso de *restart*; **não** resolve o rebuild incremental disparado por publicação.

### Decisão (→ D053)
- **Rebuild atômico:** buildar para um diretório **temporário** e fazer **swap atômico** para `dist/`. Novo fluxo do `rebuild`:
  1. `export` (store → `src/data/*.json`)
  2. `astro build --outDir dist.next` (ou build p/ temp)
  3. `pagefind --site dist.next`
  4. **swap:** `mv dist dist.old && mv dist.next dist && rm -rf dist.old` (curtíssima janela; ou symlink `dist`→`dist.<ts>` e troca do symlink = swap instantâneo).
  - O Express continua servindo o `dist/` antigo até o swap. Janela de inconsistência ≈ duração de um `mv` (ms).
- **Preview de rascunho (R8/R38) — sem adapter Node no público:** o **Express renderiza o preview** numa rota autenticada (`GET /admin/preview/:id`, requer capability), montando o HTML do post (sanitizado) dentro do **mesmo shell/CSS do artigo** (`@artificio/ui/styles.css` + markup do template de artigo). Evita adicionar adapter SSR ao Astro (público segue SSG puro/zero-JS). Fidelidade alta (o tema é CSS-driven). Alternativa client-side (render no editor) fica como fallback de menor fidelidade.
- **Estado do build no admin (R39):** já temos `jobState()`; expor no dashboard.

## T3 — Roles / capabilities editoriais

### Estado atual (fatos do código)
- `packages/auth/src/types.ts`: `UserRole = "user" | "admin"` — **só 2 papéis** no SSO. `Session.user.{id,email,name,role,avatar}`.
- `server/server.ts`: `requireAdmin` checa `session.user.role !== "admin"`.

### Conclusão
Os papéis editoriais do WP (**Editor/Autor/Contribuidor**) **não existem** no SSO e não devem poluí-lo (auth é sagrado; mudar `UserRole` afeta mesas/accounts).

### Decisão (→ D052)
- **Capabilities ficam no `apps/site`** (não em `packages/auth`). `packages/auth` permanece **intocado** (zero SDD em shared, zero risco a mesas/accounts).
- Tabela `site_users` no store: `user_id` (= SSO `user.id`/`sub`) → `editorial_role` (`admin`|`editor`|`author`|`contributor`). Default p/ quem não está na tabela = sem capacidades de escrita (só leitura).
- `admin` global do SSO = **superusuário** do site (todas as capabilities), independente de `site_users`.
- Mapa **role → capabilities** (constante no site) + middleware `requireCapability(cap)` no backend (estende `requireAdmin`). Capabilities: `edit_posts`, `publish_posts`, `edit_others_posts`, `delete_posts`, `manage_categories`, `upload_files`, `manage_users`, `manage_options`, `manage_curation`, `manage_redirects`.
- Ownership: `posts.author_id` = SSO user id; Autor edita só os próprios (`edit_posts` sem `edit_others_posts`); Contribuidor cria mas sem `publish_posts`.

## T4 — Editor de blocos (estilo Gutenberg)

### Contexto
Requisito firme: UX **de blocos** estilo Gutenberg (inserir "/"+"+", reordenar, barra por bloco), **não** o `wp-editor`. Web search estava fora (erro de modelo do provider) → decisão por conhecimento de referência; **validar versões/HTML round-trip no início da Fase 1**.

### Avaliação
- **BlockNote** (React, sobre ProseMirror/TipTap, MIT): entrega a **UX de blocos pronta** (slash menu, drag handle, side menu, formatting toolbar) — casa direto com "estilo Gutenberg" sem reconstruir a UX. HTML in/out (`blocksToHTMLLossy`/`tryParseHTMLToBlocks`). **Custom blocks** em React (cobre imagem/áudio/vídeo/embed/snippet — R11/R13/R14/R15). Rota admin isola o JS do público.
- **TipTap + camada de blocos própria:** controle total do HTML, mas a UX de blocos é trabalho nosso.
- **Editor.js:** block-native, mas saída JSON (não HTML) → camada de render/sanitize própria.

### Decisão (→ D051)
- **BlockNote** como editor da Fase 1. **Fonte da verdade dupla:** persistir o **documento de blocos (JSON)** do BlockNote (re-edição lossless) **+** o **HTML sanitizado** derivado (`content_html`, consumido pelo SSG/`@artificio/content`). Coluna nova `posts.block_doc JSONB` (migration base) ao lado de `content_html`.
- Posts **importados do WP** (só têm `content_html`): ao abrir no editor, `tryParseHTMLToBlocks` converte HTML→blocos (best-effort); na 1ª gravação passam a ter `block_doc`.
- **Validação obrigatória no T11** (1ª integração): fidelidade HTML de saída, sanitização (R17), tamanho do bundle, custom block de embed. Se a perda HTML do BlockNote for inaceitável p/ algum caso → fallback TipTap+blocos (plano B).

## Resumo das decisões geradas
- **D051** — Editor = BlockNote (JSON block_doc + HTML sanitizado).
- **D052** — Capabilities/roles editoriais no `apps/site` (`site_users`); `packages/auth` intocado.
- **D053** — Pipeline: rebuild atômico (build→temp→swap) p/ zero downtime; preview via render no Express (sem adapter Node).

## Impacto nas migrations base (T5)
Além de `author_id`/`revisions`/`site_users`/OG: adicionar `posts.block_doc JSONB NULL`. Tabelas do hub (`site_settings`/`curation`/`nav_items`/`audit_log`) entram na Fase 3 (T20).
