# Sessao 26-06-17_1 — site / Cloudinary usadas

## Objetivo
Retomar migracao automatizada das imagens usadas do WordPress para Cloudinary, antes de desativar Hostinger.

## Contexto carregado
- T0 lido: `.specify/memory/project-state.md`, `docs/agents/context-capsule.md`, `.specify/memory/decisions.md`.
- T0 companion lido: `specs/backlog-audit-map.md` (arquivo correto; caminho antigo `docs/agents/backlog-audit-map.md` nao existe).
- T1 lido: secoes pedidas de `AGENTS.md`, `docs/agents/infra-map.md`, `docs/agents/deploy-flow.md`, `specs/backlog.md`.
- Regras criticas: WP raiz intocavel; importador so GET/read-only; Cloudinary upload em massa exige aprovacao nominal; VM write/deploy/commit/push exigem aprovacao nominal quando aplicavel.

## Estado inicial
- Branch atual: `infra/026-f5-accounts-deploy-module`.
- Working tree ja esta sujo por trabalho anterior (`project-state`, `AGENTS`, `apps/mesas`, specs/sessoes etc.).
- Backlog relevante: `BL-QA-SITE-IMAGES` pausado; retomar com aprovacao nominal para materializar env/flag `SITE_MIGRATE_MEDIA=true` e executar migracao beta.
- Codigo atual:
  - `apps/site/importer/run.ts` busca posts e pages allow-list via WP REST.
  - `apps/site/importer/media.ts` migra somente URLs recebidas do conteudo importado: featured + `<img src>` em HTML de posts/pages.
  - Sem `SITE_MIGRATE_MEDIA=true`, dry-run mantem URLs WP.

## Plano
- [x] Ler governanca/T0/T1 e backlog.
- [x] Confirmar se o importador migra somente imagens usadas.
- [x] Inventariar, em read-only, quantas URLs WP usadas existem hoje e quantas ja estao em `media_map`.
- [ ] Se faltar comando/relatorio seguro, preparar script local sem upload por padrao.
- [ ] Pedir aprovacao nominal antes de qualquer upload Cloudinary em massa, materializacao de env na VM, deploy, commit ou push.
- [ ] Registrar resultado em `specs/backlog.md`/tasks/project-state conforme impacto.

## Retomada 2026-06-17 — execucao autorizada
- Mantenedor autorizou nominalmente o bloco:
  1. backup local via `pg_dump` read-only do `site-beta-db`;
  2. `SITE_MIGRATE_MEDIA=true pnpm import` no `site-beta-app`;
  3. `pnpm export && pnpm build`;
  4. validar HTTP beta + contagens DB + grep de `wp-content` restante.
- Escopo: `apps/site` beta; WP somente GET/read-only; sem DNS raiz, sem Tunnel, sem WAF, sem WP write.
- Risco/rollback registrado pelo mantenedor: upload parcial/URLs quebradas/cota Cloudinary/DB rewrite incompleto; rollback por dump SQL local exige nova aprovacao nominal para restore.

## Evidencia read-only
- WP REST GET local (sem credencial, sem write): 125 posts + 10 paginas allow-list; 245 imagens unicas usadas; 247 referencias totais.
- VM read-only: containers `site-beta-app` e `site-beta-db` healthy.
- `site-beta-app`: `CLOUDINARY_CONFIG=present`; `SITE_MIGRATE_MEDIA` vazio/desligado; `WP_BASE` setado.
- DB beta read-only:
  - `media_map`: 25 linhas.
  - `media.cloudinary_url IS NOT NULL`: 16 linhas.
  - `media.wp_url IS NOT NULL`: 124 linhas.
  - posts ainda com `wp-content/uploads`: 125.
  - pages ainda com `wp-content/uploads`: 6.

## Execucao one-shot 2026-06-17
- Backup local criado antes da tentativa real:
  - `C:\projetos\artificiobackup\site-cloudinary\site-beta-before-cloudinary-20260617-110311.sql`
  - tamanho: 3.953.515 bytes.
- Baseline imediatamente antes da tentativa:
  - `site-beta-app` e `site-beta-db` healthy.
  - `media_map=25`.
  - `posts_wp=121`.
  - `pages_wp=6`.
  - `posts_total=125`.
  - `pages_total=10`.
  - `media_total=124`.
- Tentativa 1: `docker exec -e SITE_MIGRATE_MEDIA=true site-beta-app pnpm import`.
  - Falhou antes do import por `ERR_PNPM_LOCKFILE_NOT_FOUND`; causa: comando executado no pacote `/repo/apps/site`, mas o lockfile fica em `/repo`.
- Tentativa 2: `cd /repo && pnpm --filter @artificio/site import`.
  - Falhou por colisao com builtin do pnpm: `Unknown option: 'recursive'`.
- Tentativa 3: `cd /repo && pnpm --filter @artificio/site run import`.
  - Import real iniciou com `[import] driver=pg — mídia=Cloudinary (upload)`.
  - Falhou em imagem usada do WP que retorna 404:
    - `https://artificiorpg.com/wp-content/uploads/2025/08/lunatar-rpg-escuridao-eco-floresta-1100x630.webp`
    - slug afetado: `lunatar-rpg-smzinho-colucci`.
  - Confirmado por `curl -I`: HTTP `404`.
  - Pos-falha: `media_map=25`, `cloudinary_map=25`, `posts_wp=121`, `pages_wp=6`; ou seja, nao houve avanco mensuravel de mapeamentos antes da parada.
- Uma tentativa de inventario amplo das URLs via regex/PowerShell falhou por quoting local/SSH antes de produzir resultado util; sem mutacao.

## Bloqueio / achado para planejamento
- A migracao atual aborta no primeiro asset WP ausente. Isso impede o one-shot completo mesmo com Cloudinary configurado e DB beta acessivel.
- Bug/dado quebrado novo: ao menos uma imagem usada no conteudo importado aponta para `wp-content/uploads` inexistente no WP/Hostinger.
- Planejamento recomendado para Claude:
  1. fazer inventario read-only robusto de todas as URLs usadas e seus HTTP status antes do upload;
  2. decidir politica para asset ausente: manter URL WP quebrada e seguir, remover imagem, substituir por original alternativo, ou registrar placeholder;
  3. tornar importador tolerante a 404/erro por asset individual, com relatorio final e sem abortar o lote inteiro;
  4. so depois rodar `SITE_MIGRATE_MEDIA=true pnpm --filter @artificio/site run import`, `pnpm --filter @artificio/site run export`, `pnpm --filter @artificio/site run build`;
  5. validar DB/HTML/HTTP e comparar `wp-content` restante.

## Conclusao parcial
O importador atual ja limita a migracao a imagens usadas: featured + imagens inline de posts + imagens inline das paginas institucionais allow-list. Nao varre a biblioteca inteira do WP. Porem rodar a migracao pelo boot/deploy com `SITE_MIGRATE_MEDIA=true` ja causou incidente historico (502/healthcheck em Spec 011 T18). Para agora, caminho recomendado: comando one-shot controlado no container/VM ou script dedicado com dry-run e batches, depois export/build/smoke.

## Criterio de conclusao desta sessao
Um caminho seguro de migracao fica pronto: relatorio read-only de URLs usadas, comando de dry-run, comando real aprovado (ou bloqueio explicito), e evidencia registrada. Nao declarar migracao concluida sem upload real + reimport/export/build/smoke.

## Backlog
Backlog consultado. Bug novo registrado em `specs/backlog.md`: migracao Cloudinary do site aborta em asset WP usado que retorna 404.

## Links
- Handoff Codex: `sessoes/26-06-17_1_site_cloudinary-codex-handoff.md`.
- Backlog: `specs/backlog.md` (`BL-QA-SITE-IMAGES`).
- PR #49: https://github.com/FarenRavirar/artificio/pull/49

## Project-state
- `BL-QA-SITE-IMAGES`: Fase A/B feitas na branch `fix/site-cloudinary-tolerant-import`; Fase C (`SITE_MIGRATE_MEDIA=true` real, rewrite DB beta e smoke) aguarda nova aprovacao nominal em sessao separada.

## Planejamento Claude 2026-06-17 — handoff Codex
- Causa raiz isolada: `media.ts` `uploadToCloudinary` sem try/catch; `resolveMediaUrl`/`buildMediaMap` nao capturam; erro sobe a `run.ts` `main().catch` → `process.exit(1)`. 1 asset 404 mata lote.
- Insight: 404 e derivado de tamanho (`-1100x630.webp`); original `nome.webp` pode existir. Fallback = strip `-\d+x\d+`.
- Decisoes do mantenedor: (1) politica 404 = fallback original, senao manter URL WP; (2) Fase B escrita pelo Codex via branch+PR.
- Plano 3 fases documentado em `sessoes/26-06-17_1_site_cloudinary-codex-handoff.md`:
  - A inventario read-only (`inventory.ts`, sem upload/write);
  - B endurecer importador (try/catch + fallback + relatorio, nunca throw) via branch+PR;
  - C execucao real so com aprovacao nominal (pg_dump → import → export/build → smoke).
- `BL-QA-SITE-IMAGES` movido `pausado-beta-later` → `bloqueado-planejar` com plano linkado. Sem commit/push/deploy nesta sessao.
