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

## Retomada 2026-07-09 — iniciar I0b.1-I0b.2

- Pedido do mantenedor: iniciar I0b.1-I0b.2.
- Escopo autorizado nesta retomada: backup/auditoria read-only dos bancos `mesas_rpg` beta/prod e confirmação da query de contaminados vs irregulares; nenhum SQL write, migration, deploy, commit ou push.
- T0 já lido neste chat; T1 pertinente lido antes de agir: `AGENTS.md`, `docs/agents/infra-map.md`, `docs/agents/deploy-runbook.md`, `.specify/memory/errors.md`.
- Ferramentas usadas/planejadas: Serena já inicializado; `artificio-api-governance` já consultado para rotas; `codebase-memory-mcp` já consultado; shell via `rtk proxy` quando PowerShell exigir cmdlet.
- Plano curto:
  1. Confirmar estado read-only da VM/containers de `mesas-db` e `mesas-beta-db`.
  2. Gerar dumps read-only em `C:\projetos\artificiobackup` sem imprimir segredos.
  3. Rodar query read-only em beta e prod para contar nós por tipo, contaminados por prefixo de pai e irregulares.
  4. Registrar evidência e comparar com baseline da spec.

## I0b.1-I0b.2 — evidência

- VM read-only: `mesas-db` e `mesas-beta-db` estavam healthy.
- Backups read-only salvos:
  - `C:\projetos\artificiobackup\spec-062\mesas_prod_20260709-132037.sql` — 5.060.121 bytes — SHA256 `227D1F9B3EF4A0848950BAD155AA392CDDBF95EB5C747BAD9A9856D3A43AD803`.
  - `C:\projetos\artificiobackup\spec-062\mesas_beta_20260709-132037.sql` — 5.200.707 bytes — SHA256 `E5048F0767050CBCB32AF78B3AE271B0847AFB62CAF996AA573082E775E8223D`.
- Auditoria prod (`mesas-db`): 688 `system`, 392 `edition`, 187 `variant`; 579 nós com pai; 573 contaminados por prefixo de pai; 6 irregulares.
- Irregulares prod:
  - `Dungeons & Dragons` → `Advanced Dungeons & Dragons` (`edition`).
  - `Vampiro` → `Vampire 1e`, `Vampire 2e`, `Vampire 5e`, `Vampire Anniversary` (`edition`).
  - `Dungeons & Dragons 3.5e` → `Dungeons & Dragons 3.0` (`variant`).
- Auditoria beta (`mesas-beta-db`): 697 `system`, 402 `edition`, 189 `variant`, 1 `subsystem`; 592 nós com pai; 577 contaminados por prefixo de pai; 15 irregulares.
- Irregulares beta:
  - `CAIN` → `1.3`; `Call of Cthulhu` → `7e`; `Dungeons & Dragons` → `Advanced Dungeons & Dragons`; `Mutants & Masterminds` → `Mutants And Masterminds`; `Pokerole` → `3e`; `Starfinder Roleplaying Game` → `2e`; `The One Ring Roleplaying Game` → `2e`.
  - `Vampiro` → `Vampire 1e`, `Vampire 2e`, `Vampire 5e`, `Vampire Anniversary`.
  - `3D&T` → `3DeT Victory` (`subsystem`).
  - `Dungeons & Dragons 3.5e` → `Dungeons & Dragons 3.0`; `Dungeons & Dragons 5e` → `Dungeons & Dragons 2014`, `Dungeons & Dragons 2024`.
- Diferença relevante vs texto anterior da spec: beta não tem só 1 irregular; tem 15. `plan.md` e `tasks.md` corrigidos.
- Status: I0b.1 e I0b.2 fechadas; próximo passo é I0b.3-I0b.4 (migration manual-risk planejada + fila de revisão manual), ainda sem autorização para SQL write.

## Decisão do mantenedor — fonte real da 062

- Prod é a fonte material principal e real para o catálogo canônico da Spec 062.
- Dev/beta é ambiente de implementação, ensaio e deploy inicial até centralizar e implementar o serviço.
- Divergências beta ajudam a validar migration/deploy, mas não competem com prod nem mudam a curadoria principal.
- D109 registrada em `.specify/memory/decisions.md`.
- Ajuste aplicado: `plan.md` e `tasks.md` agora tratam os 6 irregulares prod como fila canônica principal; os 15 irregulares beta ficam como fila operacional de ensaio/dev.

## Retomada 2026-07-09 — I0b.3

- Pedido do mantenedor: criar a migration `manual-risk` que corrige automaticamente só os contaminados do prod pelo padrão seguro `child.name = parent.name || ' ' || nome_proprio`.
- Escopo desta etapa: arquivo de migration local + documentação; nenhuma aplicação em VM/DB, nenhum deploy, commit ou push.
- Regra D109: prod governa a curadoria; a migration deve ser orientada pelo padrão prod, mas precisa continuar executável em dev/beta para ensaio.
- Antes de editar: confirmar último número de migration em `apps/mesas/database` e copiar header válido.

## I0b.3 — migration criada localmente

- Arquivo: `apps/mesas/database/migration_142_fix_system_child_names.sql`.
- Header: `manual-risk`, `requires-backup: true`, `author: spec-062`, `created: 2026-07-09`, `description` preenchido.
- Operação: sem `BEGIN`/`COMMIT` interno, porque o runner oficial `apply_required_migrations.sh` já envolve cada arquivo e o registro em `schema_migrations` numa única transação. A migration calcula candidatos por predicado literal `left(child.name, length(parent.name) + 1) = parent.name || ' '` (sem `LIKE`/wildcards) e `length(child.name) > length(parent.name) + 1`, atualiza `systems.name` para `btrim(substring(child.name FROM length(parent.name) + 2))`.
- Guards: aborta se algum nome ficaria vazio; aborta se quantidade de candidatos divergir da quantidade atualizada; emite `RAISE NOTICE` com a quantidade corrigida.
- Intenção prod: corrigir os 573 contaminados confirmados por I0b.2; os 6 irregulares prod ficam fora por não casarem no padrão e seguem para I0b.4.
- Validação read-only da lógica exata:
  - Prod: `prod_candidates=573`, `prod_empty_clean_names=0`, `prod_irregular=6`.
  - Beta: `beta_candidates=577`, `beta_empty_clean_names=0`, `beta_irregular=15`.
- Correção de risco feita durante a revisão: a versão final usa `left(child.name, length(parent.name) + 1) = parent.name || ' '` em vez de `LIKE parent.name || ' %'`, para não tratar `%`/`_` em nome de sistema como wildcard. Revalidação read-only em prod/beta manteve exatamente as mesmas contagens: prod `573|0|6`; beta `577|0|15`.
- Correção de risco de runner: a migration **não** abre `BEGIN`/`COMMIT` interno. O runner oficial `scripts/deploy/apply_required_migrations.sh` já aplica cada arquivo dentro de `BEGIN`/`COMMIT` e registra `schema_migrations` no mesmo bloco; transação interna quebraria essa atomicidade operacional.
- Validação local: `bash -n scripts/deploy/lib_migrations.sh`, `bash -n scripts/deploy/apply_required_migrations.sh`, `parse_header`, `validate_sql_against_class ... manual-risk` e `bash scripts/deploy/test_migration_guard.sh` verdes (`migration_guard_selftest: 39/39 passaram`).
- Risco operacional descoberto: deploy normal **não aplica** migration `manual-risk` pendente, porque `apply_required_migrations.sh` exige `ALLOW_MANUAL_MIGRATIONS=true` e, por padrão, `PROD_BACKUP_FILE` existente quando `REQUIRE_PROD_BACKUP_FOR_MANUAL=true`. O workflow `_deploy-module.yml` cria snapshot predeploy, mas não exporta essas variáveis para o script de migrations. Portanto I0b.3 precisa de aplicação manual/aprovada pelo runner oficial com env explícito, ou ajuste deliberado do workflow; não pode ser tratado como deploy automático comum.
- Execução em banco real: pendente de aprovação nominal; nada aplicado nesta etapa.

## I0b.3 — aplicação beta/dev executada

- Pedido do mantenedor: preparar e já executar o procedimento de aplicação I0b.3 em beta/dev usando runner oficial, backup visível no ambiente, rollback e comando exato.
- Escopo executado: **somente beta/dev** (`mesas-beta-db` / `/opt/artificio-beta` / `COMPOSE_PROJECT=mesas-beta`). Prod não tocado.
- Tentativas protegidas:
  - Primeira tentativa abortou antes de SQL write efetivo porque o backup foi gerado dentro do container (`pg_dump -f /tmp/...`) e não ficava visível ao guard do runner no host. Corrigido para `docker exec ... pg_dump -Fc > /tmp/...dump`.
  - Segunda tentativa abortou por `docker compose` no clone/projeto errado (`/opt/artificio`, sem `COMPOSE_PROJECT=mesas-beta`). Corrigido para `/opt/artificio-beta` + `COMPOSE_PROJECT=mesas-beta`.
  - Terceira tentativa abortou por drift porque o diretório temporário continha só `migration_142`; o guard exige que migrations já aplicadas também existam no disco. Corrigido para cópia temporária completa de `/opt/artificio-beta/apps/mesas/database` + adição da `142`.
- Aplicação efetiva:
  - Backup VM-local visível ao runner: `/tmp/artificio-mesas-beta-i0b3-pre-20260709-143715.dump` — 1.5M — SHA256 `3eb7ffc055ca27616033c2449d7f6f9f5d1341b4efd454692233475e5e13b85a`.
  - Runner: `COMPOSE_PROJECT=mesas-beta ALLOW_MANUAL_MIGRATIONS=true PROD_BACKUP_FILE=/tmp/artificio-mesas-beta-i0b3-pre-20260709-143715.dump bash scripts/deploy/apply_required_migrations.sh apps/mesas/docker-compose.beta.yml mesas-beta-db mesas_rpg admin <copia-temporaria-completa-das-migrations>`.
  - Resultado: `migration_142: 577 nomes de sistemas filhos corrigidos`; `INSERT 0 1`; `COMMIT`; `schema em conformidade`.
  - Para evitar drift futuro, a migration também foi copiada para `/opt/artificio-beta/apps/mesas/database/migration_142_fix_system_child_names.sql` e o runner no diretório real retornou `schema em conformidade`.
- Validação pós:
  - `schema_migrations` beta: `migration_142_fix_system_child_names.sql = 1`.
  - Detector pós-migration: `counts=1|0|591`. O 1 remanescente foi investigado: `Time` → `Time Again`, caso legítimo de nome próprio que começa com o nome do pai, não sujeira a corrigir. Simulação read-only em prod mostra o mesmo falso positivo residual esperado.
  - Health beta: `mesas-beta-app`, `mesas-beta-api`, `mesas-beta-db` healthy; health interno da API `api_health_rc=0`.
- Rollback beta, se necessário e aprovado nominalmente: restaurar o dump VM-local para `mesas-beta-db` com serviço parado/isolado conforme runbook, por exemplo `cat /tmp/artificio-mesas-beta-i0b3-pre-20260709-143715.dump | docker exec -i mesas-beta-db pg_restore -U admin -d mesas_rpg --clean --if-exists --no-owner` **somente após aprovação explícita**, preferencialmente com parada controlada da API para evitar escrita concorrente.
- Status: I0b.3 aplicada e validada em beta/dev. Prod ainda pendente de plano/aprovação nominal própria.

## I0b.3 — aplicação prod executada

- Pedido do mantenedor: realizar a ordem segura de I0b.3 em prod.
- Escopo executado: **prod Mesas** (`mesas-db` / `/opt/artificio` / `COMPOSE_PROJECT=mesas`). WordPress, DNS raiz e demais apps não tocados.
- Guard pré-execução:
  - `schema_migrations` prod para `migration_142_fix_system_child_names.sql`: `0`.
  - Contagem pré-prod: `573|0|6`; se divergisse, o script abortaria.
- Backup VM-local visível ao runner:
  - `/tmp/artificio-mesas-prod-i0b3-pre-20260709-162521.dump`
  - Tamanho: 1.5M
  - SHA256: `44d947913ec88505a5db7bdff9fccab27ad7126c153510425ec2114ac16dee75`.
- Execução:
  - Migration copiada para `/opt/artificio/apps/mesas/database/migration_142_fix_system_child_names.sql` antes do runner, para evitar drift disco↔banco.
  - Runner: `COMPOSE_PROJECT=mesas ALLOW_MANUAL_MIGRATIONS=true PROD_BACKUP_FILE=/tmp/artificio-mesas-prod-i0b3-pre-20260709-162521.dump bash scripts/deploy/apply_required_migrations.sh apps/mesas/docker-compose.prod.yml mesas-db mesas_rpg admin apps/mesas/database`.
  - Resultado: `migration_142: 573 nomes de sistemas filhos corrigidos`; `INSERT 0 1`; `COMMIT`; `schema em conformidade`.
- Validação pós:
  - `schema_migrations` prod: `migration_142_fix_system_child_names.sql = 1`.
  - Detector pós-migration: `1|0|578`.
  - Residual investigado/listado: `Time -> Time Again`, falso positivo legítimo já previsto por simulação.
  - Health prod: `mesas-app`, `mesas-api`, `mesas-db` healthy; health interno da API `api_health_rc=0`. `mesas-cron` continuou `Up`.
- Rollback prod, se necessário e aprovado nominalmente: restaurar o dump VM-local para `mesas-db` com serviço parado/isolado conforme runbook, por exemplo `cat /tmp/artificio-mesas-prod-i0b3-pre-20260709-162521.dump | docker exec -i mesas-db pg_restore -U admin -d mesas_rpg --clean --if-exists --no-owner` **somente após aprovação explícita**, preferencialmente com parada controlada da API/cron para evitar escrita concorrente.
- Status: I0b.3 fechada em beta/dev e prod. Próximo: I0b.6 (build/lint/smoke visual do catálogo pós-migration em beta) antes de iniciar I0a.

## Retomada 2026-07-09 — I0b.6

- Pedido do mantenedor: realizar I0b.6.
- Escopo: validar build+lint local do `apps/mesas` e smoke beta pós-migration do catálogo antes de liberar I0a.
- Sem código novo planejado; alterações esperadas só em documentação de evidência/status.
- Validações planejadas:
  - `pnpm --filter @artificio/mesas lint`.
  - `pnpm --filter @artificio/mesas build`.
  - Smoke read-only beta: health, `/api/v1/systems?view=tree`, `/catalogo`, contagem residual esperada (`Time -> Time Again`).

## I0b.6 — validação pós-migration beta

- Lint local: `pnpm --filter @artificio/mesas lint` ✅ (`@artificio/mesas-frontend lint`, ESLint exit 0).
- Build local: `pnpm --filter @artificio/mesas build` ✅ (`@artificio/auth`, `@artificio/ui`, `@artificio/mesas-frontend`, `@artificio/mesas-backend`). Observação: Vite manteve aviso não-bloqueante de chunk grande/perf, build exit 0.
- Smoke DB/API beta read-only:
  - `schema_142=1`.
  - Residual pós-migration: `counts=1|0|591`.
  - Residual listado: `Time -> Time Again` (falso positivo legítimo).
  - Amostras de nome próprio: `Dungeons & Dragons` → `5e` existe; `5e` → `2024` existe.
  - Containers `mesas-beta-app`, `mesas-beta-api`, `mesas-beta-db` healthy.
- Smoke público beta:
  - `https://mesasbeta.artificiorpg.com/catalogo` → HTTP 200.
  - `https://mesasbeta.artificiorpg.com/api/v1/systems?view=tree` → HTTP 200, payload 469.612 bytes.
  - Payload: `roots=697`, `dnd=true`, `dnd_5e=true`, `dnd_5e_2024=true`, `dnd_contaminated_string=false`.
  - HTML `/catalogo`: `catalogo_has_root=1`, `catalogo_assets=5`.
- Smoke visual real por Playwright: tentado via `node_repl`, mas bloqueado porque o binário do Chromium não está instalado (`chrome-headless-shell.exe` ausente). Não foi baixado/instalado browser nesta etapa. Cobertura visual ficou por HTTP/DOM/assets sem sessão real.
- Status: I0b.6 fechada. I0a pode iniciar.

## I0a.0 — rota órfã removida

- Pedido do mantenedor: executar próxima parte após I0b.6.
- Escopo executado:
  - Removidos do backend `apps/mesas/backend/src/routes/profile.ts`:
    - `POST /api/v1/profile/me/systems`.
    - `DELETE /api/v1/profile/me/systems/:id`.
  - Mantidos os endpoints ativos:
    - `POST /api/v1/profile/systems`.
    - `DELETE /api/v1/profile/systems/:id`.
  - Removido hook morto `apps/mesas/frontend/src/hooks/useProfile.ts`.
  - Tipos usados por `ProfileEditPage`/`ProfileContext` extraídos para `apps/mesas/frontend/src/types/profileTypes.ts`.
  - `useProfileQuery.ts` passou a reexportar os tipos centrais, evitando duplicação.
- Evidência:
  - `rg "profile/me/systems|/me/systems|hooks/useProfile|useProfile\\(" apps/mesas/frontend/src apps/mesas/backend/src` não encontrou uso legado, só `useProfileQuery` pelo nome próprio.
  - Smoke beta sem sessão da rota mantida: `POST /api/v1/profile/systems` → 401; `DELETE /api/v1/profile/systems/probe` → 401 (rota existe e bate no auth guard, não 404).
  - `pnpm --filter @artificio/mesas lint` ✅.
  - `pnpm --filter @artificio/mesas build` ✅.
  - `pnpm verify:api` ✅; artefatos `docs/api/generated/*` e `docs/api/openapi/mesas.openapi.yaml` regenerados.
- Observações:
  - `verify:api` mostra 2 breaking changes em `mesas`, intencionais: remoção das duas rotas órfãs `/profile/me/systems`.
  - `api:lint` manteve 3 warnings conhecidos de paths ambíguos (1 mesas, 2 glossário).
  - Defeito de ferramenta descoberto/confirmado: `docs/api/generated/api-diff.generated.md` lista `path.remove` sem path/method para as duas remoções, mesmo após alinhar `refs/heads/dev` com `origin/dev`; registrado no backlog como débito de governança API.
- Status: I0a.0 fechado. Próximo: I0a.1 (`useSystemsCatalog()`).

## I0b.4 — decisão da fila manual prod

- Pedido/decisão do mantenedor:
  - `Advanced Dungeons & Dragons` é edição de `Dungeons & Dragons`.
  - `Vampire` é nome em inglês e `Vampiro` é nome em português do mesmo sistema.
  - `Anniversary` tem nome português `Aniversário`.
  - `Dungeons & Dragons 3.5e` é uma edição; `Dungeons & Dragons 3.0` é outra edição. São irmãs sob `Dungeons & Dragons`, não edição→variante.
- D110 registrada em `.specify/memory/decisions.md`.
- Consequência:
  - `Advanced Dungeons & Dragons` fica como nome próprio legítimo, sem correção automática.
  - Casos `Vampire ...` exigem tratamento por nomes localizados/alias, não pelo update automático por prefixo PT.
  - `Dungeons & Dragons 3.0` precisa correção de hierarquia em etapa própria/manual, não pela migration 142.
- Status: I0b.4 fechada como decisão de curadoria. Qualquer SQL para aplicar esses ajustes ainda depende de plano e aprovação nominal.

## I0a.1 — `useSystemsCatalog()`

- Escopo: criar hook central de catálogo em `apps/mesas/frontend/src/hooks/useSystemsCatalog.ts` sem ainda migrar telas consumidoras.
- Implementado:
  - `SystemTreeNode` ampliado em `apps/mesas/frontend/src/types/systems.ts` para refletir o payload real de `GET /api/v1/systems?view=tree`: `logo_filename`, `website_url`, `children_count`, `tables_count`, `aliases_count`.
  - `useSystemsCatalog()` com cache TTL de 5 min, `forceRefresh`, `invalidateSystemsCatalogCache`, loader exportável `loadSystemsCatalog`, normalização Zod de `unknown`, `tree`, `flat`, `loading` e `error`.
  - `flattenSystemsCatalog()` preserva o nó real e acrescenta `parent`/`ancestors` para busca/seleção futura, sem criar `pathLabel` ou label composto.
  - `apps/mesas/frontend/src/hooks/useSystemsCatalog.test.ts` cobre preservação de **Slug**, **Tipo**, **Aliases**, filhos/edições, **Logo**, **Website Oficial** e contadores; cobre cache/forceRefresh; cobre `loading → dados → erro simulado` no hook.
- Validação:
  - `pnpm --filter @artificio/mesas-frontend test -- src/hooks/useSystemsCatalog.test.ts` ✅ (Vitest rodou a suite frontend e ficou verde: 16 arquivos, 166 testes).
  - `pnpm --filter @artificio/mesas lint` ✅.
  - `pnpm --filter @artificio/mesas build` ✅ (warning conhecido de chunk grande do Vite, não bloqueante).
- Status: I0a.1 fechado. Próximo: I0a.2 (`SystemPicker` v1).

## I0a.2 — `SystemPicker` v1

- Escopo: criar componente novo `apps/mesas/frontend/src/components/SystemPicker.tsx`, ainda sem migrar telas consumidoras.
- Implementado:
  - Modo `single` e `multi` por prop.
  - Mesmo layout para usuário comum e admin; ações variam por `role`.
  - Árvore navegável com chevron/indentação por nível, nome próprio, `nome PT` sempre visível, badge de alias, check e destaque só no nó selecionado.
  - Busca por `name`, `name_pt`, `slug`, `path_slug` e `aliases`, filtrando a árvore com ancestrais visíveis.
  - Bloco de confirmação com caminho completo montado em render (`sistema › edição › variante`), sem campo `pathLabel`/label composto no dado.
  - Ações para busca sem resultado: usuário comum pode `Sugerir`; admin pode `Sugerir` e `Criar agora`; nó existente pode ter editar inline admin via callback.
  - Sem lista plana e sem grid 3 colunas.
- Teste:
  - `apps/mesas/frontend/src/components/SystemPicker.test.tsx`.
  - Cobre render da árvore, nome PT/alias/caminho selecionado, filtro mantendo ancestral, seleção single, ações admin e remoção multi.
- Validação:
  - `pnpm --filter @artificio/mesas-frontend test -- src/components/SystemPicker.test.tsx` ✅ (suite frontend verde: 17 arquivos, 170 testes).
  - `pnpm --filter @artificio/mesas lint` ✅.
  - `pnpm --filter @artificio/mesas build` ✅ (warnings conhecidos do Vite/Rolldown sobre chunk/plugin timings, não bloqueantes).
- Status: I0a.2 fechado. Próximo: I0a.3 (migrar `StepSystem.tsx` para `SystemPicker` single).

## I0a.3 — `StepSystem.tsx` migrado para `SystemPicker`

- Escopo: fluxo de criar mesa, sem mexer ainda em catálogo/perfil/onboarding/Discord.
- Implementado:
  - `apps/mesas/frontend/src/components/form-steps/steps/StepSystem.tsx` trocou `SystemTreeSelector` por `SystemPicker`.
  - Uso: `mode="single"`, `role="user"`, `onSuggest` abrindo o `SystemSuggestionModal` existente.
  - Removido estado local `systemSearch`; busca agora é interna do `SystemPicker`.
  - Callback de seleção preserva o contrato do form pai: `setSelectedSystemId(ids[0] ?? '')`.
  - Fluxo de sugestão mantém comportamento: ao criar sistema no modal, fecha modal, seleciona `createdSystem.id` quando existir e chama `onRefreshSystems()`.
- Validação:
  - `pnpm --filter @artificio/mesas-frontend test -- src/components/SystemPicker.test.tsx` ✅ (suite frontend verde: 17 arquivos, 170 testes).
  - `pnpm --filter @artificio/mesas lint` ✅.
  - `pnpm --filter @artificio/mesas build` ✅ (warning conhecido de chunk grande do Vite, não bloqueante).
- Status: I0a.3 fechado. Próximo: I0a.4 (`CatalogoPage.tsx`).

## I0a.4 — `CatalogoPage.tsx` migrada para `useSystemsCatalog()` + `SystemPicker`

- Escopo: filtro de sistema do catálogo público, desktop e drawer mobile.
- Implementado:
  - `apps/mesas/frontend/src/pages/CatalogoPage.tsx` removeu `SystemAutocomplete`.
  - Removido fetch local cru de `GET /api/v1/systems?view=tree`, `systemsTreeReloadKey`, `setSystemsTree` e normalização local.
  - Página agora usa `useSystemsCatalog()` para `tree`, `flat`, `loading`, `error` e `forceRefresh`.
  - Mapas id→slug e id→nome derivam de `flat`.
  - Desktop e mobile usam `SystemPicker` em `mode="single"`/`role="user"`.
  - `handleSystemSelect` continua convertendo id selecionado para `filters.system` por slug e mantendo `trackFilterSistema`.
- Evidência:
  - `rg "SystemAutocomplete|fetch\\('/api/v1/systems|systemsTreeReloadKey|setSystemsTree" apps/mesas/frontend/src/pages/CatalogoPage.tsx` sem matches.
- Validação:
  - `pnpm --filter @artificio/mesas-frontend test -- src/components/SystemPicker.test.tsx src/hooks/useSystemsCatalog.test.ts` ✅ (suite frontend verde: 17 arquivos, 170 testes).
  - `pnpm --filter @artificio/mesas lint` ✅.
  - `pnpm --filter @artificio/mesas build` ✅ (warning conhecido de chunk grande do Vite, não bloqueante).
- Status: I0a.4 fechado. Próximo: I0a.5 (`UserSystemsSelector.tsx`).

## I0a.5 — `UserSystemsSelector.tsx` migrado para `useSystemsCatalog()` + `SystemPicker`

- Escopo: seletor de sistemas do perfil (`favorite` e `gm`), usado em `ProfileEditPage.tsx`.
- Implementado:
  - `apps/mesas/frontend/src/components/UserSystemsSelector.tsx` agora usa `useSystemsCatalog()` para `tree`, `loading`, `error` e `forceRefresh`.
  - Troca `SystemTreeSelector` por `SystemPicker` em `mode="multi"`/`role="user"`.
  - Removidos fetch cru, `VITE_API_URL`, estado local de árvore/loading/busca, `console.log`, `showError` local e busca manual `findSystem`.
  - `onSelectionChange` reconcilia o array novo contra `selectedSystemIds`: ids removidos chamam `onRemove`, ids adicionados chamam `onAdd`, preservando contrato dos mutations do perfil.
  - CSS ganhou botão simples de retry para erro do catálogo.
- Evidência:
  - `rg "fetch\\(|SystemTreeSelector|showError|console\\.log|VITE_API_URL|SystemTreeNode" apps/mesas/frontend/src/components/UserSystemsSelector.tsx` sem matches.
- Validação:
  - `pnpm --filter @artificio/mesas-frontend test -- src/components/SystemPicker.test.tsx src/hooks/useSystemsCatalog.test.ts` ✅ (suite frontend verde: 17 arquivos, 170 testes).
  - `pnpm --filter @artificio/mesas lint` ✅.
  - `pnpm --filter @artificio/mesas build` ✅ (warning conhecido de chunk grande do Vite, não bloqueante).
- Status: I0a.5 fechado. Próximo: I0a.6 (`OnboardingPage.tsx`).

## I0a.6 — `OnboardingPage.tsx` migrado para `useSystemsCatalog()` + `SystemPicker`

- Escopo: trocar o seletor de sistemas do onboarding do `SystemTreeSelector` legado para o catálogo central.
- Alterações:
  - `apps/mesas/frontend/src/pages/OnboardingPage.tsx` agora usa `useSystemsCatalog()` para `tree`, `flat`, `loading`, `error` e `forceRefresh`.
  - Troca `SystemTreeSelector` por `SystemPicker` em `mode="multi"`/`role="user"`.
  - Remove `systems_tree` do contrato consumido de `/api/v1/me/options`; o payload agregado continua responsável apenas por tags/plataformas do onboarding.
  - Remove `flattenSystemTree` e estado local de busca; o resumo da confirmação usa `systemsFlat` do hook para id→nome.
- Validação:
  - `rg "SystemTreeSelector|systems_tree|systemSearch|flattenSystemTree" apps/mesas/frontend/src/pages/OnboardingPage.tsx` sem matches.
  - `pnpm --filter @artificio/mesas-frontend test -- src/components/SystemPicker.test.tsx src/hooks/useSystemsCatalog.test.ts` ✅ (suite frontend verde: 17 arquivos, 170 testes).
  - `pnpm --filter @artificio/mesas lint` ✅.
  - `pnpm --filter @artificio/mesas build` ✅.
- Status: I0a.6 fechado. Próximo: I0a.7 (`SystemSuggestionModal.tsx`).

## I0a.7 — `SystemSuggestionModal.tsx` migrado para `useSystemsCatalog()`

- Escopo: remover o fetch próprio de árvore do modal de sugestão/criação de sistema.
- Alterações:
  - `apps/mesas/frontend/src/components/SystemSuggestionModal.tsx` agora usa `useSystemsCatalog()` para `tree`, `loading`, `error` e `forceRefresh`.
  - Removidos `authGet('/api/v1/systems?view=tree')`, `systemsTree` local, `setSystemsTree`, `systemsLoading`/`systemsError` locais e o tipo local duplicado de nó.
  - `flattenSystems` agora recebe `SystemTreeNode[]` canônico.
  - Select de sistema pai mantém loading/error e ganhou retry via `forceRefresh()`.
  - Envio continua separado via `authPost`, preservando comportamento admin (`/api/v1/systems/admin`) e usuário comum (`/api/v1/system-suggestions`).
- Validação:
  - `rg "authGet|setSystemsTree|systems_tree|fetchSystemsTree" apps/mesas/frontend/src/components/SystemSuggestionModal.tsx` sem matches.
  - `pnpm --filter @artificio/mesas-frontend test -- src/test/suggestionModals.test.tsx src/hooks/useSystemsCatalog.test.ts` ✅ (suite frontend verde: 17 arquivos, 170 testes).
  - `pnpm --filter @artificio/mesas lint` ✅.
  - `pnpm --filter @artificio/mesas build` ✅.
- Status: I0a.7 fechado. Próximo: I0a.8 (restringir `SystemTreeSelector` ao admin de catálogo).

## I0a.8 — `SystemTreeSelector` removido das telas finais

- Escopo: garantir que o grid legado `SystemTreeSelector` não seja mais consumido por telas de usuário final.
- Investigação:
  - `rg "from ['\"].*SystemTreeSelector|<SystemTreeSelector" apps/mesas/frontend/src` não encontrou imports/uso real.
  - O admin de catálogo não usa `SystemTreeSelector`; usa `CatalogTree`/`CatalogTreeNode`.
  - `DraftEditorTab.tsx` continua fora do escopo desta task: não usa `SystemTreeSelector`, usa `SystemSearchSelect` próprio e será tratado em I0a.9.
- Alterações:
  - Removido `apps/mesas/frontend/src/components/SystemTreeSelector.tsx`, pois não havia consumidor admin restante e manter o arquivo morto permitiria regressão acidental.
  - Limpado comentário obsoleto em `apps/mesas/frontend/src/components/SystemAutocomplete.tsx`.
- Validação:
  - `rg "from ['\"].*SystemTreeSelector|<SystemTreeSelector" apps/mesas/frontend/src` sem matches.
  - `Test-Path apps/mesas/frontend/src/components/SystemTreeSelector.tsx` → `False`.
  - `pnpm --filter @artificio/mesas-frontend test -- src/components/SystemPicker.test.tsx src/hooks/useSystemsCatalog.test.ts src/test/suggestionModals.test.tsx` ✅ (suite frontend verde: 17 arquivos, 170 testes).
  - `pnpm --filter @artificio/mesas lint` ✅.
  - `pnpm --filter @artificio/mesas build` ✅.
- Status: I0a.8 fechado. Próximo: I0a.9 (moderação de drafts Discord para `useSystemsCatalog()` + `SystemPicker`).

## I0a.9 — Moderação de drafts Discord migrada para `useSystemsCatalog()` + `SystemPicker`

- Escopo: trocar o fluxo de seleção de sistema no editor de drafts Discord (staff/revisor) para o catálogo central e o mesmo componente visual das demais telas.
- Alterações:
  - `apps/mesas/frontend/src/features/discord-sync/useDraftForm.ts` agora usa `useSystemsCatalog()` para `tree`, `flat`, `loading`, `error` e `forceRefresh`.
  - `handleSystemChange` busca o nome na view `flat` do hook central, preservando `knownName` para sistema recém-criado pelo modal.
  - `apps/mesas/frontend/src/features/discord-sync/components/DraftEditorTab.tsx` trocou `SystemSearchSelect` por `SystemPicker` em `mode="single"`/`role="admin"`, com ações de sugerir/criar apontando para o modal existente.
  - `apps/mesas/frontend/src/features/discord-sync/components/DiscordDraftPreview.tsx` repassa `systemsError` para a aba.
  - `apps/mesas/frontend/src/features/discord-sync/draftFormUtils.ts` perdeu o loader/cache/schema duplicado de sistemas (`loadSystems`); catálogos simples de cenário/VTT/comunicação continuam no helper.
  - Removido `apps/mesas/frontend/src/features/discord-sync/components/SystemSearchSelect.tsx`.
- Validação:
  - `rg "SystemSearchSelect|loadSystems|flattenSystems\\(" apps/mesas/frontend/src/features/discord-sync` sem matches do fluxo legado.
  - `pnpm --filter @artificio/mesas-frontend test -- src/features/discord-sync/useDraftForm.test.ts src/features/discord-sync/components/DraftEditorTab.test.tsx src/features/discord-sync/draftFormUtils.test.ts src/components/SystemPicker.test.tsx src/hooks/useSystemsCatalog.test.ts` ✅ (5 arquivos, 52 testes).
  - `pnpm --filter @artificio/mesas lint` ✅.
  - `pnpm --filter @artificio/mesas build` ✅.
- Status: I0a.9 fechado. Próximo: fim do PR 1 conforme task list, com commit/push somente mediante autorização nominal.

## Review PR #143 — counts do catálogo

- Achado do `chatgpt-codex-connector` procede: `COUNT(DISTINCT ...)` vindo do Postgres pode chegar como string (`int8`) no payload real de `GET /api/v1/systems?view=tree`, enquanto `useSystemsCatalog()` validava `children_count`, `tables_count` e `aliases_count` com `z.number()`.
- Correção local: `apps/mesas/frontend/src/hooks/useSystemsCatalog.ts` passou esses 3 campos para `z.coerce.number().optional()`.
- Teste local: `apps/mesas/frontend/src/hooks/useSystemsCatalog.test.ts` agora injeta os contadores como string no payload e confirma saída numérica normalizada.
- Validação:
  - `pnpm --filter @artificio/mesas-frontend test -- src/hooks/useSystemsCatalog.test.ts` ✅ (suite frontend: 17 arquivos, 170 testes).
  - `pnpm --filter @artificio/mesas lint` ✅.
  - `pnpm --filter @artificio/mesas build` ✅ (warning conhecido de chunk grande do Vite, não bloqueante).
- Status: fix aplicado localmente; commit/push para atualizar a PR #143 aguardam aprovação nominal separada.

## Review PR #143 — CatalogoPage/SystemPicker/retry

- Achados de review procedem:
  - `CatalogoPage.tsx` duplicava o bloco loading/erro/`SystemPicker` entre desktop e mobile.
  - `SystemPicker.tsx` tinha input de busca com `placeholder`/`id`, mas sem nome acessível programático.
  - `useSystemsCatalog().forceRefresh()` relançava erro depois de atualizar `state.error`, gerando risco de `unhandled rejection` em handlers `onClick`.
- Correções locais:
  - Extraído `CatalogSystemFilter` local em `CatalogoPage.tsx`, preservando `idPrefix` e a cor de loading específica desktop/mobile.
  - Adicionado `aria-label={searchPlaceholder}` ao input de busca do `SystemPicker`.
  - `forceRefresh()` agora captura a falha e resolve `undefined`; `loadSystemsCatalog()` continua lançando para callers/testes que precisam de erro bruto. Tipo `SystemsCatalogResult.forceRefresh` atualizado.
  - Teste do hook atualizado para confirmar que `forceRefresh()` não rejeita e ainda grava `state.error`.
- Validação:
  - `pnpm --filter @artificio/mesas-frontend test -- src/hooks/useSystemsCatalog.test.ts src/components/SystemPicker.test.tsx` ✅ (suite frontend: 17 arquivos, 170 testes).
  - `pnpm --filter @artificio/mesas lint` ✅.
  - `pnpm --filter @artificio/mesas build` ✅ (warning conhecido de chunk grande do Vite, não bloqueante).
- Status: fixes aplicados localmente; commit/push para atualizar a PR #143 aguardam aprovação nominal separada.

## Review PR #143 — SonarCloud

- Achados SonarCloud procedem e foram corrigidos localmente:
  - `SystemPickerProps` virou `Readonly<...>`.
  - Ternário de badge de alias e label de expandir/recolher extraídos para statements/helpers independentes.
  - `useSystemsCatalog.ts` passou a lançar `TypeError` para payload de catálogo em formato inesperado.
  - `CatalogoPage.tsx` removeu ternários sinalizados no bloco de seleção/render: `selectedIds` saiu para helper, empty state saiu para `CatalogEmptyState`, e cards/skeletons saíram para `renderTableCards`.
  - Mock visual `sessoes/assets/062-systempicker-arvore-mock.html` ganhou `id` no input e `label` associado visualmente oculto.
- Validação:
  - `pnpm --filter @artificio/mesas-frontend test -- src/hooks/useSystemsCatalog.test.ts src/components/SystemPicker.test.tsx` ✅ (suite frontend: 17 arquivos, 170 testes).
  - `pnpm --filter @artificio/mesas lint` ✅.
  - `pnpm --filter @artificio/mesas build` ✅ (warning conhecido de chunk grande do Vite, não bloqueante).
- Status: fixes aplicados localmente; commit/push para atualizar a PR #143 aguardam aprovação nominal separada.
