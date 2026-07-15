# Sessão 26-07-15 — Spec 078: sistemas centrais e projeção Mesas Beta

## Objetivo

Criar spec dedicada e plano completo. Nenhuma implementação runtime nesta abertura.

## Decisões do mantenedor

- Catálogo/dados Mesas e sistemas de RPG são domínios distintos.
- Central significa somente sistemas de RPG no Site Prod.
- Mesas Prod usa o Central.
- Mesas Beta mantém sistemas localmente e hidrata do Central.
- Upsert aditivo: atualiza existentes, insere ausentes, preserva extras Beta e UUID central; zero delete.
- Mesas Prod hidrata mesas/usuários para Beta, excluindo sistemas RPG.
- Runtime Beta inteiro usa mesma projeção local.
- Criação/manipulação passa por abstração única.
- Onboarding e draft JSON serão unificados com capacidades mais maduras/recentes de ambos.

## Auditoria de origem

- `adminEnrichment.ts` sincroniza systems/aliases/suggestions e resolve mesa por legado.
- Parser (`discord/shared.ts`), onboarding/preferências (`routes/me.ts`), grupos (`routes/gm.ts`) e DDAL (`tableService.ts`) consultam legado.
- `/systems`, CRUD e hidratação visual já usam API central.
- Spec 062 dizia “sem projeções”; D114/078 cria exceção consciente para Mesas Beta.
- IDs existentes exigem auditoria: colisão slug com UUID diferente nunca pode ser automática.

## Artefatos

- `specs/078-mesas-sistemas-central-hidratacao/` completo.
- T0 (`project-state`, `decisions`), backlog, README, índice de sessões.
- Nota de superação parcial na Spec 062.

## Estado

Planejamento completo. Próximo gate: Fase 0 material. Sem commit/push/deploy.

## Fase 0 material — início

- Autorização do mantenedor: iniciar execução.
- Ordem: inventário reads/writes → referências UUID → fluxos onboarding/draft
  JSON → matriz comparativa → checkpoint `tasks` + `project-state`.
- Trava: nenhum código runtime antes do checkpoint material da Fase 0.

## Fase 0 material — concluída

- Reads/writes inventariados. Ponto comum do parser é
  `loadSystemsForParser`, usado por Discord, JSON/texto, batch, reparse e
  learning; hoje consulta `systems/system_aliases` locais.
- Onboarding já usa `SystemPicker/useSystemsCatalog` no frontend, mas
  `/me/options` e `/me/preferences` ainda leem/validam local. Perfil usa UI e
  validação Central, porém `user_systems` ainda tem FK local.
- Grupos fechados e DDAL consultam local. `/systems`, CRUD de sistemas,
  candidatos de sugestões e hidratação visual consultam Central.
- Hidratação Mesas Prod→Beta inclui `systems`, aliases e sugestões, além de
  resolver `tables.system_id` por slug local. Deve excluir o domínio RPG.
- Referências mapeadas em UUID/UUID[], drafts/candidatos JSONB e learning.
  `tables.system_id` não tem mais FK; `user_systems` e resolução de sugestões
  ainda têm.
- Central já possui snapshot versionado/checksum/ETag com árvore e aliases.
  Site armazena ID como TEXT e Mesas como UUID: ID não-UUID aborta.
- Matriz registrada na spec: UI base compartilhada já existe; motor de
  candidatos vem do parser/scorer; onboarding permanece escolha explícita e
  não recebe extração de anúncio.
- Checkpoint atualizado em `tasks.md`, `plan.md` e `project-state.md`.

## Fase 1 — início

- Gate F0 satisfeito.
- Próximo trabalho: especificar interface única e selecionar adapter por
  ambiente, fail-closed, preservando fachadas públicas.
- Nenhuma implementação F1 feita neste checkpoint.

## Fase 1 — reader implementado, writer bloqueado

- Criado `systemCatalogProvider.ts`: interface única de leitura, adapter
  Central e adapter local.
- Fonte resolvida por `APP_ENV`: production/prod = Central; beta/local/test =
  local. Production sem valor válido aborta; não há fallback silencioso.
- Adapter local monta flat/tree com aliases, contagem de mesas e rejeita pai
  órfão.
- Validação: teste focado 5/5; lint e build do backend Mesas verdes;
  `git diff --check` verde.
- Bloqueio material: Central tem status/merge/redirect; `systems` local não.
  `user_systems` ainda tem `ON DELETE CASCADE`, então hard delete perde
  preferências. Snapshot Central traz só ativos, logo ausência é ambígua entre
  extra Beta e central arquivado/mesclado.
- Fase 2 não iniciada. Requer decisão de lifecycle/redirect da projeção.

## Decisão do mantenedor — lifecycle

- Aprovada solução principal recomendada.
- Projeção local registra origem, status, destino de merge e versão Central.
- Archive/merge é soft; IDs e referências históricas permanecem.
- Central deve informar inativos/redirects explicitamente.
- Hard delete proibido. Writer F1 liberado; Fase 2 continua aguardando F1.

## Fase 1 — concluída

- Provider único agora cobre leitura e mutação.
- Mesas Prod usa reader/writer Central; Beta usa local. Gate por `APP_ENV`
  continua fail-closed.
- `/systems` e resolução/admin de sugestões preservam endpoints, mas passam
  pela fachada.
- Writer local cria/edita e arquiva soft; não executa hard delete.
- Migration 149 adiciona origem, status, destino de merge, versão e instante
  de sync, com constraints/FK/índices.
- Snapshot Site ganhou `inactive_nodes` e `redirects`; checksum cobre lifecycle.
- Evidência: provider+scorer Mesas 32/32; repo Site 8/8; lint/build backend
  Mesas verdes; build Site verde; diff-check verde. `site lint` é script TODO
  preexistente e não vale como lint real.

## Fase 2 — início

- Gate F1 satisfeito e registrado antes do avanço.
- Implementar snapshot validado, dry-run, upsert topológico, aliases,
  lifecycle, conflitos e idempotência.
- Nenhum comando contra banco real/VM autorizado.

## Fase 2 — implementação concluída

- Snapshot Central é lido do Site Prod por URL dedicada e token interno.
- Endpoint admin existe somente em Beta; dry-run é padrão, apply exige flag.
- Validação integral: UUIDs, count, hierarquia, paths, slugs, lifecycle e
  redirects. Conflito aborta antes da transação.
- Upsert pai→filho atualiza campos/aliases, preserva UUID e extras Beta.
- Lifecycle aplica archive/merge soft. Índices únicos passaram a considerar
  somente nós ativos, preservando histórico sem bloquear substituto.
- Relatório lista IDs por create/update/unchanged/lifecycle/beta_extra.
- Evidência: testes do hidratador 7/7; lint/build backend verdes;
  `verify:api` verde após repetição de lock transitório Windows; diff-check
  verde. Nenhum apply real.

## Fase 3 — início

- Gate F2 registrado antes do avanço.
- Remover domínio RPG da hidratação Mesas Prod→Beta, remover resolução por
  slug legado e exigir projeção atualizada/referências existentes.

## Fase 3 — concluída

- Domínio RPG removido de `SYNC_FIELDS` e `tablesToSync`.
- Join com `systems` Prod e remapeamento de `tables.system_id` por slug local
  removidos; UUID atravessa intacto.
- Guard exige projeção sem mudanças/conflitos antes da transação Mesas.
- Guard valida todas as referências vindas de mesas, `user_systems`, arrays de
  preferência e grupos fechados contra a projeção local.
- PII e dry-run existentes permanecem.
- Evidência: guard+rota 6/6; lint/build backend e diff-check verdes.

## Fase 4 — início

- Gate F3 registrado antes do avanço.
- Migrar parser/JSON, onboarding, preferências, grupos, DDAL e helpers visuais
  para o provider único. Depois provar zero query direta runtime fora adapter,
  hidratador e scripts permitidos.

## Fase 4 — concluída

- Parser Discord/JSON/texto/batch/reparse carrega sistemas pelo provider.
- Onboarding/opções/preferências, perfil, grupos fechados e DDAL usam mesma
  fonte do ambiente.
- Filtros/hidratação visual de mesas e CRUD/sugestões também usam provider.
- Helpers Central-only duplicados removidos de `catalogClient`.
- Busca estática: query local direta só no provider, hidratador/guard e scripts
  permitidos.
- Suíte completa encontrou mock antigo do import esperando duas queries; mock
  atualizado para systems+aliases+counts. Reexecução: 529/529; lint/build e
  diff-check verdes.

## Fase 5 — início

- Gate F4 registrado antes do avanço.
- Matriz F0 já escolheu UI/motor. Falta expor no onboarding o mesmo modal de
  sugestão/criação hierárquica usado no draft e provar equivalência.

## Fase 5 — concluída

- Onboarding usa `SystemPicker` e o mesmo `SystemSuggestionModal` do draft;
  permissões, cadeia hierárquica, refresh e seleção do novo nó foram preservados.
- Normalizador separa token compacto `dnd5`; alias exato único pode identificar
  edição filha direta (`V5`), sem liberar variante que pule edição.
- Migrations Site 010/011 adicionam `3D&T > Victory` e aliases comprovados
  `3DeT`, `OSE`, `V5`, `Lobisomem: O Apocalipse`, com precondições e auditoria.
- Testes focados: scorer + hierarquia 41/41 verdes.
- Auditoria read-only: snapshot Site Prod v1283 + migrations simuladas em memória,
  200 mensagens. Matches 130→137: parte 1 63→66; parte 2 67→71.
- Nomes sem nó/alias confiável permaneceram sem seleção. Parser não inventa
  catálogo nem cria sistema silenciosamente.
- Fase 6 não iniciada: backup e restore-test precedem todo write real.

## Fase 6 — preflight read-only iniciado

- T1 de infra/deploy relido. Bancos-alvo: `site-prod-db/site` (Central) e
  `mesas-beta-db/mesas_rpg` (projeção/runtime Beta).
- Antes de gerar backup: confirmar containers, tamanhos, versões/migrations e
  espaço local. Nenhuma migration/apply/restore em VM autorizado.

## Fase 6 — T6.1 concluída

- Containers saudáveis. Site Prod: 15 MB, catálogo v1283/1.273 nós. Mesas Beta:
  23 MB, 1.289 sistemas/442 aliases. `D:` tinha 206 GB livres.
- Dumps custom-format off-VM em
  `D:\artificiobackup\spec-078\20260715-142510\`.
- `site-prod.dump`: 1.530.970 bytes, SHA-256
  `F01E0545AE3C3DBBE3ED7869013E86071C50C760F756C1F2225642B7A4B3C045`.
- `mesas-beta.dump`: 1.560.640 bytes, SHA-256
  `4501EBD7D18B8045C8FDDB1461C42B6EF88F8FF0BCDF11C71A08D2D1FD31627F`.
- `pg_restore -l` validou ambos: 136 e 640 entradas.
- Docker local indisponível. Restore-test exige ambiente temporário na VM e,
  portanto, autorização nominal antes de qualquer criação/write.

## Fase 6 — T6.2 concluída

- Restore autorizado em `postgres:16-alpine` temporário, isolado e sem portas.
- Ambos os arquivos restauraram com `--exit-on-error`.
- Site origem=cópia: versão 1283, 1.273 nós, 412 aliases, 0 redirects,
  1.283 versões.
- Mesas Beta origem=cópia: 1.289 sistemas, 442 aliases, 18 mesas, 18 usuários,
  20 drafts.
- Constraints não validadas nas duas cópias: zero.
- Container/dados temporários removidos. Bancos reais não alterados.
- Próximo: T6.3 dry-run com dados reais. Apply/migration em cópia é nova ação e
  não herda a autorização do restore-test.

## Fase 6 — T6.3 primeiro dry-run

- Migrations 008 Site e 147/148 Mesas passaram na cópia.
- Migration Site 009 falhou por variáveis `source_id/target_id` ambíguas; nomes
  corrigidos para `v_source_id/v_target_id`; reexecução passou.
- Migration Site 010 repetia a ambiguidade em `parent_id`; corrigida para
  `v_parent_id`; reexecução passou. Site 011 e Mesas 149 também passaram.
- Dry-run real: Central v1286/1.273 ativos versus Beta 1.289 locais produziu
  1.273 creates, 1.289 extras e 1.374 colisões. Causa: UUID legado diferente,
  não conflito semântico.
- `catalog_legacy_mappings` contém 1.269 mappings Prod; 1.264 cobrem os UUIDs
  atuais do Beta e todos apontam para nó Central conhecido; zero destino
  duplicado. Restam 25 nós Beta sem mapping.
- Falha de implementação: snapshot/hidratador não transportavam nem aplicavam
  o mapping previsto em RF5. Corrigir contrato antes de classificar os 25.

## Fase 6 — T6.3 após contrato de mapping

- Snapshot admin Site agora inclui mappings Mesas; snapshot público permanece
  sem detalhes de reconciliação.
- Planejador reconhece remap determinístico, não acusa path/slug ocupado pelo
  próprio legado e não classifica mapped como extra.
- Teste focado do planejador: 8/8.
- Dry-run refinado: 1.264 remaps, 9 creates, 1.264 updates, 25 extras Beta e
  somente 1 conflito residual (`Call of Cthulhu/7e`).
- Mapeamentos semanticamente inequívocos adicionais identificados: 3D&T/Victory,
  CoC/7e, D&D/4e, D&D/5e/2014/2024 e Tormenta/20.
- Extras filhos sem equivalente Central (ex.: D&D 3e, Starfinder 2e, One Ring
  2e) devem ser preservados e reparentados ao pai canônico quando o pai migrar.
- Duas decisões humanas restam: `CAIN` versus `CAIN RPG`; nó edição duplicado
  `Mutants And Masterminds` versus raiz `Mutants & Masterminds`.
- Ambiente temporário removido. Nenhum banco real alterado.

## Decisão D115

- Mantenedor: `CAIN RPG` é sistema; `CAIN` alias. Edição `1.3` preservada.
- Mantenedor: `Mutants & Masterminds` é sistema; `Mutants And Masterminds` alias,
  não edição.
- Implementação liberada: mappings/aliases centrais, referências para UUID
  canônico, IDs antigos soft-merged e filhos Beta extras reparentados.

## Decisão D116 — versão em português

- Mantenedor apontou lacuna: versão/nome em português não estava explícita.
- `name` e `name_pt` são o mesmo nó; localização não cria sistema/edição irmã.
- Correção nominal: `name` é sempre o nome original, seja qual for seu idioma,
  e é o principal/exibido. `name_pt` é só tradução auxiliar; nunca ganha
  prioridade visual sobre o original.
- Parser/busca usam ambos; hidratação preserva/atualiza `name_pt` e aliases.
- Antes de aceitar 16 extras Beta, comparar também tradução e aliases.
- Primeiro apply real na cópia excedeu 180 s; conexão caiu e transação reverteu
  integralmente (1.289 ativos, zero merged/central). Remap por loop deve virar
  set-based antes de novo ensaio.

## Checkpoint — idioma e apply em cópia

- D116 materialmente auditada: `name_pt` viaja no snapshot/projeção e parser/scorer
  pesquisa `name`, `name_pt` e aliases. Teste prova `Mutantes e Malfeitores` →
  `Mutants & Masterminds` no mesmo nó.
- Site Prod restaurado tem só 1/1.273 nós com `name_pt`. Nenhum dos 16 extras
  coincide com a tradução/aliases centrais hoje preenchidos.
- Divergência real contra D110/D116: Central mantém raízes paralelas `Vampire` e
  `Vampiro`; `Vampiro` deve ser `name_pt`, não sistema separado. Filhos precisam
  reconciliação sem perda; `Anniversary`/`Aniversário` também está vazio.
- Apply set-based na cópia convergiu 1.273 remaps. `BIGINT` retornava string e
  gerava falso não-idempotente; comparação normalizada. Rerun final: create 0,
  update 0, unchanged 1.273, remap 0, conflicts 0, em 14,9 s.
- Container/túnel temporários removidos. Bancos reais permaneceram intocados.

## Checkpoint — migrations de localização e promoção Beta

- Autorizado pelo mantenedor: implementar reconciliação localizada e integrar os
  16 extras Beta no Central Prod.
- Migration Site 013 criada: `Vampire` permanece nome original/principal;
  `Vampiro` vira `name_pt` + alias localizado; raiz/5e duplicadas viram redirects,
  filhos são reparentados sem delete e `Anniversary` recebe `Aniversário` auxiliar.
- Migration Site 014 criada: 11 sistemas + 5 edições Beta promovidos com os mesmos
  UUIDs, pais canônicos e hierarquia `system > edition`. Dados automáticos ruins
  foram saneados: descrições internas, `name_pt` redundante/errado, typo e alias
  genérico `TRPG` não entram no Central.
- Testes Site 38/38, build Site e diff-check verdes. SQL ainda não executado:
  novo restore-test temporário na VM exige aprovação nominal própria.

## Checkpoint — restore-test final 013/014

- Autorização nominal recebida; hashes dos dumps originais reconfirmados.
- Site 008–014 aplicadas na cópia; 013/014 reaplicadas com sucesso. Resultado:
  1.287 nós ativos, 16/16 promovidos, `Vampire|Vampiro|active`, duas origens
  duplicadas soft-merged aos destinos e zero hierarquia inválida.
- Plano Central→Beta: 1.287 nós, create 5, update 1.282, remap 1.273,
  beta_extra 0, conflicts 0.
- Apply set-based real na cópia Mesas e rerun: create/update/remap/beta_extra/
  conflicts = 0; unchanged 1.287. Projeção final: 1.287 `active|central`,
  1.273 `merged|beta`, 16 extras agora centrais, zero hierarquia inválida.
- Container, túnel, dumps e arquivos temporários removidos da VM e ausência
  confirmada. Bancos reais permaneceram intocados.

## Checkpoint — gates finais locais

- `pnpm verify:api`: verde; breaking 0, Mesas 6 adições não-breaking.
- `pnpm run lint`: verde.
- `pnpm run build`: verde.
- `pnpm run test`: 31/31 tasks; Mesas backend 50 arquivos/540 testes.
- `git diff --check`: verde.
- T6.5 permanece: ensaio ordenado projeção sistemas → hidratação mesas/usuários.
  Nenhum commit, push, PR ou write real executado.

## Checkpoint — backup Mesas Prod faltante

- T6.5 revelou que o conjunto original tinha Site Prod + Mesas Beta, mas não
  Mesas Prod; sem a origem real, o ensaio Prod→Beta seria falso.
- `pg_dump -Fc` read-only de `mesas-db/mesas_rpg` criado diretamente off-VM:
  `D:\artificiobackup\spec-078\20260715-142510\mesas-prod.dump` (2.826.308 bytes),
  SHA-256 `5981d4ac0ed70e11979fcb74503b9b4c6c1ae55a6c7bde5ce2351b01ddd977b5`.
- Falta restaurar/validar esse terceiro dump e executar T6.5 em ambiente isolado;
  exige nova autorização nominal para container temporário.

## Checkpoint — T6.5 encontrou referências legadas

- Três dumps restaurados em PostgreSQL descartável; migrations Site 008–014 e
  Mesas 147–149 passaram nas cópias.
- Projeção Central→Mesas Beta passou; rerun: 1.287 unchanged, zero
  create/update/remap/conflict.
- Handler real de `POST /sync/enrich` bloqueou corretamente antes do write:
  8 UUIDs referenciados pelo Mesas Prod não existem mais como nós ativos locais,
  mas possuem identidade canônica no snapshot via legacy mapping/redirect.
- Falha material: guard compara UUID legado cru e a hidratação também copiaria
  cru `tables.system_id`, `user_systems.system_id`, `user_preferences.systems` e
  `gm_profiles.closed_group_systems`.
- Correção mínima proposta: resolver a identidade canônica uma vez no guard e
  aplicar a mesma resolução aos quatro payloads antes do upsert. Depois, repetir
  o ensaio desde cópias limpas e comparar fingerprint de `systems`/aliases.
- Nenhum banco real, commit, push ou PR tocado.

## Checkpoint — correção de identidade da hidratação

- `createSystemIdResolver` resolve chains de legacy mapping + redirect e detecta ciclo.
- Guard valida as referências Prod após resolução canônica.
- A mesma função remapeia `tables.system_id`, `user_systems.system_id`,
  `user_preferences.systems` e `gm_profiles.closed_group_systems`; arrays são
  deduplicados quando IDs legados convergem no mesmo nó central.
- Resposta HTTP expõe somente versão/contagem, nunca a função interna.
- Testes guard+rota: 8/8; lint focado verde.
- Próximo: repetir T6.5 completo desde três restores limpos.

## Checkpoint — T6.5 concluído

- Quatro UUIDs restantes não existiam em Site, Mesas Prod nem Mesas Beta; eram
  referências órfãs: duas mesas ativas e uma linha de preferências.
- Decisão do mantenedor: dado pequeno pode ser removido e corrigido manualmente.
  Migration 150 preserva mesas/usuário, limpa apenas `system_id`/itens do array;
  é idempotente, `manual-risk` e exige backup.
- Decisão do mantenedor para colisões de nome: Prod sobrescreve Beta. No único
  conflito real (`Mestre Pollux`), Prod reteve nickname/slug; Beta conflitante
  perdeu nickname e recebeu slug técnico determinístico.
- Hidratação real #1: HTTP 200; guard `catalog_version=1289`, 48 referências.
- Hidratação real #2: HTTP 200, zero inserts em todas as tabelas.
- Sistemas intocados nas duas execuções:
  `systems_count=2560`, hash `dccb965ec2ee3cb2bdace072f90a7ba2`;
  `aliases_count=851`, hash `77aa2eb7fccbb80a76d7e5607e9161b8`.
- Próximo: validação final do diff; nenhum banco real/commit/push/PR tocado.

## Checkpoint — gates finais verdes

- Mesas backend: 50 arquivos, 542 testes verdes.
- `pnpm verify:api`: verde, breaking 0; 6 adições Mesas não-breaking.
- Monorepo lint: 21/21; build: 21/21.
- `git diff --check`: verde.
- Ambiente temporário removido; bancos reais intactos.
- Pronto para commit/push somente após autorização nominal nova.
