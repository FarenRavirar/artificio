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
- **Fase 1 commitada e deployada no beta:** commit `a24f187` em `dev`; `beta.artificiorpg.com/admin/` serve a SPA; `/admin/status` e `/api/admin/v1/*` retornam 401 sem sessão; público 200; WP raiz intocado. Falta validação E2E autenticada do mantenedor.
- **Backend funcional:** migration `003_authoring.sql` (block_doc/OG/author_id/sequence) ✅; `db/repo/{posts,pages,taxonomies,redirects}.ts` ✅; API `/api/admin/v1/*` ✅; preview stateless ✅; rebuild atômico/coalesced ✅; redirects públicos ✅.
- **SPA admin funcional:** `apps/site-admin` (vite 8) — editor BlockNote + CRUD posts/pages + slug+sugestão + categorias/tags inline + SEO/OG/canonical/noindex + publicar→rebuild + preview stateless. Express serve `/admin`.
- **Revisões Codex:** 2 rodadas, 13 achados, todos corrigidos/verificados. Detalhe: `handoff-review.md` §§Revisão Codex.
- **Checkpoint de produto:** Fase 1 é MVP técnico funcional, não paridade WordPress. Serve para provar arquitetura e permitir autoria básica por admin técnico; ainda não é fluxo editorial confortável.
- **Bug SSO pós-deploy:** login cross-subdomínio corrigido pelo Opus em `612189c`; patch local posterior troca botão público "Entrar" por "Admin"/"Conta" quando `/api/auth/me` reconhece sessão e amplia CORS accounts para ápice futuro + subdomínios. Commit/deploy desse patch ficam com Opus.

## Atualização 2026-06-08 — T16 validado (local) + T17 implementado (Claude executa, Codex valida)
- **Retomada pela Spec 011** conforme `docs/agents/claude-next-prompt.md`. Mantenedor: Claude executa, Codex valida/arquiteta. Commit/push/deploy seguem exigindo aprovação por ação.
- **T16 (núcleo) validado LOCAL** com server `tsx server/server.ts` + pglite + token admin HS256 (`JWT_SECRET` local, `Authorization: Bearer`): gate 401/200; criar draft; preview stateless (`noindex` + `<script>` sanitizado); preview persistido; **rebuild/SSG completo verde** (astro 219 arquivos + pagefind 125 + swap atômico junction no Windows). Smoke beta público OK; WP raiz intocado. **Falta:** E2E com login Google real no beta = mantenedor (sessão SSO não-forjável, sem `JWT_SECRET` prod local).
- **Bug achado e corrigido:** publicar via `POST /posts/:id/status` não carimbava `published_at` → export gerava `date:""` → `@astrojs/rss` `validateRssOptions` abortava o build inteiro. Fix em `setPostStatus`/`setPageStatus` (carimba `now()` quando publica e está nulo) + RSS endurecido (ignora item com data inválida).
- **T17 implementado** (apps/site + apps/site-admin):
  - Backend: `getPostStatus`/`deletePost` (limpa `post_taxonomies`, preserva `redirects`), `getPageStatus`/`deletePage`; `DELETE /posts/:id` e `/pages/:id` só de `trash` (409 `must_trash_first`); `maybeRebuild(new, prev)` com prev real.
  - Frontend: PostsList/PagesList com filtro de status + ações por item (publicar/despublicar/arquivar/lixeira/restaurar/apagar c/ confirm) + toast; PostEditor/PageEditor com slug live-check + aviso 301, `scheduled`/`private` desabilitados, campos OG (`og_title`/`og_description`/`twitter_card`) + avisos honestos de `noindex`.
- **Validação:** `pnpm --filter @artificio/site exec tsc --noEmit` ✓; `pnpm --filter @artificio/site-admin build` (vite 8) ✓; harness `scripts/t17-validate.ts` 15/15 ✓; smoke HTTP guards (401/403/409/200/404) ✓.
- **Não commitado/deployado.** `.pgdata` local foi recriado via `pnpm sync` (paridade 125/125) após corrupção por kill de processo durante o E2E; seeds `src/data/*.json` revertidos ao commitado. Arquivos alterados: `apps/site/db/repo/{posts,pages}.ts`, `apps/site/server/admin-api.ts`, `apps/site/src/pages/rss.xml.ts`, `apps/site/scripts/t17-validate.ts` (novo), `apps/site-admin/src/{api.ts,styles.css,pages/{PostsList,PagesList,PostEditor,PageEditor}.tsx}`.
- **Para o Codex revisar primeiro:** (1) semântica de delete só-de-trash + preservação de redirects; (2) gatilho de rebuild `maybeRebuild(new, prev)` (antes assumia prev=`publish` fixo); (3) honestidade de `noindex` vs sitemap (hoje só meta tag; remoção real do sitemap quando sai de publish — confirmar se basta ou precisa filtro no sitemap integration); (4) `scripts/t17-validate.ts` é descartável ou vira teste de verdade.

## Próximos passos (retomar)
1. **T16 / E2E autenticado:** mantenedor validar no ar: logar como admin SSO, abrir `/admin`, criar/editar post/página, preview stateless, publicar e confirmar rebuild.
2. **Fase 2A — operações editoriais básicas + publicação honesta:** editar existente com fluxo confiável, publicar/despublicar, arquivar, mover para lixeira, restaurar e apagar permanentemente com confirmação; rebuild quando conteúdo publicado sai do público; slug com colisão/301 visíveis; `scheduled`/`private` sem falsa promessa; `noindex` coerente com sitemap; OG editável/fallback visível.
3. **Fase 2B — mídia:** biblioteca/upload Cloudinary, metadados alt/legenda/dimensões, seletor para featured/OG/imagem inline. Sem instalar ferramentas novas na VM antes de necessidade concreta; considerar `multer`/`busboy` + `file-type` no backend.
4. **Fase 2C/4 — lista editorial:** filtros server-side, paginação, ordenação, bulk actions, quick edit.
5. **Workflow:** agendamento real, autosave, revisões/restaurar.
6. **Roles granulares (D052):** `site_users`/capabilities no `apps/site`, sem tocar `@artificio/auth`.
7. **Portal/operação:** dashboard (R44), curadoria portal/hub (área K), redirects UI e auditoria.

## Handoff de revisão
- Inventário completo (arquivos novos/modificados, o que foi verificado, como rodar) em `specs/011-site-cms-authoring/handoff-review.md` — base para a revisão de código do Codex.

## Estudo pós-deploy — funcionalidade mínima vs WordPress
- **Conclusão:** o admin está minimamente funcional para autoria técnica de posts/páginas, mas não deve ser considerado paridade WordPress. A tela atual vista pelo mantenedor (lista simples + botão "+ Novo post") é esperada para Fase 1, porém insuficiente para administrar o acervo como no WP.
- **Correção do estudo:** a primeira versão do checkpoint pulou básicos: antes de mídia, o admin precisa permitir administrar lifecycle do conteúdo como WP (editar existente, despublicar, arquivar, lixeira, restaurar, apagar permanente), e a publicação precisa ser honesta (slug/status/noindex/sitemap/OG sem semântica parcial escondida). Auditoria não substitui essas ações; ela só registra ações que já existem.
- **Bloqueio principal imediato:** operações editoriais básicas por item + publicação honesta. Sem isso, a área admin só edita/publica parcialmente; não administra o acervo.
- **Bloqueio principal seguinte:** mídia. Sem upload/biblioteca/seletor/alt, o editor ainda depende de URL manual e não fecha o fluxo "criar post completo sem sair do admin".
- **Bloqueios secundários:** lista editorial completa, scheduled real, autosave/revisões, roles, dashboard/build status, curadoria, redirects UI, auditoria.
- **Registro feito antes de nova implementação:** `spec.md` ganhou R3a/R4a/R4b/R4c e CA2b/CA2c; `plan.md` ganhou Fase 2A de operações editoriais básicas + publicação honesta; `tasks.md` colocou T17 como lifecycle/slug/status/SEO antes de mídia; `handoff-review.md` ganhou checkpoint pós-deploy corrigido.

## Pendências de verificação
- Fluxo autenticado UI↔API: validar no deploy com cookie SSO real.
- Fidelidade do HTML do BlockNote em conteúdo real (posts WP importados): validar no deploy.
- Patch SSO pós-login: Opus precisa commitar/deployar e mantenedor validar no browser real.

## CI/security review pós-PR (2026-06-06)
- **pr-checks falhou em `enforce-migration-dir`:** causa = migrations do site em `apps/site/db/migrations/{001,002,003}.sql`; gate só permitia `apps/*/database/`. Correção local: `.github/migration-dir-allowlist` agora aceita também `apps/*/db/migrations/`; `_enforce-migration-dir.yml` mensagem de erro ficou genérica para diretórios allowlisted.
- **Amazon Q security review:** corrigidos localmente os achados procedentes/defensivos:
  - importador usa `cleanHtml()` allowlist em vez de regex (`apps/site/importer/sanitize.ts`);
  - `withToc` escapa atributo `id`;
  - preview sanitiza explicitamente no endpoint e já sanitizava em `renderPreviewFromContent`;
  - redirects manuais aceitam só caminhos internos (`/...`, sem `//` e sem CR/LF);
  - `express.json({ limit: "10mb" })`;
  - Pool PG com `connectionTimeoutMillis: 30000`;
  - `setPostTaxonomies` virou uma statement CTE com lock do post, evitando janela DELETE+INSERT.
- **Validação local:** `pnpm --filter @artificio/site exec tsc --noEmit` ✅; `pnpm --filter @artificio/site build` ✅; smoke `setPostTaxonomies(-1, [], [])` ✅; reprodução local da allowlist contra `origin/main...origin/dev` permite os 3 SQL do site ✅.
