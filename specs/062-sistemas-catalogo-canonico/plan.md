# Plano — Spec 062

**Estado:** Etapa I (investigação) concluída e aprovada. Etapa II (código) em andamento: I0a, I0b, I1-I7 implementados localmente; I0a.15 (deploy beta) e I5a (mapeamento manual glossário) pendentes. Primeiro alvo operacional: `beta.artificiorpg.com` via app `site`.

## Referência visual aprovada do `SystemPicker` (mantenedor, 2026-07-09 — vinculante)

**Esta seção é a fonte de verdade visual/UX do `SystemPicker`. Qualquer implementação (I0a.2, I0a.13, I0a.14) deve reproduzir exatamente este estilo — não é sugestão, é o design aprovado.** Motivo de existir com este nível de detalhe: permitir que um agente sem contexto prévio da conversa implemente sem reinterpretar decisões já fechadas.

### Estrutura geral

Um único campo de busca no topo, seguido de um card com a árvore de resultados (não uma lista plana). A árvore é navegável: cada nó pode ser expandido/recolhido revelando os filhos, indentados por nível. Abaixo da árvore, quando algo está selecionado, aparece um bloco de confirmação com o caminho completo lido de cima a baixo.

```
[ Buscar sistema, edição ou variante...                    ]

┌─────────────────────────────────────────────────┐
│ ⌄  Dungeons & Dragons                    D&D +19│  nível 0 (sistema)
│    ›  3.5e                                       │  nível 1 (edição), recolhido
│    ⌄  5e                            5th ed       │  nível 1 (edição), expandido
│         ·  2024                              ✓  │  nível 2 (variante), SELECIONADO
│         ·  2014                                  │  nível 2 (variante)
│    ›  Advanced Dungeons & Dragons                │  nível 1 (edição), recolhido
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ ✓  Selecionado                                   │
│    Dungeons & Dragons › 5e › 2024                │
└─────────────────────────────────────────────────┘
  Cada nível é um nó com nome, nome PT e aliases
  próprios — o texto acima é a leitura da árvore de
  cima a baixo, não um campo salvo.
```

### Regra de dado (não visual, mas obrigatória pra entender o layout)

Cada nó da árvore (`system`/`edition`/`variant`/`subsystem`) tem `name`, `name_pt` e `aliases[]` **próprios e completos** — nenhum nível herda, deriva ou concatena nome do pai. O nó "5e" tem `name = "5e"`, não `"Dungeons & Dragons 5e"`. O que aparece como `"Dungeons & Dragons › 5e › 2024"` no bloco de confirmação é a **concatenação de exibição** dos nomes próprios de cada nível do caminho selecionado, montada em tempo de render — nunca um campo gravado no banco nem uma prop de "sufixo". Ver `## I0b` para a correção de dado que hoje viola esse modelo (573 nós com `name` sujo, gravado com o prefixo do pai por erro do import antigo).

### Cada linha da árvore (nó), da esquerda pra direita

1. **Indicador de expansão** — chevron (`▾`/`▸`) se o nó tem filhos; ponto pequeno (`·`) se é folha (sem filhos, ex.: variante sem sub-variante). Ocupa largura fixa pequena (~14px) pra alinhar todos os níveis.
2. **Indentação por nível** — cada nível de profundidade recua ~22px a mais que o pai (sistema=0, edição=1, variante=2). É isso que comunica hierarquia visualmente, não o texto.
3. **Nome próprio** — `name` do nó, negrito, 13px. Só o nome desse nível (`"5e"`, `"2024"`), nunca o caminho completo.
4. **Nome PT** — linha logo abaixo do nome, 11px, cor apagada (`--fg-muted`), formato `"nome PT: {valor ou —}"`. Sempre visível (não esconder quando vazio) pra deixar claro que o campo existe e é opcional.
5. **Aliases** — só quando o nó tem alias(es), badge arredondado à direita da linha, texto pequeno (10px), mostra 1 alias + contador se houver mais (`"D&D +19"`). Sem aliases, não renderiza nada nesse espaço (não deixar badge vazio).
6. **Check de seleção** — ícone de check só na linha do nó atualmente selecionado, mesma cor do acento de marca (laranja).

### Nó selecionado — destaque

A linha do nó selecionado (não as linhas ancestrais no caminho até ele) recebe: fundo com tom do acento de marca em baixa opacidade (`rgba(255,87,34,.1)`), borda esquerda sólida de 3px na cor do acento (`var(--artificio-brand)`, `#ff5722`), ícone de check à direita. As linhas ancestrais (ex.: "Dungeons & Dragons" e "5e" quando "2024" está selecionado) ficam com aparência normal, expandidas pra revelar o caminho — não recebem o mesmo destaque, senão perde-se qual é o nó de fato escolhido.

### Bloco de confirmação (abaixo da árvore)

Card separado, borda sólida na cor do acento, fundo com o mesmo tom translúcido do destaque de seleção. Ícone de check + rótulo `"Selecionado"` (12px, negrito, cor do acento) na primeira linha; caminho completo (`sistema › edição › variante`, separador `›`) na segunda linha, 13px, cor de texto normal. Só aparece quando há seleção — sem seleção, o espaço fica vazio (não mostrar placeholder "nada selecionado").

Abaixo do card, texto de apoio (11px, `--fg-muted`) explicando a regra de nome próprio — existe pra treinar o usuário a entender que editar o nome de "5e" não deveria incluir "Dungeons & Dragons" na frente.

### Cores (tokens reais do projeto, `packages/ui/src/styles.css` — nunca hexadecimal solto)

| Elemento | Token | Light | Dark |
|---|---|---|---|
| Fundo do card/superfície | `--surface` | `#ffffff` | `#1b2a4a` |
| Fundo hover de linha | `--surface-subtle` | `#eef2f8` | `#16223e` |
| Borda entre linhas | `--line` | `rgba(2,7,64,.14)` | `rgba(255,255,255,.1)` |
| Fundo de badge/alias | `--fill` | `rgba(2,7,64,.08)` | `rgba(255,255,255,.1)` |
| Texto principal | `--fg` | `#0b1220` | `#eef1f8` |
| Texto apagado (nome PT, hints, chevron) | `--fg-muted` | `rgba(11,18,32,.66)` | `#aab3c7` |
| Acento de seleção/marca | `--artificio-brand` | `#ff5722` | `#ff5722` (mesmo valor, não escurece) |
| Fundo do destaque de seleção | — | `rgba(255,87,34,.1)` sobre `--surface` | idem |

Ambos os temas usam a mesma estrutura — só os valores de `--surface`/`--fg`/`--line` trocam via `:root[data-theme="dark"]` (ver `packages/ui/src/styles.css:105`). Nunca hardcodar `#fff`/`#000`/cinza fixo fora desses tokens.

### Campo de busca

Input único no topo, fora do card da árvore, largura total, placeholder `"Buscar sistema, edição ou variante..."`. Ao digitar, filtra a árvore mantendo a estrutura hierárquica (não vira lista plana) — nós que não casam e não têm filho que case ficam ocultos; nós ancestrais de um match ficam visíveis mesmo sem match direto, pra manter o contexto do caminho.

### Comportamento de permissão (ver task I0a.2 em `tasks.md` para o texto completo da decisão)

É **o mesmo componente e o mesmo layout de árvore** para mestre e admin — não existe variante visual por tela. O que muda por `role`:
- Nó/termo não encontrado na busca: usuário comum vê ação "Sugerir"; admin vê "Sugerir" e "Criar agora" lado a lado.
- Nó existente selecionado: admin ganha um ícone de editar (lápis) ao lado do nó, ausente para usuário comum.

### Mockup de referência (aprovado 2026-07-09)

Arquivo standalone: `sessoes/assets/062-systempicker-arvore-mock.html`. Abrir direto no navegador — reproduz light/dark via `prefers-color-scheme`. Usar como padrão pixel-a-pixel de estrutura, espaçamento e cor ao implementar `SystemPicker`, não só como inspiração.

## Fases da investigação

1. Inventário material de `mesas`.
2. Inventário material de `glossario`.
3. Comparação, consumidores e dados reais beta/prod.
4. Ownership, localização, host e trust boundaries.
5. API central integral, dependência direta, disponibilidade e cache transitório.
6. Modelo canônico, fronteira semântica, sugestões, permissões e auditoria.
7. Mapeamento de UUIDs e validação do catálogo principal Mesas.
8. Migração do glossário e preservação dos termos.
9. Compatibilidade, disponibilidade, propagação e falhas.
10. Rollout beta/prod, rollback e provas.
11. Aprovação do mantenedor.
12. Preparação da etapa de código na própria Spec 062.

## Recomendação

Serviço independente com DB próprio, oferecido e gerido pelo `artificiorpg.com`. Gestão principal no admin do Site/sidebar; Mesas, Glossário e Downloads administram como clientes.

Leitura e escrita integrais no serviço central, sem projeções locais. Mesas é catálogo principal correto e base canônica. Glossário mapeia manualmente seus 12 sistemas/17 edições e migra as referências dos termos.

## Etapa II — implementação nesta spec

0a. Unificação de consumo frontend do catálogo em `apps/mesas` (antecipável, não depende do serviço central).
1. Fundação central no app `site`, primeiro em `beta.artificiorpg.com`.
2. Modelo completo e importação integral do catálogo Mesas para o serviço central.
3. Gestão principal no site.
4. Migração do Mesas para consumo central.
5. Reescrita/migração glossário.
6. Administração distribuída e entrada de downloads.
7. Hardening/remoção de legado.

## I1 — Fundação central (`apps/site`, beta primeiro)

**Decisão operacional (2026-07-10):** o serviço/banco/API central nasce dentro do app `site`, servido primeiro por `beta.artificiorpg.com`. Não há host técnico separado, não há novo módulo no manifesto e não há prod nesta rodada. A promoção para `main` e deploy prod continuam bloqueados por aprovação nominal futura.

**Escopo de I1:** criar a fundação vazia e testável, ainda sem consumidores conectados. Inclui schema central, repo de domínio e API HTTP mínima. Não importa dados do Mesas, não altera `mesas`, não altera `glossario` e não cria UI de gestão completa.

**Modelo mínimo implementado:**

- `catalog_versions`: versão monotônica do catálogo.
- `catalog_nodes`: UUID canônico, árvore `system|edition|subsystem|variant`, slug por pai, `path_slug`, status, merge target, metadados e autoria.
- `catalog_aliases`: aliases próprios do nó.
- `catalog_redirects`: redirect permanente de UUID após merge.
- `catalog_suggestions`: entidade separada para sugestões/moderação.
- `catalog_audit_events`: auditoria imutável de mutações centrais.

**API inicial:**

- Pública/read-only: `GET /api/catalog/v1/systems`, `GET /api/catalog/v1/nodes/:idOrSlug`, `GET /api/catalog/v1/resolve?q=...`.
- Admin: `GET /api/admin/v1/catalog/snapshot`, `POST /api/admin/v1/catalog/nodes`, `PUT /api/admin/v1/catalog/nodes/:id`.

**Gate de conclusão I1:** TypeScript do site, build/test do site, `verify:api`, migration real em PGlite limpo e smoke de repo criando sistema+edição, gerando snapshot e resolvendo por `path_slug`.

**Próximo código após I1:** I2 importa o catálogo material do Mesas para essas tabelas centrais no ambiente beta, com contagens, checksum e relatório. Consumidores só entram depois.

## I2 — Importação Mesas → catálogo central

**Decisão operacional:** I2 prepara e valida o mecanismo de importação, ainda sem trocar consumidores. A execução real em beta usa fonte Mesas beta e destino Site beta; prod continua fora até nova aprovação.

**Componentes implementados:**

- `catalog_legacy_mappings`: mapa legado→canônico por `source_app`, `source_environment`, tabela e `legacy_id`.
- `import-mesas-catalog.ts`: importador idempotente que lê `MESAS_DATABASE_URL` ou `MESAS_CATALOG_JSON`.
- Relatório JSON com contagens de fonte, criados/atualizados/inalterados, mappings, versão e checksum.

**Regras do importador:**

- ordena pais antes dos filhos;
- preserva `system|edition|subsystem|variant`;
- usa `slug` do Mesas como `canonical_slug` e reconstrói `path_slug` pelo pai canônico;
- preserva `name`, `name_pt`, `description`, aliases, logo e website;
- gera UUID canônico novo por ambiente e mantém estabilidade via `catalog_legacy_mappings`;
- rerun é idempotente: se checksum da fonte não mudou, não cria nem atualiza nó;
- `CATALOG_IMPORT_DRY_RUN=true` executa tudo em transação e dá rollback após gerar relatório.

**Gate local de I2:** aplicar migrations 006+007 em PGlite limpo, importar fixture sample, repetir import para provar idempotência, rodar TypeScript/build/test do site e `verify:api`.

**Pendente operacional de beta:** após commit/PR/deploy beta do `site`, executar o importador com `MESAS_DATABASE_URL` apontando para `mesas-beta-db`, `DATABASE_URL` apontando para `site-beta-db`, `CATALOG_SOURCE_ENV=beta` e relatório preservado na sessão.

## I3 — Gestão principal no Site Admin

**Decisão operacional:** a superfície principal de administração do catálogo entra no `site-admin`, dentro da sidebar existente do Site. Continua sendo beta primeiro; nenhum consumidor muda nesta fase.

**Escopo implementado localmente:**

- rota SPA `/admin/catalogo-sistemas`;
- item "Sistemas" na sidebar;
- leitura do snapshot central com versão, contagem e checksum;
- árvore pesquisável por nome, nome PT, slug, path e aliases;
- formulário admin para criar sistema raiz, criar filho e editar nó;
- campos preservados: tipo, pai, nome, nome PT, slug, aliases, Logo e Website Oficial.

**Não escopo de I3:** moderação completa de sugestões, merge/redirect destrutivo, import real de beta e cutover de consumidores. Esses passos ficam para I4+I7.

**Gate local de I3:** `site-admin` typecheck/build e `verify:api`.

**Pendente operacional:** smoke visual autenticado em `beta.artificiorpg.com/admin/catalogo-sistemas` após commit/PR/deploy beta do `site`.

## I4 — Mesas como consumidor integral do catálogo central

**Decisão técnica (2026-07-10):** Mesas mantém os endpoints legados `/api/v1/systems*` como fachada de compatibilidade, mas leitura e escrita de catálogo passam pelo serviço central no `site`. Não há projeção local nova nem escrita concorrente em `systems`/`system_aliases` para CRUD de catálogo.

Implementação local:

- `apps/mesas/backend/src/services/catalogClient.ts` é o cliente único do catálogo central para Mesas.
- Leitura usa `GET /api/catalog/v1/systems`.
- Escrita usa `POST|PUT /api/admin/v1/catalog/nodes`.
- Autenticação server-to-server usa `CATALOG_INTERNAL_TOKEN` enviado por Mesas como `x-artificio-catalog-token`.
- `apps/site/server/server.ts` aceita esse token apenas na API admin do catálogo; demais APIs admin continuam por SSO admin.
- `GET /api/v1/systems` preserva shape legado (`slug`, `path_slug`, `aliases`, `children`, `logo_filename`, `website_url`, contadores) para frontend Mesas.
- `tables_count` continua calculado no banco Mesas, porque mesas permanecem domínio consumidor local.
- `DELETE /api/v1/systems/admin/:id` vira arquivamento central (`status=rejected`) após bloquear filhos/mesas; UUID canônico nunca é apagado.

Pendente operacional para beta:

- configurar `CATALOG_API_URL` no backend Mesas apontando para o `site` beta;
- configurar o mesmo `CATALOG_INTERNAL_TOKEN` em `site` e `mesas`;
- garantir import real beta I2 antes do smoke de Mesas;
- deploy beta de `site` e `mesas`;
- smoke `/api/v1/systems?view=tree`, busca flat e CRUD admin por fachada Mesas.

## I5 — Glossário como consumidor integral do catálogo central

**Decisão técnica (2026-07-10):** Glossário mantém `/api/systems*` como fachada de compatibilidade para o frontend atual, mas deixa de possuir CRUD próprio de sistemas/edições. O backend passa a ler e escrever no serviço central do `site`, usando o mesmo `CATALOG_API_URL` e `CATALOG_INTERNAL_TOKEN` de Mesas.

Implementação local:

- `apps/glossario/backend/src/services/catalogClient.ts` é o cliente único do catálogo central para o Glossário.
- `systemController.ts` lista sistemas/edições via snapshot central e cria/edita via `POST|PUT /api/admin/v1/catalog/nodes`.
- Delete legado vira arquivamento central (`status=rejected`) após bloqueio por termos, cenários e edições.
- `termController.ts`, `scenarioController.ts` e `exportController.ts` deixam de fazer join em `systems`/`editions` locais para nomes; hidratam `system_name`/`edition_name` via snapshot central.
- `importController.ts` resolve `system_name` de planilhas contra nomes do catálogo central.
- `mergeUsers.ts` não tenta mais mover autoria em `public.systems`, pois ownership virou central.
- `apps/glossario/backend/src/scripts/migrateGlossarioCatalogRefs.ts` cria o procedimento de mapeamento de referências locais antigas para UUIDs centrais; dry-run por padrão, apply só com `GLOSSARIO_CATALOG_MIGRATION_APPLY=true`.

Pendente operacional para beta:

- configurar `CATALOG_API_URL` e `CATALOG_INTERNAL_TOKEN` no backend Glossário;
- rodar `pnpm --filter @artificio/glossario-backend catalog:migrate-refs` em dry-run com relatório visível;
- aplicar o mapeamento só após aprovação nominal;
- smoke de busca/lista de termos, admin de estrutura, criação/edição de sistema/edição e export MateCat.

## I6 — Administração contextual nos consumidores

**Decisão técnica (2026-07-10):** I6 começa pelo consumidor que gerou dor real em beta: Mesas, no fluxo de revisão/importação Discord. Não criaremos `packages/catalog-ui` nesta rodada, porque seria pacote compartilhado e ampliaria o blast radius; a lógica de persistência já está centralizada no serviço do `site` e o Mesas só usa a fachada `POST /api/v1/systems/admin`.

Implementação local:

- `SystemSuggestionModal.tsx` passa a oferecer, para admin, os campos de cadastro central que já existiam no contrato: aliases, Logo e Website Oficial.
- O formulário continua criando um nó por vez, com `node_type` e `parent_id`; edição/variante/subsistema são cobertos pelo seletor de tipo + pai.
- Usuário comum mantém o fluxo moderado de sugestão em cadeia, sem write direto.
- Teste `suggestionModals.test.tsx` cobre o payload admin com `aliases`, `logo_filename` e `website_url`.

Não escopo de I6 local:

- extração de pacote compartilhado de UI;
- criação encadeada admin sistema→edição→variante em uma única submissão;
- smoke beta real, que fica em I7 junto de deploy, env central, import real e rollback.

## I7 — Compatibilidade, observabilidade e operação beta

**Decisão técnica (2026-07-10):** readiness do catálogo central deve ser explícito e separado do health Docker dos apps consumidores. Se o catálogo central cair, Mesas/Glossário devem mostrar erro acionável nos fluxos de catálogo, mas o container não deve ser reiniciado por depender de outro serviço durante rollout.

Implementação local:

- Site expõe `GET /api/catalog/v1/health`, com `ok`, `catalog_version`, `nodes_count` e `checksum`.
- Mesas expõe `GET /api/v1/systems/health`, validando o catálogo central via `CATALOG_API_URL`/`CATALOG_INTERNAL_TOKEN` quando aplicável.
- Glossário expõe `GET /api/systems/health`, com o mesmo contrato de readiness.
- Endpoints legados de leitura/escrita permanecem compatíveis; os novos endpoints são só smoke/observabilidade.

Pendente operacional para beta:

- commit/PR/merge para `dev`;
- configurar `CATALOG_INTERNAL_TOKEN` no `site`, `mesas` e `glossario` beta;
- configurar `CATALOG_API_URL` dos consumidores apontando para o Site beta;
- deploy beta de `site`, `mesas` e `glossario`;
- rodar import real Mesas→Site beta;
- rodar dry-run do mapeamento Glossário e aplicar só após aprovação nominal;
- smoke das três rotas de readiness, `/api/v1/systems?view=tree`, `/api/systems`, admin Site e export Glossário;
- ensaio de rollback beta antes de qualquer conversa de produção.

## I0a — Unificação de consumo frontend (`apps/mesas`)

**Motivo:** 5 telas (`StepSystem`/criar mesa, `CatalogoPage`, `UserSystemsSelector`×2 no perfil, `OnboardingPage`) reimplementam cada uma seu próprio fetch de árvore (prop herdada, `fetch` cru sem auth helper, `authGet` em payload agregado, `useState`/`useEffect` local), seu próprio flatten e mapas id→slug/id→nome, e alternam entre 2 componentes de seleção (`SystemTreeSelector` grid-3-colunas e `SystemAutocomplete`) sem critério único. `StepSystem.tsx` chega a mostrar 4 representações simultâneas da mesma escolha (busca + grid + 2 `<select>` de edição/variante + texto de caminho), confuso e não funcional para o fluxo de criar mesa.

**Modelo de dados (lendo o que já existe em `apps/mesas`, sem schema novo — CORRIGIDO 2026-07-09, ver `## I0b` para a regra completa e a razão da correção):**

- Hierarquia fixa: `sistema > edição > variante` (tipos reais do banco continuam `system|edition|variant|subsystem`, ver `types/systems.ts`; `subsystem` é caso raro tratado como nível intermediário quando ocorrer).
- Por nó: `name` (obrigatório, **nome próprio completo desse nível só — nunca inclui o nome do pai**), `name_pt` (opcional, próprio desse nível, fallback pra `name` quando vazio), `slug`, `node_type`, `aliases[]` (opcional, próprios desse nível), `path_slug` (derivado, não editável direto — usado só para URL/roteamento, nunca para exibição de nome), `children[]`, `logo_filename`, `website_url`, `children_count`, `tables_count` e `aliases_count`. `logo_filename` e `website_url` são campos reais do catálogo e hoje aparecem/editam no admin como **Logo** e **Website Oficial** apenas para nós raiz (`node_type = system`); o hook não pode descartá-los mesmo que o `SystemPicker` v1 não os renderize.
- **Não existe `pathLabel` nem qualquer campo "label composto" persistido.** Quando uma tela precisa exibir o caminho completo (ex.: `"Dungeons & Dragons › 5e › 2024"`), isso é concatenação de EXIBIÇÃO montada em tempo de render a partir dos `name` próprios de cada nível do caminho selecionado — nunca lido de um campo do banco, nunca calculado por "sufixo do pai". Ver seção "Referência visual aprovada do `SystemPicker`" no topo deste arquivo.
- Sem novo campo em `systems`, sem migration de schema nesta parte — Etapa I0a é reorganização de consumo frontend. A única migration de dado é I0b (correção dos 573 nomes sujos, ver abaixo), que **não adiciona nem remove coluna**, só corrige o conteúdo de `name` que hoje viola a regra de nome próprio.

**Arquitetura da solução:**

- `useSystemsCatalog()` (novo hook em `apps/mesas/frontend/src/hooks/`): único ponto de `GET /api/v1/systems?view=tree`, cache com TTL + `forceRefresh` (não cache eterno de sessão — ver decisão mais abaixo), retorna a árvore completa (nó com `children[]`, cada nó com `name`/`name_pt`/`slug`/`node_type`/`aliases[]`/`logo_filename`/`website_url`/contadores próprios preservados) + uma view "flat" (lista de todos os nós, útil para busca) + `loading`/`error` padronizados. Deve ampliar o tipo público `SystemTreeNode` para refletir o payload real do backend, incluindo **Slug**, **Tipo**, **Aliases**, filhos/edições/variantes, **Logo** e **Website Oficial**, sem normalização que perca campos. **Não expõe nenhum "label composto" pronto** — telas que precisam de 1 linha de texto montam a concatenação de exibição no próprio componente (`SystemPicker`), a partir do caminho selecionado, não do hook. Substitui os 3 padrões de fetch hoje espalhados (prop herdada, `fetch` cru, `authGet` em payload agregado).
- `SystemPicker` (novo componente em `apps/mesas/frontend/src/components/`): layout de árvore navegável (não dropdown de lista plana, não grid de 3 colunas) — ver seção "Referência visual aprovada" no topo deste arquivo para o design completo, obrigatório. Busca por nome/`name_pt`/slug/alias (reaproveita `matchesSystemQuery` de `utils/systemTree.ts`) filtra a árvore mantendo hierarquia. Modo `single` (criar mesa, catálogo) e `multi` (perfil, onboarding) via prop, mesmo componente visual — não dois componentes divergentes como hoje (`SystemTreeSelector` vs `SystemAutocomplete`). Ações disponíveis (sugerir/criar direto/editar) variam por `role` do usuário, não por modo visual — ver seção "Comportamento de permissão".
- Digitar-para-adicionar quando não encontra: reaproveita `SystemSuggestionModal` já existente (fluxo de sugestão/moderação já implementado, sem inventar segundo caminho de criação).
- Digitar-para-excluir (remover seleção): botão "x" no chip, sem confirmação modal (ação local reversível, diferente de deletar nó do catálogo que é admin-only e já tem guard próprio).
- `SystemTreeSelector` (grid 3 colunas) deixa de ser consumido por telas de usuário final; fica restrito ao admin de catálogo, onde navegar a árvore inteira faz sentido.

**Arquivos afetados:**

- Novo: `hooks/useSystemsCatalog.ts`, `components/SystemPicker.tsx`.
- Editados: `components/form-steps/steps/StepSystem.tsx`, `pages/CatalogoPage.tsx`, `components/UserSystemsSelector.tsx`, `pages/OnboardingPage.tsx`.
- Sem mudança: `apps/mesas/backend/**` (nenhuma rota nova/alterada), `SystemTreeSelector.tsx` (mantido, uso restrito a admin), `utils/systemTree.ts` (reaproveitado).

**Rollback:** reverter para os componentes/hooks antigos via `git revert` do PR; nenhuma migration, nenhuma mudança de contrato de API — rollback é puramente frontend.

**Validação:** `pnpm run lint` + `pnpm --filter @artificio/mesas-frontend build` verdes; smoke visual dos fluxos migrados via preview local. Deploy só em beta nesta rodada, sem promote/prod.

**Inventário completo de consumidores/rotas (investigação ampliada 2026-07-09, a pedido do mantenedor — "não descartar nenhuma API sem aprovação"):**

Reimplementações de fetch de árvore encontradas (9, não 5 como no levantamento inicial):

1. `StepSystem.tsx` (criar mesa) — árvore via prop herdada do form pai; `SystemTreeSelector` grid+2 `<select>`.
2. `CatalogoPage.tsx` (filtro) — `useState`/`useEffect` local; `SystemAutocomplete`.
3-4. `UserSystemsSelector.tsx` (perfil: favoritos + mestrado) — `fetch` cru sem auth helper; `SystemTreeSelector` multi.
5. `OnboardingPage.tsx` — árvore embutida no payload agregado `/api/v1/me/options`; `SystemTreeSelector` multi.
6. `SystemSuggestionModal.tsx` — `authGet('/api/v1/systems?view=tree')` própria; usado para escolher `parent_id` ao sugerir/criar nó (sistema/edição/variante/subsystem).
7. `features/discord-sync/draftFormUtils.ts` (`loadSystems`) — cache em memória com TTL 5 min + `forceRefresh` manual (invalidado após criar sistema via `SystemSuggestionModal` dentro do editor de draft); bom padrão, espelha o cache TTL que o backend (`apps/mesas/backend/src/routes/systems.ts:171`, `systemsTreeCache`) já faz — referência para o `useSystemsCatalog()`, não gambiarra a descartar.
8. `features/discord-sync/components/SystemSearchSelect.tsx` — busca flat simples sobre `SearchSelect` genérico, consumido só no editor de draft (staff/importação, não usuário final); bom padrão de busca, isolado do resto.
9. `features/admin/systems/useSystems.ts` — `authGet`/`authPost`/`authPut`/`authDelete` próprios, paginado; é o admin de catálogo (CRUD completo), fora do escopo de unificação de consumo (admin continua com fluxo próprio).

Auditoria de rotas de sistema (via `artificio-api-governance` + grep + Serena, nenhuma descartada sem confirmação real de uso):

- `GET/POST/PUT/DELETE /api/v1/systems*` — ativas (público + admin).
- `POST/DELETE /api/v1/profile/systems*` — ativas; caminho real em uso hoje via `useProfileQuery.ts`/`useAddSystem`/`useRemoveSystem` (React Query) e `ProfileContext`.
- `POST/DELETE /api/v1/profile/me/systems*` — **órfã confirmada**. Rota original em `profile.ts`; `/profile/systems*` foi criada depois como "alias de compatibilidade" com handler idêntico (mesmo `profileService.addUserSystem`/`removeUserSystem`), nunca migrado de volta. `useProfile.ts` (hook que a chama) tem zero referência real de uso — só exporta tipos (`PlayerProfile`, `GmProfile`) reaproveitados por `profileContextCore.ts` e `ProfileEditPage.tsx` via `import type`. Confirmado por grep + `find_referencing_symbols` (Serena): 0 chamadas à função `useProfile()`.
  - **Decisão do mantenedor (2026-07-09): remover.** Manter só `/api/v1/profile/systems*` (rota já ativa), apagar rotas `/me/systems*` do backend (`profile.ts`) e apagar `useProfile.ts` do frontend (hook morto). Entra como task própria em `tasks.md` (I0a.0).
- `POST /api/v1/system-suggestions`, `GET /system-suggestions/mine` — ativas (`SystemSuggestionModal`, fluxo de sugestão do usuário comum).
- `/api/v1/admin/system-suggestions*` (5 rotas: list, candidates, approve, reject, resolve) — ativas (`ComunidadeSection`, `SystemSuggestionResolutionDrawer`, `useAdminPendencias`).
- `/api/systems*` do glossário (7 rotas) — ativas via client com baseURL (`api.get('/systems', ...)` em `AdminStructurePage.tsx`); apareceram como sem-consumidor no bundle só porque o gerador não resolve baseURL relativo — falso órfão, confirmado por leitura direta do código.

Decisões do mantenedor (2026-07-09):

- Cache do `useSystemsCatalog()` segue o padrão TTL+`forceRefresh` de `draftFormUtils.ts`/backend (`systemsTreeCache`), não cache eterno de sessão.
- `SystemSuggestionModal.tsx` entra na migração para `useSystemsCatalog()` (elimina reimplementação nº 6 de fetch).
- Fluxo Discord (`draftFormUtils.ts`/`loadSystems` + `SystemSearchSelect.tsx`) **entra na unificação**: também precisa de redesenho visual, não só troca de fonte de dados.

**Correção de escopo (investigação confirmada por código, 2026-07-09): são 3 fluxos distintos de usuário, não 2.** O mantenedor apontou que o mestre no draft/criação de mesa **nunca passa por parser** — só busca e seleciona sistema/edição/variante existentes, ou sugere um novo, manualmente. Confirmado lendo o código real (não suposição):

| Fluxo | Componente real | Rota/onde vive | Parser envolvido? | Quem usa |
|---|---|---|---|---|
| Mestre cria/edita mesa | `StepSystem.tsx` → `SystemTreeSelector` (futuro `SystemPicker` single) | `CreateTableForm.tsx`, dentro de `PainelMestrePage.tsx` | **Não.** Busca/seleção manual, ou sugestão avulsa via `SystemSuggestionModal`. | Mestre comum (usuário final público) |
| Revisor de moderação de drafts Discord | `DraftEditorTab.tsx` → `SystemSearchSelect.tsx` + `SystemSuggestionModal` | `ModeracaoSection.tsx` (confirmado via grep — só é importado aqui, dentro de `features/admin/`) | **Sim, indireto.** O parser já rodou no backend antes; esta tela mostra o resultado (`system_id`/`raw_system_hint`) e deixa o revisor corrigir/confirmar. | Staff/admin, não mestre comum |
| Importação em lote (ingestão do JSON/mensagem Discord) | `parseDiscordAnnouncement.ts` (backend, roda em `routes/discord/drafts.ts`/`routes/inbox/*`) | Backend, na ingestão inicial, antes de qualquer tela | **Sim, é aqui que o parser de fato executa** — resolve nome de sistema por texto/alias com prioridade e desambiguação por versão. | Disparado por staff (importação), sem UI própria de "parsing" — o resultado vira draft que a tela de moderação acima revisa |

Consequência prática pra I0a.9 (Discord) e pras 3 telas mockadas na sessão de visualização: a tela do **mestre** (`StepSystem`/`SystemPicker` single) não deve mostrar nenhuma referência a "parser não identificou" — isso não existe nesse fluxo. Essa mensagem só é real na tela do **revisor de moderação** (`DraftEditorTab`), que já recebe o resultado do parser rodado no backend. A tela de **importação em lote** (JSON) é a única onde o parser roda de fato, e é sobre o resultado dela que a cascata sistema→edição→variante (I0a.10-14) se aplica com mais força — é lá que aparecem sistemas novos/não identificados em massa, não no fluxo do mestre.

## Lacuna real descoberta: criação em cascata (sistema→edição→variante) não existe

**Problema concreto relatado pelo mantenedor:** para cadastrar um variante novo cuja edição e sistema também não existem ainda, hoje é preciso 3 idas separadas ao `SystemSuggestionModal` — criar sistema, sair, reabrir, criar edição escolhendo o sistema recém-criado num dropdown, sair, reabrir, criar variante escolhendo a edição. Se qualquer etapa for sugestão de usuário comum (não admin), fica pendente de aprovação e trava as etapas seguintes por falta de pai já existente no catálogo.

**Confirmado em 3 camadas que a lacuna é real, não impressão:**

- `system_suggestions` (schema) — 1 linha = 1 nó; sem conceito de lote/cadeia.
- `POST /api/v1/system-suggestions` (`systemSuggestions.ts:15`) — aceita 1 nó por chamada, `parent_id` deve referenciar nó já existente no catálogo (`systems`), nunca outra sugestão pendente.
- `POST /api/v1/admin/system-suggestions/:id/resolve`, `resolution_type=create_child` (`systemSuggestionsAdmin.ts:657`) — mesma trava: exige `parent_id` de nó **já existente** em `systems`; não resolve cadeia, só 1 nível por vez.

**Solução proposta — criação em cascata numa transação:**

- `system_suggestions` ganha suporte a lote: campo agrupador (ex.: `batch_id`) ou referência interna entre linhas da mesma submissão, permitindo que uma sugestão de nível N referencie a sugestão de nível N-1 da mesma remessa como pai (em vez de exigir `parent_id` de nó já existente em `systems`).
- `POST /api/v1/system-suggestions` aceita array de nós (sistema→edição→variante) numa única submissão; cada nó no array referencia o índice do nó-pai na mesma lista quando o pai também é novo, ou um `parent_id` real quando o pai já existe no catálogo (reaproveitamento parcial da cadeia).
- Novo `resolution_type: create_chain` em `POST .../resolve` — aprova a cadeia inteira numa transação: cria cada nível na ordem, resolvendo o `parent_id` do nível anterior com o `id` real recém-criado (mesma lógica de `create_child`, encadeada).
- UI (`SystemPicker`/`SystemSuggestionModal` redesenhados): formulário único com até 3 linhas (sistema/edição/variante); cada linha detecta autonomamente se o texto já existe no catálogo (reaproveita, mostra check) ou é novo (marca para criação, mostra +); envia tudo numa submissão só.
- Requer **migration nova** em `system_suggestions` (campo de agrupamento) — SDD Completo formal: `plan.md` de rollback, header de migration com os 5 campos obrigatórios (ver AGENTS.md §Migrations), sem quebrar sugestões pendentes já existentes (linhas antigas continuam válidas como cadeia de tamanho 1).

**Sequenciamento de PR (achado da revisão cruzada, 2026-07-09):** I0a.10-14 (migration de lote + 2 rotas + redesign de `SystemPicker` + redesign de `SystemSuggestionResolutionDrawer`) formam um bloco de trabalho grande e coeso — decisão: **entram num PR próprio, separado do PR de I0a.0-9** (rota órfã + hook + componente v1 + migração das 7 telas). Motivo: I0a.2 cria `SystemPicker` v1 (seleção simples) e I0a.13 o redesenha por completo para lote — se os dois PRs forem misturados, o bot de revisão (CodeRabbit/Codex/Amazon Q) analisa um componente sendo escrito e reescrito na mesma janela de diff, o que dificulta revisão útil. PR 1 (I0a.0-9 + I0b.1-6) fecha e valida em beta antes de abrir PR 2 (I0a.10-14).

## I0b — Correção de `name` sujo para nome próprio por nó (precede I0a.2+)

**CORREÇÃO DE MODELO (mantenedor, 2026-07-09) — a versão anterior desta seção estava conceitualmente errada e foi substituída.** O mantenedor fixou a regra pétrea do catálogo: é uma árvore `sistema → edição → variante`, e **cada nó tem `name`, `name_pt` e `aliases` próprios e completos** — nenhum nível deriva ou herda nome do pai, nenhum campo guarda "sufixo". A versão anterior desta seção propunha cortar `name` para virar um sufixo (ex.: `"Dungeons & Dragons 5e"` → `"5e"`) e depois recompor no frontend concatenando `pai.name + filho.name` em tempo de exibição. Isso está errado: viola a regra de nome próprio por nó, e transformaria a árvore num modelo de "nome derivado" que o mantenedor explicitamente rejeitou.

**O que de fato está sujo (reexaminado sob o modelo correto):** os 573 nós (edition+variant) cujo `name` bate com `parent.name + ' ' + resto` não são "regulares esperando compor" — são **dado sujo real**, herança do script antigo `importSistemas.ts` (linha 111/140: `edName = `${sys.name} ${edition}``), que gravou o nome completo concatenado no campo `name` em vez do nome próprio daquele nível. Ex.: o nó que deveria se chamar `"2024"` (nome próprio da variante) está gravado como `"Dungeons & Dragons 5e 2024"`. Confirmado reexaminando a mesma amostra (2026-07-09): `"7th Sea 1999"` deveria ser só `"1999"`; `"Ars Magica 3e"` deveria ser só `"3e"`; `"Dungeons & Dragons 1e Basic Set, Mentzer version"` deveria ser só `"Basic Set, Mentzer version"`.

**Escala confirmada via query read-only em prod (`mesas-db`, 2026-07-09):** 688 `system`, 392 `edition`, 187 `variant`, 0 `subsystem`. Dos 579 nós com pai (edition+variant), **573 têm `name` sujo** (contém o prefixo do pai — extrair `substring` após o prefixo dá o nome próprio correto). **6 são irregulares** (não seguem nem esse padrão de contaminação, então não dá pra extrair automaticamente):

- `Vampire 1e/2e/5e/Anniversary` — pai é `"Vampiro"` (PT), filho é `"Vampire ..."` (EN); mesmo removendo o prefixo, sobra `"Vampire 1e"` etc., que ainda tem o nome do sistema embutido em outro idioma — precisa de revisão manual pra decidir o nome próprio real (`"1e"`? `"Vampire 1e"` como nome próprio mesmo, já que não é filho de "Vampire"?).
- `Dungeons & Dragons 3.0` (variant) com pai `Dungeons & Dragons 3.5e` — parece erro de hierarquia (3.0 não é variante de 3.5e), não só nome sujo; precisa revisão humana antes de decidir nome E pai.
- `Advanced Dungeons & Dragons` (edition) com pai `Dungeons & Dragons` — não contém o prefixo do pai; pode já ser nome próprio correto (rótulo genuíno "Advanced Dungeons & Dragons"), não necessariamente sujo — revisar antes de tocar.

**Escala confirmada via query read-only em beta (`mesas-beta-db`, 2026-07-09):** 697 `system`, 402 `edition`, 189 `variant`, 1 `subsystem`. Dos 592 nós com pai, **577 têm `name` sujo** pelo padrão de prefixo do pai e **15 são irregulares**. **D109:** esses dados beta/dev não competem com prod como fonte de verdade; servem para ensaio de migration, validação de deploy e detecção de diferenças operacionais. Curadoria canônica e fila manual principal derivam do snapshot prod. As diferenças beta só entram como fila de ensaio/ambiente quando necessário para validar `dev`.

**Plano aprovado pelo mantenedor (2026-07-09): executar com backup prévio.**

1. `pg_dump` completo de `mesas_rpg` (prod) antes de qualquer escrita — read-only, sem aprovação extra necessária (dump é leitura); salvar em `C:\projetos\artificiobackup` conforme guardrail do Gate A.
2. Migration `manual-risk` (não é `online-safe`: altera dado semântico usado por FK de mesas ativas) com os 5 campos de header obrigatórios.
3. Para os 573 casos contaminados: `UPDATE systems SET name = substring(name from length(parent.name) + 2) WHERE left(child.name, length(parent.name) + 1) = parent.name || ' '` (ou equivalente em script de migration, não SQL solto) — o resultado passa a ser o **nome próprio definitivo** desse nó, não um "sufixo temporário"; validar que o resultado não fica vazio antes de aplicar. A atomicidade vem do runner oficial (`apply_required_migrations.sh`), que envolve cada arquivo em `BEGIN`/`COMMIT` junto do registro em `schema_migrations`; a migration não deve abrir transação interna.
4. Para os 6 irregulares de prod, a fila manual principal foi decidida pelo mantenedor (D110): `Advanced Dungeons & Dragons` é edição de `Dungeons & Dragons`; `Vampire` é nome inglês e `Vampiro` nome português do mesmo sistema; `Anniversary` tem PT `Aniversário`; `Dungeons & Dragons 3.0` e `Dungeons & Dragons 3.5e` são edições irmãs de `Dungeons & Dragons`, não variante uma da outra. Para os 15 irregulares de beta: fila operacional de ensaio, sem autoridade sobre o catálogo real. Nenhuma correção automática fora do padrão seguro I0b.3.
5. **Exibição não compõe nada — só percorre a árvore.** `useSystemsCatalog()` mostra a árvore de verdade (nó com filhos expansíveis, cada nível com seu `name`/`name_pt`/`aliases` próprios visíveis). Quando uma tela precisa de 1 linha de texto (ex.: chip de seleção, resultado de busca), o label é a concatenação dos nomes próprios de cada nível no caminho selecionado (`sistema.name + ' ' + edicao.name + ' ' + variante.name`) — não existe campo derivado nem lógica de "sufixo do pai": é o mesmo texto que apareceria se você navegasse a árvore e lesse os 3 nomes em sequência.
6. Dry-run em beta primeiro (beta tem 1.289 nós, ligeiramente diferente de prod — não assumir que a mesma % de contaminados/irregulares se repete; rodar a mesma query de auditoria em beta antes de aplicar).
7. Rollback: restaurar do dump se a correção quebrar exibição em produção; nenhuma remoção de coluna, só update de `name` — reversível por dump.
8. **Disponibilidade durante a migration:** a app fica no ar durante o `UPDATE` — 573 linhas na transação do runner é operação rápida, sem janela de manutenção. Isolamento `READ COMMITTED` do Postgres garante que ninguém vê estado misto durante a transação.

**Gate duro de sincronização migration↔frontend:** antes da correção, `name` de nó contaminado inclui o prefixo do pai; depois, só o nome próprio. Se o deploy do frontend (que exibe `name` direto, sem mais compor nada) não for estritamente posterior à migration confirmada em cada ambiente, há janela de exibição incompleta: frontend exibindo árvore antes da correção mostra nome ainda contaminado (inofensivo, só feio); frontend novo lendo dado ainda não corrigido mostra a mesma coisa (também inofensivo — a diferença de I0b não é mais "duplicar texto", é só "ainda não ficou bonito"). Ordem por ambiente ainda recomendada por disciplina de deploy, mesmo sem o risco de duplicação anterior: (1) rodar I0b.1-4 em beta, confirmar via query, (2) smoke visual em beta, (3) repetir em prod só depois de aprovação explícita de promote+deploy prod (nenhuma automação — segue trava pétrea do AGENTS.md sobre promote nunca disparar deploy).

## I8 — `packages/catalog-ui`: unificar árvore + formulário de nó entre `mesas-frontend` e `site-admin` (mudança de decisão, 2026-07-11)

**Contexto que mudou a decisão anterior.** I6 (ver acima) tinha registrado achado do mantenedor (2026-07-10, pós-deploy PR #144) sobre o `SystemSuggestionModal.tsx` do Mesas não ter campos que o `CatalogSystemsPage.tsx` do site-admin já tinha (aliases, logo, website, criação de cadeia). Na época a decisão foi **rota 1** (ampliar só o formulário do Mesas, campo a campo, sem extrair pacote) — "menor prioridade" que os campos ausentes, avaliar rota 2 "só se o padrão se repetir num terceiro consumidor".

**O padrão se repetiu no próprio 2º consumidor, não no 3º — motivo pra reverter a decisão agora:** o mesmo bug de fundo (árvore inteira renderizada sem filtro, inutilizável com 1289 nós reais pós-import I2) apareceu de forma **independente** em dois lugares com lógica quase idêntica e implementações divergentes:

- `apps/mesas/frontend/src/components/SystemPicker.tsx` — corrigido nesta spec (PR #147): árvore em cascata por nível (sistema→edição→variante), busca só filtra raiz, sem busca não lista nada.
- `apps/site-admin/src/pages/CatalogSystemsPage.tsx` — mesmo sintoma (`filterTree` retorna a árvore inteira quando `query` vazia), ainda não corrigido; formulário de nó tem os campos completos (tipo, pai, nome, nome PT, slug, aliases, logo, website, descrição) que o Mesas não tem.

**Decisão do mantenedor (2026-07-11):** não são mais 2 fixes pontuais em lugares diferentes — é a mesma função (árvore navegável de catálogo + formulário de edição de nó com aliases por nível) duplicada com drift. Extrair pacote compartilhado agora, consumido por `mesas-frontend` e `site-admin`; corrigir/otimizar num local reflete nos dois. Isso reabre a rota 2 descartada em I6 — motivo documentado aqui para não re-decidir de novo no futuro.

**Escopo (SDD Completo — pacote novo em `packages/*`, trava do AGENTS.md):**

- Novo pacote `packages/catalog-ui` (nome provisório, confirmar disponibilidade/convenção antes de criar): componente de árvore em cascata (extraído de `SystemPicker.tsx`, mesmo comportamento validado na PR #147 — busca só filtra raiz, drill-down por nível, sem listar tudo sem busca) + formulário de edição/criação de nó com todos os campos que hoje só existem em `CatalogSystemsPage` (tipo, pai, nome, nome PT, slug, **aliases próprios por nível** — sistema tem os seus, edição os seus, variante os seus, sem herança —, logo, website oficial, descrição).
- **Fluxo de edição unificado exigido pelo mantenedor:** ao escolher/selecionar um nó em qualquer consumidor, o painel de edição completo (mesmo formulário do `CatalogSystemsPage` atual) deve aparecer, permitindo editar todos os campos incluindo aliases daquele nível específico — não só nome/seleção como o `SystemPicker` faz hoje no Mesas.
- `mesas-frontend` (`SystemPicker.tsx` e os 6 consumidores dele) e `site-admin` (`CatalogSystemsPage.tsx`) passam a consumir o pacote novo; lógica de árvore/busca/formulário sai dos apps e vive só no pacote.
- Cada app mantém as diferenças de **contexto de uso** (papéis `admin`/`user`, ação de sugerir vs. criar direto, integração com `SystemSuggestionModal`, estilos por design system de cada app se necessário) — a lógica compartilhada é a estrutura de dado/árvore/formulário, não a casca visual de cada app.
- Requer `spec.md`/`plan.md`/`tasks.md` formais de SDD Completo (mudança em pacote compartilhado) antes de codar — este registro em plan.md/tasks.md da própria 062 cobre a decisão e o escopo; detalhamento fase-a-fase entra em tasks.md abaixo.
- Migration de dados **não é necessária** — dado já vive no serviço central (I1/I2); é reorganização de código de apresentação/edição, sem tocar schema.

## Gates

- arquitetura aprovada antes da etapa de código — cumprido;
- IDs e mapa curados antes de consumidores;
- shadow/read beta antes de qualquer cutover;
- contagens, órfãos zero e equivalência antes de remover legado;
- rollback exercitado em beta;
- prod repete esteira canônica, sem snowflake.
