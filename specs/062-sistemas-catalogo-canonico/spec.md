# Spec 062 — Catálogo canônico de sistemas e edições

- **Estado:** Etapa I concluída e aprovada; Etapa II em execução. I0/I1 locais implementados; primeiro alvo operacional do serviço central é `beta.artificiorpg.com` via app `site`, sem promoção/prod nesta rodada.
- **Nível SDD:** Completo
- **Origem:** Spec 061 F-1 / D096
- **Escopo:** investigação, plano e implementação incremental do catálogo canônico; I1 local já cria fundação no `site`, sem consumidores conectados e sem prod.

## Problema

`mesas` e `glossario` já mantêm sistemas de RPG. `downloads` também precisará desse conceito. Criar uma terceira fonte produziria IDs incompatíveis, aliases divergentes, administração duplicada e filtros inconsistentes.

## Objetivo firme

Definir um banco/catálogo canônico e um gerenciamento únicos de sistemas/edições consumidos por `mesas`, `glossario` e futuro `downloads`, preservando isolamento dos demais dados de domínio.

## Governança de administração definida

- `mesas`, `glossario` e `downloads` podem oferecer telas/ações de administração do catálogo.
- Todas as interfaces escrevem pelo mesmo serviço/API central; nenhuma mantém CRUD, regra ou banco concorrente.
- O local principal e completo de gerenciamento será o admin do `site`, dentro da sidebar.
- Interfaces dos apps consumidores podem ser contextuais ou reduzidas, mas devem respeitar exatamente as mesmas permissões, validações, auditoria e estados.
- Alteração feita em qualquer interface torna-se visível para todas após confirmação do serviço central/cache.
- Autorização continua central e exige admin; “qualquer filial” significa qualquer app consumidor autorizado, não qualquer usuário.

## Liberdade de migração do glossário

- O subsistema de sistemas/edições do `glossario` pode ser reescrito integralmente se isso produzir integração mais limpa com o catálogo canônico.
- Escala pequena do catálogo local: 12 sistemas e 17 edições em produção.
- A autorização não cobre reescrever o app inteiro, termos, cenários, categorias, comentários ou busca.
- Os 8.795 termos com `system_id` tornam preservação referencial obrigatória.
- Reescrita deve incluir mapa de UUID legado→canônico, backfill verificável, compatibilidade temporária e rollback.
- Nenhum termo pode perder sistema/edição silenciosamente; divergências viram fila de reconciliação.

## Saída exigida

- inventário material das duas implementações existentes;
- mapa de consumidores e contratos;
- divergências e riscos;
- opções arquiteturais comparadas;
- decisão do mantenedor;
- modelo canônico conceitual;
- plano de migração, compatibilidade, rollout, rollback e testes;
- fases executáveis da Etapa II nesta própria spec.

## Fora de escopo (Etapa I)

Na Etapa I (investigação), está fora de escopo:
- Código, migration ou alteração de dados.
- Escolher por memória/documentação sem conferir código.
- Compartilhar todo o banco dos apps.
- Quebrar IDs/URLs/consumidores existentes.

A Etapa II (código) tem escopo próprio detalhado em `plan.md` e executado conforme `tasks.md`.

## Investigação material

### Estado real dos bancos

Inspeção read-only em 2026-07-08:

> **Nota:** Snapshot de 2026-07-08, pré-migration I0b.3 (142). Após a correção, 573 nós em prod e 577 em beta tiveram `name` reescrito para nome próprio. Ver `plan.md` I0b e `tasks.md` I0b.3 para estado pós-migration.

| Ambiente | Mesas `systems` | Mesas aliases | Glossário `systems` | Glossário `editions` | Termos com sistema | Termos com edição |
|---|---:|---:|---:|---:|---:|---:|
| Produção | 1.265 | 407 | 12 | 17 | 8.795 | 11 |
| Beta | 1.289 | 442 | 13 | 17 | 8.784 | 0 |

Mesas prod por tipo: 686 `system`, 392 `edition`, 187 `variant`. Beta: 697 `system`, 402 `edition`, 189 `variant`, 1 `subsystem`.

Conclusões:

- beta/prod já divergem nos dois apps;
- mesas possui catálogo muito maior e estruturalmente mais rico;
- glossário tem poucos sistemas, mas alto impacto referencial: milhares de termos;
- UUIDs não coincidem nem quando slug/nome coincidem;
- migração não pode ser simples troca de conexão ou join por UUID.

### Modelo `apps/mesas`

Fonte: migrations, tipos Kysely, rota `routes/systems.ts`, frontend admin e DB real.

`systems` representa árvore única:

- `id`, `name`, `name_pt`, `slug`, `description`;
- `parent_id`;
- `node_type`: `system|edition|variant|subsystem`;
- `depth`, `path_slug`;
- `logo_filename`, `website_url`;
- timestamps.

`system_aliases`:

- alias + slug normalizado;
- flag `is_official`;
- unicidade por sistema/alias.

Recursos:

- 682 raízes no JSON fonte local; DB real já tem 686 raízes em prod;
- árvore/flat view com cache;
- CRUD admin completo;
- bloqueio de delete quando há mesas ou filhos;
- aliases, nome PT, logo e site;
- importador de árvore;
- sugestões de sistema, resolução e notificações;
- consumidores em mesas, perfis de usuário, filtros, formulário, importadores Discord/inbox, parser/learning e gestão.

APIs canônicas atuais:

- `GET /api/v1/systems`;
- `POST /api/v1/systems/admin`;
- `PUT|DELETE /api/v1/systems/admin/{id}`;
- relações de perfil em `/api/v1/profile/.../systems`.

Pontos fortes:

- maior catálogo;
- árvore flexível;
- aliases;
- gestão/admin mais madura;
- proteção de exclusão;
- muitos consumidores reais/testes.

Débitos/riscos:

- não possui `updated_at` no tipo/schema efetivo;
- não possui status de moderação no nó canônico;
- `depth`/`path_slug` são dados derivados persistidos e podem driftar;
- `name_pt` opcional enquanto `name` mistura idiomas;
- logo usa `logo_filename`, contrato específico do app;
- catálogo está acoplado ao DB/deploy/availability de mesas.

### Modelo `apps/glossario`

Fonte: `database/init.sql`, migrations legadas, controller/routes, tela `AdminStructurePage` e DB real.

Tabelas separadas:

`systems`:

- `id`, `name`, `slug`, `description`;
- `created_by`, `suggested_by`;
- `status`: `pendente|aprovado` no estado observado;
- `created_at`, `updated_at`.

`editions`:

- `id`, `system_id`, `name`, `slug`, `description`;
- `status`, `suggested_by`;
- timestamps;
- unicidade `(system_id, slug)`.

Recursos:

- usuário autenticado sugere sistema/edição; admin aprova via status;
- CRUD admin em tela unificada de estrutura;
- termos referenciam `system_id` e `edition_id` separadamente;
- cenários e edições de cenário são conceitos próprios e não devem ser misturados automaticamente ao catálogo de sistemas.

APIs canônicas atuais:

- `GET|POST /api/systems`;
- `PUT|DELETE /api/systems/{id}`;
- `GET|POST /api/systems/{systemId}/editions`;
- `PUT|DELETE /api/systems/editions/{id}`.

Pontos fortes:

- status/sugestão integrados;
- separação explícita sistema×edição;
- `updated_at`;
- relação direta com termos e referências editoriais.

Débitos/riscos:

- delete de sistema usa cascade para edições e `SET NULL` nos termos; controller não faz preflight de impacto;
- sem aliases;
- catálogo pequeno/manual;
- APIs usam SQL cru e formas distintas de mesas;
- tela mistura sistemas, edições, cenários e categorias;
- autenticação/usuário local ainda aparece no schema legado;
- beta tem 13 sistemas contra 12 em prod e nenhuma referência de termo a edição.

### Divergências comprovadas

| Tema | Mesas | Glossário | Necessidade canônica |
|---|---|---|---|
| Estrutura | árvore única | tabelas system/edition | árvore canônica com tipo explícito |
| Tipos | system/edition/variant/subsystem | system/edition | manter os quatro, validar relações |
| Alias | sim | não | obrigatório |
| Tradução de nome | `name` + `name_pt` | um `name` | nomes localizados explícitos |
| Status | sem status no nó | pendente/aprovado | draft/pending/active/rejected/merged |
| Sugestão | tabela/workflow separado | campos no registro | workflow separado e auditável |
| Logo/site | sim | não | metadados opcionais |
| Updated at | ausente | presente | obrigatório |
| Delete | bloqueia referências/filhos | cascade/SET NULL | nunca apagar; merge obrigatório |
| IDs | UUID local | UUID local diferente | UUID canônico + mapa legado |
| Escala prod | 1.265 nós | 29 registros | catálogo inicial vem integralmente do mesas |
| Consumidores | muitos fluxos runtime | 8.795 termos | compatibilidade gradual obrigatória |

Exemplos de conflito:

- `Dungeons & Dragons`: mesmo slug `dungeons-dragons`, UUIDs distintos.
- `Pathfinder` e `GURPS`: slugs iguais, UUIDs distintos.
- `Call of Cthulhu` em mesas versus `O Chamado de Cthulhu`/`chamado-de-cthulhu` no glossário: exige alias/localização, não igualdade textual.
- edições do glossário usam slugs locais (`5e`, `2024`, `v20`); mesas possui nós independentes com `path_slug`.

## Consumidores e blast radius

### Mesas

- FK `tables.system_id`;
- preferências/perfis (`user_systems`);
- formulários e filtros públicos;
- gestão admin;
- parser Discord/inbox;
- sugestões, learning-store, métricas e notificações;
- drafts/importação guardam nome/ID em payloads históricos.

### Glossário

- `terms.system_id` e `terms.edition_id`;
- busca/listagem/detalhe;
- import/export;
- criação/revisão de termos;
- categorias e cenários relacionados;
- tela admin de estrutura.

O mantenedor aceita substituir totalmente esse CRUD/schema local de sistemas/edições. Preferir reescrita limpa a preservar abstração incompatível apenas por legado, desde que os termos sejam migrados com prova.

### Downloads

- filtros e metadados do material;
- compatibilidade e requisitos;
- taxonomia DriveThruRPG;
- submissão/moderação e busca.

## Restrições arquiteturais

- IDs canônicos devem permanecer estáveis.
- Apps não podem ler diretamente tabelas de outro banco de domínio.
- Escrita deve passar por um único serviço/contrato.
- Consumidores dependem da disponibilidade do serviço central.
- Mesas/glossário não podem ser migrados em big bang.
- APIs antigas precisam janela de compatibilidade.
- Mapeamento `legacy_id → canonical_id` é obrigatório por app/ambiente.
- Beta/prod seguem fluxo canônico; catálogos não podem cruzar ambientes.
- Cenários continuam fora desta unificação, salvo decisão futura.

## Opções arquiteturais

### A — Serviço dedicado de catálogo (recomendada)

Novo app/serviço técnico com Postgres próprio e API única de leitura/admin. Mesas, glossário e downloads consomem essa API e podem expor gestão contextual. A UI principal/completa vive no admin do `site`, na sidebar.

Vantagens:

- ownership neutro;
- DB e gestão realmente únicos;
- não acopla disponibilidade a um produto;
- contrato versionado;
- facilita futuros apps (`esferas`, `srd`).

Custos:

- novo serviço/deploy/monitoramento;
- auth admin e rede interna;
- disponibilidade cross-app e migração gradual.

### B — Catálogo dentro de `apps/mesas`

Mesas vira owner e expõe API para glossário/downloads.

Vantagens: catálogo e gestão mais maduros já existem.

Riscos: domínio compartilhado depende do deploy/DB de mesas; blast radius e ownership incorretos; futuros apps ficam subordinados a mesas.

### C — Catálogo dentro de `apps/downloads`

Downloads nasce owner e absorve mesas/glossário.

Vantagens: catálogo combina com descoberta.

Riscos: apps existentes dependeriam de app ainda inexistente; bloqueia migração e mistura fundação compartilhada com produto novo.

### D — Pacote versionado/JSON no monorepo

Catálogo em `packages/*`, atualizado por PR/deploy.

Vantagens: simples, leitura local e disponibilidade alta.

Riscos: não atende gerenciamento dinâmico/sugestões; IDs e atualizações exigem deploy; não é banco/gestão únicos em runtime.

### E — Replicação entre bancos

Um master replica para tabelas locais.

Vantagens: leitura resiliente e FKs locais.

Riscos: complexidade de sync, drift, conflitos e operação. Opção rejeitada pelo mantenedor.

## Recomendação técnica

Escolher **A — serviço dedicado**, usando:

- Postgres próprio;
- API central de leitura e escrita;
- API admin autenticada;
- contrato versionado;
- UI admin única;
- UI principal no `site` admin + clientes administrativos contextuais em mesas/glossário/downloads;
- import integral baseado no catálogo de mesas;
- mapeamento manual dos 12 sistemas/17 edições do glossário;
- tabelas de mapeamento legado por app/ambiente.
- reescrever o módulo de sistemas/edições do glossário como cliente do serviço central, removendo o CRUD local após janela de compatibilidade.

## Decisões fechadas pelo mantenedor

1. Administração pode ocorrer em qualquer app consumidor: mesas, glossário ou downloads.
2. Gestão principal/completa fica no admin do `site`, dentro da sidebar.
3. Banco, regras e escrita permanecem únicos/centrais; não haverá quatro implementações de CRUD.

## Decisões arquiteturais aprovadas

1. Serviço independente como fonte única, gerido principalmente pelo `artificiorpg.com`.
2. Serviço oferecido dentro do `artificiorpg.com`; não haverá host técnico público separado.
3. Mesas, Glossário e Downloads leem e escrevem integralmente no serviço central. Não haverá cópias/projeções locais do catálogo.
4. Cenários ficam fora, mantendo referência ao sistema canônico.
5. Sugestões, moderação, permissões e auditoria usam fluxo central único.
6. Modelo adota `system|edition|subsystem|variant`, nomes, traduções e aliases, preservando todos os recursos maduros do padrão Mesas.
7. Registro nunca é apagado nem arquivado sem destino. Duplicata ou item substituído deve ser mesclado em outro UUID canônico.
8. Catálogo Mesas é fonte principal considerada correta. Curadoria procura apenas conflitos materiais antes da migração; não presume que os 1.265 nós sejam suspeitos.
9. Os 12 sistemas e 17 edições do Glossário serão mapeados manualmente, um por um, e seus termos migrados.
10. A própria Spec 062 terá duas etapas, cada uma com fases próprias: investigação e implementação.

## Investigação profunda — arquitetura-alvo

### Ownership e localização

Decisão: serviço técnico independente, com banco próprio, integrado e gerido pelo `artificiorpg.com`. Não pertence aos bancos de domínio de `mesas`, `glossario` ou `downloads`. O `site-admin` é superfície principal e completa de gestão. Mesas, Glossário e Downloads também podem ajustar e alimentar o mesmo catálogo.

Responsabilidades do serviço:

- gerar e preservar UUID canônico;
- validar árvore, tipos, nomes, aliases, traduções e estados;
- receber sugestões e decisões de moderação;
- registrar auditoria imutável;
- publicar snapshot/versionamento e mudanças;
- manter merges/redirecionamentos de IDs;
- responder leitura canônica e impacto agregado informado pelos consumidores.

Responsabilidades dos apps:

- guardar somente referências UUID canônicas nos dados de domínio;
- expor UX contextual;
- nunca criar regra concorrente;
- informar uso/referências antes de merge;
- tratar indisponibilidade central de forma explícita.

Alternativas B/C foram rejeitadas tecnicamente: tornam taxonomia compartilhada dependente do ciclo e disponibilidade de um produto. `packages/*` pode conter tipos/client compartilhados, nunca dados nem ownership.

### Host

Decisão: serviço fica dentro do `artificiorpg.com`, sem hostname técnico público separado. A forma exata da rota será definida na etapa de implementação, respeitando contratos atuais do Site, SSO, CSRF e API governance.

Todos os consumidores puxam os dados desse serviço. Não haverá catálogo hospedado em Mesas, Glossário ou Downloads.

### API central, sem projeções locais

> **Superação parcial D114/Spec 078 (2026-07-15):** regra continua para Prod e demais consumidores, mas Mesas Beta mantém projeção local persistente de sistemas de RPG, hidratada do Central Site Prod por upsert aditivo com UUID preservado e zero delete de extras Beta. Exceção decidida após implementação parcial revelar consumidores locais e hidratação incompatíveis.

Decisão: todos leem e registram integralmente no serviço central. Não haverá cópia/projeção local do catálogo nos bancos consumidores.

Modelo:

1. serviço central = única API e verdade;
2. todas as mutações ocorrem nele;
3. consumidores guardam o UUID canônico apenas como referência de domínio;
4. detalhes de sistema/edição são buscados no serviço;
5. cache técnico transitório pode existir apenas para desempenho HTTP, sem virar banco, catálogo ou fonte alternativa;
6. indisponibilidade central pode impedir operações dependentes do catálogo; essa dependência é aceita e deve ser tratada por UX, timeout, retry e observabilidade.

Consequência aceita: Postgres não cria FK entre bancos independentes. `system_id`/`edition_id` nos consumidores guardam UUID canônico e são validados pelo serviço/API. A regra de nunca apagar UUID e sempre mesclar preserva referências históricas.

Implementação Mesas I4 (2026-07-10): os endpoints legados de Mesas (`/api/v1/systems*`) passam a ser fachada de compatibilidade sobre o serviço central. Reads usam snapshot central; writes usam API admin central com token interno server-to-server (`CATALOG_INTERNAL_TOKEN`) restrito à API de catálogo. Mesas não cria projeção local nova; contadores de mesas vinculadas continuam sendo agregados localmente porque pertencem ao domínio consumidor. Remoção no endpoint legado vira arquivamento central, não delete físico de UUID.

Implementação Glossário I5 (2026-07-10): os endpoints legados do Glossário (`/api/systems*`) também passam a ser fachada de compatibilidade sobre o serviço central. O Glossário para de consultar/gravar `systems`/`editions` locais nos fluxos de catálogo; termos, cenários, importação e exportação hidratam nomes pelo snapshot central e mantêm apenas UUIDs canônicos nas referências locais. A migração de referências existentes é feita por script dry-run/apply controlado, não por SQL solto.

Contrato conceitual mínimo:

- `catalog_version` monotônico;
- snapshot consistente com `generated_at`, contagem e checksum;
- redirect permanente para merge;
- endpoint de resolução por UUID, alias e caminho;
- ETag/`If-None-Match` para leitura;
- publicação somente após commit central.

Consistência:

- escrita: forte no serviço central;
- leitura administrativa após escrita: confirmação central imediata;
- leitura dos apps: direta no estado central confirmado.

## Modelo canônico conceitual

### Entidade `catalog_node`

- `id`: UUID canônico imutável;
- `parent_id`: UUID canônico opcional;
- `node_type`: `system|edition|subsystem|variant`;
- `canonical_slug`: segmento estável no escopo do pai;
- `path_slug`: derivado, não autoridade;
- `status`: `draft|pending|active|rejected|merged`;
- `description`;
- `official_website_url`;
- referência de mídia/logo opcional;
- `created_at`, `updated_at`, `created_by`, `updated_by`;
- `version`;
- `merged_into_id` quando aplicável.

Relações válidas iniciais, copiando comportamento material do mesas:

- `system`: raiz;
- `edition`: filha de `system`;
- `subsystem`: filho de `system`;
- `variant`: filha de `edition` ou `subsystem`.

Mudança de pai/tipo exige validação de ciclo, compatibilidade dos filhos, recalculo de caminhos e auditoria. `depth` e `path_slug` devem ser derivados/reconstruíveis; se materializados por desempenho, precisam de invariant checker.

### Nomes e traduções

Tabela conceitual separada `catalog_node_name`:

- `node_id`, locale BCP 47 (`pt-BR`, `en`, etc.);
- `name`;
- `kind`: `official|localized|display`;
- uma forma de exibição por locale;
- fallback explícito, inicialmente `pt-BR`, depois nome oficial.

`name_pt` não escala. Nome oficial não deve ser sobrescrito por tradução.

### Aliases

`catalog_alias`:

- `id`, `node_id`, `locale` opcional;
- `value`, `normalized_value`;
- `kind`: `official_abbreviation|common|former_name|translation|import`;
- `status`;
- origem/proveniência;
- timestamps.

Alias não identifica sozinho uma entidade. Normalização pode produzir colisões globais (`5e`, `2e`, `Merc`). Resolução deve usar contexto: pai, tipo e locale. Colisão vira lista de candidatos, nunca escolha silenciosa.

### Sugestão, auditoria e merge

Sugestão é entidade separada do nó. Nó pendente não deve poluir catálogo ativo.

- proposta de criar, editar, mover, traduzir, adicionar alias ou mesclar;
- autor, origem/app, justificativa, diff estruturado;
- estados `pending|approved|rejected|withdrawn`;
- revisor, decisão, motivo e timestamps;
- aprovação aplica mutação central numa transação e gera auditoria.

`audit_event` guarda ator, app de origem, ação, before/after, correlação e versão. Logs de app não substituem auditoria.

Merge preserva ID antigo como redirect permanente. Registro nunca é apagado nem arquivado. Item substituído sempre recebe `merged_into_id`.

## Fronteira semântica

Dentro:

- sistemas de regras;
- edições;
- subsistemas formalmente derivados;
- variantes/revisões compatíveis com a hierarquia;
- aliases, abreviações, traduções e nomes anteriores;
- metadados institucionais do sistema.

Fora:

- cenários/settings (`Forgotten Realms`, `Eberron`, etc.);
- editoras, autores, licenças, livros, aventuras, suplementos;
- plataformas/VTTs;
- categorias editoriais do glossário;
- tags e gêneros;
- compatibilidade específica de um material além das referências aos nós;
- versões de arquivo/produto.

Regra: “usa regras de” entra como referência ao catálogo; “acontece em”, “foi publicado por” ou “é um tipo de conteúdo” pertence ao domínio consumidor. Cenários podem referenciar `system_id` canônico, mas não viram nós. Caso ambíguo entra em fila humana; não ampliar enum no improviso.

## Permissões e administração distribuída

Capacidades centrais recomendadas:

- `catalog.read`;
- `catalog.suggest`;
- `catalog.review`;
- `catalog.write`;
- `catalog.merge`;
- `catalog.audit.read`.

Primeiro rollout:

- leitura pública de ativos;
- usuário autenticado pode sugerir onde produto permitir;
- somente `admin` revisa/escreve;
- merge exige capacidade elevada, confirmação e impacto conhecido;
- autoaprovação não entra nesta spec.

Mesmo usuário/role deve produzir mesmo resultado em qualquer filial. BFF não decide regra própria. Toda escrita leva ator SSO, app de origem, request/correlation ID e idempotency key. Site/sidebar oferece gestão completa; apps podem limitar UX, nunca autoridade.

## Mapeamento de UUIDs legados

Mapa obrigatório e permanente por ambiente:

- `source_app`: `mesas|glossario`;
- `source_environment`: `beta|prod`;
- `legacy_entity_type`: `system|edition`;
- `legacy_id`;
- `canonical_id`;
- `match_method`: `exact_path|exact_slug_parent|alias|manual|created`;
- `confidence`;
- `review_status`, `reviewed_by`, `reviewed_at`;
- evidência e checksum da origem.

Constraint única no legado; vários legados podem apontar ao mesmo canônico. Um legado nunca aponta a dois canônicos. Mapa não pode ser inferido novamente no momento do cutover.

Ordem de matching:

1. caminho/tipo/pai exatos;
2. slug sob pai já mapeado;
3. nome oficial/localizado normalizado;
4. alias contextual;
5. revisão humana.

Baixa confiança nunca é autoaprovada. UUID de beta e prod não é intercambiável.

## Validação dos 1.265 nós de mesas

Decisão: Mesas é catálogo principal e está correto. Seus 1.265 nós — 686 raízes, 392 edições e 187 variantes em prod — serão base canônica.

Validação não significa rediscutir ou reduzir o catálogo. Serve para impedir erro mecânico de migração:

Passos de curadoria:

1. congelar snapshot prod e beta separadamente;
2. validar invariantes: UUID, tipo, pai, ciclos, profundidade, `path_slug`, órfãos;
3. normalizar para comparação sem alterar original;
4. gerar candidatos por path, nome, tradução, alias, acrônimo e similaridade;
5. comparar filhos e usos; contexto pesa mais que texto;
6. classificar somente conflitos encontrados;
7. revisão humana de qualquer conflito ou merge;
8. criar canônico + mapas, preservando integralmente o Mesas quando não houver conflito material;
9. preservar alias/nome anterior/proveniência;
10. bloquear merge automático de slugs curtos/reutilizados.

Provas mínimas:

- zero ciclos, órfãos e paths duplicados;
- todo nó ativo tem nome oficial, tipo e hierarquia válida;
- 100% dos nós usados por mesas têm mapa aprovado;
- todo merge mantém redirect;
- relatório antes/depois por tipo, status, origem e motivo;
- amostra manual dos sistemas mais usados e de todos os casos ambíguos.

Quantidade inicial esperada é a do Mesas. Mudança de quantidade exige conflito concreto, revisão e merge explícito.

## Migração segura dos 8.795 termos do glossário

Blast radius confirmado:

- `terms.system_id` e `terms.edition_id`;
- `scenarios.system_id`;
- criação/edição de termo;
- criação inline de sistema/edição;
- importador resolve sistema por nome;
- export, busca, filtros e joins;
- apenas 11 termos prod têm edição; 8.795 têm sistema.

Plano sem big bang:

1. inventário imutável de contagens e referências por UUID;
2. mapa manual, item por item, dos 12 sistemas/17 edições;
3. disponibilizar serviço central e preparar referências UUID canônicas paralelas;
4. adicionar referência canônica paralela nos consumidores, sem remover legado;
5. backfill por mapa, em lotes idempotentes;
6. validar relação edição-pai e sistema;
7. shadow read: comparar resposta antiga e nova;
8. dual-read controlado por flag; sem dual-write para dois owners;
9. trocar escrita para o serviço central;
10. trocar leitura;
11. observar janela definida;
12. só depois aposentar CRUD/tabelas legadas.

Gates:

- total de termos idêntico antes/depois;
- 8.795/8.795 referências de sistema mapeadas no snapshot observado;
- 11/11 referências de edição mapeadas e coerentes;
- zero `source_type='sistema'` sem sistema;
- zero referência canônica órfã;
- distribuições por sistema e edição iguais após tradução pelo mapa;
- busca, import, export, criação e edição com resultados equivalentes;
- backup/dump e script reverso planejados antes de qualquer escrita futura.

Contagens são baseline de 2026-07-08; execução futura deve recalculá-las, nunca hardcode.

## Compatibilidade temporária

APIs públicas atuais permanecem nos hosts atuais:

- mesas: `/api/v1/systems`;
- glossário: `/api/systems` e edições aninhadas.

Fachadas adaptam modelo canônico ao shape legado durante janela versionada. Escritas antigas passam ao serviço central; não escrevem tabela antiga. Respostas devem incluir, quando compatível, `canonical_id` e deprecation metadata.

Casos obrigatórios:

- shape/envelope e filtros existentes;
- status aprovado/ativo;
- paginação/árvore do mesas;
- edições aninhadas do glossário;
- criação inline no termo convertida em sugestão, sem supor criação imediata;
- importador por nome usando resolução contextual e retorno ambíguo explícito;
- payloads históricos com UUID legado resolvidos pelo mapa.

Fim da compatibilidade exige telemetria de uso zero, consumidores migrados, documentação e data aprovada. Não remover por calendário apenas.

## Disponibilidade e falhas

Falha do catálogo central:

- consumidores não usam cópia local como substituta;
- leitura/operação dependente retorna indisponibilidade controlada;
- criação, edição e sugestão falham fechadas;
- consumidores não inventam nós temporários;
- timeout, retry limitado, circuit breaker, health e alertas evitam cascata silenciosa.

SLOs propostos para decisão posterior:

- propagação normal p95 menor que 60 s;
- alerta imediato de indisponibilidade ou latência excessiva do serviço;
- disponibilidade do catálogo deve acompanhar a criticidade cross-app;
- escrita fail-closed;
- RPO do catálogo conforme backup Postgres;
- cache transitório nunca autoriza escrita nem substitui verdade central.

Cache atual do mesas é memória por 60 s e invalidado só no processo local. Não serve como solução cross-app, multi-instância ou recuperação.

## Rollout beta/prod

Ambientes totalmente separados. Nunca copiar UUIDs beta como se fossem mapeamento prod; pode-se promover schema/software e seed curado, não relações legadas sem recalcular.

Ordem:

1. aprovar arquitetura/modelo/gates;
2. construir serviço central na Etapa II dentro do app `site`, servido por `beta.artificiorpg.com` primeiro;
3. beta central sem consumidores;
4. importar integralmente catálogo Mesas beta e validar;
5. conectar site-admin beta;
6. conectar mesas beta em shadow/read;
7. conectar glossário beta, backfill e provas;
8. downloads beta só nasce consumindo canônico;
9. soak beta e ensaio de rollback;
10. preparar prod com dump, mapas prod e relatório;
11. serviço prod;
12. mesas prod;
13. glossário prod;
14. downloads prod posteriormente.

Segue exatamente esteira canônica: branch `dev`/beta, promoção para `main`, deploy prod manual explícito. Decisão operacional de I1: a fundação central entra no app `site` existente e sobe primeiro em `beta.artificiorpg.com`; não há hostname técnico separado nem entrada própria de módulo no manifesto nesta fase. Se no futuro o serviço virar deploy técnico separado, isso exige decisão explícita nova.

## Rollback e provas de integridade

Rollback por fase:

- antes de escrita canônica: desligar consumidor;
- durante shadow: voltar feature flag;
- após backfill, antes de remover legado: voltar leitura/escrita à fachada anterior usando colunas e mapa preservados;
- após cutover: restaurar serviço pelo backup/snapshot; nunca “desmesclar” apagando auditoria;
- remoção física de legado só em spec posterior, após janela e backup.

Artefatos obrigatórios futuros:

- dump pré-migração por ambiente;
- snapshot e checksum do catálogo;
- mapa legado assinado/revisado;
- relatório de contagens e órfãos;
- comparação de distribuição;
- lista de ambiguidades;
- prova de resolução dos UUIDs canônicos;
- smoke de APIs antigas e novas;
- ensaio documentado de rollback em beta.

Gate final: rollback testado em beta, não apenas descrito.

## Estrutura da própria Spec 062

### Etapa I — investigação

Concluída com decisões do mantenedor. Contém inventário, arquitetura, modelo, migração, compatibilidade, rollout, rollback e gates.

### Etapa II — código

Permanecerá na Spec 062, dividida em fases executáveis:

1. fundação do serviço/banco/API central dentro do app `site`, com API pública/admin e primeiro deploy em `beta.artificiorpg.com`;
2. modelo completo baseado no Mesas;
3. importação integral do catálogo Mesas;
4. gestão principal no Site/sidebar;
5. migração de Mesas para leitura/escrita central;
6. mapeamento manual e migração do Glossário;
7. administração contextual em Mesas, Glossário e Downloads — I6 local começou por Mesas: admin no fluxo contextual pode criar nó central com aliases, Logo e Website Oficial sem sair para o Site Admin;
8. compatibilidade, observabilidade, beta, rollback e produção — I7 local adicionou readiness explícito do catálogo em Site, Mesas e Glossário; operação beta real segue gated por commit/PR/deploy/env/import/backfill/rollback aprovados.

Specs auxiliares só serão abertas se a implementação revelar um domínio independente que exija isolamento. Não dividir antecipadamente a 062 em sete specs.

## Conclusão investigativa — gate encerrado

Decisão fechada:

- serviço independente gerido no `artificiorpg.com`;
- sem host técnico separado;
- API central para leitura e escrita, sem projeções locais;
- árvore canônica tipada, nomes localizados, aliases contextuais, redirects de merge;
- cenários fora, apenas referenciando sistemas;
- sugestões, permissões e auditoria centrais desde a fundação;
- Mesas como catálogo principal correto;
- Glossário mapeado manualmente;
- migração gradual, mapas por app/ambiente e compatibilidade;
- nenhuma remoção de legado antes de prova e rollback beta.

Investigação encerrada e aprovada. Não restam perguntas arquiteturais bloqueantes na Etapa I.

Próxima etapa da própria 062: I0, detalhar tasks executáveis, contratos, migrations, testes, deploy e rollback antes de qualquer código. Descoberta técnica durante I0 pode refinar detalhes de execução, mas não reabre decisões D096–D099 sem conflito material comprovado.
