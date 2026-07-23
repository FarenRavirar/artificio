# Tasks — Spec 082

## F0 — auditoria e backup

- [x] T0.0 — Auditoria live Beta: home visual abre; catálogo renderiza shell, mas falha ao carregar materiais. Front buildado servido; API/DB funcional não comprovado.
- [x] T0.0a — Auditoria visual de tema: mantenedor confirmou dark predominantemente navy e light funcionando só no Header; código confirma conteúdo com classes/tokens dark fixos.
- [x] T0.1 — Inventariar containers, volumes, labels Compose, env não secreto por nomes e runs de deploy. Resultado: app healthy, API unhealthy, DB healthy; volume atual `downloads-beta_*`, legado `downloads_*`; deploy `29759345736` falhou no guard de 19 migrations.
- [ ] T0.2 — Comparar volumes Beta e identificar qual contém dados válidos das specs 070–075.
- [ ] T0.3 — Backup off-VM + hash + `pg_restore -l` + restore-test isolado.
- [ ] T0.4 — Registrar decisão do mantenedor sobre volume a preservar e destino do volume divergente.
- [x] T0.5 — Comparar build servido com código local: frontend foi rebuildado em 2026-07-20; API dist servida coincide por hash com os arquivos locais críticos.
- [x] T0.6 — Auditar rotas/UX/storage/tema e registrar lacunas materiais em `investigacao-pre-implementacao.md`.

## F1 — corrigir Beta

- [ ] T1.1 — Preservar `downloads-beta` como projeto Compose canônico; impedir invocação sem `-p`/manifesto e documentar origem do volume legado.
- [ ] T1.2 — Definir bootstrap controlado das migrations sem relaxar globalmente o guard de 5 pendências.
- [ ] T1.3 — Corrigir rollback/falha inicial para não recriar serviço contra banco vazio.
- [ ] T1.4 — Aplicar/registrar migrations 001–019 no banco correto.
- [ ] T1.5 — Confirmar containers healthy e schema esperado.

## F2 — fechar produto antes do smoke

- [ ] T2.1 — Implementar tela/fluxo de criação usando `POST /api/v1/materials`.
- [ ] T2.2 — Implementar ação de submissão usando `POST /api/v1/moderation/:id/submit`.
- [ ] T2.3 — Decidir storage: provider gerenciado real ou MVP somente-link-externo.
- [ ] T2.4 — Persistir binário de evidência se upload gerenciado permanecer no contrato.
- [ ] T2.5 — Implementar `/obter/:fileId` conforme contrato decidido.
- [ ] T2.6 — Migrar dark/light integralmente para tokens semânticos, incluindo estados e responsividade.
- [ ] T2.7 — Implementar ou reclassificar, com decisão do mantenedor, gestão de mídias, gestão de publicadores e link checker agendado.

## F3 — smoke Beta

- [ ] T3.1 — Validar health, catálogo, ficha, criador, redirect/download e respostas 401/404.
- [ ] T3.2 — Executar criação→submissão→moderação→publicação→download real.
- [ ] T3.3 — Validar storage/provider, checksum, auditoria e rollback.
- [ ] T3.4 — Validar dark/light ponta a ponta e screenshots desktop/mobile.

## F4 — Prod e fechamento

- [ ] T4.1 — Rodar lint/build/test/verify:api; atualizar 070–076/backlog com evidência, sem mascarar gaps.
- [ ] T4.2 — Commit/push/PR somente com autorização nominal.
- [ ] T4.3 — Promote `dev→main` somente com autorização nominal.
- [ ] T4.4 — Deploy Prod via `workflow_dispatch` manual, somente com autorização nominal.
- [ ] T4.5 — Smoke Prod e registrar run IDs/URLs/timestamps.
- [ ] T4.6 — Fechar 082/076 apenas após todos os critérios verdes; reabrir e perguntar se qualquer falha surgir.
