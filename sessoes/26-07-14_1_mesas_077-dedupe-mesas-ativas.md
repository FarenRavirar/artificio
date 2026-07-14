# Sessão 26-07-14 — Spec 077: dedupe de mesas ativas

- Data: 2026-07-14
- Objetivo: executar a Spec 077, começando pela Fase 0 obrigatória.
- Escopo: `apps/mesas` backend + frontend; documentação da spec/sessão/backlog/T0.
- Gate: D (mesas).
- Vínculos: `specs/077-mesas-dedupe-mesas-ativas/`.

## Estado de entrada

- T0, `AGENTS.md`, RTK, skill caveman e T1 de specs/sessões lidos.
- Branch encontrada: `feat/mesas-og-scrape-catalog-backup`.
- Working tree já contém mudanças do mantenedor em arquivos de Mesas e pacotes; preservar integralmente.
- Spec 077 está untracked.
- Implementação bloqueada pela própria Fase 0 até decisões explícitas do mantenedor sobre schema e gatilho.

## Plano desta fase

- [ ] Confirmar schema/campos reais de `tables` e pipeline atual de dedupe.
- [ ] Consultar volume real de mesas ativas em produção, read-only.
- [ ] Executar análise exploratória do score sobre amostra/dados reais sem mutar produção.
- [ ] Propor schema, gatilho e algoritmo com evidências.
- [ ] Atualizar backlog, `project-state.md`, `plan.md` e `tasks.md` com estado da Fase 0.
- [ ] Pedir decisão explícita antes de migration/rota/código da feature.

## Arquivos previstos nesta fase

- `sessoes/26-07-14_1_mesas_077-dedupe-mesas-ativas.md`
- `sessoes/index.md`
- `specs/077-mesas-dedupe-mesas-ativas/plan.md`
- `specs/077-mesas-dedupe-mesas-ativas/tasks.md`
- `specs/backlog.md`
- `.specify/memory/project-state.md`

## Critério de conclusão da fase

Fase 0 concluída com evidência real, decisões propostas e aprovação do mantenedor solicitada. Nenhuma migration, rota ou UI antes dessa aprovação.

## Backlog

`BL-077-MESAS-DEDUPE-ATIVAS` aberto em `specs/backlog.md`; implementação marcada
bloqueada até decisão nominal do mantenedor.

## Evidência — Fase 0

- `apps/mesas/backend/src/db/types.ts:225-292`: `tables` expõe título,
  descrição, sistema, origem/URL, status e slug; não guarda hash/texto
  normalizado.
- `apps/mesas/database/migration_137_discord_duplicate_candidates.sql:7-21`:
  estrutura atual exige `parse_case_id` e `candidate_case_id`; ambas FKs para
  `discord_parse_cases`.
- `apps/mesas/backend/src/discord/parseRetrieval.ts:153-187`: score atual usa
  similaridade textual + URL/form + sistema/canal/autor; threshold candidato
  0.75.
- Produção read-only: `SELECT count(*) FROM tables WHERE status='active'`
  retornou **31** em 2026-07-14.
- `specs/077-mesas-dedupe-mesas-ativas/exploratory-active-pairs.sql` executado
  contra produção, read-only. 465 pares possíveis; 3 candidatos fortes:
  `a-voz-nas-cartas-*`, `ecos-bastardos-*`, `mascaras-de-nyarlathotep-*`.
  Todos: título 1.000 + descrição 1.000. Dois: `system_id` diferente.
- Conclusão: sistema é sinal corroborativo, não filtro eliminatório. Full-scan
  sob demanda é barato no volume atual.
- Ferramentas indisponíveis neste turno: `artificio-api-governance`, LSP,
  `codebase-memory-mcp`. Fallback: RTK, código real, SQL read-only.

## Estado ao pausar

- [x] Schema e dedupe atual confirmados.
- [x] Volume real levantado.
- [x] Teste exploratório escrito e executado.
- [x] Proposta registrada no `plan.md`.
- [ ] Mantenedor aprovar tabela nova + gatilho sob demanda + score.
- [ ] Implementação Fase 1+.

## Aprovação do mantenedor

- 2026-07-14: `autorizado` para proposta da Fase 0: tabela nova,
  gatilho admin sob demanda, score URL/título/descrição com sistema
  corroborativo e decisão exclusivamente manual.
- Autorização cobre implementação local e validação. Não cobre commit, push,
  PR, deploy ou escrita na VM/DB real.

Estado histórico da pausa pré-aprovação: nenhum código de feature, migration,
rota ou UI havia sido alterado; gates seriam executados após implementação.

## Implementação local

- Migration 145: `table_duplicate_candidates`, alvo exclusivo mesa ou
  parse-case, índices únicos parciais, decisão manual e auditoria.
- `tableDuplicateDetection.ts`: score puro por trigramas normalizados, URL,
  sistema corroborativo; scanner sob demanda para mesa×mesa e draft×mesa.
- API admin: listar, recalcular e decidir candidato. Decisão draft×mesa também
  alimenta `discord_parse_feedback`; mesa×mesa não força trilha Discord.
- UI: aba `/gestao/mesas/duplicatas`, botão `Checar duplicatas`, links para
  mesa pública/admin/draft, três decisões manuais.
- Fila `/gestao/mesas/rascunhos`: badge `possível duplicata (N)`; deep-link
  `?draft=<id>` abre editor.
- OpenAPI + gerados atualizados por `pnpm verify:api`.

## Validação

- `pnpm --filter @artificio/mesas-backend exec tsc --noEmit` ✅
- `pnpm --filter @artificio/mesas-frontend exec tsc --noEmit` ✅
- backend test: 44 arquivos, 456 testes ✅
- frontend test: 17 arquivos, 173 testes ✅
- lint backend/frontend ✅
- `pnpm verify:api` ✅; mesas `breaking=0`, `non-breaking=3`
- `pnpm run lint` ✅; 21/21 pacotes
- `pnpm run build` ✅; 21/21 pacotes
- `git diff --check` ✅

## Pendência real

- Docker local indisponível (`docker_engine` não encontrado). Não foi possível
  aplicar migration nem subir app/DB local.
- Smoke exigido segue aberto: aplicar migration em beta/local, rodar botão,
  confirmar pares e links/badge. Produção não foi alterada.
- Spec não está concluída nem deployada.

## Retomada — débitos do agente paralelo

- Mantenedor pediu investigar e corrigir `DEB-077-01` a `DEB-077-05`.
- Agente paralelo já editou `CatalogTree.tsx`, validação de sessões,
  `gmPanel.ts`, `apiClient.ts` e `debitos.md` no working tree compartilhado.
- Antes de novas edições: validar causa/fix no código material, consumidores,
  schema backend e testes. Preservar mudanças concorrentes em `AGENTS.md` e
  demais arquivos não relacionados.
## Débitos paralelos — investigação e correção

- DEB-077-01: confirmado falso vazio no `CatalogTree`; correção paralela validada e teste de regressão adicionado. Teste obsoleto ainda usava a prop removida `showEmptySearchResults`; reconciliado.
- DEB-077-02: backend/schema confirmam `end_time` nullable/opcional; validação frontend corrigida e regressão adicionada.
- DEB-077-03: rota de edição agora sanitiza CDN efêmero do Discord; regressão de rota adicionada.
- DEB-077-04: cancelamento continua funcional; ruído de console limitado a DEV.
- DEB-077-05: registro estava desatualizado; os dois erros `set-state-in-effect` já foram corrigidos e lint repo-wide havia passado.
- Testes: `catalog-ui` 12/12; `mesas-frontend` 174/174; `mesas-backend` 456/456.
- Gates finais: `pnpm verify:api` verde (3 mudanças não-breaking já esperadas da 077); `pnpm run lint` 21/21; `pnpm run build` 21/21.

## Retomada — SonarCloud PR #159

- Mantenedor pediu corrigir 5 reports: complexidade cognitiva no scanner,
  2 ternários aninhados, comparação SQL nullable e operador `void` no effect.
- Plano: registrar review; extrair builders/mapas sem mudar contrato; tornar
  nullabilidade explícita; validar testes/lint/build proporcionais.
- Arquivos previstos: os 4 apontados pelo Sonar, `reviews.md` e esta sessão.
- Backlog: nada a atualizar; achados serão corrigidos agora, sem pendência.

## Frente parser P7 — checkpoint backend

- Causa confirmada: matcher retirava versão antes do texto completo; learning
  legado generalizava nome canônico errado; não havia contrato de candidatos.
- Implementado localmente: match exato completo primeiro; fallback sem versão;
  `_system_source_hint`; `_system_candidates`; regra `system_entity` de token
  bruto exato para ID+nome; `system_name` legado desativado.
- Validação focada: parser + learning + utils, **174/174 verdes**.
- Próximo passo registrado antes de avançar: renderizar e aplicar alternativas
  abaixo do picker; então testar frontend e só depois auditar corpora reais.

## Frente parser P7 — checkpoint frontend

- Hook valida e transporta `_system_candidates`; editor mostra as opções logo
  abaixo do picker; clique aplica ID e nome juntos.
- Testes focados frontend: **2 arquivos, 16/16 verdes**.
- P7.2 concluída. Antes do próximo avanço ficou definido: auditar os dois JSONs
  reais com snapshot local do catálogo, sem confundir esse snapshot com o banco
  canônico de produção; depois executar backend/frontend completos, lint/build.

## Frente parser P7 — auditoria real inicial

- 200 mensagens / 169 drafts / 155 hints; snapshot local com 682 raízes e
  1.151 entradas: 91 vinculados, 64 sem vínculo, 74 com alternativas.
- Achado bloqueante: aliases colidentes fazem `D&D 5e` escolher às vezes
  `Gamma World 5e`; logo restaurar alternativas não basta.
- Próximo passo registrado antes de avançar: corrigir ranking/desempate por
  evidência canônica, cobrir D&D×Gamma World e repetir corpus. Gates completos
  continuam pendentes.

## Frente parser P7 — alias colidente corrigido

- Harness corrigido para espelhar `importSistemas.ts`; ele havia inventado
  aliases em filhos. A rechecagem ainda reproduziu D&D→Gamma World, agora como
  bug material do fallback por alias de raiz.
- Matching canônico por acrônimo+edição passa à frente do alias; ordinal PT e
  sufixos `5ª`/`5ed`/`5e` convergem.
- Parser+scorer: **175/175 verdes**, com regressão D&D×Gamma World.
- Próximo passo registrado: repetir os 200 anúncios no harness fiel antes dos
  gates completos.

- Achado intermediário: o gate de exatidão antigo rebaixava `D&D 5e` mesmo
  após o match canônico correto. Unificado com base/acrônimo+edição; três
  grafias (`5ª Edição`, `5e`, `5ed`) cobertas; **175/175 verdes**.
- Reauditoria final continua sendo o próximo avanço registrado.

## Frente parser P7 — reauditoria final

- 200 mensagens / 169 drafts / 155 hints; 100 vínculos, 55 sem vínculo; 69
  drafts com 283 alternativas.
- D&D ficou coerente em `5ª Edição`, `5e`, `5ed` e `5e 2014`; nenhum exemplo
  auditado permaneceu em Gamma World.
- Os vazios dominantes não existem no snapshot local (ex.: Tormenta 20, Ordem
  Paranormal); não extrapolar isso ao catálogo canônico sem banco real.
- Próximo avanço registrado: suites completas backend/frontend; depois lint,
  build e diff-check, documentando cada gate antes do seguinte.

## Frente parser P7 — suites completas

- Backend: 44 arquivos, **483/483 verdes**.
- Frontend: 18 arquivos, **176/176 verdes**.
- Próximo avanço registrado: lint repo-wide; build apenas depois de salvar o
  resultado do lint na spec.

## Frente parser P7 — lint

- `pnpm run lint`: **21/21 verdes**.
- Próximo avanço registrado: build repo-wide; depois diff-check/revisão final.

## Frente parser P7 — build

- `pnpm run build`: **21/21 verdes**.
- Próximo avanço registrado: diff-check, revisão de escopo/status e fechamento
  local; sem commit, push ou deploy.

## Frente parser P7 — fechamento local

- `git diff --check` verde.
- P7 local concluída: sistema principal melhor ranqueado; alternativas
  determinísticas restauradas; aplicação ID+nome; learning `system_entity`
  seguro; regra legada perigosa desativada.
- Gates: backend **483/483**; frontend **176/176**; lint/build **21/21**.
- Sem banco local: regras e catálogo reais não auditados. Sem deploy: smoke
  visual beta/prod não executado. Sem commit/push/deploy.
- A Spec 077 completa continua aberta pelo smoke real anterior; este fechamento
  vale somente para a frente parser P7.

## Correção do mantenedor — P6/P7 reabertas

- RTK retomado como prefixo obrigatório de todo shell.
- `0/6` é semanticamente ambíguo sem rótulo: pode ser abertas/total ou
  preenchidas/total. Regra max/min universal estava errada.
- Nova cascata definida antes de editar: abertas/disponíveis → `open=X`;
  ocupadas/preenchidas → `open=Y-X`; genérico → `_slots_ambiguity`.
- Sistema deve casar em sequência: base `D&D` e, somente dentro dela, filho
  `5e`. O ranking achatado anterior não encerra o problema arquitetural.
- Próximo passo registrado: localizar todas as interpretações e testes antes
  da implementação.

## P6.4/P7.4 — localização concluída

- Max/min passa por três caminhos e seus testes; todos serão corrigidos juntos.
- UI já sabe perguntar preenchidas/total versus abertas/total.
- Árvore de sistemas já chega ao parser, mas matcher ignora `parent_id`.
- Próximo passo registrado: implementar semântica de rótulo e resolução
  raiz→descendente; depois somente testes focados.

## P6.4/P7.4 — primeira validação

- 15 falhas: 12 expectativas antigas max/min devem mudar; ocupadas `0/6`
  agora resulta 6 abertas, e genérico resulta ambiguidade.
- Sistema revelou `5 5e` (decoração removeu ponto) e `Tormenta20` (token colado).
- Próximo passo registrado: normalizar esses formatos, atualizar contratos
  obsoletos e rodar Vitest direto, sempre via RTK.

## P6.4/P7.4 — focados verdes

- Vagas: rótulo aberto/preenchido decide; genérico/conflitante pergunta.
- Sistema: raiz canônica primeiro; edição/variante só na descendência.
- Tokenização cobre grafias e versões coladas/decimais.
- Vitest direto via RTK: **175/175 verdes**.
- Próximo passo registrado: reauditar 200 anúncios; depois suites completas.

## P6.4/P7.4 — primeira reauditoria

- Vagas: 28/28 coerentes; 19 genéricos ambíguos, 7 abertas, 2 ocupadas.
- Sistemas: 72/155 vinculados; conservador demais por não aceitar raiz como
  sequência dentro de hint maior.
- Próximo passo registrado: busca contígua de raiz, mantendo conflito entre
  duas raízes; depois focados + nova auditoria.

- Busca contígua implementada; aliases genéricos bloqueados; focados 175/175.
- Próximo passo registrado: segunda auditoria de sistemas e inspeção de Gamma/
  alternativas por raiz.

- Segunda auditoria: 90/155; Gamma ausente; alternativas D&D só na raiz D&D.
- Empate incidental em complementos ainda zera Fabula/Pathfinder.
- Próximo passo registrado: desempate por sequência mais longa e mais cedo;
  depois focados + terceira auditoria.

- Desempate posicional implementado; focados 175/175.
- Próximo passo registrado: terceira auditoria de sistemas.

- Terceira auditoria: 98/155, sem Gamma, alternativas limitadas à raiz.
- Próximo passo registrado: regressão raiz D&D + folha 5ª Edição; depois suites.

## P7.4 — regressão de folha falhou

- Caso raiz `D&D` + folha `5ª Edição`/slug `5e`: 175/176 verdes; recebeu raiz
  `dnd`, esperado `dnd-5e`. Gamma permaneceu bloqueado.
- Causa localizada: `isExactSystemMatch` exige base no nome da folha e rebaixa
  descendente hierárquico válido para a raiz.
- Próximo passo registrado: aceitar token de edição exato somente no
  descendente já restrito à raiz; repetir focados. Suites completas bloqueadas.

- Gate corrigido sem busca global por edição. `D&D 5e` seleciona folha
  `dnd-5e`; Gamma segue fora da seleção e das alternativas.
- Focados via RTK: **176/176 verdes**.
- Próximo passo registrado: suites backend/frontend; depois documentar antes
  de lint/build.

## P6.4/P7.4 — suites completas

- Backend: 44 arquivos, **484/484 verdes**.
- Frontend: 18 arquivos, **176/176 verdes**.
- Ambos via RTK. Próximo passo registrado: lint repo-wide; documentar antes do
  build repo-wide.

- Lint repo-wide via RTK: **21/21 verde**.
- Próximo passo registrado: build repo-wide; documentar antes do diff-check e
  inspeção final.

## P5.5 — decisão do mantenedor

- Escolhida **Onda A — feedback confiável**.
- Escopo: auditoria completa da regra aplicada; recorreção rejeita regra exata;
  confirmação explícita alimenta avaliação; falha de persistência fica
  observável e recuperável.
- Travas: nenhuma automação operacional ou DeepSeek automático será liberado.
- Próximo passo registrado: localizar código/schema dos quatro fluxos; nenhum
  código da Onda A antes do mapa material voltar à spec/tasks.

## P5.6/P5.7 — mapa e contrato Onda A

- `_learning_applied` perde `ruleId`, confiança e evidência já disponíveis.
- Quatro writers backend + cliente escondem falhas; confirmação sem alteração
  não existe; recorreção não identifica regra aplicada.
- Decisão técnica registrada na spec: `import_corrections` vira outbox durável;
  processamento atômico/idempotente; recorreção suprime regra exata; salvar
  confirma campos mantidos; API/UI expõem estado e retry.
- Próximo passo registrado: migration 146, tipos e serviço; só depois API/UI.

## P5.8a — fundação Onda A

- Migration 146, tipos, `_learning_applied` auditável e processador transacional
  implementados localmente.
- Não está integrado: endpoint/UI ainda seguem fluxo antigo. Próximo passo:
  conectar outbox, remover regra recorreta do payload, expor status/retry.

## P5.8b/P5.8c — integração Onda A

- Endpoint usa outbox; UI envia confirmações, exibe resultado e chama retry.
- Recorreção remove provenance do payload e suprime regra exata no processador.
- Ainda sem validação. Próximo passo registrado: regressões focadas; nenhum gate
  amplo antes delas.

## P5.9a — primeira regressão focada

- Frontend 10/11: fixture gera normalizações `null/false`; expectativa vazia era
  incorreta. `confirmed_fields` e retry estão presentes.
- Backend sem resultado confiável por interrupção do lote paralelo. Próximo:
  ajustar expectativa e repetir ambos isoladamente.

- Focados verdes: backend 26/26; frontend 11/11.
- Risco achado: default `pending` reprocessaria corpus histórico. Próximo passo
  registrado: migration cria existentes como `completed`, depois default futuro
  vira `pending`; só então suites completas.

## P5.9c — harness backend

- 4 falhas no mesmo mock: falta `.returning().executeTakeFirstOrThrow()`.
- Próximo: atualizar mock com ID durável e processador isolado; rodar arquivo,
  frontend completo, depois backend completo.

- Harness isolado 44/44; frontend completo 177/177.
- Próximo passo registrado: backend completo; depois checkpoint antes do lint.

- Backend completo 487/487; frontend completo 177/177.
- Próximo passo registrado: lint repo-wide; depois checkpoint antes de
  verify:api/build/corpora.

- Lint repo-wide 21/21 verde.
- Próximo passo registrado: `verify:api`; build só após novo checkpoint.

- `verify:api` verde: 0 breaking, 3 não-breaking em mesas.
- Próximo passo registrado: build repo-wide; corpora/diff-check depois.

- Build falhou: tipo/schema Inbox ainda sem `learning` e adapter incompatível.
- Próximo: alinhar Inbox completo e repetir build, sem cast.

- Segundo build: Inbox/frontend passou; fixture `LearningRuleHit` sem
  `inputToken` bloqueou backend. Próximo: corrigir fixture e repetir build.

- Terceiro build repo-wide: 21/21 verde.
- Próximo passo registrado: reauditar corpora; diff-check somente depois.

## P5.9k/P6.4b/P7.4b — reauditoria final

- 200 mensagens/169 drafts. Vagas 28/28 coerentes: 19 ambíguas, 7 abertas, 2
  ocupadas. P6.4 fechada localmente.
- Sistemas 98/155; Gamma ausente; D&D 5e correto; 61 com alternativas.
- Bug: alternativas D&D incluem combinações cartesianas impossíveis (`1e 2024`,
  `1e 3.5`). P7 segue aberta. Diff-check bloqueado até mantenedor escolher
  correção agora ou débito acionável.

## P7.4b.2 — correção semântica do mantenedor

- 2014/2024 = variantes; 5e = edição; D&D = sistema.
- Contrato: raiz→edição→variante. Compartilhar só raiz é insuficiente.
- Próximo passo registrado: localizar perda do parentesco; nenhum código antes
  do mapa voltar à spec.
- Correção adicional do mantenedor: variante é FILHA da edição, nunca irmã.
- Causa confirmada: `findSystemMatch` pontua todos os descendentes da raiz;
  `findExistingChildMatch` usa `candidateSystem.parent_id` e procura entre
  irmãos. Próximo avanço: filho direto por `parent_id === current.id`.
- Regressão focada inicial: 23/26. Restos: stripping de `2024` sobrescreve
  variante já encontrada; scorer aceita edição incompatível pela base; teste
  antigo ainda esperava raiz onde o pai correto agora é `5e`.
- Segundo ciclo: 25/26; travessia parcial ainda era tratada como match completo.
  Próximo ajuste: exigir consumo integral dos tokens para `existing_child_match`.
- Terceiro ciclo: 25/26; o match parcial deixou de ser falso completo, mas foi
  descartado. Próximo ajuste: retorno explícito parcial/completo, preservando
  `5e` como pai da variante ausente.
- Hierarquia verde: 26/26 testes focados. Próximo avanço registrado:
  reauditar `D:\teste.json` + `D:\teste [part 2].json`.
- Corpus reauditado: 98/155 matches; 80 com alternativas. Ainda aparecem filhos
  `5e 3rd/4th/3.0/3.5`; investigar se origem é catálogo ou flatten do harness.
- API prod read-only: `5e.children = [2024, Next, 2014]`; produto cartesiano é
  falso do harness/JSON legado. Há duplicado real `D&D.children += 2024`
  (`node_type=edition`), contrário à semântica decidida; limpar só após auditar
  referências e preparar migration.
- Auditor com API real: 122/155 matches, porém `D&D 5e` regride à raiz. Fixture
  focada não refletia `name="5e"` + slug técnico composto; corrigir reprodução.
- Fixture prod real: `D&D 5e` passa; `D&D 5e 2024` empata `5e`×duplicado raiz
  `2024`. Próximo ajuste: desempate pela ordem dos tokens hierárquicos.
- Mantenedor ampliou: revisar tudo, inclusive frontend; regra é universal, não
  D&D-specific. P7 não fecha antes de inventário backend+frontend+DB, correções
  e regressão com outro sistema.
- Inventário encontrou resíduos em Mesas CRUD/moderação/sugestões, modal/drawer,
  serviço central site e importador legado.
- Correção do mantenedor: `subsystem` não existe. Única cadeia:
  `system → edition → variant`; remover legado após auditar dados reais.
- API prod: 691 system / 395 edition / 187 variant / 0 subsystem. Remoção pode
  ser fail-closed: migration aborta se outro ambiente divergir.
- Resíduo: filhos textuais não são reconhecidos; adicionar regressão genérica
  `Call of Cthulhu → 7e → Pulp` antes dos gates amplos.
- Correção definitiva do mantenedor: não existe `subsystem` nem nível equivalente.
  Modelo fechado e universal: `system → edition → variant`.
- Busca transversal encontrou resíduo operacional em `packages/catalog-ui`,
  `site-admin`, clientes `downloads`/`glossario` e textos do drawer. Portanto a
  auditoria ainda não está concluída; todos entram no mesmo escopo solicitado.
- Antes do próximo avanço, spec/tasks atualizadas. Próximo passo: remover esses
  consumidores e criar guardas de banco; depois repetir busca global.
- Checkpoint: código operacional transversal limpo. Busca encontra somente
  migrations históricas, guarda fail-closed nova e o script manual executável
  `apply_migrations_06_07.sql`.
- Antes da etapa de banco, spec/tasks atualizadas. Próximo passo: neutralizar o
  script antigo e impor pai/tipo exatos nas bases central e Mesas.
- Banco local implementado sem conversão automática: migration 147 valida dados,
  fecha tipos/profundidade/pai e instala trigger; script manual 06/07 aborta.
- Antes da próxima etapa, spec/tasks atualizadas. Próximo passo: remover o loop
  cartesiano do importador e adicionar regressões genéricas de backend/frontend.
- Importador cartesiano removido; formato legado com variantes segue bloqueado.
  Validador puro cobre cadeia completa e formulários filtram pai por tipo exato.
- Antes dos testes, spec/tasks atualizadas. Próximo passo: quatro suítes focadas;
  qualquer falha volta para correção local antes de ampliar validação.
- Focados verdes: backend 39/39, catalog-ui 14/14, modal Mesas 3/3. Caso genérico
  `Call of Cthulhu → 7e → Pulp` coberto.
- Antes da auditoria de dados, spec/tasks atualizadas. Próximo passo: detectar nós
  existentes no nível semântico errado, sem assumir que qualquer ano é variante.
- Auditoria prod read-only: 2 violações estruturais D&D; 5 grupos com nomes
  duplicados entre edição/variante. D&D 2024 errado tem 1 mesa; correto tem 0.
- Decisão existente resolve D&D 1e/2024. Mage, Mothership, OSE e Shadowrun seguem
  ambíguos e não serão alterados automaticamente.
- Antes do mapa de referências, spec/tasks atualizadas. Próximo passo: localizar
  todas as FKs e preparar merge D&D sem perda; nenhuma escrita externa.
- Migrations locais prontas e não executadas: Mesas 148 remapeia mesa, drafts e
  aprendizados; site 008 corrige 1e/trava estrutura; site 009 mescla 2024 com
  mappings, aliases, redirect e auditoria. Pai 5e confirmado pela API.
- Antes da auditoria estática/testes centrais, spec/tasks atualizadas. Próximo
  passo: busca global de tipos/pais e teste do repositório central.
- Busca operacional limpa; site 8/8, catalog-client 3/3 e TypeScript dos clientes
  Glossário/Downloads verdes.
- Antes do corpus, spec/tasks atualizadas. Próximo passo: reprocessar 200 anúncios
  reais contra a árvore pública ainda não migrada.
- Corpus: 122/155 vinculados, 33 sem vínculo, 87 com alternativas. P7 reaberta:
  D&D real fica na raiz e oferece Gamma World; OPRPG pode virar `Do`.
- Causa: filho real repete prefixo ancestral (`Dungeons & Dragons 5e`), diferente
  da fixture curta. Alternativas não podam outras raízes após raiz forte.
- Antes da correção, spec/tasks atualizadas. Próximo passo: fixtures reais,
  stripping apenas do ancestral confirmado e bloqueio de raiz genérica concorrente.
- Diagnóstico controlado confirmou cruzamento de aliases: `D&D 5.5` no nó 2024
  e alias `D&D` em Gamma/Drakar/Starstone pontuam apesar da base canônica alheia.
- Trava nova do mantenedor registrada: nenhum merge/migration em VM antes de
  backup completo, verificado e copiado off-VM para `C:\projetos\artificiobackup`.
- Próximo passo: vetar edição incompatível e alias sem vínculo à base canônica;
  depois focados, sem tocar VM.
- Focados: parser 6/6; scorer 22/24. Regra bloqueou alias traduzido único e alias
  de edição legítimo. Critério refinado: unicidade global do alias; se colidente,
  exigir vínculo canônico apenas para extensão. Spec atualizada antes do ajuste.
- Refinamento verde 30/30. Próximo passo registrado: corpus real rodada 2; Gamma
  e seleção na raiz D&D são bloqueios explícitos de avanço.
- Rodada 2: Gamma/Starstone saíram, mas seleção D&D controlada ainda falha e
  Drakar permanece. Hipótese agora é precedência errada em mensagem sem thread
  iniciada por `Título:`. Spec atualizada antes de isolar extração/aliases reais.
- Extração inocentada. Drakar entra por acrônimo derivado `DnD`, não alias.
  Próximo passo registrado: fixture com aliases reais e prioridade explícita
  nome/alias canônico > acrônimo derivado.
- Sinais reais revelaram cadeia causal: slug 3.5e vira falso token 5e → empate;
  fallback remove versão → alias D&D 5.5 pontua base e escolhe 2024. Correção
  registrada na spec antes de editar.
- Correção verde 30/30 com fixture realista. Próximo passo: controles API; corpus
  completo condicionado ao resultado correto, registrado antes do avanço.
- Controle: variante 2024 correta e colisões removidas; `D&D 5e` cai em `Next`
  porque slug do filho repete ancestral 5e. Regra registrada: descendente casa
  apenas nome/name_pt/aliases locais, nunca slug/path.
- Ajuste verde 30/30. Próximo passo: quatro controles públicos novamente; corpus
  segue condicionado ao verde.
- Controles públicos verdes: 5e e 5e/2024 selecionam níveis corretos, sem
  Gamma/Drakar. Antes do corpus completo, spec atualizada; relatório destacará
  todos os casos D&D.
- Corpus: 122/155; casos comuns D&D corrigidos; 33 principais são nomes ausentes.
  Resíduo: irmãos/raízes aparecem após seleção. Spec atualizada antes de remover
  siblings; inferência variante única (14/24) registrada como próxima etapa.
- Algoritmo de inferência registrado antes de editar: descendente único pode
  completar nível omitido; duplicata entre níveis mantém pai; ano curto só casa
  ano existente e continua sujeito à unicidade.
- Inferência verde 33/33. Antes de controle/corpus final, spec atualizada. Depois
  só avançar para gates amplos se seleção e alternativas permanecerem coerentes.
- Corpus final confirmou hierarquia/alternativas; achado restante `3.5` versus
  `3.5e` escolhe variante errada. Spec atualizada: canonicalizar ambos como 3.5,
  depois focado/controle antes de gates amplos.
- Decimal corrigido; focados 35/35. Antes do controle público, spec atualizada.
- Controle público 3.5e verde. Antes do gate API, spec/tasks atualizadas. Próximo:
  `pnpm verify:api`, sem commit/deploy/migration.
- `verify:api` bloqueou em consumer-only novo de `retry-learning`. Registrado
  antes de avançar; próximo passo somente diagnóstico read-only e pergunta ao
  mantenedor, conforme governança.
- Mantenedor escolheu corrigir. Diagnóstico: rota existe nos dois mounts do
  handler factory; OpenAPI gerado sobrescreve edição direta. Fonte correta é o
  overlay Mesas. Próximo: adicionar os dois contratos e repetir o gate.
- Overlay corrigido para Discord + Inbox; `pnpm verify:api` verde (360 operações,
  0 breaking, 5 non-breaking Mesas; 3 warnings preexistentes). Próximo: auditoria
  integral do que falta implementar/corrigir na spec 077.
- Auditoria achou trava incorreta na migration 148: remapeia dados, mas metadata
  dizia `online-safe`/sem backup. Próximo: corrigir para risco manual + backup
  obrigatório e conferir descoberta/ordem das migrations 146–148.
- Metadata 148 corrigida. Novo bloqueante: runner de migrations do site ignora
  risco/backup e aplicaria 008/009 automaticamente. Próximo: localizar testes e
  integração de deploy, criar gate fail-closed compatível com legado.
- Runner site agora bloqueia 008/009 por padrão e exige autorização + backup
  existente/verificado/off-VM. Migrations históricas seguem compatíveis. Testes
  site 26/26. Próximo: auditar funcionalmente hierarquia/parser/outbox.
- Auditoria funcional: backend 275/275, frontend 55/55, catalog-ui 14/14,
  catalog-client 3/3, site 26/26. Contrato ativo universal limpo; ocorrências
  restantes do tipo legado são históricas/guardas/testes negativos. Próximo:
  suites completas, lint/build e diff-check antes do inventário final de pendências.
- Suites completas verdes: backend 47/511; frontend 18/178. Próximo: lint
  repo-wide; registrar antes do build.
- Lint repo-wide 21/21 verde. Próximo: build repo-wide; depois diff-check e
  inventário final do que ainda depende de ambiente/decisão.
- Build atingiu timeout do harness em 120 s; nenhum erro material apareceu, mas
  não é verde comprovado. Próximo: repetir com janela maior e cache reaproveitado.
- Reexecução do build verde 21/21. Próximo: diff-check e consolidação honesta das
  pendências externas/decisões.
- Diff-check verde. Lacuna de DoD corrigida: criado smoke real P5.10 para Onda A
  em Postgres/UI beta. Pendências finais: smoke dedupe, backup, migrations
  ordenadas, smokes learning/hierarquia, quatro decisões de curadoria e depois
  fechamento documental. Nenhuma dessas etapas foi fingida como concluída.
- Auditoria do deploy: gate site não tem wiring de env/mount no compose; execução
  manual 008/009 ainda não possui caminho operacional. Task criada. Checagem de
  backup agora rejeita arquivo ausente, diretório ou arquivo vazio.
- Gate endurecido validado: site 26/26. Próximo: lint/build repo-wide e diff-check.
- Lint pós-delta 21/21 verde. Próximo: build e diff-check.
- Build pós-delta 21/21 verde. Próximo: diff-check final.
- Diff-check final verde. Auditoria concluída; spec permanece aberta pelos itens
  reais listados em `tasks.md`.
