# Tasks — 028 Biblioteca de mídia na VM

> Ordem sugerida: persistência → tipos/limite → modelo/pastas → UI → serviço → re-host. Cada task pequena e verificável. Atualizar a sessão a cada etapa. Write na VM e DB = aprovação nominal.

## Infra / persistência
- [ ] T1 — Volume Docker para uploads na VM (`docker-compose.beta.yml` + `.env.beta` `SITE_UPLOADS_DIR=/data/uploads`) · feito quando: arquivo enviado sobrevive a um redeploy do beta (provado: upload → `deploy` → arquivo ainda baixa).

## Upload / tipos / limite
- [ ] T2 — Ampliar `ALLOWED_MIME` (+`application/pdf` e tipos de download definidos) mantendo validação de magic bytes · feito quando: upload de PDF válido passa, arquivo com MIME falsificado é rejeitado (teste).
- [ ] T3 — Elevar limite do multer (≥25MB, via env) sem barrar os PDFs reais · feito quando: PDF de 22MB sobe; acima do teto retorna 413 claro.
- [ ] T4 — Decisão de destino (VM vs Cloudinary) explícita por tipo/tamanho/param · feito quando: PDF vai p/ VM, imagem de post continua indo p/ Cloudinary; coberto por teste.

## Modelo / pastas
- [ ] T5 — Migration aditiva: `folder`/`display_name` (ou tabela `media_folders`+FK) sem quebrar `media`/`media_map` do importador · feito quando: migration aplica com backup, schema_migrations registra, importador segue verde.
- [ ] T6 — CRUD de pasta + mover/renomear/excluir item no backend (endpoints admin, SSO) · feito quando: testes dos endpoints (criar/mover/renomear/excluir/listar) passam.

## UI admin (FileBird-like)
- [ ] T7 — Biblioteca no `apps/site-admin`: árvore de pastas, upload drag-drop, busca/filtro por nome e tipo · feito quando: build do admin verde + smoke manual logado (subir, organizar, buscar).
- [ ] T8 — Ações por item: renomear, excluir, copiar URL pública, metadados · feito quando: cada ação reflete no backend e na lista.

## Serviço público
- [ ] T9 — Servir o volume com `Content-Type` correto e `Content-Disposition: attachment` p/ PDF; URL estável por id/hash (renomear não quebra URL) · feito quando: `curl` do PDF retorna headers corretos; renomear display_name mantém a URL.

## Re-host dos 6 PDFs + reescrita
- [ ] T10 — Carregar os 6 PDFs de `artificiobackup/site-cloudinary/rescued-pdfs/` na biblioteca da VM (origem = arquivos locais, sem WP) · feito quando: os 6 aparecem na biblioteca e baixam.
- [ ] T11 — Reescrever links nos posts (mapa URL-WP-original → nova URL VM) reinserindo o botão/link de download podado no D074 · feito quando: posts afetados oferecem o download de novo; mapa documentado.
- [ ] T12 — `export`+`build`+smoke; grep `wp-content/uploads` no dist e live = 0 · feito quando: residual-zero preservado e downloads funcionando.
- [ ] T13 — (opcional, `BL-SITE-RESCUE-STRIPPED`) re-host do avatar `Jason-Bulmahn.jpg.webp` (Cloudinary normal, <10MB) + reescrita · feito quando: avatar volta no post.

## Fechamento
- [ ] T14 — Atualizar backlog (fechar `BL-SITE-VM-MEDIA-LIBRARY`/`BL-SITE-RESCUE-STRIPPED`), sessão e `project-state`; remover `SITE_IMPORT_ON_START=false`? (não — mantém; importador descartável) · feito quando: docs refletem o estado final e downloads validados pelo mantenedor.
