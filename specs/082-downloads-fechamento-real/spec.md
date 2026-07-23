# Spec 082 — Downloads: fechamento real beta/prod e conclusão do projeto

## Objetivo

Levar Downloads de implementação local para serviço operacional comprovado em Beta e Produção, encerrando os gaps das specs 070–076 sem confundir código mergeado com deploy/runtime.

## Problema

Parte das funcionalidades existe no repositório, mas o produto não fecha ponta a ponta. A primeira tentativa de deploy Beta revelou tracking de migrations ausente e volumes PostgreSQL divergentes. Downloads Beta ficou unhealthy com `42P01`. Além disso, o frontend não oferece criação de material nem envio do rascunho à moderação, `/obter/:fileId` é placeholder e o upload de evidência só registra metadata. Portanto o Gate D de Downloads não está fechado e Produção não pode ser declarada concluída.

## Dependência de dados compartilhados e pacotes

Downloads não possui banco de sistemas de RPG próprio. Sistemas/edições continuam no catálogo central do Site, hoje operacional; Downloads deve consumi-los via `@artificio/catalog-client`, sem copiar, migrar ou criar catálogo local. A falha histórica de configuração do banco do catálogo central pertence ao Site e está atualmente resolvida.

O consumo precisa ser validado em Beta e Produção com `CATALOG_API_URL` apontando para `site-beta-app:4322`/`site-prod-app:4322` e `CATALOG_INTERNAL_TOKEN` válido, incluindo health, leitura de sistema por ID e comportamento fechado quando o Site estiver indisponível.

Downloads também precisa provar compatibilidade dos pacotes compartilhados: backend (`@artificio/auth`, `@artificio/catalog-client`, `@artificio/changelog`, `@artificio/config`, `@artificio/media`) e frontend (`@artificio/analytics`, `@artificio/auth`, `@artificio/catalog-client`, `@artificio/config`, `@artificio/ui`). A matriz compara SSO, shell/tema, analytics, changelog, mídia e catálogo com Mesas, Glossário e Links.

## Evidência live adicionada (2026-07-23)

Em `https://downloadsbeta.artificiorpg.com`:

- Home abre e renderiza shell compartilhado, navegação, tema, changelog, SSO, hero e footer.
- `/catalogo` renderiza título, busca e ordenação, mas após o carregamento mostra `Falha ao carregar materiais. Tente novamente.`
- Isso prova que o frontend buildado está sendo servido; não prova API/DB saudável.
- O smoke funcional fica bloqueado até `/api/v1/materials` responder e o catálogo popular.
- Evidência visual do mantenedor: dark fica predominantemente navy; light só altera o Header. O conteúdo Downloads não acompanha integralmente o tema.

## Gap visual adicional — dark/light

O fechamento exige tema funcional em todas as áreas públicas, painel e gestão. O Header usa o contrato compartilhado, mas o conteúdo Downloads ainda fixa `text-white`, `border-white/*`, `bg-[var(--color-artificio-blue)]` e não consome integralmente `--canvas`, `--surface`, `--fg` e `--line`. A implementação e validação desse gap pertencem a esta spec; nenhuma correção foi aplicada nesta auditoria.

## Auditoria das migrations e do bootstrap

Auditoria completa das migrations `001–019`, documentação e histórico Git confirmou que o problema Beta não está em migration quebrada:

- As 19 migrations existem, têm os cinco campos de header, são `online-safe` e declaram `requires-backup:false`.
- Nenhuma contém `DROP TABLE`, `TRUNCATE` ou `DELETE FROM`.
- `003`, `013`, `016` e `017` contêm somente operações idempotentes `DROP TRIGGER/INDEX IF EXISTS`, aceitas pelo guard corrigido.
- O banco Downloads é próprio do app; não deve compartilhar schema com o Site nem com o catálogo central de sistemas.

Correções históricas relevantes do framework:

- `7958483`: guard passou a aceitar `DROP <objeto> IF EXISTS` idempotente.
- `d82992b`, `32173bb`, `c88c8b6`, `4e0df5e`: guard recebeu allowlist, tokenizer correto para comentários/strings, fail-closed e validação de `CLASS`.
- `2d9b13c`: tracking recebeu `ON CONFLICT (migration_name) DO NOTHING`, corrigindo corrida/duplicidade em `schema_migrations`.

Falha restante: banco novo com 19 migrations pendentes é bloqueado por `MAX_AUTO_PENDING=5`. **Isso não é bug do framework** — o guard é proteção deliberada contra aplicar lote grande de migrations sem revisão passo a passo (funciona como projetado). O caso real e já documentado é `E012` (`.specify/memory/errors.md`): quando o número de migrations pendentes excede 5 numa única rodada (histórico: specs seguidas sem promote a prod), a solução oficial é rodar `apply_required_migrations.sh` manualmente (mesmo script, preserva lock/checksum/header) com `MAX_AUTO_PENDING=<N>` como env var só nessa execução pontual — nunca elevar o limite globalmente, nunca fatiar em lotes artificiais (script sempre compara o total pendente de uma vez).

Downloads nunca teve deploy Beta bem-sucedido — é projeto novo, a única tentativa de deploy (`29759345736`) foi o primeiro contato real com o guard, com as 19 migrations completas do zero (não é acúmulo por falta de promote, é primeiro deploy nunca feito). O padrão de correção é o mesmo do E012: rodar o bootstrap inicial com `MAX_AUTO_PENDING=19` (ou N=pendentes) só nessa rodada única, guard volta a 5 depois. T1.2 implementa esse bootstrap controlado seguindo o precedente E012, não uma correção de framework.

Decisão de volumes: `downloads-beta_pgdata_downloads_beta` é o banco Beta/dev; `downloads_pgdata_downloads_prod` será o banco Produção. O volume legado `downloads_pgdata_downloads_beta`, criado sob projeto Compose incorreto `downloads`, não será conectado a runtime; dump permanece para auditoria/rollback até os smokes, e remoção posterior exige autorização.

## Escopo

- Diagnóstico read-only e reconciliação segura dos volumes Beta.
- Restore/backup antes de qualquer write.
- Tracking e aplicação ordenada das 19 migrations no banco correto.
- Fix/validação do nome de projeto Compose e isolamento Beta/Prod.
- Smoke HTTP e funcional ponta a ponta em Beta.
- Promoção `dev→main` e deploy Prod manual, com smoke Prod.
- Observabilidade mínima: health, logs, migrations aplicadas, storage e rollback.
- UI de criação e submissão conectada às APIs existentes.
- Persistência/entrega real de arquivo ou decisão explícita e refletida no produto por MVP somente com link externo.
- Migração completa do conteúdo aos tokens semânticos de tema.
- Decisão e acabamento dos placeholders de gestão e do link checker agendado.
- Fechamento/reclassificação dos itens ainda abertos em 073, 076 e débitos Downloads.

## Fora de escopo

- Novas features de produto não necessárias ao fluxo mínimo criação→publicação→download.
- DNS raiz, alteração de SSO, alteração de packages compartilhados e migrações de outros apps. Contratos compartilhados usados por Downloads continuam dentro do escopo de validação.
- Scheduler real de link checker, mídia admin avançada e filtros futuros, salvo decisão explícita de reclassificação.

## Critérios de aceite

1. Volume Beta correto identificado por evidência de conteúdo/hash/contagens; volume errado preservado até decisão e rollback documentados.
2. Banco Beta saudável, 19 migrations registradas/aplicadas exatamente uma vez, API `/api/v1/health` 200.
3. Rotas públicas, 401 protegidas e 404 esperadas validadas.
4. Fluxo real Beta: submissão → fila → aprovação → publicação → redirecionamento/download; auditoria registrada.
5. Usuário consegue criar material e submeter rascunho pela UI; moderador consegue revisar/publicar.
6. Upload/storage real validado com provider configurado, ou MVP somente-link-externo decidido pelo mantenedor e sem controles/promessas falsas de upload hospedado.
7. Dark/light funcionam em todas as rotas e estados; contraste e screenshots desktop/mobile aprovados.
8. Placeholders e scheduler têm decisão explícita: implementar nesta spec ou retirar/reclassificar com débito acionável autorizado.
9. Código em branch/PR contra `dev`, checks verdes; nenhum commit/push/merge implícito.
10. Após aprovação nominal, `main` contém o código e `deploy.yml` Prod foi disparado manualmente; smoke Prod verde.
11. Evidência inclui run IDs, URLs, timestamps, migrations, health e rollback; só então 076 e 082 podem ser encerradas.
12. Downloads não cria banco local de sistemas; Site central responde health e leitura de sistema em Beta/Produção, com token e URLs internos corretos.
13. Pacotes compartilhados usados por Downloads passam lint/build/test focados e smoke de integração equivalente aos consumidores Mesas/Glossário/Links.
14. Bootstrap de banco novo aplica as 19 migrations `online-safe` ordenadamente, registra todas uma vez e mantém guard estrito para bancos existentes.
