# Sessão 26-06-06_1 — site / CMS-authoring (spec 011)

- **Spec:** `specs/011-site-cms-authoring/` (spec + plan + tasks)
- **Módulo:** `apps/site` (+ possível `packages/auth`/`packages/ui` → SDD Completo)
- **Origem:** mantenedor pediu paridade WordPress de autoria (inserir/editar posts, slug+sugestão, OG, mídia img/áudio/vídeo, snippets, links, categorias, resumos, arquivar, usuários editores, "tudo que o WP faz") + levantamento/pesquisa → super spec.

## Estado (atualizado 2026-06-06)
- **Spec 010 fechada e no ar** (nav unificado + fix logo neg). `dev`=`origin/dev`=`7f2fbd1`.
- Super spec 011 criada, revisada p/ **portal/hub completo** (área K) e faseada. Apêndice A = paridade WordPress. Escopo reordenado pelo mantenedor: **funcional primeiro (add/editar posts+pages)**; dashboard + roles granulares adiados.
- **Fase 0 (spikes) ✅** → decisões registradas:
  - **D051** editor = **BlockNote** (block-UX Gutenberg, HTML in/out, `block_doc`+`content_html`).
  - **D052** roles/capabilities no `apps/site` (`site_users`), `packages/auth` intocado. *(sistema granular adiado; gate atual = `requireAdmin`.)*
  - **D053** pipeline: rebuild **atômico** (build→`dist.next`→swap, sem downtime) + preview render no Express (sem adapter Astro).
  - **D054** admin = **pacote próprio `apps/site-admin`** no toolchain latest (vite 8 + plugin-react 6 + react 19.2 + router 7 + blocknote 0.51), servido pelo Express em `/admin`. Regra do mantenedor: **sempre versões mais recentes, sem gambiarra**; majors do monorepo (Astro/TS) = decisão à parte.
- **Backend funcional+testado (local):** migration `003_authoring.sql` (block_doc/OG/author_id/sequence) ✅; `db/repo/{posts,pages,taxonomies,redirects}.ts` ✅; `server/lib/content.ts` (slug PT/excerpt/sanitize/toc) ✅; API `/api/admin/v1/*` ✅; preview `/admin/preview/:type/:id` ✅; rebuild atômico `scripts/rebuild.mjs` ✅. Smoke repo via tsx ✅; tsc limpo.
- **SPA admin funcional (local):** `apps/site-admin` (vite 8 build verde) — editor BlockNote + CRUD posts/pages + slug+sugestão + categorias/tags (criação inline) + SEO/OG + publicar→rebuild + preview. Express serve `/admin`. Smoke: `/admin/` 200, API/preview/status **401 sem SSO** (gate ok).
- **Revisão Codex (8 achados) toda corrigida e verificada** (XSS→sanitize-html; 301 servidos via middleware; swap atômico symlink; rebuild server-side no publish; validação de id; taxonomias pré-filtradas; SPA respeita status; pages canonical). + **T12 público** (OG/canonical/noindex no HTML). Detalhe: `handoff-review.md` §Revisão Codex.
- **Nada commitado/deployado.** Deps: +`sanitize-html` (+ admin no `pnpm-lock`).

## Próximos passos (retomar)
1. **T12 público:** `export.ts` + templates Astro emitirem `og_title`/`og_description`/`noindex` (hoje OG vem de title/excerpt).
2. **Fase 2:** biblioteca de mídia + upload Cloudinary (hoje imagem só por URL).
3. **T16 / E2E autenticado:** só no deploy (precisa SSO real) — autorização do mantenedor.
4. Fases seguintes: dashboard (R44), curadoria portal/hub (área K), roles granulares (D052), agendamento/revisões.

## Handoff de revisão
- Inventário completo (arquivos novos/modificados, o que foi verificado, como rodar) em `specs/011-site-cms-authoring/handoff-review.md` — base para a revisão de código do Codex.

## Pendências de verificação
- Fluxo autenticado UI↔API: não testável local (sem cookie SSO); valida no deploy.
- Fidelidade do HTML do BlockNote em conteúdo real (posts WP importados): validar no deploy.
