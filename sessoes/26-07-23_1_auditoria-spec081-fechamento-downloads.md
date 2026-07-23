# Sessão 26-07-23 — Auditoria spec 080 + fechamento Downloads

## Objetivo

Auditar a spec 080 contra código, Git e produção; abrir spec completa com tudo que falta para Downloads terminar.

## Estado inicial

- Spec 080 = `specs/080-search-console-opengraph-indexacao/`; escopo é Site, Mesas e Glossário.
- 080 tem tarefas de produção explicitamente registradas: sitemaps, OG e GSC.
- 080 está mergeada em `origin/dev` e `origin/main` por PRs #174–#178, conforme histórico local.
- Downloads tem specs 070–076 implementadas em código, mas 076 mantém F5/F6 abertos.
- Sessão de 2026-07-20 registra Downloads Beta indisponível: 19 migrations pendentes, tracking ausente/novo e volumes Compose divergentes (`downloads-beta_pgdata_downloads_beta` vs `downloads_pgdata_downloads_beta`), com API unhealthy/42P01.

## Trabalho desta sessão

1. Comparar 080 com commits, código e refs `origin/dev`/`origin/main`.
2. Registrar auditoria material em `specs/080-search-console-opengraph-indexacao/auditoria-codigo-producao.md`.
3. Criar spec 082 com gaps restantes de Downloads, sem declarar produção concluída.

## Evidência

- `git log origin/dev/origin/main --grep=080`: commits de implementação e merges #174–#178 presentes.
- `specs/080.../tasks.md`: smoke real de sitemap/OG/GSC e validações locais registrados como concluídos.
- Auditoria live `downloadsbeta.artificiorpg.com`: Home visual abre; `/catalogo` mostra busca/ordenação, depois `Falha ao carregar materiais. Tente novamente.`

## Evidência Downloads Beta — 2026-07-23

- **Entrou no build/está servido:** shell Artifício, header/footer, links de módulos, tema, changelog, autenticação visível, Home, rota `/catalogo`, campo de busca e ordenação.
- **Não está funcional no runtime:** carregamento de materiais; o catálogo não exibe cards nem dados.
- **Inferência suportada:** frontend nginx/build está vivo; backend/DB/API não está saudável ou não está acessível ao frontend. A causa provável já registrada em 2026-07-20 é volume Compose divergente + migrations ausentes, mas precisa confirmação read-only na VM.
- **Não declarado:** submissão, moderação, publicação, download, painel, storage, health 200 e 401. Não foram comprovados nesta inspeção porque o catálogo já falhou e o endpoint de health não pôde ser aberto pela camada do navegador.
- Evidência adicional do mantenedor: dark predominantemente navy; light altera só Header. Código confirma `AppShell` com fundo/texto fixos e amplo uso de `text-white`/`border-white` nas telas Downloads. Registrado em 082; nenhuma correção aplicada.
- `specs/076-downloads-g-infra-deploy/tasks.md`: T5.1–T5.3 e T6.1–T6.3 permanecem unchecked.
- `sessoes/26-07-20_1_analytics_ga4-property-por-app.md`: falha real de deploy Beta de Downloads e serviço unhealthy.

## Regra de encerramento

Nenhuma spec será marcada concluída sem smoke real e evidência de runtime; promoção Git não será tratada como deploy.

## Retomada — investigação pré-implementação 082

## Retomada — empacotamento do diff

- Pedido do mantenedor: incluir todo o diff local, sem diferenciação de arquivos.
- Próximo: branch nova baseada em `origin/dev`, commit único, push e PR pronta contra `dev`.

Pedido do mantenedor: investigar integralmente o estado necessário para avançar à implementação/correção da 082. Escopo desta etapa: inspeção read-only de código, build, VM, containers, volumes, banco, migrations, API, storage, tema e gaps funcionais. Nenhum write na VM, banco, deploy, commit ou push autorizado nesta etapa.

Estado de entrada:

- frontend Beta servido;
- catálogo falha ao carregar dados;
- tema light só altera Header;
- hipótese histórica: volumes Compose divergentes + migrations ausentes;
- tasks F0.1–F0.4 ainda abertas.

## Resultado da investigação pré-implementação

- Beta: app healthy, API unhealthy, DB healthy; health 500, catálogo 500, rota protegida 401.
- DB ativo contém somente `schema_migrations` vazia; `download_material` inexiste; logs confirmam `42P01`.
- Há volume canônico `downloads-beta_*` vazio e legado `downloads_*` sem consumidor. Comparação exata requer restore/container temporário e autorização nominal.
- Run `29759345736` bloqueou 19 migrations pelo guard de máximo 5; rollback deixou runtime contra banco vazio.
- Frontend novo está servido. API crítica coincide por hash com dist local; causa imediata é schema, não ausência do build backend.
- Produto não permite criação nem submissão via UI; `/obter/:fileId` e duas gestões são placeholders; evidência não persiste binário; storage não está ligado ponta a ponta.
- Tema tem 221 ocorrências rígidas em 37 arquivos e precisa migração aos tokens semânticos existentes.
- Prod responde 502 e não possui containers Downloads.
- Validação local verde: backend lint/build + 76 testes; frontend lint/build + 6 testes.
- Consolidação detalhada: `specs/082-downloads-fechamento-real/investigacao-pre-implementacao.md`.
