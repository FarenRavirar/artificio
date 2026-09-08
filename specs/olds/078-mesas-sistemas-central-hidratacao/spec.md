# 078 — Sistemas de RPG: Central Site Prod, projeção Mesas Beta e fluxos unificados

- **Escopo:** `apps/mesas` backend/frontend/database, API de sistemas do `apps/site` e hidratações.
- **Processo:** SDD Completo — banco, API compartilhada, importador e deploy.
- **Origem:** auditoria pós-Spec 077, 2026-07-15.
- **Status:** Fases 0–5 implementadas localmente; ensaio de dados real bloqueado
  pelos backups/restore-test da Fase 6.

## Vocabulário obrigatório

- **Catálogo/dados do Mesas:** mesas, usuários, perfis, preferências e demais dados próprios do produto Mesas.
- **Sistemas de RPG:** somente taxonomia compartilhada `sistema > edição > variante`, incluindo nomes, traduções, aliases e metadados próprios.
- **Central:** exclusivamente serviço de sistemas de RPG hospedado no **Site Prod**. Não significa conteúdo ou catálogo geral do Site.
- **Projeção local Beta:** `systems`/`system_aliases` do Mesas Beta, hidratados do Central e usados pelo runtime Beta.

Proibido usar “catálogo do Site” como sinônimo de sistemas de RPG. Mesas consome somente domínio compartilhado de sistemas.

## Problema material

A Spec 062 migrou parte do Mesas para API central, mas deixou consumidores runtime no banco local:

- `/api/v1/systems`, CRUD e hidratação visual usam API central;
- parser Discord/JSON, onboarding, preferências, grupos fechados e DDAL consultam `systems` local;
- hidratação Mesas Prod→Beta ainda inclui tabelas de sistemas e resolução local;
- `tables.system_id` guarda UUID canônico sem FK local, mas sync pode copiar referência sem garantir projeção Beta;
- onboarding e importação draft JSON possuem fluxos distintos de descoberta, criação e manipulação de sistemas.

Resultado: drift, sistema errado no parser, sugestões inconsistentes, manutenção duplicada e perda de dados.

## Baseline material — Fase 0

### Fontes e escritas atuais

| Fluxo | Leitura atual | Escrita atual | Veredicto 078 |
|---|---|---|---|
| `/systems`, criação/edição e hidratação visual | API Central Site Prod via `catalogClient` | API admin Central | manter como adapter Prod; Beta deve usar adapter local |
| parser Discord, JSON e texto colado | `systems` + `system_aliases` locais via `loadSystemsForParser` | drafts/learning locais | trocar pelo adapter único; em Beta continuará local, em Prod será Central |
| onboarding `/me/options` e `/me/preferences` | `systems` + aliases locais | `user_preferences.systems` | trocar pelo adapter; validação e árvore devem usar mesma fonte |
| perfil favorito/sistema que mestra | UI Central; validação backend Central | `user_systems` local | unificar fonte por ambiente; hoje UI/backend/FK discordam |
| grupos fechados | IDs e nomes em `systems` local | `gm_profiles.closed_group_systems` | adapter local em Beta/Central em Prod |
| DDAL | `systems.path_slug` local | mesa local | adapter local em Beta/Central em Prod |
| sugestões | candidatos/CRUD Central; auditoria local | Central + `system_suggestions` local | manter auditoria local; mutação passa pelo adapter do ambiente |
| Mesas Prod→Beta | inclui sistemas, aliases e sugestões; resolve mesa por slug local | upsert local | remover domínio RPG; preservar UUID da referência |
| scripts legados | tabelas locais | tabelas locais | permitidos somente como migration/import/hidratação explícita |

`loadSystemsForParser` alimenta import Discord, import JSON/texto, parse em lote,
reparse de drafts e learning. Portanto trocar apenas uma rota não unifica o
parser; o provider precisa ficar abaixo desse ponto comum.

### Superfície de referências

- colunas UUID: `tables.system_id`, `user_systems.system_id`,
  `system_suggestions.parent_id/resolved_system_id/created_system_id` e aliases;
- arrays UUID: `user_preferences.systems` e
  `gm_profiles.closed_group_systems`;
- JSONB: `discord_import_table_drafts.parsed_payload` e
  `normalized_payload`, incluindo `table.system_id` e
  `_system_candidates[].system_id`;
- aprendizado: `discord_field_learning` e `discord_learning_rules` guardam
  `system_entity`/saídas JSON com `system_id`;
- metadados de notificações/auditoria podem carregar IDs, mas não são FKs de
  runtime e não devem ser reescritos sem regra explícita.

`tables.system_id` já perdeu a FK local na migration 144. Em contraste,
`user_systems` e as colunas de resolução de `system_suggestions` ainda possuem
FK local. A projeção Beta precisa existir antes de hidratar essas referências.
O banco do Site usa ID `TEXT`, enquanto Mesas usa `UUID/UUID[]`: snapshot com ID
central não-UUID é erro de contrato e deve abortar antes de qualquer write.

### Matriz onboarding × draft JSON

| Capacidade | Onboarding atual | Draft JSON atual | Base escolhida |
|---|---|---|---|
| árvore e busca hierárquica | `useSystemsCatalog` + `SystemPicker` | mesmos hook/picker | componente compartilhado já existente |
| seleção | múltipla, explícita e acessível | única, com nome conhecido após criação | `SystemPicker`, modo explícito |
| hierarquia | navega sistema/edição/variante | navega e cria filho no nível correto | contrato do draft, disponível por opção |
| aliases | busca pelo catálogo | busca + matching de parser | índice normalizado único do backend |
| candidatos/alternativas | inexistente | `_system_candidates`, score e revisão | motor do parser/suggestion candidates |
| criação/sugestão | inexistente no onboarding | `SystemSuggestionModal`, cadeia e moderação | modal compartilhado; nunca criação silenciosa |
| matching textual | não se aplica à escolha explícita | tokens ordenados, hierarquia e score | serviço puro único; onboarding reutiliza busca/índice, não parse de anúncio |
| learning/proveniência | inexistente | parser, learning store, DeepSeek e humano | preservar no draft; seleção explícita registra humano |
| validação persistida | `/me/preferences` local | gate normalizado + sync | adapter único por ambiente |

Escolha: não transformar onboarding em parser. Ambos compartilham provider,
árvore, índice de nomes/aliases, hierarquia, candidatos e modal. O draft mantém
extração de texto, learning e proveniência; onboarding mantém seleção humana
múltipla e acessibilidade.

### Resultado da Fase 5 — fluxo e dados reais

- Onboarding passou a usar o mesmo `SystemSuggestionModal` do draft, inclusive
  cadeia `system > edition > variant`, permissão por papel, refresh e seleção do
  nó recém-criado.
- Parser e scorer continuam sendo o único motor textual; onboarding não tenta
  adivinhar texto, mas usa o mesmo provider, árvore, aliases e picker.
- Alias exato e único de uma edição filha direta pode representar sistema +
  edição (`V5`). Essa exceção não vale para variante: variante nunca pula edição.
- Tokens compactos inequívocos separam nome e edição (`dnd5` → `dnd` + `5e`).
- Catálogo recebeu migrations idempotentes para `3D&T > Victory` e aliases reais
  `3DeT`, `OSE`, `V5` e `Lobisomem: O Apocalipse`. Não há criação automática pelo
  parser; dados ausentes continuam para curadoria.
- Reprocessamento read-only de 200 mensagens reais, simulando as migrations em
  memória sobre snapshot Site Prod v1283: matches passaram de **130 para 137**.
  `teste.json`: 63→66; `teste [part 2].json`: 67→71. Restantes sem candidato
  confiável não foram aproximados/inventados.

### Curadoria de identidade da Fase 6

- `CAIN RPG` é sistema; `CAIN` é alias; `1.3` permanece edição filha.
- `Mutants & Masterminds` é sistema; `Mutants And Masterminds` é alias, nunca edição.
- Remap legado preserva o UUID antigo como nó soft-merged, move referências ao
  UUID Central e reparenta filhos exclusivos Beta ao pai canônico.
- Nome original e versão em português são o mesmo nó: `name` + `name_pt`.
- `name` é sempre o nome original, em qualquer idioma, e permanece principal/exibido; `name_pt` é tradução auxiliar para busca/contexto, nunca preferência visual.
  Tradução participa de matching/aliases, nunca cria taxonomia paralela.

### Contrato de snapshot já disponível

O Central já expõe `GET /api/catalog/v1/systems` com ETag e payload contendo
`catalog_version`, `generated_at`, `checksum`, `nodes_count` e `tree` ativa com
aliases. A 078 reutiliza esse contrato, validando integralmente antes do apply.
O dry-run adiciona classificação local: `create`, `update`, `unchanged`,
`beta_extra`, `conflict`, `orphan` e `invalid_contract`.

### Lifecycle/redirect decidido na Fase 1

O Central possui lifecycle (`active/rejected/merged`) e redirects. A projeção
local do Mesas não possui `status`, `source` nem redirect; `user_systems` ainda
usa `ON DELETE CASCADE`. Portanto implementar “archive” local como DELETE
apagaria preferências de usuários e violaria preservação de IDs. Além disso, o
snapshot público contém somente nós ativos: quando o Central arquiva/mescla um
nó, Beta não consegue distinguir “extra Beta” de “central removido do snapshot”.

Decisão do mantenedor: propagar lifecycle/redirects para a projeção local.
Cada nó local registra origem (`central` ou `beta`), status, destino de merge e
versão Central observada. Archive/merge é soft: some das escolhas novas, mas ID
e referências históricas permanecem. Snapshot Central passa a informar
explicitamente nós inativos e redirects. Hard delete é proibido nesse fluxo.

## Arquitetura decidida pelo mantenedor

1. Central de sistemas de RPG = **Site Prod**.
2. Mesas Prod usa sistemas diretamente do Central.
3. Mesas Beta mantém sistemas localmente.
4. Mesas Beta hidrata projeção local a partir do Central.
5. Central→Mesas Beta é upsert aditivo: preserva UUIDs centrais, atualiza existentes, insere ausentes e nunca apaga extras Beta.
6. Mesas Prod→Mesas Beta hidrata dados Mesas, incluindo mesas e usuários, mas exclui domínio de sistemas de RPG.
7. Parser, onboarding, preferências, grupos fechados e DDAL do Beta usam mesma projeção local.
8. Criação/manipulação usa abstração única: Central em Prod; projeção local em Beta.
9. Onboarding e importação draft JSON compartilham motor e UX, incorporando melhor, mais avançado e mais recente de ambos.
10. Hierarquia universal: somente `system > edition > variant`.

Exceção explícita à Spec 062: projeção persistente permitida somente no Mesas Beta, como réplica operacional aditiva do Central.

## Requisitos funcionais

### RF1 — Central→Mesas Beta

- Snapshot versionado do Site Prod por contrato autenticado/read-only.
- Upsert de sistemas, edições, variantes e aliases mantendo UUID central.
- Atualizar nome, tradução, descrição, hierarquia, slug/path, aliases e metadados alterados no Central.
- Reconciliação compara `name`, `name_pt` e aliases antes de classificar extra Beta.
- Preservar registros exclusivos Beta; zero delete.
- Colisão `slug/path` com UUID diferente aborta e gera relatório; nunca escolha arbitrária.
- Ordem pai antes de filho e validação `system > edition > variant`.
- Transação/rollback verificável.
- Dry-run: criar, atualizar, inalterado, extra Beta, conflito e órfão.

### RF2 — Mesas Prod→Mesas Beta

- Excluir `systems`, `system_aliases`, `system_suggestions` e demais tabelas do domínio de sistemas.
- Continuar mesas, usuários e dependências autorizadas, preservando mascaramento de PII.
- Preservar UUID em `tables.system_id`, preferências, `user_systems` e grupos fechados; projeção local deve conter cada UUID.
- Ordem: RF1 antes de RF2.
- Referência inexistente no Central/projeção aborta com relatório.

### RF3 — Abstração única

- Contrato único: árvore/flat, ID/slug, aliases, matching, hierarquia, create/update/suggest/archive/merge.
- Prod chama Central Site Prod; Beta usa projeção local.
- Nenhum consumidor runtime consulta tabelas locais fora adapter Beta/hidratador.
- Endpoints legados permanecem fachada, sem regra paralela.

### RF4 — Onboarding + draft JSON

- Auditar ambos antes de escolher base.
- Compartilhar catálogo, normalização, aliases, cadeia hierárquica, candidatos, sugestão, validação e proveniência.
- Preservar parser recente: tokens ordenados, aliases, matching hierárquico, alternativas, learning e revisão humana.
- Preservar onboarding maduro: seleção explícita, acessibilidade, validação, UX de sugestão e preferência.
- Um picker/form; diferenças por opções explícitas, não forks copiados.
- Draft nunca cria/publica sistema silenciosamente.

### RF5 — Reconciliação

- Inventariar IDs Beta, UUIDs centrais e referências antes de write.
- Mapa legado→central determinístico.
- Remap somente após backup e relatório aprovado.
- Colisões, extras e órfãos entram em fila explícita.
- Nunca apagar UUID; merge usa redirect/mapeamento.

## Critérios de aceite

1. Dry-run Central→Beta: zero conflito não classificado e zero órfão.
2. Apply em cópia preserva UUID central e extras; rerun idempotente.
3. Mesas Prod→Beta não toca domínio de sistemas.
4. Toda referência hidratada existe na projeção Beta.
5. Parser JSON, onboarding, preferências, grupos, DDAL e CRUD usam contrato único.
6. Sinal equivalente produz mesma resolução/candidatos no onboarding e draft.
7. Casos: D&D/5e/2014/2024, D&D/1e/Basic Set, 3D&T/Victory e árvore não-D&D.
8. Backups Site Prod + Mesas Beta verificados/off-VM antes de apply real.
9. `verify:api`, testes, lint e build verdes.
10. Smoke Beta cobre seis consumidores usando mesma projeção.

## Fora de escopo

- Hidratar conteúdo geral do Site para Mesas.
- Tornar Mesas owner do Central.
- Apagar imediatamente tabelas legadas de Mesas Prod.
- Autoaprovar sistema sugerido pelo parser.
- Corrigir taxonomia sem curadoria.

## Continuidade

Antes e depois de cada fase: atualizar `tasks.md`, sessão e `project-state.md`. Decisão também entra em `decisions.md`, nunca somente nela. Falha real reabre task/estado imediatamente.
