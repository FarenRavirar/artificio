# Investigação pré-implementação — Spec 082

Data: 2026-07-23. Inspeção read-only; nenhum código, banco, container ou deploy alterado.

## Estado material Beta/Prod

| Camada | Evidência | Estado |
|---|---|---|
| Front Beta | `/` 200; imagem criada em 2026-07-20; assets JS/CSS presentes | build novo servido |
| API Beta | container unhealthy; `/api/v1/health` 500 | quebrada |
| DB Beta | só `schema_migrations`, zero registros; `download_material` ausente | banco vazio |
| Catálogo | `/api/v1/materials` 500 | indisponível |
| Auth guard | `/api/v1/materials/mine` 401 | guarda executa antes do DB |
| Prod | hostname e health 502; nenhum container Downloads Prod | não implantada |

## Causa de infraestrutura

- Deploy Beta `29759345736`, SHA `21c7939`, bloqueado por 19 migrations pendentes acima de `MAX_AUTO_PENDING=5`.
- As 19 migrations são marcadas `online-safe` e `requires-backup:false`, mas isso não autoriza elevar o limite global.
- O DB ativo monta `downloads-beta_pgdata_downloads_beta`; existe volume legado `downloads_pgdata_downloads_beta`, sem consumidor.
- Volume atual: 47 MB, mtime 2026-07-20, 1199 arquivos base. Legado: 47 MB, mtime 2026-07-12, 1280 arquivos base. Isso sugere conteúdo adicional no legado, não prova schema/dados.
- Manifesto usa `compose_project_beta: downloads-beta` desde sua introdução. O label do legado aponta projeto `downloads`; causa mais provável é execução manual/pré-canônica sem `-p downloads-beta`.
- Conhecer o conteúdo exato do legado exige restore/container temporário. Isso muta a VM e requer aprovação nominal antes de T0.2/T0.3.
- O rollback do deploy falho deixou a API ligada ao banco atual vazio. Primeiro deploy precisa tratamento próprio; rollback não pode produzir runtime pior que o estado anterior.

## O que saiu no build

- Frontend foi rebuildado no deploy de 2026-07-20 e é o bundle servido.
- API em execução usa imagem de 2026-07-12, mas hashes de `server.js`, `routes/materials.js` e `routes/moderation.js` coincidem com o `dist` local atual.
- Logo, o defeito principal da API não é código local ausente: é schema não aplicado.

## O que não fecha no produto

1. Não existe UI/hook para `POST /api/v1/materials`; usuário não cria material pelo frontend.
2. Não existe ação UI para `POST /api/v1/moderation/:id/submit`; rascunho não entra na fila pelo frontend.
3. `/obter/:fileId` informa que download hospedado direto não está disponível.
4. Upload de evidência valida magic bytes e grava metadata, mas não persiste o binário.
5. Runtime só recebe configuração Cloudinary. R2/B2/Fastio não são injetados pelo Compose; adapters não formam fluxo utilizável.
6. `GestaoMidiasPage` e `GestaoPublicadoresPage` são placeholders.
7. Link checker é sob demanda; não existe agendamento operacional.
8. Facetas avançadas, sidebar/drawer contextual e E2E light da 073 permanecem incompletos.
9. Backlog 070–076 está documentalmente atrasado: ainda descreve entregas como locais, embora PRs tenham sido mergeadas e um deploy Beta tenha sido tentado.

## Tema

- `AppShell` fixa navy/branco e o Footer usa contrato visual diferente.
- Busca local encontrou 221 ocorrências de cores/classes rígidas em 37 arquivos frontend.
- `packages/ui` já fornece `--canvas`, `--surface`, `--fg` e `--line`; a correção deve migrar consumidores, sem inventar segundo sistema de tokens.
- Aceite deve cobrir rotas públicas, painel, gestão, modais, drawers, loading/erro/vazio e desktop/mobile nos dois temas.

## Ordem segura de implementação

1. Com aprovação: backup/restore-test isolado dos dois volumes e decisão de retenção.
2. Corrigir bootstrap/rollback; aplicar 001–019; obter health 200.
3. Implementar criação/submissão e decidir storage contratual.
4. Implementar download/evidência conforme decisão; remover promessas falsas/placeholders do fluxo crítico.
5. Migrar tema e completar/reclassificar placeholders não críticos.
6. Smoke Beta ponta a ponta.
7. Só então PR/promoção/deploy Prod, cada ação sob sua autorização.

## Validação local desta investigação

- Backend: lint verde; 17 arquivos/76 testes verdes; build verde.
- Frontend: lint verde; 2 arquivos/6 testes verdes; build verde (247 módulos).
- Aviso não bloqueante: configuração ESLint backend é carregada como módulo sem `"type":"module"` no package.
