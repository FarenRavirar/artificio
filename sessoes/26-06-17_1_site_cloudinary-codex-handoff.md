# Handoff Codex — migração Cloudinary segura (BL-QA-SITE-IMAGES)

> Investigação feita por Claude 2026-06-17. Codex executa Fase A (inventário) + Fase B
> (endurecer importador) via branch + PR. Fase C (execução real) só com aprovação nominal
> do mantenedor. WP raiz é GET/read-only; nunca write em WP/DNS/Tunnel/WAF/VM sem aprovação.

## Execucao Codex 2026-06-17
- T0 lido: `project-state.md`, `context-capsule.md`, `decisions.md`, `specs/backlog.md`, este handoff.
- Escopo aceito: executar somente Fase A e Fase B.
- Nao executar Fase C: sem `SITE_MIGRATE_MEDIA=true`, sem upload Cloudinary, sem DB write beta, sem deploy.
- Branch criada: `fix/site-cloudinary-tolerant-import`.
- Worktree inicial ja estava sujo por outras frentes (`apps/mesas/*`, docs/specs/sessoes). Esta execucao vai tocar somente `apps/site/*`, artifact de inventario e docs deste BL.

### Fase A — resultado
- Implementado `apps/site/importer/inventory.ts`.
- Script adicionado: `pnpm --filter @artificio/site run inventory`.
- Execucao read-only concluida (WP REST GET + HEAD/GET de imagens; zero DB/Cloudinary/WP write):
  - `total=366`
  - `status200=338`
  - `status404=28`
  - `outros=0`
  - `derivados404ComOriginal200=22`
- Artifact gerado:
  - `artifacts/cloudinary/inventory-2026-06-17T14-21-49-005Z.json`

### Fase B — resultado local
- Implementado `apps/site/importer/pages.ts` para fonte unica da allow-list D046.
- `apps/site/importer/media.ts`:
  - `stripSizeSuffix(wpUrl)`;
  - fallback para URL original sem `-\d+x\d+`;
  - falha por asset individual registra `{ wpUrl, motivo }`, nao grava `media_map`, nao reescreve, retorna URL WP original e continua;
  - sucesso do fallback grava `media_map` com chave da URL WP original de entrada;
  - relatorio em memoria com `getMediaReport()`/`resetMediaReport()`.
- `apps/site/importer/run.ts`:
  - aborta cedo se `SITE_MIGRATE_MEDIA=true` sem config Cloudinary;
  - imprime `=== MÍDIA === migradas=N falhas=M` + lista de falhas;
  - erro de asset individual nao chega mais ao `main().catch`.
- Testes adicionados em `apps/site/importer/media.test.ts`:
  - `stripSizeSuffix` com/sem sufixo e query string;
  - tolerancia a falha individual;
  - fallback original grava `media_map` usando a chave da URL de entrada.
- Validacoes locais:
  - `pnpm --filter @artificio/site run inventory` verde.
  - `pnpm --filter @artificio/site lint` verde (`lint TODO` existente).
  - `pnpm --filter @artificio/site test` verde: 5 testes.
  - `pnpm --filter @artificio/site build` verde.
- Nao executado: Fase C / `SITE_MIGRATE_MEDIA=true` real, export/build no container beta, deploy, DB write.
- Backlog atualizado: `BL-QA-SITE-IMAGES` -> `em-execucao`.

### Pendente operacional
- Commit/push/PR base `dev` ainda exigem aprovacao nominal por acao, conforme AGENTS/D073.
- Depois do PR/checks/merge, Fase C exige nova aprovacao nominal antes de qualquer upload real/DB rewrite.

## Causa raiz do incidente 2026-06-17
- `apps/site/importer/media.ts` `uploadToCloudinary` (linha ~68) chama
  `cloudinary.uploader.upload(wpUrl)`; Cloudinary baixa a URL server-side.
- Asset 404 → exception. `resolveMediaUrl` (~79) e `buildMediaMap` (~96) **não capturam**.
- Erro sobe até `run.ts` `main().catch` → `process.exit(1)`. **1 asset 404 mata o lote inteiro.**
- Asset que parou: `https://artificiorpg.com/wp-content/uploads/2025/08/lunatar-rpg-escuridao-eco-floresta-1100x630.webp` (404). Slug `lunatar-rpg-smzinho-colucci`.

## Insight: 404 é derivado de tamanho, não original
- WP nomeia derivados `nome-LARGUxALTU.ext` (ex.: `...-1100x630.webp`).
- Hostinger pode ter purgado o derivado e mantido o original `nome.webp`.
- Política aprovada: ao 404, tentar **fallback original** (strip `-\d+x\d+` antes da extensão) 1×;
  se ainda falhar, **manter URL WP original** no HTML e registrar a falha. Nunca abortar lote.

---

## Fase A — inventário read-only (faça primeiro; zero upload, zero write)
Objetivo: saber quantas das ~245 URLs usadas estão 200 / 404 / outro, ANTES de gastar cota.

Entregar `apps/site/importer/inventory.ts`:
- Reusa `fetchAll` (já é GET WP read-only) para posts + pages allow-list (mesma allow-list de `run.ts`, `PAGES_ALLOW`).
- Para cada post/page: `featured` + `extractImageUrls(sanitize(content))`.
- Dedup URLs únicas. Para cada: `fetch(url, { method: "HEAD" })`; se HEAD não-200, refazer `GET` (alguns hosts não respondem HEAD).
- Computar `isDerivado = /-\d+x\d+\.[a-z0-9]+$/i.test(url)` e a `urlOriginal` candidata.
- Saída em `artifacts/cloudinary/inventory-<data>.json` + resumo no stdout:
  `total / status200 / status404 / outros / derivados404ComOriginal200`.
- **Não tocar DB. Não tocar Cloudinary. Não escrever em WP.**
- Script roda: `pnpm --filter @artificio/site run inventory` (adicionar npm script).

Critério Fase A: relatório gerado e commitado o artifact (ou colado na sessão), com contagem real de 404.

---

## Fase B — endurecer importador (branch + PR; aprovação nominal p/ commit/merge)
Branch sugerida: `fix/site-cloudinary-tolerant-import`.

### B1. `media.ts`
- Nova fn `stripSizeSuffix(wpUrl)`: remove `-\d+x\d+` imediatamente antes da extensão. Retorna candidato original.
- `resolveMediaUrl`: envolver `uploadToCloudinary(wpUrl)` em try/catch:
  1. tenta upload `wpUrl`;
  2. on erro → tenta `uploadToCloudinary(stripSizeSuffix(wpUrl))` (só se diferente);
  3. on erro de novo → **NÃO grava media_map, NÃO reescreve**, retorna a `wpUrl` original e empurra `{ wpUrl, motivo }` num acumulador de falhas exportado. `continue` (nunca throw).
- Sucesso do fallback: grava `media_map` com chave = `wpUrl` ORIGINAL (não o stripped) → idempotência preserva reescrita correta do HTML.
- Expor `getFailures()` / resetar por execução.

### B2. `run.ts`
- Ao fim de `main`, imprimir `=== MÍDIA ===` com `migradas=N falhas=M` + lista das falhas.
- **Não** `process.exit(1)` por falha de asset individual — só por erro fatal de infra (DB/WP REST down, Cloudinary config ausente com `SITE_MIGRATE_MEDIA=true`).

### B3. Testes
- Unit em `stripSizeSuffix` (com/sem sufixo, .webp/.jpg, query string).
- Teste de tolerância: mock upload que joga em 1 URL → import completa, falha registrada, demais migradas.

Critério Fase B: `pnpm --filter @artificio/site build` + testes verdes; PR aberto base `dev`,
check `lint + build + test` verde. Sem deploy.

---

## Fase C — execução real (SÓ com aprovação nominal do mantenedor, igual bloco autorizado antes)
1. `pg_dump` local read-only do `site-beta-db` (backup antes).
2. `docker exec` no `site-beta-app`, `cd /repo && SITE_MIGRATE_MEDIA=true pnpm --filter @artificio/site run import`.
3. `pnpm --filter @artificio/site run export` + `run build`.
4. Smoke: HTTP beta 200; contagens DB (`media_map`, `media.cloudinary_url`, posts/pages com `wp-content`);
   grep `wp-content/uploads` restante; revisar relatório `falhas=M`.
5. Registrar resultado em `specs/backlog.md` + `project-state.md`.

## Restrições pétreas (todas as fases)
- WP raiz: só GET. DNS/Tunnel/WAF/VM write/deploy/commit/push/merge: aprovação nominal por ação.
- Importador é código descartável pós-Gate C, mas ainda entra por branch + PR (D072/D073).
- Bug 404 já registrado em `specs/backlog.md` (BL-QA-SITE-IMAGES = `bloqueado-planejar` → vira `em-execucao` ao iniciar Fase A).
