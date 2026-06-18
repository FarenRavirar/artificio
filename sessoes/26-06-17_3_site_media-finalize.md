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

## Review PR #53 -> PR #54 (residual filtra status=publish)

Gate B executado (deploy beta `5f6bbeb`); PR #53 mergeado em `dev` (`fb7463d`). CodeRabbit apontou 4o
bug real: `priorResidual`/residual contavam posts/pages de QUALQUER status, mas `db/export.ts` so
publica `status='publish'`. Um `draft`/`trash`/`archived` com `wp-content/uploads` deixava
`priorResidual>0` -> `finalizedStore=false` -> boot dry-run posterior pulava o prune e regravava HTML
cru nos publicados, recriando links mortos.

Fix em PR #54 (branch `fix/site-media-residual-published`): helper unico `servedWpResidual(db)` filtra
`status='publish'` (mesmo predicado do export) e cobre todas as colunas servidas (posts: content_html,
featured_url, og_image, seo_description; pages: content_html, og_image, seo_description). Usado no
snapshot pre-loop (finalizedStore) e na verificacao residual-zero pos-loop -> sem drift de predicado.

Validacoes: test 17/17, build verde, tsc importer 0 erros.

## Execucao gated 2026-06-17 (B' -> D)

- PR #54 mergeado em `dev` (`8ec2203`). Cadeia de review #51->#54 fechada (4 bugs CodeRabbit reais).
- Gate B' (re-deploy beta) verde: run `27718952555`, beta `8ec2203`, HTTP 200, healthz posts=125.
  Boot dry-run validou codigo novo: `pruneMode=false (finalizedStore=false mmap=357 priorResidual=77)`,
  residual `status=publish`, midia preservada (sem wipe). Store: posts_pub_wp=38.
- Gate C (backup): `C:\projetos\artificiobackup\site-cloudinary\site-beta-before-gated-migration-20260617-214044.sql`
  (4.060.250 bytes, dump integro).
- Gate D (import real) ABORTOU -> bug real achado:
  `[import] ERRO: Error in loading <...quem-e-ela...webm> - 403 Forbidden`. Cloudinary nao consegue
  buscar o `.webm` server-side (WP/Cloudflare 403, provavel hotlink). `isFatalCloudinaryError` tinha
  `forbidden` no regex -> tratou 403 do ASSET como credencial fatal -> abortou o lote. Abortou cedo
  (1o post), nada exportado, backup intacto, idempotente.

### Fix (branch `fix/site-cloudinary-remote-load-tolerant` -> PR proprio)

`media.ts isFatalCloudinaryError`: `Error in loading` (carga remota) agora retorna `false` (toleravel),
ANTES dos checks de auth — asset bloqueado por-asset nao mata o lote; vai p/ recordMediaFailure ->
poda do HTML (D074 migra-ou-remove). +2 testes (403/404 remote-load toleravel). test 19/19, build
verde, tsc importer 0 erros. Backlog `BL-SITE-MEDIA-REMOTE-403`: revisar relatorio de podas pos-Gate D;
assets valiosos podem precisar resgate (fetch local + upload buffer, como o caminho AVIF) antes do EOL.

## Investigacao raiz + resgate por bytes (PR #55 estendido)

Mantenedor pediu p/ investigar a raiz do 403 antes de re-rodar (roda 1x, tem que dar certo). Read-only:

Residual real = so 9 assets distintos (repetidos em 38 posts), nao dezenas. Probe nosso fetch (UA browser):
- `.webm` quem-e-ela: 200, **22.6MB**, ct=`text/plain` -> VIVO (Cloudinary fetch 403 por MIME/hotlink).
- 3 `.avif`: 200 ct=`text/plain` -> vivos (path AVIF migra).
- `Jason-Bulmahn-1024x577.jpg.webp`: derivado 404, **original 200 image/webp** -> stripSizeSuffix migra.
- 4 `.webp` (Exemplo-covil, foundry_demo-2, larp-exemplo-1, mesa-presencial-2): 404 p/ todos -> mortos, poda.

Raiz: WP/Hostinger serve esses media com `content-type: text/plain` (MIME errado). O fetch SERVER-SIDE
da Cloudinary rejeita/é bloqueado (403/"Error in loading"); nosso fetch le os bytes (200).

Teste end-to-end ANTES de codar (1 upload controlado no container beta, public_id `_test/twebm`,
deletado depois): fetch local do webm + tempfile + `uploader.upload(resource_type:"video")` ->
**UPLOAD_OK** secure_url, bytes=22607372, fmt=webm, dur=124s. Metodo PROVADO.

Implementado em `media.ts`: `uploadRemoteFileToCloudinary(wpUrl)` (fetch local -> tempfile -> upload
via path com resource_type image/video/raw, limite 100MB, unlink no finally) + `__setRemoteFileForTest`.
Wired no `uploadWithFallback` apos AVIF/stripSizeSuffix e antes de podar. Resultado previsto no Gate D:
migra webm + 3 avif + Jason; poda so os 4 webp mortos. +3 testes (resgate ok / morto poda / fatal
propaga) + beforeEach stub p/ nenhum teste tocar rede. test 22/22, build verde, tsc importer 0 erros.

## Gate B''/D(re-run)/E/F — migracao COMPLETA 2026-06-17

- PR #55 mergeado em `dev` (`921fd10`). Gate B'' (re-deploy beta) verde: beta `921fd10`, resgate no
  container, HTTP 200.
- Gate D re-run (`SITE_MIGRATE_MEDIA=true`) NAO abortou: `pruneMode=true`, `migradas=39 falhas=12
  removidas_html=12`, **RESIDUAL servido posts=0 pages=0 ✓ ZERO**.
  - Migrou: webm (video, 22.6MB, ambos forms ?_=1), 3 avif (image), + featured/inline residuais.
  - Podou 12: 5 webp/img mortas (404), 1 Jason-Bulmahn avatar (original vivo p/ nos mas resgate
    buscou o derivado 404 -> gap menor), **6 PDFs valiosos 16-22MB** bloqueados pelo limite RAW 10MB
    do Cloudinary free ("File size too large ... Upgrade your plan").
- Backup local dos 6 PDFs + Jason (read-only GET, antes do EOL):
  `C:\projetos\artificiobackup\site-cloudinary\rescued-pdfs\` (104MB, 7 arquivos, todos HTTP 200).
- Decisao do mantenedor: hospedar os PDFs NA VM via futura feature de upload/gestao de midia dentro do
  beta (estilo FileBird) -> `BL-SITE-VM-MEDIA-LIBRARY` (mantenedor detalha em prompt proprio). E
  finalizar export/build agora.
- Gate D final: `export` (125 posts, 10 pages) + `build` (220 pages, Pagefind 125) OK.
- Gate E verde: dist grep `wp-content/uploads` = **0 arquivos / 0 ocorrencias**; live home grep = 0;
  post do webm serve `res.cloudinary.com/.../video/upload/...webm`; HTTP home/post/page 200; healthz 125.

### Resultado

Dependencia WP no conteudo SERVIDO do site = **ZERO** (store + dist + live). webm/avif/imagens vivas
migradas p/ Cloudinary; so assets mortos (404) e 6 PDFs grandes (salvos, a re-hospedar na VM) foram
removidos do HTML. Idempotente: futuros boots dry-run detectam `finalizedStore=true` (mmap>0 +
residual 0) e mantem o prune; store permanece zero.

### Backlog (Gate F)

- `BL-QA-SITE-IMAGES` -> FECHADO (imagens usadas migradas; residual servido 0).
- `BL-SITE-AVIF-FAIL` -> FECHADO (3 avif migradas via resgate/AVIF path).
- `BL-SITE-MEDIA-REMOTE-403` -> FECHADO (raiz=MIME text/plain; resgate por bytes migrou webm).
- `BL-SITE-MEDIA-ERR-SERIAL` -> FECHADO (mergeado no PR #50).
- `BL-SITE-NONIMG-MEDIA` -> parcial: webm migrado; 6 PDFs pendentes de re-host -> `BL-SITE-VM-MEDIA-LIBRARY`.
- Novos: `BL-SITE-VM-MEDIA-LIBRARY` (feature de midia na VM + re-host dos 6 PDFs salvos),
  `BL-SITE-RESCUE-STRIPPED` (resgate por bytes deveria tentar tambem a URL stripped; Jason avatar).

## Operacional pendente

Pos WP EOL (~2026-06-20): setar `SITE_IMPORT_ON_START=false` no beta (store canonico, importador
descartavel D005) — senao boot dry-run re-fetch do WP morto falha. Enquanto WP vivo, import-on-start
e idempotente (finalizedStore mantem residual 0).
