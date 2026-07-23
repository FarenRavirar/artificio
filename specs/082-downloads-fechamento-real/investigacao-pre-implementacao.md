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
- T0.2: cópias isoladas dos volumes confirmaram que `downloads-beta_pgdata_downloads_beta` contém somente `schema_migrations` sem linhas e nenhuma tabela de domínio. O legado `downloads_pgdata_downloads_beta` contém 20 tabelas esperadas (19 de domínio + `schema_migrations`) e as migrations `001`–`019` registradas, todas aplicadas em 2026-07-12, porém todas as tabelas estão sem registros. Volumes originais não foram escritos; cópias e containers temporários foram removidos.
- Volume atual: 47 MB, mtime 2026-07-20, 1199 arquivos base. Legado: 47 MB, mtime 2026-07-12, 1280 arquivos base. Isso sugere conteúdo adicional no legado, não prova schema/dados.
- Manifesto usa `compose_project_beta: downloads-beta` desde sua introdução. O label do legado aponta projeto `downloads`; causa mais provável é execução manual/pré-canônica sem `-p downloads-beta`.
- Conteúdo exato do legado foi confirmado em restore/container temporário autorizado; dumps off-VM, hashes, `pg_restore -l` e restore-test estão registrados em T0.2/T0.3.
- O rollback do deploy falho deixou a API ligada ao banco atual vazio. Primeiro deploy precisa tratamento próprio; rollback não pode produzir runtime pior que o estado anterior.

## O que saiu no build

- Frontend foi rebuildado no deploy de 2026-07-20 e é o bundle servido.
- Banco de sistemas RPG não pertence a Downloads. Código usa `@artificio/catalog-client`; Compose Beta aponta para `http://site-beta-app:4322` e Prod para `http://site-prod-app:4322`, ambos exigindo `CATALOG_INTERNAL_TOKEN`. Smoke runtime fica pendente após o banco/API Downloads voltar.
- Dependências confirmadas: backend `auth`, `catalog-client`, `changelog`, `config`, `media`; frontend `analytics`, `auth`, `catalog-client`, `config`, `ui`. Validação local: catalog-client 3/3 testes; backend lint/build e 76/76 testes; frontend lint/build e 6/6 testes. Smoke de integração ainda não comprovado.
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

1. Corrigir bootstrap/rollback no volume Beta canônico; aplicar 001–019; obter health 200.
2. Validar catálogo central do Site e contratos/pacotes compartilhados.
3. Implementar criação/submissão e decidir storage contratual.
4. Implementar download/evidência conforme decisão; remover promessas falsas/placeholders do fluxo crítico.
5. Migrar tema e completar/reclassificar placeholders não críticos.
6. Smoke Beta ponta a ponta.
7. Só então preparar volume Prod próprio, PR/promoção/deploy Prod, cada ação sob sua autorização.

## Validação local desta investigação

- Backend: lint verde; 17 arquivos/76 testes verdes; build verde.
- Frontend: lint verde; 2 arquivos/6 testes verdes; build verde (247 módulos).
- Aviso não bloqueante: configuração ESLint backend é carregada como módulo sem `"type":"module"` no package.
- Auditoria completa das migrations `001–019`: todas existem, têm headers válidos, são `online-safe`/`requires-backup:false`; nenhuma tem `DROP TABLE`, `TRUNCATE` ou `DELETE FROM`. `003`, `013`, `016` e `017` usam apenas `DROP TRIGGER/INDEX IF EXISTS` idempotente.
- Histórico confirma correções no framework: `7958483` liberou DDL idempotente no guard; `d82992b`, `32173bb`, `c88c8b6`, `4e0df5e` corrigiram allowlist, tokenizer, fail-closed e validação de `CLASS`; `2d9b13c` tornou tracking idempotente com `ON CONFLICT`.
- Causa restante do bootstrap: banco novo tem 19 pendências, mas `MAX_AUTO_PENDING=5` bloqueia o lote inicial. Próxima correção deve tratar banco vazio/projeto novo de forma controlada, sem relaxar o limite para bancos existentes.
- T0.4 decidido: Beta/dev usa `downloads-beta_pgdata_downloads_beta`; Produção usará `downloads_pgdata_downloads_prod`; legado `downloads_pgdata_downloads_beta` fica fora de runtime, retido por auditoria/rollback até smokes verdes.
- T0.3 concluído: dumps custom-format off-VM em `C:\projetos\artificiobackup\spec-082\20260723-172424`, hashes e `pg_restore -l` válidos. Restore-test isolado passou para ambos; canonical restaura 1 tabela e legado restaura 20 tabelas/19 migrations. `pg_restore` ausente no Windows local; validação executada na VM.
