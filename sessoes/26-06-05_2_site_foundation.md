# Sessão 26-06-05_2 — Módulo `site` (fundação, spec 008)

- **Data:** 2026-06-05 · **Módulo:** `site` (+ `packages/content`, `packages/analytics`) · **Gate:** D site (Gate C adiado)
- **Objetivo:** levantamento + decisão + documentação estratégica do módulo `site` (portal+blog) — maior risco/valor (blog WP). "Para não se perder" (D044). Spec antes de código.

## Contexto de entrada
- Fase 3 em curso. mesas/accounts no ar; esteira beta (D041/spec 005) pronta. `packages/{config,auth,ui}` prontos.
- Tarefa: construir o módulo `site` saindo do WordPress (`artificiorpg.com`), começando como `beta.artificiorpg.com`. WP raiz intocável até Gate C.

## Levantamento (recon READ-ONLY do WP via REST)
- **Risco re-dimensionado p/ BAIXO.** 125 posts (não 300+), HTML **Gutenberg limpo** (zero Elementor/shortcode/inline nos posts), **Yoast meta** completo via REST, 1 autor, 13 categorias aninhadas, 69 tags, 25 comentários, 485 mídia.
- WP é **multi-módulo**: guarda `definicao`(163, glossário), `magia`(328, esferas), `docs`(17, downloads) → fora do escopo `site`.
- Posts em `/blog/<slug>/`; pages institucionais na raiz. 30 pages: ~12 do site, resto de mesas/woo/outros módulos.
- Inventário durável: `docs/agents/wp-content-inventory.md`.

## Decisões da sessão (→ D044–D047)
- **D044** — site só em `beta.artificiorpg.com` por ora; sem staging dedicado; fase = levantamento/decisão/doc (não pressa de código).
- **D045** — importador = WP REST API (não dump SQL); read-only sobre o WP; idempotente por slug; mídia on-demand.
- **D046** — escopo = post(125)+taxonomias+mídia+pages filtradas+comentários(25); CPTs de outros módulos fora.
- **D047** — preservar permalink `/blog/<slug>/`; mapa 301 preparado, ativa só no cutover (Gate C); sitemap/robots/JSON-LD via `packages/content`.

## Plano
Spec `008-site-foundation` (spec/plan/tasks). Fundação + 7 fases: F1 doc (✅) → F2 store → F3 importador (agente `wp-importer`) → F4 SSG+rebuild → F5 `packages/content` → F6 `packages/analytics` → F7 deploy beta + Gate D. Fases grandes podem virar specs-filhas. Codex executa; Opus valida por Gate D; `seo-usability-auditor` = gate SEO.

## Log
- 2026-06-05 — Tier 0 lido. Recon WP (REST) → números reais + inventário (`wp-content-inventory.md`). Risco baixo (125 posts, Gutenberg limpo, Yoast presente).
- 2026-06-05 — 4 decisões resolvidas com o mantenedor → D044–D047 gravadas. Steer: agora é levantamento/decisão/doc estratégica.
- 2026-06-05 — Spec 008 criada (spec/plan/tasks) + sessão + inventário. F1 (fundação) concluída.
- 2026-06-05 — Mantenedor: Codex pausado (créditos), **Opus executa**. Pediu opções framework/template/funcionalidade. `template-options.md` escrito; escolhas → **D048** (Astro + híbrido A+B + core completo). Web search/fetch indisponíveis na sessão (backend haiku caído) — opções do conhecimento, re-verificar nomes de tema antes de scaffoldar produção.
- 2026-06-05 — Protótipo estático (`C:\projetos\site-proto`, conteúdo WP real 8 posts, marca real) — **aprovado** (desktop). Portado p/ `apps/site` Astro: install OK (231 pkgs), build verde (10 páginas+sitemap), paridade confirmada via preview. Etapa-1 zero-JS (`.astro` header/footer reusam CSS @artificio/ui). Próximo: Etapa-2 (Header island + Pagefind + arquivos + RSS) e/ou F2 store + F3 importer. Aguarda decisão de commit.

## Bloqueios / aprovações pendentes
- F2+ aguardam o mantenedor liberar passar de "documentação" p/ execução de código.
- T20/T21 (deploy beta) = secrets/VM/DNS/Tunnel → ação mantenedor/Codex.
- Re-confirmar recon volátil (T5) na véspera do import real (F3).
