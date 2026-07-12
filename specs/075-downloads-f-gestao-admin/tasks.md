# Tasks — Spec 075 (Downloads-F)

## F0 — Preparação

- [x] T0.1 — Confirmado specs 072 e 074 localmente verdes (validadas na mesma sessão, 56 testes backend + 6 frontend, lint/build limpos).

## F1 — Estrutura de gestão

- [x] T1.1 — Rotas `/gestao/*` implementadas: Visão geral, Moderação, Materiais, Denúncias, Links, Arquivos, Mídias (placeholder — sem dado real), Publicadores (placeholder — sem listagem paginada), Taxonomias (aponta ao Site), Métricas, Auditoria, Configurações.
- [x] T1.2 — `GestaoShell.tsx`: sidebar de recursos agrupada (Conteúdo/Operação/Comunidade/Sistema), contagem por fila via `GET /api/v1/admin/summary`, P0 (denúncia aberta) com ícone ⚠️ além de cor.
- [x] T1.3 — Link "Sistemas e edições" aponta para `VITE_SITE_ADMIN_SYSTEMS_URL` (env, default `site-admin` em `/admin/sistemas`), nunca cópia local.

## F2 — Fila de moderação

- [x] T2.1 — `GestaoModeracaoPage.tsx` lista fila via `GET /moderation/queue` (já existente da 072, só `in_review`).
- [x] T2.2 — Ações batch aprovar/reprovar/arquivar via `PATCH /moderation/batch/:action` (já existente).
- [x] T2.3 — Motivo estruturado obrigatório em reprovação batch (validação client-side + backend já exigia).

## F3 — Auditoria de edição

- [x] T3.1 — `GestaoAuditoriaPage.tsx`: histórico completo por campo via `GET /materials/:id/history` (já existente da 074).
- [x] T3.2 — Histórico completo de links: nova rota `GET /admin/materials/:id/link-history` filtra `download_material_version` por `field_name='external_url'`, mostra TODAS as trocas, não só a atual.

## F4 — Denúncias

- [x] T4.1 — `GestaoDenunciasPage.tsx`: fila via `GET /reports` (já existente da 072), prioridade com ícone (⛔P0/⚠️P1/🔶P2/ℹ️P3).
- [x] T4.2 — Decisão via `PATCH /reports/:id` (já existente) com nota de resolução.

## F5 — Link checker

- [x] T5.1 — `linkChecker.ts`: checagem sob demanda via `POST /admin/materials/:id/check-link` (job agendado real fica fora de escopo — sem infra de scheduler disponível nesta rodada; rota é reusável por scheduler futuro).
- [x] T5.2 — Bloqueio SSRF: rejeita loopback (127.0.0.1/::1), redes privadas (10.x/172.16-31.x/192.168.x), link-local/metadado de nuvem (169.254.169.254, metadata.google.internal), resolve DNS e revalida IP resultante (anti-rebinding), só http/https, sem seguir redirect sem revalidar cada hop.
- [x] T5.3 — `GET /admin/links` expõe status mais recente por material (join com `MAX(checked_at)`); grava em `download_link_check` (já existente desde spec 070).

## F6 — Segurança e métricas

- [x] T6.1 — `sanitizeText.ts`: strip de tags/entidades HTML (equivalente a DOMPurify `ALLOWED_TAGS:[]`), sem nova dependência (decisão nominal do mantenedor — jsdom/isomorphic-dompurify descartado por não haver HTML rico em nenhum campo admin).
- [x] T6.2 — Reforço de magic bytes no fluxo admin: `POST /admin/materials/:id/evidence/upload` reusa `detectAllowedFileType` (já existente da 071) via `express.raw()`, mesmo sem storage real de arquivo conectado (upload real ainda depende de credencial de provider, DEB-073-03/071 T6.2) — decisão nominal do mantenedor: implementar contrato de validação mesmo sem storage real.
- [x] T6.3 — `GET /admin/metrics`: agrega `download_metric_daily` por material; país/dispositivo/horário não coletados no banco (GA4 cobre fora do banco) — nota explícita na resposta.

## F7 — Validação

- [x] T7.1 — lint + build + test: backend 73/73 testes (15 arquivos), frontend 6/6, `tsc --noEmit` limpo nos dois, `eslint` limpo, `vite build` ok, `pnpm verify:api` exit 0 (downloads breaking=0 non-breaking=25, 2026-07-12).
- [x] T7.2 — Teste de SSRF: `linkChecker.test.ts` (7 casos — loopback IPv4/IPv6, rede privada 10.x/192.168.x, metadado de nuvem, protocolo não-http, URL inválida).
- [x] T7.3 — Teste de sanitização XSS: `sanitizeText.test.ts` (4 casos) + `admin.test.ts` (upload magic bytes real/falso, sanitize-preview).

## Extra (fora do plano original, achado durante verificação com o mantenedor)

- [x] Campo estruturado de editora/selo: `publisher_name` em `download_material_metadata` (migration_019), editável no painel (`EditarMaterialPage`), exibido na ficha pública.
- [x] Relacionados por sistema/edição: `GET /materials/:slug` agora expõe `system_id`/`edition_id`/`system_name`/`edition_name` (resolvidos via `catalogClient`); ficha linka para `/catalogo?system_id=`/`?edition_id=`; `CatalogoPage` passou a ler esses filtros da URL.
