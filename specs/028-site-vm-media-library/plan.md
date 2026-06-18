# Plano — 028 Biblioteca de mídia na VM

> Plano técnico. Construir só após aprovação (SDD Completo). Contexto rico vem da sessão `26-06-17_3`.

## Arquitetura da solução

Estender a infra de mídia já existente, sem reinventar:

- **Hoje:** `apps/site/server/lib/media-store.ts` → `storeUpload(buffer, ext)`:
  - Cloudinary se configurado (`folder: artificio/uploads, resource_type: auto`);
  - senão grava em `UPLOADS_DIR = SITE_UPLOADS_DIR || apps/site/uploads` e serve via `express.static("/uploads")` (`server.ts:147`) — **efêmero**.
- **Admin:** `apps/site/server/admin-api.ts` já tem `GET /media` (lista) e `POST /media` (multipart, valida MIME real via `file-type`/magic bytes, `ALLOWED_MIME`, `storeUpload` → tabela `media`/`Media.createMedia`). Protegido por `requireAuth`+`requireAdmin` (SSO).

Mudanças:

1. **Destino por tipo:** introduzir uma decisão explícita de backend de storage. Arquivos "download/grande" (pdf/zip e/ou acima de um limite) → **VM persistente**; imagens/vídeo de post → Cloudinary (como hoje). Pode ser um parâmetro do upload (`storage: "vm"|"cloudinary"`) ou regra por MIME/tamanho.
2. **Persistência:** `SITE_UPLOADS_DIR` aponta para um **volume Docker** montado (ex.: `site-beta_uploads:/data/uploads`), fora de `/repo`. Ajustar `docker-compose.beta.yml` + `.env.beta` (`SITE_UPLOADS_DIR=/data/uploads`).
3. **MIME/limite:** ampliar `ALLOWED_MIME` (+`application/pdf`, downloads a definir) e o limite do multer (≥25MB, via env).
4. **Modelo de pastas:** estender o modelo de mídia com `folder`/`display_name` (migration aditiva em `apps/site/database/`), ou tabela `media_folders` + FK. Não quebrar a `media` usada pelo importador.
5. **UI FileBird-like:** `apps/site-admin` ganha biblioteca com árvore de pastas, upload (drag-drop), busca/filtro, renomear/mover/excluir, copiar URL.
6. **Serviço público:** servir o volume em `/uploads` (ou `/downloads`) com `Content-Type` correto e `Content-Disposition: attachment` para PDF; URL estável por id/hash (R11).
7. **Re-host dos 6 PDFs:** script/rotina one-shot que sobe os arquivos de `rescued-pdfs/` para a biblioteca e **reescreve os links nos posts** (mapeando URL WP original → nova URL VM). Como D074 já podou/desembrulhou esses links, a reescrita reinsere o botão/link de download. Depois `export`+`build`.

## Arquivos afetados (por módulo/pacote)

- `apps/site/server/lib/media-store.ts` — backend VM persistente + escolha de destino.
- `apps/site/server/admin-api.ts` — `ALLOWED_MIME`, limite multer, endpoints de pastas/gestão (mover/renomear/excluir), parâmetro de storage.
- `apps/site/server/server.ts` — servir o volume (`/uploads`|`/downloads`) com headers de download.
- `apps/site/database/migration_*.sql` — pastas/`display_name` no modelo de mídia (aditiva).
- `apps/site/server/lib/media-models` (ou `Media.*`) — CRUD de pasta/itens.
- `apps/site-admin/*` — UI da biblioteca (árvore, upload, busca, ações).
- `apps/site/docker-compose.beta.yml` + `.env.beta` (VM) — volume + `SITE_UPLOADS_DIR` + limite.
- Script one-shot de re-host + reescrita (`apps/site/scripts/` ou `importer/` descartável) consumindo `rescued-pdfs/`.

## Contratos/interfaces tocados

- **Auth/accounts:** reusa `requireAuth`/`requireAdmin` (SSO) — sem tocar contrato de auth.
- **Subdomínio/DNS:** nenhum (serve sob o próprio `beta.artificiorpg.com`); sem mudança de Tunnel.
- **Schema:** migration aditiva (pastas/display_name); não alterar colunas usadas pelo importador (`media.wp_url`, `media_map`).
- **Infra/VM:** criar e montar volume Docker = write na VM (aprovação nominal); ajuste de compose/.env.beta.

## Impacto em consumidores

- **Posts/SSG:** os posts re-hospedados passam a apontar para URLs da VM; `export`/`build` regenera o dist. Verificar residual-zero pós-build.
- **Importador WP:** descartável (D005); a tabela `media` é compartilhada — não quebrar. O re-host é independente do WP (usa arquivos locais salvos).
- **Cloudinary:** fluxo de imagem/vídeo intacto.

## Rollback

- Migration aditiva → reverter por migration própria; snapshot/backup do `site-beta-db` antes (como Gate C desta sessão).
- Volume: se a montagem falhar, voltar `SITE_UPLOADS_DIR` ao default (efêmero) não perde dados já no volume; o volume não é destruído no redeploy.
- Reescrita de links: idempotente e baseada em mapa URL→URL; `git revert` do diff de dados/script; backup do DB antes do re-host.

## Validação (como provo que funciona)

- Subir PDF ~20MB pela UI → redeploy beta → arquivo ainda baixa (persistência R1/R2).
- 6 PDFs na biblioteca + posts originais oferecem download apontando para VM (R12/R13).
- `pnpm --filter @artificio/site test`+`build` + admin build verdes; smoke beta 200.
- **grep `wp-content/uploads` no dist e no live = 0** (residual-zero preservado).
- Download de PDF retorna `Content-Type: application/pdf` + `Content-Disposition: attachment`.
- Upload sem SSO admin = 401/403.
