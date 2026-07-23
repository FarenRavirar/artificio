# Spec 082 — Downloads: fechamento real beta/prod e conclusão do projeto

## Objetivo

Levar Downloads de implementação local para serviço operacional comprovado em Beta e Produção, encerrando os gaps das specs 070–076 sem confundir código mergeado com deploy/runtime.

## Problema

Parte das funcionalidades existe no repositório, mas o produto não fecha ponta a ponta. A primeira tentativa de deploy Beta revelou tracking de migrations ausente e volumes PostgreSQL divergentes. Downloads Beta ficou unhealthy com `42P01`. Além disso, o frontend não oferece criação de material nem envio do rascunho à moderação, `/obter/:fileId` é placeholder e o upload de evidência só registra metadata. Portanto o Gate D de Downloads não está fechado e Produção não pode ser declarada concluída.

## Evidência live adicionada (2026-07-23)

Em `https://downloadsbeta.artificiorpg.com`:

- Home abre e renderiza shell compartilhado, navegação, tema, changelog, SSO, hero e footer.
- `/catalogo` renderiza título, busca e ordenação, mas após o carregamento mostra `Falha ao carregar materiais. Tente novamente.`
- Isso prova que o frontend buildado está sendo servido; não prova API/DB saudável.
- O smoke funcional fica bloqueado até `/api/v1/materials` responder e o catálogo popular.
- Evidência visual do mantenedor: dark fica predominantemente navy; light só altera o Header. O conteúdo Downloads não acompanha integralmente o tema.

## Gap visual adicional — dark/light

O fechamento exige tema funcional em todas as áreas públicas, painel e gestão. O Header usa o contrato compartilhado, mas o conteúdo Downloads ainda fixa `text-white`, `border-white/*`, `bg-[var(--color-artificio-blue)]` e não consome integralmente `--canvas`, `--surface`, `--fg` e `--line`. A implementação e validação desse gap pertencem a esta spec; nenhuma correção foi aplicada nesta auditoria.

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
- DNS raiz, SSO, packages compartilhados e migrações de outros apps.
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
