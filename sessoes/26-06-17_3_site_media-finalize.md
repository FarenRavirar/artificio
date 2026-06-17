# Sessao 26-06-17_3 — site media finalize (BL-QA-SITE-IMAGES + BL-SITE-NONIMG-MEDIA)

Data: 2026-06-17
Modulo/projeto: `apps/site` (importador descartavel)
Gate: Codigo (Gate A do plano de finalizacao); WP raiz/DNS fora de escopo

## Objetivo

Zerar dependencia WP no conteudo do site antes do EOL ~2026-06-20 (D074): importador captura midia
NAO-imagem, aplica politica remover-ao-falhar e prova residual-zero.

## T0/T1 lidos

`project-state.md`, `context-capsule.md`, `decisions.md` (D074), `specs/backlog.md`
(BL-QA-SITE-IMAGES, BL-SITE-NONIMG-MEDIA, BL-SITE-AVIF-FAIL, BL-SITE-MEDIA-ERR-SERIAL),
`infra-map.md`, `deploy-flow.md`, sessoes `26-06-17_1_*codex-handoff` + `26-06-17_2_*real-migration`.

## Estado de partida

- PR #49 (importador tolerante) e PR #50 (AVIF->WebP + serializa erro) ja mergeados em `dev` (`9589922`).
- Fase C real rodou: migradas=332, falhas=9. Residual: 58 URLs WP em posts (maioria nao-imagem
  `.ogg/.mp3/.pdf/.webm` + 9 imagens: 6 HTTP 404, 3 AVIF cobertos pelo PR #50).

## Codigo (branch `fix/site-media-finalize`, base `dev`)

`apps/site/importer/media.ts`:
- `extractMediaUrls(html)`: toda ref `/wp-content/uploads/` em `href/src/poster` (`<a>`, `<audio>`,
  `<video>`, `<source>`), nao so `<img>`.
- `mediaResourceType(url)`: image / video (inclui audio mp3/ogg) / raw (pdf/zip/doc).
- `uploadToCloudinary` passa `resource_type` correto; `raw` mantem extensao no `public_id`.
- `pruneWpAssets(html)`: remove player de midia WP, desembrulha `<a>` (preserva texto), remove
  `<img>/<source>` WP, e remove QUALQUER ref WP restante -> zero por construcao. Retorna lista p/ relatorio.
- `recordPruned` + campo `pruned` no `MediaReport`.

`apps/site/importer/run.ts`:
- posts+pages: migra featured + og_image + img + nao-imagem; pos-rewrite -> `pruneWpAssets`.
- `cleanMapped()`: featured/og que nao migrou vira `null` (nunca URL WP servida).
- Relatorio `migradas/falhas/removidas_html`; seção RESIDUAL WP (servido) via SQL conta
  wp-content em posts (content_html/featured_url/og_image/seo) + pages -> prova residual-zero in-process.

`apps/site/importer/media.test.ts`: +9 testes (extract nao-imagem, resource_type, pruning incl.
`<a>` envolvendo `<img>`, migra pdf/mp3).

### Politica residual-zero (Gate F)

Criterio "zero wp-content no store" aplicado a colunas SERVIDAS (posts.content_html/featured_url/
og_image/seo, pages.content_html) + dist exportado. `media_map.wp_url` e `media.wp_url` sao chaves
de idempotencia (nao servidas), fora do criterio; documentado no log RESIDUAL.

## Validacoes locais

```text
pnpm --filter @artificio/site test  -> 17/17
pnpm --filter @artificio/site build -> verde (220 pages, Pagefind)
pnpm --filter @artificio/site lint  -> stub TODO
tsc --noEmit importer (run/media)   -> 0 erros
```

## Bug pre-existente investigado (a pedido do mantenedor)

`server/admin-api.ts:220` `error TS2345`: multer `upload.single("file")(req,res,cb)` — route handler
infere `Request<{}>`, multer espera `RequestHandler<ParamsDictionary>`. Variancia de tipo conhecida.
ZERO impacto operacional: nao esta no gate CI (`import`/`export` via `tsx` sem typecheck; `build`=astro
so frontend; `lint`=stub; sem script `typecheck`); runtime executa normal. Origem `e7d737a` (T18).
Registrado `BL-SITE-ADMIN-TS-VARIANCE` (baixo).

## Backlog

- `BL-QA-SITE-IMAGES` segue `parcial-beta`; codigo de finalizacao pronto em branch (nao mergeado).
- `BL-SITE-NONIMG-MEDIA` enderecado pelo codigo desta sessao (migra nao-imagem + prune); fecha apos
  Fase C real (Gates B-F do plano) provar residual-zero.
- Novo: `BL-SITE-ADMIN-TS-VARIANCE` (cosmetico).

## Gate A fechado + fix review (PR #51 -> PR #52)

PR #51 mergeado em `dev` (`3c2cd2a`). CodeRabbit apontou 2 bugs reais no `run.ts`; corrigidos em
PR #52 (branch `fix/site-media-dryrun-guard`):

1. **Dry-run apagava mídia (CRITICO).** `docker-entrypoint.sh` roda `pnpm run import` todo boot
   (`SITE_IMPORT_ON_START` default true) SEM `SITE_MIGRATE_MEDIA` => dry-run. O prune + `cleanMapped`
   removiam toda mídia WP do HTML e zeravam featured/OG => deploy normal sobrescreveria o store com
   posts sem imagem/áudio/PDF. Fix: `finalizing = mediaMigrationEnabled()`; prune e nulling de
   featured/OG só ocorrem em finalização. Dry-run preserva URL WP (comportamento antigo).
2. **Residual só logava warning.** Agora, em finalização, residual servido > 0 seta `exitReason` e o
   import sai com código 1; `set -e` do entrypoint aborta o `rebuild`, impedindo publicar HTML com
   URL WP. Em dry-run residual > 0 é esperado e NÃO falha (senão o boot normal entraria em crash-loop).

Validacoes: `test` 17/17, `build` verde, `tsc` importer 0 erros. Sem teste unitario para o gating do
`run.ts` (script com main()/db, sem scaffold); coberto por revisao + pruneWpAssets/cleanMapped testados.

## Gate B fechado + review PR #52 -> PR #53

Gate B (deploy beta) verde: run `27715665207` exit=0, beta head `5f6bbeb`, containers healthy,
HTTP home/post/page 200, healthz posts=125. Prova do fix #52: boot rodou import dry-run e NAO apagou
midia (store posts_wp=38 preservado, featured_wp=0, media_map=357 intacto).

CodeRabbit apontou 3o bug real no PR #52: apos a finalizacao, um boot dry-run posterior
(`SITE_IMPORT_ON_START` default true, WP ainda vivo pre-EOL) re-importa HTML cru do WP e DESFAZ o
prune, republicando links wp-content mortos (gate `finalizing=false` pulava o prune).

Fix em PR #53 (branch `fix/site-media-finalized-state`): pruneMode auto-detecta estado finalizado.
`pruneMode = finalizing || finalizedStore`, onde `finalizedStore = media_map>0 AND residual servido
stored == 0` (snapshot pre-loop). Assim:
- pre-migracao (media_map vazio): pruneMode falso, dry-run preserva URLs WP vivas (sem regressao #52);
- pos-finalizacao: dry-run re-detecta finalizado, segue podando os mortos e mantendo Cloudinary do
  media_map -> store permanece zero, idempotente, sem clobber;
- residual-fail tambem passa a valer em pruneMode (nao so finalizing).
Sem env nova, sem migration. `finalizing` ainda controla upload + check migrated==0.

Validacoes: test 17/17, build verde, tsc importer 0 erros.

## Proximo

Apos PR #53 verde+merge: re-deploy beta (Gate B') p/ subir o pruneMode, depois Gates C (backup pg_dump),
D (re-import real SITE_MIGRATE_MEDIA=true), E (smoke + residual-zero), F (registro/fechamento) — cada um
com aprovacao nominal. Operacional pos-Gate D: avaliar `SITE_IMPORT_ON_START=false` no beta apos WP EOL
(importador descartavel, D005; store vira canonico).
