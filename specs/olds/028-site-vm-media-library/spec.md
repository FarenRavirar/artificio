# 028 — Biblioteca de mídia self-hosted na VM (estilo FileBird)

- **Módulo/Pacote:** apps/site (+ apps/site-admin) | infra (volume Docker na VM)
- **Gate relacionado:** nenhum (site é beta-only, D044; beta→principal por redirect, D074)
- **Origem:** `BL-SITE-VM-MEDIA-LIBRARY` + decisão do mantenedor 2026-06-17 (`sessoes/26-06-17_3_site_media-finalize.md`)

## Problema

A migração WP→site (D074) está concluída com **residual-zero**, mas a política migra-ou-remove **podou 6 PDFs valiosos** (16–22MB) porque o **Cloudinary free limita upload RAW/imagem a 10MB** (vídeo 100MB). São downloads reais do site:

| Arquivo (salvo em `C:\projetos\artificiobackup\site-cloudinary\rescued-pdfs\`) | Tamanho | URL WP original (morre no EOL) |
|---|---|---|
| `Unearthed-Arcana-2026-Subclasses-Misticas-Versao-Ilustrada.pdf` | 22,9 MB | `.../2026/01/Unearthed-Arcana-2026-Subclasses-Misticas-Versao-Ilustrada.pdf` |
| `DnD-5.5E-Unearthed-Arcana-2025-Subclasses-Apocalipticas-Ilustrado.pdf` | 22,5 MB | `.../2025/08/DnD-5.5E-Unearthed-Arcana-2025-Subclasses-Apocalipticas-Ilustrado.pdf` |
| `DD-2024-Ficha-de-Personagem-Impressao-Portugues-Artificio-RPG.pdf` | 16,1 MB | `.../2025/05/DD-2024-Ficha-de-Personagem-Impressao-Portugues-Artificio-RPG.pdf` |
| `DD-2024-Ficha-de-Personagem-Editavel-Portugues-Artificio-RPG.pdf` | 19,2 MB | `.../2025/05/DD-2024-Ficha-de-Personagem-Editavel-Portugues-Artificio-RPG.pdf` |
| `DD-2024-Ficha-de-Personagem-Impressao-Portugues-Erudhir.pdf` | 11,95 MB | `.../2025/05/DD-2024-Ficha-de-Personagem-Impressao-Portugues-Erudhir.pdf` |
| `DD-2024-Ficha-de-Personagem-Editavel-Portugues-Erudhir.pdf` | 12,1 MB | `.../2025/05/DD-2024-Ficha-de-Personagem-Editavel-Portugues-Erudhir.pdf` |

(`Jason-Bulmahn.jpg.webp`, 140KB, avatar de autor, também salvo — re-host trivial via Cloudinary normal, ver `BL-SITE-RESCUE-STRIPPED`.)

Além do caso pontual: o `beta.artificiorpg.com` será **o site principal** (por redirect do mantenedor, D074) e precisa de um **fluxo próprio de upload e gestão de mídia** (estilo plugin WordPress **FileBird**) — biblioteca organizável, para arquivos que **não cabem ou não pertencem ao Cloudinary** (PDFs/downloads grandes, materiais). Hoje o admin só sobe imagem/áudio/vídeo para o Cloudinary; o caminho local existe (`media-store.ts` → `apps/site/uploads` servido em `/uploads`) mas é **efêmero** (perde no redeploy, pois o container faz `git reset --hard`) e **não aceita PDF** (`ALLOWED_MIME` sem `application/*`), sem UI de gestão.

## Requisitos (numerados, testáveis)

### Storage persistente
- **R1** — Arquivos enviados à biblioteca da VM persistem entre redeploys/recriações do container (hoje `apps/site/uploads` é efêmero). Provar: subir arquivo, redeployar beta, arquivo continua acessível.
- **R2** — O storage fica num **volume Docker** dedicado na VM, montado em `SITE_UPLOADS_DIR`, fora da árvore do repo (`/repo` é sobrescrito no deploy). Não versionar binários no git.

### Suporte a PDF na VM (requisito central)
- **R3** — **PDF (`application/pdf`) é tipo de primeira classe, ARMAZENADO E SERVIDO pela VM** (não Cloudinary — onde o free barra >10MB raw). O upload admin aceita `application/pdf` (e tipos de download a definir: `application/zip`, etc.) além dos atuais imagem/áudio/vídeo, com validação de **MIME real (magic bytes)** mantida. Sem suporte a PDF na VM a spec não fecha.
- **R4** — Limite de tamanho do upload eleva para cobrir os PDFs reais (≥ 25MB; teto configurável). O `413 LIMIT_FILE_SIZE` atual não pode barrar arquivos legítimos do escopo (os PDFs alvo têm 16–22MB).
- **R5** — Arquivos grandes/download (PDF e afins) vão para o **storage persistente da VM** (não Cloudinary). Imagens/vídeo continuam podendo ir ao Cloudinary (transform/CDN). A decisão de destino (VM vs Cloudinary) é explícita e previsível; **PDF sempre VM**.

### Gestão (FileBird-like)
- **R6** — A UI admin (`apps/site-admin`) lista a biblioteca com **organização em pastas/categorias** (criar, renomear, mover item entre pastas).
- **R7** — Operações por item: **renomear, excluir, copiar URL pública**, e ver metadados (tipo, tamanho, data, pasta).
- **R8** — **Busca/filtro** por nome e por tipo dentro da biblioteca.
- **R9** — O modelo de dados da mídia persiste pasta, nome de exibição, MIME, tamanho, URL/caminho e autor (estende a tabela `media` existente ou tabela própria, sem quebrar a `media` do importador).

### Serviço público dos arquivos
- **R10** — Arquivos da biblioteca são servidos publicamente (leitura) por URL estável (ex.: `/uploads/<...>` ou `/downloads/<...>`), com `Content-Type` correto e `Content-Disposition` adequado para download de PDF.
- **R11** — URLs estáveis: renomear "nome de exibição" não quebra a URL já publicada num post (URL baseada em id/hash, não no título).

### Re-host dos 6 PDFs + reescrita de links
- **R12** — Os 6 PDFs salvos em `rescued-pdfs/` são carregados na biblioteca da VM (origem = os arquivos locais; **não** depender do WP, que sairá do ar).
- **R13** — Os links nos posts que apontavam para as URLs WP originais desses PDFs são **reescritos** para as novas URLs da VM (os links hoje estão **podados/desembrulhados** no store após D074 — a reescrita precisa reinserir o link/botão de download apontando para a VM).
- **R14** — Após R12+R13: `export`+`build` do site e verificação de que os posts afetados oferecem o download novamente, e que **nenhuma URL `wp-content/uploads`** reaparece (residual-zero preservado).

### Acesso
- **R15** — Upload/gestão exigem sessão **SSO admin** (mesmo `requireAuth`+`requireAdmin` do admin atual). Leitura dos arquivos é pública.

## Critérios de aceite

- Subir um PDF de ~20MB pela UI admin, organizá-lo numa pasta, copiar a URL, colá-la num post, publicar, e **baixar o PDF** pelo site público — tudo funcionando após um redeploy do beta (persistência provada).
- Os **6 PDFs** estão na biblioteca e os posts originais voltam a oferecer o download (links apontando para a VM, não WP).
- `pnpm --filter @artificio/site test` + `build` + (admin build) verdes; smoke beta 200; **grep `wp-content/uploads` no dist/live = 0**.
- Nenhuma regressão no fluxo Cloudinary existente (imagens dos posts continuam servidas via Cloudinary com transforms).

## Fora de escopo

- Cutover DNS raiz (Gate C, adiado, D016) — beta segue como alvo; principal por redirect.
- Migrar para object storage externo (R2/S3) — decisão é **hospedar na VM** (mantenedor 2026-06-17). Reavaliar só se o volume crescer demais.
- Upgrade do plano Cloudinary.
- CDN/edge-cache próprio para os downloads (pode entrar em fatia futura se a banda da VM pesar).
- Versionamento/biblioteca de assets do glossário/mesas — esta spec é do `site`.
- Reescrita do importador WP (descartável, D005); o `BL-SITE-RESCUE-STRIPPED` (avatar Jason) é tratado junto do re-host manual, não reabrindo o importador.

## Riscos e impacto em outros módulos

- **Persistência/volume na VM** = ação de infra: criar/montar volume exige write na VM (aprovação nominal). Se o volume não for montado corretamente, uploads se perdem no redeploy — provar persistência é critério pétreo.
- **Banda/disco da VM:** servir PDFs de 16–22MB pela origem consome banda; Oracle tem 200GB disco (folga), mas downloads populares podem exigir cache/limite futuro (fora de escopo, registrar se observado).
- **Segurança de upload:** aceitar `application/pdf`/binários amplia superfície; manter validação de magic bytes, servir com `Content-Disposition: attachment` e sem execução; nunca servir de diretório com permissão de execução.
- **Modelo `media`:** estender sem quebrar a tabela usada pelo importador (`media`/`media_map`); migration aditiva, com backup/snapshot.
- **Auth (sagrado):** reusar `requireAuth`/`requireAdmin` do admin; não abrir upload sem SSO.
- **D074/residual-zero:** a reescrita de links (R13) não pode reintroduzir URL WP; validar grep pós-build. Como o site beta vira principal, qualquer download quebrado é visível ao público.
