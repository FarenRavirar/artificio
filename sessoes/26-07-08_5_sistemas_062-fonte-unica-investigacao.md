# Sessão 26-07-08_5 — Spec 062 · fonte única de sistemas/edições

## Retomada — encerramento da investigação

- Fazer: auditar lacunas e contradições restantes da Etapa I; consolidar decisão, modelo, migração, compatibilidade, disponibilidade, rollout, rollback e provas.
- Já feito: inventário material de Mesas/Glossário, inspeção read-only beta/prod, decisão arquitetural D099 e primeira decomposição da Etapa II.
- Falta: alinhar status/checklists, registrar critérios formais de encerramento e apontar somente o planejamento executável da Etapa II como próximo passo.
- Limite: documentação e investigação apenas; nenhum código, migration, alteração de dados, deploy ou write em VM.

## Escopo

Criar e executar a investigação da Spec 062, pré-requisito da 061, sem implementação.

## Retomada — investigação profunda

- **Pedido:** investigar ownership/localização, host, leitura/cache/projeções, modelo canônico, escopo semântico, governança, UUIDs, deduplicação, migração do glossário, compatibilidade, disponibilidade, rollout, rollback/integridade e futura divisão em specs.
- **Limite:** documentação e inspeção read-only; nenhum código, migration, dado, deploy ou spec executável criada.
- **Já provado:** implementações e APIs atuais auditadas; bancos beta/prod medidos; D096–D098 firmes.
- **Falta:** fechar recomendações, alternativas rejeitadas, contratos conceituais, gates mensuráveis, perguntas realmente abertas e sequência futura.

## Antes de alterar

- T0 e T1 pertinentes já lidos nesta conversa.
- D096: unificação em um banco/catálogo canônico e gerenciamento único é requisito firme.
- Auditar materialmente `apps/mesas` e `apps/glossario`; documentação não substitui código.
- Comparar dados, schemas, APIs, telas admin, consumidores, IDs, aliases e edições.
- Definir opções de ownership/localização/contrato, migração, rollout e rollback.
- Preservar mudanças locais alheias em `apps/mesas`.

## Estado

## Evidência

- Código/schema/rotas/admin/consumidores auditados em mesas e glossário.
- API bundle consultado para rotas de sistemas dos dois apps.
- VM read-only: containers e bancos beta/prod inspecionados por `SELECT`.
- Mesas prod: 1.265 nós, 407 aliases; glossário prod: 12 sistemas, 17 edições, 8.795 termos com sistema.
- UUIDs divergem para slugs iguais; catálogo não pode migrar por UUID.
- Opções A–E comparadas; serviço dedicado recomendado.

## Estado

Investigação profunda concluída. Nenhum código, migration, banco, API, deploy, commit ou push.

## Retomada concluída

- Ownership: serviço independente, gerido principalmente pelo Site/sidebar; todos os projetos consumidores podem ajustar/alimentar pelo mesmo contrato.
- Host: serviço dentro do `artificiorpg.com`, sem hostname técnico separado.
- Leitura e escrita: integrais no serviço central; sem cópias/projeções locais.
- Modelo: árvore tipada, nomes localizados, aliases contextuais, lifecycle, merge/redirect.
- Fronteira: cenários e demais taxonomias ficam fora.
- Governança: sugestões, capacidades e auditoria centrais.
- Migração: Mesas é fonte principal correta; Glossário terá mapa manual item por item e migração dos termos.
- Compatibilidade: fachadas mantêm APIs atuais até telemetria de uso zero.
- Operação: dependência direta do serviço central; falha controlada, sem catálogo alternativo.
- Rollout: beta completo, ensaio de rollback, depois prod pela esteira canônica.
- Ciclo: Spec 062 terá duas etapas com fases próprias — investigação e código.
- Registros: nunca apagar nem arquivar; item substituído precisa ser mesclado em outro.
- Investigação aprovada; próxima fase é detalhar a Etapa II antes de código.

## Limitação de evidência

- SSH read-only adicional não executou nesta retomada porque `ssh.exe` ficou indisponível no ambiente do comando.
- Contagens reais e divergências já estavam provadas na inspeção anterior da mesma sessão.
- Código, schemas, APIs, importadores e fonte JSON local foram reinspecionados; nenhum número novo de banco foi inventado.

## Mapas

- `specs/README.md`, `specs/backlog.md`, `project-state.md` e Spec 061 sincronizados.

## Decisão do mantenedor — administração

- Gestão principal/completa no admin do `site`, pela sidebar.
- Mesas, glossário e downloads também podem administrar no próprio contexto.
- Toda escrita usa o mesmo serviço/API, permissões, validações e auditoria.
- Não haverá bancos ou CRUDs concorrentes.
- D097 registrada.

## Decisão do mantenedor — glossário

- Subsistema de sistemas/edições pode ser reescrito por completo.
- Escopo: 12 sistemas + 17 edições, CRUD/schema/admin.
- Fora: reescrever o glossário inteiro ou demais domínios.
- Gate: preservar 8.795 termos via mapa UUID legado→canônico, backfill, órfãos zero e rollback.
- D098 registrada.

## Encerramento formal da Etapa I

- Auditoria final não encontrou pergunta arquitetural bloqueante restante.
- Entregas completas: inventário Mesas/Glossário; consumidores; divergências; alternativas; decisão D099; modelo conceitual; permissões; UUIDs; migração; compatibilidade; disponibilidade; beta/prod; rollback; provas.
- Cabeçalho, plano, tasks, backlog, estado do projeto e F-1 da Spec 061 sincronizados.
- Etapa I encerrada e aprovada. Etapa II não iniciada.
- Próximo passo exclusivo: I0 transformar decisões em plano executável verificável. Nenhum código autorizado ou produzido nesta retomada.
